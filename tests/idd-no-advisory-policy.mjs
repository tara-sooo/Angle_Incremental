import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const config = JSON.parse(read('.github/idd/config.json'));

assert.equal(config.reviewPolicy, 'no-advisory');
assert.equal(config.mergePolicy, 'human_merge');
assert.equal(config.helperRuntime.profile, 'instructions-only');
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
  'profiles/no-advisory/README.md',
];
const forbiddenRuntimePatterns = [
  /Copilot/i,
  /\bCOPILOT_[A-Z_]+\b/,
  /\bLAST_COPILOT_[A-Z_]+\b/,
  /\bAW[1-6]\b/,
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
const policy = read('docs/idd-policy.md');
const workflow = read('docs/idd-workflow.md');

assert.match(reviewFix, /## E10[\s\S]*critique pass/);
assert.match(reviewSnapshot, /human|ordinary PR|review comments/i);
assert.match(reviewTriage, /PATH A[\s\S]*human|ordinary PR/i);
assert.match(policy, /human_merge/);
assert.match(policy, /next/);
assert.match(policy, /main/);
assert.match(workflow, /Codex CLI[\s\S]*bounded read-only native subagent/i);
assert.match(workflow, /structured self-critique/i);

console.log(`no-advisory policy OK (${activeSurfaces.length} runtime surfaces)`);
