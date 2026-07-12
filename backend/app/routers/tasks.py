"""Task CRUD endpoints — matches DHTMLX dataProcessor REST format."""

from datetime import datetime

from fastapi import APIRouter, Request

from app.database import get_pool

router = APIRouter(prefix="/api", tags=["tasks"])

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


async def _parse_form(request: Request) -> dict:
    form = await request.form()
    sort_order_raw = form.get("sort_order")
    return {
        "text": form.get("text", "New task"),
        "start_date": datetime.strptime(form.get("start_date"), DATE_FMT),
        "duration": int(form.get("duration", 1)),
        "progress": float(form.get("progress", 0)),
        "parent": int(form.get("parent", 0)),
        "type": form.get("type", "task"),
        "assignee": form.get("assignee") or None,
        "status": form.get("status") or None,
        "sort_order": int(sort_order_raw) if sort_order_raw is not None else 0,
    }


@router.get("/data")
async def get_data():
    """Load all tasks and links (initial chart payload)."""
    pool = get_pool()
    async with pool.acquire() as conn:
        tasks = await conn.fetch(
            "SELECT * FROM gantt_tasks ORDER BY sort_order, id"
        )
        links = await conn.fetch("SELECT * FROM gantt_links ORDER BY id")
    return {
        "data": [_row_to_dict(t) for t in tasks],
        "links": [
            {"id": l["id"], "source": l["source"],
             "target": l["target"], "type": l["type"]}
            for l in links
        ],
    }


@router.post("/task")
async def create_task(request: Request):
    t = await _parse_form(request)
    pool = get_pool()
    async with pool.acquire() as conn:
        new_id = await conn.fetchval(
            """INSERT INTO gantt_tasks
               (text, start_date, duration, progress, parent, type, assignee, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id""",
            t["text"], t["start_date"], t["duration"],
            t["progress"], t["parent"], t["type"], t["assignee"], t["status"],
        )
    return {"action": "inserted", "tid": new_id}


@router.put("/task/{task_id}")
async def update_task(task_id: int, request: Request):
    t = await _parse_form(request)
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """UPDATE gantt_tasks SET
               text=$1, start_date=$2, duration=$3, progress=$4,
               parent=$5, type=$6, assignee=$7, status=$8, sort_order=$9, updated_at=NOW()
               WHERE id=$10""",
            t["text"], t["start_date"], t["duration"], t["progress"],
            t["parent"], t["type"], t["assignee"], t["status"], t["sort_order"], task_id,
        )
    return {"action": "updated"}


@router.delete("/task/{task_id}")
async def delete_task(task_id: int):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM gantt_tasks WHERE id=$1 OR parent=$1", task_id
        )
    return {"action": "deleted"}


@router.post("/reorder")
async def reorder_tasks(request: Request):
    """Bulk update sort_order for a list of tasks."""
    body = await request.json()
    pool = get_pool()
    async with pool.acquire() as conn:
        for item in body:
            await conn.execute(
                "UPDATE gantt_tasks SET sort_order=$1 WHERE id=$2",
                item["sort_order"], item["id"],
            )
    return {"action": "reordered", "count": len(body)}
