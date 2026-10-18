import uuid
import re
import logging
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException
from apps.api.src.schemas.project import Project, ProjectCreate, ProjectUpdate, TeamMember, JiraSettings, GitRepoLink, ConfluencePageLink, SyncJiraUsersRequest
from apps.api.src.schemas.common import ProjectMode
from apps.api.src.core.firestore_client import db
from apps.api.src.core.config import settings

logger = logging.getLogger("projects_api")
router = APIRouter(prefix="/projects", tags=["Projects"])

@router.get("", response_model=List[Project])
def list_projects():
    """List all configured projects deduplicated by project key and ID, excluding native standalone projects."""
    docs = list(db.collection("projects").stream())
    projects = []
    for d in docs:
        try:
            p = Project(**d.to_dict())
            # Exclude Native Storage / Standalone non-Jira projects
            if p.mode == ProjectMode.STANDALONE:
                continue
            projects.append(p)
        except Exception:
            pass

    # Deduplicate by key (and id), keeping the most recently updated/created
    unique_map = {}
    for p in sorted(projects, key=lambda x: str(x.updated_at or x.created_at or ""), reverse=True):
        lookup_key = (p.key or p.id).upper()
        if lookup_key not in unique_map:
            unique_map[lookup_key] = p

    return list(unique_map.values())

