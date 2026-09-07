"""
Import PERSADA Gantt tasks into Plane.so as issues.

Workstreams become Modules in Plane.
Tasks become Issues with start_date and target_date.
"""

import csv
import io
import json
import time
import requests

import os

API_BASE = os.environ.get("PLANE_BASE_URL", "https://plane-digd.mcmc.gov.my")
API_KEY = os.environ.get("PLANE_API_TOKEN")
WORKSPACE = os.environ.get("PLANE_WORKSPACE_SLUG", "persada")
PROJECT_ID = os.environ.get("PLANE_PROJECT_ID", "9bd17731-fa8f-40a7-81b6-31a3aae3ad63")

if not API_KEY:
    raise SystemExit(
        "PLANE_API_TOKEN is not set. Export it (e.g. from gantt-app/.env) before "
        "running this script; the token must never be hardcoded here."
    )

HEADERS = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
}

# CSV status → Plane state *group*. State IDs are per-project, so they are
# resolved at runtime instead of hardcoded (see resolve_state_map).
STATUS_TO_GROUP = {
    "to do": "unstarted",
    "in progress": "started",
    "complete": "completed",
    "on hold": "backlog",
    "planning": "backlog",
}


def resolve_state_map():
    """Fetch this project's states and map CSV statuses to their state IDs."""
    resp = requests.get(
        f"{API_BASE}/api/v1/workspaces/{WORKSPACE}/projects/{PROJECT_ID}/states/",
        headers=HEADERS,
        timeout=30,
    )
    resp.raise_for_status()
    payload = resp.json()
    states = payload.get("results", payload) if isinstance(payload, dict) else payload

    by_group = {}
    for state in states:
        by_group.setdefault(state["group"], state["id"])

    fallback = by_group.get("unstarted") or by_group.get("backlog")
    if not fallback:
        raise RuntimeError("No usable states found on the target project.")

    state_map = {
        status: by_group.get(group, fallback) for status, group in STATUS_TO_GROUP.items()
    }
    print(f"Resolved {len(states)} project states -> {sorted(set(state_map.values()))}")
    return state_map

# Priority mapping (not in CSV, default to none)
DEFAULT_PRIORITY = "none"

