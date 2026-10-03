from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from apps.api.src.schemas.common import GovernanceTier, AuditActionType

class GovernanceApproval(BaseModel):
    id: str
    project_id: str
    tier: GovernanceTier = GovernanceTier.APPROVAL_REQUIRED
    title: str
    summary: str
    observation: str
    delivery_impact: str
    ai_proposed_action: str
    target_entity_type: str # STORY, TASK, SPRINT, REQUIREMENT
    target_entity_id: str
    confidence_score: float = 0.94
    status: str = "PENDING" # PENDING, APPROVED, REJECTED
    reviewed_by: Optional[str] = None
    review_notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_at: Optional[datetime] = None

class ApprovalActionRequest(BaseModel):
    approval_id: str
    action: str # "APPROVE" or "REJECT"
    reviewed_by: str = "Product Owner"
    review_notes: Optional[str] = None

class ActivityLogEntry(BaseModel):
    id: str
    project_id: str
    action_type: AuditActionType
    actor: str # e.g. "Workflow Agent", "Product Owner", "Task Agent"
    description: str
    target_entity: str
    governance_tier: GovernanceTier
    confidence: float = 1.0
    details: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
