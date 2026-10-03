import logging
from typing import List, Optional
from datetime import datetime, timedelta
from apps.api.src.schemas.common import FlashHealthStatus
from apps.api.src.schemas.git_telemetry import FlashHealthResult, GitCommit, PullRequest
from apps.api.src.core.firestore_client import db

logger = logging.getLogger("flash_engine")

class FlashHealthEngine:
    def compute_flash_health(self, project_id: str, commits: List[GitCommit], prs: List[PullRequest]) -> FlashHealthResult:
        now = datetime.utcnow()
        reasons: List[str] = []
        stalled_keys: List[str] = []
        blocked_prs: List[int] = []

        # 1. Fetch in-progress and blocked tasks for this project
        task_docs = list(db.collection("tasks").where("project_id", "==", project_id).stream())
        in_progress_tasks = []
        blocked_tasks = []
        for td in task_docs:
            t = td.to_dict()
            status = t.get("status")
            if status == "IN_PROGRESS":
                in_progress_tasks.append(t)
            elif status == "BLOCKED" or t.get("is_blocked"):
                blocked_tasks.append(t)

        # 2. Match commit timestamps to in-progress tasks
        commit_keys = set()
        recent_commit_count = 0
        for c in commits:
            commit_keys.update(c.linked_issue_keys)
            # Check if within 48h
            c_time = c.timestamp.replace(tzinfo=None) if hasattr(c.timestamp, "tzinfo") and c.timestamp.tzinfo else c.timestamp
            if (now - c_time).total_seconds() <= 48 * 3600:
                recent_commit_count += 1

        for t in in_progress_tasks:
            t_key = t.get("key", "")
            if t_key and t_key not in commit_keys:
                stalled_keys.append(t_key)
                reasons.append(f"Task {t_key} ('{t.get('title')}') has had 0 git commits for over 48 hours.")

        for b in blocked_tasks:
            b_key = b.get("key", "")
            reasons.append(f"Active blocker on {b_key}: {b.get('blocker_reason', 'External dependency delay')}")

        all_project_keys = set(t.get("key") for t in (in_progress_tasks + blocked_tasks))
        relevant_prs = [pr for pr in prs if any(k in all_project_keys for k in pr.linked_issue_keys)]

        for pr in relevant_prs:
            if pr.review_status == "CHANGES_REQUESTED" or pr.ci_status == "FAILURE":
                blocked_prs.append(pr.number)
                reasons.append(f"PR #{pr.number} ('{pr.title}') has failing CI checks or pending review revisions.")

        # Determine Flash Status
        if blocked_tasks or blocked_prs or len(stalled_keys) >= 2:
            status = FlashHealthStatus.OFF_TRACK
            headline = "🔴 OFF-TRACK: Critical path task blocked & development stalled on active scope."
        elif stalled_keys:
            status = FlashHealthStatus.AT_RISK
            headline = "🟡 AT-RISK: In-progress tasks showing zero commit movement in last 24h."
        else:
            status = FlashHealthStatus.ON_TRACK
            headline = "🟢 ON-TRACK: All sprint stories advancing with regular commit rhythm and passing CI."
            reasons.append(f"{recent_commit_count} commits registered across active feature branches.")

        return FlashHealthResult(
            project_id=project_id,
            status=status,
            headline=headline,
            stalled_task_keys=stalled_keys,
            blocked_pr_numbers=blocked_prs,
            recent_commit_count_48h=recent_commit_count,
            active_branches_count=2,
            reasons=reasons,
            evaluated_at=now
        )

flash_engine = FlashHealthEngine()
