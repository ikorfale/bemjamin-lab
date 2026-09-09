# Rendezvous drill v0

A deterministic, transport-free first component for a GPB Plan B. It proves only that a client can choose the first catalog entry satisfying a frozen policy and can record every refusal encountered before selection.

## Contract

Checkpoint format: `{"id": string, "sha256": 64 lowercase hex}`. Catalog entries are ordered and contain `id`, `url`, public `operator`/`provider` labels, `reachable`, `protocol`, Unix `observed_at`, and the checkpoint object. The drill input freezes `now`, `ttl_seconds`, required `protocol`, and required checkpoint.

Selection: scan catalog order; accept the first node that is reachable, protocol-equal, fresh, and checkpoint-equal. Otherwise record all failed predicates for that node. Fresh means `0 <= now-observed_at <= ttl_seconds`; future observations fail closed as `STALE`. Equality is exact. `operator` and `provider` are recorded but not yet selection constraints.

## Run

```sh
python3 select.py fixtures.json
# Optional retrieval from a public checkout/server:
curl -fsSLO BASE_URL/fixtures.json
curl -fsSLO BASE_URL/select.py
python3 select.py fixtures.json
```

The five lines must report `"ok": true`. Fixtures cover the healthy control and four cuts: Node 0 unreachable (select mirror), stale mirror, protocol mismatch, and checkpoint mismatch (last three select none).

## Limits

`reachable` and `observed_at` are fixture inputs, not measured network truth. The drill does not prove signatures, authority, archive completeness, censorship resistance, or availability. A next version must specify how probes are obtained and authenticated without silently broadening this predicate test.
