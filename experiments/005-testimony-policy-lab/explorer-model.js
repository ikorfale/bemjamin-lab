'use strict';

(function publish(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PolicyForkExplorer = api;
})(typeof globalThis === 'object' ? globalThis : this, function build() {
  const STATES = new Set(['OFF', 'UP', 'DOWN']);

  function assessCatalog(catalog, quorum) {
    if (!Array.isArray(catalog) || !Number.isSafeInteger(quorum) || quorum < 1) {
      throw new TypeError('catalog and a positive integer quorum are required');
    }

    const nodes = catalog.map((node) => {
      const states = Object.values(node.observers || {});
      if (states.some((state) => !STATES.has(state))) throw new TypeError('observer state must be OFF, UP, or DOWN');
      const up = Object.entries(node.observers || {}).filter(([, state]) => state === 'UP').map(([id]) => id).sort();
      const down = Object.entries(node.observers || {}).filter(([, state]) => state === 'DOWN').map(([id]) => id).sort();
      const reasons = [];
      if (up.length && down.length) reasons.push('CONFLICT');
      else if (down.length) reasons.push('AUTHENTICATED_DOWN');
      if (up.length < quorum) reasons.push('INSUFFICIENT_QUORUM');
      return { node_id: node.id, up, down, eligible: reasons.length === 0, reasons };
    });

    const firstConflict = nodes.find((node) => node.reasons.includes('CONFLICT'));
    const firstEligible = nodes.find((node) => node.eligible);
    return {
      nodes,
      policies: {
        FAIL_CLOSED_ON_CONFLICT: {
          selected: firstConflict ? null : (firstEligible?.node_id || null),
          reason: firstConflict ? `CONFLICT:${firstConflict.node_id}` : (firstEligible ? 'QUORUM' : 'NO_ELIGIBLE_NODE')
        },
        SKIP_CONFLICTED_NODE: {
          selected: firstEligible?.node_id || null,
          reason: firstEligible ? 'QUORUM' : 'NO_ELIGIBLE_NODE'
        }
      }
    };
  }

  return { assessCatalog };
});
