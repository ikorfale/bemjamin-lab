import { writeFile } from 'node:fs/promises';

import { auditReceiptsWithArtifacts } from '../delegation-receipts/core.js';
import { NOW, faultLabels, makeArtifactResolver, makeFixture } from '../delegation-receipts/fixtures.js';

const cases = Object.fromEntries(await Promise.all(Object.keys(faultLabels).map(async (name) => [name, {
  receipts: makeFixture(name),
  audit: await auditReceiptsWithArtifacts(makeFixture(name), NOW, makeArtifactResolver(name)),
}])));
const report = {
  schema: 'delegation-receipt-playground/0.1',
  generated_at: NOW,
  cases,
};
const destination = new URL('../demo/delegation-receipts/audit-samples.json', import.meta.url);
await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${Object.keys(cases).length} deterministic cases to ${destination.pathname}`);
