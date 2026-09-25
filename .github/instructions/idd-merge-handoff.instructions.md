# IDD — Branch-policy handoff

Read this short routing step after the final live merge gate. It adds no
second readiness checklist.

Resolve the PR base with the repository-owned boundary check:

```sh
node scripts/verify-human-merge-boundary.mjs --repo OWNER/REPO --pr <N>
```

Only `route: "autonomous"` for exact `next` may continue to merge execution.
`main`, `release/**`, transition PRs, unknown bases, or a failed check route
to a concise human handoff and stop; this is fail-closed. Never infer authorization from a title,
branch name, or stale snapshot.
