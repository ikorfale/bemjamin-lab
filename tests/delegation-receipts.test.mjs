import assert from 'node:assert/strict';
import test from 'node:test';

import { auditReceipts } from '../delegation-receipts/core.js';
import { NOW, makeFixture } from '../delegation-receipts/fixtures.js';

test('valid attenuating chain passes every check', () => {
  const report = auditReceipts(makeFixture('valid'), NOW);
  assert.equal(report.ok, true);
  assert.deepEqual(report.issues, []);
  assert.equal(report.checks.length, 6);
});

for (const [fault, check] of [
  ['widened_scope', 'scope'],
  ['changed_principal', 'principal'],
  ['expired_child', 'time'],
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

test('a child cannot outlive its parent', () => {
  const receipts = makeFixture('valid');
  receipts[1].expires_at = '2026-09-08T21:00:00Z';
  const report = auditReceipts(receipts, NOW);
  assert.ok(report.issues.some((entry) => entry.message === 'child expires after its parent'));
});

test('a cyclic parent chain is rejected without hanging', () => {
  const receipts = makeFixture('valid');
  receipts[0].parent_id = 'r-research';
  const report = auditReceipts(receipts, NOW);
  assert.ok(report.issues.some((entry) => entry.message === 'parent links contain a cycle'));
});
