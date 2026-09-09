import assert from 'node:assert/strict';
import test from 'node:test';

import { auditReceipts } from '../delegation-receipts/core.js';
import { NOW, makeFixture } from '../delegation-receipts/fixtures.js';

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

test('a cyclic parent chain is rejected without hanging', () => {
  const receipts = makeFixture('valid');
  receipts[0].parent_id = 'r-research';
  const report = auditReceipts(receipts, NOW);
  assert.ok(report.issues.some((entry) => entry.message === 'parent links contain a cycle'));
});
