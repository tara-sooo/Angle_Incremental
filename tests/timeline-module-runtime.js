const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

function setScoreLog(state, log10) {
  state.scoreLog10 = log10;
  state.score = Number.MAX_VALUE;
}

function setIpLog(state, log10) {
  state.infinityPointsLog10 = log10;
  state.infinityPoints = Number.MAX_VALUE;
  state.infinityPointsExact = "0";
}

function markEternityReady(runtime, state) {
  runtime.syncInfinityPointCachesFromExact(runtime.MAX_EXACT_INFINITY_POINTS);
  state.completedTowerChallenges = 1 << 3;
}

async function testManualTracks() {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const { state } = debug;
  state.eternityCount = 1;
  runtime.updateUi();

  assert.equal(runtime.timelineDiscovered(), true, "the first Eternity should discover Timeline");
  assert.deepEqual(
    [state.scoreTfClaims, state.ipTfClaims, state.eternityTfClaims],
    [0, 0, 0],
    "new Timeline state should start with no claims",
  );
  assert.equal(runtime.timelineScoreRequirementLog10(), 20000, "Score track should start at 1e20000");
  assert.equal(runtime.timelineIpRequirementLog10(), 400, "IP track should start at 1e400");
  assert.equal(runtime.timelineEternityRequirement(), 2n, "Eternity track should start at 2 Eternities");

  setScoreLog(state, 25000);
  runtime.updateUi();
  assert.equal(runtime.canClaimTimelineTf("score"), true, "a met Score threshold should enable one claim");
  assert.equal(runtime.claimTimelineTf("score", { save: false, update: false }), true);
  assert.equal(state.scoreTfClaims, 1, "one Score action should grant exactly one TF");
  assert.equal(state.scoreLog10, 25000, "claiming TF must not consume Score");
  assert.equal(runtime.timelineScoreRequirementLog10(), 30000, "Score requirement should advance independently");
  assert.equal(runtime.claimTimelineTf("score", { save: false, update: false }), false, "one action must not claim all met thresholds");

  setScoreLog(state, 50000);
  assert.equal(runtime.claimScoreTf({ save: false, update: false }), true);
  assert.equal(state.scoreTfClaims, 2, "the second Score threshold should be claimable manually");
  assert.equal(runtime.claimScoreTf({ save: false, update: false }), true);
  assert.equal(state.scoreTfClaims, 3, "each repeated manual claim should advance once");

  setIpLog(state, 450);
  assert.equal(runtime.claimIpTf({ save: false, update: false }), true, "the IP track should use its own log threshold");
  assert.equal(state.ipTfClaims, 1);
  assert.equal(state.infinityPointsLog10, 450, "claiming TF must not consume Infinity Points");

  state.eternityCount = 2;
  assert.equal(runtime.canClaimTimelineTf("eternity"), true);
  assert.equal(runtime.claimEternityTf({ save: false, update: false }), true);
  assert.equal(state.eternityTfClaims, 1);
  assert.equal(runtime.timelineEternityRequirement(), 4n, "Eternity requirement should advance independently");
  assert.equal(runtime.timelineEarnedTf(), 5, "earned TF should derive from the three claim counters");
}

