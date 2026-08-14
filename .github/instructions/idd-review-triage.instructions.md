# IDD — Review Triage Phase (E4–E8)

Read this file after `idd-review-snapshot.instructions.md` (E3) finds a
non-empty `ReviewItems_snapshot`. The `no-advisory` profile keeps one review
universe: human feedback, ordinary PR feedback, review threads, and Codex
critique findings are all triaged here. No external reviewer is requested,
waited for, or used as a merge gate.

Before every reply, resolution, or digest update, revalidate the active
claim and the worktree branch.

## E4 — Classify and score ReviewItems_snapshot

Treat each actionable human or ordinary PR item, `CHANGES_REQUESTED` review,
unresolved thread, and critique finding as PATH A. If an automated comment is
only a status, quota, or error notice and contains no finding, record it as
non-actionable context; never treat it as proof of review and never request a
replacement reviewer because of it. If classification is ambiguous, use PATH
A and verify the claim against the live diff.

Score PATH A items by severity and relevance:

- High safety, correctness, requirement, or CI findings are forced Accepted
  after live verification.
- Medium findings require an explicit Accept or Reject decision.
- Low or unrelated findings are Reject candidates, with a reason.

Before accepting a claimed defect, reproduce it with a code read, test, or
equivalent live evidence. A verified-false claim is a reasoned rejection, not
an implementation task. Record actor permission for the maintainer decision
cap; CODEOWNER and required-reviewer items cannot be rejected unilaterally.

## E5 — Record decisions

Every item gets exactly one Accept or Reject decision. Accepted items enter
E9 review-fix; rejected reviewer feedback receives an individual explanation.
Do not combine several source items into one disposition.

Use these prefixes at the start of replies:

```text
**Rejected** — {verified reason and evidence}
**Awaiting maintainer decision** — {why a required decision is needed}
```

An Accepted item is acknowledged after its fix in E13. A review-thread
rejection is resolved only after its reply; a maintainer-decision thread stays
open and blocks the merge. Regular comments receive a reply but have no thread
resolution operation.

## E6 — Reply and resolve

Revalidate the claim immediately before each GitHub side effect. Reply to
every rejected reviewer item individually, resolve non-maintainer-decision
threads after the reply, and keep a hold comment for any pending maintainer
decision. If a reviewer reopens or disputes a rejection, restart at E1 and
triage the new activity rather than assuming the old decision still holds.

When an Accepted item is fixed, E13 replies with the commit SHA and resolves
the corresponding thread. Human required-reviewer states still control the
pre-merge gate.

## E7 — Verify dispositions

Before leaving triage, verify that every snapshot item has a classification,
an evidence-backed decision, and the required reply or resolution. Ensure no
unresolved actionable thread or unreplied ordinary PR comment is hidden by a
status-only interpretation. If verification is incomplete, remain in triage
or post a maintainer hold; do not proceed to merge readiness.

## E8 — Route the next phase

- Accepted PATH A count greater than zero → `idd-review-fix.instructions.md`
  E9.
- No Accepted items and a clean branch state → refresh the watermark only
  after the full activity/CI fetch, then continue to F1/F2.
- Any branch conflict or new activity → fetch `next`, merge it into the issue
  branch through the documented sync path, run `fix-validate`, and return to
  E1.

The bounded critique-loop guards in `docs/policy-constants.md` still apply to
E2, E10, and C1. A clean critique or a rejected comment never bypasses CI,
review currency, unresolved conversations, claim ownership, or the
`human_merge` boundary.
