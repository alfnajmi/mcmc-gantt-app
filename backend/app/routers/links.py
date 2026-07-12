"""Link CRUD endpoints — matches DHTMLX dataProcessor REST format."""

from fastapi import APIRouter, Request

from app.database import get_pool

router = APIRouter(prefix="/api", tags=["links"])


@router.post("/link")
async def create_link(request: Request):
    form = await request.form()
    pool = get_pool()
    async with pool.acquire() as conn:
        new_id = await conn.fetchval(
            """INSERT INTO gantt_links (source, target, type)
               VALUES ($1,$2,$3) RETURNING id""",
            int(form.get("source")), int(form.get("target")),
            form.get("type", "0"),
        )
    return {"action": "inserted", "tid": new_id}


@router.put("/link/{link_id}")
async def update_link(link_id: int, request: Request):
    form = await request.form()
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE gantt_links SET source=$1, target=$2, type=$3 WHERE id=$4",
            int(form.get("source")), int(form.get("target")),
            form.get("type", "0"), link_id,
        )
    return {"action": "updated"}


@router.delete("/link/{link_id}")
async def delete_link(link_id: int):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM gantt_links WHERE id=$1", link_id)
    return {"action": "deleted"}
