const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

function markEternityReady(runtime, state) {
  runtime.syncInfinityPointCachesFromExact(runtime.MAX_EXACT_INFINITY_POINTS);
  state.completedTowerChallenges = 1 << 3;
}

function setScore(state, log10) {
  state.scoreLog10 = log10;
  state.score = log10 <= 308 ? 10 ** log10 : Number.MAX_VALUE;
}

async function testMilestoneChoiceLifecycle() {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const { state } = debug;

  assert.deepEqual(Array.from(runtime.availableEternityMilestoneChoices()), ["1-1", "1-2", "1-3"]);
  assert.equal(runtime.selectEternityMilestone("1-1"), true, "the first-tier choice should be selectable before the first Eternity");
  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true);
  assert.equal(state.eternityCount, 1);
  assert.equal(state.eternityMilestoneMask, 1, "one selected first-tier milestone should be acquired");
  assert.equal(state.eternityMilestoneChoice, "", "the pending choice should be consumed");
  assert.equal(runtime.normalAutomationUnlocked(), true, "1-1 should unlock pre-Infinity automation");
  assert.deepEqual(Array.from(runtime.availableEternityMilestoneChoices()), ["1-2", "1-3"]);

  state.eternityMilestoneChoice = "1-2";
  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true);
  assert.equal(state.eternityMilestoneMask, 3, "one Eternity must not acquire multiple first-tier choices");

  state.eternityMilestoneChoice = "1-3";
  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true);
  assert.equal(state.eternityMilestoneMask, 7, "all first-tier milestones should be acquirable over later Eternities");
  assert.deepEqual(Array.from(runtime.availableEternityMilestoneChoices()), [], "no first-tier offer remains after all three are owned");
  assert.equal(Object.hasOwn(state, "eternityPoints"), false, "milestones must not introduce an EP currency");
}

async function testMilestoneThresholdsAndEffects() {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const { state } = debug;

  state.eternityCount = 4;
  assert.equal(runtime.eternityMilestoneActive("2"), false);
  state.eternityCount = 5;
  assert.equal(runtime.eternityMilestoneActive("2"), true);
  state.eternityCount = 7;
  assert.equal(runtime.eternityMilestoneActive("3"), false);
  state.eternityCount = 8;
  assert.equal(runtime.eternityMilestoneActive("3"), true);
  state.eternityCount = 11;
  assert.equal(runtime.eternityMilestoneActive("4"), false);
  assert.equal(runtime.eternityMilestoneActive("5"), false);
  state.eternityCount = 12;
  assert.equal(runtime.eternityMilestoneActive("4"), true);
  state.eternityCount = 20;
  assert.equal(runtime.eternityMilestoneActive("5"), true);
  assert.equal(runtime.infinityAutomationUnlocked(), true, "5 should unlock the existing Infinity automation path");

  state.eternityMilestoneMask = 1;
  state.eternityCount = 1;
  state.automationEnabled = true;
  state.autoBuySpeed = true;
  state.autoBuyVertex = false;
  state.autoBuyGain = false;
  setScore(state, 20);
  state.speedLevel = 0;
  runtime.runAutobuyers();
  assert.ok(state.speedLevel > 0, "1-1 should unlock the existing normal-upgrade autobuyer");

  state.eternityMilestoneMask = 0;
  state.eternityCount = 20;
  state.autoRunInfinity = true;
  state.autoInfinityPointThresholdLog10 = 0;
  state.infinityCount = 1;
  state.activeChallenge = 0;
  state.activeTowerChallenge = 0;
  setScore(state, 309);
  assert.equal(runtime.runLayerAutomation(), true, "5 should unlock the existing Infinity-layer automation");
  assert.equal(state.infinityCount, 2, "milestone 5 automation should still use the normal Infinity action");

  state.eternityMilestoneMask = 2;
  state.eternityCount = 2;
  state.towerFloor = 13;
  state.completedTowerChallenges = 1 << 2;
  state.speedLevel = 100;
  state.gainLevel = 100;
  state.vertices = 103;
  assert.ok(Math.abs(runtime.effectiveSpeedLevel() - 147.62815625) < 1e-12, "1-2 must add its bonus after TC3 Speed scaling");
  assert.ok(Math.abs(runtime.effectiveGainLevel() - 147.62815625) < 1e-12, "1-2 must add its bonus after TC3 Gain scaling");
  assert.equal(runtime.effectiveVertexCount(), 150, "1-2 must add its bonus after TC3 Vertex scaling");

  state.eternityMilestoneMask = 0;
  state.eternityCount = 5;
  setScore(state, 10);
  state.speedLevel = 1;
  const scoreBeforeIc7Reward = state.scoreLog10;
  assert.equal(runtime.isChallengeCompleted(7), false, "milestone 2 must not mark the raw IC7 completion bit");
  assert.equal(runtime.spendNormalUpgrade("speed"), true, "milestone 2 must provide the IC7 score-spend reward");
  assert.equal(state.scoreLog10, scoreBeforeIc7Reward, "milestone 2 must not spend score for a normal upgrade");

  state.eternityCount = 8;
  setScore(state, 20);
  state.generationScoreLog10 = 10;
  state.generationScore = 1e10;
  state.generationCount = 1;
  state.previousGenerationScoreLog10 = 6;
  state.previousGenerationScore = 1e6;
  state.speedLevel = 4;
  state.gainLevel = 5;
  assert.equal(runtime.runGeneration(), undefined);
  assert.equal(state.scoreLog10, 20, "milestone 3 must preserve score through GR");
  assert.equal(state.generationScoreLog10, 10, "milestone 3 must preserve Generation progress through GR");
  assert.equal(state.speedLevel, 4, "milestone 3 must preserve normal upgrades through GR");
  state.coreBoostCount = 0;
  assert.equal(runtime.runCoreBoost(), undefined);
  assert.equal(state.coreBoostCount, 1, "milestone 3 must preserve the CB action");
  assert.equal(state.scoreLog10, 20, "milestone 3 must preserve score through CB");
  assert.equal(state.generationCount, 2, "milestone 3 must preserve Generation count through CB");

  state.eternityCount = 11;
  state.coreBoostCount = 2;
  assert.equal(runtime.coreBoostRequirementLog10(), 80, "CB cost must remain unchanged before milestone 4");
  state.eternityCount = 12;
  assert.equal(runtime.coreBoostRequirementLog10(), 72, "milestone 4 must raise only the CB cost to ^0.9");
}

