# IDD — Review Fix Phase (E9–E15)

Read this file after idd-review-triage.instructions.md (E8) finds
Accepted PATH A items. This repository uses the no-advisory profile:
no external reviewer is requested or awaited. Codex critique remains an
internal bounded review pass.

## E9 — Fix accepted issues

Fix all Accepted PATH A items from ReviewItems_snapshot. Run
**fix-validate**. Commit fixes atomically — one logical change per
commit.

**Within-round batching.** All of this round's Accepted PATH A fixes
travel as their own atomic commits, but push together in a single push
at E12 — do not push after each individual fix. See E12 for the push
step and the bounded cross-round allowance for comments arriving before
that push.

These fix-side rules complement the accept-side "Verify before accept"
rule in `idd-review-triage.instructions.md` (E5); each cuts the review
round count:

- **Fix the whole class, not just the flagged line.** Sweep the current
  diff (and adjacent sections) and fix every instance of a systemic
  finding in one commit — this converges faster than waiting for each
  instance to be re-flagged.
- **Verify any claim a fix adds.** Check any new precision (a name,
  value, path, or described behavior) against the actual implementation
  before committing.
- **Already fixed via batching.** A PATH A item Accepted (E4/E5) may
  already be folded into a prior E12 push — confirm the commit
  addresses it and let E13 cite that SHA, without duplicating the fix.

## E10 — Validate fixes with critique pass

Run a critique pass to verify that the fixes in E9 address the root
causes and are correct (see `idd-overview-appendix.instructions.md` for per-agent
implementation). The distributed defaults for the E10 guardrails are
listed in `docs/policy-constants.md`. Keep an E10 pass count for the
current E9 fix batch.

If the critique pass finds additional issues, fix them, commit
atomically, and run E10 again while the findings are converging.

Convergence guardrails:

- "Meaningful progress" means a pass removes at least one Accepted
  finding, narrows a remaining finding's root cause/scope, or yields a
  materially new fix direction. Reworded duplicates do not count.
- If the same Accepted findings recur for
  `critiqueLoop.e10NoProgressHoldAfter` consecutive E10 passes (default
  `3`) without progress, stop the auto-loop: post a hold comment
  summarizing the repeated findings and attempted fixes, and wait for a
  maintainer decision.
- Do not use this stop condition to bypass serious issues: unresolved
  High/Medium findings remain blockers until fixed or explicitly
  redirected by a maintainer.
- If the critique pass reports zero issues, proceed to E11.

## E11 — Resolve conflicts with next

