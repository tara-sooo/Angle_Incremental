# IDD — Review Fix Phase (Lite)

The lite route follows the repository's `no-advisory` profile. Human review,
ordinary PR comments, bounded Codex critique, project validation, and CI are
the only review-fix inputs. No external reviewer is requested or awaited.

## E9 — Fix

Fix every Accepted PATH A item from the review snapshot. Verify the claim,
fix the affected class, run `fix-validate`, and commit atomically.

## E10 — Critique

Run one bounded read-only critique when suitable delegation is available;
otherwise use structured self-critique. If findings remain, triage them,
fix accepted items, validate, and repeat. Stop and request a maintainer
decision after the configured no-progress guard (`3` by default) rather than
looping indefinitely. A clean critique does not bypass CI or `human_merge`.

## E11–E12 — Sync, validate, push

Resolve conflicts with `next` by merging it into the issue branch, then run
`post-fix-validate`, revalidate the claim and worktree lock, and push the
branch. Human feedback or substantive scope changes ends any batching.

## E13–E15 — Reply, human review, CI

Reply individually to accepted and rejected human/ordinary review items,
resolve non-maintainer-decision threads after replying, and keep maintainer
decision holds open. Request re-review only from human reviewers with
`CHANGES_REQUESTED`; never request or poll a review bot. Use the shared CI
wait, then return to the full review snapshot before merge readiness.
