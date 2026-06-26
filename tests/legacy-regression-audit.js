const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");
const SAVE_KEY = "angle-incremental-save";

function setLogResource(state, key, log) {
  state[`${key}Log10`] = log;
  state[key] = log <= 308 ? 10 ** log : Number.MAX_VALUE;
}

function setRuntimeConstant(runtime, name, value) {
  Object.defineProperty(runtime, name, {
    configurable: true,
    enumerable: true,
    value,
  });
}

function prepareBatchScenario(instance, { initialScoreLog = -Infinity, initialGainLog = 0, infiniteCapBroken = true }) {
  const { runtime } = instance;
  const { state } = instance.debug;
  state.vertices = 3;
  state.speedLevel = 0;
  state.gainLevel = 0;
  state.coreBoostCount = 0;
  state.generationCount = 0;
  state.infinityCount = 1;
  state.infiniteCapBroken = infiniteCapBroken;
  state.activeChallenge = 0;
  state.completedChallenges = 0;
  state.achievementMask = 0;
  state.showFloatingText = false;
  state.lightEffects = true;
  state.pointProgress = 0;
  state.totalVertexProgress = 0;
  state.lastVertexIndex = 0;
  setLogResource(state, "score", initialScoreLog);
  setLogResource(state, "totalScore", -Infinity);
  setLogResource(state, "generationScore", -Infinity);
  setLogResource(state, "currentGain", initialGainLog);
  runtime.checkAchievements = () => [];
  runtime.completeChallengeIfReady = () => false;
}

async function simulateVertices({ targetVertexSteps, batch, initialScoreLog, initialGainLog, infiniteCapBroken }) {
  const instance = await loadRuntime(candidatePath);
  const { runtime } = instance;
  const { state, update } = instance.debug;
  prepareBatchScenario(instance, { initialScoreLog, initialGainLog, infiniteCapBroken });

  setRuntimeConstant(runtime, "MAX_VERTEX_STEPS_PER_FRAME", batch ? 5000 : Number.MAX_SAFE_INTEGER);
  let batchUsed = false;
  const originalProcessManyVertices = runtime.processManyVertices;
  runtime.processManyVertices = (...args) => {
    batchUsed = true;
    return originalProcessManyVertices(...args);
  };

  const dt = runtime.lapDuration() * targetVertexSteps / state.vertices;
  update(dt);
  return {
    batchUsed,
    scoreLog10: runtime.currentScoreLog10(),
    totalScoreLog10: runtime.currentTotalScoreLog10(),
    generationScoreLog10: runtime.currentGenerationScoreLog10(),
    currentGainLog10: runtime.currentGainLog10(),
    totalVertexProgress: state.totalVertexProgress,
    pointProgress: state.pointProgress,
    lastVertexIndex: state.lastVertexIndex,
  };
}

function difference(left, right) {
  return Math.abs(left - right);
}

async function runLegacyRegressionAudit() {
  const report = {};

  {
    const storedSave = {
      version: 7,
      state: { vertices: 10001 },
    };
    const storage = new Map([[SAVE_KEY, JSON.stringify(storedSave)]]);
    const instance = await loadRuntime(candidatePath, storage);
    const loadedVertices = instance.debug.state.vertices;
    report.vertexLoad = { storedVertices: 10001, loadedVertices };
    assert.equal(loadedVertices, 10000, "audit: a saved vertex count above 10,000 is currently truncated during load");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime } = instance;
    const { state } = instance.debug;
    state.coreBoostCount = 25;
    const beforeCap = runtime.coreBoostRequirementLog10();
    state.coreBoostCount = 26;
    const atCap = runtime.coreBoostRequirementLog10();
    state.coreBoostCount = 27;
    const afterCap = runtime.coreBoostRequirementLog10();
    report.coreBoostRequirement = { beforeCap, atCap, afterCap, cap: runtime.MAX_TRACKED_LOG10 };
    assert.ok(beforeCap < runtime.MAX_TRACKED_LOG10, "audit: Core Boost requirement must still rise before the saturation point");
    assert.equal(atCap, runtime.MAX_TRACKED_LOG10, "audit: Core Boost requirement reaches the internal log cap at 26 Core Boosts");
    assert.equal(afterCap, atCap, "audit: Core Boost requirement remains fixed after reaching the internal log cap");
  }

  {
    const targetVertexSteps = 6006;
    const exact = await simulateVertices({
      targetVertexSteps,
      batch: false,
      initialScoreLog: -Infinity,
      initialGainLog: 0,
      infiniteCapBroken: true,
    });
    const batched = await simulateVertices({
      targetVertexSteps,
      batch: true,
      initialScoreLog: -Infinity,
      initialGainLog: 0,
      infiniteCapBroken: true,
    });
    report.batchBelowSoftcap = {
      targetVertexSteps,
      exact,
      batched,
      scoreLogDifference: difference(exact.scoreLog10, batched.scoreLog10),
      gainLogDifference: difference(exact.currentGainLog10, batched.currentGainLog10),
      progressDifference: difference(exact.totalVertexProgress, batched.totalVertexProgress),
    };
    assert.equal(batched.batchUsed, true, "audit: scenario must exercise batch vertex processing");
  }

  {
    const targetVertexSteps = 6006;
    const exact = await simulateVertices({
      targetVertexSteps,
      batch: false,
      initialScoreLog: 308.3,
      initialGainLog: 308,
      infiniteCapBroken: false,
    });
    const batched = await simulateVertices({
      targetVertexSteps,
      batch: true,
      initialScoreLog: 308.3,
      initialGainLog: 308,
      infiniteCapBroken: false,
    });
    const scoreLogDifference = difference(exact.scoreLog10, batched.scoreLog10);
    report.batchAboveInfinitySoftcap = {
      targetVertexSteps,
      exact,
      batched,
      scoreLogDifference,
      gainLogDifference: difference(exact.currentGainLog10, batched.currentGainLog10),
      progressDifference: difference(exact.totalVertexProgress, batched.totalVertexProgress),
    };
    assert.equal(batched.batchUsed, true, "audit: softcap scenario must exercise batch vertex processing");
    assert.ok(scoreLogDifference > 0.01, "audit: batch and sequential processing diverge materially above the Infinity softcap");
  }

  {
    const targetVertexSteps = 150006;
    const exact = await simulateVertices({
      targetVertexSteps,
      batch: false,
      initialScoreLog: -Infinity,
      initialGainLog: 0,
      infiniteCapBroken: true,
    });
    const batched = await simulateVertices({
      targetVertexSteps,
      batch: true,
      initialScoreLog: -Infinity,
      initialGainLog: 0,
      infiniteCapBroken: true,
    });
    report.batchApproximation = {
      targetVertexSteps,
      exact,
      batched,
      scoreLogDifference: difference(exact.scoreLog10, batched.scoreLog10),
      gainLogDifference: difference(exact.currentGainLog10, batched.currentGainLog10),
      progressDifference: difference(exact.totalVertexProgress, batched.totalVertexProgress),
    };
    assert.equal(batched.batchUsed, true, "audit: approximation scenario must exercise batch vertex processing");
  }

  console.log("LEGACY_REGRESSION_AUDIT", JSON.stringify(report));
  return report;
}

module.exports = { runLegacyRegressionAudit };
