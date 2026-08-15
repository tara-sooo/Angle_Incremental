import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { resolveBranchMergePolicy } from './branch-merge-policy.mjs';

const releaseWorkflow = fs.readFileSync(new URL('../.github/workflows/publish-release.yml', import.meta.url), 'utf8');
assert.doesNotMatch(releaseWorkflow, /^\s*workflow_dispatch:/m, 'release workflow must not expose workflow_dispatch');
assert.match(releaseWorkflow, /github\.event\.workflow_run\.event == 'push'/);
assert.match(releaseWorkflow, /github\.event\.workflow_run\.head_branch == 'main'/);

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith('--') || !value || args.has(key)) {
    throw new Error('usage: node scripts/verify-human-merge-boundary.mjs --repo OWNER/REPO (--pr NUMBER | --base-branch BRANCH)');
  }
  args.set(key, value);
}

const repo = args.get('--repo');
const pr = args.get('--pr');
const requestedBaseBranch = args.get('--base-branch');
assert.match(repo ?? '', /^[^/]+\/[^/]+$/, 'repo must be OWNER/REPO');
assert.ok(pr || requestedBaseBranch, 'pr or base branch is required');
assert.ok(!(pr && requestedBaseBranch), 'pass either pr or base branch, not both');

const runGh = (ghArgs) => {
  const result = spawnSync('gh', ['api', ...ghArgs], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`gh api failed (${result.status}): ${result.stderr.trim()}`);
  }
  return JSON.parse(result.stdout);
};

const runGhItems = (endpoint) => {
  const result = spawnSync('gh', ['api', endpoint, '--paginate', '--jq', '.[]'], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`gh api failed (${result.status}): ${result.stderr.trim()}`);
  }
  return result.stdout.trim() === '' ? [] : result.stdout.trim().split('\n').map(JSON.parse);
};

const pullRequest = pr ? runGh([`repos/${repo}/pulls/${pr}`]) : null;
const baseBranch = pullRequest?.base?.ref ?? requestedBaseBranch;
const mergePolicy = resolveBranchMergePolicy(baseBranch, pr);

const output = {
  ready: true,
  repo,
  pr: pr ? Number(pr) : null,
  baseBranch,
  ...mergePolicy,
  mergeEndpointTouched: false,
};

if (mergePolicy.route === 'autonomous') {
  const rulesets = runGhItems(`repos/${repo}/rulesets`);
  const temporaryRestriction = rulesets.find((ruleset) =>
    ruleset.name === 'angle-incremental-human-merge-next' &&
    ruleset.enforcement === 'active',
  );
  assert.equal(temporaryRestriction, undefined, 'temporary next human-merge restriction is still active');
  console.log(JSON.stringify({ ...output, humanControlled: false }));
} else if (mergePolicy.reason === 'release-boundary') {
  const rulesets = runGhItems(`repos/${repo}/rulesets`);
  const candidates = rulesets.filter((ruleset) =>
    ruleset.name === 'angle-incremental-human-release-boundary' &&
    ruleset.target === 'branch' &&
    ruleset.enforcement === 'active',
  );
  assert.equal(candidates.length, 1, 'expected one active release human-merge ruleset');
  const detail = runGh([`repos/${repo}/rulesets/${candidates[0].id}`]);
  assert.deepEqual(detail.bypass_actors, []);
  const includes = detail.conditions?.ref_name?.include ?? [];
  assert.ok(includes.includes('refs/heads/main'));
  assert.ok(includes.includes('refs/heads/release/**'));
  assert.deepEqual(detail.conditions?.ref_name?.exclude ?? [], []);
  const pullRequestRule = detail.rules.find(({ type }) => type === 'pull_request');
  assert.ok(pullRequestRule, 'pull_request rule is required');
  const parameters = pullRequestRule.parameters ?? {};
  assert.equal(parameters.required_approving_review_count, 0);
  assert.equal(parameters.dismiss_stale_reviews_on_push, true);
  assert.equal(parameters.require_last_push_approval, false);
  assert.equal(parameters.required_review_thread_resolution, true);
  assert.deepEqual(parameters.allowed_merge_methods, ['merge']);
  const statusRule = detail.rules.find(({ type }) => type === 'required_status_checks');
  assert.ok(statusRule, 'regression status check is required');
  const statusParameters = statusRule.parameters ?? {};
  assert.ok(statusParameters.required_status_checks?.some(({ context }) => context === 'regression'));
  assert.equal(statusParameters.strict_required_status_checks_policy, true);
  console.log(JSON.stringify({
    ...output,
    humanControlled: true,
    soloMaintainerViable: true,
    releaseWorkflowDispatchDisabled: true,
    rulesetId: detail.id,
    rulesetName: detail.name,
  }));
} else {
  console.log(JSON.stringify({ ...output, humanControlled: true }));
}
