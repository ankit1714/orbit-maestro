from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from apps.api.src.schemas.common import ItemStatus, Priority, TaskType

class AcceptanceCriteria(BaseModel):
    id: str
    scenario: str
    given: str
    when: str
    then: str

class TaskItem(BaseModel):
    id: str
    key: str # e.g. TSK-301
    project_id: str
    story_id: str
    title: str
    task_type: TaskType = TaskType.DEV
    status: ItemStatus = ItemStatus.TODO
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    effort_days: float = 1.0
    trace_ref: Optional[str] = None
    is_blocked: bool = False
    blocker_reason: Optional[str] = None
    idle_hours: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserStory(BaseModel):
    id: str
    key: str # e.g. STY-102
    project_id: str
    epic_id: str
    title: str
    description: str
    requirement_origin: str
    story_points: int = 5
    priority: Priority = Priority.HIGH
    status: ItemStatus = ItemStatus.TODO
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    skill_match_percentage: int = 90
    acceptance_criteria: List[AcceptanceCriteria] = Field(default_factory=list)
    tasks: List[TaskItem] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class Epic(BaseModel):
    id: str
    key: str # e.g. EPC-01
    project_id: str
    title: str
    description: str
    requirement_origin: str
    total_points: int = 0
    status: ItemStatus = ItemStatus.IN_PROGRESS
    stories: List[UserStory] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class BacklogHierarchyResponse(BaseModel):
    project_id: str
    epics: List[Epic] = Field(default_factory=list)
    total_epics: int
    total_stories: int
    total_tasks: int
    total_points: int
