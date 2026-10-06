-- Spillover Risk & Predictive Trend Query
-- Analyzes the last N sprints for a given project to identify common spillover patterns.
SELECT
  project_id,
  sprint_id,
  sprint_name,
  planned_points,
  delivered_points,
  spillover_points,
  SAFE_DIVIDE(spillover_points, planned_points) * 100.0 AS spillover_rate_pct,
  blocked_tasks_count,
  cycle_time_avg_days,
  sprint_end_date,
  AVG(SAFE_DIVIDE(spillover_points, planned_points) * 100.0) 
    OVER(
      PARTITION BY project_id 
      ORDER BY sprint_end_date 
      ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) AS rolling_3_sprint_spillover_avg
FROM
  `scrum_delivery_analytics.sprint_snapshots`
WHERE
  project_id = @project_id
ORDER BY
  sprint_end_date DESC
LIMIT 10;
