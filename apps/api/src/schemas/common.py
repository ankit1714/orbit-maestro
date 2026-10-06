from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ProjectMode(str, Enum):
    STANDALONE = "STANDALONE"          # Native Firestore Backlog & Knowledge + Direct GitHub Read
    ENTERPRISE_SYNC = "ENTERPRISE_SYNC" # Atlassian Jira + Confluence + GitHub

class ItemStatus(str, Enum):
    TODO = "TODO"
    IN_PROGRESS = "IN_PROGRESS"
    BLOCKED = "BLOCKED"
    IN_REVIEW = "IN_REVIEW"
    DONE = "DONE"
    CANCELLED = "CANCELLED"

class Priority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class GovernanceTier(str, Enum):
    AUTO_EXECUTE = "AUTO_EXECUTE"
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"
    HUMAN_ONLY = "HUMAN_ONLY"

class TaskType(str, Enum):
    DEV = "DEV"
    QA = "QA"
    SPIKE = "SPIKE"
    IMPEDIMENT = "IMPEDIMENT"

class MeetingType(str, Enum):
    STANDUP = "STANDUP"
    PLANNING = "PLANNING"
    REVIEW = "REVIEW"
    RETROSPECTIVE = "RETROSPECTIVE"

class FlashHealthStatus(str, Enum):
    ON_TRACK = "ON_TRACK"         # 🟢 Commits active, PRs merging, no aging blockers
    AT_RISK = "AT_RISK"           # 🟡 24h-48h idle, unverified API contract, high capacity load
    OFF_TRACK = "OFF_TRACK"       # 🔴 >48h idle, blocked critical path task, sprint slip forecasted

class AuditActionType(str, Enum):
    DOCUMENT_INGESTED = "DOCUMENT_INGESTED"
    AMBIGUITY_RESOLVED = "AMBIGUITY_RESOLVED"
    BACKLOG_SYNTHESIZED = "BACKLOG_SYNTHESIZED"
    SPRINT_COMMITTED = "SPRINT_COMMITTED"
    MEETING_EXTRACTED = "MEETING_EXTRACTED"
    TASK_STATUS_CHANGED = "TASK_STATUS_CHANGED"
    TASK_REASSIGNED = "TASK_REASSIGNED"
    SCOPE_CHANGE_FLAGGED = "SCOPE_CHANGE_FLAGGED"
    RISK_DETECTED = "RISK_DETECTED"
    APPROVAL_GRANTED = "APPROVAL_GRANTED"
    APPROVAL_REJECTED = "APPROVAL_REJECTED"
    SPILLOVER_TRIAGED = "SPILLOVER_TRIAGED"
    KNOWLEDGE_ADDED = "KNOWLEDGE_ADDED"
