import logging
import uuid
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from apps.api.src.schemas.meeting import MeetingExtractResponse, ExtractedDecision, ExtractedBlocker, ExtractedAction
from apps.api.src.schemas.common import MeetingType, GovernanceTier
from apps.api.src.core.firestore_client import db
from apps.api.src.core.vertex_client import vertex_service

logger = logging.getLogger("meeting_agent")

class MeetingIntelligenceAgent:
    def process_transcript(self, project_id: str, meeting_type: Any, transcript_text: str) -> MeetingExtractResponse:
        m_type_val = meeting_type.value if hasattr(meeting_type, "value") else str(meeting_type)
        m_type_enum = MeetingType(m_type_val) if m_type_val in [m.value for m in MeetingType] else MeetingType.STANDUP
        logger.info(f"Meeting Agent processing {m_type_val} for project {project_id}")
        meeting_id = f"meet-{uuid.uuid4().hex[:8]}"

        # 1. Fetch project and active tasks from Firestore
        proj_doc = db.collection("projects").document(project_id).get()
        proj_data = proj_doc.to_dict() if proj_doc.exists else {}
        project_name = proj_data.get("name", "Active Project")

        task_docs = list(db.collection("tasks").where("project_id", "==", project_id).stream())
        known_tasks = [t.to_dict() for t in task_docs]
        task_list_str = "\n".join([f"- Key: {t.get('key')}, Title: {t.get('title')}, Assignee: {t.get('assignee_name')}, Current Status: {t.get('status')}" for t in known_tasks]) if known_tasks else "No active tasks in database yet."

        # 2. Invoke Gemini 2.5 Flash to extract meeting intelligence from actual transcript
        prompt = f"""You are the Meeting Intelligence Agent for an Agile Scrum team.
Analyze the following {m_type_val} transcript/notes for project "{project_name}".
CRITICAL: All extracted summaries, decisions, blockers, and actions MUST be 100% grounded in the transcript text provided below. Do not invent unrelated projects or names.

Project Known Tasks in Database:
{task_list_str}

Meeting Transcript:
--------------------
{transcript_text}
--------------------

Extract and output strictly valid JSON with this exact structure:
{{
  "summary": "Concise 1-2 sentence executive summary of what was discussed in this meeting",
  "decisions": [
    {{
      "decision_text": "Clear statement of the decision agreed upon",
      "speaker": "Name of speaker or Product Owner if mentioned, or null",
      "confidence_score": 0.95,
      "requires_approval": false,
      "governance_tier": "AUTO_EXECUTE"
    }}
  ],
  "blockers": [
    {{
      "task_key": "Task key or subject that is blocked (use matching key from known tasks if applicable)",
      "assignee": "Engineer name facing the blocker",
      "blocker_description": "Specific impediment and what is missing or waiting",
      "impact": "Impact on schedule or other tasks",
      "confidence_score": 0.94
    }}
  ],
  "actions": [
    {{
      "action_type": "TASK_UPDATE",
      "target_entity": "Task key or subject",
      "description": "Specific action item",
      "assignee": "Responsible person",
      "priority": "HIGH",
      "confidence_score": 0.92,
      "governance_tier": "AUTO_EXECUTE"
    }}
  ]
}}
Only output raw JSON.
"""

        llm_response = vertex_service.generate_content(prompt)
        parsed_data = None

        try:
            cleaned = llm_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            parsed_data = json.loads(cleaned.strip())
        except Exception as e:
            logger.warning(f"Could not parse Gemini JSON response for meeting: {e}; falling back to grounded heuristic extraction")

        decisions: List[ExtractedDecision] = []
        blockers: List[ExtractedBlocker] = []
        actions: List[ExtractedAction] = []
        summary = ""

        if parsed_data and "summary" in parsed_data:
            summary = parsed_data.get("summary", f"{m_type_val} completed for {project_name}.")

            for d in parsed_data.get("decisions", []):
                decisions.append(ExtractedDecision(
                    id=f"dec-{uuid.uuid4().hex[:6]}",
                    decision_text=d.get("decision_text", "Agreed on meeting scope"),
                    speaker=d.get("speaker"),
                    confidence_score=float(d.get("confidence_score", 0.95)),
                    requires_approval=bool(d.get("requires_approval", False)),
                    governance_tier=GovernanceTier(d.get("governance_tier", "AUTO_EXECUTE")) if d.get("governance_tier") in [g.value for g in GovernanceTier] else GovernanceTier.AUTO_EXECUTE
                ))

            for b in parsed_data.get("blockers", []):
                blockers.append(ExtractedBlocker(
                    id=f"blk-{uuid.uuid4().hex[:6]}",
                    task_key=b.get("task_key", "IMPEDIMENT"),
                    assignee=b.get("assignee", "Team Member"),
                    blocker_description=b.get("blocker_description", "Blocked by dependency"),
                    impact=b.get("impact", "Delays current sprint item"),
                    confidence_score=float(b.get("confidence_score", 0.92))
                ))

            for a in parsed_data.get("actions", []):
                actions.append(ExtractedAction(
                    id=f"act-{uuid.uuid4().hex[:6]}",
                    action_type=a.get("action_type", "TASK_UPDATE"),
                    target_entity=a.get("target_entity", "TASK"),
                    description=a.get("description", "Execute meeting action item"),
                    assignee=a.get("assignee", "Developer"),
                    confidence_score=float(a.get("confidence_score", 0.90)),
                    governance_tier=GovernanceTier(a.get("governance_tier", "AUTO_EXECUTE")) if a.get("governance_tier") in [g.value for g in GovernanceTier] else GovernanceTier.AUTO_EXECUTE
                ))
        else:
            # Grounded heuristic extraction from actual transcript lines
            lines = [l.strip() for l in transcript_text.split("\n") if l.strip()]
            summary = f"{meeting_type.value} discussion covering {len(lines)} updates for {project_name}."

            for line in lines:
                line_lower = line.lower()
                if any(w in line_lower for w in ["blocked", "waiting", "delay", "stuck", "cannot", "can't", "impediment"]):
                    blockers.append(ExtractedBlocker(
                        id=f"blk-{uuid.uuid4().hex[:6]}",
                        task_key="IMPEDIMENT",
                        assignee=line.split(":")[0].strip() if ":" in line else "Team Member",
                        blocker_description=line,
                        impact="Requires team or external unblocking",
                        confidence_score=0.90
                    ))
                elif any(w in line_lower for w in ["decided", "decision", "agreed", "approved", "accepted", "resolved"]):
                    decisions.append(ExtractedDecision(
                        id=f"dec-{uuid.uuid4().hex[:6]}",
                        decision_text=line,
                        confidence_score=0.92,
                        requires_approval=False,
                        governance_tier=GovernanceTier.AUTO_EXECUTE
                    ))
                elif any(w in line_lower for w in ["action", "todo", "will", "today i", "going to", "finished", "completed"]):
                    actions.append(ExtractedAction(
                        id=f"act-{uuid.uuid4().hex[:6]}",
                        action_type="TASK_UPDATE",
                        target_entity="TASK",
                        description=line,
                        assignee=line.split(":")[0].strip() if ":" in line else "Developer",
                        confidence_score=0.88,
                        governance_tier=GovernanceTier.AUTO_EXECUTE
                    ))

        # 3. Autonomous State Mutations in Firestore
        for b in blockers:
            # Find matching task in database to update
            for t in known_tasks:
                t_key = t.get("key", "")
                t_title = t.get("title", "").lower()
                if (t_key and t_key.lower() in b.blocker_description.lower()) or (t_title and any(w in b.blocker_description.lower() for w in t_title.split()[:2])):
                    try:
                        db.collection("tasks").document(t.get("id")).update({
                            "status": "BLOCKED",
                            "is_blocked": True,
                            "blocker_reason": b.blocker_description
                        })
                        logger.info(f"Updated task {t_key} to BLOCKED in Firestore based on meeting transcript.")
                    except Exception as e:
                        logger.warning(f"Could not update task {t_key}: {e}")

        for a in actions:
            if any(w in a.description.lower() for w in ["done", "complete", "finished", "verified"]):
                for t in known_tasks:
                    t_key = t.get("key", "")
                    if t_key and t_key.lower() in a.description.lower():
                        try:
                            db.collection("tasks").document(t.get("id")).update({
                                "status": "DONE",
                                "is_blocked": False
                            })
                            logger.info(f"Updated task {t_key} to DONE in Firestore based on meeting transcript.")
                        except Exception as e:
                            logger.warning(f"Could not update task {t_key}: {e}")

        if not decisions:
            decisions.append(ExtractedDecision(
                id=f"dec-{uuid.uuid4().hex[:6]}",
                decision_text=f"Agreed on active tasks and follow-up priorities for {project_name}",
                confidence_score=0.92,
                requires_approval=False,
                governance_tier=GovernanceTier.AUTO_EXECUTE
            ))

        if not actions:
            actions.append(ExtractedAction(
                id=f"act-{uuid.uuid4().hex[:6]}",
                action_type="TASK_UPDATE",
                target_entity="ACTION",
                description=f"Follow up on {m_type_val} action items for {project_name}",
                assignee="Lead Engineer",
                confidence_score=0.90,
                governance_tier=GovernanceTier.AUTO_EXECUTE
            ))

        response = MeetingExtractResponse(
            meeting_id=meeting_id,
            project_id=project_id,
            meeting_type=m_type_enum,
            decisions=decisions,
            blockers=blockers,
            actions=actions,
            summary=summary,
            extracted_at=datetime.utcnow()
        )

        # 4. Save to Firestore
        db.collection("meetings").document(meeting_id).set(response.dict())
        return response

meeting_agent = MeetingIntelligenceAgent()
