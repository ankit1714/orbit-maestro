from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from apps.api.src.schemas.common import Priority

class DependencyNode(BaseModel):
    id: str
    label: str
    node_type: str # REQUIREMENT, STORY, TASK, EXTERNAL
    status: str
    is_blocked: bool = False
    is_critical_path: bool = False

class DependencyEdge(BaseModel):
    source: str
    target: str
    edge_type: str = "BLOCKS"
    is_critical_path: bool = False

class DependencyDAGResponse(BaseModel):
    project_id: str
    nodes: List[DependencyNode] = Field(default_factory=list)
    edges: List[DependencyEdge] = Field(default_factory=list)
    critical_path_node_ids: List[str] = Field(default_factory=list)
    critical_path_aging_hours: float = 48.0

class HealthDimension(BaseModel):
    dimension_name: str # Schedule, Dependencies, Scope Stability, Quality & Tests, Capacity
    status: str # Healthy, Watch, At Risk
    metric_label: str
    detail: str

class HealthMatrix5D(BaseModel):
    project_id: str
    overall_health: str = "Watch"
    dimensions: List[HealthDimension] = Field(default_factory=list)
    primary_risks: List[str] = Field(default_factory=list)
    confidence: str = "High"
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)

class RiskItem(BaseModel):
    id: str
    project_id: str
    title: str
    severity: Priority = Priority.HIGH
    category: str # SCHEDULE, DEPENDENCY, SCOPE, CAPACITY
    evidence: str
    impact: str
    recommended_mitigation: str
    status: str = "ACTIVE" # ACTIVE, MITIGATED, ACCEPTED
    created_at: datetime = Field(default_factory=datetime.utcnow)
