-- =============================================================================
-- ONE-TIME MIGRATION: persada_gantt_chart → gantt_tasks / gantt_links
-- =============================================================================
-- STATUS: *** ALREADY EXECUTED IN PRODUCTION (2026-07-10) ***
-- Kept here for reference and disaster-recovery re-import ONLY.
-- DO NOT run against production unless restoring from a fresh database.
-- =============================================================================
--
-- Source table: persada_gantt_chart (uploaded via Superset CSV import)
-- Columns used: workstream, task_name, start_date, end_date, progress,
--               task_type, assignee, status
--
-- Target: gantt_tasks (6 project parents + 78 tasks + 14 milestones = 98 rows)
--         gantt_links (empty — dependencies added manually in the Gantt UI)
-- =============================================================================

-- Step 0: Ensure status column exists
ALTER TABLE gantt_tasks ADD COLUMN IF NOT EXISTS status VARCHAR(50);

-- Step 1: Clear existing data (DESTRUCTIVE — only for fresh re-import)
TRUNCATE gantt_links, gantt_tasks RESTART IDENTITY;

-- Step 2: Insert one 'project' row per distinct workstream
INSERT INTO gantt_tasks (text, start_date, duration, progress, parent, type, sort_order, status)
SELECT
    workstream,
    MIN(start_date),
    GREATEST(EXTRACT(DAY FROM MAX(end_date) - MIN(start_date))::INTEGER, 1),
    0,
    0,
    'project',
    ROW_NUMBER() OVER (ORDER BY MIN(start_date), workstream),
    NULL
FROM persada_gantt_chart
GROUP BY workstream
ORDER BY MIN(start_date), workstream;

-- Step 3: Insert child tasks joined to their workstream parent
INSERT INTO gantt_tasks (text, start_date, duration, progress, parent, type, sort_order, assignee, status)
SELECT
    p.task_name,
    p.start_date,
    CASE
        WHEN LOWER(p.task_type) = 'milestone' THEN 0
        ELSE GREATEST(EXTRACT(DAY FROM p.end_date - p.start_date)::INTEGER, 1)
    END,
    COALESCE(p.progress, 0) / 100.0,
    parent.id,
    LOWER(p.task_type),
    ROW_NUMBER() OVER (PARTITION BY p.workstream ORDER BY p.start_date, p.task_name),
    NULLIF(TRIM(p.assignee), ''),
    NULLIF(TRIM(p.status), '')
FROM persada_gantt_chart p
JOIN gantt_tasks parent ON parent.text = p.workstream AND parent.type = 'project'
ORDER BY p.workstream, p.start_date, p.task_name;

-- =============================================================================
-- VERIFICATION (expected results after migration):
-- =============================================================================
-- SELECT type, COUNT(*) FROM gantt_tasks GROUP BY type;
--
--   type      | count
--   ----------+------
--   project   |     6
--   task      |    78
--   milestone |    14
-- =============================================================================
