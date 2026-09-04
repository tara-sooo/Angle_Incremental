import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveBranchMergePolicy } from '../scripts/branch-merge-policy.mjs';

const read = (path) => fs.readFileSync(path, 'utf8');
const config = JSON.parse(read('.github/idd/config.json'));

assert.equal(config.reviewPolicy, 'no-advisory');
assert.equal(config.mergePolicy, 'fully_autonomous_merge');
assert.deepEqual(config.branchMergePolicy, {
  autonomousBranches: ['next'],
  humanExactBranches: ['main'],
  humanPatterns: ['release/**'],
  unknownBaseRoute: 'human_merge',
  transitionPullRequests: [105, 109],
});
assert.equal(config.helperRuntime.profile, 'instructions-only');
assert.equal(config.skipIssueAuthorApprovalGate, true);
assert.equal(config.ciGate?.trustEmptyProtectionReads, true);
assert.equal(config.mergeGate?.soloCodeownerAdminFallback, 'hold-and-report');
assert.equal(Object.hasOwn(config, 'advisoryWait'), false);

const activeFiles = [
  '.github/instructions/idd-overview-core.instructions.md',
  '.github/instructions/idd-discover.instructions.md',
  '.github/instructions/idd-suitability.instructions.md',
  '.github/instructions/idd-claim.instructions.md',
  '.github/instructions/idd-work.instructions.md',
  '.github/instructions/idd-pr-submit.instructions.md',
  '.github/instructions/idd-ci.instructions.md',
  '.github/instructions/idd-review-snapshot.instructions.md',
  '.github/instructions/idd-review-triage.instructions.md',
  '.github/instructions/idd-review-fix.instructions.md',
  '.github/instructions/idd-pre-merge.instructions.md',
  '.github/instructions/idd-merge-handoff.instructions.md',
  '.github/instructions/idd-merge.instructions.md',
  '.github/instructions/idd-resume.instructions.md',
  '.github/instructions/idd-resume-stall.instructions.md',
  '.github/instructions/idd-overview-appendix.instructions.md',
  'docs/idd-workflow.md',
];

const retiredRoutePatterns = [
  /\bA0-O\b/,
  /\borphan-first\b/i,
  /\broadmap\b/i,
  /\blite\b/i,
  /advisoryWait/i,
  /idd-advisory-wait/i,
  /review-watermark/i,
  /review-baseline/i,
  /F2\.5/i,
  /Copilot/i,
  /requested_reviewers/i,
];

for (const path of activeFiles) {
  const source = read(path);
  assert.ok(source.trim().split(/\r?\n/).length <= 180, `${path} is not compact`);
  for (const pattern of retiredRoutePatterns) {
    assert.doesNotMatch(source, pattern, `${path} retains a retired route: ${pattern}`);
  }
}

const core = read('.github/instructions/idd-overview-core.instructions.md');
const discover = read('.github/instructions/idd-discover.instructions.md');
const suitability = read('.github/instructions/idd-suitability.instructions.md');
const claim = read('.github/instructions/idd-claim.instructions.md');
const work = read('.github/instructions/idd-work.instructions.md');
const prSubmit = read('.github/instructions/idd-pr-submit.instructions.md');
const ci = read('.github/instructions/idd-ci.instructions.md');
const reviewSnapshot = read('.github/instructions/idd-review-snapshot.instructions.md');
const reviewTriage = read('.github/instructions/idd-review-triage.instructions.md');
const reviewFix = read('.github/instructions/idd-review-fix.instructions.md');
const preMerge = read('.github/instructions/idd-pre-merge.instructions.md');
const handoff = read('.github/instructions/idd-merge-handoff.instructions.md');
const merge = read('.github/instructions/idd-merge.instructions.md');
const resume = read('.github/instructions/idd-resume.instructions.md');
const stall = read('.github/instructions/idd-resume-stall.instructions.md');
const appendix = read('.github/instructions/idd-overview-appendix.instructions.md');
const workflow = read('docs/idd-workflow.md');
const policy = read('docs/idd-policy.md');
const profile = read('profiles/no-advisory/README.md');

for (const pattern of [
  /explicit Issue target/i,
  /claimed-by/,
  /activation-nonce/,
  /same-second/,
  /claim revalidation/i,
  /idd-claim\.lock/,
  /next/,
  /main/,
  /release\/\*\*/,
  /fail-closed/i,
  /npm ci/,
  /npm run validate/,
]) assert.match(core, pattern);

