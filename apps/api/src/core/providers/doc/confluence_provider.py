import logging
import re
import html
import requests
from requests.auth import HTTPBasicAuth
from typing import List, Dict, Any, Optional
from datetime import datetime
from apps.api.src.core.providers.base import BaseDocProvider
from apps.api.src.core.providers.doc.native_provider import NativeFirestoreDocProvider
from apps.api.src.core.firestore_client import db

from urllib.parse import urlparse

logger = logging.getLogger("confluence_provider")

def clean_confluence_instance_url(raw_url: Optional[str]) -> str:
    """
    Sanitizes Confluence instance URL to guarantee it points to the correct base.
    For Atlassian Cloud, standard base is https://<domain>.atlassian.net/wiki.
    Prevents nested /wiki paths or appended page paths.
    """
    if not raw_url or not str(raw_url).strip():
        return ""
    clean = str(raw_url).strip()
    if not clean.startswith(("http://", "https://")):
        clean = "https://" + clean
    try:
        parsed = urlparse(clean)
        if parsed.netloc:
            base = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
            if "atlassian.net" in parsed.netloc.lower():
                return f"{base}/wiki"
            path_parts = [p for p in parsed.path.split("/") if p]
            if path_parts and path_parts[0].lower() == "wiki":
                return f"{base}/wiki"
            return base
    except Exception:
        pass
    return clean.rstrip("/")

def html_to_markdown(raw_html: str) -> str:
    """Converts Confluence XHTML storage format into clean, readable Markdown."""
    if not raw_html:
        return ""
    t = raw_html
    # Headings
    t = re.sub(r'<h1[^>]*>(.*?)</h1>', r'\n\n# \1\n', t, flags=re.DOTALL)
    t = re.sub(r'<h2[^>]*>(.*?)</h2>', r'\n\n## \1\n', t, flags=re.DOTALL)
    t = re.sub(r'<h3[^>]*>(.*?)</h3>', r'\n\n### \1\n', t, flags=re.DOTALL)
    t = re.sub(r'<h[4-6][^>]*>(.*?)</h[4-6]>', r'\n\n#### \1\n', t, flags=re.DOTALL)
    # Lists
    t = re.sub(r'<li[^>]*>(.*?)</li>', r'\n- \1', t, flags=re.DOTALL)
    # Paragraphs & line breaks
    t = re.sub(r'<p[^>]*>(.*?)</p>', r'\n\n\1', t, flags=re.DOTALL)
    t = re.sub(r'<br\s*/?>', r'\n', t)
    # Inline formatting
    t = re.sub(r'<strong[^>]*>(.*?)</strong>', r'**\1**', t, flags=re.DOTALL)
    t = re.sub(r'<b[^>]*>(.*?)</b>', r'**\1**', t, flags=re.DOTALL)
    t = re.sub(r'<em[^>]*>(.*?)</em>', r'*\1*', t, flags=re.DOTALL)
    t = re.sub(r'<i[^>]*>(.*?)</i>', r'*\1*', t, flags=re.DOTALL)
    t = re.sub(r'<code[^>]*>(.*?)</code>', r'`\1`', t, flags=re.DOTALL)
    # Tables
    t = re.sub(r'<tr[^>]*>', r'\n', t)
    t = re.sub(r'<td[^>]*>(.*?)</td>', r' | \1', t, flags=re.DOTALL)
    t = re.sub(r'<th[^>]*>(.*?)</th>', r' | **\1**', t, flags=re.DOTALL)
    # Strip remaining XML/HTML tags
    t = re.sub(r'<[^>]+>', '', t)
    t = html.unescape(t)
    # Normalize extra whitespaces
    t = re.sub(r'[ \t]+', ' ', t)
    t = re.sub(r'\n{3,}', '\n\n', t)
    return t.strip()

def extract_page_id_from_url(url: str) -> Optional[str]:
    """Extracts numeric Confluence Page ID from URL patterns."""
    if not url:
        return None
    # Pattern 1: /pages/1234567/
    m1 = re.search(r'/pages/(\d+)', url)
    if m1:
        return m1.group(1)
    # Pattern 2: pageId=1234567
    m2 = re.search(r'pageId=(\d+)', url)
    if m2:
        return m2.group(1)
    # Pattern 3: /content/1234567
    m3 = re.search(r'/content/(\d+)', url)
    if m3:
        return m3.group(1)
    return None

