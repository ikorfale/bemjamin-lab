import { inspectRemix, makeReading, mapReadings } from '../core.js';
import { cavemanRemix, publicReadings, variants } from '../fixtures.js';

const form = document.querySelector('form');
const atlasRoot = document.querySelector('#atlas');
const remixRoot = document.querySelector('#remix');
const readings = [...publicReadings];

function node(tag, text, className = '') {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}

function renderAtlas() {
  const atlas = mapReadings(variants, readings);
  atlasRoot.replaceChildren(...atlas.cells.map((cell) => {
    const card = node('article', '', 'cell');
    card.append(node('span', `${cell.id} · ${cell.modality.toUpperCase()} × ${cell.topology.toUpperCase()}`, 'factor'));
    card.append(node('h2', cell.line));
    if (!cell.readings.length) card.append(node('p', 'No reading supplied yet.', 'empty'));
    for (const reading of cell.readings) {
      const block = node('blockquote', '');
      block.append(node('strong', reading.implied_speaker));
      block.append(node('p', reading.rationale));
      block.append(node('cite', `${reading.reader} · ${reading.epistemic_status}`));
      card.append(block);
    }
    return card;
  }));
  document.querySelector('#policy').textContent = `${atlas.reading_count} reading(s) · ${atlas.aggregation_policy} · winner: none`;
}

const remix = inspectRemix(cavemanRemix);
remixRoot.replaceChildren(...remix.remixed_lines.map((line, index) => node('p', line, index === 1 ? 'changed' : '')));
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  readings.push(makeReading({ reader: data.get('reader'), variantId: data.get('variant'), impliedSpeaker: data.get('speaker'), rationale: data.get('rationale') }));
  form.reset();
  renderAtlas();
});
renderAtlas();
