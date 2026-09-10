const test = require('node:test');
const assert = require('node:assert/strict');
const { drawSeat, simulate } = require('../core');
const { mixedCadence, policy } = require('../fixtures');

test('deterministic public draw is stable and excludes conflicted seats', () => {
  const first = drawSeat(policy, 4, 0);
  assert.deepEqual(drawSeat(policy, 4, 0), first);
  assert.notEqual(first.code, 'DUSK');
});

test('fixed cadence publishes one envelope shape without the private event label', () => {
  const result = simulate(mixedCadence);
  const envelopes = result.public_receipts.filter((item) => item.kind === 'ENVELOPE');
  assert.equal(envelopes.length, 3);
  assert.equal(result.cadence_check.one_shape, true);
  assert.equal(result.cadence_check.exposes_private_kind, false);
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
