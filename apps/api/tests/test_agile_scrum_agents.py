import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from apps.api.src.main import app
from packages.agents.src.agile_scrum_agents import (
    LeadAgileOrchestratorAgent,
    ProductOwnerAgent,
    TechnicalScrumMasterAgent,
    RequirementsDecompositionPipeline,
    snap_to_fibonacci,
    VALID_FIBONACCI
)
from apps.api.src.schemas.requirement import (
    LeadOrchestratorStrategy,
    ProductOwnerDecomposition,
    DecomposedEpic,
    DecomposedUserStory,
    TechnicalSprintPlan,
    RequirementDecompositionResponse
)

client = TestClient(app)

def test_fibonacci_snapping():
    assert snap_to_fibonacci(1) == 1
    assert snap_to_fibonacci(2) == 2
    assert snap_to_fibonacci(3) == 3
    assert snap_to_fibonacci(4) in [3, 5]
    assert snap_to_fibonacci(5) == 5
    assert snap_to_fibonacci(7) == 8
    assert snap_to_fibonacci(8) == 8
    assert snap_to_fibonacci(13) == 8
    assert snap_to_fibonacci("invalid") == 5

@patch("apps.api.src.core.vertex_client.vertex_service.generate_content")
def test_agent_1_orchestrator(mock_vertex):
    mock_vertex.return_value = """{
      "project_name": "Claims Automation",
      "core_problem_statement": "Automate manual medical claims processing",
      "target_audience": ["Claims Adjuster", "Policyholder"],
      "key_functional_themes": ["OCR Ingestion", "Auto-Approval Engine", "Fraud Detection"],
      "execution_strategy": {
        "architectural_scope": "Microservices with Document AI OCR and Firestore persistence",
        "delivery_milestones": ["Milestone 1: Core OCR", "Milestone 2: Validation", "Milestone 3: Auto-settlement"],
        "core_risks_and_dependencies": ["Document AI quota", "Webhook timeout"]
      },
      "sprint_guidelines": {
        "definition_of_ready": ["Story persona format", "2-4 Gherkin ACs"],
        "quality_standards": ["Unit test coverage >= 80%"],
        "scope_boundaries": ["In Scope: Claims under $1,000"]
      }
    }"""

    agent = LeadAgileOrchestratorAgent()
    strategy = agent.analyze_and_formulate_strategy(
        project_name="Claims Automation",
        raw_requirements="Process incoming medical bills, extract totals with OCR, auto-approve under $1000.",
        sprint_goal="Automate claims under $1000"
    )

    assert strategy.project_name == "Claims Automation"
    assert "Automate manual" in strategy.core_problem_statement
    assert len(strategy.target_audience) == 2
    assert len(strategy.key_functional_themes) == 3
    assert "architectural_scope" in strategy.execution_strategy
    assert len(strategy.sprint_guidelines["definition_of_ready"]) >= 2

@patch("apps.api.src.core.vertex_client.vertex_service.generate_content")
def test_agent_2_product_owner(mock_vertex):
    mock_vertex.return_value = """{
      "epics": [
        {
          "title": "Automated Claims Ingestion",
          "description": "Optical receipt processing and line item extraction",
          "stories": [
            {
              "title": "As a claims adjuster, I want optical character recognition on receipts so that line items are digitized automatically",
              "description": "Integrate Document AI processor with receipt parser",
              "origin": "PRD §1.2",
              "acceptance_criteria": [
                {
                  "scenario": "Successful receipt parsing",
                  "given": "A valid PDF receipt is uploaded",
                  "when": "Extraction executes",
                  "then": "Total amount, vendor name, and date are extracted with >=90% confidence"
                },
                {
                  "scenario": "Malformed file rejection",
                  "given": "An unsupported or corrupted document",
                  "when": "Upload is attempted",
                  "then": "System rejects file with HTTP 400 and user-friendly error"
                }
              ],
              "non_functional_constraints": ["Processing latency < 3 seconds"]
            }
          ]
        }
      ]
    }"""

    agent = ProductOwnerAgent()
    orchestrator_strategy = LeadOrchestratorStrategy(
        project_name="Claims Automation",
        core_problem_statement="Automate claims",
        target_audience=["Adjuster"],
        key_functional_themes=["OCR"],
        execution_strategy={"architectural_scope": "Microservices"},
        sprint_guidelines={"definition_of_ready": ["Persona format"]}
    )

    decomp = agent.decompose_epics_and_stories(
        project_name="Claims Automation",
        raw_requirements="Extract receipts with OCR",
        sprint_goal="Automate receipt parsing",
        orchestrator_strategy=orchestrator_strategy
    )

    assert len(decomp.epics) == 1
    epic = decomp.epics[0]
    assert epic.title == "Automated Claims Ingestion"
    assert len(epic.stories) == 1
    story = epic.stories[0]
    assert story.title.startswith("As a claims adjuster")
    assert len(story.acceptance_criteria) >= 2
    assert "given" in story.acceptance_criteria[0]
    assert "then" in story.acceptance_criteria[0]

