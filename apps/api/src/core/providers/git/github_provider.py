import logging
import requests
import re
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from apps.api.src.core.providers.base import BaseGitProvider
from apps.api.src.schemas.git_telemetry import GitCommit, PullRequest
from apps.api.src.core.config import settings

logger = logging.getLogger("github_provider")

class GitHubTrackerProvider(BaseGitProvider):
    def __init__(self, repo_url: Optional[str] = None, repo_owner: Optional[str] = None, repo_name: Optional[str] = None, access_token: Optional[str] = None, api_base: Optional[str] = None):
        self.repo_url = repo_url
        self.repo_owner = repo_owner
        self.repo_name = repo_name
        self.access_token = access_token or settings.GITHUB_TOKEN
        self.api_base = (api_base or settings.GITHUB_API_BASE).rstrip("/")

        # Parse owner and repo from URL if not explicitly given
        if self.repo_url and (not self.repo_owner or not self.repo_name):
            match = re.search(r"github\.com[/:]([^/]+)/([^/.]+)", self.repo_url)
            if match:
                self.repo_owner = match.group(1)
                self.repo_name = match.group(2)

    def _is_configured(self) -> bool:
        return bool(self.repo_owner and self.repo_name)

    def fetch_repository_full_context(self, repo_url: Optional[str] = None, default_branch: Optional[str] = None) -> Dict[str, Any]:
        """
        Fetch full repository content: README.md, recursive file tree, key configs
        (package.json, workflows), commits, and PRs via GitHub REST API.
        """
        target_url = repo_url or self.repo_url or ""
        owner = self.repo_owner
        repo = self.repo_name

        if target_url and (not owner or not repo):
            match = re.search(r"github\.com[/:]([^/]+)/([^/.]+)", target_url)
            if match:
                owner = match.group(1)
                repo = match.group(2).removesuffix(".git")

        if not owner or not repo:
            logger.info("GitHub repository owner/repo not resolvable; returning empty context.")
            return {}

        headers = {
            "User-Agent": "AI-Scrum-Master",
            "Accept": "application/vnd.github.v3+json"
        }
        if self.access_token:
            headers["Authorization"] = f"token {self.access_token}"

        result: Dict[str, Any] = {
            "owner": owner,
            "repo_name": repo,
            "repo_url": target_url or f"https://github.com/{owner}/{repo}",
            "readme_content": "",
            "file_tree": [],
            "key_files": {},
            "recent_commits": [],
            "pull_requests": [],
            "content_length": 0,
            "default_branch": default_branch or "main",
            "description": ""
        }

        # 1. Fetch repo metadata
        try:
            r_meta = requests.get(f"{self.api_base}/repos/{owner}/{repo}", headers=headers, timeout=6)
            if r_meta.status_code == 200:
                meta = r_meta.json()
                result["description"] = meta.get("description") or ""
                result["default_branch"] = meta.get("default_branch") or result["default_branch"]
                result["language"] = meta.get("language")
                result["topics"] = meta.get("topics", [])
                result["open_issues_count"] = meta.get("open_issues_count", 0)
        except Exception as e:
            logger.warning(f"Failed to fetch GitHub repo metadata for {owner}/{repo}: {e}")

        branch = result["default_branch"]

        # 2. Fetch full raw README
        try:
            r_readme = requests.get(
                f"{self.api_base}/repos/{owner}/{repo}/readme",
                headers={**headers, "Accept": "application/vnd.github.raw"},
                timeout=8
            )
            if r_readme.status_code == 200:
                result["readme_content"] = r_readme.text
                result["content_length"] = len(r_readme.text)
        except Exception as e:
            logger.warning(f"Failed to fetch GitHub README for {owner}/{repo}: {e}")

        # 3. Fetch recursive file tree
        try:
            r_tree = requests.get(
                f"{self.api_base}/repos/{owner}/{repo}/git/trees/{branch}?recursive=1",
                headers=headers,
                timeout=10
            )
            if r_tree.status_code == 200:
                tree_items = r_tree.json().get("tree", [])
                file_paths = [item.get("path") for item in tree_items if item.get("type") == "blob" and item.get("path")]
                result["file_tree"] = file_paths[:500]
        except Exception as e:
            logger.warning(f"Failed to fetch GitHub tree for {owner}/{repo}: {e}")

        # 4. Fetch key manifest files (package.json, workflows, etc.)
        candidates = ["package.json", "requirements.txt", "pyproject.toml", ".github/workflows/deploy.yml"]
        for cpath in candidates:
            if result["file_tree"] and cpath not in result["file_tree"]:
                continue
            try:
                r_file = requests.get(
                    f"{self.api_base}/repos/{owner}/{repo}/contents/{cpath}",
                    headers={**headers, "Accept": "application/vnd.github.raw"},
                    timeout=5
                )
                if r_file.status_code == 200:
                    result["key_files"][cpath] = r_file.text[:4000]
            except Exception:
                pass

        # 5. Fetch recent commits
        try:
            r_commits = requests.get(
                f"{self.api_base}/repos/{owner}/{repo}/commits?per_page=15",
                headers=headers,
                timeout=6
            )
            if r_commits.status_code == 200:
                commits_data = []
                for c in r_commits.json():
                    c_commit = c.get("commit", {})
                    msg = c_commit.get("message", "").strip()
                    author_name = c_commit.get("author", {}).get("name", "Developer")
                    c_date = c_commit.get("author", {}).get("date", "")
                    sha = c.get("sha", "")[:7]
                    keys = list(set(re.findall(r"\[?([A-Z]{2,6}-\d+)\]?", msg)))
                    commits_data.append({
                        "sha": sha,
                        "message": msg.split("\n")[0],
                        "full_message": msg,
                        "author": author_name,
                        "date": c_date,
                        "linked_issues": keys
                    })
                result["recent_commits"] = commits_data
        except Exception as e:
            logger.warning(f"Failed to fetch GitHub commits for {owner}/{repo}: {e}")

        # 6. Fetch pull requests
        try:
            r_prs = requests.get(
                f"{self.api_base}/repos/{owner}/{repo}/pulls?state=all&per_page=10",
                headers=headers,
                timeout=6
            )
            if r_prs.status_code == 200:
                prs_data = []
                for pr in r_prs.json():
                    prs_data.append({
                        "number": pr.get("number"),
                        "title": pr.get("title"),
                        "state": pr.get("state"),
                        "author": pr.get("user", {}).get("login"),
                        "created_at": pr.get("created_at"),
                        "url": pr.get("html_url")
                    })
                result["pull_requests"] = prs_data
        except Exception as e:
            logger.warning(f"Failed to fetch GitHub PRs for {owner}/{repo}: {e}")

        return result

    def get_recent_commits(self, project_id: str, since_hours: int = 48) -> List[GitCommit]:
        if self._is_configured():
            try:
                url = f"{self.api_base}/repos/{self.repo_owner}/{self.repo_name}/commits"
                headers = {"Accept": "application/vnd.github.v3+json"}
                if self.access_token:
                    headers["Authorization"] = f"token {self.access_token}"

                # First try fetching commits within the specified window
                since_iso = (datetime.utcnow() - timedelta(hours=since_hours)).isoformat() + "Z"
                res = requests.get(url, headers=headers, params={"since": since_iso, "per_page": 30}, timeout=5)
                raw_commits = res.json() if res.status_code == 200 else []

                # If no commits in window, fetch the latest 10 commits from the repository
                if not raw_commits:
                    res_latest = requests.get(url, headers=headers, params={"per_page": 10}, timeout=5)
                    if res_latest.status_code == 200 and isinstance(res_latest.json(), list):
                        raw_commits = res_latest.json()

                results = []
                for rc in raw_commits:
                    msg = rc.get("commit", {}).get("message", "")
                    keys = re.findall(r"\[?([A-Z]{2,6}-\d+)\]?", msg)
                    dt_str = rc.get("commit", {}).get("author", {}).get("date", "")
                    c_dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00")) if dt_str else datetime.utcnow()
                    results.append(GitCommit(
                        sha=rc.get("sha", "")[:7],
                        author_name=rc.get("commit", {}).get("author", {}).get("name", "Developer"),
                        author_email=rc.get("commit", {}).get("author", {}).get("email", "dev@example.com"),
                        message=msg,
                        timestamp=c_dt,
                        branch="main",
                        linked_issue_keys=list(set(keys))
                    ))
                if results:
                    return results
            except Exception as e:
                logger.warning(f"Failed to fetch live GitHub commits: {e}")

        # Deterministic fallback commits for local development and offline mock
        now = datetime.utcnow()
        return [
            GitCommit(
                sha="7f3b89a",
                author_name="Developer",
                author_email="dev@company.com",
                message="feat(core): Initial commit for sprint task [TSK-301]",
                timestamp=now - timedelta(hours=2),
                branch="main",
                linked_issue_keys=["TSK-301"]
            )
        ]

    def get_pull_requests(self, project_id: str, state: str = "open") -> List[PullRequest]:
        if self._is_configured():
            try:
                url = f"{self.api_base}/repos/{self.repo_owner}/{self.repo_name}/pulls"
                headers = {"Accept": "application/vnd.github.v3+json"}
                if self.access_token:
                    headers["Authorization"] = f"token {self.access_token}"

                res = requests.get(url, headers=headers, params={"state": state, "per_page": 10}, timeout=5)
                if res.status_code == 200:
                    raw_prs = res.json()
                    results = []
                    for pr in raw_prs:
                        title = pr.get("title", "")
                        keys = re.findall(r"\[?([A-Z]{2,6}-\d+)\]?", title)
                        created_dt = datetime.fromisoformat(pr.get("created_at", "").replace("Z", "+00:00")) if pr.get("created_at") else datetime.utcnow()
                        updated_dt = datetime.fromisoformat(pr.get("updated_at", "").replace("Z", "+00:00")) if pr.get("updated_at") else None
                        results.append(PullRequest(
                            number=pr.get("number", 0),
                            title=title,
                            state=pr.get("state", "open"),
                            author=pr.get("user", {}).get("login", "developer"),
                            draft=pr.get("draft", False),
                            linked_issue_keys=list(set(keys)),
                            created_at=created_dt,
                            updated_at=updated_dt,
                            review_status="APPROVED" if pr.get("state") == "closed" else "PENDING",
                            ci_status="SUCCESS"
                        ))
                    return results
            except Exception as e:
                logger.warning(f"Failed to fetch live GitHub PRs: {e}")
        return []
