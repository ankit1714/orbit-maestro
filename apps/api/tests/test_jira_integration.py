import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from apps.api.src.main import app
from apps.api.src.core.providers.backlog.jira_provider import JiraBacklogProvider
from apps.api.src.core.firestore_client import db
from scripts.seed_project_data import seed

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    # Tests should not seed demo data into live Firestore
    pass

def test_jira_adf_builder():
    provider = JiraBacklogProvider(
        instance_url="https://test.atlassian.net",
        user_email="dev@test.com",
        api_token="dummy-token",
        project_key="TEST"
    )
    adf = provider._build_adf_doc("Test description text", ["Note 1", "Note 2"])
    assert adf["type"] == "doc"
    assert adf["version"] == 1
    assert len(adf["content"]) >= 3
    assert adf["content"][0]["content"][0]["text"] == "Test description text"
    assert adf["content"][1]["content"][0]["text"] == "Note 1"

def test_jira_check_connection_mocked():
    provider = JiraBacklogProvider(
        instance_url="https://test.atlassian.net",
        user_email="dev@test.com",
        api_token="dummy-token",
        project_key="TEST"
    )
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "displayName": "Test Engineer",
        "emailAddress": "dev@test.com",
        "accountId": "acc-12345",
        "timeZone": "UTC"
    }

    with patch("requests.get", return_value=mock_response):
        res = provider.check_connection()
        assert res["connected"] is True
        assert res["display_name"] == "Test Engineer"
        assert res["email"] == "dev@test.com"

def test_jira_create_epic_mocked():
    provider = JiraBacklogProvider(
        instance_url="https://test.atlassian.net",
        user_email="dev@test.com",
        api_token="dummy-token",
        project_key="TEST"
    )
    mock_post = MagicMock()
    mock_post.status_code = 201
    mock_post.json.return_value = {"id": "10001", "key": "TEST-101"}

    with patch("requests.post", return_value=mock_post):
        epic = provider.create_epic("proj-claims-auto", "Test Jira Epic", "Test Description", "PRD §1.0")
        assert epic.key == "TEST-101"
        assert epic.title == "Test Jira Epic"

def test_jira_create_story_with_parent_mocked():
    provider = JiraBacklogProvider(
        instance_url="https://test.atlassian.net",
        user_email="dev@test.com",
        api_token="dummy-token",
        project_key="TEST"
    )
    # Create epic first with Jira key
    epic_doc = db.collection("epics").document("epic-test-01")
    epic_doc.set({
        "id": "epic-test-01",
        "project_id": "proj-claims-auto",
        "key": "TEST-101",
        "title": "Parent Epic",
        "description": "Parent Epic description",
        "requirement_origin": "PRD",
        "status": "TODO"
    })

    mock_post = MagicMock()
    mock_post.status_code = 201
    mock_post.json.return_value = {"id": "10002", "key": "TEST-102"}

    with patch("requests.post", return_value=mock_post) as mock_req:
        story = provider.create_story(
            project_id="proj-claims-auto",
            epic_id="epic-test-01",
            title="Child Story",
            description="Story details",
            points=5,
            ac_list=[{"scenario": "Login success", "given": "user exists", "when": "login", "then": "ok"}]
        )
        assert story.key == "TEST-102"
        # Verify parent key was passed to Jira payload
        call_kwargs = mock_req.call_args[1]
        fields = call_kwargs["json"]["fields"]
        assert fields["parent"]["key"] == "TEST-101"
        assert fields["issuetype"]["name"] == "Story"

def test_jira_api_status_endpoint():
    with patch.object(JiraBacklogProvider, "check_connection", return_value={"connected": True, "display_name": "Test User"}):
        res = client.get("/v1/backlog/jira/status")
        assert res.status_code == 200
        assert res.json()["connected"] is True

def test_jira_api_upload_endpoint_mocked():
    mock_sync_result = {
        "status": "SUCCESS",
        "project_id": "proj-claims-auto",
        "jira_project_key": "TEST",
        "jira_instance_url": "https://test.atlassian.net",
        "total_epics_synced": 1,
        "total_stories_synced": 1,
        "total_tasks_synced": 4,
        "epics": [{"id": "e1", "key": "TEST-1", "title": "Epic 1", "url": "https://test.atlassian.net/browse/TEST-1"}],
        "stories": [{"id": "s1", "key": "TEST-2", "title": "Story 1", "url": "https://test.atlassian.net/browse/TEST-2"}],
        "tasks": [{"id": "t1", "key": "TEST-3", "title": "Task 1", "url": "https://test.atlassian.net/browse/TEST-3"}],
        "errors": []
    }

    with patch.object(JiraBacklogProvider, "upload_project_backlog", return_value=mock_sync_result):
        res = client.post("/v1/backlog/proj-claims-auto/upload-jira", json={"project_key": "TEST"})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "SUCCESS"
        assert data["total_epics_synced"] == 1
        assert data["total_stories_synced"] == 1
        assert data["total_tasks_synced"] == 4
        assert len(data["epics"]) == 1

