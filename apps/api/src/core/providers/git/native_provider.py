from typing import List
from apps.api.src.core.providers.base import BaseGitProvider
from apps.api.src.schemas.git_telemetry import GitCommit, PullRequest
from apps.api.src.core.providers.git.github_provider import GitHubTrackerProvider

class NativeGitTrackerProvider(BaseGitProvider):
    """Graceful fallback when no GitHub repo URL is linked."""
    def __init__(self):
        self._delegate = GitHubTrackerProvider()

    def get_recent_commits(self, project_id: str, since_hours: int = 48) -> List[GitCommit]:
        return self._delegate.get_recent_commits(project_id, since_hours)

    def get_pull_requests(self, project_id: str, state: str = "open") -> List[PullRequest]:
        return self._delegate.get_pull_requests(project_id, state)
