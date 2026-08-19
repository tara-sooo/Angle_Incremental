const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");
const ACHIEVEMENT_38_TO_41_MASK = [38, 39, 40, 41]
  .reduce((mask, id) => mask | (1 << (id - 32)), 0);

function markEternityReady(runtime, state) {
  runtime.syncInfinityPointCachesFromExact(runtime.MAX_EXACT_INFINITY_POINTS);
  state.completedTowerChallenges = 1 << 3;
}

function setPersistentFixture(state) {
  state.eternityCount = 12;
  state.eternityMilestoneMask = 5;
  state.eternityMilestoneChoice = "1-2";
  state.achievementMaskHigh = ACHIEVEMENT_38_TO_41_MASK;
  state.timeFlux = 321;
  state.timeFluxCapacityLevel = 2;
  state.timeFluxGainLevel = 3;
  state.timeFluxSpeed = 5;
  state.timeFluxCustomSpeed = 6;
}

function assertPersistentFixture(state, messagePrefix) {
  assert.equal(state.eternityCount, 12, `${messagePrefix}: Eternity count should persist`);
  assert.equal(state.eternityMilestoneMask, 5, `${messagePrefix}: Milestone ownership should persist`);
  assert.equal(state.eternityMilestoneChoice, "1-2", `${messagePrefix}: pending first-tier choice should persist`);
  assert.equal(
    state.achievementMaskHigh & ACHIEVEMENT_38_TO_41_MASK,
    ACHIEVEMENT_38_TO_41_MASK,
    `${messagePrefix}: Achievements 38-41 should persist`,
  );
  assert.equal(state.timeFlux, 321, `${messagePrefix}: Time Flux should persist`);
  assert.equal(state.timeFluxCapacityLevel, 2, `${messagePrefix}: Time Flux capacity should persist`);
  assert.equal(state.timeFluxGainLevel, 3, `${messagePrefix}: Time Flux gain should persist`);
  assert.equal(state.timeFluxSpeed, 5, `${messagePrefix}: Time Flux speed should persist`);
  assert.equal(state.timeFluxCustomSpeed, 6, `${messagePrefix}: custom Time Flux speed should persist`);
}

async function testLegacyDefaults() {
  const source = await loadRuntime(candidatePath);
  const { runtime } = source;
  const legacy = runtime.serializeSaveData();
  legacy.savedAt = Date.now();
  delete legacy.state.eternityCount;
  delete legacy.state.eternityMilestoneMask;
  delete legacy.state.eternityMilestoneChoice;
  delete legacy.state.achievementMaskHigh;

  const loaded = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(legacy)]]));
  assert.equal(loaded.debug.state.eternityCount, 0, "legacy saves should default Eternity count to zero");
  assert.equal(loaded.debug.state.eternityMilestoneMask, 0, "legacy saves should default Milestone ownership to zero");
  assert.equal(loaded.debug.state.eternityMilestoneChoice, "", "legacy saves should default pending Milestone choice to empty");
  assert.equal(loaded.debug.state.achievementMaskHigh, 0, "legacy saves should default the high achievement mask safely");
  assert.equal(loaded.runtime.SAVE_VERSION, 10, "optional Eternity fields should not require a speculative save-version bump");
}

