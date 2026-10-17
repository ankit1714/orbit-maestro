import logging
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime
from packages.agents.src.understanding_agent import understanding_agent
from packages.agents.src.ambiguity_agent import ambiguity_agent
from packages.agents.src.backlog_agent import backlog_agent
from packages.agents.src.sprint_agent import sprint_agent
from packages.agents.src.meeting_agent import meeting_agent
from packages.agents.src.risk_agent import risk_agent
from packages.agents.src.git_agent import git_agent
from apps.api.src.core.firestore_client import db
from apps.api.src.schemas.common import GovernanceTier, AuditActionType
from apps.api.src.schemas.governance import GovernanceApproval, ActivityLogEntry

logger = logging.getLogger("orchestrator")

class ADKOrchestratorAgent:
    def __init__(self):
        logger.info("Initializing Vertex AI ADK Orchestrator Agent.")

    def log_activity(self, project_id: str, action_type: AuditActionType, actor: str, description: str, target: str, tier: GovernanceTier, details: Dict[str, Any] = None):
        """Append-only immutable audit trail (Section 44)."""
        entry_id = f"act-{uuid.uuid4().hex[:8]}"
        entry = ActivityLogEntry(
            id=entry_id,
            project_id=project_id,
            action_type=action_type,
            actor=actor,
            description=description,
            target_entity=target,
            governance_tier=tier,
            details=details or {},
            timestamp=datetime.utcnow()
        )
        db.collection("activity_logs").document(entry_id).set(entry.dict())

    def create_pending_approval(self, project_id: str, title: str, summary: str, observation: str, impact: str, proposed_action: str, target_type: str, target_id: str) -> GovernanceApproval:
        """Enforces 3-Tier Governance approval ledger."""
        app_id = f"app-{uuid.uuid4().hex[:8]}"
        approval = GovernanceApproval(
            id=app_id,
            project_id=project_id,
            tier=GovernanceTier.APPROVAL_REQUIRED,
            title=title,
            summary=summary,
            observation=observation,
            delivery_impact=impact,
            ai_proposed_action=proposed_action,
            target_entity_type=target_type,
            target_entity_id=target_id,
            confidence_score=0.94,
            status="PENDING",
            created_at=datetime.utcnow()
        )
        db.collection("governance_approvals").document(app_id).set(approval.dict())
        return approval

    def handle_event(self, event_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Routes workflow events to specialized sub-agents."""
        project_id = payload.get("project_id", "project-demo")

        if event_type == "EVENT_DOCUMENT_UPLOADED":
            file_bytes = payload.get("file_bytes", b"")
            file_name = payload.get("file_name", "document.pdf")
            extracted = understanding_agent.process_document(project_id, file_bytes, file_name)
            open_questions = ambiguity_agent.identify_open_questions(project_id, extracted.clauses)
            
            self.log_activity(
                project_id=project_id,
                action_type=AuditActionType.DOCUMENT_INGESTED,
                actor="Understanding Agent",
                description=f"Extracted optical layout and identified {len(open_questions)} open ambiguities from {file_name}",
                target=file_name,
                tier=GovernanceTier.AUTO_EXECUTE
            )
            return {"extract": extracted.dict(), "open_questions": [q.dict() for q in open_questions]}

        elif event_type == "EVENT_BACKLOG_GENERATE":
            clarifications = payload.get("clarifications", {})
            backlog = backlog_agent.synthesize_backlog(project_id, clarifications)
            self.log_activity(
                project_id=project_id,
                action_type=AuditActionType.BACKLOG_SYNTHESIZED,
                actor="Backlog Agent",
                description=f"Synthesized {backlog.total_epics} epics, {backlog.total_stories} stories, and {backlog.total_tasks} tasks ({backlog.total_points} pts)",
                target="Product Backlog",
                tier=GovernanceTier.AUTO_EXECUTE
            )
            return {"backlog": backlog.dict()}

        elif event_type == "EVENT_MEETING_INGESTED":
            meeting_type = payload.get("meeting_type", "STANDUP")
            transcript = payload.get("transcript", "")
            title = payload.get("title", "Daily Scrum")
            entered_by = payload.get("entered_by", "Team Member")
            date = payload.get("date")
            result = meeting_agent.process_transcript(
                project_id=project_id,
                meeting_type=meeting_type,
                transcript_text=transcript,
                title=title,
                entered_by=entered_by,
                date=date
            )

            # If there are decisions requiring approval, route to approval ledger
            for dec in result.decisions:
                if dec.requires_approval:
                    self.create_pending_approval(
                        project_id=project_id,
                        title="Meeting Decision Approval",
                        summary=dec.decision_text,
                        observation=f"Mentioned in {meeting_type} by {dec.speaker or 'participant'}",
                        impact="Modifies acceptance criteria and delivery parameters",
                        proposed_action=f"Update requirements and notify team of decision: {dec.decision_text}",
                        target_type="DECISION",
                        target_id=dec.id
                    )

            self.log_activity(
                project_id=project_id,
                action_type=AuditActionType.MEETING_EXTRACTED,
                actor="Meeting Agent",
                description=f"Processed {meeting_type} notes: extracted {len(result.decisions)} decisions and {len(result.actions)} action items",
                target=f"{meeting_type} Transcript",
                tier=GovernanceTier.AUTO_EXECUTE
            )
            return {"meeting_result": result.dict()}

        elif event_type == "EVENT_EVALUATE_HEALTH":
            dag = risk_agent.evaluate_risks(project_id)
            matrix = risk_agent.evaluate_health_matrix(project_id)
            flash = git_agent.evaluate_git_health(project_id)
            return {"dag": dag.dict(), "health_matrix": matrix.dict(), "flash": flash.dict()}

        return {"status": "UNKNOWN_EVENT", "event": event_type}

orchestrator = ADKOrchestratorAgent()
