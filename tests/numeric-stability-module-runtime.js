const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

function setLogResource(state, key, log) {
  state[`${key}Log10`] = log;
  state[key] = log <= 308 ? 10 ** log : Number.MAX_VALUE;
}

function overrideRuntimeConstant(runtime, name, value) {
  Object.defineProperty(runtime, name, {
    configurable: true,
    enumerable: true,
    value,
  });
}

function prepareVertexScenario(instance, { scoreLog10, currentGainLog10, infiniteCapBroken }) {
  const { runtime } = instance;
  const { state } = instance.debug;
  state.vertices = 3;
  state.speedLevel = 0;
  state.gainLevel = 0;
  state.generationCount = 0;
  state.coreBoostCount = 0;
  state.infinityCount = 1;
  state.infinityUpgradeMask = 0;
  state.activeChallenge = 0;
  state.completedChallenges = 0;
  state.achievementMask = 0;
  state.infiniteCapBroken = infiniteCapBroken;
  state.showFloatingText = false;
  state.lightEffects = true;
  state.pointProgress = 0;
  state.totalVertexProgress = 0;
  state.lastVertexIndex = 0;
  setLogResource(state, "score", scoreLog10);
  setLogResource(state, "totalScore", -Infinity);
  setLogResource(state, "generationScore", -Infinity);
  setLogResource(state, "currentGain", currentGainLog10);
  runtime.checkAchievements = () => [];
  runtime.completeChallengeIfReady = () => false;
}

async function simulateVertexSteps({ targetVertexSteps, batch, scoreLog10, currentGainLog10, infiniteCapBroken }) {
  const instance = await loadRuntime(candidatePath);
  const { runtime } = instance;
  const { state, update } = instance.debug;
  prepareVertexScenario(instance, { scoreLog10, currentGainLog10, infiniteCapBroken });

  overrideRuntimeConstant(runtime, "MAX_VERTEX_STEPS_PER_FRAME", batch ? 5000 : Number.MAX_SAFE_INTEGER);
  let batchUsed = false;
  const baseProcessManyVertices = runtime.processManyVertices;
  runtime.processManyVertices = (...args) => {
    batchUsed = true;
    return baseProcessManyVertices(...args);
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

function assertClose(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
}

function assertSameSimulation(exact, batched, label) {
  assert.equal(batched.batchUsed, true, `${label}: batch path was not used`);
  assertClose(batched.scoreLog10, exact.scoreLog10, 1e-10, `${label}: score log`);
  assertClose(batched.totalScoreLog10, exact.totalScoreLog10, 1e-10, `${label}: total score log`);
  assertClose(batched.generationScoreLog10, exact.generationScoreLog10, 1e-10, `${label}: Generation Score log`);
  assertClose(batched.currentGainLog10, exact.currentGainLog10, 1e-10, `${label}: current gain log`);
  assertClose(batched.totalVertexProgress, exact.totalVertexProgress, 1e-10, `${label}: vertex progress`);
  assertClose(batched.pointProgress, exact.pointProgress, 1e-10, `${label}: point progress`);
  assert.equal(batched.lastVertexIndex, exact.lastVertexIndex, `${label}: last vertex index`);
}

async function runNumericStabilityModuleRuntimeTest() {
  {
    const storedSave = {
      version: 7,
      state: { vertices: 1_000_000 },
    };
    const localStorage = new Map([["angle-incremental-save", JSON.stringify(storedSave)]]);
    const loaded = await loadRuntime(candidatePath, localStorage);
    assert.equal(loaded.debug.state.vertices, 1_000_000, "local saves must retain vertex counts above 10,000");
  }

  {
    const source = await loadRuntime(candidatePath);
    source.debug.state.vertices = 1_000_000;
    source.debug.saveGame("manual");
    const localReload = await loadRuntime(candidatePath, source.storage);
    assert.equal(localReload.debug.state.vertices, 1_000_000, "saved local progress must retain a million vertices");

    const saveCode = await source.debug.exportSaveCode();
    const imported = await loadRuntime(candidatePath);
    assert.equal(await imported.debug.importSaveCode(saveCode), true, "numeric-stability save code must import");
    assert.equal(imported.debug.state.vertices, 1_000_000, "save codes must retain a million vertices");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime } = instance;
    const { state } = instance.debug;
    const counts = [25, 26, 27, 100, 1_000];
    const requirements = counts.map((count) => {
      state.coreBoostCount = count;
      return runtime.coreBoostRequirementLog10();
    });
    requirements.forEach((value) => assert.equal(Number.isFinite(value), true, "Core Boost requirements must stay finite in the one-layer log range"));
    requirements.slice(1).forEach((value, index) => {
      assert.ok(value > requirements[index], `Core Boost requirement must rise from CB${counts[index]} to CB${counts[index + 1]}`);
    });
    assert.ok(requirements[1] > 1_000_000_000, "CB26 must no longer be clamped at the legacy 1e9 log ceiling");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime } = instance;
    const { state } = instance.debug;
    state.score = Number.MAX_VALUE;
    state.scoreLog10 = 400;
    state.currentGain = Number.MAX_VALUE;
    state.currentGainLog10 = 410;
    assert.equal(runtime.currentScoreLog10(), 400, "stored score logs must be the progression source of truth");
    assert.equal(runtime.currentGainLog10(), 410, "stored gain logs must be the progression source of truth");
  }

  {
    const exact = await simulateVertexSteps({
      targetVertexSteps: 6_006,
      batch: false,
      scoreLog10: 308.3,
      currentGainLog10: 308,
      infiniteCapBroken: false,
    });
    const batched = await simulateVertexSteps({
      targetVertexSteps: 6_006,
      batch: true,
      scoreLog10: 308.3,
      currentGainLog10: 308,
      infiniteCapBroken: false,
    });
    assertSameSimulation(exact, batched, "Infinity softcap batch");
  }

  {
    const exact = await simulateVertexSteps({
      targetVertexSteps: 150_006,
      batch: false,
      scoreLog10: -Infinity,
      currentGainLog10: 0,
      infiniteCapBroken: true,
    });
    const batched = await simulateVertexSteps({
      targetVertexSteps: 150_006,
      batch: true,
      scoreLog10: -Infinity,
      currentGainLog10: 0,
      infiniteCapBroken: true,
    });
    assertSameSimulation(exact, batched, "post-cap high-speed batch");
  }

  console.log("Numeric stability module runtime tests passed");
}

module.exports = { runNumericStabilityModuleRuntimeTest };
