# IDD — Work and self-review (B/C)

Read this file after a verified A5 claim. Keep the primary worktree on `next`
and make all implementation mutations in the sibling worktree.

## B1 — Sibling worktree

From the primary worktree, confirm it is on `next`, fetch `origin/next`, and
stop if local `next` has unpushed commits. Create the deterministic branch
from `origin/next` without switching the primary worktree:

```sh
git worktree add ../<repo>.<branch-with-slashes-replaced-by-dashes> \
  -b <branch> origin/next
```

If the claimed worktree already exists, inspect it and reuse it only when its
branch and lock belong to the current claim. An unlisted path or unrelated
branch is a hold, not a cleanup target. Immediately after creation, acquire
the atomic `idd-claim.lock`; only then run:

```sh
npm ci
```

Before B2, verify the primary branch is `next`, the sibling is listed, the
sibling path is the current directory, and its branch is the claimed branch.

## B2 — Plan checkpoint

Re-fetch the Issue and perform one bounded supersession check: confirm it is
still open and scan PRs merged at or after the claim timestamp for the Issue's
named candidate files. If the complete outcome already shipped, verify the
acceptance criteria on `next`, record the superseding PR, close the Issue, and
stop; otherwise continue.

Post a concrete draft plan to the Issue, critique it for correctness, scope,
and verification, then post a refined final plan. Revalidate the claim and
record the plan in the live status digest before writing implementation code.
No code is written before the final plan comment exists.

## B3 — Implement

Work only on the named Issue and candidate files. Before each write, apply the
shared claim/cwd/branch/lock revalidation gate. Keep commits atomic. Before
each commit run the `fix-validate` gate:

```sh
npm run check:runtime-order && npm run check:syntax
```

## C — Bounded self-review loop

After the implementation stabilizes, inspect the complete diff and run a
self-critique for requirement coverage, correctness, safety, and tests. Use
at most three passes:

1. classify each finding as high, medium, or low and accept only findings
   relevant to the Issue;
2. fix every accepted high/medium finding, or record why a low finding is
   outside scope; and
3. rerun `check:runtime-order`, `check:syntax`, and the affected focused test
   after every fix. Commit each logical fix before continuing.

When the diff is clean and the validation floor passes, continue to
`idd-pr-submit.instructions.md`. A failed validation is a fix, not a reason to
skip the loop. Use the hold rules in `idd-overview-appendix.instructions.md`
if ownership or external state prevents safe progress.
