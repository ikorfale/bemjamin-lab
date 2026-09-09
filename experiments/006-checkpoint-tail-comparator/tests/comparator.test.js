'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { compareTails, inspectTail, recordBytes, recordDigest } = require('../core');
const { fixtures, history } = require('../fixtures');

for (const [name, verdict, reason] of [
  ['equivalent', 'EQUIVALENT', 'SAME_HISTORY'],
  ['left_extends', 'USE_LEFT', 'LEFT_STRICTLY_EXTENDS_RIGHT'],
  ['right_extends', 'USE_RIGHT', 'RIGHT_STRICTLY_EXTENDS_LEFT'],
  ['diverged', 'REFUSE', 'DIVERGED'],
  ['broken_link', 'REFUSE', 'INVALID_TAIL'],
  ['checkpoint_mismatch', 'REFUSE', 'CHECKPOINT_MISMATCH'],
]) {
  test(`${name} produces ${verdict}/${reason}`, () => {
    const result = compareTails(...fixtures()[name]);
    assert.equal(result.verdict, verdict);
    assert.equal(result.reason, reason);
  });
}

test('divergence evidence pins the first conflicting sequence and both record digests', () => {
  const result = compareTails(...fixtures().diverged);
  assert.equal(result.evidence[0].seq, 43);
  assert.match(result.evidence[0].left_sha256, /^[a-f0-9]{64}$/);
  assert.match(result.evidence[0].right_sha256, /^[a-f0-9]{64}$/);
  assert.notEqual(result.evidence[0].left_sha256, result.evidence[0].right_sha256);
});

test('a common prefix may end at the checkpoint', () => {
  const empty = history([]);
  const longer = history(['post-41']);
  assert.deepEqual(compareTails(empty, longer), {
    verdict: 'USE_RIGHT', reason: 'RIGHT_STRICTLY_EXTENDS_LEFT', evidence: [{ additional_records: 1 }],
  });
});

test('a sequence gap and a malformed payload digest are both preserved as evidence', () => {
  const candidate = history(['post-41', 'post-42']);
  candidate.tail[0].seq = 44;
  candidate.tail[1].payload_sha256 = 'not-a-digest';
  const result = inspectTail(candidate);
  assert.equal(result.ok, false);
  assert.deepEqual(result.reasons, ['TAIL[0]:SEQUENCE', 'TAIL[1]:MALFORMED']);
});

test('record hashing ignores extra uncommitted properties but binds every declared field', () => {
  const record = history(['post-41']).tail[0];
  const withExtra = { ...record, untrusted_note: 'ignored' };
  assert.deepEqual(recordBytes(record), recordBytes(withExtra));
  assert.equal(recordDigest(record), recordDigest(withExtra));
  assert.notEqual(recordDigest(record), recordDigest({ ...record, seq: record.seq + 1 }));
});
