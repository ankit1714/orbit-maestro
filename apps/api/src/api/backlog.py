from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query
from apps.api.src.schemas.backlog import BacklogHierarchyResponse, TaskItem, UserStory, Epic
from apps.api.src.schemas.ambiguity import OpenQuestion, OpenQuestionResolveRequest
from apps.api.src.core.provider_factory import provider_factory
from apps.api.src.core.firestore_client import db

try:
    from packages.agents.src.backlog_agent import backlog_agent
    from packages.agents.src.ambiguity_agent import ambiguity_agent
    from packages.agents.src.orchestrator import orchestrator
except ImportError:
    pass

router = APIRouter(prefix="/backlog", tags=["Backlog & Ambiguity Engine"])

@router.get("/{project_id}", response_model=BacklogHierarchyResponse)
def get_backlog(project_id: str):
    """Retrieve 4-tier product backlog hierarchy for project (synced directly from Jira if configured)."""
    jira_provider = provider_factory.get_jira_provider(project_id)
    if jira_provider._is_configured():
        return jira_provider.get_backlog(project_id)
    provider = provider_factory.get_backlog_provider(project_id)
    return provider.get_backlog(project_id)

@router.post("/generate", response_model=BacklogHierarchyResponse)
def generate_backlog(payload: Dict[str, Any]):
    """Synthesize backlog from requirements and resolved open questions."""
    project_id = payload.get("project_id", "proj-demo")
    clarifications = payload.get("clarifications", {})
    return backlog_agent.synthesize_backlog(project_id, clarifications)

@router.get("/questions/{project_id}", response_model=List[OpenQuestion])
def list_open_questions(project_id: str, resolved: Optional[bool] = None):
    """List open questions / ambiguities requiring Product Owner input."""
    q = db.collection("open_questions").where("project_id", "==", project_id)
    if resolved is not None:
        q = q.where("resolved", "==", resolved)
    docs = list(q.stream())
    return [OpenQuestion(**d.to_dict()) for d in docs]

@router.post("/questions/resolve", response_model=OpenQuestion)
def resolve_question(req: OpenQuestionResolveRequest):
    """Resolve an open ambiguity with PO answer, unblocking story acceptance criteria."""
    return ambiguity_agent.resolve_question(req.question_id, req.resolved_answer, req.resolved_by)

@router.put("/tasks/{task_id}/status", response_model=TaskItem)
def update_task_status(task_id: str, project_id: str = Query(...), new_status: str = Query(...)):
    """Update task status in real-time (synced to Jira workflow if task is a Jira issue)."""
    jira_provider = provider_factory.get_jira_provider(project_id)
    if jira_provider._is_configured():
        return jira_provider.update_task_status(project_id, task_id, new_status)
    provider = provider_factory.get_backlog_provider(project_id)
    return provider.update_task_status(project_id, task_id, new_status)

@router.get("/jira/status")
def get_jira_status():
    """Verify live Jira connectivity, URL, and authenticated user."""
    jira_provider = provider_factory.get_jira_provider("default")
    return jira_provider.check_connection()

@router.post("/{project_id}/upload-jira")
def upload_backlog_to_jira(project_id: str, payload: Optional[Dict[str, Any]] = None):
    """
    Upload and synchronize an existing backlog (Epics, Stories, Tasks) directly to Jira.
    Accepts optional 'project_key' in the payload to target a specific Jira project (e.g. CKST2).
    """
    target_key = payload.get("project_key") if payload else None
    jira_provider = provider_factory.get_jira_provider(project_id, target_project_key=target_key)

    if not jira_provider._is_configured():
        raise HTTPException(
            status_code=400,
            detail="Jira credentials not configured. Please set JIRA_INSTANCE_URL, JIRA_USER_EMAIL, and JIRA_API_TOKEN in environment or project settings."
        )

    try:
        result = jira_provider.upload_project_backlog(project_id, target_project_key=target_key)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload backlog to Jira: {str(e)}")

