import re
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query
from apps.api.src.schemas.backlog import BacklogHierarchyResponse, TaskItem, UserStory, Epic
from apps.api.src.schemas.ambiguity import OpenQuestion, OpenQuestionResolveRequest
from apps.api.src.core.provider_factory import provider_factory
from apps.api.src.core.firestore_client import db
from apps.api.src.core.config import settings

try:
    from packages.agents.src.backlog_agent import backlog_agent
    from packages.agents.src.ambiguity_agent import ambiguity_agent
    from packages.agents.src.orchestrator import orchestrator
except ImportError:
    pass

router = APIRouter(prefix="/backlog", tags=["Backlog & Ambiguity Engine"])

@router.get("/{project_id}", response_model=BacklogHierarchyResponse)
def get_backlog(project_id: str):
    """Retrieve 4-tier product backlog hierarchy for project (uses Jira if configured for project, otherwise native database)."""
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
    """List open questions / ambiguities requiring Scrum Master input."""
    q = db.collection("open_questions").where("project_id", "==", project_id)
    if resolved is not None:
        q = q.where("resolved", "==", resolved)
    docs = list(q.stream())
    return [OpenQuestion(**d.to_dict()) for d in docs]

@router.post("/questions/resolve", response_model=OpenQuestion)
def resolve_question(req: OpenQuestionResolveRequest):
    """Resolve an open ambiguity with Scrum Master answer, unblocking story acceptance criteria."""
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
    Accepts optional 'project_key' and 'instance_url' in the payload to target a specific Jira project and instance.
    Persists updated Jira configuration in Firestore for the project.
    """
    target_key = payload.get("project_key") if payload else None
    instance_url = payload.get("instance_url") if payload else None

    # Persist edited Jira instance or project key to Firestore project document
    if instance_url or target_key:
        try:
            doc_ref = db.collection("projects").document(project_id)
            doc = doc_ref.get()
            if doc.exists:
                current = doc.to_dict()
                update_data = {}
                current_js = current.get("jira_settings") or {}

                if instance_url:
                    raw_inst = instance_url.strip()
                    update_data["jira_project_link"] = raw_inst
                    m_domain = re.search(r'(https?://[^/]+)', raw_inst)
                    if m_domain:
                        current_js["instance_url"] = m_domain.group(1)
                    else:
                        current_js["instance_url"] = raw_inst

                if target_key:
                    clean_key = target_key.strip().upper()
                    current_js["project_key"] = clean_key

                current_js["enabled"] = True
                current_js["user_email"] = current_js.get("user_email") or settings.JIRA_USER_EMAIL
                current_js["api_token"] = current_js.get("api_token") or settings.JIRA_API_TOKEN
                update_data["jira_settings"] = current_js
                doc_ref.update(update_data)
        except Exception as e:
            print(f"Warning: could not update project {project_id} Jira settings in Firestore: {e}")

    jira_provider = provider_factory.get_jira_provider(
        project_id,
        target_project_key=target_key,
        target_instance_url=instance_url
    )

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

