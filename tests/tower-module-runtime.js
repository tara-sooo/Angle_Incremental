const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

function setInfinityPoints(runtime, amount) {
  runtime.syncInfinityPointCachesFromExact(BigInt(amount));
}

async function runTowerModuleRuntimeTest() {
  {
    const instance = await loadRuntime(candidatePath);
    const { runtime } = instance;
    const expectedCosts = [50, 60, 70, 85, 100, 125, 150, 175, 205, 235, 265, 295, 345];
    expectedCosts.forEach((expected, index) => {
      assert.equal(runtime.towerFloorCostLog10(index + 1), expected, `Tower Floor ${index + 1} should cost e${expected} IP`);
    });
    assert.equal(runtime.towerFloorCostLog10(14), 345 * 1.15, "Floor 14 should apply the post-Floor-13 power");
    assert.equal(runtime.towerFloorCostLog10(15), 345 * 1.15 ** 2, "post-Floor-13 costs should compound by 1.15");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    setInfinityPoints(runtime, runtime.exactInfinityPointsFromCostLog10(50));
    assert.equal(debug.buildTower(), true, "Floor 1 should be purchasable with e50 IP");
    assert.equal(debug.state.towerFloor, 1, "building Tower should increase the floor");
    assert.equal(runtime.currentExactInfinityPoints(), 0n, "Tower construction should spend the exact IP cost");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    debug.state.towerFloor = 3;
    setInfinityPoints(runtime, runtime.MAX_EXACT_INFINITY_POINTS);
    assert.equal(runtime.towerChallengeUnlocked(1), true, "TC1 should unlock at Floor 3");
    assert.equal(runtime.towerGateForFloor(4), 1, "Floor 4 should be gated by TC1");
    assert.equal(runtime.towerCanBuildNextFloor(), false, "an uncleared TC should block the next Tower floor");
    assert.equal(runtime.canBuildTower(), false, "a gated Tower floor should not be purchasable");
    assert.equal(debug.buildTower(), false, "building through an uncleared TC should fail");
    assert.equal(runtime.towerGateForFloor(6), 2, "Floor 6 should be gated by TC2");
    assert.equal(runtime.towerGateForFloor(9), 3, "Floor 9 should be gated by TC3");
    assert.equal(runtime.towerGateForFloor(13), 4, "Floor 13 should be gated by TC4");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    debug.state.towerFloor = 3;
    debug.state.infinityCount = 5;
    debug.state.infinityUpgradeMask = 1 << 16;
    setInfinityPoints(runtime, 123n);
    assert.equal(runtime.toggleTowerChallenge(1), true, "TC1 should start at Floor 3");
    assert.equal(debug.state.activeTowerChallenge, 1, "TC1 should become active");
    assert.equal(runtime.canBuyNormalUpgrade("speed"), false, "TC1 should seal normal upgrades");
    setInfinityPoints(runtime, runtime.MAX_EXACT_INFINITY_POINTS);
    assert.equal(runtime.sponsoredNormalUpgradeBonusLevel(), 10, "TC1 should divide IU 11-1's effective-level cap by five");
    debug.state.scoreLog10 = 308;
    debug.state.score = Number.MAX_VALUE;
    assert.equal(runtime.towerChallengeCanComplete(), true, "TC1 should complete at 1e308 Score");
    assert.equal(runtime.completeTowerChallengeIfReady(), true, "TC1 should perform its dedicated completion reset");
    assert.equal(debug.state.completedTowerChallenges & 1, 1, "TC1 completion should persist its reward flag");
    assert.equal(debug.state.activeTowerChallenge, 0, "TC1 should stop after completion");
    assert.equal(debug.state.infinityCount, 5, "TC1 should not grant Infinity count");
    assert.equal(runtime.currentExactInfinityPoints(), runtime.MAX_EXACT_INFINITY_POINTS, "TC1 should not grant IP");
    assert.equal(debug.state.towerFloor, 3, "TC1 should preserve Tower progress");
    assert.equal(runtime.toggleTowerChallenge(1), true, "a cleared TC1 should be replayable");
    assert.equal(debug.state.activeTowerChallenge, 1, "TC1 replay should become active");
    assert.equal(runtime.canBuyNormalUpgrade("speed"), false, "TC1 restrictions should apply during a replay");
    debug.state.scoreLog10 = 308;
    debug.state.score = Number.MAX_VALUE;
    assert.equal(runtime.completeTowerChallengeIfReady(), true, "TC1 replay should complete at its target");
    assert.equal(debug.state.completedTowerChallenges & 1, 1, "TC1 replay should preserve its reward flag");
    assert.equal(debug.state.infinityCount, 5, "TC1 replay should not grant Infinity count");
    assert.equal(runtime.currentExactInfinityPoints(), runtime.MAX_EXACT_INFINITY_POINTS, "TC1 replay should not grant IP");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    debug.state.towerFloor = 5;
    debug.state.infinityCount = 5;
    debug.state.infinityUpgradeMask = 1 << 14;
    assert.equal(runtime.toggleTowerChallenge(2), true, "TC2 should start at Floor 5");
    assert.equal(debug.state.coreBoostCount, 0, "TC2 should suppress starting Core Boosts as well");
    debug.state.generationScoreMultiplierLog10 = 2.5;
    debug.state.generationScoreMultiplier = 10 ** 2.5;
    assert.equal(runtime.generationScoreMultiplierEffectLog10(), 0.5, "TC2 should raise the GR score multiplier to ^0.1");
    debug.state.generationCostFactor = 0.1;
    assert.equal(runtime.generationCostFactorEffect(), 0.9, "TC2 should impose a hard floor of x0.90 on GR cost");
    debug.state.scoreLog10 = 20;
    debug.state.score = 1e20;
    assert.equal(runtime.canCoreBoost(), false, "TC2 should seal Core Boost");
    debug.state.scoreLog10 = 1300;
    debug.state.score = Number.MAX_VALUE;
    assert.equal(runtime.towerChallengeCanComplete(), true, "TC2 should complete at 1e1300 Score");
    assert.equal(runtime.completeTowerChallengeIfReady(), true, "TC2 should use the normal Infinity completion path");
    assert.equal(debug.state.completedTowerChallenges & 2, 2, "TC2 completion should persist its reward flag");
    assert.equal(debug.state.activeTowerChallenge, 0, "TC2 should stop after completion");
    assert.equal(debug.state.infinityCount, 6, "TC2 should grant the normal Infinity count reward");
    const replayIpBefore = runtime.currentExactInfinityPoints();
    assert.equal(runtime.toggleTowerChallenge(2), true, "a cleared TC2 should be replayable");
    assert.equal(debug.state.activeTowerChallenge, 2, "TC2 replay should become active");
    debug.state.scoreLog10 = 1300;
    debug.state.score = Number.MAX_VALUE;
    assert.equal(runtime.completeTowerChallengeIfReady(), true, "TC2 replay should complete at its target");
    assert.equal(debug.state.completedTowerChallenges & 2, 2, "TC2 replay should preserve its reward flag");
    assert.equal(debug.state.infinityCount, 7, "TC2 replay should grant another normal Infinity count");
    assert.ok(runtime.currentExactInfinityPoints() > replayIpBefore, "TC2 replay should grant normal Infinity points");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    debug.state.towerFloor = 13;
    setInfinityPoints(runtime, runtime.MAX_EXACT_INFINITY_POINTS);
    const costLog10 = runtime.towerNextFloorCostLog10();
    const maximumCostLog10 = runtime.log10ExactInfinityPoints(runtime.MAX_EXACT_INFINITY_POINTS);
    assert.ok(costLog10 > maximumCostLog10, "late Tower costs should exceed the exact IP ceiling");
    assert.equal(runtime.canBuildTower(), false, "a cost above the exact IP ceiling should not be affordable");
    assert.equal(debug.buildTower(), false, "an over-ceiling Tower purchase should not spend IP");
    assert.equal(runtime.currentExactInfinityPoints(), runtime.MAX_EXACT_INFINITY_POINTS, "failed Tower purchases should preserve IP");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    debug.state.score = 1e10;
    debug.state.scoreLog10 = 10;
    debug.state.towerFloor = 0;
    assert.equal(runtime.currentScoreLog10(), 10, "Floor 0 should leave effective score unchanged");
    debug.state.towerFloor = 1;
    assert.equal(runtime.currentScoreLog10(), 10.5, "each Tower floor should add ^0.05 to effective score");
    debug.state.towerFloor = 2;
    assert.equal(runtime.currentScoreLog10(), 11, "Tower score exponent should compound with floor count");
    assert.equal(debug.state.scoreLog10, 10, "Tower should not rewrite the raw saved score");
    debug.state.towerFloor = 4;
    runtime.resetBelowInfinity();
    assert.equal(debug.state.towerFloor, 4, "Infinity should preserve Tower progress");
  }

  {
    const source = await loadRuntime(candidatePath);
    source.debug.state.towerFloor = 7;
    source.debug.state.infiniteAngleUnlocked = true;
    source.debug.state.infiniteAngleSpeedLevel = 7;
    source.debug.state.infiniteScoreLog10 = 123;
    source.debug.saveGame("manual");
    const reloaded = await loadRuntime(candidatePath, source.storage);
    assert.equal(reloaded.debug.state.towerFloor, 7, "Tower floor should survive a local save");
    assert.equal(reloaded.debug.state.infiniteAngleSpeedLevel, 7, "IA upgrades should survive a local save");
    assert.equal(reloaded.debug.state.infiniteScoreLog10, 123, "IA log-backed score should survive a local save");

    const saveCode = await source.debug.exportSaveCode();
    const imported = await loadRuntime(candidatePath);
    assert.equal(await imported.debug.importSaveCode(saveCode), true, "Tower and IA save code should import");
    assert.equal(imported.debug.state.towerFloor, 7, "Tower floor should survive save-code import");
    assert.equal(imported.debug.state.infiniteAngleUnlocked, true, "IA unlock should survive save-code import");
    assert.equal(imported.debug.state.infiniteScoreLog10, 123, "IA score log should survive save-code import");

    source.debug.state.towerFloor = 5;
    source.debug.state.activeTowerChallenge = 2;
    source.debug.state.completedTowerChallenges = 2;
    source.debug.state.scoreLog10 = 123;
    source.debug.state.score = Number.MAX_VALUE;
    source.debug.saveGame("manual");
    const challengeReloaded = await loadRuntime(candidatePath, source.storage);
    assert.equal(challengeReloaded.debug.state.activeTowerChallenge, 2, "a replaying Tower Challenge should survive a local save");
    assert.equal(challengeReloaded.debug.state.completedTowerChallenges, 2, "Tower Challenge rewards should survive a local save");
    assert.equal(challengeReloaded.debug.state.scoreLog10, 123, "valid replay progress should survive a local save");
    assert.equal(challengeReloaded.runtime.canCoreBoost(), false, "TC2 restrictions should survive a local save");

    const invalid = await loadRuntime(candidatePath);
    invalid.debug.state.towerFloor = 0;
    invalid.debug.state.activeTowerChallenge = 1;
    invalid.debug.state.scoreLog10 = 123;
    invalid.debug.state.score = Number.MAX_VALUE;
    invalid.debug.state.vertices = 100;
    invalid.debug.state.speedLevel = 4;
    invalid.debug.state.generationCount = 2;
    invalid.debug.state.coreBoostCount = 3;
    invalid.debug.saveGame("manual");
    const invalidReloaded = await loadRuntime(candidatePath, invalid.storage);
    assert.equal(invalidReloaded.debug.state.activeTowerChallenge, 0, "a locked Tower Challenge should be cleared on load");
    assert.equal(invalidReloaded.debug.state.scoreLog10, -Infinity, "invalid Tower Challenge progress should reset Score");
    assert.equal(invalidReloaded.debug.state.vertices, 3, "invalid Tower Challenge progress should reset vertices");
    assert.equal(invalidReloaded.debug.state.speedLevel, 0, "invalid Tower Challenge progress should reset upgrades");
    assert.equal(invalidReloaded.debug.state.generationCount, 0, "invalid Tower Challenge progress should reset Generations");
    assert.equal(invalidReloaded.debug.state.coreBoostCount, 0, "invalid Tower Challenge progress should reset Core Boosts");

    const legacy = await loadRuntime(candidatePath);
    legacy.runtime.applySaveData({ score: 0, scoreLog10: -Infinity }, 10);
    assert.equal(legacy.debug.state.towerFloor, 0, "old saves without Tower data should start at Floor 0");
  }

  console.log("Tower module runtime tests passed");
}

module.exports = { runTowerModuleRuntimeTest };
