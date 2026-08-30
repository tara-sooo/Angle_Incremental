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

async function testEternityRunStatistics() {
  const timerInstance = await loadRuntime(candidatePath);
  const { debug: timerDebug } = timerInstance;
  const timerState = timerDebug.state;
  timerDebug.update(5, true);
  assert.equal(timerState.currentEternityRunTime, 5, "game time should advance during an offline-capable update");
  assert.equal(timerState.currentEternityRealTime, 0, "offline-capable updates must not advance Eternity real time");
  timerDebug.advanceOnlineTime(2);
  assert.ok(Math.abs(timerState.currentEternityRunTime - 7) < 1e-9, "online time should advance Eternity game time");
  assert.ok(Math.abs(timerState.currentEternityRealTime - 2) < 1e-9, "online time should advance Eternity real time");
  timerState.offlineTickCount = 1;
  const offlineReport = await timerDebug.processOfflineElapsed(60, "eternity-statistics-test", { clockSource: "server" });
  assert.equal(offlineReport.simulatedSeconds, 60, "offline processing should simulate the trusted interval");
  assert.ok(Math.abs(timerState.currentEternityRunTime - 67) < 1e-9, "offline progress should advance Eternity game time");
  assert.ok(Math.abs(timerState.currentEternityRealTime - 2) < 1e-9, "offline progress must not advance Eternity real time");

  const { debug, runtime } = await loadRuntime(candidatePath);
  const { state } = debug;
  state.currentEternityRunTime = 7;
  state.currentEternityRealTime = 2;
  state.infinityCount = 1;
  setScore(state, 7777);
  debug.runInfinity(false);
  assert.equal(state.currentEternityRunTime, 7, "ordinary Infinity must preserve Eternity game time");
  assert.equal(state.currentEternityRealTime, 2, "ordinary Infinity must preserve Eternity real time");

  state.currentEternityRunTime = 12.5;
  state.currentEternityRealTime = 8.25;
  state.infinityCount = 6;
  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true, "a successful Eternity should record its run");
  assert.deepEqual(JSON.parse(JSON.stringify(state.lastEternityRuns[0])), { time: 12.5, realTime: 8.25, infinityCount: 6 });
  assert.equal(state.currentEternityRunTime, 0, "successful Eternity should reset current game time");
  assert.equal(state.currentEternityRealTime, 0, "successful Eternity should reset current real time");
  assert.equal(state.fastestEternityTime, 12.5);
  assert.equal(state.fastestEternityRealTime, 8.25);

  state.currentEternityRunTime = 3.25;
  state.currentEternityRealTime = 4.5;
  state.infinityCount = 2;
  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true);
  assert.deepEqual(JSON.parse(JSON.stringify(state.lastEternityRuns.slice(0, 2))), [
    { time: 3.25, realTime: 4.5, infinityCount: 2 },
    { time: 12.5, realTime: 8.25, infinityCount: 6 },
  ], "Eternity history should be newest first and preserve the pre-reset Infinity count");
  assert.equal(state.fastestEternityTime, 3.25);
  assert.equal(state.fastestEternityRealTime, 4.5);

  for (let index = 0; index < 10; index += 1) {
    state.currentEternityRunTime = 100 + index;
    state.currentEternityRealTime = 100 + index;
    state.infinityCount = index;
    runtime.recordEternityRun();
  }
  assert.equal(state.lastEternityRuns.length, 10, "Eternity history should retain at most ten records");
  assert.equal(state.lastEternityRuns[0].infinityCount, 9, "the newest Eternity record should remain first");
  assert.equal(state.lastEternityRuns.at(-1).infinityCount, 0, "the oldest retained Eternity record should be the tenth newest");
  state.currentEternityRunTime = 0;
  state.currentEternityRealTime = 0;
  runtime.recordEternityRun();
  assert.equal(state.lastEternityRuns[0].time, 0, "zero-time Eternity records should remain zero");
  assert.equal(state.fastestEternityTime, 3.25, "zero-time records must not replace the fastest record");
}

