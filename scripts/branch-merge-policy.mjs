import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const configPath = new URL('../.github/idd/config.json', import.meta.url);
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const policy = config.branchMergePolicy;

assert.deepEqual(policy?.autonomousBranches, ['next']);
assert.deepEqual(policy?.humanExactBranches, ['main']);
assert.deepEqual(policy?.humanPatterns, ['release/**']);
assert.equal(policy?.unknownBaseRoute, 'human_merge');
assert.ok(Array.isArray(policy?.transitionPullRequests));

const matchesPattern = (branch, pattern) =>
  pattern.endsWith('/**') && branch.startsWith(pattern.slice(0, -2));

export function resolveBranchMergePolicy(baseBranch, pullRequestNumber = null) {
  if (typeof baseBranch !== 'string' || baseBranch.length === 0) {
    return { route: 'human', reason: 'unknown-base', failClosed: true };
  }

  const normalizedPr = pullRequestNumber === null ? null : Number(pullRequestNumber);
  if (policy.transitionPullRequests.includes(normalizedPr)) {
    return {
      route: 'human',
      reason: 'transition-pr',
      baseBranch,
      failClosed: true,
    };
  }

  if (policy.autonomousBranches.includes(baseBranch)) {
    return {
      route: 'autonomous',
      reason: 'integration-branch',
      baseBranch,
      failClosed: false,
      releasePublication: false,
    };
  }

  if (
    policy.humanExactBranches.includes(baseBranch) ||
    policy.humanPatterns.some((pattern) => matchesPattern(baseBranch, pattern))
  ) {
    return {
      route: 'human',
      reason: 'release-boundary',
      baseBranch,
      failClosed: false,
    };
  }

  return {
    route: 'human',
    reason: 'unknown-base',
    baseBranch,
    failClosed: true,
  };
}

const isCli = process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isCli) {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    const value = process.argv[index + 1];
    if (!key?.startsWith('--') || !value || args.has(key)) {
      throw new Error('usage: node scripts/branch-merge-policy.mjs --base-branch BRANCH [--pr NUMBER]');
    }
    args.set(key, value);
  }

  const baseBranch = args.get('--base-branch');
  assert.ok(baseBranch, 'base branch is required');
  console.log(JSON.stringify(resolveBranchMergePolicy(baseBranch, args.get('--pr') ?? null)));
}
