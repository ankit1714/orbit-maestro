from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from apps.api.src.schemas.common import ItemStatus
from apps.api.src.schemas.backlog import UserStory

class SprintCapacity(BaseModel):
    team_total_hours: float = 160.0
    frontend_hours: float = 60.0
    backend_hours: float = 80.0
    qa_hours: float = 20.0
    frontend_load_pct: float = 72.0
    backend_load_pct: float = 108.0 # Alert
    qa_load_pct: float = 65.0

class SpilloverItem(BaseModel):
    task_id: str
    task_key: str
    title: str
    points: int
    assignee: str
    spillover_probability_pct: float
    reason: str
    ai_recommendation: str

class Sprint(BaseModel):
    id: str
    project_id: str
    sprint_number: int
    name: str
    goal: str
    status: str = "ACTIVE" # PLANNING, ACTIVE, COMPLETED
    planned_points: int = 32
    delivered_points: int = 24
    remaining_days: int = 3
    total_days: int = 10
    start_date: datetime
    end_date: datetime
    committed_story_ids: List[str] = Field(default_factory=list)
    capacity: SprintCapacity = Field(default_factory=SprintCapacity)

class SprintScopeCommitRequest(BaseModel):
    project_id: str
    sprint_id: str
    goal: str
    committed_story_ids: List[str]
    buffer_percentage: float = 10.0

class SpilloverResolutionRequest(BaseModel):
    project_id: str
    sprint_id: str
    task_id: str
    action: str # "ROLLOVER_SPRINT_4", "SPLIT_STORY", "DESCOPE"
    authority: str = "Scrum Master"
