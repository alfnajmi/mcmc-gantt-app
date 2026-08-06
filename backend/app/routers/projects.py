"""Project CRUD endpoints — registry for multi-project Gantt platform."""

import json
import re
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request

from app.database import get_pool

router = APIRouter(prefix="/api/projects", tags=["projects"])

SLUG_PATTERN = re.compile(r"^[a-z0-9][a-z0-9\-]{1,98}[a-z0-9]$")


def _row_to_dict(r) -> dict:
    return {
        "id": r["id"],
        "slug": r["slug"],
        "title": r["title"],
        "description": r["description"],
        "config": json.loads(r["config"]) if isinstance(r["config"], str) else r["config"],
        "created_at": r["created_at"].isoformat(),
        "updated_at": r["updated_at"].isoformat(),
    }


@router.get("")
async def list_projects():
    """List all projects."""
    pool = get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM gantt_projects ORDER BY created_at DESC"
        )
    return [_row_to_dict(r) for r in rows]


@router.get("/{slug}")
async def get_project(slug: str):
    """Get a single project by slug."""
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM gantt_projects WHERE slug = $1", slug
        )
    if not row:
        raise HTTPException(status_code=404, detail=f"Project '{slug}' not found.")
    return _row_to_dict(row)


@router.post("", status_code=201)
async def create_project(request: Request):
    """Create a new project."""
    body = await request.json()
    slug = body.get("slug", "").strip().lower()
    title = body.get("title", "").strip()
    description = body.get("description", "").strip()
    config = body.get("config", {"editable": True, "scale": "month"})

    if not slug or not SLUG_PATTERN.match(slug):
        raise HTTPException(
            status_code=400,
            detail="Slug must be 3-100 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphen.",
        )
    if not title:
        raise HTTPException(status_code=400, detail="Title is required.")

    pool = get_pool()
    async with pool.acquire() as conn:
        try:
            row = await conn.fetchrow(
                """INSERT INTO gantt_projects (slug, title, description, config)
                   VALUES ($1, $2, $3, $4::jsonb)
                   RETURNING *""",
                slug, title, description, json.dumps(config),
            )
        except Exception as e:
            if "unique" in str(e).lower():
                raise HTTPException(status_code=409, detail=f"Slug '{slug}' already exists.")
            raise
    return _row_to_dict(row)


@router.put("/{slug}")
async def update_project(slug: str, request: Request):
    """Update project metadata."""
    body = await request.json()
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id FROM gantt_projects WHERE slug = $1", slug
        )
        if not row:
            raise HTTPException(status_code=404, detail=f"Project '{slug}' not found.")

        await conn.execute(
            """UPDATE gantt_projects
               SET title = COALESCE($1, title),
                   description = COALESCE($2, description),
                   config = COALESCE($3::jsonb, config),
                   updated_at = NOW()
               WHERE slug = $4""",
            body.get("title"),
            body.get("description"),
            json.dumps(body["config"]) if "config" in body else None,
            slug,
        )
        updated = await conn.fetchrow(
            "SELECT * FROM gantt_projects WHERE slug = $1", slug
        )
    return _row_to_dict(updated)


@router.delete("/{slug}")
async def delete_project(slug: str):
    """Delete a project and all its tasks/links (cascade)."""
    pool = get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute(
            "DELETE FROM gantt_projects WHERE slug = $1", slug
        )
    if result == "DELETE 0":
        raise HTTPException(status_code=404, detail=f"Project '{slug}' not found.")
    return {"action": "deleted", "slug": slug}
