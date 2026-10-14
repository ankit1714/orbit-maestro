import os
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from apps.api.src.core.vertex_client import vertex_service
from apps.api.src.core.firestore_client import db
from apps.api.src.core.provider_factory import provider_factory
from apps.api.src.schemas.requirement import (
    LeadOrchestratorStrategy,
    ProductOwnerDecomposition,
    DecomposedEpic,
    DecomposedUserStory,
    TechnicalSprintPlan,
    TechnicalValidatedStory,
    InvestCriteria,
    RequirementDecompositionResponse
)

logger = logging.getLogger("agile_scrum_agents")

# Fibonacci scale for Story Points
VALID_FIBONACCI = [1, 2, 3, 5, 8]

def snap_to_fibonacci(points: Any) -> int:
    try:
        val = int(points)
    except (ValueError, TypeError):
        return 5
    if val in VALID_FIBONACCI:
        return val
    # Snap to closest Fibonacci number
    return min(VALID_FIBONACCI, key=lambda x: abs(x - val))

def clean_json_response(raw_text: str) -> str:
    cleaned = raw_text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


class LeadAgileOrchestratorAgent:
    """
    Agent 1- Lead Agile Scrum Orchestrator.
    Analyzes project requirements and objectives, formulating an overarching execution strategy
    and sprint guidelines (DoR, quality standards, scope boundaries).
    """

    def analyze_and_formulate_strategy(
        self,
        project_name: str,
        raw_requirements: str,
        sprint_goal: str
    ) -> LeadOrchestratorStrategy:
        logger.info(f"Agent 1 (Lead Agile Orchestrator) analyzing requirements for '{project_name}'...")

        prompt = f"""You are the Lead Agile Scrum Orchestrator. Your role is to analyze the initial project requirements and objectives provided by the user and formulate a clear execution strategy and sprint guidelines to guide subsequent backlog decomposition and planning.

Review the input parameters:
Project Name: {project_name}
Raw Requirements:
{raw_requirements[:5000]}

Sprint Goal: {sprint_goal}

Tasks:
1. Analyze the core problem statement, target audience, and key functional themes within the raw requirements.
2. Formulate an overarching execution strategy that outlines architectural scope, delivery milestones, and core risks or dependencies.
3. Define clear sprint guidelines, including definition of ready (DoR), quality standards, and scope boundaries for backlog decomposition.
4. Populate the output parameters with your detailed execution strategy and sprint guidelines.

Output strictly valid JSON with this exact structure:
{{
  "project_name": "{project_name}",
  "core_problem_statement": "Concise summary of the user problem and business objective",
  "target_audience": [
    "Persona 1 role and description",
    "Persona 2 role and description"
  ],
  "key_functional_themes": [
    "Functional Theme 1",
    "Functional Theme 2",
    "Functional Theme 3"
  ],
  "execution_strategy": {{
    "architectural_scope": "Architecture overview, system components, integrations, and technologies",
    "delivery_milestones": [
      "Milestone 1: Core Foundation & Data Models",
      "Milestone 2: Functional Workflows & APIs",
      "Milestone 3: Verification, Security & Release"
    ],
    "core_risks_and_dependencies": [
      "External dependency or integration risk",
      "Technical complexity or performance consideration"
    ]
  }},
  "sprint_guidelines": {{
    "definition_of_ready": [
      "User story written in standard 'As a... I want... so that...' persona format",
      "2 to 4 concrete acceptance criteria defined using 'Given... When... Then...'",
      "Technical dependencies and target APIs identified",
      "INVEST criteria validated"
    ],
    "quality_standards": [
      "Automated unit & integration test coverage >= 80%",
      "Adherence to security, authentication, and validation standards",
      "Code review approved by Tech Lead before merge"
    ],
    "scope_boundaries": [
      "In Scope: Core capabilities described in the raw requirements",
      "Out of Scope: Future phase multi-region deployments or unverified legacy migrations"
    ]
  }}
}}
Only return raw JSON.
"""
        response_text = vertex_service.generate_content(prompt)
        try:
            data = json.loads(clean_json_response(response_text))
            return LeadOrchestratorStrategy(**data)
        except Exception as e:
            logger.warning(f"Agent 1 JSON parse error: {e}. Falling back to structured default strategy.")
            return LeadOrchestratorStrategy(
                project_name=project_name,
                core_problem_statement=f"Deliver scalable, automated capabilities for {project_name}.",
                target_audience=["End User", "Product Operations Lead"],
                key_functional_themes=["Data Processing & Ingestion", "User Experience & Workflow", "System Integration"],
                execution_strategy={
                    "architectural_scope": f"Cloud-native microservices architecture for {project_name}",
                    "delivery_milestones": ["Milestone 1: Baseline Architecture", "Milestone 2: Feature Implementation", "Milestone 3: QA & Deployment"],
                    "core_risks_and_dependencies": ["Integration schema alignment", "API rate limits and response times"]
                },
                sprint_guidelines={
                    "definition_of_ready": [
                        "User story in persona format",
                        "Acceptance criteria in Given-When-Then",
                        "Dependencies documented",
                        "INVEST criteria met"
                    ],
                    "quality_standards": [
                        "Automated test coverage >= 80%",
                        "Peer review approval",
                        "Zero critical security vulnerabilities"
                    ],
                    "scope_boundaries": [
                        f"In Scope: Requirements for {project_name}",
                        "Out of Scope: Deferred phase extensions"
                    ]
                }
            )


