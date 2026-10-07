#!/usr/bin/env python3
"""
Seed script for AI Scrum Master:
Preloads sample multi-tenant projects into Firestore:
1. Customer Claims Automation (STANDALONE Mode with Google NotebookLM & GitHub tracking)
2. FinTech Payment Modernization (ENTERPRISE_SYNC Mode with Jira, Confluence, GitHub & NotebookLM)
"""

import sys
import os
from datetime import datetime, timedelta

# Ensure python path includes project root
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from apps.api.src.core.firestore_client import db
from apps.api.src.schemas.project import Project, TeamMember, GitSettings, JiraSettings, ConfluenceSettings, NotebookLMSettings
from apps.api.src.schemas.common import ProjectMode, ItemStatus, Priority, TaskType, GovernanceTier, AuditActionType
from apps.api.src.schemas.backlog import Epic, UserStory, TaskItem, AcceptanceCriteria
from apps.api.src.schemas.sprint import Sprint, SprintCapacity
from apps.api.src.schemas.ambiguity import OpenQuestion
from apps.api.src.schemas.governance import GovernanceApproval, ActivityLogEntry
from apps.api.src.schemas.knowledge import KnowledgeItem

def seed():
    print("==========================================================")
    print("    AI Scrum Master — Multi-Project Data Seeder           ")
    print("==========================================================")

    now = datetime.utcnow()

    # 1. Project A: Customer Claims Automation (STANDALONE)
    p1_id = "proj-claims-auto"
    p1 = Project(
        id=p1_id,
        name="Customer Claims Automation",
        key="CLM",
        description="Automate medical claim intake and under-$1,000 threshold validation.",
        business_objective="Reduce claim processing cycle time by 40% and automate intake.",
        mode=ProjectMode.STANDALONE,
        sprint_duration_days=14,
        target_velocity_points=32,
        team_members=[
            TeamMember(id="tm-1", name="Alex", role="Backend Lead", email="alex@company.com", skills=["Python", "Cloud Run", "Document AI"], available_hours_per_week=40, current_workload_hours=32),
            TeamMember(id="tm-2", name="Maria", role="Frontend Dev", email="maria@company.com", skills=["React", "TypeScript", "Tailwind"], available_hours_per_week=40, current_workload_hours=26),
            TeamMember(id="tm-3", name="David", role="Senior Backend", email="david@company.com", skills=["Go", "APIs", "Payment Gateways"], available_hours_per_week=40, current_workload_hours=44),
            TeamMember(id="tm-4", name="Sam", role="QA Automator", email="sam@company.com", skills=["Playwright", "Jest", "Integration Testing"], available_hours_per_week=40, current_workload_hours=24)
        ],
        git_settings=GitSettings(
            enabled=True,
            repo_url="https://github.com/enterprise/claims-service",
            repo_owner="enterprise",
            repo_name="claims-service",
            default_branch="main"
        ),
        notebooklm_settings=NotebookLMSettings(
            enabled=True,
            notebook_id="nb-claims-automation-01",
            notebook_url="https://notebooklm.google.com/notebook/nb-claims-automation-01",
            workspace_name="Claims Automation Living Knowledge Hub"
        ),
        created_at=now,
        updated_at=now
    )
    db.collection("projects").document(p1_id).set(p1.dict())
    print(f"[✓] Seeded Project: {p1.name} [{p1.mode}]")

    # 2. Project B: FinTech Payment Modernization (ENTERPRISE_SYNC)
    p2_id = "proj-fintech-pay"
    p2 = Project(
        id=p2_id,
        name="FinTech Payment Modernization",
        key="FIN",
        description="Jira and Confluence integrated payment orchestrator with OAuth2 PKCE.",
        business_objective="Modernize payment gateway infrastructure to achieve PCI DSS compliance.",
        mode=ProjectMode.ENTERPRISE_SYNC,
        sprint_duration_days=14,
        target_velocity_points=35,
        team_members=[
            TeamMember(id="tm-5", name="Ken", role="Lead Architect", email="ken@company.com", skills=["Architecture", "Security", "Jira"], available_hours_per_week=40, current_workload_hours=30),
            TeamMember(id="tm-6", name="Sarah", role="Backend Dev", email="sarah@company.com", skills=["Java", "Spring", "OAuth2"], available_hours_per_week=40, current_workload_hours=28)
        ],
        jira_settings=JiraSettings(
            enabled=True,
            instance_url="https://the-ai-scrum-master.atlassian.net",
            project_key="FIN",
            board_id="board-101"
        ),
        confluence_settings=ConfluenceSettings(
            enabled=True,
            instance_url="https://the-ai-scrum-master.atlassian.net/wiki",
            space_key="PAY",
            parent_page_id="page-501"
        ),
        git_settings=GitSettings(
            enabled=True,
            repo_url="https://github.com/enterprise/fintech-gateway",
            repo_owner="enterprise",
            repo_name="fintech-gateway"
        ),
        notebooklm_settings=NotebookLMSettings(
            enabled=True,
            notebook_id="nb-fintech-pay-02",
            notebook_url="https://notebooklm.google.com/notebook/nb-fintech-pay-02",
            workspace_name="FinTech Payment Living Knowledge Space"
        ),
        created_at=now,
        updated_at=now
    )
    db.collection("projects").document(p2_id).set(p2.dict())
    print(f"[✓] Seeded Project: {p2.name} [{p2.mode}]")

    # Seed Epics, Stories & Tasks for Project 1
    epic_id = "epic-claims-01"
    epic = Epic(
        id=epic_id,
        key="EPC-01",
        project_id=p1_id,
        title="Customer Claim Submission & Ingestion Engine",
        description="End-to-end receipt upload, optical parsing, auto-approval rules, and payment gateway integration.",
        requirement_origin="PRD §3.0 - §3.4",
        status=ItemStatus.IN_PROGRESS
    )
    db.collection("epics").document(epic_id).set(epic.dict())

    # Stories
    s1_id = "story-claims-102"
    s1 = UserStory(
        id=s1_id,
        key="STY-102",
        project_id=p1_id,
        epic_id=epic_id,
        title="As a customer, I can upload claim receipts for OCR parsing",
        description="Upload medical bill attachments with client-side chunking and Document AI OCR extraction.",
        requirement_origin="PRD §3.2.1",
        story_points=8,
        priority=Priority.HIGH,
        assignee_name="Alex (Backend)",
        status=ItemStatus.TODO,
        acceptance_criteria=[
            AcceptanceCriteria(
                id="ac-1",
                scenario="File Attachment Size Validation",
                given="A customer is authenticated on the claim submission portal",
                when="They upload a PDF, JPG, or PNG under 25MB",
                then="The file is accepted, hashed, and dispatched to Document AI"
            )
        ]
    )
    db.collection("stories").document(s1_id).set(s1.dict())

    # Tasks
    tasks = [
        TaskItem(id="task-301", key="TSK-301", project_id=p1_id, story_id=s1_id, title="Build Document AI ingestion pipeline on Cloud Run", task_type=TaskType.DEV, status=ItemStatus.DONE, assignee_name="Alex", effort_days=3.0, trace_ref="AC-1"),
        TaskItem(id="task-302", key="TSK-302", project_id=p1_id, story_id=s1_id, title="File Upload MIME type validator and 25MB chunking", task_type=TaskType.DEV, status=ItemStatus.TODO, assignee_name="Maria", effort_days=1.5, trace_ref="AC-2"),
        TaskItem(id="task-pay-142", key="PAY-142", project_id=p1_id, story_id=s1_id, title="Claims Validation Vendor API Gateway connector", task_type=TaskType.DEV, status=ItemStatus.BLOCKED, is_blocked=True, blocker_reason="Vendor API schema contract delayed by 3 days", assignee_name="David", effort_days=2.0),
        TaskItem(id="task-qa-401", key="QA-401", project_id=p1_id, story_id=s1_id, title="Boundary test suites for auto-approval limits", task_type=TaskType.QA, status=ItemStatus.TODO, assignee_name="Sam", effort_days=1.5)
    ]
    for t in tasks:
        db.collection("tasks").document(t.id).set(t.dict())
    print("[✓] Seeded Epics, Stories, and Tasks.")

    # Seed Open Questions
    q1 = OpenQuestion(
        id="q-1",
        project_id=p1_id,
        question="What are the allowed attachment formats and maximum file sizes?",
        section_ref="PRD §3.2.1",
        why_needed="Unclear storage limits affect Cloud Storage provisioning & Document AI parsing throughput.",
        delivery_impact="Blocks backend upload schema validation & infrastructure provisioning.",
        priority=Priority.HIGH,
        ai_suggested_answer="Support PDF, JPG, PNG with max 25MB per file.",
        options=["PDF, JPG, PNG max 25MB", "PDF only max 10MB", "Any image/doc max 50MB"],
        confidence_score=0.96
    )
    db.collection("open_questions").document("q-1").set(q1.dict())

    # Seed Sprint 3
    sprint = Sprint(
        id="sprint-3",
        project_id=p1_id,
        sprint_number=3,
        name="Sprint 3",
        goal="Enable end-to-end customer medical claim intake with Document AI extraction, under-$1,000 auto-approval rule, and vendor payment webhook harness.",
        status="ACTIVE",
        planned_points=32,
        delivered_points=24,
        remaining_days=3,
        total_days=10,
        start_date=now - timedelta(days=7),
        end_date=now + timedelta(days=3),
        capacity=SprintCapacity(
            team_total_hours=160,
            frontend_hours=60,
            backend_hours=80,
            qa_hours=20,
            frontend_load_pct=72.0,
            backend_load_pct=108.0,
            qa_load_pct=65.0
        )
    )
    db.collection("sprints").document("sprint-3").set(sprint.dict())

    # Seed Governance Approvals
    gov1 = GovernanceApproval(
        id="app-1",
        project_id=p1_id,
        tier=GovernanceTier.APPROVAL_REQUIRED,
        title="Scope Change Detected",
        summary="Payment Timeout parameter reduced from 30s to 10s",
        observation="Line 42 of Standup transcript: 'Timeout must be 10s for mobile users.'",
        delivery_impact="Affects 2 backend tasks and performance testing criteria.",
        ai_proposed_action="Update Acceptance Criteria of STY-102 and add performance test task QA-403.",
        target_entity_type="STORY",
        target_entity_id="STY-102",
        status="PENDING",
        created_at=now
    )
    db.collection("governance_approvals").document("app-1").set(gov1.dict())

    gov2 = GovernanceApproval(
        id="app-2",
        project_id=p1_id,
        tier=GovernanceTier.APPROVAL_REQUIRED,
        title="Resource Rebalance",
        summary="Reassign TSK-304 (Claim validation schema) to Maria",
        observation="David holds 108% capacity with 2 blocked dependencies.",
        delivery_impact="Maria has 14h available capacity and 95% TypeScript skill fit.",
        ai_proposed_action="Shift TSK-304 ownership to preserve Sprint 3 completion date.",
        target_entity_type="TASK",
        target_entity_id="TSK-304",
        status="PENDING",
        created_at=now
    )
    db.collection("governance_approvals").document("app-2").set(gov2.dict())

    # Seed Activity Logs
    act1 = ActivityLogEntry(
        id="act-1",
        project_id=p1_id,
        action_type=AuditActionType.DOCUMENT_INGESTED,
        actor="Understanding Agent",
        description="Ingested Claims_Automation_PRD_v1.pdf and identified 2 open questions",
        target_entity="PRD Spec",
        governance_tier=GovernanceTier.AUTO_EXECUTE,
        timestamp=now - timedelta(hours=2)
    )
    db.collection("activity_logs").document("act-1").set(act1.dict())

    act2 = ActivityLogEntry(
        id="act-2",
        project_id=p1_id,
        action_type=AuditActionType.TASK_STATUS_CHANGED,
        actor="Task Agent",
        description="Moved TSK-301 to Done after automated tests verified",
        target_entity="TSK-301",
        governance_tier=GovernanceTier.AUTO_EXECUTE,
        timestamp=now - timedelta(hours=1)
    )
    db.collection("activity_logs").document("act-2").set(act2.dict())

    # Seed Knowledge Items
    k1 = KnowledgeItem(
        id="know-1",
        project_id=p1_id,
        title="Customer Claims Automation PRD v1.2",
        content="Overview §1.0: Reduce manual claim review cycle time by 40% and automate intake for high-volume, low-risk claims. Standard file attachments include PDF, JPG, PNG up to 25MB.",
        source_type="PRD",
        source_uri="https://notebooklm.google.com/notebook/nb-claims-automation-01"
    )
    db.collection("knowledge_items").document("know-1").set(k1.dict())

    print("[✓] Preloaded sample Sprint, Approvals, Activity logs, and Knowledge items.")
    print("==========================================================")
    print("    Seeding Complete! All projects ready for execution.   ")
    print("==========================================================")

if __name__ == "__main__":
    seed()
