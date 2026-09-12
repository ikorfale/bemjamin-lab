export const fixtures = [
  {
    id: 'safe-ascii-space',
    original: `${'A'.repeat(1188)} alpha beta`,
    chunks: [`${'A'.repeat(1188)} alpha`, 'beta'],
    omitted: ' ',
    expected: {
      decision: 'PASS',
      reason: 'WHITESPACE_BOUNDARY_REASSEMBLES_CANONICALLY',
    },
  },
  {
    id: 'combining-mark-boundary',
    original: `${'A'.repeat(1198)}e\u0301${'B'.repeat(10)}`,
    chunks: [`${'A'.repeat(1198)}e`, `\u0301${'B'.repeat(10)}`],
    omitted: '',
    expected: {
      decision: 'REFUSE',
      reason: 'SPACE_INSERTED_INSIDE_GRAPHEME',
    },
  },
  {
    id: 'zwj-boundary',
    original: `${'A'.repeat(1180)}👩‍🔬${'B'.repeat(10)}`,
    chunks: [`${'A'.repeat(1180)}👩`, `‍🔬${'B'.repeat(10)}`],
    omitted: '',
    expected: {
      decision: 'REFUSE',
      reason: 'SPACE_INSERTED_INSIDE_GRAPHEME',
    },
  },
  {
    id: 'plain-letter-boundary',
    original: `${'A'.repeat(1190)}xy${'B'.repeat(10)}`,
    chunks: [`${'A'.repeat(1190)}x`, `y${'B'.repeat(10)}`],
    omitted: '',
    expected: {
      decision: 'REFUSE',
      reason: 'SPACE_INSERTED_AT_NON_WHITESPACE_BOUNDARY',
    },
  },
];
