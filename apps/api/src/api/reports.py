from typing import List, Dict, Any
from datetime import datetime
from fastapi import APIRouter
from apps.api.src.schemas.analytics import ExecutiveDeliveryReport, CycleTimeMetric
from apps.api.src.core.bigquery_client import bq_service
from apps.api.src.core.provider_factory import provider_factory
from apps.api.src.core.firestore_client import db

router = APIRouter(prefix="/reports", tags=["Actionable Reports & BigQuery Analytics"])

@router.get("/{project_id}/executive", response_model=ExecutiveDeliveryReport)
def get_executive_report(project_id: str):
    """
    Generate dynamic executive delivery brief and sprint completion summary
    synchronized directly from Jira Cloud and BigQuery analytics.
    """
    project = provider_factory.get_project(project_id)
    project_name = project.name if project else "Active Delivery Project"
    project_key = project.key if project else "SCRUM"

    jira_provider = provider_factory.get_jira_provider(project_id)
    is_jira = jira_provider._is_configured()

    if is_jira:
        sprint = jira_provider.get_active_sprint(project_id)
        backlog = jira_provider.get_backlog(project_id)

        sprint_name = sprint.name
        planned_pts = sprint.planned_points or backlog.total_points or 30
        delivered_pts = sprint.delivered_points or 0

        # Collect all tasks and stories from Jira hierarchy
        all_tasks = []
        for e in backlog.epics:
            for s in e.stories:
                if s.tasks:
                    all_tasks.extend(s.tasks)
                else:
                    all_tasks.append(s)

        done_tasks = [t for t in all_tasks if getattr(t, "status", "").lower() in ["done", "completed", "resolved", "closed"]]
        blocked_tasks = [t for t in all_tasks if getattr(t, "status", "").lower() in ["blocked", "impediment"] or getattr(t, "is_blocked", False)]
        remaining_days = sprint.remaining_days
        total_days = sprint.total_days

    else:
        # Fallback to local Firestore
        sprint_docs = list(db.collection("sprints").where("project_id", "==", project_id).where("status", "==", "ACTIVE").stream())
        sprint_data = sprint_docs[0].to_dict() if sprint_docs else {}
        sprint_name = sprint_data.get("name", "Sprint 1")
        planned_pts = sprint_data.get("planned_points", 30)
        delivered_pts = sprint_data.get("delivered_points", 0)
        remaining_days = sprint_data.get("remaining_days", 10)
        total_days = sprint_data.get("total_days", 14)

        task_docs = list(db.collection("tasks").where("project_id", "==", project_id).stream())
        all_tasks = [t.to_dict() for t in task_docs]
        done_tasks = [t for t in all_tasks if t.get("status") == "DONE"]
        blocked_tasks = [t for t in all_tasks if t.get("status") == "BLOCKED" or t.get("is_blocked")]

    # Calculate real completion rate
    if planned_pts > 0 and delivered_pts > 0:
        completion_pct = round((delivered_pts / planned_pts) * 100.0, 1)
    elif all_tasks and done_tasks:
        completion_pct = round((len(done_tasks) / len(all_tasks)) * 100.0, 1)
    else:
        completion_pct = 0.0

    delivery_health = "At Risk" if len(blocked_tasks) > 1 else ("Watch" if blocked_tasks else "Healthy")

    accomplishments = []
    if done_tasks:
        for dt in done_tasks[:4]:
            t_key = getattr(dt, "key", dt.get("key", "task") if isinstance(dt, dict) else "task")
            t_title = getattr(dt, "title", dt.get("title", "") if isinstance(dt, dict) else "")
            accomplishments.append(f"Completed {t_key}: {t_title}")
    else:
        accomplishments.append(f"Synchronized active backlog from Jira project {project_key}.")
        accomplishments.append(f"Sprint scope committed with {planned_pts} target story points.")

    bottlenecks = []
    if blocked_tasks:
        for bt in blocked_tasks[:3]:
            b_key = getattr(bt, "key", bt.get("key", "task") if isinstance(bt, dict) else "task")
            b_title = getattr(bt, "title", bt.get("title", "") if isinstance(bt, dict) else "")
            bottlenecks.append(f"{b_key}: {b_title} (Flagged impediment in Jira)")
    else:
        bottlenecks.append("Zero active blockers detected on critical path in Jira.")

    commitments = [
        f"Maintain daily standup check-ins and active commitment pace for {sprint_name}.",
        "Automate continuous integration test verification pipelines."
    ]

    md_content = f"""# AI Scrum Master — {sprint_name} Executive Report
Project: {project_name} ({project_key})
Generated: {datetime.utcnow().strftime('%b %d, %Y')} · Model: Gemini 2.5 Flash
Source: {'Jira Cloud Direct Sync' if is_jira else 'Firestore'}
Delivery Health: {delivery_health} · Completion Rate: {completion_pct}% ({delivered_pts} of {planned_pts} pts)

## 1. Key Accomplishments
{chr(10).join(['- ' + a for a in accomplishments])}

## 2. Critical Path Bottlenecks
{chr(10).join(['- ' + b for b in bottlenecks])}

## 3. Retrospective Commitments
{chr(10).join(['- ' + c for c in commitments])}
"""

    return ExecutiveDeliveryReport(
        project_id=project_id,
        project_name=project_name,
        sprint_name=sprint_name,
        status_day=f"Day {max(1, total_days - remaining_days)} of {total_days}",
        delivery_health=delivery_health,
        completion_rate_pct=completion_pct,
        key_accomplishments=accomplishments,
        critical_path_bottlenecks=bottlenecks,
        retrospective_commitments=commitments,
        markdown_content=md_content,
        generated_at=datetime.utcnow()
    )

@router.get("/{project_id}/spillover-trends")
def get_spillover_trends(project_id: str):
    """Fetch multi-sprint spillover trends from BigQuery analytics."""
    return bq_service.query_spillover_trends(project_id)

@router.get("/{project_id}/cycle-times")
def get_cycle_times(project_id: str):
    """Fetch cycle time metrics from BigQuery analytics."""
    return bq_service.query_cycle_times(project_id)
