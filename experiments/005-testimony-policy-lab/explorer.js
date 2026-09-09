'use strict';

const observers = ['ada', 'bert', 'cy'];
const nodes = ['node-0', 'mirror-a'];
const state = {
  quorum: 2,
  catalog: [
    { id: 'node-0', observers: { ada: 'UP', bert: 'UP', cy: 'DOWN' } },
    { id: 'mirror-a', observers: { ada: 'UP', bert: 'UP', cy: 'OFF' } }
  ]
};

const stateLabels = { OFF: 'No fresh testimony', UP: 'Authenticated UP', DOWN: 'Authenticated DOWN' };

function nextState(current) {
  return current === 'OFF' ? 'UP' : current === 'UP' ? 'DOWN' : 'OFF';
}

function render() {
  const result = PolicyForkExplorer.assessCatalog(state.catalog, state.quorum);
  document.querySelector('#quorum-value').textContent = String(state.quorum);
  document.querySelector('#scenario').replaceChildren(...state.catalog.flatMap((node) => [
    Object.assign(document.createElement('h3'), { textContent: node.id }),
    ...observers.map((observer) => {
      const button = document.createElement('button');
      const value = node.observers[observer];
      button.type = 'button';
      button.className = `testimony testimony-${value.toLowerCase()}`;
      button.dataset.node = node.id;
      button.dataset.observer = observer;
      button.setAttribute('aria-label', `${node.id}, ${observer}: ${stateLabels[value]}. Activate to change.`);
      button.innerHTML = `<strong>${observer}</strong><span>${stateLabels[value]}</span>`;
      return button;
    })
  ]));

  const policyRoot = document.querySelector('#policies');
  policyRoot.replaceChildren(...Object.entries(result.policies).map(([name, decision]) => {
    const article = document.createElement('article');
    article.className = `policy ${decision.selected ? 'policy-pass' : 'policy-stop'}`;
    const heading = document.createElement('h3');
    heading.textContent = name.replaceAll('_', ' ');
    const selection = document.createElement('p');
    selection.className = 'selection';
    selection.textContent = decision.selected || 'NONE';
    const reason = document.createElement('code');
    reason.textContent = decision.reason;
    article.append(heading, selection, reason);
    return article;
  }));

  document.querySelector('#findings').replaceChildren(...result.nodes.map((node) => {
    const row = document.createElement('li');
    const reasons = node.reasons.length ? node.reasons.join(' + ') : 'ELIGIBLE';
    row.textContent = `${node.node_id}: ${node.up.length} UP / ${node.down.length} DOWN — ${reasons}`;
    return row;
  }));
}

document.querySelector('#scenario').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-node]');
  if (!button) return;
  const node = state.catalog.find((candidate) => candidate.id === button.dataset.node);
  node.observers[button.dataset.observer] = nextState(node.observers[button.dataset.observer]);
  render();
});

document.querySelector('#quorum-down').addEventListener('click', () => {
  state.quorum = Math.max(1, state.quorum - 1);
  render();
});

document.querySelector('#quorum-up').addEventListener('click', () => {
  state.quorum = Math.min(observers.length, state.quorum + 1);
  render();
});

render();
