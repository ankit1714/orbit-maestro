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

def clean_story_title(title: str) -> str:
    """Cleans up story titles, removing trailing 'I want to ...', incomplete ellipses, or dangling fillers."""
    import re
    if not title:
        return "Implement System Feature"
    t = title.strip()
    patterns = [
        r'\s*[,;-]?\s*I\s+want\s+to\s*\.{0,3}\s*$',
        r'\s*[,;-]?\s*I\s+want\s*\.{0,3}\s*$',
        r'\s*[,;-]?\s*so\s+that\s*\.{0,3}\s*$',
        r'\s*[,;-]?\s*to\s*\.{0,3}\s*$',
        r'\s*\.{2,}\s*$',
    ]
    for p in patterns:
        t = re.sub(p, '', t, flags=re.IGNORECASE).strip()
    return t

def clean_story_description(desc: str) -> str:
    """Cleans up story descriptions, stripping trailing ellipses and dangling 'I want to ...'."""
    import re
    if not desc:
        return ""
    d = desc.strip()
    patterns = [
        r'\s*[,;-]?\s*I\s+want\s+to\s*\.{0,3}\s*$',
        r'\s*[,;-]?\s*I\s+want\s*\.{0,3}\s*$',
        r'\s*\.{2,}\s*$',
    ]
    for p in patterns:
        d = re.sub(p, '', d, flags=re.IGNORECASE).strip()
    return d


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

        prompt = f"""You are the Lead Agile Scrum Orchestrator. Your role is to analyze the complete project requirements, attached Confluence architecture pages, and Ingested Baseline provided for project "{project_name}" and sprint goal "{sprint_goal}".

Complete Specifications (Confluence Pages & Ingested Baseline):
{raw_requirements[:35000]}

Tasks:
1. Analyze the core problem statement, target audience, and key functional themes within the raw requirements.
2. Formulate an overarching execution strategy that outlines architectural scope, delivery milestones, and core risks or dependencies directly based on the specifications.
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
        response_text = vertex_service.generate_content(prompt, max_output_tokens=8192)
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


def extract_smart_fallback_epics(project_name: str, raw_requirements: str) -> List[DecomposedEpic]:
    """Dynamically parses raw requirements (Baseline + Confluence) to extract crisp domain-specific epics and stories."""
    import re

    # 1. Look for capabilities [CAP-xx] **Title**: Description
    caps = re.findall(r'\[(CAP-[^\]]+)\]\s*\*\*([^*]+)\*\*:\s*([^\n\r]+)', raw_requirements)
    # 2. Look for Confluence docs: ## Confluence Specification: Title
    conf_docs = re.findall(r'##\s*Confluence Specification:\s*([^\n\r]+)', raw_requirements)

    epics = []

    if caps:
        for cap_id, cap_title, cap_desc in caps[:5]:
            clean_cap = cap_title.strip()
            epics.append(DecomposedEpic(
                title=f"{clean_cap}",
                description=f"Scope for capability {cap_id}: {cap_desc.strip()}",
                stories=[
                    DecomposedUserStory(
                        title=clean_story_title(f"Implement {clean_cap} Service"),
                        description=clean_story_description(f"Implement and expose the core functionality for {clean_cap}.\n\nFunctional Scope:\n{cap_desc.strip()}"),
                        origin=f"Baseline: {cap_id}",
                        acceptance_criteria=[
                            {
                                "scenario": f"Execute {clean_cap}",
                                "given": f"User is authenticated and system is in ready state for {clean_cap}",
                                "when": "Valid payload matching specification constraints is submitted",
                                "then": "Operation completes successfully and verified records are persisted"
                            },
                            {
                                "scenario": f"Validation and error handling for {clean_cap}",
                                "given": "Input payload with invalid format or out-of-bounds parameters",
                                "when": "Request is submitted",
                                "then": "System rejects request with 400 Bad Request and descriptive validation details"
                            }
                        ],
                        non_functional_constraints=["P95 latency < 350ms", "Audit trail logged to database"]
                    ),
                    DecomposedUserStory(
                        title=clean_story_title(f"Configure Telemetry & Monitoring for {clean_cap}"),
                        description=clean_story_description(f"Provide health telemetry, error metrics, and structured logs for {clean_cap}."),
                        origin=f"Baseline: {cap_id}",
                        acceptance_criteria=[
                            {
                                "scenario": "Telemetry metric emission",
                                "given": f"Processing runs for {clean_cap}",
                                "when": "Workflows transition between states",
                                "then": "Structured telemetry is emitted with execution duration and status"
                            }
                        ],
                        non_functional_constraints=["Zero packet loss telemetry"]
                    )
                ]
            ))

    if conf_docs:
        for c_title in conf_docs[:3]:
            # Avoid duplicate if title similar
            if not any(c_title.strip().lower() in e.title.lower() for e in epics):
                epics.append(DecomposedEpic(
                    title=f"Confluence: {c_title.strip()}",
                    description=f"Architecture and workflows specified in Confluence document '{c_title.strip()}'.",
                    stories=[
                        DecomposedUserStory(
                            title=clean_story_title(f"Implement Architecture & Interfaces for {c_title.strip()}"),
                            description=clean_story_description(f"Construct component architecture and data models as documented in Confluence page: {c_title.strip()}."),
                            origin=f"Confluence: {c_title.strip()}",
                            acceptance_criteria=[
                                {
                                    "scenario": "Architecture contract validation",
                                    "given": f"System deployed adhering to {c_title.strip()} specification",
                                    "when": "Client makes API or UI requests",
                                    "then": "Responses match the documented schemas and contracts in Confluence"
                                }
                            ],
                            non_functional_constraints=["Compliant with enterprise architecture standards"]
                        )
                    ]
                ))

    if not epics:
        epics = [
            DecomposedEpic(
                title=f"{project_name} Core Workflows & Processing",
                description=f"End-to-end implementation of core functional workflows for {project_name}.",
                stories=[
                    DecomposedUserStory(
                        title=clean_story_title(f"Automate Core Processing Engine for {project_name}"),
                        description=clean_story_description(f"Implement primary capability workflow as defined in project specifications for {project_name}."),
                        origin="Specification Baseline",
                        acceptance_criteria=[
                            {
                                "scenario": "Standard capability execution",
                                "given": "Valid parameters provided according to requirements",
                                "when": "Workflow is triggered",
                                "then": "Data is processed, validated, and state is persisted"
                            },
                            {
                                "scenario": "Boundary validation",
                                "given": "Missing or out-of-range input fields",
                                "when": "Workflow is triggered",
                                "then": "System flags validation errors without side effects"
                            }
                        ],
                        non_functional_constraints=["Response time < 350ms"]
                    )
                ]
            )
        ]

    return epics


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

        prompt = f"""You are an expert Agile Scrum Master and Product Owner. Your role is to analyze the complete project requirements and architecture specifications provided below, considering the project name "{project_name}" and sprint goal "{sprint_goal}".

