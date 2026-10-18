import logging
import uuid
import json
import re
from typing import List, Dict, Any, Optional
from datetime import datetime
from apps.api.src.schemas.meeting import (
    MeetingExtractResponse,
    ExtractedDecision,
    ExtractedBlocker,
    ExtractedAction,
    LinkedJiraIssue,
    LinkedGitArtifact,
    LinkedConfluencePage,
    MeetingDueDiligenceResult
)
from apps.api.src.schemas.common import MeetingType, GovernanceTier
from apps.api.src.core.firestore_client import db
from apps.api.src.core.vertex_client import vertex_service

logger = logging.getLogger("meeting_agent")

class MeetingIntelligenceAgent:
    def perform_due_diligence(self, project_id: str, transcript_text: str) -> MeetingDueDiligenceResult:
        """
        AI mechanism to perform due diligence over meeting minutes.
        Identifies related JIRA tasks/bugs/stories, Git repos/files, and Confluence pages.
        Otherwise responds with 'Not linked to any GIT/JIRA/Confluence'.
        """
        from apps.api.src.core.provider_factory import provider_factory
        kp = provider_factory.get_knowledge_provider(project_id)
        sources = kp._gather_project_sources(project_id)

        project_name = sources.get("project_name", "Current Project")
        jira_items = sources.get("jira_items", [])
        git_repos = sources.get("git_repos", [])
        confluence_links = sources.get("confluence_links", [])

        # Format context for Gemini
        jira_summary_lines = []
        for it in jira_items[:30]:
            k = it.get("key", "N/A")
            t = it.get("title", "")
            itype = it.get("type", "TASK")
            st = it.get("status", "TODO")
            ass = it.get("assignee") or it.get("assignee_name") or "Unassigned"
            jira_summary_lines.append(f"- [{itype}] {k}: {t} (Status: {st}, Assignee: {ass})")
        jira_str = "\n".join(jira_summary_lines) if jira_summary_lines else "No active JIRA tickets found."

        git_summary_lines = []
        for gr in git_repos:
            rname = gr.get("name") or gr.get("repo_url", "repo")
            files_sample = ", ".join((gr.get("file_tree") or [])[:20])
            commits_sample = "; ".join([f"{c.get('sha', '')[:7]}: {c.get('message', '')}" for c in (gr.get("recent_commits") or [])[:5]])
            git_summary_lines.append(f"- Repo: {rname}\n  Key Files: {files_sample}\n  Recent Commits: {commits_sample}")
        git_str = "\n".join(git_summary_lines) if git_summary_lines else "No connected Git repositories."

        conf_summary_lines = []
        for cp in confluence_links:
            ctitle = cp.get("title", "")
            cspace = cp.get("space_key", "Docs")
            conf_summary_lines.append(f"- Confluence: {ctitle} (Space: {cspace})")
        conf_str = "\n".join(conf_summary_lines) if conf_summary_lines else "No connected Confluence pages."

        prompt = f"""You are the AI Scrum Master & Cross-Artifact Due Diligence Auditor.
Analyze the following Meeting Minutes for project "{project_name}".
Perform deep due diligence by comparing the meeting notes against the known Project JIRA tickets, Git codebase artifacts, and Confluence documentation.

Known Project JIRA Tickets:
{jira_str}

Known Project Git Artifacts & Repos:
{git_str}

Known Project Confluence Documentation:
{conf_str}

Meeting Minutes:
--------------------
{transcript_text}
--------------------

CRITICAL RULE & STRICT DUE DILIGENCE GUARDRAILS:
1. Examine if any sentence, task, feature, bug, blocker, or update in the meeting minutes explicitly or implicitly relates to any known JIRA ticket, Git file/commit/script, or Confluence page.
2. If the meeting minutes discuss general topics, off-topic conversations, personal plans, or unrelated external matters that do NOT relate to the project's JIRA, Git, or Confluence items, you MUST output:
   "is_linked": false,
   "relevance_status": "NOT_LINKED",
   "verdict_message": "Not linked to any GIT/JIRA/Confluence",
   "detailed_analysis": "Explanation of why no links were found.",
   "linked_jira_issues": [],
   "linked_git_artifacts": [],
   "linked_confluence_pages": []
3. If there ARE valid links, output:
   "is_linked": true,
   "relevance_status": "LINKED",
   "verdict_message": "Concise 1-sentence statement highlighting the primary links found (e.g. Linked to JIRA task HM-3 and Git package.json)",
   "detailed_analysis": "2-3 sentences explaining how the meeting minutes impact or relate to these artifacts",
   "linked_jira_issues": [
     {{
       "key": "Ticket Key, e.g. HM-3",
       "title": "Ticket title",
       "issue_type": "Story/Task/Bug",
       "status": "To Do/In Progress/Done",
       "assignee": "Name",
       "relationship": "Directly Discussed / Blocker / Acceptance Criteria Update",
       "relevance_reason": "Specific reason why this ticket was discussed",
       "confidence_score": 0.95
     }}
   ],
   "linked_git_artifacts": [
     {{
       "repo_name": "Repo name",
       "artifact_type": "FILE / WORKFLOW / SCRIPT / COMMIT",
       "path_or_identifier": "e.g. package.json or .github/workflows/deploy.yml",
       "relationship": "Impacted script or file",
       "relevance_reason": "Why this file was referenced in the meeting",
       "confidence_score": 0.92
     }}
   ],
   "linked_confluence_pages": [
     {{
       "title": "Page Title",
       "space_key": "HM",
       "relationship": "Referenced Specification",
       "relevance_reason": "Why this page relates to the discussion",
       "confidence_score": 0.90
     }}
   ]

Return strictly valid JSON matching this structure. Do NOT include markdown code blocks. Only raw JSON.
"""

        llm_response = vertex_service.generate_content(prompt)
        parsed_data = None
        try:
            cleaned = llm_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            parsed_data = json.loads(cleaned.strip())
        except Exception as e:
            logger.warning(f"Failed to parse Gemini due diligence JSON: {e}")

        # Deterministic Grounded Fallback if LLM parsing failed or is empty
        if not parsed_data or not isinstance(parsed_data, dict):
            parsed_data = self._deterministic_due_diligence(transcript_text, jira_items, git_repos, confluence_links)

        # Validate structure
        is_linked = bool(parsed_data.get("is_linked", False))
        verdict = parsed_data.get("verdict_message", "Not linked to any GIT/JIRA/Confluence")
        if not is_linked:
            verdict = "Not linked to any GIT/JIRA/Confluence"

        jira_links = []
        for j in parsed_data.get("linked_jira_issues", []):
            jira_links.append(LinkedJiraIssue(
                key=j.get("key", "N/A"),
                title=j.get("title", "Related Issue"),
                issue_type=j.get("issue_type", "Task"),
                status=j.get("status", "To Do"),
                assignee=j.get("assignee"),
                relationship=j.get("relationship", "Discussed in Meeting"),
                relevance_reason=j.get("relevance_reason", "Correlated with meeting minutes discussion"),
                confidence_score=float(j.get("confidence_score", 0.90)),
                url=j.get("url")
            ))

        git_links = []
        for g in parsed_data.get("linked_git_artifacts", []):
            git_links.append(LinkedGitArtifact(
                repo_name=g.get("repo_name", "Primary Repo"),
                artifact_type=g.get("artifact_type", "FILE"),
                path_or_identifier=g.get("path_or_identifier", ""),
                relationship=g.get("relationship", "Impacted Artifact"),
                relevance_reason=g.get("relevance_reason", "Referenced in meeting minutes"),
                confidence_score=float(g.get("confidence_score", 0.88))
            ))

        conf_links = []
        for c in parsed_data.get("linked_confluence_pages", []):
            conf_links.append(LinkedConfluencePage(
                page_id=c.get("page_id"),
                title=c.get("title", "Documentation Page"),
                space_key=c.get("space_key"),
                relationship=c.get("relationship", "Referenced Specification"),
                relevance_reason=c.get("relevance_reason", "Aligned with meeting decisions"),
                confidence_score=float(c.get("confidence_score", 0.88)),
                url=c.get("url")
            ))

        # Final check: if no entities were linked, ensure verdict is strictly Not linked
        if not jira_links and not git_links and not conf_links:
            is_linked = False
            verdict = "Not linked to any GIT/JIRA/Confluence"

        return MeetingDueDiligenceResult(
            is_linked=is_linked,
            relevance_status="LINKED" if is_linked else "NOT_LINKED",
            verdict_message=verdict,
            detailed_analysis=parsed_data.get("detailed_analysis", ""),
            linked_jira_issues=jira_links,
            linked_git_artifacts=git_links,
            linked_confluence_pages=conf_links,
            analyzed_at=datetime.utcnow()
        )

    def _deterministic_due_diligence(self, transcript: str, jira_items: List[Dict], git_repos: List[Dict], confluence_links: List[Dict]) -> Dict[str, Any]:
        """Grounded regex & keyword matcher when LLM is unavailable."""
        text_lower = transcript.lower()
        linked_jira = []
        linked_git = []
        linked_conf = []

        # Find Jira keys via regex
        found_keys = set(re.findall(r'\b[A-Z]{2,}-\d+\b', transcript))
        for item in jira_items:
            k = item.get("key")
            title = item.get("title", "").lower()
            if k in found_keys or (title and len(title) > 6 and title in text_lower):
                linked_jira.append({
                    "key": k,
                    "title": item.get("title", ""),
                    "issue_type": item.get("type", "Task"),
                    "status": item.get("status", "To Do"),
                    "assignee": item.get("assignee") or item.get("assignee_name"),
                    "relationship": "Direct Mention",
                    "relevance_reason": f"Ticket {k} was identified in meeting transcript",
                    "confidence_score": 0.95
                })

        # Find Git artifacts
        for repo in git_repos:
            rname = repo.get("name", "repo")
            for f in repo.get("file_tree", []):
                fname = f.split("/")[-1].lower()
                if len(fname) > 4 and fname in text_lower:
                    linked_git.append({
                        "repo_name": rname,
                        "artifact_type": "FILE",
                        "path_or_identifier": f,
                        "relationship": "Referenced Codebase File",
                        "relevance_reason": f"File {f} matches discussion keywords",
                        "confidence_score": 0.85
                    })
                    break

        # Find Confluence pages
        for cp in confluence_links:
            ctitle = cp.get("title", "")
            if ctitle and len(ctitle) > 5 and ctitle.lower() in text_lower:
                linked_conf.append({
                    "title": ctitle,
                    "space_key": cp.get("space_key", "Docs"),
                    "relationship": "Documentation Reference",
                    "relevance_reason": f"Confluence doc '{ctitle}' mentioned in minutes",
                    "confidence_score": 0.90
                })

        if linked_jira or linked_git or linked_conf:
            return {
                "is_linked": True,
                "relevance_status": "LINKED",
                "verdict_message": f"Linked to {len(linked_jira)} JIRA items, {len(linked_git)} Git files, and {len(linked_conf)} Confluence pages",
                "detailed_analysis": "Heuristic match detected references to project work items.",
                "linked_jira_issues": linked_jira,
                "linked_git_artifacts": linked_git,
                "linked_confluence_pages": linked_conf
            }
        else:
            return {
                "is_linked": False,
                "relevance_status": "NOT_LINKED",
                "verdict_message": "Not linked to any GIT/JIRA/Confluence",
                "detailed_analysis": "No references to known JIRA keys, Git codebase files, or Confluence docs were found in these minutes.",
                "linked_jira_issues": [],
                "linked_git_artifacts": [],
                "linked_confluence_pages": []
            }

    def process_transcript(
        self,
        project_id: str,
        meeting_type: Any,
        transcript_text: str,
        title: str = "Daily Scrum",
        entered_by: str = "Team Member",
        date: Optional[datetime] = None,
        meeting_id: Optional[str] = None
    ) -> MeetingExtractResponse:
        m_type_val = meeting_type.value if hasattr(meeting_type, "value") else str(meeting_type)
        m_type_enum = MeetingType(m_type_val) if m_type_val in [m.value for m in MeetingType] else MeetingType.STANDUP
        logger.info(f"Meeting Agent processing {m_type_val} for project {project_id}")
        
        meeting_id = meeting_id or f"meet-{uuid.uuid4().hex[:8]}"
        meeting_date = date or datetime.utcnow()

        # 1. Fetch project and active tasks from Firestore
        proj_doc = db.collection("projects").document(project_id).get()
        proj_data = proj_doc.to_dict() if proj_doc.exists else {}
        project_name = proj_data.get("name", "Active Project")

        task_docs = list(db.collection("tasks").where("project_id", "==", project_id).stream())
        known_tasks = [t.to_dict() for t in task_docs]
        task_list_str = "\n".join([f"- Key: {t.get('key')}, Title: {t.get('title')}, Assignee: {t.get('assignee_name')}, Current Status: {t.get('status')}" for t in known_tasks]) if known_tasks else "No active tasks in database yet."

        # 2. Extract decisions, blockers, actions via Gemini
        prompt = f"""You are the Meeting Intelligence Agent for an Agile Scrum team.
Analyze the following {m_type_val} meeting notes/transcript titled "{title}" for project "{project_name}".
Entered by: {entered_by} on {meeting_date.strftime('%Y-%m-%d %H:%M UTC')}.

Known Active Tasks:
{task_list_str}

Meeting Minutes:
--------------------
{transcript_text}
--------------------

Extract and output strictly valid JSON with this exact structure:
{{
  "summary": "Concise 1-2 sentence executive summary of what was discussed in this meeting",
  "decisions": [
    {{
      "decision_text": "Clear statement of the decision agreed upon",
      "speaker": "Name of speaker or Product Owner if mentioned, or null",
      "confidence_score": 0.95,
      "requires_approval": false,
      "governance_tier": "AUTO_EXECUTE"
    }}
  ],
  "blockers": [
    {{
      "task_key": "Task key or subject that is blocked",
      "assignee": "Engineer facing blocker",
      "blocker_description": "Specific impediment",
      "impact": "Impact on schedule",
      "confidence_score": 0.94
    }}
  ],
  "actions": [
    {{
      "action_type": "TASK_UPDATE",
      "target_entity": "Task key or subject",
      "description": "Specific action item",
      "assignee": "Responsible person",
      "confidence_score": 0.92,
      "governance_tier": "AUTO_EXECUTE"
    }}
  ]
}}
Only output raw JSON.
"""

        llm_response = vertex_service.generate_content(prompt)
        parsed_data = None

        try:
            cleaned = llm_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            parsed_data = json.loads(cleaned.strip())
        except Exception as e:
            logger.warning(f"Could not parse Gemini JSON response for meeting: {e}; falling back to heuristic")

        decisions: List[ExtractedDecision] = []
        blockers: List[ExtractedBlocker] = []
        actions: List[ExtractedAction] = []
        summary = ""

        if parsed_data and "summary" in parsed_data:
            summary = parsed_data.get("summary", f"{m_type_val} completed for {project_name}.")

            for d in parsed_data.get("decisions", []):
                decisions.append(ExtractedDecision(
                    id=f"dec-{uuid.uuid4().hex[:6]}",
                    decision_text=d.get("decision_text", "Agreed on meeting scope"),
                    speaker=d.get("speaker"),
                    confidence_score=float(d.get("confidence_score", 0.95)),
                    requires_approval=bool(d.get("requires_approval", False)),
                    governance_tier=GovernanceTier(d.get("governance_tier", "AUTO_EXECUTE")) if d.get("governance_tier") in [g.value for g in GovernanceTier] else GovernanceTier.AUTO_EXECUTE
                ))

            for b in parsed_data.get("blockers", []):
                blockers.append(ExtractedBlocker(
                    id=f"blk-{uuid.uuid4().hex[:6]}",
                    task_key=b.get("task_key", "IMPEDIMENT"),
                    assignee=b.get("assignee", "Team Member"),
                    blocker_description=b.get("blocker_description", "Blocked by dependency"),
                    impact=b.get("impact", "Delays current sprint item"),
                    confidence_score=float(b.get("confidence_score", 0.92))
                ))

            for a in parsed_data.get("actions", []):
                actions.append(ExtractedAction(
                    id=f"act-{uuid.uuid4().hex[:6]}",
                    action_type=a.get("action_type", "TASK_UPDATE"),
                    target_entity=a.get("target_entity", "TASK"),
                    description=a.get("description", "Execute meeting action item"),
                    assignee=a.get("assignee", "Developer"),
                    confidence_score=float(a.get("confidence_score", 0.90)),
                    governance_tier=GovernanceTier(a.get("governance_tier", "AUTO_EXECUTE")) if a.get("governance_tier") in [g.value for g in GovernanceTier] else GovernanceTier.AUTO_EXECUTE
                ))
        else:
            lines = [l.strip() for l in transcript_text.split("\n") if l.strip()]
            summary = f"{m_type_val} notes with {len(lines)} updates for {project_name}."
            for line in lines:
                line_lower = line.lower()
                if any(w in line_lower for w in ["blocked", "waiting", "delay", "stuck", "cannot", "can't", "impediment"]):
                    blockers.append(ExtractedBlocker(
                        id=f"blk-{uuid.uuid4().hex[:6]}",
                        task_key="IMPEDIMENT",
                        assignee=line.split(":")[0].strip() if ":" in line else "Team Member",
                        blocker_description=line,
                        impact="Requires team or external unblocking",
                        confidence_score=0.90
                    ))
                elif any(w in line_lower for w in ["decided", "decision", "agreed", "approved", "accepted", "resolved"]):
                    decisions.append(ExtractedDecision(
                        id=f"dec-{uuid.uuid4().hex[:6]}",
                        decision_text=line,
                        confidence_score=0.92,
                        requires_approval=False,
                        governance_tier=GovernanceTier.AUTO_EXECUTE
                    ))
                elif any(w in line_lower for w in ["action", "todo", "will", "today i", "going to", "finished", "completed", "requested", "request", "feature", "feedback"]):
                    actions.append(ExtractedAction(
                        id=f"act-{uuid.uuid4().hex[:6]}",
                        action_type="TASK_UPDATE",
                        target_entity="TASK",
                        description=line,
                        assignee=line.split(":")[0].strip() if ":" in line else "Developer",
                        confidence_score=0.88,
                        governance_tier=GovernanceTier.AUTO_EXECUTE
                    ))

        # 3. Autonomous State Mutations in Firestore
        for b in blockers:
            for t in known_tasks:
                t_key = t.get("key", "")
                t_title = t.get("title", "").lower()
                if (t_key and t_key.lower() in b.blocker_description.lower()) or (t_title and any(w in b.blocker_description.lower() for w in t_title.split()[:2])):
                    try:
                        db.collection("tasks").document(t.get("id")).update({
                            "status": "BLOCKED",
                            "is_blocked": True,
                            "blocker_reason": b.blocker_description
                        })
                        logger.info(f"Updated task {t_key} to BLOCKED in Firestore based on meeting transcript.")
                    except Exception as e:
                        logger.warning(f"Could not update task {t_key}: {e}")

        for a in actions:
            if any(w in a.description.lower() for w in ["done", "complete", "finished", "verified"]):
                for t in known_tasks:
                    t_key = t.get("key", "")
                    if t_key and t_key.lower() in a.description.lower():
                        try:
                            db.collection("tasks").document(t.get("id")).update({
                                "status": "DONE",
                                "is_blocked": False
                            })
                            logger.info(f"Updated task {t_key} to DONE in Firestore based on meeting transcript.")
                        except Exception as e:
                            logger.warning(f"Could not update task {t_key}: {e}")

        # 4. Run AI Due Diligence over the meeting minutes
        due_diligence = self.perform_due_diligence(project_id, transcript_text)

        # 5. Build response object
        response = MeetingExtractResponse(
            meeting_id=meeting_id,
            project_id=project_id,
            title=title,
            meeting_type=m_type_enum,
            transcript_text=transcript_text,
            entered_by=entered_by,
            date=meeting_date,
            created_at=datetime.utcnow(),
            decisions=decisions,
            blockers=blockers,
            actions=actions,
            summary=summary,
            due_diligence=due_diligence,
            is_linked=due_diligence.is_linked,
            verdict_message=due_diligence.verdict_message,
            extracted_at=datetime.utcnow()
        )

        # 6. Save to Firestore in 'meetings' collection
        db.collection("meetings").document(meeting_id).set(response.dict())

        # 6b. Log all Decisions and Action Items into 'actions_and_decisions' central collection
        try:
            for d in decisions:
                ad_id = f"dec-{uuid.uuid4().hex[:8]}"
                db.collection("actions_and_decisions").document(ad_id).set({
                    "id": ad_id,
                    "project_id": project_id,
                    "type": "DECISION",
                    "title": d.decision_text[:90] + ("..." if len(d.decision_text) > 90 else ""),
                    "description": d.decision_text,
                    "status": "APPROVED",
                    "meeting_id": meeting_id,
                    "meeting_title": title,
                    "meeting_date": meeting_date.isoformat(),
                    "meeting_type": m_type_val,
                    "decision_maker": d.speaker or entered_by or "Meeting Participants",
                    "assignee": None,
                    "due_date": None,
                    "created_at": meeting_date.isoformat(),
                    "created_by": entered_by or "Meeting Intelligence",
                    "updated_at": datetime.utcnow().isoformat(),
                    "notes": f"Extracted from {title} ({m_type_val})"
                })

            for a in actions:
                ad_id = f"act-{uuid.uuid4().hex[:8]}"
                db.collection("actions_and_decisions").document(ad_id).set({
                    "id": ad_id,
                    "project_id": project_id,
                    "type": "ACTION_ITEM",
                    "title": a.description[:90] + ("..." if len(a.description) > 90 else ""),
                    "description": a.description,
                    "status": "PENDING",
                    "meeting_id": meeting_id,
                    "meeting_title": title,
                    "meeting_date": meeting_date.isoformat(),
                    "meeting_type": m_type_val,
                    "decision_maker": None,
                    "assignee": a.assignee or "Unassigned",
                    "due_date": None,
                    "created_at": meeting_date.isoformat(),
                    "created_by": entered_by or "Meeting Intelligence",
                    "updated_at": datetime.utcnow().isoformat(),
                    "notes": f"Extracted from {title} ({m_type_val})"
                })
        except Exception as e:
            logger.warning(f"Could not log decisions and actions to actions_and_decisions: {e}")

        # 7. Index in 'knowledge_items' so AI Search Bot can immediately retrieve meeting insights
        try:
            decisions_str = "\n".join([f"- {d.decision_text}" for d in decisions]) if decisions else "None"
            blockers_str = "\n".join([f"- {b.blocker_description} (Impact: {b.impact})" for b in blockers]) if blockers else "None"
            actions_str = "\n".join([f"- {a.description} (Assignee: {a.assignee})" for a in actions]) if actions else "None"

            content = (
                f"MEETING TITLE: {title}\n"
                f"TYPE: {m_type_val}\n"
                f"DATE & TIME: {meeting_date.strftime('%Y-%m-%d %H:%M UTC')}\n"
                f"ENTERED BY: {entered_by}\n"
                f"RELEVANCE VERDICT: {due_diligence.verdict_message}\n\n"
                f"EXECUTIVE SUMMARY:\n{summary}\n\n"
                f"KEY DECISIONS:\n{decisions_str}\n\n"
                f"BLOCKERS / IMPEDIMENTS:\n{blockers_str}\n\n"
                f"ACTION ITEMS:\n{actions_str}\n\n"
                f"RAW MEETING MINUTES:\n{transcript_text}"
            )
            k_id = f"know-meet-{meeting_id}"
            db.collection("knowledge_items").document(k_id).set({
                "id": k_id,
                "project_id": project_id,
                "title": f"[{m_type_val}] {title} - {meeting_date.strftime('%Y-%m-%d %H:%M')}",
                "content": content,
                "source_type": "MEETING_DECISION",
                "source_uri": f"/meetings/{meeting_id}",
                "created_at": datetime.utcnow()
            })
        except Exception as e:
            logger.warning(f"Could not index meeting into knowledge_items: {e}")

        return response

    def analyze_existing_meeting(self, meeting_id: str) -> MeetingDueDiligenceResult:
        """Runs on-demand AI due diligence for an existing meeting minutes record."""
        doc = db.collection("meetings").document(meeting_id).get()
        if not doc.exists:
            raise ValueError(f"Meeting {meeting_id} not found")
        data = doc.to_dict()
        project_id = data.get("project_id")
        transcript = data.get("transcript_text") or data.get("transcript") or ""

        due_diligence = self.perform_due_diligence(project_id, transcript)

        # Update in DB
        db.collection("meetings").document(meeting_id).update({
            "due_diligence": due_diligence.dict(),
            "is_linked": due_diligence.is_linked,
            "verdict_message": due_diligence.verdict_message
        })

        return due_diligence

meeting_agent = MeetingIntelligenceAgent()
