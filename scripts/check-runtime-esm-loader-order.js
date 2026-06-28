const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const expectedOrder = require(path.join(root, "tests", "candidate-runtime-order.js"));
const mainSource = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");
const imports = [...mainSource.matchAll(/^import "\.\/([^\"]+)";$/gm)]
  .map((entry) => `src/${entry[1]}`);

assert.deepStrictEqual(
  imports,
  expectedOrder.slice(0, -1),
  "ESM side-effect imports must match the differential candidate order",
);

const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(indexSource, /<script type="module" src="src\/main\.js[^\"]*"><\/script>/);

const compatibilitySource = fs.readFileSync(path.join(root, "game.js"), "utf8");
assert.match(compatibilitySource, /import\("\.\/src\/main\.js"\)/);

console.log("ESM entrypoint and import order are aligned");
