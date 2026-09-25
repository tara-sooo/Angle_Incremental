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

### EXP-WF-004 — Do not remap authoritative feature terms to nearby existing mechanics

- Status: active
- Scope: IDD B2/B3 planning and critique; authoritative Issue interpretation; implementation mapping; regression-test semantics
- Learned from: Issue #121; PR #148; PR #153
- Context: Issue #121 explicitly specified Milestone 5 as `unlock IU automation`, and the later player-facing copy preserved that meaning. During implementation planning, the unfamiliar capability was reinterpreted as the already-existing IU 8-1 Infinity automation path, so PR #148 implemented Milestone 5 as an Auto Infinity unlock and tests then encoded that changed meaning as expected behavior.
- Cause: the plan optimized for an existing implementation surface instead of preserving the authoritative Issue terminology. `IU automation` was silently mapped to the nearest known automation mechanic (`Infinity automation`) without an explicit maintainer decision or source text supporting that equivalence; critique and tests then validated the drifted plan rather than comparing it back to the Issue.
- Reusable lesson: when an authoritative Issue names a capability that does not appear to exist in the codebase, do not substitute a nearby existing mechanic merely because it is easier to wire. Treat the missing capability as new implementation work or surface the ambiguity for an explicit maintainer decision. Preserve the Issue's nouns, verbs, targets, and scope through B2/B3, and require any semantic reinterpretation to be justified against the authoritative source rather than implementation convenience.
- Verification: before implementation and again when finalizing tests, compare each user-visible effect in the plan/test assertions against the authoritative Issue wording. Flag terminology changes such as `IU automation` -> `Infinity automation`, verify that the named target object/action is the same, and stop for clarification when the requested capability has no matching implementation surface. Tests must validate the authoritative semantics, not merely the behavior introduced by the current patch.
- Authoritative at: not yet promoted
- Last verified: 2026-08-24

### EXP-WF-005 — Preserve IDD-managed markers when rewriting PR metadata

- Status: active
- Scope: IDD PR-body refresh/regeneration; Issue/PR association; D3.5 merge-boundary verification
- Learned from: Issue #237; PR #240
- Context: PR #240 initially contained the canonical association marker `<!-- idd-claimed-issue: 237 -->`. A later automated PR-body refresh replaced the body with updated research results but preserved only `Refs #237`, dropping the workflow-owned marker. D3.5 correctly failed closed with `marker-mismatch` and placed the otherwise valid PR on hold.
- Cause: the PR-body updater treated generated prose as the complete body and did not preserve or deterministically regenerate workflow-owned metadata required by later phases.
- Reusable lesson: whenever IDD rewrites or regenerates PR metadata, preserve IDD-managed association/claim markers exactly once, or deterministically regenerate them from the active claim. Human-readable references such as `Refs #N` are not substitutes for machine-readable workflow markers. A metadata refresh must not invalidate downstream workflow state that was valid before the refresh.
- Verification: after every automated PR-body rewrite, inspect the live PR body and verify the required canonical marker appears exactly once, then run/re-run the live Issue/PR association check before entering merge-boundary phases. If association is not `ready: true`, stop before merge and repair the metadata rather than treating implementation or CI as the blocker.
- Authoritative at: not yet promoted
- Last verified: 2026-08-29

## Superseded lessons

None yet.
