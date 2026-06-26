import { runtime, expose } from "../runtime/shared.js";

// Extracted mechanically from the next-runtime baseline.
// Functions retain their original global runtime dependencies during the classic-script migration phase.

function rawLapSpeedLog10() {
  let multiplierLog = runtime.state.speedLevel * runtime.log10Value(1.22);
  if (runtime.hasInfinityUpgrade("2-1")) multiplierLog += runtime.log10Value(runtime.applyInfinityUpgradePower(1.5));
  if (runtime.isChallengeCompleted(3)) multiplierLog += runtime.log10Value(1.1);
  if (runtime.state.activeChallenge === 3) multiplierLog *= 0.8;
  return runtime.clampLog10(multiplierLog);
}

function rawLapSpeedMultiplier() {
  return runtime.valueFromLog10(rawLapSpeedLog10());
}

function effectiveLapSpeedLog10() {
  const rawLog = rawLapSpeedLog10();
  const softcapStart = lapSpeedSoftcapStart();
  const softcapStartLog = runtime.log10Value(softcapStart);
  const softcappedLog = rawLog <= softcapStartLog
    ? rawLog
    : softcapStartLog + (rawLog - softcapStartLog) * lapSpeedSoftcapPower();
  if (softcappedLog <= runtime.LAP_SPEED_SUPER_SOFTCAP_START_LOG10) return softcappedLog;
  return runtime.LAP_SPEED_SUPER_SOFTCAP_START_LOG10
    + Math.log10(1 + softcappedLog - runtime.LAP_SPEED_SUPER_SOFTCAP_START_LOG10) * runtime.LAP_SPEED_SUPER_SOFTCAP_LOG_STRENGTH;
}

function lapSpeedMultiplier() {
  return runtime.valueFromLog10(effectiveLapSpeedLog10());
}

function isLapSpeedSoftcapped() {
  return rawLapSpeedLog10() > runtime.log10Value(lapSpeedSoftcapStart());
}

function lapSpeedSoftcapStart() {
  if (runtime.state.generationCount <= 0) return runtime.PRE_GENERATION_LAP_SPEED_SOFTCAP_START;
  const stagedStart = Math.min(
    runtime.LAP_SPEED_SOFTCAP_START,
    60 + (runtime.state.generationCount - 1) * 40 + runtime.state.coreBoostCount * 65,
  );
  const relief = Math.min(1.5, Math.max(0, runtime.currentGenerationScoreMultiplierLog10()) * 0.08);
  return stagedStart * (1 + relief);
}

function lapSpeedSoftcapPower() {
  if (runtime.state.generationCount <= 0) return runtime.PRE_GENERATION_LAP_SPEED_SOFTCAP_POWER;
  return Math.min(
    runtime.LAP_SPEED_SOFTCAP_POWER,
    0.24 + (runtime.state.generationCount - 1) * 0.06 + runtime.state.coreBoostCount * 0.1,
  );
}

function lapDuration() {
  return runtime.BASE_LAP_SECONDS / lapSpeedMultiplier();
}

function currentScoreLog10() {
  return currentLog10ForValue(runtime.state.score, runtime.state.scoreLog10);
}

function currentLog10ForValue(value, savedLog) {
  const log = runtime.sanitizeLog10(savedLog);
  if (value === Number.MAX_VALUE && log > -Infinity) return log;
  return Math.max(runtime.log10Value(value), log);
}

function currentTotalScoreLog10() {
  return currentLog10ForValue(runtime.state.totalScore, runtime.state.totalScoreLog10);
}

function currentGenerationScoreLog10() {
  return currentLog10ForValue(runtime.state.generationScore, runtime.state.generationScoreLog10);
}

function currentGainLog10() {
  return currentLog10ForValue(runtime.state.currentGain, runtime.state.currentGainLog10);
}

function setCurrentGainLog10(log) {
  runtime.state.currentGainLog10 = Math.max(0, runtime.clampLog10(log));
  runtime.state.currentGain = runtime.valueFromLog10(runtime.state.currentGainLog10);
}

function addCurrentGain(amount) {
  if (amount <= 0) return;
  setCurrentGainLog10(runtime.combineLog10(currentGainLog10(), runtime.log10Value(amount)));
}

