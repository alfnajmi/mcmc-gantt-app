-- Gantt schema: two tables map 1:1 to DHTMLX data format.
-- Idempotent — safe to run on an existing database.

CREATE TABLE IF NOT EXISTS gantt_tasks (
    id          SERIAL PRIMARY KEY,
    text        VARCHAR(255) NOT NULL,
    start_date  TIMESTAMP NOT NULL,
    duration    INTEGER NOT NULL DEFAULT 1,       -- in days
    progress    REAL NOT NULL DEFAULT 0,          -- 0.0 to 1.0
    parent      INTEGER NOT NULL DEFAULT 0,       -- 0 = top level
    type        VARCHAR(20) DEFAULT 'task',       -- task | project | milestone
    sort_order  INTEGER NOT NULL DEFAULT 0,
    assignee    VARCHAR(100),
    status      VARCHAR(50),                      -- to do | planning | in progress | complete
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- Add status column for existing installs that predate this field.
ALTER TABLE gantt_tasks ADD COLUMN IF NOT EXISTS status VARCHAR(50);

CREATE TABLE IF NOT EXISTS gantt_links (
    id      SERIAL PRIMARY KEY,
    source  INTEGER NOT NULL REFERENCES gantt_tasks(id) ON DELETE CASCADE,
    target  INTEGER NOT NULL REFERENCES gantt_tasks(id) ON DELETE CASCADE,
    type    VARCHAR(1) NOT NULL DEFAULT '0'  -- 0=finish-to-start, 1=start-to-start, 2=finish-to-finish, 3=start-to-finish
);
