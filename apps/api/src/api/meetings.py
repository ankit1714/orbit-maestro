from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from apps.api.src.schemas.meeting import (
    MeetingIngestRequest,
    MeetingExtractResponse,
    MeetingDueDiligenceResult,
    CalendarStatusResponse,
    CalendarEventsResponse,
    CalendarPullNotesResponse,
    CalendarConnectRequest,
    CalendarPullAndProcessRequest,
    CalendarOAuthUrlResponse,
    CalendarOAuthCallbackRequest,
    CalendarOAuthCallbackResponse
)
from apps.api.src.core.firestore_client import db
from apps.api.src.core.calendar_service import calendar_service

try:
    from packages.agents.src.orchestrator import orchestrator
    from packages.agents.src.meeting_agent import meeting_agent
except ImportError:
    pass

router = APIRouter(prefix="/meetings", tags=["Meeting Intelligence"])

# =========================================================================
# Google Calendar & Gemini Notes Integration Endpoints
# =========================================================================

@router.get("/calendar/status", response_model=CalendarStatusResponse)
def get_calendar_status(
    user_email: Optional[str] = Query(None, description="Current user email"),
    access_token: Optional[str] = Query(None, description="Optional OAuth access token")
):
    """Checks Google Calendar connectivity status and active credentials."""
    return calendar_service.get_status(user_email=user_email, access_token=access_token)

@router.post("/calendar/connect", response_model=CalendarStatusResponse)
def connect_calendar(req: CalendarConnectRequest):
    """Stores or links user's Google Calendar credentials / Gmail identity."""
    return calendar_service.connect(
        access_token=req.access_token,
        user_email=req.user_email,
        refresh_token=req.refresh_token
    )

@router.post("/calendar/disconnect", response_model=CalendarStatusResponse)
def disconnect_calendar():
    """Disconnects Google Calendar integration."""
    return calendar_service.disconnect()

@router.get("/calendar/oauth/url", response_model=CalendarOAuthUrlResponse)
def get_calendar_oauth_url(
    redirect_uri: Optional[str] = Query(None, description="OAuth redirect URI"),
    project_id: Optional[str] = Query(None, description="Active project ID")
):
    """Generates the Google OAuth 2.0 authorization URL for 1-click Calendar & Drive authorization."""
    return calendar_service.get_oauth_url(redirect_uri=redirect_uri, project_id=project_id)

@router.post("/calendar/oauth/callback", response_model=CalendarOAuthCallbackResponse)
def handle_calendar_oauth_callback(req: CalendarOAuthCallbackRequest):
    """Exchanges Google OAuth authorization code for tokens and connects the user's calendar."""
    return calendar_service.exchange_oauth_code(
        code=req.code,
        redirect_uri=req.redirect_uri,
        project_id=req.project_id
    )

@router.get("/calendar/events", response_model=CalendarEventsResponse)
def list_calendar_events(
    project_id: str = Query(..., description="Active project ID"),
    user_email: Optional[str] = Query(None, description="User email"),
    access_token: Optional[str] = Query(None, description="Optional OAuth access token"),
    time_min: Optional[str] = Query(None, description="Start time ISO string"),
    time_max: Optional[str] = Query(None, description="End time ISO string"),
    max_results: int = Query(25, description="Max calendar events to return")
):
    """
    Lists user's Google Calendar meetings, automatically detecting attached Gemini Notes
    Google Docs and Meeting transcripts.
    """
    return calendar_service.list_meetings(
        project_id=project_id,
        user_email=user_email,
        access_token=access_token,
        time_min=time_min,
        time_max=time_max,
        max_results=max_results
    )

@router.get("/calendar/events/{event_id}/notes", response_model=CalendarPullNotesResponse)
def preview_calendar_meeting_notes(
    event_id: str,
    project_id: str = Query(..., description="Active project ID"),
    doc_id: Optional[str] = Query(None, description="Optional Google Doc attachment ID"),
    access_token: Optional[str] = Query(None, description="Optional OAuth access token")
):
    """Previews Gemini meeting notes extracted from Google Calendar before ingesting."""
    return calendar_service.pull_gemini_notes(
        event_id=event_id,
        project_id=project_id,
        doc_id=doc_id,
        access_token=access_token
    )

@router.post("/calendar/pull-and-process", response_model=MeetingExtractResponse)
def pull_and_process_calendar_meeting(req: CalendarPullAndProcessRequest):
    """
    Directly pulls Gemini meeting notes from the Google Calendar invite/Google Doc
    and triggers the AI Meeting Intelligence Agent to extract decisions, blockers,
    actions, and execute cross-artifact due diligence.
    """
    try:
        return calendar_service.pull_and_process(
            event_id=req.event_id,
            project_id=req.project_id,
            doc_id=req.doc_id,
            access_token=req.access_token
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to pull and process Gemini notes: {str(e)}")

# =========================================================================
# Core Meeting Intelligence Endpoints
# =========================================================================

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