function gainAfterIncreaseLog10(increase, stepCount) {
  if (stepCount <= 0 || increase <= 0) return currentGainLog10();
  return runtime.combineLog10(currentGainLog10(), runtime.log10Value(increase) + runtime.log10Value(stepCount));
}

function currentPreviousGenerationScoreLog10() {
  return currentLog10ForValue(runtime.state.previousGenerationScore, runtime.state.previousGenerationScoreLog10);
}

function currentInfinityPointsLog10() {
  return currentLog10ForValue(runtime.state.infinityPoints, runtime.state.infinityPointsLog10);
}

function currentInfiniteScoreLog10() {
  return currentLog10ForValue(runtime.state.infiniteScore, runtime.state.infiniteScoreLog10);
}

function scoreDisplay() {
  const scoreLog = currentScoreLog10();
  if (runtime.state.numberFormat === "scientific" && scoreLog > -Infinity) return runtime.formatScientificLog(scoreLog);
  if (scoreLog >= (runtime.state.numberFormat === "detailed" ? 3 : 18)) return runtime.formatLogNumber(scoreLog);
  return runtime.formatNumber(runtime.state.score);
}

function applyInfinitySoftcap(rawLog10) {
  if (runtime.state.infiniteCapBroken || rawLog10 <= runtime.INFINITY_REQUIREMENT_LOG10) return rawLog10;
  return runtime.INFINITY_REQUIREMENT_LOG10 + (rawLog10 - runtime.INFINITY_REQUIREMENT_LOG10) * runtime.infinitySoftcapPower();
}

function vertexGainIncrease() {
  const infinityResetBoost = runtime.hasInfinityUpgrade("1-1") ? runtime.applyInfinityUpgradePower(Math.max(1, runtime.state.infinityCount)) : 1;
  let gain = (0.01 + runtime.state.gainLevel * 0.01)
    * runtime.coreBoostGainIncreaseMultiplier()
    * runtime.infiniteAngleBoost()
    * runtime.achievementGainMultiplier()
    * infinityResetBoost;
  if (runtime.state.activeChallenge === 6) return 0.001;
  if (runtime.state.activeChallenge === 4) gain = Math.pow(gain, 0.5);
  if (runtime.isChallengeCompleted(4)) gain = Math.pow(gain, 1.1);
  return gain;
}

function finalScoreGainPower() {
  return 1;
}

function finalScoreGainDivisor() {
  return 1;
}

function finalScoreGain(baseGain = runtime.state.currentGain) {
  const gainLog = finalScoreGainLog10(baseGain);
  return gainLog <= 308 ? 10 ** gainLog : Infinity;
}

function angleExpressionFromBaseLog10(baseLog) {
  const config = runtime.gainExpressionConfig();
  if (config.parts <= 1) return baseLog;
  return (baseLog - runtime.log10Value(config.divisor)) * config.parts;
}

function angleExpressionLog10(baseGain = runtime.state.currentGain) {
  return angleExpressionFromBaseLog10(runtime.log10Value(Math.max(baseGain, 0)));
}

function preExpressionScoreGainLog10(baseGain = runtime.state.currentGain) {
  return angleExpressionLog10(baseGain);
}

function finalScoreGainFromBaseLog10(baseLog) {
  const angleLog = angleExpressionFromBaseLog10(baseLog) * runtime.coreBoostGainExponent();
  const boostedLog = angleLog + runtime.generationScoreMultiplierEffectLog10();
  return boostedLog * finalScoreGainPower() - runtime.log10Value(finalScoreGainDivisor());
}

function finalScoreGainLog10(baseGain = runtime.state.currentGain) {
  if (baseGain === runtime.state.currentGain) return finalScoreGainFromBaseLog10(currentGainLog10());
  return finalScoreGainFromBaseLog10(runtime.log10Value(Math.max(baseGain, 0)));
}

function coreVertexIndices() {
  return [0];
}

function isCoreVertex(index) {
  return coreVertexIndices().includes(index);
}

