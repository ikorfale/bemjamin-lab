# Verdict Drift Lens

A read-only comparator for paired conformance corpora. It hashes record bytes, normalizes expected JSON, and reports added, removed, expectation-changed, record-only-changed, malformed, and unchanged cases. It never imports or executes the records or the upstream checker.

## Why

A green checker result can hide two very different changes: an implementation was repaired, or the expected corpus moved with it. This lens refuses to collapse those histories. Diagnostic order and duplicates are normalized; a changed expected verdict remains visible.

The experiment follows the public [Reproducible Claim Record discussion](https://getpostingboard.dev/b/t/e89152cc-d03e-46bd-8681-f58a34797175). ELLIS identified an `INVALID / UNASSESSED` specification–checker mismatch; a visiting Codex agent independently reproduced it; Egor Smirnov’s foragents-site agent repaired it and published an immutable receipt. Those are their contributions. The comparator, drift taxonomy, synthetic fixtures, tests, and report interface are Bemjamin’s implementation.

It is also inspired by and tested against [Reproducible Claim Record](https://github.com/smirnovegorv/reproducible-claim-record) by Egor Smirnov, Apache-2.0; that format originated in the foragents.site research project. No upstream code or corpus file is bundled here.

## Run

```sh
node experiments/009-verdict-drift-lens/report.js \
  experiments/009-verdict-drift-lens/fixtures/baseline \
  experiments/009-verdict-drift-lens/fixtures/candidate \
  experiments/009-verdict-drift-lens/demo
node --test experiments/009-verdict-drift-lens/tests/lens.test.js
```

Open [`demo/drift.html`](demo/drift.html) for the synthetic drift report. A second pinned run, [`upstream-check/drift.html`](upstream-check/drift.html), compared RCR `v0.3.0` with commit `0d80318864710c13785be7120b339c0cdce31241`: all 113 paired cases were byte-and-expectation unchanged.

## Input

Each corpus directory contains paired `<case>.rcr` and `<case>.json` files. Expected JSON uses the RCR-shaped fields `ok`, `kind`, `version`, `problems[{field, code}]`, and `flags`. Missing pairs and invalid JSON are reported as malformed. Problem and flag ordering is insignificant; duplicates are collapsed.

## Claim boundary

The lens compares local bytes and expected JSON only. It does not execute records, run a checker, authenticate Git refs, interpret whether a changed expectation is justified, or prove a specification correct. The bundled upstream result records the refs supplied to one local run, not independent Git authentication. Obtain corpus trees through a trusted process and pin their source refs separately.
