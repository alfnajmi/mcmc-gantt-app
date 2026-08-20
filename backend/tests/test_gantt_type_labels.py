import unittest

from fastapi import HTTPException

from app.routers.plane_gantt import _gantt_type_labels, _plain_description_html


class FakePlaneService:
    def __init__(self, labels=None, issue_labels=None):
        self.labels = list(labels or [])
        self.issue_labels = list(issue_labels or [])
        self.created = []

    async def list_labels(self, project_id):
        return self.labels

    async def create_label(self, project_id, name):
        label = {"id": f"created-{len(self.created) + 1}", "name": name}
        self.labels.append(label)
        self.created.append(label)
        return label

    async def get_issue(self, project_id, issue_id):
        return {"id": issue_id, "labels": self.issue_labels}


class GanttTypeLabelTests(unittest.IsolatedAsyncioTestCase):
    async def test_project_type_is_rejected_because_projects_are_modules(self):
        with self.assertRaises(HTTPException):
            await _gantt_type_labels(
                FakePlaneService(), "project-1", "issue-1", "project"
            )

    async def test_switching_to_task_removes_all_gantt_type_markers(self):
        svc = FakePlaneService(
            labels=[
                {"id": "milestone", "name": "Gantt: Milestone"},
                {"id": "project", "name": "Gantt: Project"},
                {"id": "backend", "name": "Backend"},
            ],
            issue_labels=["project", "backend"],
        )

        labels = await _gantt_type_labels(svc, "project-1", "issue-1", "task")

        self.assertEqual(labels, ["backend"])

    async def test_milestone_marker_is_created_and_unrelated_label_is_preserved(self):
        svc = FakePlaneService(
            labels=[{"id": "backend", "name": "Backend"}],
            issue_labels=["backend"],
        )

        labels = await _gantt_type_labels(
            svc, "project-1", "issue-1", "milestone"
        )

        self.assertEqual(svc.created[0]["name"], "Gantt: Milestone")
        self.assertEqual(labels, ["backend", "created-1"])

    async def test_rejects_unknown_gantt_type(self):
        with self.assertRaises(HTTPException):
            await _gantt_type_labels(
                FakePlaneService(), "project-1", "issue-1", "unknown"
            )

    def test_plain_description_is_encoded_for_plane_without_empty_paragraph(self):
        self.assertEqual(_plain_description_html(""), "")
        self.assertEqual(
            _plain_description_html("First & second\nNext"),
            "<p>First &amp; second<br>Next</p>",
        )


if __name__ == "__main__":
    unittest.main()
