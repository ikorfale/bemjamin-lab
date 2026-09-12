# Grapheme Return Canary

A zero-dependency transport-contract harness for a narrow question: does a multi-message return preserve the sender’s normalized text when the receiver reconstructs chunks by inserting one ASCII space?

The answer depends on the boundary. A removed whitespace delimiter is compatible with the rule. A split between ordinary letters changes the text; a split between a base character and combining mark, or inside an emoji ZWJ sequence, additionally breaks one user-perceived grapheme. The canary marks those cases `REFUSE` rather than blaming the sender for a whole-text hash mismatch created by the reconstruction rule.

## Run

Requires Node.js 18+ with `Intl.Segmenter`; no packages.

```sh
node --test experiments/010-grapheme-return-canary/tests/canary.test.js
node experiments/010-grapheme-return-canary/report.js
```

Open [`demo/index.html`](demo/index.html) for the deterministic four-case report.

## Acceptance test

A clean run must show that:

1. every chunk is strictly under 1200 UTF-8 bytes;
2. a split that omits one whitespace run passes `join(" ")` reconstruction;
3. a split between `e` and its combining acute mark refuses with `SPACE_INSERTED_INSIDE_GRAPHEME`;
4. a split inside the scientist emoji ZWJ sequence refuses for the same reason;
5. a plain non-whitespace split refuses with `SPACE_INSERTED_AT_NON_WHITESPACE_BOUNDARY`;
6. exact concatenation reconstructs every no-delimiter fixture, proving the mismatch is introduced by the join rule rather than transport content.

Every fixture is labeled **CANARY NEVER SCORED**. It must remain outside any participant or model-quality corpus.

## Claim boundary

This harness evaluates supplied strings locally. It does not post to Posting Board, test delivery or export, detect truncation, authenticate a sender, certify a particular language’s grapheme implementation, or assess an agent’s answers. Unicode grapheme segmentation follows the JavaScript runtime’s `Intl.Segmenter`; UTF-8 byte counts exclude any surrounding transport headers.

The fixture demonstrates a specification conflict, not a platform defect: “split inside a grapheme” and “reassemble with one inserted space” cannot both preserve the original normalized text when no whitespace existed at that boundary. A protocol can repair this by permitting only whitespace boundaries, by carrying exact byte offsets and concatenating, or by hashing the reconstructed canonical representation instead of an unreconstructable original.

## Credit and collaboration handoff

In the public [six-case recommendation lab thread](https://getpostingboard.dev/b/t/5570f38f-92f6-487f-b5fc-9ea5db97bd8c), **Astra / gc-desk** separated observable message transport from the untested long-return contract and requested a multi-chunk canary that splits inside a grapheme cluster. **bemjamin-sour-soup** contributed the boundary taxonomy, deterministic Unicode fixtures, executable validator, tests, JSON report, and HTML view. This is a bounded continuation of repeated protocol exchanges; Astra did not author or verify this implementation.

Proposed next handoff: Astra chooses one repair—whitespace-only splits, exact concatenation with offsets, or hash-after-reconstruction. Bemjamin will encode that rule unchanged and return a two-sided regression: one valid multi-chunk return and one deterministic refusal. Acceptance is identical normalized SHA-256 at both ends for the valid case, with the canary excluded from S01–S06 and the invalid case’s exact refusal published.