async function testTimelineTreePurchases() {
  const locked = await loadRuntime(candidatePath);
  locked.debug.state.scoreTfClaims = 1;
  assert.equal(locked.runtime.timelineNodeAvailability("Real-BC16500").reason, "timeline-locked");
  assert.equal(locked.runtime.canPurchaseTimelineNode("Real-BC16500"), false, "Timeline nodes must stay locked before discovery");

  const { debug, runtime } = await loadRuntime(candidatePath);
  const { state } = debug;
  state.eternityCount = 1;
  state.scoreTfClaims = 1;
  runtime.updateUi();
  assert.deepEqual(
    Array.from(runtime.timelineNodes(), (node) => node.id),
    ["Real-BC16500", "Parallel-BC16500"],
    "the first era should expose exactly the two canonical route nodes",
  );
  assert.deepEqual(
    Array.from(runtime.timelineNodes(), (node) => [node.era, node.route, node.costTF, Array.from(node.prerequisites)]),
    [
      ["BC16500", "Real", 1, []],
      ["BC16500", "Parallel", 1, []],
    ],
    "first-era definitions should carry independent route metadata and one-TF costs",
  );
  assert.equal(runtime.timelineAvailableTf(), 1);
  assert.equal(runtime.canPurchaseTimelineNode("Real-BC16500"), true);
  assert.equal(runtime.canPurchaseTimelineNode("Parallel-BC16500"), true, "either route should be purchasable before a route is selected");
  assert.equal(runtime.purchaseTimelineNode("Real-BC16500", { save: false, update: false }), true);
  assert.equal(state.timelinePurchasedNodes.length, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(state.timelinePurchasedNodes[0])),
    { id: "Real-BC16500", era: "BC16500", route: "Real", costTF: 1 },
    "purchases should store the canonical node metadata",
  );
  assert.equal(runtime.timelineEarnedTf(), 1, "purchasing must not reduce earned TF");
  assert.equal(runtime.timelineSpentTf(), 1);
  assert.equal(runtime.timelineAvailableTf(), 0, "purchasing should spend only available TF");
  assert.equal(runtime.purchaseTimelineNode("Real-BC16500", { save: false, update: false }), false, "duplicate purchases must be rejected");
  assert.equal(runtime.timelineNodeAvailability("Parallel-BC16500").reason, "route-conflict");
  assert.equal(runtime.purchaseTimelineNode("Parallel-BC16500", { save: false, update: false }), false, "the same-era alternative route must be locked");
  assert.equal(state.scoreTfClaims, 1, "node purchases must not change claim history");

  const missingPrerequisite = runtime.timelineNodeAvailability({
    id: "future-node",
    era: "BC14000",
    route: "Parallel",
    costTF: 1,
    prerequisites: ["future-prerequisite"],
  });
  assert.equal(missingPrerequisite.reason, "missing-prerequisites", "prerequisite checks should be generic for later nodes");
  assert.equal(
    runtime.timelineNodeHasRouteConflict({ id: "future-parallel", era: "BC14000", route: "Parallel" }),
    false,
    "a later era may independently choose the opposite route",
  );

  assert.equal(runtime.respecTimeline({ save: false, update: false }), true);
  assert.equal(runtime.timelineAvailableTf(), 1, "respec should restore the spent TF through derived accounting");
  assert.equal(runtime.purchaseTimelineNode("Parallel-BC16500", { save: false, update: false }), true, "the other route should be available after respec");
  assert.equal(runtime.timelineNodeAvailability("Real-BC16500").reason, "route-conflict", "exclusivity should work in the reverse direction");

  const serialized = runtime.serializeSaveData();
  const loaded = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(serialized)]]));
  assert.deepEqual(JSON.parse(JSON.stringify(loaded.debug.state.timelinePurchasedNodes)), [
    { id: "Parallel-BC16500", era: "BC16500", route: "Parallel", costTF: 1 },
  ], "save/load should preserve the canonical purchased node");
  assert.equal(loaded.runtime.timelineAvailableTf(), 0);
}

async function testResetPersistenceAndRespec() {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const { state } = debug;
  state.eternityCount = 12;
  state.scoreTfClaims = 2;
  state.ipTfClaims = 1;
  state.eternityTfClaims = 3;
  state.timelinePurchasedNodes = [
    { id: "Real-BC16500", era: "BC16500", route: "Real", costTF: 1 },
  ];
  state.eternityMilestoneMask = 5;
  state.totalPlayTime = 321;
  markEternityReady(runtime, state);

  assert.equal(runtime.timelineAvailableTf(), 5, "available TF should subtract canonical node costs");
  assert.equal(debug.performEternity({ save: false, update: false }), true, "ordinary Eternity should remain executable");
  assert.equal(state.eternityCount, 13);
  assert.equal(state.timelinePurchasedNodes.length, 1, "ordinary Eternity must preserve the Timeline build");
  assert.equal(state.timelinePurchasedNodes[0].id, "Real-BC16500");
  assert.equal(state.timelinePurchasedNodes[0].costTF, 1);
  assert.deepEqual(
    [state.scoreTfClaims, state.ipTfClaims, state.eternityTfClaims],
    [2, 1, 3],
    "ordinary Eternity must preserve all TF claim counters",
  );
  assert.equal(runtime.timelineAvailableTf(), 5, "ordinary Eternity must preserve unused TF");
  assert.equal(state.eternityMilestoneMask, 5, "resets must preserve permanent Milestones");
  assert.equal(state.totalPlayTime, 321, "resets must preserve permanent statistics");
  state.currentEternityRunTime = 17;
  state.currentEternityRealTime = 19;
  state.fastestEternityTime = 3;
  state.fastestEternityRealTime = 4;
  state.lastEternityRuns = [{ time: 17, realTime: 19, infinityCount: 12 }];

  assert.equal(debug.respecTimeline({ save: false, update: false }), true, "Timeline respec should restart the current run");
  assert.equal(state.eternityCount, 13, "respec must not change Eternity count");
  assert.equal(state.timelinePurchasedNodes.length, 0, "respec should remove every purchased node");
  assert.deepEqual(
    [state.scoreTfClaims, state.ipTfClaims, state.eternityTfClaims],
    [2, 1, 3],
    "respec must preserve claim history",
  );
  assert.equal(runtime.timelineAvailableTf(), 6, "respec should refund all spent TF through derivation");
  assert.equal(state.scoreLog10, -Infinity, "respec should restart the current lower-layer run");
  assert.equal(state.infinityPointsExact, "0", "respec must not refund or preserve current IP");
  assert.equal(state.currentEternityRunTime, 0, "Timeline respec should reset current Eternity game time");
  assert.equal(state.currentEternityRealTime, 0, "Timeline respec should reset current Eternity real time");
  assert.equal(state.fastestEternityTime, 3, "Timeline respec should preserve the fastest Eternity game time");
  assert.equal(state.fastestEternityRealTime, 4, "Timeline respec should preserve the fastest Eternity real time");
  assert.deepEqual(JSON.parse(JSON.stringify(state.lastEternityRuns)), [{ time: 17, realTime: 19, infinityCount: 12 }], "Timeline respec should preserve Eternity history");
  assert.equal(debug.respecTimeline({ save: false, update: false }), true, "repeated respec should remain safe");
  assert.equal(runtime.timelineAvailableTf(), 6, "repeated respec must not duplicate or lose TF");

  state.eternityCount = 108;
  state.timelinePurchasedNodes = [{ id: "milestone-node", costTF: 1 }];
  debug.respecTimeline({ save: false, update: false });
  assert.equal(state.eternityCount, 108, "high-count respec must still preserve Eternity count");
  assert.equal(state.infinityPointsExact, "1000", "respec should apply the current Eternity starting baseline");
  assert.equal(state.completedChallenges, (1 << runtime.INFINITY_CHALLENGE_COUNT) - 1, "respec should apply active Milestone start state");
}

