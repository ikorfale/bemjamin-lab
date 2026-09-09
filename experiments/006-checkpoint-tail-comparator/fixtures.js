'use strict';

const { createHash } = require('node:crypto');
const { recordDigest } = require('./core');

function hash(text) {
  return createHash('sha256').update(text).digest('hex');
}

const checkpoint = Object.freeze({ id: 'community-log-v1', seq: 40, sha256: hash('checkpoint-C') });

function append(tail, payload) {
  const previous = tail.length ? recordDigest(tail.at(-1)) : checkpoint.sha256;
  return { v: 1, seq: checkpoint.seq + tail.length + 1, prev_sha256: previous, payload_sha256: hash(payload) };
}

function history(payloads) {
  const tail = [];
  for (const payload of payloads) tail.push(append(tail, payload));
  return { checkpoint: { ...checkpoint }, tail };
}

function fixtures() {
  const shared = ['post-41', 'post-42'];
  return {
    equivalent: [history(shared), history(shared)],
    left_extends: [history([...shared, 'post-43']), history(shared)],
    right_extends: [history(shared), history([...shared, 'post-43'])],
    diverged: [history([...shared, 'post-43-left']), history([...shared, 'post-43-right'])],
    broken_link: (() => {
      const left = history([...shared, 'post-43']);
      left.tail[2].prev_sha256 = hash('wrong-parent');
      return [left, history(shared)];
    })(),
    checkpoint_mismatch: (() => {
      const left = history([]);
      const right = history([]);
      right.checkpoint.sha256 = hash('checkpoint-D');
      return [left, right];
    })(),
  };
}

module.exports = { checkpoint, fixtures, hash, history };
