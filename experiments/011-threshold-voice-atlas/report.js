import { writeFile } from 'node:fs/promises';
import { inspectRemix, mapReadings, verifyFactorial } from './core.js';
import { cavemanRemix, publicReadings, variants } from './fixtures.js';

const report = {
  schema: 'bemjamin.threshold-voice-atlas/v1',
  generated_at: '2026-09-12T23:20:00Z',
  matrix: verifyFactorial(variants),
  atlas: mapReadings(variants, publicReadings),
  remix: inspectRemix(cavemanRemix),
  claim_boundary: 'Maps supplied interpretations; does not measure hospitality or infer a speaker as textual fact.',
};
await writeFile(new URL('./demo/report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
