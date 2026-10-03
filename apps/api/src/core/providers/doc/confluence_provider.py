import logging
import requests
from requests.auth import HTTPBasicAuth
from typing import List, Dict, Any, Optional
from apps.api.src.core.providers.base import BaseDocProvider
from apps.api.src.core.providers.doc.native_provider import NativeFirestoreDocProvider

logger = logging.getLogger("confluence_provider")

class ConfluenceDocProvider(BaseDocProvider):
    def __init__(self, instance_url: Optional[str] = None, user_email: Optional[str] = None, api_token: Optional[str] = None, space_key: Optional[str] = None, parent_page_id: Optional[str] = None):
        self.instance_url = (instance_url or "").rstrip("/")
        self.user_email = user_email
        self.api_token = api_token
        self.space_key = space_key or "AI"
        self.parent_page_id = parent_page_id
        self._fallback = NativeFirestoreDocProvider()

    def _is_configured(self) -> bool:
        return bool(self.instance_url and self.user_email and self.api_token)

    def publish_prd_summary(self, project_id: str, title: str, content: str) -> Dict[str, Any]:
        result = self._fallback.publish_prd_summary(project_id, title, content)
        if self._is_configured():
            try:
                url = f"{self.instance_url}/wiki/api/v2/pages"
                headers = {"Accept": "application/json", "Content-Type": "application/json"}
                body_html = f"<p><strong>AI Scrum Master Generated PRD Summary</strong></p><pre>{content}</pre>"
                payload = {
                    "spaceId": self.space_key,
                    "title": f"[AI] {title}",
                    "body": {"representation": "storage", "value": body_html}
                }
                auth = HTTPBasicAuth(self.user_email, self.api_token)
                res = requests.post(url, headers=headers, json=payload, auth=auth, timeout=5)
                if res.status_code in [200, 201]:
                    page_id = res.json().get("id")
                    result["confluence_page_id"] = page_id
                    logger.info(f"Published PRD to Confluence Page ID {page_id}")
            except Exception as e:
                logger.warning(f"Failed to publish to Confluence: {e}")
        return result

    def publish_open_questions(self, project_id: str, questions: List[Dict[str, Any]]) -> Dict[str, Any]:
        return self._fallback.publish_open_questions(project_id, questions)

    def publish_meeting_notes(self, project_id: str, meeting_type: str, date_str: str, summary: str, decisions: List[str], actions: List[str]) -> Dict[str, Any]:
        result = self._fallback.publish_meeting_notes(project_id, meeting_type, date_str, summary, decisions, actions)
        if self._is_configured():
            try:
                url = f"{self.instance_url}/wiki/api/v2/pages"
                headers = {"Accept": "application/json", "Content-Type": "application/json"}
                decisions_html = "".join([f"<li>{d}</li>" for d in decisions])
                actions_html = "".join([f"<li>{a}</li>" for a in actions])
                body_html = f"""
                    <h2>{meeting_type} Notes - {date_str}</h2>
                    <p>{summary}</p>
                    <h3>Decisions</h3><ul>{decisions_html}</ul>
                    <h3>Action Items</h3><ul>{actions_html}</ul>
                """
                payload = {
                    "spaceId": self.space_key,
                    "title": f"[{meeting_type}] {date_str} Notes",
                    "body": {"representation": "storage", "value": body_html}
                }
                auth = HTTPBasicAuth(self.user_email, self.api_token)
                res = requests.post(url, headers=headers, json=payload, auth=auth, timeout=5)
                if res.status_code in [200, 201]:
                    logger.info("Published meeting notes to Confluence")
            except Exception as e:
                logger.warning(f"Failed to publish meeting notes to Confluence: {e}")
        return result

    def publish_adr(self, project_id: str, decision_id: str, title: str, context: str, decision: str, consequences: str) -> Dict[str, Any]:
        return self._fallback.publish_adr(project_id, decision_id, title, context, decision, consequences)