function sumCoreHitGains(firstCoreStep, coreHits, increase) {
  const stride = runtime.state.vertices;

  if (coreHits > runtime.MAX_EXACT_CORE_HITS) {
    let earned = 0;
    const segmentSize = coreHits / runtime.CORE_HIT_APPROX_SEGMENTS;
    for (let segment = 0; segment < runtime.CORE_HIT_APPROX_SEGMENTS; segment += 1) {
      const midHit = (segment + 0.5) * segmentSize;
      const stepAtMid = firstCoreStep + midHit * stride;
      const gainLog = gainAfterIncreaseLog10(increase, stepAtMid);
      const scoreLog = finalScoreGainFromBaseLog10(gainLog);
      earned += runtime.valueFromLog10(scoreLog) * segmentSize;
    }
    return earned;
  }

  let earned = 0;
  for (let hit = 0; hit < coreHits; hit += 1) {
    const gainLog = gainAfterIncreaseLog10(increase, firstCoreStep + hit * stride);
    earned += runtime.valueFromLog10(finalScoreGainFromBaseLog10(gainLog));
  }
  return earned;
}

function earlyLayerCostScalingFactor() {
  let generationFactor;
  if (runtime.state.generationCount <= 0) generationFactor = 1;
  else if (runtime.state.generationCount === 1) generationFactor = 0.9;
  else if (runtime.state.generationCount === 2) generationFactor = 0.45;
  else if (runtime.state.generationCount === 3) generationFactor = 0.2;
  else generationFactor = 0.08;

  let coreRelief;
  if (runtime.state.coreBoostCount <= 0) coreRelief = 1;
  else if (runtime.state.coreBoostCount === 1) coreRelief = 0.35;
  else if (runtime.state.coreBoostCount === 2) coreRelief = 0.1;
  else coreRelief = 0;

  return generationFactor * coreRelief;
}

function preGenerationCostScalingLog10(kind, level) {
  const scalingFactor = earlyLayerCostScalingFactor();
  if (scalingFactor <= 0) return 0;
  const scaling = runtime.PRE_GENERATION_COST_SCALING[kind];
  if (!scaling) return 0;
  const excess = Math.max(0, level - scaling.startsAfter);
  return excess * excess * scaling.logScale * scalingFactor;
}

function stagedUpgradeCostScalingLog10(costLog) {
  const relief = Math.max(
    0.28,
    1 - Math.max(0, runtime.state.generationCount - 1) * 0.06 - runtime.state.coreBoostCount * 0.16,
  );
  return runtime.STAGED_UPGRADE_COST_SCALING.reduce((total, stage) => {
    const excess = Math.max(0, costLog - stage.startsAfterLog10);
    return total + excess * excess * stage.logScale * relief;
  }, 0);
}

function costLog10(kind, base, level, growth) {
  const growthLog = runtime.log10Value(growth) * (runtime.state.activeChallenge === 3 && kind === "speed" ? 2 : 1);
  const rawLog = runtime.log10Value(base) + level * growthLog;
  const costFactor = runtime.generationCostFactorEffect();
  let adjustedLog;

  if (rawLog <= 300) {
    const rawCost = 10 ** rawLog;
    adjustedLog = runtime.log10Value(Math.ceil(base + (rawCost - base) * costFactor));
  } else {
    adjustedLog = rawLog + runtime.log10Value(costFactor);
  }

  const earlyAdjustedLog = adjustedLog + preGenerationCostScalingLog10(kind, level);
  const scaledLog = earlyAdjustedLog + stagedUpgradeCostScalingLog10(earlyAdjustedLog);
  return runtime.isChallengeCompleted(2) ? scaledLog * 0.95 : scaledLog;
}

function cost(kind, base, level, growth) {
  return runtime.valueFromLog10(costLog10(kind, base, level, growth));
}

function costLogs() {
  return {
    speed: costLog10("speed", 5, runtime.state.speedLevel, 1.55),
    vertex: costLog10("vertex", 12, runtime.state.vertices - 3, 1.72),
    gain: costLog10("gain", 18, runtime.state.gainLevel, 1.68),
  };
}

function costs() {
  return {
    speed: cost("speed", 5, runtime.state.speedLevel, 1.55),
    vertex: cost("vertex", 12, runtime.state.vertices - 3, 1.72),
    gain: cost("gain", 18, runtime.state.gainLevel, 1.68),
  };
}

