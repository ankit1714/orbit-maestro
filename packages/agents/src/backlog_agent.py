import logging
import json
from typing import List, Dict, Any, Optional, Tuple
from apps.api.src.core.provider_factory import provider_factory
from apps.api.src.core.firestore_client import db
from apps.api.src.core.vertex_client import vertex_service
from apps.api.src.schemas.backlog import Epic, UserStory, TaskItem, BacklogHierarchyResponse

logger = logging.getLogger("backlog_agent")

def match_developer_by_skills(
    task_title: str,
    task_type: str,
    team_members: List[Dict[str, Any]],
    default_dev_name: str = "Developer"
) -> Tuple[str, int, str]:
    """
    Intelligently assigns a task/story to the team member whose technical skills and role
    best fit the task domain. Returns (assignee_name, skill_match_percentage, match_rationale).
    """
    import re
    if not team_members:
        return default_dev_name, 90, "Standard team allocation"

    task_lower = f"{task_title} {task_type}".lower()

    def contains_word(text: str, word: str) -> bool:
        return bool(re.search(r'\b' + re.escape(word) + r'\b', text, re.IGNORECASE))

    best_dev = team_members[0]
    best_score = -1
    matched_skills = []

    for dev in team_members:
        score = 0
        dev_skills = dev.get("skills", [])
        dev_role = dev.get("role", "").lower()
        dev_matched = []

        # 1. Role compatibility scoring
        if task_type == "QA":
            if any(contains_word(dev_role, w) for w in ["qa", "test", "quality", "automation"]):
                score += 10
        else: # DEV or STORY
            if any(contains_word(task_lower, w) for w in ["ui", "frontend", "react", "next", "css", "component", "web", "layout", "view"]):
                if any(contains_word(dev_role, w) for w in ["front", "frontend", "ui", "web"]):
                    score += 10
            if any(contains_word(task_lower, w) for w in ["api", "service", "backend", "database", "cloud", "model", "pipeline", "ingestion", "ai"]):
                if any(contains_word(dev_role, w) for w in ["back", "backend", "cloud", "architect", "lead", "fullstack"]):
                    score += 10

        # 2. Skill keyword matching
        for skill in dev_skills:
            s_clean = skill.lower()
            if contains_word(task_lower, s_clean):
                score += 6
                dev_matched.append(skill)
            else:
                for word in s_clean.split():
                    if len(word) >= 2 and contains_word(task_lower, word):
                        score += 3
                        dev_matched.append(skill)
                        break

        if score > best_score:
            best_score = score
            best_dev = dev
            matched_skills = dev_matched

    dev_name = best_dev.get("name", default_dev_name)
    dev_role = best_dev.get("role", "Developer")
    match_pct = min(98, 86 + (best_score * 2))
    skills_text = ", ".join(matched_skills[:3]) if matched_skills else ", ".join(best_dev.get("skills", ["Agile Delivery"])[:2])
    rationale = f"Assigned to {dev_name} ({dev_role}) matching skills: {skills_text}"

    return dev_name, match_pct, rationale

