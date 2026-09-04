# Angle Incremental IDD workflow

This repository uses one compact, explicit-target workflow. The operator
names one Issue; the agent works in an isolated sibling worktree and stops on
ambiguous ownership, review, CI, or branch state.

## Start sequence

1. Read `idd-overview-core.instructions.md`, the experience contract, and the
   routed experience topic.
2. Read `idd-discover.instructions.md` and verify the one explicit Issue.
3. Read `idd-suitability.instructions.md`; only a passing target reaches
   `idd-claim.instructions.md`.
4. Claim the Issue, create the sibling worktree, and acquire its atomic lock.
5. Read `idd-work.instructions.md` for the plan, implementation, and bounded
   self-review loop.

There is no unattended Issue selection or fallback target. The selected Issue
and its acceptance criteria are the complete scope.

## Active route

```text
A0-T target → A4.5 suitability → A5 claim
→ B1 worktree → B2 plan/critique → B3 implement
→ C self-review/fix-validate → D PR to next → CI
→ E snapshot/triage/fix → final live merge gate → merge/completion/cleanup
```

The phase files are short operational contracts. Read the one matching the
current state; do not load unrelated phase variants.

## Safety invariants

- Parse trusted claim markers chronologically. A claim ID, agent ID, or marker
  body without a trusted author is not ownership proof.
- Revalidate the Issue claim, activation nonce, cwd, branch, and atomic
  `idd-claim.lock` immediately before every write.
- Keep the primary worktree on `next`; implementation happens only in the
  claimed sibling worktree.
- Use deterministic `issue/<number>-<slug>` branches and stop on collisions.
- Treat missing, stale, conflicting, or unknown evidence as fail-closed.
- Bind the merge command to the freshly checked PR head SHA.

## Weak-model guardrails

The safest short route is a checklist, not a long decision tree: identify the
target, prove ownership, inspect the diff, run validation, and re-fetch live
state before each irreversible action. Never infer a branch, review result, or
merge authorization from a title or cached output.

## ReviewItems_snapshot lifecycle

E1 reads all current PR threads, review bodies, and regular comments for the
current head. E2 keeps concrete human findings, unresolved actionable threads,
unreplied actionable comments, and the internal critique. Acknowledgements do
not block. E3 routes an empty worklist to the merge gate and a non-empty one to
triage. Any head change discards the snapshot.

Human `CHANGES_REQUESTED` reviews, unresolved actionable threads, and
unreplied actionable comments block merging. Accepted findings are fixed,
validated, replied to, and resolved only after the result is visible.

## Branch-aware issue association

An ordinary Issue PR targets exact `next` and contains:

```text
Refs #N
<!-- idd-claimed-issue: N -->
```

The marker appears exactly once, the active claim matches it, and the live
closing association is empty. Verify the body and base with
`scripts/idd-issue-association.mjs`; its read-only result never authorizes a
merge. A PR targeting `main`, `release/**`, a feature branch, or an unknown
base takes the human/fail-closed route.

## CI and merge

CI must be a real hosted result for the current PR head. Empty protection
configuration is not vacuous green. Poll for 30 min, allow 10 min for check
generation, and rerun an infrastructure failure at most once. Code failures
return to fix-validate; unknown or repeated failures hold.

The single final live merge gate re-fetches the Issue claim, PR base/head,
mergeability, current-head CI, and all review activity. It passes only for
exact `next`, a current claim, reviewed current head, green CI, clean review,
and a mergeable PR. `main`, `release/**`, transition PRs, and unknown bases
remain human-controlled. Execute only:

```sh
gh pr merge <pr-number> --merge --match-head-commit "<validated-head-sha>"
```

Do not use an administrator bypass. After a successful `next` merge, verify
the merge SHA and neutral Issue association, close the Issue as completed,
post the completion marker, verify it, remove only the session's worktree and
branch, and update the primary `next` branch.

## Live Status Digests

An optional digest starts with `<!-- idd-live-status: current -->` and records
the phase, claim, branch, timestamp, blockers, next action, and its evidence.
It is human context, never the source of truth. Revalidate ownership before
editing it and report duplicate current digests without choosing one.

## Critique pass invocation

Every plan and stabilized diff receives a bounded independent check for
correctness, requirement coverage, safety, and verification. If no separate
review process is available, perform the critique in the same response and
keep validation as the load-bearing check. Fix relevant high/medium findings;
keep low-value out-of-scope suggestions out of the diff. The work phase allows
at most three self-review passes.

### Mutation / write-side helper lens

For any script that mutates GitHub or git state, verify fail-closed inputs,
validate/execute scope parity, strict output handling, and that a failed or
unknown validation cannot reach the write. Prefer the written phase contract
and direct live evidence when a script is unavailable or disagrees.

## Verification commands

```sh
npm run check:runtime-order && npm run check:syntax
npm run validate
```

No gameplay, balance, save, UI, release, or deployment change belongs in this
IDD documentation/policy task.
