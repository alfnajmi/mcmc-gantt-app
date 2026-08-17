import unittest

from app.services.plane_transformer import transform_issues_to_gantt


def issue(**overrides):
    value = {
        "id": "issue-1",
        "name": "Same-day work",
        "start_date": "2026-05-17",
        "target_date": "2026-05-17",
        "labels": [],
    }
    value.update(overrides)
    return value


class PlaneTransformerTaskTypeTests(unittest.TestCase):
    def transform(self, value):
        return transform_issues_to_gantt([value])["data"][0]

    def test_same_day_issue_is_a_one_day_task_by_default(self):
        task = self.transform(issue())

        self.assertEqual(task["type"], "task")
        self.assertEqual(task["duration"], 1)

    def test_explicit_gantt_milestone_label_creates_milestone(self):
        task = self.transform(
            issue(labels=[{"id": "label-1", "name": "Gantt: Milestone"}])
        )

        self.assertEqual(task["type"], "milestone")
        self.assertEqual(task["duration"], 0)

    def test_plain_milestone_label_is_also_supported(self):
        task = self.transform(
            issue(labels=[{"id": "label-1", "name": "Milestone"}])
        )

        self.assertEqual(task["type"], "milestone")

    def test_legacy_gantt_project_label_does_not_create_project(self):
        task = self.transform(
            issue(labels=[{"id": "label-1", "name": "Gantt: Project"}])
        )

        self.assertEqual(task["type"], "task")
        self.assertEqual(task["duration"], 1)

    def test_plain_project_label_is_not_treated_as_gantt_project(self):
        task = self.transform(
            issue(labels=[{"id": "label-1", "name": "Project"}])
        )

        self.assertEqual(task["type"], "task")

    def test_unrelated_or_unexpanded_labels_do_not_create_milestone(self):
        task = self.transform(
            issue(labels=["label-uuid", {"id": "label-2", "name": "Backend"}])
        )

        self.assertEqual(task["type"], "task")

    def test_issue_with_children_remains_a_task(self):
        result = transform_issues_to_gantt([
            issue(),
            issue(id="issue-2", parent="issue-1", name="Child"),
        ])["data"]

        self.assertEqual(result[0]["type"], "task")
        self.assertEqual(result[1]["parent"], "issue-1")

    def test_archived_issue_is_not_rendered(self):
        result = transform_issues_to_gantt([
            issue(archived_at="2026-08-17T10:00:00Z")
        ])["data"]

        self.assertEqual(result, [])

    def test_plane_description_html_is_plain_text_for_editor(self):
        task = self.transform(issue(
            description_html="<p>First &amp; second</p><p>Next line<br>More</p>"
        ))

        self.assertEqual(task["description"], "First & second\nNext line\nMore")

    def test_empty_plane_paragraph_does_not_appear_in_editor(self):
        task = self.transform(issue(description_html="<p></p>"))

        self.assertEqual(task["description"], "")

    def test_plane_module_is_the_gantt_project(self):
        result = transform_issues_to_gantt(
            [],
            modules=[{
                "id": "module-1",
                "name": "Standalone module",
                "start_date": "2026-05-17",
                "target_date": "2026-05-20",
            }],
        )["data"]

        self.assertEqual(result[0]["type"], "project")
        self.assertEqual(result[0]["plane_type"], "module")


if __name__ == "__main__":
    unittest.main()
