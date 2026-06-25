const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Module = module.constructor;

const gamePath = path.join(__dirname, "game.js");
const gameSource = fs.readFileSync(gamePath, "utf8");
assert.ok(gameSource.includes('const canvas = document.getElementById("gameCanvas");'));
assert.ok(!gameSource.includes("game-core.js"));
assert.ok(!fs.existsSync(path.join(__dirname, "game-core.js")));
assert.ok(!fs.existsSync(path.join(__dirname, "balance-config.js")));

const corePath = path.join(__dirname, "regression-tests-core.js");
const original = fs.readFileSync(corePath, "utf8");
const oldBlock = `function testIc7LocksByScoreAndRewardRequiresAffordableCost() {
  const context = loadGame();
  const { state, buySpeed } = context.window.__angleDebug;
  state.activeChallenge = 7;
  state.scoreLog10 = 30;
  state.speedLevel = 0;
  assert.strictEqual(context.canBuyNormalUpgrade("speed"), true);

  state.scoreLog10 = 30.001;
  assert.strictEqual(context.canBuyNormalUpgrade("speed"), false);

  state.activeChallenge = 0;
  state.completedChallenges = 1 << 6;
  state.scoreLog10 = 0;
  state.speedLevel = 10;
  const lockedLevel = state.speedLevel;
  buySpeed();
  assert.strictEqual(state.speedLevel, lockedLevel);

  state.speedLevel = 0;
  state.scoreLog10 = 2;
  const beforeScore = state.scoreLog10;
  buySpeed();
  assert.strictEqual(state.speedLevel, 1);
  assert.strictEqual(state.scoreLog10, beforeScore);
}`;
const newBlock = `function testIc7LocksByScoreAndRewardRequiresAffordableCost() {
  const context = loadGame();
  const { state, buySpeed } = context.window.__angleDebug;
  state.activeChallenge = 7;
  state.scoreLog10 = 100;
  state.speedLevel = 0;
  assert.strictEqual(context.canBuyNormalUpgrade("speed"), true);

  state.speedLevel = 160;
  assert.strictEqual(context.canBuyNormalUpgrade("speed"), false);

  state.activeChallenge = 0;
  state.completedChallenges = 1 << 6;
  state.scoreLog10 = 0;
  state.speedLevel = 10;
  const lockedLevel = state.speedLevel;
  buySpeed();
  assert.strictEqual(state.speedLevel, lockedLevel);

  state.speedLevel = 0;
  state.scoreLog10 = 2;
  const beforeScore = state.scoreLog10;
  buySpeed();
  assert.strictEqual(state.speedLevel, 1);
  assert.strictEqual(state.scoreLog10, beforeScore);
}`;

if (!original.includes(oldBlock)) throw new Error("stale IC7 regression block not found");
const patched = original.replace(oldBlock, newBlock);
const loaded = new Module(corePath, module);
loaded.filename = corePath;
loaded.paths = Module._nodeModulePaths(__dirname);
loaded._compile(patched, corePath);
