# IDD — Claim phase (A5)

Read this file after explicit-target ownership/safety readiness. Run the full
non-ownership suitability gate after verified claim and worktree ownership.
A claim is local to the selected Issue and its deterministic branch.

## Pre-checks

Re-fetch the Issue immediately before the claim write. All of these must pass:

1. the Issue is still open, unassigned, and startable;
2. the active trusted claim is absent, is this session's already-verified
   claim, or is at least 24 h stale;
3. no open PR references the Issue unless its head branch is the branch of an
   inheritable claim; and
4. no unrelated local worktree or remote branch matches `issue/<N>-*`.

An active non-stale claim held by another session is a stop, even when the
agent IDs match. A stale takeover must use `supersedes: {old-claim-id}` and a
fresh claim ID. Unknown claim, PR, or branch state is fail-closed.

## Deterministic branch

Use `issue/<number>-<slug>` for a fresh claim. Build the slug from the Issue
title by lowercasing, replacing non-ASCII `a-z`/`0-9` characters with `-`,
dropping empty tokens and these whole-token stop words: `a`, `an`, `the`,
`and`, `or`, `in`, `for`, `to`, `with`, `from`. Join with single dashes, trim
to 40 characters at a dash when possible, remove a trailing dash, and use
`task` when empty. The exact same title must always produce the exact same
branch.

Before claiming, inspect local worktrees and
`git/matching-refs/heads/issue/<number>-`. A match is allowed only when it is
tied to this session's verified claim, a stale claim being taken over, a
trusted released claim with the same branch, or the exact maintainer-prepared
branch exception below. Otherwise post a hold explaining the orphan collision
and stop; never delete or reuse it silently.

### Maintainer-prepared branch exception

A fresh claim may inherit a pre-existing Issue branch in the target Issue
namespace only when a top-level Issue comment from the repository owner or a
Maintain/Admin actor contains this exact authorization marker:

`<!-- idd-prepared-branch: branch=<branch> head=<40-hex-sha> base=next base-sha=<40-hex-sha> -->`

Treat the marker as branch-reuse authorization only, never as ownership or merge
authorization. Plain prose naming a branch/commit does not count. Before claim
posting, verify all of these against live state:

- `branch` starts with exact `issue/<N>-` for this Issue and has a
  non-empty suffix. For this exception only, the marker's exact branch is
  authoritative and need not equal the deterministic slug derived from the
  current Issue title;
- the live remote branch head exactly equals the marker `head`;
- `base` is exact `next`; marker `base-sha` is an ancestor of both the
  marked branch head and current `origin/next`:
  `git merge-base --is-ancestor <base-sha> origin/<branch>` and
  `git merge-base --is-ancestor <base-sha> origin/next` both succeed;
- no active claim exists for the Issue and no open PR uses that branch or
  references/closes the Issue.

If any check is unknown or false, stop. A validated prepared branch is reused
verbatim, but the session must still post and verify the normal fresh
`claimed-by` plus activation-nonce before any mutation. Never reset,
force-push, delete, or silently rewrite the prepared branch to make the checks
pass.

## Claim and activation

Generate a fresh opaque `{claim-id}` and `{nonce}`. Post the following exact
claim body through a direct JSON `POST`; the HTML marker must be the first
bytes and the visible note must be the final content:

```markdown
<!-- claimed-by: {agent-id} {claim-id} supersedes: {prior-claim-id|none} {ISO8601-timestamp} branch: {branch-name} -->

_{agent-id}: issue claim — IDD automation marker. Do not edit._
```

Then post exactly one activation marker:

```markdown
<!-- activation-nonce: {agent-id} {claim-id} {nonce} {ISO8601-timestamp} -->

_{agent-id}: claim activation nonce — IDD automation marker. Do not edit._
```

Do not append text to either marker. Record the pair and nonce before doing
anything else. A normal heartbeat reuses the existing pair and does not post
a new activation marker.

## Verify the race

Wait 5 s for GitHub consistency, then parse the complete trusted comment
stream in `created_at` order. The claim is usable only when:

- the active claim is this `{claim-id}` and its branch is exact;
- competing claims in the same `created_at` second are won by the earliest
  lexicographic `{claim-id}`;
- no different trusted claim arrived in a later second; and
- the winning activation nonce is this session's nonce.

If any condition fails, the claim is contested. For an explicit target, report
and stop; do not retry another Issue. Once verified, record the claim pair and
continue to `idd-work.instructions.md`.

## Worktree-local lock

After the sibling worktree exists and before its first mutation, atomically
create `idd-claim.lock` in the worktree's absolute Git directory (the path
returned by `git rev-parse --absolute-git-dir`). Write JSON containing the
current `agentId`, `claimId`, and `acquiredAt`. Use exclusive-create semantics
(`O_EXCL`/`wx`). Re-acquiring the same pair is a read-only success; a different
pair is a collision and must stop. F4 removes the lock with the worktree.

## Heartbeats and release

When work may exceed 12 h, revalidate the claim and post a matching heartbeat
using the original branch. The latest valid GitHub `created_at` is the only
timestamp that refreshes the 24 h stale clock.

Before voluntarily abandoning work, revalidate ownership and post the exact
`unclaimed-by` marker from `idd-overview-core.instructions.md`. If ownership
is already lost, do not release, comment, push, or clean up.
