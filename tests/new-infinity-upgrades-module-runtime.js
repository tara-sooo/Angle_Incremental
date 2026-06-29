const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

function setLogResource(state, key, log) {
  state[`${key}Log10`] = log;
  state[key] = log <= 308 ? 10 ** log : Number.MAX_VALUE;
}

function purchasedMaskThrough(bit) {
  return (1 << (bit + 1)) - 1;
}

function prepareGenerationAutomationScenario(instance, { generationScoreLog10 = 20, runSeconds = 0 } = {}) {
  const { state } = instance.debug;
  state.infinityUpgradeMask = purchasedMaskThrough(12);
  state.automationEnabled = true;
  state.autoRunGeneration = true;
  state.generationCount = 1;
  state.previousGenerationScoreLog10 = 6;
  state.previousGenerationScore = 1e6;
  setLogResource(state, "generationScore", generationScoreLog10);
  state.generationScoreMultiplierLog10 = 0;
  state.generationScoreMultiplier = 1;
  state.generationCostFactor = 1;
  state.currentGenerationRunTime = runSeconds;
}

async function runNewInfinityUpgradesModuleRuntimeTest() {
  {
    const { runtime } = await loadRuntime(candidatePath);
    const byId = new Map(runtime.INFINITY_UPGRADES.map((upgrade) => [upgrade.id, upgrade]));

    assert.equal(byId.get("8-1")?.cost, 200, "IU 8-1 must cost 200 IP");
    assert.deepEqual(Array.from(byId.get("8-1")?.requires || []), ["7-1", "7-2"], "IU 8-1 must require both tier 7 upgrades");
    assert.equal(byId.get("9-1")?.cost, 200, "IU 9-1 must cost 200 IP");
    assert.deepEqual(Array.from(byId.get("9-1")?.requires || []), ["8-1"], "IU 9-1 must require IU 8-1");
    assert.equal(byId.get("10-1")?.cost, 3000, "IU 10-1 must cost 3000 IP");
    assert.deepEqual(Array.from(byId.get("10-1")?.requires || []), ["9-1"], "IU 10-1 must require IU 9-1");
    assert.equal(byId.get("10-2")?.cost, 7000, "IU 10-2 must cost 7000 IP");
    assert.deepEqual(Array.from(byId.get("10-2")?.requires || []), ["9-1"], "IU 10-2 must require IU 9-1");
    assert.equal(byId.get("11-1")?.cost, 50000, "IU 11-1 must cost 50000 IP");
    assert.deepEqual(Array.from(byId.get("11-1")?.requires || []), ["10-1", "10-2"], "IU 11-1 must require both tier 10 upgrades");
    assert.equal(byId.get("11-2")?.cost, 100000, "IU 11-2 must cost 100000 IP");
    assert.deepEqual(Array.from(byId.get("11-2")?.requires || []), ["10-1", "10-2"], "IU 11-2 must require both tier 10 upgrades");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityUpgradeMask = purchasedMaskThrough(11);
    state.infinityPoints = 200;
    state.infinityPointsLog10 = Math.log10(200);
    assert.equal(debug.buyInfinityUpgrade("8-1"), true, "tier 8 automation upgrade must be purchasable after tier 7");
    assert.equal((state.infinityUpgradeMask & (1 << 12)) !== 0, true, "IU 8-1 purchase bit must be set");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityCount = 1;
    setLogResource(state, "score", 310);
    state.infiniteCapBroken = false;
    assert.equal(runtime.infinityPointGain(), 3, "pre-9-1 formula must remain log10(score)-307");
    state.infinityUpgradeMask = purchasedMaskThrough(13);
    assert.equal(
      runtime.infinityPointGain(),
      Math.max(1, Math.floor(310 / Math.log10(7) - 307)),
      "IU 9-1 must use log7(score)-307 before Break Infinite Cap",
    );
    state.infiniteCapBroken = true;
    assert.equal(
      runtime.infinityPointGain(),
      Math.max(1, Math.floor(310 / Math.log10(2) - 307)),
      "IU 9-1 must not replace the post-break log2 formula",
    );
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityUpgradeMask = purchasedMaskThrough(13);
    state.infinityPoints = 3000;
    state.infinityPointsLog10 = Math.log10(3000);
    state.coreBoostCount = 0;
    assert.equal(debug.buyInfinityUpgrade("10-1"), true, "IU 10-1 must be purchasable with 3000 IP and IU 9-1");
    assert.equal(state.coreBoostCount, 2, "buying IU 10-1 must grant the two starting Core Boosts immediately");
    runtime.resetBelowInfinity();
    assert.equal(state.coreBoostCount, 2, "Infinity resets must preserve the IU 10-1 Core Boost floor");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityUpgradeMask = purchasedMaskThrough(14);
    state.infinityCount = 1;
    state.coreBoostCount = 2;
    runtime.toggleInfinityChallenge(5);
    assert.equal(state.activeChallenge, 5, "IC5 must start when Infinity Challenges and IU 10-1 are unlocked");
    assert.equal(state.coreBoostCount, 0, "IC5 must suppress IU 10-1 starting Core Boosts");
    runtime.toggleInfinityChallenge(5);
    assert.equal(state.activeChallenge, 0, "toggling IC5 again must leave the challenge");
    assert.equal(state.coreBoostCount, 2, "leaving IC5 must restore the IU 10-1 starting Core Boost floor");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    setLogResource(state, "score", 10);
    state.infinityUpgradeMask = purchasedMaskThrough(15);
    assert.equal(runtime.currentScoreLog10(), 12, "IU 10-2 must expose current score as score^1.2");
    assert.equal(runtime.canSpendLog(11), true, "IU 10-2 effective score must be spendable");
    assert.equal(runtime.spendLog(11), true, "spending must work against IU 10-2 effective score");
    assert.ok(
      runtime.currentScoreLog10() < 12 && runtime.currentScoreLog10() > 10.9,
      "spending effective score must convert the remaining balance back to raw stored score",
    );
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    setLogResource(state, "score", 2);
    state.infinityUpgradeMask = purchasedMaskThrough(15);
    assert.notEqual(runtime.scoreDisplay(), runtime.formatNumber(100), "IU 10-2 small score display must not show raw score");
    assert.equal(
      runtime.scoreDisplay(),
      runtime.formatNumber(runtime.valueFromLog10(2.4)),
      "IU 10-2 small score display must use the exponentiated effective score",
    );
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityUpgradeMask = purchasedMaskThrough(15);
    state.infinityPoints = 50000;
    state.infinityPointsLog10 = Math.log10(50000);
    assert.equal(debug.buyInfinityUpgrade("11-1"), true, "IU 11-1 must be purchasable after both tier 10 upgrades");
    state.infinityPoints = 100000;
    state.infinityPointsLog10 = Math.log10(100000);
    assert.equal(debug.buyInfinityUpgrade("11-2"), true, "IU 11-2 must be purchasable after both tier 10 upgrades");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityUpgradeMask = purchasedMaskThrough(16);

    setLogResource(state, "infinityPoints", Math.log10(99999));
    assert.equal(runtime.sponsoredNormalUpgradeBonusLevel(), 999, "IU 11-1 bonus should grant one level per 100 IP before the softcap");
    setLogResource(state, "infinityPoints", Math.log10(100000));
    assert.equal(runtime.sponsoredNormalUpgradeBonusLevel(), 1000, "IU 11-1 bonus should reach 1000 levels at 100000 IP");
    setLogResource(state, "infinityPoints", Math.log10(1000000));
    assert.equal(runtime.sponsoredNormalUpgradeBonusLevel(), 1010, "IU 11-1 bonus should use strong log scaling after 100000 IP");
    setLogResource(state, "infinityPoints", Math.log10(20000000));
    assert.equal(runtime.sponsoredNormalUpgradeBonusLevel(), 1023, "IU 11-1 bonus should stay tightly capped at the hotfix IP limit");
    setLogResource(state, "infinityPoints", Math.log10(100000000));
    assert.equal(runtime.sponsoredNormalUpgradeBonusLevel(), 1023, "IU 11-1 bonus should use the hotfix IP cap before calculating bonus levels");
    setLogResource(state, "infinityPoints", Math.log10(1000000));

    state.speedLevel = 10;
    state.vertices = 20;
    state.gainLevel = 30;
    assert.equal(runtime.effectiveSpeedLevel(), 1020, "IU 11-1 should add bonus levels to lap-speed upgrades");
    assert.equal(runtime.effectiveVertexCount(), 1030, "IU 11-1 should add bonus levels to effective vertices");
    assert.equal(runtime.effectiveGainLevel(), 1040, "IU 11-1 should add bonus levels to gain upgrades");

    const speedCost = runtime.costLog10("speed", 5, state.speedLevel, 1.55);
    const vertexCost = runtime.costLog10("vertex", 12, state.vertices - 3, 1.72);
    const gainCost = runtime.costLog10("gain", 18, state.gainLevel, 1.68);
    const costs = runtime.costLogs();
    assert.equal(costs.speed, speedCost, "IU 11-1 bonus levels must not increase speed upgrade costs");
    assert.equal(costs.vertex, vertexCost, "IU 11-1 bonus levels must not increase vertex upgrade costs");
    assert.equal(costs.gain, gainCost, "IU 11-1 bonus levels must not increase gain upgrade costs");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime, debug, storage } = instance;
    const { state } = debug;
    const capLog = Math.log10(20000000);

    runtime.applySaveData({
      infinityPoints: 17000000,
      infinityPointsLog10: Math.log10(17000000),
    }, 7);
    assert.equal(state.infinityPoints, 17000000, "legitimate reported IP below the hotfix cap must not be reduced");
    assert.equal(state.infinityPointsLog10, Math.log10(17000000), "legitimate reported IP log below the hotfix cap must not be reduced");

    runtime.applySaveData({
      infinityPoints: 20000000,
      infinityPointsLog10: capLog,
    }, 7);
    assert.equal(state.infinityPoints, 20000000, "the hotfix IP cap itself must be preserved exactly");
    assert.equal(state.infinityPointsLog10, capLog, "the hotfix IP cap log must be preserved exactly");

    runtime.applySaveData({
      infinityPoints: Number.MAX_VALUE,
      infinityPointsLog10: 30,
    }, 7);
    assert.equal(state.infinityPoints, 20000000, "excessive finite IP saves must be capped at 20000000 IP");
    assert.equal(state.infinityPointsLog10, capLog, "excessive finite IP logs must be capped at 20000000 IP");

    runtime.applySaveData({
      infinityPoints: Number.MAX_VALUE,
      infinityPointsLog10: Infinity,
      infinityCount: 1000000,
    }, 7);
    assert.equal(state.infinityPoints, 20000000, "overflow IP saves must recover to the hotfix IP cap");
    assert.equal(state.infinityPointsLog10, capLog, "overflow IP logs must recover to the hotfix IP cap");
    assert.equal(state.infinityCount, 30000, "overflow Infinity count saves must recover to the hotfix Infinity cap");

    state.infinityPoints = Number.MAX_VALUE;
    state.infinityPointsLog10 = 30;
    state.infinityCount = 1000000;
    assert.equal(debug.saveGame("manual"), true, "saving an excessive IP balance should succeed");
    const saved = JSON.parse(storage.get(runtime.SAVE_KEY));
    assert.equal(saved.state.infinityPoints, 20000000, "saved excessive IP balances must be persisted at the hotfix cap");
    assert.equal(saved.state.infinityPointsLog10, capLog, "saved excessive IP logs must be persisted at the hotfix cap");
    assert.equal(saved.state.infinityCount, 30000, "saved excessive Infinity counts must be persisted at the hotfix cap");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityUpgradeMask = purchasedMaskThrough(16);
    state.infinityCount = 1;
    setLogResource(state, "infinityPoints", Math.log10(1000000));
    state.vertices = 20;
    runtime.toggleInfinityChallenge(2);
    assert.equal(state.activeChallenge, 2, "IC2 should start for the effective vertex cap scenario");
    assert.equal(runtime.effectiveVertexCount(), 200, "IC2 must cap IU 11-1 effective vertices at 200");
    assert.equal(runtime.canBuyNormalUpgrade("vertex"), false, "IC2 must prevent vertex purchases once effective vertices are capped at 200");

    runtime.toggleInfinityChallenge(2);
    runtime.toggleInfinityChallenge(8);
    assert.equal(state.activeChallenge, 8, "IC8 should start for the effective vertex lock scenario");
    assert.equal(runtime.effectiveVertexCount(), 3, "IC8 must ignore IU 11-1 vertex bonuses and keep 3 effective vertices");
    assert.equal(runtime.canBuyNormalUpgrade("vertex"), false, "IC8 must keep vertex purchases disabled");
    assert.equal(runtime.effectiveSpeedLevel(), state.speedLevel + 1010, "IC8 should still keep IU 11-1 speed bonus levels");
    assert.equal(runtime.effectiveGainLevel(), state.gainLevel + 1010, "IC8 should still keep IU 11-1 gain bonus levels");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityUpgradeMask = 1 << 0;
    state.infinityCount = 1000;
    const legacy = runtime.vertexGainIncrease();
    state.infinityUpgradeMask = (1 << 0) | (1 << 17);
    const revised = runtime.vertexGainIncrease();
    assert.ok(legacy > revised, "IU 11-2 should replace the old IU 1-1 formula instead of multiplying on top of it");
    assert.ok(
      Math.abs(revised / legacy - (Math.pow(1.005, 1000) / 1001)) < 1e-10,
      "IU 11-2 should change IU 1-1 from Infinity+1 to 1.005^Infinity",
    );
    state.infinityCount = 10000;
    assert.equal(runtime.iu11_2EffectiveInfinityCount(), 10000, "IU 11-2 should not softcap before 10000 Infinity");
    const atSoftcapStart = runtime.vertexGainIncrease();
    state.infinityCount = 1000000;
    assert.ok(
      Math.abs(runtime.iu11_2EffectiveInfinityCount() - (10000 + Math.log10(20001))) < 1e-12,
      "IU 11-2 should strongly softcap Infinity counts above 10000 after the hotfix Infinity cap",
    );
    const farAfterSoftcap = runtime.vertexGainIncrease();
    assert.ok(farAfterSoftcap > atSoftcapStart, "IU 11-2 softcap should remain monotonic");
    assert.ok(farAfterSoftcap / atSoftcapStart < 1.03, "IU 11-2 should barely grow after the 10000 Infinity softcap");
    assert.equal(Number.isFinite(farAfterSoftcap), true, "IU 11-2 softcapped multiplier must stay finite");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityUpgradeMask = purchasedMaskThrough(12);
    state.automationEnabled = true;
    state.autoRunInfinity = true;
    state.autoInfinityPointThreshold = 10;
    state.infinityCount = 1;
    setLogResource(state, "score", 320);
    assert.equal(runtime.runLayerAutomation(), true, "IU 8-1 must expose and run layer automation");
    assert.equal(state.infinityCount > 1, true, "layer automation must run Infinity when the IP threshold is met");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    runtime.applySaveData({
      autoGenerationMode: "or",
      autoGenerationScoreThreshold: 10,
      autoGenerationCostThreshold: 1,
    }, 7);
    assert.equal(
      state.autoGenerationScoreMultiplierThreshold,
      1.1,
      "old percent score threshold saves must migrate to the equivalent multiplier threshold",
    );
    assert.ok(
      Math.abs(state.autoGenerationCostMultiplierThreshold - (1 / 0.99)) < 1e-12,
      "old OR percent cost threshold saves must keep the equivalent cost improvement multiplier",
    );
    assert.equal(state.autoGenerationLegacyOrMode, true, "old OR automation saves must preserve OR trigger semantics");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    runtime.applySaveData({
      autoGenerationMode: "and",
      autoGenerationScoreThreshold: 10,
      autoGenerationCostThreshold: 1,
    }, 7);
    assert.equal(
      state.autoGenerationScoreMultiplierThreshold,
      1.1,
      "old AND percent score threshold saves must migrate to the equivalent multiplier threshold",
    );
    assert.ok(
      Math.abs(state.autoGenerationCostMultiplierThreshold - (1 / 0.99)) < 1e-12,
      "old AND percent cost threshold saves must migrate to the equivalent cost improvement multiplier",
    );
    assert.equal(state.autoGenerationLegacyOrMode, false, "old AND automation saves must use the new all-active-gates behavior");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime } = instance;
    runtime.applySaveData({
      autoGenerationMode: "or",
      autoGenerationScoreThreshold: 100000000000,
      autoGenerationCostThreshold: 1,
    }, 7);
    prepareGenerationAutomationScenario(instance);
    assert.equal(runtime.shouldAutoRunGeneration(), true, "legacy OR automation must still trigger from cost improvement alone");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime } = instance;
    runtime.applySaveData({
      autoGenerationMode: "or",
      autoGenerationScoreThreshold: 10,
      autoGenerationCostThreshold: 90,
    }, 7);
    prepareGenerationAutomationScenario(instance);
    assert.equal(runtime.shouldAutoRunGeneration(), true, "legacy OR automation must still trigger from score improvement alone");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    runtime.applySaveData({
      autoGenerationMode: "or",
      autoGenerationScoreThreshold: 10,
      autoGenerationCostThreshold: 1,
    }, 7);
    runtime.applySetting("autoGenerationScoreMultiplierThreshold", 2);
    assert.equal(state.autoGenerationLegacyOrMode, false, "editing a new GR automation threshold must leave legacy OR mode");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime } = instance;
    prepareGenerationAutomationScenario(instance);

    runtime.state.autoGenerationScoreMultiplierThreshold = 10;
    runtime.state.autoGenerationCostMultiplierThreshold = 0;
    runtime.state.autoGenerationMinimumSeconds = 0;
    assert.equal(runtime.shouldAutoRunGeneration(), true, "a score multiplier threshold alone should trigger GR when met");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime } = instance;
    prepareGenerationAutomationScenario(instance, { runSeconds: 29 });

    runtime.state.autoGenerationScoreMultiplierThreshold = 0;
    runtime.state.autoGenerationCostMultiplierThreshold = 0;
    runtime.state.autoGenerationMinimumSeconds = 30;
    assert.equal(runtime.shouldAutoRunGeneration(), false, "time-only GR automation must wait for the configured seconds");
    runtime.state.currentGenerationRunTime = 30;
    assert.equal(runtime.shouldAutoRunGeneration(), true, "time-only GR automation must trigger once the configured seconds pass");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime } = instance;
    prepareGenerationAutomationScenario(instance, { runSeconds: 59 });

    runtime.state.autoGenerationScoreMultiplierThreshold = 10;
    runtime.state.autoGenerationCostMultiplierThreshold = 0;
    runtime.state.autoGenerationMinimumSeconds = 60;
    assert.equal(runtime.shouldAutoRunGeneration(), false, "active GR automation conditions must all be met");
    runtime.state.currentGenerationRunTime = 60;
    assert.equal(runtime.shouldAutoRunGeneration(), true, "GR automation must trigger after all active conditions are met");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime } = instance;
    prepareGenerationAutomationScenario(instance);

    runtime.state.autoGenerationScoreMultiplierThreshold = 0;
    runtime.state.autoGenerationCostMultiplierThreshold = 0;
    runtime.state.autoGenerationMinimumSeconds = 0;
    assert.equal(runtime.shouldAutoRunGeneration(), true, "zero GR automation thresholds must disable all threshold gates");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime, debug } = instance;
    const { state } = debug;
    prepareGenerationAutomationScenario(instance, { runSeconds: 42 });
    state.autoRunGeneration = false;

    debug.update(1.5);
    assert.ok(state.currentGenerationRunTime > 43, "current Generation run time must advance with game time");
    debug.runGeneration();
    assert.equal(state.currentGenerationRunTime, 0, "running Generation must reset the Generation automation timer");
  }
}

module.exports = { runNewInfinityUpgradesModuleRuntimeTest };
