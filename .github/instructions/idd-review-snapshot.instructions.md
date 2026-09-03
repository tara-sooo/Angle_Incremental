# IDD — Review snapshot

Read this file after current-head CI. The snapshot is a local working set for
this pass; it is not an operational marker and does not authorize a merge.

## E1 — Collect current activity

Re-fetch the PR head and collect the complete review activity for that PR:

- all review threads, resolved or unresolved;
- all review-body submissions and states; and
- all regular PR comments.

Use the current head SHA for every item. Exclude only trusted IDD operational
comments that carry no review content. Keep human comments, human review
threads, and the internal critique in the snapshot.

## E2 — Build ReviewItems_snapshot

Keep a human review body in the worklist when it is `CHANGES_REQUESTED`, or
when a `COMMENTED` review contains a concrete finding or requested change.
Ignore acknowledgement-only comments such as `LGTM`; keep ambiguous comments
until their meaning is verified. Keep every unresolved actionable thread and
every actionable regular comment that has not received a response.

Run a bounded critique of the current diff for correctness, Issue coverage,
safety, and tests. Record the finding and source URL in the same worklist.

## E3 — Route

- Empty `ReviewItems_snapshot` → `idd-pre-merge.instructions.md`.
- Non-empty snapshot → `idd-review-triage.instructions.md`.

If the PR head moved while collecting activity, discard this snapshot and
restart E1. Never carry review conclusions across a head change.