CSV_DATA = """task_name,workstream,task_type,status,assignee,start_date,end_date,progress
Media and comms,1. Connectivity at public hospitals and clinics,Task,to do,,2026-05-05,2029-12-31,100.0
RFP Process,1. Connectivity at public hospitals and clinics,Task,to do,MUHAMMAD AIMAN BIN MUHAMMAD HARIS,2026-05-29,2026-06-03,0.0
Appointment of panel consultant,1. Connectivity at public hospitals and clinics,Milestone,to do,,2026-06-04,2026-06-14,100.0
Consultant to begin survey process (includes data compilation by UD),1. Connectivity at public hospitals and clinics,Task,to do,,2026-06-15,2026-07-15,100.0
Project Rollout and Deployment,1. Connectivity at public hospitals and clinics,Task,to do,,2026-12-15,2029-12-31,0.0
Project kick-off - installation,1. Connectivity at public hospitals and clinics,Task,to do,,2026-12-15,2027-06-14,100.0
Monitoring exercise,1. Connectivity at public hospitals and clinics,Task,to do,,2026-12-15,2027-06-14,100.0
Monitoring exercise,2. EMR and ICT equipment deployment at public clinics,Task,to do,,2026-12-25,2029-12-24,100.0
Project Rollout and Deployment,2. EMR and ICT equipment deployment at public clinics,Task,to do,,2027-06-25,2027-12-24,0.0
Project kick-off - installation of ICT hardware and EMR activation,2. EMR and ICT equipment deployment at public clinics,Task,to do,,2027-06-25,2027-12-24,100.0
Development of programme,3. Telehealth kiosks at NADI nationwide,Task,to do,,2026-06-18,2026-06-30,100.0
Paper development,3. Telehealth kiosks at NADI nationwide,Task,to do,,2026-06-24,2026-07-07,100.0
Submission to DUSP,3. Telehealth kiosks at NADI nationwide,Task,to do,,2026-07-13,2026-08-12,100.0
Request for Information (RFI),3. Telehealth kiosks at NADI nationwide,Task,to do,,2026-07-15,2026-09-17,0.0
Finalisation of scope,3. Telehealth kiosks at NADI nationwide,Task,to do,,2026-07-15,2026-07-28,100.0
Creation of MyVAS accounts at all NADI,3. Telehealth kiosks at NADI nationwide,Task,to do,,2026-07-15,2029-12-31,0.0
Account creation,3. Telehealth kiosks at NADI nationwide,Task,to do,,2026-07-15,2026-07-28,100.0
Acquiring process by NADI,3. Telehealth kiosks at NADI nationwide,Task,to do,,2026-07-18,2026-10-17,0.0
Rollout schedule,3. Telehealth kiosks at NADI nationwide,Task,to do,,2026-07-28,2026-08-28,100.0
Onboarding of NADI managers per MyVAS SOP,3. Telehealth kiosks at NADI nationwide,Task,to do,,2026-07-28,2026-08-28,0.0
MOH's SOP on NADI managers training module and materials,3. Telehealth kiosks at NADI nationwide,Task,to do,,2026-07-28,2026-08-28,100.0
Preparation of RFQ docuemnt,3. Telehealth kiosks at NADI nationwide,Task,to do,,2026-08-10,2026-08-14,100.0
Issuance of RFI,3. Telehealth kiosks at NADI nationwide,Task,to do,,2026-08-17,2026-09-17,100.0
Go-live coordination support,3. Telehealth kiosks at NADI nationwide,Task,to do,,2026-08-28,2029-12-31,100.0
Concept Paper Development,Commission Approval,Task,complete,"Mawardi, Sya MS, Nurul Jannah Sulaiman",2026-04-07,2026-05-20,100.0
MCM - FHCI Framework & MOU,Commission Approval,Milestone,to do,"Mawardi, Syahirah Azman, Sya MS",2026-05-21,2026-05-21,100.0
Review flow of MCM paper,Commission Approval,Task,to do,Mawardi,2026-05-29,2026-05-29,100.0
MCM - Tawau Event Launch,Commission Approval,Milestone,planning,Mawardi,2026-06-17,2026-06-17,0.0
MCM approval,Commission Approval,Task,to do,,2026-06-17,2026-06-24,100.0
[27 July] Commission meeting on FHCI concept framework - MoU & Consultant,Commission Approval,Milestone,complete,,2026-07-13,2026-07-27,100.0
[4 Aug] Commission meeting on PERSADA - Reg. 5,Commission Approval,Milestone,to do,,2026-07-20,2026-08-04,0.0
[13 Oct] Commission meeting on PERSADA - Evaluation approval,Commission Approval,Task,to do,,2026-10-01,2026-10-13,100.0
Slide Development,Governance,Task,to do,,2025-09-01,2025-09-01,100.0
Stakeholders Identification,Governance,Task,to do,,2025-09-08,2025-09-08,100.0
Share draft with Legal for review,Governance,Task,to do,,2025-10-21,2025-10-21,100.0
Revise based on legal feedback,Governance,Task,to do,,2025-10-22,2025-10-22,100.0
MOU [paperwork],Governance,Task,to do,"Sya MS, Mawardi",2025-11-11,2026-06-11,0.0
1. SC CONNECTIVITY,Governance,Task,complete,"Nurul Jannah Sulaiman, Sya MS, Syahirah Azman",2025-12-04,2025-12-04,25.0
"No. 1/2025, 4 Dec 2026 (Thursday)",Governance,Task,complete,,2025-12-04,2025-12-04,100.0
Invitation to MoH and MCMC with meeting documents,Governance,Task,in progress,"Izzah Adil, Sya MS, Amalia Husna",2026-03-12,2026-03-12,0.0
"No. 1/2026, 2 April 2026 (Thursday)",Governance,Milestone,complete,,2026-03-30,2026-03-30,100.0
"No. 1/2026, 2 April 2026 (Thursday)",Governance,Milestone,complete,,2026-04-02,2026-04-02,0.0
"No. 2/2026, 5 May 2026 (Tuesday)",Governance,Task,complete,,2026-05-05,2026-05-05,100.0
Engagement with MOH,Governance,Task,to do,,2026-05-11,2026-06-05,0.0
Email Requesting meeting with event team,Governance,Task,complete,"Aiman Faris, Nurul Jannah Sulaiman",2026-05-12,2026-05-12,100.0
Logistic Management,Governance,Task,complete,,2026-05-14,2026-05-14,0.0
Email to Mahesh,Governance,Task,complete,Syahirah Azman,2026-05-14,2026-05-14,100.0
F&B,Governance,Task,on hold,Aiman Faris,2026-05-18,2026-05-18,100.0
Governance,Governance,Task,to do,,2026-05-19,2026-05-19,40.0
"No. 2/2026, 22 May 2026 (Friday)",Governance,Milestone,complete,,2026-05-19,2026-05-19,100.0
"No. 2/2026, 25 May 2026 (Monday)",Governance,Milestone,to do,,2026-05-19,2026-05-19,100.0
"No. 1/2026, 25 May 2026 (Monday)",Governance,Milestone,planning,FORESIGHT DIVISION,2026-05-19,2026-05-19,100.0
RFQ,Governance,Task,in progress,,2026-05-20,2026-05-20,0.0
Award Event Organiser,Governance,Task,to do,Amalia Husna,2026-05-22,2026-06-03,0.0
Content Event,Governance,Task,to do,"Nurul Jannah Sulaiman, Aiman Faris, Amalia Husna, MUHAMMAD AIMAN BIN MUHAMMAD HARIS",2026-05-25,2026-05-29,0.0
RFQ process close (3 days),Governance,Task,to do,,2026-05-25,2026-05-29,100.0
Project Management Framework (PMF),Governance,Task,in progress,Nurul Jannah Sulaiman,2026-05-27,2026-06-10,0.0
Invitation to members,Governance,Task,to do,Syahirah Azman,2026-05-29,2026-05-29,100.0
Brief pack,Governance,Task,to do,"Nurul Jannah Sulaiman, Aiman Faris, Mawardi",2026-05-29,2026-05-29,0.0
Brief CIDO/ TSS,Governance,Task,to do,abdullah sani mohamed,2026-06-03,2026-06-03,100.0
Invitation Letter,Governance,Task,to do,Amalia Husna,2026-06-03,2026-06-05,0.0
Public Relations,Governance,Task,to do,Amalia Husna,2026-06-03,2026-06-05,0.0
Pocket Book,Governance,Task,complete,Amalia Husna,2026-06-03,2026-06-05,0.0
Logistic Arrangment,Governance,Task,to do,MUHAMMAD AIMAN BIN MUHAMMAD HARIS,2026-06-03,2026-06-05,100.0
Production of Launching Gimmick (video),Governance,Task,to do,Aiman Faris,2026-06-03,2026-06-11,0.0
Appointment of vendor,Governance,Task,to do,,2026-06-03,2026-06-03,100.0
Storyboard draft,Governance,Task,to do,,2026-06-04,2026-06-04,100.0
"No. 1/ 2026, 5 June (Friday)",Governance,Milestone,to do,"Sya MS, Syahirah Azman",2026-06-05,2026-06-05,100.0
KSU Courtesy Visit,Governance,Milestone,complete,"Aiman Faris, Nurul Jannah Sulaiman, abdullah sani mohamed",2026-06-05,2026-06-05,33.3
Doc Finalisation,Governance,Task,to do,,2026-06-05,2026-06-15,25.0
MOH,Governance,Task,in progress,"Nurul Jannah Sulaiman, Aiman Faris",2026-06-09,2026-06-09,100.0
Production,Governance,Task,to do,,2026-06-09,2026-06-09,100.0
Brand and MOH approval,Governance,Task,to do,,2026-06-11,2026-06-11,100.0
Dry Run,Governance,Task,to do,,2026-06-12,2026-06-12,100.0
Reheaersal,Governance,Task,to do,"Nurul Jannah Sulaiman, Aiman Faris, Amalia Husna",2026-06-12,2026-06-12,100.0
MOU Signing/ Exchange Ceremony,Governance,Milestone,to do,"Nurul Jannah Sulaiman, Aiman Faris",2026-06-15,2026-06-15,25.0
Closing Phase,Governance,Task,to do,MUHAMMAD AIMAN BIN MUHAMMAD HARIS,2026-06-16,2026-06-17,100.0
Approval by CIDO,Governance,Task,to do,"Nurul Jannah Sulaiman, Aiman Faris",2026-06-19,2026-06-19,100.0
"No. 3/2026, 20 July 2026 (Monday)",Governance,Task,to do,"Sya MS, Syahirah Azman, Murni Daud",2026-06-21,2026-07-20,100.0
Development of RFP,Governance,Task,to do,,2026-06-22,2026-06-29,100.0
Project Submission to CMD,Governance,Task,to do,"Nurul Jannah Sulaiman, Aiman Faris",2026-06-23,2026-06-23,100.0
MOA,Governance,Task,to do,"Sya MS, Nurul Jannah Sulaiman",2026-07-01,2026-07-31,100.0
MOU,Governance,Task,to do,,2026-07-19,2026-07-19,33.3
"No. 3/2026, 20 July 2026 (Monday)",Governance,Task,to do,,2026-07-20,2026-07-20,100.0
"No. 2/2026, 20 July 2026 (Monday)",Governance,Task,to do,,2026-07-20,2026-07-20,0.0
"No.2/2026, 27 July [tentative]",Governance,Task,to do,,2026-07-20,2026-07-27,100.0
"No. 3/2026, 29 July 2026 [tentative]",Governance,Milestone,to do,"Sya MS, Syahirah Azman",2026-07-27,2026-07-29,100.0
Registration of Interest,Governance,Task,to do,,2026-08-17,2026-09-16,100.0
Evaluation Process,Governance,Task,to do,,2026-09-17,2026-10-13,100.0
Notice of Award (NoA),Governance,Task,to do,,2026-10-14,2026-11-06,100.0
Site visit to Perlis,Media and Communications,Task,complete,Amalia Husna,2026-05-18,2026-05-20,100.0
Coordination meeting with UKK to streamline on Comm Strategy,Media and Communications,Task,complete,"Amalia Husna, MUHAMMAD AIMAN BIN MUHAMMAD HARIS",2026-06-05,2026-06-12,100.0
"""


