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
    seed()

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
