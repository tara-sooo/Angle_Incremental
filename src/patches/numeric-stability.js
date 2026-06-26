import { runtime } from "../runtime/shared.js";

const MAX_GAME_LOG10 = Number.MAX_VALUE;
const MAX_NATIVE_VALUE_LOG10 = Math.log10(Number.MAX_VALUE);
const MAX_GAME_VERTICES = 1_000_000_000_000;
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
  const requirementLogLog10 = Math.log10(Math.log10(runtime.CORE_BOOST_BASE_REQUIREMENT))
    + count * Math.log10(2);
  if (!Number.isFinite(requirementLogLog10) || requirementLogLog10 >= MAX_NATIVE_VALUE_LOG10) {
    return MAX_GAME_LOG10;
  }
  return 10 ** requirementLogLog10;
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

function coreEventsBetween(start, end) {
  const count = end - start + 1;
  if (count <= 0) return [];
  const vertices = Math.max(3, runtime.state.vertices);
  const events = [];
  runtime.coreVertexIndices().forEach((coreIndex) => {
    const coreOffset = ((coreIndex - (start % vertices)) + vertices) % vertices;
    for (let step = coreOffset + 1; step <= count; step += vertices) {
      events.push({ step, index: coreIndex });
    }
  });
  return events.sort((left, right) => left.step - right.step || left.index - right.index);
}

function passCoreVertexWithoutBurstText(index, suppressFloatingText) {
  if (!suppressFloatingText) return runtime.passVertex(index);
  const previousFloatingTextSetting = runtime.state.showFloatingText;
  runtime.state.showFloatingText = false;
  try {
    return runtime.passVertex(index);
  } finally {
    runtime.state.showFloatingText = previousFloatingTextSetting;
  }
}

function processManyVerticesExactly(start, end) {
  const count = end - start + 1;
  if (count <= 0) return false;

  const events = coreEventsBetween(start, end);
  const suppressFloatingText = events.length > 1 && runtime.state.showFloatingText && !runtime.state.lightEffects;
  let processedSteps = 0;

  for (const event of events) {
    addCurrentGainForVertexSteps(event.step - processedSteps - 1);
    if (passCoreVertexWithoutBurstText(event.index, suppressFloatingText)) return true;
    processedSteps = event.step;
  }

  addCurrentGainForVertexSteps(count - processedSteps);
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
