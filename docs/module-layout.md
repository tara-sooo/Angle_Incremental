# Runtime module layout

The gameplay runtime is split by responsibility and loaded as browser ES modules.

```text
src/
  core/
    constants.js       # thresholds, save version, timing and balance constants
    state.js           # state object and serialized-field schema
    numbers.js         # log10 resources, huge-number helpers, formatting
    save.js            # local storage, migration, and reset
    save-code.js       # encrypted save-code export/import

  data/
    i18n.js            # TEXT and translation helper
    infinity-data.js   # Infinity upgrades, challenges, balance profile

  systems/
    angle.js           # vertices, laps, score, normal upgrades, costs
    generation.js      # Generation multiplier, reward, reset logic
    core-boost.js      # Core Boost requirements, effects, reset logic
    infinity.js        # Infinity, IP, IU, IC, Infinite Angle
    achievements.js    # achievement definitions and unlock checks
    balance.js         # installs the active balance profile
    balance-angle.js   # angle and normal-upgrade balance rules
    balance-generation.js # Generation balance rules and save restoration
    balance-core-boost.js # Core Boost balance rules
    balance-infinity.js # IP and Infinity Upgrade balance rules
    balance-ui.js      # active Infinity Upgrade tree layout

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

## Verification

- `tests/runtime-harness-esm.js` loads the canonical module runtime in a VM with a deterministic DOM and storage surface.
- `tests/runtime-invariants-module-runtime.js` checks numerical boundaries, challenge rules, automation, save-code integrity, and diagnostic hooks against that runtime.
- Feature-focused module-runtime tests cover normal upgrades, Generation, Core Boost, IU5-2/IU6-2, IC6–IC8, high-speed vertex processing, existing local saves, and bidirectional save-code import.
- `tests/browser-smoke.mjs` serves the static application locally in CI, launches Chromium, and verifies ESM startup plus the runtime diagnostic surface.
- GitHub Actions runs syntax checks, the ESM regression suite, and the browser smoke test.