class ConfluenceDocProvider(BaseDocProvider):
    def __init__(
        self,
        instance_url: Optional[str] = None,
        user_email: Optional[str] = None,
        api_token: Optional[str] = None,
        space_key: Optional[str] = None,
        parent_page_id: Optional[str] = None
    ):
        self.instance_url = clean_confluence_instance_url(instance_url)
        self.user_email = user_email
        self.api_token = api_token
        self.space_key = space_key
        self.parent_page_id = parent_page_id
        self._fallback = NativeFirestoreDocProvider()

    def _is_configured(self) -> bool:
        return bool(self.instance_url and self.user_email and self.api_token)

    def fetch_page_content(self, page_id_or_url: str) -> Optional[Dict[str, Any]]:
        """Calls Atlassian Confluence REST API to retrieve the complete page content."""
        if not self._is_configured():
            logger.warning("Confluence credentials not fully configured; cannot fetch remote page.")
            return None

        page_id = extract_page_id_from_url(page_id_or_url) or page_id_or_url
        if not page_id or not page_id.isdigit():
            logger.warning(f"Could not extract numeric page ID from {page_id_or_url}")
            return None

        endpoint = f"{self.instance_url}/rest/api/content/{page_id}?expand=body.storage,version,space"
        auth = HTTPBasicAuth(self.user_email, self.api_token)
        headers = {"Accept": "application/json"}

        try:
            res = requests.get(endpoint, auth=auth, headers=headers, timeout=12)
            if res.status_code == 200:
                data = res.json()
                title = data.get("title", f"Page {page_id}")
                space_info = data.get("space", {})
                space_k = space_info.get("key") or self.space_key or "GENERAL"
                storage_html = data.get("body", {}).get("storage", {}).get("value", "")
                plain_text = html_to_markdown(storage_html)

                return {
                    "page_id": page_id,
                    "title": title,
                    "space_key": space_k,
                    "content": plain_text,
                    "content_length": len(plain_text),
                    "version": data.get("version", {}).get("number", 1),
                    "url": f"{self.instance_url}/spaces/{space_k}/pages/{page_id}"
                }
            else:
                logger.warning(f"Confluence API returned {res.status_code} for page {page_id}: {res.text[:200]}")
                return None
        except Exception as e:
            logger.error(f"Failed to fetch page {page_id} from Confluence: {e}")
            return None

    def fetch_space_pages(self, space_key: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
        """Queries all pages under a specific Confluence space and extracts their complete bodies."""
        if not self._is_configured():
            return []

        sk = space_key or self.space_key
        if not sk:
            return []

        endpoint = f"{self.instance_url}/rest/api/content?spaceKey={sk}&expand=body.storage,version,space&limit={limit}"
        auth = HTTPBasicAuth(self.user_email, self.api_token)
        headers = {"Accept": "application/json"}

        try:
            res = requests.get(endpoint, auth=auth, headers=headers, timeout=15)
            if res.status_code == 200:
                results = res.json().get("results", [])
                pages = []
                for p in results:
                    pid = p.get("id")
                    title = p.get("title", "")
                    storage_html = p.get("body", {}).get("storage", {}).get("value", "")
                    content_md = html_to_markdown(storage_html)
                    pages.append({
                        "page_id": pid,
                        "title": title,
                        "space_key": sk,
                        "content": content_md,
                        "content_length": len(content_md),
                        "url": f"{self.instance_url}/spaces/{sk}/pages/{pid}"
                    })
                return pages
            else:
                logger.warning(f"Confluence space query failed with {res.status_code}: {res.text[:200]}")
                return []
        except Exception as e:
            logger.error(f"Error fetching space {sk} from Confluence: {e}")
            return []

    def publish_prd_summary(self, project_id: str, title: str, content: str) -> Dict[str, Any]:
        result = self._fallback.publish_prd_summary(project_id, title, content)
        if self._is_configured():
            try:
                url = f"{self.instance_url}/api/v2/pages"
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
                url = f"{self.instance_url}/api/v2/pages"
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
