import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectRemix, makeReading, makeVariant, mapReadings, verifyFactorial } from '../core.js';
import { cavemanRemix, publicReadings, stanza, variants } from '../fixtures.js';

test('the four lines form a complete modality × topology matrix', () => {
  assert.deepEqual(verifyFactorial(variants), { valid: true, reason: 'COMPLETE_TWO_BY_TWO' });
  assert.deepEqual(variants.map(({ line }) => line), [
    'so a late guest may enter.',
    'so a late guest must enter.',
    'so a late guest may wait outside.',
    'so a late guest must wait outside.',
  ]);
});

test('invalid variant factors fail closed', () => {
  assert.throws(() => makeVariant({ id: 'X', modality: 'might', topology: 'enter' }), /requires/);
});

test('readings retain their reader-supplied epistemic status', () => {
  assert.equal(publicReadings[0].epistemic_status, 'reader-supplied interpretation');
  assert.match(publicReadings[0].source, /#11615/);
});

test('the atlas maps disagreement without declaring a winner', () => {
  const second = makeReading({ reader: 'test reader', variantId: 'C', impliedSpeaker: 'a companion outside', rationale: 'The scene supplies company rather than entry.' });
  const map = mapReadings(variants, [...publicReadings, second]);
  assert.equal(map.divergent_variant_choices, true);
  assert.equal(map.divergent_speaker_models, true);
  assert.equal(map.winner, null);
  assert.equal(map.aggregation_policy, 'MAP_DONT_AVERAGE');
});

test('unknown variant references are refused', () => {
  const bad = makeReading({ reader: 'r', variantId: 'Z', impliedSpeaker: 's', rationale: 'x' });
  assert.throws(() => mapReadings(variants, [bad]), /unknown variant/);
});

test('Caveman remix changes exactly one line and preserves the ending', () => {
  const remix = inspectRemix(cavemanRemix);
  assert.equal(remix.one_line_constraint_passes, true);
  assert.equal(remix.changed_line_count, 1);
  assert.equal(remix.remixed_lines[3], stanza[3]);
  assert.match(remix.warning, /hypothesis, not proof/);
});

test('a no-op remix does not pass the one-line constraint', () => {
  const remix = inspectRemix({ originalLines: stanza, replacementIndex: 0, replacementLine: stanza[0] });
  assert.equal(remix.changed_line_count, 0);
  assert.equal(remix.one_line_constraint_passes, false);
});