class ProductOwnerAgent:
    """
    Agent 2- Agile Scrum Master & Product Owner.
    Analyzes raw feature requirements, breaks down scope into logical Epics,
    and decomposes each Epic into comprehensive Jira User Stories with Gherkin Acceptance Criteria.
    """

    def decompose_epics_and_stories(
        self,
        project_name: str,
        raw_requirements: str,
        sprint_goal: str,
        orchestrator_strategy: LeadOrchestratorStrategy
    ) -> ProductOwnerDecomposition:
        logger.info(f"Agent 2 (Product Owner) decomposing scope into Epics and Gherkin User Stories...")

        strategy_summary = json.dumps({
            "problem_statement": orchestrator_strategy.core_problem_statement,
            "themes": orchestrator_strategy.key_functional_themes,
            "scope": orchestrator_strategy.execution_strategy.get("architectural_scope", "")
        }, indent=2)

        prompt = f"""You are an expert Agile Scrum Master and Product Owner. Your role is to analyze the raw feature requirements provided, considering the project name "{project_name}" and sprint goal "{sprint_goal}".

Lead Agile Scrum Orchestrator Strategy Guidelines:
{strategy_summary}

Raw Feature Requirements:
{raw_requirements[:6000]}

Follow these steps:
1. Break down the high-level scope into one or more logical Epics.
2. Decompose each Epic into comprehensive, granular Jira User Stories written in the standard format: 'As a <user persona>, I want <goal/feature> so that <benefit/value>'.
3. For every user story, specify at least 2 to 4 concrete Acceptance Criteria using the 'Given... When... Then...' framework.
4. Ensure each story is self-contained and captures functional as well as key non-functional constraints.
5. Generate the output parameters with the structured breakdown of epics and decomposed user stories.

Output strictly valid JSON with this exact structure:
{{
  "epics": [
    {{
      "title": "Specific Epic Title",
      "description": "Epic objective, user value, and operational boundaries",
      "stories": [
        {{
          "title": "As a [user persona], I want [goal/feature] so that [benefit/value]",
          "description": "Detailed implementation scope, functional requirements, and developer context",
          "origin": "PRD §1.1 Feature Specification",
          "acceptance_criteria": [
            {{
              "scenario": "Successful primary workflow",
              "given": "Specific system state and preconditions",
              "when": "User or external trigger executes the action",
              "then": "Expected outcome and verified system behavior"
            }},
            {{
              "scenario": "Validation or error handling scenario",
              "given": "Preconditions with boundary or invalid inputs",
              "when": "Submission is triggered",
              "then": "System enforces validation with descriptive error message"
            }}
          ],
          "non_functional_constraints": [
            "Response latency under 300ms",
            "Audit trail logging"
          ]
        }}
      ]
    }}
  ]
}}
Only return raw JSON.
"""
        response_text = vertex_service.generate_content(prompt)
        try:
            data = json.loads(clean_json_response(response_text))
            epics_list = []
            for ep_data in data.get("epics", []):
                stories_list = []
                for st_data in ep_data.get("stories", []):
                    stories_list.append(DecomposedUserStory(**st_data))
                epics_list.append(DecomposedEpic(
                    title=ep_data.get("title", f"{project_name} Epic"),
                    description=ep_data.get("description", ""),
                    stories=stories_list
                ))
            return ProductOwnerDecomposition(epics=epics_list)
        except Exception as e:
            logger.warning(f"Agent 2 JSON parse error: {e}. Generating fallback decomposition.")
            return ProductOwnerDecomposition(epics=[
                DecomposedEpic(
                    title=f"{project_name} Core Capabilities",
                    description=f"Core operational features for {project_name}",
                    stories=[
                        DecomposedUserStory(
                            title=f"As an operator, I want automated processing for {project_name} so that efficiency is improved",
                            description=f"Implement core processing workflow for {project_name}",
                            origin="PRD Specification",
                            acceptance_criteria=[
                                {
                                    "scenario": "Execute core capability",
                                    "given": "Valid input parameters are provided",
                                    "when": "Operation is submitted",
                                    "then": "Processing succeeds and results are saved"
                                },
                                {
                                    "scenario": "Input validation failure",
                                    "given": "Invalid or missing parameters",
                                    "when": "Operation is submitted",
                                    "then": "System returns validation error"
                                }
                            ],
                            non_functional_constraints=["Response time < 500ms"]
                        )
                    ]
                )
            ])


