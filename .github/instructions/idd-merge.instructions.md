# IDD — Merge, completion, and cleanup

Read this file after `idd-pre-merge.instructions.md` and the branch-policy
handoff pass. The final live gate must have produced a current head SHA.

## Merge

Revalidate the Issue claim, PR base, head SHA, CI, review state, mergeability,
cwd, branch, and lock immediately before the command. If the head changed or
any condition is unknown, return to the final live gate.

For an autonomous `next` PR, use a merge commit bound to that exact SHA:

```sh
gh pr merge <pr-number> --merge --match-head-commit "<validated-head-sha>"
```

Do not squash, rebase, or retry with `--admin`. A plain merge failure is a
hold with the GitHub error and the maintainer resume condition.

## Completion evidence

After a successful merge, re-fetch the PR and Issue. For a `next` PR whose
base differs from the repository default branch, verify `mergedAt`, the full
merge SHA, visible `Refs #N`, exactly one
`<!-- idd-claimed-issue: N -->` marker, and an empty closing association.
Revalidate the claim, then close the Issue as completed:

```sh
gh issue close <issue-number> --reason completed
```

After confirming it is closed, post and verify one completion comment such as:

```markdown
<!-- idd-next-issue-completion: N -->
Completed by PR #P (merge {merge-sha}).
```

If closing or evidence fails, record the exact reconciliation failure and
resume from live state. Never undo a successful merge or reopen the Issue.

## Cleanup

After merge and completion evidence are verified, revalidate ownership and
remove only this session's sibling worktree and local branch. Update the
primary worktree to `next`, delete the remote issue branch when policy allows,
and verify the PR is merged and the Issue is closed. Preserve other worktrees,
branches, and human discussion. Cosmetic comment cleanup is optional and
never a merge condition.
