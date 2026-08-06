-- =============================================================================
-- MIGRATION 002: Multi-project support
-- =============================================================================
-- Adds a projects registry table and scopes tasks/links by project_id.
-- Existing data is assigned to a default 'persada-phase-1' project.
-- =============================================================================

BEGIN;

-- 1. Create projects registry
CREATE TABLE IF NOT EXISTS gantt_projects (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    title       VARCHAR(255) NOT NULL,
    description TEXT,
    config      JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. Add project_id to gantt_tasks
ALTER TABLE gantt_tasks
    ADD COLUMN IF NOT EXISTS project_id INTEGER;

-- 3. Add project_id to gantt_links
ALTER TABLE gantt_links
    ADD COLUMN IF NOT EXISTS project_id INTEGER;

-- 4. Create the default project for existing data
INSERT INTO gantt_projects (id, slug, title, description, config)
VALUES (1, 'persada-phase-1', 'PERSADA Phase 1', 'PERSADA Connectivity/EMR/ICT Deployment — Foresight Division', '{"editable": true, "scale": "month"}')
ON CONFLICT (slug) DO NOTHING;

-- 5. Assign all existing tasks/links to the default project
UPDATE gantt_tasks SET project_id = 1 WHERE project_id IS NULL;
UPDATE gantt_links SET project_id = 1 WHERE project_id IS NULL;

-- 6. Make project_id NOT NULL now that all rows have a value
ALTER TABLE gantt_tasks ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE gantt_tasks ALTER COLUMN project_id SET DEFAULT 1;
ALTER TABLE gantt_links ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE gantt_links ALTER COLUMN project_id SET DEFAULT 1;

-- 7. Add FK constraints
ALTER TABLE gantt_tasks
    ADD CONSTRAINT fk_tasks_project
    FOREIGN KEY (project_id) REFERENCES gantt_projects(id) ON DELETE CASCADE;

ALTER TABLE gantt_links
    ADD CONSTRAINT fk_links_project
    FOREIGN KEY (project_id) REFERENCES gantt_projects(id) ON DELETE CASCADE;

-- 8. Index for fast project-scoped queries
CREATE INDEX IF NOT EXISTS idx_tasks_project ON gantt_tasks(project_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_links_project ON gantt_links(project_id);

-- 9. Reset project sequence
SELECT setval('gantt_projects_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM gantt_projects));

COMMIT;
