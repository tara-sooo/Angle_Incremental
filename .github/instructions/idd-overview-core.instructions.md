---
applyTo: "**"
excludeAgent: "code-review"
---

# IDD — Angle Incremental shared contract

This is the short, safety-critical contract for the normal IDD route. The
operator supplies one explicit Issue target; no unattended issue selection is
performed.

## Normal route

```text
explicit target → readiness → suitability → claim → sibling worktree
→ plan/critique → implement → bounded self-review and validation
→ PR to next → current-head CI → review/fix loop
→ one final live merge gate → merge → completion evidence and cleanup
```

Read this file first, then the phase file for the current step. The active
phase files are `idd-discover`, `idd-suitability`, `idd-claim`, `idd-work`,
`idd-pr-submit`, `idd-ci`, `idd-review-snapshot`, `idd-review-triage`,
`idd-review-fix`, `idd-pre-merge`, `idd-merge-handoff`, `idd-merge`,
`idd-resume`, and `idd-resume-stall`.

## Operational markers

New claim comments use this exact body, posted as a JSON `POST` with a visible
note after the HTML marker:

```markdown
<!-- claimed-by: {agent-id} {claim-id} supersedes: {prior-claim-id|none} {ISO8601-timestamp} branch: {branch-name} -->

_{agent-id}: issue claim — IDD automation marker. Do not edit._
```

Release a claim only with:

```markdown
<!-- unclaimed-by: {agent-id} {claim-id} {ISO8601-timestamp} -->

_{agent-id}: issue claim released — IDD automation marker. Do not edit._
```

Every fresh claim, takeover, or migration also posts one activation marker:

```markdown
<!-- activation-nonce: {agent-id} {claim-id} {nonce} {ISO8601-timestamp} -->

_{agent-id}: claim activation nonce — IDD automation marker. Do not edit._
```

`claim-id` is a fresh opaque token for each claim lineage. An `agent-id` alone
never proves ownership. Heartbeats reuse the verified pair and copy the
original branch exactly.

## Trusted claim state

Parse trusted comments in GitHub `created_at` order. Ignore marker-shaped
comments from untrusted actors. A new claim activates only when there is no
active claim and `supersedes: none`, or when it supersedes an already-stale
claim. A heartbeat must match the active agent, claim, and branch exactly.
An unclaim releases only the exact active pair. The stale threshold is 24 h;
heartbeat at least every 12 h when work may exceed that age.

After a claim write, wait the configured 5 s settle interval and verify:

- the active claim is the current `claim-id`;
- any same-second claim race is won by the lexicographically earliest
  `claim-id`;
- no later trusted competing claim exists; and
- the activation-nonce winner is the nonce recorded by this session.

Ambiguous or unavailable state is fail-closed. A claim that cannot be proved
current is lost, even when its `agent-id` looks familiar.

## Claim revalidation before mutation

Immediately before every local or GitHub write—comment, label, commit, push,
reply, resolution, merge, or cleanup—re-fetch the Issue and re-parse the
active claim. The current `{claim-id}` and activation nonce must still win.
For worktree mutations, also verify:

1. `git rev-parse --show-toplevel` is the sibling path derived from the
   claimed branch (`../<repo-name>.<branch-with-slashes-replaced-by-dashes>`).
2. `git branch --show-current` exactly equals the claimed branch.
3. The worktree-local `idd-claim.lock` is acquired by an atomic create before
   the mutation. A lock held by another pair is a collision; do not delete or
   override it.

If any check fails, stop and report. Never continue from the primary worktree
or from a branch different from the active claim.

## Repository commands

The values in `.github/idd/config.json` override this table:

| purpose | command |
| --- | --- |
| install | `npm ci` |
| fix-validate | `npm run check:runtime-order && npm run check:syntax` |
| pre-push/post-fix | `npm run validate` |

## Branch boundary

Ordinary Issue PRs target the exact `next` branch. `next` may use the
autonomous merge route only after the final live gate. `main`, `release/**`,
transition PRs, and unknown bases are human-controlled and fail closed.

## Phase routing

| state | read next |
| --- | --- |
| explicit Issue supplied | `idd-discover` → `idd-suitability` → `idd-claim` |
| claim and branch/worktree, no PR | `idd-work` |
| PR created or CI pending | `idd-pr-submit` → `idd-ci` |
| PR has review activity | `idd-review-snapshot` → `idd-review-triage` or `idd-review-fix` |
| ready to merge | `idd-pre-merge` → `idd-merge-handoff` → `idd-merge` |
| crash, handoff, or stale session | `idd-resume` → `idd-resume-stall` when needed |

The experience contract is read from `idd-experience.instructions.md` and
`docs/idd-experience/index.md` only for the current Issue.
