function balanceGenerationRewardForLog(generationScoreLog) {
  const depth = Math.max(0, generationScoreLog - log10Value(GENERATION_UNLOCK_SCORE));
  const scoreMultiplierLog10 = Math.min(
    8,
    Math.log10(1 + depth) * BALANCE_PROFILE.generationRewardLogCoefficient,
  );
  return {
    scoreMultiplierLog10,
    scoreMultiplierGain: valueFromLog10(scoreMultiplierLog10),
    costReduction: Math.min(0.22, Math.log10(1 + depth) * 0.04),
  };
}

function balancePreGenerationCostScalingLog10(kind, level) {
  const scaling = BALANCE_PROFILE.initialUpgradeCostScaling[kind];
  if (!scaling) return 0;
  const excess = Math.max(0, level - scaling.startsAfter);
  return excess * excess * scaling.logScale;
}

function balanceCanBuyNormalUpgrade(kind) {
  const costLog = upgradeCostLog(kind);
  if (state.activeChallenge === 7 && costLog > 30) return false;
  if (kind === "vertex") {
    if (state.activeChallenge === 8) return false;
    if (state.activeChallenge === 2 && state.vertices >= 200) return false;
  }
  return canSpendLog(costLog);
}

function balanceInfinityPointGain() {
  if (!canInfinity()) return 0;
  const scoreLog10 = currentScoreLog10();
  const base = state.infiniteCapBroken
    ? Math.floor(scoreLog10 / Math.log10(2) - 307)
    : Math.floor(scoreLog10 - 307);
  return Math.max(1, base);
}

function balanceGenerationMinCostFactor() {
  return hasInfinityUpgrade("6-2") ? 0.70 : GENERATION_MIN_NEW_COST_FACTOR;
}

function balanceRestoreGenerationCostFactor(rawValue, upgradeMask = state.infinityUpgradeMask) {
  if ((Math.floor(Number(upgradeMask) || 0) & (1 << 9)) === 0) return;
  const value = parseSavedNumber(rawValue);
  if (!Number.isFinite(value)) return;
  state.generationCostFactor = Math.max(0.70, Math.min(1, value));
}

function balanceRestoreGenerationCostFactorFromLocalSave() {
  if (typeof localStorage === "undefined" || typeof SAVE_KEY === "undefined") return;
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (saved && saved.state) {
      balanceRestoreGenerationCostFactor(
        saved.state.generationCostFactor,
        saved.state.infinityUpgradeMask,
      );
    }
  } catch (error) {
    // The core save loader already handles malformed saves safely.
  }
}

function balanceInfinityUpgradeCostExponent() {
  if (!hasInfinityUpgrade("7-2")) return 1;
  const config = BALANCE_PROFILE.infinityUpgradeCostReduction;
  const infinityCount = Math.max(0, state.infinityCount);
  const rawExponent = 1 - infinityCount * config.perInfinity;
  if (rawExponent >= config.softcapStartExponent) return rawExponent;
  const postSoftcapInfinities = infinityCount - (1 - config.softcapStartExponent) / config.perInfinity;
  return config.softcapAsymptoteExponent
    + (config.softcapStartExponent - config.softcapAsymptoteExponent)
      * Math.exp(-Math.max(0, postSoftcapInfinities) * config.postSoftcapDecay);
}

function balanceCostLog10(kind, base, level, growth) {
  const growthLog = log10Value(growth) * (state.activeChallenge === 3 && kind === "speed" ? 2 : 1);
  const rawLog = log10Value(base) + level * growthLog;
  const costFactor = generationCostFactorEffect();
  const adjustedLog = rawLog <= 300
    ? log10Value(Math.ceil(base + (10 ** rawLog - base) * costFactor))
    : rawLog + log10Value(costFactor);
  const earlyAdjustedLog = adjustedLog + preGenerationCostScalingLog10(kind, level);
  const scaledLog = earlyAdjustedLog + stagedUpgradeCostScalingLog10(earlyAdjustedLog);
  const challengeAdjustedLog = isChallengeCompleted(2) ? scaledLog * 0.95 : scaledLog;
  return challengeAdjustedLog * balanceInfinityUpgradeCostExponent();
}

function balanceRawLapSpeedLog10() {
  let multiplierLog = state.speedLevel * log10Value(1.22);
  if (hasInfinityUpgrade("2-1")) multiplierLog += log10Value(applyInfinityUpgradePower(1.5));
  if (hasInfinityUpgrade("5-1")) multiplierLog += log10Value(applyInfinityUpgradePower(3));
  if (isChallengeCompleted(3)) multiplierLog += log10Value(1.1);
  if (state.activeChallenge === 3) multiplierLog *= 0.8;
  return clampLog10(multiplierLog);
}

function balanceGenerationScorePower() {
  let power = GENERATION_SCORE_POWER;
  if (hasInfinityUpgrade("3-1")) power *= applyInfinityUpgradePower(1.5);
  if (hasInfinityUpgrade("6-1")) power *= applyInfinityUpgradePower(1.2);
  return power;
}

function balanceCoreBoostGainIncreaseMultiplier() {
  const increasePerCoreBoost = hasInfinityUpgrade("7-1") ? 1 : 0.5;
  return Math.pow(1 + state.coreBoostCount * increasePerCoreBoost, coreBoostBonusPower());
}

function balanceVertexGainIncrease() {
  const infinityResetBoost = hasInfinityUpgrade("1-1")
    ? applyInfinityUpgradePower(state.infinityCount + 1)
    : 1;
  let gain = (0.01 + state.gainLevel * 0.01)
    * coreBoostGainIncreaseMultiplier()
    * infiniteAngleBoost()
    * achievementGainMultiplier()
    * infinityResetBoost;
  if (state.activeChallenge === 6) return 0.001;
  if (state.activeChallenge === 4) gain = Math.pow(gain, 0.5);
  if (isChallengeCompleted(4)) gain = Math.pow(gain, 1.1);
  return gain;
}
