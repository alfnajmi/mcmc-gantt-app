"""
Backfill PERSADA workstream modules in Plane and attach existing work items.

Safe to re-run: existing modules are reused instead of duplicated, and Plane
ignores issues that are already members of a module.
"""

import time

import requests

from import_persada import (
    API_BASE,
    CSV_DATA,
    HEADERS,
    PROJECT_ID,
    WORKSPACE,
    create_module,
)

import csv
import io

PROJECT_URL = f"{API_BASE}/api/v1/workspaces/{WORKSPACE}/projects/{PROJECT_ID}"


def fetch_all(endpoint):
    """Page through a Plane list endpoint."""
    results = []
    url = f"{PROJECT_URL}/{endpoint}/"
    while url:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        payload = resp.json()
        results.extend(payload.get("results", []))
        url = payload.get("next_page_results") and payload.get("next_cursor") and None
        next_url = payload.get("next")
        url = next_url if isinstance(next_url, str) else None
    return results


def attach(module_id, issue_ids):
    resp = requests.post(
        f"{PROJECT_URL}/modules/{module_id}/module-issues/",
        headers=HEADERS,
        json={"issues": issue_ids},
        timeout=30,
    )
    return resp.status_code in (200, 201), resp.status_code, resp.text[:160]


def main():
    tasks = list(csv.DictReader(io.StringIO(CSV_DATA.strip())))

    workstreams = {}
    for task in tasks:
        workstreams.setdefault(task["workstream"].strip(), []).append(task)

    existing_modules = {m["name"]: m["id"] for m in fetch_all("modules")}
    issues = fetch_all("work-items")
    print(f"Found {len(issues)} work items and {len(existing_modules)} existing modules")

    by_name = {}
    for issue in issues:
        by_name.setdefault(issue["name"].strip(), []).append(issue["id"])

    total_attached = 0
    for ws_name, ws_tasks in workstreams.items():
        if ws_name in existing_modules:
            module_id = existing_modules[ws_name]
            print(f"\nReusing module: {ws_name}")
        else:
            starts = [t["start_date"] for t in ws_tasks if t["start_date"]]
            ends = [t["end_date"] for t in ws_tasks if t["end_date"]]
            module_id = create_module(
                ws_name, min(starts) if starts else None, max(ends) if ends else None
            )
            time.sleep(0.3)

        if not module_id:
            continue

        issue_ids = []
        for task in ws_tasks:
            candidates = by_name.get(task["task_name"].strip())
            if candidates:
                issue_ids.append(candidates.pop(0))

        if not issue_ids:
            print(f"  No matching work items for {ws_name}")
            continue

        ok, status, body = attach(module_id, issue_ids)
        if ok:
            total_attached += len(issue_ids)
            print(f"  Attached {len(issue_ids)} work items")
        else:
            print(f"  ERROR attaching to {ws_name}: {status} {body}")
        time.sleep(0.5)

    print(f"\nDONE. Attached {total_attached} work items across {len(workstreams)} modules.")


if __name__ == "__main__":
    main()
