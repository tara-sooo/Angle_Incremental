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
    debug.state.towerFloor = 3;
    assert.equal(runtime.towerChallenge1InfinityScorePowerBonus(), 0, "uncleared TC1 should provide no Infinity Score exponent bonus");
    debug.state.completedTowerChallenges = 1;
    assert.equal(runtime.towerChallenge1InfinityScorePowerBonus(), 0, "TC1 should add no bonus at its unlock floor");
    debug.state.towerFloor = 4;
    assert.equal(runtime.towerChallenge1InfinityScorePowerBonus(), 0.077, "TC1 should add 0.077 at Floor 4");
    debug.state.towerFloor = 5;
    assert.equal(runtime.towerChallenge1InfinityScorePowerBonus(), 0.154, "TC1 should add 0.154 at Floor 5");
    assert.equal(runtime.towerScoreExponent(), 1.25, "TC1 reward should not alter Tower's normal score exponent");
    assert.ok(Math.abs(runtime.infiniteAngleScorePower() - 0.454) < 1e-12, "TC1 bonus should apply to the Infinity Score exponent");
    const iu13 = runtime.infinityUpgradeById("13-1");
    debug.state.infinityUpgradeMask = 1 << iu13.bit;
    assert.ok(Math.abs(runtime.infiniteAngleScorePower() - 0.654) < 1e-12, "TC1 bonus should stack on IU13-1's base exponent");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    debug.state.towerFloor = 22;
    debug.state.completedTowerChallenges = 0;
    assert.equal(runtime.coreBoostRequirementRawGrowthPower(), 2, "uncleared TC2 should keep the base requirement growth power");
    assert.equal(runtime.coreBoostRequirementGrowthPower(), 2, "uncleared TC2 should not apply its reward");
    debug.state.completedTowerChallenges = 2;
    const expectedPowers = new Map([
      [5, 2],
      [6, 1.97],
      [7, 1.94],
      [21, 1.52],
      [22, 1.49],
    ]);
    expectedPowers.forEach((expected, floor) => {
      debug.state.towerFloor = floor;
      assert.equal(runtime.coreBoostRequirementRawGrowthPower(), expected, `Floor ${floor} should use the specified raw TC2 growth power`);
    });
    debug.state.towerFloor = 21;
    assert.equal(runtime.coreBoostRequirementGrowthPower(), 1.52, "the TC2 soft cap should not affect raw powers at or above 1.50");
    debug.state.towerFloor = 22;
    const floor22EffectivePower = runtime.coreBoostRequirementGrowthPower();
    assert.ok(floor22EffectivePower > 1.49 && floor22EffectivePower < 1.5, "Floor 22 should enter the soft-cap region without freezing at 1.50");
    debug.state.towerFloor = 23;
    assert.ok(runtime.coreBoostRequirementGrowthPower() < floor22EffectivePower, "the effective power should continue improving after Floor 22");
    debug.state.coreBoostCount = 1;
    assert.equal(runtime.coreBoostRequirementLog10(), runtime.coreBoostRequirementGrowthPower() * 20, "Core Boost requirements should use the shared effective growth power");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    const ic1 = runtime.infinityUpgradeById("4-1");
    debug.state.infinityUpgradeMask = 1 << ic1.bit;
    debug.state.infinityCount = 1;
    assert.equal(runtime.toggleInfinityChallenge(1), undefined, "IC1 should start through its existing toggle action");
    runtime.advanceOnlineTime(2);
    assert.equal(debug.state.activeChallengeTime, 2, "IC time should start at challenge activation");
    debug.state.scoreLog10 = 309;
    debug.state.score = Number.MAX_VALUE;
    runtime.runInfinity(true);
    assert.equal(debug.state.fastestInfinityChallengeTimes[0], 2, "IC1 should record its first clear time");
    assert.equal(debug.state.activeChallenge, 0, "IC1 should stop after completion");
    assert.equal(runtime.toggleInfinityChallenge(1), undefined, "completed IC1 should be replayable");
    runtime.advanceOnlineTime(1);
    debug.state.scoreLog10 = 309;
    debug.state.score = Number.MAX_VALUE;
    runtime.runInfinity(true);
    assert.equal(debug.state.fastestInfinityChallengeTimes[0], 1, "a faster IC1 replay should replace the record");
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
    runtime.advanceOnlineTime(2);
    assert.equal(debug.state.activeTowerChallengeTime, 2, "TC1 time should start at challenge activation");
    assert.equal(runtime.canBuyNormalUpgrade("speed"), false, "TC1 should seal normal upgrades");
    setInfinityPoints(runtime, runtime.MAX_EXACT_INFINITY_POINTS);
    assert.equal(runtime.sponsoredNormalUpgradeBonusLevel(), 10, "TC1 should divide IU 11-1's effective-level cap by five");
    debug.state.scoreLog10 = 1000;
    debug.state.score = Number.MAX_VALUE;
    assert.equal(runtime.towerChallengeCanComplete(), true, "TC1 should complete at 1e1000 Score");
    assert.equal(runtime.completeTowerChallengeIfReady(), true, "TC1 should perform its dedicated completion reset");
    assert.equal(debug.state.completedTowerChallenges & 1, 1, "TC1 completion should persist its reward flag");
    assert.equal(debug.state.activeTowerChallenge, 0, "TC1 should stop after completion");
    assert.equal(debug.state.infinityCount, 5, "TC1 should not grant Infinity count");
    assert.equal(runtime.currentExactInfinityPoints(), runtime.MAX_EXACT_INFINITY_POINTS, "TC1 should not grant IP");
    assert.equal(debug.state.fastestTowerChallengeTimes[0], 2, "TC1 should record its first clear time");
    assert.equal(debug.state.towerFloor, 3, "TC1 should preserve Tower progress");
    assert.equal(runtime.toggleTowerChallenge(1), true, "a cleared TC1 should be replayable");
    assert.equal(debug.state.activeTowerChallenge, 1, "TC1 replay should become active");
    assert.equal(runtime.canBuyNormalUpgrade("speed"), false, "TC1 restrictions should apply during a replay");
    runtime.advanceOnlineTime(1 / 60);
    debug.state.scoreLog10 = 1000;
    debug.state.score = Number.MAX_VALUE;
    assert.equal(runtime.completeTowerChallengeIfReady(), true, "TC1 replay should complete at its target");
    assert.equal(debug.state.completedTowerChallenges & 1, 1, "TC1 replay should preserve its reward flag");
    assert.equal(debug.state.infinityCount, 5, "TC1 replay should not grant Infinity count");
    assert.equal(runtime.currentExactInfinityPoints(), runtime.MAX_EXACT_INFINITY_POINTS, "TC1 replay should not grant IP");
    assert.equal(debug.state.fastestTowerChallengeTimes[0], 1 / 60, "an immediate TC1 replay should use the minimum recorded time");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    debug.state.towerFloor = 5;
    debug.state.infinityCount = 5;
    debug.state.infinityUpgradeMask = 1 << 14;
    assert.equal(runtime.toggleTowerChallenge(2), true, "TC2 should start at Floor 5");
    assert.equal(debug.state.coreBoostCount, 0, "TC2 should suppress starting Core Boosts as well");
    runtime.advanceOnlineTime(3);
    debug.state.generationScoreMultiplierLog10 = 2.5;
    debug.state.generationScoreMultiplier = 10 ** 2.5;
    assert.equal(runtime.generationScoreMultiplierEffectLog10(), 0.5, "TC2 should raise the GR score multiplier to ^0.1");
    debug.state.generationCostFactor = 0.1;
    assert.equal(runtime.generationCostFactorEffect(), 0.9, "TC2 should impose a hard floor of x0.90 on GR cost");
    debug.state.scoreLog10 = 20;
    debug.state.score = 1e20;
    assert.equal(runtime.canCoreBoost(), false, "TC2 should seal Core Boost");
    debug.state.scoreLog10 = 3000;
    debug.state.score = Number.MAX_VALUE;
    assert.equal(runtime.towerChallengeCanComplete(), true, "TC2 should complete at 1e3000 Score");
    assert.equal(runtime.completeTowerChallengeIfReady(), true, "TC2 should use the normal Infinity completion path");
    assert.equal(debug.state.completedTowerChallenges & 2, 2, "TC2 completion should persist its reward flag");
    assert.equal(debug.state.activeTowerChallenge, 0, "TC2 should stop after completion");
    assert.equal(debug.state.infinityCount, 6, "TC2 should grant the normal Infinity count reward");
    const replayIpBefore = runtime.currentExactInfinityPoints();
    assert.equal(runtime.toggleTowerChallenge(2), true, "a cleared TC2 should be replayable");
    assert.equal(debug.state.activeTowerChallenge, 2, "TC2 replay should become active");
    runtime.advanceOnlineTime(1);
    debug.state.scoreLog10 = 3000;
    debug.state.score = Number.MAX_VALUE;
    assert.equal(runtime.completeTowerChallengeIfReady(), true, "TC2 replay should complete at its target");
    assert.equal(debug.state.completedTowerChallenges & 2, 2, "TC2 replay should preserve its reward flag");
    assert.equal(debug.state.infinityCount, 7, "TC2 replay should grant another normal Infinity count");
    assert.ok(runtime.currentExactInfinityPoints() > replayIpBefore, "TC2 replay should grant normal Infinity points");
    assert.ok(debug.state.fastestTowerChallengeTimes[1] > 0, "TC2 should record its clear time");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    assert.equal(runtime.towerChallengeTargetLog10(1), 1000, "TC1 should target e1000 Score");
    assert.equal(runtime.towerChallengeTargetLog10(2), 3000, "TC2 should target e3000 Score");
    assert.equal(runtime.towerChallengeTargetLog10(3), 5000, "TC3 should target e5000 Score");
    assert.equal(runtime.towerChallengeTargetLog10(4), Infinity, "TC4 completion target should remain deferred");
    assert.equal(runtime.towerChallengeImplemented(3), true, "TC3 should be implemented");
    assert.equal(runtime.towerChallengeImplemented(4), true, "TC4 lifecycle should be implemented");
    debug.state.infinityCount = 0;
    assert.equal(runtime.towerChallenge3ScoreGainPower(), 0.001, "TC3 should start Score gain at ^0.001");
    assert.equal(runtime.towerChallenge3InfinityScorePower(), 0.1, "TC3 should start Infinity Score gain at ^0.1");
    debug.state.infinityCount = 600000;
    assert.equal(runtime.towerChallenge3ScoreGainPower(), 0.8, "TC3 should relax Score gain to ^0.8 at 600000 Infinity");
    assert.equal(runtime.towerChallenge3InfinityScorePower(), 0.5, "TC3 should relax Infinity Score gain to ^0.5 at 600000 Infinity");
    debug.state.infinityCount = 1200000;
    assert.ok(runtime.towerChallenge3ScoreGainPower() > 0.8 && runtime.towerChallenge3ScoreGainPower() < 1, "TC3 Score gain should soft-cap above 600000 Infinity");
    assert.ok(
      Math.abs(runtime.towerChallenge3InfinityScorePower() - (0.5 + 0.5 * 600000 / 1350000)) < 1e-12,
      "TC3 Infinity Score gain should use the continuous 750000 post-target span",
    );
    debug.state.activeTowerChallenge = 3;
    debug.state.infinityCount = 0;
    assert.equal(runtime.finalScoreGainPower(), 0.001, "TC3 should compress active Score gain");
    assert.equal(runtime.infiniteAngleScoreGainLog10(100), 10, "TC3 should compress generated Infinity Score");
    debug.state.infinityCount = 600000;
    assert.equal(runtime.finalScoreGainPower(), 0.8, "TC3 Score compression should use the relaxed power");
    assert.equal(runtime.infiniteAngleScoreGainLog10(100), 50, "TC3 Infinity Score compression should use the relaxed power");
    debug.state.towerFloor = 4;
    debug.state.completedTowerChallenges = 1;
    debug.state.infinityCount = 0;
    const iu13 = runtime.infinityUpgradeById("13-1");
    debug.state.infinityUpgradeMask = 1 << iu13.bit;
    const generatedInfinityScoreLog10 = runtime.infiniteAngleScoreGainLog10(100);
    debug.state.infiniteScoreLog10 = generatedInfinityScoreLog10;
    debug.state.infiniteScore = 10 ** generatedInfinityScoreLog10;
    assert.equal(generatedInfinityScoreLog10, 10, "TC3 should compress the generated Infinity Score before boost effects");
    assert.ok(
      Math.abs(runtime.infiniteAngleBoostLog10() - 10 * (0.5 + 0.077)) < 1e-12,
      "TC1 and IU13-1 should apply to the generated TC3 Infinity Score in the final boost",
    );
    debug.state.activeTowerChallenge = 0;
    debug.state.towerFloor = 13;
    debug.state.completedTowerChallenges = 0;
    debug.state.speedLevel = 100;
    debug.state.gainLevel = 100;
    debug.state.vertices = 103;
    const savedPurchaseCosts = runtime.costLogs();
    assert.equal(runtime.towerNormalUpgradeMultiplier(), 1, "uncleared TC3 should not enhance normal upgrades");
    assert.equal(runtime.effectiveSpeedLevel(), 100, "uncleared TC3 should preserve Speed levels");
    assert.equal(runtime.effectiveGainLevel(), 100, "uncleared TC3 should preserve Gain levels");
    assert.equal(runtime.effectiveVertexCount(), 103, "uncleared TC3 should preserve purchased vertices");
    debug.state.completedTowerChallenges = 4;
    assert.ok(Math.abs(runtime.towerNormalUpgradeMultiplier() - 1.2762815625) < 1e-12, "Floor 13 should use the TC3 x1.2762815625 multiplier");
    assert.ok(Math.abs(runtime.effectiveSpeedLevel() - 127.62815625) < 1e-12, "TC3 should scale Speed purchases without rounding");
    assert.ok(Math.abs(runtime.effectiveGainLevel() - 127.62815625) < 1e-12, "TC3 should scale Gain purchases without rounding");
    assert.equal(runtime.effectiveVertexCount(), 130, "TC3 should floor scaled purchased vertices while preserving the base three");
    assert.deepEqual(runtime.costLogs(), savedPurchaseCosts, "TC3 should not change normal upgrade purchase costs");
    const iu11 = runtime.infinityUpgradeById("11-1");
    debug.state.infinityUpgradeMask = 1 << iu11.bit;
    setInfinityPoints(runtime, runtime.MAX_EXACT_INFINITY_POINTS);
    assert.ok(Math.abs(runtime.effectiveSpeedLevel() - 177.62815625) < 1e-12, "IU11-1 should add after TC3 scales Speed purchases");
    assert.equal(runtime.effectiveVertexCount(), 180, "IU11-1 should add after TC3 scales Vertex purchases");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    debug.state.towerFloor = 8;
    debug.state.infinityCount = 12;
    assert.equal(runtime.toggleTowerChallenge(3), true, "TC3 should start at Floor 8");
    assert.equal(debug.state.activeTowerChallenge, 3, "TC3 should become active");
    assert.equal(debug.state.infinityCount, 12, "starting TC3 should preserve Infinity count");
    debug.state.scoreLog10 = 5000;
    debug.state.score = Number.MAX_VALUE;
    assert.equal(runtime.towerChallengeCanComplete(), true, "TC3 should complete at 1e5000 Score");
    assert.equal(runtime.completeTowerChallengeIfReady(), true, "TC3 should use the normal Infinity completion path");
    assert.equal(debug.state.completedTowerChallenges & 4, 4, "TC3 completion should persist its reward flag");
    assert.equal(debug.state.activeTowerChallenge, 0, "TC3 should stop after completion");
    assert.equal(debug.state.infinityCount, 13, "TC3 should grant the normal Infinity count reward");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    debug.state.towerFloor = 12;
    debug.state.infiniteAngleUnlocked = true;
    debug.state.infiniteAngleSpeedLevel = 4;
    debug.state.infiniteAngleVertexLevel = 3;
    debug.state.infiniteAngleGainLevel = 2;
    setInfinityPoints(runtime, runtime.MAX_EXACT_INFINITY_POINTS);
    assert.equal(runtime.towerChallengeUnlocked(4), true, "TC4 should unlock at Floor 12");
    assert.equal(runtime.toggleTowerChallenge(4), true, "TC4 should start at Floor 12");
    assert.equal(debug.state.activeTowerChallenge, 4, "TC4 should become active");
    assert.equal(debug.state.infiniteAngleSpeedLevel, 0, "TC4 entry should reset IA Speed");
    assert.equal(debug.state.infiniteAngleVertexLevel, 0, "TC4 entry should reset IA Vertex");
    assert.equal(debug.state.infiniteAngleGainLevel, 0, "TC4 entry should reset IA Gain");

    debug.state.scoreLog10 = 1000;
    debug.state.score = Number.MAX_VALUE;
    assert.equal(runtime.buyAllUpgrades({ refresh: false, save: false }), 3, "TC4 buy-max should allow one level of each normal upgrade");
    assert.equal(debug.state.speedLevel, 1, "TC4 should allow normal Speed level 1");
    assert.equal(debug.state.vertices, 4, "TC4 should allow normal Vertex level 1");
    assert.equal(debug.state.gainLevel, 1, "TC4 should allow normal Gain level 1");
    assert.equal(runtime.spendNormalUpgrade("speed"), false, "TC4 should block manual normal upgrades above level 1");
    assert.equal(runtime.buyAllUpgrades({ refresh: false, save: false }), 0, "TC4 should block repeated normal buy-max purchases");

    assert.equal(runtime.buyAllInfiniteAngleUpgrades({ refresh: false, save: false }), 3, "TC4 IA buy-max should allow one level of each upgrade");
    assert.equal(debug.state.infiniteAngleSpeedLevel, 1, "TC4 should allow IA Speed level 1");
    assert.equal(debug.state.infiniteAngleVertexLevel, 1, "TC4 should allow IA Vertex level 1");
    assert.equal(debug.state.infiniteAngleGainLevel, 1, "TC4 should allow IA Gain level 1");
    assert.equal(runtime.buyInfiniteAngleUpgrade("speed", { refresh: false, save: false }), false, "TC4 should block manual IA upgrades above level 1");
    assert.equal(runtime.buyAllInfiniteAngleUpgrades({ refresh: false, save: false }), 0, "TC4 should block repeated IA buy-max purchases");

    assert.equal(runtime.toggleTowerChallenge(4), true, "TC4 should be stoppable");
    assert.equal(debug.state.activeTowerChallenge, 0, "stopping TC4 should clear the active challenge");
    debug.state.scoreLog10 = 1000;
    debug.state.score = Number.MAX_VALUE;
    setInfinityPoints(runtime, runtime.MAX_EXACT_INFINITY_POINTS);
    assert.equal(runtime.canBuyNormalUpgrade("speed"), true, "normal upgrade eligibility should return after TC4");
    assert.equal(runtime.canBuyInfiniteAngleUpgrade("speed"), true, "IA upgrade eligibility should return after TC4");
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
    source.debug.state.activeTowerChallengeTime = 4;
    source.debug.state.fastestInfinityChallengeTimes = [1, 2, 3, 4, 5, 6, 7, 8];
    source.debug.state.fastestTowerChallengeTimes = [9, 10, 11, 12];
    source.debug.state.scoreLog10 = 123;
    source.debug.state.score = Number.MAX_VALUE;
    source.debug.saveGame("manual");
    const challengeReloaded = await loadRuntime(candidatePath, source.storage);
    assert.equal(challengeReloaded.debug.state.activeTowerChallenge, 2, "a replaying Tower Challenge should survive a local save");
    assert.equal(challengeReloaded.debug.state.completedTowerChallenges, 2, "Tower Challenge rewards should survive a local save");
    assert.ok(challengeReloaded.debug.state.activeTowerChallengeTime >= 4, "active challenge time should survive a local save");
    assert.deepEqual(Array.from(challengeReloaded.debug.state.fastestInfinityChallengeTimes), [1, 2, 3, 4, 5, 6, 7, 8], "IC fastest times should survive a local save");
    assert.deepEqual(Array.from(challengeReloaded.debug.state.fastestTowerChallengeTimes), [9, 10, 11, 12], "TC fastest times should survive a local save");
    assert.equal(challengeReloaded.debug.state.scoreLog10, 123, "valid replay progress should survive a local save");
    assert.equal(challengeReloaded.runtime.canCoreBoost(), false, "TC2 restrictions should survive a local save");
    assert.equal(challengeReloaded.runtime.coreBoostRequirementRawGrowthPower(), 2, "TC2 reward scaling should use the saved Tower floor");
    assert.equal(challengeReloaded.runtime.coreBoostRequirementGrowthPower(), 2, "TC2 reward scaling should survive a local save");

    source.debug.state.towerFloor = 12;
    source.debug.state.activeTowerChallenge = 4;
    source.debug.state.completedTowerChallenges = 3;
    source.debug.state.activeTowerChallengeTime = 6;
    source.debug.state.infiniteAngleSpeedLevel = 1;
    source.debug.state.infiniteAngleVertexLevel = 1;
    source.debug.state.infiniteAngleGainLevel = 1;
    source.debug.saveGame("manual");
    const tc4Reloaded = await loadRuntime(candidatePath, source.storage);
    assert.equal(tc4Reloaded.debug.state.activeTowerChallenge, 4, "an active TC4 run should survive a local save");
    assert.equal(tc4Reloaded.debug.state.completedTowerChallenges, 3, "existing TC completion bits should survive a TC4 save");
    assert.ok(tc4Reloaded.debug.state.activeTowerChallengeTime >= 6, "active TC4 time should survive a local save");
    assert.equal(tc4Reloaded.debug.state.infiniteAngleSpeedLevel, 1, "valid TC4 IA levels should survive a local save");

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

    const invalidIc = await loadRuntime(candidatePath);
    invalidIc.debug.state.activeChallenge = 1;
    invalidIc.debug.state.activeChallengeTime = 12;
    invalidIc.debug.saveGame("manual");
    const invalidIcReloaded = await loadRuntime(candidatePath, invalidIc.storage);
    assert.equal(invalidIcReloaded.debug.state.activeChallenge, 0, "a locked Infinity Challenge should be cleared on load");
    assert.equal(invalidIcReloaded.debug.state.activeChallengeTime, 0, "an invalid Infinity Challenge should clear its timer on load");

    const legacy = await loadRuntime(candidatePath);
    legacy.runtime.applySaveData({ score: 0, scoreLog10: -Infinity }, 10);
    assert.equal(legacy.debug.state.towerFloor, 0, "old saves without Tower data should start at Floor 0");
    assert.deepEqual(Array.from(legacy.debug.state.fastestInfinityChallengeTimes), Array(8).fill(0), "old saves should default IC fastest times");
    assert.deepEqual(Array.from(legacy.debug.state.fastestTowerChallengeTimes), Array(4).fill(0), "old saves should default TC fastest times");
  }

  console.log("Tower module runtime tests passed");
}

module.exports = { runTowerModuleRuntimeTest };
