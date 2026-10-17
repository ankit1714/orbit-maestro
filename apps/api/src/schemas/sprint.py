from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from apps.api.src.schemas.common import ItemStatus
from apps.api.src.schemas.backlog import UserStory

class DeveloperCapacity(BaseModel):
    name: str
    role: str = "Developer"
    assigned_tickets_count: int = 0
    assigned_story_points: float = 0.0
    allocated_hours: float = 0.0
    available_hours: float = 80.0
    load_pct: float = 0.0
    status: str = "BALANCED" # HEALTHY, BALANCED, HIGH_LOAD, OVERLOADED

class SprintCapacity(BaseModel):
    team_total_hours: float = 0.0
    committed_hours: float = 0.0
    overall_load_pct: float = 0.0
    frontend_hours: float = 0.0
    frontend_committed_hours: float = 0.0
    frontend_load_pct: float = 0.0
    backend_hours: float = 0.0
    backend_committed_hours: float = 0.0
    backend_load_pct: float = 0.0
    qa_hours: float = 0.0
    qa_committed_hours: float = 0.0
    qa_load_pct: float = 0.0
    developer_allocations: List[DeveloperCapacity] = Field(default_factory=list)

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
    planned_points: int = 0
    delivered_points: int = 0
    remaining_days: int = 0
    total_days: int = 14
    start_date: datetime
    end_date: datetime
    committed_story_ids: List[str] = Field(default_factory=list)
    capacity: SprintCapacity = Field(default_factory=SprintCapacity)
    source: str = "JIRA"
    jira_board_id: Optional[int] = None
    jira_sprint_id: Optional[int] = None

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
