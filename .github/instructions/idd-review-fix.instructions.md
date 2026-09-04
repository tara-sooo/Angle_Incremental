# IDD — Review fix

Read this file after triage accepts a relevant item.

1. Revalidate the claim, cwd, claimed branch, and worktree lock.
2. Fix the accepted items in the sibling worktree and keep the diff scoped.
3. Run `npm run check:runtime-order && npm run check:syntax` and the affected
   focused test; commit each logical fix.
4. Push the new commit, reply to each human item with the result, and resolve
   a thread only after its fix or disposition is visible.
5. Return to `idd-ci.instructions.md` for CI on the new head, then rebuild the
   review snapshot.

If a response needs a maintainer decision, leave the thread unresolved, post a
hold with the resume condition, and do not merge.
