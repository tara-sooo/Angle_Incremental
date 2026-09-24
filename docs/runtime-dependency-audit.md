# Runtime dependency audit

This snapshot inventories the 667 `expose()` registrations under `src/` by
owner. The registrations themselves remain the canonical API-name list:

```sh
rg -n '^\s*expose\("' src --glob '*.js'
```

The classification is intentionally by role, not exclusive per name: an API
can be both a production dependency and a debug/test compatibility surface.

| Owner | APIs | Classification and reason retained |
| --- | ---: | --- |
| `src/core/constants.js` | 92 | Shared immutable game, persistence, and timing configuration read across domains. |
| `src/core/numbers.js` | 36 | Cross-domain numeric parsing, normalization, arithmetic, and formatting helpers. |
| `src/core/offline-progress.js` | 14 | Offline lifecycle state and operations; `updateUi`/`saveGame` remain replaceable because this owner installs batching wrappers. |
| `src/core/save-code.js` | 8 | Save-code operations shared with UI and persistence flows. |
| `src/core/save.js` | 32 | Persistence state and save/recovery operations shared with lifecycle, UI, and tests. |
| `src/core/state.js` | 8 | Canonical mutable game state and tab configuration. |
| `src/data/i18n.js` | 2 | Shared text catalog and translation function. |
| `src/data/infinity-data.js` | 2 | Shared Infinity challenge and upgrade definitions. |
| `src/main.js` | 1 | Font-ready state retained for debug compatibility. |
| `src/runtime/automation.js` | 6 | Automation lifecycle state and cross-system entrypoints. |
| `src/runtime/browser-lifecycle.js` | 10 | Browser visibility, storage, and save-conflict lifecycle shared with core/save. |
| `src/runtime/clock.js` | 9 | Clock state/services shared with offline processing and browser lifecycle. |
| `src/runtime/debug-adapter.js` | 1 | `renderGameToText`, the supported text-debug adapter. |
| `src/runtime/game-loop.js` | 17 | Frame/update state and operations shared with offline simulation and systems. |
| `src/runtime/update-check.js` | 8 | Update-check state and UI/persistence operations. |
| `src/systems/achievements.js` | 6 | Achievement data and operations consumed across gameplay and UI. |
| `src/systems/angle.js` | 77 | Core progression state and operations consumed across gameplay systems. |
| `src/systems/core-boost.js` | 14 | Core Boost calculations and reset operations consumed across progression systems. |
| `src/systems/eternity.js` | 33 | Eternity progression, reset, and milestone operations shared with other systems and UI. |
| `src/systems/generation.js` | 21 | Generation calculations and actions consumed across progression systems. |
| `src/systems/infinite-angle.js` | 27 | Infinite Angle progression operations and state shared with gameplay/UI. |
| `src/systems/infinity.js` | 43 | Infinity progression, challenge, and upgrade operations shared across systems and UI. |
| `src/systems/time-flux.js` | 15 | Time Flux domain operations; the duplicate offline-tick clamp was removed in favor of `core/save.js`. |
| `src/systems/timeline.js` | 41 | Timeline state and progression operations shared across systems/UI. |
| `src/systems/tower.js` | 60 | Tower and challenge definitions/operations consumed across progression systems and UI. |
| `src/ui/dom.js` | 5 | Shared references to the page's canvas, context, and elements. |
| `src/ui/events.js` | 19 | Tab state and event operations used by startup and UI behavior. |
| `src/ui/render-achievements.js` | 2 | Renderer API retained for debug/test access; row updates are now imported by `render-ui.js`. |
| `src/ui/render-automation.js` | 4 | Renderer/statistics API retained for debug/test access; updates are now imported by `render-ui.js`. |
| `src/ui/render-canvas.js` | 9 | Canvas state and drawing APIs shared with gameplay and startup. |
| `src/ui/render-challenges.js` | 4 | Challenge row APIs retained for debug/test access; updates are now imported by `render-ui.js`. |
| `src/ui/render-eternity.js` | 2 | Eternity renderer API retained for debug/test access; updates are explicitly imported. |
| `src/ui/render-help.js` | 1 | Help renderer API retained for debug/test access; updates are now imported by `render-ui.js`. |
| `src/ui/render-infinity.js` | 7 | Infinity UI state/actions shared with event handling; row updates are now imported by `render-ui.js`. |
| `src/ui/render-offline-report.js` | 2 | Offline report renderer API retained for debug/test access; updates are now imported by `render-ui.js`. |
| `src/ui/render-save-recovery.js` | 1 | Recovery renderer API retained for debug/test access; updates are explicitly imported. |
| `src/ui/render-time-flux.js` | 2 | Time Flux renderer API retained for debug/test access. |
| `src/ui/render-timeline.js` | 2 | Timeline renderer API retained for debug/test access; updates are explicitly imported. |
| `src/ui/render-topbar.js` | 5 | Top-bar state/API retained for debug/test access; updates are now imported by `render-ui.js`. |
| `src/ui/render-ui.js` | 19 | UI-owned helpers plus the wrapped `updateUi` seam; domain renderer calls are explicit imports. |

## What changed

- `main.js` now imports startup functions from their owning modules: save
  loading, canvas operations, row creation, event binding/tab switches, clock,
  update checks, and frame scheduling.
- `render-ui.js` imports domain update functions from their renderers instead
  of looking them up through `runtime`. Existing named imports for Eternity,
  Timeline, save recovery, and exact-integer formatting remain explicit.
- `clampOfflineTickCount` has one canonical implementation in `core/save.js`
  and is imported by its two consumers; the duplicate Time Flux exposure is
  gone.
- Score-ordering achievements receive the projected score as an argument;
  `angle.js` no longer temporarily replaces `runtime.currentScoreLog10`.
- `check-runtime-esm-loader-order.js` fixes only the remaining legacy
  side-effect imports and checks the new named owner imports. The imported
  functions remain exposed for `window.__angleDebug.runtime` compatibility.

## Why `runtime` remains

- Shared mutable state, DOM references, constants, catalogs, and lifecycle
  counters are read across multiple domains and remain the compatibility
  boundary for now.
- Gameplay systems still call one another through runtime APIs. This Issue
  converts verified acyclic edges, not the entire graph; remaining edges need
  their own ownership/cycle review before conversion.
- The debug adapter exposes the runtime object, and tests/browser checks
  intentionally replace APIs including `updateUi`, `saveGame`, `update`,
  `processOfflineElapsed`, and selected progression functions. Those setters
  remain deliberate seams.
- Setters for the migrated startup functions, renderer-only functions,
  `loadGame`, `clampOfflineTickCount`, and `currentScoreLog10` were removed
  where the repository has no writer. The offline batching wrappers and
  existing test seams were preserved.

No runtime API rewrite, debug-adapter replacement, module relocation, or
player-visible change is part of this migration.
