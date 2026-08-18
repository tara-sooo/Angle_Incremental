const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

function markEternityReady(runtime, state) {
  runtime.syncInfinityPointCachesFromExact(runtime.MAX_EXACT_INFINITY_POINTS);
  state.completedTowerChallenges = 1 << 3;
}

async function testThresholdAndResetBoundary() {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const { state } = debug;

  runtime.syncInfinityPointCachesFromExact(runtime.MAX_EXACT_INFINITY_POINTS - 1n);
  state.completedTowerChallenges = 1 << 3;
  assert.equal(runtime.canEternity(), false, "IP below the finite Eternity boundary must not qualify");

  runtime.syncInfinityPointCachesFromExact(runtime.MAX_EXACT_INFINITY_POINTS);
  state.completedTowerChallenges = 0;
  assert.equal(runtime.canEternity(), false, "the Eternity threshold must still require TC4 completion");
  state.completedTowerChallenges = 1 << 3;
  assert.equal(runtime.canEternity(), true, "the finite IP boundary plus TC4 must qualify for Eternity");

  state.scoreLog10 = 200;
  state.score = Number.MAX_VALUE;
  state.generationCount = 4;
  state.coreBoostCount = 6;
  state.infinityCount = 12;
  state.infinityUpgradeMask = 1 << 10;
  state.infiniteScoreLog10 = 40;
  state.infiniteScore = Number.MAX_VALUE;
  state.infiniteAngleUnlocked = true;
  state.infiniteAngleSpeedLevel = 4;
  state.infiniteAngleVertexLevel = 5;
  state.infiniteAngleGainLevel = 6;
  state.towerFloor = 12;
  state.activeChallenge = 2;
  state.completedChallenges = 1 << 2;
  state.activeTowerChallenge = 4;
  state.activeTowerChallengeTime = 12;
  state.tc4BaseGainLevel = 2;
  state.tc4BaseGainPriceStep = 3;
  state.tc4InfinityScoreVertexGainLevel = 4;
  state.tc4InfinityScoreVertexGainPriceStep = 5;
  state.tc4FreeCoreBoostLevel = 6;
  state.tc4FreeCoreBoostPriceStep = 7;
  state.infiniteCapBroken = true;
  state.currentInfinityRunTime = 11;
  state.currentInfinityRealTime = 12;
  state.bestInfinityCountPerSecond = 13;
  state.infinityCountRateRemainder = 0.5;
  state.achievementMask = 0x1234;
  state.achievementMaskHigh = 0x5678;
  state.totalPlayTime = 100;
  state.totalRealPlayTime = 200;
  state.fastestInfinityTime = 3;
  state.fastestInfinityRealTime = 4;
  state.fastestInfinityChallengeTimes = [1, 2, 3, 4, 5, 6, 7, 8];
  state.fastestTowerChallengeTimes = [9, 10, 11, 12];
  state.lastInfinityRuns = [{ time: 1, realTime: 2, scoreLog10: 3, ipGain: 4, challenge: 0 }];
  state.timeFlux = 321;
  state.timeFluxCapacityLevel = 2;
  state.timeFluxGainLevel = 3;
  state.timeFluxSpeed = 5;
  state.timeFluxCustomSpeed = 6;
  state.automationEnabled = true;
  state.autoRunInfinity = true;
  state.autoInfinityPointThresholdLog10 = 77;
  state.offlineProgressEnabled = false;
  state.language = "en";
  state.noGenerationCoreBoostReached = true;
  state.eternityCount = 8;

  assert.equal(debug.performEternity({ save: false, update: false }), true, "a ready Eternity must execute");
  assert.equal(state.eternityCount, 9, "Eternity must increment its count exactly once");
  assert.equal(state.infinityCount, 0, "Eternity must reset Infinity count");
  assert.equal(state.infinityPointsExact, "0", "Eternity must reset exact IP");
  assert.equal(state.infinityPointsLog10, -Infinity, "Eternity must reset the IP log cache");
  assert.equal(state.coreBoostCount, 0, "Eternity must reset Core Boost");
  assert.equal(state.infinityUpgradeMask, 0, "Eternity must reset Infinity Upgrades");
  assert.equal(state.infiniteScoreLog10, -Infinity, "Eternity must reset Infinite Score");
  assert.equal(state.infiniteAngleUnlocked, false, "Eternity must reset Infinite Angle unlock");
  assert.equal(state.towerFloor, 0, "Eternity must reset Tower floor");
  assert.equal(state.completedChallenges, 0, "Eternity must reset Infinity Challenges");
  assert.equal(state.completedTowerChallenges, 0, "Eternity must reset TC completion including TC4");
  assert.equal(state.tc4BaseGainLevel, 0, "Eternity must reset TC4 local upgrade levels");
  assert.equal(state.tc4FreeCoreBoostPriceStep, 0, "Eternity must reset TC4 local price steps");
  assert.equal(state.infiniteCapBroken, false, "Eternity must restore the Infinity cap");
  assert.equal(state.currentInfinityRunTime, 0, "Eternity must reset current-run timers");
  assert.equal(state.bestInfinityCountPerSecond, 0, "Eternity must reset offline Infinity rate");
  assert.equal(state.infinityCountRateRemainder, 0, "Eternity must reset offline rate remainder");
  assert.equal(state.scoreLog10, -Infinity, "Eternity must reset Score");
  assert.equal(state.generationCount, 0, "Eternity must reset Generation");

  assert.equal(state.achievementMask, 0x1234, "Eternity must preserve achievements");
  assert.equal(state.achievementMaskHigh, 0x5678, "Eternity must preserve high achievement bits");
  assert.equal(state.totalPlayTime, 100, "Eternity must preserve total play time");
  assert.equal(state.totalRealPlayTime, 200, "Eternity must preserve total real play time");
  assert.deepEqual(state.fastestInfinityChallengeTimes, [1, 2, 3, 4, 5, 6, 7, 8], "Eternity must preserve IC records");
  assert.deepEqual(state.fastestTowerChallengeTimes, [9, 10, 11, 12], "Eternity must preserve TC records");
  assert.deepEqual(state.lastInfinityRuns, [{ time: 1, realTime: 2, scoreLog10: 3, ipGain: 4, challenge: 0 }], "Eternity must preserve Infinity history");
  assert.equal(state.timeFlux, 321, "Eternity must preserve Time Flux");
  assert.equal(state.timeFluxCapacityLevel, 2, "Eternity must preserve Time Flux capacity");
  assert.equal(state.timeFluxGainLevel, 3, "Eternity must preserve Time Flux gain");
  assert.equal(state.timeFluxSpeed, 5, "Eternity must preserve Time Flux speed");
  assert.equal(state.timeFluxCustomSpeed, 6, "Eternity must preserve custom Time Flux speed");
  assert.equal(state.automationEnabled, true, "Eternity must preserve automation settings");
  assert.equal(state.autoRunInfinity, true, "Eternity must preserve automation toggles");
  assert.equal(state.autoInfinityPointThresholdLog10, 77, "Eternity must preserve automation thresholds");
  assert.equal(state.offlineProgressEnabled, false, "Eternity must preserve offline settings");
  assert.equal(state.language, "en", "Eternity must preserve UI settings");
  assert.equal(state.noGenerationCoreBoostReached, true, "Eternity must preserve achievement history flags");

  assert.equal(debug.performEternity({ save: false, update: false }), false, "a completed Eternity must not repeat without new TC4/IP state");
  assert.equal(state.eternityCount, 9, "a repeated trigger must not increment Eternity count");
  assert.equal(Object.hasOwn(state, "eternityPoints"), false, "Eternity must not add an EP resource");
}

