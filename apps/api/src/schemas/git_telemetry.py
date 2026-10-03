from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from apps.api.src.schemas.common import FlashHealthStatus

class GitCommit(BaseModel):
    sha: str
    author_name: str
    author_email: str
    message: str
    timestamp: datetime
    branch: str
    linked_issue_keys: List[str] = Field(default_factory=list)
    files_changed: int = 1
    insertions: int = 10
    deletions: int = 2

class PullRequest(BaseModel):
    number: int
    title: str
    state: str # open, closed, merged
    author: str
    draft: bool = False
    linked_issue_keys: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    merged_at: Optional[datetime] = None
    review_status: str = "APPROVED" # APPROVED, CHANGES_REQUESTED, PENDING
    ci_status: str = "SUCCESS" # SUCCESS, FAILURE, PENDING

class FlashHealthResult(BaseModel):
    project_id: str
    sprint_id: Optional[str] = None
    status: FlashHealthStatus = FlashHealthStatus.ON_TRACK
    headline: str
    stalled_task_keys: List[str] = Field(default_factory=list)
    blocked_pr_numbers: List[int] = Field(default_factory=list)
    recent_commit_count_48h: int = 0
    active_branches_count: int = 0
    reasons: List[str] = Field(default_factory=list)
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)
