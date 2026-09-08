from __future__ import annotations

import json
import math
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path
from typing import Any, Iterable


def load_jsonl(path: str | Path) -> list[dict[str, Any]]:
    """Load and minimally validate one trajectory per JSONL line."""
    rows: list[dict[str, Any]] = []
    with Path(path).open(encoding="utf-8") as handle:
        for line_no, raw in enumerate(handle, 1):
            if not raw.strip():
                continue
            try:
                row = json.loads(raw)
            except json.JSONDecodeError as exc:
                raise ValueError(f"line {line_no}: invalid JSON: {exc.msg}") from exc
            missing = {"task_id", "run_id", "success", "actions"} - row.keys()
            if missing:
                raise ValueError(f"line {line_no}: missing {', '.join(sorted(missing))}")
            if not isinstance(row["success"], bool) or not isinstance(row["actions"], list):
                raise ValueError(f"line {line_no}: success must be bool and actions must be a list")
            rows.append(row)
    return rows


def _names(actions: list[Any]) -> list[str]:
    names: list[str] = []
    for index, action in enumerate(actions):
        if isinstance(action, str):
            names.append(action)
        elif isinstance(action, dict) and isinstance(action.get("tool"), str):
            names.append(action["tool"])
        else:
            raise ValueError(f"action {index} must be a tool-name string or object with string 'tool'")
    return names


def _multiset_jaccard(left: list[str], right: list[str]) -> float:
    a, b = Counter(left), Counter(right)
    union = sum((a | b).values())
    return 1.0 if union == 0 else sum((a & b).values()) / union


def _levenshtein_similarity(left: list[str], right: list[str]) -> float:
    if not left and not right:
        return 1.0
    previous = list(range(len(right) + 1))
    for i, a in enumerate(left, 1):
        current = [i]
        for j, b in enumerate(right, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (a != b)))
        previous = current
    return 1.0 - previous[-1] / max(len(left), len(right))


def _mean_pairwise(sequences: list[list[str]], metric) -> float:
    pairs = list(combinations(sequences, 2))
    return 1.0 if not pairs else sum(metric(a, b) for a, b in pairs) / len(pairs)


def _depth_entropy(sequences: list[list[str]]) -> list[dict[str, Any]]:
    """Shannon entropy at each depth, including an explicit stop token."""
    if not sequences:
        return []
    result = []
    for depth in range(max(map(len, sequences)) + 1):
        counts = Counter(seq[depth] if depth < len(seq) else "<STOP>" for seq in sequences)
        entropy = -sum((n / len(sequences)) * math.log2(n / len(sequences)) for n in counts.values())
        result.append({
            "depth": depth,
            "entropy_bits": round(entropy, 6),
            "choices": dict(sorted(counts.items())),
        })
        if counts == {"<STOP>": len(sequences)}:
            break
    return result


def _pass_power(successes: int, total: int, k: int) -> float | None:
    """Chance that all k runs pass when sampling k observed runs without replacement."""
    if k > total:
        return None
    return math.comb(successes, k) / math.comb(total, k) if successes >= k else 0.0


def analyze_task(rows: list[dict[str, Any]]) -> dict[str, Any]:
    if not rows:
        raise ValueError("a task needs at least one run")
    sequences = [_names(row["actions"]) for row in rows]
    successes = sum(row["success"] for row in rows)
    entropy = _depth_entropy(sequences)
    unstable = [item for item in entropy if item["entropy_bits"] > 0]
    return {
        "task_id": str(rows[0]["task_id"]),
        "runs": len(rows),
        "successes": successes,
        "success_rate": round(successes / len(rows), 6),
        "pass_power": {str(k): (None if (v := _pass_power(successes, len(rows), k)) is None else round(v, 6))
                       for k in (1, 2, 4, 8)},
        "composition_consistency": round(_mean_pairwise(sequences, _multiset_jaccard), 6),
        "order_consistency": round(_mean_pairwise(sequences, _levenshtein_similarity), 6),
        "first_unstable_depth": unstable[0]["depth"] if unstable else None,
        "peak_entropy_bits": round(max((item["entropy_bits"] for item in entropy), default=0.0), 6),
        "depth_entropy": entropy,
    }


def analyze(rows: Iterable[dict[str, Any]]) -> dict[str, Any]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    seen: set[tuple[str, str]] = set()
    for row in rows:
        key = (str(row["task_id"]), str(row["run_id"]))
        if key in seen:
            raise ValueError(f"duplicate task_id/run_id: {key[0]}/{key[1]}")
        seen.add(key)
        groups[key[0]].append(row)
    if not groups:
        raise ValueError("input contains no runs")
    tasks = [analyze_task(groups[key]) for key in sorted(groups)]
    return {
        "schema": "branchpoint-report/0.1",
        "tasks": tasks,
        "summary": {
            "task_count": len(tasks),
            "run_count": sum(task["runs"] for task in tasks),
            "mean_success_rate": round(sum(task["success_rate"] for task in tasks) / len(tasks), 6),
            "mean_composition_consistency": round(sum(task["composition_consistency"] for task in tasks) / len(tasks), 6),
            "mean_order_consistency": round(sum(task["order_consistency"] for task in tasks) / len(tasks), 6),
        },
    }

