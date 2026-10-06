import uuid
import re
from typing import List
from datetime import datetime
from fastapi import APIRouter, HTTPException
from apps.api.src.schemas.project import Project, ProjectCreate, ProjectUpdate, TeamMember, JiraSettings
from apps.api.src.schemas.common import ProjectMode
from apps.api.src.core.firestore_client import db
from apps.api.src.core.config import settings
from scripts.seed_project_data import seed

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.get("", response_model=List[Project])
def list_projects():
    """List all configured projects. Preloads default projects if store is empty."""
    docs = list(db.collection("projects").stream())
    if not docs:
        try:
            seed()
            docs = list(db.collection("projects").stream())
        except Exception:
            pass
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
    """
    Create a new project.
    Automatically parses Jira project links, registers developer names,
    and persists the project into GCP Firestore.
    """
    project_id = f"proj-{uuid.uuid4().hex[:8]}"
    project_key = data.key.strip().upper() if data.key else "SCRUM"
    jira_settings = data.jira_settings or JiraSettings()
    mode = data.mode

    # 1. Parse Jira project link if provided (e.g. https://the-ai-scrum-master.atlassian.net/jira/software/projects/SCRUM/summary)
    if data.jira_project_link:
        link = data.jira_project_link.strip()
        m_domain = re.search(r'(https?://[^/]+)', link)
        if m_domain:
            jira_settings.instance_url = m_domain.group(1)

        m_key = re.search(r'/(?:projects|browse)/([A-Za-z0-9_]+)', link)
        if m_key:
            extracted_key = m_key.group(1).upper()
            project_key = extracted_key
            jira_settings.project_key = extracted_key

        jira_settings.enabled = True
        jira_settings.user_email = jira_settings.user_email or settings.JIRA_USER_EMAIL
        jira_settings.api_token = jira_settings.api_token or settings.JIRA_API_TOKEN
        mode = ProjectMode.ENTERPRISE_SYNC

    # 2. Parse developer profiles and technical skills
    team_members = list(data.team_members or [])
    raw_inputs = []
    if data.developer_skills_input:
        raw_inputs.extend(data.developer_skills_input.replace(";", "\n").split("\n"))
    if data.developer_names:
        for dn in data.developer_names:
            raw_inputs.extend(dn.replace(";", "\n").split("\n"))

    for raw_line in raw_inputs:
        line = raw_line.strip()
        if not line:
            continue
        if ":" in line:
            parts = line.split(":", 1)
            name = parts[0].strip()
            skills = [s.strip() for s in parts[1].split(",") if s.strip()]
        else:
            name = line.strip()
            skills = ["Fullstack", "Agile", "Cloud Run"]

        if not name:
            continue

        skills_lower = " ".join(skills).lower()
        if any(w in skills_lower for w in ["qa", "test", "automation", "cypress", "pytest", "selenium"]):
            role = "QA Engineer"
        elif any(w in skills_lower for w in ["react", "next", "ui", "frontend", "css", "vue", "tailwind"]):
            role = "Frontend Engineer"
        elif any(w in skills_lower for w in ["python", "backend", "fastapi", "cloud", "api", "go", "java", "sql"]):
            role = "Backend Engineer"
        else:
            role = "Fullstack Developer"

        clean_email = re.sub(r"[^a-zA-Z0-9]", ".", name.lower())
        team_members.append(TeamMember(
            id=f"dev-{uuid.uuid4().hex[:6]}",
            name=name,
            role=role,
            email=f"{clean_email}@company.com",
            skills=skills,
            available_hours_per_week=40.0,
            current_workload_hours=0.0
        ))

    project = Project(
        id=project_id,
        name=data.name,
        key=project_key,
        description=data.description or f"{data.name} workspace",
        business_objective=data.business_objective,
        mode=mode,
        sprint_duration_days=data.sprint_duration_days,
        target_velocity_points=data.target_velocity_points,
        team_members=team_members,
        git_settings=data.git_settings,
        jira_settings=jira_settings,
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

@router.delete("/{project_id}")
def delete_project(project_id: str):
    """Delete a project and its configuration from GCP Firestore."""
    doc_ref = db.collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")

    project_data = doc.to_dict()
    p_name = project_data.get("name", project_id)
    p_key = project_data.get("key", "")

    # Delete project document
    doc_ref.delete()

    # Clean up project requirement caches if present
    try:
        db.collection("requirements").document(f"req-{project_id}").delete()
    except Exception:
        pass

    return {
        "status": "SUCCESS",
        "deleted_project_id": project_id,
        "message": f"Project '{p_name}' [{p_key}] was deleted from database."
    }
