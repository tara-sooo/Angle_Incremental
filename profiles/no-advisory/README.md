# No-Advisory Review Policy Artifact

This repository uses its internal bounded critique, human review, and CI. No
external review bot is requested or awaited. This file records the selected
policy; the standard explicit-target route remains authoritative.

## Adopter-owned values

- Review policy: `no-advisory`
- Thread resolution: `fast-agent-resolve`; unresolved actionable threads block
  the merge
- Merge policy: `next` is autonomous after the final live gate;
  `main`, `release/**`, transition, and unknown bases are `human_merge` and
  fail closed
- Branch protection and rulesets remain authoritative when configured
- Verification: `npm run check:idd-policy` and `npm run validate`

## Active contract

The active route keeps human `COMMENTED` findings, human review threads,
`CHANGES_REQUESTED`, unresolved conversations, current-head CI, claim
ownership, and the exact `next` boundary in scope. It does not add a second
reviewer or an alternate wait state. The final merge command is bound to the
reviewed head with `--match-head-commit`; `--admin` is never an automatic
fallback.

Inactive compatibility documents are not loaded by the normal route and are
not part of this profile's verification surface.

## Completion note

```markdown
PR review policy profile: no-advisory
Reason: Internal critique plus CI and maintainer review; no external reviewer
is requested or awaited.
Merge boundary: exact `next` may be autonomous after the live gate; `main`,
`release/**`, and unknown bases require human handoff.
Verification: `npm run check:idd-policy` and `npm run validate`.
```
