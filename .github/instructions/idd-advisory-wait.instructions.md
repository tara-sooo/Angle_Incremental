# IDD — Advisory-Wait Protocol (inactive)

This repository selects the `no-advisory` profile. No IDD phase requests,
waits for, recovers an external reviewer, or posts an advisory-wait marker.
E14 moves from human-review handling to the CI wait phase; F2 and F3 use
review-currency, unresolved-conversation, claim, branch, and CI evidence.

The file remains as an explicit profile boundary for resume routing. Do not
restore an external reviewer path here unless the repository changes
`reviewPolicy` and applies a different documented profile in one change.

Human and ordinary PR feedback stays in the E1 snapshot and E4-E8 triage
universe. Codex critique passes are separate internal checks and continue to
use the bounded convergence rules in the work and review-fix instructions.
