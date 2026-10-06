from typing import Dict, Any
from fastapi import APIRouter
from apps.api.src.schemas.requirement import PRDUploadRequest, PRDExtractResult
from apps.api.src.schemas.backlog import BacklogHierarchyResponse
from apps.api.src.api.ingest import ingest_document
from apps.api.src.api.backlog import generate_backlog

router = APIRouter(prefix="/simulator", tags=["E2E Pipeline Simulator"])

@router.post("/run-step-1", response_model=PRDExtractResult)
def run_stage_1(req: PRDUploadRequest):
    """Step 1 & 2: Ingest PRD & Run Multi-Agent Document Analysis."""
    return ingest_document(req)

@router.post("/run-step-4", response_model=BacklogHierarchyResponse)
def run_stage_4(payload: Dict[str, Any]):
    """Step 4: Synthesize Backlog from resolved Open Questions."""
    return generate_backlog(payload)
