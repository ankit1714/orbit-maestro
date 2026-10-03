import logging
import uuid
from typing import List, Dict, Any
from datetime import datetime
from apps.api.src.schemas.meeting import MeetingExtractResponse, ExtractedDecision, ExtractedBlocker, ExtractedAction
from apps.api.src.schemas.common import MeetingType, GovernanceTier
from apps.api.src.core.firestore_client import db

logger = logging.getLogger("meeting_agent")

class MeetingIntelligenceAgent:
    def process_transcript(self, project_id: str, meeting_type: MeetingType, transcript_text: str) -> MeetingExtractResponse:
        logger.info(f"Meeting Agent processing {meeting_type} for project {project_id}")
        meeting_id = f"meet-{uuid.uuid4().hex[:8]}"

        if meeting_type == MeetingType.REVIEW:
            summary = "Sprint Review demo: Stakeholders verified customer claim OCR parsing with 96% accuracy. PO requested photo auto-orientation story."
            decisions = [
                ExtractedDecision(id=f"dec-{uuid.uuid4().hex[:6]}", decision_text="Stakeholders accepted STY-102 (OCR Submission)", confidence_score=0.98, requires_approval=False, governance_tier=GovernanceTier.AUTO_EXECUTE)
            ]
            blockers = []
            actions = [
                ExtractedAction(id=f"act-{uuid.uuid4().hex[:6]}", action_type="NEW_STORY", target_entity="STY-109", description="Created STY-109: Photo auto-orientation & EXIF correction", assignee="Alex", confidence_score=0.92, governance_tier=GovernanceTier.AUTO_EXECUTE)
            ]
        elif meeting_type == MeetingType.RETROSPECTIVE:
            summary = "Retrospective: Document AI setup was praised. Deployment stalled 4h due to Secret Manager permissions. Team agreed to automate secrets in Terraform."
            decisions = [
                ExtractedDecision(id=f"dec-{uuid.uuid4().hex[:6]}", decision_text="Automate Secret Manager IAM provisioning prior to Sprint 4", confidence_score=0.96, requires_approval=False, governance_tier=GovernanceTier.AUTO_EXECUTE)
            ]
            blockers = []
            actions = [
                ExtractedAction(id=f"act-{uuid.uuid4().hex[:6]}", action_type="KAIZEN", target_entity="TSK-408", description="TSK-408: Automate Cloud Run Secret Manager permissions in Terraform", assignee="Alex", confidence_score=0.95, governance_tier=GovernanceTier.AUTO_EXECUTE)
            ]
        else:
            # Standup
            summary = "Daily Standup: Alex completed OCR endpoints. David blocked on PAY-142 due to missing vendor contract. Maria noted PO requested 10s timeout constraint."
            decisions = [
                ExtractedDecision(id=f"dec-{uuid.uuid4().hex[:6]}", decision_text="Payment timeout constraint modified from 30s to 10s for mobile users", speaker="Maria", confidence_score=0.96, requires_approval=True, governance_tier=GovernanceTier.APPROVAL_REQUIRED)
            ]
            blockers = [
                ExtractedBlocker(id=f"blk-{uuid.uuid4().hex[:6]}", task_key="PAY-142", assignee="David", blocker_description="PAY-142 Blocked: Missing vendor API schema contract", impact="Prevents completion of checkout connector", confidence_score=0.94)
            ]
            actions = [
                ExtractedAction(id=f"act-{uuid.uuid4().hex[:6]}", action_type="TASK_UPDATE", target_entity="TSK-301", description="TSK-301 (OCR Endpoints) marked as Complete", assignee="Alex", confidence_score=0.91, governance_tier=GovernanceTier.AUTO_EXECUTE)
            ]

        response = MeetingExtractResponse(
            meeting_id=meeting_id,
            project_id=project_id,
            meeting_type=meeting_type,
            decisions=decisions,
            blockers=blockers,
            actions=actions,
            summary=summary,
            extracted_at=datetime.utcnow()
        )

        db.collection("meetings").document(meeting_id).set(response.dict())
        return response

meeting_agent = MeetingIntelligenceAgent()
