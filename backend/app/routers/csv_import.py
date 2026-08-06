"""CSV import endpoint — bulk-load tasks from uploaded CSV file."""

import csv
import io
from datetime import datetime

from fastapi import APIRouter, HTTPException, UploadFile, File, Form

from app.database import get_pool

router = APIRouter(prefix="/api/projects", tags=["import"])

# Expected CSV columns (flexible — uses what's available)
# Required: text (or task_name), start_date
# Optional: end_date OR duration, parent (or parent_id), type, progress, assignee, status


def _parse_date(value: str) -> datetime | None:
    """Try multiple date formats."""
    if not value or not value.strip():
        return None
    value = value.strip()
    formats = [
        "%Y-%m-%d",
        "%Y-%m-%d %H:%M",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%B %d, %Y",          # January 15, 2026
        "%A, %B %dst %Y",     # Monday, August 3rd 2026
        "%A, %B %dnd %Y",
        "%A, %B %drd %Y",
        "%A, %B %dth %Y",
    ]
    # Strip ordinal suffixes (1st, 2nd, 3rd, 4th, etc.)
    import re
    cleaned = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', value)
    for fmt in formats:
        try:
            return datetime.strptime(cleaned, fmt)
        except ValueError:
            continue
    # Last resort: try without day name
    try:
        parts = cleaned.split(", ", 1)
        if len(parts) == 2:
            return datetime.strptime(parts[1], "%B %d %Y")
    except ValueError:
        pass
    return None


def _calc_duration(start: datetime | None, end: datetime | None, duration_str: str | None) -> int:
    """Calculate duration in days."""
    if duration_str and duration_str.strip().isdigit():
        return max(int(duration_str), 0)
    if start and end:
        delta = (end - start).days
        return max(delta, 0)
    return 1


@router.post("/{slug}/import")
async def import_csv(
    slug: str,
    file: UploadFile = File(...),
    mode: str = Form("append"),  # append | replace
):
    """
    Import tasks from a CSV file into a project.

    Mode:
      - append: add to existing tasks
      - replace: delete all existing tasks first

    CSV columns recognized (case-insensitive, flexible naming):
      text / task_name / Task Name
      start_date / Start Date
      end_date / due_date / Due Date
      duration / Days / Days (text)
      parent / parent_id / Parent ID
      type / Type (milestone, task, project)
      progress
      assignee
      status
    """
    # Resolve project
    pool = get_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow(
            "SELECT id FROM gantt_projects WHERE slug = $1", slug
        )
    if not project:
        raise HTTPException(status_code=404, detail=f"Project '{slug}' not found.")
    project_id = project["id"]

    # Read CSV
    content = await file.read()
    text = content.decode("utf-8-sig")  # handle BOM
    reader = csv.DictReader(io.StringIO(text))

    # Normalize column names
    def find_col(row: dict, candidates: list[str]) -> str | None:
        for c in candidates:
            for key in row.keys():
                if key.strip().lower().replace(" ", "_").replace("(", "").replace(")", "") == c:
                    return row[key]
        return None

    # Parse rows
    tasks = []
    id_map = {}  # original_id -> sort_order (for parent resolution)

    for idx, row in enumerate(reader):
        text_val = (
            find_col(row, ["text", "task_name"])
            or row.get("Task Name", "")
            or row.get("text", "")
        ).strip()
        if not text_val:
            continue

        start = _parse_date(
            find_col(row, ["start_date"]) or row.get("Start Date", "") or ""
        )
        end = _parse_date(
            find_col(row, ["end_date", "due_date"]) or row.get("Due Date", "") or ""
        )
        duration_raw = find_col(row, ["duration", "days", "days_text"]) or row.get("Days (text)", "")
        duration = _calc_duration(start, end, duration_raw)

        task_type_raw = (find_col(row, ["type"]) or row.get("Type", "") or "").strip().lower()
        task_type = "milestone" if task_type_raw == "milestone" else ("project" if task_type_raw == "project" else "task")
        if task_type == "milestone":
            duration = 0

        progress_raw = find_col(row, ["progress"]) or "0"
        try:
            progress = float(progress_raw) / 100.0 if float(progress_raw) > 1 else float(progress_raw)
        except (ValueError, TypeError):
            progress = 0.0

        parent_raw = find_col(row, ["parent", "parent_id"]) or row.get("Parent ID", "") or ""
        assignee = (find_col(row, ["assignee"]) or "").strip() or None
        status = (find_col(row, ["status"]) or "").strip() or None

        # Use original task_id for parent resolution
        task_id_raw = find_col(row, ["task_id", "id"]) or row.get("Task ID", "") or ""

        tasks.append({
            "text": text_val,
            "start_date": start or datetime(2026, 1, 1),
            "duration": duration,
            "progress": progress,
            "parent_ref": parent_raw.strip(),
            "type": task_type,
            "assignee": assignee,
            "status": status,
            "original_id": task_id_raw.strip(),
            "sort_order": idx + 1,
        })
        if task_id_raw.strip():
            id_map[task_id_raw.strip()] = idx

    if not tasks:
        raise HTTPException(status_code=400, detail="No valid tasks found in CSV.")

    # Insert into DB
    async with pool.acquire() as conn:
        if mode == "replace":
            await conn.execute(
                "DELETE FROM gantt_links WHERE project_id = $1", project_id
            )
            await conn.execute(
                "DELETE FROM gantt_tasks WHERE project_id = $1", project_id
            )

        # First pass: insert all tasks with parent=0
        new_ids = {}  # original_id -> new DB id
        for task in tasks:
            new_id = await conn.fetchval(
                """INSERT INTO gantt_tasks
                   (project_id, text, start_date, duration, progress, parent, type, assignee, status, sort_order)
                   VALUES ($1,$2,$3,$4,$5,0,$6,$7,$8,$9) RETURNING id""",
                project_id, task["text"], task["start_date"], task["duration"],
                task["progress"], task["type"], task["assignee"], task["status"],
                task["sort_order"],
            )
            new_ids[task["original_id"]] = new_id

        # Second pass: fix parent references
        for task in tasks:
            if task["parent_ref"] and task["parent_ref"] in new_ids:
                new_task_id = new_ids[task["original_id"]]
                parent_id = new_ids[task["parent_ref"]]
                await conn.execute(
                    "UPDATE gantt_tasks SET parent = $1 WHERE id = $2",
                    parent_id, new_task_id,
                )

    return {
        "action": "imported",
        "project": slug,
        "mode": mode,
        "tasks_imported": len(tasks),
    }
