import { writeFileSync } from 'node:fs';
import { scoreLedger } from './core.js';
import { manifest, reviews } from './fixtures.js';

const report = scoreLedger(manifest, reviews);
const output = `${JSON.stringify(report, null, 2)}\n`;
writeFileSync(new URL('./report.json', import.meta.url), output);
process.stdout.write(output);
