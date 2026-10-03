import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from apps.api.src.core.providers.base import BaseDocProvider
from apps.api.src.core.firestore_client import db

class NativeFirestoreDocProvider(BaseDocProvider):
    def publish_prd_summary(self, project_id: str, title: str, content: str) -> Dict[str, Any]:
        doc_id = f"doc-{uuid.uuid4().hex[:8]}"
        data = {
            "id": doc_id,
            "project_id": project_id,
            "title": title,
            "content": content,
            "doc_type": "PRD_SUMMARY",
            "published_at": datetime.utcnow().isoformat()
        }
        db.collection("requirements").document(doc_id).set(data)
        return {"status": "SUCCESS", "id": doc_id, "provider": "NATIVE"}

    def publish_open_questions(self, project_id: str, questions: List[Dict[str, Any]]) -> Dict[str, Any]:
        for q in questions:
            q_id = q.get("id") or f"q-{uuid.uuid4().hex[:8]}"
            q["project_id"] = project_id
            db.collection("open_questions").document(q_id).set(q)
        return {"status": "SUCCESS", "count": len(questions), "provider": "NATIVE"}

    def publish_meeting_notes(self, project_id: str, meeting_type: str, date_str: str, summary: str, decisions: List[str], actions: List[str]) -> Dict[str, Any]:
        meeting_id = f"meet-{uuid.uuid4().hex[:8]}"
        data = {
            "id": meeting_id,
            "project_id": project_id,
            "meeting_type": meeting_type,
            "date": date_str,
            "summary": summary,
            "decisions": decisions,
            "actions": actions,
            "created_at": datetime.utcnow().isoformat()
        }
        db.collection("meetings").document(meeting_id).set(data)
        return {"status": "SUCCESS", "id": meeting_id, "provider": "NATIVE"}

    def publish_adr(self, project_id: str, decision_id: str, title: str, context: str, decision: str, consequences: str) -> Dict[str, Any]:
        data = {
            "id": decision_id,
            "project_id": project_id,
            "title": title,
            "context": context,
            "decision": decision,
            "consequences": consequences,
            "created_at": datetime.utcnow().isoformat()
        }
        db.collection("decisions").document(decision_id).set(data)
        return {"status": "SUCCESS", "id": decision_id, "provider": "NATIVE"}
