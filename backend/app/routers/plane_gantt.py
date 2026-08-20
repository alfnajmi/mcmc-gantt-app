"""
Gantt API endpoints — powered by Plane.so.

All project/task data comes from Plane. The dhtmlxGantt SDK on the frontend
calls these endpoints using its standard URL pattern:
  - GET  /api/projects              → list projects
  - GET  /api/projects/{id}/data    → load gantt chart (tasks + links)
  - PUT  /api/projects/{id}/task/{tid} → update task (DataProcessor REST mode)

Caching: Responses are cached in Redis (if configured) to reduce Plane API load.
Cache auto-expires via TTL and is invalidated on write operations.
"""

import logging
from datetime import datetime, timezone
from html import escape

from fastapi import APIRouter, HTTPException, Query, Request

from app.config import PLANE_BASE_URL
from app.services.plane import PlaneService, PlaneAPIError
from app.services.plane_transformer import (
    GANTT_MILESTONE_LABEL_NAME,
    transform_issues_to_gantt,
    transform_projects_to_list,
)
from app.services import cache, trash

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["gantt"])


def _get_plane_service() -> PlaneService:
    """Create a PlaneService instance. Raises 503 if not configured."""
    if not PLANE_BASE_URL:
        raise HTTPException(
            status_code=503,
            detail="Plane integration is not configured. Set PLANE_BASE_URL, PLANE_API_TOKEN, and PLANE_WORKSPACE_SLUG.",
        )
    return PlaneService()


async def _resolve_project_id(svc: PlaneService, project_id: str) -> str:
    """
    Resolve a project identifier to its UUID.

    Accepts either:
    - A UUID (passed through as-is)
    - A project identifier/slug (e.g., 'persada', 'PERSADA', 'nasp')
      → looked up from the project list
    """
    # If it looks like a UUID, use it directly
    if len(project_id) == 36 and "-" in project_id:
        return project_id

    # Otherwise, search by identifier (case-insensitive)
    projects = await svc.list_projects()
    slug_upper = project_id.upper()
    for proj in projects:
        if proj.get("identifier", "").upper() == slug_upper:
            return proj["id"]
        if proj.get("name", "").lower() == project_id.lower():
            return proj["id"]

    raise HTTPException(status_code=404, detail=f"Project '{project_id}' not found.")


def _label_ids(labels) -> list[str]:
    """Normalize expanded label objects or UUID strings to UUID strings."""
    result = []
    for label in labels or []:
        label_id = label.get("id") if isinstance(label, dict) else label
        if label_id:
            result.append(str(label_id))
    return result


def _plain_description_html(value) -> str:
    """Encode textarea text as Plane HTML without producing empty <p> tags."""
    text = str(value or "").strip()
    if not text:
        return ""
    return f"<p>{escape(text).replace(chr(10), '<br>')}</p>"


async def _gantt_type_labels(
    svc: PlaneService,
    project_id: str,
    issue_id: str,
    gantt_type: str,
) -> list[str] | None:
    """Build the Plane label list that persists an explicit Gantt task type."""
    if gantt_type not in {"task", "milestone"}:
        raise HTTPException(
            status_code=400,
            detail="gantt_type must be 'task' or 'milestone'; Projects are Plane Modules",
        )

    project_labels = await svc.list_labels(project_id)
    milestone_labels = [
        label
        for label in project_labels
        if str(label.get("name", "")).strip().casefold()
        in {"milestone", GANTT_MILESTONE_LABEL_NAME.casefold()}
    ]
    legacy_project_labels = [
        label
        for label in project_labels
        if str(label.get("name", "")).strip().casefold()
        == "gantt: project"
    ]

    # Creating the marker is only necessary when a user explicitly chooses
    # Milestone. Saving an ordinary task must not create project metadata.
    if gantt_type == "milestone" and not milestone_labels:
        milestone_labels = [
            await svc.create_label(project_id, GANTT_MILESTONE_LABEL_NAME)
        ]
    type_labels = milestone_labels + legacy_project_labels
    if not type_labels:
        return None

    issue = await svc.get_issue(project_id, issue_id)
    current_ids = _label_ids(issue.get("labels"))
    type_label_ids = {str(label["id"]) for label in type_labels}
    updated_ids = [label_id for label_id in current_ids if label_id not in type_label_ids]

    if gantt_type == "milestone":
        updated_ids.append(str(milestone_labels[0]["id"]))
    return updated_ids


