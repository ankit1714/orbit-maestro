import base64
import logging
from fastapi import APIRouter, HTTPException
from apps.api.src.schemas.requirement import PRDUploadRequest, PRDExtractResult
from packages.agents.src.understanding_agent import understanding_agent
from packages.agents.src.ambiguity_agent import ambiguity_agent
from apps.api.src.core.provider_factory import provider_factory
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

@router.post("", response_model=PRDExtractResult)
def ingest_document(req: PRDUploadRequest):
    """Ingest a PRD/Specification document, extract optical layout and open questions."""
    file_bytes = b""
    raw_text = req.file_text or ""

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

    # 1. Understanding Agent processing with live Gemini / Document AI
    result = understanding_agent.process_document(
        project_id=req.project_id,
        file_bytes=file_bytes,
        file_name=req.file_name or "Project_Requirements.txt",
        raw_text=raw_text
    )

    # 2. Ambiguity Agent identifies open questions from extracted clauses
    ambiguity_agent.identify_open_questions(req.project_id, result.clauses)

    # 3. Publish summary via configured Documentation Provider
    doc_provider = provider_factory.get_doc_provider(req.project_id)
    doc_provider.publish_prd_summary(req.project_id, result.document_title, result.business_goal)

    # 4. Update project's business_objective in Firestore
    try:
        p_ref = db.collection("projects").document(req.project_id)
        if p_ref.get().exists:
            p_ref.update({"business_objective": result.business_goal})
    except Exception as e:
        logger.warning(f"Could not update project business objective: {e}")

    return result
