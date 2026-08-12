import { runtime } from "../runtime/shared.js";

const MAX_GAME_LOG10 = Number.MAX_VALUE;
const MAX_NATIVE_VALUE_LOG10 = Math.log10(Number.MAX_VALUE);
const MAX_GAME_VERTICES = 1_000_000_000_000;
const MAX_EXACT_BATCH_CORE_HITS = 2048;
const CORE_HIT_BATCH_APPROX_SEGMENTS = 256;
const MAX_SAFE_CORE_HIT_SEARCH = Number.MAX_SAFE_INTEGER;
let installed = false;

function clampGameLog10(value) {
  if (value === -Infinity) return -Infinity;
  if (value === Infinity) return MAX_GAME_LOG10;
  return Number.isFinite(value) ? Math.min(value, MAX_GAME_LOG10) : -Infinity;
}

function sanitizeGameLog10(value, fallback = -Infinity) {
  const parsed = runtime.parseSavedNumber(value);
  if (parsed === -Infinity) return -Infinity;
  if (parsed === Infinity) return MAX_GAME_LOG10;
  return Number.isFinite(parsed) ? Math.min(parsed, MAX_GAME_LOG10) : fallback;
}

function valueFromGameLog10(log) {
  const normalized = clampGameLog10(log);
  if (normalized === -Infinity) return 0;
  if (normalized >= MAX_NATIVE_VALUE_LOG10) return Number.MAX_VALUE;
  const value = 10 ** normalized;
  return Number.isFinite(value) ? value : Number.MAX_VALUE;
}

function combineGameLog10(a, b) {
  if (a === -Infinity) return b;
  if (b === -Infinity) return a;
  if (a === Infinity || b === Infinity) return MAX_GAME_LOG10;
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  if (high - low > 15) return high;
  return clampGameLog10(high + Math.log10(1 + 10 ** (low - high)));
}

function subtractGameLog10(currentLog, amountLog) {
  if (currentLog === -Infinity || amountLog === -Infinity) return currentLog;
  if (currentLog === Infinity) return MAX_GAME_LOG10;
  if (amountLog > currentLog) return currentLog;
  if (currentLog - amountLog > 15) return currentLog;
  const remainingFactor = 1 - 10 ** (amountLog - currentLog);
  return remainingFactor <= 0 ? -Infinity : currentLog + Math.log10(remainingFactor);
}

function currentLog10FromState(value, savedLog) {
  const log = runtime.sanitizeLog10(savedLog);
  return log > -Infinity ? log : runtime.log10Value(value);
}

function coreBoostRequirementWithoutEarlyCap() {
  const count = Math.max(0, Math.floor(runtime.state.coreBoostCount));
  const growthPower = typeof runtime.coreBoostRequirementGrowthPower === "function"
    ? runtime.coreBoostRequirementGrowthPower()
    : 2;
  const multiplier = growthPower ** count;
  if (Number.isFinite(multiplier)) {
    const requirementLog10 = Math.log10(runtime.CORE_BOOST_BASE_REQUIREMENT) * multiplier;
    const challengeAdjustedLog10 = runtime.state.activeChallenge === 8 ? requirementLog10 * 2 : requirementLog10;
    if (Number.isFinite(challengeAdjustedLog10)) return challengeAdjustedLog10;
  }
  return MAX_GAME_LOG10;
}

function normalizedSavedVertices(data) {
  const raw = Math.floor(runtime.sanitizeNumber(data && data.vertices, 3, 3));
  return Math.min(MAX_GAME_VERTICES, Math.max(3, raw));
}

function loadedTowerChallengeIsInvalid(data) {
  const activeTowerChallenge = Math.min(
    runtime.TOWER_CHALLENGE_COUNT || 0,
    Math.max(0, Math.floor(runtime.sanitizeNumber(data && data.activeTowerChallenge, 0))),
  );
  return activeTowerChallenge > 0
    && (!runtime.towerChallengeImplemented?.(activeTowerChallenge)
      || !runtime.towerChallengeUnlocked?.(activeTowerChallenge));
}

