# IDD — Review triage

Read this file when the current review snapshot contains items. Human review
and the internal critique are evidence; neither can silently be discarded.

## E4 — Verify each item

For every worklist item, read the referenced code and Issue requirement.
Classify it as:

| result | action |
| --- | --- |
| accepted, relevant | fix it in the review-fix phase |
| rejected, irrelevant or already satisfied | reply with the reason |
| ambiguous, safety-related, or requiring a maintainer decision | hold and report |

Always accept a real correctness, safety, data-loss, or CI-stability problem.
Do not close a human thread without a concise reply. Do not resolve an
actionable thread until its fix or reasoned disposition is visible.

## E5 — Check the worklist

Before leaving triage, verify that every actionable human item has a reply and
that every accepted item is listed for the fix phase. Any unresolved
actionable thread, unreplied actionable comment, or human
`CHANGES_REQUESTED` state blocks the merge. An acknowledgement-only comment
does not create a blocker.

- Accepted items → `idd-review-fix.instructions.md`.
- Only rejected or already-satisfied items remain →
  `idd-pre-merge.instructions.md`.

After any new reviewer activity or head change, return to
`idd-review-snapshot.instructions.md` and rebuild the worklist.
