import { createHash } from 'node:crypto';

const encoder = new TextEncoder();

export function utf8Bytes(value) {
  return encoder.encode(value).byteLength;
}

export function normalizeManifestText(value) {
  return value.replace(/\s+/gu, ' ').trim();
}

export function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function graphemeBoundaries(value) {
  const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
  return new Set([...segmenter.segment(value)].map(({ index }) => index).concat(value.length));
}

export function inspectSplit(original, left, right, omitted = '') {
  if (`${left}${omitted}${right}` !== original) {
    throw new Error('chunks and omitted delimiter do not reconstruct original input');
  }

  const splitIndex = left.length;
  const boundaries = graphemeBoundaries(original);
  const splitInsideGrapheme = !boundaries.has(splitIndex);
  const omittedIsWhitespace = omitted.length > 0 && /^\s+$/u.test(omitted);

  return {
    split_index_utf16: splitIndex,
    left_bytes: utf8Bytes(left),
    right_bytes: utf8Bytes(right),
    omitted,
    omitted_is_whitespace: omittedIsWhitespace,
    split_inside_grapheme: splitInsideGrapheme,
  };
}

export function evaluateCanary({ id, original, chunks, omitted = '', maxChunkBytes = 1200 }) {
  if (!id || !original || !Array.isArray(chunks) || chunks.length !== 2) {
    throw new Error('canary requires id, original, and exactly two chunks');
  }

  const [left, right] = chunks;
  const split = inspectSplit(original, left, right, omitted);
  const oversized = chunks
    .map((chunk, index) => ({ index: index + 1, bytes: utf8Bytes(chunk) }))
    .filter(({ bytes }) => bytes >= maxChunkBytes);
  const joinedWithSpace = chunks.join(' ');
  const concatenated = chunks.join('');
  const originalHash = sha256(normalizeManifestText(original));
  const spacedHash = sha256(normalizeManifestText(joinedWithSpace));
  const concatenatedHash = sha256(normalizeManifestText(concatenated));

  let decision = 'PASS';
  let reason = 'WHITESPACE_BOUNDARY_REASSEMBLES_CANONICALLY';
  if (oversized.length) {
    decision = 'REFUSE';
    reason = 'CHUNK_NOT_UNDER_BYTE_LIMIT';
  } else if (split.split_inside_grapheme) {
    decision = 'REFUSE';
    reason = 'SPACE_INSERTED_INSIDE_GRAPHEME';
  } else if (!split.omitted_is_whitespace) {
    decision = 'REFUSE';
    reason = 'SPACE_INSERTED_AT_NON_WHITESPACE_BOUNDARY';
  } else if (spacedHash !== originalHash) {
    decision = 'REFUSE';
    reason = 'NORMALIZED_HASH_MISMATCH';
  }

  return {
    id,
    marker: 'CANARY NEVER SCORED',
    decision,
    reason,
    max_chunk_bytes_exclusive: maxChunkBytes,
    split,
    chunk_bytes: chunks.map(utf8Bytes),
    original_normalized_sha256: originalHash,
    join_one_space_normalized_sha256: spacedHash,
    concatenate_normalized_sha256: concatenatedHash,
    join_one_space_matches: spacedHash === originalHash,
    concatenate_matches: concatenatedHash === originalHash,
  };
}
