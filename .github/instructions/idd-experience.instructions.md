---
applyTo: "**"
excludeAgent: "code-review"
---

# IDD — Repository Experience

This file defines the repository-local experience layer used by IDD. It preserves reusable project knowledge across sessions and agent vendors without relying on hidden conversational memory or an external service.

Experience is advisory evidence. It never overrides the current Issue, an explicit maintainer decision, the checked-out code/specification, repository policy/configuration, or current test/CI evidence. When experience conflicts with a higher-authority source, follow the higher-authority source and update or supersede the stale experience when that edit is in scope.

## Before B2/B3 — scoped experience lookup

Before drafting the B2 plan, and again before B3 only when the planned scope changed materially:

1. Read `docs/idd-experience/README.md` and the small routing table in `docs/idd-experience/index.md`.
2. Derive relevant topics from the current Issue, its `## Candidate files` when present, and the files/subsystems the plan is likely to touch.
3. Open only the matching topic files that currently exist. Do not read every topic file or the whole experience directory by default.
4. Consider only entries whose scope applies. For `promoted` entries, follow the linked authoritative policy/test/document rather than the historical summary. For `superseded` entries, use them only as provenance.
5. If an active lesson changes the implementation or verification approach, mention its ID in the B2 plan. If no relevant lesson exists, continue silently; absence of experience is not a blocker and does not require a comment.

Do not use repo-wide Issue search as an experience lookup mechanism. Experience lookup is repository-file scoped and does not relax the explicit-target-only Discover policy.

## Record schema

Topic files use compact records with this shape:

```markdown
### EXP-<TOPIC>-NNN — Short title

- Status: active | promoted | superseded
- Scope: topic names and/or repository paths
- Learned from: Issue #N; PR #N when available
- Context: concise symptom or situation
- Cause: validated explanation, or `uncertain` with the uncertainty stated
- Reusable lesson: the smallest rule worth carrying forward
- Verification: how a future session checks that the lesson still applies
- Authoritative at: required for `promoted`; optional otherwise
- Last verified: YYYY-MM-DD or `unknown`
```

Do not invent a cause merely to fill the schema. Provenance and uncertainty are more valuable than false completeness.

## Capture timing and threshold

Experience capture is optional. Routine successful work with no reusable lesson creates no entry and no mandatory `none` artifact.

After the implementation diff has stabilized in C, but before leaving C for PR submission, assess whether the Issue produced a reusable lesson. Capture or update a lesson only when at least one is true:

- meaningful debugging corrected a false assumption;
- the same failure class can plausibly recur;
- the finding changes how future agents should inspect, plan, implement, or verify related work;
- review/CI exposed a project-specific invariant not already documented;
- forgetting the finding would likely waste meaningful future effort.

When capture is warranted:

1. Search the relevant topic file for the same rule/symptom/scope and update that record instead of appending a near-duplicate.
2. Preserve prior Issue/PR provenance and add the new provenance.
3. Keep uncertain explanations explicitly uncertain.
4. If the lesson has become a stable project rule, promote it to normal documentation/policy. If it can be mechanically enforced, prefer a deterministic test/helper/CI gate. Mark the experience record `promoted` and link `Authoritative at` instead of maintaining competing normative copies.
5. If the experience edit changes the branch diff, return to C1 and satisfy the normal critique and `fix-validate` floor before PR submission.

Never store private chain-of-thought, full agent transcripts, credentials, or unrelated conversation history in the experience store.

## F4 completion boundary

F4 may report `Experience: captured EXP-...`, `Experience: promoted EXP-...`, or `Experience: none` from the already-merged diff, but F4 does not create a new repository mutation after merge and experience is not a new completion/human gate. A missed non-safety lesson does not reopen, unmerge, or make an otherwise completed Issue incomplete.

## Lifecycle

Use this progression instead of letting the experience store become permanent duplicate policy:

```text
contextual/reusable observation
  -> active experience

stable/repeated project rule
  -> normal docs / policy / contributor guidance
  -> experience status: promoted

mechanically enforceable rule
  -> deterministic test / helper / CI
  -> experience status: promoted

invalidated historical lesson
  -> experience status: superseded
```

Keep promoted/superseded records concise for provenance. The current authoritative surface remains the source of truth.