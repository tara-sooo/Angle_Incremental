const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const gameSource = fs.readFileSync(path.join(root, "game.js"), "utf8");
const candidateOrder = require(path.join(root, "tests", "candidate-runtime-order.js"));
const match = gameSource.match(/const runtimeFiles = \[([\s\S]*?)\];/);

if (!match) throw new Error("game.js does not declare runtimeFiles");
const loaderOrder = [...match[1].matchAll(/"\.\/(src\/[^"]+)"/g)].map((entry) => entry[1]);
assert.deepStrictEqual(loaderOrder, candidateOrder, "browser loader order must match the differential-runtime candidate order");
console.log("runtime loader order matches differential harness");
