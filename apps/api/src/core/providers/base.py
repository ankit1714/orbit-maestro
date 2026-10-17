from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from apps.api.src.schemas.backlog import Epic, UserStory, TaskItem, BacklogHierarchyResponse
from apps.api.src.schemas.git_telemetry import GitCommit, PullRequest
from apps.api.src.schemas.knowledge import KnowledgeItem, KnowledgeSearchResponse, NotebookLMReference

class BaseBacklogProvider(ABC):
    @abstractmethod
    def get_backlog(self, project_id: str) -> BacklogHierarchyResponse:
        pass

    @abstractmethod
    def create_epic(self, project_id: str, title: str, description: str, origin: str) -> Epic:
        pass

    @abstractmethod
    def create_story(
        self,
        project_id: str,
        epic_id: str,
        title: str,
        description: str,
        points: int,
        ac_list: List[Dict[str, str]],
        assignee: Optional[str] = None,
        origin: Optional[str] = None,
        skill_match_percentage: int = 92,
        skill_match_rationale: Optional[str] = None
    ) -> UserStory:
        pass

    @abstractmethod
    def create_task(
        self,
        project_id: str,
        story_id: str,
        title: str,
        task_type: str,
        effort_days: float,
        assignee: Optional[str] = None,
        trace_ref: Optional[str] = None,
        skill_match_percentage: int = 92,
        skill_match_rationale: Optional[str] = None
    ) -> TaskItem:
        pass

    @abstractmethod
    def update_task_status(self, project_id: str, task_id: str, new_status: str) -> TaskItem:
        pass

class BaseDocProvider(ABC):
    @abstractmethod
    def publish_prd_summary(self, project_id: str, title: str, content: str) -> Dict[str, Any]:
        pass

    @abstractmethod
    def publish_open_questions(self, project_id: str, questions: List[Dict[str, Any]]) -> Dict[str, Any]:
        pass

    @abstractmethod
    def publish_meeting_notes(self, project_id: str, meeting_type: str, date_str: str, summary: str, decisions: List[str], actions: List[str]) -> Dict[str, Any]:
        pass

    @abstractmethod
    def publish_adr(self, project_id: str, decision_id: str, title: str, context: str, decision: str, consequences: str) -> Dict[str, Any]:
        pass

class BaseGitProvider(ABC):
    @abstractmethod
    def get_recent_commits(self, project_id: str, since_hours: int = 48) -> List[GitCommit]:
        pass

    @abstractmethod
    def get_pull_requests(self, project_id: str, state: str = "open") -> List[PullRequest]:
        pass

from apps.api.src.schemas.knowledge import KnowledgeItem, KnowledgeSearchResponse, NotebookLMReference, ProjectKnowledgeSyncResponse

class BaseKnowledgeProvider(ABC):
    @abstractmethod
    def search(self, project_id: str, query: str, limit: int = 5) -> KnowledgeSearchResponse:
        pass

    @abstractmethod
    def add_knowledge_item(self, project_id: str, title: str, content: str, source_type: str, source_uri: Optional[str] = None) -> KnowledgeItem:
        pass

    @abstractmethod
    def get_notebooklm_reference(self, project_id: str) -> NotebookLMReference:
        pass

    @abstractmethod
    def sync_sources(self, project_id: str) -> ProjectKnowledgeSyncResponse:
        pass
