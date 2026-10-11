import pytest
from fastapi.testclient import TestClient
from apps.api.src.main import app

client = TestClient(app)

def test_health_check():
    res = client.get("/healthz")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "HEALTHY"

def test_root():
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["service"] == "AI Scrum Master Core API"

def test_projects_crud():
    import uuid
    test_key = f"T{uuid.uuid4().hex[:4].upper()}"
    payload = {
        "name": "E2E Test Project",
        "key": test_key,
        "description": "Integration test project",
        "mode": "ENTERPRISE_SYNC",
        "jira_settings": {"enabled": True, "instance_url": "https://test.atlassian.net", "project_key": test_key},
        "git_settings": {"enabled": True, "repo_url": "https://github.com/org/test-repo"},
        "notebooklm_settings": {"enabled": True, "notebook_id": "nb-test-01"}
    }
    create_res = client.post("/v1/projects", json=payload)
    assert create_res.status_code == 200
    created = create_res.json()
    assert created["key"] == test_key
    project_id = created["id"]

    get_res = client.get(f"/v1/projects/{project_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "E2E Test Project"

    list_res = client.get("/v1/projects")
    assert list_res.status_code == 200
    assert any(p["id"] == project_id for p in list_res.json())

def test_document_ingestion():
    payload = {
        "project_id": "proj-claims-auto",
        "file_name": "Claims_Automation_PRD_v1.pdf",
        "use_sample_doc": True
    }
    res = client.post("/v1/ingest", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["personas"]) >= 3
    assert len(data["capabilities"]) >= 3
    assert len(data["clauses"]) >= 4

def test_backlog_and_questions():
    p_id = "proj-claims-auto"
    gen_res = client.post("/v1/backlog/generate", json={"project_id": p_id, "clarifications": {"q1": "PDF 25MB"}})
    assert gen_res.status_code == 200
    backlog = gen_res.json()
    assert backlog["total_epics"] >= 1

    get_res = client.get(f"/v1/backlog/{p_id}")
    assert get_res.status_code == 200

    q_res = client.get(f"/v1/backlog/questions/{p_id}")
    assert q_res.status_code == 200
    questions = q_res.json()
    assert len(questions) >= 1

    # Resolve question
    resolve_res = client.post("/v1/backlog/questions/resolve", json={
        "question_id": questions[0]["id"],
        "resolved_answer": "PDF, JPG, PNG max 25MB",
        "resolved_by": "Product Owner"
    })
    assert resolve_res.status_code == 200
    assert resolve_res.json()["resolved"] is True

def test_sprints_and_spillovers():
    p_id = "proj-claims-auto"
    res = client.get(f"/v1/sprints/{p_id}")
    assert res.status_code == 200
    sprint = res.json()
    assert sprint["planned_points"] > 0

    commit_res = client.post("/v1/sprints/commit", json={
        "project_id": p_id,
        "sprint_id": sprint["id"],
        "goal": "Test Sprint Goal Commitment",
        "committed_story_ids": ["STY-102"]
    })
    assert commit_res.status_code == 200

    spill_res = client.get(f"/v1/sprints/{p_id}/spillovers")
    assert spill_res.status_code == 200
    assert isinstance(spill_res.json(), list)

def test_meeting_intelligence():
    p_id = "proj-claims-auto"
    payload = {
        "project_id": p_id,
        "meeting_type": "STANDUP",
        "transcript_text": "Alex finished OCR. David is blocked on PAY-142. Team agreed to deploy hotfix tomorrow."
    }
    res = client.post("/v1/meetings/extract", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert len(data["decisions"]) >= 1
    assert len(data["blockers"]) >= 1

def test_risks_and_dag():
    p_id = "proj-claims-auto"
    dag_res = client.get(f"/v1/risks/dag/{p_id}")
    assert dag_res.status_code == 200
    assert len(dag_res.json()["nodes"]) >= 4

    health_res = client.get(f"/v1/risks/health/{p_id}")
    assert health_res.status_code == 200
    assert len(health_res.json()["dimensions"]) == 5

def test_git_tracker_and_flash():
    p_id = "proj-claims-auto"
    flash_res = client.get(f"/v1/git-tracker/{p_id}/flash")
    assert flash_res.status_code == 200
    assert flash_res.json()["status"] in ["ON_TRACK", "AT_RISK", "OFF_TRACK"]

    commits_res = client.get(f"/v1/git-tracker/{p_id}/commits")
    assert commits_res.status_code == 200
    assert len(commits_res.json()) >= 1

def test_governance_and_audit():
    p_id = "proj-claims-auto"
    # Seed an approval if none
    from packages.agents.src.orchestrator import orchestrator
    orchestrator.create_pending_approval(p_id, "Test Approval", "Summary", "Obs", "Impact", "Action", "STORY", "STY-1")

    apps_res = client.get(f"/v1/governance/approvals/{p_id}")
    assert apps_res.status_code == 200
    approvals = apps_res.json()
    assert len(approvals) >= 1

    act_res = client.post("/v1/governance/approvals/action", json={
        "approval_id": approvals[0]["id"],
        "action": "APPROVE",
        "review_notes": "Looks solid"
    })
    assert act_res.status_code == 200
    assert act_res.json()["status"] == "APPROVED"

    log_res = client.get(f"/v1/governance/activity/{p_id}")
    assert log_res.status_code == 200
    assert len(log_res.json()) >= 1

def test_knowledge_and_notebooklm():
    p_id = "proj-claims-auto"
    # Ensure a knowledge item is indexed for the test
    client.post("/v1/knowledge/items", json={
        "id": "know-test-1",
        "project_id": p_id,
        "title": "Vendor API Integration Notes",
        "content": "PAY-142 is blocked because the vendor API schema contract was delayed by 3 days.",
        "source_type": "MEETING_DECISION",
        "source_uri": "https://notebooklm.google.com/notebook/nb-claims-auto-01"
    })

    nb_res = client.get(f"/v1/knowledge/notebooklm/{p_id}")
    assert nb_res.status_code == 200
    assert "notebooklm.google.com" in nb_res.json()["notebook_url"]

    search_res = client.post("/v1/knowledge/search", json={
        "project_id": p_id,
        "query": "Why is PAY-142 blocked?"
    })
    assert search_res.status_code == 200
    data = search_res.json()
    assert "blocked" in data["answer"].lower()
    assert len(data["citations"]) >= 1

def test_reports_executive():
    p_id = "proj-claims-auto"
    res = client.get(f"/v1/reports/{p_id}/executive")
    assert res.status_code == 200
    data = res.json()
    assert data["completion_rate_pct"] >= 0.0
    assert len(data["key_accomplishments"]) >= 2
    assert "Executive Report" in data["markdown_content"]