Check for conflicts between the feature branch and `next`. If conflicts
exist, merge `next` into the feature branch (`git fetch origin next &&
git merge origin/next`), resolve them, and complete the merge. On a
signed-commit repo with non-interactive-hostile primary signing (GPG
pinentry / hardware-touch), use the
[signed-commit merge wrapper](../../docs/idd-helper-scripts.md#signed-commit-merge-wrapper-shared-git-procedure)
for the whole operation instead of the plain command.

**Active review gate**: same check as
`idd-review-triage.instructions.md`'s sync path step 1 — unresolved
review threads, unreplied comments, or a reviewer's
`CHANGES_REQUESTED` state require explicit operator confirmation before
this merge, since the merge commit will appear in PR history.

## E12 — Lint, test, push

Run **post-fix-validate**.

Then push the feature branch normally (E11 uses merge commits, not
rebase, so no force push is required).

**Bounded cross-round batching allowance.** A small number of review
comments can arrive before this push that fall outside this round's
scope and haven't gone through triage yet. Fold them into this same
pending push — each its own atomic commit — instead of starting a
fresh round per arrival, but only when **all** hold:

- Each comment since the last push is a small, confirmable fix whose claim
  was checked against live evidence (linter run, actual file/runtime behavior)
  before folding it in. Never fold in an assertion-only finding, and do not
  delay a human review item or a substantive scope change.

- The resulting commit touches only files this round's pending fixes
  already touch, and re-runs **post-fix-validate** first (E12's own run
  already happened and misses a later fold-in).
- No CI-wait poll (E15) is currently in flight for this branch.

**Bound**: at most 3 additional commits, or 10 minutes since the first
accumulated commit — whichever comes first.

**Ends accumulation immediately** (push whatever has accumulated): a
new PATH A item arrives from the review snapshot; any item requests a
substantive code/logic change; any item falls outside the touched-file
scope; or either bound is reached.

**Non-goals**: never delays an in-flight CI wait (E15's mid-wait
fold-in rule is unchanged); never changes PATH A routing or triage
timing (still happens at the next E1 pass — only push timing changes);
and relaxes nothing else — the applicable human re-review remains
required after `CHANGES_REQUESTED`, the per-HEAD `review-watermark`
still invalidates on push, each E6 reply stays individual, and the
[claim revalidation gate](idd-overview-core.instructions.md#claim-revalidation-gate)
still runs immediately before push.

## E13 — Reply to feedback

For each Accepted PATH A item whose source is reviewer feedback (review
thread, review body, or regular comment): reply describing which commits
fixed it and how.

Start every reply with one of these prefixes so that disposition is
unambiguous:

- `**Accepted** — fixed in {commit-sha or comma-separated list}: {brief explanation}`

- **Review threads**: after posting your reply, **immediately resolve
  the thread**. When helper runtime is enabled, the profile-selected
  resolve-review-thread command (`--pr <number> --comment-id <id>
  --apply`, with `--body`/`--claim-issue`/`--claim-id`; see
  `docs/idd-helper-scripts.md`) posts the reply and resolves in one
  call, replying before resolving so a failed reply never leaves a
  silently-resolved thread; the manual REST + GraphQL
  `resolveReviewThread` sequence is the fallback. Resolution means
  "agent acted", not "reviewer agreed" — a disagreeing reviewer can
  reopen the thread, re-surfacing it in the next E1 pass.
- **Regular comments**: reply only; do not resolve.
- **Persistent non-review notices**: a non-review notice already
  dispositioned `**Rejected** — {bot} did not review HEAD …` in a prior
  pass **carries that rejection forward** across this push — do not
  re-post it just because `updatedAt` bumped or the bot re-posted the
  same summary (see the E6 non-review-notice rule). Only a notice the
  bot replaces with an actual completed review needs a fresh
  disposition.

After E13 replies and resolutions are complete, upsert the PR live
status digest before E14 if the next route is still review-fix or CI
wait: `Phase` to `E13 feedback replied`, `Open blockers` to any
remaining reviewer/CI wait, `Next action` to E14 or E15, and
`Authoritative by` to the accepted replies, resolved threads, current
HEAD, and verified claim. Since E15 returns to E1 after CI, this edit
is safe and does not bypass the next E1 snapshot.

## E14 — Human re-review

Request re-review only from human reviewers whose latest state is
CHANGES_REQUESTED after their accepted findings are fixed:

```sh
gh pr edit {pr-number} --add-reviewer {reviewer-login}
```

Do not request a review bot or post a bot-wait marker. If no human reviewer
needs re-review, continue directly to E15.

## E15 — Wait for CI

Schedule a wake, or background this wait only if the
topology-safety condition holds (confirmed to route completion back to
this turn); otherwise wait synchronously — see
[wake-up discipline](idd-ci.instructions.md#wake-up-discipline) for
the blocking commands and caveats; do not `run_in_background` this
wait absent the confirmed condition above.

Use `idd-ci.instructions.md` for the polling mechanics and timing. E15
reuses the same resolved `ciWait.runningTimeout`,
`ciWait.generationTimeout`, and `ciWait.rerunPolicy` values; omitted
keys preserve the distributed defaults. The outcome paths below are
authoritative and override the shared helper's generic outcomes for this
phase:

**While polling**: if new review threads or comments arrive during the
CI wait, note them. After CI resolves (any outcome), return to E1 before
proceeding to F — do not skip triage.

- **On success** → return to `idd-review-snapshot.instructions.md` (E1)
- **On failure / code-caused**: fix, run **fix-validate**, commit
  atomically, then return to E11
- **On failure / infra-flaky or pre-existing** (failure also present on
  `next`, unrelated to this branch): apply `ciWait.rerunPolicy` (default
  `rerun-once`) — rerun once and resume polling if it authorizes the
  current rerun; otherwise, or if the failure persists after that
  rerun, post a hold comment documenting it and stop. A maintainer must
  resolve or bypass the failing check; never auto-continue or treat as
  passed without human confirmation. Phrase the resume condition per
  the invariant-first guidance in `idd-overview-appendix.instructions.md`
  (Hold / suspend).
- **On cancelled / timed_out / code-caused**: fix, run **fix-validate**,
  commit, return to E11
- **On cancelled / timed_out / infra**: apply `ciWait.rerunPolicy` —
  re-push/rerun only when it authorizes the current rerun; if the route
  recurs after that rerun, or the policy is `hold`, post a hold comment
  and stop (do not loop). On success after the rerun, **return to E1**.
- **On failure / idd-advisory-convergence alone, pending: false with
  outstanding review reasons** (see idd-ci.instructions.md
  Interpretation): return to E1, not E11 — neither code-caused nor
  infrastructure. The check remains a CI/critique gate until review triage
  makes it pass.

When E15 stops on a CI hold, re-validate the claim, then update the
digest with `Phase: E15 hold`, the failing/missing checks in
`Open blockers`, and the maintainer/rerun expectation in `Next action`.
On CI success, do not edit the digest before returning to E1 — let the
next E1/F pass refresh review currency first.
