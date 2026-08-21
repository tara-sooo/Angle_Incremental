# Workflow experience

## Promoted lessons

### EXP-WF-001 — Integration and release merge authority are different

- Status: promoted
- Scope: IDD merge routing; `next`, `main`, `release/**`
- Learned from: Issue #104; PR #101 investigation context
- Context: a repository-wide merge rule did not represent the intended distinction between integration work and release authority.
- Cause: the desired authority boundary is branch-specific rather than repository-wide; exact attribution for the motivating PR #101 merge remained uncertain.
- Reusable lesson: determine merge authority from the live base branch and fail closed for unknown/release bases; do not infer actor attribution beyond available evidence.
- Verification: run the branch-policy regression and inspect the live base branch before merge.
- Authoritative at: `docs/idd-policy.md`, `.github/idd/config.json`, `scripts/branch-merge-policy.mjs`, and the F2.5/F3 merge instructions
- Last verified: 2026-08-21

Because this lesson is promoted, future workers must follow the listed authoritative surfaces rather than this historical summary.

## Active lessons

### EXP-WF-002 — Persist repository-mutating lessons before merge

- Status: active
- Scope: IDD experience lifecycle; C-phase finalization; F4 cleanup
- Learned from: Issue #198
- Context: the first design placed experience extraction in F4 cleanup, after the implementation PR had already merged.
- Cause: a repository-backed memory entry created only after F3 cannot be included in the PR that discovered it without an extra post-merge mutation or follow-up change.
- Reusable lesson: assess and write reusable experience after the implementation diff stabilizes in C and before PR submission; keep F4 report-only for experience.
- Verification: confirm the shared experience instruction places capture before PR submission and explicitly forbids a new F4 repository mutation/gate.
- Authoritative at: not yet promoted; `.github/instructions/idd-experience.instructions.md` is the current implementation of this active lesson
- Last verified: 2026-08-21

## Superseded lessons

None yet.