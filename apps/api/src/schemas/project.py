from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from apps.api.src.schemas.common import ProjectMode

class TeamMember(BaseModel):
    id: str
    name: str
    role: str
    email: str
    skills: List[str] = Field(default_factory=list)
    available_hours_per_week: float = 40.0
    current_workload_hours: float = 0.0

class GitSettings(BaseModel):
    enabled: bool = True
    repo_url: Optional[str] = None
    repo_owner: Optional[str] = None
    repo_name: Optional[str] = None
    default_branch: str = "main"
    access_token: Optional[str] = None

class JiraSettings(BaseModel):
    enabled: bool = False
    instance_url: Optional[str] = None
    project_key: Optional[str] = None
    user_email: Optional[str] = None
    api_token: Optional[str] = None
    board_id: Optional[str] = None

class ConfluenceSettings(BaseModel):
    enabled: bool = False
    instance_url: Optional[str] = None
    space_key: Optional[str] = None
    user_email: Optional[str] = None
    api_token: Optional[str] = None
    parent_page_id: Optional[str] = None

class NotebookLMSettings(BaseModel):
    enabled: bool = True
    notebook_id: Optional[str] = None
    notebook_url: Optional[str] = None
    workspace_name: Optional[str] = None
    auto_sync_artifacts: bool = True

class ProjectBase(BaseModel):
    name: str
    key: str = Field(..., description="Project Key prefix, e.g. CLM, FIN, SCRUM")
    description: str
    business_objective: Optional[str] = None
    mode: ProjectMode = ProjectMode.STANDALONE
    sprint_duration_days: int = 14
    target_velocity_points: int = 32

class ProjectCreate(ProjectBase):
    jira_project_link: Optional[str] = Field(None, description="Full link to Jira project, e.g. https://domain.atlassian.net/jira/software/projects/KEY/summary")
    developer_names: Optional[List[str]] = Field(default_factory=list, description="Names of developers assigned to the project")
    developer_skills_input: Optional[str] = Field(None, description="Developer and skill profiles e.g. 'Ankit Maurya: Python, FastAPI, Cloud Run; Sarah Chen: React, Next.js, UI'")
    team_members: List[TeamMember] = Field(default_factory=list)
    git_settings: Optional[GitSettings] = Field(default_factory=GitSettings)
    jira_settings: Optional[JiraSettings] = Field(default_factory=JiraSettings)
    confluence_settings: Optional[ConfluenceSettings] = Field(default_factory=ConfluenceSettings)
    notebooklm_settings: Optional[NotebookLMSettings] = Field(default_factory=NotebookLMSettings)

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    business_objective: Optional[str] = None
    mode: Optional[ProjectMode] = None
    sprint_duration_days: Optional[int] = None
    target_velocity_points: Optional[int] = None
    team_members: Optional[List[TeamMember]] = None
    git_settings: Optional[GitSettings] = None
    jira_settings: Optional[JiraSettings] = None
    confluence_settings: Optional[ConfluenceSettings] = None
    notebooklm_settings: Optional[NotebookLMSettings] = None

class Project(ProjectBase):
    id: str
    team_members: List[TeamMember] = Field(default_factory=list)
    git_settings: GitSettings = Field(default_factory=GitSettings)
    jira_settings: JiraSettings = Field(default_factory=JiraSettings)
    confluence_settings: ConfluenceSettings = Field(default_factory=ConfluenceSettings)
    notebooklm_settings: NotebookLMSettings = Field(default_factory=NotebookLMSettings)
    active_sprint_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
