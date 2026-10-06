import logging
from typing import Optional
from apps.api.src.core.config import settings
from apps.api.src.schemas.project import Project
from apps.api.src.schemas.common import ProjectMode
from apps.api.src.core.providers.base import BaseBacklogProvider, BaseDocProvider, BaseGitProvider, BaseKnowledgeProvider
from apps.api.src.core.providers.backlog.native_provider import NativeFirestoreBacklogProvider
from apps.api.src.core.providers.backlog.jira_provider import JiraBacklogProvider
from apps.api.src.core.providers.doc.native_provider import NativeFirestoreDocProvider
from apps.api.src.core.providers.doc.confluence_provider import ConfluenceDocProvider
from apps.api.src.core.providers.git.github_provider import GitHubTrackerProvider
from apps.api.src.core.providers.git.native_provider import NativeGitTrackerProvider
from apps.api.src.core.providers.notebooklm.notebooklm_provider import NotebookLMKnowledgeProvider
from apps.api.src.core.firestore_client import db

logger = logging.getLogger("provider_factory")

class ProviderFactory:
    @staticmethod
    def get_project(project_id: str) -> Optional[Project]:
        snap = db.collection("projects").document(project_id).get()
        if snap.exists:
            return Project(**snap.to_dict())
        return None

    @classmethod
    def get_backlog_provider(cls, project_id: str) -> BaseBacklogProvider:
        project = cls.get_project(project_id)
        if project and project.mode == ProjectMode.ENTERPRISE_SYNC and project.jira_settings.enabled:
            return JiraBacklogProvider(
                instance_url=project.jira_settings.instance_url or settings.JIRA_INSTANCE_URL,
                user_email=project.jira_settings.user_email or settings.JIRA_USER_EMAIL,
                api_token=project.jira_settings.api_token or settings.JIRA_API_TOKEN,
                project_key=project.jira_settings.project_key or project.key
            )
        return NativeFirestoreBacklogProvider()

    @classmethod
    def get_jira_provider(cls, project_id: str, target_project_key: Optional[str] = None) -> JiraBacklogProvider:
        project = cls.get_project(project_id)
        jira_settings = project.jira_settings if project else None

        instance_url = (jira_settings.instance_url if jira_settings and jira_settings.instance_url else None) or settings.JIRA_INSTANCE_URL
        user_email = (jira_settings.user_email if jira_settings and jira_settings.user_email else None) or settings.JIRA_USER_EMAIL
        api_token = (jira_settings.api_token if jira_settings and jira_settings.api_token else None) or settings.JIRA_API_TOKEN
        proj_key = (
            target_project_key
            or (jira_settings.project_key if jira_settings and jira_settings.project_key else None)
            or getattr(settings, "JIRA_PROJECT_KEY", None)
            or (project.key if project and project.key not in ["CLM", "FIN"] else "SCRUM")
            or "SCRUM"
        )

        return JiraBacklogProvider(
            instance_url=instance_url,
            user_email=user_email,
            api_token=api_token,
            project_key=proj_key
        )

    @classmethod
    def get_doc_provider(cls, project_id: str) -> BaseDocProvider:
        project = cls.get_project(project_id)
        if project and project.mode == ProjectMode.ENTERPRISE_SYNC and project.confluence_settings.enabled:
            return ConfluenceDocProvider(
                instance_url=project.confluence_settings.instance_url,
                user_email=project.confluence_settings.user_email,
                api_token=project.confluence_settings.api_token,
                space_key=project.confluence_settings.space_key,
                parent_page_id=project.confluence_settings.parent_page_id
            )
        return NativeFirestoreDocProvider()

    @classmethod
    def get_git_provider(cls, project_id: str) -> BaseGitProvider:
        project = cls.get_project(project_id)
        if project and project.git_settings.enabled and (project.git_settings.repo_url or project.git_settings.repo_name):
            return GitHubTrackerProvider(
                repo_url=project.git_settings.repo_url,
                repo_owner=project.git_settings.repo_owner,
                repo_name=project.git_settings.repo_name,
                access_token=project.git_settings.access_token
            )
        return NativeGitTrackerProvider()

    @classmethod
    def get_knowledge_provider(cls, project_id: str) -> BaseKnowledgeProvider:
        project = cls.get_project(project_id)
        if project and project.notebooklm_settings.enabled:
            return NotebookLMKnowledgeProvider(
                notebook_id=project.notebooklm_settings.notebook_id,
                notebook_url=project.notebooklm_settings.notebook_url,
                workspace_name=project.notebooklm_settings.workspace_name or f"{project.name} Knowledge Hub"
            )
        return NotebookLMKnowledgeProvider()

provider_factory = ProviderFactory()