async function testMilestoneChoiceLifecycle() {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const { state } = debug;

  assert.equal(runtime.firstTierMilestoneEntitlementCount(), 0, "no first-tier acquisition should exist before the first Eternity");
  assert.deepEqual(Array.from(runtime.availableEternityMilestoneChoices()), [], "first-tier Milestones should not be acquirable before the first Eternity");
  assert.equal(runtime.selectEternityMilestone("1-1"), false, "pre-Eternity reservation must no longer be possible");

  markEternityReady(runtime, state);
  assert.equal(runtime.canEternity(), true, "the full requirement should make Eternity available");
  assert.equal(runtime.shouldForceEternity(), false, "qualified Eternity must not be forced");
  assert.equal(runtime.maybeForceEternity({ save: false, update: false }), false, "legacy automatic trigger hooks must be inert");
  assert.equal(state.eternityCount, 0, "automatic hooks must not increment Eternity count");

  assert.equal(debug.performEternity({ save: false, update: false }), true, "explicit Eternity should execute when qualified");
  assert.equal(state.eternityCount, 1);
  assert.equal(state.eternityMilestoneMask, 0, "Eternity itself must not auto-acquire a first-tier Milestone");
  assert.equal(runtime.firstTierMilestoneEntitlementCount(), 1, "the first Eternity should grant one persistent first-tier acquisition");
  assert.deepEqual(Array.from(runtime.availableEternityMilestoneChoices()), ["1-1", "1-2", "1-3"]);

  assert.equal(runtime.selectEternityMilestone("1-1"), true, "an earned first-tier acquisition should be consumable after Eternity");
  assert.equal(state.eternityMilestoneMask, 1, "the acquired first-tier Milestone should become owned immediately");
  assert.equal(runtime.firstTierMilestoneEntitlementCount(), 0, "one Eternity must fund at most one first-tier acquisition");
  assert.equal(runtime.selectEternityMilestone("1-2"), false, "a second first-tier acquisition must wait for another Eternity");
  assert.equal(runtime.normalAutomationUnlocked(), true, "1-1 should unlock pre-Infinity automation");

  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true);
  assert.equal(state.eternityCount, 2);
  assert.equal(runtime.firstTierMilestoneEntitlementCount(), 1, "the second Eternity should add another acquisition right");
  assert.equal(runtime.selectEternityMilestone("1-2"), true);
  assert.equal(state.eternityMilestoneMask, 3, "the second acquisition should add 1-2 without duplicating 1-1");

  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true);
  assert.equal(runtime.selectEternityMilestone("1-3"), true);
  assert.equal(state.eternityMilestoneMask, 7, "all first-tier Milestones should be acquirable over three successful Eternities");
  assert.equal(runtime.firstTierMilestoneEntitlementCount(), 0);
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
  assert.equal(runtime.infinityUpgradeAutomationUnlocked(), true, "5 should unlock Infinity Upgrade automation");
  assert.equal(runtime.infinityAutomationUnlocked(), false, "5 must not unlock the existing Auto Infinity path");

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
  assert.equal(runtime.runLayerAutomation(), false, "5 must not unlock the existing Infinity-layer automation");
  assert.equal(state.infinityCount, 1, "Milestone 5 must not run Auto Infinity");

  state.infinityUpgradeMask = 1 << 12;
  assert.equal(runtime.infinityAutomationUnlocked(), true, "IU 8-1 should remain the Auto Infinity unlock");
  assert.equal(runtime.runLayerAutomation(), true, "IU 8-1 should still unlock the existing Infinity-layer automation");
  assert.equal(state.infinityCount, 2, "Auto Infinity should still use the normal Infinity action");

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
  state.eternityCount = 26;
  assert.equal(runtime.eternityMilestoneActive("6"), false, "milestone 6 must remain locked below Eternity 27");
  state.eternityCount = 27;
  assert.equal(runtime.eternityMilestoneActive("6"), true, "milestone 6 must activate at Eternity 27");
  state.eternityCount = 43;
  assert.equal(runtime.eternityMilestoneActive("7"), false, "milestone 7 must remain locked below Eternity 44");
  state.eternityCount = 44;
  assert.equal(runtime.eternityMilestoneActive("7"), true, "milestone 7 must activate at Eternity 44");
  state.eternityCount = 107;
  assert.equal(runtime.eternityMilestoneActive("9"), false, "milestone 9 must remain locked below Eternity 108");
  state.eternityCount = 108;
  assert.equal(runtime.eternityMilestoneActive("9"), true, "milestone 9 must activate at Eternity 108");

  assert.equal(state.autoBuyInfiniteAngleSpeed, false, "Milestone 8 IA Speed automation should default off");
  assert.equal(state.autoBuyInfiniteAngleVertex, false, "Milestone 8 IA Vertex automation should default off");
  assert.equal(state.autoBuyInfiniteAngleGain, false, "Milestone 8 IA Gain automation should default off");
  assert.equal(state.autoBuildTower, false, "Milestone 8 Tower automation should default off");
  state.eternityCount = 80;
  assert.equal(runtime.eternityMilestoneActive("8"), false, "milestone 8 must remain locked below Eternity 81");
  state.eternityCount = 81;
  assert.equal(runtime.eternityMilestoneActive("8"), true, "milestone 8 must activate at Eternity 81");

  state.automationEnabled = true;
  state.autoRunInfinity = false;
  state.autoRunCoreBoost = false;
  state.autoRunGeneration = false;
  state.activeChallenge = 0;
  state.activeTowerChallenge = 0;
  state.towerFloor = 0;
  state.completedTowerChallenges = 0;
  state.infiniteAngleUnlocked = true;
  state.infiniteAngleSpeedLevel = 0;
  state.infiniteAngleVertexLevel = 0;
  state.infiniteAngleGainLevel = 0;
  state.autoBuyInfiniteAngleSpeed = true;
  state.autoBuyInfiniteAngleVertex = false;
  state.autoBuyInfiniteAngleGain = true;
  state.autoBuildTower = false;
  runtime.syncInfinityPointCachesFromExact(10n ** 22n);
  state.eternityCount = 80;
  assert.equal(runtime.runEternityMilestoneEightAutomation(), false, "Milestone 8 automation must not run below Eternity 81");
  assert.deepEqual(
    [state.infiniteAngleSpeedLevel, state.infiniteAngleVertexLevel, state.infiniteAngleGainLevel],
    [0, 0, 0],
    "locked Milestone 8 must not purchase IA upgrades",
  );
  state.eternityCount = 81;
  assert.equal(runtime.runEternityMilestoneEightAutomation(), true, "Milestone 8 automation should run at Eternity 81");
  assert.ok(state.infiniteAngleSpeedLevel > 0, "enabled IA Speed automation should purchase Speed");
  assert.equal(state.infiniteAngleVertexLevel, 0, "disabled IA Vertex automation must not purchase Vertex");
  assert.ok(state.infiniteAngleGainLevel > 0, "enabled IA Gain automation should purchase Gain");

  state.autoBuyInfiniteAngleSpeed = false;
  state.autoBuyInfiniteAngleVertex = false;
  state.autoBuyInfiniteAngleGain = false;
  state.autoBuildTower = true;
  state.infiniteAngleUnlocked = false;
  state.towerFloor = 0;
  state.completedTowerChallenges = 0;
  runtime.syncInfinityPointCachesFromExact(runtime.MAX_EXACT_INFINITY_POINTS);
  assert.equal(runtime.runEternityMilestoneEightAutomation(), true, "Tower auto-build should use the normal build action");
  assert.equal(state.towerFloor, 1, "Tower automation should build one normal next floor");

  state.towerFloor = 3;
  state.completedTowerChallenges = 0;
  runtime.syncInfinityPointCachesFromExact(runtime.MAX_EXACT_INFINITY_POINTS);
  assert.equal(runtime.runEternityMilestoneEightAutomation(), true, "Milestone 7 should allow the normal Tower gate at its unlock floor");
  assert.equal(state.towerFloor, 4, "Tower automation should build past a Milestone 7-completed gate");
  assert.notEqual(state.completedTowerChallenges & 1, 0, "Milestone 7 should mark the normal Tower challenge complete");

  runtime.syncInfinityPointCachesFromExact(0n);
  assert.equal(runtime.runEternityMilestoneEightAutomation(), false, "Tower automation must respect insufficient IP");
  assert.equal(state.towerFloor, 4, "insufficient IP must not advance Tower");

  state.autoBuildTower = false;
  state.infiniteAngleUnlocked = true;
  state.activeTowerChallenge = 4;
  state.infiniteAngleSpeedLevel = 0;
  state.infiniteAngleVertexLevel = 0;
  state.infiniteAngleGainLevel = 0;
  state.autoBuyInfiniteAngleSpeed = true;
  state.autoBuyInfiniteAngleVertex = true;
  state.autoBuyInfiniteAngleGain = true;
  runtime.syncInfinityPointCachesFromExact(runtime.MAX_EXACT_INFINITY_POINTS);
  assert.equal(runtime.runEternityMilestoneEightAutomation(), true, "IA automation should use the normal TC4 purchase path");
  assert.deepEqual(
    [state.infiniteAngleSpeedLevel, state.infiniteAngleVertexLevel, state.infiniteAngleGainLevel],
    [1, 1, 1],
    "TC4 must keep each IA track at its normal one-level restriction",
  );
}

