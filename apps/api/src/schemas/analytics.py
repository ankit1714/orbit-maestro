from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class SprintSnapshot(BaseModel):
    project_id: str
    sprint_id: str
    sprint_name: str
    planned_points: int
    delivered_points: int
    spillover_points: int
    total_tasks: int
    completed_tasks: int
    blocked_tasks_count: int
    cycle_time_avg_days: float
    lead_time_avg_days: float
    sprint_start_date: datetime
    sprint_end_date: datetime

class CycleTimeMetric(BaseModel):
    project_id: str
    sprint_id: str
    avg_cycle_time_days: float
    avg_lead_time_days: float
    trend_direction: str # "DOWN_14PCT", "UP_5PCT", "FLAT"

class ExecutiveDeliveryReport(BaseModel):
    project_id: str
    project_name: str
    sprint_name: str
    status_day: str
    delivery_health: str # Healthy, Watch, At Risk
    completion_rate_pct: float
    key_accomplishments: List[str]
    critical_path_bottlenecks: List[str]
    retrospective_commitments: List[str]
    markdown_content: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