# ------------------------------------------------------------------
# Health
# ------------------------------------------------------------------

@router.get("/health")
async def health():
    """Health check — verifies service is running and optionally checks Plane connectivity."""
    if not PLANE_BASE_URL:
        return {
            "status": "ok",
            "engine": "plane",
            "version": "3.1.0",
            "plane": "not configured",
            "cache": cache.is_available(),
        }

    svc = _get_plane_service()
    try:
        projects = await svc.list_projects()
        return {
            "status": "ok",
            "engine": "plane",
            "version": "3.1.0",
            "projects": len(projects),
            "cache": cache.is_available(),
        }
    except PlaneAPIError as e:
        return {"status": "ok", "engine": "plane", "version": "3.1.0", "plane": "unreachable", "error": e.detail, "cache": cache.is_available()}
    except Exception as e:
        return {"status": "ok", "engine": "plane", "version": "3.1.0", "plane": "error", "error": str(e), "cache": cache.is_available()}
    finally:
        await svc.close()


# ------------------------------------------------------------------
# Projects
# ------------------------------------------------------------------

@router.get("/projects")
async def list_projects():
    """
    List all Plane projects in the configured workspace.
    Compatible with the existing gantt-app SDK project list format.
    """
    cached = await cache.get("projects", "list")
    if cached is not None:
        return cached

    svc = _get_plane_service()
    try:
        projects = await svc.list_projects()
        result = transform_projects_to_list(projects)
        await cache.set("projects", "list", value=result)
        return result
    except PlaneAPIError as e:
        logger.error("Plane API error listing projects: %s", e.detail)
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    finally:
        await svc.close()


@router.get("/projects/{project_id}")
async def get_project(project_id: str):
    """Get a single project's metadata."""
    svc = _get_plane_service()
    try:
        resolved_id = await _resolve_project_id(svc, project_id)
        proj = await svc.get_project(resolved_id)
        return {
            "id": proj["id"],
            "slug": proj.get("identifier", "").lower() or proj["id"],
            "title": proj.get("name", ""),
            "description": proj.get("description", ""),
            "identifier": proj.get("identifier", ""),
            "source": "plane",
        }
    except PlaneAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    finally:
        await svc.close()


# ------------------------------------------------------------------
# Gantt Data (consumed by dhtmlxGantt SDK)
# ------------------------------------------------------------------

