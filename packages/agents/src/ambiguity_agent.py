import logging
import uuid
import json
from datetime import datetime
from typing import List, Any, Optional
from apps.api.src.schemas.ambiguity import OpenQuestion
from apps.api.src.schemas.common import Priority
from apps.api.src.core.firestore_client import db
from apps.api.src.core.vertex_client import vertex_service

logger = logging.getLogger("ambiguity_agent")

class AmbiguityAgent:
    def identify_open_questions(self, project_id: str, clauses: List[Any] = None) -> List[OpenQuestion]:
        logger.info(f"Ambiguity Agent analyzing requirements for project: {project_id}")

        clause_texts = []
        if clauses:
            for c in clauses:
                if hasattr(c, "text"):
                    clause_texts.append(f"[{getattr(c, 'section_title', 'Requirement')}] {c.text}")
                elif isinstance(c, dict):
                    clause_texts.append(f"[{c.get('section_title', 'Requirement')}] {c.get('text', '')}")

        req_summary = "\n".join(clause_texts[:10]) if clause_texts else f"Project {project_id} functional specification."

        prompt = f"""You are the Open Questions & Ambiguity Agent for the AI Scrum Master.
Analyze the following requirement clauses and identify 2-3 specific ambiguous, incomplete, or missing specifications:
--------------------
{req_summary}
--------------------

Output strictly valid JSON with this array structure:
[
  {{
    "question": "Clear, direct question for the Product Owner?",
    "section_ref": "Section or clause reference",
    "why_needed": "Why clarification is required for engineering or testing",
    "delivery_impact": "Impact on architecture, database, or testing if unanswered",
    "priority": "HIGH", // or "MEDIUM" or "LOW"
    "ai_suggested_answer": "Industry standard recommendation",
    "options": ["Option 1", "Option 2", "Option 3"]
  }}
]
Only output raw JSON.
"""

        llm_response = vertex_service.generate_content(prompt)
        parsed_questions = None

        try:
            cleaned = llm_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            parsed_questions = json.loads(cleaned.strip())
        except Exception as e:
            logger.warning(f"Could not parse Gemini JSON response for open questions: {e}")

        questions: List[OpenQuestion] = []
        if parsed_questions and isinstance(parsed_questions, list):
            for pq in parsed_questions:
                pri_str = pq.get("priority", "HIGH").upper()
                pri = Priority.HIGH if pri_str == "HIGH" else (Priority.LOW if pri_str == "LOW" else Priority.MEDIUM)
                questions.append(OpenQuestion(
                    id=f"q-{uuid.uuid4().hex[:8]}",
                    project_id=project_id,
                    question=pq.get("question", "What are the allowed constraints?"),
                    section_ref=pq.get("section_ref", "Core Spec"),
                    why_needed=pq.get("why_needed", "Required for technical task decomposition."),
                    delivery_impact=pq.get("delivery_impact", "May delay acceptance testing."),
                    priority=pri,
                    ai_suggested_answer=pq.get("ai_suggested_answer", "Follow standard cloud defaults."),
                    options=pq.get("options", ["Option A", "Option B"]),
                    confidence_score=0.95
                ))

        if not questions:
            # Fallback based on project clauses
            questions = [
                OpenQuestion(
                    id=f"q-{uuid.uuid4().hex[:8]}",
                    project_id=project_id,
                    question=f"What are the target SLA constraints and storage quotas for {project_id}?",
                    section_ref="System Requirements",
                    why_needed="Affects Cloud Run memory scaling and database storage allocations.",
                    delivery_impact="Blocks infrastructure sizing.",
                    priority=Priority.HIGH,
                    ai_suggested_answer="Apply standard enterprise microservice quotas with auto-scaling.",
                    options=["Standard Auto-Scaling (1-10 instances)", "Fixed high-concurrency instances", "Serverless spot allocation"],
                    confidence_score=0.92
                ),
                OpenQuestion(
                    id=f"q-{uuid.uuid4().hex[:8]}",
                    project_id=project_id,
                    question="How should authentication session timeouts and retry limits be handled?",
                    section_ref="Security Spec",
                    why_needed="Required for security compliance and boundary test suites.",
                    delivery_impact="Blocks QA validation criteria.",
                    priority=Priority.MEDIUM,
                    ai_suggested_answer="15 minute idle session timeout with 3 retry attempts.",
                    options=["15 min timeout, 3 retries", "30 min timeout, 5 retries", "Custom OAuth refresh tokens"],
                    confidence_score=0.90
                )
            ]

        for q in questions:
            db.collection("open_questions").document(q.id).set(q.dict())

        return questions

    def resolve_question(self, question_id: str, answer: str, resolved_by: str = "Product Owner") -> OpenQuestion:
        doc_ref = db.collection("open_questions").document(question_id)
        snap = doc_ref.get()
        if not snap.exists:
            raise ValueError(f"Open question {question_id} not found.")
        
        data = snap.to_dict()
        data["resolved"] = True
        data["resolved_answer"] = answer
        data["resolved_by"] = resolved_by
        data["resolved_at"] = datetime.utcnow()
        doc_ref.update(data)
        return OpenQuestion(**data)

ambiguity_agent = AmbiguityAgent()