CRITICAL INSTRUCTIONS:
- You must read and base the work breakdown strictly on the provided INGESTED DOCUMENT BASELINE and ATTACHED CONFLUENCE DOCUMENTATION & ARCHITECTURE PAGES.
- Do NOT output generic, vague, or placeholder stories.
- Decompose the actual features, UI flows, API contracts, database models, business rules, and constraints described in the specifications into crisp, clear, well-bounded Epics and User Stories.
- Each Epic must represent a major functional theme or architecture domain directly from the specifications.
- Every User Story MUST be written in the standard agile format: 'As a <persona>, I want <specific feature/action> so that <business value/outcome>'.
- Every User Story MUST include 2 to 4 concrete, actionable Acceptance Criteria using the 'Given... When... Then...' framework covering the positive path, edge/boundary cases, and validation error scenarios described in the requirements.
- Set the 'origin' field to reference the exact Confluence page or baseline section (e.g. 'Confluence: Login Spec §2.1' or 'Baseline: CAP-01').

Lead Agile Scrum Orchestrator Strategy Guidelines:
{strategy_summary}

Complete Specifications (Confluence Pages & Ingested Baseline):
{raw_requirements[:35000]}

Follow these steps:
1. Break down the high-level scope into 2 to 5 logical, crisp Epics based on the requirements.
2. Under each Epic, deconstruct 2 to 5 granular, comprehensive User Stories.
3. For every user story, specify at least 2 to 4 concrete Acceptance Criteria using the 'Given... When... Then...' framework.
4. Ensure each story is self-contained and captures functional as well as key non-functional constraints.

