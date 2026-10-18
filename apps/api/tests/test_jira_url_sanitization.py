from unittest.mock import MagicMock
import pytest
from apps.api.src.core.providers.backlog.jira_provider import (
    clean_jira_instance_url,
    safe_err_text,
    JiraBacklogProvider,
)
from apps.api.src.core.providers.doc.confluence_provider import (
    clean_confluence_instance_url,
    ConfluenceDocProvider,
)

def test_clean_jira_instance_url():
    # Full browser UI project summary URL
    assert clean_jira_instance_url("https://test-domain.atlassian.net/jira/software/projects/IRIS/summary") == "https://test-domain.atlassian.net"

    # Issue browse URL
    assert clean_jira_instance_url("https://test-domain.atlassian.net/browse/SCRUM-123") == "https://test-domain.atlassian.net"

    # URL with trailing slashes
    assert clean_jira_instance_url("https://test-domain.atlassian.net///") == "https://test-domain.atlassian.net"

    # Clean domain
    assert clean_jira_instance_url("https://test-domain.atlassian.net") == "https://test-domain.atlassian.net"

    # No scheme provided
    assert clean_jira_instance_url("myorg.atlassian.net/jira/boards") == "https://myorg.atlassian.net"

    # Empty / None
    assert clean_jira_instance_url("") == ""
    assert clean_jira_instance_url(None) == ""

def test_clean_confluence_instance_url():
    # Bare Atlassian net domain -> adds /wiki
    assert clean_confluence_instance_url("https://test-domain.atlassian.net") == "https://test-domain.atlassian.net/wiki"
    assert clean_confluence_instance_url("https://test-domain.atlassian.net/") == "https://test-domain.atlassian.net/wiki"

    # Already has /wiki
    assert clean_confluence_instance_url("https://test-domain.atlassian.net/wiki") == "https://test-domain.atlassian.net/wiki"

    # Specific space / page path
    assert clean_confluence_instance_url("https://test-domain.atlassian.net/wiki/spaces/DEV/pages/12345") == "https://test-domain.atlassian.net/wiki"

def test_safe_err_text_with_html():
    mock_res = MagicMock()
    mock_res.status_code = 200
    mock_res.json.side_effect = Exception("Expecting value")
    mock_res.text = '<!doctype html><html><head><title>Jira</title></head><body id="jira" class="deferred adg3">Some long script content</body></html>'

    err = safe_err_text(mock_res)
    assert "[Jira] HTTP 200" in err
    assert "deferred adg3" not in err

def test_safe_err_text_with_json_errors():
    mock_res = MagicMock()
    mock_res.status_code = 400
    mock_res.json.return_value = {
        "errorMessages": ["Project does not exist."],
        "errors": {"summary": "Field is required"}
    }
    mock_res.text = '{"errorMessages":["Project does not exist."],"errors":{"summary":"Field is required"}}'

    err = safe_err_text(mock_res)
    assert "Project does not exist." in err
    assert "summary: Field is required" in err

def test_jira_provider_init_sanitizes_instance_url():
    provider = JiraBacklogProvider(
        instance_url="https://test-domain.atlassian.net/jira/software/projects/IRIS/summary",
        user_email="test@example.com",
        api_token="token123",
        project_key="IRIS"
    )
    assert provider.instance_url == "https://test-domain.atlassian.net"