for (const pattern of [/A0-T/, /exactly one/, /no fallback/i, /suitability/]) {
  assert.match(discover, pattern);
}
for (const pattern of [/seven checks/i, /state_reason/, /Duplicate\/superseded/, /Actionability/, /Verifiability/]) {
  assert.match(suitability, pattern);
}
for (const pattern of [/deterministic branch/i, /issue\/<number>-<slug>/, /supersedes/, /O_EXCL|wx/, /activation marker/i, /open PR/i]) {
  assert.match(claim, pattern);
}
for (const pattern of [/B1/, /B2/, /B3/, /at most three/, /worktree/, /fix-validate/]) {
  assert.match(work, pattern);
}
for (const pattern of [/Refs #N/, /idd-claimed-issue/, /base exactly[\s\S]*`next`/, /main/, /release\/\*\*/, /idd-issue-association/]) {
  assert.match(prSubmit, pattern);
}
for (const pattern of [/current (?:PR )?head/i, /required checks/i, /rerun.*once/i, /30 min/, /10 min/, /vacuous green/i]) {
  assert.match(ci, pattern);
}
for (const pattern of [/COMMENTED/, /CHANGES_REQUESTED/, /unresolved actionable/i, /current head/i, /critique/i]) {
  assert.match(reviewSnapshot, pattern);
}
for (const pattern of [/human review/i, /reply/i, /resolve/i, /unreplied actionable/i]) {
  assert.match(reviewTriage, pattern);
}
for (const pattern of [/revalidate/i, /fix/i, /push/i, /idd-ci/, /review snapshot/]) {
  assert.match(reviewFix, pattern);
}
for (const pattern of [/single merge-readiness gate/i, /exact `next`/, /current head/i, /required CI/i, /--match-head-commit/, /NO-GO/]) {
  assert.match(preMerge, pattern);
}
for (const pattern of [/autonomous/, /next/, /main/, /release\/\*\*/, /human/i, /fail-closed/i]) {
  assert.match(handoff, pattern);
}
for (const pattern of [/gh pr merge/, /--merge/, /--match-head-commit/, /idd-next-issue-completion/, /gh issue close/, /worktree/]) {
  assert.match(merge, pattern);
}
for (const pattern of [/live state/i, /current\s+claim/i, /current head/i, /CI/, /merged `next`/]) {
  assert.match(resume, pattern);
}
for (const pattern of [/24 h/, /stale claim/i, /supersedes/, /orphan branch/i, /atomic lock/i]) {
  assert.match(stall, pattern);
}
for (const pattern of [/idd-live-status: current/, /digest is context/i, /claim before every/i, /bounded/i]) {
  assert.match(appendix, pattern);
}
for (const pattern of [/explicit-target/i, /Critique pass invocation/, /Mutation \/ write-side helper lens/, /next/, /main/, /current-head CI/i]) {
  assert.match(workflow, pattern);
}
for (const pattern of [/branch-aware/i, /fully_autonomous_merge/, /human_merge/, /ciGate\.trustEmptyProtectionReads: true/, /vacuous green/i, /least-privilege/i]) {
  assert.match(policy, pattern);
}
assert.match(profile, /Merge policy: `next` is autonomous/);
assert.match(profile, /`main`, `release\/\*\*`.*`human_merge`/s);
assert.match(profile, /--match-head-commit/);

const issueAssociation = read('scripts/idd-issue-association.mjs');
const boundaryVerifier = read('scripts/verify-human-merge-boundary.mjs');
const branchPolicy = read('scripts/branch-merge-policy.mjs');
const releaseWorkflow = read('.github/workflows/publish-release.yml');
assert.match(issueAssociation, /idd-claimed-issue/);
assert.match(issueAssociation, /evaluateNextMergeReconciliation/);
assert.match(boundaryVerifier, /angle-incremental-human-release-boundary/);
assert.match(boundaryVerifier, /required_status_checks/);
assert.doesNotMatch(boundaryVerifier, /pulls\/[^`]+\/merge/);
assert.match(branchPolicy, /autonomousBranches/);
assert.deepEqual(resolveBranchMergePolicy('next'), {
  route: 'autonomous', reason: 'integration-branch', baseBranch: 'next', failClosed: false, releasePublication: false,
});
assert.equal(resolveBranchMergePolicy('next', 105).reason, 'transition-pr');
assert.equal(resolveBranchMergePolicy('next', 109).reason, 'transition-pr');
assert.equal(resolveBranchMergePolicy('main').route, 'human');
assert.equal(resolveBranchMergePolicy('release/0.12.0').route, 'human');
assert.equal(resolveBranchMergePolicy('feature/demo').failClosed, true);
assert.match(releaseWorkflow, /github\.event\.workflow_run\.event == 'push'/);
assert.match(releaseWorkflow, /github\.event\.workflow_run\.head_branch == 'main'/);
assert.doesNotMatch(releaseWorkflow, /^\s*workflow_dispatch:/m);
assert.doesNotMatch(releaseWorkflow, /github\.event_name == 'workflow_dispatch'/);
assert.match(releaseWorkflow, /github\.event\.workflow_run\.head_sha/);
assert.doesNotMatch(releaseWorkflow, /head_branch == 'next'/);

console.log(`compact no-advisory policy OK (${activeFiles.length} active surfaces)`);
