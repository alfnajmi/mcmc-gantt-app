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

    async def list_module_issues(self, project_id: str, module_id: str) -> list[dict]:
        """List all work items assigned to a module."""
        return await self._get_paginated(
            f"{self._ws}/projects/{project_id}/modules/{module_id}/module-issues/"
        )

    # ------------------------------------------------------------------
    # States (for mapping state IDs to names/groups)
    # ------------------------------------------------------------------

    async def list_states(self, project_id: str) -> list[dict]:
        """List all states (workflow statuses) for a project."""
        return await self._get_paginated(
            f"{self._ws}/projects/{project_id}/states/"
        )