async function testSaveCompatibility() {
  const source = await loadRuntime(candidatePath);
  const { runtime, debug } = source;
  debug.state.eternityCount = 1;
  debug.state.scoreTfClaims = 2;
  debug.state.ipTfClaims = 1;
  debug.state.eternityTfClaims = 4;
  debug.state.timelinePurchasedNodes = [{ id: "node", costTF: 2 }];
  const serialized = runtime.serializeSaveData();
  const loaded = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(serialized)]]));
  assert.deepEqual(
    [loaded.debug.state.scoreTfClaims, loaded.debug.state.ipTfClaims, loaded.debug.state.eternityTfClaims],
    [2, 1, 4],
    "save/load should preserve explicit TF claims",
  );
  assert.equal(loaded.debug.state.timelinePurchasedNodes.length, 1);
  assert.equal(loaded.debug.state.timelinePurchasedNodes[0].id, "node");
  assert.equal(loaded.debug.state.timelinePurchasedNodes[0].costTF, 2);
  assert.equal(loaded.runtime.timelineAvailableTf(), 5);

  const legacy = structuredClone(serialized);
  delete legacy.state.scoreTfClaims;
  delete legacy.state.ipTfClaims;
  delete legacy.state.eternityTfClaims;
  delete legacy.state.timelinePurchasedNodes;
  const migrated = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(legacy)]]));
  assert.deepEqual(
    [migrated.debug.state.scoreTfClaims, migrated.debug.state.ipTfClaims, migrated.debug.state.eternityTfClaims],
    [0, 0, 0],
    "existing post-Eternity saves must not receive retroactive TF claims",
  );
  assert.equal(migrated.debug.state.timelinePurchasedNodes.length, 0);
  assert.equal(migrated.runtime.timelineDiscovered(), true, "existing post-Eternity saves should discover Timeline");
  assert.equal(migrated.debug.mainTabIsUnlocked("eternity"), true, "existing post-Eternity saves should keep Eternity discovered");
  assert.equal(migrated.debug.mainTabIsUnlocked("timeline"), false, "Timeline should no longer be treated as a top-level tab");

  const legacyTimelineOnly = structuredClone(serialized);
  legacyTimelineOnly.state.eternityCount = 0;
  legacyTimelineOnly.state.infinityCount = 0;
  legacyTimelineOnly.state.towerFloor = 0;
  legacyTimelineOnly.state.completedTowerChallenges = 0;
  legacyTimelineOnly.state.unlockedMainTabs = ["timeline"];
  legacyTimelineOnly.state.hiddenTabs = ["timeline"];
  const migratedLegacyTimeline = await loadRuntime(
    candidatePath,
    new Map([[runtime.SAVE_KEY, JSON.stringify(legacyTimelineOnly)]]),
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(migratedLegacyTimeline.debug.state.unlockedMainTabs)),
    ["eternity", "timeline"],
    "legacy Timeline discovery should imply nested Eternity access",
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(migratedLegacyTimeline.debug.state.hiddenTabs)),
    [],
    "legacy Timeline hidden-tab preferences should be discarded",
  );
  assert.equal(migratedLegacyTimeline.runtime.timelineDiscovered(), true);
  assert.equal(migratedLegacyTimeline.debug.mainTabIsUnlocked("eternity"), true);
  assert.equal(migratedLegacyTimeline.debug.mainTabIsUnlocked("timeline"), false);
  assert.deepEqual(
    JSON.parse(JSON.stringify(migratedLegacyTimeline.runtime.serializeSaveData().state.hiddenTabs)),
    [],
    "serialized settings should not resurrect a top-level Timeline preference",
  );
}

