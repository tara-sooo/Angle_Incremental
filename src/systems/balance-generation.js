import { runtime, expose } from "../runtime/shared.js";

function balanceGenerationRewardForLog(generationScoreLog) {
  const depth = Math.max(0, generationScoreLog - runtime.log10Value(runtime.GENERATION_UNLOCK_SCORE));
  const shallowScoreLift = 0.60 * (1 - Math.exp(-depth / 4));
  const shallowCostLift = 0.13 * (1 - Math.exp(-depth / 5));
  const baseScoreMultiplierLog10 = Math.min(
    8,
    Math.log10(1 + depth) * runtime.BALANCE_PROFILE.generationRewardLogCoefficient + shallowScoreLift,
  );
  const ic8ScoreMultiplierLog10 = Number.isFinite(generationScoreLog)
    ? runtime.clampLog10(generationScoreLog * 0.014 + shallowScoreLift)
    : baseScoreMultiplierLog10;
  const scoreMultiplierLog10 = runtime.isChallengeCompleted(8)
    ? ic8ScoreMultiplierLog10
    : baseScoreMultiplierLog10;
  return {
    scoreMultiplierLog10,
    scoreMultiplierGain: runtime.valueFromLog10(scoreMultiplierLog10),
    costReduction: Math.min(0.24, Math.log10(1 + depth) * 0.04 + shallowCostLift),
  };
}

function balanceGenerationMinCostFactor() {
  return runtime.hasInfinityUpgrade("6-2") ? 0.70 : runtime.GENERATION_MIN_NEW_COST_FACTOR;
}

function balanceRestoreGenerationCostFactor(rawValue, upgradeMask = runtime.state.infinityUpgradeMask) {
  if ((Math.floor(Number(upgradeMask) || 0) & (1 << 9)) === 0) return;
  const value = runtime.parseSavedNumber(rawValue);
  if (!Number.isFinite(value)) return;
  runtime.state.generationCostFactor = Math.max(0.70, Math.min(1, value));
}

function balanceRestoreGenerationCostFactorFromLocalSave() {
  if (typeof localStorage === "undefined" || typeof runtime.SAVE_KEY === "undefined") return;
  try {
    const saved = JSON.parse(localStorage.getItem(runtime.SAVE_KEY) || "null");
    if (saved && saved.state) {
      balanceRestoreGenerationCostFactor(saved.state.generationCostFactor, saved.state.infinityUpgradeMask);
    }
  } catch (error) {
    // The core save loader already handles malformed saves safely.
  }
}

function balanceGenerationScorePower() {
  let power = runtime.GENERATION_SCORE_POWER;
  if (runtime.hasInfinityUpgrade("3-1")) power *= runtime.applyInfinityUpgradePower(1.5);
  if (runtime.hasInfinityUpgrade("6-1")) power *= runtime.applyInfinityUpgradePower(1.2);
  return power;
}

function canonicalGenerationCostFactorWithBonuses(rawCostFactor) {
  const upgradeFactor = runtime.hasInfinityUpgrade("3-2") ? runtime.applyInfinityUpgradePower(0.95) : 1;
  const achievementFactor = runtime.isAchievementUnlocked(20) ? 0.98 : 1;
  return Math.pow(rawCostFactor, 1) * upgradeFactor * achievementFactor;
}

function balanceApplyResetStartScore() {
  if (!runtime.hasInfinityUpgrade("5-2")) return;
  runtime.state.score = 100;
  runtime.state.scoreLog10 = 2;
}

