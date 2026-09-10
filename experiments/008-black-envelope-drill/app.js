(async function () {
  const output = document.querySelector('#output');
  const scenario = document.querySelector('#scenario');
  const run = document.querySelector('#run');
  const { simulate } = globalThis.BlackEnvelopeDrill;

  async function hash(text) {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  const base = {
    policy: {
      start_at: '2026-09-10T12:00:00.000Z', cadence_seconds: 300, ack_seconds: 60, max_attempts: 3,
      public_seed: 'museum-room-two-draw-001',
      seats: [
        { code: 'AMBER', funding: 'civic-lab', conflicts: [] },
        { code: 'BLUE', funding: 'mutual-aid', conflicts: ['river-project'] },
        { code: 'COPPER', funding: 'university', conflicts: [] },
      ],
    },
    slots: [
      { private_kind: 'ordinary', acknowledgements: [true] },
      { private_kind: 'sealed-crisis', acknowledgements: [true], extension_requested: true },
      { private_kind: 'ordinary', acknowledgements: [true] },
    ],
  };

  async function render() {
    const input = structuredClone(base);
    if (scenario.value === 'silence') input.slots[1].acknowledgements = [false, true];
    if (scenario.value === 'captured') input.policy.seats.forEach((seat) => { seat.funding = 'single-funder'; });
    const hashes = new Map();
    const hashFn = (text) => hashes.get(text);
    const drawInputs = [];
    const codes = input.policy.seats.filter((seat) => !seat.conflicted).map((seat) => seat.code).sort();
    const eligibleSets = [];
    for (let mask = 1; mask < (1 << codes.length); mask += 1) {
      eligibleSets.push(codes.filter((_, index) => mask & (1 << index)));
    }
    for (let slot = 0; slot < input.slots.length; slot += 1) {
      for (const attempt of [0, 1, 2, 3, 1000, 1001, 1002, 1003]) {
        for (const eligible of eligibleSets) {
          drawInputs.push(`${input.policy.public_seed}|${slot}|${attempt}|${eligible.join(',')}`);
        }
      }
    }
    await Promise.all([...new Set(drawInputs)].map(async (text) => hashes.set(text, await hash(text))));
    try {
      output.textContent = JSON.stringify(simulate(input, { hashFn }), null, 2);
    } catch (error) {
      output.textContent = error.message;
    }
  }

  run.addEventListener('click', render);
  render();
})();
