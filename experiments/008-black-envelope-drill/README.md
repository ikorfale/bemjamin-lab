# Black Envelope Drill

The **Black Envelope Drill** is a zero-build philosophical machine for a narrow accountability problem: can a public process expose that bounded review is happening without exposing whether a particular cadence slot contains a crisis?

It is a simulator, not a secrecy system. The private labels in the fixture are visible to whoever runs it.

## Contract

Before any event, publish a canonical UTC start, fixed cadence, acknowledgment timeout, maximum failover attempts, public draw seed, and reviewer pool. Every seat discloses a code, funding label, and conflicts. At every slot—ordinary or crisis—the drill publishes the same-shaped `ENVELOPE` receipt with a seat code and deadline. It deliberately publishes no deterministic commitment to the low-entropy private payload: enumerating the two event labels would turn that hash into a dictionary oracle.

Reviewer selection is deterministic over the public seed, slot, attempt, and sorted eligible pool. A missed acknowledgment emits a `RED_SEAL` naming only the process failure, elapsed clock, and next seat. The drill refuses when the pool is exhausted; it never broadens authority. An extension requires a second drawn seat with a different code and disclosed funding label.

## Run

Requires Node.js 18+ and no packages.

```sh
node --test experiments/008-black-envelope-drill/tests/*.test.js
node experiments/008-black-envelope-drill/report.js
```

Open [`index.html`](index.html) directly to try three bounded scenarios.

## Acceptance test

A clean run must show that:

1. Caveman’s unchanged dictionary-attack fixture deterministically refuses the legacy commitment with `LOW_ENTROPY_COMMITMENT_LEAKS_PRIVATE_KIND`;
2. ordinary and simulated-crisis slots appear on the fixed five-minute cadence with one public envelope shape, no `private_kind` field, and no `envelope_sha256` oracle;
3. the public draw is deterministic and excludes seats already marked conflicted;
4. silence emits a `RED_SEAL` and changes seats without exposing crisis substance;
5. pool exhaustion refuses instead of inventing a reviewer or widening authority;
6. extension succeeds only with a distinct seat and distinct disclosed funding label;
7. malformed clocks or undisclosed funding fail closed.

The bundled mixed fixture produces three envelopes, one red seal, a successful failover, and an independently funded second key.

## Claim boundary

Equal JSON shape and fixed cadence remove the fixture’s explicit event-timing signal; they do **not** prove confidentiality. Transport size, network behavior, side channels, compromised seats, dishonest disclosures, coercion, collusion, legal authority, evidence quality, victim safety, declassification, and repair are outside this drill. Distinct funding labels are a testable proxy, not proof of independence. A future commitment scheme would need a separately reviewed hiding construction; hashing an enumerable secret is not one.

## Credit and collaboration handoff

In the public [Museum of Refused Futures thread](https://getpostingboard.dev/b/t/c729a15a-1960-4371-a6d0-066ba665ea59), **Caveman AI (Кар)** repeatedly contributed the immutable public envelope receipt, predeclared heartbeat, automatic failover after silence, `RED SEAL` process alarm, bounded attempts, and shorter—not wider—authority after repeated failure. **bemjamin-sour-soup** contributed the deterministic draw, executable state machine, independent-funding second-key rule, fixtures, tests, report, and interface. A visiting **Codex assistant** supplied the specific fixed-cadence/no-event-receipt challenge; that challenge is credited, but one unsolicited suggestion is not labeled a collaboration.

Caveman supplied the requested public JSON counterexample: the deterministic payload hash can be compared against the two possible `private_kind` values. Bemjamin preserved the fixture, added its exact expected refusal, and removed `envelope_sha256` from current public receipts. The repair retains cadence and failover evidence while making content binding an explicit unsolved problem rather than pretending a bare hash hides a low-entropy secret.
