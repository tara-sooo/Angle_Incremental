# IDD — Review Fix Phase (E9–E15)

Read this file after `idd-review-triage.instructions.md` (E8) finds
Accepted PATH A items. This repository uses the `no-advisory` profile:
human review handling, Codex critique, validation, and CI are the only
review-fix routes. No external reviewer is requested or awaited.

Apply the shared claim revalidation gate before E9, the E12 push, and each
E13/E14/E15 GitHub side effect.

## E9 — Fix accepted issues

Fix every Accepted PATH A item from `ReviewItems_snapshot`. Verify the
reported claim against the current diff, fix the whole affected class, run
`fix-validate`, and commit one logical change at a time. Batch the commits in
one push at E12 unless a human decision or an out-of-scope change ends the
batch.

## E10 — Validate fixes with critique pass

Run the documented critique pass against the fixes and their root causes.
Use one bounded read-only native subagent when Codex supports a suitable
delegation; otherwise use the documented structured self-critique fallback.

If findings remain, accept or reject them through E4-E8 rules, fix accepted
items, run `fix-validate`, commit atomically, and repeat E10. Meaningful
progress removes a finding, narrows its scope, or provides a new fix
direction. After `critiqueLoop.e10NoProgressHoldAfter` (default `3`) passes
without progress, post a hold with the repeated findings and wait for a
maintainer decision. Never use this guard to bypass an unresolved High or
Medium finding. A zero-finding pass proceeds to E11.

## E11 — Resolve conflicts with next

Fetch `origin/next` and check for conflicts. If the branch conflicts, merge
`origin/next`, resolve the conflict, run `fix-validate`, and commit the merge.
Unresolved review threads, unreplied comments, or `CHANGES_REQUESTED` still
require the documented operator confirmation before this merge.

## E12 — Lint, test, push

Run `post-fix-validate`, revalidate the claim and the worktree branch, then
push the issue branch normally. A small number of bot notices may be folded
into this pending push only when they are independently verified, touch the
same files, fit the bounded commit/time allowance, and no CI wait is active;
human feedback or substantive scope changes end accumulation immediately.

## E13 — Reply to feedback

For each Accepted PATH A reviewer item, reply with:

```text
**Accepted** — fixed in {commit-sha}: {brief explanation}
```

Resolve review threads after replying; regular comments receive a reply only.
For a CODEOWNER or required-reviewer rejection, use the maintainer-decision
hold path instead. Keep replies individual and revalidate the claim before
each GitHub mutation.

## E14 — Human re-review

Request re-review only from human reviewers whose latest state is
`CHANGES_REQUESTED` after their accepted findings are fixed:

```sh
gh pr edit {pr-number} --add-reviewer {reviewer-login}
```

Do not request a review bot, post a bot-wait marker, or poll an external
reviewer. If no human reviewer needs re-review, continue directly to E15.

## E15 — Wait for CI

Use `idd-ci.instructions.md` for the bounded CI wait. A successful wait returns
to E1 so the full human/ordinary-comment snapshot is rebuilt. A code-caused
failure returns to E9 after `fix-validate`; an infrastructure failure gets
the configured single rerun or a maintainer hold. A failed internal
`idd-advisory-convergence` check with `pending: false` and outstanding review
reasons returns to E1 for triage rather than being rerun as a code failure.

On a hold, revalidate the claim and update the live digest with the failing
check and the maintainer resume condition. Do not edit the digest between a
fresh review watermark and an intended merge-gate pass unless routing out of
that gate.
