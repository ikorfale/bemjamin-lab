export const CHECKS = Object.freeze([
  'chain',
  'principal',
  'scope',
  'time',
  'revocation',
  'redelegation',
  'result',
]);

function issue(check, receiptId, message) {
  return { check, receiptId, message };
}

function resultIssue(receiptId, code, message) {
  return { check: 'result', receiptId, code, message };
}

const RFC3339_WITH_OFFSET = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/;

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseTime(value) {
  if (typeof value !== 'string') return null;
  const match = RFC3339_WITH_OFFSET.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText,
    offset, , offsetHourText, offsetMinuteText] = match;
  const [year, month, day, hour, minute, second] = [
    yearText, monthText, dayText, hourText, minuteText, secondText,
  ].map(Number);
  if (month < 1 || month > 12
    || day < 1 || day > daysInMonth(year, month)
    || hour > 23 || minute > 59 || second > 59) return null;
  if (offset !== 'Z' && (Number(offsetHourText) > 23 || Number(offsetMinuteText) > 59)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function auditReceipts(receipts, now = '2026-09-08T18:00:00Z') {
  const issues = [];
  const receiptList = Array.isArray(receipts) ? receipts : [];
  const byId = new Map();
  const nowTime = parseTime(now);

  for (const receipt of receiptList) {
    const id = typeof receipt?.id === 'string' && receipt.id ? receipt.id : '<missing-id>';
    if (byId.has(id)) issues.push(issue('chain', id, `duplicate receipt id: ${id}`));
    else byId.set(id, receipt);
  }

  const roots = receiptList.filter((receipt) => receipt?.parent_id === null);
  if (roots.length !== 1) {
    issues.push(issue('chain', '*', `expected exactly one root; found ${roots.length}`));
  }
  const rootPrincipal = roots[0]?.principal;

  for (const receipt of receiptList) {
    const id = receipt?.id || '<missing-id>';
    const parent = receipt?.parent_id === null ? null : byId.get(receipt?.parent_id);

    if (receipt?.parent_id !== null && !parent) {
      issues.push(issue('chain', id, `parent ${String(receipt?.parent_id)} does not exist`));
    }

    if (typeof receipt?.principal !== 'string' || !receipt.principal.trim()) {
      issues.push(issue('principal', id, 'principal must be a non-empty string'));
    }
    if (receipt?.principal !== rootPrincipal) {
      issues.push(issue('principal', id, `principal changed from ${rootPrincipal} to ${String(receipt?.principal)}`));
    }

    const start = parseTime(receipt?.not_before);
    const expiry = parseTime(receipt?.expires_at);
    if (start === null || expiry === null || start >= expiry) {
      issues.push(issue('time', id, 'invalid or inverted validity interval'));
    } else if (nowTime === null || nowTime < start || nowTime >= expiry) {
      issues.push(issue('time', id, `receipt is not active at ${now}`));
    }

    const revokedAt = receipt?.revoked_at == null ? null : parseTime(receipt.revoked_at);
    if (receipt?.revoked_at != null && revokedAt === null) {
      issues.push(issue('revocation', id, 'invalid revoked_at timestamp'));
    }

    let ancestor = receipt;
    const seenAncestors = new Set();
    while (ancestor && !seenAncestors.has(ancestor.id)) {
      seenAncestors.add(ancestor.id);
      const ancestorRevokedAt = ancestor?.revoked_at == null ? null : parseTime(ancestor.revoked_at);
      if (ancestorRevokedAt !== null && nowTime !== null && nowTime >= ancestorRevokedAt) {
        const message = ancestor.id === id
          ? `receipt was revoked at ${ancestor.revoked_at}`
          : `ancestor ${ancestor.id} was revoked at ${ancestor.revoked_at}`;
        issues.push(issue('revocation', id, message));
        break;
      }
      ancestor = ancestor?.parent_id === null ? null : byId.get(ancestor?.parent_id);
    }

    if (parent) {
      const parentScopes = new Set(Array.isArray(parent.scopes) ? parent.scopes : []);
      const widened = (Array.isArray(receipt?.scopes) ? receipt.scopes : []).filter((scope) => !parentScopes.has(scope));
      if (widened.length) {
        issues.push(issue('scope', id, `scope widened by: ${widened.join(', ')}`));
      }

      const parentStart = parseTime(parent.not_before);
      const parentExpiry = parseTime(parent.expires_at);
      if (start !== null && parentStart !== null && start < parentStart) {
        issues.push(issue('time', id, 'child starts before its parent'));
      }
      if (expiry !== null && parentExpiry !== null && expiry > parentExpiry) {
        issues.push(issue('time', id, 'child expires after its parent'));
      }
      if (parent.redelegation_allowed !== true) {
        issues.push(issue('redelegation', id, `parent ${parent.id} forbids re-delegation`));
      }
    }
  }

  const leaves = receiptList.filter((candidate) => !receiptList.some((other) => other?.parent_id === candidate?.id));
  for (const leaf of leaves) {
    const id = leaf?.id || '<missing-id>';
    if (typeof leaf?.result_locator !== 'string' || !leaf.result_locator.trim()) {
      issues.push(resultIssue(id, 'RESULT_LOCATOR_MISSING', 'leaf has no result locator'));
    }
    if (typeof leaf?.result_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(leaf.result_sha256)) {
      issues.push(resultIssue(id, 'RESULT_DIGEST_INVALID', 'leaf has no valid lowercase SHA-256 digest'));
    }
  }

  for (const receipt of receiptList) {
    const visited = new Set();
    let cursor = receipt;
    while (cursor?.parent_id !== null) {
      if (visited.has(cursor?.id)) {
        issues.push(issue('chain', receipt?.id || '<missing-id>', 'parent links contain a cycle'));
        break;
      }
      visited.add(cursor?.id);
      cursor = byId.get(cursor?.parent_id);
      if (!cursor) break;
    }
  }

  const uniqueIssues = [...new Map(issues.map((entry) => [JSON.stringify(entry), entry])).values()];
  return {
    ok: uniqueIssues.length === 0,
    checked_at: now,
    receipt_count: receiptList.length,
    checks: CHECKS.map((name) => ({
      name,
      ok: !uniqueIssues.some((entry) => entry.check === name),
    })),
    issues: uniqueIssues,
  };
}

function asBytes(value) {
  if (typeof value === 'string') return new TextEncoder().encode(value);
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return null;
}

function ownBytes(value) {
  const bytes = asBytes(value);
  return bytes ? new Uint8Array(bytes) : null;
}

export async function sha256Hex(value) {
  const bytes = asBytes(value);
  if (!bytes) throw new TypeError('artifact must be a string, Uint8Array, or ArrayBuffer');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function auditReceiptsWithArtifacts(
  receipts,
  now = '2026-09-08T18:00:00Z',
  resolveArtifact = async () => undefined,
) {
  const report = auditReceipts(receipts, now);
  const receiptList = Array.isArray(receipts) ? receipts : [];
  const leaves = receiptList.filter((candidate) => !receiptList.some((other) => other?.parent_id === candidate?.id));
  const artifactIssues = [];

  for (const leaf of leaves) {
    const id = leaf?.id || '<missing-id>';
    if (typeof leaf?.result_locator !== 'string' || !leaf.result_locator.trim()) continue;
    if (typeof leaf?.result_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(leaf.result_sha256)) continue;

    let artifact;
    try {
      artifact = await resolveArtifact(leaf.result_locator);
    } catch {
      artifactIssues.push(resultIssue(id, 'RESULT_UNAVAILABLE', `artifact unavailable at ${leaf.result_locator}`));
      continue;
    }
    const bytes = asBytes(artifact);
    if (!bytes) {
      artifactIssues.push(resultIssue(id, 'RESULT_UNAVAILABLE', `artifact unavailable at ${leaf.result_locator}`));
      continue;
    }
    const actual = await sha256Hex(bytes);
    if (actual !== leaf.result_sha256) {
      artifactIssues.push(resultIssue(id, 'RESULT_DIGEST_MISMATCH', `artifact digest mismatch at ${leaf.result_locator}`));
    }
  }

  const issues = [...report.issues, ...artifactIssues];
  return {
    ...report,
    ok: issues.length === 0,
    checks: report.checks.map((check) => check.name === 'result'
      ? { ...check, ok: !issues.some((entry) => entry.check === 'result') }
      : check),
    issues,
  };
}

export async function auditAndConsumeArtifacts(
  receipts,
  now = '2026-09-08T18:00:00Z',
  resolveArtifact = async () => undefined,
  consumptionMode = 'VERIFIED_BUFFER',
) {
  if (!['VERIFIED_BUFFER', 'REFRESH_AND_REVERIFY'].includes(consumptionMode)) {
    throw new TypeError(`unsupported consumption mode: ${consumptionMode}`);
  }

  const report = auditReceipts(receipts, now);
  if (!report.ok) return { ...report, artifacts: [] };

  const receiptList = Array.isArray(receipts) ? receipts : [];
  const leaves = receiptList.filter((candidate) =>
    !receiptList.some((other) => other?.parent_id === candidate?.id));
  const issues = [];
  const artifacts = [];

  for (const leaf of leaves) {
    const id = leaf?.id || '<missing-id>';
    let auditValue;
    try {
      auditValue = await resolveArtifact(leaf.result_locator);
    } catch {
      auditValue = undefined;
    }
    const auditBytes = ownBytes(auditValue);
    if (!auditBytes) {
      issues.push(resultIssue(id, 'RESULT_UNAVAILABLE', `artifact unavailable at ${leaf.result_locator}`));
      continue;
    }

    const auditDigest = await sha256Hex(auditBytes);
    if (auditDigest !== leaf.result_sha256) {
      issues.push(resultIssue(id, 'RESULT_DIGEST_MISMATCH', `artifact digest mismatch at ${leaf.result_locator}`));
      continue;
    }

    let consumedBytes = auditBytes;
    let consumedDigest = auditDigest;
    let consumed = true;

    if (consumptionMode === 'REFRESH_AND_REVERIFY') {
      let consumedValue;
      try {
        consumedValue = await resolveArtifact(leaf.result_locator);
      } catch {
        consumedValue = undefined;
      }
      const refreshedBytes = ownBytes(consumedValue);
      if (!refreshedBytes) {
        issues.push(resultIssue(
          id,
          'RESULT_UNAVAILABLE_AT_CONSUMPTION',
          `artifact unavailable when consumed at ${leaf.result_locator}`,
        ));
        consumedBytes = null;
        consumedDigest = null;
        consumed = false;
      } else {
        consumedDigest = await sha256Hex(refreshedBytes);
        if (consumedDigest !== auditDigest) {
          issues.push(resultIssue(
            id,
            'RESULT_CHANGED_SINCE_AUDIT',
            `artifact changed since audit at ${leaf.result_locator}`,
          ));
          consumedBytes = null;
          consumed = false;
        } else {
          consumedBytes = refreshedBytes;
        }
      }
    }

    artifacts.push({
      receiptId: id,
      locator: leaf.result_locator,
      audit_snapshot_digest: auditDigest,
      consumption_mode: consumptionMode,
      consumed_digest: consumedDigest,
      consumed,
      bytes: consumedBytes,
    });
  }

  const allIssues = [...report.issues, ...issues];
  return {
    ...report,
    ok: allIssues.length === 0,
    checks: report.checks.map((check) => check.name === 'result'
      ? { ...check, ok: !allIssues.some((entry) => entry.check === 'result') }
      : check),
    issues: allIssues,
    artifacts,
  };
}