@router.get("/projects/{project_id}/data")
async def get_project_data(
    project_id: str,
    include_cycles: bool = Query(True, description="Include cycles as project bars"),
    include_modules: bool = Query(True, description="Include modules as project bars"),
    include_relations: bool = Query(True, description="Fetch issue relations for dependency arrows"),
    bypass_cache: bool = Query(False, description="Force fresh data from Plane"),
):
    """
    Get all issues for a Plane project in dhtmlxGantt format.

    Returns {data: [...tasks], links: [...dependencies]} — the standard
    payload format expected by the dhtmlxGantt SDK.

    Accepts either a UUID or a project identifier (e.g., 'persada').
    """
    svc = _get_plane_service()
    try:
        # Resolve slug/identifier to UUID
        resolved_id = await _resolve_project_id(svc, project_id)

        # A trashed module can leave its member work items visible as ordinary
        # project issues in some Plane versions. Hide the recorded members until
        # the module is restored or permanently deleted.
        try:
            trash_records = await trash.list_records(resolved_id)
        except RuntimeError:
            trash_records = []
        hidden_issue_ids = {
            issue_id
            for record in trash_records
            for issue_id in (
                [record["entity_id"]]
                if record.get("entity_type") == "issue"
                else record.get("member_issue_ids", [])
            )
        }

        # Version the representation so deployments do not reuse cached payloads
        # from the former same-date-implies-milestone transformer.
        cache_variant = f"plane_modules_v3_{include_cycles}_{include_modules}_{include_relations}"

        if not bypass_cache:
            cached = await cache.get("project_data", resolved_id, cache_variant)
            if cached is not None:
                return cached

        # Fetch labels as expanded objects so milestone type is explicit rather
        # than inferred from equal start and target dates.
        issues = await svc.list_issues(
            resolved_id, expand="assignees,state,labels,module"
        )
        if hidden_issue_ids:
            issues = [issue for issue in issues if issue.get("id") not in hidden_issue_ids]

        # Fetch states for mapping
        states_raw = await svc.list_states(resolved_id)
        states_map = {s["id"]: s for s in states_raw} if states_raw else {}

        # Optionally fetch cycles
        cycles = None
        if include_cycles:
            try:
                cycles = await svc.list_cycles(resolved_id)
            except PlaneAPIError:
                logger.warning("Failed to fetch cycles for project %s", resolved_id)

        # Optionally fetch modules
        modules = None
        if include_modules:
            try:
                modules = await svc.list_modules(resolved_id)
            except PlaneAPIError:
                logger.warning("Failed to fetch modules for project %s", resolved_id)

        # Build module-issue mapping (which issues belong to which module)
        module_issue_map = {}
        if modules:
            for module in modules:
                try:
                    mod_issues = await svc.list_module_issues(resolved_id, module["id"])
                    for mi in mod_issues:
                        # module-issues endpoint returns objects with issue/issue_detail
                        issue_id = mi.get("issue") or mi.get("id") or mi.get("issue_detail", {}).get("id")
                        if issue_id:
                            module_issue_map[issue_id] = module["id"]
                except PlaneAPIError:
                    pass

        # Optionally fetch relations for dependency arrows
        relations = None
        if include_relations and issues:
            relations = {}
            for issue in issues:
                issue_id = issue["id"]
                try:
                    rels = await svc.get_issue_relations(resolved_id, issue_id)
                    if any(rels.get(k) for k in ("blocking", "blocked_by", "start_before", "start_after", "finish_before", "finish_after")):
                        relations[issue_id] = rels
                except PlaneAPIError:
                    pass

        # Transform to dhtmlxGantt format
        result = transform_issues_to_gantt(
            issues=issues,
            relations=relations,
            cycles=cycles,
            modules=modules,
            states_map=states_map,
            module_issue_map=module_issue_map if module_issue_map else None,
        )

        await cache.set("project_data", resolved_id, cache_variant, value=result)
        return result

    except PlaneAPIError as e:
        logger.error("Plane API error fetching project data: %s", e.detail)
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    finally:
        await svc.close()


# ------------------------------------------------------------------
# DataProcessor endpoints (for bidirectional editing from dhtmlxGantt)
# ------------------------------------------------------------------

@router.put("/projects/{project_id}/task/{task_id}")
async def update_task(project_id: str, task_id: str, request: Request):
    """
    Update a task via dhtmlxGantt DataProcessor (REST mode).

    Handles:
    - Date changes (start_date, duration → target_date)
    - Sort order changes (sort_order field)

    Both are PATCHed back to Plane.
    """
    # Handle module bar reorder
    if task_id.startswith("module_"):
        module_id = task_id.replace("module_", "")
        # Module updates from DataProcessor only — dates aren't applicable to modules.
        # Sort order is handled by the /reorder endpoint (onRowDragEnd).
        return {"action": "updated"}

    # Skip cycle bars
    if task_id.startswith("cycle_"):
        return {"action": "updated"}

    svc = _get_plane_service()
    try:
        resolved_id = await _resolve_project_id(svc, project_id)
        form = await request.form()

        patch_data = {}

        # Handle date changes
        start_raw = form.get("start_date", "")
        duration = int(form.get("duration", 1) or 1)

        start_date = None
        for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d", "%d-%m-%Y %H:%M", "%d/%m/%Y %H:%M"):
            try:
                start_date = datetime.strptime(start_raw, fmt)
                break
            except (ValueError, TypeError):
                continue

        if start_date:
            from datetime import timedelta
            target_date = start_date + timedelta(days=duration)
            patch_data["start_date"] = start_date.strftime("%Y-%m-%d")
            patch_data["target_date"] = target_date.strftime("%Y-%m-%d")

        if patch_data:
            resp = await svc._client.patch(
                f"/api/v1/workspaces/{svc.workspace_slug}/projects/{resolved_id}/work-items/{task_id}/",
                json=patch_data,
            )
            if resp.status_code >= 400:
                logger.warning("Failed to update issue %s: %s", task_id, resp.text[:200])

            await cache.invalidate_project(resolved_id)

        return {"action": "updated"}

    except Exception as e:
        logger.error("Error updating task %s: %s", task_id, e)
        return {"action": "error"}
    finally:
        await svc.close()

