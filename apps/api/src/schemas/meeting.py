from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from apps.api.src.schemas.common import MeetingType, GovernanceTier

class ExtractedDecision(BaseModel):
    id: str
    decision_text: str
    speaker: Optional[str] = None
    confidence_score: float = 0.95
    requires_approval: bool = True
    governance_tier: GovernanceTier = GovernanceTier.APPROVAL_REQUIRED

class ExtractedBlocker(BaseModel):
    id: str
    task_key: Optional[str] = None
    assignee: Optional[str] = None
    blocker_description: str
    impact: str
    confidence_score: float = 0.94

class ExtractedAction(BaseModel):
    id: str
    action_type: str # TASK_UPDATE, NEW_STORY, REASSIGNMENT, KAIZEN
    target_entity: str
    description: str
    assignee: Optional[str] = None
    confidence_score: float = 0.92
    governance_tier: GovernanceTier = GovernanceTier.AUTO_EXECUTE

class MeetingIngestRequest(BaseModel):
    project_id: str
    meeting_type: MeetingType = MeetingType.STANDUP
    title: str = "Daily Scrum"
    transcript_text: str
    date: datetime = Field(default_factory=datetime.utcnow)

class MeetingExtractResponse(BaseModel):
    meeting_id: str
    project_id: str
    meeting_type: MeetingType
    decisions: List[ExtractedDecision] = Field(default_factory=list)
    blockers: List[ExtractedBlocker] = Field(default_factory=list)
    actions: List[ExtractedAction] = Field(default_factory=list)
    summary: str
    extracted_at: datetime = Field(default_factory=datetime.utcnow)
