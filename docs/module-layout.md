# Module layout

The browser still uses classic scripts while the refactor moves existing subsystems out of `game.js`.

- `src/runtime/core.js` contains the legacy runtime and owns initialization, rendering, save/load, and DOM bindings.
- `src/data/state-schema.js` owns initial-state defaults and the serialized save-field contract.
- `src/data/progression-definitions.js` owns achievement and Infinity Challenge definitions.
- `src/data/balance-profile.js` owns the balance constants and Infinity Upgrade definitions.
- `src/systems/state-schema-runtime.js` applies missing state defaults non-destructively and makes the external save-field list authoritative.
- `src/systems/balance-formulas.js` owns pure progression formulas.
- `src/systems/balance-runtime.js` connects balance formulas to reset flow, save restoration, and the Infinity Upgrade UI.
- `src/systems/progression-data-runtime.js` activates external progression data and rebuilds the affected UI rows after the legacy core has initialized.

`game.js` is an ordered loader. Current data modules are runtime-authoritative but are still mirrored in `core.js` during the transition. The next reduction removes those legacy mirrors and then converts the remaining shared-global scripts to explicit ES module imports.
