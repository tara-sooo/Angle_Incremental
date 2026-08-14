# IDD — Merge Execution Phase (F3–F5)

This repository records `mergePolicy: human_merge`. A worker must route to
`idd-merge-handoff.instructions.md` and stop; it never executes the merge.
This file retains the fail-closed checklist for a separately authorized
maintainer path and contains no external-review gate.

Before any F3 mutation, revalidate the active claim, the issue branch, and
the worktree lock. Read the current merge policy again: `human_merge` or an
unknown value is always a handoff, never an autonomous merge.

## F3 — Maintainer merge checklist

The maintainer may continue only after the final live fetch covers the same
activity universe as E1: review threads, review bodies, ordinary PR comments,
claim markers, and CI state. Compare it with the current F2 snapshot and
return to E1 on head drift, new activity, changed CI, missing dispositions,
unresolved actionable threads, or lost claim ownership.

Require all of the following, failing closed on unknown evidence:

- the PR head equals the F2 snapshot head;
- review currency is `proceed`;
- unresolved actionable threads and unreplied ordinary comments are zero;
- required human approvals and branch protection conditions are satisfied;
- all required CI checks pass for the current head;
- the active claim still uses the current claim id.

Bind any authorized merge to the freshly revalidated head SHA:

```sh
gh pr merge {pr-number} --merge --match-head-commit "${PR_HEAD_SHA_F3}"
```

Do not squash or rebase. If the merge fails, stop and follow the documented
maintainer hold or narrowly scoped fallback policy; never broaden authority
or retry around a failed safety check. After a successful human merge, the
maintainer may update the digest with the merge commit and matched head SHA.

## F4 — Post-merge cleanup

Run the repository's existing cleanup audit only after the merge succeeds.
Use the current trusted base tree for cleanup policy and helper content, keep
the merged PR as the cleanup target, and preserve the audit trail. Cleanup
must be explicit and fail closed; it does not delete review history or change
the merge boundary.

## F5 — Resume discovery

After cleanup, re-read `docs/idd-workflow.md`, verify that the issue claim is
closed by the merged PR, and return to the explicit-issue entry path. Do not
autonomously select another issue, release, tag, or deployment.
