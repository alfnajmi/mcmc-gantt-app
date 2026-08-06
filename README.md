# Gantt Platform

Multi-project Gantt chart platform. Create projects, import CSV, and embed interactive Gantt charts in any portal or website.

---

## How it works

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Any Portal / Website                                                    │
│                                                                          │
│  Option A (recommended): SDK — renders in your page's DOM                │
│  <mcmc-gantt project="my-project" api="https://gantt.mcmc.gov.my" />     │
│                                                                          │
│  Option B: iframe — simple but isolated                                  │
│  <iframe src="https://gantt.mcmc.gov.my/embed/my-project" />             │
│                                                                          │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │ REST API
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Gantt Platform (single deployment, serves all projects)                 │
│                                                                          │
│  /admin                → manage projects, import CSV                     │
│  /project/:slug        → full interactive editor                         │
│  /embed/:slug          → read-only embeddable view (no toolbar)          │
│  /sdk/*                → hosted SDK files for <script> usage             │
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

**Recommended: SDK (Web Component — no iframe, native feel)**

```html
<mcmc-gantt project="my-project" api="https://gantt.mcmc.gov.my" editable height="80vh"></mcmc-gantt>
<script src="https://gantt.mcmc.gov.my/sdk/gantt-element.js" type="module"></script>
```

**Vue 3 portals:**

```vue
<script setup>
import { GanttChart } from '@mcmc/gantt-chart/vue'
</script>

<template>
  <GanttChart project="my-project" api-base="https://gantt.mcmc.gov.my" :editable="true" height="80vh" />
</template>
```

**Fallback: iframe (simple, but isolated UX)**

```html
<iframe src="https://gantt.mcmc.gov.my/embed/my-project" style="width:100%; height:80vh; border:0;"></iframe>
```

The chart updates live as tasks are edited.

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

## SDK (Embeddable Component)

The `sdk/` directory contains an embeddable Gantt component that renders directly in the host page's DOM — no iframe needed.

### Three ways to embed

| Method | Best for | Install |
|--------|----------|---------|
| **Web Component** `<mcmc-gantt>` | Any portal (HTML, React, Angular) | `<script>` tag |
| **Vue 3 component** `<GanttChart>` | Vue apps | `npm install @mcmc/gantt-chart` |
| **Imperative API** `mountGantt()` | Complex integrations | npm or script |

### Web Component attributes

```html
<mcmc-gantt
  project="my-project"
  api="https://gantt.mcmc.gov.my"
  editable
  scale="month"
  height="80vh"
></mcmc-gantt>
```

| Attribute | Required | Description |
|-----------|----------|-------------|
| `project` | Yes | Project slug |
| `api` | No | API base URL (default: same origin) |
| `editable` | No | Presence enables editing |
| `scale` | No | day, week, month (default: month) |
| `height` | No | Container height (default: 600px) |

### Events

```js
document.querySelector('mcmc-gantt').addEventListener('task-click', (e) => {
  console.log(e.detail)  // task object
})
```

| Event | Detail |
|-------|--------|
| `task-click` | Task object when clicked |
| `task-change` | Task object after update |

### Building the SDK

```bash
cd sdk
npm install
npm run build
# Output: dist/gantt-element.js, dist/gantt-chart.es.js
```

Host `dist/` on the Gantt platform at `/sdk/` or publish to your npm registry.

See [`sdk/README.md`](sdk/README.md) for full documentation.

---

## Embedding tips

- **SDK (recommended):** Renders in the host page — shared styles, native scroll, events
- **iframe fallback:** Use `/embed/:slug` — simpler but isolated UX
- **CORS:** Set `CORS_ORIGINS` to your portal's domain
- **CSP:** For iframe, set `frame-ancestors`; for SDK, just allow API requests

---

## Tech stack

- **Backend:** FastAPI + asyncpg (Python 3.12)
- **Frontend:** DHTMLX Gantt (GPL edition) — vanilla JS, no build step
- **SDK:** Web Component + Vue 3 wrapper (Vite build)
- **Database:** PostgreSQL
- **Deployment:** Docker
