import base64
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from apps.api.src.schemas.requirement import (
    PRDUploadRequest,
    PRDExtractResult,
    RequirementDecompositionResponse
)
from packages.agents.src.understanding_agent import understanding_agent
from packages.agents.src.ambiguity_agent import ambiguity_agent
from packages.agents.src.agile_scrum_agents import requirements_pipeline
from apps.api.src.core.provider_factory import provider_factory
from apps.api.src.core.storage_client import storage_service
from apps.api.src.core.firestore_client import db

logger = logging.getLogger("ingest_api")
router = APIRouter(prefix="/ingest", tags=["Document Ingestion"])

@router.get("/{project_id}", response_model=PRDExtractResult)
def get_ingested_requirements(project_id: str):
    """Retrieve the ingested requirement specification, capabilities, and clauses for a project."""
    doc = db.collection("requirements").document(f"req-{project_id}").get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="No requirement document found for this project.")
    return PRDExtractResult(**doc.to_dict())

@router.get("/{project_id}/strategy")
def get_project_strategy(project_id: str):
    """Retrieve Lead Orchestrator strategy, PO decomposition, and Technical Sprint plan."""
    doc = db.collection("project_strategies").document(project_id).get()
    if not doc.exists:
        return {}
    return doc.to_dict()

@router.post("/{project_id}/decompose", response_model=RequirementDecompositionResponse)
def trigger_requirement_decomposition(project_id: str, payload: Optional[dict] = None):
    """
    On-demand execution of the 3-Agent Requirement Decomposition Pipeline:
    - Agent 1: Lead Agile Scrum Orchestrator (Strategy & Sprint Guidelines)
    - Agent 2: Agile Scrum Master & Product Owner (Epics & Gherkin User Stories)
    - Agent 3: Technical Scrum Master (INVEST Validation, Fibonacci Story Points, and Jira export)
    """
    req_doc = db.collection("requirements").document(f"req-{project_id}").get()
    req_data = req_doc.to_dict() if req_doc.exists else {}

    proj_doc = db.collection("projects").document(project_id).get()
    proj_data = proj_doc.to_dict() if proj_doc.exists else {}

    raw_text = (
        (payload and payload.get("raw_requirements"))
        or req_data.get("business_goal")
        or proj_data.get("business_objective")
        or proj_data.get("description")
        or "Core functional requirements."
    )
    sprint_goal = (payload and payload.get("sprint_goal")) or req_data.get("business_goal") or proj_data.get("business_objective")

    return requirements_pipeline.run_pipeline(
        project_id=project_id,
        raw_requirements=raw_text,
        sprint_goal=sprint_goal,
        auto_create_backlog=True
    )

