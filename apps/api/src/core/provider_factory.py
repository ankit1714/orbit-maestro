import logging
import re
from typing import Optional
from apps.api.src.core.config import settings
from apps.api.src.schemas.project import Project
from apps.api.src.schemas.common import ProjectMode
from apps.api.src.core.providers.base import BaseBacklogProvider, BaseDocProvider, BaseGitProvider, BaseKnowledgeProvider
from apps.api.src.core.providers.backlog.native_provider import NativeFirestoreBacklogProvider
from apps.api.src.core.providers.backlog.jira_provider import JiraBacklogProvider, clean_jira_instance_url
from apps.api.src.core.providers.doc.native_provider import NativeFirestoreDocProvider
from apps.api.src.core.providers.doc.confluence_provider import ConfluenceDocProvider, clean_confluence_instance_url
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
            raw_instance = (
                project.jira_settings.instance_url
                or getattr(project, "jira_project_link", None)
                or settings.JIRA_INSTANCE_URL
            )
            instance_url = raw_instance
            if raw_instance:
                m_domain = re.search(r'(https?://[^/]+)', raw_instance.strip())
                if m_domain:
                    instance_url = m_domain.group(1)

            return JiraBacklogProvider(
                instance_url=clean_jira_instance_url(project.jira_settings.instance_url or settings.JIRA_INSTANCE_URL),
                user_email=project.jira_settings.user_email or settings.JIRA_USER_EMAIL,
                api_token=project.jira_settings.api_token or settings.JIRA_API_TOKEN,
                project_key=project.jira_settings.project_key or project.key
            )
        return NativeFirestoreBacklogProvider()

    @classmethod
    def get_jira_provider(
        cls,
        project_id: str,
        target_project_key: Optional[str] = None,
        target_instance_url: Optional[str] = None
    ) -> JiraBacklogProvider:
        project = cls.get_project(project_id)
        jira_settings = project.jira_settings if project else None

        raw_instance_url = (jira_settings.instance_url if jira_settings and jira_settings.instance_url else None) or settings.JIRA_INSTANCE_URL
        instance_url = clean_jira_instance_url(raw_instance_url)
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
        if not project:
            return NativeFirestoreDocProvider()

        jira_base = clean_jira_instance_url(project.jira_settings.instance_url or settings.JIRA_INSTANCE_URL)
        instance_url = (
            project.confluence_settings.instance_url
            or settings.CONFLUENCE_INSTANCE_URL
            or (f"{jira_base}/wiki" if jira_base else None)
        )
        user_email = (
            project.confluence_settings.user_email
            or project.jira_settings.user_email
            or settings.CONFLUENCE_USER_EMAIL
            or settings.JIRA_USER_EMAIL
        )
        api_token = (
            project.confluence_settings.api_token
            or project.jira_settings.api_token
            or settings.CONFLUENCE_API_TOKEN
            or settings.JIRA_API_TOKEN
        )
        space_key = project.confluence_settings.space_key or project.key

        if instance_url and user_email and api_token:
            return ConfluenceDocProvider(
                instance_url=clean_confluence_instance_url(instance_url),
                user_email=user_email,
                api_token=api_token,
                space_key=space_key,
                parent_page_id=project.confluence_settings.parent_page_id
            )
        return NativeFirestoreDocProvider()

    @classmethod
    def get_git_provider(cls, project_id: str) -> BaseGitProvider:
        project = cls.get_project(project_id)
        if project and project.git_settings:
            repo_url = project.git_settings.repo_url
            if not repo_url and project.git_settings.repositories:
                primary = next((r for r in project.git_settings.repositories if getattr(r, "is_primary", False)), project.git_settings.repositories[0])
                repo_url = getattr(primary, "repo_url", None)

            if repo_url or project.git_settings.repo_name:
                return GitHubTrackerProvider(
                    repo_url=repo_url,
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
