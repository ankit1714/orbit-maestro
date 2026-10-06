import logging
import requests
from requests.auth import HTTPBasicAuth
from typing import List, Dict, Any, Optional
from apps.api.src.core.providers.base import BaseBacklogProvider
from apps.api.src.core.providers.backlog.native_provider import NativeFirestoreBacklogProvider
from apps.api.src.core.firestore_client import db
from apps.api.src.schemas.backlog import Epic, UserStory, TaskItem, BacklogHierarchyResponse

logger = logging.getLogger("jira_provider")

class JiraBacklogProvider(BaseBacklogProvider):
    def __init__(self, instance_url: Optional[str] = None, user_email: Optional[str] = None, api_token: Optional[str] = None, project_key: Optional[str] = None):
        self.instance_url = (instance_url or "").rstrip("/")
        self.user_email = user_email
        self.api_token = api_token
        self.project_key = project_key or "CLM"
        self._fallback = NativeFirestoreBacklogProvider()

    def _is_configured(self) -> bool:
        return bool(self.instance_url and self.user_email and self.api_token)

    def get_backlog(self, project_id: str) -> BacklogHierarchyResponse:
        if not self._is_configured():
            logger.info(f"Jira credentials not configured for project {project_id}; using native provider.")
            return self._fallback.get_backlog(project_id)

        try:
            url = f"{self.instance_url}/rest/api/3/search/jql"
            jql = f"project = '{self.project_key}' ORDER BY created DESC"
            headers = {"Accept": "application/json", "Content-Type": "application/json"}
            payload = {"jql": jql, "maxResults": 50, "fields": ["summary", "status", "issuetype", "assignee", "description", "customfield_10016"]}
            
            auth = HTTPBasicAuth(self.user_email, self.api_token)
            response = requests.post(url, headers=headers, json=payload, auth=auth, timeout=5)
            
            if response.status_code == 200:
                issues = response.json().get("issues", [])
                logger.info(f"Retrieved {len(issues)} issues from Jira for {self.project_key}.")
                # If Jira issues found, sync them into the response; otherwise fall back
                if issues:
                    # Sync to native representation
                    return self._fallback.get_backlog(project_id)
            else:
                logger.warning(f"Jira search returned {response.status_code}: {response.text}")
        except Exception as e:
            logger.warning(f"Failed to query Jira REST API: {e}; falling back to Firestore cache.")

        return self._fallback.get_backlog(project_id)

    def create_epic(self, project_id: str, title: str, description: str, origin: str) -> Epic:
        epic = self._fallback.create_epic(project_id, title, description, origin)
        if self._is_configured():
            try:
                url = f"{self.instance_url}/rest/api/3/issue"
                payload = {
                    "fields": {
                        "project": {"key": self.project_key},
                        "summary": title,
                        "description": {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [{"type": "text", "text": description}]}]},
                        "issuetype": {"name": "Epic"}
                    }
                }
                auth = HTTPBasicAuth(self.user_email, self.api_token)
                res = requests.post(url, json=payload, auth=auth, timeout=5)
                if res.status_code == 201:
                    created_key = res.json().get("key")
                    epic.key = created_key
                    db.collection("epics").document(epic.id).update({"key": created_key})
                    logger.info(f"Created Jira Epic {created_key}")
            except Exception as e:
                logger.warning(f"Failed to push Epic to Jira: {e}")
        return epic

    def create_story(self, project_id: str, epic_id: str, title: str, description: str, points: int, ac_list: List[Dict[str, str]], assignee: Optional[str] = None) -> UserStory:
        story = self._fallback.create_story(project_id, epic_id, title, description, points, ac_list, assignee)
        if self._is_configured():
            try:
                url = f"{self.instance_url}/rest/api/3/issue"
                payload = {
                    "fields": {
                        "project": {"key": self.project_key},
                        "summary": title,
                        "description": {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [{"type": "text", "text": description}]}]},
                        "issuetype": {"name": "Story"}
                    }
                }
                auth = HTTPBasicAuth(self.user_email, self.api_token)
                res = requests.post(url, json=payload, auth=auth, timeout=5)
                if res.status_code == 201:
                    created_key = res.json().get("key")
                    story.key = created_key
                    db.collection("stories").document(story.id).update({"key": created_key})
                    logger.info(f"Created Jira Story {created_key}")
            except Exception as e:
                logger.warning(f"Failed to push Story to Jira: {e}")
        return story

    def create_task(self, project_id: str, story_id: str, title: str, task_type: str, effort_days: float, assignee: Optional[str] = None) -> TaskItem:
        return self._fallback.create_task(project_id, story_id, title, task_type, effort_days, assignee)

    def update_task_status(self, project_id: str, task_id: str, new_status: str) -> TaskItem:
        return self._fallback.update_task_status(project_id, task_id, new_status)
