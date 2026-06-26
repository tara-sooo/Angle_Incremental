const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const PREREQUISITES_FOR_3_1_AND_4_1 = (1 << 0) | (1 << 1) | (1 << 2) | (1 << 4);
const PREREQUISITES_FOR_4_1 = (1 << 3) | (1 << 4);

function hasUpgrade(state, bit) {
  return (state.infinityUpgradeMask & (1 << bit)) !== 0;
}

async function runInfinityPointAffordabilityBoundaryTest() {
  const runtimePath = path.join(__dirname, "..", "src", "main.js");
  const { context, debug } = await loadRuntime(runtimePath);
  const { state, buyInfinityUpgrade } = debug;

  state.infinityPoints = 8;
  state.infinityPointsLog10 = Math.log10(8);
  state.infinityUpgradeMask = PREREQUISITES_FOR_3_1_AND_4_1;

  buyInfinityUpgrade("3-1");
  assert.ok(hasUpgrade(state, 3), "the setup must purchase 3-1");
  assert.ok(
    state.infinityPointsLog10 < Math.log10(5),
    "subtracting 3 IP from 8 IP must preserve the historical floating-point boundary",
  );
  assert.strictEqual(
    JSON.parse(context.window.render_game_to_text()).infinity.points,
    "5",
    "the UI rounds the residual balance to 5 IP",
  );

  buyInfinityUpgrade("4-1");
  assert.ok(hasUpgrade(state, 5), "a displayed 5 IP balance must buy the 5 IP challenge unlock");
  assert.strictEqual(state.infinityPoints, 0, "an exact-cost purchase must leave no spendable IP");
  assert.strictEqual(state.infinityPointsLog10, -Infinity, "an exact-cost purchase must normalize the log balance to zero");

  const insufficient = await loadRuntime(runtimePath);
  insufficient.debug.state.infinityPoints = 4.99;
  insufficient.debug.state.infinityPointsLog10 = Math.log10(4.99);
  insufficient.debug.state.infinityUpgradeMask = PREREQUISITES_FOR_4_1;
  insufficient.debug.buyInfinityUpgrade("4-1");
  assert.strictEqual(
    hasUpgrade(insufficient.debug.state, 5),
    false,
    "the boundary tolerance must not allow a materially insufficient IP balance",
  );
}

module.exports = { runInfinityPointAffordabilityBoundaryTest };