def test_upload_backlog_to_jira_with_custom_instance_url():
    from apps.api.src.core.firestore_client import db

    mock_sync_result = {
        "status": "SUCCESS",
        "project_id": "proj-claims-auto",
        "jira_project_key": "CUSTOM",
        "jira_instance_url": "https://custom-instance.atlassian.net",
        "total_epics_synced": 1,
        "total_stories_synced": 1,
        "total_tasks_synced": 2,
        "epics": [],
        "stories": [],
        "tasks": [],
        "errors": []
    }

    with patch.object(JiraBacklogProvider, "upload_project_backlog", return_value=mock_sync_result):
        res = client.post(
            "/v1/backlog/proj-claims-auto/upload-jira",
            json={
                "project_key": "CUSTOM",
                "instance_url": "https://custom-instance.atlassian.net/jira/software/projects/CUSTOM"
            }
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "SUCCESS"

        # Verify Firestore project document got updated
        proj_doc = db.collection("projects").document("proj-claims-auto").get()
        if proj_doc.exists:
            p_data = proj_doc.to_dict()
            assert p_data.get("jira_project_link") == "https://custom-instance.atlassian.net/jira/software/projects/CUSTOM"
            assert p_data.get("jira_settings", {}).get("instance_url") == "https://custom-instance.atlassian.net"
            assert p_data.get("jira_settings", {}).get("project_key") == "CUSTOM"



def test_skill_matching_and_developer_profiling():
    from packages.agents.src.backlog_agent import match_developer_by_skills

    team = [
        {"name": "Ankit Maurya", "skills": ["Python", "FastAPI", "Cloud Run", "Vertex AI"], "role": "Backend Engineer"},
        {"name": "Sarah Chen", "skills": ["React", "Next.js", "TypeScript", "UI Components"], "role": "Frontend Engineer"},
        {"name": "David Kim", "skills": ["QA", "Pytest", "Cypress", "Automation Testing"], "role": "QA Engineer"}
    ]

    dev_be, pct_be, rat_be = match_developer_by_skills("Build Document AI backend ingestion pipeline", "DEV", team)
    assert dev_be == "Ankit Maurya"
    assert pct_be >= 90
    assert "Vertex AI" in rat_be or "Backend" in rat_be

    dev_fe, pct_fe, rat_fe = match_developer_by_skills("Render interactive UI view components and forms", "DEV", team)
    assert dev_fe == "Sarah Chen"
    assert pct_fe >= 90
    assert "UI Components" in rat_fe or "Frontend" in rat_fe

    dev_qa, pct_qa, rat_qa = match_developer_by_skills("Boundary and regression test automation suites", "QA", team)
    assert dev_qa == "David Kim"
    assert pct_qa >= 90
    assert "QA" in rat_qa or "Automation" in rat_qa


def test_sync_jira_users_and_push_to_firestore():
    """
    Verify that sync-jira-users fetches assignable users for a project,
    matches existing Firestore users and appends project tags,
    creates new Firestore users for unfamiliar Jira accounts,
    and returns users marked with is_jira_project_user.
    """
    mock_jira_users = [
        {
            "accountId": "acc-dev-123",
            "displayName": "Alex Rivera",
            "emailAddress": "alex.rivera@example.com",
            "active": True
        },
        {
            "accountId": "acc-new-dev-456",
            "displayName": "Priya Sharma",
            "emailAddress": "priya.sharma@example.com",
            "active": True
        }
    ]

    with patch.object(JiraBacklogProvider, "fetch_jira_users", return_value=mock_jira_users):
        res = client.post(
            "/v1/projects/sync-jira-users",
            json={"project_key": "PROJ_ALPHA", "jira_link": "https://test.atlassian.net/browse/PROJ_ALPHA"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["project_key"] == "PROJ_ALPHA"
        assert data["synced_count"] == 2
        
        users = data["users"]
        assert len(users) >= 2
        
        # Verify Alex Rivera was matched or tagged
        alex = next((u for u in users if "alex" in u.get("email", "").lower() or "alex" in u.get("name", "").lower()), None)
        assert alex is not None
        assert "PROJ_ALPHA" in alex.get("project_ids", [])
        assert alex.get("is_jira_project_user") is True

        # Verify new user Priya Sharma was inserted into Firestore DB
        priya = next((u for u in users if "priya" in u.get("name", "").lower()), None)
        assert priya is not None
        assert "PROJ_ALPHA" in priya.get("project_ids", [])
        assert priya.get("is_jira_project_user") is True

        # Check directly in Firestore
        priya_doc = db.collection("users").document(priya["id"]).get()
        assert priya_doc.exists
        assert priya_doc.to_dict()["email"] == "priya.sharma@example.com"

def test_create_project_key_separate_from_jira_link():
    import uuid
    random_key = f"PK{uuid.uuid4().hex[:4].upper()}"
    payload = {
        "name": "Key Separation Test Project",
        "key": random_key,
        "description": "Testing that user key is preserved independently of Jira URL key",
        "jira_project_link": "https://company.atlassian.net/jira/software/projects/EXTRACTEDKEY/summary"
    }
    res = client.post("/v1/projects", json=payload)
    assert res.status_code == 200
    data = res.json()
    proj_id = data["id"]
    try:
        # User defined key must be preserved
        assert data["key"] == random_key
        # Jira settings receives the extracted Jira key
        assert data["jira_settings"]["project_key"] == "EXTRACTEDKEY"

        # Attempting to create another project with the same key must return 409 Conflict
        dup_res = client.post("/v1/projects", json=payload)
        assert dup_res.status_code == 409
        assert "already in use" in dup_res.json()["detail"]
    finally:
        client.delete(f"/v1/projects/{proj_id}")

