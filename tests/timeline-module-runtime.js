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

async function testResetPersistenceAndRespec() {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const { state } = debug;
  state.eternityCount = 12;
  state.scoreTfClaims = 2;
  state.ipTfClaims = 1;
  state.eternityTfClaims = 3;
  state.timelinePurchasedNodes = [
    { id: "future-node", era: "future", route: "Real", costTF: 2 },
  ];
  state.eternityMilestoneMask = 5;
  state.totalPlayTime = 321;
  markEternityReady(runtime, state);

  assert.equal(runtime.timelineAvailableTf(), 4, "available TF should subtract canonical node costs");
  assert.equal(debug.performEternity({ save: false, update: false }), true, "ordinary Eternity should remain executable");
  assert.equal(state.eternityCount, 13);
  assert.equal(state.timelinePurchasedNodes.length, 1, "ordinary Eternity must preserve the Timeline build");
  assert.equal(state.timelinePurchasedNodes[0].id, "future-node");
  assert.equal(state.timelinePurchasedNodes[0].costTF, 2);
  assert.deepEqual(
    [state.scoreTfClaims, state.ipTfClaims, state.eternityTfClaims],
    [2, 1, 3],
    "ordinary Eternity must preserve all TF claim counters",
  );
  assert.equal(runtime.timelineAvailableTf(), 4, "ordinary Eternity must preserve unused TF");
  assert.equal(state.eternityMilestoneMask, 5, "resets must preserve permanent Milestones");
  assert.equal(state.totalPlayTime, 321, "resets must preserve permanent statistics");

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
  assert.equal(migrated.debug.mainTabIsUnlocked("timeline"), true, "existing post-Eternity saves should discover Timeline");
}

async function runTimelineModuleRuntimeTest() {
  await testManualTracks();
  await testResetPersistenceAndRespec();
  await testSaveCompatibility();
  console.log("Timeline module runtime tests passed");
}

module.exports = { runTimelineModuleRuntimeTest };
