import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CLOSING_KEYWORD_RE = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi;
const NEUTRAL_REFERENCE_RE = /\bRefs\s+#(\d+)\b/gi;
const MARKER_LINE_RE = /^<!-- idd-claimed-issue: (\d+) -->$/gm;
const MARKER_HINT_RE = /idd-claimed-issue:/gi;
const LEGACY_LINE_RE = /^\s*(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\s*$/i;
const COMPLETION_MARKER_RE = /^<!-- idd-next-issue-completion: (\d+) -->$/gm;

function issueNumber(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function normalizedNumbers(values) {
  if (!Array.isArray(values)) return null;
  const numbers = values.map(issueNumber);
  return numbers.every(Boolean) ? numbers : null;
}

function sameSet(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  const left = [...actual].sort((a, b) => a - b);
  const right = [...expected].sort((a, b) => a - b);
  return left.every((value, index) => value === right[index]);
}

export function stripIgnoredMarkdown(body) {
  const lines = String(body ?? '').split(/\r?\n/);
  const visible = [];
  let fenced = false;
  for (const line of lines) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced || /^\s*>/.test(line)) continue;
    visible.push(line.replace(/`[^`\n]*`/g, ''));
  }
  return visible.join('\n');
}

function visibleLineIndexes(body) {
  const lines = String(body ?? '').split(/\r?\n/);
  const indexes = [];
  let fenced = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*(?:```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (!fenced && !/^\s*>/.test(line)) indexes.push(index);
  }
  return indexes;
}

export function extractClosingIssueNumbers(body) {
  return [...stripIgnoredMarkdown(body).matchAll(CLOSING_KEYWORD_RE)].map((match) => Number(match[1]));
}

export function extractNeutralIssueNumbers(body) {
  return [...stripIgnoredMarkdown(body).matchAll(NEUTRAL_REFERENCE_RE)].map((match) => Number(match[1]));
}

export function extractClaimedIssueMarkers(body) {
  return [...stripIgnoredMarkdown(body).matchAll(MARKER_LINE_RE)].map((match) => Number(match[1]));
}

function result(route, ready, reason, details = {}) {
  return { route, ready, reason, ...details };
}

export function evaluateIssueAssociation({
  baseBranch,
  defaultBranch,
  nextBranch = 'next',
  issue,
  body = '',
  closingIssueNumbers,
  deliberateClosingIssues,
  activeClaimId,
  claimId,
}) {
  const targetIssue = issueNumber(issue);
  const githubClosing = normalizedNumbers(closingIssueNumbers);
  if (typeof baseBranch !== 'string' || typeof defaultBranch !== 'string'
    || typeof nextBranch !== 'string' || !baseBranch || !defaultBranch
    || !nextBranch || !targetIssue || !githubClosing) {
    return result('unsupported', false, 'invalid-input');
  }

  if (!claimId || activeClaimId !== claimId) {
    return result('unsupported', false, 'claim-mismatch', { issue: targetIssue });
  }

  const visibleClosing = extractClosingIssueNumbers(body);
  if (baseBranch === defaultBranch) {
    const expected = deliberateClosingIssues === undefined
      ? [targetIssue]
      : normalizedNumbers(deliberateClosingIssues);
    if (!expected || !expected.includes(targetIssue)) {
      return result('default-close', false, 'invalid-deliberate-closing-set', {
        expected,
        issue: targetIssue,
      });
    }
    if (!sameSet(visibleClosing, expected)) {
      return result('default-close', false, 'closing-reference-mismatch', {
        expected,
        visibleClosing,
      });
    }
    if (!sameSet(githubClosing, expected)) {
      return result('default-close', false, 'github-closing-reference-mismatch', {
        expected,
        githubClosing,
      });
    }
    return result('default-close', true, 'verified', { issue: targetIssue });
  }

  if (baseBranch !== nextBranch || nextBranch === defaultBranch) {
    return result('unsupported', false, 'unsupported-base', {
      baseBranch,
      defaultBranch,
    });
  }

  const visibleBody = stripIgnoredMarkdown(body);
  const markers = extractClaimedIssueMarkers(body);
  const markerHints = [...visibleBody.matchAll(MARKER_HINT_RE)];
  if (markerHints.length !== markers.length) {
    return result('next-reconcile', false, 'marker-mismatch', {
      expected: [targetIssue],
      markers,
    });
  }
  const neutralReferences = extractNeutralIssueNumbers(body);
  if (!sameSet(markers, [targetIssue])) {
    return result('next-reconcile', false, 'marker-mismatch', {
      expected: [targetIssue],
      markers,
    });
  }
  if (!neutralReferences.includes(targetIssue)) {
    return result('next-reconcile', false, 'neutral-reference-mismatch', {
      expected: [targetIssue],
      neutralReferences,
    });
  }
  if (visibleClosing.length !== 0 || githubClosing.length !== 0) {
    return result('next-reconcile', false, 'unexpected-closing-reference', {
      visibleClosing,
      githubClosing,
    });
  }
  return result('next-reconcile', true, 'verified', { issue: targetIssue });
}

export function normalizeLegacyNextBody(body, issue) {
  const targetIssue = issueNumber(issue);
  if (!targetIssue) return { changed: false, ready: false, reason: 'invalid-issue', body: String(body ?? '') };

  const source = String(body ?? '');
  const markers = extractClaimedIssueMarkers(source);
  const markerHints = [...stripIgnoredMarkdown(source).matchAll(MARKER_HINT_RE)];
  if (markerHints.length !== markers.length) {
    return { changed: false, ready: false, reason: 'malformed-marker', body: source };
  }
  if (markers.length > 1) {
    return { changed: false, ready: false, reason: 'multiple-markers', body: source };
  }

  const lines = source.split(/\r?\n/);
  const visibleIndexes = new Set(visibleLineIndexes(source));
  const legacyIndexes = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!visibleIndexes.has(index)) continue;
    const match = lines[index].match(LEGACY_LINE_RE);
    if (match && Number(match[1]) === targetIssue) legacyIndexes.push(index);
  }

  if (legacyIndexes.length === 0) {
    return { changed: false, ready: false, reason: 'legacy-closing-not-found', body: source };
  }
  if (legacyIndexes.length > 1) {
    return { changed: false, ready: false, reason: 'multiple-legacy-closings', body: source };
  }

  lines[legacyIndexes[0]] = `Refs #${targetIssue}`;
  const marker = `<!-- idd-claimed-issue: ${targetIssue} -->`;
  if (markers.length === 1 && markers[0] !== targetIssue) {
    const markerIndex = lines.findIndex((line) => line === `<!-- idd-claimed-issue: ${markers[0]} -->`);
    if (markerIndex >= 0) lines[markerIndex] = marker;
  } else if (markers.length === 0) {
    lines.push('', marker);
  }
  const normalized = lines.join('\n');
  return { changed: normalized !== source, ready: true, reason: 'normalized', body: normalized };
}

function validMergeSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value);
}

function validCompletionComment(comment, issue, pullRequestNumber, mergeCommitSha) {
  const source = typeof comment === 'string' ? comment : comment?.body;
  if (typeof source !== 'string' || !issueNumber(pullRequestNumber)) return false;
  const markers = [...stripIgnoredMarkdown(source).matchAll(COMPLETION_MARKER_RE)];
  return markers.length === 1
    && Number(markers[0][1]) === issue
    && source.includes(`PR #${pullRequestNumber}`)
    && source.includes(mergeCommitSha);
}

export function evaluateNextMergeReconciliation({
  baseBranch,
  defaultBranch,
  nextBranch = 'next',
  issue,
  issueState,
  body = '',
  closingIssueNumbers,
  activeClaimId,
  claimId,
  merged,
  mergedAt = null,
  mergeCommitSha,
}) {
  if (issueState !== 'OPEN') return result('next-reconcile', false, 'issue-not-open');
  if (merged !== true || typeof mergedAt !== 'string' || !mergedAt) {
    return result('next-reconcile', false, 'merge-not-confirmed');
  }
  if (!validMergeSha(mergeCommitSha)) return result('next-reconcile', false, 'merge-sha-missing');

  const association = evaluateIssueAssociation({
    baseBranch,
    defaultBranch,
    nextBranch,
    issue,
    body,
    closingIssueNumbers,
    activeClaimId,
    claimId,
  });
  if (!association.ready || association.route !== 'next-reconcile') {
    return result('next-reconcile', false, `association-${association.reason}`, { association });
  }
  return result('next-reconcile', true, 'verified', {
    issue: issueNumber(issue),
    mergeCommitSha,
  });
}

export function evaluateNextMergeCompletionEvidence({
  baseBranch,
  defaultBranch,
  nextBranch = 'next',
  issue,
  issueState,
  body = '',
  closingIssueNumbers,
  activeClaimId,
  claimId,
  merged,
  mergedAt = null,
  mergeCommitSha,
  pullRequestNumber,
  completionComments = [],
}) {
  if (issueState !== 'CLOSED') return result('next-reconcile', false, 'issue-not-closed');
  if (merged !== true || typeof mergedAt !== 'string' || !mergedAt) {
    return result('next-reconcile', false, 'merge-not-confirmed');
  }
  if (!validMergeSha(mergeCommitSha)) return result('next-reconcile', false, 'merge-sha-missing');

  const association = evaluateIssueAssociation({
    baseBranch,
    defaultBranch,
    nextBranch,
    issue,
    body,
    closingIssueNumbers,
    activeClaimId,
    claimId,
  });
  if (!association.ready || association.route !== 'next-reconcile') {
    return result('next-reconcile', false, `association-${association.reason}`, { association });
  }

  const targetIssue = issueNumber(issue);
  const validCompletionCount = Array.isArray(completionComments)
    ? completionComments.filter((comment) => validCompletionComment(
      comment,
      targetIssue,
      pullRequestNumber,
      mergeCommitSha,
    )).length
    : 0;
  if (validCompletionCount !== 1) {
    return result('next-reconcile', false, 'completion-evidence-missing', {
      issue: targetIssue,
      validCompletionCount,
      repairable: true,
      mergeCommitSha,
    });
  }
  return result('next-reconcile', true, 'verified', {
    issue: targetIssue,
    mergeCommitSha,
    repairable: false,
  });
}

const isCli = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isCli) {
  const inputIndex = process.argv.indexOf('--input');
  const modeIndex = process.argv.indexOf('--mode');
  assert.ok(inputIndex >= 0 && process.argv[inputIndex + 1],
    'usage: node scripts/idd-issue-association.mjs --mode association|reconcile|completion --input FILE');
  const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : 'association';
  const input = JSON.parse(fs.readFileSync(process.argv[inputIndex + 1], 'utf8'));
  const evaluate = mode === 'reconcile'
    ? evaluateNextMergeReconciliation
    : mode === 'completion' ? evaluateNextMergeCompletionEvidence : evaluateIssueAssociation;
  assert.ok(mode === 'association' || mode === 'reconcile' || mode === 'completion',
    'mode must be association, reconcile, or completion');
  console.log(JSON.stringify(evaluate(input)));
}
