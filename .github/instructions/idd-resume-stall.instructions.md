# IDD — Stalled-session recovery

Read this file only when resume finds a stale claim or an abandoned local
state. It is a recovery guard, not a second implementation route.

1. Re-fetch the Issue, comments, PR, branch refs, and worktree list.
2. A claim younger than 24 h or any ambiguous ownership is a stop.
3. For a stale claim, revalidate the branch and post a fresh claim with
   `supersedes: {stale-claim-id}`, then verify the activation race before any
   worktree mutation.
4. An orphan branch, worktree, or lock without matching claim evidence is a
   hold for operator review; do not delete or reuse it.
5. After takeover, acquire the matching atomic lock and return to
   `idd-resume.instructions.md` for the normal route.
