import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { compareCorpora } from '../core.js';
import { buildReport, renderHtml } from '../report.js';

const expected = (problems = [], flags = []) => ({ ok: problems.length === 0, kind: 'receipt', version: '0.3', problems, flags });
async function pair(dir, id, record, verdict) {
  await writeFile(join(dir, `${id}.rcr`), record);
  await writeFile(join(dir, `${id}.json`), JSON.stringify(verdict));
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'verdict-drift-'));
  const baseline = join(root, 'baseline');
  const candidate = join(root, 'candidate');
  await Promise.all([mkdir(baseline), mkdir(candidate)]);
  await pair(baseline, 'unchanged', 'A', expected());
  await pair(candidate, 'unchanged', 'A', expected());
  await pair(baseline, 'removed', 'B', expected());
  await pair(candidate, 'added', 'C', expected());
  await pair(baseline, 'expectation', 'D', expected([{ field: 'RUN', code: 'illegal_pair' }, { field: 'RUN', code: 'illegal_pair' }], ['review']));
  await pair(candidate, 'expectation', 'D', expected([{ field: 'RUN', code: 'new_rule' }], ['review']));
  await pair(baseline, 'record-only', 'E-before', expected());
  await pair(candidate, 'record-only', 'E-after', expected());
  await writeFile(join(candidate, 'broken.rcr'), 'F');
  return { root, baseline, candidate };
}

test('classifies a bounded synthetic drift corpus', async () => {
  const { baseline, candidate } = await fixture();
  const report = await compareCorpora(baseline, candidate);
  assert.deepEqual(report.summary, { added: 1, removed: 1, expectation_changed: 1, record_only_changed: 1, malformed: 1, unchanged: 1 });
  assert.equal(report.changes.expectation_changed[0].change, 'DIAGNOSTIC_ONLY');
});

test('problem ordering and duplication are insignificant', async () => {
  const root = await mkdtemp(join(tmpdir(), 'verdict-order-'));
  const a = join(root, 'a'); const b = join(root, 'b');
  await Promise.all([mkdir(a), mkdir(b)]);
  const x = { field: 'A', code: 'x' }; const y = { field: 'B', code: 'y' };
  await pair(a, 'case', 'same', expected([x, y, x], ['z', 'a', 'z']));
  await pair(b, 'case', 'same', expected([y, x], ['a', 'z']));
  const report = await compareCorpora(a, b);
  assert.deepEqual(report.summary, { added: 0, removed: 0, expectation_changed: 0, record_only_changed: 0, malformed: 0, unchanged: 1 });
});

test('writes byte-identical JSON and HTML names every affected case', async () => {
  const { root, baseline, candidate } = await fixture();
  const outA = join(root, 'out-a'); const outB = join(root, 'out-b');
  await buildReport(baseline, candidate, outA, { baseline_ref: 'A', candidate_ref: 'B' });
  await buildReport(baseline, candidate, outB, { baseline_ref: 'A', candidate_ref: 'B' });
  const [jsonA, jsonB, html] = await Promise.all([
    readFile(join(outA, 'drift.json')), readFile(join(outB, 'drift.json')), readFile(join(outA, 'drift.html'), 'utf8'),
  ]);
  assert.deepEqual(jsonA, jsonB);
  for (const id of ['added', 'removed', 'expectation', 'record-only', 'broken']) assert.match(html, new RegExp(id));
});

test('escapes case names from untrusted corpora in HTML', () => {
  const html = renderHtml({
    provenance: { baseline_ref: '<baseline>', candidate_ref: 'candidate' },
    summary: { added: 1, removed: 0, expectation_changed: 0, record_only_changed: 0, malformed: 0 },
    changes: { added: [{ case_id: '<img src=x onerror=alert(1)>' }], removed: [], expectation_changed: [], record_only_changed: [], malformed: [] },
    claim_boundary: '<boundary>',
  });
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x/);
  assert.match(html, /&lt;baseline&gt;/);
});

test('does not execute record contents', async () => {
  const root = await mkdtemp(join(tmpdir(), 'verdict-data-'));
  const a = join(root, 'a'); const b = join(root, 'b');
  await Promise.all([mkdir(a), mkdir(b)]);
  const marker = join(root, 'must-not-exist');
  const hostileLookingData = `__import__('pathlib').Path('${marker}').write_text('bad')`;
  await pair(a, 'opaque', hostileLookingData, expected());
  await pair(b, 'opaque', hostileLookingData, expected());
  await compareCorpora(a, b);
  await assert.rejects(readFile(marker), { code: 'ENOENT' });
});
