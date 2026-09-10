const test = require('node:test');
const assert = require('node:assert/strict');
const { assessLegacyCommitment, drawSeat, simulate } = require('../core');
const { mixedCadence, policy } = require('../fixtures');

test('deterministic public draw is stable and excludes conflicted seats', () => {
  const first = drawSeat(policy, 4, 0);
  assert.deepEqual(drawSeat(policy, 4, 0), first);
  assert.notEqual(first.code, 'DUSK');
});

test('Caveman counterexample refuses the legacy deterministic commitment', () => {
  const counterexample = {
    case: 'dictionary attack on deterministic commitment',
    policy: {
      start_at: '2026-09-10T12:00:00.000Z', cadence_seconds: 300, ack_seconds: 60, max_attempts: 1,
      public_seed: 'known', seats: [{ code: 'A', funding: 'f1', conflicts: [] }],
    },
    slots: [{ private_kind: 'sealed-crisis', private_note: '', acknowledgements: [true] }],
    attacker_knows: ['core.js', 'policy', 'slot', 'scheduled_at', 'private_kind enum', 'empty private_note'],
    attack: 'Hash both stable candidate payloads with private_kind=ordinary and private_kind=sealed-crisis; compare each SHA-256 to public envelope_sha256.',
    expected: { decision: 'REFUSE', reason: 'LOW_ENTROPY_COMMITMENT_LEAKS_PRIVATE_KIND' },
  };
  assert.deepEqual(assessLegacyCommitment(counterexample), counterexample.expected);
});

test('fixed cadence publishes one envelope shape without a private label or dictionary oracle', () => {
  const result = simulate(mixedCadence);
  const envelopes = result.public_receipts.filter((item) => item.kind === 'ENVELOPE');
  assert.equal(envelopes.length, 3);
  assert.equal(result.cadence_check.one_shape, true);
  assert.equal(result.cadence_check.exposes_private_kind, false);
  assert.equal(envelopes.some((item) => Object.hasOwn(item, 'envelope_sha256')), false);
  assert.deepEqual(envelopes.map((item) => item.scheduled_at), [
    '2026-09-10T12:00:00.000Z', '2026-09-10T12:05:00.000Z', '2026-09-10T12:10:00.000Z',
  ]);
});

test('silence emits a public red seal and deterministically changes seats', () => {
  const result = simulate(mixedCadence);
  const red = result.public_receipts.find((item) => item.kind === 'RED_SEAL');
  assert.equal(red.slot, 1);
  assert.equal(red.elapsed_seconds, 60);
  assert.ok(red.next_seat_code);
  assert.notEqual(red.seat_code, red.next_seat_code);
});

test('extension uses a distinct seat with distinct disclosed funding', () => {
  const result = simulate(mixedCadence);
  const extension = result.decisions.find((item) => item.slot === 1);
  assert.equal(extension.decision, 'ALLOW_EXTENSION');
  const byCode = new Map(policy.seats.map((seat) => [seat.code, seat]));
  assert.notEqual(extension.first_seat, extension.second_seat);
  assert.notEqual(byCode.get(extension.first_seat).funding, byCode.get(extension.second_seat).funding);
});

test('extension fails closed without an independent second key', () => {
  const result = simulate({
    policy: { ...policy, seats: policy.seats.map((seat) => ({ ...seat, funding: 'one-funder' })) },
    slots: [{ private_kind: 'sealed-crisis', acknowledgements: [true], extension_requested: true }],
  });
  assert.equal(result.decisions[0].decision, 'REFUSE_EXTENSION');
  assert.equal(result.decisions[0].reason, 'NO_INDEPENDENT_SECOND_KEY');
});

test('exhausted silent pool refuses instead of widening authority', () => {
  const result = simulate({
    policy: { ...policy, max_attempts: 5, seats: policy.seats.slice(0, 2) },
    slots: [{ private_kind: 'sealed-crisis', acknowledgements: [false, false, false] }],
  });
  assert.equal(result.decisions[0].decision, 'REFUSE');
  assert.equal(result.decisions[0].reason, 'POOL_EXHAUSTED');
});

test('policy rejects undisclosed funding and malformed clocks', () => {
  assert.throws(() => simulate({ policy: { ...policy, start_at: 'soon' }, slots: mixedCadence.slots }), /canonical/);
  assert.throws(() => simulate({ policy: { ...policy, seats: [{ code: 'X', funding: '', conflicts: [] }] }, slots: mixedCadence.slots }), /funding/);
});