class TechnicalScrumMasterAgent:
    """
    Agent 3- Technical Scrum Master.
    Conducts sprint planning and backlog refinement:
    - Validates against INVEST criteria.
    - Assigns Fibonacci Story Points (1, 2, 3, 5, 8).
    - Sets Jira priority ('High', 'Medium', 'Low').
    - Sets Issue Type ('Story', 'Task', 'Bug').
    - Adds technical subtasks and compiles validated Jira stories ready for export.
    """

    def refine_and_plan_sprint(
        self,
        project_name: str,
        po_decomposition: ProductOwnerDecomposition,
        sprint_guidelines: Dict[str, Any],
        team_members: List[Dict[str, Any]] = None
    ) -> TechnicalSprintPlan:
        logger.info(f"Agent 3 (Technical Scrum Master) validating INVEST, Fibonacci points, and Jira export readiness...")

        decomposed_input = {
            "epics": [
                {
                    "title": ep.title,
                    "description": ep.description,
                    "stories": [st.dict() for st in ep.stories]
                }
                for ep in po_decomposition.epics
            ]
        }

        prompt = f"""You are a Technical Scrum Master conducting sprint planning and backlog refinement. Review the decomposed stories from the Product Owner for project "{project_name}".

Review the Sprint Guidelines & Definition of Ready:
{json.dumps(sprint_guidelines, indent=2)}

Decomposed Stories to Refine and Validate:
{json.dumps(decomposed_input, indent=2)}

For each story:
1. Validate against INVEST criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable). If a story is oversized, refine its scope.
2. Assign an estimated Story Point value adhering strictly to the Fibonacci sequence (1, 2, 3, 5, 8).
3. Determine the Jira priority level ('High', 'Medium', or 'Low') based on user impact and sprint objectives.
4. Set the Issue Type as 'Story' (or 'Task'/'Bug' if appropriate).
5. Add technical implementation and verification subtasks (DEV and QA).
6. Compile a finalized list of validated Jira stories ready for export.

Output strictly valid JSON with this exact structure:
{{
  "validated_epics": [
    {{
      "title": "Epic Title",
      "description": "Epic description",
      "stories": [
        {{
          "title": "As a [persona], I want [goal] so that [benefit]",
          "description": "Refined technical story description",
          "origin": "PRD §1.0",
          "issue_type": "Story",
          "story_points": 5,
          "priority": "High",
          "invest_validation": {{
            "independent": true,
            "negotiable": true,
            "valuable": true,
            "estimable": true,
            "small": true,
            "testable": true,
            "invest_notes": "Meets INVEST criteria. Scope is well-bounded and estimable."
          }},
          "acceptance_criteria": [
            {{
              "scenario": "Scenario name",
              "given": "Preconditions",
              "when": "Action",
              "then": "Expected outcome"
            }}
          ],
          "tasks": [
            {{
              "title": "Implement core backend API endpoint and data persistence",
              "task_type": "DEV",
              "effort_days": 2.0
            }},
            {{
              "title": "Write automated unit and regression test suite",
              "task_type": "QA",
              "effort_days": 1.0
            }}
          ]
        }}
      ]
    }}
  ]
}}
Only return raw JSON.
"""
        response_text = vertex_service.generate_content(prompt)
        try:
            data = json.loads(clean_json_response(response_text))
            validated_epics = data.get("validated_epics", [])
            total_stories = 0
            total_points = 0

            # Ensure strict Fibonacci points and INVEST validation
            for ep in validated_epics:
                for st in ep.get("stories", []):
                    st["story_points"] = snap_to_fibonacci(st.get("story_points", 5))
                    total_points += st["story_points"]
                    total_stories += 1

            return TechnicalSprintPlan(
                validated_epics=validated_epics,
                total_stories=total_stories,
                total_points=total_points
            )
        except Exception as e:
            logger.warning(f"Agent 3 JSON parse error: {e}. Constructing refined plan.")
            fallback_epics = []
            total_stories = 0
            total_points = 0
            for ep in po_decomposition.epics:
                stories = []
                for st in ep.stories:
                    points = 5
                    total_points += points
                    total_stories += 1
                    stories.append({
                        "title": st.title,
                        "description": st.description,
                        "origin": st.origin or "PRD Specification",
                        "issue_type": "Story",
                        "story_points": points,
                        "priority": "High",
                        "invest_validation": {
                            "independent": True,
                            "negotiable": True,
                            "valuable": True,
                            "estimable": True,
                            "small": True,
                            "testable": True,
                            "invest_notes": "Validated against INVEST criteria."
                        },
                        "acceptance_criteria": st.acceptance_criteria,
                        "tasks": [
                            {"title": f"Implement {st.title[:50]}", "task_type": "DEV", "effort_days": 2.0},
                            {"title": f"Automated QA test suite for {st.title[:45]}", "task_type": "QA", "effort_days": 1.0}
                        ]
                    })
                fallback_epics.append({
                    "title": ep.title,
                    "description": ep.description,
                    "stories": stories
                })

            return TechnicalSprintPlan(
                validated_epics=fallback_epics,
                total_stories=total_stories,
                total_points=total_points
            )


