"""
Transform Plane.so data into dhtmlxGantt-compatible format.

Plane concepts → dhtmlx Gantt mapping:
  - Issue (work item)  → Task bar
  - Sub-issue (parent) → Nested/child task
  - Cycle              → Project-type bar (group)
  - Module             → Project-type bar (group)
  - Issue relations    → Dependency links (arrows)

dhtmlxGantt expects:
  {
    "data": [ { id, text, start_date, duration, parent, type, progress, ... } ],
    "links": [ { id, source, target, type } ]
  }

Link types in dhtmlx:
  "0" — finish-to-start (source finishes → target starts)
  "1" — start-to-start
  "2" — finish-to-finish
  "3" — start-to-finish
"""

import logging
from datetime import date, datetime
from typing import Any

logger = logging.getLogger(__name__)

DATE_FMT = "%Y-%m-%d %H:%M"


def _parse_date(value: str | None) -> datetime | None:
    """Parse a date string from Plane (ISO format YYYY-MM-DD or full datetime)."""
    if not value:
        return None
    try:
        if "T" in value:
            return datetime.fromisoformat(value.replace("Z", "+00:00").replace("+00:00", ""))
        return datetime.strptime(value, "%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def _compute_duration(start: datetime | None, end: datetime | None) -> int:
    """Compute duration in days between two dates. Returns 0 for same-day (milestone)."""
    if not start or not end:
        return 1
    delta = (end - start).days
    if delta == 0:
        return 0  # Same day = milestone
    return max(delta, 1)


def _map_state_to_status(state: dict | str | None, states_map: dict[str, dict] | None = None) -> str:
    """
    Map a Plane state to a gantt-compatible status string.

    Plane state groups: backlog, unstarted, started, completed, cancelled
    Our gantt uses: to do, planning, in progress, complete
    """
    if not state:
        return "to do"

    # If state is expanded (dict), use its group
    if isinstance(state, dict):
        group = state.get("group", "")
        name = state.get("name", "")
    elif states_map and isinstance(state, str):
        # state is a UUID, look up in map
        state_info = states_map.get(state, {})
        group = state_info.get("group", "")
        name = state_info.get("name", "")
    else:
        return "to do"

    # Map Plane state groups to our status values
    group_lower = group.lower()
    if group_lower == "completed":
        return "complete"
    elif group_lower == "started":
        return "in progress"
    elif group_lower == "unstarted":
        return "to do"
    elif group_lower == "backlog":
        return "planning"
    elif group_lower == "cancelled":
        return "complete"  # Show as done (greyed out in gantt)

    return "to do"


def _map_priority(priority: str | None) -> str:
    """Map Plane priority to a display-friendly string."""
    mapping = {
        "urgent": "Urgent",
        "high": "High",
        "medium": "Medium",
        "low": "Low",
        "none": "",
    }
    return mapping.get((priority or "").lower(), "")


def _extract_assignee_names(assignees: Any) -> str:
    """
    Extract assignee display names from expanded assignees list.

    Plane returns assignees as either:
    - List of UUIDs (unexpanded)
    - List of dicts with display_name/first_name (expanded)
    """
    if not assignees or not isinstance(assignees, list):
        return ""

    names = []
    for a in assignees:
        if isinstance(a, dict):
            name = a.get("display_name") or a.get("first_name") or ""
            if name:
                names.append(name)
        # If it's just a UUID string, we can't resolve it here
    return ", ".join(names)


def transform_issues_to_gantt(
    issues: list[dict],
    relations: dict[str, dict] | None = None,
    cycles: list[dict] | None = None,
    modules: list[dict] | None = None,
    states_map: dict[str, dict] | None = None,
    module_issue_map: dict[str, str] | None = None,
) -> dict[str, list]:
    """
    Transform Plane issues (and optionally cycles/modules) into dhtmlxGantt format.

    Args:
        issues: List of Plane work items (expanded with assignees, state)
        relations: Dict mapping issue_id → relations dict (blocking, blocked_by, etc.)
        cycles: List of Plane cycles (rendered as project-type bars)
        modules: List of Plane modules (rendered as project-type bars)
        states_map: Dict mapping state UUID → state dict (name, group, color)
        module_issue_map: Dict mapping issue_id → module_id (for nesting under modules)

    Returns:
        {"data": [...tasks...], "links": [...dependency links...]}
    """
    tasks = []
    links = []
    link_id_counter = 1

    # --- Cycles as top-level project bars ---
    if cycles:
        for cycle in cycles:
            cycle_start = _parse_date(cycle.get("start_date"))
            cycle_end = _parse_date(cycle.get("end_date"))

            if not cycle_start:
                continue  # Skip cycles without dates

            tasks.append({
                "id": f"cycle_{cycle['id']}",
                "text": f"🔄 {cycle.get('name', 'Untitled Cycle')}",
                "start_date": cycle_start.strftime(DATE_FMT),
                "duration": _compute_duration(cycle_start, cycle_end),
                "parent": 0,
                "type": "project",
                "progress": 0,
                "status": cycle.get("status", ""),
                "assignee": "",
                "open": True,
                "sort_order": cycle.get("sort_order", 0),
                "plane_id": cycle["id"],
                "plane_type": "cycle",
            })

    # --- Modules as top-level project bars ---
    if modules:
        for module in modules:
            mod_start = _parse_date(module.get("start_date"))
            mod_end = _parse_date(module.get("target_date"))

            if not mod_start:
                continue  # Skip modules without dates

            tasks.append({
                "id": f"module_{module['id']}",
                "text": module.get('name', 'Untitled Module'),
                "start_date": mod_start.strftime(DATE_FMT),
                "duration": _compute_duration(mod_start, mod_end),
                "parent": 0,
                "type": "project",
                "progress": 0,
                "status": module.get("status", ""),
                "assignee": module.get("lead", {}).get("display_name", "") if isinstance(module.get("lead"), dict) else "",
                "open": True,
                "sort_order": module.get("sort_order", 0),
                "plane_id": module["id"],
                "plane_type": "module",
            })

    # --- Issues as task bars ---
    # Build a lookup for parent resolution
    issue_ids = {issue["id"] for issue in issues}

    for issue in issues:
        issue_id = issue["id"]
        start = _parse_date(issue.get("start_date"))
        end = _parse_date(issue.get("target_date"))

        # Skip issues without any date info — they can't be rendered on a timeline
        if not start and not end:
            logger.debug("Skipping issue %s (no dates)", issue_id)
            continue

        # Default start to today if only end is set
        if not start:
            start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        # Default end to start + 1 day if only start is set
        if not end:
            end = start

        duration = _compute_duration(start, end)

        # Resolve parent — use Plane's parent field (sub-issue hierarchy)
        # If no sub-issue parent, check if issue belongs to a module
        parent_id = issue.get("parent")
        if parent_id and parent_id in issue_ids:
            parent = parent_id
        elif module_issue_map and issue_id in module_issue_map:
            parent = f"module_{module_issue_map[issue_id]}"
        else:
            parent = 0

        # Determine task type
        # If this issue has children (other issues reference it as parent), mark as "project"
        has_children = any(i.get("parent") == issue_id for i in issues)
        if has_children:
            task_type = "project"
        elif duration == 0:
            task_type = "milestone"
        else:
            task_type = "task"

        # Map state
        status = _map_state_to_status(issue.get("state"), states_map)

        # Calculate progress based on state
        progress = 0.0
        if status == "complete":
            progress = 1.0
        elif status == "in progress":
            progress = 0.5

        tasks.append({
            "id": issue_id,
            "text": issue.get("name", "Untitled"),
            "start_date": start.strftime(DATE_FMT),
            "duration": duration,
            "parent": parent,
            "type": task_type,
            "progress": progress,
            "status": status,
            "priority": _map_priority(issue.get("priority")),
            "assignee": _extract_assignee_names(issue.get("assignees")),
            "open": True,
            "sort_order": issue.get("sort_order", 0),
            "plane_id": issue_id,
            "plane_type": "issue",
            "sequence_id": issue.get("sequence_id"),
        })

    # --- Relations as dependency links ---
    if relations:
        for issue_id, rels in relations.items():
            if not isinstance(rels, dict):
                continue

            # blocked_by: if A is blocked_by B → link from B to A (finish-to-start)
            for blocker_id in rels.get("blocked_by", []):
                if blocker_id in issue_ids:
                    links.append({
                        "id": link_id_counter,
                        "source": blocker_id,
                        "target": issue_id,
                        "type": "0",  # finish-to-start
                    })
                    link_id_counter += 1

            # blocking: if A is blocking B → link from A to B (finish-to-start)
            for blocked_id in rels.get("blocking", []):
                if blocked_id in issue_ids:
                    links.append({
                        "id": link_id_counter,
                        "source": issue_id,
                        "target": blocked_id,
                        "type": "0",  # finish-to-start
                    })
                    link_id_counter += 1

            # start_after: A starts after B finishes → same as finish-to-start
            for dep_id in rels.get("start_after", []):
                if dep_id in issue_ids:
                    links.append({
                        "id": link_id_counter,
                        "source": dep_id,
                        "target": issue_id,
                        "type": "0",
                    })
                    link_id_counter += 1

            # start_before: A starts before B → link from A to B (start-to-start)
            for dep_id in rels.get("start_before", []):
                if dep_id in issue_ids:
                    links.append({
                        "id": link_id_counter,
                        "source": issue_id,
                        "target": dep_id,
                        "type": "1",  # start-to-start
                    })
                    link_id_counter += 1

            # finish_before: A finishes before B → link from A to B (finish-to-finish)
            for dep_id in rels.get("finish_before", []):
                if dep_id in issue_ids:
                    links.append({
                        "id": link_id_counter,
                        "source": issue_id,
                        "target": dep_id,
                        "type": "2",  # finish-to-finish
                    })
                    link_id_counter += 1

            # finish_after: A finishes after B → link from B to A (finish-to-finish)
            for dep_id in rels.get("finish_after", []):
                if dep_id in issue_ids:
                    links.append({
                        "id": link_id_counter,
                        "source": dep_id,
                        "target": issue_id,
                        "type": "2",
                    })
                    link_id_counter += 1

    # Deduplicate links (same source+target pair)
    seen_links = set()
    unique_links = []
    for link in links:
        key = (link["source"], link["target"])
        if key not in seen_links:
            seen_links.add(key)
            unique_links.append(link)

    # Sort tasks: modules first (by sort_order), then issues within each group (by sort_order)
    # This ensures the Gantt grid renders in a logical order
    def _sort_key(t):
        # Modules/cycles come first (type == "project"), sorted by sort_order ascending
        type_priority = 0 if t["type"] == "project" else 1
        return (type_priority, t.get("sort_order", 0))

    tasks.sort(key=_sort_key)

    return {"data": tasks, "links": unique_links}


def transform_projects_to_list(projects: list[dict]) -> list[dict]:
    """
    Transform Plane projects into a simple list for the project selector.

    Returns a format compatible with the existing gantt-app /api/projects response.
    """
    result = []
    for proj in projects:
        result.append({
            "id": proj["id"],
            "slug": proj.get("identifier", "").lower() or proj["id"],
            "title": proj.get("name", "Untitled Project"),
            "description": proj.get("description", ""),
            "identifier": proj.get("identifier", ""),
            "source": "plane",
            "created_at": proj.get("created_at", ""),
            "updated_at": proj.get("updated_at", ""),
        })
    return result
