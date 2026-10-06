import logging
import requests
from requests.auth import HTTPBasicAuth
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid

from apps.api.src.core.config import settings
from apps.api.src.core.providers.base import BaseBacklogProvider
from apps.api.src.core.providers.backlog.native_provider import NativeFirestoreBacklogProvider
from apps.api.src.core.firestore_client import db
from apps.api.src.schemas.backlog import Epic, UserStory, TaskItem, BacklogHierarchyResponse

logger = logging.getLogger("jira_provider")

class JiraBacklogProvider(BaseBacklogProvider):
    def __init__(
        self,
        instance_url: Optional[str] = None,
        user_email: Optional[str] = None,
        api_token: Optional[str] = None,
        project_key: Optional[str] = None
    ):
        self.instance_url = (instance_url or settings.JIRA_INSTANCE_URL or "").rstrip("/")
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
        """Fetch and cache Jira user accountId required for reporter fields."""
        if not self.account_id and self._is_configured():
            try:
                url = f"{self.instance_url}/rest/api/3/myself"
                res = requests.get(url, headers=self._get_headers(), auth=self._get_auth(), timeout=8)
                if res.status_code == 200:
                    self.account_id = res.json().get("accountId")
            except Exception as e:
                logger.warning(f"Could not retrieve Jira accountId: {e}")
        return self.account_id

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
        """Fetch backlog hierarchy from Jira if configured; syncs or falls back to native store."""
        if not self._is_configured():
            logger.info(f"Jira credentials not configured for project {project_id}; using native provider.")
            return self._fallback.get_backlog(project_id)

        try:
            url = f"{self.instance_url}/rest/api/3/search/jql"
            jql = f"project = '{self.project_key}' ORDER BY created DESC"
            payload = {
                "jql": jql,
                "maxResults": 50,
                "fields": ["summary", "status", "issuetype", "assignee", "description", "customfield_10016", "parent"]
            }
            res = requests.post(url, headers=self._get_headers(), json=payload, auth=self._get_auth(), timeout=8)
            if res.status_code == 200:
                issues = res.json().get("issues", [])
                logger.info(f"Retrieved {len(issues)} issues from Jira for {self.project_key}.")
            else:
                logger.warning(f"Jira search returned {res.status_code}: {res.text}")
        except Exception as e:
            logger.warning(f"Failed to query Jira REST API: {e}; falling back to Firestore cache.")

        return self._fallback.get_backlog(project_id)

    def create_epic(self, project_id: str, title: str, description: str, origin: str) -> Epic:
        """Create Epic natively in Firestore, and optionally push to Jira."""
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
                # Find parent epic key
                epic_doc = db.collection("epics").document(epic_id).get()
                epic_key = epic_doc.to_dict().get("key") if epic_doc.exists else None

                # Format Acceptance criteria for ADF
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

                # Set story points if available
                if points:
                    payload["fields"]["customfield_10016"] = float(points)

                res = requests.post(url, headers=self._get_headers(), json=payload, auth=self._get_auth(), timeout=10)
                if res.status_code == 201:
                    created_key = res.json().get("key")
                    story.key = created_key
                    db.collection("stories").document(story.id).update({"key": created_key})
                    logger.info(f"Successfully created Jira Story {created_key} (Parent: {epic_key})")
                elif res.status_code == 400 and "customfield_10016" in res.text:
                    del payload["fields"]["customfield_10016"]
                    res2 = requests.post(url, headers=self._get_headers(), json=payload, auth=self._get_auth(), timeout=10)
                    if res2.status_code == 201:
                        created_key = res2.json().get("key")
                        story.key = created_key
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
        """Create Task / Subtask natively in Firestore and in Jira under the parent Story."""
        task = self._fallback.create_task(project_id, story_id, title, task_type, effort_days, assignee, trace_ref)
        if self._is_configured():
            try:
                acc_id = self._ensure_account_id()
                # Find parent story key
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
                    db.collection("tasks").document(task.id).update({"key": created_key})
                    logger.info(f"Created Jira Task {created_key}")
            except Exception as e:
                logger.warning(f"Failed to push Task to Jira: {e}")
        return task

    def update_task_status(self, project_id: str, task_id: str, new_status: str) -> TaskItem:
        return self._fallback.update_task_status(project_id, task_id, new_status)

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

        # 1. Fetch epics, stories, and tasks for project
        epic_docs = list(db.collection("epics").where("project_id", "==", project_id).stream())
        story_docs = list(db.collection("stories").where("project_id", "==", project_id).stream())
        task_docs = list(db.collection("tasks").where("project_id", "==", project_id).stream())

        synced_epics = []
        synced_stories = []
        synced_tasks = []
        errors = []

        # Map stories by epic_id and tasks by story_id
        tasks_by_story: Dict[str, List[Any]] = {}
        for td in task_docs:
            t_data = td.to_dict()
            tasks_by_story.setdefault(t_data.get("story_id"), []).append((td.id, t_data))

        stories_by_epic: Dict[str, List[Any]] = {}
        for sd in story_docs:
            s_data = sd.to_dict()
            stories_by_epic.setdefault(s_data.get("epic_id"), []).append((sd.id, s_data))

        # 2. Upload Epics
        for ed in epic_docs:
            epic_id = ed.id
            epic_data = ed.to_dict()
            current_key = epic_data.get("key", "")
            title = epic_data.get("title", "Untitled Epic")
            desc = epic_data.get("description", "")
            origin = epic_data.get("requirement_origin", "PRD")

            # Check if already a live Jira key for this project
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

            # 3. Upload Stories under this Epic
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

                # 4. Upload Tasks under this Story
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
                            # Try Subtask with parent
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
                                # Fallback as standard Task
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

        # Record activity log in Firestore
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
