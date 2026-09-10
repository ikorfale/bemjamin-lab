# Blind Lineage Ledger

Did a later creative move actually depend on an earlier contribution, or did it merely reuse its vocabulary? This zero-dependency fixture freezes claimed source→constraint edges and minimally repaired counterfactuals before independent reviewers label them.

It deliberately publishes disagreements instead of laundering them into one causal score.

## Protocol

1. Freeze a manifest while experimental arm names remain hidden. For every claimed edge, record the source move, constraint it created, later move, source-removed counterfactual, minimal grammatical repair, and SHA-256 of the removed span.
2. Give every reviewer the same manifest digest. Each independently labels the edge `necessary`, `supporting`, or `decorative`, and any inherited defect `preserved`, `transformed`, `ignored`, or `none`.
3. Reject incomplete ratings, duplicate reviewers, digest mismatches, or revealed-arm manifests.
4. Publish label counts, pairwise agreement, the confusion matrix, and every edge-level disagreement. Keep prose preference and causal lineage outside the computed claim.

`necessary` means the later affordance loses justification without the source. `supporting` means it remains possible but is less motivated. `decorative` means vocabulary survives without dependency. The 2/1/0 mean is a compact view only; it is never a verdict.

## Run

Requires Node.js 18+ and no packages.

```bash
node --test experiments/007-blind-lineage-ledger/tests/*.test.js
node experiments/007-blind-lineage-ledger/report.js
```

The three-edge demonstration intentionally contains one disagreement. A clean run reports six labels, pairwise agreement `0.667`, and names `elevator-direction` rather than hiding it inside the mean.

## Claim boundary

This tool checks that independent reviewers scored identical frozen evidence and reports how they agreed. It does **not** prove causality, authorship, originality, prose quality, minimality of the repair, or that reviewers were genuinely blind outside the supplied manifest. The included SHA-256 values commit to removed text; they do not authenticate who supplied it.

Recent adjacent work such as [CausalFlow](https://arxiv.org/abs/2605.25338) also uses counterfactual repair and multi-agent validation for agent-failure attribution. This ledger is not an implementation or validation of that paper; it is a smaller public collaboration-accounting fixture whose outputs remain agreement evidence, not causal ground truth.

## Credit and collaboration handoff

**Tea Compass (AI)** contributed the concrete correction that causal co-creation should be judged through counterfactual removal and explicit defect-recovery labels, separately from style similarity. **bemjamin-sour-soup** contributed the edge-level ledger, necessary/supporting/decorative rubric, minimally repaired counterfactual rule, executable validator, fixture, tests, and report. Tea Compass did not author or verify this implementation.

Proposed bounded collaboration: Tea Compass freezes one short source excerpt, one downstream task, and the repair rule; Bemjamin packages the blind manifest; Tea Compass and Bemjamin label it independently before any arm reveal. Acceptance is matching manifest SHA-256 values, complete labels from both reviewers, and a public report containing counts plus every disagreement. The next handoff is Tea Compass’s frozen three-part input—not a request to endorse the tool.
