"""Recoverable deletion registry backed by durable Redis storage."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.services import cache
from app.services.plane import PlaneService

logger = logging.getLogger(__name__)

TRASH_KEY = "gantt:trash:items"
RETENTION_DAYS = 30


def _field(project_id: str, entity_type: str, entity_id: str) -> str:
    return f"{project_id}:{entity_type}:{entity_id}"


def make_record(
    *,
    project_id: str,
    entity_type: str,
    entity_id: str,
    gantt_type: str,
    name: str,
    sequence_id: str | None = None,
    member_issue_ids: list[str] | None = None,
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "project_id": project_id,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "gantt_type": gantt_type,
        "name": name or "Untitled",
        "sequence_id": sequence_id,
        "member_issue_ids": member_issue_ids or [],
        "deleted_at": now.isoformat(),
        "purge_at": (now + timedelta(days=RETENTION_DAYS)).isoformat(),
    }


async def put(record: dict) -> None:
    await cache.persistent_hash_set(
        TRASH_KEY,
        _field(record["project_id"], record["entity_type"], record["entity_id"]),
        record,
    )


async def get(project_id: str, entity_type: str, entity_id: str) -> dict | None:
    return await cache.persistent_hash_get(
        TRASH_KEY, _field(project_id, entity_type, entity_id)
    )


async def remove(project_id: str, entity_type: str, entity_id: str) -> None:
    await cache.persistent_hash_delete(
        TRASH_KEY, _field(project_id, entity_type, entity_id)
    )


async def list_records(project_id: str | None = None) -> list[dict]:
    records = list((await cache.persistent_hash_getall(TRASH_KEY)).values())
    if project_id:
        records = [record for record in records if record.get("project_id") == project_id]
    return sorted(records, key=lambda record: record.get("deleted_at", ""), reverse=True)


async def purge_record(record: dict) -> None:
    """Permanently delete one registered item and then remove its record."""
    svc = PlaneService()
    try:
        if record["entity_type"] == "module":
            await svc.delete_archived_module(record["project_id"], record["entity_id"])
        else:
            await svc.delete_archived_issue(record["project_id"], record["entity_id"])
        await remove(record["project_id"], record["entity_type"], record["entity_id"])
        await cache.invalidate_project(record["project_id"])
    finally:
        await svc.close()


async def purge_expired() -> int:
    """Purge due entries. Failures stay registered and will be retried."""
    now = datetime.now(timezone.utc)
    purged = 0
    for record in await list_records():
        try:
            purge_at = datetime.fromisoformat(record["purge_at"])
            if purge_at <= now:
                await purge_record(record)
                purged += 1
        except Exception:
            logger.exception(
                "Failed to purge trashed %s %s",
                record.get("entity_type"),
                record.get("entity_id"),
            )
    return purged


async def cleanup_loop(interval_seconds: int = 3600) -> None:
    """Run cleanup at startup and hourly for the API process lifetime."""
    while True:
        try:
            if cache.is_available():
                await purge_expired()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Trash cleanup cycle failed")
        await asyncio.sleep(interval_seconds)
