-- Gantt schema: two tables map 1:1 to DHTMLX data format.
-- Superset can connect to this same database for reporting.

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
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gantt_links (
    id      SERIAL PRIMARY KEY,
    source  INTEGER NOT NULL REFERENCES gantt_tasks(id) ON DELETE CASCADE,
    target  INTEGER NOT NULL REFERENCES gantt_tasks(id) ON DELETE CASCADE,
    type    VARCHAR(1) NOT NULL DEFAULT '0'  -- 0=finish-to-start, 1=start-to-start, 2=finish-to-finish, 3=start-to-finish
);

-- Sample data so the chart isn't empty on first run
INSERT INTO gantt_tasks (text, start_date, duration, progress, parent, type, sort_order) VALUES
('Website Revamp',        '2026-07-13', 30, 0.35, 0, 'project', 1),
('Requirements gathering','2026-07-13', 5,  1.0,  1, 'task',    1),
('Design mockups',        '2026-07-20', 7,  0.6,  1, 'task',    2),
('Frontend development',  '2026-07-29', 10, 0.2,  1, 'task',    3),
('Backend API',           '2026-07-29', 8,  0.1,  1, 'task',    4),
('Launch',                '2026-08-12', 0,  0,    1, 'milestone', 5);

INSERT INTO gantt_links (source, target, type) VALUES
(2, 3, '0'),
(3, 4, '0'),
(3, 5, '0'),
(4, 6, '0'),
(5, 6, '0');
