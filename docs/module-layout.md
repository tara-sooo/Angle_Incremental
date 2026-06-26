# Runtime module layout

The gameplay runtime is split by responsibility and loaded as browser ES modules.

```text
src/
  core/
    constants.js       # thresholds, save version, timing and balance constants
    state.js           # state object and serialized-field schema
    numbers.js         # log10 resources, huge-number helpers, formatting
    save.js            # local storage, migration, save-code import/export

  data/
    i18n.js            # TEXT and translation helper
    infinity-data.js   # Infinity upgrades, challenges, balance profile

  systems/
    angle.js           # vertices, laps, score, normal upgrades, costs
    generation.js      # Generation multiplier, reward, reset logic
    core-boost.js      # Core Boost requirements, effects, reset logic
    infinity.js        # Infinity, IP, IU, IC, Infinite Angle
    achievements.js    # achievement definitions and unlock checks

  ui/
    dom.js             # DOM and canvas bindings
    render-ui.js       # UI rows, localization application, status and previews
    render-canvas.js   # polygon/canvas drawing and canvas resize
    events.js          # tabs, settings, and input binding via bindEvents()

  runtime/
    shared.js          # live runtime binding registry used across migrated modules

  main.js              # composition root, initialization, game frame, diagnostics
```

## Execution model

`index.html` loads `src/main.js` with `type="module"`. `main.js` imports every runtime module in deterministic dependency order. Each module imports `runtime` and `expose` from `src/runtime/shared.js`; `expose()` publishes its local live bindings into the shared registry, while cross-module references use that registry.

This preserves the original runtime's live mutable bindings and reset behavior without relying on `window` globals or dynamic classic-script injection. `game.js` remains only as a compatibility bootstrap for older direct links.

## Verification

- `tests/fixtures/next-runtime.js` is an immutable fixture of the pre-refactor `next/game.js` runtime.
- `tests/differential-runtime-esm.js` compares complete state and `render_game_to_text()` output between that fixture and the ES-module runtime.
- The differential suite covers normal upgrades, Generation, Core Boost, IU5-2/IU6-2, IC6–IC8, high-speed vertex processing, existing local saves, and bidirectional save-code import.
- `tests/browser-smoke.mjs` serves the static application locally in CI, launches Chromium, and verifies ESM startup plus the runtime diagnostic surface.
- GitHub Actions runs syntax checks, baseline regression checks, ESM differential parity checks, and the browser smoke test.
