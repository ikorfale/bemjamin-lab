import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCanary, graphemeBoundaries, normalizeManifestText, utf8Bytes } from '../core.js';
import { fixtures } from '../fixtures.js';

test('manifest normalization collapses whitespace runs exactly once', () => {
  assert.equal(normalizeManifestText('  alpha\n\tbeta  '), 'alpha beta');
});

test('every fixture stays strictly under the declared per-chunk byte ceiling', () => {
  for (const fixture of fixtures) {
    for (const chunk of fixture.chunks) assert.ok(utf8Bytes(chunk) < 1200, fixture.id);
  }
});

test('a removed whitespace delimiter is restored by join-one-space', () => {
  const result = evaluateCanary(fixtures[0]);
  assert.equal(result.decision, 'PASS');
  assert.equal(result.join_one_space_matches, true);
  assert.equal(result.concatenate_matches, false);
});

test('a base/combining-mark split is inside one grapheme and must refuse', () => {
  const result = evaluateCanary(fixtures[1]);
  assert.equal(result.split.split_inside_grapheme, true);
  assert.equal(result.join_one_space_matches, false);
  assert.equal(result.concatenate_matches, true);
  assert.deepEqual(
    { decision: result.decision, reason: result.reason },
    fixtures[1].expected,
  );
});

test('a ZWJ sequence split is inside one grapheme and must refuse', () => {
  const result = evaluateCanary(fixtures[2]);
  assert.equal(result.split.split_inside_grapheme, true);
  assert.equal(result.join_one_space_matches, false);
  assert.equal(result.concatenate_matches, true);
});

test('a plain non-whitespace split also changes the normalized payload', () => {
  const result = evaluateCanary(fixtures[3]);
  assert.equal(result.split.split_inside_grapheme, false);
  assert.equal(result.reason, 'SPACE_INSERTED_AT_NON_WHITESPACE_BOUNDARY');
  assert.equal(result.join_one_space_matches, false);
  assert.equal(result.concatenate_matches, true);
});

test('reported fixture decisions remain pinned', () => {
  for (const fixture of fixtures) {
    const result = evaluateCanary(fixture);
    assert.deepEqual(
      { decision: result.decision, reason: result.reason },
      fixture.expected,
      fixture.id,
    );
  }
});

test('grapheme boundaries do not include the base/combining split', () => {
  const value = 'e\u0301';
  assert.equal(graphemeBoundaries(value).has(1), false);
  assert.equal(graphemeBoundaries(value).has(2), true);
});

test('malformed fixture reconstruction fails closed', () => {
  assert.throws(
    () => evaluateCanary({ id: 'bad', original: 'abc', chunks: ['a', 'x'], omitted: '' }),
    /do not reconstruct/,
  );
});
