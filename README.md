# Plane-powered Gantt API and SDK

Plane-backed Gantt integration for PERSADA and other MCMC portals. The FastAPI service translates Plane data into dhtmlxGantt-compatible JSON; the `@alfnajmi/gantt-chart` SDK renders and manages that data directly inside a host application.

Plane is the source of truth for projects, modules, work items, dates, hierarchy, and status. This service has no application database. Redis is optional for response caching and required for durable recoverable-trash records.

> Documentation last reviewed: 7 September 2026
>
> Current SDK version: `1.4.9`

## Architecture

```text
persada-web or another portal
        │ @alfnajmi/gantt-chart
        ▼
Gantt API (FastAPI, port 8200)
        ├── data transformation / writes ──► Plane
        └── cache + trash registry ────────► Redis
```

## Plane-to-Gantt model

| Gantt concept | Plane source | Notes |
|---|---|---|
| Project | Module | A standalone grouping with its own tasks. |
| Task | Work item | Can have equal start and due dates and still remain a task. |
| Milestone | Work item | Uses an explicit persisted Gantt type and renders as a diamond. |
| Parent/child task | Work-item hierarchy | Preserved when reading and writing. |

Type is explicit: the API and SDK do not infer a milestone only because `start_date == end_date`.

Promoting a task to Project creates a Plane Module, moves its direct subtasks into the new module, removes their old parent relationship, and archives the source task. Compensating writes restore the original hierarchy if promotion fails part-way through.

## Current capabilities

- Read Plane projects, modules, work items, hierarchy, and dependency links.
- Create and update tasks, milestones, and Plane modules.
- Persist drag/resize changes and row order back to Plane.
- Promote a long-running task into a standalone Plane module.
- Move tasks, milestones, and projects to recoverable Trash.
- Restore trashed items, delete them permanently, or purge them automatically after 30 days.
- Render pastel status colours, adaptive external labels, weekend shading, today marker, task-table toggle, and timeline zoom controls.

The detailed portal integration contract is maintained in [`sdk/README.md`](sdk/README.md).

## Quick start with Docker

```bash
cp .env.example .env
# Add the Plane URL, personal access token, and workspace slug.
docker compose up --build
curl http://localhost:8200/api/health
```

Docker Compose starts the API and Redis. The API container listens on `8000`; the host binding is `8200`.

## Run the API directly

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

set -a
source ../.env
set +a
uvicorn app.main:app --reload --port 8200
```

## Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `PLANE_BASE_URL` | Yes | Plane instance origin, without a trailing slash. |
| `PLANE_API_TOKEN` | Yes | Plane personal access token. |
| `PLANE_WORKSPACE_SLUG` | Yes | Workspace slug from the Plane URL. |
| `CORS_ORIGINS` | No | Comma-separated browser origins. |
| `REDIS_URL` | No | Redis connection URL. Required for recoverable Trash. |
| `CACHE_TTL_SECONDS` | No | Response-cache lifetime; defaults to 300 seconds. |
| `LOG_LEVEL` | No | API log level; defaults to `INFO`. |

Never commit `.env`, Plane tokens, or registry tokens.

## API endpoints

All project parameters accept a Plane UUID or project identifier where resolution is supported.

### Read and update

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | API and Plane connectivity health. |
| `GET` | `/api/projects` | List Plane projects. |
| `GET` | `/api/projects/{project}` | Get project metadata. |
| `GET` | `/api/projects/{project}/data` | Return Gantt tasks and dependency links. |
| `PUT` | `/api/projects/{project}/task/{task}` | dhtmlx DataProcessor update endpoint. |
| `PATCH` | `/api/projects/{project}/issues/{issue}/dates` | Update dates and explicit Gantt type. |
| `POST` | `/api/projects/{project}/reorder` | Persist row order. |
| `POST` | `/api/cache/invalidate` | Clear one project cache or all cached data. |

`GET .../data` supports `include_cycles`, `include_modules`, `include_relations`, and `bypass_cache` query parameters.

### Create, modules, and promotion

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/projects/{project}/issues` | Create a Task or Milestone. |
| `POST` | `/api/projects/{project}/modules` | Create a Plane Module/Project. |
| `PATCH` | `/api/projects/{project}/modules/{module}` | Update a Plane Module/Project. |
| `POST` | `/api/projects/{project}/issues/{issue}/promote-to-module` | Promote a work item and move its direct subtasks. |

### Recoverable deletion

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/projects/{project}/trash` | List items deleted through the Gantt. |
| `POST` | `/api/projects/{project}/trash/{entity_type}/{entity}` | Archive an issue/module and register it for recovery. |
| `POST` | `/api/projects/{project}/trash/{entity_type}/{entity}/restore` | Restore an item and its recorded context. |
| `DELETE` | `/api/projects/{project}/trash/{entity_type}/{entity}?confirm=true` | Permanently delete one trashed item. |

Direct permanent-delete endpoints also require `confirm=true`. The SDK normally uses the recoverable flow: three-dot menu → Delete → Undo or Trash management.

Trash metadata is stored in Redis independently from the normal response cache. Without Redis, normal Gantt reads and writes still work, but recoverable deletion returns a service-unavailable response.

## SDK development

```bash
cd sdk
npm ci
npm run build
```

The SDK publishes to GitHub Packages as `@alfnajmi/gantt-chart`. Versioning and consumer examples (including the `.npmrc` needed to install) are documented in [`sdk/README.md`](sdk/README.md).

## Verification

```bash
cd backend
pytest

cd ../sdk
npm ci
npm run build
```

Tests cover explicit task/milestone typing, Plane transformation, task-to-module promotion, rollback behavior, and recoverable Trash.
