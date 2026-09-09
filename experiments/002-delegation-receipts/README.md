# Delegation Receipt Playground: where borrowed authority leaks

**Creative premise / hypothesis.** Delegation failures become easier to discuss when authority is rendered as a short, inspectable chain rather than buried in prose or a framework. A tiny deterministic checker plus fault-injection gallery can expose *where* a delegated agent widened, outlived, substituted, disconnected, or failed to account for its authority.

This is an illustrative protocol sketch, not a new authentication protocol.

## Method / form

The playground models each hop as a deliberately small JSON receipt:

```json
{
  "id": "r-research",
  "parent_id": "r-root",
  "principal": "cora",
  "actor": "researcher",
  "scopes": ["web:read"],
  "not_before": "2026-09-08T17:05:00Z",
  "expires_at": "2026-09-08T19:00:00Z",
  "redelegation_allowed": false,
  "result_locator": "snapshot://public-notes",
  "result_sha256": "a4c30ecc2e678acd020725a5137d25358898caa4bc038ac2905bdb273d037d33"
}
```

A model-free JavaScript audit checks seven local invariants:

1. one connected, acyclic chain with unique receipt IDs;
2. every receipt names a non-empty string principal, preserved across the chain;
3. child scopes are a subset of parent scopes;
4. every receipt uses a real calendar date and a non-empty half-open interval `[not_before, expires_at)` in RFC 3339 form with an explicit `Z` or numeric offset, is active at the audit time, and every child's declared interval is contained by its parent's (equal boundaries are allowed and comparisons use parsed instants rather than timestamp text);
5. neither a receipt nor any ancestor was revoked by the audit time;
6. each additional hop is permitted by its parent;
7. every leaf separates its retrieval locator from a lowercase SHA-256 digest, retrieves the artifact independently, and verifies the exact bytes; unavailable artifacts and digest mismatches fail closed.

The interactive page switches between one valid chain and fifteen single-fault fixtures: widened scope, principal substitution, blank/null/missing root principal, child starting before its parent, offset-free time, impossible September and non-leap-February dates, expired child, revoked ancestor, broken parent, forbidden third hop, missing result evidence, and a one-byte artifact mutation at a stable locator. It shows both human-readable checks and the exact JSON.

## Result

All fifteen injected faults are rejected by the intended invariant, while the attenuating two-hop control passes. The output makes one distinction especially visible: **declared intent is not authority**. A child saying “I am still helping Cora” does not repair an expanded scope, malformed identity, stale grant, or broken provenance link.

The experiment does not establish that these receipt fields are sufficient. Its result is narrower: they are enough to make several common delegation failures executable as counterexamples instead of leaving them as architectural slogans.

## Reproduce, test, remix

Requires Node.js 20+ for the tests and any local static server for the interface.

```bash
node --test tests/delegation-receipts.test.mjs
node scripts/generate-delegation-report.mjs
git diff --exit-code -- demo/delegation-receipts/audit-samples.json
python3 -m http.server 8000
```

Open `http://localhost:8000/demo/delegation-receipts/`.

To challenge the sketch, add a fixture in `delegation-receipts/fixtures.js` that should be rejected but passes, then add a failing test before changing `auditReceipts`. Useful counterexamples include multiple independent roots, revocation between hops, actor substitution without principal substitution, context-bound scope, and a valid-looking result reference that points to the wrong artifact.

## Limitations

- Receipts are unsigned JSON; the toy does not authenticate an actor or make a claim tamper-evident.
- Result bytes are checked against a frozen digest, but the toy's in-memory resolver does not prove transport authenticity, publisher identity, truth, freshness, or causal relation to the task.
- Scope strings use exact set inclusion. Real authorization needs resource, action, audience, context, and policy semantics.
- Time comparisons parse RFC 3339 strings to instants while retaining the original strings; the toy does not canonicalize signed evidence, model clock skew or revocation propagation latency, or decide whether policy applies revocation retroactively.
- A preserved principal does not prove informed consent, continuing intent, or adequate human oversight.
- This does not replace OAuth, workload identity, transaction tokens, policy engines, audit logs, or human approval.

## Public sources

- Daniel Park, **Architectural Requirements for Supporting AI Agents on the Internet** (Internet-Draft, work in progress, 14 Aug 2026). It separates principals, delegation scope/time/context, provenance, auditability, and revocation, and explicitly says intent is not itself authorization. https://datatracker.ietf.org/doc/html/draft-daniel-ai-agent-internet-architecture-00
- Kasselman et al., **AI Agent Authentication and Authorization** (Internet-Draft, work in progress, revision 03, 6 Jul 2026). It frames agents as workloads and profiles OAuth, workload identity, transaction tokens, monitoring, and human-in-the-loop controls rather than inventing one universal protocol. https://datatracker.ietf.org/doc/draft-klrc-aiagent-auth/
- Wattamwar et al., **The Evaluation Context Protocol (ECP): A Portable Contract for AI Agent Evaluation** (arXiv:2608.19263, 18 Aug 2026). It motivates small, portable, evaluator-safe contracts and labels its own interface work in progress. https://arxiv.org/abs/2608.19263

The receipt shape, seven-invariant audit, fixtures, and interface are this experiment's original implementation contribution. The architectural concerns come from the cited work.

— bemjamin-sour-soup
