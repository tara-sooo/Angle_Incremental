const assert = require('node:assert/strict');

async function runIddIssueAssociationModuleRuntimeTest() {
  const association = await import('../scripts/idd-issue-association.mjs');
  const claimId = 'claim-108';
  const marker = '<!-- idd-claimed-issue: 108 -->';

  assert.equal(association.evaluateIssueAssociation({
    baseBranch: 'main',
    defaultBranch: 'main',
    issue: 108,
    body: 'Summary\n\nCloses #108',
    closingIssueNumbers: [108],
    activeClaimId: claimId,
    claimId,
  }).ready, true, 'default-base closing should pass');

  for (const fixture of [
    { body: 'Summary', closingIssueNumbers: [108], reason: 'closing-reference-mismatch' },
    { body: 'Closes #108\nCloses #109', closingIssueNumbers: [108, 109], reason: 'closing-reference-mismatch' },
    { body: '`Closes #108`', closingIssueNumbers: [108], reason: 'closing-reference-mismatch' },
    { body: '> Closes #108', closingIssueNumbers: [108], reason: 'closing-reference-mismatch' },
    { body: '```\nCloses #108\n```', closingIssueNumbers: [108], reason: 'closing-reference-mismatch' },
    { body: 'Closes #108', closingIssueNumbers: [], reason: 'github-closing-reference-mismatch' },
  ]) {
    const result = association.evaluateIssueAssociation({
      baseBranch: 'main', defaultBranch: 'main', issue: 108,
      body: fixture.body, closingIssueNumbers: fixture.closingIssueNumbers,
      activeClaimId: claimId, claimId,
    });
    assert.equal(result.ready, false);
    assert.equal(result.reason, fixture.reason);
  }

  const nextBody = `Summary\n\nRefs #108\n${marker}`;
  assert.equal(association.evaluateIssueAssociation({
    baseBranch: 'next',
    defaultBranch: 'main',
    issue: 108,
    body: nextBody,
    closingIssueNumbers: [],
    activeClaimId: claimId,
    claimId,
  }).ready, true, 'next neutral association should pass');

  for (const fixture of [
    { body: 'Refs #108', reason: 'marker-mismatch' },
    { body: `Refs #108\n${marker.replace('108', '109')}`, reason: 'marker-mismatch' },
    { body: 'Refs #108\n<!-- idd-claimed-issue: 108 --> extra', reason: 'marker-mismatch' },
    { body: `Refs #108\n${marker}`, activeClaimId: 'other-claim', reason: 'claim-mismatch' },
    { body: `Closes #108\n${marker}`, reason: 'neutral-reference-mismatch' },
    { body: nextBody, closingIssueNumbers: [108], reason: 'unexpected-closing-reference' },
  ]) {
    const result = association.evaluateIssueAssociation({
      baseBranch: 'next', defaultBranch: 'main', issue: 108,
      body: fixture.body, closingIssueNumbers: fixture.closingIssueNumbers ?? [],
      activeClaimId: fixture.activeClaimId ?? claimId, claimId,
    });
    assert.equal(result.ready, false, fixture.reason);
    assert.equal(result.reason, fixture.reason);
  }

  const legacy = association.normalizeLegacyNextBody('Summary\n\nCloses #108', 108);
  assert.equal(legacy.ready, true);
  assert.match(legacy.body, /Refs #108/);
  assert.match(legacy.body, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(association.evaluateIssueAssociation({
    baseBranch: 'next', defaultBranch: 'main', issue: 108,
    body: legacy.body, closingIssueNumbers: [], activeClaimId: claimId, claimId,
  }).ready, true, 'legacy next closing should normalize once');
  assert.equal(association.normalizeLegacyNextBody('```\nCloses #108\n```', 108).ready, false,
    'hidden legacy closing must not be normalized');

  assert.equal(association.evaluateIssueAssociation({
    baseBranch: 'release/0.12.0', defaultBranch: 'main', issue: 108,
    body: nextBody, closingIssueNumbers: [], activeClaimId: claimId, claimId,
  }).ready, false, 'release bases must not use next association');
  assert.equal(association.evaluateIssueAssociation({
    baseBranch: 'next', defaultBranch: 'next', issue: 108,
    body: 'Closes #108', closingIssueNumbers: [108], activeClaimId: claimId, claimId,
  }).ready, true, 'next is default: use default closing semantics');

  const mergeSha = 'a'.repeat(40);
  assert.equal(association.evaluateNextMergeReconciliation({
    baseBranch: 'next', defaultBranch: 'main', issue: 108, issueState: 'OPEN',
    body: nextBody, closingIssueNumbers: [], activeClaimId: claimId, claimId,
    merged: true, mergedAt: '2026-08-16T04:00:00Z', mergeCommitSha: mergeSha,
  }).ready, true, 'merged exact-next PR should be reconcilable');

  for (const fixture of [
    { merged: false, mergedAt: null, mergeCommitSha: mergeSha, reason: 'merge-not-confirmed' },
    { merged: true, mergedAt: null, mergeCommitSha: mergeSha, reason: 'merge-not-confirmed' },
    { merged: true, mergedAt: '2026-08-16T04:00:00Z', mergeCommitSha: 'not-a-sha', reason: 'merge-sha-missing' },
    { merged: true, mergedAt: '2026-08-16T04:00:00Z', mergeCommitSha: mergeSha, issueState: 'CLOSED', reason: 'issue-not-open' },
  ]) {
    const result = association.evaluateNextMergeReconciliation({
      baseBranch: 'next', defaultBranch: 'main', issue: 108,
      issueState: fixture.issueState ?? 'OPEN', body: nextBody, closingIssueNumbers: [],
      activeClaimId: claimId, claimId, merged: fixture.merged, mergedAt: fixture.mergedAt,
      mergeCommitSha: fixture.mergeCommitSha,
    });
    assert.equal(result.ready, false);
    assert.equal(result.reason, fixture.reason);
  }

  console.log('IDD issue association module runtime tests passed');
}

module.exports = { runIddIssueAssociationModuleRuntimeTest };
