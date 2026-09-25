# IDD — Reference appendix

Keep this page for small cross-phase rules that do not belong in the normal
route. The phase files remain authoritative for their own gates.

## Policy constants

Read timing and loop values from `docs/policy-constants.md` and
`.github/idd/config.json`. Do not invent a longer wait, an unbounded retry, or
a second merge gate.

## Live status digest

The optional human-facing digest starts with exactly:

```html
<!-- idd-live-status: current -->
```

It may summarize `Phase`, `Claim`, `Branch`, `Last checked`, `Open blockers`,
`Next action`, and `Authoritative by`. Revalidate the active claim before every
create or edit. The digest is context only; live Issue, PR, claim, CI, review,
and merge state remain authoritative. If multiple current digests exist,
report their URLs and edit none.

## Hold and abort

Before a hold, revalidate ownership and post the blocker plus a checkable
resume condition. Keep the claim during a hold and heartbeat it every 12 h.
Before aborting, update the digest if owned, then post the exact `unclaimed-by`
marker. If ownership is lost, do neither; report the handoff instead.

## Experience memory

For B2/B3, read only the topic routed by `docs/idd-experience/index.md`.
Record a new entry only for a reusable, non-obvious lesson after the diff is
stable and before PR submission. Current Issue text, policy/config, code, and
tests outrank experience records. Routine success needs no new entry.

## Commit and critique

Use `--no-gpg-sign` when non-interactive signing would block the command.
Every critique pass checks correctness, Issue coverage, safety, and
verification. A same-response self-critique is acceptable when no separate
review process is available, but validation remains load-bearing. Fix
high-severity findings and keep the loop bounded by the work phase.
