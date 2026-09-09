import unittest

from app.services.portfolio import build_project_overview


PROJECTS = [
    {"id": "project-1", "identifier": "ONE", "name": "Project One"},
    {"id": "project-2", "identifier": "TWO", "name": "Project Two"},
]


class PortfolioOverviewTests(unittest.TestCase):
    def test_filters_by_reporting_label_and_keeps_empty_projects(self):
        result = build_project_overview(
            PROJECTS,
            {
                "project-1": [
                    {
                        "id": "issue-1",
                        "name": "Reportable task",
                        "start_date": "2026-01-01",
                        "target_date": "2026-01-11",
                        "labels": [{"name": "management"}],
                        "state": {"group": "completed"},
                    },
                    {
                        "id": "issue-2",
                        "name": "Internal task",
                        "start_date": "2026-01-01",
                        "target_date": "2026-01-02",
                        "labels": [{"name": "Internal"}],
                    },
                ],
                "project-2": [],
            },
            {"project-1": {}, "project-2": {}},
            ("Management",),
        )

        self.assertEqual(len(result["projects"]), 2)
        self.assertEqual(result["projects"][0]["task_count"], 1)
        self.assertIsNone(result["projects"][1]["start_date"])
        self.assertEqual(result["segments"][0]["id"], "project-1:issue-1")
        self.assertEqual(result["segments"][0]["progress"], 1.0)

    def test_excludes_undated_matching_tasks(self):
        result = build_project_overview(
            [PROJECTS[0]],
            {
                "project-1": [{
                    "id": "issue-1",
                    "name": "No dates",
                    "labels": [{"name": "GANTT: OVERVIEW"}],
                }],
            },
            {"project-1": {}},
            ("Gantt: Overview",),
        )

        self.assertEqual(result["segments"], [])
        self.assertEqual(result["meta"]["excluded_undated_count"], 1)


if __name__ == "__main__":
    unittest.main()