@router.patch("/projects/{project_id}/issues/{issue_id}/dates")
async def update_issue_dates(project_id: str, issue_id: str, body: dict):
    """
    Update an issue's dates and/or explicit Gantt type in Plane.
    Used by the PlaneGanttView's handleTaskChange callback.
    """
    svc = _get_plane_service()
    try:
        resolved_id = await _resolve_project_id(svc, project_id)
        patch_data = {}
        if "name" in body:
            patch_data["name"] = body["name"]
        if "description" in body:
            patch_data["description_html"] = _plain_description_html(body["description"])
        if "start_date" in body:
            patch_data["start_date"] = body["start_date"]
        if "target_date" in body:
            patch_data["target_date"] = body["target_date"]

        if "gantt_type" in body:
            labels = await _gantt_type_labels(
                svc, resolved_id, issue_id, body["gantt_type"]
            )
            if labels is not None:
                patch_data["labels"] = labels

        if not patch_data:
            raise HTTPException(status_code=400, detail="No date fields provided")

        await svc.update_issue(resolved_id, issue_id, patch_data)

        await cache.invalidate_project(resolved_id)
        return {"action": "updated", "issue_id": issue_id}

    except PlaneAPIError as e:
        logger.error("Plane API error updating issue dates: %s", e.detail)
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    finally:
        await svc.close()


@router.post("/projects/{project_id}/issues")
async def create_issue(project_id: str, request: Request):
    """
    Create a new issue in Plane.

    Body: { "name": "...", "start_date": "YYYY-MM-DD", "target_date": "YYYY-MM-DD" }
    """
    svc = _get_plane_service()
    try:
        resolved_id = await _resolve_project_id(svc, project_id)
        body = await request.json()

        payload = {"name": body.get("name", "Untitled")}
        if "description" in body:
            payload["description_html"] = _plain_description_html(body["description"])
        if body.get("start_date"):
            payload["start_date"] = body["start_date"]
        if body.get("target_date"):
            payload["target_date"] = body["target_date"]

        data = await svc.create_issue(resolved_id, payload)
        if body.get("gantt_type") in {"task", "milestone"}:
            labels = await _gantt_type_labels(
                svc, resolved_id, data["id"], body["gantt_type"]
            )
            if labels is not None:
                await svc.update_issue(resolved_id, data["id"], {"labels": labels})
        await cache.invalidate_project(resolved_id)
        return {"action": "created", "issue_id": data.get("id"), "name": data.get("name")}

    except PlaneAPIError as e:
        logger.error("Plane API error creating issue: %s", e.detail)
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    finally:
        await svc.close()


def _module_payload(body: dict) -> dict:
    """Keep the Gantt/Plane module contract small and version-compatible."""
    payload = {"name": body.get("name") or "Untitled Module"}
    for field in ("description", "start_date", "target_date"):
        if field in body:
            payload[field] = body[field]
    return payload


@router.post("/projects/{project_id}/modules")
async def create_module(project_id: str, body: dict):
    """Create a real Plane Module, represented as a Project in the Gantt."""
    svc = _get_plane_service()
    try:
        resolved_id = await _resolve_project_id(svc, project_id)
        module = await svc.create_module(resolved_id, _module_payload(body))
        await cache.invalidate_project(resolved_id)
        return {"action": "created", "module_id": module.get("id"), "name": module.get("name")}
    except PlaneAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    finally:
        await svc.close()


@router.patch("/projects/{project_id}/modules/{module_id}")
async def update_module(project_id: str, module_id: str, body: dict):
    """Update a real Plane Module."""
    svc = _get_plane_service()
    try:
        resolved_id = await _resolve_project_id(svc, project_id)
        module = await svc.update_module(resolved_id, module_id, _module_payload(body))
        await cache.invalidate_project(resolved_id)
        return {"action": "updated", "module_id": module.get("id", module_id)}
    except PlaneAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    finally:
        await svc.close()


def _module_id(value) -> str | None:
    """Normalize Plane's expanded or UUID module field."""
    if isinstance(value, dict):
        return value.get("id")
    if isinstance(value, str):
        return value
    return None


