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
  state.autoBuyInfinityUpgrades = true;
  state.achievementMaskHigh = ACHIEVEMENT_38_TO_41_MASK;
  state.timeFlux = 321;
  state.timeFluxCapacityLevel = 2;
  state.timeFluxGainLevel = 3;
  state.timeFluxSpeed = 5;
  state.timeFluxCustomSpeed = 6;
}

function assertPersistentFixture(state, runtime, messagePrefix) {
  assert.equal(state.eternityCount, 12, `${messagePrefix}: Eternity count should persist`);
  assert.equal(state.eternityMilestoneMask, 5, `${messagePrefix}: Milestone ownership should persist`);
  assert.equal(state.eternityMilestoneChoice, "1-2", `${messagePrefix}: legacy pending-choice data should remain safely readable`);
  assert.equal(state.autoBuyInfinityUpgrades, true, `${messagePrefix}: Infinity Upgrade automation should persist`);
  assert.equal(runtime.firstTierMilestoneEntitlementCount(), 1, `${messagePrefix}: entitlement should derive from count and ownership`);
  assert.deepEqual(Array.from(runtime.availableEternityMilestoneChoices()), ["1-2"], `${messagePrefix}: legacy pending-choice data must not consume the remaining entitlement`);
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
  delete legacy.state.autoBuyInfinityUpgrades;

  const loaded = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(legacy)]]));
  assert.equal(loaded.debug.state.eternityCount, 0, "legacy saves should default Eternity count to zero");
  assert.equal(loaded.debug.state.eternityMilestoneMask, 0, "legacy saves should default Milestone ownership to zero");
  assert.equal(loaded.debug.state.eternityMilestoneChoice, "", "legacy saves should default the retired pending-choice field to empty");
  assert.equal(loaded.runtime.firstTierMilestoneEntitlementCount(), 0, "legacy saves without Eternities must not receive an acquisition entitlement");
  assert.equal(loaded.debug.state.achievementMaskHigh, 0, "legacy saves should default the high achievement mask safely");
  assert.equal(loaded.debug.state.autoBuyInfinityUpgrades, false, "legacy saves should default Infinity Upgrade automation off");
  assert.equal(loaded.runtime.SAVE_VERSION, 11, "Milestone 1-3 free-level semantics should use save version 11");
}

async function testInfiniteAngleFreeLevelSaveMigration() {
  const source = await loadRuntime(candidatePath);
  const { runtime } = source;
  const baseSave = runtime.serializeSaveData();
  baseSave.savedAt = Date.now();
  baseSave.version = 10;
  baseSave.state.eternityMilestoneMask = 4;
  baseSave.state.infiniteAngleUnlocked = true;
  baseSave.state.infiniteAngleSpeedLevel = 5;
  baseSave.state.infiniteAngleVertexLevel = 8;
  baseSave.state.infiniteAngleGainLevel = 4;

  const migrated = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(baseSave)]]));
  assert.equal(migrated.debug.state.infiniteAngleSpeedLevel, 0, "v10 Lv5 should migrate to purchased IA Speed Lv0");
  assert.equal(migrated.debug.state.infiniteAngleVertexLevel, 3, "v10 Lv8 should migrate to purchased IA Vertex Lv3");
  assert.equal(migrated.debug.state.infiniteAngleGainLevel, 0, "v10 IA Gain below the free baseline should clamp to purchased Lv0");
  assert.equal(migrated.runtime.infiniteAngleEffectiveUpgradeLevel("speed"), 5, "v10 IA Speed effective level should be preserved");
  assert.equal(migrated.runtime.infiniteAngleEffectiveUpgradeLevel("vertex"), 8, "v10 IA Vertex effective level should be preserved");
  assert.equal(migrated.runtime.infiniteAngleEffectiveUpgradeLevel("gain"), 5, "v10 IA Gain effective level should clamp to the free baseline");

  const withoutMilestone = structuredClone(baseSave);
  withoutMilestone.state.eternityMilestoneMask = 0;
  withoutMilestone.state.infiniteAngleSpeedLevel = 5;
  withoutMilestone.state.infiniteAngleVertexLevel = 8;
  withoutMilestone.state.infiniteAngleGainLevel = 4;
  const preserved = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(withoutMilestone)]]));
  assert.equal(preserved.debug.state.infiniteAngleSpeedLevel, 5, "v10 saves without 1-3 must preserve IA Speed levels");
  assert.equal(preserved.debug.state.infiniteAngleVertexLevel, 8, "v10 saves without 1-3 must preserve IA Vertex levels");
  assert.equal(preserved.debug.state.infiniteAngleGainLevel, 4, "v10 saves without 1-3 must preserve IA Gain levels");
  assert.equal(preserved.runtime.infiniteAngleFreeUpgradeLevel("speed"), 0, "1-3-free migration must not apply without ownership");

  const currentVersionSave = structuredClone(baseSave);
  currentVersionSave.version = 11;
  currentVersionSave.state.infiniteAngleSpeedLevel = 0;
  currentVersionSave.state.infiniteAngleVertexLevel = 3;
  currentVersionSave.state.infiniteAngleGainLevel = 0;
  const loadedAgain = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(currentVersionSave)]]));
  assert.equal(loadedAgain.debug.state.infiniteAngleSpeedLevel, 0, "v11 IA Speed must not be migrated a second time");
  assert.equal(loadedAgain.debug.state.infiniteAngleVertexLevel, 3, "v11 IA Vertex must not be migrated a second time");
  assert.equal(loadedAgain.debug.state.infiniteAngleGainLevel, 0, "v11 IA Gain must not be migrated a second time");
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
  assertPersistentFixture(loaded.debug.state, loaded.runtime, "current save round-trip");
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
  assert.equal(loaded.debug.state.eternityMilestoneChoice, "", "invalid legacy pending choices should hydrate to empty");
  assert.equal(loaded.runtime.firstTierMilestoneEntitlementCount(), 0, "fully owned first-tier Milestones must not expose extra entitlement");
}

