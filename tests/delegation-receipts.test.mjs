import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditAndConsumeArtifacts,
  auditReceipts,
  auditReceiptsWithArtifacts,
  sha256Hex,
} from '../delegation-receipts/core.js';
import { NOW, makeArtifactResolver, makeFixture } from '../delegation-receipts/fixtures.js';

test('valid attenuating chain passes every check', () => {
  const report = auditReceipts(makeFixture('valid'), NOW);
  assert.equal(report.ok, true);
  assert.deepEqual(report.issues, []);
  assert.equal(report.checks.length, 7);
});

for (const [fault, check] of [
  ['widened_scope', 'scope'],
  ['changed_principal', 'principal'],
  ['blank_root_principal', 'principal'],
  ['null_root_principal', 'principal'],
  ['missing_root_principal', 'principal'],
  ['early_child', 'time'],
  ['offset_free_time', 'time'],
  ['september_31', 'time'],
  ['non_leap_february_29', 'time'],
  ['expired_child', 'time'],
  ['revoked_ancestor', 'revocation'],
  ['broken_parent', 'chain'],
  ['forbidden_redelegation', 'redelegation'],
  ['missing_result', 'result'],
]) {
  test(`${fault} is rejected by ${check} check`, () => {
    const report = auditReceipts(makeFixture(fault), NOW);
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((entry) => entry.check === check), JSON.stringify(report));
  });
}

test('stable locator with one-byte artifact mutation is rejected by digest', async () => {
  const receipts = makeFixture('result_digest_mismatch');
  const structural = auditReceipts(receipts, NOW);
  assert.equal(structural.ok, true, 'locator and frozen digest alone cannot detect replacement');

  const report = await auditReceiptsWithArtifacts(receipts, NOW, makeArtifactResolver('result_digest_mismatch'));
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((entry) =>
    entry.receiptId === 'r-research' && entry.code === 'RESULT_DIGEST_MISMATCH'));
});

test('valid result bytes match the frozen digest', async () => {
  const report = await auditReceiptsWithArtifacts(makeFixture('valid'), NOW, makeArtifactResolver('valid'));
  assert.equal(report.ok, true);
});

test('unretrievable result is unknown rather than passing', async () => {
  const report = await auditReceiptsWithArtifacts(makeFixture('valid'), NOW, async () => undefined);
  assert.ok(report.issues.some((entry) => entry.code === 'RESULT_UNAVAILABLE'));
});

test('a later fetch cannot consume bytes changed since audit', async () => {
  let calls = 0;
  const resolver = async () => (++calls === 1 ? 'public notes\n' : 'public noteS\n');
  const result = await auditAndConsumeArtifacts(
    makeFixture('valid'), NOW, resolver, 'REFRESH_AND_REVERIFY',
  );

  assert.equal(calls, 2);
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((entry) => entry.code === 'RESULT_CHANGED_SINCE_AUDIT'));
  assert.equal(result.artifacts[0].consumed, false);
  assert.equal(result.artifacts[0].bytes, null);
});

test('verified-buffer consumption reuses the exact audited bytes', async () => {
  let calls = 0;
  const result = await auditAndConsumeArtifacts(
    makeFixture('valid'), NOW, async () => { calls += 1; return 'public notes\n'; }, 'VERIFIED_BUFFER',
  );

  assert.equal(result.ok, true);
  assert.equal(calls, 1);
  assert.equal(result.artifacts[0].consumed, true);
  assert.equal(new TextDecoder().decode(result.artifacts[0].bytes), 'public notes\n');
  assert.equal(result.artifacts[0].consumed_digest, result.artifacts[0].audit_snapshot_digest);
});

test('verified-buffer consumption owns its snapshot after resolver mutation', async () => {
  const resolverOwned = new TextEncoder().encode('public notes\n');
  const result = await auditAndConsumeArtifacts(
    makeFixture('valid'), NOW, async () => resolverOwned, 'VERIFIED_BUFFER',
  );

  resolverOwned[12] = 'S'.charCodeAt(0);
  assert.equal(new TextDecoder().decode(result.artifacts[0].bytes), 'public notes\n');
  assert.equal(await sha256Hex(result.artifacts[0].bytes), result.artifacts[0].consumed_digest);
});

test('refreshed consumption owns its verified snapshot after resolver mutation', async () => {
  const resolverOwned = new TextEncoder().encode('public notes\n');
  const result = await auditAndConsumeArtifacts(
    makeFixture('valid'), NOW, async () => resolverOwned, 'REFRESH_AND_REVERIFY',
  );

  resolverOwned[12] = 'S'.charCodeAt(0);
  assert.equal(new TextDecoder().decode(result.artifacts[0].bytes), 'public notes\n');
  assert.equal(await sha256Hex(result.artifacts[0].bytes), result.artifacts[0].consumed_digest);
});

for (const mode of ['VERIFIED_BUFFER', 'REFRESH_AND_REVERIFY']) {
  test(`${mode} hashes and owns only the supplied Uint8Array window`, async () => {
    const payload = new TextEncoder().encode('public notes\n');
    const backing = new Uint8Array(payload.length + 4);
    backing.set([0xaa, 0xbb], 0);
    backing.set(payload, 2);
    backing.set([0xcc, 0xdd], 2 + payload.length);
    const view = new Uint8Array(backing.buffer, 2, payload.length);
    const expectedWholeDigest = await sha256Hex(backing);

    const result = await auditAndConsumeArtifacts(
      makeFixture('valid'), NOW, async () => view, mode,
    );

    assert.equal(result.ok, true);
    assert.equal(new TextDecoder().decode(result.artifacts[0].bytes), 'public notes\n');
    assert.notEqual(result.artifacts[0].consumed_digest, expectedWholeDigest);

    backing[0] ^= 0xff;
    backing[backing.length - 1] ^= 0xff;
    assert.equal(new TextDecoder().decode(result.artifacts[0].bytes), 'public notes\n');

    view[12] = 'S'.charCodeAt(0);
    assert.equal(new TextDecoder().decode(result.artifacts[0].bytes), 'public notes\n');
    assert.equal(await sha256Hex(result.artifacts[0].bytes), result.artifacts[0].consumed_digest);
  });
}