class BacklogDecompositionAgent:
    def synthesize_backlog(self, project_id: str, resolved_clarifications: Dict[str, str] = None) -> BacklogHierarchyResponse:
        logger.info(f"Backlog Agent synthesizing backlog for project: {project_id}")
        provider = provider_factory.get_backlog_provider(project_id)

        # 1. Fetch project and requirement data from Firestore
        proj_doc = db.collection("projects").document(project_id).get()
        proj_data = proj_doc.to_dict() if proj_doc.exists else {}
        project_name = proj_data.get("name", "Project Delivery")
        team = proj_data.get("team_members", [])

        req_doc = db.collection("requirements").document(f"req-{project_id}").get()
        req_data = req_doc.to_dict() if req_doc.exists else {}
        doc_title = req_data.get("document_title", f"{project_name} PRD")
        goal = req_data.get("business_goal") or proj_data.get("business_objective") or proj_data.get("description") or f"Deliver core capabilities for {project_name}"
        capabilities = req_data.get("capabilities", [])
        clauses = req_data.get("clauses", [])

        # Format team skills for Gemini prompt
        if team:
            team_profiles_str = "\n".join([
                f"- {m.get('name')} (Role: {m.get('role', 'Developer')}): Skills: {', '.join(m.get('skills', ['Fullstack', 'Cloud Run']))}"
                for m in team
            ])
        else:
            team_profiles_str = "- Lead Engineer: Python, FastAPI, Cloud Run, Vertex AI\n- QA Engineer: Pytest, Automation, Regression"

        # Fetch resolved clarifications
        q_docs = list(db.collection("open_questions").where("project_id", "==", project_id).stream())
        resolved_dict = {qd.to_dict().get("question"): qd.to_dict().get("resolved_answer") for qd in q_docs if qd.to_dict().get("resolved")}
        if resolved_clarifications:
            resolved_dict.update(resolved_clarifications)

        clarifications_str = "\n".join([f"- {k}: {v}" for k, v in resolved_dict.items()]) if resolved_dict else "Standard defaults apply."
        cap_str = "\n".join([f"- [{c.get('id', 'CAP')}]: {c.get('title')}: {c.get('description')} ({c.get('section_ref', 'PRD')})" for c in capabilities]) if capabilities else f"Core functionality for {project_name}"
        clause_str = "\n".join([f"- [{c.get('clause_id', 'CLS')} in {c.get('section_title', 'Requirement')}]: {c.get('text', '')}" for c in clauses[:12]]) if clauses else "Specification requirements."

        prompt = f"""You are the Agile Backlog Decomposition Agent for the AI Scrum Master.
Decompose the following Product Requirements Document into Epics, User Stories with Gherkin Acceptance Criteria, and technical Subtasks.

CRITICAL INSTRUCTIONS:
- You MUST generate 2-3 focused User Stories that are 100% SPECIFIC to the domain and requirements of "{project_name}".
- For each User Story, explicitly set "origin" to reference the exact capability or clause (e.g. "PRD §2.1: {capabilities[0].get('title') if capabilities else 'Core Spec'}").
- For each subtask, explicitly set "trace_ref" to reference the Acceptance Criteria (e.g. "AC-1", "AC-2").
- SKILL-MATCHED ASSIGNMENTS: Assign each story and subtask to the developer whose technical skills best match the deliverables.
- Keep descriptions and acceptance criteria focused so the complete JSON response finishes cleanly.

Project Name: {project_name}
Document Title: {doc_title}
Business Goal: {goal}

Available Development Team & Technical Skills:
{team_profiles_str}

System Capabilities:
{cap_str}

Requirement Clauses:
{clause_str}

Resolved Clarifications from Product Owner:
{clarifications_str}

Output strictly valid JSON with this exact structure:
{{
  "epic": {{
    "title": "Specific Epic Title for {project_name}",
    "description": "Comprehensive description matching the business goal",
    "origin": "{doc_title}"
  }},
  "stories": [
    {{
      "title": "As a [role], I want to [action in {project_name}] so that [benefit]",
      "description": "Technical narrative and implementation scope",
      "origin": "PRD §1: Core Capability",
      "points": 5,
      "assignee": "{team[0].get('name') if team else 'Developer'}",
      "acceptance_criteria": [
        {{
          "scenario": "Primary successful workflow",
          "given": "Specific preconditions from the requirement",
          "when": "User performs specific action",
          "then": "Expected specific outcome"
        }}
      ],
      "tasks": [
        {{
          "title": "Specific technical backend or frontend task",
          "task_type": "DEV",
          "effort_days": 2.0,
          "trace_ref": "AC-1",
          "assignee": "{team[0].get('name') if team else 'Developer'}"
        }},
        {{
          "title": "Automated verification test suite for this story",
          "task_type": "QA",
          "effort_days": 1.5,
          "trace_ref": "AC-1",
          "assignee": "{team[-1].get('name') if team else 'QA Engineer'}"
        }}
      ]
    }}
  ]
}}
Only return raw JSON.
"""

        llm_response = vertex_service.generate_content(prompt)
        parsed_backlog = None

        try:
            cleaned = llm_response.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            parsed_backlog = json.loads(cleaned.strip())
        except Exception as e:
            logger.warning(f"Could not parse Gemini JSON response for backlog: {e}; falling back to grounded decomposition")

        if parsed_backlog and "epic" in parsed_backlog and "stories" in parsed_backlog:
            e_data = parsed_backlog["epic"]
            epic = provider.create_epic(
                project_id=project_id,
                title=e_data.get("title", f"{project_name} Core Capabilities & Execution"),
                description=e_data.get("description", goal),
                origin=e_data.get("origin", doc_title)
            )

            for s_data in parsed_backlog.get("stories", []):
                s_title = s_data.get("title", f"As a user, I want core capabilities for {project_name}")
                raw_acs = s_data.get("acceptance_criteria") or s_data.get("ac", [])
                normalized_acs = []
                for ac in raw_acs:
                    if isinstance(ac, str):
                        normalized_acs.append({
                            "scenario": "Acceptance Criterion",
                            "given": ac,
                            "when": "Execution occurs",
                            "then": "Expected outcome met"
                        })
                    elif isinstance(ac, dict):
                        normalized_acs.append(ac)

                story_origin = s_data.get("origin") or s_data.get("requirement_origin") or f"{doc_title} §1.0"

                # Skill matching for User Story
                s_assignee, s_pct, s_rat = match_developer_by_skills(
                    task_title=s_title,
                    task_type="STORY",
                    team_members=team,
                    default_dev_name=s_data.get("assignee") or (team[0].get("name") if team else "Developer")
                )

                story = provider.create_story(
                    project_id=project_id,
                    epic_id=epic.id,
                    title=s_title,
                    description=s_data.get("description", ""),
                    points=int(s_data.get("points") or s_data.get("story_points") or 5),
                    ac_list=normalized_acs,
                    assignee=s_assignee,
                    origin=story_origin,
                    skill_match_percentage=s_pct,
                    skill_match_rationale=s_rat
                )

                # Normalize and Skill-Match Tasks
                raw_tasks = s_data.get("tasks", [])
                for idx, t_data in enumerate(raw_tasks):
                    if isinstance(t_data, str):
                        t_title = t_data
                        t_type = "QA" if "test" in t_data.lower() or "qa" in t_data.lower() else "DEV"
                        t_days = 1.5
                        t_trace = f"AC-{idx+1}"
                    elif isinstance(t_data, dict):
                        t_title = t_data.get("title", f"Task {idx+1}")
                        t_type = t_data.get("task_type") or t_data.get("type") or "DEV"
                        t_days = float(t_data.get("effort_days", 1.5))
                        t_trace = t_data.get("trace_ref") or f"AC-{idx+1}"
                    else:
                        continue

                    # Intelligent skill-matched developer assignment
                    t_assignee, t_pct, t_rat = match_developer_by_skills(
                        task_title=t_title,
                        task_type=t_type,
                        team_members=team,
                        default_dev_name=team[0].get("name") if team else "Developer"
                    )

                    provider.create_task(
                        project_id=project_id,
                        story_id=story.id,
                        title=t_title,
                        task_type=t_type,
                        effort_days=t_days,
                        assignee=t_assignee,
                        trace_ref=t_trace,
                        skill_match_percentage=t_pct,
                        skill_match_rationale=t_rat
                    )
        else:
            # Grounded fallback based on actual capabilities and developer skills
            epic_title = f"{project_name} Core Capabilities & Execution"
            epic = provider.create_epic(
                project_id=project_id,
                title=epic_title,
                description=goal,
                origin=doc_title
            )

            story_1_title = f"As a user, I want {capabilities[0].get('title', 'core ingestion') if capabilities else project_name} operational"
            story_1_origin = capabilities[0].get("section_ref", f"{doc_title} §1.0") if capabilities else f"{doc_title} §1.0"
            s1_assignee, s1_pct, s1_rat = match_developer_by_skills(story_1_title, "STORY", team)

            story_1 = provider.create_story(
                project_id=project_id,
                epic_id=epic.id,
                title=story_1_title,
                description=f"Implement primary capabilities for {project_name}.",
                points=8,
                ac_list=[
                    {
                        "scenario": "Standard Execution",
                        "given": f"A user is interacting with {project_name}",
                        "when": "A valid input request is submitted",
                        "then": "The request is processed and stored in the database"
                    }
                ],
                assignee=s1_assignee,
                origin=story_1_origin,
                skill_match_percentage=s1_pct,
                skill_match_rationale=s1_rat
            )

            # Tasks with skill matching
            t1_title = f"Build core services and backend APIs for {project_name}"
            t1_dev, t1_pct, t1_rat = match_developer_by_skills(t1_title, "DEV", team)
            provider.create_task(project_id, story_1.id, t1_title, "DEV", 3.0, t1_dev, trace_ref="AC-1", skill_match_percentage=t1_pct, skill_match_rationale=t1_rat)

            t2_title = "Configure validation rules and error handling"
            t2_dev, t2_pct, t2_rat = match_developer_by_skills(t2_title, "DEV", team)
            provider.create_task(project_id, story_1.id, t2_title, "DEV", 1.5, t2_dev, trace_ref="AC-1", skill_match_percentage=t2_pct, skill_match_rationale=t2_rat)

            t3_title = "Automated unit and integration test coverage"
            t3_dev, t3_pct, t3_rat = match_developer_by_skills(t3_title, "QA", team)
            provider.create_task(project_id, story_1.id, t3_title, "QA", 1.5, t3_dev, trace_ref="AC-1", skill_match_percentage=t3_pct, skill_match_rationale=t3_rat)

            # Story 2
            story_2_title = f"As an administrator, I can monitor telemetry and audit events for {project_name}"
            story_2_origin = capabilities[1].get("section_ref", f"{doc_title} §2.0") if len(capabilities) > 1 else f"{doc_title} §2.0"
            s2_assignee, s2_pct, s2_rat = match_developer_by_skills(story_2_title, "STORY", team)

            story_2 = provider.create_story(
                project_id=project_id,
                epic_id=epic.id,
                title=story_2_title,
                description="Provide real-time telemetry, audit logs, and performance tracking.",
                points=5,
                ac_list=[
                    {
                        "scenario": "Telemetry logging",
                        "given": "A project action is executed",
                        "when": "State transitions complete",
                        "then": "An immutable audit event is emitted to Firestore and BigQuery"
                    }
                ],
                assignee=s2_assignee,
                origin=story_2_origin,
                skill_match_percentage=s2_pct,
                skill_match_rationale=s2_rat
            )

            t4_title = "Telemetry integration and event streaming harness"
            t4_dev, t4_pct, t4_rat = match_developer_by_skills(t4_title, "DEV", team)
            provider.create_task(project_id, story_2.id, t4_title, "DEV", 2.0, t4_dev, trace_ref="AC-1", skill_match_percentage=t4_pct, skill_match_rationale=t4_rat)

            t5_title = "End-to-end regression validation"
            t5_dev, t5_pct, t5_rat = match_developer_by_skills(t5_title, "QA", team)
            provider.create_task(project_id, story_2.id, t5_title, "QA", 1.0, t5_dev, trace_ref="AC-1", skill_match_percentage=t5_pct, skill_match_rationale=t5_rat)

        return provider.get_backlog(project_id)

backlog_agent = BacklogDecompositionAgent()
