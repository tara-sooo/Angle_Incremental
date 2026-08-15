# No-Advisory Review Policy Artifact

Use this artifact only when the repository intentionally relies on CI,
branch protection, unresolved-conversation checks, and any human review
rules configured outside IDD. Apply the complete surface below as one
workflow change so later agents do not wait for a reviewer that the
repository no longer uses.

## Adopter-Owned Values

These values are adopted by Angle Incremental:

- Reason no IDD-managed advisory reviewer is used: the repository uses the
  internal Codex critique loop, deterministic CI, and maintainer review; no
  external review bot is part of the development loop.
- Branch protection rule: no repository ruleset is currently registered;
  when configured, branch protection remains a merge gate.
- Human review rule outside IDD, if any: maintainers review PRs and own the
  final integration decision.
- Review-thread resolution profile: `fast-agent-resolve`, while unresolved
  conversations remain a pre-merge blocker.
- Merge policy: `human_merge`.
- Verification PR or dry-run reference: Issue #93 policy self-check and the
  full repository validation run on the implementing PR.

## Patch Surface

| File                                                       | Required local edit                                                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `.github/instructions/idd-review-fix.instructions.md`      | Remove the E14 advisory request and wait path.                                                                                             |
| `.github/instructions/idd-advisory-wait.instructions.md`   | Mark the advisory wait helper unused by this profile, or remove local references to it from the customized phase flow.                     |
| `docs/idd-advisory-wait-shell-fallback.md`                 | Mark the doc unused by this profile, or remove local references to it, matching the `idd-advisory-wait.instructions.md` disposition above. |
| `.github/instructions/idd-pre-merge.instructions.md`       | Gate on CI, branch protection, unresolved conversations, freshness, and claim evidence without requiring an advisory reviewer.             |
| `.github/instructions/idd-merge.instructions.md`           | Remove final advisory rechecks while keeping CI, claim, freshness, branch protection, and unresolved-thread checks.                        |
| `.github/instructions/idd-review-snapshot.instructions.md` | Keep human comments in scope and remove advisory-only PATH B requirements.                                                                 |
| `.github/instructions/idd-review-triage.instructions.md`   | Keep human review comments in the review universe and remove advisory-only disposition requirements.                                       |
| `.github/instructions/idd-merge-handoff.instructions.md`   | Carry review/critique evidence, rather than external-review state, into the `human_merge` handoff.                                       |
| `docs/idd-workflow.md`                                    | Document this repository's no-advisory route and remove the stale external-review default.                                                |
| `.github/workflows/regression.yml`                        | Run `check:idd-policy` as a load-bearing CI step.                                                                                          |
| `tests/idd-no-advisory-policy.mjs`                        | Guard the no-advisory surfaces and D4 → E1 → E2 → F2 → F2.5 routing invariants.                                                          |
| `docs/idd-review-policy-profiles.md`                       | Record the selected `no-advisory` profile and link to the local verification evidence.                                                     |
| `docs/customization.md` or another local policy document   | Record why no IDD-managed advisory reviewer is used and which outside gates still protect merges.                                          |

## Verification Evidence

Capture all of these before marking onboarding complete:

- Evidence that review-fix, pre-merge, and merge phases no longer
  request or wait for an advisory reviewer.
- A PR-state example showing CI and branch protection still gate
  merges.
- Confirmation that unresolved conversations remain visible to review
  snapshot and pre-merge checks.
- The final local diff showing every file in the patch surface was
  reviewed.

For this repository, the self-check also verifies that the active runtime
surfaces contain no external reviewer request, wait, recovery, or merge-gate
path; that `human_merge` and `next`/`main` semantics remain present; and that
the Codex critique contract remains available.

## Completion Note

```markdown
PR review policy profile: no-advisory
Reason: Internal Codex critique plus CI and maintainer review; no external
advisory reviewer is requested or awaited.
Branch protection rule: Any configured protection remains authoritative; no
ruleset is currently registered in this repository.
Review-thread resolution profile: fast-agent-resolve with unresolved-thread
blocking at pre-merge.
Verification evidence: Issue #93 policy self-check, IDD documentation review,
and the repository's `npm run validate` suite.
Profile artifact applied: profiles/no-advisory/README.md
```
