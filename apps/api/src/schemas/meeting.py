from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from apps.api.src.schemas.common import MeetingType, GovernanceTier

class ExtractedDecision(BaseModel):
    id: str
    decision_text: str
    speaker: Optional[str] = None
    confidence_score: float = 0.95
    requires_approval: bool = False
    governance_tier: GovernanceTier = GovernanceTier.AUTO_EXECUTE

class ExtractedBlocker(BaseModel):
    id: str
    task_key: Optional[str] = None
    assignee: Optional[str] = None
    blocker_description: str
    impact: str
    confidence_score: float = 0.94

class ExtractedAction(BaseModel):
    id: str
    action_type: str = "TASK_UPDATE" # TASK_UPDATE, NEW_STORY, REASSIGNMENT, KAIZEN
    target_entity: str = "TASK"
    description: str
    assignee: Optional[str] = None
    confidence_score: float = 0.92
    governance_tier: GovernanceTier = GovernanceTier.AUTO_EXECUTE

class LinkedJiraIssue(BaseModel):
    key: str # e.g. "HM-2", "HM-3"
    title: str
    issue_type: Optional[str] = "Story" # Story, Bug, Task, Epic
    status: Optional[str] = "To Do"
    assignee: Optional[str] = None
    relationship: str = "Related Task" # "Directly Discussed", "Blocker/Impediment", "Acceptance Criteria", "Bug Raised", "Status Change"
    relevance_reason: str
    confidence_score: float = 0.90
    url: Optional[str] = None

class LinkedGitArtifact(BaseModel):
    repo_name: str
    artifact_type: str = "FILE" # "FILE", "COMMIT", "WORKFLOW", "PULL_REQUEST", "ARCHITECTURE"
    path_or_identifier: str # e.g. "package.json", ".github/workflows/deploy.yml", "commit 2a699c3"
    relationship: str = "Impacted Artifact"
    relevance_reason: str
    confidence_score: float = 0.88

class LinkedConfluencePage(BaseModel):
    page_id: Optional[str] = None
    title: str
    space_key: Optional[str] = None
    relationship: str = "Referenced Specification"
    relevance_reason: str
    confidence_score: float = 0.88
    url: Optional[str] = None

class MeetingDueDiligenceResult(BaseModel):
    is_linked: bool = False
    relevance_status: str = "NOT_LINKED" # "LINKED", "NOT_LINKED"
    verdict_message: str = "Not linked to any GIT/JIRA/Confluence"
    detailed_analysis: str = ""
    linked_jira_issues: List[LinkedJiraIssue] = Field(default_factory=list)
    linked_git_artifacts: List[LinkedGitArtifact] = Field(default_factory=list)
    linked_confluence_pages: List[LinkedConfluencePage] = Field(default_factory=list)
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)

class MeetingIngestRequest(BaseModel):
    project_id: str
    title: str = "Daily Scrum"
    meeting_type: MeetingType = MeetingType.STANDUP
    transcript_text: str # Meeting minutes / notes
    entered_by: Optional[str] = "Team Member"
    date: datetime = Field(default_factory=datetime.utcnow)
    tags: Optional[List[str]] = Field(default_factory=list)

class MeetingExtractResponse(BaseModel):
    meeting_id: str
    project_id: str
    title: str = "Daily Scrum"
    meeting_type: MeetingType
    transcript_text: str = ""
    entered_by: str = "Team Member"
    date: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    decisions: List[ExtractedDecision] = Field(default_factory=list)
    blockers: List[ExtractedBlocker] = Field(default_factory=list)
    actions: List[ExtractedAction] = Field(default_factory=list)
    summary: str = ""
    due_diligence: Optional[MeetingDueDiligenceResult] = None
    is_linked: bool = False
    verdict_message: str = "Not linked to any GIT/JIRA/Confluence"
    extracted_at: datetime = Field(default_factory=datetime.utcnow)
