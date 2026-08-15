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
  transitionPullRequests: [105],
});
assert.equal(config.helperRuntime.profile, 'instructions-only');
assert.equal(config.ciGate?.trustEmptyProtectionReads, true);
assert.equal(config.mergeGate?.soloCodeownerAdminFallback, 'hold-and-report');
assert.equal(Object.hasOwn(config, 'advisoryWait'), false);

const activeSurfaces = [
  '.github/instructions/idd-overview-core.instructions.md',
  '.github/instructions/idd-ci.instructions.md',
  '.github/instructions/idd-review-fix.instructions.md',
  '.github/instructions/idd-advisory-wait.instructions.md',
  '.github/instructions/idd-pre-merge.instructions.md',
  '.github/instructions/idd-merge.instructions.md',
  '.github/instructions/idd-review-snapshot.instructions.md',
  '.github/instructions/idd-review-triage.instructions.md',
  '.github/instructions/lite/idd-advisory-wait-lite.instructions.md',
  '.github/instructions/lite/idd-review-fix-lite.instructions.md',
  '.github/instructions/lite/idd-review-snapshot-lite.instructions.md',
  '.github/instructions/lite/idd-pre-merge-lite.instructions.md',
  '.github/instructions/lite/idd-ci-lite.instructions.md',
  '.github/instructions/lite/idd-pr-submit-lite.instructions.md',
  'docs/idd-advisory-wait-shell-fallback.md',
  'docs/idd-policy.md',
  'docs/idd-workflow.md',
  '.github/instructions/idd-merge-handoff.instructions.md',
  'profiles/no-advisory/README.md',
];
const forbiddenRuntimePatterns = [
  /Copilot/i,
  /\bCOPILOT_[A-Z_]+\b/,
  /\bLAST_COPILOT_[A-Z_]+\b/,
  /\bAW[1-6]\b/,
  /advisory state/i,
  /advisoryWait\./i,
  /gh pr edit[^\n]*(?:copilot|advisory)/i,
  /requested_reviewers/i,
];

for (const path of activeSurfaces) {
  const source = read(path);
  for (const pattern of forbiddenRuntimePatterns) {
    assert.doesNotMatch(source, pattern, `${path} retains disabled advisory path: ${pattern}`);
  }
}

const reviewFix = read('.github/instructions/idd-review-fix.instructions.md');
const reviewSnapshot = read('.github/instructions/idd-review-snapshot.instructions.md');
const reviewTriage = read('.github/instructions/idd-review-triage.instructions.md');
const prSubmit = read('.github/instructions/idd-pr-submit.instructions.md');
const preMerge = read('.github/instructions/idd-pre-merge.instructions.md');
const mergeHandoff = read('.github/instructions/idd-merge-handoff.instructions.md');
const mergeExecution = read('.github/instructions/idd-merge.instructions.md');
const policy = read('docs/idd-policy.md');
const workflow = read('docs/idd-workflow.md');
const boundaryVerifier = read('scripts/verify-human-merge-boundary.mjs');
const branchPolicy = read('scripts/branch-merge-policy.mjs');
const releaseWorkflow = read('.github/workflows/publish-release.yml');

