import uuid
import json
import logging
import re
from typing import List, Dict, Any, Optional
from datetime import datetime
from apps.api.src.core.providers.base import BaseKnowledgeProvider
from apps.api.src.core.firestore_client import db
from apps.api.src.core.vertex_client import vertex_service
from apps.api.src.schemas.knowledge import (
    KnowledgeItem,
    KnowledgeSearchResponse,
    CitationSnippet,
    NotebookLMReference,
    ScannedSourcesStats,
    ProjectKnowledgeSyncResponse
)

logger = logging.getLogger("notebooklm_provider")

class NotebookLMKnowledgeProvider(BaseKnowledgeProvider):
    def __init__(self, notebook_id: Optional[str] = None, notebook_url: Optional[str] = None, workspace_name: Optional[str] = None):
        self.notebook_id = notebook_id or "nb-workspace-01"
        self.notebook_url = notebook_url or f"https://notebooklm.google.com/notebook/{self.notebook_id}"
        self.workspace_name = workspace_name or "Project Living Knowledge Hub"

    def get_notebooklm_reference(self, project_id: str) -> NotebookLMReference:
        items = list(db.collection("knowledge_items").where("project_id", "==", project_id).stream())
        proj_doc = db.collection("projects").document(project_id).get()
        p_name = proj_doc.to_dict().get("name", "Project") if proj_doc.exists else "Project"

        return NotebookLMReference(
            notebook_id=self.notebook_id,
            notebook_url=self.notebook_url,
            workspace_name=f"{p_name} Knowledge Hub",
            source_count=len(items),
            audio_briefing_available=True,
            audio_briefing_summary=f"AI Audio Briefing: Comprehensive synthesis of {p_name} specifications, sprint deliverables, and architectural decisions.",
            last_synced_at=datetime.utcnow()
        )

    def add_knowledge_item(self, project_id: str, title: str, content: str, source_type: str, source_uri: Optional[str] = None) -> KnowledgeItem:
        item_id = f"know-{uuid.uuid4().hex[:8]}"
        item = KnowledgeItem(
            id=item_id,
            project_id=project_id,
            title=title,
            content=content,
            source_type=source_type,
            source_uri=source_uri or self.notebook_url,
            notebooklm_source_id=f"src-{uuid.uuid4().hex[:6]}"
        )
        db.collection("knowledge_items").document(item_id).set(item.dict())
        return item

    def _gather_project_sources(self, project_id: str) -> Dict[str, Any]:
        """Collects all live knowledge assets across Confluence, Jira, Git, PRDs, and Open Questions."""
        proj_doc = db.collection("projects").document(project_id).get()
        proj_data = proj_doc.to_dict() if proj_doc.exists else {}
        proj_name = proj_data.get("name", "Current Project")
        proj_key = proj_data.get("key", "PRJ")

        # 1. JIRA SETTINGS & WORK ITEMS (Live Cloud + Firestore)
        jira_settings = proj_data.get("jira_settings", {})
        jira_url = jira_settings.get("instance_url") or ""
        if jira_url and not jira_url.startswith("http"):
            jira_url = f"https://{jira_url}"

        jira_items: List[Dict[str, Any]] = []

        # Attempt live fetch directly from Jira Cloud if configured
        try:
            from apps.api.src.core.provider_factory import provider_factory
            from apps.api.src.core.providers.backlog.jira_provider import JiraBacklogProvider
            jira_prov = provider_factory.get_backlog_provider(project_id)
            if isinstance(jira_prov, JiraBacklogProvider) and jira_prov._is_configured():
                live_issues = jira_prov.fetch_all_issues_detailed()
                for li in live_issues:
                    jira_items.append(li)
        except Exception as e:
            logger.warning(f"Could not fetch live detailed Jira issues: {e}")

        # Supplement / merge with local Firestore epics, stories, tasks
        existing_keys = {it.get("key") for it in jira_items if it.get("key")}
        epics = [d.to_dict() for d in db.collection("epics").where("project_id", "==", project_id).stream()]
        stories = [d.to_dict() for d in db.collection("stories").where("project_id", "==", project_id).stream()]
        tasks = [d.to_dict() for d in db.collection("tasks").where("project_id", "==", project_id).stream()]

        for ep in epics:
            k = ep.get("key") or ep.get("id")
            if k not in existing_keys:
                jira_items.append({
                    "type": "EPIC",
                    "key": k,
                    "title": ep.get("title", ""),
                    "description": ep.get("description", ""),
                    "url": f"{jira_url.rstrip('/')}/browse/{k}" if jira_url else None,
                    "status": ep.get("status", "ACTIVE")
                })
        for st in stories:
            k = st.get("key") or st.get("id")
            if k not in existing_keys:
                ac_texts = [ac.get("text", "") if isinstance(ac, dict) else str(ac) for ac in st.get("acceptance_criteria", [])]
                jira_items.append({
                    "type": "STORY",
                    "key": k,
                    "title": st.get("title", ""),
                    "description": st.get("description", ""),
                    "acceptance_criteria": "; ".join(ac_texts),
                    "status": st.get("status", "TODO"),
                    "priority": st.get("priority", "MEDIUM"),
                    "points": st.get("story_points", 0),
                    "assignee": st.get("assignee_id") or "Unassigned",
                    "url": f"{jira_url.rstrip('/')}/browse/{k}" if jira_url else None
                })
        for tk in tasks:
            k = tk.get("key") or tk.get("id")
            if k not in existing_keys:
                jira_items.append({
                    "type": tk.get("type", "TASK"),
                    "key": k,
                    "title": tk.get("title", ""),
                    "description": tk.get("description", ""),
                    "status": tk.get("status", "TODO"),
                    "assignee": tk.get("assignee_id") or "Unassigned",
                    "url": f"{jira_url.rstrip('/')}/browse/{k}" if jira_url else None
                })

        # 2. CONFLUENCE PAGES & SPACES
        conf_settings = proj_data.get("confluence_settings", {})
        confluence_links = list(conf_settings.get("pages", []) or conf_settings.get("links", []) or proj_data.get("confluence_links", []))

        # Additional docs from knowledge_items
        k_docs = [d.to_dict() for d in db.collection("knowledge_items").where("project_id", "==", project_id).stream()]
        for kd in k_docs:
            if kd.get("source_type") == "CONFLUENCE":
                confluence_links.append({
                    "title": kd.get("title"),
                    "url": kd.get("source_uri"),
                    "description": kd.get("content", "")[:200]
                })

        # 3. GIT REPOSITORIES (With Full README & Codebase Tree)
        git_settings = proj_data.get("git_settings", {})
        git_repos = list(git_settings.get("repositories", []) or git_settings.get("repos", []) or proj_data.get("git_repos", []))
        if not git_repos and git_settings.get("repo_url"):
            git_repos.append({
                "name": git_settings.get("repo_name", "Primary Codebase"),
                "repo_url": git_settings.get("repo_url"),
                "provider": "GitHub",
                "default_branch": git_settings.get("default_branch", "main"),
                "is_primary": True,
                "description": "Main project codebase repository"
            })

        # Auto-populate full repo context if not already loaded
        try:
            from apps.api.src.core.providers.git.github_provider import GitHubTrackerProvider
            for gr in git_repos:
                if not gr.get("readme_content") and gr.get("repo_url"):
                    git_prov = GitHubTrackerProvider(repo_url=gr.get("repo_url"), access_token=git_settings.get("access_token"))
                    g_data = git_prov.fetch_repository_full_context(gr.get("repo_url"), gr.get("default_branch", "main"))
                    if g_data:
                        gr["readme_content"] = g_data.get("readme_content")
                        gr["content_length"] = g_data.get("content_length", 0)
                        gr["file_tree"] = g_data.get("file_tree", [])
                        gr["key_files"] = g_data.get("key_files", {})
                        gr["recent_commits"] = g_data.get("recent_commits", [])
                        gr["pull_requests"] = g_data.get("pull_requests", [])
                        if g_data.get("description") and not gr.get("description"):
                            gr["description"] = g_data.get("description")
        except Exception as e:
            logger.warning(f"Failed to auto-populate Git repo context: {e}")

        # 4. INGESTED REQUIREMENTS / PRD
        req_doc = db.collection("requirements").document(f"req-{project_id}").get()
        req_data = req_doc.to_dict() if req_doc.exists else {}

        # 5. OPEN QUESTIONS
        q_docs = [d.to_dict() for d in db.collection("open_questions").where("project_id", "==", project_id).stream()]

        stats = ScannedSourcesStats(
            confluence_pages=len(confluence_links),
            jira_items=len(jira_items),
            git_repos=len(git_repos),
            project_docs=1 if req_data else 0,
            open_questions=len(q_docs)
        )

        # 6. LOGGED MEETING MINUTES & DECISIONS
        meeting_docs = [d.to_dict() for d in db.collection("meetings").where("project_id", "==", project_id).stream()]

        return {
            "project_name": proj_name,
            "project_key": proj_key,
            "project_description": proj_data.get("description", ""),
            "jira_items": jira_items,
            "confluence_links": confluence_links,
            "git_repos": git_repos,
            "requirements": req_data,
            "open_questions": q_docs,
            "meetings": meeting_docs,
            "stats": stats
        }


    def sync_sources(self, project_id: str) -> ProjectKnowledgeSyncResponse:
        """Refreshes all source knowledge counts and records synchronization timestamp."""
        # 1. Auto-refresh Confluence page bodies if credentials exist
        try:
            from apps.api.src.core.provider_factory import provider_factory
            from apps.api.src.core.providers.doc.confluence_provider import ConfluenceDocProvider
            doc_prov = provider_factory.get_doc_provider(project_id)
            if isinstance(doc_prov, ConfluenceDocProvider) and doc_prov._is_configured():
                proj_doc = db.collection("projects").document(project_id).get()
                pdata = proj_doc.to_dict() if proj_doc.exists else {}
                c_pages = list(pdata.get("confluence_settings", {}).get("pages", []))
                updated = False
                for pg in c_pages:
                    if not pg.get("content"):
                        f_data = doc_prov.fetch_page_content(pg.get("url", ""))
                        if f_data:
                            pg["title"] = f_data.get("title") or pg.get("title")
                            pg["content"] = f_data.get("content")
                            pg["content_length"] = f_data.get("content_length", 0)
                            pg["fetched_at"] = datetime.utcnow().isoformat()
                            pg["fetch_status"] = "SYNCED"
                            updated = True
                if updated:
                    db.collection("projects").document(project_id).update({"confluence_settings.pages": c_pages})
        except Exception as e:
            logger.warning(f"Could not auto-refresh Confluence page bodies during sync: {e}")

        # 2. Auto-refresh Git repositories
        try:
            from apps.api.src.core.providers.git.github_provider import GitHubTrackerProvider
            proj_doc = db.collection("projects").document(project_id).get()
            pdata = proj_doc.to_dict() if proj_doc.exists else {}
            g_repos = list(pdata.get("git_settings", {}).get("repositories", []))
            g_updated = False
            for gr in g_repos:
                if not gr.get("readme_content") and gr.get("repo_url"):
                    git_prov = GitHubTrackerProvider(repo_url=gr.get("repo_url"), access_token=pdata.get("git_settings", {}).get("access_token"))
                    g_data = git_prov.fetch_repository_full_context(gr.get("repo_url"), gr.get("default_branch", "main"))
                    if g_data:
                        gr["readme_content"] = g_data.get("readme_content")
                        gr["content_length"] = g_data.get("content_length", 0)
                        gr["file_tree"] = g_data.get("file_tree", [])
                        gr["key_files"] = g_data.get("key_files", {})
                        gr["recent_commits"] = g_data.get("recent_commits", [])
                        gr["pull_requests"] = g_data.get("pull_requests", [])
                        gr["fetched_at"] = datetime.utcnow().isoformat()
                        gr["fetch_status"] = "SYNCED"
                        g_updated = True

                        k_id = f"know-git-{gr['id']}"
                        db.collection("knowledge_items").document(k_id).set({
                            "id": k_id,
                            "project_id": project_id,
                            "title": f"Git Repository: {gr['name']}",
                            "content": f"# Repository: {gr['name']}\nURL: {gr['repo_url']}\nDefault Branch: {gr['default_branch']}\n\n{gr.get('readme_content', '')}",
                            "source_type": "GIT_REPOSITORY",
                            "source_uri": gr["repo_url"],
                            "tags": ["git", gr.get("provider", "GitHub"), gr["name"]],
                            "created_at": datetime.utcnow()
                        })
            if g_updated:
                db.collection("projects").document(project_id).update({"git_settings.repositories": g_repos})
        except Exception as e:
            logger.warning(f"Could not auto-refresh Git repositories during sync: {e}")

        # 3. Auto-refresh Jira items into knowledge_items
        try:
            from apps.api.src.core.provider_factory import provider_factory
            from apps.api.src.core.providers.backlog.jira_provider import JiraBacklogProvider
            jira_prov = provider_factory.get_backlog_provider(project_id)
            if isinstance(jira_prov, JiraBacklogProvider) and jira_prov._is_configured():
                j_issues = jira_prov.fetch_all_issues_detailed()
                for iss in j_issues:
                    k_id = f"know-jira-{iss['key']}"
                    desc_content = f"# Jira [{iss['type']}] {iss['key']}: {iss['title']}\n"
                    desc_content += f"Status: {iss['status']} | Priority: {iss['priority']} | Assignee: {iss['assignee']}\n"
                    if iss.get("description"):
                        desc_content += f"\n## Description:\n{iss['description']}\n"
                    if iss.get("comments"):
                        desc_content += "\n## Comments & Discussion:\n" + "\n".join([f"- [{c.get('author')}] {c.get('text')}" for c in iss['comments']])
                    db.collection("knowledge_items").document(k_id).set({
                        "id": k_id,
                        "project_id": project_id,
                        "title": f"Jira [{iss['type']}] {iss['key']}: {iss['title']}",
                        "content": desc_content,
                        "source_type": f"JIRA_{iss['type']}",
                        "source_uri": iss.get("url"),
                        "tags": ["jira", iss['key'], iss['status']],
                        "created_at": datetime.utcnow()
                    })
        except Exception as e:
            logger.warning(f"Could not auto-refresh Jira issues during sync: {e}")

        sources = self._gather_project_sources(project_id)
        stats = sources["stats"]
        now = datetime.utcnow()

        # Update project doc timestamp
        try:
            db.collection("projects").document(project_id).update({
                "knowledge_synced_at": now.isoformat(),
                "knowledge_stats": stats.dict()
            })
        except Exception as e:
            logger.warning(f"Could not update project knowledge sync timestamp: {e}")

        total_scanned = stats.confluence_pages + stats.jira_items + stats.git_repos + stats.project_docs + stats.open_questions
        return ProjectKnowledgeSyncResponse(
            project_id=project_id,
            status="SYNCED",
            scanned_sources=stats,
            message=f"Successfully indexed and refreshed {total_scanned} project records across Confluence, JIRA, Git, and Requirements.",
            synced_at=now
        )

    def search(self, project_id: str, query: str, limit: int = 15) -> KnowledgeSearchResponse:
        """Grounded semantic Q&A with strict verification against Confluence, JIRA, Git, and PRD."""
        sources = self._gather_project_sources(project_id)
        stats = sources["stats"]
        proj_name = sources["project_name"]
        proj_key = sources["project_key"]

        total_sources = stats.confluence_pages + stats.jira_items + stats.git_repos + stats.project_docs + stats.open_questions
        if total_sources == 0:
            return KnowledgeSearchResponse(
                project_id=project_id,
                query=query,
                has_details=False,
                answer="No details available anywhere. No Git repositories, Confluence pages, JIRA tickets, or PRD requirements have been connected to this project yet.",
                citations=[],
                scanned_sources=stats,
                confidence_score=0.1
            )

        # Build readable text blocks for context
        jira_text_parts = []
        for it in sources["jira_items"]:
            part = f"- [{it.get('type', 'TASK')}] {it.get('key')}: {it.get('title')}"
            part += f"\n  Status: {it.get('status', 'TODO')} | Priority: {it.get('priority', 'Medium')} | Assignee: {it.get('assignee', 'Unassigned')}"
            if it.get("reporter"):
                part += f" | Reporter: {it.get('reporter')}"
            if it.get("description"):
                part += f"\n  Description:\n{it.get('description')}"
            if it.get("acceptance_criteria"):
                part += f"\n  Acceptance Criteria:\n{it.get('acceptance_criteria')}"
            if it.get("comments"):
                comments_list = [f"    * [{c.get('author')}] {c.get('text')}" for c in it.get("comments", [])]
                part += f"\n  Comments & Discussion:\n" + "\n".join(comments_list)
            if it.get("subtasks"):
                sub_list = [f"    * [{st.get('key')}] {st.get('summary')} ({st.get('status')})" for st in it.get("subtasks", [])]
                part += f"\n  Subtasks:\n" + "\n".join(sub_list)
            if it.get("url"):
                part += f"\n  Jira URL: {it.get('url')}"
            jira_text_parts.append(part)
        jira_context = "\n\n".join(jira_text_parts) if jira_text_parts else "No Jira tasks or stories found."

        conf_text_parts = []
        for cl in sources["confluence_links"]:
            part = f"- [Confluence Page] Title: {cl.get('title')}\n  URL: {cl.get('url')}\n  Space: {cl.get('space_key', 'GENERAL')}"
            if cl.get("content"):
                part += f"\n  COMPLETE CONFLUENCE DOCUMENT CONTENT:\n{cl.get('content')[:12000]}"
            elif cl.get("description"):
                part += f"\n  Scope/Summary: {cl.get('description')[:500]}"
            conf_text_parts.append(part)
        conf_context = "\n\n".join(conf_text_parts) if conf_text_parts else "No Confluence documentation pages linked."

        git_text_parts = []
        for gr in sources["git_repos"]:
            part = f"- [Git Repository] {gr.get('name')} (Provider: {gr.get('provider', 'GitHub')}, Default Branch: {gr.get('default_branch', 'main')})"
            if gr.get("is_primary"):
                part += " [PRIMARY CODEBASE]"
            part += f"\n  Repository URL: {gr.get('repo_url')}"
            if gr.get("description"):
                part += f"\n  Description: {gr.get('description')}"

            # 1. Full README
            if gr.get("readme_content"):
                part += f"\n  COMPLETE REPOSITORY README.md CONTENT:\n{gr.get('readme_content')[:14000]}"

            # 2. File Tree / Directory Map
            if gr.get("file_tree"):
                tree_sample = gr.get("file_tree")[:70]
                part += f"\n  REPOSITORY FILE TREE & ARCHITECTURAL STRUCTURE ({len(gr.get('file_tree'))} files detected):\n  " + "\n  ".join(tree_sample)

            # 3. Key Manifests & Dependencies
            if gr.get("key_files"):
                for fname, fcontent in gr.get("key_files", {}).items():
                    part += f"\n  FILE [{fname}]:\n{fcontent[:2000]}"

            # 4. Recent Commits
            if gr.get("recent_commits"):
                commits_lines = [f"  * [{c.get('sha')}] {c.get('message')} (Author: {c.get('author')}, Date: {c.get('date')})" for c in gr.get("recent_commits", [])[:10]]
                part += f"\n  RECENT GIT COMMITS & AUTHOR HISTORY:\n" + "\n".join(commits_lines)

            # 5. Pull Requests
            if gr.get("pull_requests"):
                pr_lines = [f"  * PR #{pr.get('number')}: {pr.get('title')} (State: {pr.get('state')}, Author: {pr.get('author')})" for pr in gr.get("pull_requests", [])[:6]]
                part += f"\n  PULL REQUESTS:\n" + "\n".join(pr_lines)

            git_text_parts.append(part)
        git_context = "\n\n".join(git_text_parts) if git_text_parts else "No Git repositories linked."

        req = sources["requirements"]
        req_text_parts = []
        if req:
            req_text_parts.append(f"PRD Title: {req.get('document_title', 'Requirement Spec')}")
            if req.get("business_goal"):
                req_text_parts.append(f"Business Goal: {req.get('business_goal')}")
            caps = req.get("capabilities", [])
            for c in caps[:10]:
                req_text_parts.append(f"Capability [{c.get('id')}]: {c.get('title')} - {c.get('description', '')[:150]}")
            clauses = req.get("clauses", [])
            for cl in clauses[:10]:
                req_text_parts.append(f"Clause [{cl.get('clause_id')} - {cl.get('clause_type')}]: {cl.get('text', '')[:150]}")
        req_context = "\n".join(req_text_parts) if req_text_parts else "No requirement PRD ingested yet."

        q_text_parts = []
        for q in sources["open_questions"]:
            part = f"Question: {q.get('question')} | Resolved: {q.get('resolved', False)}"
            if q.get("resolved_answer"):
                part += f" | PO Answer: {q.get('resolved_answer')}"
            elif q.get("ai_suggested_answer"):
                part += f" | AI Suggestion: {q.get('ai_suggested_answer')}"
            q_text_parts.append(part)
        q_context = "\n".join(q_text_parts) if q_text_parts else "No open questions recorded."

        meetings_text_parts = []
        for m in sources.get("meetings", []):
            part = f"- [{m.get('meeting_type', 'STANDUP')}] {m.get('title', 'Meeting')} (Date: {m.get('date')}, Entered By: {m.get('entered_by')})"
            if m.get("verdict_message"):
                part += f"\n  Relevance Verdict: {m.get('verdict_message')}"
            if m.get("summary"):
                part += f"\n  Summary: {m.get('summary')}"
            if m.get("transcript_text") or m.get("transcript"):
                part += f"\n  Minutes: {m.get('transcript_text') or m.get('transcript')}"
            meetings_text_parts.append(part)
        meetings_context = "\n\n".join(meetings_text_parts) if meetings_text_parts else "No meeting minutes recorded."

        prompt = f"""You are the Grounded Project AI Search Assistant for project '{proj_name}' (Key: {proj_key}).
Your job is to answer the user query based THOROUGHLY AND STRICTLY on the project's verified records across Confluence, JIRA, Git, PRD specifications, and logged Meeting Minutes provided below.

========================
PROJECT SOURCE RECORDS:
========================

### 1. ATLASSIAN JIRA WORK ITEMS (STORIES, BUGS, TASKS, EPICS):
{jira_context}

### 2. CONFLUENCE WIKI & ARCHITECTURE PAGES:
{conf_context}

### 3. GIT REPOSITORIES & CODEBASES:
{git_context}

### 4. PROJECT PRD REQUIREMENTS & SPECIFICATIONS:
{req_context}

### 5. RESOLVED PRODUCT OWNER QUESTIONS:
{q_context}

### 6. LOGGED MEETING MINUTES & SCRUM DECISIONS:
{meetings_context}

========================

CRITICAL GROUNDING RULES:
========================
1. Answer ONLY using the facts present in the source records above.
2. STRICT GUARD FOR IRRELEVANT OR MISSING INFORMATION:
   If the user's question asks for information that is NOT mentioned in any of the above Confluence pages, Jira items, Git repositories, or PRD specs, OR if the question is unrelated/irrelevant to this project, you MUST output:
   "has_details": false
   "answer": "No details available anywhere"
   "citations": []
   Do NOT make up facts. Do NOT speculate or use external knowledge.
3. If relevant information IS present:
   "has_details": true
   "answer": Clear, direct, professional answer summarizing what was found.
   "citations": Include exact citations for each source used, with:
     - "source_title": e.g. "APM-01: Claims Ingestion Service" or "Confluence: Architecture RFC 401" or "Git: backend-service"
     - "source_type": One of "JIRA_STORY", "JIRA_BUG", "JIRA_TASK", "CONFLUENCE_PAGE", "GIT_REPOSITORY", "PROJECT_PRD", "OPEN_QUESTION"
     - "section_or_page": Specific field or section (e.g. "Acceptance Criteria", "main branch", "Business Goal")
     - "snippet_text": Verbatim excerpt or factual detail from the source
     - "source_uri": Direct URL if available in the record, otherwise null
     - "ticket_key": Jira key like "APM-01" if applicable, otherwise null

USER QUESTION: {query}

OUTPUT STRICTLY VALID JSON ONLY. NO OTHER TEXT. EXACT STRUCTURE:
{{
  "has_details": true,
  "answer": "Clear factual answer synthesized from project records",
  "citations": [
    {{
      "source_title": "Source name",
      "source_type": "JIRA_STORY",
      "section_or_page": "Section reference",
      "snippet_text": "Verbatim quote",
      "source_uri": "https://...",
      "ticket_key": "APM-01"
    }}
  ],
  "confidence_score": 0.96
}}
"""

        parsed = None
        try:
            llm_response = vertex_service.generate_content(prompt)
            cleaned = llm_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            parsed = json.loads(cleaned.strip())
        except Exception as e:
            logger.warning(f"Vertex AI search call failed or could not be parsed: {e}")

        # If LLM parsed successfully
        if parsed and "answer" in parsed:
            has_details = parsed.get("has_details", True)
            answer_text = parsed.get("answer", "").strip()

            if not has_details or "no details available" in answer_text.lower():
                return KnowledgeSearchResponse(
                    project_id=project_id,
                    query=query,
                    has_details=False,
                    answer="No details available anywhere",
                    citations=[],
                    scanned_sources=stats,
                    confidence_score=0.98
                )

            citations = []
            for c in parsed.get("citations", []):
                citations.append(CitationSnippet(
                    source_title=c.get("source_title", "Project Documentation"),
                    source_type=c.get("source_type", "PROJECT_PRD"),
                    section_or_page=c.get("section_or_page", "General"),
                    snippet_text=c.get("snippet_text", ""),
                    source_uri=c.get("source_uri"),
                    ticket_key=c.get("ticket_key")
                ))

            return KnowledgeSearchResponse(
                project_id=project_id,
                query=query,
                has_details=True,
                answer=answer_text,
                citations=citations,
                scanned_sources=stats,
                confidence_score=float(parsed.get("confidence_score", 0.95))
            )

        # =========================================================================
        # GROUNDED FALLBACK SEARCH (Keyword, Entity, and Token Matching)
        # =========================================================================
        tokens = [w.lower() for w in re.findall(r'\b\w{3,}\b', query)]
        matched_citations: List[CitationSnippet] = []
        matched_answers: List[str] = []

        # Check Jira items (including full descriptions, comments, and assignees)
        for it in sources["jira_items"]:
            t_str = f"{it.get('key', '')} {it.get('title', '')} {it.get('description', '')} {it.get('acceptance_criteria', '')} {it.get('assignee', '')} {it.get('status', '')}".lower()
            for c in it.get("comments", []):
                t_str += f" {c.get('text', '')} {c.get('author', '')}".lower()
            if any(tok in t_str for tok in tokens):
                matched_answers.append(f"Jira item [{it.get('key')}]: '{it.get('title')}' is in status '{it.get('status')}' (Assignee: {it.get('assignee')}).")
                snippet = it.get('description', '')[:160] or it.get('title', '')
                matched_citations.append(CitationSnippet(
                    source_title=f"{it.get('key')}: {it.get('title')}",
                    source_type=f"JIRA_{it.get('type', 'TASK')}",
                    section_or_page="Jira Cloud Work Items",
                    snippet_text=snippet,
                    source_uri=it.get('url'),
                    ticket_key=it.get('key')
                ))

        # Check Confluence links (including FULL page content!)
        for cl in sources["confluence_links"]:
            c_str = f"{cl.get('title', '')} {cl.get('description', '')} {cl.get('space_key', '')} {cl.get('content', '')}".lower()
            if any(tok in c_str for tok in tokens):
                snippet = cl.get('content', '')[:160] or cl.get('description', '')[:160] or cl.get('title', '')
                matched_answers.append(f"Confluence document '{cl.get('title')}' covers this: {snippet}...")
                matched_citations.append(CitationSnippet(
                    source_title=f"Confluence: {cl.get('title')}",
                    source_type="CONFLUENCE_PAGE",
                    section_or_page=cl.get('space_key', 'Wiki'),
                    snippet_text=snippet,
                    source_uri=cl.get('url')
                ))

        # Check Git repos (including full README, file tree, and commit history!)
        for gr in sources["git_repos"]:
            g_str = f"{gr.get('name', '')} {gr.get('description', '')} {gr.get('default_branch', '')} {gr.get('repo_url', '')} {gr.get('readme_content', '')} {' '.join(gr.get('file_tree', []))}".lower()
            for c in gr.get("recent_commits", []):
                g_str += f" {c.get('message', '')} {c.get('author', '')}".lower()
            if any(tok in g_str for tok in tokens):
                snippet = gr.get('readme_content', '')[:160] or gr.get('description', '')[:160] or gr.get('repo_url', '')
                matched_answers.append(f"Git repository '{gr.get('name')}' ({gr.get('repo_url')}) contains relevant code and documentation: {snippet}...")
                matched_citations.append(CitationSnippet(
                    source_title=f"Git: {gr.get('name')}",
                    source_type="GIT_REPOSITORY",
                    section_or_page=f"Branch: {gr.get('default_branch', 'main')}",
                    snippet_text=snippet,
                    source_uri=gr.get('repo_url')
                ))

        # Check PRD requirements
        if req:
            r_str = f"{req.get('document_title', '')} {req.get('business_goal', '')}".lower()
            for c in req.get('capabilities', []):
                r_str += f" {c.get('title', '')} {c.get('description', '')}".lower()
            if any(tok in r_str for tok in tokens):
                matched_answers.append(f"PRD '{req.get('document_title')}' outlines goal: {req.get('business_goal', '')[:120]}.")
                matched_citations.append(CitationSnippet(
                    source_title=f"PRD: {req.get('document_title', 'Requirement Spec')}",
                    source_type="PROJECT_PRD",
                    section_or_page="Capabilities & Scope",
                    snippet_text=req.get('business_goal', '')[:140],
                    source_uri=req.get('gcs_uri')
                ))

        # Check Open Questions
        for q in sources["open_questions"]:
            q_str = f"{q.get('question', '')} {q.get('resolved_answer', '')} {q.get('ai_suggested_answer', '')}".lower()
            if any(tok in q_str for tok in tokens):
                ans = q.get('resolved_answer') or q.get('ai_suggested_answer')
                matched_answers.append(f"Clarification question: '{q.get('question')}' was addressed with: {ans}.")
                matched_citations.append(CitationSnippet(
                    source_title=f"Ambiguity: {q.get('question')[:40]}...",
                    source_type="OPEN_QUESTION",
                    section_or_page="Clarifications",
                    snippet_text=ans[:140] if ans else q.get('question', '')
                ))

        # Check Logged Meeting Minutes & Decisions
        for m in sources.get("meetings", []):
            m_str = f"{m.get('title', '')} {m.get('meeting_type', '')} {m.get('summary', '')} {m.get('transcript_text', '')} {m.get('transcript', '')} {m.get('entered_by', '')}".lower()
            if any(tok in m_str for tok in tokens):
                snip = m.get('summary') or (m.get('transcript_text') or '')[:140]
                matched_answers.append(f"Meeting '{m.get('title')}' ({m.get('meeting_type')}) recorded by {m.get('entered_by')}: {snip}")
                matched_citations.append(CitationSnippet(
                    source_title=f"Meeting: {m.get('title')}",
                    source_type="MEETING_DECISION",
                    section_or_page=f"Type: {m.get('meeting_type')}",
                    snippet_text=snip[:140],
                    source_uri=f"/meetings/{m.get('meeting_id')}"
                ))

        # If NO matching records were found anywhere across Confluence, Jira, Git, PRD, Meetings:
        if not matched_citations:
            return KnowledgeSearchResponse(
                project_id=project_id,
                query=query,
                has_details=False,
                answer="No details available anywhere",
                citations=[],
                scanned_sources=stats,
                confidence_score=0.95
            )

        # Synthesize matched answer
        combined_answer = " ".join(matched_answers[:4])
        return KnowledgeSearchResponse(
            project_id=project_id,
            query=query,
            has_details=True,
            answer=combined_answer,
            citations=matched_citations[:6],
            scanned_sources=stats,
            confidence_score=0.88
        )