async function testCurrentRoundTripAndSanitization() {
  const source = await loadRuntime(candidatePath);
  const { runtime, debug } = source;
  setPersistentFixture(debug.state);
  debug.state.towerFloor = 12;
  debug.state.activeTowerChallenge = 4;
  debug.state.completedTowerChallenges = 0;
  debug.state.tc4BaseGainLevel = 4;
  debug.state.tc4BaseGainPriceStep = 5;

  const serialized = runtime.serializeSaveData();
  serialized.savedAt = Date.now();
  const loaded = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(serialized)]]));
  assertPersistentFixture(loaded.debug.state, "current save round-trip");
  assert.equal(loaded.debug.state.towerFloor, 12, "ordinary save/load should retain the Tower state that legally unlocks TC4");
  assert.equal(loaded.debug.state.activeTowerChallenge, 4, "ordinary save/load should retain a legal active TC4 run");
  assert.equal(loaded.debug.state.completedTowerChallenges, 0, "ordinary save/load must not invent TC completion during an active TC4 run");
  assert.equal(loaded.debug.state.tc4BaseGainLevel, 4, "ordinary save/load should round-trip TC4 local state inside an active TC4 run");
  assert.equal(loaded.debug.state.tc4BaseGainPriceStep, 5, "ordinary save/load should round-trip TC4 price state inside an active TC4 run");

  loaded.runtime.applySaveData({
    eternityMilestoneMask: 255,
    eternityMilestoneChoice: "not-a-milestone",
  }, loaded.runtime.SAVE_VERSION);
  assert.equal(loaded.debug.state.eternityMilestoneMask, 7, "Milestone ownership should strip unknown bits during hydration");
  assert.equal(loaded.debug.state.eternityMilestoneChoice, "", "invalid pending Milestone choices should hydrate to empty");
}

async function testSaveCodeImportAndCheckpointRestore() {
  const instance = await loadRuntime(candidatePath);
  const { context, debug } = instance;
  setPersistentFixture(debug.state);
  const code = await debug.exportSaveCode();

  debug.state.eternityCount = 1;
  debug.state.eternityMilestoneMask = 0;
  debug.state.eternityMilestoneChoice = "";
  debug.state.achievementMaskHigh = 0;
  debug.state.timeFlux = 0;
  debug.state.timeFluxCapacityLevel = 0;
  debug.state.timeFluxGainLevel = 0;
  debug.state.timeFluxSpeed = 1;
  debug.state.timeFluxCustomSpeed = 1;
  assert.equal(await debug.importSaveCode(code), true, "save-code import should accept a valid Eternity-aware save");
  assertPersistentFixture(debug.state, "save-code import");

  assert.equal(debug.createCheckpoint("eternity-save-migration", { force: true }), true, "Eternity persistent state should be checkpointable");
  debug.state.eternityCount = 2;
  debug.state.eternityMilestoneMask = 0;
  debug.state.eternityMilestoneChoice = "";
  debug.state.achievementMaskHigh = 0;
  debug.state.timeFlux = 0;
  const checkpointIndex = debug.recoveryEntries().checkpoints
    .findIndex((entry) => entry.reason === "eternity-save-migration");
  context.window.confirm = () => true;
  assert.notEqual(checkpointIndex, -1, "the Eternity checkpoint should be discoverable");
  assert.equal(debug.restoreCheckpoint(checkpointIndex), true, "checkpoint recovery should use the same Eternity hydration semantics");
  assertPersistentFixture(debug.state, "checkpoint recovery");
}

