const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

function setLogResource(state, key, log) {
  state[`${key}Log10`] = log;
  state[key] = log <= 308 ? 10 ** log : Number.MAX_VALUE;
  if (key === "infinityPoints") state.infinityPointsExact = state[key].toFixed(0);
}

function purchasedMaskThrough(bit) {
  return (1 << (bit + 1)) - 1;
}

function assertNearlyEqual(actual, expected, message, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
}

function prepareGenerationAutomationScenario(instance, { generationScoreLog10 = 20, runSeconds = 0 } = {}) {
  const { state } = instance.debug;
  state.automationEnabled = true;
  state.autoRunGeneration = true;
  state.achievementMask = 1 << (19 - 1);
  state.generationCount = 1;
  state.previousGenerationScoreLog10 = 6;
  state.previousGenerationScore = 1e6;
  setLogResource(state, "generationScore", generationScoreLog10);
  state.generationScoreMultiplierLog10 = 0;
  state.generationScoreMultiplier = 1;
  state.generationCostFactor = 1;
  state.currentGenerationRunTime = runSeconds;
}

function shallowGenerationScoreBonus(generationScoreLog10) {
  const depth = Math.max(0, generationScoreLog10 - Math.log10(1_000_000));
  return 0.60 * (1 - Math.exp(-depth / 4));
}