function addScore(amount, amountLog10 = runtime.log10Value(amount)) {
  const previousScoreLog = currentScoreLog10();
  const rawScoreLog = runtime.combineLog10(previousScoreLog, amountLog10);
  const cappedScoreLog = runtime.clampLog10(applyInfinitySoftcap(rawScoreLog));

  runtime.state.scoreLog10 = cappedScoreLog;
  runtime.state.score = cappedScoreLog <= 308 ? 10 ** cappedScoreLog : Number.MAX_VALUE;
  runtime.state.totalScoreLog10 = runtime.combineLog10(currentTotalScoreLog10(), amountLog10);
  runtime.state.generationScoreLog10 = runtime.combineLog10(currentGenerationScoreLog10(), amountLog10);
  runtime.state.totalScore = runtime.valueFromLog10(runtime.state.totalScoreLog10);
  runtime.state.generationScore = runtime.valueFromLog10(runtime.state.generationScoreLog10);
  runtime.state.lastEarnedLog10 = amountLog10;
  runtime.state.lastEarned = runtime.valueFromLog10(amountLog10);

  if (runtime.checkAchievements(true).length > 0) runtime.saveGame("manual");
  if (runtime.state.infinityCount === 0 && runtime.canInfinity()) {
    runtime.runInfinity(true);
    return true;
  }

  return false;
}

function passVertex(index) {
  addCurrentGain(vertexGainIncrease());
  if (isCoreVertex(index)) {
    const earned = finalScoreGain();
    const resetByInfinity = addScore(earned, finalScoreGainLog10());
    if (resetByInfinity) return true;
    if (runtime.state.showFloatingText && !runtime.state.lightEffects) {
      runtime.state.floatingTexts.push({
        text: `+${runtime.formatUiLogNumber(finalScoreGainLog10())}`,
        life: 1,
        x: runtime.canvas.width / 2,
        y: runtime.canvas.height * 0.16,
      });
    }
  }
  return false;
}

function processManyVertices(start, end) {
  const count = end - start + 1;
  if (count <= 0) return;

  const increase = vertexGainIncrease();
  const coreBatches = coreVertexIndices()
    .map((coreIndex) => {
      const coreOffset = ((coreIndex - (start % runtime.state.vertices)) + runtime.state.vertices) % runtime.state.vertices;
      const coreHits = coreOffset >= count ? 0 : Math.floor((count - 1 - coreOffset) / runtime.state.vertices) + 1;
      return {
        coreHits,
        firstCoreStep: coreOffset + 1,
      };
    })
    .filter((batch) => batch.coreHits > 0);
  const coreHits = coreBatches.reduce((total, batch) => total + batch.coreHits, 0);

  if (coreHits > 0) {
    let earned = 0;
    let lastCoreStep = 0;
    coreBatches.forEach((batch) => {
      earned += sumCoreHitGains(batch.firstCoreStep, batch.coreHits, increase);
      lastCoreStep = Math.max(lastCoreStep, batch.firstCoreStep + (batch.coreHits - 1) * runtime.state.vertices);
    });
    const batchLog = runtime.log10Value(Math.max(coreHits, 1)) + finalScoreGainFromBaseLog10(gainAfterIncreaseLog10(increase, lastCoreStep));
    const resetByInfinity = addScore(earned, Number.isFinite(earned) ? runtime.log10Value(earned) : batchLog);
    if (resetByInfinity) return true;
    if (runtime.state.showFloatingText && !runtime.state.lightEffects) {
      runtime.state.floatingTexts.push({
        text: `+${runtime.formatUiLogNumber(Number.isFinite(earned) ? runtime.log10Value(earned) : batchLog)}`,
        life: 1,
        x: runtime.canvas.width / 2,
        y: runtime.canvas.height * 0.16,
      });
    }
  }

  addCurrentGain(increase * count);
  return false;
}

function normalizeVertexProgress() {
  if (runtime.state.totalVertexProgress <= runtime.MAX_VERTEX_PROGRESS_TRACKED) return;
  const wrapped = ((runtime.state.totalVertexProgress % runtime.state.vertices) + runtime.state.vertices) % runtime.state.vertices;
  runtime.state.totalVertexProgress = wrapped;
  runtime.state.pointProgress = wrapped / runtime.state.vertices;
  runtime.state.lastVertexIndex = Math.floor(wrapped) % runtime.state.vertices;
}

function spendLog(amountLog) {
  const scoreLog = currentScoreLog10();
  if (!runtime.canSpendLog(amountLog)) return false;

  if (scoreLog > 18 && scoreLog - amountLog > 12) {
    return true;
  }

  const remainingLog = runtime.subtractLog10(scoreLog, amountLog);
  runtime.state.scoreLog10 = remainingLog;
  runtime.state.score = runtime.valueFromLog10(remainingLog);
  return true;
}

