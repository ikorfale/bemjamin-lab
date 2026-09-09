'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { comparePolicies } = require('../core');
const { makeLab } = require('../fixtures');
const { assessCatalog } = require('../explorer-model');

const observerIds = ['ada', 'bert', 'cy'];

function decodeStates(number, width) {
  const states = [];
  for (let index = 0; index < width; index += 1) {
    states.push(['OFF', 'UP', 'DOWN'][number % 3]);
    number = Math.floor(number / 3);
  }
  return states;
}

test('explorer model matches the signed verifier across every two-node testimony matrix', () => {
  const lab = makeLab();
  const ids = ['node-0', 'mirror-a'];
  const variants = new Map();
  for (const [nodeIndex, nodeId] of ids.entries()) {
    for (const [observerIndex, observerId] of observerIds.entries()) {
      for (const status of ['UP', 'DOWN']) {
        const key = `${nodeId}:${observerId}:${status}`;
        variants.set(key, lab.testimony(observerId, nodeId, status, 1 + nodeIndex * 10 + observerIndex));
      }
    }
  }

  let cases = 0;
  for (let encoded = 0; encoded < 3 ** 6; encoded += 1) {
    const states = decodeStates(encoded, 6);
    const catalog = ids.map((id, nodeIndex) => ({
      id,
      observers: Object.fromEntries(observerIds.map((observerId, observerIndex) => [observerId, states[nodeIndex * 3 + observerIndex]]))
    }));
    const observations = catalog.flatMap((node) => Object.entries(node.observers)
      .filter(([, status]) => status !== 'OFF')
      .map(([observerId, status]) => variants.get(`${node.id}:${observerId}:${status}`)));

    for (const quorum of [1, 2, 3]) {
      const visual = assessCatalog(catalog, quorum);
      const signed = comparePolicies({
        now: '2026-09-09T10:30:00.000Z', checkpoint: lab.base.checkpoint,
        catalog: ids.map((id) => ({ id })), observations, allowlist: lab.allowlist, quorum
      });
      assert.deepEqual(visual.policies, signed.policies);
      assert.deepEqual(
        visual.nodes,
        signed.nodes.map(({ node_id, up, down, eligible, reasons }) => ({ node_id, up, down, eligible, reasons }))
      );
      cases += 1;
    }
  }
  assert.equal(cases, 2187);
});

test('explorer page preserves its claim boundary and basic accessibility hooks', () => {
  const html = readFileSync(require.resolve('../explorer.html'), 'utf8');
  assert.match(html, /already-authenticated inputs/i);
  assert.match(html, /does not verify signatures/i);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /class="skip" href="#main"/);
  assert.match(html, /aria-live="polite"/);
});