async function testMilestoneFiveInfinityUpgradeAutomation() {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const { state } = debug;

  state.eternityCount = 19;
  state.eternityMilestoneMask = 1;
  state.automationEnabled = true;
  state.autoBuyInfinityUpgrades = true;
  runtime.syncInfinityPointCachesFromExact(2n);
  assert.equal(runtime.infinityUpgradeAutomationUnlocked(), false, "Milestone 5 must stay locked below Eternity 20");
  assert.equal(runtime.buyAllInfinityUpgrades({ refresh: false, save: false }), 0, "locked IU automation must not buy upgrades");

  state.eternityCount = 20;
  state.infinityUpgradeMask = 0;
  state.autoBuyInfinityUpgrades = false;
  runtime.syncInfinityPointCachesFromExact(2n);
  runtime.runAutobuyers();
  assert.equal(state.infinityUpgradeMask, 0, "the IU autobuyer must stay off by default");
  assert.equal(runtime.currentExactInfinityPoints(), 2n, "the IU autobuyer must not spend while disabled");

  state.autoBuyInfinityUpgrades = true;
  state.automationEnabled = false;
  runtime.runAutobuyers();
  assert.equal(state.infinityUpgradeMask, 0, "the IU autobuyer must require the normal Automation master switch");
  assert.equal(runtime.currentExactInfinityPoints(), 2n, "the master switch gate must not spend IP");

  state.automationEnabled = true;
  runtime.runAutobuyers();
  assert.equal(state.infinityUpgradeMask, 3, "the IU autobuyer must purchase both affordable root upgrades");
  assert.equal(runtime.currentExactInfinityPoints(), 0n, "the IU autobuyer must spend the exact purchase costs");
  assert.equal(runtime.hasInfinityUpgrade("2-1"), false, "the IU autobuyer must not grant unaffordable upgrades for free");
  assert.equal(runtime.infinityAutomationUnlocked(), false, "M5 purchases must not unlock Auto Infinity");

  state.infinityUpgradeMask = 0;
  runtime.syncInfinityPointCachesFromExact(14n);
  assert.equal(runtime.buyAllInfinityUpgrades({ refresh: false, save: false }), 6, "the bulk buyer must follow the canonical prerequisite chain");
  assert.equal(state.infinityUpgradeMask, (1 << 6) - 1, "the bulk buyer must purchase only the six affordable canonical upgrades");
  assert.equal(runtime.currentExactInfinityPoints(), 0n, "the canonical bulk buyer must spend each upgrade cost exactly once");
}

