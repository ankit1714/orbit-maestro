import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from apps.api.src.core.firestore_client import db

logger = logging.getLogger("team_matcher")

def is_qa_text(text: str) -> bool:
    """Checks whether text refers to QA, testing, automation, validation, or verification."""
    qa_words = [
        "qa", "test", "testing", "regression", "verification",
        "validation", "e2e", "acceptance test", "playwright", "jest",
        "cypress", "selenium", "boundary test", "test suite", "quality"
    ]
    pattern = r'\b(' + '|'.join(qa_words) + r')\b'
    return bool(re.search(pattern, text, re.IGNORECASE))

def is_qa_role(role: str, skills: List[str] = None, name: str = "") -> bool:
    """Classifies if a person's role or skill profile belongs to QA."""
    combined = f"{role} {' '.join(skills or [])} {name}"
    return is_qa_text(combined)

def resolve_project_team_with_roles(project_id: str) -> Dict[str, Any]:
    """
    1. Fetches Jira users from Jira Cloud if configured.
    2. Fetches Project DB team members from Firestore (projects/{project_id}.team_members and users collection).
    3. Cross-references Jira users with Project DB users by email or displayName.
    4. Segregates engineers into QA vs DEV based on verified roles and skills.
    Returns:
    {
        "qa_engineers": [...],
        "dev_engineers": [...],
        "all_members": [...],
        "jira_map": { <email_or_name>: <jira_user_dict> }
    }
    """
    # 1. Fetch DB team members from project document
    proj_doc = db.collection("projects").document(project_id).get()
    proj_data = proj_doc.to_dict() if proj_doc.exists else {}
    db_members = list(proj_data.get("team_members", []))

    # Also check platform users collection
    platform_users = []
    try:
        for u in db.collection("users").stream():
            ud = u.to_dict()
            platform_users.append(ud)
    except Exception as e:
        logger.debug(f"Could not read platform users: {e}")

    # 2. Try fetching Jira Cloud users
    jira_users = []
    try:
        from apps.api.src.core.provider_factory import provider_factory
        from apps.api.src.core.providers.backlog.jira_provider import JiraBacklogProvider
        b_provider = provider_factory.get_backlog_provider(project_id)
        if isinstance(b_provider, JiraBacklogProvider) and b_provider._is_configured():
            jira_users = b_provider.fetch_jira_users()
    except Exception as e:
        logger.debug(f"Could not fetch Jira users: {e}")

    # Build Jira user lookup index by email and name
    jira_map: Dict[str, Any] = {}
    for ju in jira_users:
        if ju.get("emailAddress"):
            jira_map[ju["emailAddress"].lower().strip()] = ju
        if ju.get("displayName"):
            jira_map[ju["displayName"].lower().strip()] = ju

    # 3. Categorize into QA and DEV engineers
    qa_engineers = []
    dev_engineers = []
    seen_names = set()

    for m in db_members:
        name = m.get("name", "Engineer").strip()
        role = m.get("role", "Developer")
        email = m.get("email", "").strip().lower()
        skills = m.get("skills", [])
        seen_names.add(name.lower())

        # Check if this DB user matches in Jira
        ju = jira_map.get(email) or jira_map.get(name.lower())
        account_id = ju.get("accountId") if ju else None

        member_entry = {
            "name": name,
            "role": role,
            "email": email,
            "skills": skills,
            "account_id": account_id,
            "source": "DB_JIRA" if account_id else "DB"
        }

        if is_qa_role(role, skills, name):
            qa_engineers.append(member_entry)
        else:
            dev_engineers.append(member_entry)

    # 4. If Jira returned users that weren't in project DB team_members, incorporate them
    for ju in jira_users:
        j_name = ju.get("displayName", "").strip()
        j_email = ju.get("emailAddress", "").strip().lower()
        if not j_name or j_name.lower() in seen_names:
            continue

        matched_pu = next((pu for pu in platform_users if pu.get("email", "").lower() == j_email or pu.get("name", "").lower() == j_name.lower()), None)
        inferred_role = matched_pu.get("role", "") if matched_pu else ""
        skills = []

        if not inferred_role:
            if is_qa_text(j_name) or "qa" in j_email or "test" in j_email:
                inferred_role = "QA Engineer"
                skills = ["Testing", "Regression Automation"]
            else:
                inferred_role = "Software Engineer"
                skills = ["Backend", "Frontend", "APIs"]

        seen_names.add(j_name.lower())
        member_entry = {
            "name": j_name,
            "role": inferred_role,
            "email": j_email,
            "skills": skills,
            "account_id": ju.get("accountId"),
            "source": "JIRA"
        }

        if is_qa_role(inferred_role, skills, j_name):
            qa_engineers.append(member_entry)
        else:
            dev_engineers.append(member_entry)

    # 5. Fallback safety if one list is empty
    if not qa_engineers:
        qa_engineers.append({
            "name": "QA Automator",
            "role": "QA Engineer",
            "email": "qa@company.com",
            "skills": ["Automation", "Regression Testing", "Playwright", "Jest"],
            "account_id": None,
            "source": "FALLBACK"
        })

    if not dev_engineers:
        dev_engineers.append({
            "name": "Backend Lead",
            "role": "Backend / Fullstack Dev",
            "email": "dev@company.com",
            "skills": ["Python", "FastAPI", "Cloud Run", "React"],
            "account_id": None,
            "source": "FALLBACK"
        })

    logger.info(
        f"Resolved project team for {project_id}: {len(qa_engineers)} QA engineer(s) ({[q['name'] for q in qa_engineers]}), "
        f"{len(dev_engineers)} DEV engineer(s) ({[d['name'] for d in dev_engineers]}), {len(jira_users)} Jira user(s)"
    )

    return {
        "qa_engineers": qa_engineers,
        "dev_engineers": dev_engineers,
        "all_members": qa_engineers + dev_engineers,
        "jira_map": jira_map
    }

def match_assignee_for_work(
    title: str,
    work_type: str, # "STORY" or "DEV" or "QA"
    team_roles: Dict[str, Any],
    description: str = "",
    subtasks: List[Any] = None
) -> Tuple[str, Optional[str], int, str]:
    """
    Selects the best engineer based on role and technical skills.
    - QA stories / tasks -> QA engineer
    - DEV stories / tasks -> DEV engineer
    Returns (assignee_name, account_id, match_percentage, rationale)
    """
    qa_engineers = team_roles.get("qa_engineers", [])
    dev_engineers = team_roles.get("dev_engineers", [])

    is_qa = False
    if work_type == "QA":
        is_qa = True
    elif work_type == "DEV":
        is_qa = False
    else: # STORY
        is_qa = is_qa_text(f"{title} {description}")
        if not is_qa and subtasks:
            types = [t.get("task_type") or t.get("type") for t in subtasks if isinstance(t, dict)]
            if types and all(t == "QA" for t in types):
                is_qa = True

    candidate_pool = qa_engineers if is_qa else dev_engineers
    if not candidate_pool:
        candidate_pool = team_roles.get("all_members", [])

    # Intelligently score candidates against work title
    from packages.agents.src.backlog_agent import match_developer_by_skills
    best_name, match_pct, rationale = match_developer_by_skills(
        task_title=title,
        task_type="QA" if is_qa else "DEV",
        team_members=candidate_pool,
        default_dev_name=candidate_pool[0]["name"]
    )

    matched_candidate = next((c for c in candidate_pool if c["name"].lower() == best_name.lower()), candidate_pool[0])
    acc_id = matched_candidate.get("account_id")

    return best_name, acc_id, match_pct, rationale
