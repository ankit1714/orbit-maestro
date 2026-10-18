import logging
import requests
import re
from requests.auth import HTTPBasicAuth
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import uuid
from urllib.parse import urlparse

from apps.api.src.core.config import settings
from apps.api.src.core.providers.base import BaseBacklogProvider
from apps.api.src.core.providers.backlog.native_provider import NativeFirestoreBacklogProvider
from apps.api.src.core.firestore_client import db
from apps.api.src.schemas.backlog import Epic, UserStory, TaskItem, BacklogHierarchyResponse
from apps.api.src.schemas.sprint import Sprint, SprintCapacity

logger = logging.getLogger("jira_provider")

def clean_jira_instance_url(raw_url: Optional[str]) -> str:
    """
    Sanitizes Jira instance URL to guarantee it points strictly to scheme + netloc base.
    Prevents appended UI paths like /jira/software/projects/... or /browse/...
    which cause Jira SPA to return HTML 200 instead of REST JSON responses.
    """
    if not raw_url or not str(raw_url).strip():
        return ""
    clean = str(raw_url).strip()
    if not clean.startswith(("http://", "https://")):
        clean = "https://" + clean
    try:
        parsed = urlparse(clean)
        if parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
    except Exception:
        pass
    return clean.rstrip("/")

def safe_err_text(res: Optional[requests.Response], max_len: int = 250) -> str:
    """Extracts a concise, single-line error message from a requests Response object without dumping HTML bodies."""
    if res is None:
        return "No response"
    try:
        data = res.json()
        if isinstance(data, dict):
            err_msgs = data.get("errorMessages") or []
            errors = data.get("errors") or {}
            combined = []
            if err_msgs:
                combined.extend(err_msgs)
            if errors:
                combined.extend([f"{k}: {v}" for k, v in errors.items()])
            if combined:
                return "; ".join(combined)[:max_len]
            if "message" in data:
                return str(data["message"])[:max_len]
    except Exception:
        pass
    text = (res.text or "").strip()
    if "<html" in text.lower() or "<!doctype" in text.lower():
        title_match = re.search(r"<title[^>]*>(.*?)</title>", text, re.IGNORECASE)
        title = title_match.group(1).strip() if title_match else "HTML Response"
        return f"[{title}] HTTP {res.status_code}"
    clean = re.sub(r"\s+", " ", text)
    return clean[:max_len]

def parse_jira_datetime(dt_str: Optional[str]) -> datetime:
    """Safely parse Jira ISO timestamps into datetime."""
    if not dt_str:
        return datetime.utcnow()
    try:
        clean = dt_str.replace("Z", "+00:00")
        return datetime.fromisoformat(clean)
    except Exception:
        return datetime.utcnow()

def adf_to_plain_text(doc: Any) -> str:
    """Extract plain readable markdown/text from Atlassian Document Format (ADF) or strings."""
    if not doc:
        return ""
    if isinstance(doc, str):
        return doc

    def extract_node(node: Any) -> str:
        if not node or not isinstance(node, dict):
            return ""
        ntype = node.get("type", "")
        if ntype == "text":
            return node.get("text", "")

        child_texts = [extract_node(child) for child in node.get("content", [])]
        joined = "".join(child_texts)

        if ntype in ["paragraph", "heading"]:
            return f"\n{joined}\n"
        elif ntype == "listItem":
            return f"\n- {joined.strip()}"
        elif ntype == "codeBlock":
            return f"\n```\n{joined.strip()}\n```\n"
        return joined

    if isinstance(doc, dict):
        result = extract_node(doc)
        return re.sub(r"\n{3,}", "\n\n", result).strip()
    return ""

