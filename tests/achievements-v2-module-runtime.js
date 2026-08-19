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

    assert.equal(runtime.ACHIEVEMENT_COUNT, 41, "achievement total should be derived from the 41 definitions");
    assert.equal(runtime.ACHIEVEMENTS.length, 41, "achievement definition array should contain 41 entries");

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
    state.achievementMaskHigh = 0;
    assert.equal(runtime.infinityPointGain(), 3, "base post-break IP gain should use the raw formula without achievement rewards");
    state.achievementMaskHigh = 1 << (38 - 32);
    assert.equal(runtime.infinityPointGain(), 3, "achievement 38 should not change Infinity Point gain");
    state.achievementMaskHigh = 0;
    state.achievementMask = 1 << (17 - 1);
    assert.equal(runtime.infinityPointGain(), 6, "achievement 17 should double IP gain");
    state.achievementMask = 1 << (21 - 1);
    assert.equal(runtime.infinityPointGain(), 6, "achievement 21 should also double IP gain");
    state.achievementMask = (1 << (17 - 1)) | (1 << (21 - 1));
    state.achievementMaskHigh = 1 << (38 - 32);
    assert.equal(runtime.infinityPointGain(), 12, "achievements 17 and 21 should retain their combined IP multiplier even with achievement 38");
    state.achievementMask = 1 << (31 - 1);
    state.achievementMaskHigh = 0;
    assert.equal(runtime.infinityPointGain(), 300, "achievement 31 should multiply IP gain by 100");
    state.achievementMask = (1 << (17 - 1)) | (1 << (21 - 1)) | (1 << (31 - 1));
    assert.equal(runtime.infinityPointGain(), 1200, "achievement 31 should multiply with achievements 17 and 21");
    state.achievementMask = (1 << (17 - 1)) | (1 << (21 - 1));
    setLogResource(state, "score", 309);
    assert.equal(runtime.infinityPointGain(), 8, "achievement IP multipliers must preserve exact integer products before flooring");

    state.achievementMask = 0;
    state.achievementMaskHigh = 0;
    state.completedChallenges = 0;
    assert.equal(runtime.infinityCountGain(), 1, "without IC6 or achievement 38, an Infinity should grant one count");
    state.achievementMaskHigh = 1 << (38 - 32);
    assert.equal(runtime.infinityCountGain(), 2, "achievement 38 should double count gain without IC6");
    state.achievementMaskHigh = 0;
    state.completedChallenges = 1 << (6 - 1);
    assert.equal(runtime.infinityCountGain(), 2, "IC6 should double count gain without achievement 38");
    state.achievementMaskHigh = 1 << (38 - 32);
    assert.equal(runtime.infinityCountGain(), 4, "IC6 and achievement 38 should stack to four count gain");
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
    const cases = [
      {
        id: 32,
        before: (state) => { state.infinityPointsLog10 = 43.999; },
        after: (state) => { state.infinityPointsLog10 = 44; },
      },
      {
        id: 33,
        before: (state) => { state.towerFloor = 0; },
        after: (state) => { state.towerFloor = 1; },
      },
      {
        id: 34,
        before: (state) => { state.completedTowerChallenges = 0; },
        after: (state) => { state.completedTowerChallenges = 1 << 0; },
      },
      {
        id: 35,
        before: (state) => { setLogResource(state, "score", 2450); },
        after: (state) => { setLogResource(state, "score", 2450.1); },
      },
      {
        id: 36,
        before: (state) => { state.towerFloor = 2; },
        after: (state) => { state.towerFloor = 3; },
      },
      {
        id: 37,
        before: (state) => { state.completedTowerChallenges = 0; },
        after: (state) => { state.completedTowerChallenges = 1 << 1; },
      },
      {
        id: 38,
        before: (state) => { state.infinityCount = 1_500_000; },
        after: (state) => { state.infinityCount = 1_500_001; },
      },
      {
        id: 39,
        before: (state) => { state.completedTowerChallenges = 0; },
        after: (state) => { state.completedTowerChallenges = 1 << 2; },
      },
      {
        id: 40,
        before: (state) => { state.completedTowerChallenges = 0; },
        after: (state) => { state.completedTowerChallenges = 1 << 3; },
      },
      {
        id: 41,
        before: (state) => { state.eternityCount = 0; },
        after: (state) => { state.eternityCount = 1; },
      },
    ];
    for (const testCase of cases) {
      const instance = await loadRuntime(candidatePath);
      const { state } = instance.debug;
      const { runtime } = instance;
      state.achievementMask = 0;
      state.achievementMaskHigh = 0;
      testCase.before(state);
      assert.equal(runtime.ACHIEVEMENTS[testCase.id - 1].isUnlocked(), false, `achievement ${testCase.id} should remain locked before its threshold`);
      testCase.after(state);
      assert.equal(runtime.ACHIEVEMENTS[testCase.id - 1].isUnlocked(), true, `achievement ${testCase.id} should be eligible at its threshold`);
      runtime.checkAchievements(false);
      assert.equal(runtime.isAchievementUnlocked(testCase.id), true, `achievement ${testCase.id} should unlock after checking its threshold`);
    }
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { state } = instance.debug;
    const { runtime } = instance;

    state.achievementMask = 0;
    state.achievementMaskHigh = 0;
    runtime.syncInfinityPointCachesFromExact(runtime.MAX_EXACT_INFINITY_POINTS);
    state.completedTowerChallenges = 1 << 3;
    runtime.checkAchievements(false);
    assert.equal(runtime.isAchievementUnlocked(40), true, "TC4 completion should unlock achievement 40 before Eternity reset");
    assert.equal(runtime.isAchievementUnlocked(41), false, "Eternity eligibility alone must not unlock achievement 41");

    assert.equal(runtime.performEternity({ save: false, update: false }), true, "a successful Eternity should execute for achievement coverage");
    assert.equal(state.eternityCount, 1, "successful Eternity should increment the count once");
    assert.equal(state.completedTowerChallenges, 0, "Eternity should reset current-run TC completion");
    assert.equal(runtime.isAchievementUnlocked(40), true, "achievement 40 should survive the Eternity reset");
    assert.equal(runtime.isAchievementUnlocked(41), true, "achievement 41 should unlock after the successful Eternity transition");
    assert.ok(runtime.achievementCount() >= 2, "achievements 40 and 41 should be counted after the successful Eternity");
    assertNearlyEqual(runtime.achievementGainMultiplier(), Math.pow(1.01, runtime.achievementCount()), "achievements 40 and 41 should use the shared multiplier");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { state } = instance.debug;
    const { runtime } = instance;

    state.achievementMask = 0;
    state.achievementMaskHigh = 0b1111111111;
    assert.equal(runtime.isAchievementUnlocked(1), false, "high achievement bits must not unlock achievement 1");
    assert.equal(runtime.isAchievementUnlocked(2), false, "high achievement bits must not unlock achievement 2");
    [32, 33, 34, 35, 36, 37, 38, 39, 40, 41].forEach((id) => {
      assert.equal(runtime.isAchievementUnlocked(id), true, `achievement ${id} should use its high-mask bit`);
    });

    state.achievementMask = (1 << 6) - 1;
    state.achievementMaskHigh = 0;
    assert.equal(runtime.isAchievementUnlocked(1), true, "low achievement bit 0 should remain achievement 1");
    assert.equal(runtime.isAchievementUnlocked(6), true, "low achievement bit 5 should remain achievement 6");
    assert.equal(runtime.isAchievementUnlocked(32), false, "low achievement bits must not unlock achievement 32");

    state.achievementMask = 0x7fffffff;
    state.achievementMaskHigh = 0b1111111111;
    assert.equal(runtime.achievementCount(), 41, "all 41 achievements should be counted across both masks");
    assertNearlyEqual(runtime.achievementGainMultiplier(), Math.pow(1.01, 41), "all 41 achievements should apply the shared multiplier");
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
    const { debug, runtime } = instance;
    const lowMask = 1 << (31 - 1);
    const highMask = 0b1111111111;

    runtime.applySaveData({ achievementMask: lowMask }, 10);
    assert.equal(debug.state.achievementMask, lowMask, "old v10 saves should preserve the low achievement mask");
    assert.equal(debug.state.achievementMaskHigh, 0, "old v10 saves without a high mask should default it to zero");

    debug.state.achievementMaskHigh = highMask;
    const serialized = runtime.serializeSaveData();
    assert.equal(serialized.state.achievementMask, lowMask, "serialized saves should retain the low achievement mask");
    assert.equal(serialized.state.achievementMaskHigh, highMask, "serialized saves should include the high achievement mask");

    debug.state.achievementMaskHigh = 1 << 31;
    const normalizedSignedMask = runtime.serializeSaveData().state.achievementMaskHigh;
    assert.equal(normalizedSignedMask, 0x80000000, "serialized high masks should remain unsigned at bit 31");
    debug.state.achievementMaskHigh = highMask;

    const reloaded = await loadRuntime(candidatePath);
    reloaded.runtime.applySaveData(serialized.state, serialized.version);
    assert.equal(reloaded.debug.state.achievementMask, lowMask, "save reload should retain achievement 31");
    assert.equal(reloaded.debug.state.achievementMaskHigh, highMask, "save reload should retain achievements 32-41");

    const code = await runtime.exportSaveCode();
    debug.state.achievementMask = 0;
    debug.state.achievementMaskHigh = 0;
    assert.equal(await runtime.importSaveCode(code), true, "save-code import should restore both achievement masks");
    assert.equal(debug.state.achievementMask, lowMask, "save-code import should restore the low achievement mask");
    assert.equal(debug.state.achievementMaskHigh, highMask, "save-code import should restore the high achievement mask");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { state } = instance.debug;
    const { runtime } = instance;
    state.achievementMaskHigh = (1 << (40 - 32)) | (1 << (41 - 32));

    runtime.resetBelowCoreBoost();
    runtime.resetBelowInfinity();

    assert.equal(runtime.isAchievementUnlocked(40), true, "achievement 40 should survive normal layer resets");
    assert.equal(runtime.isAchievementUnlocked(41), true, "achievement 41 should survive normal layer resets");
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
    const { state } = instance.debug;
    const { runtime } = instance;

    runtime.createAchievementRows();
    runtime.updateAchievementRows();

    const rows = runtime.elements.achievementList.querySelectorAll(".achievement-row");
    assert.equal(rows.length, 41, "achievement rows should be rendered in the module runtime");

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

    const japaneseDefinitions = [
      ["不吉だという前提は置いておいて", "所持IPがe44に到達", true],
      ["バベルも土台から", "Towerを建設", true],
      ["あれをチャレンジだと呼ぶべきではない", "TC1をクリア", true],
      ["道しるべを残す", "スコアがe2450を超える", true],
      ["ちょっぴり豪邸", "Towerの階層が3に到達", true],
      ["物騒な名前", "TC2をクリア", true],
      ["無限万長者", "Infinity数が1.5e6を超える", false],
      ["とうに越した先に", "TC3をクリア", true],
      ["挑戦権、そして時空の片道切符", "TC4をクリア", true],
      ["時間は生成的", "初回Eternityを実行", true],
    ];
    japaneseDefinitions.forEach(([title, condition, rewardHidden], offset) => {
      const row = rows[31 + offset];
      assert.equal(row.querySelector(".achievement-title").textContent, title, `achievement ${32 + offset} should use the Japanese title`);
      assert.equal(row.querySelector(".achievement-condition").textContent, condition, `achievement ${32 + offset} should use the Japanese condition`);
      const reward = row.querySelector(".achievement-reward");
      assert.equal(reward.textContent, rewardHidden ? "" : "報酬: Infinity数獲得量を×2", `achievement ${32 + offset} reward text should use the localized definition`);
      assert.equal(reward.hidden, rewardHidden, `achievement ${32 + offset} reward visibility should use the definition`);
    });

    const englishDefinitions = [
      ["Assuming It Is Unlucky", "Hold at least 1e44 IP."],
      ["Babel Starts from the Foundation", "Build the Tower."],
      ["We Should Not Call That a Challenge", "Complete TC1."],
      ["Leave a Signpost", "Reach more than 1e2450 score."],
      ["A Slightly Luxurious Mansion", "Reach Tower Floor 3."],
      ["A Violent-Sounding Name", "Complete TC2."],
      ["Infinity Millionaire", "Have more than 1.5e6 Infinity."],
      ["Far Beyond", "Complete TC3."],
      ["The Right to Challenge, and a One-Way Ticket Through Spacetime", "Complete TC4."],
      ["Time is generative", "Perform Eternity for the first time."],
    ];
    state.language = "en";
    runtime.updateAchievementRows();
    englishDefinitions.forEach(([title, condition], offset) => {
      const row = rows[31 + offset];
      assert.equal(row.querySelector(".achievement-title").textContent, title, `achievement ${32 + offset} should use the English title`);
      assert.equal(row.querySelector(".achievement-condition").textContent, condition, `achievement ${32 + offset} should use the English condition`);
    });
  }

  console.log("Achievement v2 module runtime tests passed");
}

module.exports = { runAchievementV2ModuleRuntimeTest };
