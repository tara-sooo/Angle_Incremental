# IDD — Review Fix Phase (Lite) (E9–E15)

Lite profile for helper-enabled weak/local models. Same semantics as
`idd-review-fix.instructions.md`. Use only for a single claimed issue with
an open PR. If the repository is `instructions-only`, use the standard
review-fix instructions instead.

This repository's `no-advisory` profile does not request or await external
review bots; human review, bounded Codex critique, CI, and the existing claim,
worktree, branch, and merge safeguards remain in force.
## Helper runtime contract

- Helper-enabled profiles: when a step names a helper or command set, use
  it. If a required helper is missing, fails, or disagrees with live
  state, stop and ask. Do not fall back silently to prose.
- `instructions-only`: do not use this lite file; use
  `idd-review-fix.instructions.md` instead.
- Any mismatch between this file and the standard review-fix phase is a
  bug in this file.
- **Command sets**: `fix-validate` (E9) and `post-fix-validate` (E12) are
  read from `.github/idd/config.json`'s `commands` mapping. If that file
  is missing or the command set cannot be read, stop and ask rather than
  guessing a command.

## Upstream-triage boundary

This file only executes triage dispositions someone else already made.
It never classifies, scores severity, or decides Accept/Reject itself —
those are E4-E8 judgment calls, excluded from every lite profile.

1. Before fixing anything, confirm every item from ReviewItems_snapshot
   that this round acts on already carries an `**Accepted**` or
   `**Rejected**` disposition from a prior E4-E8 pass.
2. If a ReviewItems_snapshot item has no recorded disposition, stop and
   ask. Do not triage it yourself, and do not guess its severity.
3. Only act on ReviewItems_snapshot items already marked `**Accepted**`.
   Leave `**Rejected**` items alone.
4. This boundary covers ReviewItems_snapshot items only — the ones E9
   fixes and E13 replies to. It does not cover E10's own critique
   findings, which E10 fixes directly under its bounded self-review loop.

## Stop-and-ask conditions

- A ReviewItems_snapshot item with no recorded E4-E8 disposition is in
  scope for this round (see Upstream-triage boundary).
- The active claim is ambiguous, disputed, or lost.
- A required helper is missing, fails, or disagrees with live state.
- E10's critique loop repeats the same Accepted findings for more than
  `critiqueLoop.e10NoProgressHoldAfter` (default 3) passes without
  meaningful progress.
- E11 merge conflicts cannot be resolved cleanly, or the PR has
  unresolved review threads, unreplied comments, or a
  `CHANGES_REQUESTED` reviewer and no explicit operator confirmation
  exists to merge `next` into the feature branch anyway.
- A CI failure is neither clearly code-caused nor recognized
  infra-flaky/pre-existing, **except** the sole-failing
  `idd-advisory-convergence` check with `pending: false` and outstanding
  review reasons — that case routes to E1 per E15 step 9, not
  stop-and-ask.
- The claim-lock helper reports a collision (a different claim id
  already holds the worktree lock).

## Pre-mutation guard

Before any commit, push, merge, reply, resolve, reviewer request, or
other GitHub side effect, confirm all of the following:

1. The active claim still uses this session's claim id.
2. If this session posted an activation nonce for the current claim,
   confirm it still wins (no later trusted marker for this claim id
   won the tie-break instead).
3. The current directory is the sibling worktree for the claimed branch.
4. `git branch --show-current` equals the claimed branch.
5. Acquire the worktree-local claim lock with the profile-selected
   `claim-lock` helper (`node scripts/claim-lock.mjs --acquire
   --worktree <this-worktree-path> --agent-id <id> --claim-id <id>`, or
   the package-manager-profile `idd:claim-lock` command with the same
   arguments — resolve the exact command from
   `docs/idd-helper-scripts.md` if unsure). A `collision` result is
   fail-closed: stop rather than proceed.
6. If any check fails, stop.

## E9 — Fix accepted issues

1. Fix every Accepted PATH A item from the current ReviewItems_snapshot.
2. Run `fix-validate`.
3. Commit fixes atomically — one logical change per commit.
4. When an accepted finding is one instance of a systemic class, sweep
   the current diff and adjacent touched sections and fix every
   instance in the same commit.
5. When a fix introduces a precision (a name, value, path, or described
   behavior) to satisfy a reviewer, verify it against the actual
   implementation before committing.
6. If an Accepted item is already fixed by a prior commit in this same
   round, do not duplicate the fix. Confirm the existing commit
   addresses it and let E13 cite that SHA.
7. Do not push yet. All of this round's fixes push together at E12.

## E10 — Validate fixes with critique pass

1. Run a critique pass to verify the E9 fixes address the root causes
   and are correct.
2. If the critique pass reports zero issues, continue to E11.
3. If it reports additional issues, fix them, commit atomically, and
   run E10 again.
4. Count "meaningful progress" as removing at least one Accepted
   finding, narrowing a remaining finding's root cause or scope, or
   producing a materially new fix direction. A reworded duplicate
   finding does not count.
5. If the same Accepted findings recur for more than
   `critiqueLoop.e10NoProgressHoldAfter` (default 3) consecutive E10
   passes without meaningful progress, stop the loop, post a hold
   comment summarizing the repeated findings and attempted fixes, and
   wait for a maintainer decision.
