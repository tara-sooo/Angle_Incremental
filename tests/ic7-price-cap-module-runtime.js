const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

function setScoreLog(state, scoreLog10) {
  state.scoreLog10 = scoreLog10;
  state.score = scoreLog10 <= 308 ? 10 ** scoreLog10 : Number.MAX_VALUE;
}

function hasUpgrade(state, bit) {
  return (state.infinityUpgradeMask & (1 << bit)) !== 0;
}

async function runIc7PriceCapModuleRuntimeTest() {
  const runtimePath = path.join(__dirname, "..", "src", "main.js");
  const { debug } = await loadRuntime(runtimePath);
  const { state, buySpeed } = debug;

  state.activeChallenge = 7;
  setScoreLog(state, 100);
  state.speedLevel = 0;
  buySpeed();
  assert.strictEqual(
    state.speedLevel,
    1,
    "IC7 must allow a low-cost normal upgrade even when held score exceeds 1e30",
  );

  state.speedLevel = 160;
  const cappedLevel = state.speedLevel;
  buySpeed();
  assert.strictEqual(
    state.speedLevel,
    cappedLevel,
    "IC7 must reject a normal upgrade whose own cost exceeds 1e30",
  );

  const affordability = await loadRuntime(runtimePath);
  const affordabilityState = affordability.debug.state;
  affordabilityState.infinityPoints = 8;
  affordabilityState.infinityPointsLog10 = Math.log10(8);
  affordabilityState.infinityUpgradeMask = (1 << 0) | (1 << 1) | (1 << 2) | (1 << 4);
  affordability.debug.buyInfinityUpgrade("3-1");
  assert.ok(hasUpgrade(affordabilityState, 3), "the setup must purchase 3-1");
  assert.strictEqual(affordabilityState.infinityPoints, 5, "8 IP minus 3 IP must normalize to exactly 5 IP");
  assert.strictEqual(affordabilityState.infinityPointsLog10, Math.log10(5), "the normalized 5 IP balance must use the canonical log value");

  affordability.debug.buyInfinityUpgrade("4-1");
  assert.ok(hasUpgrade(affordabilityState, 5), "an exact 5 IP balance must buy the 5 IP challenge unlock");
  assert.strictEqual(affordabilityState.infinityPoints, 0, "an exact-cost purchase must leave no spendable IP");
  assert.strictEqual(affordabilityState.infinityPointsLog10, -Infinity, "an exact-cost purchase must normalize the log balance to zero");

  const remainder = await loadRuntime(runtimePath);
  remainder.debug.state.infinityPoints = 5.999999999999999;
  remainder.debug.state.infinityPointsLog10 = Math.log10(5.999999999999999);
  remainder.debug.state.infinityUpgradeMask = (1 << 3) | (1 << 4);
  remainder.debug.buyInfinityUpgrade("4-1");
  assert.ok(hasUpgrade(remainder.debug.state, 5), "a near-6 IP balance must buy the 5 IP unlock");
  assert.strictEqual(remainder.debug.state.infinityPoints, 1, "6 IP minus 5 IP must normalize to exactly 1 IP");
  assert.strictEqual(remainder.debug.state.infinityPointsLog10, 0, "the 1 IP remainder must use the canonical zero log value");

  const insufficient = await loadRuntime(runtimePath);
  insufficient.debug.state.infinityPoints = 4.99;
  insufficient.debug.state.infinityPointsLog10 = Math.log10(4.99);
  insufficient.debug.state.infinityUpgradeMask = (1 << 3) | (1 << 4);
  insufficient.debug.buyInfinityUpgrade("4-1");
  assert.strictEqual(
    hasUpgrade(insufficient.debug.state, 5),
    false,
    "normalization must not allow a materially insufficient IP balance",
  );
}

module.exports = { runIc7PriceCapModuleRuntimeTest };
