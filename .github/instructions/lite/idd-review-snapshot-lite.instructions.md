# IDD — Review Snapshot Phase (Lite)

The lite route uses the same `no-advisory` review policy as the normal route.
Fetch the current head, all review threads and bodies, ordinary PR comments,
and CI state. Exclude only trusted IDD operational markers; keep every human
or ordinary comment that contains a finding in the review snapshot.

Post a trusted same-claim review watermark only after merge-counted CI runs
finish. On resume, a missing or foreign watermark requires a fresh snapshot.

Run one bounded Codex critique pass, using a read-only native subagent when
suitable and structured self-critique otherwise. Review the branch diff and
append findings to `ReviewItems_snapshot`; keep the existing C/E convergence
guards and do not bypass claim, CI, unresolved-conversation, or `human_merge`
checks. Empty snapshots continue to branch-sync and merge readiness; non-empty
snapshots continue to lite triage.