async def _promote_issue(svc: PlaneService, project_id: str, issue_id: str) -> dict:
    """Promote a work item into a standalone Module using compensating writes."""
    issue = await svc.get_issue(project_id, issue_id)
    if issue.get("archived_at"):
        raise HTTPException(status_code=409, detail="Archived work items cannot be promoted")

    issues = await svc.list_issues(project_id, expand="module")
    children = [item for item in issues if item.get("parent") == issue_id and not item.get("archived_at")]
    old_modules = {item["id"]: _module_id(item.get("module")) for item in children}
    module_payload = {
        "name": issue.get("name") or "Untitled Module",
        "description": issue.get("description_html") or issue.get("description") or "",
        "start_date": issue.get("start_date"),
        "target_date": issue.get("target_date"),
        "external_source": "mcmc-gantt-promotion",
        "external_id": issue_id,
    }
    module_payload = {key: value for key, value in module_payload.items() if value is not None}
    module = await svc.create_module(project_id, module_payload)
    module_id = module["id"]
    moved_ids: list[str] = []

    try:
        child_ids = [item["id"] for item in children]
        if child_ids:
            await svc.add_module_issues(project_id, module_id, child_ids)
            for child_id in child_ids:
                await svc.update_issue(project_id, child_id, {"parent": None})
                moved_ids.append(child_id)

        await svc.update_issue(
            project_id,
            issue_id,
            # This self-hosted Plane API validates archived_at as a date even
            # though some API representations expose it as a timestamp.
            {"archived_at": datetime.now(timezone.utc).date().isoformat()},
        )
    except Exception:
        # The original issue is still active until the final write. Restore any
        # modified hierarchy/module membership before removing our new Module.
        for child_id in moved_ids:
            try:
                await svc.update_issue(project_id, child_id, {"parent": issue_id})
            except Exception:
                logger.exception("Failed to restore parent for %s", child_id)
        try:
            await svc.delete_module(project_id, module_id)
        except Exception:
            logger.exception("Failed to roll back promoted module %s", module_id)
        for child_id, old_module_id in old_modules.items():
            if old_module_id:
                try:
                    await svc.add_module_issues(project_id, old_module_id, [child_id])
                except Exception:
                    logger.exception("Failed to restore module for %s", child_id)
        raise

    return {
        "action": "promoted",
        "module_id": module_id,
        "archived_issue_id": issue_id,
        "moved_task_count": len(children),
    }


@router.post("/projects/{project_id}/issues/{issue_id}/promote-to-module")
async def promote_issue_to_module(project_id: str, issue_id: str):
    """Create a Module, move direct subtasks into it, then archive the source."""
    svc = _get_plane_service()
    try:
        resolved_id = await _resolve_project_id(svc, project_id)
        result = await _promote_issue(svc, resolved_id, issue_id)
        await cache.invalidate_project(resolved_id)
        return result
    except PlaneAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    finally:
        await svc.close()


# ------------------------------------------------------------------
# Recoverable deletion (Trash)
# ------------------------------------------------------------------

def _trash_issue_id(value: dict) -> str | None:
    """Normalize Plane module-issue records into a work-item UUID."""
    issue = value.get("issue")
    if isinstance(issue, dict):
        return issue.get("id")
    return issue or value.get("issue_detail", {}).get("id")


async def _move_to_trash(
    svc: PlaneService,
    project_id: str,
    entity_type: str,
    entity_id: str,
    gantt_type: str | None = None,
) -> dict:
    """Register an item, then archive it in Plane with compensation on failure."""
    if entity_type not in {"issue", "module"}:
        raise HTTPException(status_code=400, detail="entity_type must be 'issue' or 'module'")
    if await trash.get(project_id, entity_type, entity_id):
        raise HTTPException(status_code=409, detail="Item is already in Trash")

    if entity_type == "module":
        entity = await svc.get_module(project_id, entity_id)
        module_issues = await svc.list_module_issues(project_id, entity_id)
        member_ids = [issue_id for value in module_issues if (issue_id := _trash_issue_id(value))]
        record = trash.make_record(
            project_id=project_id,
            entity_type="module",
            entity_id=entity_id,
            gantt_type="project",
            name=entity.get("name") or "Untitled Project",
            member_issue_ids=member_ids,
        )
    else:
        entity = await svc.get_issue(project_id, entity_id)
        record = trash.make_record(
            project_id=project_id,
            entity_type="issue",
            entity_id=entity_id,
            gantt_type="milestone" if gantt_type == "milestone" else "task",
            name=entity.get("name") or "Untitled Task",
            sequence_id=entity.get("sequence_id"),
        )

    # Register first so an archive can never become invisible to our cleanup
    # process. Remove the record if Plane rejects the archive operation.
    await trash.put(record)
    try:
        if entity_type == "module":
            await svc.archive_module(project_id, entity_id)
        else:
            await svc.update_issue(
                project_id,
                entity_id,
                {"archived_at": datetime.now(timezone.utc).date().isoformat()},
            )
    except Exception:
        await trash.remove(project_id, entity_type, entity_id)
        raise

    return record