@router.post("", response_model=PRDExtractResult)
def ingest_document(req: PRDUploadRequest):
    """Ingest a PRD or attached Confluence document, upload to Google Cloud Storage, extract layout, and sync to NotebookLM."""
    file_bytes = b""
    raw_text = req.file_text or ""
    file_name = req.file_name or "Project_Requirements.txt"
    confluence_url = req.confluence_url
    confluence_link_id = req.confluence_link_id

    # If Confluence link is indicated, or text is empty, resolve from project's attached Confluence pages
    if req.confluence_link_id or req.confluence_url or (not raw_text and not req.file_content_base64):
        try:
            p_doc = db.collection("projects").document(req.project_id).get()
            if p_doc.exists:
                p_data = p_doc.to_dict() or {}
                c_pages = list(p_data.get("confluence_settings", {}).get("pages", []))
                target_page = None

                if req.confluence_link_id and req.confluence_link_id != "all":
                    target_page = next((p for p in c_pages if p.get("id") == req.confluence_link_id), None)
                elif req.confluence_url:
                    target_page = next((p for p in c_pages if p.get("url") == req.confluence_url), None)

                if target_page:
                    confluence_url = target_page.get("url") or confluence_url
                    confluence_link_id = target_page.get("id") or confluence_link_id
                    if not raw_text:
                        raw_text = target_page.get("content") or target_page.get("description") or target_page.get("title") or ""
                    if file_name in ("Project_Requirements.txt", "requirements.pdf"):
                        file_name = f"{target_page.get('title', 'Confluence_Spec')}.md"

                    # If page content is empty or short, attempt to fetch live from Confluence
                    if len(raw_text.strip()) < 50:
                        try:
                            doc_provider = provider_factory.get_doc_provider(req.project_id)
                            from apps.api.src.core.providers.doc.confluence_provider import ConfluenceDocProvider
                            if isinstance(doc_provider, ConfluenceDocProvider) and doc_provider._is_configured():
                                fetched = doc_provider.fetch_page_content(target_page.get("url", ""))
                                if fetched and fetched.get("content"):
                                    raw_text = fetched["content"]
                                    target_page["content"] = fetched["content"]
                                    target_page["content_length"] = fetched.get("content_length", len(raw_text))
                                    target_page["fetch_status"] = "SYNCED"
                                    db.collection("projects").document(req.project_id).update({
                                        "confluence_settings.pages": c_pages
                                    })
                        except Exception as ex:
                            logger.warning(f"Could not fetch Confluence content during ingestion: {ex}")

                elif req.confluence_link_id == "all" or (not raw_text and c_pages):
                    confluence_link_id = "all"
                    if c_pages and not confluence_url:
                        confluence_url = c_pages[0].get("url")
                    if not raw_text:
                        parts = []
                        for p in c_pages:
                            p_body = p.get("content") or p.get("description") or p.get("title") or ""
                            parts.append(f"# {p.get('title', 'Page')}\nSource: {p.get('url', '')}\n\n{p_body}")
                        raw_text = "\n\n---\n\n".join(parts)
                    if file_name in ("Project_Requirements.txt", "requirements.pdf"):
                        file_name = f"{p_data.get('key', 'Project')}_Confluence_Documentation.md"
        except Exception as e:
            logger.warning(f"Error resolving attached Confluence pages: {e}")

    if req.file_content_base64:
        try:
            file_bytes = base64.b64decode(req.file_content_base64)
            if not raw_text:
                try:
                    raw_text = file_bytes.decode("utf-8")
                except UnicodeDecodeError:
                    pass
        except Exception as e:
            logger.warning(f"Error decoding base64 content: {e}")
    elif raw_text:
        file_bytes = raw_text.encode("utf-8")

    # 1. Upload persistent document directly to Google Cloud Storage bucket
    gcs_uri = storage_service.upload_document(
        project_id=req.project_id,
        file_name=file_name,
        content_bytes=file_bytes
    )

    # 2. Understanding Agent processing with live Gemini / Document AI
    result = understanding_agent.process_document(
        project_id=req.project_id,
        file_bytes=file_bytes,
        file_name=file_name,
        raw_text=raw_text
    )
    result.gcs_uri = gcs_uri
    result.confluence_url = confluence_url
    result.confluence_link_id = confluence_link_id

    # 3. Sync to Google NotebookLM living knowledge hub
    try:
        knowledge_provider = provider_factory.get_knowledge_provider(req.project_id)
        k_title = f"Confluence: {result.document_title}" if confluence_url or confluence_link_id else f"PRD: {result.document_title}"
        k_source_type = "CONFLUENCE" if confluence_url or confluence_link_id else "PRD_SPECIFICATION"
        k_item = knowledge_provider.add_knowledge_item(
            project_id=req.project_id,
            title=k_title,
            content=raw_text[:3000] if raw_text else result.business_goal,
            source_type=k_source_type,
            source_uri=confluence_url or gcs_uri
        )
        result.notebooklm_source_id = k_item.notebooklm_source_id
        logger.info(f"Registered document into NotebookLM knowledge registry: {k_item.id}")
    except Exception as e:
        logger.warning(f"Could not register into NotebookLM registry: {e}")

    # 4. Ambiguity Agent identifies open questions from extracted clauses
    ambiguity_agent.identify_open_questions(req.project_id, result.clauses)

    # 5. Publish summary via configured Documentation Provider
    doc_provider = provider_factory.get_doc_provider(req.project_id)
    doc_provider.publish_prd_summary(req.project_id, result.document_title, result.business_goal)

    # 6. Execute the 3-Agent Requirement Decomposition Pipeline
    try:
        raw_requirements_text = raw_text or result.business_goal or file_name
        decomp_result = requirements_pipeline.run_pipeline(
            project_id=req.project_id,
            raw_requirements=raw_requirements_text,
            sprint_goal=result.business_goal,
            auto_create_backlog=True
        )
        result.orchestrator_strategy = decomp_result.orchestrator_strategy.dict()
        result.decomposition_summary = {
            "total_epics": decomp_result.total_epics,
            "total_stories": decomp_result.total_stories,
            "total_points": decomp_result.total_points
        }
        logger.info(f"3-Agent pipeline created {decomp_result.total_stories} stories ({decomp_result.total_points} pts) for {req.project_id}")
    except Exception as e:
        logger.warning(f"Could not run 3-Agent pipeline during document ingestion: {e}")

    # 7. Update project's business_objective and requirement in Firestore
    try:
        p_ref = db.collection("projects").document(req.project_id)
        if p_ref.get().exists:
            p_ref.update({"business_objective": result.business_goal})
        db.collection("requirements").document(f"req-{req.project_id}").set(result.dict())
    except Exception as e:
        logger.warning(f"Could not update project business objective: {e}")

    return result