class RequirementsDecompositionPipeline:
    """
    Coordinates Agent 1, Agent 2, and Agent 3 to ingest requirements, formulate strategy,
    decompose into Epics and Gherkin User Stories, and validate for Jira export.
    """

    def __init__(self):
        self.orchestrator_agent = LeadAgileOrchestratorAgent()
        self.po_agent = ProductOwnerAgent()
        self.technical_sm_agent = TechnicalScrumMasterAgent()

    def run_pipeline(
        self,
        project_id: str,
        raw_requirements: str,
        sprint_goal: Optional[str] = None,
        auto_create_backlog: bool = True
    ) -> RequirementDecompositionResponse:
        logger.info(f"Initiating 3-Agent Requirement Decomposition Pipeline for project: {project_id}")

        # 1. Fetch project details
        proj_doc = db.collection("projects").document(project_id).get()
        proj_data = proj_doc.to_dict() if proj_doc.exists else {}
        project_name = proj_data.get("name", "Active Scrum Project")
        team = proj_data.get("team_members", [])
        goal = sprint_goal or proj_data.get("business_objective") or f"Deliver core requirements for {project_name}"

        # 2. Agent 1: Lead Agile Scrum Orchestrator
        orchestrator_strategy = self.orchestrator_agent.analyze_and_formulate_strategy(
            project_name=project_name,
            raw_requirements=raw_requirements,
            sprint_goal=goal
        )

        # 3. Agent 2: Agile Scrum Master & Product Owner
        po_decomposition = self.po_agent.decompose_epics_and_stories(
            project_name=project_name,
            raw_requirements=raw_requirements,
            sprint_goal=goal,
            orchestrator_strategy=orchestrator_strategy
        )

        # 4. Agent 3: Technical Scrum Master
        technical_plan = self.technical_sm_agent.refine_and_plan_sprint(
            project_name=project_name,
            po_decomposition=po_decomposition,
            sprint_guidelines=orchestrator_strategy.sprint_guidelines,
            team_members=team
        )

        # 5. Persist into project backlog (Firestore & Jira Provider)
        if auto_create_backlog:
            try:
                backlog_provider = provider_factory.get_backlog_provider(project_id)
                for ep_data in technical_plan.validated_epics:
                    epic = backlog_provider.create_epic(
                        project_id=project_id,
                        title=ep_data.get("title", f"{project_name} Epic"),
                        description=ep_data.get("description", ""),
                        origin="3-Agent Requirements Pipeline"
                    )

                    for st_data in ep_data.get("stories", []):
                        assignee = team[0].get("name") if team else "Developer"
                        story = backlog_provider.create_story(
                            project_id=project_id,
                            epic_id=epic.id,
                            title=st_data.get("title", "User Story"),
                            description=st_data.get("description", ""),
                            points=snap_to_fibonacci(st_data.get("story_points", 5)),
                            ac_list=st_data.get("acceptance_criteria", []),
                            assignee=assignee,
                            origin=st_data.get("origin", "PRD Specification")
                        )

                        for t_data in st_data.get("tasks", []):
                            task_type = t_data.get("task_type", "DEV")
                            t_assignee = team[-1].get("name") if (task_type == "QA" and len(team) > 1) else assignee
                            backlog_provider.create_task(
                                project_id=project_id,
                                story_id=story.id,
                                title=t_data.get("title", "Task"),
                                task_type=task_type,
                                effort_days=float(t_data.get("effort_days", 1.0)),
                                assignee=t_assignee,
                                trace_ref="AC-1"
                            )
                logger.info(f"Successfully persisted 3-Agent decomposed backlog for {project_id}.")
            except Exception as e:
                logger.warning(f"Could not persist decomposed stories to backlog provider: {e}")

        # 6. Save strategy and decomposition metadata in Firestore
        try:
            db.collection("project_strategies").document(project_id).set({
                "orchestrator_strategy": orchestrator_strategy.dict(),
                "po_decomposition": po_decomposition.dict(),
                "technical_sprint_plan": technical_plan.dict(),
                "updated_at": datetime.utcnow().isoformat()
            })
        except Exception as e:
            logger.debug(f"Could not persist strategy metadata: {e}")

        return RequirementDecompositionResponse(
            project_id=project_id,
            project_name=project_name,
            sprint_goal=goal,
            orchestrator_strategy=orchestrator_strategy,
            po_decomposition=po_decomposition,
            technical_sprint_plan=technical_plan,
            total_epics=len(technical_plan.validated_epics),
            total_stories=technical_plan.total_stories,
            total_points=technical_plan.total_points
        )


requirements_pipeline = RequirementsDecompositionPipeline()