test('revocation is evaluated at audit time rather than rewriting expiry', () => {
  const receipts = makeFixture('revoked_ancestor');
  const beforeRevocation = auditReceipts(receipts, '2026-09-08T17:20:00Z');
  const afterRevocation = auditReceipts(receipts, NOW);
  assert.equal(beforeRevocation.ok, true);
  assert.ok(afterRevocation.issues.some((entry) =>
    entry.receiptId === 'r-research' && entry.message.startsWith('ancestor r-root was revoked')));
});

test('a child cannot outlive its parent', () => {
  const receipts = makeFixture('valid');
  receipts[1].expires_at = '2026-09-08T21:00:00Z';
  const report = auditReceipts(receipts, NOW);
  assert.ok(report.issues.some((entry) => entry.message === 'child expires after its parent'));
});

test('a child cannot begin before its parent', () => {
  const report = auditReceipts(makeFixture('early_child'), NOW);
  assert.ok(report.issues.some((entry) => entry.message === 'child starts before its parent'));
});

for (const fault of ['blank_root_principal', 'null_root_principal', 'missing_root_principal']) {
  test(`${fault} reports malformed root identity`, () => {
    const report = auditReceipts(makeFixture(fault), NOW);
    assert.ok(report.issues.some((entry) =>
      entry.check === 'principal'
      && entry.receiptId === 'r-root'
      && entry.message === 'principal must be a non-empty string'));
  });
}

test('a child may exactly share both parent boundaries', () => {
  const receipts = makeFixture('valid');
  receipts[1].not_before = receipts[0].not_before;
  receipts[1].expires_at = receipts[0].expires_at;
  assert.equal(auditReceipts(receipts, NOW).ok, true);
});

test('an empty half-open interval is rejected', () => {
  const receipts = makeFixture('valid');
  receipts[1].expires_at = receipts[1].not_before;
  const report = auditReceipts(receipts, NOW);
  assert.ok(report.issues.some((entry) => entry.message === 'invalid or inverted validity interval'));
});

test('a receipt is inactive at its exact expiry boundary', () => {
  const receipts = makeFixture('valid');
  const report = auditReceipts(receipts, receipts[1].expires_at);
  assert.ok(report.issues.some((entry) =>
    entry.receiptId === 'r-research' && entry.message === `receipt is not active at ${receipts[1].expires_at}`));
});

test('equivalent mixed-offset intervals have the same verdict as UTC intervals', () => {
  const utc = makeFixture('valid');
  utc[1].not_before = '2026-09-08T17:00:00Z';
  const mixed = makeFixture('valid');
  mixed[1].not_before = '2026-09-08T13:00:00-04:00';
  mixed[1].expires_at = '2026-09-08T15:00:00-04:00';
  const audit = '2026-09-08T14:00:00-04:00';

  assert.equal(auditReceipts(utc, audit).ok, true);
  assert.deepEqual(auditReceipts(mixed, audit).issues, auditReceipts(utc, audit).issues);
});

test('changing serialization offset without changing the instant preserves the verdict', () => {
  const receipts = makeFixture('valid');
  const baseline = auditReceipts(receipts, NOW);
  receipts[0].not_before = '2026-09-08T13:00:00-04:00';
  receipts[1].not_before = '2026-09-08T13:05:00-04:00';
  assert.deepEqual(auditReceipts(receipts, NOW).issues, baseline.issues);
});

test('changing the child instant one second before the parent is rejected', () => {
  const receipts = makeFixture('valid');
  receipts[1].not_before = '2026-09-08T12:59:59-04:00';
  const report = auditReceipts(receipts, NOW);
  assert.ok(report.issues.some((entry) => entry.message === 'child starts before its parent'));
});

test('offset-free timestamps are rejected rather than interpreted in local time', () => {
  const report = auditReceipts(makeFixture('offset_free_time'), NOW);
  assert.ok(report.issues.some((entry) =>
    entry.receiptId === 'r-research' && entry.message === 'invalid or inverted validity interval'));
});

test('calendar validation rejects dates that Date.parse normalizes', () => {
  for (const fault of ['september_31', 'non_leap_february_29']) {
    const report = auditReceipts(makeFixture(fault), NOW);
    assert.ok(report.issues.some((entry) =>
      entry.receiptId === 'r-root' && entry.message === 'invalid or inverted validity interval'));
  }
});

test('calendar validation accepts leap day and mixed-offset controls', () => {
  const leapDay = makeFixture('valid');
  leapDay[0].not_before = '2024-02-29T17:00:00+00:00';
  leapDay[0].expires_at = '2026-09-08T20:00:00Z';
  const mixedOffset = makeFixture('valid');
  mixedOffset[0].not_before = '2026-09-08T13:00:00-04:00';
  mixedOffset[0].expires_at = '2026-09-08T16:00:00-04:00';

  assert.equal(auditReceipts(leapDay, NOW).ok, true);
  assert.equal(auditReceipts(mixedOffset, NOW).ok, true);
});

test('a cyclic parent chain is rejected without hanging', () => {
  const receipts = makeFixture('valid');
  receipts[0].parent_id = 'r-research';
  const report = auditReceipts(receipts, NOW);
  assert.ok(report.issues.some((entry) => entry.message === 'parent links contain a cycle'));
});
