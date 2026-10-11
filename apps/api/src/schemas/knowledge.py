from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class NotebookLMReference(BaseModel):
    notebook_id: str
    notebook_url: str
    workspace_name: str
    source_count: int = 0
    audio_briefing_available: bool = True
    audio_briefing_summary: Optional[str] = None
    last_synced_at: Optional[datetime] = None

class CitationSnippet(BaseModel):
    source_title: str
    source_type: str # JIRA_STORY, JIRA_BUG, JIRA_TASK, CONFLUENCE_PAGE, GIT_REPOSITORY, PROJECT_PRD, OPEN_QUESTION
    section_or_page: str
    snippet_text: str
    source_uri: Optional[str] = None
    ticket_key: Optional[str] = None

class ScannedSourcesStats(BaseModel):
    confluence_pages: int = 0
    jira_items: int = 0
    git_repos: int = 0
    project_docs: int = 0
    open_questions: int = 0

class KnowledgeItem(BaseModel):
    id: str
    project_id: str
    title: str
    content: str
    source_type: str # PRD, CONFLUENCE, MEETING_DECISION, RETRO_KAIZEN, ADR, NOTEBOOKLM_NOTE
    tags: List[str] = Field(default_factory=list)
    source_uri: Optional[str] = None
    notebooklm_source_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class KnowledgeSearchQuery(BaseModel):
    project_id: str
    query: str
    limit: int = 15
    source_types: Optional[List[str]] = None

class KnowledgeSearchResponse(BaseModel):
    query: str
    project_id: str
    has_details: bool = True
    answer: str
    citations: List[CitationSnippet] = Field(default_factory=list)
    scanned_sources: ScannedSourcesStats = Field(default_factory=ScannedSourcesStats)
    notebooklm_link: Optional[str] = None
    confidence_score: float = 0.96

class ProjectKnowledgeSyncResponse(BaseModel):
    project_id: str
    status: str
    scanned_sources: ScannedSourcesStats
    message: str
    synced_at: datetime = Field(default_factory=datetime.utcnow)