async function testMilestoneSixCompletionState() {
  const source = await loadRuntime(candidatePath);
  const { debug, runtime } = source;
  const { state } = debug;
  const allChallengesMask = (1 << runtime.INFINITY_CHALLENGE_COUNT) - 1;
  const challengeTimes = [1, 2, 3, 4, 5, 6, 7, 8];

  state.eternityCount = 25;
  state.completedChallenges = 1;
  state.activeChallenge = 2;
  state.activeChallengeTime = 12;
  state.fastestInfinityChallengeTimes = [...challengeTimes];
  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true, "Eternity 26 should still execute normally");
  assert.equal(state.eternityCount, 26, "the pre-Milestone 6 Eternity should increment normally");
  assert.equal(state.completedChallenges, 0, "Eternity 26 should leave Infinity Challenges incomplete");
  assert.equal(state.activeChallenge, 0, "Eternity should clear an active Infinity Challenge");
  assert.deepEqual(state.fastestInfinityChallengeTimes, challengeTimes, "Milestone 6 must not replay or rewrite IC clear times");

  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true, "the 27th Eternity should execute normally");
  assert.equal(state.eternityCount, 27, "the 27th successful Eternity should reach the Milestone 6 threshold");
  assert.equal(state.completedChallenges, allChallengesMask, "Milestone 6 should directly complete IC1 through IC8");
  assert.equal(runtime.completedChallengeCount(), runtime.INFINITY_CHALLENGE_COUNT, "normal completion counts should see every IC as completed");
  assert.equal(runtime.isChallengeCompleted(1), true, "IC1 should be completed by the Milestone 6 state");
  assert.equal(runtime.isChallengeCompleted(8), true, "IC8 should be completed by the Milestone 6 state");
  assert.equal(runtime.infinityCountGain(), 2, "existing IC6 reward logic should see the Milestone 6 completion state");
  assert.deepEqual(state.fastestInfinityChallengeTimes, challengeTimes, "Milestone 6 should not trigger manual clear timing side effects");

  const saveData = runtime.serializeSaveData();
  saveData.savedAt = Date.now();
  const loaded = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(saveData)]]));
  assert.equal(loaded.debug.state.completedChallenges, allChallengesMask, "the existing completedChallenges save field should preserve Milestone 6 state");
  assert.equal(loaded.runtime.completedChallengeCount(), loaded.runtime.INFINITY_CHALLENGE_COUNT, "save/load should preserve all completed IC predicates");

  loaded.debug.state.completedChallenges = 0;
  markEternityReady(loaded.runtime, loaded.debug.state);
  assert.equal(loaded.debug.performEternity({ save: false, update: false }), true, "a later Eternity should still execute with Milestone 6 active");
  assert.equal(loaded.debug.state.eternityCount, 28, "later Eternity resets should remain available after save/load");
  assert.equal(loaded.debug.state.completedChallenges, allChallengesMask, "later Eternity resets should restore all IC completion directly");
}

