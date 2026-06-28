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
    state.infinityUpgradeMask = purchasedMaskThrough(12);
    state.automationEnabled = true;
    state.autoRunInfinity = true;
    state.autoInfinityPointThreshold = 10;
    state.infinityCount = 1;
    setLogResource(state, "score", 320);
    assert.equal(runtime.runLayerAutomation(), true, "IU 8-1 must expose and run layer automation");
    assert.equal(state.infinityCount > 1, true, "layer automation must run Infinity when the IP threshold is met");
  }
}

module.exports = { runNewInfinityUpgradesModuleRuntimeTest };
