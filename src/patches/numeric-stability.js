import { runtime } from "../runtime/shared.js";

const MAX_GAME_LOG10 = Number.MAX_VALUE;
const MAX_NATIVE_VALUE_LOG10 = Math.log10(Number.MAX_VALUE);
const MAX_GAME_VERTICES = 1_000_000_000_000;
const MAX_EXACT_BATCH_CORE_HITS = 2048;
const CORE_HIT_BATCH_APPROX_SEGMENTS = 256;
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
  const multiplier = 2 ** count;
  if (Number.isFinite(multiplier)) {
    const requirementLog10 = Math.log10(runtime.CORE_BOOST_BASE_REQUIREMENT) * multiplier;
    if (Number.isFinite(requirementLog10)) return requirementLog10;
  }
  return MAX_GAME_LOG10;
}

function normalizedSavedVertices(data) {
  const raw = Math.floor(runtime.sanitizeNumber(data && data.vertices, 3, 3));
  return Math.min(MAX_GAME_VERTICES, Math.max(3, raw));
}

function restoreVerticesAfterLoad(data) {
  if (runtime.state.activeChallenge === 2 || runtime.state.activeChallenge === 8) return;
  runtime.state.vertices = normalizedSavedVertices(data);
  if (runtime.state.totalVertexProgress > runtime.MAX_VERTEX_PROGRESS_TRACKED) {
    runtime.normalizeVertexProgress();
  }
  runtime.state.lastVertexIndex = Math.floor(runtime.state.pointProgress * runtime.state.vertices) % runtime.state.vertices;
}

function addCurrentGainForVertexSteps(stepCount) {
  if (stepCount <= 0) return;
  const increase = runtime.vertexGainIncrease();
  if (!(increase > 0)) return;
  const addedLog = runtime.log10Value(increase) + Math.log10(stepCount);
  runtime.setCurrentGainLog10(runtime.combineLog10(runtime.currentGainLog10(), addedLog));
}

function coreBatchesBetween(start, end) {
  const count = end - start + 1;
  if (count <= 0) return [];
  const vertices = Math.max(3, runtime.state.vertices);
  return runtime.coreVertexIndices()
    .map((coreIndex) => {
      const coreOffset = ((coreIndex - (start % vertices)) + vertices) % vertices;
      const coreHits = coreOffset >= count ? 0 : Math.floor((count - 1 - coreOffset) / vertices) + 1;
      return { coreHits, firstCoreStep: coreOffset + 1 };
    })
    .filter((batch) => batch.coreHits > 0);
}

function coreBatchScoreLog10(firstCoreStep, coreHits, increase) {
  const vertices = Math.max(3, runtime.state.vertices);
  let totalLog = -Infinity;

  if (coreHits <= MAX_EXACT_BATCH_CORE_HITS) {
    for (let hit = 0; hit < coreHits; hit += 1) {
      const step = firstCoreStep + hit * vertices;
      const gainLog = runtime.gainAfterIncreaseLog10(increase, step);
      totalLog = runtime.combineLog10(totalLog, runtime.finalScoreGainFromBaseLog10(gainLog));
    }
    return totalLog;
  }

  const segments = Math.min(CORE_HIT_BATCH_APPROX_SEGMENTS, coreHits);
  const segmentSize = coreHits / segments;
  for (let segment = 0; segment < segments; segment += 1) {
    const midHit = (segment + 0.5) * segmentSize;
    const step = firstCoreStep + midHit * vertices;
    const gainLog = runtime.gainAfterIncreaseLog10(increase, step);
    totalLog = runtime.combineLog10(
      totalLog,
      runtime.finalScoreGainFromBaseLog10(gainLog) + Math.log10(segmentSize),
    );
  }
  return totalLog;
}

function processManyVerticesExactly(start, end) {
  const count = end - start + 1;
  if (count <= 0) return false;

  const increase = runtime.vertexGainIncrease();
  if (!(increase > 0)) return false;
  const batches = coreBatchesBetween(start, end);

  if (batches.length > 0) {
    const scoreLog = batches.reduce(
      (totalLog, batch) => runtime.combineLog10(totalLog, coreBatchScoreLog10(batch.firstCoreStep, batch.coreHits, increase)),
      -Infinity,
    );
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