@router.post("/clear-all")
def clear_all_data():
    """Clear all projects and associated entities from the database."""
    if hasattr(db, "clear_all"):
        db.clear_all()
    else:
        for col in ["projects", "requirements", "epics", "stories", "tasks", "open_questions", "sprints", "governance_approvals", "activity_logs", "knowledge_items", "users"]:
            for doc in list(db.collection(col).stream()):
                db.collection(col).document(doc.id).delete()
    return {"status": "SUCCESS", "message": "All database entries have been cleared."}

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
    Prevents creating duplicate projects with the same key.
    """
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

        m_board = re.search(r'/boards/(\d+)', link)
        if m_board:
            jira_settings.board_id = m_board.group(1)

        jira_settings.enabled = True
        jira_settings.user_email = jira_settings.user_email or settings.JIRA_USER_EMAIL
        jira_settings.api_token = jira_settings.api_token or settings.JIRA_API_TOKEN
        mode = ProjectMode.ENTERPRISE_SYNC

    if jira_settings and jira_settings.instance_url:
        from apps.api.src.core.providers.backlog.jira_provider import clean_jira_instance_url
        jira_settings.instance_url = clean_jira_instance_url(jira_settings.instance_url)

    # Check if a project with the same key already exists in Firestore
    for d in list(db.collection("projects").stream()):
        p_dict = d.to_dict()
        if p_dict.get("key", "").upper() == project_key:
            logger.info(f"Project with key {project_key} already exists ({d.id}). Returning existing project.")
            return Project(**p_dict)

    project_id = f"proj-{uuid.uuid4().hex[:8]}"

    # 2. Parse developer profiles and technical skills
    team_members = list(data.team_members or [])
    developers = list(data.developers or [])
    qa_engineers = list(data.qa_engineers or [])
    product_owner = data.product_owner
    scrum_master = data.scrum_master

    # Synthesize all assigned roles into team_members roster without duplicates
    if product_owner and not any(t.id == product_owner.id for t in team_members):
        team_members.append(product_owner)
    if scrum_master and not any(t.id == scrum_master.id for t in team_members):
        team_members.append(scrum_master)
    for dev in developers:
        if not any(t.id == dev.id for t in team_members):
            team_members.append(dev)
    for qa in qa_engineers:
        if not any(t.id == qa.id for t in team_members):
            team_members.append(qa)

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
            is_qa = True
        elif any(w in skills_lower for w in ["react", "next", "ui", "frontend", "css", "vue", "tailwind"]):
            role = "Frontend Engineer"
            is_qa = False
        elif any(w in skills_lower for w in ["python", "backend", "fastapi", "cloud", "api", "go", "java", "sql"]):
            role = "Backend Engineer"
            is_qa = False
        else:
            role = "Fullstack Developer"
            is_qa = False

        clean_email = re.sub(r"[^a-zA-Z0-9]", ".", name.lower())
        new_member = TeamMember(
            id=f"dev-{uuid.uuid4().hex[:6]}",
            name=name,
            role=role,
            email=f"{clean_email}@company.com",
            skills=skills,
            available_hours_per_week=40.0,
            current_workload_hours=0.0
        )
        team_members.append(new_member)
        if is_qa:
            qa_engineers.append(new_member)
        else:
            developers.append(new_member)

    project = Project(
        id=project_id,
        name=data.name,
        key=project_key,
        description=data.description or f"{data.name} workspace",
        business_objective=data.business_objective,
        mode=mode,
        sprint_duration_days=data.sprint_duration_days,
        target_velocity_points=data.target_velocity_points,
        product_owner=product_owner,
        scrum_master=scrum_master,
        developers=developers,
        qa_engineers=qa_engineers,
        team_members=team_members,
        git_settings=data.git_settings or GitSettings(),
        jira_settings=jira_settings,
        jira_project_link=data.jira_project_link.strip() if data.jira_project_link else None,
        confluence_settings=data.confluence_settings,
        notebooklm_settings=data.notebooklm_settings,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.collection("projects").document(project_id).set(project.dict())

    # Update assigned users' project_ids in Firestore 'users' collection
    assigned_user_ids = set()
    if product_owner and product_owner.id:
        assigned_user_ids.add(product_owner.id)
    if scrum_master and scrum_master.id:
        assigned_user_ids.add(scrum_master.id)
    for dev in developers:
        if dev.id:
            assigned_user_ids.add(dev.id)
    for qa in qa_engineers:
        if qa.id:
            assigned_user_ids.add(qa.id)

    for uid in assigned_user_ids:
        try:
            u_doc_ref = db.collection("users").document(uid)
            u_doc = u_doc_ref.get()
            if u_doc.exists:
                u_data = u_doc.to_dict()
                p_ids = u_data.get("project_ids", [])
                if project_id not in p_ids:
                    p_ids.append(project_id)
                    u_doc_ref.update({
                        "project_ids": p_ids,
                        "updated_at": datetime.utcnow().isoformat()
                    })
        except Exception as e:
            print(f"Warning: could not update user {uid} project_ids: {e}")

    # Also link any users who were tagged with the project_key during pre-creation Jira sync
    try:
        proj_key = (data.key or "").strip().upper()
        if proj_key:
            users_with_key = db.collection("users").where("project_ids", "array_contains", proj_key).stream()
            for u_snap in users_with_key:
                u_data = u_snap.to_dict()
                p_ids = u_data.get("project_ids", [])
                if project_id not in p_ids:
                    p_ids.append(project_id)
                    u_snap.reference.update({
                        "project_ids": p_ids,
                        "updated_at": datetime.utcnow().isoformat()
                    })
    except Exception as e:
        print(f"Warning: could not link project_key users to project_id: {e}")

    return project

@router.put("/{project_id}", response_model=Project)
def update_project(project_id: str, data: ProjectUpdate):
    """
    Update project configuration, Jira integration link, team members, or sprint cadence.
    Persists all edited project information reliably into GCP Firestore DB.
    """
    doc_ref = db.collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")

    current = doc.to_dict()
    update_data = {k: v for k, v in data.dict().items() if v is not None}

    # Normalize key if provided
    if data.key:
        update_data["key"] = data.key.strip().upper()

    # Parse and update Jira link if edited
    if data.jira_project_link is not None:
        link = data.jira_project_link.strip()
        if link:
            current_js = current.get("jira_settings") or {}
            m_domain = re.search(r'(https?://[^/]+)', link)
            if m_domain:
                current_js["instance_url"] = m_domain.group(1)
            m_key = re.search(r'/(?:projects|browse)/([A-Za-z0-9_]+)', link)
            if m_key:
                current_js["project_key"] = m_key.group(1).upper()
            m_board = re.search(r'/boards/(\d+)', link)
            if m_board:
                current_js["board_id"] = m_board.group(1)
            current_js["enabled"] = True
            current_js["user_email"] = current_js.get("user_email") or settings.JIRA_USER_EMAIL
            current_js["api_token"] = current_js.get("api_token") or settings.JIRA_API_TOKEN
            update_data["jira_settings"] = current_js
            update_data["jira_project_link"] = link
        else:
            update_data["jira_project_link"] = None

    # Sync and assemble team_members if roles were updated
    if data.developers is not None or data.qa_engineers is not None or data.scrum_master is not None or data.product_owner is not None:
        merged_team = []
        seen_ids = set()

        po = data.product_owner.dict() if data.product_owner else current.get("product_owner")
        if po and po.get("id"):
            merged_team.append(po)
            seen_ids.add(po["id"])

        sm = data.scrum_master.dict() if data.scrum_master else current.get("scrum_master")
        if sm and sm.get("id") and sm["id"] not in seen_ids:
            merged_team.append(sm)
            seen_ids.add(sm["id"])

        devs = [d.dict() if hasattr(d, "dict") else d for d in (data.developers if data.developers is not None else current.get("developers", []))]
        for d in devs:
            if d.get("id") and d["id"] not in seen_ids:
                merged_team.append(d)
                seen_ids.add(d["id"])

        qas = [q.dict() if hasattr(q, "dict") else q for q in (data.qa_engineers if data.qa_engineers is not None else current.get("qa_engineers", []))]
        for q in qas:
            if q.get("id") and q["id"] not in seen_ids:
                merged_team.append(q)
                seen_ids.add(q["id"])

        update_data["team_members"] = merged_team

        # Update users collection with project_id
        for uid in seen_ids:
            try:
                u_doc_ref = db.collection("users").document(uid)
                u_doc = u_doc_ref.get()
                if u_doc.exists:
                    u_data = u_doc.to_dict()
                    p_ids = u_data.get("project_ids", [])
                    if project_id not in p_ids:
                        p_ids.append(project_id)
                        u_doc_ref.update({
                            "project_ids": p_ids,
                            "updated_at": datetime.utcnow().isoformat()
                        })
            except Exception as e:
                logger.debug(f"Could not update user {uid} project_ids: {e}")

    update_data["updated_at"] = datetime.utcnow()
    current.update(update_data)
    doc_ref.set(current)
    return Project(**current)

@router.post("/{project_id}/git-repos", response_model=Project)
def add_git_repo(project_id: str, repo: GitRepoLink):
    """Add a Git repository link to the project, auto-fetch full README/tree/commits, and enable Git integration."""
    doc_ref = db.collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")

    current = doc.to_dict()
    git_settings = current.get("git_settings") or {}
    repositories = list(git_settings.get("repositories") or [])

    repo_dict = repo.dict()
    if not repo_dict.get("id"):
        repo_dict["id"] = f"repo-{uuid.uuid4().hex[:6]}"
    if not repo_dict.get("created_at"):
        repo_dict["created_at"] = datetime.utcnow().isoformat()

    # Automatically fetch full README, file tree, key manifests, and recent commits
    try:
        from apps.api.src.core.providers.git.github_provider import GitHubTrackerProvider
        git_prov = GitHubTrackerProvider(repo_url=repo_dict.get("repo_url"), access_token=git_settings.get("access_token"))
        repo_data = git_prov.fetch_repository_full_context(repo_dict.get("repo_url"), repo_dict.get("default_branch", "main"))
        if repo_data:
            repo_dict["readme_content"] = repo_data.get("readme_content")
            repo_dict["content_length"] = repo_data.get("content_length", 0)
            repo_dict["file_tree"] = repo_data.get("file_tree", [])
            repo_dict["key_files"] = repo_data.get("key_files", {})
            repo_dict["recent_commits"] = repo_data.get("recent_commits", [])
            repo_dict["pull_requests"] = repo_data.get("pull_requests", [])
            if repo_data.get("description") and not repo_dict.get("description"):
                repo_dict["description"] = repo_data.get("description")
            repo_dict["fetched_at"] = datetime.utcnow().isoformat()
            repo_dict["fetch_status"] = "SYNCED"

            # Mirror to knowledge_items for search
            k_id = f"know-git-{repo_dict['id']}"
            db.collection("knowledge_items").document(k_id).set({
                "id": k_id,
                "project_id": project_id,
                "title": f"Git Repository: {repo_dict['name']}",
                "content": f"# Repository: {repo_dict['name']}\nURL: {repo_dict['repo_url']}\nDefault Branch: {repo_dict['default_branch']}\n\n{repo_dict.get('readme_content', '')}",
                "source_type": "GIT_REPOSITORY",
                "source_uri": repo_dict["repo_url"],
                "tags": ["git", repo_dict.get("provider", "GitHub"), repo_dict["name"]],
                "created_at": datetime.utcnow()
            })
    except Exception as e:
        logger.warning(f"Failed to auto-fetch Git repository details: {e}")
        repo_dict["fetch_status"] = "PENDING"

    # If is_primary, unset any previous primary
    if repo_dict.get("is_primary"):
        for r in repositories:
            r["is_primary"] = False

    # Check if duplicate id or url
    existing_idx = next((i for i, r in enumerate(repositories) if r.get("id") == repo_dict["id"] or r.get("repo_url") == repo_dict["repo_url"]), None)
    if existing_idx is not None:
        repositories[existing_idx] = repo_dict
    else:
        repositories.append(repo_dict)

    git_settings["repositories"] = repositories
    git_settings["enabled"] = True
    if not git_settings.get("repo_url") or repo_dict.get("is_primary"):
        git_settings["repo_url"] = repo_dict["repo_url"]
        git_settings["default_branch"] = repo_dict.get("default_branch", "main")

    current["git_settings"] = git_settings
    current["updated_at"] = datetime.utcnow()
    doc_ref.set(current)
    return Project(**current)

@router.post("/{project_id}/git-sync", response_model=Project)
def sync_all_git_repos(project_id: str):
    """Fetches and synchronizes complete README, file tree, configs, and commits for all connected Git repositories."""
    doc_ref = db.collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")

    current = doc.to_dict()
    git_settings = current.get("git_settings") or {}
    repositories = list(git_settings.get("repositories") or [])

    from apps.api.src.core.providers.git.github_provider import GitHubTrackerProvider

    for repo in repositories:
        try:
            git_prov = GitHubTrackerProvider(repo_url=repo.get("repo_url"), access_token=git_settings.get("access_token"))
            repo_data = git_prov.fetch_repository_full_context(repo.get("repo_url"), repo.get("default_branch", "main"))
            if repo_data:
                repo["readme_content"] = repo_data.get("readme_content")
                repo["content_length"] = repo_data.get("content_length", 0)
                repo["file_tree"] = repo_data.get("file_tree", [])
                repo["key_files"] = repo_data.get("key_files", {})
                repo["recent_commits"] = repo_data.get("recent_commits", [])
                repo["pull_requests"] = repo_data.get("pull_requests", [])
                if repo_data.get("description") and not repo.get("description"):
                    repo["description"] = repo_data.get("description")
                repo["fetched_at"] = datetime.utcnow().isoformat()
                repo["fetch_status"] = "SYNCED"

                k_id = f"know-git-{repo['id']}"
                db.collection("knowledge_items").document(k_id).set({
                    "id": k_id,
                    "project_id": project_id,
                    "title": f"Git Repository: {repo['name']}",
                    "content": f"# Repository: {repo['name']}\nURL: {repo['repo_url']}\nDefault Branch: {repo['default_branch']}\n\n{repo.get('readme_content', '')}",
                    "source_type": "GIT_REPOSITORY",
                    "source_uri": repo["repo_url"],
                    "tags": ["git", repo.get("provider", "GitHub"), repo["name"]],
                    "created_at": datetime.utcnow()
                })
        except Exception as e:
            logger.warning(f"Failed to sync Git repo {repo.get('name')}: {e}")

    git_settings["repositories"] = repositories
    current["git_settings"] = git_settings
    current["updated_at"] = datetime.utcnow()
    doc_ref.set(current)
    return Project(**current)

@router.post("/{project_id}/git-repos/{repo_id}/sync", response_model=Project)
def sync_single_git_repo(project_id: str, repo_id: str):
    """Re-fetches and updates complete README, file tree, and commit logs for a specific Git repository."""
    doc_ref = db.collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")

    current = doc.to_dict()
    git_settings = current.get("git_settings") or {}
    repositories = list(git_settings.get("repositories") or [])

    target = next((r for r in repositories if r.get("id") == repo_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Git repository not found")

    from apps.api.src.core.providers.git.github_provider import GitHubTrackerProvider

    try:
        git_prov = GitHubTrackerProvider(repo_url=target.get("repo_url"), access_token=git_settings.get("access_token"))
        repo_data = git_prov.fetch_repository_full_context(target.get("repo_url"), target.get("default_branch", "main"))
        if repo_data:
            target["readme_content"] = repo_data.get("readme_content")
            target["content_length"] = repo_data.get("content_length", 0)
            target["file_tree"] = repo_data.get("file_tree", [])
            target["key_files"] = repo_data.get("key_files", {})
            target["recent_commits"] = repo_data.get("recent_commits", [])
            target["pull_requests"] = repo_data.get("pull_requests", [])
            if repo_data.get("description") and not target.get("description"):
                target["description"] = repo_data.get("description")
            target["fetched_at"] = datetime.utcnow().isoformat()
            target["fetch_status"] = "SYNCED"

            k_id = f"know-git-{target['id']}"
            db.collection("knowledge_items").document(k_id).set({
                "id": k_id,
                "project_id": project_id,
                "title": f"Git Repository: {target['name']}",
                "content": f"# Repository: {target['name']}\nURL: {target['repo_url']}\nDefault Branch: {target['default_branch']}\n\n{target.get('readme_content', '')}",
                "source_type": "GIT_REPOSITORY",
                "source_uri": target["repo_url"],
                "tags": ["git", target.get("provider", "GitHub"), target["name"]],
                "created_at": datetime.utcnow()
            })
    except Exception as e:
        logger.warning(f"Failed to sync Git repo {target.get('name')}: {e}")

    git_settings["repositories"] = repositories
    current["git_settings"] = git_settings
    current["updated_at"] = datetime.utcnow()
    doc_ref.set(current)
    return Project(**current)

@router.post("/{project_id}/jira-sync", response_model=Project)
def sync_jira_issues(project_id: str):
    """Fetches all live Jira issues directly from Atlassian Cloud, stores them, and indexes them in Knowledge Center."""
    doc_ref = db.collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")

    current = doc.to_dict()
    from apps.api.src.core.provider_factory import provider_factory
    from apps.api.src.core.providers.backlog.jira_provider import JiraBacklogProvider

    jira_prov = provider_factory.get_backlog_provider(project_id)
    if isinstance(jira_prov, JiraBacklogProvider) and jira_prov._is_configured():
        issues = jira_prov.fetch_all_issues_detailed()
        for iss in issues:
            k_id = f"know-jira-{iss['key']}"
            comments_text = "\n".join([f"- [{c.get('author')}] {c.get('text')}" for c in iss.get("comments", [])])
            desc_content = f"# Jira [{iss['type']}] {iss['key']}: {iss['title']}\n"
            desc_content += f"Status: {iss['status']} | Priority: {iss['priority']} | Assignee: {iss['assignee']}\n"
            if iss.get("description"):
                desc_content += f"\n## Description:\n{iss['description']}\n"
            if comments_text:
                desc_content += f"\n## Discussion & Comments:\n{comments_text}\n"

            db.collection("knowledge_items").document(k_id).set({
                "id": k_id,
                "project_id": project_id,
                "title": f"Jira [{iss['type']}] {iss['key']}: {iss['title']}",
                "content": desc_content,
                "source_type": f"JIRA_{iss['type']}",
                "source_uri": iss.get("url"),
                "tags": ["jira", iss['key'], iss['status']],
                "created_at": datetime.utcnow()
            })

    current["updated_at"] = datetime.utcnow()
    doc_ref.set(current)
    return Project(**current)

@router.delete("/{project_id}/git-repos/{repo_id}", response_model=Project)
def delete_git_repo(project_id: str, repo_id: str):
    """Remove a Git repository link from the project."""
    doc_ref = db.collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")

    current = doc.to_dict()
    git_settings = current.get("git_settings") or {}
    repositories = list(git_settings.get("repositories") or [])

    repositories = [r for r in repositories if r.get("id") != repo_id]
    git_settings["repositories"] = repositories
    if not repositories:
        git_settings["repo_url"] = None
        git_settings["enabled"] = False

    current["git_settings"] = git_settings
    current["updated_at"] = datetime.utcnow()
    doc_ref.set(current)
    return Project(**current)

@router.post("/{project_id}/confluence-links", response_model=Project)
def add_confluence_link(project_id: str, page: ConfluencePageLink):
    """Add a Confluence page link to the project, automatically fetch complete content, and enable Confluence integration."""
    doc_ref = db.collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")

    current = doc.to_dict()
    conf_settings = current.get("confluence_settings") or {}
    pages = list(conf_settings.get("pages") or [])

    page_dict = page.dict()
    if not page_dict.get("id"):
        page_dict["id"] = f"conf-{uuid.uuid4().hex[:6]}"
    if not page_dict.get("created_at"):
        page_dict["created_at"] = datetime.utcnow().isoformat()

    # Extract numeric page ID from URL
    from apps.api.src.core.providers.doc.confluence_provider import extract_page_id_from_url, ConfluenceDocProvider
    from apps.api.src.core.provider_factory import provider_factory

    pid = extract_page_id_from_url(page_dict.get("url", ""))
    if pid:
        page_dict["page_id"] = pid

    # Automatically fetch complete page content from Confluence Cloud REST API
    try:
        doc_provider = provider_factory.get_doc_provider(project_id)
        if isinstance(doc_provider, ConfluenceDocProvider) and doc_provider._is_configured():
            fetched = doc_provider.fetch_page_content(page_dict["url"])
            if fetched:
                page_dict["title"] = fetched.get("title") or page_dict.get("title")
                page_dict["content"] = fetched.get("content")
                page_dict["content_length"] = fetched.get("content_length", 0)
                if fetched.get("space_key"):
                    page_dict["space_key"] = fetched["space_key"]
                page_dict["fetched_at"] = datetime.utcnow().isoformat()
                page_dict["fetch_status"] = "SYNCED"

                # Save mirror into knowledge_items collection for permanent search indexing
                k_id = f"know-conf-{page_dict.get('page_id') or page_dict['id']}"
                db.collection("knowledge_items").document(k_id).set({
                    "id": k_id,
                    "project_id": project_id,
                    "title": page_dict["title"],
                    "content": page_dict["content"],
                    "source_type": "CONFLUENCE",
                    "source_uri": page_dict["url"],
                    "tags": ["confluence", page_dict.get("space_key", "GENERAL")],
                    "created_at": datetime.utcnow()
                })
    except Exception as e:
        page_dict["fetch_status"] = "ERROR"

    existing_idx = next((i for i, p in enumerate(pages) if p.get("id") == page_dict["id"] or p.get("url") == page_dict["url"]), None)
    if existing_idx is not None:
        pages[existing_idx] = page_dict
    else:
        pages.append(page_dict)

    conf_settings["pages"] = pages
    conf_settings["enabled"] = True
    if not conf_settings.get("instance_url"):
        m = re.search(r'(https?://[^/]+)', page_dict.get("url", ""))
        if m:
            conf_settings["instance_url"] = m.group(1)
    if page_dict.get("space_key") and not conf_settings.get("space_key"):
        conf_settings["space_key"] = page_dict["space_key"]

    current["confluence_settings"] = conf_settings
    current["updated_at"] = datetime.utcnow()
    doc_ref.set(current)
    return Project(**current)

@router.post("/{project_id}/confluence-sync", response_model=Project)
def sync_all_confluence_pages(project_id: str):
    """Fetches and synchronizes complete page content for all linked Confluence pages and auto-discovers space pages."""
    doc_ref = db.collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")

    current = doc.to_dict()
    conf_settings = current.get("confluence_settings") or {}
    pages = list(conf_settings.get("pages") or [])

    from apps.api.src.core.provider_factory import provider_factory
    from apps.api.src.core.providers.doc.confluence_provider import ConfluenceDocProvider

    doc_provider = provider_factory.get_doc_provider(project_id)
    if isinstance(doc_provider, ConfluenceDocProvider) and doc_provider._is_configured():
        # 1. Update existing pages
        for p in pages:
            try:
                fetched = doc_provider.fetch_page_content(p.get("url", ""))
                if fetched:
                    p["title"] = fetched.get("title") or p.get("title")
                    p["content"] = fetched.get("content")
                    p["content_length"] = fetched.get("content_length", 0)
                    p["fetched_at"] = datetime.utcnow().isoformat()
                    p["fetch_status"] = "SYNCED"

                    k_id = f"know-conf-{p.get('page_id') or p.get('id')}"
                    db.collection("knowledge_items").document(k_id).set({
                        "id": k_id,
                        "project_id": project_id,
                        "title": p["title"],
                        "content": p["content"],
                        "source_type": "CONFLUENCE",
                        "source_uri": p["url"],
                        "tags": ["confluence", p.get("space_key", "GENERAL")],
                        "created_at": datetime.utcnow()
                    })
            except Exception:
                pass

        # 2. If space key exists and no pages linked, auto-import space pages!
        space_key = conf_settings.get("space_key") or current.get("key")
        if space_key and len(pages) == 0:
            space_pages = doc_provider.fetch_space_pages(space_key)
            for sp in space_pages:
                new_page = {
                    "id": f"conf-{uuid.uuid4().hex[:6]}",
                    "page_id": sp["page_id"],
                    "title": sp["title"],
                    "url": sp["url"],
                    "space_key": sp["space_key"],
                    "content": sp["content"],
                    "content_length": sp["content_length"],
                    "fetched_at": datetime.utcnow().isoformat(),
                    "fetch_status": "SYNCED",
                    "created_at": datetime.utcnow().isoformat()
                }
                pages.append(new_page)

                k_id = f"know-conf-{sp['page_id']}"
                db.collection("knowledge_items").document(k_id).set({
                    "id": k_id,
                    "project_id": project_id,
                    "title": sp["title"],
                    "content": sp["content"],
                    "source_type": "CONFLUENCE",
                    "source_uri": sp["url"],
                    "tags": ["confluence", sp["space_key"]],
                    "created_at": datetime.utcnow()
                })

    conf_settings["pages"] = pages
    if pages:
        conf_settings["enabled"] = True
    current["confluence_settings"] = conf_settings
    current["updated_at"] = datetime.utcnow()
    doc_ref.set(current)
    return Project(**current)

@router.post("/{project_id}/confluence-links/{link_id}/sync", response_model=Project)
def sync_single_confluence_link(project_id: str, link_id: str):
    """Re-fetches and updates complete page text for a specific Confluence page link."""
    doc_ref = db.collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")

    current = doc.to_dict()
    conf_settings = current.get("confluence_settings") or {}
    pages = list(conf_settings.get("pages") or [])

    target = next((p for p in pages if p.get("id") == link_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Confluence link not found")

    from apps.api.src.core.provider_factory import provider_factory
    from apps.api.src.core.providers.doc.confluence_provider import ConfluenceDocProvider

    doc_provider = provider_factory.get_doc_provider(project_id)
    if isinstance(doc_provider, ConfluenceDocProvider) and doc_provider._is_configured():
        fetched = doc_provider.fetch_page_content(target.get("url", ""))
        if fetched:
            target["title"] = fetched.get("title") or target.get("title")
            target["content"] = fetched.get("content")
            target["content_length"] = fetched.get("content_length", 0)
            target["fetched_at"] = datetime.utcnow().isoformat()
            target["fetch_status"] = "SYNCED"

            k_id = f"know-conf-{target.get('page_id') or target.get('id')}"
            db.collection("knowledge_items").document(k_id).set({
                "id": k_id,
                "project_id": project_id,
                "title": target["title"],
                "content": target["content"],
                "source_type": "CONFLUENCE",
                "source_uri": target["url"],
                "tags": ["confluence", target.get("space_key", "GENERAL")],
                "created_at": datetime.utcnow()
            })

    conf_settings["pages"] = pages
    current["confluence_settings"] = conf_settings
    current["updated_at"] = datetime.utcnow()
    doc_ref.set(current)
    return Project(**current)

@router.delete("/{project_id}/confluence-links/{link_id}", response_model=Project)
def delete_confluence_link(project_id: str, link_id: str):
    """Remove a Confluence page link from the project."""
    doc_ref = db.collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")

    current = doc.to_dict()
    conf_settings = current.get("confluence_settings") or {}
    pages = list(conf_settings.get("pages") or [])

    pages = [p for p in pages if p.get("id") != link_id]
    conf_settings["pages"] = pages
    if not pages and not conf_settings.get("instance_url"):
        conf_settings["enabled"] = False

    current["confluence_settings"] = conf_settings
    current["updated_at"] = datetime.utcnow()
    doc_ref.set(current)
    return Project(**current)

@router.patch("/{project_id}/integrations", response_model=Project)
def update_integrations(project_id: str, payload: dict):
    """Update Jira, Confluence, or Git integration settings directly."""
    doc_ref = db.collection("projects").document(project_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")

    current = doc.to_dict()
    if "jira_settings" in payload and payload["jira_settings"] is not None:
        jira = current.get("jira_settings") or {}
        jira.update(payload["jira_settings"])
        if jira.get("instance_url"):
            from apps.api.src.core.providers.backlog.jira_provider import clean_jira_instance_url
            jira["instance_url"] = clean_jira_instance_url(jira["instance_url"])
        current["jira_settings"] = jira
    if "confluence_settings" in payload and payload["confluence_settings"] is not None:
        conf = current.get("confluence_settings") or {}
        conf.update(payload["confluence_settings"])
        if conf.get("instance_url"):
            from apps.api.src.core.providers.doc.confluence_provider import clean_confluence_instance_url
            conf["instance_url"] = clean_confluence_instance_url(conf["instance_url"])
        current["confluence_settings"] = conf
    if "git_settings" in payload and payload["git_settings"] is not None:
        git = current.get("git_settings") or {}
        git.update(payload["git_settings"])
        current["git_settings"] = git
    if "jira_project_link" in payload and payload["jira_project_link"] is not None:
        current["jira_project_link"] = payload["jira_project_link"]

    current["updated_at"] = datetime.utcnow()
    doc_ref.set(current)
    return Project(**current)

@router.post("/sync-jira-users")
def sync_project_jira_users(req: SyncJiraUsersRequest):
    """
    Fetch all assignable users from Jira for the specified project,
    push them into Firestore DB 'users' collection associated with this project,
    and return the updated list of users for team selection.
    """
    from apps.api.src.core.provider_factory import provider_factory

    project_key = (req.project_key or "").strip().upper()
    jira_link = (req.jira_link or "").strip()
    project_id = (req.project_id or "").strip()

    # If project_id provided, look up existing project metadata
    if project_id:
        p_snap = db.collection("projects").document(project_id).get()
        if p_snap.exists:
            p_data = p_snap.to_dict()
            if not project_key:
                project_key = (p_data.get("key") or "").strip().upper()
            if not jira_link:
                project_link = p_data.get("jira_project_link")
                inst = p_data.get("jira_settings", {}).get("instance_url")
                jira_link = project_link or inst or ""

    # Parse key from Jira link if not explicitly given
    if not project_key and jira_link:
        m_key = re.search(r'/(?:projects|browse)/([A-Za-z0-9_]+)', jira_link)
        if m_key:
            project_key = m_key.group(1).upper()

    if not project_key:
        project_key = "SCRUM"

    instance_url = None
    if jira_link:
        m_domain = re.search(r'(https?://[^/]+)', jira_link)
        if m_domain:
            instance_url = m_domain.group(1)

    # 1. Fetch assignable users from Jira Cloud
    jira_users = []
    try:
        jira_provider = provider_factory.get_jira_provider(
            project_id=project_id or "default",
            target_project_key=project_key,
            target_instance_url=instance_url
        )
        if jira_provider._is_configured():
            jira_users = jira_provider.fetch_jira_users()
            logger.info(f"Retrieved {len(jira_users)} Jira users for project key {project_key}")
    except Exception as e:
        logger.warning(f"Could not fetch Jira users for {project_key}: {e}")

    # 2. Match and push to Firestore DB users collection
    project_tags = [t for t in [project_id, project_key] if t]

    existing_docs = list(db.collection("users").stream())
    existing_users = {d.id: d.to_dict() for d in existing_docs}

    def match_user(ju):
        j_email = (ju.get("emailAddress") or "").strip().lower()
        j_name = (ju.get("displayName") or "").strip().lower()
        j_name_parts = set(j_name.replace(".", " ").split())

        # Email match
        if j_email:
            for uid, u in existing_users.items():
                if (u.get("email") or "").strip().lower() == j_email:
                    return uid

        # Exact name match
        for uid, u in existing_users.items():
            if (u.get("name") or "").strip().lower() == j_name:
                return uid

        # Email username match
        for uid, u in existing_users.items():
            u_email = (u.get("email") or "").strip().lower()
            u_user = u_email.split("@")[0] if "@" in u_email else ""
            if u_user and (u_user == j_name or j_name in u_user or u_user in j_name):
                return uid

        # Partial name match
        for uid, u in existing_users.items():
            u_name = (u.get("name") or "").strip().lower()
            u_parts = set(u_name.replace(".", " ").split())
            common = j_name_parts.intersection(u_parts)
            if len(common) >= 2 or (len(common) == 1 and len(u_parts) == 1):
                return uid

        return None

    for ju in jira_users:
        disp_name = (ju.get("displayName") or "").strip()
        if not disp_name:
            continue

        matched_uid = match_user(ju)
        if matched_uid:
            u_data = existing_users[matched_uid]
            p_ids = list(u_data.get("project_ids") or [])
            changed = False
            for tag in project_tags:
                if tag not in p_ids:
                    p_ids.append(tag)
                    changed = True
            if changed:
                u_data["project_ids"] = p_ids
                u_data["updated_at"] = datetime.utcnow().isoformat()
                try:
                    db.collection("users").document(matched_uid).update({
                        "project_ids": p_ids,
                        "updated_at": u_data["updated_at"]
                    })
                except Exception as e:
                    logger.warning(f"Failed to update user {matched_uid} in Firestore: {e}")
        else:
            # Create new Firestore user
            j_email = (ju.get("emailAddress") or "").strip()
            if not j_email:
                slug = re.sub(r'[^a-zA-Z0-9]', '', disp_name.lower())
                j_email = f"{slug}@atlassian.net"

            d_lower = disp_name.lower()
            if "scrum" in d_lower or "lead" in d_lower:
                role = "SCRUM_MASTER"
            elif "qa" in d_lower or "test" in d_lower:
                role = "QA_ENGINEER"
            elif "admin" in d_lower:
                role = "ADMIN"
            else:
                role = "DEVELOPER"

            new_id = f"usr-jira-{uuid.uuid4().hex[:8]}"
            now_iso = datetime.utcnow().isoformat()
            new_u = {
                "id": new_id,
                "name": disp_name,
                "email": j_email,
                "role": role,
                "title": "Software Developer" if role == "DEVELOPER" else role.replace("_", " ").title(),
                "avatar_url": "",
                "project_ids": project_tags,
                "status": "ACTIVE",
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            try:
                db.collection("users").document(new_id).set(new_u)
                existing_users[new_id] = new_u
            except Exception as e:
                logger.warning(f"Failed to persist new Jira user {new_id} to Firestore: {e}")

    # Return refreshed users from Firestore
    all_users = []
    for uid, u in existing_users.items():
        user_obj = dict(u)
        p_ids = user_obj.get("project_ids") or []
        user_obj["is_jira_project_user"] = any(t in p_ids for t in project_tags)
        all_users.append(user_obj)

    # Sort users: project-specific Jira users first, then by name
    all_users.sort(key=lambda x: (not x.get("is_jira_project_user", False), x.get("name", "").lower()))
    
    return {
        "status": "success",
        "project_key": project_key,
        "synced_count": len(jira_users),
        "jira_count": sum(1 for u in all_users if u.get("is_jira_project_user")),
        "users": all_users,
    }

@router.get("/{project_id}/jira-users")
def get_project_jira_users(project_id: str):
    """
    Fetch all team members and Jira assignable users for the given project.
    Syncs live Jira assignable users with Firestore and combines with registered members.
    """
    req = SyncJiraUsersRequest(project_id=project_id)
    res = sync_project_jira_users(req)
    if isinstance(res, dict) and "users" in res:
        return res["users"]
    return res

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

    # Clean up project requirement caches and child entities if present
    for col in ["requirements", "epics", "stories", "tasks", "open_questions", "sprints", "governance_approvals", "activity_logs", "knowledge_items"]:
        try:
            for d in list(db.collection(col).where("project_id", "==", project_id).stream()):
                db.collection(col).document(d.id).delete()
        except Exception:
            pass
    try:
        db.collection("requirements").document(f"req-{project_id}").delete()
    except Exception:
        pass

    # Remove project_id from users in Firestore 'users' collection
    try:
        for u_doc in db.collection("users").stream():
            u_data = u_doc.to_dict()
            p_ids = u_data.get("project_ids", [])
            if project_id in p_ids:
                p_ids = [pid for pid in p_ids if pid != project_id]
                db.collection("users").document(u_doc.id).update({
                    "project_ids": p_ids,
                    "updated_at": datetime.utcnow().isoformat()
                })
    except Exception:
        pass

    return {
        "status": "SUCCESS",
        "deleted_project_id": project_id,
        "message": f"Project '{p_name}' [{p_key}] was deleted from database."
    }
