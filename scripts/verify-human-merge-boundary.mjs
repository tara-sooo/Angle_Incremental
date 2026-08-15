import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith('--') || !value || args.has(key)) {
    throw new Error('usage: node scripts/verify-human-merge-boundary.mjs --repo OWNER/REPO --branch next [--ruleset-name NAME]');
  }
  args.set(key, value);
}

const repo = args.get('--repo');
const branch = args.get('--branch');
const rulesetName = args.get('--ruleset-name') ?? 'angle-incremental-human-merge-next';
assert.match(repo ?? '', /^[^/]+\/[^/]+$/, 'repo must be OWNER/REPO');
assert.equal(branch, 'next', 'this verifier is intentionally scoped to next');

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

const rulesets = runGhItems(`repos/${repo}/rulesets`);
const candidates = rulesets.filter((ruleset) =>
  ruleset.name === rulesetName &&
  ruleset.target === 'branch' &&
  ruleset.enforcement === 'active',
);
assert.equal(candidates.length, 1, `expected one active ${rulesetName} ruleset`);

const detail = runGh([`repos/${repo}/rulesets/${candidates[0].id}`]);
assert.deepEqual(detail.conditions?.ref_name, { include: ['refs/heads/next'], exclude: [] });
assert.deepEqual(detail.bypass_actors, []);
const pullRequest = detail.rules.find(({ type }) => type === 'pull_request');
assert.ok(pullRequest, 'pull_request rule is required');
const parameters = pullRequest.parameters ?? {};
assert.equal(parameters.required_approving_review_count, 1);
assert.equal(parameters.dismiss_stale_reviews_on_push, true);
assert.equal(parameters.require_last_push_approval, true);
assert.equal(parameters.required_review_thread_resolution, true);
assert.deepEqual(parameters.allowed_merge_methods, ['merge']);

console.log(JSON.stringify({
  ready: true,
  repo,
  branch,
  rulesetId: detail.id,
  rulesetName: detail.name,
  enforcement: detail.enforcement,
  bypassActors: detail.bypass_actors.length,
  requiredApprovingReviewCount: parameters.required_approving_review_count,
  mergeEndpointTouched: false,
}));
