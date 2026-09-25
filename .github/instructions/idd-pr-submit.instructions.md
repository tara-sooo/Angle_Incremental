# IDD — Pull request submission

Read this file after C is clean. Before every Git or GitHub write, revalidate
the claim, cwd, branch, and worktree lock from `idd-overview-core`.

## Publish once

Before the first push, fetch `origin/next`. If the issue branch is behind,
rebase it onto `origin/next`; if it is already current, skip the no-op rebase.
Verify HEAD is still on the claimed branch and the implementation commit is
present. Resolve any conflicts, run fix-validate, and commit the resolution.

### Local performance requested by the Issue

Select and run the deterministic local validation profile in
`docs/idd-policy.md`; unknown scope escalates to routine/full. `npm run
validate` is the routine profile. Install dependencies only when the selected
profile requires them, and only after acquiring the worktree lock.

For the `performance` profile, run `npm run test:performance` and record its
report. A local timing-only overage is evidence, not a hosted-CI failure or
hold; use the baseline-aware local classifier when regression classification
is needed. `local-performance-inconclusive` proceeds to PR, but the strict
hosted performance gate remains required whenever that profile applies.

Run the selected profile's complete evidence set in the sibling worktree, then
publish:

```sh
git push -u origin <claimed-branch>
```

The first push publishes review history. Later synchronization returns through
the review/fix loop; do not force-push normal work.

## Create the PR

Fetch the live default branch and create an ordinary Issue PR with base exactly
`next`. The body must contain the neutral plain-text association and exactly
one machine marker on its own line:

```text
Refs #N
<!-- idd-claimed-issue: N -->
```

Also include a short summary, verification commands/results, scope notes, and
any concrete follow-up. Do not add a closing association to a `next` PR.

After creation, re-fetch `baseRefName`, `headRefOid`, body, repository default
branch, and the live Issue association. The read-only
`scripts/idd-issue-association.mjs` evaluator must report `ready: true`, with
base `next`, an empty closing set, the exact marker once, and the active claim
matching this `{claim-id}`. A missing marker, extra marker, malformed body,
unexpected closing association, or unknown value is a hold; do not guess or
edit around it.

If the base is `main`, `release/**`, a feature branch, or unknown, stop and
route to a human maintainer. The exact `next` boundary is the only autonomous
PR route.

## D — CI handoff

Once the PR association is verified, read `idd-ci.instructions.md` and wait
for real hosted checks on the current PR head. On a successful current-head
CI result, continue to `idd-review-snapshot.instructions.md`; failures return
to the fix loop or a hold.
