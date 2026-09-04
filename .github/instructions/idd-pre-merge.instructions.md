# IDD — Final live merge gate

Read this file only when the PR's current review snapshot is clean. This is
the single merge-readiness gate; there is no second copy of its checklist.

## Live evidence

Immediately before the merge route, fetch all of the following again:

- the Issue and active `{claim-id}`/activation nonce;
- PR state, base branch, current head SHA, and mergeability;
- the repository default branch and branch-policy result;
- real required CI results for that exact head SHA; and
- all review threads, review bodies, and regular comments since the current
  head was reviewed.

The gate is `GO` only when every condition below is known true:

1. the PR is open and targets exact `next`;
2. the current claim still owns the Issue and the worktree/branch is correct;
3. the current head equals the reviewed head;
4. every required CI check for that head passes;
5. no unresolved actionable thread, unreplied actionable comment, or human
   `CHANGES_REQUESTED` review remains; and
6. the PR is mergeable without an administrator bypass.

Any changed, missing, stale, or unknown value is `NO-GO`. Return to the phase
that can repair it. `main`, `release/**`, transition PRs, and unknown bases
are human/fail-closed routes and never pass this autonomous gate.

Record the live head SHA as the merge binding. Revalidate the claim and lock
again immediately before handing it to `idd-merge.instructions.md`.

The merge command must bind to that SHA with `--match-head-commit`; never use
an unbound or stale head value.