@patch("apps.api.src.core.vertex_client.vertex_service.generate_content")
def test_agent_3_technical_scrum_master(mock_vertex):
    mock_vertex.return_value = """{
      "validated_epics": [
        {
          "title": "Automated Claims Ingestion",
          "description": "Scope",
          "stories": [
            {
              "title": "As a claims adjuster, I want optical character recognition on receipts so that line items are digitized automatically",
              "description": "Refined scope",
              "origin": "PRD §1.2",
              "issue_type": "Story",
              "story_points": 5,
              "priority": "High",
              "invest_validation": {
                "independent": true,
                "negotiable": true,
                "valuable": true,
                "estimable": true,
                "small": true,
                "testable": true,
                "invest_notes": "Meets INVEST criteria strictly."
              },
              "acceptance_criteria": [
                {
                  "scenario": "Successful receipt parsing",
                  "given": "Precondition",
                  "when": "Action",
                  "then": "Outcome"
                }
              ],
              "tasks": [
                {"title": "Implement Document AI client", "task_type": "DEV", "effort_days": 2.0},
                {"title": "Automated test suite", "task_type": "QA", "effort_days": 1.0}
              ]
            }
          ]
        }
      ]
    }"""

    po_decomp = ProductOwnerDecomposition(epics=[
        DecomposedEpic(
            title="Automated Claims Ingestion",
            description="Scope",
            stories=[
                DecomposedUserStory(
                    title="As a claims adjuster, I want OCR so that items are digitized",
                    description="Scope",
                    origin="PRD",
                    acceptance_criteria=[{"scenario": "Parse", "given": "G", "when": "W", "then": "T"}],
                    non_functional_constraints=[]
                )
            ]
        )
    ])

    agent = TechnicalScrumMasterAgent()
    plan = agent.refine_and_plan_sprint(
        project_name="Claims Automation",
        po_decomposition=po_decomp,
        sprint_guidelines={"definition_of_ready": ["INVEST valid"]}
    )

    assert plan.total_stories == 1
    assert plan.total_points == 5
    story = plan.validated_epics[0]["stories"][0]
    assert story["story_points"] in VALID_FIBONACCI
    assert story["priority"] in ["High", "Medium", "Low"]
    assert story["issue_type"] == "Story"
    assert story["invest_validation"]["valuable"] is True
    assert len(story["tasks"]) >= 1

@patch("packages.agents.src.agile_scrum_agents.requirements_pipeline.run_pipeline")
def test_decompose_api_endpoint(mock_pipeline):
    mock_pipeline.return_value = RequirementDecompositionResponse(
        project_id="proj-claims-auto",
        project_name="Claims Automation",
        sprint_goal="Automate claims",
        orchestrator_strategy=LeadOrchestratorStrategy(
            project_name="Claims Automation",
            core_problem_statement="Problem",
            target_audience=["Adjuster"],
            key_functional_themes=["Theme"],
            execution_strategy={},
            sprint_guidelines={}
        ),
        po_decomposition=ProductOwnerDecomposition(epics=[]),
        technical_sprint_plan=TechnicalSprintPlan(validated_epics=[], total_stories=3, total_points=13),
        total_epics=1,
        total_stories=3,
        total_points=13
    )

    res = client.post("/v1/ingest/proj-claims-auto/decompose", json={
        "raw_requirements": "Requirement text",
        "sprint_goal": "Goal text"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["project_id"] == "proj-claims-auto"
    assert data["total_stories"] == 3
    assert data["total_points"] == 13
    assert "orchestrator_strategy" in data
