import unittest

from app.routers.plane_gantt import _promote_issue
from app.services.plane import PlaneAPIError


class FakePlaneService:
    def __init__(self, fail_archive=False):
        self.fail_archive = fail_archive
        self.calls = []

    async def get_issue(self, project_id, issue_id):
        return {
            "id": issue_id,
            "name": "Large task",
            "description_html": "Original details",
            "start_date": "2026-08-01",
            "target_date": "2026-09-01",
        }

    async def list_issues(self, project_id, expand="module"):
        return [
            {"id": "child-1", "parent": "issue-1", "module": "old-module"},
            {"id": "grandchild", "parent": "child-1", "module": "old-module"},
        ]

    async def create_module(self, project_id, payload):
        self.calls.append(("create_module", payload))
        return {"id": "new-module"}

    async def add_module_issues(self, project_id, module_id, issue_ids):
        self.calls.append(("add_module_issues", module_id, issue_ids))
        return {}

    async def update_issue(self, project_id, issue_id, payload):
        self.calls.append(("update_issue", issue_id, payload))
        if self.fail_archive and issue_id == "issue-1" and "archived_at" in payload:
            raise PlaneAPIError(500, "archive failed")
        return {}

    async def delete_module(self, project_id, module_id):
        self.calls.append(("delete_module", module_id))


class PromoteIssueTests(unittest.IsolatedAsyncioTestCase):
    async def test_promotes_direct_children_and_archives_source_last(self):
        svc = FakePlaneService()

        result = await _promote_issue(svc, "project-1", "issue-1")

        self.assertEqual(result["module_id"], "new-module")
        self.assertEqual(result["moved_task_count"], 1)
        self.assertEqual(
            svc.calls[-1][0:2], ("update_issue", "issue-1")
        )
        self.assertIn("archived_at", svc.calls[-1][2])
        self.assertRegex(svc.calls[-1][2]["archived_at"], r"^\d{4}-\d{2}-\d{2}$")
        self.assertIn(
            ("update_issue", "child-1", {"parent": None}), svc.calls
        )
        self.assertNotIn(
            ("update_issue", "grandchild", {"parent": None}), svc.calls
        )

    async def test_archive_failure_compensates_hierarchy_and_module(self):
        svc = FakePlaneService(fail_archive=True)

        with self.assertRaises(PlaneAPIError):
            await _promote_issue(svc, "project-1", "issue-1")

        self.assertIn(
            ("update_issue", "child-1", {"parent": "issue-1"}), svc.calls
        )
        self.assertIn(("delete_module", "new-module"), svc.calls)
        self.assertIn(
            ("add_module_issues", "old-module", ["child-1"]), svc.calls
        )


if __name__ == "__main__":
    unittest.main()