async def _restore_from_trash(
    svc: PlaneService,
    project_id: str,
    entity_type: str,
    entity_id: str,
) -> dict:
    """Unarchive an item and remove its registry entry only after success."""
    record = await trash.get(project_id, entity_type, entity_id)
    if not record:
        raise HTTPException(status_code=404, detail="Trash item not found")

    if entity_type == "module":
        await svc.unarchive_module(project_id, entity_id)
        member_ids = record.get("member_issue_ids", [])
        if member_ids:
            try:
                current = await svc.list_module_issues(project_id, entity_id)
                current_ids = {
                    issue_id for value in current if (issue_id := _trash_issue_id(value))
                }
                missing = [issue_id for issue_id in member_ids if issue_id not in current_ids]
                if missing:
                    await svc.add_module_issues(project_id, entity_id, missing)
            except PlaneAPIError:
                # Plane normally preserves membership while archived. A failed
                # compatibility check must not turn a successful restore into a
                # misleading failure.
                logger.warning("Could not verify restored module membership for %s", entity_id)
    elif entity_type == "issue":
        await svc.update_issue(project_id, entity_id, {"archived_at": None})
    else:
        raise HTTPException(status_code=400, detail="entity_type must be 'issue' or 'module'")

    await trash.remove(project_id, entity_type, entity_id)
    return record


@router.get("/projects/{project_id}/trash")
async def list_trash(project_id: str):
    """List items deleted through this Gantt, newest first."""
    svc = _get_plane_service()
    try:
        resolved_id = await _resolve_project_id(svc, project_id)
        items = await trash.list_records(resolved_id)
        return {"items": items, "retention_days": trash.RETENTION_DAYS}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    finally:
        await svc.close()


@router.post("/projects/{project_id}/trash/{entity_type}/{entity_id}")
async def move_to_trash(
    project_id: str,
    entity_type: str,
    entity_id: str,
    body: dict | None = None,
):
    """Archive a Task, Milestone, or Project and retain it for 30 days."""
    svc = _get_plane_service()
    try:
        resolved_id = await _resolve_project_id(svc, project_id)
        record = await _move_to_trash(
            svc,
            resolved_id,
            entity_type,
            entity_id,
            (body or {}).get("gantt_type"),
        )
        await cache.invalidate_project(resolved_id)
        return {"action": "trashed", "item": record}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except PlaneAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    finally:
        await svc.close()


@router.post("/projects/{project_id}/trash/{entity_type}/{entity_id}/restore")
async def restore_trash_item(project_id: str, entity_type: str, entity_id: str):
    """Restore a trashed item to its original Plane project/module context."""
    svc = _get_plane_service()
    try:
        resolved_id = await _resolve_project_id(svc, project_id)
        record = await _restore_from_trash(svc, resolved_id, entity_type, entity_id)
        await cache.invalidate_project(resolved_id)
        return {"action": "restored", "item": record}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except PlaneAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    finally:
        await svc.close()


@router.delete("/projects/{project_id}/trash/{entity_type}/{entity_id}")
async def delete_trash_item_forever(
    project_id: str,
    entity_type: str,
    entity_id: str,
    confirm: bool = Query(False),
):
    """Permanently delete one item that is already in Trash."""
    if not confirm:
        raise HTTPException(status_code=400, detail="Permanent deletion requires confirm=true")
    svc = _get_plane_service()
    try:
        resolved_id = await _resolve_project_id(svc, project_id)
        record = await trash.get(resolved_id, entity_type, entity_id)
        if not record:
            raise HTTPException(status_code=404, detail="Trash item not found")
        if entity_type == "module":
            await svc.delete_archived_module(resolved_id, entity_id)
        elif entity_type == "issue":
            await svc.delete_archived_issue(resolved_id, entity_id)
        else:
            raise HTTPException(status_code=400, detail="entity_type must be 'issue' or 'module'")
        await trash.remove(resolved_id, entity_type, entity_id)
        await cache.invalidate_project(resolved_id)
        return {"action": "deleted", "item": record}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except PlaneAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    finally:
        await svc.close()


