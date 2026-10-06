import uuid
from typing import List
from datetime import datetime
from fastapi import APIRouter, HTTPException
from apps.api.src.schemas.project import Project, ProjectCreate, ProjectUpdate
from apps.api.src.core.firestore_client import db

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.get("", response_model=List[Project])
def list_projects():
    """List all configured projects."""
    docs = list(db.collection("projects").stream())
    return [Project(**d.to_dict()) for d in docs]

@router.get("/{project_id}", response_model=Project)
def get_project(project_id: str):
    """Get project by ID."""
    doc = db.collection("projects").document(project_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")
    return Project(**doc.to_dict())

@router.post("", response_model=Project)
def create_project(data: ProjectCreate):
    """Create a new project (Standalone or Enterprise Sync mode)."""
    project_id = f"proj-{uuid.uuid4().hex[:8]}"
    project = Project(
        id=project_id,
        name=data.name,
        key=data.key.upper(),
        description=data.description,
        business_objective=data.business_objective,
        mode=data.mode,
        sprint_duration_days=data.sprint_duration_days,
        target_velocity_points=data.target_velocity_points,
        team_members=data.team_members,
        git_settings=data.git_settings,
        jira_settings=data.jira_settings,
        confluence_settings=data.confluence_settings,
        notebooklm_settings=data.notebooklm_settings,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.collection("projects").document(project_id).set(project.dict())
    return project

@router.put("/{project_id}", response_model=Project)
def update_project(project_id: str, data: ProjectUpdate):
    """Update project settings, mode, or team capacity."""
    doc_ref = db.collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")
    
    current = doc.to_dict()
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    current.update(update_data)
    doc_ref.update(current)
    return Project(**current)
