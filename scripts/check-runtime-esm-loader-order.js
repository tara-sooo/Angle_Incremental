const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainSource = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");
const imports = [...mainSource.matchAll(/^import "\.\/([^\"]+)";$/gm)]
  .map((entry) => `src/${entry[1]}`);
const expectedOrder = [
  "src/ui/dom.js",
  "src/core/constants.js",
  "src/data/i18n.js",
  "src/data/infinity-data.js",
  "src/core/state.js",
  "src/core/numbers.js",
  "src/core/save.js",
  "src/core/save-code.js",
  "src/systems/achievements.js",
  "src/systems/tower.js",
  "src/ui/render-canvas.js",
  "src/ui/render-topbar.js",
  "src/ui/render-challenges.js",
  "src/ui/render-infinity.js",
  "src/ui/render-achievements.js",
  "src/ui/render-automation.js",
  "src/ui/render-offline-report.js",
  "src/ui/render-ui.js",
  "src/systems/angle.js",
  "src/systems/generation.js",
  "src/systems/core-boost.js",
  "src/systems/infinity.js",
  "src/systems/infinite-angle.js",
  "src/ui/events.js",
  "src/systems/balance.js",
];

assert.deepStrictEqual(
  imports,
  expectedOrder,
  "ESM side-effect imports must match the canonical runtime order",
);
assert.match(mainSource, /^import \{ runtime, expose \} from "\.\/runtime\/shared\.js";/m);

const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(indexSource, /<script type="module" src="src\/main\.js[^\"]*"><\/script>/);
assert.equal(fs.existsSync(path.join(root, "game.js")), false, "the removed classic entrypoint must stay absent");

console.log("ESM entrypoint and import order are canonical");
