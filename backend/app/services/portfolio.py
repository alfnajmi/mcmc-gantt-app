"""Build a read-only, cross-project management timeline from Plane work items."""

from datetime import datetime
from typing import Any

from app.services.plane_transformer import (
    _extract_assignee_names,
    _map_state_to_status,
    _parse_date,
)


def _label_names(labels: Any) -> set[str]:
    return {
        str(label.get("name", "")).strip().casefold()
        for label in labels or []
        if isinstance(label, dict) and str(label.get("name", "")).strip()
    }


def _progress_for_status(status: str) -> float:
    return {"complete": 1.0, "in progress": 0.5}.get(status, 0.0)


def _segment(project: dict, issue: dict, states_map: dict[str, dict]) -> dict | None:
    start = _parse_date(issue.get("start_date"))
    end = _parse_date(issue.get("target_date"))
    if not start and not end:
        return None
    if not start:
        start = end
    if not end:
        end = start
    status = _map_state_to_status(issue.get("state"), states_map)
    return {
        "id": f"{project['id']}:{issue['id']}",
        "project_id": project["id"],
        "project_identifier": project.get("identifier", ""),
        "project_title": project.get("name", "Untitled Project"),
        "plane_id": issue["id"],
        "text": issue.get("name", "Untitled"),
        "start_date": start.strftime("%Y-%m-%d"),
        "end_date": end.strftime("%Y-%m-%d"),
        "status": status,
        "progress": _progress_for_status(status),
        "assignee": _extract_assignee_names(issue.get("assignees")),
        "labels": [
            label.get("name", "")
            for label in issue.get("labels", [])
            if isinstance(label, dict) and label.get("name")
        ],
        "plane_url_id": issue["id"],
    }


def build_project_overview(
    projects: list[dict],
    issues_by_project: dict[str, list[dict]],
    states_by_project: dict[str, dict[str, dict]],
    overview_labels: tuple[str, ...],
) -> dict[str, Any]:
    """Return one project row and matching task segments for each selected project."""
    projects_out = []
    segments = []
    excluded_undated = 0
    matching_labels = {label.casefold() for label in overview_labels}

    for project in projects:
        project_segments = []
        for issue in issues_by_project.get(project["id"], []):
            if issue.get("archived_at"):
                continue
            if not (_label_names(issue.get("labels")) & matching_labels):
                continue
            item = _segment(project, issue, states_by_project.get(project["id"], {}))
            if item is None:
                excluded_undated += 1
                continue
            project_segments.append(item)

        project_segments.sort(key=lambda item: (item["start_date"], item["end_date"], item["text"]))
        starts = [item["start_date"] for item in project_segments]
        ends = [item["end_date"] for item in project_segments]
        total_days = sum(
            max(
                (datetime.fromisoformat(item["end_date"]) - datetime.fromisoformat(item["start_date"])).days,
                1,
            )
            for item in project_segments
        )
        weighted_progress = (
            sum(
                _progress_for_status(item["status"])
                * max(
                    (datetime.fromisoformat(item["end_date"])
                     - datetime.fromisoformat(item["start_date"])).days,
                    1,
                )
                for item in project_segments
            )
            / total_days
            if total_days
            else 0.0
        )
        projects_out.append({
            "id": project["id"],
            "identifier": project.get("identifier", ""),
            "title": project.get("name", "Untitled Project"),
            "start_date": min(starts) if starts else None,
            "end_date": max(ends) if ends else None,
            "progress": round(weighted_progress, 4),
            "task_count": len(project_segments),
        })
        segments.extend(project_segments)

    starts = [item["start_date"] for item in segments]
    ends = [item["end_date"] for item in segments]
    overall_progress = (
        sum(_progress_for_status(item["status"]) for item in segments) / len(segments)
        if segments
        else 0.0
    )

    return {
        "timeline": {
            "id": "portfolio-overview",
            "title": "Overall project progress",
            "start_date": min(starts) if starts else None,
            "end_date": max(ends) if ends else None,
            "progress": round(overall_progress, 4),
            "task_count": len(segments),
        },
        "projects": projects_out,
        "segments": segments,
        "meta": {
            "overview_labels": list(overview_labels),
            "selected_project_count": len(projects),
            "segment_count": len(segments),
            "excluded_undated_count": excluded_undated,
        },
    }