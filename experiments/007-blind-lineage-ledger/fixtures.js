import { createHash } from 'node:crypto';
import { manifestDigest } from './core.js';

const sha = (text) => createHash('sha256').update(text).digest('hex');

export const manifest = {
  schema: 'blind-lineage-manifest/0.1',
  artifact_id: 'museum-room-demo',
  arm_labels_hidden: true,
  edges: [
    {
      edge_id: 'elevator-direction',
      source_move: 'People in the metal box face the same direction.',
      created_constraint: 'Later interpretations must explain shared orientation.',
      later_move: 'A suspicious reading treats the shared focal point as hierarchy rehearsal.',
      counterfactual_without_source: 'People in the metal box avoid conversation.',
      minimal_repair: 'The later reading concerns silence only; no new affordance is added.',
      removed_span_sha256: sha('face the same direction'),
    },
    {
      edge_id: 'receipt-length',
      source_move: 'A long supermarket receipt is displayed as a moral ledger.',
      created_constraint: 'A worker voice must reinterpret the same visible length.',
      later_move: 'The worker attributes length to settings, coupons, returns, and audits.',
      counterfactual_without_source: 'A supermarket receipt is displayed as a moral ledger.',
      minimal_repair: 'The worker discusses printing conventions without treating length as evidence.',
      removed_span_sha256: sha('long'),
    },
    {
      edge_id: 'calendar-capacity',
      source_move: 'After Thursday learns to rain.',
      created_constraint: 'The date itself may need to acquire a capacity.',
      later_move: 'A child begins teaching the calendar about clouds.',
      counterfactual_without_source: 'After rain on Thursday.',
      minimal_repair: 'The child waits for weather; no capacity is transferred to the date.',
      removed_span_sha256: sha('Thursday learns to'),
    },
  ],
};

const digest = manifestDigest(manifest);

export const reviews = [
  {
    reviewer_id: 'reviewer-a', manifest_sha256: digest, ratings: [
      { edge_id: 'elevator-direction', edge: 'supporting', defect: 'preserved' },
      { edge_id: 'receipt-length', edge: 'necessary', defect: 'transformed' },
      { edge_id: 'calendar-capacity', edge: 'necessary', defect: 'none' },
    ],
  },
  {
    reviewer_id: 'reviewer-b', manifest_sha256: digest, ratings: [
      { edge_id: 'elevator-direction', edge: 'decorative', defect: 'ignored' },
      { edge_id: 'receipt-length', edge: 'necessary', defect: 'transformed' },
      { edge_id: 'calendar-capacity', edge: 'necessary', defect: 'none' },
    ],
  },
];
