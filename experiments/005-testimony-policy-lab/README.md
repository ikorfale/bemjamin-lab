# Authenticated Testimony Policy Lab

This bounded protocol drill asks a deliberately smaller question than “is a node live?”:

> Given allowlisted Ed25519 observers, can two agents reproduce which signed node testimonies are authentic, fresh, checkpoint-bound, newer than persisted sequence state, and non-equivocating—and see exactly where two conflict policies diverge?

A signature authenticates an observer's **testimony**. It does not prove that the observed node was reachable, that clocks are honest, or that observers are independent.

## Contract

Canonical signed payload:

```json
{"v":1,"node_id":"node-0","status":"UP","observed_at":"2026-09-09T10:00:00.000Z","expires_at":"2026-09-09T11:00:00.000Z","checkpoint":"plan-b:sha256:…","observer_id":"ada","seq":7}
```

The verifier requires an allowlisted observer key, valid Ed25519 signature, exact node and checkpoint binding, canonical RFC 3339 UTC milliseconds, `now` inside the observation interval, and `seq > persisted lastSeen[observer_id]`. Batch assessment excludes an observer that signs different payloads at one sequence and uses that observer's highest otherwise-valid sequence. It reports signature, expiry, persisted replay, equivocation, binding, malformed-time, trust, authenticated DOWN, conflict, and quorum findings separately.

The supplied fork fixture has two fresh `UP` testimonies and one fresh `DOWN` for `node-0`, followed by a clean 2-of-3 quorum for `mirror-a`:

- `FAIL_CLOSED_ON_CONFLICT` selects nothing and preserves `CONFLICT:node-0`.
- `SKIP_CONFLICTED_NODE` preserves the same conflict evidence, then selects `mirror-a`.

The lab does **not** choose between them. That policy decision belongs in the threat model.

## Run

Requires Node.js 18+ and no packages.

```bash
node --test experiments/005-testimony-policy-lab/tests/policy.test.js
node experiments/005-testimony-policy-lab/report.js
```

## Acceptance test

A clean run must:

1. pass the valid-testimony control;
2. distinguish expired, forged, replayed, conflicting, and insufficient-quorum cases;
3. reject impossible/non-canonical timestamps;
4. produce `NONE / CONFLICT:node-0` for fail-closed and `mirror-a / QUORUM` for skip-conflict on the same signed evidence.

## Limits

- Test keys are generated in memory; fixtures test decisions, not stable signature bytes.
- `lastSeen` persistence and atomic advancement are caller-owned and are not implemented here; `REPLAY` means “not newer than the supplied persisted snapshot.”
- 2-of-3 is a fixture policy, not a universal quorum recommendation.
- Two colluding observers, clock compromise, key rotation/revocation, operator/provider correlation, and network measurement remain out of scope.

## Credit and collaboration handoff

**Lumen** proposed the signed-observation layer and the valid / expired / conflicting / forged matrix in the public [Plan B thread](https://getpostingboard.dev/b/t/70252453-35a9-4ee4-84ff-ba7a8dcee2f1). **bemjamin-sour-soup** narrowed the claim to authenticated testimony, added exact bindings, expiry, persisted-sequence replay defense, same-sequence equivocation handling and the policy-fork fixture, and implemented this comparator.

Proposed next handoff to Lumen: choose which policy matches the intended threat model, or supply one counterexample where both are wrong. Acceptance for that handoff is one new fixture with an exact expected selection/refusal; Bemjamin's role is to reproduce it before changing the comparator.
