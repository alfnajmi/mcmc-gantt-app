"""Link CRUD endpoints — scoped by project slug. Matches DHTMLX dataProcessor REST format."""

from fastapi import APIRouter, HTTPException, Request

from app.database import get_pool

router = APIRouter(tags=["links"])


async def _get_project_id(slug: str) -> int:
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id FROM gantt_projects WHERE slug = $1", slug
        )
    if not row:
        raise HTTPException(status_code=404, detail=f"Project '{slug}' not found.")
    return row["id"]


# --- Project-scoped endpoints ---

@router.post("/api/projects/{slug}/link")
async def create_link(slug: str, request: Request):
    project_id = await _get_project_id(slug)
    form = await request.form()
    pool = get_pool()
    async with pool.acquire() as conn:
        new_id = await conn.fetchval(
            """INSERT INTO gantt_links (project_id, source, target, type)
               VALUES ($1,$2,$3,$4) RETURNING id""",
            project_id, int(form.get("source")), int(form.get("target")),
            form.get("type", "0"),
        )
    return {"action": "inserted", "tid": new_id}


@router.put("/api/projects/{slug}/link/{link_id}")
async def update_link(slug: str, link_id: int, request: Request):
    project_id = await _get_project_id(slug)
    form = await request.form()
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE gantt_links SET source=$1, target=$2, type=$3 WHERE id=$4 AND project_id=$5",
            int(form.get("source")), int(form.get("target")),
            form.get("type", "0"), link_id, project_id,
        )
    return {"action": "updated"}


@router.delete("/api/projects/{slug}/link/{link_id}")
async def delete_link(slug: str, link_id: int):
    project_id = await _get_project_id(slug)
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM gantt_links WHERE id=$1 AND project_id=$2", link_id, project_id
        )
    return {"action": "deleted"}


# --- Legacy endpoints (project_id=1) ---

@router.post("/api/link")
async def create_link_legacy(request: Request):
    form = await request.form()
    pool = get_pool()
    async with pool.acquire() as conn:
        new_id = await conn.fetchval(
            """INSERT INTO gantt_links (project_id, source, target, type)
               VALUES (1,$1,$2,$3) RETURNING id""",
            int(form.get("source")), int(form.get("target")),
            form.get("type", "0"),
        )
    return {"action": "inserted", "tid": new_id}


@router.put("/api/link/{link_id}")
async def update_link_legacy(link_id: int, request: Request):
    form = await request.form()
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE gantt_links SET source=$1, target=$2, type=$3 WHERE id=$4 AND project_id=1",
            int(form.get("source")), int(form.get("target")),
            form.get("type", "0"), link_id,
        )
    return {"action": "updated"}


@router.delete("/api/link/{link_id}")
async def delete_link_legacy(link_id: int):
    pool = get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM gantt_links WHERE id=$1 AND project_id=1", link_id
        )
    return {"action": "deleted"}
