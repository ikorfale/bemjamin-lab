'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalObservation, signObservation, verifyObservation, comparePolicies, strictInstant } = require('../core');
const { makeLab, policyForkFixture } = require('../fixtures');

test('canonical bytes ignore signature and input property order', () => {
  const lab = makeLab();
  const a = lab.testimony('ada', 'node-0', 'UP', 1).observation;
  const b = Object.fromEntries(Object.entries(a).reverse());
  b.untrusted_extra = 'ignored';
  assert.deepEqual(canonicalObservation(a), canonicalObservation(b));
});

test('valid testimony passes exact binding, time, allowlist, sequence, and signature', () => {
  const lab = makeLab();
  const signed = lab.testimony('ada', 'node-0', 'UP', 2);
  const result = verifyObservation(signed, {
    now: '2026-09-09T10:30:00.000Z', nodeId: 'node-0', checkpoint: lab.base.checkpoint,
    allowlist: lab.allowlist, lastSeen: { ada: 1 }
  });
  assert.deepEqual(result, { ok: true, reasons: [] });
});

test('expired, forged, replayed, conflicting, and insufficient cases stay distinct', () => {
  const lab = makeLab();
  const expired = lab.testimony('ada', 'node-0', 'UP', 2, { expires_at: '2026-09-09T10:01:00.000Z' });
  assert.ok(verifyObservation(expired, { now: '2026-09-09T10:30:00.000Z', nodeId: 'node-0', checkpoint: lab.base.checkpoint, allowlist: lab.allowlist, lastSeen: {} }).reasons.includes('EXPIRED'));

  const forged = lab.testimony('ada', 'node-0', 'UP', 3);
  forged.observation.status = 'DOWN';
  assert.ok(verifyObservation(forged, { now: '2026-09-09T10:30:00.000Z', nodeId: 'node-0', checkpoint: lab.base.checkpoint, allowlist: lab.allowlist, lastSeen: {} }).reasons.includes('SIGNATURE'));

  const replay = lab.testimony('ada', 'node-0', 'UP', 3);
  assert.ok(verifyObservation(replay, { now: '2026-09-09T10:30:00.000Z', nodeId: 'node-0', checkpoint: lab.base.checkpoint, allowlist: lab.allowlist, lastSeen: { ada: 3 } }).reasons.includes('REPLAY'));

  const oneUp = { now: '2026-09-09T10:30:00.000Z', checkpoint: lab.base.checkpoint, catalog: [{ id: 'node-0' }], observations: [lab.testimony('ada', 'node-0', 'UP', 4)], allowlist: lab.allowlist };
  assert.deepEqual(comparePolicies(oneUp).nodes[0].reasons, ['INSUFFICIENT_QUORUM']);
});

test('policy fork exposes the decision instead of silently choosing it', () => {
  const { input } = policyForkFixture();
  const result = comparePolicies(input);
  assert.deepEqual(result.policies.FAIL_CLOSED_ON_CONFLICT, { selected: null, reason: 'CONFLICT:node-0' });
  assert.deepEqual(result.policies.SKIP_CONFLICTED_NODE, { selected: 'mirror-a', reason: 'QUORUM' });
  assert.deepEqual(result.nodes[0].up, ['ada', 'bert']);
  assert.deepEqual(result.nodes[0].down, ['cy']);
});

test('same-sequence equivocation is excluded independent of input order', () => {
  const lab = makeLab();
  const up = lab.testimony('ada', 'node-0', 'UP', 7);
  const downObservation = { ...up.observation, status: 'DOWN' };
  const down = { observation: downObservation, signature: signObservation(downObservation, lab.privateKeys.ada) };
  const bert = lab.testimony('bert', 'node-0', 'UP', 4);
  const base = { now: '2026-09-09T10:30:00.000Z', checkpoint: lab.base.checkpoint, catalog: [{ id: 'node-0' }], allowlist: lab.allowlist };
  const forward = comparePolicies({ ...base, observations: [up, down, bert] });
  const reverse = comparePolicies({ ...base, observations: [bert, down, up] });
  assert.deepEqual(forward, reverse);
  assert.deepEqual(forward.nodes[0].up, ['bert']);
  assert.deepEqual(forward.nodes[0].rejected, [{ observer_id: 'ada', reasons: ['EQUIVOCATION'] }]);
  assert.deepEqual(forward.nodes[0].reasons, ['INSUFFICIENT_QUORUM']);
});

test('a DOWN-only node is not mislabeled as a conflict', () => {
  const lab = makeLab();
  const result = comparePolicies({ now: '2026-09-09T10:30:00.000Z', checkpoint: lab.base.checkpoint, catalog: [{ id: 'node-0' }], observations: [lab.testimony('cy', 'node-0', 'DOWN', 1)], allowlist: lab.allowlist });
  assert.deepEqual(result.nodes[0].reasons, ['AUTHENTICATED_DOWN', 'INSUFFICIENT_QUORUM']);
  assert.equal(result.policies.FAIL_CLOSED_ON_CONFLICT.reason, 'NO_ELIGIBLE_NODE');
});

test('quorum must be positive and cannot exceed the allowlist', () => {
  const lab = makeLab();
  const base = { now: '2026-09-09T10:30:00.000Z', checkpoint: lab.base.checkpoint, catalog: [{ id: 'node-0' }], observations: [], allowlist: lab.allowlist };
  for (const quorum of [-1, 0, 4, 1.5]) assert.throws(() => comparePolicies({ ...base, quorum }), RangeError);
});

test('calendar normalization and non-canonical timestamps are rejected', () => {
  assert.equal(strictInstant('2026-09-31T10:00:00.000Z'), null);
  assert.equal(strictInstant('2026-09-09T10:00:00Z'), null);
  assert.equal(strictInstant('2026-09-09T10:00:00.000Z'), Date.parse('2026-09-09T10:00:00.000Z'));
});
