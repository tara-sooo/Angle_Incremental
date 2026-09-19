import { runtime, expose } from "../runtime/shared.js";

// Angle progression, vertex processing, normal upgrades, and score gain.

const MAX_SAFE_CORE_HIT_SEARCH = Number.MAX_SAFE_INTEGER;
const SCORE_ORDERING_ACHIEVEMENT_IDS = [7, 18, 29, 35];

function normalUpgradeFields(kind) {
  if (kind === "speed") return ["speedLevelExact", "speedLevel"];
  if (kind === "gain") return ["gainLevelExact", "gainLevel"];
  if (kind === "vertex") {
    return runtime.state.activeChallenge === 8
      ? ["ic8VertexUpgradeLevelExact", "ic8VertexUpgradeLevel"]
      : ["verticesExact", "vertices"];
  }
  return null;
}

function currentExactVertices() {
  return runtime.currentExactIntegerState(runtime.state, "verticesExact", "vertices", 3n);
}

function currentExactNormalUpgradeLevel(kind) {
  const fields = normalUpgradeFields(kind);
  if (!fields) return 0n;
  const exact = runtime.currentExactIntegerState(runtime.state, fields[0], fields[1]);
  return kind === "vertex" && runtime.state.activeChallenge !== 8
    ? exact > 3n ? exact - 3n : 0n
    : exact;
}

function normalUpgradeLevelValue(kind) {
  return runtime.numberFromExactInteger(currentExactNormalUpgradeLevel(kind));
}

function normalUpgradeLevelLog10(kind) {
  return runtime.log10ExactInteger(currentExactNormalUpgradeLevel(kind));
}

function normalUpgradeLevelExact(kind) {
  return currentExactNormalUpgradeLevel(kind).toString();
}

function addNormalUpgradeLevel(kind, amount = 1n) {
  const fields = normalUpgradeFields(kind);
  if (!fields) return 0n;
  return runtime.addExactIntegerState(runtime.state, fields[0], fields[1], amount);
}

function resetNormalUpgradeLevels() {
  runtime.setExactIntegerState(runtime.state, "verticesExact", "vertices", 3n);
  runtime.setExactIntegerState(runtime.state, "ic8VertexUpgradeLevelExact", "ic8VertexUpgradeLevel", 0n);
  runtime.setExactIntegerState(runtime.state, "speedLevelExact", "speedLevel", 0n);
  runtime.setExactIntegerState(runtime.state, "gainLevelExact", "gainLevel", 0n);
}

function rawLapSpeedLog10() {
  let multiplierLog = effectiveSpeedLevel() * runtime.log10Value(1.22);
  if (runtime.hasInfinityUpgrade("2-1")) multiplierLog += runtime.log10Value(runtime.applyInfinityUpgradePower(1.5));
  if (runtime.hasInfinityUpgrade("5-1")) multiplierLog += runtime.log10Value(runtime.applyInfinityUpgradePower(3));
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
    60 + (runtime.state.generationCount - 1) * 40 + runtime.effectiveCoreBoostCount() * 65,
  );
  const relief = Math.min(1.5, Math.max(0, runtime.currentGenerationScoreMultiplierLog10()) * 0.08);
  return stagedStart * (1 + relief);
}

function lapSpeedSoftcapPower() {
  if (runtime.state.generationCount <= 0) return runtime.PRE_GENERATION_LAP_SPEED_SOFTCAP_POWER;
  return Math.min(
    runtime.LAP_SPEED_SOFTCAP_POWER,
    0.24 + (runtime.state.generationCount - 1) * 0.06 + runtime.effectiveCoreBoostCount() * 0.1,
  );
}

function lapDuration() {
  return runtime.BASE_LAP_SECONDS / lapSpeedMultiplier();
}

function scoreExponent() {
  return runtime.hasInfinityUpgrade("10-2") ? 1.2 : 1;
}

function effectiveScoreExponent() {
  return scoreExponent() * runtime.towerScoreExponent();
}

function rawCurrentScoreLog10() {
  return currentLog10ForValue(runtime.state.score, runtime.state.scoreLog10);
}

function effectiveScoreLog10FromRaw(rawLog) {
  if (rawLog === -Infinity) return -Infinity;
  return runtime.clampLog10(rawLog * effectiveScoreExponent());
}

