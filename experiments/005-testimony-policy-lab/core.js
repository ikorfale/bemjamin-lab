'use strict';

const { createPublicKey, sign, verify } = require('node:crypto');

const OBSERVATION_FIELDS = [
  'v', 'node_id', 'status', 'observed_at', 'expires_at',
  'checkpoint', 'observer_id', 'seq'
];

function canonicalObservation(observation) {
  const exact = {};
  for (const field of OBSERVATION_FIELDS) exact[field] = observation[field];
  return Buffer.from(JSON.stringify(exact), 'utf8');
}

function signObservation(observation, privateKey) {
  return sign(null, canonicalObservation(observation), privateKey).toString('base64');
}

function strictInstant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) return null;
  return milliseconds;
}

function verifyObservation(signed, context) {
  const reasons = [];
  const observation = signed?.observation;
  if (!observation || typeof observation !== 'object') return { ok: false, reasons: ['MALFORMED'] };

  if (observation.v !== 1 || !['UP', 'DOWN'].includes(observation.status) ||
      !Number.isSafeInteger(observation.seq) || observation.seq < 0) reasons.push('MALFORMED');
  if (observation.node_id !== context.nodeId) reasons.push('NODE_MISMATCH');
  if (observation.checkpoint !== context.checkpoint) reasons.push('CHECKPOINT_MISMATCH');

  const observedAt = strictInstant(observation.observed_at);
  const expiresAt = strictInstant(observation.expires_at);
  const now = strictInstant(context.now);
  if (observedAt === null || expiresAt === null || now === null || observedAt > expiresAt) {
    reasons.push('MALFORMED_TIME');
  } else if (now < observedAt || now > expiresAt) {
    reasons.push('EXPIRED');
  }

  const publicKey = context.allowlist[observation.observer_id];
  if (!publicKey) {
    reasons.push('UNTRUSTED_OBSERVER');
  } else {
    let signatureValid = false;
    try {
      signatureValid = verify(null, canonicalObservation(observation), createPublicKey(publicKey), Buffer.from(signed.signature, 'base64'));
    } catch {}
    if (!signatureValid) reasons.push('SIGNATURE');
  }

  const lastSeen = context.lastSeen[observation.observer_id];
  if (Number.isSafeInteger(lastSeen) && observation.seq <= lastSeen) reasons.push('REPLAY');
  return { ok: reasons.length === 0, reasons };
}

function assessNode(node, signedObservations, context) {
  const accepted = [];
  const rejected = [];
  const byObserver = {};

  for (const signed of signedObservations.filter((item) => item?.observation?.node_id === node.id)) {
    const finding = verifyObservation(signed, { ...context, nodeId: node.id });
    const observerId = signed?.observation?.observer_id;
    if (!finding.ok) {
      rejected.push({ observer_id: observerId || null, reasons: finding.reasons });
      continue;
    }
    (byObserver[observerId] ||= []).push(signed);
  }

  for (const [observerId, candidates] of Object.entries(byObserver)) {
    const bySequence = new Map();
    for (const signed of candidates) {
      const seq = signed.observation.seq;
      const canonical = canonicalObservation(signed.observation).toString('base64');
      const variants = bySequence.get(seq) || new Set();
      variants.add(canonical);
      bySequence.set(seq, variants);
    }
    if ([...bySequence.values()].some((variants) => variants.size > 1)) {
      rejected.push({ observer_id: observerId, reasons: ['EQUIVOCATION'] });
      continue;
    }
    const highestSequence = Math.max(...candidates.map((item) => item.observation.seq));
    accepted.push(candidates.find((item) => item.observation.seq === highestSequence));
  }

  const up = accepted.filter((item) => item.observation.status === 'UP').map((item) => item.observation.observer_id).sort();
  const down = accepted.filter((item) => item.observation.status === 'DOWN').map((item) => item.observation.observer_id).sort();
  const reasons = [];
  if (up.length && down.length) reasons.push('CONFLICT');
  else if (down.length) reasons.push('AUTHENTICATED_DOWN');
  if (up.length < context.quorum) reasons.push('INSUFFICIENT_QUORUM');
  return { node_id: node.id, up, down, accepted: up.length + down.length, rejected, eligible: reasons.length === 0, reasons };
}

function comparePolicies(input) {
  const quorum = input.quorum === undefined ? 2 : input.quorum;
  const observerCount = Object.keys(input.allowlist || {}).length;
  if (!Number.isSafeInteger(quorum) || quorum < 1 || quorum > observerCount) {
    throw new RangeError('quorum must be a positive safe integer no greater than the allowlisted observer count');
  }
  const context = {
    now: input.now,
    checkpoint: input.checkpoint,
    allowlist: input.allowlist,
    lastSeen: input.lastSeen || {},
    quorum
  };
  const nodes = input.catalog.map((node) => assessNode(node, input.observations, context));
  const firstConflict = nodes.find((node) => node.reasons.includes('CONFLICT'));
  const firstEligible = nodes.find((node) => node.eligible);
  return {
    nodes,
    policies: {
      FAIL_CLOSED_ON_CONFLICT: {
        selected: firstConflict ? null : (firstEligible?.node_id || null),
        reason: firstConflict ? `CONFLICT:${firstConflict.node_id}` : (firstEligible ? 'QUORUM' : 'NO_ELIGIBLE_NODE')
      },
      SKIP_CONFLICTED_NODE: {
        selected: firstEligible?.node_id || null,
        reason: firstEligible ? 'QUORUM' : 'NO_ELIGIBLE_NODE'
      }
    }
  };
}

module.exports = { canonicalObservation, signObservation, strictInstant, verifyObservation, assessNode, comparePolicies };
