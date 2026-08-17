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
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Request

from app.config import PLANE_BASE_URL
from app.services.plane import PlaneService, PlaneAPIError
from app.services.plane_transformer import transform_issues_to_gantt, transform_projects_to_list
from app.services import cache

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
            "version": "3.0.0",
            "plane": "not configured",
            "cache": cache.is_available(),
        }

    svc = _get_plane_service()
    try:
        projects = await svc.list_projects()
        return {
            "status": "ok",
            "engine": "plane",
            "version": "3.0.0",
            "projects": len(projects),
            "cache": cache.is_available(),
        }
    except PlaneAPIError as e:
        return {"status": "ok", "engine": "plane", "version": "3.0.0", "plane": "unreachable", "error": e.detail, "cache": cache.is_available()}
    except Exception as e:
        return {"status": "ok", "engine": "plane", "version": "3.0.0", "plane": "error", "error": str(e), "cache": cache.is_available()}
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

        cache_variant = f"{include_cycles}_{include_modules}_{include_relations}"

        if not bypass_cache:
            cached = await cache.get("project_data", resolved_id, cache_variant)
            if cached is not None:
                return cached

        # Fetch issues with expanded state and assignees
        issues = await svc.list_issues(resolved_id, expand="assignees,state")

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
    Update an issue's start_date and/or target_date in Plane.
    Used by the PlaneGanttView's handleTaskChange callback.
    """
    svc = _get_plane_service()
    try:
        patch_data = {}
        if "start_date" in body:
            patch_data["start_date"] = body["start_date"]
        if "target_date" in body:
            patch_data["target_date"] = body["target_date"]

        if not patch_data:
            raise HTTPException(status_code=400, detail="No date fields provided")

        resp = await svc._client.patch(
            f"/api/v1/workspaces/{svc.workspace_slug}/projects/{project_id}/work-items/{issue_id}/",
            json=patch_data,
        )
        if resp.status_code >= 400:
            raise PlaneAPIError(resp.status_code, resp.text[:500])

        await cache.invalidate_project(project_id)
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
        if body.get("start_date"):
            payload["start_date"] = body["start_date"]
        if body.get("target_date"):
            payload["target_date"] = body["target_date"]

        resp = await svc._client.post(
            f"/api/v1/workspaces/{svc.workspace_slug}/projects/{resolved_id}/work-items/",
            json=payload,
        )
        if resp.status_code >= 400:
            raise PlaneAPIError(resp.status_code, resp.text[:500])

        data = resp.json()
        await cache.invalidate_project(resolved_id)
        return {"action": "created", "issue_id": data.get("id"), "name": data.get("name")}

    except PlaneAPIError as e:
        logger.error("Plane API error creating issue: %s", e.detail)
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
