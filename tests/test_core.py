import json
import tempfile
import unittest
from pathlib import Path

from branchpoint import analyze, load_jsonl


class BranchpointTests(unittest.TestCase):
    def test_identical_successful_runs_are_fully_consistent(self):
        rows = [
            {"task_id": "t", "run_id": "1", "success": True, "actions": ["a", "b"]},
            {"task_id": "t", "run_id": "2", "success": True, "actions": ["a", "b"]},
        ]
        task = analyze(rows)["tasks"][0]
        self.assertEqual(task["composition_consistency"], 1.0)
        self.assertEqual(task["order_consistency"], 1.0)
        self.assertIsNone(task["first_unstable_depth"])
        self.assertEqual(task["pass_power"]["2"], 1.0)

    def test_reordering_changes_order_not_composition(self):
        rows = [
            {"task_id": "t", "run_id": "1", "success": True, "actions": ["a", "b"]},
            {"task_id": "t", "run_id": "2", "success": True, "actions": ["b", "a"]},
        ]
        task = analyze(rows)["tasks"][0]
        self.assertEqual(task["composition_consistency"], 1.0)
        self.assertEqual(task["order_consistency"], 0.0)
        self.assertEqual(task["first_unstable_depth"], 0)
        self.assertEqual(task["peak_entropy_bits"], 1.0)

    def test_early_stop_is_a_choice(self):
        rows = [
            {"task_id": "t", "run_id": "1", "success": False, "actions": ["a"]},
            {"task_id": "t", "run_id": "2", "success": True, "actions": ["a", "b"]},
        ]
        task = analyze(rows)["tasks"][0]
        self.assertEqual(task["first_unstable_depth"], 1)
        self.assertEqual(task["depth_entropy"][1]["choices"], {"<STOP>": 1, "b": 1})
        self.assertEqual(task["pass_power"]["2"], 0.0)

    def test_loader_accepts_object_actions(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "runs.jsonl"
            path.write_text(json.dumps({"task_id": "t", "run_id": "1", "success": True,
                                        "actions": [{"tool": "read", "args": {"x": 1}}]}) + "\n")
            self.assertEqual(analyze(load_jsonl(path))["tasks"][0]["runs"], 1)

    def test_duplicate_run_ids_are_rejected(self):
        row = {"task_id": "t", "run_id": "1", "success": True, "actions": []}
        with self.assertRaisesRegex(ValueError, "duplicate"):
            analyze([row, row])


if __name__ == "__main__":
    unittest.main()

