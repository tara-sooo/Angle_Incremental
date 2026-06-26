const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

function setScoreLog(state, scoreLog10) {
  state.scoreLog10 = scoreLog10;
  state.score = scoreLog10 <= 308 ? 10 ** scoreLog10 : Number.MAX_VALUE;
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
}

module.exports = { runIc7PriceCapModuleRuntimeTest };
