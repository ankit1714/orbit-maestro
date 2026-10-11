from typing import List, Optional
from fastapi import APIRouter, HTTPException
from apps.api.src.schemas.meeting import (
    MeetingIngestRequest,
    MeetingExtractResponse,
    MeetingDueDiligenceResult
)
from apps.api.src.core.firestore_client import db

try:
    from packages.agents.src.orchestrator import orchestrator
    from packages.agents.src.meeting_agent import meeting_agent
except ImportError:
    pass

router = APIRouter(prefix="/meetings", tags=["Meeting Intelligence"])

@router.post("", response_model=MeetingExtractResponse)
@router.post("/extract", response_model=MeetingExtractResponse)
@router.post("/process", response_model=MeetingExtractResponse)
def process_meeting(req: MeetingIngestRequest):
    """
    Process meeting minutes (Standup, Review, Retro, Architecture, Triage, etc.).
    Extracts decisions, blockers, actions, saves in DB with date/time and author,
    and runs AI due diligence across JIRA, Git, and Confluence.
    """
    res = orchestrator.handle_event("EVENT_MEETING_INGESTED", {
        "project_id": req.project_id,
        "meeting_type": req.meeting_type.value,
        "transcript": req.transcript_text,
        "title": req.title or "Team Meeting",
        "entered_by": req.entered_by or "Team Member",
        "date": req.date
    })
    return MeetingExtractResponse(**res["meeting_result"])

@router.get("/{project_id}", response_model=List[MeetingExtractResponse])
def list_project_meetings(project_id: str):
    """List all historical meeting minutes and decisions for the project, sorted newest first."""
    docs = list(db.collection("meetings").where("project_id", "==", project_id).stream())
    results = []
    for d in docs:
        try:
            results.append(MeetingExtractResponse(**d.to_dict()))
        except Exception as e:
            # Fallback if document has missing legacy fields
            data = d.to_dict()
            data.setdefault("title", "Meeting Notes")
            data.setdefault("transcript_text", data.get("transcript", ""))
            data.setdefault("entered_by", "Team Member")
            data.setdefault("is_linked", False)
            data.setdefault("verdict_message", "Not linked to any GIT/JIRA/Confluence")
            results.append(MeetingExtractResponse(**data))

    # Sort descending by date / created_at
    results.sort(key=lambda m: m.date or m.created_at, reverse=True)
    return results

@router.get("/item/{meeting_id}", response_model=MeetingExtractResponse)
def get_meeting(meeting_id: str):
    """Fetch single meeting record by ID."""
    doc = db.collection("meetings").document(meeting_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Meeting not found")
    data = doc.to_dict()
    data.setdefault("title", "Meeting Notes")
    data.setdefault("transcript_text", data.get("transcript", ""))
    data.setdefault("entered_by", "Team Member")
    return MeetingExtractResponse(**data)

@router.post("/{meeting_id}/analyze-links", response_model=MeetingDueDiligenceResult)
def analyze_meeting_links(meeting_id: str):
    """
    Triggers on-demand AI due diligence to identify related JIRA tasks/bugs/stories,
    Git codebase artifacts, and Confluence pages.
    Otherwise responds with 'Not linked to any GIT/JIRA/Confluence'.
    """
    try:
        return meeting_agent.analyze_existing_meeting(meeting_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Due diligence analysis error: {str(e)}")

@router.delete("/{meeting_id}")
def delete_meeting(meeting_id: str):
    """Delete a meeting record from DB."""
    db.collection("meetings").document(meeting_id).delete()
    k_id = f"know-meet-{meeting_id}"
    db.collection("knowledge_items").document(k_id).delete()
    return {"status": "DELETED", "meeting_id": meeting_id}
