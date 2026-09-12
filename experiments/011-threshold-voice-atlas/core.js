const VALID_MODALITIES = new Set(['may', 'must']);
const VALID_TOPOLOGIES = new Set(['enter', 'wait outside']);

export function makeVariant({ id, modality, topology }) {
  if (!id || !VALID_MODALITIES.has(modality) || !VALID_TOPOLOGIES.has(topology)) {
    throw new Error('variant requires an id, may/must modality, and enter/wait outside topology');
  }
  return Object.freeze({
    id,
    modality,
    topology,
    line: `so a late guest ${modality} ${topology}.`,
  });
}

export function verifyFactorial(variants) {
  if (!Array.isArray(variants) || variants.length !== 4) {
    return { valid: false, reason: 'EXPECTED_FOUR_VARIANTS' };
  }
  const cells = new Set(variants.map(({ modality, topology }) => `${modality}|${topology}`));
  const ids = new Set(variants.map(({ id }) => id));
  const lines = new Set(variants.map(({ line }) => line));
  const valid = cells.size === 4 && ids.size === 4 && lines.size === 4;
  return { valid, reason: valid ? 'COMPLETE_TWO_BY_TWO' : 'DUPLICATE_OR_MISSING_CELL' };
}

export function makeReading({ reader, variantId, impliedSpeaker, rationale, source = 'local' }) {
  for (const [name, value] of Object.entries({ reader, variantId, impliedSpeaker, rationale })) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`);
  }
  return Object.freeze({
    reader: reader.trim(),
    variant_id: variantId.trim(),
    implied_speaker: impliedSpeaker.trim(),
    rationale: rationale.trim(),
    source,
    epistemic_status: 'reader-supplied interpretation',
  });
}

export function mapReadings(variants, readings) {
  const variantIds = new Set(variants.map(({ id }) => id));
  const invalid = readings.filter(({ variant_id: id }) => !variantIds.has(id));
  if (invalid.length) throw new Error(`unknown variant: ${invalid[0].variant_id}`);

  const cells = variants.map((variant) => {
    const cellReadings = readings.filter(({ variant_id: id }) => id === variant.id);
    return {
      ...variant,
      readings: cellReadings,
      supplied_speakers: [...new Set(cellReadings.map(({ implied_speaker: speaker }) => speaker))],
    };
  });
  const selectedVariants = new Set(readings.map(({ variant_id: id }) => id));
  const suppliedSpeakers = new Set(readings.map(({ implied_speaker: speaker }) => speaker));
  return {
    cells,
    reading_count: readings.length,
    divergent_variant_choices: selectedVariants.size > 1,
    divergent_speaker_models: suppliedSpeakers.size > 1,
    winner: null,
    aggregation_policy: 'MAP_DONT_AVERAGE',
  };
}

export function inspectRemix({ originalLines, replacementIndex, replacementLine, declaredChange }) {
  if (!Array.isArray(originalLines) || !originalLines.length) throw new Error('originalLines are required');
  if (!Number.isInteger(replacementIndex) || replacementIndex < 0 || replacementIndex >= originalLines.length) {
    throw new Error('replacementIndex is outside the stanza');
  }
  if (typeof replacementLine !== 'string' || !replacementLine.trim()) throw new Error('replacementLine is required');
  const remixedLines = [...originalLines];
  remixedLines[replacementIndex] = replacementLine.trim();
  const changed = originalLines.filter((line, index) => line !== remixedLines[index]).length;
  return {
    remixed_lines: remixedLines,
    changed_line_count: changed,
    one_line_constraint_passes: changed === 1,
    declared_change: declaredChange || 'unspecified',
    warning: 'A one-line edit can alter several interpretive variables; the declaration is a hypothesis, not proof.',
  };
}