async function testMilestoneFreeLevelsAndSaveLoad() {
  const source = await loadRuntime(candidatePath);
  const { debug, runtime } = source;
  const { state } = debug;

  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true);
  state.infiniteAngleSpeedLevel = 2;
  state.infiniteAngleVertexLevel = 3;
  state.infiniteAngleGainLevel = 4;
  assert.equal(runtime.selectEternityMilestone("1-3"), true, "1-3 should be acquired from the earned post-Eternity entitlement");
  assert.equal(state.infiniteAngleSpeedLevel, 2, "acquiring 1-3 must not rewrite purchased IA Speed levels");
  assert.equal(state.infiniteAngleVertexLevel, 3, "acquiring 1-3 must not rewrite purchased IA Vertex levels");
  assert.equal(state.infiniteAngleGainLevel, 4, "acquiring 1-3 must not rewrite purchased IA Gain levels");
  assert.equal(runtime.infiniteAngleFreeUpgradeLevel("speed"), 5, "1-3 should derive five free IA Speed levels");
  assert.equal(runtime.infiniteAngleEffectiveUpgradeLevel("speed"), 7, "1-3 should add free levels to purchased IA Speed");
  assert.equal(runtime.infiniteAngleEffectiveUpgradeLevel("vertex"), 8, "1-3 should add free levels to purchased IA Vertex");
  assert.equal(runtime.infiniteAngleEffectiveUpgradeLevel("gain"), 9, "1-3 should add free levels to purchased IA Gain");

  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true, "Eternity should still reset purchased IA levels normally");
  assert.equal(state.infiniteAngleSpeedLevel, 0, "Eternity should reset purchased IA Speed levels");
  assert.equal(state.infiniteAngleVertexLevel, 0, "Eternity should reset purchased IA Vertex levels");
  assert.equal(state.infiniteAngleGainLevel, 0, "Eternity should reset purchased IA Gain levels");
  assert.equal(runtime.infiniteAngleEffectiveUpgradeLevel("speed"), 5, "persistent 1-3 ownership should restore effective IA Speed level five");
  assert.equal(runtime.infiniteAngleEffectiveUpgradeLevel("vertex"), 5, "persistent 1-3 ownership should restore effective IA Vertex level five");
  assert.equal(runtime.infiniteAngleEffectiveUpgradeLevel("gain"), 5, "persistent 1-3 ownership should restore effective IA Gain level five");

  state.eternityMilestoneMask = 5;
  state.eternityCount = 20;
  state.eternityMilestoneChoice = "1-2";
  state.infiniteAngleSpeedLevel = 0;
  state.infiniteAngleVertexLevel = 1;
  state.infiniteAngleGainLevel = 2;
  state.autoBuyInfiniteAngleSpeed = true;
  state.autoBuyInfiniteAngleVertex = false;
  state.autoBuyInfiniteAngleGain = true;
  state.autoBuildTower = true;
  const saveData = runtime.serializeSaveData();
  saveData.savedAt = Date.now();
  const loaded = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(saveData)]]));
  assert.equal(loaded.debug.state.eternityMilestoneMask, 5, "milestone ownership must survive save/load");
  assert.equal(loaded.debug.state.infiniteAngleSpeedLevel, 0, "v11 saves must preserve purchased IA Speed levels");
  assert.equal(loaded.debug.state.infiniteAngleVertexLevel, 1, "v11 saves must preserve purchased IA Vertex levels");
  assert.equal(loaded.debug.state.infiniteAngleGainLevel, 2, "v11 saves must preserve purchased IA Gain levels");
  assert.equal(loaded.runtime.infiniteAngleEffectiveUpgradeLevel("speed"), 5, "v11 save/load should derive effective IA Speed level");
  assert.equal(loaded.runtime.infiniteAngleEffectiveUpgradeLevel("vertex"), 6, "v11 save/load should derive effective IA Vertex level");
  assert.equal(loaded.runtime.infiniteAngleEffectiveUpgradeLevel("gain"), 7, "v11 save/load should derive effective IA Gain level");
  assert.equal(loaded.debug.state.autoBuyInfiniteAngleSpeed, true, "IA Speed automation should survive save/load");
  assert.equal(loaded.debug.state.autoBuyInfiniteAngleVertex, false, "IA Vertex automation should survive save/load");
  assert.equal(loaded.debug.state.autoBuyInfiniteAngleGain, true, "IA Gain automation should survive save/load");
  assert.equal(loaded.debug.state.autoBuildTower, true, "Tower automation should survive save/load");
  assert.equal(loaded.runtime.firstTierMilestoneEntitlementCount(), 1, "unused first-tier entitlement should be derived from count and ownership after save/load");
  assert.deepEqual(Array.from(loaded.runtime.availableEternityMilestoneChoices()), ["1-2"], "legacy pending-choice state must not consume or auto-grant the available entitlement");
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
  assert.equal(runtime.shouldForceEternity(), false, "qualification must not imply automatic Eternity");
  assert.equal(runtime.maybeForceEternity({ save: false, update: false }), false, "legacy automatic trigger calls must be inert at the threshold");

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
  state.autoBuyInfinityUpgrades = true;
  state.autoInfinityPointThresholdLog10 = 77;
  state.autoBuyInfiniteAngleSpeed = true;
  state.autoBuyInfiniteAngleVertex = false;
  state.autoBuyInfiniteAngleGain = true;
  state.autoBuildTower = true;
  state.offlineProgressEnabled = false;
  state.language = "en";
  state.noGenerationCoreBoostReached = true;
  state.eternityCount = 8;

  assert.equal(debug.performEternity({ save: false, update: false }), true, "an explicit ready Eternity must execute");
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
  assert.equal(state.autoBuyInfinityUpgrades, true, "Eternity must preserve Infinity Upgrade automation");
  assert.equal(state.autoInfinityPointThresholdLog10, 77, "Eternity must preserve automation thresholds");
  assert.equal(state.autoBuyInfiniteAngleSpeed, true, "Eternity must preserve IA Speed automation");
  assert.equal(state.autoBuyInfiniteAngleVertex, false, "Eternity must preserve IA Vertex automation");
  assert.equal(state.autoBuyInfiniteAngleGain, true, "Eternity must preserve IA Gain automation");
  assert.equal(state.autoBuildTower, true, "Eternity must preserve Tower automation");
  assert.equal(state.offlineProgressEnabled, false, "Eternity must preserve offline settings");
  assert.equal(state.language, "en", "Eternity must preserve UI settings");
  assert.equal(state.noGenerationCoreBoostReached, true, "Eternity must preserve achievement history flags");

  assert.equal(debug.performEternity({ save: false, update: false }), false, "a completed Eternity must not repeat without new TC4/IP state");
  assert.equal(state.eternityCount, 9, "a repeated manual action must not increment Eternity count");
  assert.equal(Object.hasOwn(state, "eternityPoints"), false, "Eternity must not add an EP resource");
}

