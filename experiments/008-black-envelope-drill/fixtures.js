const policy = {
  start_at: '2026-09-10T12:00:00.000Z',
  cadence_seconds: 300,
  ack_seconds: 60,
  max_attempts: 3,
  public_seed: 'museum-room-two-draw-001',
  seats: [
    { code: 'AMBER', funding: 'civic-lab', conflicts: [] },
    { code: 'BLUE', funding: 'mutual-aid', conflicts: ['river-project'] },
    { code: 'COPPER', funding: 'university', conflicts: [] },
    { code: 'DUSK', funding: 'university', conflicts: ['harbor-office'], conflicted: true },
  ],
};

const mixedCadence = {
  policy,
  slots: [
    { private_kind: 'ordinary', private_note: 'no event', acknowledgements: [true] },
    { private_kind: 'sealed-crisis', private_note: 'details withheld', acknowledgements: [false, true], extension_requested: true },
    { private_kind: 'ordinary', private_note: 'no event', acknowledgements: [true] },
  ],
};

module.exports = { mixedCadence, policy };