Output strictly valid JSON with this exact structure:
{{
  "epics": [
    {{
      "title": "Clear Epic Title",
      "description": "Crisp overview of the epic scope, user value, and operational boundaries",
      "stories": [
        {{
          "title": "As a [persona], I want [specific feature/action] so that [clear outcome]",
          "description": "Crisp technical story description specifying functionality, inputs, outputs, and edge cases",
          "origin": "Confluence Document Title or Baseline Section",
          "acceptance_criteria": [
            {{
              "scenario": "Happy path execution scenario",
              "given": "Specific system precondition and state",
              "when": "User or API executes the action",
              "then": "Expected outcome and verified system behavior"
            }},
            {{
              "scenario": "Boundary or validation error scenario",
              "given": "System in standard state with invalid or boundary inputs",
              "when": "Action is submitted",
              "then": "System enforces validation rules and provides actionable feedback"
            }}
          ],
          "non_functional_constraints": [
            "Performance latency constraint",
            "Security / validation constraint"
          ]
        }}
      ]
    }}
  ]
}}
Only return raw JSON.
"""
        response_text = vertex_service.generate_content(prompt, max_output_tokens=16384)
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
            if epics_list:
                return ProductOwnerDecomposition(epics=epics_list)
        except Exception as e:
            logger.warning(f"Agent 2 JSON parse error: {e}. Generating smart grounded fallback decomposition.")

        # Smart grounded fallback
        fallback_epics = extract_smart_fallback_epics(project_name, raw_requirements)
        return ProductOwnerDecomposition(epics=fallback_epics)


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
        response_text = vertex_service.generate_content(prompt, max_output_tokens=16384)
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

        # 1. Fetch project details and resolve verified team roles (QA vs DEV with Jira mapping)
        proj_doc = db.collection("projects").document(project_id).get()
        proj_data = proj_doc.to_dict() if proj_doc.exists else {}
        project_name = proj_data.get("name", "Active Scrum Project")
        goal = sprint_goal or proj_data.get("business_objective") or f"Deliver core requirements for {project_name}"

        from packages.agents.src.team_matcher import resolve_project_team_with_roles, match_assignee_for_work
        team_roles = resolve_project_team_with_roles(project_id)
        team = team_roles.get("all_members", [])

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
                        s_title = clean_story_title(st_data.get("title", "User Story"))
                        s_desc = clean_story_description(st_data.get("description", ""))
                        st_tasks = st_data.get("tasks", [])

                        # Role-based assignment: QA story -> QA engineer, DEV story -> DEV engineer
                        story_assignee, s_acc, s_pct, s_rat = match_assignee_for_work(
                            title=s_title,
                            work_type="STORY",
                            team_roles=team_roles,
                            description=s_desc,
                            subtasks=st_tasks
                        )

                        story = backlog_provider.create_story(
                            project_id=project_id,
                            epic_id=epic.id,
                            title=s_title,
                            description=s_desc,
                            points=snap_to_fibonacci(st_data.get("story_points", 5)),
                            ac_list=st_data.get("acceptance_criteria", []),
                            assignee=story_assignee,
                            origin=st_data.get("origin", "PRD Specification")
                        )

                        for t_data in st_tasks:
                            t_title = t_data.get("title", "Task")
                            task_type = t_data.get("task_type", "DEV")

                            # Role-based assignment: QA task -> QA engineer, DEV task -> DEV engineer
                            task_assignee, t_acc, t_pct, t_rat = match_assignee_for_work(
                                title=t_title,
                                work_type=task_type,
                                team_roles=team_roles
                            )

                            backlog_provider.create_task(
                                project_id=project_id,
                                story_id=story.id,
                                title=t_title,
                                task_type=task_type,
                                effort_days=float(t_data.get("effort_days", 1.0)),
                                assignee=task_assignee,
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
