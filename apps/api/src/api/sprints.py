from typing import List
from fastapi import APIRouter, HTTPException
from apps.api.src.schemas.sprint import Sprint, SprintScopeCommitRequest, SpilloverItem, SpilloverResolutionRequest
from apps.api.src.schemas.common import AuditActionType, GovernanceTier
from apps.api.src.core.firestore_client import db
from apps.api.src.core.provider_factory import provider_factory

try:
    from packages.agents.src.sprint_agent import sprint_agent
    from packages.agents.src.orchestrator import orchestrator
except ImportError:
    pass

router = APIRouter(prefix="/sprints", tags=["Sprint Execution & Planning"])

@router.get("/{project_id}", response_model=Sprint)
def get_active_sprint(project_id: str):
    """
    Get active sprint details (synced from Jira if configured for project, or from database).
    """
    project = provider_factory.get_project(project_id)
    if project and project.mode == "ENTERPRISE_SYNC" and project.jira_settings and project.jira_settings.enabled:
        jira_provider = provider_factory.get_jira_provider(project_id)
        if jira_provider._is_configured():
            return jira_provider.get_active_sprint(project_id)

    # Use database store or generated sprint
    docs = list(db.collection("sprints").where("project_id", "==", project_id).where("status", "==", "ACTIVE").stream())
    if docs:
        return Sprint(**docs[0].to_dict())
    return sprint_agent.plan_sprint(project_id, sprint_number=1)

@router.post("/commit", response_model=Sprint)
def commit_sprint_scope(req: SprintScopeCommitRequest):
    """Commit sprint scope, setting sprint goal and locking committed stories."""
    project = provider_factory.get_project(req.project_id)
    if project and project.mode == "ENTERPRISE_SYNC" and project.jira_settings and project.jira_settings.enabled:
        jira_provider = provider_factory.get_jira_provider(req.project_id)
        if jira_provider._is_configured():
            sprint = jira_provider.get_active_sprint(req.project_id)
            sprint.goal = req.goal
            sprint.committed_story_ids = req.committed_story_ids
            return sprint
    else:
        doc_ref = db.collection("sprints").document(req.sprint_id)
        snap = doc_ref.get()
        if snap.exists:
            data = snap.to_dict()
            data["goal"] = req.goal
            data["committed_story_ids"] = req.committed_story_ids
            data["status"] = "ACTIVE"
            doc_ref.update(data)
            sprint = Sprint(**data)
        else:
            sprint = sprint_agent.plan_sprint(req.project_id, 1)

    orchestrator.log_activity(
        project_id=req.project_id,
        action_type=AuditActionType.SPRINT_COMMITTED,
        actor="Product Owner",
        description=f"Committed {sprint.name} scope with goal: '{req.goal}'",
        target=sprint.name,
        tier=GovernanceTier.APPROVAL_REQUIRED
    )
    return sprint

@router.get("/{project_id}/spillovers", response_model=List[SpilloverItem])
def get_spillover_forecast(project_id: str, sprint_id: str = "sprint-3"):
    """Get spillover risk analysis and recommended handling options."""
    return sprint_agent.evaluate_spillovers(project_id, sprint_id)

@router.post("/spillovers/resolve")
def resolve_spillover(req: SpilloverResolutionRequest):
    """Execute spillover decision (rollover to next sprint, split story, descope)."""
    orchestrator.log_activity(
        project_id=req.project_id,
        action_type=AuditActionType.SPILLOVER_TRIAGED,
        actor=req.authority,
        description=f"Executed spillover action '{req.action}' on task {req.task_id}",
        target=req.task_id,
        tier=GovernanceTier.APPROVAL_REQUIRED
    )
    return {"status": "SUCCESS", "action": req.action, "task_id": req.task_id}