function spend(amount) {
  return spendLog(runtime.log10Value(amount));
}

function upgradeCostLog(kind) {
  const currentCostLogs = costLogs();
  return currentCostLogs[kind];
}

function canBuyNormalUpgrade(kind) {
  if (runtime.state.activeChallenge === 7 && currentScoreLog10() > 30) return false;
  if (kind === "vertex") {
    if (runtime.state.activeChallenge === 8) return false;
    if (runtime.state.activeChallenge === 2 && runtime.state.vertices >= 200) return false;
  }
  return runtime.canSpendLog(upgradeCostLog(kind));
}

function spendNormalUpgrade(kind) {
  if (!canBuyNormalUpgrade(kind)) return false;
  if (runtime.isChallengeCompleted(7)) return true;
  return spendLog(upgradeCostLog(kind));
}

function resetVertexProgress() {
  runtime.state.pointProgress = 0;
  runtime.state.totalVertexProgress = 0;
  runtime.state.lastVertexIndex = 0;
}

function buySpeed() {
  if (!spendNormalUpgrade("speed")) return;
  runtime.state.speedLevel += 1;
  runtime.updateUi();
  runtime.saveGame("manual");
}

function buyVertex() {
  if (!spendNormalUpgrade("vertex")) return;
  runtime.state.vertices += 1;
  resetVertexProgress();
  runtime.updateUi();
  runtime.saveGame("manual");
}

function buyGain() {
  if (!spendNormalUpgrade("gain")) return;
  runtime.state.gainLevel += 1;
  runtime.updateUi();
  runtime.saveGame("manual");
}

function buyAllUpgrades(options = {}) {
  if (typeof Event !== "undefined" && options instanceof Event) options = {};
  const refresh = options.refresh !== false;
  const persist = options.save !== false;
  const allowSpeed = options.allowSpeed !== false;
  const allowVertex = options.allowVertex !== false;
  const allowGain = options.allowGain !== false;
  let purchases = 0;
  let bought = true;
  while (bought && purchases < runtime.BUY_ALL_LIMIT) {
    bought = false;
    if (allowSpeed && spendNormalUpgrade("speed")) {
      runtime.state.speedLevel += 1;
      purchases += 1;
      bought = true;
      if (purchases >= runtime.BUY_ALL_LIMIT) break;
    }

    if (allowVertex && spendNormalUpgrade("vertex")) {
      runtime.state.vertices += 1;
      resetVertexProgress();
      purchases += 1;
      bought = true;
      if (purchases >= runtime.BUY_ALL_LIMIT) break;
    }

    if (allowGain && spendNormalUpgrade("gain")) {
      runtime.state.gainLevel += 1;
      purchases += 1;
      bought = true;
    }
  }

  if (purchases > 0) {
    if (refresh) runtime.updateUi();
    if (persist) runtime.saveGame("manual");
  }
  return purchases;
}

function balancePreGenerationCostScalingLog10(kind, level) {
  const scaling = runtime.BALANCE_PROFILE.initialUpgradeCostScaling[kind];
  if (!scaling) return 0;
  const excess = Math.max(0, level - scaling.startsAfter);
  return excess * excess * scaling.logScale;
}

function balanceCanBuyNormalUpgrade(kind) {
  const costLog = upgradeCostLog(kind);
  if (runtime.state.activeChallenge === 7 && costLog > 30) return false;
  if (kind === "vertex") {
    if (runtime.state.activeChallenge === 8) return false;
    if (runtime.state.activeChallenge === 2 && runtime.state.vertices >= 200) return false;
  }
  return runtime.canSpendLog(costLog);
}

function balanceCostLog10(kind, base, level, growth) {
  const growthLog = runtime.log10Value(growth) * (runtime.state.activeChallenge === 3 && kind === "speed" ? 2 : 1);
  const rawLog = runtime.log10Value(base) + level * growthLog;
  const costFactor = runtime.generationCostFactorEffect();
  const adjustedLog = rawLog <= 300
    ? runtime.log10Value(Math.ceil(base + (10 ** rawLog - base) * costFactor))
    : rawLog + runtime.log10Value(costFactor);
  const earlyAdjustedLog = adjustedLog + preGenerationCostScalingLog10(kind, level);
  const scaledLog = earlyAdjustedLog + stagedUpgradeCostScalingLog10(earlyAdjustedLog);
  const challengeAdjustedLog = runtime.isChallengeCompleted(2) ? scaledLog * 0.95 : scaledLog;
  return challengeAdjustedLog * runtime.balanceInfinityUpgradeCostExponent();
}

