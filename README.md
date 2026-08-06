# Gantt Platform

Multi-project Gantt chart platform. Create projects, import CSV, and embed interactive Gantt charts in any portal or website.

---

## How it works

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Any Portal / Website                                                    │
│                                                                          │
│  <iframe src="https://gantt.mcmc.gov.my/embed/my-project" />             │
│                                                                          │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Gantt Platform (single deployment, serves all projects)                 │
│                                                                          │
│  /admin                → manage projects, import CSV                     │
│  /project/:slug        → full interactive editor                         │
│  /embed/:slug          → read-only embeddable view (no toolbar)          │
│  /api/projects         → REST API                                        │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  PostgreSQL                                                              │
│  ├── gantt_projects    (project registry)                                │
│  ├── gantt_tasks       (scoped by project_id)                            │
│  └── gantt_links       (scoped by project_id)                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Quick start

```bash
# 1. Clone
git clone https://devgithub.mcmc.gov.my/mcmc/gantt-app.git
cd gantt-app

# 2. Configure
cp .env.example .env
# Edit .env with your DATABASE_URL

# 3. Run migration (first time or after upgrade)
psql $DATABASE_URL -f db/migrations/002_multi_project.sql

# 4. Build and start
docker compose up --build -d

# 5. Open
open http://localhost:8200/admin
```

---

## Onboarding guide (for any team)

### Step 1: Create a project

Go to `/admin` → fill in title and slug → click "Create project"

Or via API:
```bash
curl -X POST https://gantt.mcmc.gov.my/api/projects \
  -H "Content-Type: application/json" \
  -d '{"title": "My Project", "slug": "my-project"}'
```

### Step 2: Add tasks

**Option A: Import CSV**
- Go to `/admin` → "Import CSV into project"
- Select your project and upload a CSV
- Supported formats: ClickUp export, MS Project CSV, or any CSV with columns:
  - `Task Name` (required)
  - `Start Date` (required)
  - `Due Date` or `Duration`
  - `Parent ID` (for hierarchy)
  - `Type` (task/milestone/project)

**Option B: Build manually**
- Open `/project/my-project`
- Click "+ New task" to add tasks
- Drag to reorder, resize to change duration, link to create dependencies

### Step 3: Embed in your portal

Copy the embed code from the admin panel, or use:

```html
<iframe
  src="https://gantt.mcmc.gov.my/embed/my-project"
  style="width: 100%; height: 80vh; border: 0;"
  title="Project Gantt Chart"
></iframe>
```

That's it. The chart updates live as tasks are edited.

---

## Pages

| URL | Purpose | Editable? |
|-----|---------|-----------|
| `/` | Landing page | — |
| `/admin` | Project management, CSV import | — |
| `/project/:slug` | Full Gantt editor | Yes |
| `/embed/:slug` | Embeddable read-only view | No |

---

## API reference

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:slug` | Get project details |
| POST | `/api/projects` | Create project |
| PUT | `/api/projects/:slug` | Update project |
| DELETE | `/api/projects/:slug` | Delete project + all data |

### Tasks (scoped by project)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/:slug/data` | Get all tasks + links (DHTMLX format) |
| POST | `/api/projects/:slug/task` | Create task |
| PUT | `/api/projects/:slug/task/:id` | Update task |
| DELETE | `/api/projects/:slug/task/:id` | Delete task |
| POST | `/api/projects/:slug/reorder` | Bulk reorder |

### Links (scoped by project)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects/:slug/link` | Create link |
| PUT | `/api/projects/:slug/link/:id` | Update link |
| DELETE | `/api/projects/:slug/link/:id` | Delete link |

### Import

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects/:slug/import` | Upload CSV (multipart form: file + mode) |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |

---

## CSV format

The import endpoint accepts flexible column names. It will attempt to match:

| What | Accepted column names |
|------|----------------------|
| Task name | `text`, `task_name`, `Task Name` |
| Start date | `start_date`, `Start Date` |
| End/due date | `end_date`, `due_date`, `Due Date` |
| Duration | `duration`, `Days`, `Days (text)` |
| Parent | `parent`, `parent_id`, `Parent ID` |
| Type | `type`, `Type` (values: task, milestone, project) |
| Original ID | `id`, `task_id`, `Task ID` (used for parent resolution) |
| Progress | `progress` (0-100 or 0.0-1.0) |
| Assignee | `assignee` |
| Status | `status` |

Date formats supported: `YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`, ClickUp format (`Monday, August 3rd 2026`).

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `CORS_ORIGINS` | No | Comma-separated allowed origins (empty = allow all) |
| `DB_POOL_MIN` | No | Min pool size (default: 1) |
| `DB_POOL_MAX` | No | Max pool size (default: 10) |
| `LOG_LEVEL` | No | Logging level (default: INFO) |

---

## Database migrations

| Migration | Description | Status |
|-----------|-------------|--------|
| `001_init_sort_order.sql` | Sequential sort_order for drag-reorder | Executed |
| `002_multi_project.sql` | Multi-project support (projects table, project_id FK) | Pending |

Run migrations with:
```bash
psql $DATABASE_URL -f db/migrations/002_multi_project.sql
```

---

## Upgrading from v1 (single-project)

The migration `002_multi_project.sql` automatically:
1. Creates the `gantt_projects` table
2. Adds `project_id` column to existing tasks/links
3. Creates a default project (`persada-phase-1`) with all existing data

Legacy endpoints (`/api/data`, `/api/task`, `/api/link`) still work — they read/write to project_id=1. Existing embeds continue to function without changes.

---

## Embedding tips

- **Read-only:** Use `/embed/:slug` — hides toolbar, disables editing
- **Editable embed:** Use `/project/:slug` in an iframe
- **Custom height:** Adjust iframe `height` to fit your layout
- **CORS:** Set `CORS_ORIGINS` to your portal's domain
- **CSP:** Ensure your reverse proxy allows `frame-ancestors` for embedding portals

---

## Tech stack

- **Backend:** FastAPI + asyncpg (Python 3.12)
- **Frontend:** DHTMLX Gantt (GPL edition) — vanilla JS, no build step
- **Database:** PostgreSQL
- **Deployment:** Docker