async function testForcedLoadAndImportPersistence() {
  const source = await loadRuntime(candidatePath);
  const { debug, runtime } = source;
  markEternityReady(runtime, debug.state);
  debug.state.eternityCount = 4;
  debug.state.timeFlux = 456;
  const thresholdSave = runtime.serializeSaveData();
  thresholdSave.savedAt = Date.now();
  const loaded = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(thresholdSave)]]));
  assert.equal(loaded.debug.state.eternityCount, 5, "loading a ready save must force exactly one Eternity");
  assert.equal(loaded.debug.state.infinityPointsExact, "0", "forced load Eternity must persist the IP reset");
  assert.equal(loaded.debug.state.completedTowerChallenges, 0, "forced load Eternity must persist the TC4 reset");
  assert.equal(loaded.debug.state.timeFlux, 456, "forced load Eternity must preserve Time Flux");
  const persistedAfterLoad = JSON.parse(loaded.storage.get(loaded.runtime.SAVE_KEY));
  assert.equal(persistedAfterLoad.state.eternityCount, 5, "forced load Eternity must save the incremented count");
  await loaded.debug.loadGame();
  assert.equal(loaded.debug.state.eternityCount, 5, "reloading the reset save must not duplicate Eternity");

  const importSource = await loadRuntime(candidatePath);
  markEternityReady(importSource.runtime, importSource.debug.state);
  importSource.debug.state.eternityCount = 2;
  const saveCode = await importSource.debug.exportSaveCode();
  const importTarget = await loadRuntime(candidatePath);
  assert.equal(await importTarget.debug.importSaveCode(saveCode), true, "save-code import should accept a ready Eternity save");
  assert.equal(importTarget.debug.state.eternityCount, 3, "save-code import must force one Eternity");
  assert.equal(importTarget.debug.state.completedTowerChallenges, 0, "save-code import must reset TC4 completion");
  assert.equal(importTarget.debug.state.infinityPointsExact, "0", "save-code import must reset exact IP");
}

async function testInfinityCompletionTrigger() {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const { state } = debug;
  runtime.syncInfinityPointCachesFromExact(runtime.MAX_EXACT_INFINITY_POINTS);
  state.infinityCount = 1;
  state.scoreLog10 = 7777;
  state.score = Number.MAX_VALUE;
  state.activeTowerChallenge = 4;
  assert.equal(debug.runInfinity(false), undefined, "Infinity completion keeps its existing void return contract");
  assert.equal(state.eternityCount, 1, "successful TC4 Infinity completion must trigger Eternity");
  assert.equal(state.completedTowerChallenges, 0, "the Infinity-triggered Eternity must clear TC4 completion");
  assert.equal(state.infinityPointsExact, "0", "the Infinity-triggered Eternity must clear IP");
}

async function runEternityModuleRuntimeTest() {
  await testThresholdAndResetBoundary();
  await testInfinityCompletionTrigger();
  await testForcedLoadAndImportPersistence();
  console.log("Eternity module runtime tests passed");
}

module.exports = { runEternityModuleRuntimeTest };
