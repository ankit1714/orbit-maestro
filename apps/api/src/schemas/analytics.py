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

class LeaderboardUser(BaseModel):
    rank: int = 1
    name: str
    email: Optional[str] = None
    role: Optional[str] = "Team Member"
    closed_stories_count: int = 0
    closed_story_points: int = 0
    in_progress_count: int = 0
    in_progress_points: int = 0
    total_assigned_stories: int = 0
    total_assigned_points: int = 0
    completion_rate_pct: float = 0.0

class EpicDeliveryProgress(BaseModel):
    key: str
    title: str
    total_points: int = 0
    delivered_points: int = 0
    completion_pct: float = 0.0
    total_stories: int = 0
    completed_stories: int = 0

class ExecutiveDeliveryReport(BaseModel):
    project_id: str
    project_name: str
    sprint_name: str
    status_day: str
    delivery_health: str # Healthy, Watch, At Risk
    completion_rate_pct: float
    planned_points: int = 0
    delivered_points: int = 0
    remaining_points: int = 0
    total_stories_count: int = 0
    completed_stories_count: int = 0
    in_progress_stories_count: int = 0
    todo_stories_count: int = 0
    blocked_stories_count: int = 0
    spillover_risk_pct: float = 0.0
    key_accomplishments: List[str]
    critical_path_bottlenecks: List[str]
    retrospective_commitments: List[str]
    leaderboard: List[LeaderboardUser] = []
    epics_progress: List[EpicDeliveryProgress] = []
    markdown_content: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)

