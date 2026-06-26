const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime, snapshot } = require("./runtime-harness-esm.js");

const baselinePath = path.join(__dirname, "fixtures", "next-runtime.js");
const candidatePath = path.join(__dirname, "..", "src", "main.js");

function disableAchievementChecks(instance) {
  const noOp = () => [];
  if (instance.runtime) {
    instance.runtime.checkAchievements = noOp;
  } else {
    instance.context.checkAchievements = noOp;
  }
}

function removeAchievementRunMetadata(records) {
  records?.forEach((record) => {
    delete record.noGenerationCoreBoost;
  });
}

function compatibilitySnapshot(instance) {
  const value = snapshot(instance);
  delete value.view.achievements.total;
  delete value.view.infinity.softcapPower;
  removeAchievementRunMetadata(value.state.lastInfinityRuns);
  removeAchievementRunMetadata(value.view.statistics.lastInfinityRuns);
  return value;
}

async function compareScenario(name, act) {
  const baseline = await loadRuntime(baselinePath);
  const candidate = await loadRuntime(candidatePath);
  disableAchievementChecks(baseline);
  disableAchievementChecks(candidate);
  await act(baseline);
  await act(candidate);
  assert.deepStrictEqual(
    compatibilitySnapshot(candidate),
    compatibilitySnapshot(baseline),
    `${name}: candidate runtime diverged from next baseline outside approved release behavior`,
  );
}

function setLogResource(state, key, log) {
  state[`${key}Log10`] = log;
  state[key] = log <= 308 ? 10 ** log : Number.MAX_VALUE;
}

function seedLateGameState(instance) {
  const { state } = instance.debug;
  state.infinityCount = 3;
  state.infinityUpgradeMask = (1 << 7) | (1 << 9);
  state.completedChallenges = (1 << 5) | (1 << 7);
  state.vertices = 47;
  state.speedLevel = 321;
  state.gainLevel = 123;
  state.generationCount = 6;
  state.generationCostFactor = 0.7;
  setLogResource(state, "score", 300);
  setLogResource(state, "totalScore", 350);
  setLogResource(state, "generationScore", 300);
  setLogResource(state, "infinityPoints", 1);
  setLogResource(state, "infiniteScore", 12);
}

async function makeStoredSave(runtimePath) {
  const instance = await loadRuntime(runtimePath);
  seedLateGameState(instance);
  instance.debug.saveGame("manual");
  return new Map(instance.storage);
}

async function runDifferentialTests() {
  await compareScenario("initial state and rendering", async () => {});

  await compareScenario("normal upgrades and bounded simulation", async ({ debug }) => {
    const { state } = debug;
    setLogResource(state, "score", 60);
    setLogResource(state, "totalScore", 60);
    setLogResource(state, "generationScore", 60);
    for (let index = 0; index < 12; index += 1) {
      debug.buySpeed();
      debug.buyAllUpgrades();
    }
    state.speedLevel = 0;
    state.vertices = 3;
    state.currentGain = 1;
    state.currentGainLog10 = 0;
    state.pointProgress = 0;
    state.totalVertexProgress = 0;
    state.lastVertexIndex = 0;
    debug.update(0.5);
  });

  await compareScenario("Generation and Core Boost reset sequence", async ({ debug }) => {
    const { state } = debug;
    setLogResource(state, "score", 40);
    setLogResource(state, "totalScore", 40);
    setLogResource(state, "generationScore", 40);
    debug.runGeneration();
    setLogResource(state, "score", 120);
    debug.runCoreBoost();
  });

  await compareScenario("IU5-2 reset start score and IU6-2 floor", async ({ debug }) => {
    const { state } = debug;
    state.infinityCount = 1;
    state.infinityUpgradeMask = (1 << 7) | (1 << 9);
    state.generationCostFactor = 0.7;
    setLogResource(state, "score", 20);
    setLogResource(state, "totalScore", 20);
    setLogResource(state, "generationScore", 20);
    debug.runGeneration();
    setLogResource(state, "score", 120);
    debug.runCoreBoost();
  });

  await compareScenario("Infinity Challenge 6 reward", async ({ debug }) => {
    const { state } = debug;
    state.infinityCount = 1;
    state.completedChallenges = 1 << 5;
    setLogResource(state, "score", 309);
    debug.runInfinity(false);
  });

  await compareScenario("Infinity Challenge 7 affordability and reward", async ({ debug }) => {
    const { state } = debug;
    state.activeChallenge = 7;
    setLogResource(state, "score", 100);
    state.speedLevel = 160;
    debug.buySpeed();
    state.activeChallenge = 0;
    state.completedChallenges = 1 << 6;
    state.speedLevel = 0;
    setLogResource(state, "score", 2);
    debug.buySpeed();
  });

  await compareScenario("Infinity Challenge 8 active preservation", async ({ debug }) => {
    const { state } = debug;
    state.infinityCount = 1;
    state.infinityUpgradeMask = 1 << 5;
    debug.toggleInfinityChallenge(8);
    state.vertices = 12;
    setLogResource(state, "totalScore", 10);
    setLogResource(state, "generationScore", 10);
    debug.runGeneration();
    state.vertices = 9;
    setLogResource(state, "score", 25);
    debug.runCoreBoost();
  });

  await compareScenario("bounded vertex processing", async ({ debug }) => {
    const { state } = debug;
    state.speedLevel = 24;
    state.gainLevel = 500;
    state.vertices = 1_000;
    state.currentGainLog10 = 25;
    state.currentGain = 1e25;
    debug.update(0.08);
    debug.update(0.08);
  });

  {
    const baselineSave = await makeStoredSave(baselinePath);
    const baselineLoaded = await loadRuntime(baselinePath, baselineSave);
    const candidateLoaded = await loadRuntime(candidatePath, baselineSave);
    disableAchievementChecks(baselineLoaded);
    disableAchievementChecks(candidateLoaded);
    assert.deepStrictEqual(
      compatibilitySnapshot(candidateLoaded),
      compatibilitySnapshot(baselineLoaded),
      "legacy local save must load identically outside approved release behavior",
    );
  }

  {
    const baselineSource = await loadRuntime(baselinePath);
    seedLateGameState(baselineSource);
    const baselineCode = await baselineSource.debug.exportSaveCode();

    const baselineImported = await loadRuntime(baselinePath);
    const candidateImported = await loadRuntime(candidatePath);
    assert.equal(await baselineImported.debug.importSaveCode(baselineCode), true, "next baseline must import its own save code");
    assert.equal(await candidateImported.debug.importSaveCode(baselineCode), true, "candidate must import a next save code");
    disableAchievementChecks(baselineImported);
    disableAchievementChecks(candidateImported);
    assert.deepStrictEqual(
      compatibilitySnapshot(candidateImported),
      compatibilitySnapshot(baselineImported),
      "candidate must restore a next save code identically outside approved release behavior",
    );

    const candidateCode = await candidateImported.debug.exportSaveCode();
    const baselineReloaded = await loadRuntime(baselinePath);
    assert.equal(await baselineReloaded.debug.importSaveCode(candidateCode), true, "next baseline must import a candidate save code");
    disableAchievementChecks(baselineReloaded);
    assert.deepStrictEqual(
      compatibilitySnapshot(baselineReloaded),
      compatibilitySnapshot(candidateImported),
      "candidate save code must remain backward-compatible outside approved release behavior",
    );
  }

  console.log("ESM differential runtime tests passed");
}

module.exports = { runDifferentialTests };
