-- Sample data for LOCAL DEVELOPMENT ONLY.
-- DO NOT run against production — real project data lives there.
--
-- Usage: docker compose -f docker-compose.local.yml up
--        (this file is auto-loaded by the local Postgres container)

INSERT INTO gantt_tasks (text, start_date, duration, progress, parent, type, sort_order, status) VALUES
('Website Revamp',        '2026-07-13', 30, 0.35, 0, 'project',   1, 'in progress'),
('Requirements gathering','2026-07-13', 5,  1.0,  1, 'task',      1, 'complete'),
('Design mockups',        '2026-07-20', 7,  0.6,  1, 'task',      2, 'in progress'),
('Frontend development',  '2026-07-29', 10, 0.2,  1, 'task',      3, 'to do'),
('Backend API',           '2026-07-29', 8,  0.1,  1, 'task',      4, 'planning'),
('Launch',                '2026-08-12', 0,  0,    1, 'milestone', 5, 'to do');

INSERT INTO gantt_links (source, target, type) VALUES
(2, 3, '0'),
(3, 4, '0'),
(3, 5, '0'),
(4, 6, '0'),
(5, 6, '0');
