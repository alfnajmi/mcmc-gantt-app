# Gantt Platform

Multi-project Gantt chart platform. Create projects, import CSV, and embed interactive Gantt charts in any portal or website.

---

## How it works

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Any Portal / Website                                                    │
│                                                                          │
│  Option A (recommended): SDK — renders in your page's DOM                │
│  <mcmc-gantt project="my-project" api="http://<GANTT_HOST>:8200" />     │
│                                                                          │
│  Option B: iframe — simple but isolated                                  │
│  <iframe src="http://<GANTT_HOST>:8200/embed/my-project" />             │
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

# 3. Load environment variables
export $(grep -v '^#' .env | grep -v '^\s*$' | xargs)

# 4. Initialize database (first time — creates base tables)
psql $DATABASE_URL -f db/init.sql

# 5. Run migrations
psql $DATABASE_URL -f db/migrations/001_init_sort_order.sql
psql $DATABASE_URL -f db/migrations/002_multi_project.sql

# 4. Build and start
docker compose up --build -d

# 5. Open
open http://localhost:8200/admin
```

---

## Package management

The gantt-app repo has two distinct package ecosystems:

### Backend (Python)

Dependencies are managed in `backend/requirements.txt` with pinned versions.

```bash
# Create a virtual environment (for local dev outside Docker)
cd backend
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run locally (outside Docker)
uvicorn app.main:app --reload --port 8200
```

When adding a new dependency, pin the exact version:

```bash
pip install <package>==<version>
pip freeze | grep <package> >> requirements.txt
```

In production, dependencies are installed inside the Docker image at build time via `backend/Dockerfile`.

### SDK (`@mcmc/gantt-chart` — npm)

The SDK lives in `sdk/` and is published to the private GitHub Packages npm registry.

**Registry setup** — add `.npmrc` to your project (or globally):

```
@mcmc:registry=https://devgithub.mcmc.gov.my/_registry/npm/
//devgithub.mcmc.gov.my/_registry/npm/:_authToken=${NPM_TOKEN}
```

**Install in a consuming project (e.g. persada-web):**

```bash
npm install @mcmc/gantt-chart
```

**Build the SDK locally:**

```bash
cd sdk
npm install
npm run build     # Output: sdk/dist/
```

**Publish a new version:**

```bash
cd sdk
# 1. Bump version in package.json
# 2. Authenticate (one-time)
npm config set //devgithub.mcmc.gov.my/_registry/npm/:_authToken <GITHUB_TOKEN>
# 3. Publish (runs build automatically via prepublishOnly)
npm publish
```

The token needs `write:packages` scope on devgithub.mcmc.gov.my.

**For Docker builds** that need the SDK as a dependency, pass the token as a build arg:

```dockerfile
ARG NPM_TOKEN
RUN echo "//devgithub.mcmc.gov.my/_registry/npm/:_authToken=${NPM_TOKEN}" >> .npmrc && npm install
```

### Frontend (vanilla HTML)

The `frontend/` directory contains plain HTML/CSS files — no build step, no npm. These are served directly by the FastAPI backend as static files (mounted at `/`).

### Docker (production)

The entire app is deployed as a single Docker container:

```bash
# Build
docker compose build

# Run
docker compose up -d

# Rebuild after code changes
docker compose up --build -d
```

The `backend/Dockerfile` handles:
1. Installing Python dependencies
2. Copying `frontend/` into the image as static assets
3. Exposing the FastAPI server on port 8000 (mapped to 8200 on host)

### CI/CD

Merging a PR into `staging` triggers the GitHub Actions workflow (`.github/workflows/deploy-staging.yml`) which:
1. Builds the Docker image on the self-hosted runner
2. Copies the image tar to the staging server via SSH
3. Loads and restarts the container
4. Runs a health check against `/api/health`

---

## Using `@mcmc/gantt-chart` in your project

If you want to embed a Gantt chart in your own frontend (Vue, React, or plain HTML), follow these steps.

### Step 1: Configure the private registry

Create a `.npmrc` file in your project root:

```
@mcmc:registry=https://devgithub.mcmc.gov.my/_registry/npm/
//devgithub.mcmc.gov.my/_registry/npm/:_authToken=${NPM_TOKEN}
```

Then set `NPM_TOKEN` in your environment. The token needs `read:packages` scope on devgithub.mcmc.gov.my.

```bash
export NPM_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

