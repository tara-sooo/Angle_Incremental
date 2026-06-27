const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

function closeTo(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);
}

async function runGenerationSurplusCumulativeRuntimeTest() {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const state = debug.state;
  state.showFloatingText = false;
  runtime.saveGame = () => {};
  runtime.updateUi = () => {};

  state.generationCount = 1;
  state.previousGenerationScoreLog10 = 20;
  state.previousGenerationScore = 1e20;
  state.generationScoreLog10 = 40;
  state.generationScore = 1e40;
  state.generationScoreMultiplierLog10 = 0.4;
  state.generationScoreMultiplier = 10 ** 0.4;

  const rewardAtSurplus20 = runtime.generationRewardForLog(40);
  const rewardAtSurplus10 = runtime.generationRewardForLog(30);
  closeTo(runtime.generationSurplusForLog(40), 20);
  assert.ok(rewardAtSurplus20.scoreMultiplierLog10 > rewardAtSurplus10.scoreMultiplierLog10);
  assert.ok(rewardAtSurplus20.costReduction > rewardAtSurplus10.costReduction);

  state.previousGenerationScoreLog10 = 100;
  state.previousGenerationScore = 1e100;
  state.generationScoreLog10 = 120;
  state.generationScore = 1e120;
  const rewardAtSameSurplus = runtime.generationRewardForLog(120);
  closeTo(rewardAtSameSurplus.scoreMultiplierLog10, rewardAtSurplus20.scoreMultiplierLog10);
  closeTo(rewardAtSameSurplus.costReduction, rewardAtSurplus20.costReduction);

  const expectedRawMultiplierLog = 0.4 + rewardAtSameSurplus.scoreMultiplierLog10;
  const preview = runtime.nextGenerationValues();
  closeTo(preview.scoreMultiplierLog10, expectedRawMultiplierLog * runtime.GENERATION_SCORE_POWER);

  debug.runGeneration();
  closeTo(state.generationScoreMultiplierLog10, expectedRawMultiplierLog);
  closeTo(state.previousGenerationScoreLog10, 120);
  assert.equal(state.generationCount, 2);

  console.log("GENERATION_SURPLUS_CUMULATIVE_RUNTIME_OK");
}

module.exports = { runGenerationSurplusCumulativeRuntimeTest };