assert.match(reviewFix, /## E10[\s\S]*critique pass/);
assert.match(reviewSnapshot, /human|ordinary PR|review comments/i);
assert.match(reviewSnapshot, /`COMMENTED`[\s\S]*concrete finding[\s\S]*PATH A candidates/i,
  'E1 must retain actionable human COMMENTED reviews as PATH A candidates');
assert.match(reviewSnapshot, /acknowledgement-only[\s\S]*LGTM[\s\S]*ambiguous[\s\S]*ReviewItems_snapshot/i,
  'E1 must distinguish acknowledgement-only and ambiguous COMMENTED reviews');
assert.match(reviewTriage, /PATH A[\s\S]*human|ordinary PR/i);
assert.match(policy, /human_merge/);
assert.match(policy, /next/);
assert.match(policy, /main/);
assert.match(policy, /`ciGate\.trustEmptyProtectionReads: true`/);
assert.match(policy, /vacuous green/);
assert.match(policy, /ruleset/);
assert.match(policy, /bypass actor/i);
assert.match(policy, /最小権限|least-privilege/i);
assert.match(policy, /branch-aware|branch-aware/i);
assert.match(boundaryVerifier, /angle-incremental-human-release-boundary/);
assert.match(boundaryVerifier, /required_approving_review_count.*0/);
assert.match(boundaryVerifier, /required_status_checks/);
assert.match(boundaryVerifier, /integration_id.*15368/);
assert.match(boundaryVerifier, /bypass_actors/);
assert.doesNotMatch(boundaryVerifier, /pulls\/[^`]+\/merge/);
assert.match(branchPolicy, /autonomousBranches/);
assert.deepEqual(resolveBranchMergePolicy('next'), {
  route: 'autonomous', reason: 'integration-branch', baseBranch: 'next', failClosed: false, releasePublication: false,
});
assert.equal(resolveBranchMergePolicy('next', 105).reason, 'transition-pr');
assert.equal(resolveBranchMergePolicy('main').route, 'human');
assert.equal(resolveBranchMergePolicy('release/0.12.0').route, 'human');
assert.equal(resolveBranchMergePolicy('feature/demo').failClosed, true);
assert.match(releaseWorkflow, /github\.event\.workflow_run\.event == 'push'/);
assert.match(releaseWorkflow, /github\.event\.workflow_run\.head_branch == 'main'/);
assert.doesNotMatch(releaseWorkflow, /^\s*workflow_dispatch:/m);
assert.doesNotMatch(releaseWorkflow, /github\.event_name == 'workflow_dispatch'/);
assert.match(releaseWorkflow, /github\.event\.workflow_run\.head_sha/);
assert.doesNotMatch(releaseWorkflow, /head_branch == 'next'/);
assert.match(workflow, /Codex CLI[\s\S]*bounded read-only native subagent/i);
assert.match(workflow, /structured self-critique/i);

const d4Success = prSubmit.indexOf('**On success**');
const e1Route = prSubmit.indexOf('idd-review-snapshot.instructions.md', d4Success);
assert.ok(d4Success >= 0 && e1Route > d4Success, 'D4 success must route to E1');

const e1 = reviewSnapshot.indexOf('## E1');
const e2 = reviewSnapshot.indexOf('## E2');
const baseline = reviewSnapshot.indexOf('review-baseline', e2);
assert.ok(e1 >= 0 && e2 > e1 && baseline > e2, 'E1 must include the E2 critique baseline route');

const reviewCurrency = preMerge.indexOf('**Review currency**');
assert.ok(reviewCurrency >= 0 && preMerge.indexOf('review-watermark', reviewCurrency) > reviewCurrency,
  'F2 must require review-currency evidence');
assert.match(preMerge, /When all F2 conditions are satisfied[\s\S]*idd-merge-handoff\.instructions\.md/);
assert.match(mergeHandoff, /# IDD — Merge Policy Handoff Phase \(F2\.5\)/);
assert.match(mergeHandoff, /Read this file after `idd-pre-merge\.instructions\.md` \(F2\) satisfies/);
assert.match(mergeHandoff, /human_merge/);
assert.doesNotMatch(mergeHandoff, /advisory state/i);

const workerPhaseFiles = [
  '.github/instructions/idd-overview-core.instructions.md',
  '.github/instructions/idd-claim.instructions.md',
  '.github/instructions/idd-work.instructions.md',
  '.github/instructions/idd-pr-submit.instructions.md',
  '.github/instructions/idd-ci.instructions.md',
  '.github/instructions/idd-advisory-wait.instructions.md',
  '.github/instructions/idd-review-snapshot.instructions.md',
  '.github/instructions/idd-review-triage.instructions.md',
  '.github/instructions/idd-review-fix.instructions.md',
  '.github/instructions/idd-pre-merge.instructions.md',
  '.github/instructions/idd-merge.instructions.md',
  '.github/instructions/idd-resume.instructions.md',
];
const directHumanMergeSurfaces = workerPhaseFiles.filter((path) => /human_merge/i.test(read(path)));
assert.deepEqual(directHumanMergeSurfaces, ['.github/instructions/idd-merge.instructions.md'],
  'only post-F2.5 merge execution may contain the human_merge route');
assert.match(mergeExecution, /Read only after `idd-merge-handoff\.instructions\.md` routes/);
assert.match(mergeExecution, /route `main`[\s\S]*`human_merge` or unknown policy stops/);
assert.match(mergeExecution, /never retry with\s+`--admin`/);

console.log(`no-advisory policy OK (${activeSurfaces.length} runtime surfaces)`);
