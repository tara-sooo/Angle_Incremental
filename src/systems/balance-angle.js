import { runtime, expose } from "../runtime/shared.js";

function balancePreGenerationCostScalingLog10(kind, level) {
  const scaling = runtime.BALANCE_PROFILE.initialUpgradeCostScaling[kind];
  if (!scaling) return 0;
  const excess = Math.max(0, level - scaling.startsAfter);
  let generationRelief = 1;
  if (runtime.state.generationCount === 1) generationRelief = 0.25;
  else if (runtime.state.generationCount === 2) generationRelief = 0.10;
  else if (runtime.state.generationCount >= 3) generationRelief = 0.05;
  return excess * excess * scaling.logScale * generationRelief;
}

function balanceCanBuyNormalUpgrade(kind) {
  const costLog = runtime.costLogs()[kind];
  if (runtime.state.activeChallenge === 7 && costLog > 30) return false;
  if (kind === "vertex" && runtime.state.activeChallenge === 2 && runtime.effectiveVertexCount() >= 200) return false;
  return runtime.canSpendLog(costLog);
}

function balanceCostLog10(kind, base, level, growth) {
  const growthLog = runtime.log10Value(growth) * (runtime.state.activeChallenge === 3 && kind === "speed" ? 2 : 1);
  const rawLog = runtime.log10Value(base) + level * growthLog;
  const costFactor = runtime.generationCostFactorEffect();
  const adjustedLog = rawLog <= 300
    ? runtime.log10Value(Math.ceil(base + (10 ** rawLog - base) * costFactor))
    : rawLog + runtime.log10Value(costFactor);
  const earlyAdjustedLog = adjustedLog + runtime.preGenerationCostScalingLog10(kind, level);
  const scaledLog = earlyAdjustedLog + runtime.stagedUpgradeCostScalingLog10(earlyAdjustedLog);
  const challengeAdjustedLog = runtime.isChallengeCompleted(2) ? scaledLog * 0.95 : scaledLog;
  return challengeAdjustedLog * runtime.balanceInfinityUpgradeCostExponent();
}

function balanceRawLapSpeedLog10() {
  let multiplierLog = runtime.effectiveSpeedLevel() * runtime.log10Value(1.22);
  if (runtime.hasInfinityUpgrade("2-1")) multiplierLog += runtime.log10Value(runtime.applyInfinityUpgradePower(1.5));
  if (runtime.hasInfinityUpgrade("5-1")) multiplierLog += runtime.log10Value(runtime.applyInfinityUpgradePower(3));
  if (runtime.isChallengeCompleted(3)) multiplierLog += runtime.log10Value(1.1);
  if (runtime.state.activeChallenge === 3) multiplierLog *= 0.8;
  return runtime.clampLog10(multiplierLog);
}

function balanceVertexGainIncreaseLog10() {
  const infinityResetBoost = runtime.hasInfinityUpgrade("1-1")
    ? runtime.applyInfinityUpgradePower(runtime.hasInfinityUpgrade("11-2") ? Math.pow(1.005, runtime.iu11_2EffectiveInfinityCount()) : runtime.state.infinityCount + 1)
    : 1;
  let gainLog10 = runtime.log10Value(0.01 + runtime.effectiveGainLevel() * 0.01)
    + runtime.log10Value(runtime.coreBoostGainIncreaseMultiplier())
    + runtime.log10Value(runtime.ic8VertexGainMultiplier())
    + runtime.infiniteAngleBoostLog10()
    + runtime.log10Value(runtime.achievementGainMultiplier())
    + runtime.log10Value(infinityResetBoost);
  if (runtime.state.activeChallenge === 6) return runtime.log10Value(0.001);
  if (runtime.state.activeChallenge === 4) gainLog10 *= 0.5;
  if (runtime.isChallengeCompleted(4)) gainLog10 *= 1.1;
  return runtime.clampLog10(gainLog10);
}

function balanceVertexGainIncrease() {
  return runtime.valueFromLog10(balanceVertexGainIncreaseLog10());
}

expose("balancePreGenerationCostScalingLog10", () => balancePreGenerationCostScalingLog10);
expose("balanceCanBuyNormalUpgrade", () => balanceCanBuyNormalUpgrade);
expose("balanceCostLog10", () => balanceCostLog10);
expose("balanceRawLapSpeedLog10", () => balanceRawLapSpeedLog10);
expose("balanceVertexGainIncreaseLog10", () => balanceVertexGainIncreaseLog10);
expose("balanceVertexGainIncrease", () => balanceVertexGainIncrease);