function restoreVerticesAfterLoad(data) {
  if (
    runtime.state.activeChallenge === 2
    || runtime.state.activeChallenge === 8
    || loadedTowerChallengeIsInvalid(data)
  ) return;
  runtime.state.vertices = normalizedSavedVertices(data);
  if (runtime.state.totalVertexProgress > runtime.MAX_VERTEX_PROGRESS_TRACKED) {
    runtime.normalizeVertexProgress();
  }
  runtime.state.lastVertexIndex = Math.floor(runtime.state.pointProgress * runtime.state.vertices) % runtime.state.vertices;
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
    MAX_EXACT_BATCH_CORE_HITS,
    CORE_HIT_BATCH_APPROX_SEGMENTS,
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

function coreScoreLogForFirstHits(batches, hitLimit, increaseLog10) {
  const cutoffStep = coreStepForChronologicalHit(batches, hitLimit);
  if (cutoffStep === null) return -Infinity;
  const vertices = Math.max(3, runtime.effectiveVertexCount());

  return batches.reduce((totalLog, batch) => {
    const hits = coreHitsThroughStep(batch, cutoffStep, vertices);
    if (hits <= 0) return totalLog;
    return runtime.combineLog10(totalLog, coreBatchScoreLog10(batch.firstCoreStep, hits, increaseLog10));
  }, -Infinity);
}

function projectedScoreLogAfterCoreHits(batches, hitLimit, increaseLog10) {
  const scoreLog = coreScoreLogForFirstHits(batches, hitLimit, increaseLog10);
  return runtime.clampLog10(
    runtime.applyInfinitySoftcap(runtime.combineLog10(runtime.currentScoreLog10(), scoreLog)),
  );
}

function firstInfinityCrossingCoreHit(batches, increaseLog10) {
  const maxHit = totalCoreHitsInBatches(batches);
  let low = 1;
  let high = 1;
  while (high < maxHit && projectedScoreLogAfterCoreHits(batches, high, increaseLog10) < runtime.INFINITY_REQUIREMENT_LOG10) {
    low = high + 1;
    high = Math.min(maxHit, high * 2);
  }
  let crossingHit = null;

  while (low <= high) {
    const mid = low + Math.floor((high - low) / 2);
    if (mid === low || mid === high) {
      if (projectedScoreLogAfterCoreHits(batches, low, increaseLog10) >= runtime.INFINITY_REQUIREMENT_LOG10) crossingHit = low;
      else if (projectedScoreLogAfterCoreHits(batches, high, increaseLog10) >= runtime.INFINITY_REQUIREMENT_LOG10) crossingHit = high;
      break;
    }
    if (projectedScoreLogAfterCoreHits(batches, mid, increaseLog10) >= runtime.INFINITY_REQUIREMENT_LOG10) {
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

function processFirstInfinityCrossingBatch(batches, increaseLog10) {
  if (firstInfinityCrossingExceedsSafeHitCount(batches)) {
    return addFirstInfinityThresholdScore();
  }

  const crossing = firstInfinityCrossingCoreHit(batches, increaseLog10);
  if (!crossing || crossing.step === null) return false;

  const previousCoreScoreLog = coreScoreLogForFirstHits(batches, crossing.hit - 1, increaseLog10);
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

function offlineBatchesCanProcessExactly(batches) {
  const track = runtime.offlineWorkStats?.tracks?.angle;
  if (!track) return false;
  const smallLimit = Math.max(0, Math.floor(runtime.OFFLINE_SMALL_CORE_HIT_EXACT_LIMIT));
  let smallRemaining = track.smallExactRemaining;
  let bulkRemaining = track.bulkRemaining;
  for (const batch of batches) {
    if (batch.coreHits <= smallLimit && smallRemaining >= batch.coreHits) {
      smallRemaining -= batch.coreHits;
    } else if (bulkRemaining >= batch.coreHits) {
      bulkRemaining -= batch.coreHits;
    } else {
      return false;
    }
  }
  return true;
}

function processManyVerticesExactly(start, end) {
  const count = end - start + 1;
  if (count <= 0) return false;

  const increaseLog10 = runtime.vertexGainIncreaseLog10();
  if (increaseLog10 === -Infinity) return false;
  const batches = coreBatchesBetween(start, end);

  if (batches.length > 0) {
    const plannedBatches = runtime.offlineProcessing && offlineBatchesCanProcessExactly(batches)
      ? batches.map((batch) => ({
        ...batch,
        plan: runtime.offlineCoreHitPlan(
          "angle",
          batch.coreHits,
          MAX_EXACT_BATCH_CORE_HITS,
          CORE_HIT_BATCH_APPROX_SEGMENTS,
        ),
      }))
      : batches;
    if (plannedBatches !== batches && plannedBatches.every((batch) => batch.plan.mode === "exact")) {
      return processOfflineVerticesInOrder(start, end, plannedBatches);
    }
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
    const projectedScoreLog = runtime.clampLog10(
      runtime.applyInfinitySoftcap(runtime.combineLog10(runtime.currentScoreLog10(), scoreLog)),
    );
    if (runtime.state.infinityCount === 0 && projectedScoreLog >= runtime.INFINITY_REQUIREMENT_LOG10) {
      return processFirstInfinityCrossingBatch(batches, increaseLog10);
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

export function installNumericStabilityFixes() {
  if (installed) return;
  installed = true;

  const baseApplySaveData = runtime.applySaveData;

  runtime.MAX_GAME_LOG10 = MAX_GAME_LOG10;
  runtime.MAX_NATIVE_VALUE_LOG10 = MAX_NATIVE_VALUE_LOG10;
  runtime.MAX_GAME_VERTICES = MAX_GAME_VERTICES;
  runtime.sanitizeLog10 = sanitizeGameLog10;
  runtime.clampLog10 = clampGameLog10;
  runtime.valueFromLog10 = valueFromGameLog10;
  runtime.combineLog10 = combineGameLog10;
  runtime.subtractLog10 = subtractGameLog10;
  runtime.currentLog10ForValue = currentLog10FromState;
  runtime.coreBoostRequirementLog10 = coreBoostRequirementWithoutEarlyCap;
  runtime.processManyVertices = processManyVerticesExactly;
  runtime.applySaveData = function applySaveDataWithGameVertexLimit(data, saveVersion) {
    baseApplySaveData(data, saveVersion);
    restoreVerticesAfterLoad(data);
  };
}
