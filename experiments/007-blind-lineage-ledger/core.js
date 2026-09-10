import { createHash } from 'node:crypto';

const EDGE_LABELS = ['necessary', 'supporting', 'decorative'];
const DEFECT_LABELS = ['preserved', 'transformed', 'ignored', 'none'];
const EDGE_SCORE = { necessary: 2, supporting: 1, decorative: 0 };

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function manifestDigest(manifest) {
  validateManifest(manifest);
  return createHash('sha256').update(canonical(manifest)).digest('hex');
}

function requireText(value, path) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${path} must be non-empty text`);
}

export function validateManifest(manifest) {
  if (!manifest || manifest.schema !== 'blind-lineage-manifest/0.1') {
    throw new Error('unsupported manifest schema');
  }
  requireText(manifest.artifact_id, 'artifact_id');
  if (manifest.arm_labels_hidden !== true) throw new Error('arm_labels_hidden must be true during scoring');
  if (!Array.isArray(manifest.edges) || manifest.edges.length === 0) throw new Error('edges must be non-empty');
  const seen = new Set();
  for (const [index, edge] of manifest.edges.entries()) {
    const prefix = `edges[${index}]`;
    requireText(edge.edge_id, `${prefix}.edge_id`);
    if (seen.has(edge.edge_id)) throw new Error(`duplicate edge_id: ${edge.edge_id}`);
    seen.add(edge.edge_id);
    for (const field of ['source_move', 'created_constraint', 'later_move', 'counterfactual_without_source', 'minimal_repair']) {
      requireText(edge[field], `${prefix}.${field}`);
    }
    requireText(edge.removed_span_sha256, `${prefix}.removed_span_sha256`);
    if (!/^[a-f0-9]{64}$/.test(edge.removed_span_sha256)) {
      throw new Error(`${prefix}.removed_span_sha256 must be lowercase SHA-256`);
    }
  }
  return manifest;
}

function validateReviews(manifest, reviews, digest) {
  if (!Array.isArray(reviews) || reviews.length < 2) throw new Error('at least two independent reviews are required');
  const expectedIds = manifest.edges.map((edge) => edge.edge_id).sort();
  const reviewerIds = new Set();
  for (const review of reviews) {
    requireText(review.reviewer_id, 'reviewer_id');
    if (reviewerIds.has(review.reviewer_id)) throw new Error(`duplicate reviewer_id: ${review.reviewer_id}`);
    reviewerIds.add(review.reviewer_id);
    if (review.manifest_sha256 !== digest) throw new Error(`manifest digest mismatch for ${review.reviewer_id}`);
    if (!Array.isArray(review.ratings)) throw new Error(`ratings missing for ${review.reviewer_id}`);
    const ids = review.ratings.map((rating) => rating.edge_id).sort();
    if (ids.length !== expectedIds.length || ids.some((id, index) => id !== expectedIds[index])) {
      throw new Error(`ratings must cover each edge exactly once for ${review.reviewer_id}`);
    }
    for (const rating of review.ratings) {
      if (!EDGE_LABELS.includes(rating.edge)) throw new Error(`invalid edge label for ${rating.edge_id}`);
      if (!DEFECT_LABELS.includes(rating.defect)) throw new Error(`invalid defect label for ${rating.edge_id}`);
    }
  }
}

function emptyMatrix(labels) {
  return Object.fromEntries(labels.map((left) => [left, Object.fromEntries(labels.map((right) => [right, 0]))]));
}

export function scoreLedger(manifest, reviews) {
  const digest = manifestDigest(manifest);
  validateReviews(manifest, reviews, digest);
  const edgeMatrix = emptyMatrix(EDGE_LABELS);
  let pairCount = 0;
  let pairAgreements = 0;

  const edges = manifest.edges.map((edge) => {
    const ratings = reviews.map((review) => review.ratings.find((rating) => rating.edge_id === edge.edge_id));
    for (let left = 0; left < ratings.length; left += 1) {
      for (let right = left + 1; right < ratings.length; right += 1) {
        edgeMatrix[ratings[left].edge][ratings[right].edge] += 1;
        pairCount += 1;
        if (ratings[left].edge === ratings[right].edge) pairAgreements += 1;
      }
    }
    const edgeLabels = ratings.map((rating) => rating.edge);
    const defectLabels = ratings.map((rating) => rating.defect);
    return {
      edge_id: edge.edge_id,
      edge_labels: edgeLabels,
      defect_labels: defectLabels,
      edge_consensus: new Set(edgeLabels).size === 1 ? edgeLabels[0] : 'DISAGREEMENT',
      defect_consensus: new Set(defectLabels).size === 1 ? defectLabels[0] : 'DISAGREEMENT',
      mean_edge_score: Number((edgeLabels.reduce((sum, label) => sum + EDGE_SCORE[label], 0) / edgeLabels.length).toFixed(3)),
    };
  });

  const edgeCounts = Object.fromEntries(EDGE_LABELS.map((label) => [label, 0]));
  const defectCounts = Object.fromEntries(DEFECT_LABELS.map((label) => [label, 0]));
  for (const review of reviews) {
    for (const rating of review.ratings) {
      edgeCounts[rating.edge] += 1;
      defectCounts[rating.defect] += 1;
    }
  }

  return {
    schema: 'blind-lineage-report/0.1',
    artifact_id: manifest.artifact_id,
    manifest_sha256: digest,
    reviewer_count: reviews.length,
    edge_count: manifest.edges.length,
    edge_label_counts: edgeCounts,
    defect_label_counts: defectCounts,
    pairwise_edge_agreement: Number((pairAgreements / pairCount).toFixed(3)),
    pairwise_comparisons: pairCount,
    edge_confusion_matrix: edgeMatrix,
    disagreements: edges.filter((edge) => edge.edge_consensus === 'DISAGREEMENT' || edge.defect_consensus === 'DISAGREEMENT').map((edge) => edge.edge_id),
    edges,
    claim_boundary: 'Independent labels measure reviewer agreement on frozen evidence; they do not prove causal lineage or prose quality.',
  };
}
