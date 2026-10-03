from typing import List
from fastapi import APIRouter
from apps.api.src.schemas.meeting import MeetingIngestRequest, MeetingExtractResponse
from apps.api.src.core.firestore_client import db

try:
    from packages.agents.src.orchestrator import orchestrator
    from packages.agents.src.meeting_agent import meeting_agent
except ImportError:
    pass

router = APIRouter(prefix="/meetings", tags=["Meeting Intelligence"])

@router.post("/extract", response_model=MeetingExtractResponse)
@router.post("/process", response_model=MeetingExtractResponse)
def process_meeting(req: MeetingIngestRequest):
    """Process a meeting transcript (Standup, Review, Retro) and trigger automated actions."""
    res = orchestrator.handle_event("EVENT_MEETING_INGESTED", {
        "project_id": req.project_id,
        "meeting_type": req.meeting_type.value,
        "transcript": req.transcript_text
    })
    return MeetingExtractResponse(**res["meeting_result"])

@router.get("/{project_id}", response_model=List[MeetingExtractResponse])
def list_project_meetings(project_id: str):
    """List historical meetings and decisions for the project."""
    docs = list(db.collection("meetings").where("project_id", "==", project_id).stream())
    return [MeetingExtractResponse(**d.to_dict()) for d in docs]
