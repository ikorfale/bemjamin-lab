# Branchpoint: a microscope for repeated agent trajectories

**Hypothesis.** End-state success can hide unstable execution strategies. A cheap, model-free report that separates *which* tools were used from *their order*, and identifies the earliest divergent action depth, can make repeated-run failures easier to inspect.

## Method

Branchpoint consumes JSONL traces with `task_id`, `run_id`, `success`, and an `actions` array. It groups repeated runs by task and computes:

- empirical success and `pass^k` (the probability that all `k` observed runs pass when sampled without replacement);
- pairwise multiset Jaccard similarity for action composition;
- normalized Levenshtein similarity for action ordering;
- Shannon entropy at every action depth, with `<STOP>` treated as an explicit choice;
- the first depth with non-zero entropy: the **branchpoint**.

It emits JSON or a self-contained HTML report. It is standard-library Python: no model, API, telemetry, or network access.

## Result

On the bundled eight-run synthetic fixture, both tasks succeed often, but the report exposes different hidden instability. `invoice-check` uses the same tools in every run while one run changes their order; `calendar-cleanup` diverges in composition, ordering, and stopping behavior under a simulated timeout. The generated report therefore distinguishes “same ingredients, different recipe” from actual tool-selection drift.

This is a diagnostic, not a benchmark. Its useful output is a compact pointer to the depth and kind of divergence that deserves human inspection.

## Reproduce

Requires Python 3.10+.

```bash
python -m unittest discover -s tests -v
python -m branchpoint examples/traces.jsonl --json report.json --html report.html
python -m json.tool report.json >/dev/null
```

Open `report.html` locally, or inspect the committed sample in [`demo/index.html`](../../demo/index.html). For your own traces, each line has this shape:

```json
{"task_id":"demo","run_id":"seed-1","success":true,"actions":["search","read","answer"]}
```

Actions may alternatively be objects such as `{"tool":"search","args":{...}}`; arguments are deliberately ignored in version 0.1 to avoid leaking them into reports.

## Limitations

- Tool names are treated as meaningful identities; aliases need preprocessing.
- Edit distance gives every action equal weight and does not know which actions are risky.
- `pass^k` is descriptive for the supplied finite sample, not a confidence bound or future guarantee.
- Depth entropy aligns by position, not by causal dependency; loops can shift otherwise comparable actions.
- The synthetic fixture demonstrates the calculations but makes no claim about a particular model.

## Public sources

- Orkat et al., **Consistency as a Testable Property** (2026): trajectory consistency should be separated into composition and ordering, and early-stage variation can dominate. https://arxiv.org/abs/2605.10516
- Gupta et al., **ReliabilityBench** (2026): single-run success misses repeated-execution consistency, semantic perturbation robustness, and tool-fault tolerance. https://arxiv.org/abs/2601.06112
- Yao et al., **τ-bench** (2024): `pass^k` reveals how quickly apparent tool-agent success collapses across repeated trials. https://arxiv.org/abs/2406.12045

The branchpoint entropy view and the tiny offline report are this experiment's implementation contribution; the broader reliability framing comes from the cited work.

