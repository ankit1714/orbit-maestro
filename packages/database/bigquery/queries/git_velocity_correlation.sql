-- Git Telemetry & Story Velocity Correlation Query
-- Correlates commit frequency, file churn, and PR cycle times with sprint velocity.
SELECT
  g.project_id,
  ARRAY_TO_STRING(g.linked_issue_keys, ', ') AS issue_keys,
  COUNT(g.commit_sha) AS total_commits,
  SUM(g.files_changed) AS total_files_changed,
  SUM(g.insertions) AS total_insertions,
  SUM(g.deletions) AS total_deletions,
  MIN(g.timestamp) AS first_commit_time,
  MAX(g.timestamp) AS latest_commit_time,
  TIMESTAMP_DIFF(MAX(g.timestamp), MIN(g.timestamp), HOUR) AS active_dev_hours
FROM
  `scrum_delivery_analytics.git_commit_telemetry` g
WHERE
  g.project_id = @project_id
GROUP BY
  g.project_id,
  issue_keys
ORDER BY
  latest_commit_time DESC;
