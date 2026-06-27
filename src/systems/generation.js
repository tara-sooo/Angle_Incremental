import { runtime, expose } from "../runtime/shared.js";

// Extracted mechanically from the next-runtime baseline.
// Functions retain their original global runtime dependencies during the classic-script migration phase.

function generationScorePower() {
  let power = runtime.GENERATION_SCORE_POWER;
  if (runtime.hasInfinityUpgrade("3-1")) power *= runtime.applyInfinityUpgradePower(1.5);
  return power;
}

function generationCostPower() {
  return 1;
}

function generationCostFactorWithBonuses(rawCostFactor) {
  const upgradeFactor = runtime.hasInfinityUpgrade("3-2") ? runtime.applyInfinityUpgradePower(0.95) : 1;
  const achievementFactor = runtime.isAchievementUnlocked(20) ? 0.98 : 1;
  return Math.pow(rawCostFactor, generationCostPower()) * upgradeFactor * achievementFactor;
}

function currentGenerationScoreMultiplierLog10() {
  const savedLog = runtime.sanitizeLog10(runtime.state.generationScoreMultiplierLog10, null);
  return savedLog === null ? runtime.log10Value(runtime.state.generationScoreMultiplier) : savedLog;
}

function generationScoreMultiplierBaseEffectLog10(rawMultiplierLog = currentGenerationScoreMultiplierLog10()) {
  return runtime.clampLog10(rawMultiplierLog * generationScorePower());
}

function generationScoreMultiplierBaseEffect(rawMultiplier = runtime.state.generationScoreMultiplier) {
  return runtime.valueFromLog10(generationScoreMultiplierBaseEffectLog10(runtime.log10Value(rawMultiplier)));
}

function generationAchievementMultiplier() {
  return generationScoreMultiplierBaseEffect();
}

function applyGenerationAchievementRewardLog10(baseLog) {
  if (!runtime.isAchievementUnlocked(3)) return baseLog;
  if (baseLog <= 12) return runtime.log10Value(1 + (10 ** baseLog - 1) * 2);
  return runtime.clampLog10(baseLog + runtime.log10Value(2));
}

function applyGenerationAchievementReward(baseMultiplier) {
  if (!runtime.isAchievementUnlocked(3)) return baseMultiplier;
  return 1 + (baseMultiplier - 1) * 2;
}

function generationScoreMultiplierEffectLog10(includeAchievementReward = true) {
  const baseLog = generationScoreMultiplierBaseEffectLog10();
  return includeAchievementReward ? applyGenerationAchievementRewardLog10(baseLog) : baseLog;
}

function generationScoreMultiplierEffect(includeAchievementReward = true) {
  return runtime.valueFromLog10(generationScoreMultiplierEffectLog10(includeAchievementReward));
}

function generationCostFactorEffect() {
  return generationCostFactorWithBonuses(runtime.state.generationCostFactor);
}

function generationRewardForLog(generationScoreLog) {
  const depth = Math.max(0, generationScoreLog - runtime.log10Value(runtime.GENERATION_UNLOCK_SCORE));
  return {
    scoreMultiplierLog10: Math.min(8, Math.log10(1 + depth) * 2),
    scoreMultiplierGain: runtime.valueFromLog10(Math.min(8, Math.log10(1 + depth) * 2)),
    costReduction: Math.min(0.22, Math.log10(1 + depth) * 0.04),
  };
}

function generationRewardFor(generationScore) {
  return generationRewardForLog(runtime.log10Value(generationScore));
}

function generationRequirementLog10() {
  if (runtime.state.generationCount <= 0) return runtime.log10Value(runtime.GENERATION_UNLOCK_SCORE);
  return Math.max(runtime.log10Value(runtime.GENERATION_UNLOCK_SCORE), runtime.currentPreviousGenerationScoreLog10());
}

function generationRequirement() {
  return runtime.valueFromLog10(generationRequirementLog10());
}

function canRunGeneration() {
  const generationScoreLog = runtime.currentGenerationScoreLog10();
  if (runtime.state.generationCount <= 0) return generationScoreLog >= runtime.log10Value(runtime.GENERATION_UNLOCK_SCORE);
  return generationScoreLog > generationRequirementLog10();
}

