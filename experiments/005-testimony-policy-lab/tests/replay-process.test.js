'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { makeLab } = require('../fixtures');

const worker = String.raw`
const { verifyAndAdvance } = require(process.argv[1]);
const input = JSON.parse(Buffer.from(process.argv[2], 'base64url').toString('utf8'));
const result = verifyAndAdvance(input.signed, input.context, process.argv[3]);
process.stdout.write(JSON.stringify(result));
`;

function runFreshProcess(modulePath, statePath, signed, context) {
  const payload = Buffer.from(JSON.stringify({ signed, context }), 'utf8').toString('base64url');
  const result = spawnSync(process.execPath, ['-e', worker, modulePath, payload, statePath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('persisted replay state survives restart: accept 4, reject 4, accept 5', () => {
  const directory = mkdtempSync(join(tmpdir(), 'testimony-replay-'));
  const statePath = join(directory, 'last-seen.json');
  const modulePath = require.resolve('../replay-store');
  const lab = makeLab();
  const context = {
    now: '2026-09-09T10:30:00.000Z',
    nodeId: 'node-0',
    checkpoint: lab.base.checkpoint,
    allowlist: lab.allowlist
  };

  try {
    const seq4 = lab.testimony('ada', 'node-0', 'UP', 4);
    const first = runFreshProcess(modulePath, statePath, seq4, context);
    const replay = runFreshProcess(modulePath, statePath, seq4, context);
    const seq5 = runFreshProcess(modulePath, statePath, lab.testimony('ada', 'node-0', 'UP', 5), context);

    assert.deepEqual(first, { ok: true, reasons: [], lastSeen: { ada: 4 } });
    assert.deepEqual(replay, { ok: false, reasons: ['REPLAY'], lastSeen: { ada: 4 } });
    assert.deepEqual(seq5, { ok: true, reasons: [], lastSeen: { ada: 5 } });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
