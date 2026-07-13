const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

function setInfinityPoints(runtime, amount) {
  runtime.syncInfinityPointCachesFromExact(BigInt(amount));
}

function resetInfiniteAngleState(state) {
  state.infiniteScore = 0;
  state.infiniteScoreLog10 = -Infinity;
  state.infiniteAngleCurrentGain = 1;
  state.infiniteAngleCurrentGainLog10 = 0;
  state.infiniteAnglePointProgress = 0;
  state.infiniteAngleTotalVertexProgress = 0;
  state.infiniteAngleLastVertexIndex = 0;
}

async function runInfiniteAngleModuleRuntimeTest() {
  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    const { state } = debug;
    setInfinityPoints(runtime, 100000000000000000000n);

    assert.equal(debug.unlockInfiniteAngle(), true, "IA should unlock at exactly 1e20 IP");
    assert.equal(state.infiniteAngleUnlocked, true, "IA unlock should persist in state");
    assert.equal(state.infinityPointsExact, "0", "IA unlock should spend exactly 1e20 IP");
    assert.equal(runtime.infiniteAngleBoost(), 1, "an empty Infinity Score should be a neutral boost");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    runtime.applySaveData({
      infiniteScore: 10,
      infiniteScoreLog10: 1,
    }, 10);
    assert.equal(debug.state.infiniteAngleUnlocked, true, "legacy Infinite Score saves should migrate to unlocked IA");
    assert.equal(debug.state.infiniteScoreLog10, 1, "legacy Infinite Score should remain IA Score");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    const { state } = debug;
    state.infiniteAngleUnlocked = true;
    state.speedLevel = 7;
    state.gainLevel = 8;
    state.vertices = 11;
    setInfinityPoints(runtime, 100);

    assert.equal(debug.buyInfiniteAngleUpgrade("speed"), true, "IA speed upgrade should be payable with IP");
    assert.equal(debug.buyInfiniteAngleUpgrade("vertex"), true, "IA vertex upgrade should be payable with IP");
    assert.equal(debug.buyInfiniteAngleUpgrade("gain"), true, "IA gain upgrade should be payable with IP");
    assert.equal(state.infiniteAngleSpeedLevel, 1, "IA speed level should increase independently");
    assert.equal(state.infiniteAngleVertexLevel, 1, "IA vertex level should increase independently");
    assert.equal(state.infiniteAngleGainLevel, 1, "IA gain level should increase independently");
    assert.equal(runtime.infiniteAngleVertexCount(), 4, "IA vertex upgrades should add one IA vertex");
    assert.equal(state.speedLevel, 7, "IA speed upgrades must not change TA speed level");
    assert.equal(state.gainLevel, 8, "IA gain upgrades must not change TA gain level");
    assert.equal(state.vertices, 11, "IA vertex upgrades must not change TA vertices");
    assert.equal(runtime.currentExactInfinityPoints(), 65n, "IA upgrades should spend their independent IP costs");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    const { state } = debug;
    state.infiniteAngleUnlocked = true;
    state.infiniteAngleSpeedLevel = 0;
    state.infiniteAngleVertexLevel = 0;
    state.infiniteAngleGainLevel = 0;
    resetInfiniteAngleState(state);
    state.scoreLog10 = 7;
    state.totalScoreLog10 = 7;
    state.generationScoreLog10 = 7;
    state.generationCount = 4;
    state.coreBoostCount = 3;
    state.speedLevel = 7;
    state.gainLevel = 8;
    state.vertices = 12;

    const scoreBefore = runtime.currentInfiniteScoreLog10();
    debug.updateInfiniteAngle(runtime.infiniteAngleLapDuration());
    assert.ok(runtime.currentInfiniteScoreLog10() > scoreBefore, "IA should earn Infinity Score continuously");
    assert.equal(state.infiniteAnglePointProgress, 0, "one IA lap should return to the first vertex");
    assert.equal(state.generationCount, 4, "IA progression must not use Generation state");
    assert.equal(state.coreBoostCount, 3, "IA progression must not use Core Boost state");
    assert.equal(state.scoreLog10, 7, "IA progression must not change TA score");

    state.infiniteScore = 10;
    state.infiniteScoreLog10 = 1;
    assert.ok(Math.abs(runtime.infiniteAngleBoost() - 10 ** 0.3) < 1e-12, "IA boost should be Infinity Score^0.3");

    state.generationCount = 0;
    state.coreBoostCount = 0;
    state.speedLevel = 0;
    state.gainLevel = 0;
    state.vertices = 3;
    state.infinityCount = 0;
    state.infinityUpgradeMask = 0;
    state.achievementMask = 0;
    assert.ok(
      Math.abs(runtime.vertexGainIncrease() - 0.01 * 10 ** 0.3) < 1e-12,
      "Infinity Score^0.3 should multiply TA vertex gain",
    );

    state.infiniteAngleSpeedLevel = 1_000_000_000_000;
    debug.updateInfiniteAngle(1 / 60);
    assert.equal(Number.isFinite(state.infiniteAngleTotalVertexProgress), true, "extreme IA speed must keep progress finite");
    assert.equal(Number.isFinite(state.infiniteAnglePointProgress), true, "extreme IA speed must keep point progress finite");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    const { state } = debug;
    state.infiniteAngleUnlocked = true;
    state.infiniteAngleSpeedLevel = 4;
    state.infiniteAngleVertexLevel = 5;
    state.infiniteAngleGainLevel = 6;
    state.infiniteAngleCurrentGain = 123;
    state.infiniteAngleCurrentGainLog10 = Math.log10(123);
    state.infiniteAnglePointProgress = 0.5;
    state.infiniteAngleTotalVertexProgress = 7.5;
    state.infiniteAngleLastVertexIndex = 2;
    state.infiniteScore = 1e12;
    state.infiniteScoreLog10 = 12;

    runtime.resetBelowInfinity();
    assert.equal(state.infiniteAngleUnlocked, true, "Infinity should preserve the IA unlock");
    assert.equal(state.infiniteAngleSpeedLevel, 4, "Infinity should preserve IA speed upgrades");
    assert.equal(state.infiniteAngleVertexLevel, 5, "Infinity should preserve IA vertex upgrades");
    assert.equal(state.infiniteAngleGainLevel, 6, "Infinity should preserve IA gain upgrades");
    assert.equal(state.infiniteScoreLog10, -Infinity, "Infinity should reset Infinity Score");
    assert.equal(state.infiniteAngleCurrentGainLog10, 0, "Infinity should reset IA current gain");
    assert.equal(state.infiniteAnglePointProgress, 0, "Infinity should reset IA point progress");
    assert.equal(state.infiniteAngleTotalVertexProgress, 0, "Infinity should reset IA vertex progress");
    assert.equal(state.infiniteAngleLastVertexIndex, 0, "Infinity should reset IA vertex index");
  }

  {
    const source = await loadRuntime(candidatePath);
    const { debug } = source;
    debug.state.infiniteAngleUnlocked = true;
    debug.state.infiniteAngleSpeedLevel = 3;
    debug.state.infiniteAngleVertexLevel = 2;
    debug.state.infiniteAngleGainLevel = 4;
    debug.state.infiniteScore = 42;
    debug.state.infiniteScoreLog10 = Math.log10(42);
    debug.state.infiniteAngleCurrentGain = 17;
    debug.state.infiniteAngleCurrentGainLog10 = Math.log10(17);
    debug.saveGame("manual");

    const reloaded = await loadRuntime(candidatePath, source.storage);
    assert.equal(reloaded.debug.state.infiniteAngleUnlocked, true, "IA unlock should survive a local save");
    assert.equal(reloaded.debug.state.infiniteAngleSpeedLevel, 3, "IA speed level should survive a local save");
    assert.equal(reloaded.debug.state.infiniteAngleVertexLevel, 2, "IA vertex level should survive a local save");
    assert.equal(reloaded.debug.state.infiniteAngleGainLevel, 4, "IA gain level should survive a local save");
    assert.equal(reloaded.debug.state.infiniteScoreLog10, Math.log10(42), "IA Score should survive a local save");
    assert.equal(reloaded.debug.state.infiniteAngleCurrentGainLog10, Math.log10(17), "IA current gain should survive a local save");
  }

  console.log("Infinite Angle module runtime tests passed");
}

module.exports = { runInfiniteAngleModuleRuntimeTest };
