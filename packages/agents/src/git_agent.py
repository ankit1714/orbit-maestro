import logging
from typing import List, Dict, Any
from apps.api.src.core.provider_factory import provider_factory
from apps.api.src.core.flash_engine import flash_engine
from apps.api.src.schemas.git_telemetry import FlashHealthResult

logger = logging.getLogger("git_agent")

class GitDriftAgent:
    def evaluate_git_health(self, project_id: str) -> FlashHealthResult:
        logger.info(f"Git Agent analyzing commit and PR drift for project {project_id}")
        git_provider = provider_factory.get_git_provider(project_id)
        commits = git_provider.get_recent_commits(project_id, since_hours=48)
        prs = git_provider.get_pull_requests(project_id, state="open")
        return flash_engine.compute_flash_health(project_id, commits, prs)

git_agent = GitDriftAgent()
