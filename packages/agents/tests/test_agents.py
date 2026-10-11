import pytest
from packages.agents.src.understanding_agent import understanding_agent
from packages.agents.src.ambiguity_agent import ambiguity_agent
from packages.agents.src.backlog_agent import backlog_agent
from packages.agents.src.sprint_agent import sprint_agent
from packages.agents.src.meeting_agent import meeting_agent
from packages.agents.src.risk_agent import risk_agent
from packages.agents.src.git_agent import git_agent
from packages.agents.src.orchestrator import orchestrator
from apps.api.src.schemas.common import MeetingType, FlashHealthStatus, GovernanceTier

def test_understanding_agent():
    res = understanding_agent.process_document("proj-test-1", b"Sample PRD Content", "Claims_Automation_PRD.pdf")
    assert res.project_id == "proj-test-1"
    assert len(res.personas) >= 3
    assert len(res.capabilities) >= 3
    assert len(res.clauses) >= 4
    assert res.page_count > 0

def test_ambiguity_agent():
    questions = ambiguity_agent.identify_open_questions("proj-test-1")
    assert len(questions) >= 2
    q1 = questions[0]
    assert q1.priority.value == "HIGH"
    assert q1.ai_suggested_answer != ""

    resolved = ambiguity_agent.resolve_question(q1.id, "Accepted 25MB limit")
    assert resolved.resolved is True
    assert resolved.resolved_answer == "Accepted 25MB limit"

def test_backlog_agent():
    backlog = backlog_agent.synthesize_backlog("proj-test-1", {"q1": "PDF, JPG, PNG max 25MB"})
    assert backlog.total_epics >= 1
    assert backlog.total_stories >= 2
    assert backlog.total_tasks >= 3
    assert backlog.total_points > 0

    first_epic = backlog.epics[0]
    assert first_epic.key == "EPC-01"
    story = first_epic.stories[0]
    assert len(story.acceptance_criteria) >= 1
    ac = story.acceptance_criteria[0]
    assert ac.given != "" and ac.when != "" and ac.then != ""

def test_sprint_agent():
    sprint = sprint_agent.plan_sprint("proj-test-1", 3)
    assert sprint.sprint_number == 3
    assert sprint.planned_points > 0

    spillovers = sprint_agent.evaluate_spillovers("proj-test-1", sprint.id)
    assert isinstance(spillovers, list)

def test_meeting_agent():
    res_standup = meeting_agent.process_transcript(
        "proj-test-1",
        MeetingType.STANDUP,
        "David: PAY-142 is blocked by vendor schema. Alex finished OCR endpoints. Team agreed to prioritize vendor unblock."
    )
    assert len(res_standup.blockers) >= 1
    assert len(res_standup.decisions) >= 1

    res_review = meeting_agent.process_transcript(
        "proj-test-1",
        MeetingType.REVIEW,
        "Stakeholders loved OCR accuracy. Requested photo rotation feature."
    )
    assert len(res_review.actions) >= 1

def test_risk_agent():
    dag = risk_agent.evaluate_risks("proj-test-1")
    assert len(dag.nodes) >= 2
    assert isinstance(dag.critical_path_node_ids, list)

    matrix = risk_agent.evaluate_health_matrix("proj-test-1")
    assert matrix.overall_health in ["Healthy", "Watch", "At Risk"]
    assert len(matrix.dimensions) == 5
    assert len(matrix.primary_risks) >= 1

def test_git_agent():
    flash = git_agent.evaluate_git_health("proj-test-1")
    assert flash.status in [FlashHealthStatus.ON_TRACK, FlashHealthStatus.AT_RISK, FlashHealthStatus.OFF_TRACK]
    assert flash.headline != ""

def test_orchestrator():
    res = orchestrator.handle_event("EVENT_DOCUMENT_UPLOADED", {
        "project_id": "proj-test-1",
        "file_name": "Test_PRD.pdf",
        "file_bytes": b"Content"
    })
    assert "extract" in res
    assert "open_questions" in res

    approval = orchestrator.create_pending_approval(
        "proj-test-1",
        "Test Scope Change",
        "Timeout changed",
        "Quote from standup",
        "Affects testing",
        "Update story",
        "STORY",
        "STY-102"
    )
    assert approval.tier == GovernanceTier.APPROVAL_REQUIRED
    assert approval.status == "PENDING"