async function testQualifiedLoadAndImportDoNotAutoEternity() {
  const source = await loadRuntime(candidatePath);
  const { debug, runtime } = source;
  markEternityReady(runtime, debug.state);
  debug.state.eternityCount = 4;
  debug.state.timeFlux = 456;
  const thresholdSave = runtime.serializeSaveData();
  thresholdSave.savedAt = Date.now();
  const loaded = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(thresholdSave)]]));
  assert.equal(loaded.debug.state.eternityCount, 4, "loading a qualified save must not auto-Eternity");
  assert.equal(loaded.debug.state.infinityPointsExact, runtime.MAX_EXACT_INFINITY_POINTS.toString(), "qualified load must preserve IP until the player acts");
  assert.notEqual(loaded.debug.state.completedTowerChallenges & (1 << 3), 0, "qualified load must preserve TC4 completion until manual Eternity");
  assert.equal(loaded.debug.state.timeFlux, 456, "qualified load must preserve Time Flux");
  assert.equal(loaded.runtime.canEternity(), true, "a qualified loaded save should remain ready for manual Eternity");

  const importSource = await loadRuntime(candidatePath);
  markEternityReady(importSource.runtime, importSource.debug.state);
  importSource.debug.state.eternityCount = 2;
  const saveCode = await importSource.debug.exportSaveCode();
  const importTarget = await loadRuntime(candidatePath);
  assert.equal(await importTarget.debug.importSaveCode(saveCode), true, "save-code import should accept a qualified Eternity save");
  assert.equal(importTarget.debug.state.eternityCount, 2, "save-code import must not auto-Eternity");
  assert.notEqual(importTarget.debug.state.completedTowerChallenges & (1 << 3), 0, "save-code import must preserve TC4 completion until manual Eternity");
  assert.equal(importTarget.debug.state.infinityPointsExact, importTarget.runtime.MAX_EXACT_INFINITY_POINTS.toString(), "save-code import must preserve exact IP until manual Eternity");
  assert.equal(importTarget.runtime.canEternity(), true, "imported qualified state should remain ready for explicit Eternity");
}

async function testInfinityCompletionMakesEternityAvailable() {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const { state } = debug;
  runtime.syncInfinityPointCachesFromExact(runtime.MAX_EXACT_INFINITY_POINTS);
  state.infinityCount = 1;
  state.scoreLog10 = 7777;
  state.score = Number.MAX_VALUE;
  state.activeTowerChallenge = 4;
  assert.equal(debug.runInfinity(false), undefined, "Infinity completion keeps its existing void return contract");
  assert.equal(state.eternityCount, 0, "successful TC4 Infinity completion must not auto-Eternity");
  assert.notEqual(state.completedTowerChallenges & (1 << 3), 0, "TC4 completion must remain set until manual Eternity");
  assert.equal(runtime.currentExactInfinityPoints(), runtime.MAX_EXACT_INFINITY_POINTS, "qualified IP must remain available before manual Eternity");
  assert.equal(runtime.canEternity(), true, "successful TC4 completion at the IP threshold should make Eternity available");
  assert.equal(runtime.isAchievementUnlocked(40), true, "successful TC4 completion must unlock achievement 40 before the reset");
  assert.equal(runtime.isAchievementUnlocked(41), false, "Achievement 41 must wait for the explicit Eternity action");

  assert.equal(debug.performEternity({ save: false, update: false }), true, "the player-triggered Eternity should execute from the qualified state");
  assert.equal(state.eternityCount, 1);
  assert.equal(state.completedTowerChallenges, 0, "manual Eternity must clear TC4 completion");
  assert.equal(state.infinityPointsExact, "0", "manual Eternity must clear IP");
  assert.equal(runtime.isAchievementUnlocked(41), true, "the successful manual Eternity must unlock achievement 41");
}

async function testMilestoneNineStartingIp() {
  const beforeThreshold = await loadRuntime(candidatePath);
  beforeThreshold.debug.state.eternityCount = 106;
  markEternityReady(beforeThreshold.runtime, beforeThreshold.debug.state);
  assert.equal(beforeThreshold.debug.performEternity({ save: false, update: false }), true, "Eternity 107 should still execute below Milestone 9");
  assert.equal(beforeThreshold.debug.state.eternityCount, 107);
  assert.equal(beforeThreshold.debug.state.infinityPointsExact, "0", "pre-Milestone 9 runs should still start with zero IP");

  const boundary = await loadRuntime(candidatePath);
  boundary.debug.state.eternityCount = 107;
  markEternityReady(boundary.runtime, boundary.debug.state);
  assert.equal(boundary.debug.performEternity({ save: false, update: false }), true, "the 108th Eternity should execute");
  assert.equal(boundary.debug.state.eternityCount, 108);
  assert.equal(boundary.runtime.eternityMilestoneActive("9"), true);
  assert.equal(boundary.debug.state.infinityPointsExact, "1000", "the 108th Eternity should start with exactly 1000 IP");
  assert.equal(boundary.debug.state.infinityPointsLog10, 3, "Milestone 9 should synchronize the IP log cache");
  assert.equal(boundary.debug.state.infinityPoints, 1000, "Milestone 9 should synchronize the numeric IP cache");
  assert.equal(boundary.runtime.currentExactInfinityPoints(), 1000n, "Milestone 9 should synchronize exact IP");

  boundary.runtime.syncInfinityPointCachesFromExact(2500n);
  const saveData = boundary.runtime.serializeSaveData();
  saveData.savedAt = Date.now();
  const loaded = await loadRuntime(candidatePath, new Map([[boundary.runtime.SAVE_KEY, JSON.stringify(saveData)]]));
  loaded.debug.update(0);
  assert.equal(loaded.debug.state.infinityPointsExact, "2500", "loading a post-Eternity run must not re-grant 1000 IP");
  assert.equal(loaded.debug.state.infinityPointsLog10, Math.log10(2500), "save/load must preserve the current IP log cache");
  assert.equal(loaded.debug.state.infinityPoints, 2500, "save/load must preserve the numeric IP cache");

  markEternityReady(loaded.runtime, loaded.debug.state);
  assert.equal(loaded.debug.performEternity({ save: false, update: false }), true, "later Eternity resets should remain available");
  assert.equal(loaded.debug.state.eternityCount, 109);
  assert.equal(loaded.debug.state.infinityPointsExact, "1000", "later Milestone 9 resets should restart at 1000 rather than accumulate");
  assert.equal(loaded.debug.state.infinityPointsLog10, 3);
  assert.equal(loaded.debug.state.infinityPoints, 1000);
}

