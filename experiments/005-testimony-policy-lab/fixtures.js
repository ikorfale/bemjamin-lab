'use strict';
const { generateKeyPairSync } = require('node:crypto');
const { signObservation, comparePolicies } = require('./core');

function makeLab() {
  const privateKeys = {};
  const allowlist = {};
  for (const id of ['ada', 'bert', 'cy']) {
    const pair = generateKeyPairSync('ed25519');
    privateKeys[id] = pair.privateKey;
    allowlist[id] = pair.publicKey.export({ type: 'spki', format: 'pem' });
  }
  const base = {
    v: 1,
    observed_at: '2026-09-09T10:00:00.000Z',
    expires_at: '2026-09-09T11:00:00.000Z',
    checkpoint: 'plan-b:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  };
  function testimony(observer_id, node_id, status, seq, patch = {}) {
    const observation = { ...base, node_id, status, observer_id, seq, ...patch };
    return { observation, signature: signObservation(observation, privateKeys[observer_id]) };
  }
  return { privateKeys, allowlist, base, testimony };
}

function policyForkFixture() {
  const lab = makeLab();
  const observations = [
    lab.testimony('ada', 'node-0', 'UP', 7),
    lab.testimony('bert', 'node-0', 'UP', 11),
    lab.testimony('cy', 'node-0', 'DOWN', 3),
    lab.testimony('ada', 'mirror-a', 'UP', 8),
    lab.testimony('bert', 'mirror-a', 'UP', 12)
  ];
  const input = {
    now: '2026-09-09T10:30:00.000Z',
    checkpoint: lab.base.checkpoint,
    quorum: 2,
    catalog: [{ id: 'node-0' }, { id: 'mirror-a' }],
    observations,
    allowlist: lab.allowlist,
    lastSeen: {}
  };
  return { lab, input, expected: comparePolicies(input) };
}

module.exports = { makeLab, policyForkFixture };
