import os
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # GCP Environment
    PROJECT_ID: str = Field(default_factory=lambda: os.getenv("PROJECT_ID", os.getenv("GOOGLE_CLOUD_PROJECT", "")))
    REGION: str = Field(default_factory=lambda: os.getenv("REGION", "us-central1"))
    ENVIRONMENT: str = Field(default_factory=lambda: os.getenv("ENVIRONMENT", "dev")) # dev, prod
    FIRESTORE_DATABASE: str = Field(default_factory=lambda: os.getenv("FIRESTORE_DATABASE", "(default)"))
    
    # Document AI & Storage
    DOCUMENT_AI_PROCESSOR_ID: Optional[str] = Field(default_factory=lambda: os.getenv("DOCUMENT_AI_PROCESSOR_ID", None))
    PRD_BUCKET_NAME: Optional[str] = Field(default_factory=lambda: os.getenv("PRD_BUCKET_NAME", None))
    
    # Vertex AI Gemini
    GEMINI_MODEL: str = Field(default_factory=lambda: os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))
    
    # BigQuery
    BIGQUERY_DATASET: str = Field(default_factory=lambda: os.getenv("BIGQUERY_DATASET", "scrum_delivery_analytics"))

    # Atlassian Default Integrations (Can also be set per project)
    JIRA_INSTANCE_URL: Optional[str] = Field(default_factory=lambda: os.getenv("JIRA_INSTANCE_URL", None))
    JIRA_USER_EMAIL: Optional[str] = Field(default_factory=lambda: os.getenv("JIRA_USER_EMAIL", None))
    JIRA_API_TOKEN: Optional[str] = Field(default_factory=lambda: os.getenv("JIRA_API_TOKEN", None))
    JIRA_PROJECT_KEY: str = Field(default_factory=lambda: os.getenv("JIRA_PROJECT_KEY", "SCRUM"))
    
    CONFLUENCE_INSTANCE_URL: Optional[str] = Field(default_factory=lambda: os.getenv("CONFLUENCE_INSTANCE_URL", None))
    CONFLUENCE_USER_EMAIL: Optional[str] = Field(default_factory=lambda: os.getenv("CONFLUENCE_USER_EMAIL", None))
    CONFLUENCE_API_TOKEN: Optional[str] = Field(default_factory=lambda: os.getenv("CONFLUENCE_API_TOKEN", None))

    # GitHub / GHE Integration
    GITHUB_API_BASE: str = Field(default_factory=lambda: os.getenv("GITHUB_API_BASE", "https://api.github.com"))
    GITHUB_TOKEN: Optional[str] = Field(default_factory=lambda: os.getenv("GITHUB_TOKEN", os.getenv("GHE_TOKEN", None)))

    # Google NotebookLM Default
    NOTEBOOKLM_BASE_URL: str = "https://notebooklm.google.com"

    # Google OAuth 2.0 Web Client (Calendar & Drive Gemini Notes)
    GOOGLE_CLIENT_ID: Optional[str] = Field(default_factory=lambda: os.getenv("GOOGLE_CLIENT_ID", None))
    GOOGLE_CLIENT_SECRET: Optional[str] = Field(default_factory=lambda: os.getenv("GOOGLE_CLIENT_SECRET", None))
    GOOGLE_OAUTH_REDIRECT_URI: Optional[str] = Field(default_factory=lambda: os.getenv("GOOGLE_OAUTH_REDIRECT_URI", None))

    # API Server Port & CORS
    PORT: int = Field(default_factory=lambda: int(os.getenv("PORT", 8000)))
    CORS_ORIGINS: str = Field(default_factory=lambda: os.getenv("CORS_ORIGINS", "*"))

    model_config = {
        "env_file": [".env", "../../.env", "../../../.env"],
        "env_file_encoding": "utf-8",
        "extra": "allow"
    }

settings = Settings()
