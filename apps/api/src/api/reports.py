from typing import List, Dict, Any
from datetime import datetime
from fastapi import APIRouter
from apps.api.src.schemas.analytics import ExecutiveDeliveryReport, CycleTimeMetric
from apps.api.src.core.bigquery_client import bq_service
from apps.api.src.core.provider_factory import provider_factory

router = APIRouter(prefix="/reports", tags=["Actionable Reports & BigQuery Analytics"])

@router.get("/{project_id}/executive", response_model=ExecutiveDeliveryReport)
def get_executive_report(project_id: str):
    """Generate executive delivery brief and sprint completion summary (Stage 12 & Section 36)."""
    project = provider_factory.get_project(project_id)
    project_name = project.name if project else "Customer Claims Automation"

    md_content = f"""# AI Scrum Master — Sprint 3 Executive Report
Project: {project_name}
Generated: {datetime.utcnow().strftime('%b %d, %Y')} · Model: Gemini 3 Flash
Delivery Health: Watch

## 1. Key Accomplishments
- Successfully deployed Document AI optical parsing pipeline on Cloud Run (TSK-301).
- 14 of 14 automated acceptance boundary test suites passing.
- Intercepted external distraction request (Excel Export) and preserved Sprint 3 focus.

## 2. Primary Critical Path Bottleneck
- PAY-142 (Vendor Payment Gateway API) is halted due to missing vendor schema contracts.
- Impact: Prevents end-to-end integration testing for Sprint 3.
- Action: Triage recommendation: Rollover to Sprint 4.

## 3. Retrospective Kaizen Commitments
- Pre-verify external API contracts 1 sprint prior to work.
- Automate Cloud Run Secret Manager permissions in Terraform.
"""

    return ExecutiveDeliveryReport(
        project_id=project_id,
        project_name=project_name,
        sprint_name="Sprint 3",
        status_day="Day 7 of 10",
        delivery_health="Watch",
        completion_rate_pct=75.0,
        key_accomplishments=[
            "Completed foundational Document AI OCR ingestion pipeline (TSK-301).",
            "14 automated acceptance criteria tests green; zero P1 defects.",
            "Established immutable activity audit ledger in Firestore & BigQuery."
        ],
        critical_path_bottlenecks=[
            "PAY-142 (Vendor Payment Gateway API) halted due to missing vendor contracts.",
            "David (Senior Backend Dev) capacity over-allocated at 108%."
        ],
        retrospective_commitments=[
            "Automate Cloud Run Secret Manager permissions in Terraform (TSK-408).",
            "Pre-verify external partner API contracts 1 sprint before scheduling."
        ],
        markdown_content=md_content,
        generated_at=datetime.utcnow()
    )

@router.get("/{project_id}/spillover-trends")
def get_spillover_trends(project_id: str):
    """Fetch multi-sprint spillover trends from BigQuery analytics."""
    return bq_service.query_spillover_trends(project_id)

@router.get("/{project_id}/cycle-times")
def get_cycle_times(project_id: str):
    """Fetch cycle time and lead time metrics from BigQuery analytics."""
    return bq_service.query_cycle_times(project_id)