function nextGenerationValues() {
  if (!canRunGeneration()) {
    return {
      scoreMultiplier: generationScoreMultiplierEffect(),
      scoreMultiplierLog10: generationScoreMultiplierEffectLog10(),
      costFactor: generationCostFactorEffect(),
    };
  }

  const reward = generationRewardForLog(runtime.currentGenerationScoreLog10());
  const nextRawScoreMultiplierLog = reward.scoreMultiplierLog10;
  const nextRawCostFactor = Math.max(runtime.GENERATION_MIN_NEW_COST_FACTOR, runtime.state.generationCostFactor * (1 - reward.costReduction));

  return {
    scoreMultiplier: runtime.valueFromLog10(applyGenerationAchievementRewardLog10(generationScoreMultiplierBaseEffectLog10(nextRawScoreMultiplierLog))),
    scoreMultiplierLog10: applyGenerationAchievementRewardLog10(generationScoreMultiplierBaseEffectLog10(nextRawScoreMultiplierLog)),
    costFactor: generationCostFactorWithBonuses(nextRawCostFactor),
  };
}

function runGeneration() {
  if (!canRunGeneration()) return;

  const generationScoreBeforeResetLog = runtime.currentGenerationScoreLog10();
  const reward = generationRewardForLog(generationScoreBeforeResetLog);
  const nextCostFactor = runtime.state.generationCostFactor * (1 - reward.costReduction);
  const preservedVertices = runtime.shouldPreserveVerticesThroughEarlyReset() ? runtime.state.vertices : 3;
  runtime.state.generationCount += 1;
  runtime.state.previousGenerationScoreLog10 = generationScoreBeforeResetLog;
  runtime.state.previousGenerationScore = runtime.valueFromLog10(generationScoreBeforeResetLog);
  runtime.state.generationScoreMultiplierLog10 = reward.scoreMultiplierLog10;
  runtime.state.generationScoreMultiplier = runtime.valueFromLog10(runtime.state.generationScoreMultiplierLog10);
  runtime.state.generationCostFactor = Math.max(runtime.GENERATION_MIN_NEW_COST_FACTOR, nextCostFactor);

  runtime.state.score = 0;
  runtime.state.scoreLog10 = -Infinity;
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
  runtime.state.floatingTexts = [];
  runtime.updateUi();
  runtime.saveGame("manual");
}

