const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

async function runReleaseAudit() {
  {
    const save = {
      version: 7,
      state: {
        infinityUpgradeMask: 1 << 9,
        generationCostFactor: 0.70,
      },
    };
    const storage = new Map([["angle-incremental-save", JSON.stringify(save)]]);
    const instance = await loadRuntime(candidatePath, storage);
    const actual = instance.debug.state.generationCostFactor;
    console.log(`AUDIT_IU6_2_RELOAD_FACTOR=${actual}`);
    assert.equal(actual, 0.70, "IU6-2 must preserve its 0.70 Generation cost-factor floor after reload");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { runtime } = instance;
    const { state } = instance.debug;
    state.infinityUpgradeMask = 1 << 7;
    state.score = 1e20;
    state.scoreLog10 = 20;
    runtime.runCoreBoost();
    console.log(`AUDIT_IU5_2_CORE_RESET_SCORE_LOG10=${state.scoreLog10}`);
    assert.equal(state.scoreLog10, 2, "IU5-2 must apply its 100-score start after Core Boost");
  }
}

module.exports = { runReleaseAudit };
