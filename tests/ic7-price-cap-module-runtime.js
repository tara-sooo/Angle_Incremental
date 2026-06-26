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
  assert.ok(
    affordabilityState.infinityPointsLog10 < Math.log10(5),
    "subtracting 3 IP from 8 IP must preserve the historical floating-point boundary",
  );
  assert.strictEqual(
    JSON.parse(affordability.context.window.render_game_to_text()).infinity.points,
    "5",
    "the UI rounds the residual balance to 5 IP",
  );

  affordability.debug.buyInfinityUpgrade("4-1");
  assert.ok(hasUpgrade(affordabilityState, 5), "a displayed 5 IP balance must buy the 5 IP challenge unlock");
  assert.strictEqual(affordabilityState.infinityPoints, 0, "an exact-cost purchase must leave no spendable IP");
  assert.strictEqual(affordabilityState.infinityPointsLog10, -Infinity, "an exact-cost purchase must normalize the log balance to zero");

  const insufficient = await loadRuntime(runtimePath);
  insufficient.debug.state.infinityPoints = 4.99;
  insufficient.debug.state.infinityPointsLog10 = Math.log10(4.99);
  insufficient.debug.state.infinityUpgradeMask = (1 << 3) | (1 << 4);
  insufficient.debug.buyInfinityUpgrade("4-1");
  assert.strictEqual(
    hasUpgrade(insufficient.debug.state, 5),
    false,
    "the boundary tolerance must not allow a materially insufficient IP balance",
  );
}

module.exports = { runIc7PriceCapModuleRuntimeTest };
