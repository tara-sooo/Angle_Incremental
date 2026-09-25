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
the atomic `idd-claim.lock`. Do not install dependencies by default; run
`npm ci` only when the selected validation profile requires an installed
dependency.

Before B2, verify the primary branch is `next`, the sibling is listed, the
sibling path is the current directory, and its branch is the claimed branch.

## B2 — Plan checkpoint

Re-fetch the Issue and perform one bounded supersession check after claim:
confirm it is open and inspect PRs merged since the claim for scoped files.
If the complete outcome shipped, verify acceptance on `next`, record the
superseding PR, close the Issue, and stop; otherwise plan only remaining work.

Choose a planning profile from Issue scope and live provenance, not preference:

- **Simple:** deterministic, low-ambiguity sync/docs/metadata work; one concise
  plan/status entry, with no separate draft and final plan comments.
- **Standard:** bounded code changes; one plan with a bounded inline critique,
  without reposting an equivalent plan.
- **Complex:** cross-system, architectural, high-risk, or materially ambiguous
  work such as save/progression architecture, balance formulas, broad runtime
  refactors, or ambiguous cross-system changes; draft, critique for
  correctness/scope/verification, then refined final.

Unknown scope uses the more thorough profile. Record the selected profile and
plan in the live status digest before implementation. Do not write code before
the selected profile's plan checkpoint is complete.

## B3 — Implement

Work only on the named Issue and candidate files. Before each write, apply the
shared claim/cwd/branch/lock revalidation gate. Keep commits atomic. Before
each commit run the `fix-validate` gate:

```sh
npm run check:runtime-order && npm run check:syntax
```

## Local performance evidence boundary

When an Issue explicitly requires `npm run test:performance` during B/C or
before push, run it and record its report. The Issue request changes the
evidence collected, not gate selection: run the selected performance profile
and keep the selected pre-push requirements. The routine profile is
npm run validate; hosted-CI retry/hold rules do not apply to local results.

| local result | B/C action |
| --- | --- |
| `local-performance-pass` | record evidence and continue |
| timing-budget-only failure | record evidence; do not count it as a hosted-CI failure or invoke a rerun/second-failure hold |
| repeated local timing-budget failures | apply the same evidence-only treatment; failure count alone never invokes hosted-CI hold semantics |
| `local-performance-regression` | stop for candidate-specific repair |
| `local-performance-inconclusive` | continue to PR; hosted CI is required |
| malformed/non-timing report, invalid trusted-base state, or ownership failure | fail closed |

If a strict local timing result needs classification, use
`npm run test:performance:local` against the trusted `origin/next` state. A
strict local timing overage alone is not a hold; a baseline-aware
`local-performance-regression` remains a blocking candidate regression.

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