class JiraBacklogProvider(BaseBacklogProvider):
    def __init__(
        self,
        instance_url: Optional[str] = None,
        user_email: Optional[str] = None,
        api_token: Optional[str] = None,
        project_key: Optional[str] = None
    ):
        self.instance_url = clean_jira_instance_url(instance_url or settings.JIRA_INSTANCE_URL)
        self.user_email = user_email or settings.JIRA_USER_EMAIL
        self.api_token = api_token or settings.JIRA_API_TOKEN
        self.project_key = (project_key or "SCRUM").upper()
        self.account_id: Optional[str] = None
        self._fallback = NativeFirestoreBacklogProvider()

    def _is_configured(self) -> bool:
        return bool(self.instance_url and self.user_email and self.api_token)

    def _get_auth(self) -> Optional[HTTPBasicAuth]:
        if not self._is_configured():
            return None
        return HTTPBasicAuth(self.user_email, self.api_token)

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }

    def _ensure_account_id(self) -> Optional[str]:
        """Fetch and cache Jira user accountId required for reporter and transition fields."""
        if not self.account_id and self._is_configured():
            try:
                url = f"{self.instance_url}/rest/api/3/myself"
                res = requests.get(url, headers=self._get_headers(), auth=self._get_auth(), timeout=8)
                if res.status_code == 200:
                    ctype = res.headers.get("content-type", "")
                    if "application/json" in ctype:
                        self.account_id = res.json().get("accountId")
                    else:
                        logger.warning(f"Jira /rest/api/3/myself returned non-JSON response ({ctype}): {safe_err_text(res)}")
                else:
                    logger.warning(f"Jira /rest/api/3/myself returned {res.status_code}: {safe_err_text(res)}")
            except Exception as e:
                logger.warning(f"Could not retrieve Jira accountId: {e}")
        return self.account_id

    def fetch_jira_users(self) -> List[Dict[str, Any]]:
        """
        Fetches assignable users for the project directly from Jira Cloud.
        Returns a list of dicts: accountId, displayName, emailAddress, active.
        """
        if not self._is_configured():
            return []

        target_key = (self.project_key or "SCRUM").upper()
        # 1. Try assignable search by project
        try:
            url = f"{self.instance_url}/rest/api/3/user/assignable/search"
            params = {"project": target_key, "maxResults": 50}
            res = requests.get(url, headers=self._get_headers(), params=params, auth=self._get_auth(), timeout=8)
            if res.status_code == 200:
                users = res.json()
                assignable = [
                    {
                        "accountId": u.get("accountId"),
                        "displayName": u.get("displayName"),
                        "emailAddress": u.get("emailAddress"),
                        "active": u.get("active", True),
                    }
                    for u in users
                    if u.get("accountType") != "app" and u.get("active", True)
                ]
                if assignable:
                    logger.info(f"Fetched {len(assignable)} assignable users from Jira Cloud for project {target_key}")
                    self._cached_jira_users = assignable
                    return assignable
        except Exception as e:
            logger.debug(f"Jira assignable user search error: {e}")

        # 2. Try general user search
        try:
            url_fallback = f"{self.instance_url}/rest/api/3/users/search"
            res = requests.get(url_fallback, headers=self._get_headers(), params={"maxResults": 50}, auth=self._get_auth(), timeout=8)
            if res.status_code == 200:
                users = res.json()
                assignable = [
                    {
                        "accountId": u.get("accountId"),
                        "displayName": u.get("displayName"),
                        "emailAddress": u.get("emailAddress"),
                        "active": u.get("active", True),
                    }
                    for u in users
                    if u.get("accountType") != "app" and u.get("active", True)
                ]
                self._cached_jira_users = assignable
                return assignable
        except Exception as e:
            logger.debug(f"Jira users search error: {e}")

        return []

    def _find_jira_account_id(self, assignee_name_or_email: Optional[str]) -> Optional[str]:
        """Resolves an engineer's name or email to a Jira accountId."""
        if not assignee_name_or_email or not self._is_configured():
            return None
        target = assignee_name_or_email.strip().lower()

        users = getattr(self, "_cached_jira_users", None) or self.fetch_jira_users()

        for u in users:
            d_name = (u.get("displayName") or "").lower()
            email = (u.get("emailAddress") or "").lower()
            if target == d_name or target == email:
                return u.get("accountId")
            if target in d_name or d_name in target:
                return u.get("accountId")

        # If connected Jira user's email matches
        if self.user_email and (target in self.user_email.lower() or self.user_email.lower() in target):
            return self._ensure_account_id()

        return None

    def check_connection(self) -> Dict[str, Any]:
        """Verify Jira credentials and connectivity via /rest/api/3/myself."""
        if not self._is_configured():
            return {
                "connected": False,
                "error": "Jira credentials not fully configured (missing URL, email, or token)."
            }
        try:
            url = f"{self.instance_url}/rest/api/3/myself"
            res = requests.get(url, headers=self._get_headers(), auth=self._get_auth(), timeout=8)
            if res.status_code == 200:
                data = res.json()
                self.account_id = data.get("accountId")
                return {
                    "connected": True,
                    "instance_url": self.instance_url,
                    "project_key": self.project_key,
                    "display_name": data.get("displayName"),
                    "email": data.get("emailAddress"),
                    "account_id": self.account_id,
                    "time_zone": data.get("timeZone")
                }
            return {
                "connected": False,
                "status_code": res.status_code,
                "error": res.text
            }
        except Exception as e:
            logger.error(f"Failed to connect to Jira instance {self.instance_url}: {e}")
            return {"connected": False, "error": str(e)}

    def fetch_all_issues_detailed(self, project_key: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Fetch all issues with 100% of their rich fields (descriptions, comments, subtasks,
        acceptance criteria, assignees, priorities) directly from Jira Cloud.
        """
        if not self._is_configured():
            logger.info("Jira credentials not configured; cannot fetch live detailed issues.")
            return []

        target_key = (project_key or self.project_key).upper()
        try:
            url = f"{self.instance_url}/rest/api/3/search/jql"
            jql = f"project = '{target_key}' ORDER BY created DESC"
            payload = {
                "jql": jql,
                "maxResults": 100,
                "fields": ["*all"]
            }
            res = requests.post(url, headers=self._get_headers(), json=payload, auth=self._get_auth(), timeout=12)
            if res.status_code != 200:
                logger.warning(f"Jira JQL search returned {res.status_code}: {res.text}")
                return []

            issues = res.json().get("issues", [])
            detailed_items = []
            for item in issues:
                key = item.get("key", "")
                fields = item.get("fields", {})
                it = fields.get("issuetype", {})
                it_name = it.get("name", "Task")
                summary = fields.get("summary", "Untitled")
                status_name = fields.get("status", {}).get("name", "To Do")
                desc_text = adf_to_plain_text(fields.get("description"))
                priority_name = fields.get("priority", {}).get("name", "Medium") if fields.get("priority") else "Medium"

                assignee = fields.get("assignee")
                assignee_name = assignee.get("displayName") if assignee else "Unassigned"
                assignee_email = assignee.get("emailAddress") if assignee else None

                reporter = fields.get("reporter")
                reporter_name = reporter.get("displayName") if reporter else "Unknown"

                # Comments
                comments_data = fields.get("comment", {}).get("comments", [])
                extracted_comments = []
                for c in comments_data:
                    c_author = c.get("author", {}).get("displayName", "User")
                    c_body = adf_to_plain_text(c.get("body"))
                    c_created = c.get("created", "")
                    if c_body:
                        extracted_comments.append({
                            "author": c_author,
                            "text": c_body,
                            "created_at": c_created
                        })

                # Subtasks
                subtasks_data = fields.get("subtasks", [])
                subtasks_list = []
                for st in subtasks_data:
                    subtasks_list.append({
                        "key": st.get("key"),
                        "summary": st.get("fields", {}).get("summary"),
                        "status": st.get("fields", {}).get("status", {}).get("name")
                    })

                points = fields.get("customfield_10016") or fields.get("story_points") or 0
                labels = fields.get("labels", [])
                components = [c.get("name") for c in fields.get("components", []) if isinstance(c, dict)]

                detailed_items.append({
                    "key": key,
                    "id": item.get("id", key),
                    "title": summary,
                    "type": it_name.upper(),
                    "status": status_name,
                    "priority": priority_name,
                    "assignee": assignee_name,
                    "assignee_email": assignee_email,
                    "reporter": reporter_name,
                    "description": desc_text,
                    "points": points,
                    "labels": labels,
                    "components": components,
                    "comments": extracted_comments,
                    "subtasks": subtasks_list,
                    "url": f"{self.instance_url}/browse/{key}",
                    "created_at": fields.get("created"),
                    "updated_at": fields.get("updated")
                })
            return detailed_items
        except Exception as e:
            logger.warning(f"Error fetching detailed Jira issues: {e}")
            return []

    def _build_adf_doc(self, text: str, extra_paragraphs: Optional[List[str]] = None) -> Dict[str, Any]:
        """Construct Atlassian Document Format (ADF) representation."""
        paragraphs = []
        if text:
            for line in text.split("\n\n"):
                if line.strip():
                    paragraphs.append({
                        "type": "paragraph",
                        "content": [{"type": "text", "text": line.strip()}]
                    })
        if not paragraphs:
            paragraphs.append({
                "type": "paragraph",
                "content": [{"type": "text", "text": text or "No description provided."}]
            })
        if extra_paragraphs:
            for p in extra_paragraphs:
                paragraphs.append({
                    "type": "paragraph",
                    "content": [{"type": "text", "text": p}]
                })
        return {
            "type": "doc",
            "version": 1,
            "content": paragraphs
        }

    def get_backlog(self, project_id: str) -> BacklogHierarchyResponse:
        """
        Fetch real-time backlog hierarchy directly from Jira Cloud without local database persistence.
        Reflects live status, assignee, created date, and last modified date.
        """
        if not self._is_configured():
            logger.info(f"Jira credentials not configured; falling back to native store for {project_id}.")
            return self._fallback.get_backlog(project_id)

        try:
            url = f"{self.instance_url}/rest/api/3/search/jql"
            jql = f"project = '{self.project_key}' ORDER BY created DESC"
            payload = {
                "jql": jql,
                "maxResults": 100,
                "fields": [
                    "summary", "status", "issuetype", "assignee", "description",
                    "customfield_10016", "parent", "created", "updated", "reporter", "subtasks",
                    "customfield_10020"
                ]
            }
            res = requests.post(url, headers=self._get_headers(), json=payload, auth=self._get_auth(), timeout=12)
            if res.status_code != 200:
                logger.warning(f"Jira JQL search returned {res.status_code}: {res.text}; falling back to Firestore.")
                return self._fallback.get_backlog(project_id)

            issues = res.json().get("issues", [])
            logger.info(f"Retrieved {len(issues)} live issues from Jira project {self.project_key}")

            epics_dict: Dict[str, Epic] = {}
            stories_dict: Dict[str, UserStory] = {}
            tasks_dict: Dict[str, TaskItem] = {}
            parent_story_map: Dict[str, str] = {} # task_key -> story_key
            parent_epic_map: Dict[str, str] = {}  # story_key -> epic_key

            # 1. Parse all issues into corresponding domain models
            for item in issues:
                key = item.get("key", "")
                fields = item.get("fields", {})
                it = fields.get("issuetype", {})
                it_name = it.get("name", "").lower()
                is_subtask = it.get("subtask", False)

                summary = fields.get("summary", "Untitled")
                status_name = fields.get("status", {}).get("name", "To Do")
                desc_text = adf_to_plain_text(fields.get("description")) or summary
                raw_pts = fields.get("customfield_10016")
                points = int(round(float(raw_pts))) if raw_pts is not None else None

                assignee = fields.get("assignee")
                assignee_name = assignee.get("displayName") if assignee else "Unassigned"
                assignee_email = assignee.get("emailAddress") if assignee else None

                created_dt = parse_jira_datetime(fields.get("created"))
                updated_dt = parse_jira_datetime(fields.get("updated"))
                jira_link = f"{self.instance_url}/browse/{key}"

                parent = fields.get("parent")
                parent_key = parent.get("key") if parent else None

                # Extract Jira sprint metadata if present
                sprint_id = None
                sprint_name = None
                raw_sprints = fields.get("customfield_10020") or fields.get("sprint")
                if isinstance(raw_sprints, dict):
                    raw_sprints = [raw_sprints]
                if raw_sprints and isinstance(raw_sprints, list) and len(raw_sprints) > 0:
                    active_sp = next((sp for sp in raw_sprints if isinstance(sp, dict) and sp.get("state") == "active"), raw_sprints[-1] if isinstance(raw_sprints[-1], dict) else None)
                    if active_sp and isinstance(active_sp, dict):
                        sprint_id = str(active_sp.get("id"))
                        sprint_name = active_sp.get("name")

                if it_name == "epic":
                    epics_dict[key] = Epic(
                        id=item.get("id", key),
                        key=key,
                        project_id=project_id,
                        title=summary,
                        description=desc_text,
                        requirement_origin=f"Jira Project: {self.project_key}",
                        total_points=0,
                        status=status_name,
                        stories=[],
                        created_at=created_dt,
                        updated_at=updated_dt,
                        jira_url=jira_link
                    )
                elif is_subtask or it_name in ["subtask", "sub-task"]:
                    task_type = "QA" if "[qa]" in summary.lower() or "qa" in summary.lower() else "DEV"
                    raw_sub_pts = fields.get("customfield_10016")
                    sub_pts = int(round(float(raw_sub_pts))) if raw_sub_pts is not None else None
                    tasks_dict[key] = TaskItem(
                        id=item.get("id", key),
                        key=key,
                        project_id=project_id,
                        story_id=parent_key or "",
                        title=summary,
                        task_type=task_type,
                        status=status_name,
                        assignee_name=assignee_name,
                        assignee_email=assignee_email,
                        effort_days=1.5,
                        story_points=sub_pts,
                        created_at=created_dt,
                        updated_at=updated_dt,
                        jira_url=jira_link,
                        sprint_id=sprint_id,
                        sprint_name=sprint_name
                    )
                    if parent_key:
                        parent_story_map[key] = parent_key
                else:
                    # Standard Story or standalone Task
                    stories_dict[key] = UserStory(
                        id=item.get("id", key),
                        key=key,
                        project_id=project_id,
                        epic_id=parent_key or "",
                        title=summary,
                        description=desc_text,
                        requirement_origin=f"Jira Issue: {key}",
                        story_points=points,
                        status=status_name,
                        assignee_name=assignee_name,
                        assignee_email=assignee_email,
                        skill_match_percentage=95,
                        tasks=[],
                        created_at=created_dt,
                        updated_at=updated_dt,
                        jira_url=jira_link,
                        sprint_id=sprint_id,
                        sprint_name=sprint_name
                    )
                    if parent_key:
                        parent_epic_map[key] = parent_key

            # 2. Attach subtasks to their parent stories (inheriting sprint metadata if missing)
            for t_key, t_item in tasks_dict.items():
                p_key = parent_story_map.get(t_key)
                if p_key and p_key in stories_dict:
                    parent_st = stories_dict[p_key]
                    t_item.sprint_id = t_item.sprint_id or parent_st.sprint_id
                    t_item.sprint_name = t_item.sprint_name or parent_st.sprint_name
                    parent_st.tasks.append(t_item)
                else:
                    # If subtask points directly to epic or standalone, create placeholder story
                    orphan_story_key = p_key or f"{t_key}-parent"
                    if orphan_story_key not in stories_dict:
                        stories_dict[orphan_story_key] = UserStory(
                            id=f"story-{orphan_story_key}",
                            key=orphan_story_key,
                            project_id=project_id,
                            epic_id="",
                            title=f"Stories under {orphan_story_key}",
                            description="Auto-grouped Jira subtasks",
                            requirement_origin="Jira",
                            story_points=None,
                            status="In Progress",
                            assignee_name=t_item.assignee_name,
                            tasks=[],
                            created_at=t_item.created_at,
                            updated_at=t_item.updated_at,
                            jira_url=f"{self.instance_url}/browse/{p_key}" if p_key else None,
                            sprint_id=t_item.sprint_id,
                            sprint_name=t_item.sprint_name
                        )
                    stories_dict[orphan_story_key].tasks.append(t_item)

            # 3. Attach stories to their parent epics
            unassigned_stories: List[UserStory] = []
            for s_key, s_item in stories_dict.items():
                p_epic = parent_epic_map.get(s_key)
                if p_epic and p_epic in epics_dict:
                    epics_dict[p_epic].stories.append(s_item)
                else:
                    unassigned_stories.append(s_item)

            # 4. If there are unassigned stories (e.g. SCRUM-1, SCRUM-2, SCRUM-3), group into General Backlog Epic
            if unassigned_stories:
                general_epic_key = f"{self.project_key}-GENERAL"
                epics_dict[general_epic_key] = Epic(
                    id=f"epic-{general_epic_key.lower()}",
                    key=general_epic_key,
                    project_id=project_id,
                    title="General Project Backlog",
                    description="Standalone Jira tasks, stories, and exploratory items not bound to a parent epic.",
                    requirement_origin=f"Jira Project: {self.project_key}",
                    total_points=sum((s.story_points or 0) for s in unassigned_stories),
                    status="Active",
                    stories=unassigned_stories,
                    created_at=min((s.created_at for s in unassigned_stories), default=datetime.utcnow()),
                    updated_at=max((s.updated_at for s in unassigned_stories), default=datetime.utcnow()),
                    jira_url=f"{self.instance_url}/jira/software/projects/{self.project_key}/boards"
                )

            # Recalculate totals
            total_stories_count = 0
            total_tasks_count = 0
            total_pts_count = 0

            for e in epics_dict.values():
                e.total_points = sum((s.story_points or 0) for s in e.stories)
                total_stories_count += len(e.stories)
                total_tasks_count += sum(len(s.tasks) for s in e.stories)
                total_pts_count += e.total_points

            return BacklogHierarchyResponse(
                project_id=project_id,
                source="JIRA",
                jira_instance_url=self.instance_url,
                jira_project_key=self.project_key,
                epics=list(epics_dict.values()),
                total_epics=len(epics_dict),
                total_stories=total_stories_count,
                total_tasks=total_tasks_count,
                total_points=total_pts_count
            )

        except Exception as e:
            logger.error(f"Failed to fetch live backlog from Jira: {e}", exc_info=True)
            return self._fallback.get_backlog(project_id)

    def get_active_sprint(self, project_id: str) -> Sprint:
        """
        Fetch active sprint directly from Jira Agile API without reading from or writing to local database.
        """
        if not self._is_configured():
            logger.info("Jira not configured, checking local fallback sprint.")
            # Local fallback
            docs = list(db.collection("sprints").where("project_id", "==", project_id).where("status", "==", "ACTIVE").stream())
            if docs:
                return Sprint(**docs[0].to_dict())
            now = datetime.utcnow()
            return Sprint(
                id="sprint-local-default",
                project_id=project_id,
                sprint_number=1,
                name="Sprint 1",
                goal="Baseline delivery",
                status="ACTIVE",
                planned_points=0,
                delivered_points=0,
                remaining_days=0,
                total_days=14,
                start_date=now,
                end_date=now,
                source="FIRESTORE"
            )

        try:
            # 1. Discover board for project
            url_boards = f"{self.instance_url}/rest/agile/1.0/board?projectKeyOrId={self.project_key}"
            res_b = requests.get(url_boards, headers=self._get_headers(), auth=self._get_auth(), timeout=8)
            board_id = None
            if res_b.status_code == 200:
                values = res_b.json().get("values", [])
                if values:
                    board_id = values[0].get("id")

            if not board_id and self.project_key.upper() == "IRIS":
                # Fallback to board 1 only for IRIS
                board_id = 1

            if board_id and project_id:
                try:
                    p_doc = db.collection("projects").document(project_id).get()
                    if p_doc.exists:
                        p_data = p_doc.to_dict()
                        if "jira_settings" in p_data and isinstance(p_data["jira_settings"], dict):
                            p_data["jira_settings"]["board_id"] = str(board_id)
                        else:
                            p_data["jira_settings"] = {"board_id": str(board_id)}
                        db.collection("projects").document(project_id).set(p_data)
                except Exception as ex:
                    logger.debug(f"Could not persist board_id {board_id} for {project_id}: {ex}")

            # 2. Discover active or future sprint for board
            active_sprint_data = None
            if board_id:
                url_sprints = f"{self.instance_url}/rest/agile/1.0/board/{board_id}/sprint"
                res_s = requests.get(url_sprints, headers=self._get_headers(), auth=self._get_auth(), timeout=8)
                if res_s.status_code == 200:
                    sprints = res_s.json().get("values", [])
                    active_sprint_data = next((s for s in sprints if s.get("state") == "active"), None)
                    if not active_sprint_data and sprints:
                        active_sprint_data = sprints[-1]

            if active_sprint_data:
                s_id = active_sprint_data.get("id")
                s_name = active_sprint_data.get("name", f"{self.project_key} Sprint")
                s_state = active_sprint_data.get("state", "active").upper()

                start_dt = parse_jira_datetime(active_sprint_data.get("startDate"))
                end_dt = parse_jira_datetime(active_sprint_data.get("endDate"))

                now_utc = datetime.now(timezone.utc)
                end_utc = end_dt.astimezone(timezone.utc) if end_dt.tzinfo else end_dt.replace(tzinfo=timezone.utc)
                start_utc = start_dt.astimezone(timezone.utc) if start_dt.tzinfo else start_dt.replace(tzinfo=timezone.utc)

                remaining_days = max(0, (end_utc - now_utc).days)
                total_days = max(1, (end_utc - start_utc).days)

                # 3. Fetch issues inside this sprint and project for capacity calculation
                issues_url = f"{self.instance_url}/rest/agile/1.0/sprint/{s_id}/issue?maxResults=100"
                res_i = requests.get(issues_url, headers=self._get_headers(), auth=self._get_auth(), timeout=8)
                committed_keys = []
                planned_pts = 0
                delivered_pts = 0

                if res_i.status_code == 200:
                    sp_issues = res_i.json().get("issues", [])
                    for i in sp_issues:
                        k = i.get("key")
                        if k:
                            committed_keys.append(k)
                        i_id = i.get("id")
                        if i_id:
                            committed_keys.append(str(i_id))
                        for sub in i.get("fields", {}).get("subtasks", []):
                            if sub.get("key"):
                                committed_keys.append(sub.get("key"))
                            if sub.get("id"):
                                committed_keys.append(str(sub.get("id")))
                        f = i.get("fields", {})
                        pts = int(f.get("customfield_10016") or 5)
                        planned_pts += pts
                        st_name = f.get("status", {}).get("name", "").lower()
                        if st_name in ["done", "completed", "closed", "resolved"]:
                            delivered_pts += pts

                # 4. Fetch all project issues from Jira to compute true live capacity loading
                search_url = f"{self.instance_url}/rest/api/3/search/jql"
                search_payload = {
                    "jql": f"project = '{self.project_key}' ORDER BY created DESC",
                    "maxResults": 100,
                    "fields": ["summary", "status", "issuetype", "assignee", "customfield_10016"]
                }
                res_search = requests.post(search_url, headers=self._get_headers(), json=search_payload, auth=self._get_auth(), timeout=8)
                all_jira_issues = res_search.json().get("issues", []) if res_search.status_code == 200 else []

                # Fetch project team members from Firestore
                proj_doc = db.collection("projects").document(project_id).get()
                proj_data = proj_doc.to_dict() if proj_doc.exists else {}
                reg_team = proj_data.get("team_members", [])

                fe_committed_hrs = 0.0
                be_committed_hrs = 0.0
                qa_committed_hrs = 0.0
                dev_workloads: Dict[str, Dict[str, Any]] = {}

                for ji in all_jira_issues:
                    jf = ji.get("fields", {})
                    jsum = jf.get("summary", "").lower()
                    is_sub = jf.get("issuetype", {}).get("subtask", False)
                    jpts = float(jf.get("customfield_10016") or (1.5 if is_sub else 5.0))
                    hrs = jpts * 6.0 if is_sub else jpts * 4.0

                    if "[qa]" in jsum or "qa" in jsum or "test" in jsum:
                        qa_committed_hrs += hrs
                    elif "[fe]" in jsum or "[ui]" in jsum or "view" in jsum or "page" in jsum or "ui" in jsum or "component" in jsum:
                        fe_committed_hrs += hrs
                    else:
                        be_committed_hrs += hrs

                    j_assignee = jf.get("assignee")
                    a_name = j_assignee.get("displayName") if j_assignee else "Unassigned"
                    if a_name not in dev_workloads:
                        dev_workloads[a_name] = {"tickets": 0, "points": 0.0, "hours": 0.0}
                    dev_workloads[a_name]["tickets"] += 1
                    dev_workloads[a_name]["points"] += jpts
                    dev_workloads[a_name]["hours"] += hrs

                # Assemble DeveloperCapacity list
                from apps.api.src.schemas.sprint import DeveloperCapacity
                developer_allocations: List[DeveloperCapacity] = []

                # First add registered team members from Firestore
                known_names = set()
                for m in reg_team:
                    m_name = m.get("name", "Developer")
                    known_names.add(m_name.lower())
                    matched_wl = next((wl for k, wl in dev_workloads.items() if m_name.lower() in k.lower()), None)
                    t_count = matched_wl["tickets"] if matched_wl else 0
                    t_pts = matched_wl["points"] if matched_wl else 0.0
                    t_hrs = matched_wl["hours"] if matched_wl else 0.0
                    avail_hrs = float(m.get("available_hours_per_week", 40.0)) * 2.0
                    load = round((t_hrs / max(avail_hrs, 1.0)) * 100, 1)

                    developer_allocations.append(DeveloperCapacity(
                        name=m_name,
                        role=m.get("role", "Developer"),
                        assigned_tickets_count=t_count,
                        assigned_story_points=t_pts,
                        allocated_hours=round(t_hrs, 1),
                        available_hours=avail_hrs,
                        load_pct=load,
                        status="OVERLOADED" if load > 100 else ("HIGH_LOAD" if load >= 85 else ("BALANCED" if load >= 50 else "HEALTHY"))
                    ))

                # Also add any active Jira assignees that weren't in registered team members
                for a_name, wl in dev_workloads.items():
                    if a_name != "Unassigned" and a_name.lower() not in known_names:
                        known_names.add(a_name.lower())
                        avail = 80.0
                        load = round((wl["hours"] / avail) * 100, 1)
                        developer_allocations.append(DeveloperCapacity(
                            name=a_name,
                            role="Jira Engineer",
                            assigned_tickets_count=wl["tickets"],
                            assigned_story_points=wl["points"],
                            allocated_hours=round(wl["hours"], 1),
                            available_hours=avail,
                            load_pct=load,
                            status="OVERLOADED" if load > 100 else ("HIGH_LOAD" if load >= 85 else ("BALANCED" if load >= 50 else "HEALTHY"))
                        ))

                # If no registered team members and no assigned Jira users, include authenticated user
                if not developer_allocations:
                    user_name = "ANKIT MAURYA" if "ankit" in (self.user_email or "").lower() else "Lead Developer"
                    developer_allocations.append(DeveloperCapacity(
                        name=user_name,
                        role="Scrum Lead / Developer",
                        assigned_tickets_count=len(all_jira_issues),
                        assigned_story_points=sum(float(ji.get("fields", {}).get("customfield_10016") or 1.5) for ji in all_jira_issues),
                        allocated_hours=round(fe_committed_hrs + be_committed_hrs + qa_committed_hrs, 1),
                        available_hours=80.0,
                        load_pct=round(((fe_committed_hrs + be_committed_hrs + qa_committed_hrs) / 80.0) * 100, 1),
                        status="BALANCED"
                    ))

                # Include unassigned queue if there are unassigned tickets and specific assigned developers exist
                if "Unassigned" in dev_workloads and dev_workloads["Unassigned"]["tickets"] > 0 and len(developer_allocations) > 1:
                    un_wl = dev_workloads["Unassigned"]
                    developer_allocations.append(DeveloperCapacity(
                        name="Unassigned Queue",
                        role="Pending Jira Allocation",
                        assigned_tickets_count=un_wl["tickets"],
                        assigned_story_points=un_wl["points"],
                        allocated_hours=round(un_wl["hours"], 1),
                        available_hours=80.0,
                        load_pct=round((un_wl["hours"] / 80.0) * 100, 1),
                        status="BALANCED"
                    ))

                # Calculate overall capacity figures
                total_avail_hours = sum(d.available_hours for d in developer_allocations) or 160.0
                total_comm_hours = sum(d.allocated_hours for d in developer_allocations) or (fe_committed_hrs + be_committed_hrs + qa_committed_hrs)
                overall_load = round((total_comm_hours / max(total_avail_hours, 1.0)) * 100, 1)

                frontend_avail = max(40.0, total_avail_hours * 0.35)
                backend_avail = max(60.0, total_avail_hours * 0.45)
                qa_avail = max(20.0, total_avail_hours * 0.20)

                capacity = SprintCapacity(
                    team_total_hours=round(total_avail_hours, 1),
                    committed_hours=round(total_comm_hours, 1),
                    overall_load_pct=min(overall_load, 150.0),
                    frontend_hours=round(frontend_avail, 1),
                    frontend_committed_hours=round(fe_committed_hrs, 1),
                    frontend_load_pct=round((fe_committed_hrs / frontend_avail) * 100, 1),
                    backend_hours=round(backend_avail, 1),
                    backend_committed_hours=round(be_committed_hrs, 1),
                    backend_load_pct=round((be_committed_hrs / backend_avail) * 100, 1),
                    qa_hours=round(qa_avail, 1),
                    qa_committed_hours=round(qa_committed_hrs, 1),
                    qa_load_pct=round((qa_committed_hrs / qa_avail) * 100, 1),
                    developer_allocations=developer_allocations
                )

                return Sprint(
                    id=f"jira-sprint-{s_id}",
                    project_id=project_id,
                    sprint_number=s_id,
                    name=s_name,
                    goal=active_sprint_data.get("goal") or f"Direct live sprint from Jira ({self.project_key})",
                    status=s_state,
                    planned_points=planned_pts,
                    delivered_points=delivered_pts,
                    remaining_days=remaining_days,
                    total_days=total_days,
                    start_date=start_dt,
                    end_date=end_dt,
                    committed_story_ids=committed_keys,
                    capacity=capacity,
                    source="JIRA",
                    jira_board_id=board_id,
                    jira_sprint_id=s_id
                )

        except Exception as e:
            logger.warning(f"Could not load sprint from Jira Agile API: {e}; returning live dynamic sprint.")

        now = datetime.utcnow()
        return Sprint(
            id=f"jira-sprint-{self.project_key.lower()}",
            project_id=project_id,
            sprint_number=1,
            name=f"{self.project_key} Sprint 1",
            goal=f"Live Jira Project {self.project_key}",
            status="ACTIVE",
            planned_points=0,
            delivered_points=0,
            remaining_days=0,
            total_days=14,
            start_date=now,
            end_date=now,
            source="JIRA"
        )

    def update_task_status(self, project_id: str, task_id: str, new_status: str) -> TaskItem:
        """
        Transitions issue status directly in Jira Cloud if task_id represents a Jira issue.
        Maps UI statuses ('TODO', 'IN_PROGRESS', 'DONE', etc.) to Jira workflow transition names.
        """
        if self._is_configured() and ("-" in task_id or task_id.isdigit()):
            try:
                # 1. Fetch available transitions
                trans_url = f"{self.instance_url}/rest/api/3/issue/{task_id}/transitions"
                res = requests.get(trans_url, headers=self._get_headers(), auth=self._get_auth(), timeout=8)
                if res.status_code == 200:
                    transitions = res.json().get("transitions", [])

                    # Normalize target status for matching
                    normalized_target = new_status.replace("_", " ").lower()

                    target_trans = None
                    for t in transitions:
                        t_name = t.get("name", "").lower()
                        to_name = t.get("to", {}).get("name", "").lower()
                        if normalized_target in t_name or normalized_target in to_name:
                            target_trans = t
                            break
                        if "done" in normalized_target and ("done" in t_name or "complete" in t_name or "close" in t_name):
                            target_trans = t
                            break
                        if "progress" in normalized_target and ("progress" in t_name or "develop" in t_name or "start" in t_name):
                            target_trans = t
                            break
                        if ("to do" in normalized_target or "todo" in normalized_target) and ("to do" in t_name or "backlog" in t_name or "open" in t_name or "reopen" in t_name):
                            target_trans = t
                            break

                    if target_trans:
                        t_payload = {"transition": {"id": target_trans["id"]}}
                        post_res = requests.post(trans_url, headers=self._get_headers(), json=t_payload, auth=self._get_auth(), timeout=8)
                        if post_res.status_code in [200, 204]:
                            logger.info(f"Successfully transitioned Jira issue {task_id} to '{target_trans.get('name')}'")

                # Fetch updated issue from Jira
                issue_url = f"{self.instance_url}/rest/api/3/issue/{task_id}"
                get_res = requests.get(issue_url, headers=self._get_headers(), auth=self._get_auth(), timeout=8)
                if get_res.status_code == 200:
                    i_data = get_res.json()
                    f = i_data.get("fields", {})
                    st_name = f.get("status", {}).get("name", new_status)
                    assignee = f.get("assignee")
                    return TaskItem(
                        id=i_data.get("id", task_id),
                        key=i_data.get("key", task_id),
                        project_id=project_id,
                        story_id=f.get("parent", {}).get("key", ""),
                        title=f.get("summary", ""),
                        task_type="DEV",
                        status=st_name,
                        assignee_name=assignee.get("displayName") if assignee else "Unassigned",
                        assignee_email=assignee.get("emailAddress") if assignee else None,
                        created_at=parse_jira_datetime(f.get("created")),
                        updated_at=parse_jira_datetime(f.get("updated")),
                        jira_url=f"{self.instance_url}/browse/{i_data.get('key', task_id)}"
                    )
            except Exception as e:
                logger.warning(f"Could not transition issue in Jira: {e}")

        # Fallback to local store
        return self._fallback.update_task_status(project_id, task_id, new_status)

    def create_epic(self, project_id: str, title: str, description: str, origin: str) -> Epic:
        """Create Epic natively in Firestore, and push to Jira."""
        epic = self._fallback.create_epic(project_id, title, description, origin)
        if self._is_configured():
            try:
                acc_id = self._ensure_account_id()
                url = f"{self.instance_url}/rest/api/3/issue"
                payload = {
                    "fields": {
                        "project": {"key": self.project_key},
                        "summary": title,
                        "description": self._build_adf_doc(description, [f"Requirement Trace: {origin}"]),
                        "issuetype": {"name": "Epic"}
                    }
                }
                if acc_id:
                    payload["fields"]["reporter"] = {"id": acc_id}

                res = requests.post(url, headers=self._get_headers(), json=payload, auth=self._get_auth(), timeout=10)
                if res.status_code == 201:
                    created_key = res.json().get("key")
                    epic.key = created_key
                    epic.jira_url = f"{self.instance_url}/browse/{created_key}"
                    db.collection("epics").document(epic.id).update({"key": created_key})
                    logger.info(f"Successfully created Jira Epic {created_key} for project {project_id}")
                else:
                    logger.warning(f"Jira Epic creation returned {res.status_code}: {res.text}")
            except Exception as e:
                logger.warning(f"Failed to push Epic to Jira: {e}")
        return epic

    def create_story(
        self,
        project_id: str,
        epic_id: str,
        title: str,
        description: str,
        points: int,
        ac_list: List[Dict[str, str]],
        assignee: Optional[str] = None,
        origin: Optional[str] = None
    ) -> UserStory:
        """Create User Story natively in Firestore, linking to Epic in Jira if available."""
        story = self._fallback.create_story(project_id, epic_id, title, description, points, ac_list, assignee, origin)
        if self._is_configured():
            try:
                acc_id = self._ensure_account_id()
                epic_doc = db.collection("epics").document(epic_id).get()
                epic_key = epic_doc.to_dict().get("key") if epic_doc.exists else None

                ac_texts = []
                if ac_list:
                    ac_texts.append("Acceptance Criteria (Gherkin):")
                    for ac in ac_list:
                        scenario = ac.get("scenario", "Scenario")
                        given = ac.get("given", "")
                        when = ac.get("when", "")
                        then = ac.get("then", "")
                        ac_texts.append(f"• {scenario} | Given {given} When {when} Then {then}")
                if origin:
                    ac_texts.append(f"Requirement Origin: {origin}")

                url = f"{self.instance_url}/rest/api/3/issue"
                payload = {
                    "fields": {
                        "project": {"key": self.project_key},
                        "summary": title,
                        "description": self._build_adf_doc(description, ac_texts),
                        "issuetype": {"name": "Story"}
                    }
                }
                if acc_id:
                    payload["fields"]["reporter"] = {"id": acc_id}
                if epic_key and "-" in epic_key:
                    payload["fields"]["parent"] = {"key": epic_key}

                if points:
                    payload["fields"]["customfield_10016"] = float(points)

                res = requests.post(url, headers=self._get_headers(), json=payload, auth=self._get_auth(), timeout=10)
                if res.status_code == 201:
                    created_key = res.json().get("key")
                    story.key = created_key
                    story.jira_url = f"{self.instance_url}/browse/{created_key}"
                    db.collection("stories").document(story.id).update({"key": created_key})
                    logger.info(f"Successfully created Jira Story {created_key} (Parent: {epic_key})")
                elif res.status_code == 400 and "customfield_10016" in res.text:
                    del payload["fields"]["customfield_10016"]
                    res2 = requests.post(url, headers=self._get_headers(), json=payload, auth=self._get_auth(), timeout=10)
                    if res2.status_code == 201:
                        created_key = res2.json().get("key")
                        story.key = created_key
                        story.jira_url = f"{self.instance_url}/browse/{created_key}"
                        db.collection("stories").document(story.id).update({"key": created_key})
                        logger.info(f"Created Jira Story {created_key} on retry without story points field")
                else:
                    logger.warning(f"Jira Story creation returned {res.status_code}: {res.text}")
            except Exception as e:
                logger.warning(f"Failed to push Story to Jira: {e}")
        return story

    def create_task(
        self,
        project_id: str,
        story_id: str,
        title: str,
        task_type: str,
        effort_days: float,
        assignee: Optional[str] = None,
        trace_ref: Optional[str] = None
    ) -> TaskItem:
        """Create Task / Subtask in Firestore and in Jira under the parent Story."""
        task = self._fallback.create_task(project_id, story_id, title, task_type, effort_days, assignee, trace_ref)
        if self._is_configured():
            try:
                acc_id = self._ensure_account_id()
                story_doc = db.collection("stories").document(story_id).get()
                story_key = story_doc.to_dict().get("key") if story_doc.exists else None

                url = f"{self.instance_url}/rest/api/3/issue"
                summary_text = f"[{task_type}] {title}"
                details = [
                    f"Trace Ref: {trace_ref or 'AC-1'}",
                    f"Estimated Effort: {effort_days} day(s)",
                    f"Assigned: {assignee or 'Engineer'}"
                ]

                # Attempt creation as Jira Subtask
                if story_key and "-" in story_key:
                    for subtask_name in ["Subtask", "Sub-task"]:
                        payload = {
                            "fields": {
                                "project": {"key": self.project_key},
                                "summary": summary_text,
                                "description": self._build_adf_doc(title, details),
                                "issuetype": {"name": subtask_name},
                                "parent": {"key": story_key}
                            }
                        }
                        if acc_id:
                            payload["fields"]["reporter"] = {"id": acc_id}

                        res = requests.post(url, headers=self._get_headers(), json=payload, auth=self._get_auth(), timeout=10)
                        if res.status_code == 201:
                            created_key = res.json().get("key")
                            task.key = created_key
                            task.jira_url = f"{self.instance_url}/browse/{created_key}"
                            db.collection("tasks").document(task.id).update({"key": created_key})
                            logger.info(f"Created Jira Subtask {created_key} under {story_key}")
                            return task

                # Fallback to standard Task if no parent or Subtask rejected
                payload_task = {
                    "fields": {
                        "project": {"key": self.project_key},
                        "summary": summary_text,
                        "description": self._build_adf_doc(title, details),
                        "issuetype": {"name": "Task"}
                    }
                }
                if acc_id:
                    payload_task["fields"]["reporter"] = {"id": acc_id}

                res_task = requests.post(url, headers=self._get_headers(), json=payload_task, auth=self._get_auth(), timeout=10)
                if res_task.status_code == 201:
                    created_key = res_task.json().get("key")
                    task.key = created_key
                    task.jira_url = f"{self.instance_url}/browse/{created_key}"
                    db.collection("tasks").document(task.id).update({"key": created_key})
                    logger.info(f"Created Jira Task {created_key}")
            except Exception as e:
                logger.warning(f"Failed to push Task to Jira: {e}")
        return task

    def upload_project_backlog(self, project_id: str, target_project_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Upload an existing Firestore backlog hierarchy (Epics -> Stories -> Tasks) to Jira.
        Updates each item's key in Firestore with the live Jira issue key and returns a report.
        """
        if not self._is_configured():
            raise ValueError(
                "Jira credentials not configured. Please verify JIRA_INSTANCE_URL, JIRA_USER_EMAIL, and JIRA_API_TOKEN."
            )

        project_key = (target_project_key or self.project_key).upper()
        auth = self._get_auth()
        headers = self._get_headers()
        url = f"{self.instance_url}/rest/api/3/issue"
        acc_id = self._ensure_account_id()

        epic_docs = list(db.collection("epics").where("project_id", "==", project_id).stream())
        story_docs = list(db.collection("stories").where("project_id", "==", project_id).stream())
        task_docs = list(db.collection("tasks").where("project_id", "==", project_id).stream())

        synced_epics = []
        synced_stories = []
        synced_tasks = []
        errors = []

        tasks_by_story: Dict[str, List[Any]] = {}
        for td in task_docs:
            t_data = td.to_dict()
            tasks_by_story.setdefault(t_data.get("story_id"), []).append((td.id, t_data))

        stories_by_epic: Dict[str, List[Any]] = {}
        for sd in story_docs:
            s_data = sd.to_dict()
            stories_by_epic.setdefault(s_data.get("epic_id"), []).append((sd.id, s_data))

        # Upload Epics
        for ed in epic_docs:
            epic_id = ed.id
            epic_data = ed.to_dict()
            current_key = epic_data.get("key", "")
            title = epic_data.get("title", "Untitled Epic")
            desc = epic_data.get("description", "")
            origin = epic_data.get("requirement_origin", "PRD")

            jira_epic_key = current_key if (current_key and current_key.startswith(f"{project_key}-")) else None

            if not jira_epic_key:
                try:
                    payload = {
                        "fields": {
                            "project": {"key": project_key},
                            "summary": title,
                            "description": self._build_adf_doc(desc, [f"Requirement Trace: {origin}"]),
                            "issuetype": {"name": "Epic"}
                        }
                    }
                    if acc_id:
                        payload["fields"]["reporter"] = {"id": acc_id}

                    res = requests.post(url, headers=headers, json=payload, auth=auth, timeout=12)
                    if res.status_code == 201:
                        jira_epic_key = res.json().get("key")
                        db.collection("epics").document(epic_id).update({"key": jira_epic_key})
                        logger.info(f"Uploaded Jira Epic {jira_epic_key}: '{title}'")
                    else:
                        errors.append(f"Epic '{title}' failed ({res.status_code}): {res.text}")
                except Exception as e:
                    errors.append(f"Epic '{title}' error: {e}")

            if jira_epic_key:
                synced_epics.append({
                    "id": epic_id,
                    "key": jira_epic_key,
                    "title": title,
                    "url": f"{self.instance_url}/browse/{jira_epic_key}"
                })

            # Upload Stories under this Epic
            stories = stories_by_epic.get(epic_id, [])
            for story_id, story_data in stories:
                s_key = story_data.get("key", "")
                s_title = story_data.get("title", "Untitled Story")
                s_desc = story_data.get("description", "")
                s_points = story_data.get("story_points", 5)
                s_acs = story_data.get("acceptance_criteria", [])
                s_origin = story_data.get("requirement_origin", origin)

                jira_story_key = s_key if (s_key and s_key.startswith(f"{project_key}-")) else None

                if not jira_story_key:
                    try:
                        ac_texts = []
                        if s_acs:
                            ac_texts.append("Acceptance Criteria (Gherkin):")
                            for ac in s_acs:
                                if isinstance(ac, dict):
                                    ac_texts.append(f"• {ac.get('scenario', 'Criterion')}: Given {ac.get('given', '')} When {ac.get('when', '')} Then {ac.get('then', '')}")
                                else:
                                    ac_texts.append(f"• {ac}")
                        if s_origin:
                            ac_texts.append(f"Requirement Origin: {s_origin}")

                        s_payload = {
                            "fields": {
                                "project": {"key": project_key},
                                "summary": s_title,
                                "description": self._build_adf_doc(s_desc, ac_texts),
                                "issuetype": {"name": "Story"}
                            }
                        }
                        if acc_id:
                            s_payload["fields"]["reporter"] = {"id": acc_id}
                        if jira_epic_key:
                            s_payload["fields"]["parent"] = {"key": jira_epic_key}
                        if s_points:
                            s_payload["fields"]["customfield_10016"] = float(s_points)

                        s_res = requests.post(url, headers=headers, json=s_payload, auth=auth, timeout=12)
                        if s_res.status_code == 201:
                            jira_story_key = s_res.json().get("key")
                            db.collection("stories").document(story_id).update({"key": jira_story_key})
                            logger.info(f"Uploaded Jira Story {jira_story_key}: '{s_title}'")
                        elif s_res.status_code == 400 and "customfield_10016" in s_res.text:
                            del s_payload["fields"]["customfield_10016"]
                            s_res2 = requests.post(url, headers=headers, json=s_payload, auth=auth, timeout=12)
                            if s_res2.status_code == 201:
                                jira_story_key = s_res2.json().get("key")
                                db.collection("stories").document(story_id).update({"key": jira_story_key})
                                logger.info(f"Uploaded Jira Story {jira_story_key} (without points)")
                            else:
                                errors.append(f"Story '{s_title}' retry failed: {s_res2.text}")
                        else:
                            errors.append(f"Story '{s_title}' failed ({s_res.status_code}): {s_res.text}")
                    except Exception as e:
                        errors.append(f"Story '{s_title}' error: {e}")

                if jira_story_key:
                    synced_stories.append({
                        "id": story_id,
                        "key": jira_story_key,
                        "title": s_title,
                        "points": s_points,
                        "parent_epic": jira_epic_key,
                        "url": f"{self.instance_url}/browse/{jira_story_key}"
                    })

                # Upload Tasks under this Story
                tasks = tasks_by_story.get(story_id, [])
                for task_id, task_data in tasks:
                    t_key = task_data.get("key", "")
                    t_title = task_data.get("title", "Task")
                    t_type_raw = task_data.get("task_type", "DEV")
                    t_type = t_type_raw.value if hasattr(t_type_raw, "value") else str(t_type_raw).split(".")[-1]
                    t_effort = task_data.get("effort_days", 1.5)
                    t_assignee = task_data.get("assignee_name", "Developer")
                    t_trace = task_data.get("trace_ref", "AC-1")

                    jira_task_key = t_key if (t_key and t_key.startswith(f"{project_key}-")) else None

                    if not jira_task_key:
                        try:
                            t_details = [
                                f"Trace Ref: {t_trace}",
                                f"Effort: {t_effort} days",
                                f"Assignee: {t_assignee}"
                            ]
                            if jira_story_key:
                                for sub_type in ["Subtask", "Sub-task"]:
                                    t_payload = {
                                        "fields": {
                                            "project": {"key": project_key},
                                            "summary": f"[{t_type}] {t_title}",
                                            "description": self._build_adf_doc(t_title, t_details),
                                            "issuetype": {"name": sub_type},
                                            "parent": {"key": jira_story_key}
                                        }
                                    }
                                    if acc_id:
                                        t_payload["fields"]["reporter"] = {"id": acc_id}

                                    t_res = requests.post(url, headers=headers, json=t_payload, auth=auth, timeout=12)
                                    if t_res.status_code == 201:
                                        jira_task_key = t_res.json().get("key")
                                        db.collection("tasks").document(task_id).update({"key": jira_task_key})
                                        logger.info(f"Uploaded Jira Subtask {jira_task_key}: '{t_title}'")
                                        break

                            if not jira_task_key:
                                t_payload_task = {
                                    "fields": {
                                        "project": {"key": project_key},
                                        "summary": f"[{t_type}] {t_title}",
                                        "description": self._build_adf_doc(t_title, t_details),
                                        "issuetype": {"name": "Task"}
                                    }
                                }
                                if acc_id:
                                    t_payload_task["fields"]["reporter"] = {"id": acc_id}

                                t_res2 = requests.post(url, headers=headers, json=t_payload_task, auth=auth, timeout=12)
                                if t_res2.status_code == 201:
                                    jira_task_key = t_res2.json().get("key")
                                    db.collection("tasks").document(task_id).update({"key": jira_task_key})
                                    logger.info(f"Uploaded Jira Task {jira_task_key}: '{t_title}'")
                                else:
                                    errors.append(f"Task '{t_title}' failed ({t_res2.status_code}): {t_res2.text}")
                        except Exception as e:
                            errors.append(f"Task '{t_title}' error: {e}")

                    if jira_task_key:
                        synced_tasks.append({
                            "id": task_id,
                            "key": jira_task_key,
                            "title": t_title,
                            "type": t_type,
                            "parent_story": jira_story_key,
                            "url": f"{self.instance_url}/browse/{jira_task_key}"
                        })

        try:
            log_id = f"act-sync-{uuid.uuid4().hex[:8]}"
            db.collection("activity_logs").document(log_id).set({
                "id": log_id,
                "project_id": project_id,
                "action_type": "BACKLOG_UPLOADED_TO_JIRA",
                "actor": self.user_email or "AI Scrum Master",
                "description": f"Uploaded backlog to Jira project {project_key}: {len(synced_epics)} Epics, {len(synced_stories)} Stories, {len(synced_tasks)} Tasks.",
                "target_entity": f"Jira Project {project_key}",
                "timestamp": datetime.utcnow()
            })
        except Exception as e:
            logger.warning(f"Failed to record audit activity: {e}")

        return {
            "status": "SUCCESS" if (synced_epics or synced_stories or synced_tasks) else "NO_ITEMS_SYNCED",
            "project_id": project_id,
            "jira_project_key": project_key,
            "jira_instance_url": self.instance_url,
            "total_epics_synced": len(synced_epics),
            "total_stories_synced": len(synced_stories),
            "total_tasks_synced": len(synced_tasks),
            "epics": synced_epics,
            "stories": synced_stories,
            "tasks": synced_tasks,
            "errors": errors
        }