def create_module(name, start_date=None, target_date=None):
    """Create a module (workstream) in the project."""
    payload = {"name": name}
    if start_date:
        payload["start_date"] = start_date
    if target_date:
        payload["target_date"] = target_date

    resp = requests.post(
        f"{API_BASE}/api/v1/workspaces/{WORKSPACE}/projects/{PROJECT_ID}/modules/",
        headers=HEADERS,
        json=payload,
    )
    if resp.status_code in (200, 201):
        data = resp.json()
        print(f"  Module created: {data['id']} - {name}")
        return data["id"]
    else:
        print(f"  ERROR creating module {name}: {resp.status_code} {resp.text[:200]}")
        return None


def create_issue(name, state_id, start_date, target_date, priority="none"):
    """Create an issue in the project."""
    payload = {
        "name": name,
        "state": state_id,
        "start_date": start_date,
        "target_date": target_date,
        "priority": priority,
    }

    resp = requests.post(
        f"{API_BASE}/api/v1/workspaces/{WORKSPACE}/projects/{PROJECT_ID}/work-items/",
        headers=HEADERS,
        json=payload,
    )
    if resp.status_code in (200, 201):
        data = resp.json()
        return data["id"]
    else:
        print(f"  ERROR creating issue '{name}': {resp.status_code} {resp.text[:200]}")
        return None


