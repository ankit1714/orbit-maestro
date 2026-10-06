from fastapi import APIRouter
from apps.api.src.schemas.risk import DependencyDAGResponse, HealthMatrix5D

try:
    from packages.agents.src.risk_agent import risk_agent
except ImportError:
    pass

router = APIRouter(prefix="/risks", tags=["Dependency & Risk Radar"])

@router.get("/dag/{project_id}", response_model=DependencyDAGResponse)
def get_dependency_dag(project_id: str):
    """Get the project dependency DAG, critical path, and path aging metrics."""
    return risk_agent.evaluate_risks(project_id)

@router.get("/health/{project_id}", response_model=HealthMatrix5D)
def get_health_matrix(project_id: str):
    """Compute the 5-dimensional health indicators (Schedule, Dependencies, Scope, Quality, Capacity)."""
    return risk_agent.evaluate_health_matrix(project_id)