async function testSaveCodeImportAndCheckpointRestore() {
  const instance = await loadRuntime(candidatePath);
  const { context, debug, runtime } = instance;
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
  assertPersistentFixture(debug.state, runtime, "save-code import");

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
  assertPersistentFixture(debug.state, runtime, "checkpoint recovery");
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

  assert.equal(debug.performEternity({ save: false, update: false }), true, "a fully qualified manual Eternity should execute");
  assert.equal(state.eternityCount, 3, "successful Eternity should increment the count exactly once");
  assert.equal(state.eternityMilestoneMask, 1, "legacy pending choice must not be auto-acquired by Eternity");
  assert.equal(state.eternityMilestoneChoice, "", "manual Eternity should clear obsolete pending-choice state");
  assert.equal(runtime.firstTierMilestoneEntitlementCount(), 2, "count 3 with only one owned first-tier Milestone should retain two acquisitions");
  assert.deepEqual(Array.from(runtime.availableEternityMilestoneChoices()), ["1-2", "1-3"], "unused first-tier acquisition rights should remain available after Eternity");
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
  assert.equal(loaded.debug.state.eternityMilestoneMask, 1, "post-Eternity save/load should retain acquired Milestones only");
  assert.equal(loaded.debug.state.eternityMilestoneChoice, "", "post-Eternity save/load should not resurrect obsolete pending-choice state");
  assert.equal(loaded.runtime.firstTierMilestoneEntitlementCount(), 2, "unused derived acquisition entitlement should survive save/load");
  assert.equal(loaded.debug.state.completedTowerChallenges, 0, "post-Eternity save/load must not resurrect TC completion");
  assert.equal(loaded.debug.state.tc4BaseGainLevel, 0, "post-Eternity save/load must not resurrect TC4 local progression");
  assert.equal(loaded.debug.state.achievementMaskHigh & ACHIEVEMENT_38_TO_41_MASK, ACHIEVEMENT_38_TO_41_MASK, "post-Eternity save/load should retain Achievements 38-41");
  assert.equal(loaded.debug.state.timeFlux, 444, "post-Eternity save/load should retain global Time Flux");

  assert.equal(loaded.runtime.selectEternityMilestone("1-2"), true, "a saved unused entitlement should acquire a first-tier Milestone after reload");
  assert.equal(loaded.debug.state.eternityMilestoneMask, 3, "post-load acquisition should add exactly the selected Milestone");
  assert.equal(loaded.runtime.firstTierMilestoneEntitlementCount(), 1, "one unused acquisition should remain after buying 1-2");

  markEternityReady(loaded.runtime, loaded.debug.state);
  assert.equal(loaded.debug.performEternity({ save: false, update: false }), true, "a later manual Eternity should still execute after reload");
  assert.equal(loaded.debug.state.eternityCount, 4, "the later Eternity should increment exactly once");
  assert.equal(loaded.debug.state.eternityMilestoneMask, 3, "a later Eternity must not auto-acquire the remaining first-tier Milestone");
  assert.equal(loaded.runtime.firstTierMilestoneEntitlementCount(), 1, "the cap of three earned first-tier slots should leave exactly one acquisition available");
}

