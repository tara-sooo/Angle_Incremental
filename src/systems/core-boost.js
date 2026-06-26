import { runtime, expose } from "../runtime/shared.js";

// Extracted mechanically from the next-runtime baseline.
// Functions retain their original global runtime dependencies during the classic-script migration phase.

function coreBoostRequirementLog10() {
  const multiplier = 2 ** runtime.state.coreBoostCount;
  if (!Number.isFinite(multiplier)) return runtime.MAX_TRACKED_LOG10;
  return Math.min(Math.log10(runtime.CORE_BOOST_BASE_REQUIREMENT) * multiplier, runtime.MAX_TRACKED_LOG10);
}

function coreBoostRequirement() {
  const requirementLog10 = coreBoostRequirementLog10();
  return requirementLog10 > 308 ? Infinity : 10 ** requirementLog10;
}

function canCoreBoost() {
  if (runtime.state.activeChallenge === 5) return false;
  return runtime.currentScoreLog10() >= coreBoostRequirementLog10();
}

function coreBoostBonusPower() {
  return 1;
}

function coreBoostGainIncreaseMultiplier() {
  return Math.pow(1 + runtime.state.coreBoostCount * 0.5, coreBoostBonusPower());
}

function coreBoostGainExponent() {
  return Math.pow(1 + runtime.state.coreBoostCount * 0.02, coreBoostBonusPower()) + (runtime.isChallengeCompleted(5) ? 0.01 : 0);
}

function nextCoreBoostValues() {
  const currentCoreBoostCount = runtime.state.coreBoostCount;
  const nextCoreBoostCount = canCoreBoost() ? currentCoreBoostCount + 1 : currentCoreBoostCount;
  const power = coreBoostBonusPower();
  return {
    gainMultiplier: Math.pow(1 + nextCoreBoostCount * 0.5, power),
    gainExponent: Math.pow(1 + nextCoreBoostCount * 0.02, power),
  };
}

function shouldPreserveVerticesThroughEarlyReset() {
  return runtime.state.activeChallenge === 8 || runtime.isChallengeCompleted(8);
}

function resetBelowCoreBoost() {
  const preservedVertices = shouldPreserveVerticesThroughEarlyReset() ? runtime.state.vertices : 3;
  runtime.state.score = 0;
  runtime.state.scoreLog10 = -Infinity;
  runtime.state.totalScore = 0;
  runtime.state.totalScoreLog10 = -Infinity;
  runtime.state.generationScore = 0;
  runtime.state.generationScoreLog10 = -Infinity;
  runtime.state.vertices = preservedVertices;
  runtime.state.speedLevel = 0;
  runtime.state.gainLevel = 0;
  runtime.state.currentGain = 1;
  runtime.state.currentGainLog10 = 0;
  runtime.state.pointProgress = 0;
  runtime.state.totalVertexProgress = 0;
  runtime.state.lastVertexIndex = 0;
  runtime.state.generationCount = 0;
  runtime.state.previousGenerationScore = 0;
  runtime.state.previousGenerationScoreLog10 = -Infinity;
  runtime.state.generationScoreMultiplier = 1;
  runtime.state.generationScoreMultiplierLog10 = 0;
  runtime.state.generationCostFactor = 1;
  runtime.state.floatingTexts = [];
}

function runCoreBoost() {
  if (!canCoreBoost()) return;
  if (runtime.state.coreBoostCount === 0 && runtime.state.generationCount <= 0) runtime.state.noGenerationCoreBoostReached = true;
  runtime.state.coreBoostCount += 1;
  resetBelowCoreBoost();
  runtime.updateUi();
  runtime.saveGame("manual");
}

function balanceCoreBoostGainIncreaseMultiplier() {
  const increasePerCoreBoost = runtime.hasInfinityUpgrade("7-1") ? 1 : 0.5;
  return Math.pow(1 + runtime.state.coreBoostCount * increasePerCoreBoost, coreBoostBonusPower());
}
expose("coreBoostRequirementLog10", () => coreBoostRequirementLog10, (value) => { coreBoostRequirementLog10 = value; });
expose("coreBoostRequirement", () => coreBoostRequirement, (value) => { coreBoostRequirement = value; });
expose("canCoreBoost", () => canCoreBoost, (value) => { canCoreBoost = value; });
expose("coreBoostBonusPower", () => coreBoostBonusPower, (value) => { coreBoostBonusPower = value; });
expose("coreBoostGainIncreaseMultiplier", () => coreBoostGainIncreaseMultiplier, (value) => { coreBoostGainIncreaseMultiplier = value; });
expose("coreBoostGainExponent", () => coreBoostGainExponent, (value) => { coreBoostGainExponent = value; });
expose("nextCoreBoostValues", () => nextCoreBoostValues, (value) => { nextCoreBoostValues = value; });
expose("shouldPreserveVerticesThroughEarlyReset", () => shouldPreserveVerticesThroughEarlyReset, (value) => { shouldPreserveVerticesThroughEarlyReset = value; });
expose("resetBelowCoreBoost", () => resetBelowCoreBoost, (value) => { resetBelowCoreBoost = value; });
expose("runCoreBoost", () => runCoreBoost, (value) => { runCoreBoost = value; });
expose("balanceCoreBoostGainIncreaseMultiplier", () => balanceCoreBoostGainIncreaseMultiplier, (value) => { balanceCoreBoostGainIncreaseMultiplier = value; });

