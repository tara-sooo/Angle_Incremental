# IDD — Resume

Use this file after a crash, rate limit, handoff, or context restart. Resume
from live state; do not trust an old digest or session memory as authority.

## Live snapshot

Re-fetch the Issue comments and state, active claim, PR and current head, CI
for that head, review activity, local branch, and all worktrees. The current
claim is usable only when its `{agent-id}`, `{claim-id}`, branch, activation
nonce, and lock all match this session.

Route as follows:

- no PR and a verified branch/worktree → `idd-work.instructions.md`;
- PR exists but association or CI is incomplete →
  `idd-pr-submit.instructions.md` / `idd-ci.instructions.md`;
- PR has new review activity → `idd-review-snapshot.instructions.md`;
- clean review and current green CI → `idd-pre-merge.instructions.md`;
- merged `next` PR → verify completion evidence in
  `idd-merge.instructions.md`, then clean up;
- active claim held by another session, ambiguous state, or a different
  worktree owner → stop and report.

If the active claim is stale, use `idd-claim.instructions.md` to take it over
with the exact branch and `supersedes` value. Never mint a competing claim
over a live owner. A closed Issue is evidence to verify, not a reason to
reopen it.