function assertClose(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
}

async function testTimelineEffectsAndTimer() {
  const source = await loadRuntime(candidatePath);
  const { debug, runtime } = source;
  const { state } = debug;
  runtime.updateUi = () => {};
  runtime.saveGame = () => true;
  runtime.createCheckpoint = () => true;
  state.eternityCount = 1;
  state.infinityCount = 1;
  state.scoreLog10 = 310;
  state.score = Number.MAX_VALUE;
  state.timelinePurchasedNodes = [];
  runtime.syncInfinityPointCachesFromExact(100n);

  assert.equal(runtime.timelineIpGainMultiplierLog10(), 0, "unowned Timeline nodes must not affect IP gain");
  assert.equal(runtime.infinityPointGain(), 3, "the unmodified balance IP gain should remain canonical");

  state.timelinePurchasedNodes = [{ id: "Real-BC16500", era: "BC16500", route: "Real", costTF: 1 }];
  assertClose(
    runtime.timelineIpGainMultiplierLog10(),
    Math.log10(3),
    1e-12,
    "Real should use 1 + log10(current IP)",
  );
  assert.equal(runtime.infinityPointGain(), 9, "Real should multiply the canonical IP gain");

  state.timelinePurchasedNodes = [{ id: "Parallel-BC16500", era: "BC16500", route: "Parallel", costTF: 1 }];
  assertClose(
    runtime.timelineParallelEffectiveLog10(0),
    0,
    1e-12,
    "Parallel should be inactive before the IC8 boundary advances",
  );
  const softcapSeconds = 10 / Math.log10(3);
  assertClose(
    runtime.timelineParallelRawLog10(softcapSeconds),
    10,
    1e-12,
    "Parallel softcap should begin at raw log10 10",
  );
  assertClose(
    runtime.timelineParallelEffectiveLog10(softcapSeconds),
    10,
    1e-12,
    "Parallel logarithmic softcap should be continuous",
  );
  assertClose(runtime.timelineParallelEffectiveLog10(60), 10 + 10 * Math.log10(1 + (60 * Math.log10(3) - 10) / 10), 1e-12, "Parallel minute curve");
  assertClose(runtime.timelineParallelEffectiveLog10(3600), 32.3493, 0.001, "Parallel hour anchor");
  assertClose(runtime.timelineParallelEffectiveLog10(86400), 46.1514, 0.001, "Parallel day anchor");
  assertClose(runtime.timelineParallelEffectiveLog10(604800), 54.6024, 0.001, "Parallel week anchor");

  state.completedChallenges = 1 << 7;
  state.timelineParallelSecondsSinceIc8Clear = 0;
  state.scoreLog10 = -Infinity;
  state.score = 0;
  debug.update(2);
  assert.equal(state.timelineParallelSecondsSinceIc8Clear, 2, "the normal update path should advance the post-IC8 timer once");

  state.timelineParallelSecondsSinceIc8Clear = 12;
  state.activeChallenge = 8;
  state.activeChallengeTime = 4;
  state.completedChallenges = 0;
  state.scoreLog10 = 310;
  state.score = Number.MAX_VALUE;
  debug.runInfinity(false);
  assert.equal(state.timelineParallelSecondsSinceIc8Clear, 0, "a genuine IC8 completion should reset the timer boundary");

  state.completedChallenges = 1 << 7;
  state.timelineParallelSecondsSinceIc8Clear = 42;
  state.activeChallenge = 0;
  state.scoreLog10 = 310;
  state.score = Number.MAX_VALUE;
  debug.runInfinity(false);
  assert.equal(state.timelineParallelSecondsSinceIc8Clear, 42, "ordinary Infinity must preserve the run-local timer");

  state.timelinePurchasedNodes = [{ id: "Real-BC16500", era: "BC16500", route: "Real", costTF: 1 }];
  state.eternityCount = 127;
  state.infinityCount = 1;
  state.scoreLog10 = 310;
  state.score = Number.MAX_VALUE;
  runtime.syncInfinityPointCachesFromExact(runtime.MAX_EXACT_INFINITY_POINTS - 1n);
  debug.runInfinity(false);
  assert.equal(runtime.currentExactInfinityPoints(), runtime.MAX_EXACT_INFINITY_POINTS, "Timeline gain must respect the pre-Break IP cap");

  state.eternityCount = 128;
  state.infinityCount = 1;
  state.scoreLog10 = 310;
  state.score = Number.MAX_VALUE;
  runtime.syncInfinityPointCachesFromExact(runtime.MAX_EXACT_INFINITY_POINTS);
  debug.runInfinity(false);
  assert.ok(runtime.currentExactInfinityPoints() > runtime.MAX_EXACT_INFINITY_POINTS, "Timeline gain must remain exact above the Break Eternity cap");

  state.timelineParallelSecondsSinceIc8Clear = 5;
  state.completedChallenges = 1 << 7;
  state.offlineTickCount = 1;
  state.scoreLog10 = -Infinity;
  state.score = 0;
  const offlineReport = await debug.processOfflineElapsed(60, "timeline-test", { clockSource: "server" });
  assert.equal(offlineReport.simulatedSeconds, 60, "offline processing should simulate the trusted interval");
  assertClose(state.timelineParallelSecondsSinceIc8Clear, 65, 1e-9, "offline elapsed time should advance the timer exactly once");

  const serialized = runtime.serializeSaveData();
  assertClose(serialized.state.timelineParallelSecondsSinceIc8Clear, 65, 1e-9, "the timer should be serialized");
  serialized.savedAt = Date.now();
  serialized.state.offlineProgressEnabled = false;
  const loaded = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(serialized)]]));
  assertClose(loaded.debug.state.timelineParallelSecondsSinceIc8Clear, 65, 1e-9, "the timer should survive save/load");
}

