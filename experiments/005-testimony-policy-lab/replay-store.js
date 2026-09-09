'use strict';

const { openSync, readFileSync, renameSync, unlinkSync, writeFileSync, fsyncSync, closeSync } = require('node:fs');
const { dirname, basename, join } = require('node:path');
const { verifyObservation } = require('./core');

function loadLastSeen(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError('replay state must be an object');
    for (const [observerId, seq] of Object.entries(parsed)) {
      if (!observerId || !Number.isSafeInteger(seq) || seq < 0) throw new TypeError('replay state contains an invalid sequence');
    }
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

function persistLastSeen(path, state) {
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  const directory = openSync(dirname(path), 'r');
  try {
    writeFileSync(temporary, `${JSON.stringify(state)}\n`, { encoding: 'utf8', mode: 0o600 });
    const file = openSync(temporary, 'r');
    try { fsyncSync(file); } finally { closeSync(file); }
    renameSync(temporary, path);
    fsyncSync(directory);
  } catch (error) {
    try { unlinkSync(temporary); } catch {}
    throw error;
  } finally {
    closeSync(directory);
  }
}

function verifyAndAdvance(signed, context, path) {
  const lastSeen = loadLastSeen(path);
  const finding = verifyObservation(signed, { ...context, lastSeen });
  if (!finding.ok) return { ...finding, lastSeen };

  const { observer_id: observerId, seq } = signed.observation;
  const next = { ...lastSeen, [observerId]: seq };
  persistLastSeen(path, next);
  return { ...finding, lastSeen: next };
}

module.exports = { loadLastSeen, persistLastSeen, verifyAndAdvance };
