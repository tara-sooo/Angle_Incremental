const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

async function runReleaseAudit() {
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
  assert.equal(actual, 0.78, "audit probe expects the current reload regression");
}

module.exports = { runReleaseAudit };
