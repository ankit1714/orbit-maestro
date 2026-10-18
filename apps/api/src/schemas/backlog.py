from pydantic import BaseModel, Field
from typing import List, Optional, Any, Union
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
    key: str # e.g. TSK-301 or SCRUM-7
    project_id: str
    story_id: str
    title: str
    task_type: Union[TaskType, str] = TaskType.DEV
    status: Union[ItemStatus, str] = ItemStatus.TODO
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    assignee_email: Optional[str] = None
    effort_days: float = 1.0
    story_points: Optional[int] = None
    trace_ref: Optional[str] = None
    is_blocked: bool = False
    blocker_reason: Optional[str] = None
    idle_hours: float = 0.0
    skill_match_percentage: int = 92
    skill_match_rationale: Optional[str] = None
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    jira_url: Optional[str] = None
    sprint_id: Optional[str] = None
    sprint_name: Optional[str] = None

class UserStory(BaseModel):
    id: str
    key: str # e.g. STY-102 or SCRUM-6
    project_id: str
    epic_id: str
    title: str
    description: Optional[str] = ""
    requirement_origin: Optional[str] = ""
    story_points: Optional[int] = None
    priority: Union[Priority, str] = Priority.HIGH
    status: Union[ItemStatus, str] = ItemStatus.TODO
    assignee_id: Optional[str] = None
    assignee_name: Optional[str] = None
    assignee_email: Optional[str] = None
    skill_match_percentage: int = 92
    skill_match_rationale: Optional[str] = None
    acceptance_criteria: List[AcceptanceCriteria] = Field(default_factory=list)
    tasks: List[TaskItem] = Field(default_factory=list)
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    jira_url: Optional[str] = None
    sprint_id: Optional[str] = None
    sprint_name: Optional[str] = None

class Epic(BaseModel):
    id: str
    key: str # e.g. EPC-01 or SCRUM-5
    project_id: str
    title: str
    description: Optional[str] = ""
    requirement_origin: Optional[str] = ""
    total_points: int = 0
    status: Union[ItemStatus, str] = ItemStatus.IN_PROGRESS
    stories: List[UserStory] = Field(default_factory=list)
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default_factory=datetime.utcnow)
    jira_url: Optional[str] = None

class BacklogHierarchyResponse(BaseModel):
    project_id: str
    source: str = "FIRESTORE" # JIRA or FIRESTORE
    jira_instance_url: Optional[str] = None
    jira_project_key: Optional[str] = None
    epics: List[Epic] = Field(default_factory=list)
    total_epics: int
    total_stories: int
    total_tasks: int
    total_points: int