async function testMainTabDiscoveryMigration() {
  const source = await loadRuntime(candidatePath);
  const { runtime } = source;
  const baseSave = runtime.serializeSaveData();
  const challengeUpgrade = runtime.INFINITY_UPGRADES.find((upgrade) => upgrade.id === "4-1");
  const normalAutomationUpgrade = runtime.INFINITY_UPGRADES.find((upgrade) => upgrade.id === "1-2");

  const legacySave = (overrides) => {
    const save = structuredClone(baseSave);
    delete save.state.unlockedMainTabs;
    Object.assign(save.state, overrides);
    save.savedAt = Date.now();
    return save;
  };
  const loadLegacy = (overrides) => loadRuntime(
    candidatePath,
    new Map([[runtime.SAVE_KEY, JSON.stringify(legacySave(overrides))]]),
  );

  const postEternity = await loadLegacy({ eternityCount: 1, infinityCount: 0, towerFloor: 0 });
  assert.deepEqual(
    Array.from(postEternity.debug.state.unlockedMainTabs),
    ["infinity", "challenges", "automation", "eternity"],
    "legacy saves with Eternity progress should retain every already-discovered progression tab",
  );

  const infinity = await loadLegacy({ infinityCount: 1, eternityCount: 0 });
  assert.deepEqual(Array.from(infinity.debug.state.unlockedMainTabs), ["infinity"], "current Infinity count should migrate INF discovery");

  const challenges = await loadLegacy({
    infinityCount: 0,
    eternityCount: 0,
    infinityUpgradeMask: 1 << challengeUpgrade.bit,
  });
  assert.deepEqual(Array.from(challenges.debug.state.unlockedMainTabs), ["challenges"], "IU 4-1 ownership should migrate CHAL discovery");

  const automation = await loadLegacy({
    infinityCount: 0,
    eternityCount: 0,
    infinityUpgradeMask: 1 << normalAutomationUpgrade.bit,
  });
  assert.deepEqual(Array.from(automation.debug.state.unlockedMainTabs), ["automation"], "IU 1-2 ownership should migrate AUTO discovery");

  const achievementAutomation = await loadLegacy({
    infinityCount: 0,
    eternityCount: 0,
    achievementMask: 1 << (19 - 1),
  });
  assert.deepEqual(Array.from(achievementAutomation.debug.state.unlockedMainTabs), ["automation"], "Achievement 19 should migrate AUTO discovery");

  const eternity = await loadLegacy({ infinityCount: 0, eternityCount: 0, towerFloor: 12 });
  assert.deepEqual(Array.from(eternity.debug.state.unlockedMainTabs), ["eternity"], "Tower Floor 12 should migrate ETR discovery");

  const normalized = await loadLegacy({
    infinityCount: 0,
    eternityCount: 0,
    towerFloor: 0,
    unlockedMainTabs: ["eternity", "unknown", "automation", "automation", "settings"],
    hiddenTabs: ["eternity"],
  });
  assert.deepEqual(Array.from(normalized.debug.state.unlockedMainTabs), ["automation", "eternity"], "discovery migration should discard unknown and duplicate tab IDs");
  assert.equal(normalized.debug.mainTabIsUnlocked("eternity"), true, "normalized ETR discovery should remain authoritative");
  assert.equal(normalized.debug.mainTabIsVisible("eternity"), false, "migration must preserve hiddenTabs independently of discovery");

  const roundTrip = await loadRuntime(candidatePath);
  roundTrip.debug.state.unlockedMainTabs = ["infinity", "eternity"];
  const serialized = roundTrip.runtime.serializeSaveData();
  assert.deepEqual(Array.from(serialized.state.unlockedMainTabs), ["infinity", "eternity"], "save serialization should preserve normalized discovery history");
  const reloaded = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(serialized)]]));
  assert.deepEqual(Array.from(reloaded.debug.state.unlockedMainTabs), ["infinity", "eternity"], "save/load should preserve discovery history");
}

async function runEternitySaveMigrationModuleRuntimeTest() {
  await testLegacyDefaults();
  await testInfiniteAngleFreeLevelSaveMigration();
  await testCurrentRoundTripAndSanitization();
  await testSaveCodeImportAndCheckpointRestore();
  await testEternityResetThenSaveLoad();
  await testMainTabDiscoveryMigration();
  console.log("Eternity save and migration module runtime tests passed");
}

module.exports = { runEternitySaveMigrationModuleRuntimeTest };
