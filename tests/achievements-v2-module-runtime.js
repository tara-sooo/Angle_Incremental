const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

function setLogResource(state, key, log) {
  state[`${key}Log10`] = log;
  state[key] = log <= 308 ? 10 ** log : Number.MAX_VALUE;
}

function assertNearlyEqual(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-12, `${message}: expected ${expected}, got ${actual}`);
}

async function runAchievementV2ModuleRuntimeTest() {
  {
    const instance = await loadRuntime(candidatePath);
    const { state } = instance.debug;
    const { runtime } = instance;

    assert.equal(runtime.ACHIEVEMENT_COUNT, 31, "achievement total should be derived from the 31 definitions");
    assert.equal(runtime.ACHIEVEMENTS.length, 31, "achievement definition array should contain 31 entries");

    state.achievementMask = 0;
    state.gainLevel = 10;
    const baseGain = runtime.vertexGainIncrease();
    state.achievementMask = 1 << 14;
    const boostedGain = runtime.vertexGainIncrease();
    assertNearlyEqual(boostedGain / baseGain, 1.01, "one achievement should multiply gain per vertex by 1.01");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { state } = instance.debug;
    const { runtime } = instance;

    state.infinityCount = 1;
    setLogResource(state, "score", 310);
    state.achievementMask = 0;
    assert.equal(runtime.infinityPointGain(), 3, "base post-break IP gain should use the raw formula without achievement rewards");
    state.achievementMask = 1 << (17 - 1);
    assert.equal(runtime.infinityPointGain(), 6, "achievement 17 should double IP gain");
    state.achievementMask = 1 << (21 - 1);
    assert.equal(runtime.infinityPointGain(), 6, "achievement 21 should also double IP gain");
    state.achievementMask = (1 << (17 - 1)) | (1 << (21 - 1));
    assert.equal(runtime.infinityPointGain(), 12, "achievements 17 and 21 should stack to quadruple IP gain");
    state.achievementMask = 1 << (31 - 1);
    assert.equal(runtime.infinityPointGain(), 300, "achievement 31 should multiply IP gain by 100");
    state.achievementMask = (1 << (17 - 1)) | (1 << (21 - 1)) | (1 << (31 - 1));
    assert.equal(runtime.infinityPointGain(), 1200, "achievement 31 should multiply with achievements 17 and 21");
    state.achievementMask = (1 << (17 - 1)) | (1 << (21 - 1));
    setLogResource(state, "score", 309);
    assert.equal(runtime.infinityPointGain(), 8, "achievement IP multipliers must preserve exact integer products before flooring");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { state } = instance.debug;
    const { runtime } = instance;

    state.achievementMask = 0;
    state.infiniteAngleUnlocked = false;
    runtime.checkAchievements(false);
    assert.equal(runtime.isAchievementUnlocked(31), false, "achievement 31 should require the IA unlock");

    state.infiniteAngleUnlocked = true;
    runtime.checkAchievements(false);
    assert.equal(runtime.isAchievementUnlocked(31), true, "unlocking IA should unlock achievement 31");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { state } = instance.debug;
    const { runtime } = instance;

    state.infinityCount = 1;
    state.activeChallenge = 3;
    setLogResource(state, "score", 309);
    runtime.runInfinity(false);

    assert.equal(runtime.isAchievementUnlocked(17), true, "clearing IC3 should unlock achievement 17");
    assert.equal(state.lastInfinityRuns[0].ipGain, 4, "achievement 17 should double the IP reward of its IC3 completion run");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { state } = instance.debug;
    const { runtime } = instance;

    state.infinityPoints = 100;
    state.infinityPointsLog10 = 2;
    runtime.checkAchievements(false);

    assert.equal(runtime.isAchievementUnlocked(20), true, "holding 100 IP should unlock achievement 20");
    assertNearlyEqual(runtime.generationCostFactorEffect(), 0.98, "achievement 20 should reduce the effective GR cost factor");
    assertNearlyEqual(runtime.nextGenerationValues().costFactor, 0.98, "achievement 20 should affect the Generation preview");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { state } = instance.debug;
    const { runtime } = instance;

    state.infinityCount = 1;
    state.generationCount = 0;
    state.coreBoostCount = 0;
    setLogResource(state, "score", 309);
    runtime.runInfinity(false);

    assert.equal(state.lastInfinityRuns[0].noGenerationCoreBoost, true, "first-generation Infinity should record its condition");
    assert.equal(runtime.isAchievementUnlocked(22), true, "first-generation Infinity should unlock achievement 22");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { state } = instance.debug;
    const { runtime } = instance;

    state.infinityCount = 1;
    state.infinityUpgradeMask = 1 << 14;
    state.generationCount = 0;
    state.coreBoostCount = 2;
    setLogResource(state, "score", 309);
    runtime.runInfinity(false);

    assert.equal(
      state.lastInfinityRuns[0].noGenerationCoreBoost,
      true,
      "IU 10-1 starting Core Boosts should not block the no-GR/CB Infinity record",
    );
    assert.equal(runtime.isAchievementUnlocked(22), true, "IU 10-1 should not block achievement 22 by itself");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { state } = instance.debug;
    const { runtime } = instance;

    state.infinityCount = 1;
    state.infinityUpgradeMask = 1 << 14;
    state.coreBoostCount = 2;
    setLogResource(state, "score", 90);
    runtime.runCoreBoost();
    setLogResource(state, "score", 309);
    runtime.runInfinity(false);

    assert.equal(
      state.lastInfinityRuns[0].noGenerationCoreBoost,
      undefined,
      "manual Core Boost after IU 10-1 must still block the no-GR/CB Infinity record",
    );
    assert.equal(runtime.isAchievementUnlocked(22), false, "manual Core Boost after IU 10-1 must block achievement 22");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { state } = instance.debug;
    const { runtime } = instance;

    state.completedChallenges = 0;
    assert.equal(runtime.infinitySoftcapPower(), 0.08, "the pre-break Infinity softcap must start at 0.08");
    state.completedChallenges = (1 << 8) - 1;
    assert.equal(runtime.infinitySoftcapPower(), 0.08, "clearing ICs must not relax the pre-break Infinity softcap");
    state.infiniteCapBroken = true;
    assert.equal(runtime.infinitySoftcapPower(), 1, "breaking the cap must remove the Infinity softcap");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { state } = instance.debug;
    const { runtime } = instance;

    state.infinityCount = 10;
    state.completedChallenges = (1 << 8) - 1;
    state.fastestInfinityTime = 119;
    state.infinityPoints = 100;
    state.infinityPointsLog10 = 2;
    state.infinityUpgradeMask = (1 << 10) | (1 << 11);
    state.infiniteCapBroken = true;
    state.infiniteAngleUnlocked = true;
    setLogResource(state, "score", 314);
    runtime.checkAchievements(false);

    state.infinityCount = 5001;
    state.infinityPoints = 100000;
    state.infinityPointsLog10 = 5;
    state.infinityUpgradeMask |= 1 << 13;
    setLogResource(state, "score", 628.1);
    runtime.checkAchievements(false);

    [15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 28, 29, 30, 31].forEach((id) => {
      assert.equal(runtime.isAchievementUnlocked(id), true, `achievement ${id} should unlock from its condition`);
    });
    assert.equal(runtime.ACHIEVEMENTS[23].title.ja, "以前はlog10(score)-307でした", "achievement 24 should be the IU9-1 achievement");
    assert.equal(runtime.ACHIEVEMENTS[29].title.ja, "SDGsよりは簡単な課題", "achievement 30 should be the all-IC achievement");
    assert.equal(runtime.ACHIEVEMENTS[30].title.ja, "六兆年と一夜の付き合い", "achievement 31 should be the IA unlock achievement");
  }

  {
    const { runtime, debug } = await loadRuntime(candidatePath);
    runtime.applySaveData({
      achievementMask: (1 << (24 - 1)) | (1 << (25 - 1)),
    }, 8);
    assert.equal(debug.state.achievementMask & (1 << (30 - 1)), 1 << (30 - 1), "old achievement 24 should migrate to new achievement 30");
    assert.equal(debug.state.achievementMask & (1 << (25 - 1)), 1 << (25 - 1), "old achievement 25 should remain achievement 25");
    assert.equal(debug.state.achievementMask & (1 << (24 - 1)), 0, "new achievement 24 should not inherit the old all-IC achievement bit");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { state } = instance.debug;
    const { runtime } = instance;

    state.coreBoostCount = 2;
    setLogResource(state, "score", 100);
    state.infinityUpgradeMask = 0;
    assertNearlyEqual(runtime.nextCoreBoostValues().gainMultiplier, 2.5, "next Core Boost preview should use the base gain increase without 7-1");

    state.infinityUpgradeMask = 1 << 10;
    assertNearlyEqual(runtime.coreBoostGainIncreaseMultiplier(), 3, "7-1 should affect the current Core Boost gain multiplier");
    assertNearlyEqual(runtime.nextCoreBoostValues().gainMultiplier, 4, "7-1 should affect the next Core Boost gain multiplier preview");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { state } = instance.debug;
    const { runtime } = instance;

    state.completedChallenges = 1 << (5 - 1);
    state.coreBoostCount = 0;
    setLogResource(state, "score", 0);
    assertNearlyEqual(runtime.coreBoostGainExponent(), 1.01, "IC5 reward should affect the current Core Boost gain exponent");
    assertNearlyEqual(
      runtime.nextCoreBoostValues().gainExponent,
      runtime.coreBoostGainExponent(),
      "Core Boost exponent preview should not decrease when no Core Boost is available",
    );

    setLogResource(state, "score", 20);
    assert.equal(runtime.canCoreBoost(), true, "test setup should make the next Core Boost available");
    assertNearlyEqual(
      runtime.nextCoreBoostValues().gainExponent,
      1.03,
      "Core Boost exponent preview should include the IC5 reward after the next Core Boost",
    );
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime } = instance;

    runtime.createAchievementRows();
    runtime.updateAchievementRows();

    const rows = runtime.elements.achievementList.querySelectorAll(".achievement-row");
    assert.equal(rows.length, 31, "achievement rows should be rendered in the module runtime");

    const firstReward = rows[0].querySelector(".achievement-reward");
    assert.equal(firstReward.textContent, "", "achievements without individual rewards should not repeat the shared reward");
    assert.equal(firstReward.hidden, true, "empty individual achievement rewards should be hidden");

    const ic3Reward = rows[16].querySelector(".achievement-reward");
    assert.equal(ic3Reward.textContent, "報酬: IP獲得量が×2", "individual achievement rewards should use the generic reward label");
    assert.equal(ic3Reward.hidden, false, "individual achievement rewards should remain visible");

    const achievement19Reward = rows[18].querySelector(".achievement-reward");
    assert.equal(achievement19Reward.textContent, "報酬: GRとCBの自動化を解放", "achievement 19 should advertise GR/CB automation");
    assert.equal(achievement19Reward.hidden, false, "achievement 19 reward should be visible");

    const achievement21Reward = rows[20].querySelector(".achievement-reward");
    assert.equal(achievement21Reward.textContent, "報酬: IP獲得量がさらに×2", "achievement 21 should advertise the extra IP multiplier");
    assert.equal(achievement21Reward.hidden, false, "achievement 21 reward should be visible");

    assert.equal(rows[23].querySelector(".achievement-title").textContent, "以前はlog10(score)-307でした", "achievement 24 row should use the new order");
    assert.equal(rows[29].querySelector(".achievement-title").textContent, "SDGsよりは簡単な課題", "achievement 30 row should use the new order");

    const achievement31Reward = rows[30].querySelector(".achievement-reward");
    assert.equal(rows[30].querySelector(".achievement-title").textContent, "六兆年と一夜の付き合い", "achievement 31 row should use the new order");
    assert.equal(achievement31Reward.textContent, "報酬: IP獲得量が×100", "achievement 31 should advertise the IP multiplier");
    assert.equal(achievement31Reward.hidden, false, "achievement 31 reward should be visible");
  }

  console.log("Achievement v2 module runtime tests passed");
}

module.exports = { runAchievementV2ModuleRuntimeTest };
