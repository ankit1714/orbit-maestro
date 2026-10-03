from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from apps.api.src.schemas.common import Priority

class OpenQuestion(BaseModel):
    id: str
    project_id: str
    question: str
    section_ref: str
    why_needed: str
    delivery_impact: str
    priority: Priority = Priority.HIGH
    ai_suggested_answer: str
    options: List[str] = Field(default_factory=list)
    confidence_score: float = 0.95
    resolved: bool = False
    resolved_answer: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None

class OpenQuestionResolveRequest(BaseModel):
    question_id: str
    resolved_answer: str
    resolved_by: str = "Product Owner"

class Assumption(BaseModel):
    id: str
    project_id: str
    statement: str
    source_ref: str
    status: str = "UNCONFIRMED" # UNCONFIRMED, VERIFIED, REJECTED
    owner: str = "Engineering Lead"
    impact: Priority = Priority.MEDIUM
    created_at: datetime = Field(default_factory=datetime.utcnow)
