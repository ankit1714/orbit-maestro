import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from apps.api.src.main import app
from apps.api.src.core.calendar_service import calendar_service
from apps.api.src.schemas.common import MeetingType

client = TestClient(app)

def test_calendar_status_endpoint():
    res = client.get("/v1/meetings/calendar/status?user_email=test@company.com")
    assert res.status_code == 200
    data = res.json()
    assert "connected" in data
    assert data["primary_calendar_id"] == "primary"

def test_calendar_connect_endpoint():
    res = client.post("/v1/meetings/calendar/connect", json={
        "access_token": "mock-token-xyz",
        "user_email": "engineer@enterprise.io"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["connected"] is True
    assert data["user_email"] == "engineer@enterprise.io"

@patch("requests.get")
def test_calendar_list_events_endpoint(mock_get):
    # Mock realistic Google Calendar API response
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "items": [
            {
                "id": "gcal-real-standup-001",
                "summary": "Sprint Daily Scrum — Claims Auto",
                "description": "Daily standup meeting. Notes by Gemini attached.",
                "start": {"dateTime": "2026-10-11T09:30:00Z"},
                "end": {"dateTime": "2026-10-11T10:00:00Z"},
                "organizer": {"displayName": "Sarah Connor", "email": "sarah@company.com"},
                "attendees": [
                    {"displayName": "Alex", "email": "alex@company.com"},
                    {"displayName": "David", "email": "david@company.com"}
                ],
                "hangoutLink": "https://meet.google.com/abc-defg-hij",
                "attachments": [
                    {
                        "fileId": "doc-gn-standup-01",
                        "fileUrl": "https://docs.google.com/document/d/doc-gn-standup-01/edit",
                        "title": "Notes by Gemini: Daily Scrum",
                        "mimeType": "application/vnd.google-apps.document"
                    }
                ]
            },
            {
                "id": "gcal-real-arch-002",
                "summary": "Architecture & Security Sync",
                "description": "Reviewing security gateways and OAuth2 token rotation.",
                "start": {"dateTime": "2026-10-11T14:00:00Z"},
                "end": {"dateTime": "2026-10-11T15:00:00Z"},
                "organizer": {"displayName": "Alex", "email": "alex@company.com"},
                "attendees": [{"displayName": "David", "email": "david@company.com"}],
                "hangoutLink": "https://meet.google.com/xyz-uvwx-rst",
                "attachments": []
            }
        ]
    }
    mock_get.return_value = mock_resp

    res = client.get("/v1/meetings/calendar/events?project_id=proj-claims-auto&access_token=ya29.mock_token")
    assert res.status_code == 200
    data = res.json()
    assert data["connected"] is True
    assert data["source"] == "GOOGLE_CALENDAR_LIVE"
    assert len(data["events"]) == 2
    
    # Check that Gemini Notes attachments are detected
    gemini_events = [e for e in data["events"] if e["has_gemini_notes"]]
    assert len(gemini_events) == 1
    first_gemini = gemini_events[0]
    assert first_gemini["gemini_notes_title"] == "Notes by Gemini: Daily Scrum"
    assert len(first_gemini["attachments"]) == 1

@patch("requests.get")
def test_calendar_pull_notes_endpoint(mock_get):
    # Mock Google Drive export of plain-text Gemini Notes document
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = """# Notes by Gemini: Daily Scrum
Attendees: Sarah, Alex, David
- Alex completed OCR pipeline implementation.
- David working on task CLM-142 for checkout gateway.
- Decision: Product Owner approved keeping current sprint scope locked."""
    mock_get.return_value = mock_resp

    res = client.get("/v1/meetings/calendar/events/gcal-real-standup-001/notes?project_id=proj-claims-auto&doc_id=doc-gn-standup-01&access_token=ya29.mock_token")
    assert res.status_code == 200
    data = res.json()
    assert data["event_id"] == "gcal-real-standup-001"
    assert data["has_gemini_notes"] is True
    assert "Notes by Gemini" in data["notes_content"]

@patch("requests.get")
def test_calendar_pull_and_process_endpoint(mock_get):
    # Mock Google Drive export of Gemini Notes
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = """# Notes by Gemini: Daily Scrum
Attendees: Sarah, Alex, David
- Decision: Approved priority for task CLM-142 checkout integration.
- Blocker: Payment webhook endpoint blocked waiting on vendor contract."""
    mock_get.return_value = mock_resp

    res = client.post("/v1/meetings/calendar/pull-and-process", json={
        "event_id": "gcal-real-standup-001",
        "project_id": "proj-claims-auto",
        "doc_id": "doc-gn-standup-01",
        "access_token": "ya29.mock_token"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["calendar_event_id"] == "gcal-real-standup-001"
    assert data["has_gemini_notes"] is True
    assert len(data["decisions"]) >= 1
    assert "Notes by Gemini" in data["transcript_text"]
    assert data["due_diligence"] is not None

def test_calendar_oauth_url_sanitizes_local_redirect_uri():
    """Verify that passing 127.0.0.1:3000 as redirect_uri is normalized to localhost:3000 to avoid redirect_uri_mismatch."""
    res = client.get("/v1/meetings/calendar/oauth/url?redirect_uri=http://127.0.0.1:3000/oauth/callback")
    assert res.status_code == 200
    data = res.json()
    assert data["client_id_configured"] is True
    # The generated auth_url must have sanitized redirect_uri to localhost:3000
    assert "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Foauth%2Fcallback" in data["auth_url"]
    assert "127.0.0.1" not in data["auth_url"]

