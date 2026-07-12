# Gantt App (DHTMLX + FastAPI + Postgres)

An editable Gantt chart that reads and writes tasks in your own Postgres
database. Drag, resize, link, and edit tasks in the browser — every change
is saved automatically via a REST API. Superset (or anything else) can
report on the same tables.

---

## Architecture

```
gantt-app/
├── docker-compose.yml          # Service orchestration (db + app)
├── .env.example                # Environment variable template
├── .gitignore
├── db/
│   └── init.sql                # Schema (gantt_tasks, gantt_links) + sample data
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt        # Pinned Python dependencies
│   └── app/
│       ├── __init__.py
│       ├── config.py           # Env-driven configuration
│       ├── database.py         # asyncpg connection pool
│       ├── main.py             # FastAPI app entry point
│       └── routers/
│           ├── __init__.py
│           ├── tasks.py        # /api/data, /api/task CRUD
│           └── links.py        # /api/link CRUD
└── frontend/
    └── index.html              # DHTMLX Gantt page (toolbar, zoom, editing)
```

---

## Quick Start

```bash
# 1. Create env file
cp .env.example .env
# Edit .env — at minimum change POSTGRES_PASSWORD

# 2. Build and run
docker compose up --build -d

# 3. Verify
curl -f http://localhost:8000/api/data
```

Open http://localhost:8000 — you'll see a sample project. Drag a bar,
refresh the page: the change persisted.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `gantt` | PostgreSQL username |
| `POSTGRES_PASSWORD` | — | PostgreSQL password (required) |
| `POSTGRES_DB` | `gantt` | PostgreSQL database name |
| `DATABASE_URL` | derived | Full connection string for the backend |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `DB_POOL_MIN` | `1` | Minimum connection pool size |
| `DB_POOL_MAX` | `10` | Maximum connection pool size |

---

## Point it at an Existing Database

1. Set `DATABASE_URL` in `.env` to your database connection string.
2. Run `db/init.sql` against it (or adapt column names if you already have task tables).
3. Remove the `db` service from `docker-compose.yml`.

---

## Integrate with Your Website

**Option A — iframe (simplest):**
```html
<iframe src="https://your-gantt-host:8000" style="width:100%;height:80vh;border:0"></iframe>
```

**Option B — native component (recommended):**
`npm install dhtmlx-gantt` in your website project, copy the JS from
`frontend/index.html` into a component, and point `API` at this backend.

**Superset:** Connect Superset to the same Postgres database and build
charts on `gantt_tasks` (e.g., tasks by assignee, overdue tasks, progress
by project). Edits in the Gantt appear in Superset on refresh.

---

## Production Checklist

- [ ] Set a strong `POSTGRES_PASSWORD` in `.env`
- [ ] Restrict `CORS_ORIGINS` to your website's origin
- [ ] Put the app behind your reverse proxy with HTTPS
- [ ] Add auth (SSO at reverse proxy or session token validation in FastAPI middleware)
- [ ] Self-host DHTMLX library instead of CDN (`npm install dhtmlx-gantt`)
- [ ] Back up the database

---

## License Note

DHTMLX Gantt Standard edition is GPL v2 — free, including for internal
company use. The Pro edition (paid) adds auto-scheduling, critical path,
resource load, undo/redo.