### Step 2: Install the package

```bash
npm install @mcmc/gantt-chart
```

### Step 3: Use in your app

**Vue 3:**

```vue
<script setup>
import GanttChart from '@mcmc/gantt-chart/vue'
</script>

<template>
  <GanttChart
    project="persada-phase-1"
    api-base="https://gantt-stg.mcmc.gov.my"
    :editable="true"
    height="80vh"
  />
</template>
```

**Plain HTML / any framework (Web Component):**

```html
<mcmc-gantt
  project="persada-phase-1"
  api="https://gantt-stg.mcmc.gov.my"
  editable
  height="80vh"
></mcmc-gantt>

<script type="module">
  import '@mcmc/gantt-chart/element'
</script>
```

Or load directly from the Gantt platform (no npm install needed):

```html
<mcmc-gantt project="persada-phase-1" api="https://gantt-stg.mcmc.gov.my" editable height="80vh"></mcmc-gantt>
<script src="https://gantt-stg.mcmc.gov.my/sdk/gantt-element.js" type="module"></script>
```

**Imperative JS:**

```js
import { mountGantt } from '@mcmc/gantt-chart'

const gantt = mountGantt({
  container: document.getElementById('gantt-container'),
  project: 'persada-phase-1',
  apiBase: 'https://gantt-stg.mcmc.gov.my',
  editable: true,
})
```

### Step 4: Docker / CI builds

For Dockerized projects that install `@mcmc/gantt-chart`, pass the token as a build arg:

```dockerfile
ARG NPM_TOKEN
COPY .npmrc package*.json ./
RUN npm ci
```

In your CI pipeline or `docker compose build`:

```bash
docker build --build-arg NPM_TOKEN=$NPM_TOKEN -t my-app .
```

### CORS

Make sure your portal's origin is listed in the Gantt platform's `CORS_ORIGINS` environment variable, otherwise API requests from the embedded component will be blocked.

---

## Onboarding guide (for any team)

### Step 1: Create a project

Go to `/admin` → fill in title and slug → click "Create project"

Or via API:
```bash
curl -X POST http://<GANTT_HOST>:8200/api/projects \
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
<mcmc-gantt project="my-project" api="http://<GANTT_HOST>:8200" editable height="80vh"></mcmc-gantt>
<script src="http://<GANTT_HOST>:8200/sdk/gantt-element.js" type="module"></script>
```

**Vue 3 portals:**

```vue
<script setup>
import { GanttChart } from '@mcmc/gantt-chart/vue'
</script>

<template>
  <GanttChart project="my-project" api-base="http://<GANTT_HOST>:8200" :editable="true" height="80vh" />
</template>
```

**Fallback: iframe (simple, but isolated UX)**

```html
<iframe src="http://<GANTT_HOST>:8200/embed/my-project" style="width:100%; height:80vh; border:0;"></iframe>
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

Migrations must run in order, and require the base tables from `init.sql` to exist first.

```bash
# Load env (strips comments automatically)
export $(grep -v '^#' .env | grep -v '^\s*$' | xargs)

# 1. Base tables (idempotent — safe to re-run)
psql $DATABASE_URL -f db/init.sql

# 2. Migrations in order
psql $DATABASE_URL -f db/migrations/001_init_sort_order.sql
psql $DATABASE_URL -f db/migrations/002_multi_project.sql
```

| Migration | Description | Depends on |
|-----------|-------------|------------|
| `db/init.sql` | Creates `gantt_tasks` and `gantt_links` tables | — |
| `001_init_sort_order.sql` | Sequential sort_order for drag-reorder | init.sql |
| `002_multi_project.sql` | Multi-project support (projects table, project_id FK) | init.sql |

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
  api="http://<GANTT_HOST>:8200"
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
