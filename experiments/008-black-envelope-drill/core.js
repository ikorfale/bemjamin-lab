(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BlackEnvelopeDrill = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const crypto = typeof require === 'function' ? require('node:crypto') : null;

  function sha256(text) {
    if (!crypto) throw new Error('SHA-256 is injected by the browser app');
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function assertIso(value, label) {
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)) {
      throw new Error(`${label} must be canonical UTC milliseconds`);
    }
    const time = Date.parse(value);
    if (!Number.isFinite(time) || new Date(time).toISOString() !== value) throw new Error(`${label} is not a real instant`);
    return time;
  }

  function validatePolicy(policy) {
    if (!policy || typeof policy !== 'object') throw new Error('policy is required');
    assertIso(policy.start_at, 'start_at');
    for (const key of ['cadence_seconds', 'ack_seconds', 'max_attempts']) {
      if (!Number.isInteger(policy[key]) || policy[key] < 1) throw new Error(`${key} must be a positive integer`);
    }
    if (typeof policy.public_seed !== 'string' || !policy.public_seed) throw new Error('public_seed is required');
    if (!Array.isArray(policy.seats) || policy.seats.length < 1) throw new Error('at least one seat is required');
    const codes = new Set();
    for (const seat of policy.seats) {
      if (!seat || typeof seat.code !== 'string' || !seat.code) throw new Error('every seat needs a code');
      if (codes.has(seat.code)) throw new Error(`duplicate seat code ${seat.code}`);
      codes.add(seat.code);
      if (typeof seat.funding !== 'string' || !seat.funding) throw new Error(`seat ${seat.code} must disclose funding`);
      if (!Array.isArray(seat.conflicts)) throw new Error(`seat ${seat.code} must disclose conflicts`);
    }
  }

  function digestHex(text, hashFn) {
    return (hashFn || sha256)(text);
  }

  function drawSeat(policy, slot, attempt, exclusions = {}, hashFn) {
    const excludedCodes = new Set(exclusions.codes || []);
    const excludedFunding = new Set(exclusions.funding || []);
    const eligible = policy.seats
      .filter((seat) => !seat.conflicted && !excludedCodes.has(seat.code) && !excludedFunding.has(seat.funding))
      .sort((a, b) => a.code.localeCompare(b.code));
    if (!eligible.length) return null;
    const digest = digestHex(`${policy.public_seed}|${slot}|${attempt}|${eligible.map((seat) => seat.code).join(',')}`, hashFn);
    const index = Number(BigInt(`0x${digest.slice(0, 13)}`) % BigInt(eligible.length));
    return eligible[index];
  }

  function publicShape(receipt) {
    return Object.keys(receipt).sort().join('|');
  }

  function assessLegacyCommitment(input) {
    validatePolicy(input.policy);
    if (!Array.isArray(input.slots) || !input.slots.length) throw new Error('at least one slot is required');
    const enumerableKinds = new Set(['ordinary', 'sealed-crisis']);
    const lowEntropy = input.slots.every((slot) => slot && enumerableKinds.has(slot.private_kind)
      && typeof (slot.private_note || '') === 'string');
    return lowEntropy
      ? { decision: 'REFUSE', reason: 'LOW_ENTROPY_COMMITMENT_LEAKS_PRIVATE_KIND' }
      : { decision: 'OUT_OF_SCOPE', reason: 'LEGACY_PAYLOAD_NOT_ENUMERABLE' };
  }

  function simulate(input, options = {}) {
    validatePolicy(input.policy);
    if (!Array.isArray(input.slots) || !input.slots.length) throw new Error('at least one slot is required');
    const policy = input.policy;
    const start = assertIso(policy.start_at, 'start_at');
    const hashFn = options.hashFn;
    const receipts = [];
    const decisions = [];
    const envelopeShapes = new Set();

    input.slots.forEach((slot, index) => {
      if (!slot || !['ordinary', 'sealed-crisis'].includes(slot.private_kind)) throw new Error(`slot ${index} has invalid private_kind`);
      const scheduled = new Date(start + index * policy.cadence_seconds * 1000).toISOString();
      let seat = drawSeat(policy, index, 0, {}, hashFn);
      if (!seat) throw new Error(`slot ${index} has no eligible reviewer`);
      const envelope = {
        kind: 'ENVELOPE',
        slot: index,
        scheduled_at: scheduled,
        seat_code: seat.code,
        ack_deadline: new Date(Date.parse(scheduled) + policy.ack_seconds * 1000).toISOString(),
      };
      receipts.push(envelope);
      envelopeShapes.add(publicShape(envelope));

      const acknowledgements = Array.isArray(slot.acknowledgements) ? slot.acknowledgements : [true];
      let acknowledged = false;
      let attempt = 0;
      const tried = new Set();
      while (seat && attempt < policy.max_attempts) {
        tried.add(seat.code);
        if (acknowledgements[attempt] === true) {
          receipts.push({ kind: 'ACK', slot: index, attempt, seat_code: seat.code });
          acknowledged = true;
          break;
        }
        const next = drawSeat(policy, index, attempt + 1, { codes: [...tried] }, hashFn);
        receipts.push({
          kind: 'RED_SEAL', slot: index, attempt, seat_code: seat.code,
          elapsed_seconds: policy.ack_seconds, next_seat_code: next ? next.code : null,
        });
        seat = next;
        attempt += 1;
      }

      if (!acknowledged) {
        decisions.push({ slot: index, decision: 'REFUSE', reason: seat ? 'MAX_ATTEMPTS' : 'POOL_EXHAUSTED' });
        return;
      }

      if (slot.extension_requested) {
        const first = seat;
        const second = drawSeat(policy, index, attempt + 1000, { codes: [first.code], funding: [first.funding] }, hashFn);
        if (!second) {
          decisions.push({ slot: index, decision: 'REFUSE_EXTENSION', reason: 'NO_INDEPENDENT_SECOND_KEY', first_seat: first.code });
        } else {
          decisions.push({ slot: index, decision: 'ALLOW_EXTENSION', first_seat: first.code, second_seat: second.code });
          receipts.push({ kind: 'SECOND_KEY', slot: index, first_seat: first.code, second_seat: second.code });
        }
      } else {
        decisions.push({ slot: index, decision: 'REVIEW_OPEN', seat_code: seat.code });
      }
    });

    return {
      public_receipts: receipts,
      decisions,
      cadence_check: {
        complete: input.slots.length > 1,
        envelope_count: input.slots.length,
        one_shape: envelopeShapes.size === 1,
        exposes_private_kind: receipts.some((receipt) => Object.hasOwn(receipt, 'private_kind')),
      },
    };
  }

  return { assessLegacyCommitment, drawSeat, publicShape, simulate, stable, validatePolicy };
});
