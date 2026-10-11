import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apps.api.src.core.config import settings

# Import API Routers
from apps.api.src.api.projects import router as projects_router
from apps.api.src.api.ingest import router as ingest_router
from apps.api.src.api.backlog import router as backlog_router
from apps.api.src.api.sprints import router as sprints_router
from apps.api.src.api.meetings import router as meetings_router
from apps.api.src.api.risks import router as risks_router
from apps.api.src.api.git_tracker import router as git_router
from apps.api.src.api.governance import router as governance_router
from apps.api.src.api.knowledge import router as knowledge_router
from apps.api.src.api.reports import router as reports_router
from apps.api.src.api.simulator import router as simulator_router
from apps.api.src.api.users import router as users_router

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_scrum_api")

app = FastAPI(
    title="AI Scrum Master — Autonomous Delivery Orchestration API",
    description="Multi-agent Scrum Master API supporting Standalone Firestore Mode, Enterprise Jira/Confluence/GitHub sync, and Google NotebookLM knowledge spaces.",
    version="1.0.0"
)

# Configure CORS
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
if not origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers under /v1
api_prefix = "/v1"
app.include_router(projects_router, prefix=api_prefix)
app.include_router(ingest_router, prefix=api_prefix)
app.include_router(backlog_router, prefix=api_prefix)
app.include_router(sprints_router, prefix=api_prefix)
app.include_router(meetings_router, prefix=api_prefix)
app.include_router(risks_router, prefix=api_prefix)
app.include_router(git_router, prefix=api_prefix)
app.include_router(governance_router, prefix=api_prefix)
app.include_router(knowledge_router, prefix=api_prefix)
app.include_router(reports_router, prefix=api_prefix)
app.include_router(simulator_router, prefix=api_prefix)
app.include_router(users_router, prefix=api_prefix)

@app.get("/")
def root():
    return {
        "service": "AI Scrum Master Core API",
        "version": "1.0.0",
        "status": "ONLINE",
        "docs_url": "/docs"
    }

@app.get("/healthz")
def health_check():
    return {
        "status": "HEALTHY",
        "project_id": settings.PROJECT_ID,
        "region": settings.REGION,
        "environment": settings.ENVIRONMENT
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("apps.api.src.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
