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

### EXP-ARCH-002 — Balance profiles can replace runtime UI builders

- Status: active
- Scope: balance profile/runtime overrides; Infinity Upgrade UI; `src/systems/balance.js`, `src/ui/render-infinity.js`, `src/systems/balance-ui.js`
- Learned from: Issue #364
- Context: a UI interaction added only to the canonical Infinity Upgrade renderer would not reach the shipped tree.
- Cause: the balance profile assigns `runtime.createInfinityUpgradeRows = runtime.balanceCreateInfinityUpgradeRows` during installation, replacing the renderer selected by `main.js`.
- Reusable lesson: when changing a runtime UI builder, search profile and variant modules for assignments that replace the runtime function; update every active builder or introduce one shared hook only when it removes real duplication.
- Verification: search assignments to the runtime builder and exercise the shipped balance profile through browser interaction coverage.
- Last verified: 2026-09-12