async function testMilestoneStartingLevelsAndSaveLoad() {
  const source = await loadRuntime(candidatePath);
  const { debug, runtime } = source;
  const { state } = debug;

  state.eternityMilestoneChoice = "1-3";
  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true);
  assert.equal(state.infiniteAngleSpeedLevel, 5, "1-3 should start IA Speed at level 5");
  assert.equal(state.infiniteAngleVertexLevel, 5, "1-3 should start IA Vertex at level 5");
  assert.equal(state.infiniteAngleGainLevel, 5, "1-3 should start IA Gain at level 5");

  state.eternityMilestoneMask = 5;
  state.eternityCount = 20;
  state.eternityMilestoneChoice = "1-2";
  const saveData = runtime.serializeSaveData();
  saveData.savedAt = Date.now();
  const loaded = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(saveData)]]));
  assert.equal(loaded.debug.state.eternityMilestoneMask, 5, "milestone ownership must survive save/load");
  assert.equal(loaded.debug.state.eternityMilestoneChoice, "1-2", "a pending choice must survive save/load");
  assert.equal(loaded.runtime.eternityMilestoneActive("5"), true, "count-based milestones must survive save/load");
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
  state.achievementMaskHigh = 0x5678 | (1 << (40 - 32)) | (1 << (41 - 32));
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

  assert.equal(state.achievementMask & 0x1234, 0x1234, "Eternity must preserve existing achievements");
  assert.equal(state.achievementMaskHigh & (0x5678 | (1 << (40 - 32)) | (1 << (41 - 32))), 0x5678 | (1 << (40 - 32)) | (1 << (41 - 32)), "Eternity must preserve existing high achievement bits");
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
  assert.equal(runtime.isAchievementUnlocked(40), true, "successful TC4 completion must unlock achievement 40 before the reset");
  assert.equal(runtime.isAchievementUnlocked(41), true, "the successful Eternity transition must unlock achievement 41");
}

async function runEternityModuleRuntimeTest() {
  await testMilestoneChoiceLifecycle();
  await testMilestoneThresholdsAndEffects();
  await testMilestoneStartingLevelsAndSaveLoad();
  await testThresholdAndResetBoundary();
  await testInfinityCompletionTrigger();
  await testForcedLoadAndImportPersistence();
  console.log("Eternity module runtime tests passed");
}

module.exports = { runEternityModuleRuntimeTest };
