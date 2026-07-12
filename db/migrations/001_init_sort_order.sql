-- Migration 001: Initialize sort_order values
-- Status: ALREADY EXECUTED on 2026-07-12
-- Context: All tasks had sort_order=0, causing row reorder to not persist.
-- This sets sequential sort_order within each parent group.

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY parent ORDER BY id) - 1 AS new_order
  FROM gantt_tasks
)
UPDATE gantt_tasks SET sort_order = numbered.new_order
FROM numbered WHERE gantt_tasks.id = numbered.id;

-- Verification:
-- SELECT id, text, parent, sort_order FROM gantt_tasks ORDER BY parent, sort_order;
