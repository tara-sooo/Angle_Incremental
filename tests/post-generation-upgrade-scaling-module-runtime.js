const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidateRuntimePath = path.join(__dirname, "..", "src", "main.js");

async function runActiveBalanceProfileRoutingChecks() {
  async function costWithPreGenerationProfileValue(value) {
    const { runtime } = await loadRuntime(candidateRuntimePath);
    runtime.preGenerationCostScalingLog10 = () => value;
    return runtime.costLog10("speed", 5, 80, 1.55);
  }

  const costWithoutProfileAdjustment = await costWithPreGenerationProfileValue(0);
  const costWithProfileAdjustment = await costWithPreGenerationProfileValue(10);
  assert.ok(
    costWithProfileAdjustment > costWithoutProfileAdjustment + 5,
    "normal upgrade costs must use the active pre-Generation scaling profile",
  );

  const nextGenerationInstance = await loadRuntime(candidateRuntimePath);
  const { debug: nextDebug, runtime: nextRuntime } = nextGenerationInstance;
  nextDebug.state.generationScore = 1e25;
  nextDebug.state.generationScoreLog10 = 25;
  nextDebug.state.generationScoreMultiplier = 1;
  nextDebug.state.generationScoreMultiplierLog10 = 0;
  nextDebug.state.generationCostFactor = 1;
  const nextReward = nextRuntime.generationRewardForLog(25);
  const expectedNextMultiplierLog10 = nextRuntime.applyGenerationAchievementRewardLog10(
    nextRuntime.generationScoreMultiplierBaseEffectLog10(nextReward.scoreMultiplierLog10),
  );
  assert.equal(
    nextRuntime.nextGenerationValues().scoreMultiplierLog10,
    expectedNextMultiplierLog10,
    "Generation preview must use the active reward profile",
  );

  const runGenerationInstance = await loadRuntime(candidateRuntimePath);
  const { debug: runDebug, runtime: runRuntime } = runGenerationInstance;
  runDebug.state.generationScore = 1e25;
  runDebug.state.generationScoreLog10 = 25;
  runDebug.state.generationCostFactor = 1;
  const runReward = runRuntime.generationRewardForLog(25);
  runRuntime.runGeneration();
  assert.equal(
    runDebug.state.generationScoreMultiplierLog10,
    runReward.scoreMultiplierLog10,
    "Generation execution must use the active reward profile",
  );
}

async function runGenerationRewardChecks() {
  await runActiveBalanceProfileRoutingChecks();
  const { debug, runtime } = await loadRuntime(candidateRuntimePath);
  const shallow = debug.generationRewardFor(1e10);
  const deep = debug.generationRewardFor(1e106);

  assert.ok(shallow.scoreMultiplierLog10 > 0.48);
  assert.ok(shallow.costReduction > 0.09);
  assert.ok(deep.scoreMultiplierLog10 < 1.3);
  assert.ok(deep.costReduction <= 0.24);

  const earlier = debug.generationRewardFor(1e25);
  const later = debug.generationRewardFor(1e46);
  assert.ok(later.scoreMultiplierLog10 >= earlier.scoreMultiplierLog10);
  assert.ok(later.costReduction >= earlier.costReduction);

  debug.state.speedLevel = 80;
  debug.state.generationCount = 0;
  const beforeGeneration = runtime.costLog10("speed", 5, debug.state.speedLevel, 1.55);

  debug.state.generationCount = 1;
  const afterOneGeneration = runtime.costLog10("speed", 5, debug.state.speedLevel, 1.55);
  assert.ok(afterOneGeneration < beforeGeneration - 0.5);

  debug.state.generationCount = 2;
  const afterTwoGenerations = runtime.costLog10("speed", 5, debug.state.speedLevel, 1.55);
  assert.ok(afterTwoGenerations < afterOneGeneration - 0.5);

  debug.state.generationCount = 3;
  const afterThreeGenerations = runtime.costLog10("speed", 5, debug.state.speedLevel, 1.55);
  assert.ok(afterThreeGenerations < afterTwoGenerations);
}

async function runPostGenerationUpgradeScalingModuleRuntimeTest() {
  await runGenerationRewardChecks();
  console.log("Post-Generation upgrade scaling module runtime tests passed");
}

module.exports = { runPostGenerationUpgradeScalingModuleRuntimeTest };