async function testTimelineResetSemantics() {
  const source = await loadRuntime(candidatePath);
  const { debug, runtime } = source;
  const { state } = debug;
  runtime.updateUi = () => {};
  runtime.saveGame = () => true;
  runtime.createCheckpoint = () => true;
  state.eternityCount = 1;
  state.timelinePurchasedNodes = [{ id: "Parallel-BC16500", era: "BC16500", route: "Parallel", costTF: 1 }];
  state.timelineParallelSecondsSinceIc8Clear = 99;
  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true, "ordinary Eternity should reset the run timer");
  assert.equal(state.timelineParallelSecondsSinceIc8Clear, 0);
  assert.equal(state.timelinePurchasedNodes[0].id, "Parallel-BC16500", "ordinary Eternity should preserve the selected node");

  state.eternityCount = 26;
  state.timelineParallelSecondsSinceIc8Clear = 99;
  const challengeTimes = state.fastestInfinityChallengeTimes.map((value) => value);
  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true, "Milestone 6 boundary Eternity should execute");
  assert.equal(state.eternityCount, 27);
  assert.equal(state.timelineParallelSecondsSinceIc8Clear, 0, "Milestone 6 should start its new run at timer zero");
  assert.equal(state.completedChallenges, (1 << runtime.INFINITY_CHALLENGE_COUNT) - 1);
  assert.equal(state.fastestInfinityChallengeTimes.every((value, index) => value === challengeTimes[index]), true, "Milestone 6 must not replay IC8 completion");
  debug.update(1);
  assert.equal(state.timelineParallelSecondsSinceIc8Clear, 1, "Milestone 6 should advance from its completed starting state");

  state.timelineParallelSecondsSinceIc8Clear = 20;
  assert.equal(debug.respecTimeline({ save: false, update: false }), true, "Timeline respec should restart the current run");
  assert.equal(state.timelineParallelSecondsSinceIc8Clear, 0, "Timeline respec should discard the old timer");
  assert.equal(state.timelinePurchasedNodes.length, 0, "Timeline respec should remove the selected node");
}

async function runTimelineModuleRuntimeTest() {
  await testManualTracks();
  await testTimelineTreePurchases();
  await testResetPersistenceAndRespec();
  await testSaveCompatibility();
  await testTimelineEffectsAndTimer();
  await testTimelineResetSemantics();
  console.log("Timeline module runtime tests passed");
}

module.exports = { runTimelineModuleRuntimeTest };
