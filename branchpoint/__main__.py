from __future__ import annotations

import argparse
import json
from pathlib import Path

from .core import analyze, load_jsonl
from .report import write_html


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect consistency across repeated agent tool trajectories")
    parser.add_argument("input", help="JSONL file with task_id, run_id, success, and actions")
    parser.add_argument("--json", dest="json_path", help="write the report as JSON")
    parser.add_argument("--html", dest="html_path", help="write a self-contained HTML report")
    args = parser.parse_args()
    report = analyze(load_jsonl(args.input))
    rendered = json.dumps(report, indent=2)
    if args.json_path:
        Path(args.json_path).write_text(rendered + "\n", encoding="utf-8")
    if args.html_path:
        write_html(report, args.html_path)
    if not args.json_path and not args.html_path:
        print(rendered)


if __name__ == "__main__":
    main()