async function testBreakEternityBoundaryAndPersistence() {
  const source = await loadRuntime(candidatePath);
  const { debug, runtime } = source;
  const { state } = debug;
  const cap = runtime.MAX_EXACT_INFINITY_POINTS;
  const threshold = runtime.eternityRequirementExact();

  state.eternityCount = 126;
  runtime.syncInfinityPointCachesFromExact(cap - 1n);
  assert.equal(runtime.infinityPointCapActive(), true, "the IP cap should remain active below Milestone 10");
  assert.equal(runtime.currentExactInfinityPoints(), cap - 1n, "IP below the old ceiling should remain exact");
  runtime.syncInfinityPointCachesFromExact(cap + 1n);
  assert.equal(runtime.currentExactInfinityPoints(), cap, "IP above the old ceiling should clamp before Break Eternity");

  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true, "the 127th Eternity should still execute normally");
  assert.equal(state.eternityCount, 127);
  assert.equal(runtime.eternityMilestoneActive("10"), false, "Milestone 10 must remain locked at Eternity 127");
  assert.equal(runtime.infinityPointCapActive(), true, "Break Eternity must not activate at Eternity 127");

  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true, "the 128th Eternity should execute normally");
  assert.equal(state.eternityCount, 128);
  assert.equal(runtime.eternityMilestoneActive("10"), true, "Milestone 10 should activate at Eternity 128");
  assert.equal(runtime.infinityPointCapActive(), false, "the 128th Eternity should remove the IP cap immediately");
  assert.equal(runtime.eternityRequirementExact(), threshold, "Break Eternity must not change the existing Eternity IP threshold");
  assert.equal(debug.maybeForceEternity({ save: false, update: false }), false, "Break Eternity must not make Eternity automatic");

  runtime.syncInfinityPointCachesFromExact(cap * 2n);
  state.completedTowerChallenges = 0;
  assert.equal(runtime.canEternity(), false, "TC4 must remain required after Break Eternity");
  state.completedTowerChallenges = 1 << 3;
  assert.equal(runtime.canEternity(), true, "the existing threshold plus TC4 should remain the manual Eternity gate");
  assert.equal(runtime.currentExactInfinityPoints(), cap * 2n, "above-cap IP should remain exact after Break Eternity");
  assert.ok(state.infinityPointsLog10 > Math.log10(Number.MAX_VALUE), "above-cap IP should retain an above-cap log cache");
  assert.equal(state.infinityPoints, Number.MAX_VALUE, "the finite numeric cache should remain a compatibility projection");
  assert.match(runtime.formatUiLogNumber(state.infinityPointsLog10), /e308$/, "above-cap IP should remain displayable");

  assert.equal(runtime.spendInfinityPoints(Math.log10(100)), true, "above-cap IP should remain spendable through the exact path");
  assert.equal(runtime.currentExactInfinityPoints(), cap * 2n - 100n, "spending should preserve exact above-cap remainders");

  const saveData = runtime.serializeSaveData();
  saveData.savedAt = Date.now();
  const loaded = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(saveData)]]));
  assert.equal(loaded.debug.state.eternityCount, 128, "save/load should preserve the Break Eternity count-derived state");
  assert.equal(loaded.runtime.infinityPointCapActive(), false, "save/load should retain the uncapped progression state");
  assert.equal(loaded.debug.state.infinityPointsExact, (cap * 2n - 100n).toString(), "save/load should preserve above-cap exact IP");
  assert.equal(loaded.runtime.eternityRequirementExact(), threshold, "save/load should preserve the unchanged Eternity threshold");

  markEternityReady(loaded.runtime, loaded.debug.state);
  assert.equal(loaded.debug.performEternity({ save: false, update: false }), true, "a later manual Eternity should remain available");
  assert.equal(loaded.debug.state.eternityCount, 129, "later Eternity should increment normally after Break Eternity");
  assert.equal(loaded.runtime.infinityPointCapActive(), false, "Break Eternity should persist through later Eternities");

  loaded.debug.state.automationEnabled = true;
  loaded.debug.state.autoRunInfinity = true;
  loaded.debug.state.autoInfinityPointThresholdLog10 = 0;
  loaded.debug.state.infinityCount = 1;
  loaded.debug.state.activeChallenge = 0;
  loaded.debug.state.activeTowerChallenge = 0;
  loaded.debug.state.scoreLog10 = 7777;
  loaded.debug.state.score = Number.MAX_VALUE;
  loaded.debug.state.infinityUpgradeMask = 1 << 12;
  loaded.runtime.syncInfinityPointCachesFromExact(cap * 2n);
  const offlineBefore = loaded.runtime.currentExactInfinityPoints();
  loaded.debug.update(1 / 60, true);
  assert.ok(loaded.runtime.currentExactInfinityPoints() > offlineBefore, "the offline update path should continue adding exact IP above the old ceiling");
}

