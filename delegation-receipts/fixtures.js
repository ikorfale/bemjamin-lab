export const NOW = '2026-09-08T18:00:00Z';
export const RESULT_LOCATOR = 'snapshot://public-notes';
export const RESULT_BODY = 'public notes\n';
export const RESULT_SHA256 = 'a4c30ecc2e678acd020725a5137d25358898caa4bc038ac2905bdb273d037d33';

export const baseReceipts = Object.freeze([
  Object.freeze({
    id: 'r-root', parent_id: null, principal: 'cora', actor: 'planner',
    scopes: Object.freeze(['web:read', 'report:write']),
    not_before: '2026-09-08T17:00:00Z', expires_at: '2026-09-08T20:00:00Z',
    redelegation_allowed: true, result_locator: '', result_sha256: '',
  }),
  Object.freeze({
    id: 'r-research', parent_id: 'r-root', principal: 'cora', actor: 'researcher',
    scopes: Object.freeze(['web:read']),
    not_before: '2026-09-08T17:05:00Z', expires_at: '2026-09-08T19:00:00Z',
    redelegation_allowed: false, result_locator: RESULT_LOCATOR, result_sha256: RESULT_SHA256,
  }),
]);

export const faultLabels = Object.freeze({
  valid: 'Valid attenuation',
  widened_scope: 'Scope widening',
  changed_principal: 'Principal substitution',
  blank_root_principal: 'Blank root principal',
  null_root_principal: 'Null root principal',
  missing_root_principal: 'Missing root principal',
  early_child: 'Child starts before parent',
  offset_free_time: 'Timestamp without an explicit offset',
  expired_child: 'Expired child',
  revoked_ancestor: 'Revoked ancestor',
  broken_parent: 'Broken parent link',
  forbidden_redelegation: 'Forbidden third hop',
  missing_result: 'Unaudited leaf result',
  result_digest_mismatch: 'Mutated result at stable locator',
});

function cloneBase() {
  return baseReceipts.map((receipt) => ({ ...receipt, scopes: [...receipt.scopes] }));
}

export function makeFixture(name) {
  const receipts = cloneBase();
  const child = receipts[1];

  if (name === 'widened_scope') child.scopes.push('publish:write');
  if (name === 'changed_principal') child.principal = 'mallory';
  if (name === 'blank_root_principal') receipts[0].principal = '';
  if (name === 'null_root_principal') receipts[0].principal = null;
  if (name === 'missing_root_principal') delete receipts[0].principal;
  if (name === 'early_child') child.not_before = '2026-09-08T16:00:00Z';
  if (name === 'offset_free_time') child.not_before = '2026-09-08T17:05:00';
  if (name === 'expired_child') child.expires_at = '2026-09-08T17:30:00Z';
  if (name === 'revoked_ancestor') receipts[0].revoked_at = '2026-09-08T17:30:00Z';
  if (name === 'broken_parent') child.parent_id = 'r-vanished';
  if (name === 'missing_result') {
    child.result_locator = '';
    child.result_sha256 = '';
  }
  if (name === 'forbidden_redelegation') {
    child.result_locator = '';
    child.result_sha256 = '';
    receipts.push({
      id: 'r-summarize', parent_id: 'r-research', principal: 'cora', actor: 'summarizer',
      scopes: ['web:read'], not_before: '2026-09-08T17:10:00Z',
      expires_at: '2026-09-08T18:45:00Z', redelegation_allowed: false,
      result_locator: 'snapshot://summary',
      result_sha256: '264f1497580860d4381e24d976a63c1dd8965bc48eb729864cd484e9aa0eecc0',
    });
  }
  return receipts;
}

export function makeArtifactResolver(name) {
  const artifacts = new Map([
    [RESULT_LOCATOR, name === 'result_digest_mismatch' ? 'public noteS\n' : RESULT_BODY],
    ['snapshot://summary', 'summary\n'],
  ]);
  return async (locator) => artifacts.get(locator);
}
