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

### EXP-WF-003 — Check live Issue state immediately before creating Issues

- Status: active
- Scope: GitHub Issue creation; batch Issue creation; concurrent/multi-agent repository work
- Learned from: duplicate Issues #205-#209; canonical Issues #200-#204
- Context: a second set of Eternity Milestone 6-10 Issues was created because the creation step relied on conversation-local understanding instead of re-checking the repository immediately before the write. The canonical Issues had already been created in the live repository.
- Cause: Issue creation was treated as if the repository state had not changed since the preceding discussion, which is unsafe when another session, agent, or concurrent workflow may have written related Issues.
- Reusable lesson: immediately before creating one or more Issues, search the live repository for existing open and recently created Issues matching each planned scope/title. For batch creation, verify every planned Issue against live results before the first write; do not rely on conversation memory alone to conclude that an Issue does not exist.
- Verification: search Issues using the planned feature names, milestone numbers, and distinctive scope keywords, and inspect recent Issues when concurrent work is plausible. If a matching Issue exists, update/reuse it instead of creating another.
- Authoritative at: not yet promoted
- Last verified: 2026-08-21

## Superseded lessons

None yet.