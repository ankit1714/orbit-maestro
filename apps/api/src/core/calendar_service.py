import os
import json
import logging
import re
import subprocess
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

import requests

from apps.api.src.core.config import settings
from apps.api.src.core.firestore_client import db
from apps.api.src.schemas.common import MeetingType
from apps.api.src.schemas.meeting import (
    CalendarMeeting,
    CalendarEventAttachment,
    CalendarStatusResponse,
    CalendarEventsResponse,
    CalendarPullNotesResponse,
    MeetingExtractResponse,
    CalendarOAuthUrlResponse,
    CalendarOAuthCallbackResponse
)

logger = logging.getLogger("calendar_service")

class GoogleCalendarService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(GoogleCalendarService, cls).__new__(cls)
            cls._instance._custom_token = None
            cls._instance._user_email = None
            cls._instance._user_tokens = {}
        return cls._instance

    def _get_active_token(self, user_email: Optional[str] = None, passed_token: Optional[str] = None) -> Optional[str]:
        """Resolves active Google OAuth2 token from passed token, memory, env, firestore, ADC, or gcloud CLI."""
        if passed_token and passed_token.strip():
            return passed_token.strip()

        if user_email and user_email in self._user_tokens:
            return self._user_tokens[user_email]

        if self._custom_token:
            return self._custom_token

        env_token = getattr(settings, "GOOGLE_ACCESS_TOKEN", None) or os.getenv("GOOGLE_ACCESS_TOKEN")
        if env_token and env_token.strip():
            return env_token.strip()

        # Check in local firestore settings
        try:
            doc = db.collection("integrations").document("google_calendar").get()
            if doc.exists:
                data = doc.to_dict()
                if data.get("access_token"):
                    return data.get("access_token")
        except Exception:
            pass

        # Try Google Application Default Credentials (ADC / Cloud Run Service Account)
        try:
            import google.auth
            from google.auth.transport.requests import Request
            creds, _ = google.auth.default(scopes=[
                'https://www.googleapis.com/auth/calendar.readonly',
                'https://www.googleapis.com/auth/drive.readonly'
            ])
            creds.refresh(Request())
            if creds.token:
                return creds.token
        except Exception as e:
            logger.debug(f"Could not get ADC token: {e}")

        # Try gcloud CLI auth token if available locally
        try:
            token = subprocess.check_output(["gcloud", "auth", "print-access-token"], timeout=4).decode().strip()
            if token:
                return token
        except Exception:
            pass

        return None

    def get_status(self, user_email: Optional[str] = None, access_token: Optional[str] = None) -> CalendarStatusResponse:
        """Checks Google Calendar connectivity status against Google Calendar API."""
        token = self._get_active_token(user_email, access_token)
        email = user_email or self._user_email

        if not token:
            return CalendarStatusResponse(
                connected=False,
                user_email=email,
                source="DISCONNECTED",
                primary_calendar_id="primary",
                message="Google Calendar is not connected. Enter your Gmail or access token to connect."
            )

        if token.startswith("mock-") or token.startswith("test-"):
            return CalendarStatusResponse(
                connected=True,
                user_email=email or "test@company.com",
                source="MOCK_TEST",
                primary_calendar_id="primary",
                message=f"Connected to Google Calendar as {email or 'test@company.com'}"
            )

        # Test call to Google Calendar API
        try:
            calendar_id = email if email and "@" in email else "primary"
            res = requests.get(
                f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events",
                headers={"Authorization": f"Bearer {token}"},
                params={"maxResults": 1},
                timeout=5
            )
            if res.status_code == 200:
                return CalendarStatusResponse(
                    connected=True,
                    user_email=email or "Connected Google Account",
                    source="GOOGLE_CALENDAR_LIVE",
                    primary_calendar_id=calendar_id,
                    message="Connected to live Google Calendar. Ready to fetch actual meetings."
                )
            elif res.status_code in (401, 403):
                err_json = res.json().get("error", {})
                err_msg = err_json.get("message", "Insufficient permission or expired token")
                return CalendarStatusResponse(
                    connected=False,
                    user_email=email,
                    source="AUTH_REQUIRED",
                    primary_calendar_id="primary",
                    message=f"Google Calendar authorization needed: {err_msg}."
                )
        except Exception as e:
            logger.debug(f"Google Calendar status check error: {e}")

        return CalendarStatusResponse(
            connected=False,
            user_email=email,
            source="DISCONNECTED",
            primary_calendar_id="primary",
            message="Unable to verify Google Calendar connection. Please provide a token or share calendar."
        )

    def connect(self, access_token: Optional[str] = None, user_email: Optional[str] = None, refresh_token: Optional[str] = None) -> CalendarStatusResponse:
        """Stores user's Google Calendar OAuth credentials."""
        if access_token:
            self._custom_token = access_token.strip()
            if user_email:
                self._user_tokens[user_email] = access_token.strip()
        if user_email:
            self._user_email = user_email

        try:
            db.collection("integrations").document("google_calendar").set({
                "access_token": access_token or self._custom_token,
                "refresh_token": refresh_token,
                "user_email": user_email or self._user_email,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }, merge=True)
        except Exception as e:
            logger.warning(f"Could not persist calendar integration in DB: {e}")

        return self.get_status(user_email=user_email, access_token=access_token)

    def disconnect(self) -> CalendarStatusResponse:
        """Disconnects custom Google Calendar token."""
        self._custom_token = None
        self._user_email = None
        self._user_tokens = {}
        try:
            db.collection("integrations").document("google_calendar").delete()
        except Exception:
            pass

        return CalendarStatusResponse(
            connected=False,
            user_email=None,
            source="DISCONNECTED",
            primary_calendar_id="primary",
            message="Google Calendar disconnected."
        )

    def get_oauth_url(self, redirect_uri: Optional[str] = None, project_id: Optional[str] = None) -> CalendarOAuthUrlResponse:
        """Generates the Google OAuth 2.0 authorization redirect URL for calendar & drive scopes."""
        client_id = settings.GOOGLE_CLIENT_ID or os.getenv("GOOGLE_CLIENT_ID")
        
        # Check in local firestore settings if not in env
        if not client_id:
            try:
                doc = db.collection("integrations").document("google_oauth_client").get()
                if doc.exists:
                    client_id = doc.to_dict().get("client_id")
            except Exception:
                pass

        if not client_id:
            return CalendarOAuthUrlResponse(
                auth_url="",
                client_id_configured=False,
                message="Google OAuth 2.0 Client ID is not configured. Set GOOGLE_CLIENT_ID in your environment or Cloud Run variables."
            )

        target_redirect = redirect_uri or settings.GOOGLE_OAUTH_REDIRECT_URI or "http://localhost:3000/oauth/callback"
        scopes = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.readonly email profile"
        
        state_payload = {"project_id": project_id or ""}
        state_str = json.dumps(state_payload)

        params = {
            "client_id": client_id,
            "redirect_uri": target_redirect,
            "response_type": "code",
            "scope": scopes,
            "access_type": "offline",
            "prompt": "consent",
            "state": state_str
        }
        
        query_string = urllib.parse.urlencode(params)
        auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{query_string}"

        return CalendarOAuthUrlResponse(
            auth_url=auth_url,
            client_id_configured=True,
            message="Google authorization URL generated."
        )

    def exchange_oauth_code(self, code: str, redirect_uri: str, project_id: Optional[str] = None) -> CalendarOAuthCallbackResponse:
        """Exchanges Google authorization code for access and refresh tokens, and saves credentials."""
        client_id = settings.GOOGLE_CLIENT_ID or os.getenv("GOOGLE_CLIENT_ID")
        client_secret = settings.GOOGLE_CLIENT_SECRET or os.getenv("GOOGLE_CLIENT_SECRET")

        if not client_id or not client_secret:
            try:
                doc = db.collection("integrations").document("google_oauth_client").get()
                if doc.exists:
                    data = doc.to_dict()
                    client_id = client_id or data.get("client_id")
                    client_secret = client_secret or data.get("client_secret")
            except Exception:
                pass

        if not client_id or not client_secret:
            return CalendarOAuthCallbackResponse(
                success=False,
                message="GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Please configure them in GCP or environment."
            )

        token_url = "https://oauth2.googleapis.com/token"
        data = {
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code"
        }

        try:
            res = requests.post(token_url, data=data, timeout=12)
            if res.status_code != 200:
                logger.error(f"OAuth token exchange failed ({res.status_code}): {res.text}")
                return CalendarOAuthCallbackResponse(
                    success=False,
                    message=f"Google token exchange failed: {res.text}"
                )

            token_data = res.json()
            access_token = token_data.get("access_token")
            refresh_token = token_data.get("refresh_token")

            # Fetch user email from Google Userinfo endpoint
            user_email = None
            try:
                userinfo_res = requests.get(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=6
                )
                if userinfo_res.status_code == 200:
                    user_email = userinfo_res.json().get("email")
            except Exception as e:
                logger.debug(f"Could not fetch userinfo: {e}")

            # Store credentials
            self.connect(access_token=access_token, user_email=user_email, refresh_token=refresh_token)

            return CalendarOAuthCallbackResponse(
                success=True,
                user_email=user_email,
                access_token=access_token,
                message="Google Calendar authorized successfully!"
            )
        except Exception as e:
            logger.error(f"Error during OAuth exchange: {e}")
            return CalendarOAuthCallbackResponse(success=False, message=str(e))

    def list_meetings(
        self,
        project_id: str,
        user_email: Optional[str] = None,
        time_min: Optional[str] = None,
        time_max: Optional[str] = None,
        max_results: int = 30,
        access_token: Optional[str] = None
    ) -> CalendarEventsResponse:
        """
        Retrieves user's Google Calendar meetings, identifying Gemini Notes attachments.
        STRICTLY queries and returns actual meetings from the user's Google Calendar account.
        Zero hardcoded meetings.
        """
        token = self._get_active_token(user_email, access_token)

        if not token:
            logger.info("No active Google token found; returning 0 calendar events.")
            return CalendarEventsResponse(
                connected=False,
                user_email=user_email or self._user_email,
                source="DISCONNECTED",
                events=[],
                total_events=0
            )

        live_events: List[CalendarMeeting] = []

        try:
            now = datetime.now(timezone.utc)
            now_iso = time_min or (now - timedelta(days=14)).isoformat()
            future_iso = time_max or (now + timedelta(days=14)).isoformat()

            # Attempt querying user's calendar by email or primary
            calendar_ids = []
            if user_email and "@" in user_email:
                calendar_ids.append(user_email)
            calendar_ids.append("primary")

            res = None
            for cal_id in calendar_ids:
                url = f"https://www.googleapis.com/calendar/v3/calendars/{cal_id}/events"
                params = {
                    "timeMin": now_iso,
                    "timeMax": future_iso,
                    "singleEvents": "true",
                    "orderBy": "startTime",
                    "maxResults": max_results
                }
                res = requests.get(url, headers={"Authorization": f"Bearer {token}"}, params=params, timeout=10)
                if res.status_code == 200:
                    break
                elif res.status_code in (404, 403) and cal_id != "primary":
                    continue  # try primary calendar next

            if res and res.status_code == 200:
                raw_items = res.json().get("items", [])
                logger.info(f"Retrieved {len(raw_items)} live Google Calendar events from real account.")

                for ev in raw_items:
                    ev_id = ev.get("id", "")
                    summary = ev.get("summary", "Untitled Meeting")
                    description = ev.get("description", "")
                    start_time = ev.get("start", {}).get("dateTime") or ev.get("start", {}).get("date") or now.isoformat()
                    end_time = ev.get("end", {}).get("dateTime") or ev.get("end", {}).get("date") or now.isoformat()
                    organizer = ev.get("organizer", {}).get("displayName") or ev.get("organizer", {}).get("email") or "Meeting Host"
                    meet_link = ev.get("hangoutLink")

                    attendees_list = []
                    for att in ev.get("attendees", []):
                        att_name = att.get("displayName") or att.get("email")
                        if att_name:
                            attendees_list.append(att_name)

                    # Detect Gemini Notes attachments & Google Docs
                    attachments: List[CalendarEventAttachment] = []
                    has_gemini = False
                    gemini_title = None
                    gemini_doc_id = None
                    gemini_url = None

                    for a in ev.get("attachments", []):
                        a_title = a.get("title", "Attachment")
                        a_url = a.get("fileUrl", "")
                        a_id = a.get("fileId", "")
                        a_mime = a.get("mimeType", "")
                        is_gn = False

                        if "gemini" in a_title.lower() or "notes by" in a_title.lower() or "take notes" in a_title.lower() or "meeting notes" in a_title.lower():
                            is_gn = True
                            has_gemini = True
                            gemini_title = a_title
                            gemini_doc_id = a_id
                            gemini_url = a_url
                        elif a_mime == "application/vnd.google-apps.document":
                            is_gn = True
                            has_gemini = True
                            gemini_title = a_title
                            gemini_doc_id = a_id
                            gemini_url = a_url

                        attachments.append(CalendarEventAttachment(
                            file_id=a_id,
                            file_url=a_url,
                            title=a_title,
                            mime_type=a_mime,
                            is_gemini_notes=is_gn
                        ))

                    # Check description for Gemini Notes links
                    if not has_gemini and ("docs.google.com" in description or "gemini" in description.lower()):
                        m_link = re.search(r'https://docs\.google\.com/document/d/([a-zA-Z0-9_-]+)', description)
                        if m_link:
                            has_gemini = True
                            gemini_doc_id = m_link.group(1)
                            gemini_url = m_link.group(0)
                            gemini_title = f"Notes by Gemini: {summary}"
                            attachments.append(CalendarEventAttachment(
                                file_id=gemini_doc_id,
                                file_url=gemini_url,
                                title=gemini_title,
                                mime_type="application/vnd.google-apps.document",
                                is_gemini_notes=True
                            ))

                    # Determine meeting type
                    sum_lower = summary.lower()
                    if any(w in sum_lower for w in ["standup", "scrum", "daily"]):
                        m_type = MeetingType.STANDUP
                    elif any(w in sum_lower for w in ["arch", "design", "tech", "api"]):
                        m_type = MeetingType.ARCHITECTURE
                    elif any(w in sum_lower for w in ["review", "demo", "showcase"]):
                        m_type = MeetingType.REVIEW
                    elif any(w in sum_lower for w in ["retro", "retrospective"]):
                        m_type = MeetingType.RETROSPECTIVE
                    elif any(w in sum_lower for w in ["triage", "bug", "defect"]):
                        m_type = MeetingType.TRIAGE
                    else:
                        m_type = MeetingType.STANDUP if "sync" in sum_lower else MeetingType.ADHOC

                    meeting = CalendarMeeting(
                        id=ev_id,
                        title=summary,
                        description=description,
                        start_time=start_time,
                        end_time=end_time,
                        meeting_type=m_type,
                        attendees=attendees_list,
                        organizer=organizer,
                        meet_link=meet_link,
                        attachments=attachments,
                        has_gemini_notes=has_gemini,
                        gemini_notes_title=gemini_title,
                        gemini_notes_doc_id=gemini_doc_id,
                        gemini_notes_url=gemini_url,
                        status="CONFIRMED"
                    )
                    live_events.append(meeting)

                return CalendarEventsResponse(
                    connected=True,
                    user_email=user_email or self._user_email or "Connected Google Account",
                    source="GOOGLE_CALENDAR_LIVE",
                    events=live_events,
                    total_events=len(live_events)
                )

            elif res and res.status_code in (401, 403):
                err_json = res.json().get("error", {})
                err_msg = err_json.get("message", "Permission denied or expired token")
                logger.warning(f"Google Calendar API rejected access ({res.status_code}): {err_msg}")
                return CalendarEventsResponse(
                    connected=False,
                    user_email=user_email or self._user_email,
                    source="AUTH_REQUIRED",
                    events=[],
                    total_events=0
                )

        except Exception as e:
            logger.warning(f"Google Calendar API query failed: {e}")

        # Return empty list on failure - NO hardcoded fallback
        return CalendarEventsResponse(
            connected=bool(token),
            user_email=user_email or self._user_email,
            source="GOOGLE_CALENDAR_LIVE" if token else "DISCONNECTED",
            events=[],
            total_events=0
        )

    def pull_gemini_notes(
        self,
        event_id: str,
        project_id: str,
        doc_id: Optional[str] = None,
        access_token: Optional[str] = None
    ) -> CalendarPullNotesResponse:
        """
        Extracts Gemini meeting notes from the Google Calendar invite or Google Doc attachment.
        Fetches the actual text via Google Drive API plain-text export or event description.
        Zero hardcoded templates.
        """
        token = self._get_active_token(passed_token=access_token)

        # 1. Attempt live Google Docs API export if doc_id provided and token valid
        if token and doc_id:
            try:
                export_url = f"https://www.googleapis.com/drive/v3/files/{doc_id}/export?mimeType=text/plain"
                res = requests.get(export_url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
                if res.status_code == 200 and res.text.strip():
                    doc_content = res.text.strip()
                    logger.info(f"Exported live Gemini Notes Google Doc ({len(doc_content)} characters) for event {event_id}")
                    return CalendarPullNotesResponse(
                        event_id=event_id,
                        project_id=project_id,
                        title=f"Notes by Gemini: {event_id}",
                        meeting_type=MeetingType.STANDUP,
                        date=datetime.now(timezone.utc),
                        organizer="Meeting Host",
                        attendees=[],
                        notes_content=doc_content,
                        has_gemini_notes=True,
                        source_doc_title=f"Google Doc [{doc_id}]",
                        source_doc_url=f"https://docs.google.com/document/d/{doc_id}/edit"
                    )
            except Exception as e:
                logger.warning(f"Could not export live Google Doc: {e}")

        # 2. Check live calendar event description if available
        if token:
            try:
                ev_url = f"https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}"
                ev_res = requests.get(ev_url, headers={"Authorization": f"Bearer {token}"}, timeout=6)
                if ev_res.status_code == 200:
                    ev_data = ev_res.json()
                    desc = ev_data.get("description", "").strip()
                    summary = ev_data.get("summary", f"Meeting: {event_id}")
                    organizer = ev_data.get("organizer", {}).get("displayName") or ev_data.get("organizer", {}).get("email") or "Meeting Host"
                    attendees = [a.get("displayName") or a.get("email") for a in ev_data.get("attendees", []) if a.get("displayName") or a.get("email")]

                    if desc:
                        return CalendarPullNotesResponse(
                            event_id=event_id,
                            project_id=project_id,
                            title=summary,
                            meeting_type=MeetingType.STANDUP,
                            date=datetime.now(timezone.utc),
                            organizer=organizer,
                            attendees=attendees,
                            notes_content=desc,
                            has_gemini_notes=True,
                            source_doc_title=summary,
                            source_doc_url=None
                        )
            except Exception as e:
                logger.debug(f"Could not fetch live calendar event details: {e}")

        # 3. If no actual content found, return an informative empty note
        return CalendarPullNotesResponse(
            event_id=event_id,
            project_id=project_id,
            title=f"Meeting: {event_id}",
            meeting_type=MeetingType.STANDUP,
            date=datetime.now(timezone.utc),
            organizer="Meeting Host",
            attendees=[],
            notes_content=f"No Gemini notes or text description found for calendar event {event_id}. You can manually add notes in the entry form.",
            has_gemini_notes=False,
            source_doc_title=None,
            source_doc_url=None
        )

    def pull_and_process(
        self,
        event_id: str,
        project_id: str,
        doc_id: Optional[str] = None,
        access_token: Optional[str] = None
    ) -> MeetingExtractResponse:
        """
        Pulls Gemini meeting notes from the Google Calendar invite and feeds them directly
        as the input to the AI Meeting Intelligence Agent.
        """
        from packages.agents.src.meeting_agent import meeting_agent

        # 1. Pull the meeting details and Gemini notes
        pulled = self.pull_gemini_notes(event_id=event_id, project_id=project_id, doc_id=doc_id, access_token=access_token)

        # 2. Run the Meeting Intelligence Agent
        result = meeting_agent.process_transcript(
            project_id=project_id,
            meeting_type=pulled.meeting_type,
            transcript_text=pulled.notes_content,
            title=pulled.title,
            entered_by=f"Google Calendar (Gemini Notes) — {pulled.organizer or 'Organizer'}",
            date=pulled.date,
            meeting_id=f"meet-gcal-{event_id}"
        )

        # 3. Augment with calendar metadata
        result.calendar_event_id = event_id
        result.has_gemini_notes = pulled.has_gemini_notes
        result.source_doc_url = pulled.source_doc_url

        # Update in database
        try:
            db.collection("meetings").document(result.meeting_id).update({
                "calendar_event_id": event_id,
                "has_gemini_notes": pulled.has_gemini_notes,
                "source_doc_url": pulled.source_doc_url
            })
        except Exception:
            pass

        return result

calendar_service = GoogleCalendarService()
