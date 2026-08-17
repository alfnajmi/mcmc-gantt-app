"""Plane.so API client — fetches projects, issues, cycles, modules, and relations."""

import logging
from typing import Any

import httpx

from app.config import PLANE_BASE_URL, PLANE_API_TOKEN, PLANE_WORKSPACE_SLUG

logger = logging.getLogger(__name__)

# Plane API v1 base path
_API_PREFIX = "/api/v1"


class PlaneAPIError(Exception):
    """Raised when the Plane API returns a non-2xx response."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"Plane API error {status_code}: {detail}")


class PlaneService:
    """
    Async client for Plane's REST API.

    Authentication uses X-API-Key header with a Personal Access Token.
    Ref: https://developers.plane.so/api-reference/introduction
    """

    def __init__(
        self,
        base_url: str | None = None,
        api_token: str | None = None,
        workspace_slug: str | None = None,
    ):
        self.base_url = (base_url or PLANE_BASE_URL).rstrip("/")
        self.api_token = api_token or PLANE_API_TOKEN
        self.workspace_slug = workspace_slug or PLANE_WORKSPACE_SLUG

        if not self.base_url:
            raise ValueError("PLANE_BASE_URL is not configured")
        if not self.api_token:
            raise ValueError("PLANE_API_TOKEN is not configured")
        if not self.workspace_slug:
            raise ValueError("PLANE_WORKSPACE_SLUG is not configured")

        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers={
                "X-API-Key": self.api_token,
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

    async def close(self):
        """Close the underlying HTTP client."""
        await self._client.aclose()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get(self, path: str, params: dict | None = None) -> Any:
        """Make a GET request and return parsed JSON."""
        url = f"{_API_PREFIX}{path}"
        logger.debug("GET %s params=%s", url, params)
        resp = await self._client.get(url, params=params)
        if resp.status_code >= 400:
            raise PlaneAPIError(resp.status_code, resp.text[:500])
        return resp.json()

    async def _get_paginated(self, path: str, params: dict | None = None) -> list[dict]:
        """
        Fetch all pages from a paginated Plane endpoint.

        Plane uses cursor-based pagination with format: per_page:offset:is_prev
        """
        all_results = []
        params = dict(params or {})
        params.setdefault("per_page", 100)

        while True:
            data = await self._get(path, params=params)

            # Handle both paginated and non-paginated responses
            if isinstance(data, list):
                all_results.extend(data)
                break
            elif isinstance(data, dict) and "results" in data:
                all_results.extend(data["results"])
                if data.get("next_page_results") and data.get("next_cursor"):
                    params["cursor"] = data["next_cursor"]
                else:
                    break
            else:
                # Single object or unexpected format
                all_results.append(data)
                break

        return all_results

    async def _write(self, method: str, path: str, payload: dict) -> dict:
        """Make a JSON write request and return its response body."""
        resp = await self._client.request(
            method, f"{_API_PREFIX}{path}", json=payload
        )
        if resp.status_code >= 400:
            raise PlaneAPIError(resp.status_code, resp.text[:500])
        return resp.json() if resp.content else {}

    async def _delete(self, path: str) -> None:
        """Make a permanent DELETE request."""
        resp = await self._client.delete(f"{_API_PREFIX}{path}")
        if resp.status_code >= 400:
            raise PlaneAPIError(resp.status_code, resp.text[:500])

    # ------------------------------------------------------------------
    # Workspace
    # ------------------------------------------------------------------

    @property
    def _ws(self) -> str:
        """Workspace path prefix."""
        return f"/workspaces/{self.workspace_slug}"

    # ------------------------------------------------------------------
    # Projects
    # ------------------------------------------------------------------

    async def list_projects(self) -> list[dict]:
        """List all projects in the workspace."""
        return await self._get_paginated(f"{self._ws}/projects/")

    async def get_project(self, project_id: str) -> dict:
        """Get a single project by ID."""
        return await self._get(f"{self._ws}/projects/{project_id}/")

    # ------------------------------------------------------------------
    # Work Items (Issues)
    # ------------------------------------------------------------------

    async def list_issues(
        self,
        project_id: str,
        expand: str = "assignees,state",
    ) -> list[dict]:
        """
        List all work items (issues) in a project.

        Expands assignees and state by default for richer Gantt display.
        """
        params = {"expand": expand}
        return await self._get_paginated(
            f"{self._ws}/projects/{project_id}/work-items/", params=params
        )

    async def get_issue(self, project_id: str, issue_id: str) -> dict:
        """Get a single work item by ID."""
        return await self._get(
            f"{self._ws}/projects/{project_id}/work-items/{issue_id}/"
        )

    async def create_issue(self, project_id: str, payload: dict) -> dict:
        """Create a work item."""
        return await self._write(
            "post", f"{self._ws}/projects/{project_id}/work-items/", payload
        )

    async def update_issue(self, project_id: str, issue_id: str, payload: dict) -> dict:
        """Update a work item, including its archive or parent state."""
        return await self._write(
            "patch",
            f"{self._ws}/projects/{project_id}/work-items/{issue_id}/",
            payload,
        )

    async def delete_issue(self, project_id: str, issue_id: str) -> None:
        """Permanently delete a work item."""
        await self._delete(
            f"{self._ws}/projects/{project_id}/work-items/{issue_id}/"
        )

    async def delete_archived_issue(self, project_id: str, issue_id: str) -> None:
        """Permanently delete an archived work item across Plane API variants."""
        try:
            await self.delete_issue(project_id, issue_id)
        except PlaneAPIError as exc:
            if exc.status_code != 404:
                raise
            # Older Plane releases require restoration before permanent delete.
            await self.update_issue(project_id, issue_id, {"archived_at": None})
            await self.delete_issue(project_id, issue_id)

    # ------------------------------------------------------------------
    # Labels
    # ------------------------------------------------------------------

    async def list_labels(self, project_id: str) -> list[dict]:
        """List all labels configured for a project."""
        return await self._get_paginated(
            f"{self._ws}/projects/{project_id}/labels/"
        )

    async def create_label(self, project_id: str, name: str) -> dict:
        """Create a project label and return it."""
        resp = await self._client.post(
            f"{_API_PREFIX}{self._ws}/projects/{project_id}/labels/",
            json={"name": name},
        )
        if resp.status_code >= 400:
            raise PlaneAPIError(resp.status_code, resp.text[:500])
        return resp.json()

    # ------------------------------------------------------------------
    # Work Item Relations
    # ------------------------------------------------------------------

    async def get_issue_relations(self, project_id: str, issue_id: str) -> dict:
        """
        Get all relations for a work item.

        Returns dict with keys: blocking, blocked_by, duplicate,
        relates_to, start_before, start_after, finish_before, finish_after
        """
        return await self._get(
            f"{self._ws}/projects/{project_id}/work-items/{issue_id}/relations/"
        )

    # ------------------------------------------------------------------
    # Cycles
    # ------------------------------------------------------------------

    async def list_cycles(self, project_id: str) -> list[dict]:
        """List all cycles in a project."""
        return await self._get_paginated(
            f"{self._ws}/projects/{project_id}/cycles/"
        )

    async def list_cycle_issues(self, project_id: str, cycle_id: str) -> list[dict]:
        """List all work items assigned to a cycle."""
        return await self._get_paginated(
            f"{self._ws}/projects/{project_id}/cycles/{cycle_id}/cycle-issues/"
        )

    # ------------------------------------------------------------------
    # Modules
    # ------------------------------------------------------------------

    async def list_modules(self, project_id: str) -> list[dict]:
        """List all modules in a project."""
        return await self._get_paginated(
            f"{self._ws}/projects/{project_id}/modules/"
        )

    async def get_module(self, project_id: str, module_id: str) -> dict:
        """Get a single active module."""
        return await self._get(
            f"{self._ws}/projects/{project_id}/modules/{module_id}/"
        )

    async def list_module_issues(self, project_id: str, module_id: str) -> list[dict]:
        """List all work items assigned to a module."""
        return await self._get_paginated(
            f"{self._ws}/projects/{project_id}/modules/{module_id}/module-issues/"
        )

    async def create_module(self, project_id: str, payload: dict) -> dict:
        """Create a Plane module (shown as a Project in the Gantt)."""
        return await self._write(
            "post", f"{self._ws}/projects/{project_id}/modules/", payload
        )

    async def update_module(self, project_id: str, module_id: str, payload: dict) -> dict:
        """Update a Plane module."""
        return await self._write(
            "patch",
            f"{self._ws}/projects/{project_id}/modules/{module_id}/",
            payload,
        )

    async def add_module_issues(
        self, project_id: str, module_id: str, issue_ids: list[str]
    ) -> dict:
        """Move work items into a module."""
        return await self._write(
            "post",
            f"{self._ws}/projects/{project_id}/modules/{module_id}/module-issues/",
            {"issues": issue_ids},
        )

    async def delete_module(self, project_id: str, module_id: str) -> None:
        """Permanently delete a module. Plane leaves its work items intact."""
        await self._delete(
            f"{self._ws}/projects/{project_id}/modules/{module_id}/"
        )

    async def archive_module(self, project_id: str, module_id: str) -> None:
        """Move a module to Plane's archive."""
        await self._write(
            "post",
            f"{self._ws}/projects/{project_id}/modules/{module_id}/archive/",
            {},
        )

    async def unarchive_module(self, project_id: str, module_id: str) -> None:
        """Restore a module from Plane's archive."""
        await self._delete(
            f"{self._ws}/projects/{project_id}/archived-modules/{module_id}/unarchive/"
        )

    async def delete_archived_module(self, project_id: str, module_id: str) -> None:
        """Permanently delete an archived module across Plane API variants."""
        try:
            await self._delete(
                f"{self._ws}/projects/{project_id}/archived-modules/{module_id}/"
            )
        except PlaneAPIError as exc:
            if exc.status_code != 404:
                raise
            # Some Plane versions accept deletion through the ordinary module
            # endpoint while archived; others require unarchiving first.
            try:
                await self.delete_module(project_id, module_id)
            except PlaneAPIError as active_exc:
                if active_exc.status_code != 404:
                    raise
                await self.unarchive_module(project_id, module_id)
                await self.delete_module(project_id, module_id)

    # ------------------------------------------------------------------
    # States (for mapping state IDs to names/groups)
    # ------------------------------------------------------------------

    async def list_states(self, project_id: str) -> list[dict]:
        """List all states (workflow statuses) for a project."""
        return await self._get_paginated(
            f"{self._ws}/projects/{project_id}/states/"
        )