async function testEternityResetThenSaveLoad() {
  const source = await loadRuntime(candidatePath);
  const { runtime, debug } = source;
  const { state } = debug;

  state.eternityCount = 2;
  state.eternityMilestoneMask = 1;
  state.eternityMilestoneChoice = "1-2";
  state.achievementMaskHigh = [38, 39, 40]
    .reduce((mask, id) => mask | (1 << (id - 32)), 0);
  state.timeFlux = 444;
  state.timeFluxCapacityLevel = 4;
  state.timeFluxGainLevel = 5;
  state.timeFluxSpeed = 7;
  state.timeFluxCustomSpeed = 8;
  state.tc4BaseGainLevel = 9;
  state.tc4BaseGainPriceStep = 10;
  state.tc4InfinityScoreVertexGainLevel = 11;
  state.tc4InfinityScoreVertexGainPriceStep = 12;
  state.tc4FreeCoreBoostLevel = 13;
  state.tc4FreeCoreBoostPriceStep = 14;
  markEternityReady(runtime, state);

  assert.equal(debug.performEternity({ save: false, update: false }), true, "a fully qualified Eternity should execute");
  assert.equal(state.eternityCount, 3, "successful Eternity should increment the count exactly once");
  assert.equal(state.eternityMilestoneMask, 3, "the pending 1-2 choice should be acquired exactly once");
  assert.equal(state.eternityMilestoneChoice, "", "the pending first-tier choice should be consumed");
  assert.equal(state.completedTowerChallenges, 0, "Eternity should reset current-run TC completion");
  assert.equal(state.tc4BaseGainLevel, 0, "Eternity should reset TC4 A level");
  assert.equal(state.tc4BaseGainPriceStep, 0, "Eternity should reset TC4 A price step");
  assert.equal(state.tc4InfinityScoreVertexGainLevel, 0, "Eternity should reset TC4 B level");
  assert.equal(state.tc4InfinityScoreVertexGainPriceStep, 0, "Eternity should reset TC4 B price step");
  assert.equal(state.tc4FreeCoreBoostLevel, 0, "Eternity should reset TC4 C level");
  assert.equal(state.tc4FreeCoreBoostPriceStep, 0, "Eternity should reset TC4 C price step");
  assert.equal(state.achievementMaskHigh & ACHIEVEMENT_38_TO_41_MASK, ACHIEVEMENT_38_TO_41_MASK, "Achievements 38-41 should remain earned after Eternity");
  assert.equal(state.timeFlux, 444, "global Time Flux should survive Eternity");
  assert.equal(state.timeFluxCapacityLevel, 4, "Time Flux capacity should survive Eternity");
  assert.equal(state.timeFluxGainLevel, 5, "Time Flux gain should survive Eternity");
  assert.equal(state.timeFluxSpeed, 7, "Time Flux speed should survive Eternity");
  assert.equal(state.timeFluxCustomSpeed, 8, "custom Time Flux speed should survive Eternity");

  const postEternitySave = runtime.serializeSaveData();
  postEternitySave.savedAt = Date.now();
  const loaded = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(postEternitySave)]]));
  assert.equal(loaded.debug.state.eternityCount, 3, "post-Eternity save/load should retain Eternity count");
  assert.equal(loaded.debug.state.eternityMilestoneMask, 3, "post-Eternity save/load should retain acquired Milestones");
  assert.equal(loaded.debug.state.eternityMilestoneChoice, "", "post-Eternity save/load should not resurrect a consumed choice");
  assert.equal(loaded.debug.state.completedTowerChallenges, 0, "post-Eternity save/load must not resurrect TC completion");
  assert.equal(loaded.debug.state.tc4BaseGainLevel, 0, "post-Eternity save/load must not resurrect TC4 local progression");
  assert.equal(loaded.debug.state.achievementMaskHigh & ACHIEVEMENT_38_TO_41_MASK, ACHIEVEMENT_38_TO_41_MASK, "post-Eternity save/load should retain Achievements 38-41");
  assert.equal(loaded.debug.state.timeFlux, 444, "post-Eternity save/load should retain global Time Flux");

  markEternityReady(loaded.runtime, loaded.debug.state);
  assert.equal(loaded.debug.performEternity({ save: false, update: false }), true, "a later Eternity should still execute after reload");
  assert.equal(loaded.debug.state.eternityCount, 4, "the later Eternity should increment exactly once");
  assert.equal(loaded.debug.state.eternityMilestoneMask, 3, "a consumed pending choice must not be acquired again on a later Eternity");
}

async function runEternitySaveMigrationModuleRuntimeTest() {
  await testLegacyDefaults();
  await testCurrentRoundTripAndSanitization();
  await testSaveCodeImportAndCheckpointRestore();
  await testEternityResetThenSaveLoad();
  console.log("Eternity save and migration module runtime tests passed");
}

module.exports = { runEternitySaveMigrationModuleRuntimeTest };