def add_issue_to_module(module_id, issue_id):
    """Add an issue to a module."""
    resp = requests.post(
        f"{API_BASE}/api/v1/workspaces/{WORKSPACE}/projects/{PROJECT_ID}/modules/{module_id}/module-issues/",
        headers=HEADERS,
        json={"issues": [issue_id]},
    )
    return resp.status_code in (200, 201)


def main():
    print("=" * 60)
    print("Importing PERSADA tasks into Plane.so")
    print(f"Workspace: {WORKSPACE}")
    print(f"Project: {PROJECT_ID}")
    print("=" * 60)

    state_map = resolve_state_map()

    # Parse CSV
    reader = csv.DictReader(io.StringIO(CSV_DATA.strip()))
    tasks = list(reader)
    print(f"\nTotal tasks in CSV: {len(tasks)}")

    # Group by workstream
    workstreams = {}
    for task in tasks:
        ws = task["workstream"].strip()
        if ws not in workstreams:
            workstreams[ws] = []
        workstreams[ws].append(task)

    print(f"Workstreams: {list(workstreams.keys())}")

    # Create modules for each workstream
    print("\n--- Creating Modules (Workstreams) ---")
    module_map = {}
    for ws_name, ws_tasks in workstreams.items():
        # Calculate date range for the module
        start_dates = [t["start_date"] for t in ws_tasks if t["start_date"]]
        end_dates = [t["end_date"] for t in ws_tasks if t["end_date"]]
        module_start = min(start_dates) if start_dates else None
        module_end = max(end_dates) if end_dates else None

        module_id = create_module(ws_name, module_start, module_end)
        if module_id:
            module_map[ws_name] = module_id
        time.sleep(0.3)  # Rate limit respect

    # Create issues
    print(f"\n--- Creating {len(tasks)} Issues ---")
    created = 0
    failed = 0

    for i, task in enumerate(tasks):
        name = task["task_name"].strip()
        status = task["status"].strip().lower()
        start = task["start_date"].strip()
        end = task["end_date"].strip()
        ws = task["workstream"].strip()

        # Map status to state ID
        state_id = state_map.get(status, state_map["to do"])

        # Create the issue
        issue_id = create_issue(name, state_id, start, end)

        if issue_id:
            created += 1
            # Add to module
            if ws in module_map:
                add_issue_to_module(module_map[ws], issue_id)

            if (i + 1) % 10 == 0:
                print(f"  Progress: {i + 1}/{len(tasks)} issues created")
        else:
            failed += 1

        # Rate limiting — Plane allows 60 req/min
        time.sleep(1.2)

    print(f"\n{'=' * 60}")
    print(f"DONE! Created {created} issues, {failed} failed.")
    print(f"Modules: {len(module_map)}")
    print(f"\nView in Plane: {API_BASE}/{WORKSPACE}/projects/{PROJECT_ID}/issues/")
    print("View in Gantt:  http://localhost:5174/persada/portal/gantt")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