async function runNewInfinityUpgradesModuleRuntimeTest() {
  {
    const { runtime } = await loadRuntime(candidatePath);
    const byId = new Map(runtime.INFINITY_UPGRADES.map((upgrade) => [upgrade.id, upgrade]));

    assert.equal(byId.get("8-1")?.cost, 200, "IU 8-1 must cost 200 IP");
    assert.deepEqual(Array.from(byId.get("8-1")?.requires || []), ["7-1", "7-2"], "IU 8-1 must require both tier 7 upgrades");
    assert.equal(byId.get("8-1")?.name.ja, "8-1 無限に無限周回", "IU 8-1 Japanese name must describe Infinity automation");
    assert.equal(byId.get("8-1")?.effect.ja, "Infinityの自動化を解放する", "IU 8-1 Japanese effect must only mention Infinity automation");
    assert.equal(byId.get("9-1")?.cost, 200, "IU 9-1 must cost 200 IP");
    assert.deepEqual(Array.from(byId.get("9-1")?.requires || []), ["8-1"], "IU 9-1 must require IU 8-1");
    assert.equal(byId.get("10-1")?.cost, 12000, "IU 10-1 must cost 12000 IP");
    assert.deepEqual(Array.from(byId.get("10-1")?.requires || []), ["9-1"], "IU 10-1 must require IU 9-1");
    assert.equal(byId.get("10-2")?.cost, 28000, "IU 10-2 must cost 28000 IP");
    assert.deepEqual(Array.from(byId.get("10-2")?.requires || []), ["9-1"], "IU 10-2 must require IU 9-1");
    assert.equal(byId.get("11-1")?.cost, 200000, "IU 11-1 must cost 200000 IP");
    assert.deepEqual(Array.from(byId.get("11-1")?.requires || []), ["10-1", "10-2"], "IU 11-1 must require both tier 10 upgrades");
    assert.equal(byId.get("11-2")?.cost, 400000, "IU 11-2 must cost 400000 IP");
    assert.deepEqual(Array.from(byId.get("11-2")?.requires || []), ["10-1", "10-2"], "IU 11-2 must require both tier 10 upgrades");
    assert.equal(byId.get("12-1")?.bit, 18, "IU 12-1 must use bit 18");
    assert.equal(byId.get("12-1")?.cost, 6660000, "IU 12-1 must cost 6.66e6 IP");
    assert.deepEqual(Array.from(byId.get("12-1")?.requires || []), ["11-1", "11-2"], "IU 12-1 must require both tier 11 upgrades");
    assert.equal(byId.get("12-1")?.name.ja, "12-1 ゴールデンヘル", "IU 12-1 Japanese name must match the new upgrade");
    assert.match(byId.get("12-1")?.effect.en || "", /multiplicatively/, "IU 12-1 English effect must describe multiplicative Core Boost effects");
    assert.equal(byId.get("13-1")?.bit, 19, "IU 13-1 must use bit 19");
    assert.equal(byId.get("13-1")?.cost, 1e51, "IU 13-1 must cost 1e51 IP");
    assert.deepEqual(Array.from(byId.get("13-1")?.requires || []), ["12-1"], "IU 13-1 must require IU 12-1");
    assert.equal(byId.get("13-1")?.name.ja, "13-1 久々にここを見たなら", "IU 13-1 Japanese name must match the new upgrade");
    assert.equal(byId.get("14-1")?.bit, 20, "IU 14-1 must use bit 20");
    assert.equal(byId.get("14-1")?.cost, 1e80, "IU 14-1 must cost 1e80 IP");
    assert.deepEqual(Array.from(byId.get("14-1")?.requires || []), ["13-1"], "IU 14-1 must require IU 13-1");
    assert.equal(byId.get("14-1")?.name.ja, "14-1 ペナルティは遅れてやってくる", "IU 14-1 Japanese name must match the new upgrade");
    assert.equal(byId.get("14-1")?.name.en, "14-1 The Penalty Comes Later", "IU 14-1 English name must match the new upgrade");
    assert.equal(byId.get("14-1")?.effect.ja, "IU11-2のハードキャップを×3遅らせる", "IU 14-1 Japanese effect must describe the delayed hard cap");
    assert.equal(byId.get("14-1")?.effect.en, "Delays IU 11-2's hard cap by x3.", "IU 14-1 English effect must describe the delayed hard cap");
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
    state.language = "en";
    state.infiniteCapBroken = true;

    runtime.updateUi();

    assert.equal(runtime.elements.breakCapRequirement.textContent, "Cap broken", "Break Infinite Cap status must use English text when English is selected");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    const scoreLog10 = 20;

    assert.notEqual(
      runtime.generationRewardForLog(scoreLog10).scoreMultiplierLog10,
      scoreLog10 * 0.014 + shallowGenerationScoreBonus(scoreLog10),
      "IC8's revised GR formula must not apply before IC8 is completed",
    );

    state.completedChallenges = 1 << (8 - 1);
    assert.equal(
      runtime.generationRewardForLog(scoreLog10).scoreMultiplierLog10,
      scoreLog10 * 0.014 + shallowGenerationScoreBonus(scoreLog10),
      "IC8 completion must switch the GR score multiplier formula",
    );
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityCount = 1;
    state.completedChallenges = 1 << (8 - 1);
    setLogResource(state, "score", 400);

    state.generationScoreMultiplierLog10 = 1;
    state.generationScoreMultiplier = 10;
    assert.equal(
      runtime.infinityPointGain(),
      Math.max(1, Math.floor(400 - 307)),
      "IC8 GR-derived IP multiplier must not reduce IP below the base gain",
    );

    state.generationScoreMultiplierLog10 = 11;
    state.generationScoreMultiplier = 1e11;
    assert.equal(
      runtime.infinityPointGain(),
      Math.floor(Math.max(1, Math.floor(400 - 307)) * 100),
      "IC8 GR-derived IP multiplier must apply the effective score multiplier divided by 1e20",
    );

    state.generationScoreMultiplierLog10 = 310;
    state.generationScoreMultiplier = Number.MAX_VALUE;
    const hugeGainLog10 = runtime.infinityPointGainLog10();
    assert.equal(
      runtime.infinityPointGain(),
      Number.MAX_VALUE,
      "IC8 GR-derived IP multiplier must clamp huge IP gains to a finite value",
    );
    assert.ok(
      hugeGainLog10 > Math.log10(Number.MAX_VALUE),
      "IC8 GR-derived IP gain log must retain the true value above the Number cap",
    );
    assert.doesNotThrow(
      () => debug.runInfinity(),
      "huge finite IC8 IP gains must not crash Infinity reward payout",
    );
    assert.equal(
      state.lastInfinityRuns[0].ipGainLog10,
      hugeGainLog10,
      "Infinity history must retain an overflowing IP gain log",
    );
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityUpgradeMask = purchasedMaskThrough(13);
    setLogResource(state, "infinityPoints", Math.log10(12000));
    state.coreBoostCount = 0;
    assert.equal(debug.buyInfinityUpgrade("10-1"), true, "IU 10-1 must be purchasable with 12000 IP and IU 9-1");
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
    setLogResource(state, "infinityPoints", Math.log10(200000));
    assert.equal(debug.buyInfinityUpgrade("11-1"), true, "IU 11-1 must be purchasable after both tier 10 upgrades");
    setLogResource(state, "infinityPoints", Math.log10(400000));
    assert.equal(debug.buyInfinityUpgrade("11-2"), true, "IU 11-2 must be purchasable after both tier 10 upgrades");
    setLogResource(state, "infinityPoints", Math.log10(6660000));
    assert.equal(debug.buyInfinityUpgrade("12-1"), true, "IU 12-1 must be purchasable after both tier 11 upgrades");
    assert.equal((state.infinityUpgradeMask & (1 << 18)) !== 0, true, "IU 12-1 purchase bit must be set");
    setLogResource(state, "infinityPoints", 51);
    assert.equal(debug.buyInfinityUpgrade("13-1"), true, "IU 13-1 must be purchasable after IU 12-1");
    assert.equal((state.infinityUpgradeMask & (1 << 19)) !== 0, true, "IU 13-1 purchase bit must be set");
  }

  {
    const { debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityUpgradeMask = purchasedMaskThrough(19);
    state.infinityPointsExact = "9".repeat(80);
    state.infinityPoints = Number.MAX_VALUE;
    state.infinityPointsLog10 = 80;
    assert.equal(debug.buyInfinityUpgrade("14-1"), false, "IU 14-1 must reject an IP balance just below 1e80");
    assert.equal((state.infinityUpgradeMask & (1 << 20)) !== 0, false, "a rejected IU 14-1 purchase must not set its bit");

    state.infinityPointsExact = `1${"0".repeat(80)}`;
    state.infinityPoints = Number.MAX_VALUE;
    state.infinityPointsLog10 = 80;
    assert.equal(debug.buyInfinityUpgrade("14-1"), true, "IU 14-1 must be purchasable at exactly 1e80 IP");
    assert.equal((state.infinityUpgradeMask & (1 << 20)) !== 0, true, "IU 14-1 purchase bit must be set");
    assert.equal(state.infinityPointsExact, "0", "purchasing IU 14-1 must spend exactly 1e80 IP");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityUpgradeMask = purchasedMaskThrough(16);

    setLogResource(state, "infinityPoints", Math.log10(1999));
    assert.equal(runtime.sponsoredNormalUpgradeBonusLevel(), 0, "IU 11-1 bonus should not grant levels before 2000 IP");
    setLogResource(state, "infinityPoints", Math.log10(2000));
    assert.equal(runtime.sponsoredNormalUpgradeBonusLevel(), 1, "IU 11-1 bonus should grant one level per 2000 IP");
    setLogResource(state, "infinityPoints", Math.log10(99999));
    assert.equal(runtime.sponsoredNormalUpgradeBonusLevel(), 49, "IU 11-1 bonus should floor one level per 2000 IP before the cap");
    setLogResource(state, "infinityPoints", Math.log10(100000));
    assert.equal(runtime.sponsoredNormalUpgradeBonusLevel(), 50, "IU 11-1 bonus should reach 50 levels at 100000 IP");
    setLogResource(state, "infinityPoints", Math.log10(1000000));
    assert.equal(runtime.sponsoredNormalUpgradeBonusLevel(), 50, "IU 11-1 bonus should stop growing after 100000 IP");
    setLogResource(state, "infinityPoints", Math.log10(20000000));
    assert.equal(runtime.sponsoredNormalUpgradeBonusLevel(), 50, "IU 11-1 bonus should ignore IP past 100000");
    setLogResource(state, "infinityPoints", Math.log10(100000000));
    assert.equal(runtime.sponsoredNormalUpgradeBonusLevel(), 50, "IU 11-1 bonus should not use the hotfix IP cap");
    state.activeTowerChallenge = 1;
    assert.equal(runtime.sponsoredNormalUpgradeBonusLevel(), 10, "TC1 should divide the IU 11-1 effective-level cap by five");
    state.activeTowerChallenge = 0;
    setLogResource(state, "infinityPoints", Math.log10(1000000));

    state.speedLevel = 10;
    state.vertices = 20;
    state.gainLevel = 30;
    assert.equal(runtime.effectiveSpeedLevel(), 60, "IU 11-1 should add bonus levels to lap-speed upgrades");
    assert.equal(runtime.effectiveVertexCount(), 70, "IU 11-1 should add bonus levels to effective vertices");
    assert.equal(runtime.effectiveGainLevel(), 80, "IU 11-1 should add bonus levels to gain upgrades");

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
    runtime.applySaveData({
      infinityPoints: 17000000,
      infinityPointsLog10: Math.log10(17000000),
    }, 7);
    assert.equal(state.infinityPoints, 17000000, "legitimate reported IP below the hotfix cap must not be reduced");
    assert.equal(state.infinityPointsLog10, Math.log10(17000000), "legitimate reported IP log below the hotfix cap must not be reduced");

    runtime.applySaveData({
      infinityPoints: 20000000,
      infinityPointsLog10: Math.log10(20000000),
    }, 7);
    assert.equal(state.infinityPoints, 20000000, "the hotfix IP cap itself must be preserved exactly");
    assert.equal(state.infinityPointsLog10, Math.log10(20000000), "the former hotfix IP cap log must be preserved exactly");

    runtime.applySaveData({
      infinityPoints: Number.MAX_VALUE,
      infinityPointsLog10: 30,
    }, 7);
    assert.equal(state.infinityPoints, 1e30, "large finite IP saves must no longer be capped at 20000000 IP");
    assert.equal(state.infinityPointsLog10, 30, "large finite IP logs must no longer be capped at 20000000 IP");
    assert.equal(state.infinityPointsExact, "1000000000000000000000000000000", "large finite IP saves must hydrate exact integer IP");

    runtime.applySaveData({
      infinityPoints: Number.MAX_VALUE,
      infinityPointsLog10: Infinity,
      infinityCount: 1000000,
    }, 7);
    assert.equal(state.infinityPoints, Number.MAX_VALUE, "overflow IP saves must recover to Number.MAX_VALUE");
    assert.equal(state.infinityPointsLog10, Math.log10(Number.MAX_VALUE), "overflow IP logs must recover to the maximum finite IP log");
    assert.equal(state.infinityCount, 1000000, "overflow Infinity count saves must no longer recover to the hotfix Infinity cap");

    state.infinityPoints = Number.MAX_VALUE;
    state.infinityPointsLog10 = 30;
    state.infinityPointsExact = "1000000000000000000000000000000";
    state.infinityCount = 1000000;
    assert.equal(debug.saveGame("manual"), true, "saving an excessive IP balance should succeed");
    const saved = JSON.parse(storage.get(runtime.SAVE_KEY));
    assert.equal(saved.state.infinityPoints, 1e30, "saved large IP balances must not be persisted at the hotfix cap");
    assert.equal(saved.state.infinityPointsLog10, 30, "saved large IP logs must not be persisted at the hotfix cap");
    assert.equal(saved.state.infinityPointsExact, "1000000000000000000000000000000", "saved large IP balances must preserve exact IP");
    assert.equal(saved.state.infinityCount, 1000000, "saved Infinity counts must not be persisted at the hotfix cap");
  }

  {
    const { runtime, debug, storage } = await loadRuntime(candidatePath);
    const { state } = debug;

    runtime.applySaveData({
      infinityPoints: 1e35,
      infinityPointsLog10: 35,
      infinityPointsExact: "100000000000000000000000000000000000",
      infiniteScore: 1000,
      infiniteScoreLog10: 3,
    }, 9);
    assert.equal(state.infinityPoints, 1e10, "version 9 saves must receive the one-time IP balance correction");
    assert.equal(state.infinityPointsLog10, 10, "version 9 IP correction must synchronize the IP log");
    assert.equal(state.infinityPointsExact, "10000000000", "version 9 IP correction must synchronize exact IP");
    assert.equal(state.infiniteScore, 0, "version 9 saves must reset Infinite Score once");
    assert.equal(state.infiniteScoreLog10, -Infinity, "version 9 Infinite Score correction must synchronize its log");
    assert.equal(debug.saveGame("manual"), true, "corrected version 9 state must save successfully");
    assert.equal(JSON.parse(storage.get(runtime.SAVE_KEY)).version, 11, "corrected saves must persist as version 11");

    runtime.applySaveData({
      infinityPoints: 1e9,
      infinityPointsLog10: 9,
      infinityPointsExact: "1000000000",
      infiniteScore: 10,
      infiniteScoreLog10: 1,
    }, 9);
    assert.equal(state.infinityPoints, 1e9, "version 9 IP balances below the correction cap must be preserved");
    assert.equal(state.infinityPointsExact, "1000000000", "preserved version 9 IP must remain exact");
    assert.equal(state.infiniteScore, 0, "version 9 Infinite Score must reset even when IP is below the cap");

    runtime.applySaveData({
      infinityPoints: 1e35,
      infinityPointsLog10: 35,
      infinityPointsExact: "100000000000000000000000000000000000",
      infiniteScore: 1000,
      infiniteScoreLog10: 3,
    }, 10);
    assert.equal(state.infinityPointsLog10, 35, "version 10 saves must allow IP above the one-time correction cap");
    assert.equal(state.infinityPointsExact, "100000000000000000000000000000000000", "version 10 saves must preserve exact high IP");
    assert.equal(state.infiniteScore, 1000, "version 10 saves must preserve Infinite Score");
    assert.equal(state.infiniteScoreLog10, 3, "version 10 saves must preserve the Infinite Score log");

    runtime.applySaveData({
      infinityPoints: 1e35,
      infinityPointsLog10: 35,
      infinityPointsExact: "100000000000000000000000000000000000",
      infiniteScore: 1000,
      infiniteScoreLog10: 3,
    }, 8);
    assert.equal(state.infinityPointsLog10, 35, "pre-0.6.0 saves must not receive the version 9 IP correction");
    assert.equal(state.infiniteScore, 1000, "pre-0.6.0 saves must not receive the version 9 Infinite Score correction");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityCount = 1234567;
    state.numberFormat = "scientific";
    runtime.updateUi();
    assert.equal(runtime.elements.infinityCount.textContent, "1.23e6", "Infinity count display must respect scientific number formatting");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityUpgradeMask = purchasedMaskThrough(16);
    state.infinityCount = 1;
    setLogResource(state, "infinityPoints", Math.log10(1000000));
    runtime.toggleInfinityChallenge(2);
    state.vertices = 180;
    assert.equal(state.activeChallenge, 2, "IC2 should start for the effective vertex cap scenario");
    assert.equal(runtime.effectiveVertexCount(), 200, "IC2 must cap IU 11-1 effective vertices at 200");
    assert.equal(runtime.canBuyNormalUpgrade("vertex"), false, "IC2 must prevent vertex purchases once effective vertices are capped at 200");

    runtime.toggleInfinityChallenge(2);
    runtime.toggleInfinityChallenge(8);
    assert.equal(state.activeChallenge, 8, "IC8 should start for the effective vertex lock scenario");
    assert.equal(runtime.effectiveVertexCount(), 3, "IC8 must ignore IU 11-1 vertex bonuses and keep 3 effective vertices");
    assert.equal(runtime.canBuyNormalUpgrade("vertex"), true, "IC8 must let vertex purchases buy IC8-only replacement effects");
    const baseVertexGain = runtime.vertexGainIncrease();
    const baseExponent = runtime.coreBoostGainExponent();
    assert.equal(debug.buyAllUpgrades({ allowSpeed: false, allowVertex: true, allowGain: false, refresh: false, save: false }) > 0, true, "IC8 vertex purchases should be buyable through Buy All");
    assert.equal(runtime.effectiveVertexCount(), 3, "IC8 vertex purchases must still keep 3 effective vertices");
    assert.equal(state.vertices, 3, "IC8 vertex purchases must not change the real vertex count");
    assert.ok(state.ic8VertexUpgradeLevel > 0, "IC8 vertex purchases must increase the IC8 replacement level");
    assert.equal(runtime.checkAchievements(true).length, 0, "IC8 replacement levels must not unlock vertex-count achievements");
    runtime.updateUi();
    assert.doesNotMatch(runtime.elements.vertexCount.textContent, /\+ -/, "IC8 vertex display must not show a negative sponsored-vertex difference");
    assert.ok(runtime.vertexGainIncrease() > baseVertexGain, "IC8 vertex purchases must increase gain per vertex");
    assert.ok(runtime.coreBoostGainExponent() > baseExponent, "IC8 vertex purchases must increase score gain exponent");
    assert.equal(runtime.effectiveSpeedLevel(), state.speedLevel + 50, "IC8 should still keep IU 11-1 speed bonus levels");
    assert.equal(runtime.effectiveGainLevel(), state.gainLevel + 50, "IC8 should still keep IU 11-1 gain bonus levels");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityUpgradeMask = purchasedMaskThrough(17);
    state.completedChallenges = 1 << (8 - 1);
    state.vertices = 20;
    setLogResource(state, "generationScore", 7);
    runtime.runGeneration();
    assert.equal(state.vertices, 3, "completed IC8 must not preserve vertices through normal Generation resets");
    state.vertices = 20;
    runtime.resetBelowCoreBoost();
    assert.equal(state.vertices, 3, "completed IC8 must not preserve vertices through normal Core Boost resets");

    state.activeChallenge = 8;
    state.vertices = 3;
    state.ic8VertexUpgradeLevel = 17;
    setLogResource(state, "generationScore", 7);
    runtime.runGeneration();
    assert.equal(state.vertices, 3, "active IC8 must keep real vertices fixed through Generation");
    assert.equal(state.ic8VertexUpgradeLevel, 0, "active IC8 must reset replacement levels through Generation");
    state.ic8VertexUpgradeLevel = 17;
    runtime.resetBelowCoreBoost();
    assert.equal(state.vertices, 3, "active IC8 must keep real vertices fixed through Core Boost");
    assert.equal(state.ic8VertexUpgradeLevel, 0, "active IC8 must reset replacement levels through Core Boost");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    runtime.applySaveData({
      infinityCount: 1,
      infinityUpgradeMask: 1 << 5,
      activeChallenge: 8,
      vertices: 20,
    }, runtime.SAVE_VERSION);
    assert.equal(state.activeChallenge, 8, "active IC8 saves must remain in IC8 when ICs are unlocked");
    assert.equal(state.vertices, 3, "active IC8 saves must keep real vertices fixed at 3");
    assert.equal(state.ic8VertexUpgradeLevel, 17, "old active IC8 saves must migrate extra vertices to replacement levels");
    runtime.applySaveData({
      infinityCount: 1,
      infinityUpgradeMask: 1 << 5,
      activeChallenge: 8,
      vertices: 3,
      ic8VertexUpgradeLevel: 20000,
    }, runtime.SAVE_VERSION);
    assert.equal(state.vertices, 3, "new active IC8 saves must keep real vertices fixed at 3");
    assert.equal(state.ic8VertexUpgradeLevel, 20000, "new active IC8 saves must preserve replacement levels above the render cap");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityUpgradeMask = purchasedMaskThrough(17);
    state.coreBoostCount = 2;
    assert.equal(runtime.coreBoostRequirementLog10(), 80, "normal Core Boost requirement must remain unchanged before IC8");
    state.activeChallenge = 8;
    assert.equal(runtime.coreBoostRequirementLog10(), 160, "IC8 must square Core Boost score requirements");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityUpgradeMask = purchasedMaskThrough(18);
    state.coreBoostCount = 3;
    assertNearlyEqual(runtime.coreBoostGainIncreaseMultiplier(), 8, "IU 12-1 must make CB gain multiplier multiplicative with IU 7-1");
    assertNearlyEqual(runtime.coreBoostGainExponent(), 1.02 ** 3, "IU 12-1 must make CB exponent multiplicative");
    state.completedChallenges = 1 << (5 - 1);
    assertNearlyEqual(runtime.coreBoostGainExponent(), 1.02 ** 3 + 0.01, "IC5 reward must still add after IU 12-1's multiplicative exponent");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.activeChallenge = 8;
    state.coreBoostCount = 2;
    state.ic8VertexUpgradeLevel = 10;
    setLogResource(state, "score", 10);
    assertNearlyEqual(
      runtime.nextCoreBoostValues().gainExponent,
      runtime.coreBoostGainExponent(),
      "active IC8 Core Boost preview must keep replacement levels while Core Boost is unavailable",
    );
    setLogResource(state, "score", 1000);
    assertNearlyEqual(runtime.coreBoostGainExponent(), 1.04 + 10 * runtime.IC8_VERTEX_EXPONENT_BONUS, "active IC8 current exponent must include replacement levels");
    assertNearlyEqual(runtime.nextCoreBoostValues().gainExponent, 1.06, "active IC8 Core Boost preview must omit replacement levels cleared by the reset");
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
    state.infinityCount = 9999;
    const beforeOriginalCap = runtime.vertexGainIncrease();
    assert.equal(runtime.iu11_2EffectiveInfinityCount(), 9999, "IU 11-2 should use the count immediately below its original cap");
    state.infinityCount = 10000;
    assert.equal(runtime.iu11_2EffectiveInfinityCount(), 10000, "IU 11-2 should not softcap before 10000 Infinity");
    const atOriginalCap = runtime.vertexGainIncrease();
    assert.ok(atOriginalCap > beforeOriginalCap, "IU 11-2 should still grow through the original cap boundary");
    state.infinityCount = 10001;
    assert.equal(runtime.iu11_2EffectiveInfinityCount(), 10000, "IU 11-2 should stop growing after 10000 Infinity");
    assert.equal(runtime.vertexGainIncrease(), atOriginalCap, "IU 11-2 should be flat after the 10000 Infinity cap");

    state.infinityUpgradeMask = (1 << 0) | (1 << 17) | (1 << 20);
    state.infinityCount = 29999;
    const beforeExtendedCap = runtime.vertexGainIncrease();
    assert.equal(runtime.iu11_2Hardcap(), 30000, "IU 14-1 should extend the IU 11-2 hard cap to 30000");
    assert.equal(runtime.iu11_2EffectiveInfinityCount(), 29999, "IU 14-1 should use the count immediately below its extended cap");
    state.infinityCount = 30000;
    assert.equal(runtime.iu11_2EffectiveInfinityCount(), 30000, "IU 14-1 should allow the extended cap boundary");
    const atExtendedCap = runtime.vertexGainIncrease();
    assert.ok(atExtendedCap > beforeExtendedCap, "IU 14-1 should preserve growth through the extended cap boundary");
    state.infinityCount = 30001;
    assert.equal(runtime.iu11_2EffectiveInfinityCount(), 30000, "IU 14-1 should stop growing after 30000 Infinity");
    assert.equal(runtime.vertexGainIncrease(), atExtendedCap, "IU 14-1 should be flat after the 30000 Infinity cap");
    assert.equal(Number.isFinite(atExtendedCap), true, "IU 14-1's extended multiplier must stay finite");

    state.infinityCount = 30000;
    state.infinityUpgradeMask = 1 << 20;
    const iu14OnlyGain = runtime.vertexGainIncrease();
    state.infinityUpgradeMask = 0;
    const withoutInfinityUpgradesGain = runtime.vertexGainIncrease();
    assert.equal(iu14OnlyGain, withoutInfinityUpgradesGain, "IU 14-1 alone must not affect the IU 1-1 formula");

    state.infinityUpgradeMask = (1 << 0) | (1 << 17) | (1 << 20);
    for (const extremeCount of [-10, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE]) {
      state.infinityCount = extremeCount;
      const effectiveCount = runtime.iu11_2EffectiveInfinityCount();
      assert.equal(Number.isFinite(effectiveCount), true, `IU 11-2 effective count must be finite for ${String(extremeCount)}`);
      assert.ok(effectiveCount >= 0 && effectiveCount <= 30000, `IU 11-2 effective count must stay bounded for ${String(extremeCount)}`);
      assert.equal(Number.isFinite(runtime.vertexGainIncrease()), true, `IU 11-2 gain must be finite for ${String(extremeCount)}`);
    }
  }

  {
    const source = await loadRuntime(candidatePath);
    const { debug, storage } = source;
    debug.state.infinityUpgradeMask = (1 << 19) | (1 << 20);
    assert.equal(debug.saveGame("manual"), true, "IU14-1 state should save through the normal save path");
    assert.equal(
      (JSON.parse(storage.get(source.runtime.SAVE_KEY)).state.infinityUpgradeMask & (1 << 20)) !== 0,
      true,
      "normal saves must persist IU14-1",
    );
    const reloaded = await loadRuntime(candidatePath, new Map(storage));
    assert.equal((reloaded.debug.state.infinityUpgradeMask & (1 << 20)) !== 0, true, "local save reloads must preserve IU14-1");

    const saveCode = await source.debug.exportSaveCode();
    const imported = await loadRuntime(candidatePath);
    assert.equal(await imported.debug.importSaveCode(saveCode), true, "IU14-1 save codes should import");
    assert.equal((imported.debug.state.infinityUpgradeMask & (1 << 20)) !== 0, true, "save-code imports must preserve IU14-1");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityUpgradeMask = purchasedMaskThrough(12);
    state.automationEnabled = true;
    state.autoRunInfinity = true;
    state.autoRunGeneration = true;
    state.autoRunCoreBoost = true;
    state.autoInfinityPointThreshold = 10;
    state.infinityCount = 1;
    setLogResource(state, "score", 320);
    assert.equal(runtime.runLayerAutomation(), true, "IU 8-1 must expose and run layer automation");
    assert.equal(state.infinityCount > 1, true, "layer automation must run Infinity when the IP threshold is met");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    assert.equal(runtime.parseUiLogNumber("1e100"), 100, "Infinity thresholds should parse scientific notation");
    assert.equal(runtime.parseUiLogNumber("1.00B"), 9, "Infinity thresholds should parse compact notation");

    runtime.applySaveData({ autoInfinityPointThreshold: "1e100" }, 10);
    assert.equal(state.autoInfinityPointThresholdLog10, 100, "legacy Infinity threshold saves should migrate to log space");
    assert.equal(state.autoInfinityPointThreshold, 1e100, "migrated Infinity thresholds should keep their numeric cache");

    runtime.applySaveData({ autoInfinityPointThreshold: 10, autoInfinityPointThresholdLog10: 400 }, 10);
    assert.equal(state.autoInfinityPointThresholdLog10, 400, "saved Infinity threshold logs should take precedence");
    assert.equal(state.autoInfinityPointThreshold, Number.MAX_VALUE, "large Infinity thresholds should cap only their numeric cache");

    state.infinityUpgradeMask = purchasedMaskThrough(12);
    state.automationEnabled = true;
    state.autoRunInfinity = true;
    state.autoRunGeneration = false;
    state.autoRunCoreBoost = false;
    state.infinityCount = 1;
    state.infiniteCapBroken = true;
    state.completedChallenges = 1 << (8 - 1);
    state.generationScoreMultiplierLog10 = 510;
    state.generationScoreMultiplier = Number.MAX_VALUE;
    setLogResource(state, "score", 400);
    assert.ok(runtime.infinityPointGainLog10() > 400, "payable Infinity gain must retain its true log above an e400 threshold");
    assert.equal(runtime.runLayerAutomation(), true, "Infinity automation must compare the true gain above the Number cap");
    assert.ok(state.infinityCount > 1, "true over-cap Infinity gain must trigger the reset automation");

    state.numberFormat = "scientific";
    assert.equal(runtime.formatUiLogNumber(100), "1.00e100", "scientific formatting should display Infinity thresholds as exponents");
    state.numberFormat = "compact";
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime, debug, storage } = instance;
    const record = { time: 1, realTime: 1, scoreLog10: 400, ipGain: Number.MAX_VALUE, ipGainLog10: 1000, challenge: 0 };
    debug.state.lastInfinityRuns = [record];
    assert.match(
      runtime.infinityRunRecordText(record, 0),
      /1\.00e1,000 IP/,
      "Infinity history text must use the raw overflowing IP gain log",
    );
    assert.equal(debug.saveGame("manual"), true, "Infinity history with a raw gain log should save");
    const reloaded = await loadRuntime(candidatePath, storage);
    assert.equal(
      reloaded.debug.state.lastInfinityRuns[0].ipGainLog10,
      1000,
      "Infinity history raw gain logs must survive save and reload",
    );
    assert.equal(
      reloaded.debug.state.lastInfinityRuns[0].ipGain,
      Number.MAX_VALUE,
      "Infinity history numeric compatibility caches must remain capped only as caches",
    );
  }

  {
    const source = await loadRuntime(candidatePath);
    source.runtime.applySetting("autoInfinityPointThreshold", "1e400");
    const reloaded = await loadRuntime(candidatePath, source.storage);
    assert.equal(reloaded.debug.state.autoInfinityPointThresholdLog10, 400, "log-space Infinity thresholds should survive local saves");
    assert.equal(reloaded.debug.state.autoInfinityPointThreshold, Number.MAX_VALUE, "reloaded large thresholds should retain their capped numeric cache");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    state.infinityUpgradeMask = purchasedMaskThrough(12);
    state.automationEnabled = true;
    state.autoRunGeneration = true;
    state.autoRunCoreBoost = true;
    state.infinityCount = 1;
    state.generationCount = 1;
    setLogResource(state, "score", 90);
    assert.equal(runtime.runLayerAutomation(), false, "IU 8-1 must not unlock GR or CB automation by itself");

    state.achievementMask = 1 << (19 - 1);
    assert.equal(runtime.runLayerAutomation(), true, "achievement 19 must unlock Core Boost automation");
    assert.equal(state.coreBoostCount, 1, "Core Boost automation should run once achievement 19 is unlocked");
  }

  {
    const { debug } = await loadRuntime(candidatePath);
    const { state } = debug;
    assert.equal(state.autoGenerationScoreMultiplierThreshold, 2, "new states should default Generation score automation to 2x");
    assert.equal(state.autoGenerationCostMultiplierThreshold, 1, "new states should default Generation cost automation to 1x");
    assert.equal(state.autoInfinityPointThresholdLog10, 1, "new states should default Infinity automation to 10 IP");
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