6. Do not use step 5 to bypass a serious issue: unresolved High or
   Medium findings stay blockers until fixed or explicitly redirected
   by a maintainer.

## E11 — Resolve conflicts with next

1. Check for conflicts between the feature branch and `next`.
2. If none exist, continue to E12.
3. If conflicts exist, and the PR has unresolved review threads,
   unreplied comments, or a reviewer's latest state is
   `CHANGES_REQUESTED`, get explicit operator confirmation before
   merging — the merge commit will appear in the PR history.
4. Run `git fetch origin next && git merge origin/next`.
5. On a signed-commit repo whose primary signing is non-interactive
   hostile (GPG pinentry or hardware-touch) but that provides a
   fallback signing wrapper for arbitrary git subcommands (pass
   `-c gpg.format=ssh -c user.signingkey=<abs-path> -c
   commit.gpgsign=true` to `git` before the subcommand — `git -c …
   merge`, not `git merge -c …`; a commit-only alias like
   `git commit-ssh` will not run `merge`), run this merge through that
   wrapper, not the plain command.
6. Resolve any conflicts and complete the merge.
7. If the merge needed `--continue`, run it through the same wrapper
   used in step 5 (`git -c … merge --continue`), never the plain
   `git merge --continue` — the wrapper must own the whole operation, or
   the merge commit reverts to the stalling primary signing.

## E12 — Lint, test, push

1. Run `post-fix-validate`.
2. Push the feature branch normally — E11 uses merge commits, so no
   force push is required.
3. Apply the pre-mutation guard immediately before this push.

## E13 — Reply to feedback

1. For each Accepted PATH A item whose source is reviewer feedback
   (review thread, review body, or regular comment), reply describing
   which commits fixed it and how.
2. Start every reply with:
   `**Accepted** — fixed in {commit-sha or comma-separated list}: {brief explanation}`
3. For a review thread, immediately resolve the thread after posting
   the reply. Reply first, resolve second, so a failed reply never
   leaves a silently-resolved thread.
4. For a regular comment, reply only; do not resolve.
5. If an automated non-review notice was already dispositioned in a prior
   pass, carry that rejection forward. Do not re-post an identical
   rejection just because the notice's timestamp bumped; disposition it
   again only when it becomes an actual completed review of the current HEAD.
6. After all replies and resolutions in this step are complete, update
   the PR live status digest: `Phase` to `E13 feedback replied`, `Open
   blockers` to any remaining reviewer or CI wait, `Next
   action` to E14 or E15, and `Authoritative by` to the replies,
   resolved threads, current HEAD, and verified claim.

## E14 — Re-review request

1. For each human reviewer whose latest state is `CHANGES_REQUESTED` and
   whose items are all addressed, request a re-review:
   `gh pr edit {pr-number} --add-reviewer {reviewer-login}`.
2. Fetch the current head:
   `PR_HEAD_SHA=$(gh pr view {pr-number} --json headRefOid --jq '.headRefOid')`.
3. Confirm the human re-review request is recorded, then return to E15 for
   the shared CI wait. Do not request, poll, or wait for an external review
   bot; if a human reviewer cannot be requested, stop and ask.

## E15 — Wait for CI

1. Schedule a wake, or background this wait only if the topology-safety
   condition is confirmed to route completion back to this turn;
   otherwise wait synchronously.
2. Use `idd-ci-lite.instructions.md` for the polling mechanics and
   timing (required-check discovery, state normalization, and the
   shared `ciWait.runningTimeout` / `ciWait.generationTimeout` /
   `ciWait.rerunPolicy` values). The outcomes below override its generic
   routing for this phase.
3. If new review threads or comments arrive during the wait, note them
   but keep waiting for CI.
4. On success: return to `idd-review-snapshot-lite.instructions.md`
   (E1) — do not skip triage.
5. On failure that is code-caused: fix it, run `fix-validate`, commit
   atomically, then return to E11.
6. On failure that is infra-flaky or pre-existing (also failing on
   `next`, unrelated to this branch): apply `ciWait.rerunPolicy`. If it
   authorizes a rerun, rerun once and resume polling. If the failure
   persists after that rerun, or the policy is `hold`, post a hold
   comment documenting the pre-existing failure and stop for a
   maintainer.
7. On cancelled or timed-out that is code-caused: fix it, run
   `fix-validate`, commit, return to E11.
8. On cancelled or timed-out that is infra-caused: apply
   `ciWait.rerunPolicy`. Re-push or rerun only when the policy
   authorizes the current rerun; if the same outcome recurs after that
   rerun, or the policy is `hold`, post a hold comment and stop. On
   success after the rerun, return to E1.
9. If `idd-advisory-convergence` is the sole failing required check and
   its own verdict reports `pending: false` with outstanding review
   reasons, return to E1, not E11 — this is neither code-caused nor
   infra. Unless a maintainer has posted a valid waiver
   for this HEAD, in which case apply `ciWait.rerunPolicy` instead so
   the rerun reflects the waiver.
10. When this step stops on a CI hold, update the digest: `Phase` to
    `E15 hold`, the failing or missing checks in `Open blockers`, and
    the maintainer or rerun expectation in `Next action`. On success, do
    not edit the digest before returning to E1.
