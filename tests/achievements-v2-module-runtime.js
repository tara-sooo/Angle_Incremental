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

    assert.equal(runtime.ACHIEVEMENT_COUNT, 25, "achievement total should be derived from the 25 definitions");
    assert.equal(runtime.ACHIEVEMENTS.length, 25, "achievement definition array should contain 25 entries");

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

    state.infinityCount = 10;
    state.completedChallenges = (1 << 8) - 1;
    state.fastestInfinityTime = 119;
    state.infinityPoints = 100;
    state.infinityPointsLog10 = 2;
    state.infinityUpgradeMask = (1 << 10) | (1 << 11);
    state.infiniteCapBroken = true;
    setLogResource(state, "score", 314);
    runtime.checkAchievements(false);

    [15, 16, 17, 18, 19, 20, 21, 23, 24, 25].forEach((id) => {
      assert.equal(runtime.isAchievementUnlocked(id), true, `achievement ${id} should unlock from its condition`);
    });
  }

  console.log("Achievement v2 module runtime tests passed");
}

module.exports = { runAchievementV2ModuleRuntimeTest };
