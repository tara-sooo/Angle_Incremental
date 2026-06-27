const fs = require("node:fs");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");
const reportPath = path.join(__dirname, "..", "general-first-infinity-audit-report.json");

function logResource(runtime, key) {
  return runtime.currentLog10ForValue(runtime.state[key], runtime.state[`${key}Log10`]);
}

// Used only for policy sweeps before first Infinity, when Infinity softcap is inactive.
function installFastPreInfinityBatch(runtime) {
  runtime.processManyVertices = function fastPreInfinityBatch(start, end) {
    const count = end - start + 1;
    if (count <= 0) return false;
    const increase = runtime.vertexGainIncrease();
    const coreBatches = runtime.coreVertexIndices()
      .map((coreIndex) => {
        const offset = ((coreIndex - (start % runtime.state.vertices)) + runtime.state.vertices) % runtime.state.vertices;
        const hits = offset >= count ? 0 : Math.floor((count - 1 - offset) / runtime.state.vertices) + 1;
        return { hits, firstStep: offset + 1 };
      })
      .filter((batch) => batch.hits > 0);

    if (coreBatches.length > 0) {
      let earned = 0;
      let hitCount = 0;
      let lastStep = 0;
      for (const batch of coreBatches) {
        earned += runtime.sumCoreHitGains(batch.firstStep, batch.hits, increase);
        hitCount += batch.hits;
        lastStep = Math.max(lastStep, batch.firstStep + (batch.hits - 1) * runtime.state.vertices);
      }
      const fallbackLog = runtime.log10Value(Math.max(1, hitCount))
        + runtime.finalScoreGainFromBaseLog10(runtime.gainAfterIncreaseLog10(increase, lastStep));
      if (runtime.addScore(earned, Number.isFinite(earned) ? runtime.log10Value(earned) : fallbackLog)) return true;
    }

    runtime.addCurrentGain(increase * count);
    return false;
  };
}

function chooseReset(runtime, policy) {
  const canGeneration = runtime.canRunGeneration();
  const canCoreBoost = runtime.canCoreBoost();
  if (policy === "none") return null;
  if (policy === "generation-only") return canGeneration ? "GR" : null;
  if (policy === "core-only") return canCoreBoost ? "CB" : null;
  if (policy === "immediate-gr") {
    if (canGeneration) return "GR";
    return canCoreBoost ? "CB" : null;
  }
  if (policy === "immediate-cb") {
    if (canCoreBoost) return "CB";
    return canGeneration ? "GR" : null;
  }
  if (policy === "strategic-d20") {
    if (canCoreBoost) return "CB";
    const requirement = runtime.generationRequirementLog10();
    return canGeneration && logResource(runtime, "generationScore") >= requirement + 20 ? "GR" : null;
  }
  throw new Error(`Unknown reset policy: ${policy}`);
}

async function simulate(scenario) {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const state = debug.state;
  state.showFloatingText = false;
  state.lightEffects = true;
  installFastPreInfinityBatch(runtime);

  const actionInterval = scenario.actionIntervalSeconds;
  const maxSeconds = scenario.maxSeconds || 6 * 60 * 60;
  let time = 0;
  let nextAction = 0;
  let buyAllCalls = 0;
  let generations = 0;
  let coreBoosts = 0;
  let firstGenerationTime = null;
  let firstCoreBoostTime = null;

  while (time < maxSeconds && state.infinityCount === 0) {
    if (time + 1e-9 >= nextAction) {
      debug.buyAllUpgrades({ refresh: false, save: false });
      buyAllCalls += 1;
      const reset = chooseReset(runtime, scenario.resetPolicy);
      if (reset === "GR") {
        debug.runGeneration();
        generations += 1;
        if (firstGenerationTime === null) firstGenerationTime = time;
      } else if (reset === "CB") {
        debug.runCoreBoost();
        coreBoosts += 1;
        if (firstCoreBoostTime === null) firstCoreBoostTime = time;
      }
      nextAction += actionInterval;
    }
    const dt = Math.min(actionInterval, maxSeconds - time);
    debug.update(dt);
    time += dt;
  }

  const run = state.lastInfinityRuns[0] || null;
  return {
    ...scenario,
    reachedInfinity: state.infinityCount > 0,
    firstInfinitySeconds: run ? run.time : null,
    elapsedSeconds: time,
    buyAllCalls,
    generations,
    coreBoosts,
    firstGenerationTime,
    firstCoreBoostTime,
    finalScoreLog10: runtime.currentScoreLog10(),
  };
}

async function runGeneralFirstInfinityAudit() {
  const scenarios = [
    {
      name: "button-chaser_cb-priority_3s",
      description: "Reads reset buttons and presses whichever reset is currently available; Core Boost takes precedence.",
      actionIntervalSeconds: 3,
      resetPolicy: "immediate-cb",
    },
    {
      name: "button-chaser_gr-priority_3s",
      description: "Reads reset buttons and presses whichever reset is currently available; Generation takes precedence.",
      actionIntervalSeconds: 3,
      resetPolicy: "immediate-gr",
    },
    {
      name: "button-chaser_cb-priority_10s",
      description: "Same as above, but checks upgrades and resets only every 10 seconds.",
      actionIntervalSeconds: 10,
      resetPolicy: "immediate-cb",
    },
    {
      name: "button-chaser_gr-priority_10s",
      description: "Same as above, but checks upgrades and resets only every 10 seconds.",
      actionIntervalSeconds: 10,
      resetPolicy: "immediate-gr",
    },
    {
      name: "button-chaser_cb-priority_30s",
      description: "Checks the game every 30 seconds and resets immediately when a button is available.",
      actionIntervalSeconds: 30,
      resetPolicy: "immediate-cb",
    },
    {
      name: "core-only_10s",
      description: "Uses Core Boost when noticed, but does not understand or use Generation.",
      actionIntervalSeconds: 10,
      resetPolicy: "core-only",
    },
    {
      name: "generation-only_10s",
      description: "Uses Generation immediately, but never uses Core Boost.",
      actionIntervalSeconds: 10,
      resetPolicy: "generation-only",
    },
    {
      name: "no-reset_30s",
      description: "Uses Buy All occasionally but never notices the reset systems.",
      actionIntervalSeconds: 30,
      resetPolicy: "none",
    },
    {
      name: "informed-reference_d20_3s",
      description: "Reference policy: wait until Generation Score is requirement +20 log, use Core Boost immediately.",
      actionIntervalSeconds: 3,
      resetPolicy: "strategic-d20",
    },
  ];

  const results = [];
  for (const scenario of scenarios) results.push(await simulate(scenario));
  const report = {
    assumptions: {
      newSave: true,
      noInfinityUpgradesOrAutomation: true,
      actionModel: "At every action interval: press Buy All, then apply the scenario's reset rule once.",
      horizonSeconds: 21600,
      caveat: "This is a deterministic policy model, not telemetry from human players.",
    },
    scenarios: results,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log("GENERAL_FIRST_INFINITY_AUDIT", JSON.stringify(results.map((result) => ({
    name: result.name,
    reachedInfinity: result.reachedInfinity,
    seconds: result.firstInfinitySeconds,
    generations: result.generations,
    coreBoosts: result.coreBoosts,
  }))));
  return report;
}

module.exports = { runGeneralFirstInfinityAudit };
