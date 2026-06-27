const fs = require("node:fs");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");
const reportPath = path.join(__dirname, "..", "first-infinity-strategy-search-report.json");
const ACTION_INTERVAL_SECONDS = 0.25;
const BASELINE_CUTOFF_SECONDS = 2125.25;

function currentLog(runtime, key) {
  return runtime.currentLog10ForValue(runtime.state[key], runtime.state[`${key}Log10`]);
}

function installPreInfinityAggregateBatch(runtime) {
  runtime.processManyVertices = function aggregatePreInfinityVertices(start, end) {
    const count = end - start + 1;
    if (count <= 0) return false;
    const increase = runtime.vertexGainIncrease();
    const coreEvents = runtime.coreVertexIndices()
      .map((coreIndex) => {
        const offset = ((coreIndex - (start % runtime.state.vertices)) + runtime.state.vertices) % runtime.state.vertices;
        const hits = offset >= count ? 0 : Math.floor((count - 1 - offset) / runtime.state.vertices) + 1;
        return { firstStep: offset + 1, hits };
      })
      .filter((event) => event.hits > 0);
    if (coreEvents.length > 0) {
      let earned = 0;
      let totalHits = 0;
      let lastStep = 0;
      for (const event of coreEvents) {
        earned += runtime.sumCoreHitGains(event.firstStep, event.hits, increase);
        totalHits += event.hits;
        lastStep = Math.max(lastStep, event.firstStep + (event.hits - 1) * runtime.state.vertices);
      }
      const fallbackLog = runtime.log10Value(Math.max(totalHits, 1))
        + runtime.finalScoreGainFromBaseLog10(runtime.gainAfterIncreaseLog10(increase, lastStep));
      if (runtime.addScore(earned, Number.isFinite(earned) ? runtime.log10Value(earned) : fallbackLog)) return true;
    }
    runtime.addCurrentGain(increase * count);
    return false;
  };
}

function buyByMode(debug, mode) {
  if (mode === "all") return debug.buyAllUpgrades({ refresh: false, save: false });
  if (mode === "speed-gain") return debug.buyAllUpgrades({ refresh: false, save: false, allowVertex: false });
  if (mode === "speed-vertex") return debug.buyAllUpgrades({ refresh: false, save: false, allowGain: false });
  if (mode === "vertex-gain") return debug.buyAllUpgrades({ refresh: false, save: false, allowSpeed: false });
  throw new Error(`Unknown purchase mode: ${mode}`);
}