function balanceRunGeneration() {
  if (!runtime.canRunGeneration()) return;
  runtime.state.currentInfinityRunHadGeneration = true;
  const generationScoreBeforeResetLog = runtime.currentGenerationScoreLog10();
  const reward = runtime.generationRewardForLog(generationScoreBeforeResetLog);
  const nextCostFactor = runtime.state.generationCostFactor * (1 - reward.costReduction);
  runtime.checkAchievements(true);
  runtime.state.generationCount += 1;
  runtime.state.previousGenerationScoreLog10 = generationScoreBeforeResetLog;
  runtime.state.previousGenerationScore = runtime.valueFromLog10(generationScoreBeforeResetLog);
  runtime.state.generationScoreMultiplierLog10 = reward.scoreMultiplierLog10;
  runtime.state.generationScoreMultiplier = runtime.valueFromLog10(runtime.state.generationScoreMultiplierLog10);
  runtime.state.generationCostFactor = Math.max(
    balanceGenerationMinCostFactor(),
    nextCostFactor,
    runtime.state.activeTowerChallenge === 2 ? 0.90 : 0,
  );
  if (!runtime.eternityMilestonePreservesGenerationReset?.()) {
    runtime.state.score = 0;
    runtime.state.scoreLog10 = -Infinity;
    runtime.state.generationScore = 0;
    runtime.state.generationScoreLog10 = -Infinity;
    runtime.state.vertices = 3;
    runtime.state.ic8VertexUpgradeLevel = 0;
    runtime.state.currentGain = 1;
    runtime.state.currentGainLog10 = 0;
    runtime.state.pointProgress = 0;
    runtime.state.totalVertexProgress = 0;
    runtime.state.lastVertexIndex = 0;
    runtime.state.floatingTexts = [];
    runtime.state.currentGenerationRunTime = 0;
    runtime.state.speedLevel = 0;
    runtime.state.gainLevel = 0;
  }
  if (!runtime.eternityMilestonePreservesGenerationReset?.()) balanceApplyResetStartScore();
  runtime.checkAchievements(true);
  runtime.updateUi();
  runtime.saveGame("manual");
}

function balanceNextGenerationValues() {
  if (!runtime.canRunGeneration()) {
    return {
      scoreMultiplier: runtime.generationScoreMultiplierEffect(),
      scoreMultiplierLog10: runtime.generationScoreMultiplierEffectLog10(),
      costFactor: runtime.generationCostFactorEffect(),
    };
  }
  const reward = runtime.generationRewardForLog(runtime.currentGenerationScoreLog10());
  const nextRawScoreMultiplierLog = reward.scoreMultiplierLog10;
  const nextRawCostFactor = Math.max(
    balanceGenerationMinCostFactor(),
    runtime.state.generationCostFactor * (1 - reward.costReduction),
    runtime.state.activeTowerChallenge === 2 ? 0.90 : 0,
  );
  return {
    scoreMultiplier: runtime.valueFromLog10(runtime.towerChallengeGenerationScoreMultiplierLog10(runtime.applyGenerationAchievementRewardLog10(runtime.generationScoreMultiplierBaseEffectLog10(nextRawScoreMultiplierLog)))),
    scoreMultiplierLog10: runtime.towerChallengeGenerationScoreMultiplierLog10(runtime.applyGenerationAchievementRewardLog10(runtime.generationScoreMultiplierBaseEffectLog10(nextRawScoreMultiplierLog))),
    costFactor: runtime.towerChallengeGenerationCostFactor(canonicalGenerationCostFactorWithBonuses(nextRawCostFactor)),
  };
}

expose("balanceGenerationRewardForLog", () => balanceGenerationRewardForLog);
expose("balanceGenerationMinCostFactor", () => balanceGenerationMinCostFactor);
expose("balanceRestoreGenerationCostFactor", () => balanceRestoreGenerationCostFactor);
expose("balanceRestoreGenerationCostFactorFromLocalSave", () => balanceRestoreGenerationCostFactorFromLocalSave);
expose("balanceGenerationScorePower", () => balanceGenerationScorePower);
expose("balanceApplyResetStartScore", () => balanceApplyResetStartScore);
expose("balanceRunGeneration", () => balanceRunGeneration);
expose("balanceNextGenerationValues", () => balanceNextGenerationValues);
