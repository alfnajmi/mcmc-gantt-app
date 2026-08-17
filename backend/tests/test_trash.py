import unittest
from unittest.mock import AsyncMock, patch

from app.routers.plane_gantt import _move_to_trash, _restore_from_trash
from app.services.plane import PlaneAPIError


class FakePlaneService:
    def __init__(self, fail_archive=False):
        self.fail_archive = fail_archive
        self.calls = []

    async def get_issue(self, project_id, issue_id):
        return {"id": issue_id, "name": "One-day task", "sequence_id": 42}

    async def update_issue(self, project_id, issue_id, payload):
        self.calls.append(("update_issue", issue_id, payload))
        if self.fail_archive and payload.get("archived_at"):
            raise PlaneAPIError(400, "archive rejected")
        return {}

    async def get_module(self, project_id, module_id):
        return {"id": module_id, "name": "Standalone project"}

    async def list_module_issues(self, project_id, module_id):
        self.calls.append(("list_module_issues", module_id))
        return [{"issue": "task-1"}, {"issue_detail": {"id": "task-2"}}]

    async def archive_module(self, project_id, module_id):
        self.calls.append(("archive_module", module_id))

    async def unarchive_module(self, project_id, module_id):
        self.calls.append(("unarchive_module", module_id))

    async def add_module_issues(self, project_id, module_id, issue_ids):
        self.calls.append(("add_module_issues", module_id, issue_ids))


class TrashFlowTests(unittest.IsolatedAsyncioTestCase):
    async def test_task_is_registered_then_archived_with_explicit_type(self):
        svc = FakePlaneService()
        with (
            patch("app.routers.plane_gantt.trash.get", AsyncMock(return_value=None)),
            patch("app.routers.plane_gantt.trash.put", AsyncMock()) as put,
        ):
            record = await _move_to_trash(
                svc, "project-1", "issue", "issue-1", "milestone"
            )

        self.assertEqual(record["gantt_type"], "milestone")
        self.assertEqual(record["sequence_id"], 42)
        self.assertRegex(record["purge_at"], r"^\d{4}-\d{2}-\d{2}T")
        put.assert_awaited_once()
        self.assertRegex(
            svc.calls[-1][2]["archived_at"], r"^\d{4}-\d{2}-\d{2}$"
        )

    async def test_module_record_keeps_member_ids_for_hide_and_restore(self):
        svc = FakePlaneService()
        with (
            patch("app.routers.plane_gantt.trash.get", AsyncMock(return_value=None)),
            patch("app.routers.plane_gantt.trash.put", AsyncMock()),
        ):
            record = await _move_to_trash(
                svc, "project-1", "module", "module-1"
            )

        self.assertEqual(record["gantt_type"], "project")
        self.assertEqual(record["member_issue_ids"], ["task-1", "task-2"])
        self.assertIn(("archive_module", "module-1"), svc.calls)

    async def test_failed_archive_removes_registry_record(self):
        svc = FakePlaneService(fail_archive=True)
        with (
            patch("app.routers.plane_gantt.trash.get", AsyncMock(return_value=None)),
            patch("app.routers.plane_gantt.trash.put", AsyncMock()),
            patch("app.routers.plane_gantt.trash.remove", AsyncMock()) as remove,
        ):
            with self.assertRaises(PlaneAPIError):
                await _move_to_trash(
                    svc, "project-1", "issue", "issue-1", "task"
                )

        remove.assert_awaited_once_with("project-1", "issue", "issue-1")

    async def test_restore_task_unarchives_before_removing_record(self):
        svc = FakePlaneService()
        record = {
            "project_id": "project-1",
            "entity_type": "issue",
            "entity_id": "issue-1",
            "gantt_type": "task",
        }
        with (
            patch("app.routers.plane_gantt.trash.get", AsyncMock(return_value=record)),
            patch("app.routers.plane_gantt.trash.remove", AsyncMock()) as remove,
        ):
            result = await _restore_from_trash(
                svc, "project-1", "issue", "issue-1"
            )

        self.assertEqual(result, record)
        self.assertEqual(svc.calls, [("update_issue", "issue-1", {"archived_at": None})])
        remove.assert_awaited_once_with("project-1", "issue", "issue-1")


if __name__ == "__main__":
    unittest.main()
