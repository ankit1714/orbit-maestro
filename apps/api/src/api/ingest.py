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
    """Ingest a PRD document, upload to Google Cloud Storage, extract layout, and sync to NotebookLM."""
    file_bytes = b""
    raw_text = req.file_text or ""
    file_name = req.file_name or "Project_Requirements.txt"

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

    # 3. Sync to Google NotebookLM living knowledge hub
    try:
        knowledge_provider = provider_factory.get_knowledge_provider(req.project_id)
        k_item = knowledge_provider.add_knowledge_item(
            project_id=req.project_id,
            title=f"PRD: {result.document_title}",
            content=raw_text[:3000] if raw_text else result.business_goal,
            source_type="PRD_SPECIFICATION",
            source_uri=gcs_uri
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