async function testMainTabDiscoveryLifecycle() {
  const source = await loadRuntime(candidatePath);
  const { debug, runtime } = source;
  const { state } = debug;

  assert.deepEqual(Array.from(state.unlockedMainTabs), [], "a new game should start without progression-tab discoveries");
  assert.equal(debug.mainTabIsUnlocked("angle"), true, "ANGLE should always be available");
  assert.equal(debug.mainTabIsUnlocked("statistics"), true, "STAT should always be available");
  assert.equal(debug.mainTabIsUnlocked("achievements"), true, "ACH should always be available");
  assert.equal(debug.mainTabIsUnlocked("help"), true, "HELP should always be available");
  assert.equal(debug.mainTabIsUnlocked("settings"), true, "SET should always be available");
  assert.equal(debug.mainTabIsUnlocked("infinity"), false, "INF should remain hidden before the first discovery");
  assert.equal(debug.mainTabIsUnlocked("eternity"), false, "ETR should remain hidden before TC4 unlock");

  state.infinityCount = 1;
  runtime.updateUi();
  assert.deepEqual(Array.from(state.unlockedMainTabs), ["infinity"], "the first Infinity should discover INF");
  state.infinityCount = 0;
  runtime.updateUi();
  assert.equal(debug.mainTabIsUnlocked("infinity"), true, "INF should remain unlocked after the current count resets");

  const challengeUpgrade = runtime.infinityUpgradeById("4-1");
  state.infinityCount = 1;
  state.infinityUpgradeMask = 1 << challengeUpgrade.bit;
  runtime.updateUi();
  assert.equal(debug.mainTabIsUnlocked("challenges"), true, "IU 4-1 should discover CHAL");
  state.infinityCount = 0;
  state.infinityUpgradeMask = 0;
  state.activeChallenge = 0;
  runtime.updateUi();
  assert.equal(debug.mainTabIsUnlocked("challenges"), true, "CHAL should remain unlocked after IU 4-1 resets");
  debug.toggleInfinityChallenge(1);
  assert.equal(state.activeChallenge, 0, "CHAL page access must not bypass current IU 4-1 entry requirements");

  const tc4 = await loadRuntime(candidatePath);
  tc4.debug.state.towerFloor = 11;
  tc4.runtime.updateUi();
  assert.equal(tc4.debug.mainTabIsUnlocked("eternity"), false, "ETR should remain hidden below the TC4 unlock floor");
  tc4.debug.state.towerFloor = 12;
  tc4.runtime.updateUi();
  assert.deepEqual(Array.from(tc4.debug.state.unlockedMainTabs), ["eternity"], "TC4 unlock should discover ETR before Eternity");
  tc4.runtime.resetEternityProgression();
  tc4.runtime.updateUi();
  assert.deepEqual(Array.from(tc4.debug.state.unlockedMainTabs), ["eternity"], "Eternity resets must not revoke ETR discovery");

  const milestoneFive = await loadRuntime(candidatePath);
  milestoneFive.debug.state.eternityCount = 20;
  milestoneFive.debug.state.infinityCount = 0;
  milestoneFive.debug.state.infinityUpgradeMask = 0;
  milestoneFive.runtime.updateUi();
  assert.equal(milestoneFive.debug.mainTabIsUnlocked("automation"), true, "Milestone 5 should discover AUTO");
  assert.equal(milestoneFive.runtime.normalAutomationUnlocked(), false, "Milestone 5 must not fake IU 1-2 or Milestone 1-1");
  assert.equal(milestoneFive.runtime.infinityAutomationUnlocked(), false, "Milestone 5 must not fake IU 8-1");
  assert.equal(milestoneFive.runtime.infinityUpgradeAutomationUnlocked(), true, "Milestone 5 should retain its IU autobuy capability");
  assert.equal(milestoneFive.runtime.elements.autoBuyInfinityUpgradesToggle.disabled, false, "Milestone 5 IU autobuy control should remain available");

  state.unlockedMainTabs = ["infinity"];
  state.infinityCount = 1;
  state.hiddenTabs = ["infinity"];
  runtime.updateUi();
  assert.equal(debug.mainTabIsUnlocked("infinity"), true, "hiding a tab must not change its permanent unlock");
  assert.equal(debug.mainTabIsVisible("infinity"), false, "hiddenTabs should still control navigation visibility");
  state.infinityCount = 0;
  runtime.resetEternityProgression();
  runtime.updateUi();
  assert.equal(debug.mainTabIsUnlocked("infinity"), true, "resets must not revoke a discovered tab");
  assert.equal(debug.mainTabIsVisible("infinity"), false, "resets must not override a hidden tab preference");
}

async function runEternityModuleRuntimeTest() {
  await testEternityRunStatistics();
  await testMilestoneChoiceLifecycle();
  await testMilestoneThresholdsAndEffects();
  await testMilestoneFiveInfinityUpgradeAutomation();
  await testMilestoneSixCompletionState();
  await testMilestoneFreeLevelsAndSaveLoad();
  await testThresholdAndResetBoundary();
  await testInfinityCompletionMakesEternityAvailable();
  await testMilestoneNineStartingIp();
  await testBreakEternityBoundaryAndPersistence();
  await testQualifiedLoadAndImportDoNotAutoEternity();
  await testMainTabDiscoveryLifecycle();
  console.log("Eternity module runtime tests passed");
}

module.exports = { runEternityModuleRuntimeTest };
