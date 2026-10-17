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
    reviewed_by: str = "Scrum Master"
    review_notes: Optional[str] = None

class ActivityLogEntry(BaseModel):
    id: str
    project_id: str
    action_type: AuditActionType
    actor: str # e.g. "Workflow Agent", "Scrum Master", "Task Agent"
    description: str
    target_entity: str
    governance_tier: GovernanceTier
    confidence: float = 1.0
    details: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ItemType(str):
    ACTION_ITEM = "ACTION_ITEM"
    DECISION = "DECISION"

class ActionDecisionStatus(str):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    BLOCKED = "BLOCKED"
    APPROVED = "APPROVED"
    SUPERSEDED = "SUPERSEDED"

class ActionDecisionItem(BaseModel):
    id: str
    project_id: str
    type: str # "ACTION_ITEM" or "DECISION"
    title: str
    description: str
    status: str = "PENDING" # PENDING, IN_PROGRESS, COMPLETED, BLOCKED, APPROVED, SUPERSEDED
    meeting_id: Optional[str] = None
    meeting_title: Optional[str] = None
    meeting_date: Optional[str] = None
    meeting_type: Optional[str] = None
    assignee: Optional[str] = None
    decision_maker: Optional[str] = None
    due_date: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    created_by: Optional[str] = "Meeting Intelligence"
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None
    notes: Optional[str] = None

class ActionDecisionCreate(BaseModel):
    project_id: str
    type: str = "ACTION_ITEM" # ACTION_ITEM or DECISION
    title: str
    description: str
    status: str = "PENDING"
    meeting_id: Optional[str] = None
    meeting_title: Optional[str] = None
    meeting_date: Optional[str] = None
    meeting_type: Optional[str] = None
    assignee: Optional[str] = None
    decision_maker: Optional[str] = None
    due_date: Optional[str] = None
    created_by: Optional[str] = "Manual Entry"
    notes: Optional[str] = None

class ActionDecisionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    assignee: Optional[str] = None
    decision_maker: Optional[str] = None
    due_date: Optional[str] = None
    notes: Optional[str] = None
    updated_by: Optional[str] = None