function balanceGenerationRewardForLog(generationScoreLog) {
  const depth = Math.max(0, generationScoreLog - runtime.log10Value(runtime.GENERATION_UNLOCK_SCORE));
  const shallowScoreLift = 0.60 * (1 - Math.exp(-depth / 4)) * Math.exp(-depth / 90);
  const shallowCostLift = 0.13 * (1 - Math.exp(-depth / 5)) * Math.exp(-depth / 80);
  const scoreMultiplierLog10 = Math.min(
    8,
    Math.log10(1 + depth) * runtime.BALANCE_PROFILE.generationRewardLogCoefficient + shallowScoreLift,
  );
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
      balanceRestoreGenerationCostFactor(
        saved.state.generationCostFactor,
        saved.state.infinityUpgradeMask,
      );
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

function balanceApplyResetStartScore() {
  if (!runtime.hasInfinityUpgrade("5-2")) return;
  runtime.state.score = 100;
  runtime.state.scoreLog10 = 2;
}

function balanceRunGeneration() {
  if (!canRunGeneration()) return;
  const generationScoreBeforeResetLog = runtime.currentGenerationScoreLog10();
  const reward = generationRewardForLog(generationScoreBeforeResetLog);
  const nextCostFactor = runtime.state.generationCostFactor * (1 - reward.costReduction);
  const preservedVertices = runtime.shouldPreserveVerticesThroughEarlyReset() ? runtime.state.vertices : 3;
  runtime.state.generationCount += 1;
  runtime.state.previousGenerationScoreLog10 = generationScoreBeforeResetLog;
  runtime.state.previousGenerationScore = runtime.valueFromLog10(generationScoreBeforeResetLog);
  runtime.state.generationScoreMultiplierLog10 = reward.scoreMultiplierLog10;
  runtime.state.generationScoreMultiplier = runtime.valueFromLog10(runtime.state.generationScoreMultiplierLog10);
  runtime.state.generationCostFactor = Math.max(balanceGenerationMinCostFactor(), nextCostFactor);
  runtime.state.score = 0;
  runtime.state.scoreLog10 = -Infinity;
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
  runtime.state.floatingTexts = [];
  balanceApplyResetStartScore();
  runtime.updateUi();
  runtime.saveGame("manual");
}

function balanceNextGenerationValues() {
  if (!canRunGeneration()) {
    return {
      scoreMultiplier: generationScoreMultiplierEffect(),
      scoreMultiplierLog10: generationScoreMultiplierEffectLog10(),
      costFactor: generationCostFactorEffect(),
    };
  }
  const reward = generationRewardForLog(runtime.currentGenerationScoreLog10());
  const nextRawScoreMultiplierLog = reward.scoreMultiplierLog10;
  const nextRawCostFactor = Math.max(
    balanceGenerationMinCostFactor(),
    runtime.state.generationCostFactor * (1 - reward.costReduction),
  );
  return {
    scoreMultiplier: runtime.valueFromLog10(applyGenerationAchievementRewardLog10(generationScoreMultiplierBaseEffectLog10(nextRawScoreMultiplierLog))),
    scoreMultiplierLog10: applyGenerationAchievementRewardLog10(generationScoreMultiplierBaseEffectLog10(nextRawScoreMultiplierLog)),
    costFactor: generationCostFactorWithBonuses(nextRawCostFactor),
  };
}
expose("generationScorePower", () => generationScorePower, (value) => { generationScorePower = value; });
expose("generationCostPower", () => generationCostPower, (value) => { generationCostPower = value; });
expose("currentGenerationScoreMultiplierLog10", () => currentGenerationScoreMultiplierLog10, (value) => { currentGenerationScoreMultiplierLog10 = value; });
expose("generationScoreMultiplierBaseEffectLog10", () => generationScoreMultiplierBaseEffectLog10, (value) => { generationScoreMultiplierBaseEffectLog10 = value; });
expose("generationScoreMultiplierBaseEffect", () => generationScoreMultiplierBaseEffect, (value) => { generationScoreMultiplierBaseEffect = value; });
expose("generationAchievementMultiplier", () => generationAchievementMultiplier, (value) => { generationAchievementMultiplier = value; });
expose("applyGenerationAchievementRewardLog10", () => applyGenerationAchievementRewardLog10, (value) => { applyGenerationAchievementRewardLog10 = value; });
expose("applyGenerationAchievementReward", () => applyGenerationAchievementReward, (value) => { applyGenerationAchievementReward = value; });
expose("generationScoreMultiplierEffectLog10", () => generationScoreMultiplierEffectLog10, (value) => { generationScoreMultiplierEffectLog10 = value; });
expose("generationScoreMultiplierEffect", () => generationScoreMultiplierEffect, (value) => { generationScoreMultiplierEffect = value; });
expose("generationCostFactorEffect", () => generationCostFactorEffect, (value) => { generationCostFactorEffect = value; });
expose("generationRewardForLog", () => generationRewardForLog, (value) => { generationRewardForLog = value; });
expose("generationRewardFor", () => generationRewardFor, (value) => { generationRewardFor = value; });
expose("generationRequirementLog10", () => generationRequirementLog10, (value) => { generationRequirementLog10 = value; });
expose("generationRequirement", () => generationRequirement, (value) => { generationRequirement = value; });
expose("canRunGeneration", () => canRunGeneration, (value) => { canRunGeneration = value; });
expose("nextGenerationValues", () => nextGenerationValues, (value) => { nextGenerationValues = value; });
expose("runGeneration", () => runGeneration, (value) => { runGeneration = value; });
expose("balanceGenerationRewardForLog", () => balanceGenerationRewardForLog, (value) => { balanceGenerationRewardForLog = value; });
expose("balanceGenerationMinCostFactor", () => balanceGenerationMinCostFactor, (value) => { balanceGenerationMinCostFactor = value; });
expose("balanceRestoreGenerationCostFactor", () => balanceRestoreGenerationCostFactor, (value) => { balanceRestoreGenerationCostFactor = value; });
expose("balanceRestoreGenerationCostFactorFromLocalSave", () => balanceRestoreGenerationCostFactorFromLocalSave, (value) => { balanceRestoreGenerationCostFactorFromLocalSave = value; });
expose("balanceGenerationScorePower", () => balanceGenerationScorePower, (value) => { balanceGenerationScorePower = value; });
expose("balanceApplyResetStartScore", () => balanceApplyResetStartScore, (value) => { balanceApplyResetStartScore = value; });
expose("balanceRunGeneration", () => balanceRunGeneration, (value) => { balanceRunGeneration = value; });
expose("balanceNextGenerationValues", () => balanceNextGenerationValues, (value) => { balanceNextGenerationValues = value; });
