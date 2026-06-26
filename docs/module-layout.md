# Module layout

The browser still uses classic scripts while the refactor moves existing subsystems out of `game.js`.

- `src/runtime/core.js` contains the legacy runtime and owns initialization, rendering, save/load, and DOM bindings.
- `src/data/balance-profile.js` owns the balance constants and IU definitions.
- `src/systems/balance-formulas.js` owns pure progression formulas.
- `src/systems/balance-runtime.js` connects those formulas to the runtime, reset flow, save restoration, and the Infinity Upgrade UI.

`game.js` is now an ordered loader. Later refactors should replace shared-global classic scripts with explicit ES module imports one subsystem at a time.
