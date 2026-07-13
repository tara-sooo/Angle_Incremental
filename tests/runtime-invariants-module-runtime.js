const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const runtimePath = path.join(__dirname, "..", "src", "main.js");

function setLogResource(state, key, log10) {
  state[`${key}Log10`] = log10;
  state[key] = log10 <= 308 ? 10 ** log10 : Number.MAX_VALUE;
  if (key === "infinityPoints") state.infinityPointsExact = state[key].toFixed(0);
}

async function testCoreBoostAndInfinityBoundaries() {
  const { debug, runtime } = await loadRuntime(runtimePath);
  const { state } = debug;

  state.coreBoostCount = 4;
  assert.equal(runtime.coreBoostRequirementLog10(), 320);
  setLogResource(state, "score", 308.3);
  assert.equal(runtime.canCoreBoost(), false);

  setLogResource(state, "score", 333);
  assert.equal(runtime.infinityPointGain(), 26);
  state.infiniteCapBroken = true;
  assert.equal(runtime.infinityPointGain(), 799);

  state.infiniteCapBroken = false;
  state.scoreLog10 = 349.99;
  assert.equal(runtime.canBreakInfiniteCap(), false);
  state.scoreLog10 = 350;
  assert.equal(runtime.canBreakInfiniteCap(), true);
}

async function testAngleScalingRemainsFinite() {
  const { debug, runtime } = await loadRuntime(runtimePath);
  const { state } = debug;

  state.speedLevel = 10000;
  assert.ok(runtime.rawLapSpeedLog10() > 42);
  assert.ok(runtime.effectiveLapSpeedLog10() > 22);
  assert.ok(runtime.effectiveLapSpeedLog10() < runtime.rawLapSpeedLog10());
  assert.ok(Number.isFinite(runtime.lapSpeedMultiplier()));

  state.vertices = 16;
  state.currentGainLog10 = 24;
  state.currentGain = 1e24;
  state.numberFormat = "scientific";
  assert.equal(runtime.formatGainExpressionSummary(), "(1.00e24 / 4)^4");
  state.activeChallenge = 1;
  assert.equal(runtime.formatGainExpressionSummary(), "(1.00e24 / 40)^4");
}

async function testChallengeRulesAndAutomation() {
  const { debug, runtime } = await loadRuntime(runtimePath);
  const { state } = debug;

  state.activeChallenge = 7;
  setLogResource(state, "score", 100);
  state.speedLevel = 0;
  assert.equal(runtime.canBuyNormalUpgrade("speed"), true);
  state.speedLevel = 160;
  assert.equal(runtime.canBuyNormalUpgrade("speed"), false);

  state.activeChallenge = 6;
  assert.equal(runtime.vertexGainIncrease(), 0.001);
  state.activeChallenge = 0;
  state.infinityUpgradeMask = 1 << 1;
  state.automationEnabled = true;
  state.autoBuySpeed = true;
  setLogResource(state, "score", 20);
  debug.update(0.1);
  assert.ok(state.speedLevel > 0);
}

async function testSaveCodeRoundTrip() {
  const { debug } = await loadRuntime(runtimePath);
  const { state } = debug;

  state.scoreLog10 = 123;
  state.score = Number.MAX_VALUE;
  state.vertices = 77;
  const code = await debug.exportSaveCode();
  assert.match(code, /^ANGLE_SAVE_V2:/);
  assert.ok(!code.includes("scoreLog10"));

  state.scoreLog10 = 0;
  state.score = 1;
  state.vertices = 3;
  assert.equal(await debug.importSaveCode(code), true);
  assert.equal(state.scoreLog10, 123);
  assert.equal(state.vertices, 77);

  const tampered = `${code.slice(0, -1)}${code.endsWith("A") ? "B" : "A"}`;
  state.scoreLog10 = 55;
  assert.equal(await debug.importSaveCode(tampered), false);
  assert.equal(state.scoreLog10, 55);
}

async function testChallengeAutomationToggle() {
  const { debug, runtime } = await loadRuntime(runtimePath);
  const { state } = debug;

  state.infinityCount = 1;
  state.infinityUpgradeMask = 1 << 5;
  state.activeChallenge = 1;
  setLogResource(state, "score", 309);
  state.autoCompleteChallenges = false;
  debug.completeChallengeIfReady();
  assert.equal(state.activeChallenge, 1);

  state.autoCompleteChallenges = true;
  debug.completeChallengeIfReady();
  assert.equal(state.activeChallenge, 0);
  assert.equal((state.completedChallenges & 1) !== 0, true);
  assert.equal(runtime.completedChallengeCount() >= 1, true);
}

async function runRuntimeInvariantTests() {
  await testCoreBoostAndInfinityBoundaries();
  await testAngleScalingRemainsFinite();
  await testChallengeRulesAndAutomation();
  await testSaveCodeRoundTrip();
  await testChallengeAutomationToggle();
  console.log("Runtime invariant tests passed");
}

module.exports = { runRuntimeInvariantTests };
