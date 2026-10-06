import uuid
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from apps.api.src.core.providers.base import BaseKnowledgeProvider
from apps.api.src.core.firestore_client import db
from apps.api.src.core.vertex_client import vertex_service
from apps.api.src.schemas.knowledge import KnowledgeItem, KnowledgeSearchResponse, CitationSnippet, NotebookLMReference

logger = logging.getLogger("notebooklm_provider")

class NotebookLMKnowledgeProvider(BaseKnowledgeProvider):
    def __init__(self, notebook_id: Optional[str] = None, notebook_url: Optional[str] = None, workspace_name: Optional[str] = None):
        self.notebook_id = notebook_id or "nb-workspace-01"
        self.notebook_url = notebook_url or f"https://notebooklm.google.com/notebook/{self.notebook_id}"
        self.workspace_name = workspace_name or "Project Living Knowledge Hub"

    def get_notebooklm_reference(self, project_id: str) -> NotebookLMReference:
        items = list(db.collection("knowledge_items").where("project_id", "==", project_id).stream())
        proj_doc = db.collection("projects").document(project_id).get()
        p_name = proj_doc.to_dict().get("name", "Project") if proj_doc.exists else "Project"

        return NotebookLMReference(
            notebook_id=self.notebook_id,
            notebook_url=self.notebook_url,
            workspace_name=f"{p_name} Knowledge Hub",
            source_count=len(items),
            audio_briefing_available=True,
            audio_briefing_summary=f"AI Audio Briefing: Comprehensive synthesis of {p_name} specifications, sprint deliverables, and architectural decisions.",
            last_synced_at=datetime.utcnow()
        )

    def add_knowledge_item(self, project_id: str, title: str, content: str, source_type: str, source_uri: Optional[str] = None) -> KnowledgeItem:
        item_id = f"know-{uuid.uuid4().hex[:8]}"
        item = KnowledgeItem(
            id=item_id,
            project_id=project_id,
            title=title,
            content=content,
            source_type=source_type,
            source_uri=source_uri or self.notebook_url,
            notebooklm_source_id=f"src-{uuid.uuid4().hex[:6]}"
        )
        db.collection("knowledge_items").document(item_id).set(item.dict())
        return item

    def search(self, project_id: str, query: str, limit: int = 5) -> KnowledgeSearchResponse:
        # Fetch actual knowledge items for this project from Firestore
        item_docs = list(db.collection("knowledge_items").where("project_id", "==", project_id).stream())
        items = [d.to_dict() for d in item_docs]

        if not items:
            return KnowledgeSearchResponse(
                project_id=project_id,
                query=query,
                answer=f"No grounded documents or decisions have been indexed for this project yet. Upload a PRD in Document Studio to index knowledge.",
                citations=[],
                confidence_score=0.5,
                source_count=0
            )

        sources_text = "\n\n".join([
            f"--- Source [{idx+1}]: {it.get('title')} ({it.get('source_type')}) ---\nURI: {it.get('source_uri')}\nContent:\n{it.get('content', '')[:1500]}"
            for idx, it in enumerate(items[:limit])
        ])

        prompt = f"""You are the Grounded Knowledge Assistant for {self.workspace_name}.
Answer the user's question using ONLY the provided project source knowledge below.
Provide a direct factual answer and cite the source title and relevant quote.

Project Grounded Sources:
{sources_text}

User Question: {query}

Output strictly valid JSON with this exact structure:
{{
  "answer": "Direct factual answer strictly based on the provided project sources",
  "citations": [
    {{
      "source_title": "Title of the matching source",
      "source_type": "PRD_SPECIFICATION",
      "section_or_page": "Section reference",
      "snippet_text": "Exact relevant snippet from the source"
    }}
  ],
  "confidence_score": 0.95
}}
Only return raw JSON.
"""

        llm_response = vertex_service.generate_content(prompt)
        parsed = None

        try:
            cleaned = llm_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            parsed = json.loads(cleaned.strip())
        except Exception as e:
            logger.warning(f"Could not parse Gemini JSON response for knowledge search: {e}")

        if parsed and "answer" in parsed:
            citations = [
                CitationSnippet(
                    source_title=c.get("source_title", items[0].get("title", "Project Spec")),
                    source_type=c.get("source_type", "PRD_SPECIFICATION"),
                    section_or_page=c.get("section_or_page", "Section 1"),
                    snippet_text=c.get("snippet_text", "")
                )
                for c in parsed.get("citations", [])
            ]
            if not citations and items:
                citations.append(CitationSnippet(
                    source_title=items[0].get("title", "Project Spec"),
                    source_type=items[0].get("source_type", "PRD_SPECIFICATION"),
                    section_or_page="Indexed Spec",
                    snippet_text=items[0].get("content", "")[:120]
                ))
            return KnowledgeSearchResponse(
                project_id=project_id,
                query=query,
                answer=parsed.get("answer", "Answer grounded in project documentation."),
                citations=citations,
                confidence_score=float(parsed.get("confidence_score", 0.94)),
                source_count=len(items)
            )

        # Grounded keyword fallback if LLM response couldn't be parsed
        q_words = [w.lower() for w in query.split() if len(w) > 3]
        best_item = items[0]
        for it in items:
            c_lower = it.get("content", "").lower()
            if any(qw in c_lower for qw in q_words):
                best_item = it
                break

        return KnowledgeSearchResponse(
            project_id=project_id,
            query=query,
            answer=f"Based on {best_item.get('title')}: {best_item.get('content')[:250]}...",
            citations=[
                CitationSnippet(
                    source_title=best_item.get("title", "Project Documentation"),
                    source_type=best_item.get("source_type", "PRD_SPECIFICATION"),
                    section_or_page="Indexed Spec",
                    snippet_text=best_item.get("content", "")[:120]
                )
            ],
            confidence_score=0.90,
            source_count=len(items)
        )