@router.delete("/projects/{project_id}/issues/{issue_id}")
async def delete_issue(project_id: str, issue_id: str, confirm: bool = Query(False)):
    """Permanently delete a Task or Milestone after explicit confirmation."""
    if not confirm:
        raise HTTPException(status_code=400, detail="Permanent deletion requires confirm=true")
    svc = _get_plane_service()
    try:
        resolved_id = await _resolve_project_id(svc, project_id)
        await svc.delete_issue(resolved_id, issue_id)
        await cache.invalidate_project(resolved_id)
        return {"action": "deleted", "issue_id": issue_id}
    except PlaneAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    finally:
        await svc.close()


@router.delete("/projects/{project_id}/modules/{module_id}")
async def delete_module(project_id: str, module_id: str, confirm: bool = Query(False)):
    """Permanently delete a Module; its work items remain in Plane."""
    if not confirm:
        raise HTTPException(status_code=400, detail="Permanent deletion requires confirm=true")
    svc = _get_plane_service()
    try:
        resolved_id = await _resolve_project_id(svc, project_id)
        module_issues = await svc.list_module_issues(resolved_id, module_id)
        await svc.delete_module(resolved_id, module_id)
        await cache.invalidate_project(resolved_id)
        return {
            "action": "deleted",
            "module_id": module_id,
            "preserved_task_count": len(module_issues),
        }
    except PlaneAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    finally:
        await svc.close()


# ------------------------------------------------------------------
# Cache management
# ------------------------------------------------------------------

@router.post("/cache/invalidate")
async def invalidate_cache(project_id: str = Query(None, description="Invalidate specific project or all")):
    """Manually invalidate cached Plane data."""
    if not cache.is_available():
        return {"status": "skipped", "reason": "Cache not configured"}

    if project_id:
        await cache.invalidate_project(project_id)
        return {"status": "ok", "invalidated": f"project:{project_id}"}
    else:
        await cache.invalidate_all()
        return {"status": "ok", "invalidated": "all"}


# ------------------------------------------------------------------
# Sort order (reorder tasks/modules in the Gantt)
# ------------------------------------------------------------------

@router.post("/projects/{project_id}/reorder")
async def reorder_items(project_id: str, request: Request):
    """
    Persist sort order changes back to Plane.

    Called by the SDK's onRowDragEnd handler when user reorders rows.

    Accepts two formats:
    - Array: [{"id": "...", "sort_order": 0}, ...]
    - Object: {"items": [{"id": "...", "sort_order": 0, "type": "issue"}, ...]}
    """
    svc = _get_plane_service()
    try:
        resolved_id = await _resolve_project_id(svc, project_id)
        body = await request.json()
        logger.info("Reorder called: project=%s body=%s", project_id, body)

        # Normalize body format
        if isinstance(body, list):
            items = body
        elif isinstance(body, dict):
            items = body.get("items", [])
        else:
            return {"action": "updated", "count": 0}

        if not items:
            return {"action": "updated", "count": 0}

        updated = 0
        for item in items:
            item_id = str(item.get("id", ""))
            sort_order = item.get("sort_order")

            if sort_order is None or not item_id:
                continue

            # Convert index-based sort_order to Plane's float format (multiply by 10000 for spacing)
            plane_sort_order = float(sort_order) * 10000 + 5535

            # Determine if this is a module or issue by checking the ID prefix
            if item_id.startswith("module_"):
                module_id = item_id.replace("module_", "")
                resp = await svc._client.patch(
                    f"/api/v1/workspaces/{svc.workspace_slug}/projects/{resolved_id}/modules/{module_id}/",
                    json={"sort_order": plane_sort_order},
                )
            elif item_id.startswith("cycle_"):
                continue  # Skip cycles
            else:
                resp = await svc._client.patch(
                    f"/api/v1/workspaces/{svc.workspace_slug}/projects/{resolved_id}/work-items/{item_id}/",
                    json={"sort_order": plane_sort_order},
                )

            if resp.status_code < 400:
                updated += 1
            else:
                logger.warning("Failed to reorder %s: %s", item_id, resp.text[:200])

        await cache.invalidate_project(resolved_id)
        return {"action": "updated", "count": updated}

    except PlaneAPIError as e:
        logger.error("Plane API error during reorder: %s", e.detail)
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        logger.error("Reorder error: %s", e)
        return {"action": "updated", "count": 0}
    finally:
        await svc.close()