function balanceRawLapSpeedLog10() {
  let multiplierLog = runtime.state.speedLevel * runtime.log10Value(1.22);
  if (runtime.hasInfinityUpgrade("2-1")) multiplierLog += runtime.log10Value(runtime.applyInfinityUpgradePower(1.5));
  if (runtime.hasInfinityUpgrade("5-1")) multiplierLog += runtime.log10Value(runtime.applyInfinityUpgradePower(3));
  if (runtime.isChallengeCompleted(3)) multiplierLog += runtime.log10Value(1.1);
  if (runtime.state.activeChallenge === 3) multiplierLog *= 0.8;
  return runtime.clampLog10(multiplierLog);
}

function balanceVertexGainIncrease() {
  const infinityResetBoost = runtime.hasInfinityUpgrade("1-1")
    ? runtime.applyInfinityUpgradePower(runtime.state.infinityCount + 1)
    : 1;
  let gain = (0.01 + runtime.state.gainLevel * 0.01)
    * runtime.coreBoostGainIncreaseMultiplier()
    * runtime.infiniteAngleBoost()
    * runtime.achievementGainMultiplier()
    * infinityResetBoost;
  if (runtime.state.activeChallenge === 6) return 0.001;
  if (runtime.state.activeChallenge === 4) gain = Math.pow(gain, 0.5);
  if (runtime.isChallengeCompleted(4)) gain = Math.pow(gain, 1.1);
  return gain;
}
expose("rawLapSpeedLog10", () => rawLapSpeedLog10, (value) => { rawLapSpeedLog10 = value; });
expose("rawLapSpeedMultiplier", () => rawLapSpeedMultiplier, (value) => { rawLapSpeedMultiplier = value; });
expose("effectiveLapSpeedLog10", () => effectiveLapSpeedLog10, (value) => { effectiveLapSpeedLog10 = value; });
expose("lapSpeedMultiplier", () => lapSpeedMultiplier, (value) => { lapSpeedMultiplier = value; });
expose("isLapSpeedSoftcapped", () => isLapSpeedSoftcapped, (value) => { isLapSpeedSoftcapped = value; });
expose("lapSpeedSoftcapStart", () => lapSpeedSoftcapStart, (value) => { lapSpeedSoftcapStart = value; });
expose("lapSpeedSoftcapPower", () => lapSpeedSoftcapPower, (value) => { lapSpeedSoftcapPower = value; });
expose("lapDuration", () => lapDuration, (value) => { lapDuration = value; });
expose("currentScoreLog10", () => currentScoreLog10, (value) => { currentScoreLog10 = value; });
expose("currentLog10ForValue", () => currentLog10ForValue, (value) => { currentLog10ForValue = value; });
expose("currentTotalScoreLog10", () => currentTotalScoreLog10, (value) => { currentTotalScoreLog10 = value; });
expose("currentGenerationScoreLog10", () => currentGenerationScoreLog10, (value) => { currentGenerationScoreLog10 = value; });
expose("currentGainLog10", () => currentGainLog10, (value) => { currentGainLog10 = value; });
expose("setCurrentGainLog10", () => setCurrentGainLog10, (value) => { setCurrentGainLog10 = value; });
expose("addCurrentGain", () => addCurrentGain, (value) => { addCurrentGain = value; });
expose("gainAfterIncreaseLog10", () => gainAfterIncreaseLog10, (value) => { gainAfterIncreaseLog10 = value; });
expose("currentPreviousGenerationScoreLog10", () => currentPreviousGenerationScoreLog10, (value) => { currentPreviousGenerationScoreLog10 = value; });
expose("currentInfinityPointsLog10", () => currentInfinityPointsLog10, (value) => { currentInfinityPointsLog10 = value; });
expose("currentInfiniteScoreLog10", () => currentInfiniteScoreLog10, (value) => { currentInfiniteScoreLog10 = value; });
expose("scoreDisplay", () => scoreDisplay, (value) => { scoreDisplay = value; });
expose("applyInfinitySoftcap", () => applyInfinitySoftcap, (value) => { applyInfinitySoftcap = value; });
expose("vertexGainIncrease", () => vertexGainIncrease, (value) => { vertexGainIncrease = value; });
expose("finalScoreGainPower", () => finalScoreGainPower, (value) => { finalScoreGainPower = value; });
expose("finalScoreGainDivisor", () => finalScoreGainDivisor, (value) => { finalScoreGainDivisor = value; });
expose("finalScoreGain", () => finalScoreGain, (value) => { finalScoreGain = value; });
expose("angleExpressionFromBaseLog10", () => angleExpressionFromBaseLog10, (value) => { angleExpressionFromBaseLog10 = value; });
expose("angleExpressionLog10", () => angleExpressionLog10, (value) => { angleExpressionLog10 = value; });
expose("preExpressionScoreGainLog10", () => preExpressionScoreGainLog10, (value) => { preExpressionScoreGainLog10 = value; });
expose("finalScoreGainFromBaseLog10", () => finalScoreGainFromBaseLog10, (value) => { finalScoreGainFromBaseLog10 = value; });
expose("finalScoreGainLog10", () => finalScoreGainLog10, (value) => { finalScoreGainLog10 = value; });
expose("coreVertexIndices", () => coreVertexIndices, (value) => { coreVertexIndices = value; });
expose("isCoreVertex", () => isCoreVertex, (value) => { isCoreVertex = value; });
expose("sumCoreHitGains", () => sumCoreHitGains, (value) => { sumCoreHitGains = value; });
expose("earlyLayerCostScalingFactor", () => earlyLayerCostScalingFactor, (value) => { earlyLayerCostScalingFactor = value; });
expose("preGenerationCostScalingLog10", () => preGenerationCostScalingLog10, (value) => { preGenerationCostScalingLog10 = value; });
expose("stagedUpgradeCostScalingLog10", () => stagedUpgradeCostScalingLog10, (value) => { stagedUpgradeCostScalingLog10 = value; });
expose("costLog10", () => costLog10, (value) => { costLog10 = value; });
expose("cost", () => cost, (value) => { cost = value; });
expose("costLogs", () => costLogs, (value) => { costLogs = value; });
expose("costs", () => costs, (value) => { costs = value; });
expose("addScore", () => addScore, (value) => { addScore = value; });
expose("passVertex", () => passVertex, (value) => { passVertex = value; });
expose("processManyVertices", () => processManyVertices, (value) => { processManyVertices = value; });
expose("normalizeVertexProgress", () => normalizeVertexProgress, (value) => { normalizeVertexProgress = value; });
expose("spendLog", () => spendLog, (value) => { spendLog = value; });
expose("spend", () => spend, (value) => { spend = value; });
expose("upgradeCostLog", () => upgradeCostLog, (value) => { upgradeCostLog = value; });
expose("canBuyNormalUpgrade", () => canBuyNormalUpgrade, (value) => { canBuyNormalUpgrade = value; });
expose("spendNormalUpgrade", () => spendNormalUpgrade, (value) => { spendNormalUpgrade = value; });
expose("resetVertexProgress", () => resetVertexProgress, (value) => { resetVertexProgress = value; });
expose("buySpeed", () => buySpeed, (value) => { buySpeed = value; });
expose("buyVertex", () => buyVertex, (value) => { buyVertex = value; });
expose("buyGain", () => buyGain, (value) => { buyGain = value; });
expose("buyAllUpgrades", () => buyAllUpgrades, (value) => { buyAllUpgrades = value; });
expose("balancePreGenerationCostScalingLog10", () => balancePreGenerationCostScalingLog10, (value) => { balancePreGenerationCostScalingLog10 = value; });
expose("balanceCanBuyNormalUpgrade", () => balanceCanBuyNormalUpgrade, (value) => { balanceCanBuyNormalUpgrade = value; });
expose("balanceCostLog10", () => balanceCostLog10, (value) => { balanceCostLog10 = value; });
expose("balanceRawLapSpeedLog10", () => balanceRawLapSpeedLog10, (value) => { balanceRawLapSpeedLog10 = value; });
expose("balanceVertexGainIncrease", () => balanceVertexGainIncrease, (value) => { balanceVertexGainIncrease = value; });

