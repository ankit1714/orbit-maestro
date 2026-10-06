-- Velocity & Cycle Time Aggregation Query
-- Computes delivery cadence, mean lead time, and cycle time across completed tasks.
SELECT
  t.project_id,
  t.sprint_id,
  COUNT(t.task_id) AS completed_task_count,
  SUM(t.points) AS total_points_delivered,
  ROUND(AVG(t.cycle_time_hours), 2) AS avg_cycle_time_hours,
  ROUND(AVG(t.lead_time_hours), 2) AS avg_lead_time_hours,
  ROUND(AVG(COALESCE(t.blocked_duration_hours, 0)), 2) AS avg_blocked_hours,
  COUNTIF(t.reopen_count > 0) AS reopened_tasks_count
FROM
  `scrum_delivery_analytics.task_cycle_times` t
WHERE
  t.project_id = @project_id
GROUP BY
  t.project_id,
  t.sprint_id
ORDER BY
  t.sprint_id DESC;