function rawScoreLog10FromEffective(effectiveLog) {
  if (effectiveLog === -Infinity) return -Infinity;
  return runtime.clampLog10(effectiveLog / effectiveScoreExponent());
}

function currentScoreLog10() {
  return effectiveScoreLog10FromRaw(rawCurrentScoreLog10());
}

function currentLog10ForValue(value, savedLog) {
  const log = runtime.sanitizeLog10(savedLog);
  return log > -Infinity ? log : runtime.log10Value(value);
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

function addCurrentGainLog10(amountLog10) {
  if (amountLog10 === -Infinity) return;
  setCurrentGainLog10(runtime.combineLog10(currentGainLog10(), amountLog10));
}

function addCurrentGain(amount) {
  if (amount <= 0) return;
  addCurrentGainLog10(runtime.log10Value(amount));
}

function gainAfterIncreaseLog10FromLog(increaseLog10, stepCount) {
  if (stepCount <= 0 || increaseLog10 === -Infinity) return currentGainLog10();
  return runtime.combineLog10(currentGainLog10(), increaseLog10 + runtime.log10Value(stepCount));
}

function gainAfterIncreaseLog10(increase, stepCount) {
  if (stepCount <= 0 || increase <= 0) return currentGainLog10();
  return gainAfterIncreaseLog10FromLog(runtime.log10Value(increase), stepCount);
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

function sponsoredNormalUpgradeBonusLevel() {
  if (!runtime.hasInfinityUpgrade("11-1")) return 0;
  const maximumIp = runtime.state.activeTowerChallenge === 1 ? 20000 : 100000;
  const effectiveIp = Math.min(maximumIp, runtime.valueFromLog10(currentInfinityPointsLog10()));
  return Math.max(0, Math.floor(effectiveIp / 2000));
}

function iu11_2Hardcap() {
  return runtime.hasInfinityUpgrade("14-1") ? 30000 : 10000;
}

function iu11_2EffectiveInfinityCount() {
  const hardcap = BigInt(iu11_2Hardcap());
  const count = runtime.currentExactIntegerState(runtime.state, "infinityCountExact", "infinityCount");
  return Number(count < hardcap ? count : hardcap);
}

function effectiveSpeedLevel() {
  return normalUpgradeLevelValue("speed") * runtime.towerNormalUpgradeMultiplier()
    + sponsoredNormalUpgradeBonusLevel()
    + (runtime.eternityMilestoneNormalUpgradeBonusLevel?.() || 0);
}

function effectiveGainLevel() {
  return normalUpgradeLevelValue("gain") * runtime.towerNormalUpgradeMultiplier()
    + sponsoredNormalUpgradeBonusLevel()
    + (runtime.eternityMilestoneNormalUpgradeBonusLevel?.() || 0);
}

function effectiveVertexCount() {
  if (runtime.state.activeChallenge === 8) return 3;
  const purchasedVertices = Math.max(0, runtime.numberFromExactInteger(currentExactVertices()) - 3);
  const scaledPurchasedVertices = purchasedVertices * runtime.towerNormalUpgradeMultiplier();
  const count = 3 + (Number.isFinite(scaledPurchasedVertices)
    ? Math.floor(scaledPurchasedVertices)
    : Number.MAX_VALUE)
    + sponsoredNormalUpgradeBonusLevel()
    + (runtime.eternityMilestoneNormalUpgradeBonusLevel?.() || 0);
  if (runtime.state.activeChallenge === 2) return Math.min(200, count);
  return count;
}

function ic8VertexGainMultiplier() {
  return Math.pow(runtime.IC8_VERTEX_GAIN_MULTIPLIER, runtime.ic8VertexUpgradeCount());
}

function scoreDisplay() {
  const scoreLog = currentScoreLog10();
  return runtime.formatHeldUiLogNumber(scoreLog);
}

function applyInfinitySoftcap(rawLog10) {
  if (runtime.state.infiniteCapBroken || rawLog10 <= runtime.INFINITY_REQUIREMENT_LOG10) return rawLog10;
  return runtime.INFINITY_REQUIREMENT_LOG10 + (rawLog10 - runtime.INFINITY_REQUIREMENT_LOG10) * runtime.infinitySoftcapPower();
}

function vertexGainIncreaseLog10() {
  const infinityCountPlusOne = runtime.numberFromExactInteger(
    runtime.currentExactIntegerState(runtime.state, "infinityCountExact", "infinityCount") + 1n,
  );
  const infinityResetBoost = runtime.hasInfinityUpgrade("1-1")
    ? runtime.applyInfinityUpgradePower(runtime.hasInfinityUpgrade("11-2") ? Math.pow(1.005, iu11_2EffectiveInfinityCount()) : infinityCountPlusOne)
    : 1;
  let gainLog10 = runtime.log10Value(0.01 + effectiveGainLevel() * 0.01)
    + runtime.log10Value(runtime.coreBoostGainIncreaseMultiplier())
    + runtime.log10Value(ic8VertexGainMultiplier())
    + runtime.infiniteAngleBoostLog10()
    + runtime.log10Value(runtime.achievementGainMultiplier())
    + runtime.log10Value(infinityResetBoost);
  if (runtime.state.activeChallenge === 6) return runtime.log10Value(0.001);
  if (runtime.state.activeChallenge === 4) gainLog10 *= 0.5;
  if (runtime.isChallengeCompleted(4)) gainLog10 *= 1.1;
  return runtime.clampLog10(gainLog10);
}

function vertexGainIncrease() {
  return runtime.valueFromLog10(vertexGainIncreaseLog10());
}

function finalScoreGainPower() {
  return runtime.state.activeTowerChallenge === 3
    ? runtime.towerChallenge3ScoreGainPower()
    : 1;
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
  const effectiveParts = runtime.tc4EffectiveGainExpressionParts(config.parts);
  if (effectiveParts <= 1) return baseLog;
  return (baseLog - runtime.log10Value(config.divisor)) * effectiveParts;
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

function sumCoreHitGainsFromLog10(firstCoreStep, coreHits, increaseLog10) {
  const stride = runtime.effectiveVertexCount();
  const plan = runtime.offlineCoreHitPlan(
    "angle",
    coreHits,
    runtime.MAX_EXACT_CORE_HITS,
    runtime.CORE_HIT_APPROX_SEGMENTS,
  );

  if (plan.mode === "approximation") {
    let earned = 0;
    const segmentSize = coreHits / plan.iterations;
    for (let segment = 0; segment < plan.iterations; segment += 1) {
      const midHit = (segment + 0.5) * segmentSize;
      const stepAtMid = firstCoreStep + midHit * stride;
      const gainLog = gainAfterIncreaseLog10FromLog(increaseLog10, stepAtMid);
      const scoreLog = finalScoreGainFromBaseLog10(gainLog);
      earned += runtime.valueFromLog10(scoreLog) * segmentSize;
    }
    return earned;
  }

  let earned = 0;
  for (let hit = 0; hit < coreHits; hit += 1) {
    const gainLog = gainAfterIncreaseLog10FromLog(increaseLog10, firstCoreStep + hit * stride);
    earned += runtime.valueFromLog10(finalScoreGainFromBaseLog10(gainLog));
  }
  return earned;
}

function sumCoreHitGains(firstCoreStep, coreHits, increase) {
  return sumCoreHitGainsFromLog10(firstCoreStep, coreHits, runtime.log10Value(increase));
}

function addCurrentGainForVertexSteps(stepCount) {
  if (stepCount <= 0) return;
  const increaseLog10 = runtime.vertexGainIncreaseLog10();
  if (increaseLog10 === -Infinity) return;
  const addedLog = increaseLog10 + Math.log10(stepCount);
  runtime.setCurrentGainLog10(runtime.combineLog10(runtime.currentGainLog10(), addedLog));
}

function coreBatchesBetween(start, end) {
  const count = end - start + 1;
  if (count <= 0) return [];
  const vertices = Math.max(3, runtime.effectiveVertexCount());
  return runtime.coreVertexIndices()
    .map((coreIndex) => {
      const coreOffset = ((coreIndex - (start % vertices)) + vertices) % vertices;
      const coreHits = coreOffset >= count ? 0 : Math.floor((count - 1 - coreOffset) / vertices) + 1;
      return { coreHits, firstCoreStep: coreOffset + 1 };
    })
    .filter((batch) => batch.coreHits > 0);
}

function coreBatchScoreLog10(firstCoreStep, coreHits, increaseLog10, selectedPlan = null) {
  const vertices = Math.max(3, runtime.effectiveVertexCount());
  let totalLog = -Infinity;
  const plan = selectedPlan || runtime.offlineCoreHitPlan(
    "angle",
    coreHits,
    runtime.MAX_EXACT_BATCH_CORE_HITS,
    runtime.CORE_HIT_BATCH_APPROX_SEGMENTS,
  );

  if (plan.mode === "exact") {
    for (let hit = 0; hit < coreHits; hit += 1) {
      const step = firstCoreStep + hit * vertices;
      const gainLog = runtime.gainAfterIncreaseLog10FromLog(increaseLog10, step);
      totalLog = runtime.combineLog10(totalLog, runtime.finalScoreGainFromBaseLog10(gainLog));
    }
    return totalLog;
  }

  const segments = plan.iterations;
  const segmentSize = coreHits / segments;
  for (let segment = 0; segment < segments; segment += 1) {
    const midHit = (segment + 0.5) * segmentSize;
    const step = firstCoreStep + midHit * vertices;
    const gainLog = runtime.gainAfterIncreaseLog10FromLog(increaseLog10, step);
    totalLog = runtime.combineLog10(
      totalLog,
      runtime.finalScoreGainFromBaseLog10(gainLog) + Math.log10(segmentSize),
    );
  }
  return totalLog;
}

function totalCoreHitsInBatches(batches) {
  return batches.reduce((total, batch) => total + batch.coreHits, 0);
}

function coreHitsThroughStep(batch, step, vertices) {
  if (step < batch.firstCoreStep) return 0;
  return Math.min(batch.coreHits, Math.floor((step - batch.firstCoreStep) / vertices) + 1);
}

function countCoreHitsThroughStep(batches, step, vertices) {
  return batches.reduce((total, batch) => total + coreHitsThroughStep(batch, step, vertices), 0);
}

function coreStepForChronologicalHit(batches, hitIndex) {
  if (hitIndex <= 0 || hitIndex > totalCoreHitsInBatches(batches)) return null;
  const vertices = Math.max(3, runtime.effectiveVertexCount());
  if (batches.length === 1) {
    return batches[0].firstCoreStep + (hitIndex - 1) * vertices;
  }
  let low = Math.min(...batches.map((batch) => batch.firstCoreStep));
  let high = Math.max(...batches.map((batch) => batch.firstCoreStep + (batch.coreHits - 1) * vertices));
  let step = null;

  while (low <= high) {
    const mid = low + Math.floor((high - low) / 2);
    if (countCoreHitsThroughStep(batches, mid, vertices) >= hitIndex) {
      step = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return step;
}

function coreScoreLogForFirstHits(batches, hitLimit, increaseLog10, plannedBatches = null) {
  const cutoffStep = coreStepForChronologicalHit(batches, hitLimit);
  if (cutoffStep === null) return -Infinity;
  const vertices = Math.max(3, runtime.effectiveVertexCount());

  return batches.reduce((totalLog, batch, index) => {
    const hits = coreHitsThroughStep(batch, cutoffStep, vertices);
    if (hits <= 0) return totalLog;
    return runtime.combineLog10(
      totalLog,
      coreBatchScoreLog10(
        batch.firstCoreStep,
        hits,
        increaseLog10,
        plannedBatches?.[index]?.plan || null,
      ),
    );
  }, -Infinity);
}

function projectedScoreLogFromRawGain(rawGainLog) {
  const rawScoreLog = runtime.combineLog10(runtime.rawCurrentScoreLog10(), rawGainLog);
  const cappedRawScoreLog = runtime.clampLog10(runtime.applyInfinitySoftcap(rawScoreLog));
  return runtime.effectiveScoreLog10FromRaw(cappedRawScoreLog);
}

function projectedScoreLogAfterCoreHits(batches, hitLimit, increaseLog10, plannedBatches = null) {
  const scoreLog = coreScoreLogForFirstHits(batches, hitLimit, increaseLog10, plannedBatches);
  return projectedScoreLogFromRawGain(scoreLog);
}

function firstInfinityCrossingCoreHit(batches, increaseLog10, plannedBatches = null) {
  const maxHit = totalCoreHitsInBatches(batches);
  let low = 1;
  let high = 1;
  while (high < maxHit && projectedScoreLogAfterCoreHits(
    batches,
    high,
    increaseLog10,
    plannedBatches,
  ) < runtime.INFINITY_REQUIREMENT_LOG10) {
    low = high + 1;
    high = Math.min(maxHit, high * 2);
  }
  let crossingHit = null;

  while (low <= high) {
    const mid = low + Math.floor((high - low) / 2);
    if (mid === low || mid === high) {
      if (projectedScoreLogAfterCoreHits(
        batches,
        low,
        increaseLog10,
        plannedBatches,
      ) >= runtime.INFINITY_REQUIREMENT_LOG10) crossingHit = low;
      else if (projectedScoreLogAfterCoreHits(
        batches,
        high,
        increaseLog10,
        plannedBatches,
      ) >= runtime.INFINITY_REQUIREMENT_LOG10) crossingHit = high;
      break;
    }
    if (projectedScoreLogAfterCoreHits(
      batches,
      mid,
      increaseLog10,
      plannedBatches,
    ) >= runtime.INFINITY_REQUIREMENT_LOG10) {
      crossingHit = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  if (crossingHit === null) return null;
  return {
    hit: crossingHit,
    step: coreStepForChronologicalHit(batches, crossingHit),
  };
}

function firstInfinityCrossingExceedsSafeHitCount(batches) {
  if (batches.length <= 1) return false;
  return totalCoreHitsInBatches(batches) > MAX_SAFE_CORE_HIT_SEARCH;
}

function addFirstInfinityThresholdScore() {
  const requiredScoreLog = runtime.subtractLog10(runtime.INFINITY_REQUIREMENT_LOG10, runtime.currentScoreLog10());
  return runtime.addScore(runtime.valueFromLog10(requiredScoreLog), requiredScoreLog);
}

function processFirstInfinityCrossingBatch(batches, increaseLog10, plannedBatches = null) {
  if (firstInfinityCrossingExceedsSafeHitCount(batches)) {
    return addFirstInfinityThresholdScore();
  }

  const crossing = firstInfinityCrossingCoreHit(batches, increaseLog10, plannedBatches);
  if (!crossing || crossing.step === null) return false;

  const previousCoreScoreLog = coreScoreLogForFirstHits(
    batches,
    crossing.hit - 1,
    increaseLog10,
    plannedBatches,
  );
  if (previousCoreScoreLog > -Infinity) {
    const resetBeforeCrossing = runtime.addScore(runtime.valueFromLog10(previousCoreScoreLog), previousCoreScoreLog);
    if (resetBeforeCrossing) return true;
  }

  addCurrentGainForVertexSteps(crossing.step);
  const crossingScoreLog = runtime.finalScoreGainFromBaseLog10(runtime.currentGainLog10());
  return runtime.addScore(runtime.valueFromLog10(crossingScoreLog), crossingScoreLog);
}

function processOfflineVerticesInOrder(start, end, batches) {
  const count = end - start + 1;
  const vertices = Math.max(3, runtime.effectiveVertexCount());
  const coreSteps = [];
  batches.forEach((batch) => {
    for (let hit = 0; hit < batch.coreHits; hit += 1) {
      coreSteps.push(batch.firstCoreStep + hit * vertices);
    }
  });
  coreSteps.sort((a, b) => a - b);

  let processedSteps = 0;
  for (const coreStep of coreSteps) {
    addCurrentGainForVertexSteps(coreStep - processedSteps);
    const earned = runtime.finalScoreGain();
    if (runtime.addScore(earned, runtime.finalScoreGainLog10())) return true;
    processedSteps = coreStep;
  }
  addCurrentGainForVertexSteps(count - processedSteps);
  return false;
}

function scoreAchievementNeedsOrderedProcessing(projectedScoreLog) {
  if (!Array.isArray(runtime.ACHIEVEMENTS) || typeof runtime.isAchievementUnlocked !== "function") return false;
  const currentScoreLog10 = runtime.currentScoreLog10;
  runtime.currentScoreLog10 = () => projectedScoreLog;
  try {
    return SCORE_ORDERING_ACHIEVEMENT_IDS.some((id) => {
      const achievement = runtime.ACHIEVEMENTS[id - 1];
      return achievement
        && !runtime.isAchievementUnlocked(id)
        && achievement.isUnlocked();
    });
  } finally {
    runtime.currentScoreLog10 = currentScoreLog10;
  }
}

function earlyLayerCostScalingFactor() {
  return 1;
}

function preGenerationCostScalingLog10(kind, level) {
  const scaling = runtime.PRE_GENERATION_COST_SCALING[kind];
  if (!scaling) return 0;
  const excess = Math.max(0, level - scaling.startsAfter);
  let generationRelief = 1;
  if (runtime.state.generationCount === 1) generationRelief = 0.25;
  else if (runtime.state.generationCount === 2) generationRelief = 0.10;
  else if (runtime.state.generationCount >= 3) generationRelief = 0.05;
  return excess * excess * scaling.logScale * generationRelief;
}

function stagedUpgradeCostScalingLog10(costLog) {
  const relief = Math.max(
    0.28,
    1 - Math.max(0, runtime.state.generationCount - 1) * 0.06 - runtime.effectiveCoreBoostCount() * 0.16,
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
  const challengeAdjustedLog = runtime.isChallengeCompleted(2) ? scaledLog * 0.95 : scaledLog;
  return challengeAdjustedLog * runtime.infinityUpgradeCostExponent();
}

function cost(kind, base, level, growth) {
  return runtime.valueFromLog10(costLog10(kind, base, level, growth));
}

function costLogs() {
  const vertexLevel = normalUpgradeLevelValue("vertex");
  return {
    speed: costLog10("speed", 5, normalUpgradeLevelValue("speed"), 1.55),
    vertex: costLog10("vertex", 12, vertexLevel, 1.72),
    gain: costLog10("gain", 18, normalUpgradeLevelValue("gain"), 1.68),
  };
}

function costs() {
  const vertexLevel = normalUpgradeLevelValue("vertex");
  return {
    speed: cost("speed", 5, normalUpgradeLevelValue("speed"), 1.55),
    vertex: cost("vertex", 12, vertexLevel, 1.72),
    gain: cost("gain", 18, normalUpgradeLevelValue("gain"), 1.68),
  };
}

function addScore(amount, amountLog10 = runtime.log10Value(amount)) {
  const previousScoreLog = rawCurrentScoreLog10();
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
  if (
    runtime.currentExactIntegerState(runtime.state, "infinityCountExact", "infinityCount") === 0n
    && runtime.canInfinity()
    && (runtime.state.activeTowerChallenge <= 0 || runtime.towerChallengeCanComplete())
  ) {
    runtime.runInfinity(true);
    return true;
  }

  return false;
}

function passVertex(index) {
  addCurrentGainLog10(runtime.vertexGainIncreaseLog10());
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
  if (count <= 0) return false;

  const increaseLog10 = runtime.vertexGainIncreaseLog10();
  if (increaseLog10 === -Infinity) return false;
  const batches = coreBatchesBetween(start, end);

  if (batches.length > 0) {
    const plannedBatches = runtime.offlineProcessing
      ? batches.map((batch) => ({
        ...batch,
        plan: runtime.offlineCoreHitPlan(
          "angle",
          batch.coreHits,
          runtime.MAX_EXACT_BATCH_CORE_HITS,
          runtime.CORE_HIT_BATCH_APPROX_SEGMENTS,
        ),
      }))
      : batches;
    const scoreLog = batches.reduce(
      (totalLog, batch, index) => runtime.combineLog10(
        totalLog,
        coreBatchScoreLog10(
          batch.firstCoreStep,
          batch.coreHits,
          increaseLog10,
          plannedBatches[index]?.plan,
        ),
      ),
      -Infinity,
    );
    const projectedScoreLog = projectedScoreLogFromRawGain(scoreLog);
    if (plannedBatches !== batches
      && plannedBatches.every((batch) => batch.plan.mode === "exact")
      && scoreAchievementNeedsOrderedProcessing(projectedScoreLog)) {
      return processOfflineVerticesInOrder(start, end, plannedBatches);
    }

    if (
      runtime.currentExactIntegerState(runtime.state, "infinityCountExact", "infinityCount") === 0n
      && projectedScoreLog >= runtime.INFINITY_REQUIREMENT_LOG10
    ) {
      return processFirstInfinityCrossingBatch(batches, increaseLog10, plannedBatches);
    }

    const scoreValue = runtime.valueFromLog10(scoreLog);
    const resetByInfinity = runtime.addScore(scoreValue, scoreLog);
    if (resetByInfinity) return true;
    if (runtime.state.showFloatingText && !runtime.state.lightEffects) {
      runtime.state.floatingTexts.push({
        text: `+${runtime.formatUiLogNumber(scoreLog)}`,
        life: 1,
        x: runtime.canvas.width / 2,
        y: runtime.canvas.height * 0.16,
      });
    }
  }

  addCurrentGainForVertexSteps(count);
  return false;
}

function normalizeVertexProgress() {
  if (runtime.state.totalVertexProgress <= runtime.MAX_VERTEX_PROGRESS_TRACKED) return;
  const vertices = runtime.effectiveVertexCount();
  const wrapped = ((runtime.state.totalVertexProgress % vertices) + vertices) % vertices;
  runtime.state.totalVertexProgress = wrapped;
  runtime.state.pointProgress = wrapped / vertices;
  runtime.state.lastVertexIndex = Math.floor(wrapped) % vertices;
}

function spendLog(amountLog) {
  const scoreLog = currentScoreLog10();
  if (!runtime.canSpendLog(amountLog)) return false;

  if (scoreLog > 18 && scoreLog - amountLog > 12) {
    return true;
  }

  const remainingLog = runtime.subtractLog10(scoreLog, amountLog);
  const rawRemainingLog = rawScoreLog10FromEffective(remainingLog);
  runtime.state.scoreLog10 = rawRemainingLog;
  runtime.state.score = runtime.valueFromLog10(rawRemainingLog);
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
  if (runtime.state.activeTowerChallenge === 1) return false;
  if (!runtime.towerChallenge4AllowsNormalUpgrade(kind)) return false;
  const costLog = upgradeCostLog(kind);
  if (runtime.state.activeChallenge === 7 && costLog > 30) return false;
  if (kind === "vertex") {
    if (runtime.state.activeChallenge === 2 && runtime.effectiveVertexCount() >= 200) return false;
  }
  return runtime.canSpendLog(costLog);
}

function spendNormalUpgrade(kind) {
  if (!runtime.towerChallenge4AllowsNormalUpgrade(kind) || !canBuyNormalUpgrade(kind)) return false;
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
  addNormalUpgradeLevel("speed");
  runtime.updateUi();
  runtime.saveGame("manual");
}

function buyVertex() {
  if (!spendNormalUpgrade("vertex")) return;
  addNormalUpgradeLevel("vertex");
  resetVertexProgress();
  runtime.updateUi();
  runtime.saveGame("manual");
}

function buyGain() {
  if (!spendNormalUpgrade("gain")) return;
  addNormalUpgradeLevel("gain");
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
      addNormalUpgradeLevel("speed");
      purchases += 1;
      bought = true;
      if (purchases >= runtime.BUY_ALL_LIMIT) break;
    }

    if (allowVertex && spendNormalUpgrade("vertex")) {
      addNormalUpgradeLevel("vertex");
      resetVertexProgress();
      purchases += 1;
      bought = true;
      if (purchases >= runtime.BUY_ALL_LIMIT) break;
    }

    if (allowGain && spendNormalUpgrade("gain")) {
      addNormalUpgradeLevel("gain");
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

expose("rawLapSpeedLog10", () => rawLapSpeedLog10, (value) => { rawLapSpeedLog10 = value; });
expose("rawLapSpeedMultiplier", () => rawLapSpeedMultiplier, (value) => { rawLapSpeedMultiplier = value; });
expose("effectiveLapSpeedLog10", () => effectiveLapSpeedLog10, (value) => { effectiveLapSpeedLog10 = value; });
expose("lapSpeedMultiplier", () => lapSpeedMultiplier, (value) => { lapSpeedMultiplier = value; });
expose("isLapSpeedSoftcapped", () => isLapSpeedSoftcapped, (value) => { isLapSpeedSoftcapped = value; });
expose("lapSpeedSoftcapStart", () => lapSpeedSoftcapStart, (value) => { lapSpeedSoftcapStart = value; });
expose("lapSpeedSoftcapPower", () => lapSpeedSoftcapPower, (value) => { lapSpeedSoftcapPower = value; });
expose("lapDuration", () => lapDuration, (value) => { lapDuration = value; });
expose("currentScoreLog10", () => currentScoreLog10, (value) => { currentScoreLog10 = value; });
expose("rawCurrentScoreLog10", () => rawCurrentScoreLog10, (value) => { rawCurrentScoreLog10 = value; });
expose("scoreExponent", () => scoreExponent, (value) => { scoreExponent = value; });
expose("effectiveScoreExponent", () => effectiveScoreExponent);
expose("effectiveScoreLog10FromRaw", () => effectiveScoreLog10FromRaw, (value) => { effectiveScoreLog10FromRaw = value; });
expose("rawScoreLog10FromEffective", () => rawScoreLog10FromEffective, (value) => { rawScoreLog10FromEffective = value; });
expose("currentLog10ForValue", () => currentLog10ForValue, (value) => { currentLog10ForValue = value; });
expose("currentTotalScoreLog10", () => currentTotalScoreLog10, (value) => { currentTotalScoreLog10 = value; });
expose("currentGenerationScoreLog10", () => currentGenerationScoreLog10, (value) => { currentGenerationScoreLog10 = value; });
expose("currentGainLog10", () => currentGainLog10, (value) => { currentGainLog10 = value; });
expose("setCurrentGainLog10", () => setCurrentGainLog10, (value) => { setCurrentGainLog10 = value; });
expose("addCurrentGainLog10", () => addCurrentGainLog10, (value) => { addCurrentGainLog10 = value; });
expose("addCurrentGain", () => addCurrentGain, (value) => { addCurrentGain = value; });
expose("gainAfterIncreaseLog10FromLog", () => gainAfterIncreaseLog10FromLog, (value) => { gainAfterIncreaseLog10FromLog = value; });
expose("gainAfterIncreaseLog10", () => gainAfterIncreaseLog10, (value) => { gainAfterIncreaseLog10 = value; });
expose("currentPreviousGenerationScoreLog10", () => currentPreviousGenerationScoreLog10, (value) => { currentPreviousGenerationScoreLog10 = value; });
expose("currentInfinityPointsLog10", () => currentInfinityPointsLog10, (value) => { currentInfinityPointsLog10 = value; });
expose("currentInfiniteScoreLog10", () => currentInfiniteScoreLog10, (value) => { currentInfiniteScoreLog10 = value; });
expose("sponsoredNormalUpgradeBonusLevel", () => sponsoredNormalUpgradeBonusLevel, (value) => { sponsoredNormalUpgradeBonusLevel = value; });
expose("iu11_2Hardcap", () => iu11_2Hardcap, (value) => { iu11_2Hardcap = value; });
expose("iu11_2EffectiveInfinityCount", () => iu11_2EffectiveInfinityCount, (value) => { iu11_2EffectiveInfinityCount = value; });
expose("currentExactVertices", () => currentExactVertices);
expose("currentExactNormalUpgradeLevel", () => currentExactNormalUpgradeLevel);
expose("normalUpgradeLevelValue", () => normalUpgradeLevelValue);
expose("normalUpgradeLevelLog10", () => normalUpgradeLevelLog10);
expose("normalUpgradeLevelExact", () => normalUpgradeLevelExact);
expose("addNormalUpgradeLevel", () => addNormalUpgradeLevel);
expose("resetNormalUpgradeLevels", () => resetNormalUpgradeLevels);
expose("effectiveSpeedLevel", () => effectiveSpeedLevel, (value) => { effectiveSpeedLevel = value; });
expose("effectiveGainLevel", () => effectiveGainLevel, (value) => { effectiveGainLevel = value; });
expose("effectiveVertexCount", () => effectiveVertexCount, (value) => { effectiveVertexCount = value; });
expose("ic8VertexGainMultiplier", () => ic8VertexGainMultiplier, (value) => { ic8VertexGainMultiplier = value; });
expose("scoreDisplay", () => scoreDisplay, (value) => { scoreDisplay = value; });
expose("applyInfinitySoftcap", () => applyInfinitySoftcap, (value) => { applyInfinitySoftcap = value; });
expose("vertexGainIncreaseLog10", () => vertexGainIncreaseLog10, (value) => { vertexGainIncreaseLog10 = value; });
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
expose("sumCoreHitGainsFromLog10", () => sumCoreHitGainsFromLog10, (value) => { sumCoreHitGainsFromLog10 = value; });
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
