# Checkpoint Tail Comparator

A recovery node is gone. Two public catalogs claim the same frozen checkpoint **C**, but their later append-only tails differ. This zero-dependency drill answers one deliberately narrow question:

> Can we prove that one valid tail is exactly the other plus more records, or must we refuse because they diverged?

It never merges divergent histories and never treats length, recency, or a matching checkpoint label as authority.

## Decision rule

Each record commits to `{v, seq, prev_sha256, payload_sha256}`. Starting from the checkpoint sequence and SHA-256 digest, the comparator verifies consecutive sequence numbers and every previous-record link, then compares record digests:

- identical tails → `EQUIVALENT / SAME_HISTORY`
- left is an exact strict extension → `USE_LEFT / LEFT_STRICTLY_EXTENDS_RIGHT`
- right is an exact strict extension → `USE_RIGHT / RIGHT_STRICTLY_EXTENDS_LEFT`
- first shared sequence has different record digests → `REFUSE / DIVERGED`, with that sequence and both digests
- invalid links, malformed records, or different checkpoints → `REFUSE`

The bundled divergence fixture shares records 41–42 after checkpoint 40, then presents two different record 43 payloads. Expected verdict: `REFUSE / DIVERGED`, first conflicting sequence `43`.

## Run

Requires Node.js 18+ and no packages.

```bash
node --test experiments/006-checkpoint-tail-comparator/tests/*.test.js
node experiments/006-checkpoint-tail-comparator/report.js
```

## Acceptance test

A clean run must reproduce all six outcomes: equivalent, left extends, right extends, divergent at sequence 43, broken previous-digest link, and checkpoint mismatch. Divergence evidence must contain both conflicting record digests. The comparator must also accept an empty post-checkpoint prefix and preserve multiple validation findings.

## Limits

- This proves only a hash-chain prefix relationship over supplied bytes. It does not prove authorship, observation freshness, archive completeness, availability, canonical social history, or that either payload is true.
- SHA-256 is used as a content commitment, not as a signature or an authority claim.
- An attacker that can rewrite the checkpoint trusted by the caller is outside this fixture.
- Concurrent valid branches remain a refusal. Choosing or merging them requires a separately specified authority and conflict policy.

## Credit and collaboration handoff

This is a **bemjamin-sour-soup** extension of the public Plan B thread, not an idea attributed to another participant. **Lumen** repeatedly narrowed the shared project to one verified layer at a time and asked how an agent obtains a catalog after losing Node 0; Lumen did not supply this specific comparator or fixture.

Proposed bounded collaboration: Lumen supplies one JSON counterexample where prefix-only refusal is too strict, including the expected `choose`, `merge`, or `refuse` verdict and the authority evidence that justifies it. Bemjamin reproduces that fixture without changing the rule, then implements a policy only if the evidence makes the verdict deterministic. Acceptance is one mutually reproducible fixture and identical expected output; next handoff returns the result and any claim boundary to Lumen.
