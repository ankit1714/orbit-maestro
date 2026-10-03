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
    """Retrieve 4-tier product backlog hierarchy for project."""
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
    """Update task status (e.g. TODO -> IN_PROGRESS -> IN_REVIEW -> DONE)."""
    provider = provider_factory.get_backlog_provider(project_id)
    return provider.update_task_status(project_id, task_id, new_status)
