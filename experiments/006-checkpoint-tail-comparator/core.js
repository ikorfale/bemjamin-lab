'use strict';

const { createHash } = require('node:crypto');

const HEX_256 = /^[a-f0-9]{64}$/;

function recordBytes(record) {
  return Buffer.from(JSON.stringify({
    v: record?.v,
    seq: record?.seq,
    prev_sha256: record?.prev_sha256,
    payload_sha256: record?.payload_sha256,
  }), 'utf8');
}

function recordDigest(record) {
  return createHash('sha256').update(recordBytes(record)).digest('hex');
}

function validateCheckpoint(checkpoint) {
  const reasons = [];
  if (!checkpoint || typeof checkpoint !== 'object') return ['CHECKPOINT_MALFORMED'];
  if (typeof checkpoint.id !== 'string' || !checkpoint.id) reasons.push('CHECKPOINT_ID_INVALID');
  if (!Number.isSafeInteger(checkpoint.seq) || checkpoint.seq < 0) reasons.push('CHECKPOINT_SEQ_INVALID');
  if (!HEX_256.test(checkpoint.sha256 || '')) reasons.push('CHECKPOINT_DIGEST_INVALID');
  return reasons;
}

function inspectTail(candidate) {
  const checkpointReasons = validateCheckpoint(candidate?.checkpoint);
  if (checkpointReasons.length) return { ok: false, reasons: checkpointReasons, digests: [] };
  if (!Array.isArray(candidate?.tail)) return { ok: false, reasons: ['TAIL_NOT_ARRAY'], digests: [] };

  const reasons = [];
  const digests = [];
  let expectedSequence = candidate.checkpoint.seq + 1;
  let expectedPrevious = candidate.checkpoint.sha256;

  for (let index = 0; index < candidate.tail.length; index += 1) {
    const record = candidate.tail[index];
    const label = `TAIL[${index}]`;
    if (!record || typeof record !== 'object'
      || record.v !== 1
      || !Number.isSafeInteger(record.seq)
      || !HEX_256.test(record.prev_sha256 || '')
      || !HEX_256.test(record.payload_sha256 || '')) {
      reasons.push(`${label}:MALFORMED`);
      continue;
    }
    if (record.seq !== expectedSequence) reasons.push(`${label}:SEQUENCE`);
    if (record.prev_sha256 !== expectedPrevious) reasons.push(`${label}:PREV_DIGEST`);
    const digest = recordDigest(record);
    digests.push(digest);
    expectedSequence = record.seq + 1;
    expectedPrevious = digest;
  }

  return { ok: reasons.length === 0, reasons, digests };
}

function sameCheckpoint(left, right) {
  return left.id === right.id && left.seq === right.seq && left.sha256 === right.sha256;
}

function compareTails(left, right) {
  const leftInspection = inspectTail(left);
  const rightInspection = inspectTail(right);
  const invalid = [];
  if (!leftInspection.ok) invalid.push(...leftInspection.reasons.map((reason) => `LEFT:${reason}`));
  if (!rightInspection.ok) invalid.push(...rightInspection.reasons.map((reason) => `RIGHT:${reason}`));
  if (invalid.length) return { verdict: 'REFUSE', reason: 'INVALID_TAIL', evidence: invalid };
  if (!sameCheckpoint(left.checkpoint, right.checkpoint)) {
    return { verdict: 'REFUSE', reason: 'CHECKPOINT_MISMATCH', evidence: [] };
  }

  const a = leftInspection.digests;
  const b = rightInspection.digests;
  const commonLength = Math.min(a.length, b.length);
  let firstDifference = -1;
  for (let index = 0; index < commonLength; index += 1) {
    if (a[index] !== b[index]) { firstDifference = index; break; }
  }
  if (firstDifference >= 0) {
    return {
      verdict: 'REFUSE',
      reason: 'DIVERGED',
      evidence: [{
        seq: left.checkpoint.seq + firstDifference + 1,
        left_sha256: a[firstDifference],
        right_sha256: b[firstDifference],
      }],
    };
  }
  if (a.length === b.length) return { verdict: 'EQUIVALENT', reason: 'SAME_HISTORY', evidence: [] };
  if (a.length > b.length) {
    return { verdict: 'USE_LEFT', reason: 'LEFT_STRICTLY_EXTENDS_RIGHT', evidence: [{ additional_records: a.length - b.length }] };
  }
  return { verdict: 'USE_RIGHT', reason: 'RIGHT_STRICTLY_EXTENDS_LEFT', evidence: [{ additional_records: b.length - a.length }] };
}

function liveGrants(grants, scope, now) {
  if (!Array.isArray(grants)) return [];
  return grants.filter((grant) => grant
    && typeof grant.grant_id === 'string' && grant.grant_id
    && grant.scope === scope
    && Number.isSafeInteger(grant.granted_at) && grant.granted_at <= now
    && Number.isSafeInteger(grant.expires_at) && now <= grant.expires_at
    && (grant.revoked_at === null || (Number.isSafeInteger(grant.revoked_at) && grant.revoked_at > now)));
}

function resolveWithAuthority(left, right, authority) {
  const history = compareTails(left, right);
  if (history.verdict !== 'REFUSE' || history.reason !== 'DIVERGED') return history;
  if (!authority || typeof authority.scope !== 'string' || !authority.scope
    || !Number.isSafeInteger(authority.now)) {
    return { ...history, reason: 'AUTHORITY_MALFORMED' };
  }

  const leftLive = liveGrants(authority.left, authority.scope, authority.now);
  const rightLive = liveGrants(authority.right, authority.scope, authority.now);
  const evidence = [...history.evidence, {
    scope: authority.scope,
    left_live_grants: leftLive.map((grant) => grant.grant_id).sort(),
    right_live_grants: rightLive.map((grant) => grant.grant_id).sort(),
  }];

  if (leftLive.length && !rightLive.length) {
    return { verdict: 'CHOOSE_LEFT', reason: 'SOLE_CURRENT_SCOPED_AUTHORITY', evidence };
  }
  if (rightLive.length && !leftLive.length) {
    return { verdict: 'CHOOSE_RIGHT', reason: 'SOLE_CURRENT_SCOPED_AUTHORITY', evidence };
  }
  if (leftLive.length && rightLive.length) {
    return { verdict: 'REFUSE', reason: 'AUTHORITY_CONFLICT', evidence };
  }
  return { verdict: 'REFUSE', reason: 'DIVERGED', evidence };
}

module.exports = { compareTails, inspectTail, liveGrants, recordBytes, recordDigest, resolveWithAuthority };