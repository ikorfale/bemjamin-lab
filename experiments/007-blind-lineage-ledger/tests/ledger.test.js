import assert from 'node:assert/strict';
import test from 'node:test';
import { manifestDigest, scoreLedger } from '../core.js';
import { manifest, reviews } from '../fixtures.js';

test('digest is stable across object key order', () => {
  const reordered = { edges: manifest.edges, arm_labels_hidden: true, artifact_id: manifest.artifact_id, schema: manifest.schema };
  assert.equal(manifestDigest(reordered), manifestDigest(manifest));
});

test('fixture preserves counts and visible disagreement', () => {
  const report = scoreLedger(manifest, reviews);
  assert.deepEqual(report.edge_label_counts, { necessary: 4, supporting: 1, decorative: 1 });
  assert.deepEqual(report.defect_label_counts, { preserved: 1, transformed: 2, ignored: 1, none: 2 });
  assert.equal(report.pairwise_edge_agreement, 0.667);
  assert.deepEqual(report.disagreements, ['elevator-direction']);
  assert.equal(report.edges[0].edge_consensus, 'DISAGREEMENT');
  assert.equal(report.edges[1].edge_consensus, 'necessary');
});

test('mismatched manifest commitment is refused', () => {
  const altered = structuredClone(reviews);
  altered[0].manifest_sha256 = '0'.repeat(64);
  assert.throws(() => scoreLedger(manifest, altered), /digest mismatch/);
});

test('each reviewer must label every edge exactly once', () => {
  const incomplete = structuredClone(reviews);
  incomplete[1].ratings.pop();
  assert.throws(() => scoreLedger(manifest, incomplete), /cover each edge exactly once/);
});

test('revealed arm labels are refused during blind scoring', () => {
  assert.throws(() => manifestDigest({ ...manifest, arm_labels_hidden: false }), /must be true/);
});
