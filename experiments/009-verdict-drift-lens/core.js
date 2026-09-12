import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const stable = (value) => JSON.stringify(value);

function normalizeExpected(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected JSON object');
  const problems = Array.isArray(value.problems) ? value.problems : [];
  const flags = Array.isArray(value.flags) ? value.flags : [];
  return {
    ok: Boolean(value.ok),
    kind: value.kind ?? null,
    version: value.version ?? null,
    problems: [...new Set(problems.map((item) => `${item?.field ?? ''}\u0000${item?.code ?? ''}`))].sort(),
    flags: [...new Set(flags.map(String))].sort(),
  };
}

async function inspectCorpus(directory) {
  const names = await readdir(directory);
  const ids = [...new Set(names.filter((name) => name.endsWith('.rcr') || name.endsWith('.json'))
    .map((name) => basename(name, name.endsWith('.rcr') ? '.rcr' : '.json')))].sort();
  const cases = new Map();
  const malformed = [];

  for (const id of ids) {
    const recordName = `${id}.rcr`;
    const expectedName = `${id}.json`;
    if (!names.includes(recordName) || !names.includes(expectedName)) {
      malformed.push({ case_id: id, reason: 'MISSING_PAIR', missing: names.includes(recordName) ? expectedName : recordName });
      continue;
    }
    try {
      const [record, expectedBytes] = await Promise.all([
        readFile(join(directory, recordName)),
        readFile(join(directory, expectedName)),
      ]);
      const expected = normalizeExpected(JSON.parse(expectedBytes.toString('utf8')));
      cases.set(id, { record_sha256: digest(record), expected });
    } catch (error) {
      malformed.push({ case_id: id, reason: 'INVALID_PAIR', message: error.message });
    }
  }
  return { cases, malformed };
}

function expectationChange(before, after) {
  const changed = [];
  for (const field of ['ok', 'kind', 'version', 'problems', 'flags']) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) changed.push(field);
  }
  if (changed.length === 1 && changed[0] === 'problems') return 'DIAGNOSTIC_ONLY';
  if (changed.length === 1 && changed[0] === 'flags') return 'FLAG_ONLY';
  return 'SEMANTIC';
}

export async function compareCorpora(baselineDirectory, candidateDirectory, provenance = {}) {
  const [baseline, candidate] = await Promise.all([
    inspectCorpus(baselineDirectory),
    inspectCorpus(candidateDirectory),
  ]);
  const baselineIds = [...baseline.cases.keys()];
  const candidateIds = [...candidate.cases.keys()];
  const malformed = [
    ...baseline.malformed.map((item) => ({ side: 'baseline', ...item })),
    ...candidate.malformed.map((item) => ({ side: 'candidate', ...item })),
  ].sort((a, b) => `${a.case_id}:${a.side}`.localeCompare(`${b.case_id}:${b.side}`));
  const malformedIds = new Set(malformed.map((item) => item.case_id));
  const removed = baselineIds.filter((id) => !candidate.cases.has(id) && !malformedIds.has(id)).map((case_id) => ({ case_id }));
  const added = candidateIds.filter((id) => !baseline.cases.has(id) && !malformedIds.has(id)).map((case_id) => ({ case_id }));
  const expectationChanged = [];
  const recordOnlyChanged = [];
  const unchanged = [];

  for (const id of baselineIds.filter((caseId) => candidate.cases.has(caseId)).sort()) {
    const before = baseline.cases.get(id);
    const after = candidate.cases.get(id);
    if (stable(before.expected) !== stable(after.expected)) {
      expectationChanged.push({ case_id: id, change: expectationChange(before.expected, after.expected), baseline: before.expected, candidate: after.expected });
    } else if (before.record_sha256 !== after.record_sha256) {
      recordOnlyChanged.push({ case_id: id, baseline_sha256: before.record_sha256, candidate_sha256: after.record_sha256 });
    } else {
      unchanged.push({ case_id: id });
    }
  }

  return {
    schema: 'verdict-drift/v1',
    provenance: {
      target: provenance.target ?? null,
      baseline_ref: provenance.baseline_ref ?? null,
      candidate_ref: provenance.candidate_ref ?? null,
    },
    summary: {
      added: added.length,
      removed: removed.length,
      expectation_changed: expectationChanged.length,
      record_only_changed: recordOnlyChanged.length,
      malformed: malformed.length,
      unchanged: unchanged.length,
    },
    changes: { added, removed, expectation_changed: expectationChanged, record_only_changed: recordOnlyChanged, malformed, unchanged },
    claim_boundary: 'Compares corpus bytes and expected JSON only; it does not execute records, run a checker, authenticate refs, or prove a specification correct.',
  };
}
