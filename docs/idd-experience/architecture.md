# Architecture experience

### EXP-ARCH-001 — Local baseline commands must exist on the trusted base

- Status: active
- Scope: validation architecture; `scripts/local-performance-gate.mjs`, `tests/performance-smoke.mjs`, `package.json`
- Learned from: Issue #221
- Context: the local gate creates a fresh detached `origin/next` worktree and runs the same timing measurement there as on the candidate.
- Cause: a candidate-only npm script or benchmark entry point is not available in the trusted-base worktree, so it cannot provide comparable evidence.
- Reusable lesson: local baseline comparison must invoke a command and report contract present on both revisions, or explicitly run a shared harness against each revision; do not call a candidate-only script in the baseline worktree.
- Verification: run `npm run test:performance:local` and confirm candidate/base measurements use the same focused timing command and report matrix.
- Last verified: 2026-08-22
