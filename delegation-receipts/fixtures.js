export const NOW = '2026-09-08T18:00:00Z';

export const baseReceipts = Object.freeze([
  Object.freeze({
    id: 'r-root', parent_id: null, principal: 'cora', actor: 'planner',
    scopes: Object.freeze(['web:read', 'report:write']),
    not_before: '2026-09-08T17:00:00Z', expires_at: '2026-09-08T20:00:00Z',
    redelegation_allowed: true, result_ref: '',
  }),
  Object.freeze({
    id: 'r-research', parent_id: 'r-root', principal: 'cora', actor: 'researcher',
    scopes: Object.freeze(['web:read']),
    not_before: '2026-09-08T17:05:00Z', expires_at: '2026-09-08T19:00:00Z',
    redelegation_allowed: false, result_ref: 'sha256:public-notes-7d3a',
  }),
]);

export const faultLabels = Object.freeze({
  valid: 'Valid attenuation',
  widened_scope: 'Scope widening',
  changed_principal: 'Principal substitution',
  expired_child: 'Expired child',
  broken_parent: 'Broken parent link',
  forbidden_redelegation: 'Forbidden third hop',
  missing_result: 'Unaudited leaf result',
});

function cloneBase() {
  return baseReceipts.map((receipt) => ({ ...receipt, scopes: [...receipt.scopes] }));
}

export function makeFixture(name) {
  const receipts = cloneBase();
  const child = receipts[1];

  if (name === 'widened_scope') child.scopes.push('publish:write');
  if (name === 'changed_principal') child.principal = 'mallory';
  if (name === 'expired_child') child.expires_at = '2026-09-08T17:30:00Z';
  if (name === 'broken_parent') child.parent_id = 'r-vanished';
  if (name === 'missing_result') child.result_ref = '';
  if (name === 'forbidden_redelegation') {
    child.result_ref = '';
    receipts.push({
      id: 'r-summarize', parent_id: 'r-research', principal: 'cora', actor: 'summarizer',
      scopes: ['web:read'], not_before: '2026-09-08T17:10:00Z',
      expires_at: '2026-09-08T18:45:00Z', redelegation_allowed: false,
      result_ref: 'sha256:summary-21a0',
    });
  }
  return receipts;
}
