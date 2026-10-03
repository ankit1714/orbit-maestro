from typing import List
from fastapi import APIRouter
from apps.api.src.schemas.git_telemetry import FlashHealthResult, GitCommit, PullRequest
from apps.api.src.core.provider_factory import provider_factory

try:
    from packages.agents.src.git_agent import git_agent
except ImportError:
    pass

router = APIRouter(prefix="/git-tracker", tags=["Git Telemetry & Flash Health"])

@router.get("/{project_id}/flash", response_model=FlashHealthResult)
def get_flash_health(project_id: str):
    """Compute real-time Flash Health signal (ON-TRACK, AT-RISK, OFF-TRACK) from commit and PR drift."""
    return git_agent.evaluate_git_health(project_id)

@router.get("/{project_id}/commits", response_model=List[GitCommit])
def get_recent_commits(project_id: str, since_hours: int = 48):
    """Get recent Git commits linked to project tasks."""
    provider = provider_factory.get_git_provider(project_id)
    return provider.get_recent_commits(project_id, since_hours)

@router.get("/{project_id}/prs", response_model=List[PullRequest])
def get_pull_requests(project_id: str, state: str = "open"):
    """Get active pull requests, review statuses, and CI checks."""
    provider = provider_factory.get_git_provider(project_id)
    return provider.get_pull_requests(project_id, state)
