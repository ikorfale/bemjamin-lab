import { auditReceiptsWithArtifacts } from '../../delegation-receipts/core.js';
import { NOW, faultLabels, makeArtifactResolver, makeFixture } from '../../delegation-receipts/fixtures.js';

const controls = document.querySelector('#faults');
const chain = document.querySelector('#chain');
const checks = document.querySelector('#checks');
const verdict = document.querySelector('#verdict');
const json = document.querySelector('#json');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

async function render(name) {
  const receipts = makeFixture(name);
  const report = await auditReceiptsWithArtifacts(receipts, NOW, makeArtifactResolver(name));
  const broken = new Set(report.issues.map((item) => item.receiptId));

  chain.replaceChildren(...receipts.map((receipt, index) => {
    const card = el('article', `receipt ${broken.has(receipt.id) ? 'bad' : 'good'}`);
    const head = el('div', 'receipt-head');
    head.append(el('span', 'hop', index === 0 ? 'ROOT' : `HOP ${index}`), el('span', 'actor', receipt.actor));
    const scopeList = el('div', 'scopes');
    receipt.scopes.forEach((scope) => scopeList.append(el('span', '', scope)));
    card.append(
      head,
      el('h2', '', receipt.id),
      el('p', '', `principal / ${receipt.principal}`),
      scopeList,
      el('dl', 'facts'),
    );
    const facts = card.querySelector('dl');
    for (const [key, value] of [
      ['parent', receipt.parent_id ?? '—'],
      ['expires', receipt.expires_at],
      ['may delegate', receipt.redelegation_allowed ? 'yes' : 'no'],
      ['result locator', receipt.result_locator || '—'],
      ['result sha256', receipt.result_sha256 || '—'],
    ]) {
      facts.append(el('dt', '', key), el('dd', '', value));
    }
    return card;
  }));

  checks.replaceChildren(...report.checks.map((check) => {
    const row = el('li', check.ok ? 'pass' : 'fail');
    row.append(el('span', '', check.ok ? 'PASS' : 'FAIL'), el('strong', '', check.name));
    const details = report.issues.filter((item) => item.check === check.name).map((item) => `${item.receiptId}: ${item.message}`);
    if (details.length) row.append(el('small', '', details.join(' · ')));
    return row;
  }));

  verdict.className = report.ok ? 'verdict pass' : 'verdict fail';
  verdict.textContent = report.ok ? 'AUTHORITY CHAIN HOLDS' : `${report.issues.length} INVARIANT${report.issues.length === 1 ? '' : 'S'} BROKEN`;
  json.textContent = JSON.stringify({ receipts, audit: report }, null, 2);
}

for (const [name, label] of Object.entries(faultLabels)) {
  const button = el('button', '', label);
  button.type = 'button';
  button.dataset.fault = name;
  button.setAttribute('aria-pressed', String(name === 'valid'));
  button.addEventListener('click', () => {
    controls.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    render(name);
  });
  controls.append(button);
}

void render('valid');
