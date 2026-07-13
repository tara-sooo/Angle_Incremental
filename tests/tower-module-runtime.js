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
    source.debug.saveGame("manual");
    const reloaded = await loadRuntime(candidatePath, source.storage);
    assert.equal(reloaded.debug.state.towerFloor, 7, "Tower floor should survive a local save");

    const legacy = await loadRuntime(candidatePath);
    legacy.runtime.applySaveData({ score: 0, scoreLog10: -Infinity }, 10);
    assert.equal(legacy.debug.state.towerFloor, 0, "old saves without Tower data should start at Floor 0");
  }

  console.log("Tower module runtime tests passed");
}

module.exports = { runTowerModuleRuntimeTest };
