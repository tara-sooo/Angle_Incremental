# Runtime module layout

The gameplay runtime is split by responsibility and loaded as browser ES modules.

```text
src/
  core/
    constants.js       # thresholds, save version, timing and active balance constants
    state.js           # state object and serialized-field schema
    numbers.js         # log10 resources, huge-number helpers, formatting
    save.js            # local storage, migration, and reset
    save-code.js       # encrypted save-code export/import

  data/
    i18n.js            # TEXT and translation helper
    infinity-data.js   # Infinity upgrades and challenges

  systems/
    angle.js           # vertices, laps, score, normal upgrades, costs
    generation.js      # Generation multiplier, reward, reset logic
    core-boost.js      # Core Boost requirements, effects, reset logic
    infinity.js        # Infinity, IP, IU, IC, Infinite Angle
    achievements.js    # achievement definitions and unlock checks
  ui/
    dom.js             # DOM and canvas bindings
    render-ui.js       # shared helpers and UI update orchestration
    render-topbar.js   # news ticker and selectable top-bar modes
    render-challenges.js # Infinity Challenge rows
    render-infinity.js # Infinity Upgrade tree and detail panel
    render-achievements.js # achievement list
    render-automation.js # automation controls and statistics
    render-canvas.js   # polygon/canvas drawing and canvas resize
    events.js          # tabs, settings, and input binding via bindEvents()

  runtime/
    shared.js          # live runtime binding registry used across migrated modules

  main.js              # composition root, initialization, game frame, diagnostics
```

## Execution model

`index.html` loads `src/main.js` with `type="module"`. `main.js` imports every runtime module in deterministic dependency order. Each module imports `runtime` and `expose` from `src/runtime/shared.js`; `expose()` publishes its local live bindings into the shared registry, while cross-module references use that registry.

This preserves the original runtime's live mutable bindings and reset behavior without relying on `window` globals or dynamic classic-script injection. The browser entrypoint is ESM-only; direct links must load `index.html`.

## Offline Progress v2 boundary

Offline resume processing in `src/main.js` selects a path from the current
state. `automationEnabled` is not a blanket reason to disable every v2 path;
each family must pass its own eligibility predicate and event probe.

| State family | v2 behavior | Guarded fallback |
| --- | --- | --- |
| Quiet production and supported quiet Timeline routes | Bulk advance through the existing numeric-safe batch path. | Active challenges, unsafe numeric ranges, or a failed bulk predicate use bounded canonical updates. |
| Stable Auto Infinity at the zero threshold | Execute two canonical Infinity boundaries, prove the cycle is stable, then aggregate the remaining exact cycles. | Custom thresholds, Timeline/milestone/Infinite Angle state, purchases, challenges, or an unstable formula stay on event boundaries or canonical fallback. |
| Generation/Core Boost automation | Probe for the first changed boundary, bulk-advance before it, and commit the canonical reset ordering. | Challenges, Timeline, milestones, purchase interference, numeric failure, or dense events use guarded canonical batches. |
| Normal/IU/Infinite Angle/tower purchases and shipped milestone transitions | Probe for the first canonical action, commit it through the normal action path, then re-evaluate predictions. | An unknown or unsupported predicate defaults to canonical guarded simulation; no action is reimplemented in the offline engine. |

Every event boundary snapshots and restores state during speculative probes,
commits gameplay mutations through the canonical update/action functions, and
records prediction invalidation separately from committed work. Internal path,
event, cycle, fallback, ledger, and timing diagnostics belong to developer
reports; the player-facing offline result remains the existing before/after
progress report.

To add an event family safely, first define its canonical action and eligibility
predicate, then add a guarded-vs-accelerated differential case covering nearby
and invalidated boundaries. Add a one-million-tick browser scenario with exact
discrete-state assertions, structural work accounting, and a regression case
for the guarded fallback before changing its release boundary.

## Verification

- `tests/runtime-harness-esm.js` loads the canonical module runtime in a VM with a deterministic DOM and storage surface.
- `tests/runtime-invariants-module-runtime.js` checks numerical boundaries, challenge rules, automation, save-code integrity, and diagnostic hooks against that runtime.
- Feature-focused module-runtime tests cover normal upgrades, Generation, Core Boost, IU5-2/IU6-2, IC6–IC8, high-speed vertex processing, existing local saves, and bidirectional save-code import.
- `tests/browser-harness.mjs` owns the shared static server and Chromium setup. `tests/browser-smoke.mjs` keeps the short startup/save/visibility smoke path, while `tests/browser-feature-regression.mjs` and the focused Eternity browser tests cover detailed feature behavior.
- `npm run test:browser-smoke` runs only the fast critical-path smoke test; `npm run test:browser-features` runs feature-specific browser coverage; `npm run test:render-regression` remains the visual snapshot layer.
- GitHub Actions runs syntax checks, the ESM regression suite, the browser validation aggregate, and the separate hosted performance/offline jobs.
