# Gantt App (DHTMLX + FastAPI + Postgres)

An editable Gantt chart for PERSADA project planning. Tasks are stored in an
external PostgreSQL database (`superset_analytics_db`) shared with Superset for
reporting. The chart is embedded in the project website via iframe.

---

## Architecture

```
┌────────────────────────┐       ┌──────────────────────────────┐
│  Project Website       │       │  Superset                    │
│  (persada-stg)         │       │  (analytics-stg)             │
│                        │       │                              │
│  <iframe src="gantt"/> │       │  Charts on gantt_tasks table │
└────────────┬───────────┘       └──────────────┬───────────────┘
             │                                   │
             ▼                                   ▼
┌────────────────────────────────────────────────────────────────┐
│  gantt-app container (FastAPI + static frontend)  :8200        │
└────────────────────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────────────┐
│  External PostgreSQL (192.168.71.145)                           │
│  Database: superset_analytics_db                               │
│  Tables:   gantt_tasks (98 rows), gantt_links                  │
└────────────────────────────────────────────────────────────────┘
```

**Single source of truth:** `gantt_tasks` and `gantt_links` tables in the
external Postgres. All edits from the Gantt UI write directly here.

---

## Repository Structure

```
gantt-app/
├── docker-compose.yml          # Production/staging (external DB)
├── docker-compose.local.yml    # Local dev override (bundled Postgres + sample data)
├── .env.example                # Environment variable template
├── .gitignore
├── db/
│   ├── init.sql                # Idempotent schema (gantt_tasks, gantt_links)
│   ├── sample_data.sql         # Sample data for local development only
│   └── migrate_from_persada.sql  # One-time migration reference (ALREADY EXECUTED)
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── config.py           # Env-driven config (fails fast if DATABASE_URL unset)
│       ├── database.py         # asyncpg connection pool
│       ├── main.py             # FastAPI entry point
│       └── routers/
│           ├── tasks.py        # /api/data, /api/task CRUD
│           └── links.py        # /api/link CRUD
└── frontend/
    └── index.html              # DHTMLX Gantt (month view, status field, zoom controls)
```

---

## Staging Deployment

The app runs on `mcmcdisddevapp01` alongside other services.

```bash
# 1. Clone (first time)
cd ~/disd/git
git clone https://devgithub.mcmc.gov.my/mcmc/gantt-app.git
cd gantt-app

# 2. Create .env
cp .env.example .env
# Edit .env:
#   DATABASE_URL=postgresql://superset_analytics:PASSWORD@192.168.71.145:5432/superset_analytics_db
#   CORS_ORIGINS=https://persada-stg.mcmc.gov.my

# 3. Build and start
docker compose up --build -d

# 4. Verify
curl -f http://localhost:8200/api/data | head -c 200
docker compose ps
```

The app is available at `http://<server-ip>:8200`.

### Updating

```bash
cd ~/disd/git/gantt-app
git pull
docker compose up --build -d
```

---

## Local Development

For local development with a throwaway Postgres and sample data:

```bash
cp .env.example .env
# DATABASE_URL will be overridden by docker-compose.local.yml

docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

Open http://localhost:8200 — sample tasks appear in the chart.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Full PostgreSQL connection string |
| `CORS_ORIGINS` | No | Comma-separated allowed origins (empty = block all) |
| `DB_POOL_MIN` | No | Min pool size (default: 1) |
| `DB_POOL_MAX` | No | Max pool size (default: 10) |

If `DATABASE_URL` is not set, the app will refuse to start.

---

## Data Migration

The production data was migrated from `persada_gantt_chart` (a CSV uploaded to
Superset) into `gantt_tasks` using `db/migrate_from_persada.sql`. This script
has already been executed and must not be re-run against production.

Current production data: 6 workstream projects, 78 tasks, 14 milestones.

**WARNING:** Never re-run the CSV import or migration script against production.
The `gantt_tasks` table is the live source of truth — any re-import will
destroy manual edits made through the Gantt chart UI.

---

## Production Checklist

- [x] External Postgres with dedicated role (`superset_analytics`) having write
      access limited to `gantt_tasks` and `gantt_links`
- [x] Data migrated from persada_gantt_chart (98 rows verified)
- [ ] Restrict `CORS_ORIGINS` to the project website origin only
- [ ] HTTPS via reverse proxy (nginx on host)
- [ ] Authentication in front of the app (SSO at reverse proxy level or
      session token validation in FastAPI middleware)
- [ ] Scheduled `pg_dump` backups of `superset_analytics_db` including gantt tables
- [ ] Self-host DHTMLX library instead of CDN (`npm install dhtmlx-gantt`)
- [ ] Rate limiting on write endpoints

---

## Embedding in the Project Website

```html
<iframe
  src="https://gantt.mycompany.com"
  style="width:100%; height:80vh; border:0;"
></iframe>
```

Ensure the Gantt app's CORS allows the website origin, and the reverse proxy
sets appropriate `X-Frame-Options` / CSP `frame-ancestors` headers.

---

## Superset Integration

Superset connects to the same `superset_analytics_db` database and can build
charts on `gantt_tasks` (tasks by workstream, progress heatmap, overdue tasks,
milestones timeline). Edits in the Gantt chart appear in Superset on dashboard
refresh.

---

## License Note

DHTMLX Gantt Standard edition is GPL v2 — free for internal company use.
The Pro edition (paid) adds auto-scheduling, critical path, resource load,
and undo/redo.
