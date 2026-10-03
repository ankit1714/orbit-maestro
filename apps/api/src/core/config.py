import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # GCP Environment
    PROJECT_ID: str = os.getenv("PROJECT_ID", "ai-scrum-master-510116")
    REGION: str = os.getenv("REGION", "us-central1")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "dev") # dev, prod
    
    # Document AI & Storage
    DOCUMENT_AI_PROCESSOR_ID: Optional[str] = os.getenv("DOCUMENT_AI_PROCESSOR_ID", None)
    PRD_BUCKET_NAME: str = os.getenv("PRD_BUCKET_NAME", "ai-scrum-master-prd-uploads")
    
    # Vertex AI Gemini
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    
    # BigQuery
    BIGQUERY_DATASET: str = os.getenv("BIGQUERY_DATASET", "scrum_delivery_analytics")

    # Atlassian Default Integrations (Can also be set per project)
    JIRA_INSTANCE_URL: Optional[str] = os.getenv("JIRA_INSTANCE_URL", "https://whirlpool.atlassian.net")
    JIRA_USER_EMAIL: Optional[str] = os.getenv("JIRA_USER_EMAIL", None)
    JIRA_API_TOKEN: Optional[str] = os.getenv("JIRA_API_TOKEN", None)
    
    CONFLUENCE_INSTANCE_URL: Optional[str] = os.getenv("CONFLUENCE_INSTANCE_URL", "https://whirlpool.atlassian.net/wiki")
    CONFLUENCE_USER_EMAIL: Optional[str] = os.getenv("CONFLUENCE_USER_EMAIL", None)
    CONFLUENCE_API_TOKEN: Optional[str] = os.getenv("CONFLUENCE_API_TOKEN", None)

    # GitHub / GHE Integration
    GITHUB_API_BASE: str = os.getenv("GITHUB_API_BASE", "https://api.github.com")
    GITHUB_TOKEN: Optional[str] = os.getenv("GITHUB_TOKEN", os.getenv("GHE_TOKEN", None))

    # Google NotebookLM Default
    NOTEBOOKLM_BASE_URL: str = "https://notebooklm.google.com"

    # API Server Port & CORS
    PORT: int = int(os.getenv("PORT", 8000))
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")

    model_config = {
        "env_file": ".env",
        "extra": "allow"
    }

settings = Settings()
