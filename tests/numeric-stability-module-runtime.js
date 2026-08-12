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

async function simulateVertexSteps({
  targetVertexSteps,
  batch,
  scoreLog10,
  currentGainLog10,
  infiniteCapBroken,
  infinityCount = 1,
  forceExactCoreHits = false,
  vertices = 3,
  coreVertexIndices = null,
  gainLevel = 0,
}) {
  const instance = await loadRuntime(candidatePath);
  const { runtime } = instance;
  const { state, update } = instance.debug;
  prepareVertexScenario(instance, { scoreLog10, currentGainLog10, infiniteCapBroken });
  state.vertices = vertices;
  state.gainLevel = gainLevel;
  state.infinityCount = infinityCount;
  if (coreVertexIndices) runtime.coreVertexIndices = () => coreVertexIndices;

  overrideRuntimeConstant(runtime, "MAX_VERTEX_STEPS_PER_FRAME", batch ? 5000 : Number.MAX_SAFE_INTEGER);
  if (forceExactCoreHits) overrideRuntimeConstant(runtime, "MAX_CORE_HITS_PER_FRAME", Number.MAX_SAFE_INTEGER);
  let batchUsed = false;
  const baseProcessManyVertices = runtime.processManyVertices;
  runtime.processManyVertices = (...args) => {
    batchUsed = true;
    return baseProcessManyVertices(...args);
  };
  let passVertexCalls = 0;
  const basePassVertex = runtime.passVertex;
  runtime.passVertex = (...args) => {
    passVertexCalls += 1;
    return basePassVertex(...args);
  };

  const dt = runtime.lapDuration() * targetVertexSteps / state.vertices;
  update(dt);
  return {
    batchUsed,
    passVertexCalls,
    maxCoreHitsPerFrame: runtime.MAX_CORE_HITS_PER_FRAME,
    scoreLog10: runtime.currentScoreLog10(),
    totalScoreLog10: runtime.currentTotalScoreLog10(),
    generationScoreLog10: runtime.currentGenerationScoreLog10(),
    currentGainLog10: runtime.currentGainLog10(),
    totalVertexProgress: state.totalVertexProgress,
    pointProgress: state.pointProgress,
    lastVertexIndex: state.lastVertexIndex,
    infinityCount: state.infinityCount,
    infinityPointsLog10: runtime.currentInfinityPointsLog10(),
    lastInfinityRun: state.lastInfinityRuns[0],
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
    const instance = await loadRuntime(candidatePath);
    const { runtime, debug } = instance;
    const { state } = debug;
    runtime.applySaveData({
      infinityPointsExact: "100000000000000000000",
      infinityPoints: 100000000000000000000,
      infinityPointsLog10: 20,
    }, 7);
    runtime.addInfinityPoints(3570);
    assert.equal(
      state.infinityPointsExact,
      "100000000000000003570",
      "IP gains must be exact when adding small amounts to 1e20 IP",
    );
    assert.equal(
      runtime.canSpendInfinityPoints(20),
      true,
      "exact IP gains above 1e20 should still allow exact 1e20 IP spending",
    );
    assert.equal(runtime.spendInfinityPoints(20), true, "exact IP spending should succeed at the 1e20 boundary");
    assert.equal(state.infinityPointsExact, "3570", "spending 1e20 IP should preserve the exact remainder");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime, debug } = instance;
    const { state } = debug;
    runtime.applySaveData({
      infinityPointsExact: "100000000000000000000",
      infinityPoints: 100000000000000000000,
      infinityPointsLog10: 20,
    }, 7);
    assert.equal(debug.unlockInfiniteAngle(), true, "1e20 IP should unlock Infinite Angle");
    assert.equal(state.infiniteAngleUnlocked, true, "Infinite Angle should remain unlocked after purchase");
    assert.equal(state.infinityPointsExact, "0", "unlocking IA should exactly consume a 1e20 IP balance");
    assert.equal(state.infinityPoints, 0, "spending all exact IP should update the numeric cache");
    assert.equal(state.infinityPointsLog10, -Infinity, "spending all exact IP should update the log cache");
  }

  {
    const source = await loadRuntime(candidatePath);
    const { runtime, debug } = source;
    runtime.applySaveData({
      infinityPointsExact: "1000000000000000000000000000000",
      infinityPoints: 1e30,
      infinityPointsLog10: 30,
      infinityCount: 1234567,
    }, 7);
    debug.saveGame("manual");
    const localReload = await loadRuntime(candidatePath, source.storage);
    assert.equal(
      localReload.debug.state.infinityPointsExact,
      "1000000000000000000000000000000",
      "local saves must preserve exact high IP balances",
    );
    assert.equal(localReload.debug.state.infinityCount, 1234567, "local saves must preserve uncapped Infinity counts");

    const saveCode = await debug.exportSaveCode();
    const imported = await loadRuntime(candidatePath);
    assert.equal(await imported.debug.importSaveCode(saveCode), true, "exact-IP save code must import");
    assert.equal(
      imported.debug.state.infinityPointsExact,
      "1000000000000000000000000000000",
      "save codes must preserve exact high IP balances",
    );
  }

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
    const instance = await loadRuntime(candidatePath);
    const { debug } = instance;
    const { state, runInfinity } = debug;
    state.infinityCount = 1;
    state.scoreLog10 = 309;
    state.score = Number.MAX_VALUE;
    state.currentInfinityRunTime = 0.00033;
    state.currentInfinityRealTime = 0.00033;

    runInfinity(false);

    assert.equal(
      state.lastInfinityRuns[0].time,
      1 / 60,
      "sub-frame Infinity runs must be recorded as at least one frame",
    );
    assert.equal(
      state.fastestInfinityTime,
      1 / 60,
      "fastest Infinity time must use the one-frame recording floor",
    );
    assert.equal(state.lastInfinityRuns[0].realTime, 1 / 60, "sub-frame real Infinity runs must use the one-frame floor");
    assert.equal(state.fastestInfinityRealTime, 1 / 60, "fastest real Infinity time must use the one-frame floor");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug } = instance;
    const { state, runInfinity } = debug;
    state.infinityCount = 1;
    state.scoreLog10 = 309;
    state.score = Number.MAX_VALUE;
    state.currentInfinityRunTime = 0.2;
    state.currentInfinityRealTime = 0.15;

    runInfinity(false);

    assert.equal(state.lastInfinityRuns[0].time, 0.2, "normal Infinity run times must be preserved");
    assert.equal(state.fastestInfinityTime, 0.2, "normal fastest Infinity times must be preserved");
    assert.equal(state.lastInfinityRuns[0].realTime, 0.15, "normal real Infinity run times must be preserved");
    assert.equal(state.fastestInfinityRealTime, 0.15, "normal fastest real Infinity times must be preserved");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug } = instance;
    const { state, runInfinity } = debug;
    state.infinityCount = 1;
    state.scoreLog10 = 309;
    state.score = Number.MAX_VALUE;
    state.currentInfinityRunTime = 0;
    state.currentInfinityRealTime = 0;

    runInfinity(false);

    assert.equal(state.lastInfinityRuns[0].time, 0, "zero-time Infinity records must remain zero-time records");
    assert.equal(state.fastestInfinityTime, 0, "zero-time Infinity records must not update fastest Infinity");
    assert.equal(state.lastInfinityRuns[0].realTime, 0, "zero-time real Infinity records must remain zero-time records");
    assert.equal(state.fastestInfinityRealTime, 0, "zero-time real Infinity records must not update fastest real Infinity");
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
      targetVertexSteps: 6_006,
      batch: false,
      scoreLog10: 307.99,
      currentGainLog10: 306.5,
      infiniteCapBroken: false,
      infinityCount: 0,
      forceExactCoreHits: true,
    });
    const batched = await simulateVertexSteps({
      targetVertexSteps: 6_006,
      batch: true,
      scoreLog10: 307.99,
      currentGainLog10: 306.5,
      infiniteCapBroken: false,
      infinityCount: 0,
    });

    assert.equal(batched.batchUsed, true, "first Infinity scenario must exercise the batch path");
    assert.ok(
      batched.passVertexCalls <= batched.maxCoreHitsPerFrame,
      `batched first Infinity replay must stay bounded; got ${batched.passVertexCalls} passVertex calls`,
    );
    assert.equal(batched.infinityCount, exact.infinityCount, "batched first Infinity should reset at the same point as exact processing");
    assert.equal(batched.lastInfinityRun.ipGain, exact.lastInfinityRun.ipGain, "batched first Infinity must not include post-threshold IP gain");
    assertClose(
      batched.lastInfinityRun.scoreLog10,
      exact.lastInfinityRun.scoreLog10,
      1e-10,
      "batched first Infinity must record the first crossing score",
    );
  }

  {
    const exact = await simulateVertexSteps({
      targetVertexSteps: 6_006,
      batch: false,
      scoreLog10: 307.5,
      currentGainLog10: 0,
      infiniteCapBroken: false,
      infinityCount: 0,
      forceExactCoreHits: true,
      vertices: 6,
      coreVertexIndices: [0, 3],
      gainLevel: 1e308,
    });
    const batched = await simulateVertexSteps({
      targetVertexSteps: 6_006,
      batch: true,
      scoreLog10: 307.5,
      currentGainLog10: 0,
      infiniteCapBroken: false,
      infinityCount: 0,
      vertices: 6,
      coreVertexIndices: [0, 3],
      gainLevel: 1e308,
    });

    assert.equal(batched.batchUsed, true, "multi-core first Infinity scenario must exercise the batch path");
    assert.ok(
      batched.passVertexCalls <= batched.maxCoreHitsPerFrame,
      `multi-core first Infinity replay must stay bounded; got ${batched.passVertexCalls} passVertex calls`,
    );
    assert.equal(batched.lastInfinityRun.ipGain, exact.lastInfinityRun.ipGain, "multi-core batched first Infinity must preserve chronological IP gain");
    assertClose(
      batched.lastInfinityRun.scoreLog10,
      exact.lastInfinityRun.scoreLog10,
      1e-10,
      "multi-core batched first Infinity must preserve chronological crossing score",
    );
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

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime } = instance;
    const { state, update } = instance.debug;
    prepareVertexScenario(instance, {
      scoreLog10: 50,
      currentGainLog10: 0,
      infiniteCapBroken: true,
    });
    state.speedLevel = 300;
    state.vertices = 3;

    let passVertexCalls = 0;
    runtime.passVertex = () => {
      passVertexCalls += 1;
      return false;
    };

    runtime.processManyVertices(1, 60_006);
    assert.ok(
      passVertexCalls <= 64,
      `high-speed batches must not visit every core hit; got ${passVertexCalls} passVertex calls`,
    );

    let batchUsed = false;
    const baseProcessManyVertices = runtime.processManyVertices;
    runtime.processManyVertices = (...args) => {
      batchUsed = true;
      return baseProcessManyVertices(...args);
    };

    update(1 / 60);
    assert.equal(batchUsed, true, "high-speed low-vertex updates must use the batch path");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime } = instance;
    const { state, update } = instance.debug;
    prepareVertexScenario(instance, {
      scoreLog10: 307.99,
      currentGainLog10: 306.5,
      infiniteCapBroken: false,
    });
    state.infinityCount = 0;
    state.speedLevel = 1000;
    state.vertices = 3;

    let passVertexCalls = 0;
    const basePassVertex = runtime.passVertex;
    runtime.passVertex = (...args) => {
      passVertexCalls += 1;
      return basePassVertex(...args);
    };
    let batchUsed = false;
    const baseProcessManyVertices = runtime.processManyVertices;
    runtime.processManyVertices = (...args) => {
      batchUsed = true;
      return baseProcessManyVertices(...args);
    };
    let gainProjectionCalls = 0;
    const baseGainAfterIncreaseLog10 = runtime.gainAfterIncreaseLog10;
    runtime.gainAfterIncreaseLog10 = (...args) => {
      gainProjectionCalls += 1;
      return baseGainAfterIncreaseLog10(...args);
    };

    update(1 / 30);
    assert.equal(batchUsed, true, "e308 first-Infinity high-speed update must use the batch path");
    assert.equal(state.infinityCount, 1, "e308 first-Infinity high-speed update must complete the first Infinity");
    assert.equal(state.lastInfinityRuns[0].ipGain, 1, "e308 first-Infinity high-speed update must not include post-threshold IP gain");
    assert.ok(
      passVertexCalls <= runtime.MAX_CORE_HITS_PER_FRAME,
      `e308 first-Infinity high-speed update must stay bounded; got ${passVertexCalls} passVertex calls`,
    );
    assert.ok(
      gainProjectionCalls <= 2000,
      `e308 first-Infinity crossing search must stay bounded; got ${gainProjectionCalls} gain projections`,
    );
  }

  {
    const runAchievementOrderingScenario = async (offline) => {
      const instance = await loadRuntime(candidatePath);
      const { runtime, debug } = instance;
      const { state } = debug;
      state.vertices = 3;
      state.speedLevel = 0;
      state.gainLevel = 0;
      state.generationCount = 0;
      state.coreBoostCount = 0;
      state.infinityCount = 1;
      state.infinityUpgradeMask = 0;
      state.activeChallenge = 0;
      state.activeTowerChallenge = 0;
      state.completedChallenges = 0;
      state.achievementMask = 0;
      state.achievementMaskHigh = 0;
      state.infiniteCapBroken = true;
      state.showFloatingText = false;
      state.lightEffects = true;
      state.totalVertexProgress = 2;
      state.pointProgress = 2 / 3;
      state.lastVertexIndex = 2;
      setLogResource(state, "score", 30);
      setLogResource(state, "totalScore", 30);
      setLogResource(state, "generationScore", 30);
      setLogResource(state, "currentGain", 8);

      let batchCalls = 0;
      const baseProcessManyVertices = runtime.processManyVertices;
      runtime.processManyVertices = (...args) => {
        batchCalls += 1;
        return baseProcessManyVertices(...args);
      };
      let passVertexCalls = 0;
      const basePassVertex = runtime.passVertex;
      runtime.passVertex = (...args) => {
        passVertexCalls += 1;
        return basePassVertex(...args);
      };

      runtime.offlineProcessing = offline;
      debug.update(runtime.lapDuration() / 3, true);
      runtime.offlineProcessing = false;
      return {
        batchCalls,
        passVertexCalls,
        currentGainLog10: state.currentGainLog10,
        achievementMask: state.achievementMask,
      };
    };

    const online = await runAchievementOrderingScenario(false);
    const offline = await runAchievementOrderingScenario(true);
    assert.equal(offline.batchCalls, 1, "small offline batches should use the bounded aggregate path");
    assert.equal(offline.passVertexCalls, 0, "small offline batches should not visit every vertex");
    assert.equal(offline.achievementMask, online.achievementMask, "offline achievement unlocks should match online processing");
    assert.equal(offline.currentGainLog10, online.currentGainLog10, "offline gain should use the pre-achievement vertex multiplier");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime, debug } = instance;
    const { state } = debug;
    prepareVertexScenario(instance, {
      scoreLog10: 30,
      currentGainLog10: 8,
      infiniteCapBroken: true,
    });
    state.vertices = 720;
    state.totalVertexProgress = 0;
    state.pointProgress = 0;
    runtime.checkAchievements = () => [];
    const tickSeconds = runtime.lapDuration() * 5000 / state.vertices;
    let passVertexCalls = 0;
    runtime.passVertex = () => {
      passVertexCalls += 1;
      return false;
    };
    runtime.beginOfflineWorkBudget(1000);
    runtime.offlineProcessing = true;
    try {
      for (let tick = 0; tick < 1000; tick += 1) debug.update(tickSeconds, true);
    } finally {
      runtime.offlineProcessing = false;
    }
    const work = runtime.offlineWorkStats;
    assert.equal(passVertexCalls, 0, "long direct offline ticks should not visit every vertex");
    assert.ok(work.totalIterations <= work.hardCap, "long direct offline ticks should stay within the work budget");
    assert.ok(work.tracks.angle.exactIterations <= runtime.OFFLINE_CORE_HIT_WORK_BUDGET, "direct offline exact work should stay bounded");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime } = instance;
    const { state } = instance.debug;
    prepareVertexScenario(instance, {
      scoreLog10: -Infinity,
      currentGainLog10: 0,
      infiniteCapBroken: false,
    });
    state.infinityCount = 0;
    state.vertices = 3;
    runtime.vertexGainIncreaseLog10 = () => 275;

    const coreHitsPastSafeSearch = 1e18;
    const endStep = coreHitsPastSafeSearch * state.vertices;
    const usedBatch = runtime.processManyVertices(1, endStep);

    assert.equal(usedBatch, true, "first-Infinity batch must report the reset even when crossing is past the safe hit count");
    assert.equal(state.infinityCount, 1, "first-Infinity crossing past the safe hit count must still complete Infinity");
    assert.ok(state.lastInfinityRuns[0], "first-Infinity crossing past the safe hit count must record the Infinity run");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime } = instance;
    const { state } = instance.debug;
    prepareVertexScenario(instance, {
      scoreLog10: -Infinity,
      currentGainLog10: 0,
      infiniteCapBroken: false,
    });
    state.infinityCount = 0;
    state.vertices = 6;
    runtime.coreVertexIndices = () => [0, 3];
    runtime.vertexGainIncreaseLog10 = () => 275;

    const usedBatch = runtime.processManyVertices(1, 6e18);

    assert.equal(usedBatch, true, "multi-core huge first-Infinity batch must report the reset");
    assert.equal(state.infinityCount, 1, "multi-core huge first-Infinity batch must complete Infinity");
    assert.equal(state.lastInfinityRuns[0].ipGain, 1, "multi-core huge first-Infinity batch must stop at the threshold crossing");
  }

  console.log("Numeric stability module runtime tests passed");
}

module.exports = { runNumericStabilityModuleRuntimeTest };
