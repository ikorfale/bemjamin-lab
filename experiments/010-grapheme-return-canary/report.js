import { writeFile } from 'node:fs/promises';
import { evaluateCanary } from './core.js';
import { fixtures } from './fixtures.js';

const results = fixtures.map(evaluateCanary);
const report = {
  schema: 'bemjamin.grapheme-return-canary/v1',
  generated_from: 'deterministic bundled fixtures',
  claim: 'join-one-space preserves normalized text only when the omitted boundary is whitespace',
  results,
};

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const rows = results.map((result) => `
      <tr>
        <th scope="row">${escapeHtml(result.id)}</th>
        <td><span class="${result.decision.toLowerCase()}">${result.decision}</span></td>
        <td><code>${escapeHtml(result.reason)}</code></td>
        <td>${result.chunk_bytes.join(' / ')}</td>
        <td>${result.join_one_space_matches ? 'match' : 'mismatch'}</td>
        <td>${result.concatenate_matches ? 'match' : 'mismatch'}</td>
      </tr>`).join('');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Grapheme Return Canary</title>
  <style>
    :root { color-scheme: dark; font: 16px/1.5 ui-monospace, monospace; background: #10130f; color: #e7f6d5; }
    body { max-width: 72rem; margin: auto; padding: 2rem 1rem 4rem; }
    h1 { color: #c8ff63; } p { max-width: 72ch; } table { width: 100%; border-collapse: collapse; margin-top: 2rem; }
    th, td { border: 1px solid #526348; padding: .7rem; text-align: left; vertical-align: top; }
    thead { background: #1c2419; } code { color: #d4bfff; overflow-wrap: anywhere; }
    .pass { color: #8dffab; } .refuse { color: #ff9f89; } .note { border-left: .3rem solid #c8ff63; padding-left: 1rem; }
    @media (max-width: 760px) { table, thead, tbody, tr, th, td { display: block; } thead { position: absolute; left: -9999px; } tr { margin: 1rem 0; } }
  </style>
</head>
<body>
  <main>
    <p>Experiment 010 · transport-contract harness</p>
    <h1>Grapheme Return Canary</h1>
    <p class="note"><strong>CANARY NEVER SCORED.</strong> A reply arriving proves transport. It does not prove that chunk reassembly preserves the sender’s normalized text.</p>
    <p>These deterministic fixtures compare the stated “join chunks with one space” rule with byte-preserving concatenation. The combining-mark and emoji-ZWJ cases deliberately split one visible grapheme. Inserting a space changes the payload and therefore its whole-text SHA-256.</p>
    <table>
      <thead><tr><th>Fixture</th><th>Decision</th><th>Reason</th><th>Chunk bytes</th><th>Join one space</th><th>Concatenate</th></tr></thead>
      <tbody>${rows}
      </tbody>
    </table>
    <p>This diagnoses one reconstruction rule only. It does not test Board delivery, truncation, exporter behavior, authorship, or model quality.</p>
  </main>
</body>
</html>`;

await writeFile(new URL('./demo/report.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(new URL('./demo/index.html', import.meta.url), html);
console.log(JSON.stringify(report, null, 2));
