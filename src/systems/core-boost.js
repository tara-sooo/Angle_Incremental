import { runtime, expose } from "../runtime/shared.js";

// Extracted mechanically from the next-runtime baseline.
// Functions retain their original global runtime dependencies during the classic-script migration phase.

function coreBoostRequirementLog10() {
  const multiplier = 2 ** runtime.state.coreBoostCount;
  if (!Number.isFinite(multiplier)) return runtime.MAX_TRACKED_LOG10;
  const requirementLog10 = Math.log10(runtime.CORE_BOOST_BASE_REQUIREMENT) * multiplier;
  const challengeAdjustedLog10 = runtime.state.activeChallenge === 8 ? requirementLog10 * 2 : requirementLog10;
  return Math.min(challengeAdjustedLog10, runtime.MAX_TRACKED_LOG10);
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

function coreBoostGainIncreaseBaseForCount(coreBoostCount) {
  const increasePerCoreBoost = runtime.hasInfinityUpgrade("7-1") ? 1 : 0.5;
  return runtime.hasInfinityUpgrade("12-1")
    ? Math.pow(1 + increasePerCoreBoost, coreBoostCount)
    : 1 + coreBoostCount * increasePerCoreBoost;
}

function coreBoostGainIncreaseMultiplier() {
  return Math.pow(coreBoostGainIncreaseBaseForCount(runtime.state.coreBoostCount), coreBoostBonusPower());
}

function ic8VertexUpgradeCount() {
  return runtime.state.activeChallenge === 8 ? Math.max(0, runtime.state.vertices - 3) : 0;
}

function ic8VertexScoreExponentBonus() {
  return ic8VertexUpgradeCount() * runtime.IC8_VERTEX_EXPONENT_BONUS;
}

function coreBoostGainExponentForCount(coreBoostCount) {
  const baseExponent = runtime.hasInfinityUpgrade("12-1") ? Math.pow(1.02, coreBoostCount) : 1 + coreBoostCount * 0.02;
  return Math.pow(baseExponent, coreBoostBonusPower())
    + ic8VertexScoreExponentBonus()
    + (runtime.isChallengeCompleted(5) ? 0.01 : 0);
}

function coreBoostGainExponent() {
  return coreBoostGainExponentForCount(runtime.state.coreBoostCount);
}

function nextCoreBoostValues() {
  const currentCoreBoostCount = runtime.state.coreBoostCount;
  const nextCoreBoostCount = canCoreBoost() ? currentCoreBoostCount + 1 : currentCoreBoostCount;
  const power = coreBoostBonusPower();
  return {
    gainMultiplier: Math.pow(coreBoostGainIncreaseBaseForCount(nextCoreBoostCount), power),
    gainExponent: coreBoostGainExponentForCount(nextCoreBoostCount),
  };
}

function shouldPreserveVerticesThroughEarlyReset() {
  return runtime.state.activeChallenge === 8;
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
  runtime.state.currentGenerationRunTime = 0;
  runtime.state.floatingTexts = [];
}

function runCoreBoost() {
  if (!canCoreBoost()) return;
  if (runtime.state.coreBoostCount === 0 && runtime.state.generationCount <= 0) runtime.state.noGenerationCoreBoostReached = true;
  runtime.state.currentInfinityRunHadCoreBoost = true;
  runtime.state.coreBoostCount += 1;
  resetBelowCoreBoost();
  runtime.updateUi();
  runtime.saveGame("manual");
}

function balanceCoreBoostGainIncreaseMultiplier() {
  return Math.pow(coreBoostGainIncreaseBaseForCount(runtime.state.coreBoostCount), coreBoostBonusPower());
}
expose("coreBoostRequirementLog10", () => coreBoostRequirementLog10, (value) => { coreBoostRequirementLog10 = value; });
expose("coreBoostRequirement", () => coreBoostRequirement, (value) => { coreBoostRequirement = value; });
expose("canCoreBoost", () => canCoreBoost, (value) => { canCoreBoost = value; });
expose("coreBoostBonusPower", () => coreBoostBonusPower, (value) => { coreBoostBonusPower = value; });
expose("coreBoostGainIncreaseMultiplier", () => coreBoostGainIncreaseMultiplier, (value) => { coreBoostGainIncreaseMultiplier = value; });
expose("ic8VertexUpgradeCount", () => ic8VertexUpgradeCount, (value) => { ic8VertexUpgradeCount = value; });
expose("ic8VertexScoreExponentBonus", () => ic8VertexScoreExponentBonus, (value) => { ic8VertexScoreExponentBonus = value; });
expose("coreBoostGainExponent", () => coreBoostGainExponent, (value) => { coreBoostGainExponent = value; });
expose("nextCoreBoostValues", () => nextCoreBoostValues, (value) => { nextCoreBoostValues = value; });
expose("shouldPreserveVerticesThroughEarlyReset", () => shouldPreserveVerticesThroughEarlyReset, (value) => { shouldPreserveVerticesThroughEarlyReset = value; });
expose("resetBelowCoreBoost", () => resetBelowCoreBoost, (value) => { resetBelowCoreBoost = value; });
expose("runCoreBoost", () => runCoreBoost, (value) => { runCoreBoost = value; });
expose("balanceCoreBoostGainIncreaseMultiplier", () => balanceCoreBoostGainIncreaseMultiplier, (value) => { balanceCoreBoostGainIncreaseMultiplier = value; });
