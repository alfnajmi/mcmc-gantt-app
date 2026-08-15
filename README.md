# Gantt API

Lightweight API that serves dhtmlxGantt-compatible data from **Plane.so**. No database required — Plane is the single source of truth for all project/task data.

## Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌──────────────┐
│  persada-web    │         │  gantt-api       │         │  Plane.so    │
│  (Vue 3 + SDK) │◄──API──►│  (FastAPI)       │◄──API──►│  (self-host) │
│  dhtmlxGantt    │         │  No database     │         │              │
└─────────────────┘         └─────────────────┘         └──────────────┘
```

- **Plane** → admin portal (create projects, issues, modules, set dates)
- **Gantt API** → transforms Plane data into dhtmlxGantt format
- **persada-web** → renders the Gantt chart with the `@mcmc/gantt-chart` SDK

## Quick start

```bash
cd backend

# Create virtualenv
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure
cp ../.env.example ../.env
# Edit ../.env with your Plane credentials

# Run
export $(grep -v '^#' ../.env | grep -v '^\s*$' | xargs)
uvicorn app.main:app --reload --port 8200
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PLANE_BASE_URL` | Yes | Plane instance URL (e.g., `https://plane-digd.mcmc.gov.my`) |
| `PLANE_API_TOKEN` | Yes | Personal Access Token from Plane |
| `PLANE_WORKSPACE_SLUG` | Yes | Workspace slug from Plane URL |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |
| `REDIS_URL` | No | Redis URL for caching (optional) |
| `CACHE_TTL_SECONDS` | No | Cache TTL in seconds (default: 300) |
| `LOG_LEVEL` | No | Logging level (default: INFO) |

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check + Plane connectivity |
| GET | `/api/projects` | List all Plane projects |
| GET | `/api/projects/{id}` | Get project metadata |
| GET | `/api/projects/{id}/data` | Gantt chart data (tasks + links) |
| PUT | `/api/projects/{id}/task/{tid}` | Update task dates (DataProcessor) |
| PATCH | `/api/projects/{id}/issues/{iid}/dates` | Update issue dates |
| POST | `/api/projects/{id}/reorder` | Persist sort order changes |
| POST | `/api/cache/invalidate` | Flush cached data |

The `/data` endpoint accepts either a UUID or project identifier (e.g., `persada`, `NASP`).

Query parameters for `/data`:
- `include_cycles=true` — show cycles as group bars
- `include_modules=true` — show modules as group bars
- `include_relations=true` — fetch dependency links
- `bypass_cache=false` — skip Redis cache

## SDK integration

The `@mcmc/gantt-chart` SDK allows any web portal to embed a Gantt chart that reads from this API. The SDK handles dhtmlxGantt loading, rendering, and DataProcessor communication.

### Installation

```bash
npm install @mcmc/gantt-chart
```

Registry setup (`.npmrc`):
```
@mcmc:registry=https://devgithub.mcmc.gov.my/_registry/npm/
//devgithub.mcmc.gov.my/_registry/npm/:_authToken=${NPM_TOKEN}
```

### Option 1: Vue 3 component

```vue
<script setup>
import { GanttChart } from '@mcmc/gantt-chart/vue'
</script>

<template>
  <GanttChart
    project="persada"
    api-base="https://gantt.mcmc.gov.my"
    :editable="true"
    scale="week"
    height="80vh"
    @task-click="handleClick"
    @task-change="handleChange"
  />
</template>
```

### Option 2: Web Component (any framework or plain HTML)

```html
<mcmc-gantt
  project="persada"
  api="https://gantt.mcmc.gov.my"
  editable
  height="80vh"
></mcmc-gantt>
<script src="https://gantt.mcmc.gov.my/sdk/gantt-element.js" type="module"></script>
```

### Option 3: Imperative API

```js
import { mountGantt } from '@mcmc/gantt-chart'

const controller = mountGantt({
  container: document.getElementById('gantt'),
  project: 'persada',
  apiBase: 'https://gantt.mcmc.gov.my',
  editable: true,
  scale: 'month',
  onTaskClick: (task) => console.log(task),
  onTaskChange: (task) => console.log('updated', task),
})

// Later: controller.destroy()
```

### Props / Attributes

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `project` | string | — | Project UUID or identifier (e.g., `persada`, `NASP`) |
| `api-base` | string | `''` | Gantt API base URL |
| `editable` | boolean | `false` | Allow drag-to-edit (dates sync back to Plane) |
| `scale` | string | `'month'` | Initial zoom: `day`, `week`, `month`, `year` |
| `height` | string | `'600px'` | Container height |

### SDK development

The SDK source lives in `sdk/`. To build and publish:

```bash
cd sdk
npm install
npm run build       # outputs to sdk/dist/
npm publish         # publishes to @mcmc registry
```

## Caching

If `REDIS_URL` is set, API responses are cached to reduce Plane API load:
- Project list: cached for `CACHE_TTL_SECONDS`
- Project data: cached per project + query params
- Cache is auto-invalidated on write operations (date changes, reorder)
- Manual flush: `POST /api/cache/invalidate`

If Redis is unavailable, the API works without caching (graceful degradation).
