import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareCorpora } from './core.js';

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

export function renderHtml(report) {
  const groups = [
    ['Expectation changed', report.changes.expectation_changed],
    ['Record only changed', report.changes.record_only_changed],
    ['Added', report.changes.added],
    ['Removed', report.changes.removed],
    ['Malformed', report.changes.malformed],
  ];
  const cards = groups.map(([title, items]) => `
    <section><h2>${title} <span>${items.length}</span></h2>${items.length
      ? `<ul>${items.map((item) => `<li><code>${escapeHtml(item.case_id)}</code>${item.change ? ` · ${escapeHtml(item.change)}` : ''}${item.reason ? ` · ${escapeHtml(item.side)}:${escapeHtml(item.reason)}` : ''}</li>`).join('')}</ul>`
      : '<p>None.</p>'}</section>`).join('');
  const s = report.summary;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verdict Drift Lens</title>
<style>:root{color-scheme:dark;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#08110f;color:#edf7ef}body{max-width:72rem;margin:auto;padding:clamp(1rem,4vw,4rem)}a{color:#caff38}header{border-bottom:1px solid #385049;padding-bottom:2rem}.eyebrow{color:#caff38;text-transform:uppercase;letter-spacing:.12em}h1{font-size:clamp(2.5rem,7vw,6rem);line-height:.9;margin:.4em 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(12rem,1fr));gap:1px;background:#385049;border:1px solid #385049;margin:2rem 0}.metric,section{background:#0d1a17;padding:1.25rem}.metric strong{display:block;font-size:2.2rem;color:#43e4e7}main{display:grid;gap:1rem}section{border:1px solid #385049}h2{display:flex;justify-content:space-between}code{color:#caff38}li+li{margin-top:.6rem}.boundary{border-left:3px solid #43e4e7;padding:1rem;color:#b8cbc1}</style></head>
<body><header><p class="eyebrow">Experiment 009 · read-only corpus comparison</p><h1>Verdict Drift Lens</h1><p>${escapeHtml(report.provenance.baseline_ref ?? 'baseline')} → ${escapeHtml(report.provenance.candidate_ref ?? 'candidate')}</p></header>
<div class="grid"><div class="metric"><strong>${s.expectation_changed}</strong>expectation changed</div><div class="metric"><strong>${s.record_only_changed}</strong>record only</div><div class="metric"><strong>${s.added}</strong>added</div><div class="metric"><strong>${s.removed}</strong>removed</div><div class="metric"><strong>${s.malformed}</strong>malformed</div></div>
<p class="boundary">${escapeHtml(report.claim_boundary)}</p><main>${cards}</main></body></html>`;
}

export async function buildReport(baseline, candidate, output, provenance = {}) {
  const report = await compareCorpora(baseline, candidate, provenance);
  await mkdir(output, { recursive: true });
  await Promise.all([
    writeFile(resolve(output, 'drift.json'), `${JSON.stringify(report, null, 2)}\n`),
    writeFile(resolve(output, 'drift.html'), renderHtml(report)),
  ]);
  return report;
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const [baseline, candidate, output = '.'] = process.argv.slice(2);
  if (!baseline || !candidate) {
    console.error('Usage: node report.js BASELINE_CASES CANDIDATE_CASES [OUTPUT_DIR]');
    process.exit(2);
  }
  const report = await buildReport(baseline, candidate, output, {
    target: process.env.DRIFT_TARGET ?? null,
    baseline_ref: process.env.DRIFT_BASELINE_REF ?? null,
    candidate_ref: process.env.DRIFT_CANDIDATE_REF ?? null,
  });
  console.log(JSON.stringify(report.summary));
}
