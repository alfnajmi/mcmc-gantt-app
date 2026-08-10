"""Task CRUD endpoints — scoped by project slug. Matches DHTMLX dataProcessor REST format."""

from datetime import datetime

from fastapi import APIRouter, HTTPException, Request

from app.database import get_pool

router = APIRouter(tags=["tasks"])

DATE_FMT = "%Y-%m-%d %H:%M"


def _row_to_dict(r) -> dict:
    return {
        "id": r["id"],
        "text": r["text"],
        "start_date": r["start_date"].strftime(DATE_FMT),
        "duration": r["duration"],
        "progress": r["progress"],
        "parent": r["parent"],
        "type": r["type"],
        "assignee": r["assignee"],
        "status": r["status"],
        "sort_order": r["sort_order"],
        "open": True,
    }


async def _get_project_id(slug: str) -> int:
    """Resolve project slug to ID."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id FROM gantt_projects WHERE slug = $1", slug
        )
    if not row:
        raise HTTPException(status_code=404, detail=f"Project '{slug}' not found.")
    return row["id"]


async def _parse_form(request: Request) -> dict:
    form = await request.form()
    sort_order_raw = form.get("sort_order")

    # Parse start_date — handle multiple formats from DHTMLX
    start_raw = form.get("start_date", "")
    start_date = None
    for fmt in (DATE_FMT, "%Y-%m-%d", "%d-%m-%Y %H:%M", "%d/%m/%Y %H:%M"):
        try:
            start_date = datetime.strptime(start_raw, fmt)
            break
        except (ValueError, TypeError):
            continue
    if start_date is None:
        # Fallback: try ISO format
        try:
            start_date = datetime.fromisoformat(start_raw.replace("Z", "+00:00").replace("+00:00", ""))
        except (ValueError, TypeError, AttributeError):
            start_date = datetime.now()

    return {
        "text": form.get("text", "New task"),
        "start_date": start_date,
        "duration": int(form.get("duration", 1) or 1),
        "progress": float(form.get("progress", 0) or 0),
        "parent": int(form.get("parent", 0) or 0),
        "type": form.get("type", "task"),
        "assignee": form.get("assignee") or None,
        "status": form.get("status") or None,
        "sort_order": int(sort_order_raw) if sort_order_raw is not None else 0,
    }


# --- Project-scoped endpoints ---

@router.get("/api/projects/{slug}/data")
async def get_project_data(slug: str):
    """Load all tasks and links for a project (DHTMLX chart payload)."""
    project_id = await _get_project_id(slug)
    pool = get_pool()
    async with pool.acquire() as conn:
        tasks = await conn.fetch(
            "SELECT * FROM gantt_tasks WHERE project_id = $1 ORDER BY sort_order, id",
            project_id,
        )
        links = await conn.fetch(
            "SELECT * FROM gantt_links WHERE project_id = $1 ORDER BY id",
            project_id,
        )
    return {
        "data": [_row_to_dict(t) for t in tasks],
        "links": [
            {"id": l["id"], "source": l["source"],
             "target": l["target"], "type": l["type"]}
            for l in links
        ],
    }


@router.post("/api/projects/{slug}/task")
async def create_task(slug: str, request: Request):
    project_id = await _get_project_id(slug)
    t = await _parse_form(request)
    pool = get_pool()
    async with pool.acquire() as conn:
        new_id = await conn.fetchval(
            """INSERT INTO gantt_tasks
               (project_id, text, start_date, duration, progress, parent, type, assignee, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id""",
            project_id, t["text"], t["start_date"], t["duration"],
            t["progress"], t["parent"], t["type"], t["assignee"], t["status"],
        )
    return {"action": "inserted", "tid": new_id}


@router.put("/api/projects/{slug}/task/{task_id}")
async def update_task(slug: str, task_id: int, request: Request):
    project_id = await _get_project_id(slug)
    t = await _parse_form(request)
    pool = get_pool()
    async with pool.acquire() as conn:
        # Ignore updates for temporary IDs that don't exist in DB
        # (DHTMLX may fire update before POST response remaps the ID)
        try:
            result = await conn.execute(
                """UPDATE gantt_tasks SET
               text=$1, start_date=$2, duration=$3, progress=$4,
               parent=$5, type=$6, assignee=$7, status=$8, sort_order=$9, updated_at=NOW()
               WHERE id=$10 AND project_id=$11""",
                t["text"], t["start_date"], t["duration"], t["progress"],
                t["parent"], t["type"], t["assignee"], t["status"], t["sort_order"],
                task_id, project_id,
            )
        except Exception:
            # ID out of integer range or other DB error — treat as no-op
            pass
    return {"action": "updated"}


@router.delete("/api/projects/{slug}/task/{task_id}")
async def delete_task(slug: str, task_id: int):
    project_id = await _get_project_id(slug)
    pool = get_pool()
    async with pool.acquire() as conn:
        try:
            await conn.execute(
                "DELETE FROM gantt_tasks WHERE (id=$1 OR parent=$1) AND project_id=$2",
                task_id, project_id,
            )
        except Exception:
            pass
    return {"action": "deleted"}


@router.post("/api/projects/{slug}/reorder")
async def reorder_tasks(slug: str, request: Request):
    """Bulk update sort_order for tasks within a project."""
    project_id = await _get_project_id(slug)
    body = await request.json()
    pool = get_pool()
    async with pool.acquire() as conn:
        for item in body:
            await conn.execute(
                "UPDATE gantt_tasks SET sort_order=$1 WHERE id=$2 AND project_id=$3",
                item["sort_order"], item["id"], project_id,
            )
    return {"action": "reordered", "count": len(body)}


# --- Legacy endpoints (backwards-compatible, uses default project) ---

@router.get("/api/data")
async def get_data_legacy():
    """Legacy: load data from project_id=1 (backwards compat)."""
    pool = get_pool()
    async with pool.acquire() as conn:
        tasks = await conn.fetch(
            "SELECT * FROM gantt_tasks WHERE project_id = 1 ORDER BY sort_order, id"
        )
        links = await conn.fetch(
            "SELECT * FROM gantt_links WHERE project_id = 1 ORDER BY id"
        )
    return {
        "data": [_row_to_dict(t) for t in tasks],
        "links": [
            {"id": l["id"], "source": l["source"],
             "target": l["target"], "type": l["type"]}
            for l in links
        ],
    }


@router.post("/api/task")
async def create_task_legacy(request: Request):
    t = await _parse_form(request)
    pool = get_pool()
    async with pool.acquire() as conn:
        new_id = await conn.fetchval(
            """INSERT INTO gantt_tasks
               (project_id, text, start_date, duration, progress, parent, type, assignee, status)
               VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8) RETURNING id""",
            t["text"], t["start_date"], t["duration"],
            t["progress"], t["parent"], t["type"], t["assignee"], t["status"],
        )
    return {"action": "inserted", "tid": new_id}


@router.put("/api/task/{task_id}")
async def update_task_legacy(task_id: int, request: Request):
    t = await _parse_form(request)
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """UPDATE gantt_tasks SET
               text=$1, start_date=$2, duration=$3, progress=$4,
               parent=$5, type=$6, assignee=$7, status=$8, sort_order=$9, updated_at=NOW()
               WHERE id=$10 AND project_id=1""",
            t["text"], t["start_date"], t["duration"], t["progress"],
            t["parent"], t["type"], t["assignee"], t["status"], t["sort_order"], task_id,
        )
    return {"action": "updated"}


@router.delete("/api/task/{task_id}")
async def delete_task_legacy(task_id: int):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM gantt_tasks WHERE (id=$1 OR parent=$1) AND project_id=1", task_id
        )
    return {"action": "deleted"}


@router.post("/api/reorder")
async def reorder_tasks_legacy(request: Request):
    body = await request.json()
    pool = get_pool()
    async with pool.acquire() as conn:
        for item in body:
            await conn.execute(
                "UPDATE gantt_tasks SET sort_order=$1 WHERE id=$2 AND project_id=1",
                item["sort_order"], item["id"],
            )
    return {"action": "reordered", "count": len(body)}
