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

- Status: superseded
- Superseded by: Issues #430/#431; the current tree has no balance profile or `balanceCreateInfinityUpgradeRows` override.
- Scope: balance profile/runtime overrides; Infinity Upgrade UI; `src/systems/balance.js`, `src/ui/render-infinity.js`, `src/systems/balance-ui.js`
- Learned from: Issue #364
- Context: a UI interaction added only to the canonical Infinity Upgrade renderer would not reach the shipped tree.
- Cause: the balance profile assigns `runtime.createInfinityUpgradeRows = runtime.balanceCreateInfinityUpgradeRows` during installation, replacing the renderer selected by `main.js`.
- Reusable lesson: historical; if a balance profile is reintroduced, check for an active builder override before changing the canonical renderer.
- Verification: `rg -n 'balanceCreateInfinityUpgradeRows|runtime\.createInfinityUpgradeRows' src tests scripts` finds no active implementation.
- Last verified: 2026-09-23

### EXP-ARCH-003 — Version checks must follow canonical ESM ownership

- Status: active
- Scope: ESM composition; import maps; `tests/version-consistency.mjs`
- Learned from: Issue #430
- Context: moving Eternity i18n and renderer loading to the canonical composition path made the version check report a missing cache buster on the old side-effect importer.
- Cause: the check enforced an incidental importer instead of the canonical module and import-map surface.
- Reusable lesson: when moving a versioned ESM dependency, update checks to validate its new canonical owner and import-map entry; do not preserve a side-effect import solely to satisfy a stale check.
- Verification: run `npm run check:version` and inspect the owner/import-map path after import-graph changes.
- Last verified: 2026-09-22
