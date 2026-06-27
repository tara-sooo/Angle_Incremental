const fs = require("node:fs");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");
const reportPath = path.join(__dirname, "..", "immediate-reset-first-infinity-audit-report.json");

// First Infinity is below the Infinity softcap. This aggregation is mathematically
// equivalent for that interval and keeps the policy audit computationally practical.
function installPreInfinityAggregateBatch(runtime) {
  runtime.processManyVertices = function processPreInfinityAggregate(start, end) {
    const count = end - start + 1;
    if (count <= 0) return false;

    const increase = runtime.vertexGainIncrease();
    const events = runtime.coreVertexIndices()
      .map((coreIndex) => {
        const offset = ((coreIndex - (start % runtime.state.vertices)) + runtime.state.vertices) % runtime.state.vertices;
        const hits = offset >= count ? 0 : Math.floor((count - 1 - offset) / runtime.state.vertices) + 1;
        return { hits, firstStep: offset + 1 };
      })
      .filter((event) => event.hits > 0);

    if (events.length > 0) {
      let earned = 0;
      let totalHits = 0;
      let finalStep = 0;
      for (const event of events) {
        earned += runtime.sumCoreHitGains(event.firstStep, event.hits, increase);
        totalHits += event.hits;
        finalStep = Math.max(finalStep, event.firstStep + (event.hits - 1) * runtime.state.vertices);
      }
      const fallbackLog = runtime.log10Value(Math.max(totalHits, 1))
        + runtime.finalScoreGainFromBaseLog10(runtime.gainAfterIncreaseLog10(increase, finalStep));
      if (runtime.addScore(earned, Number.isFinite(earned) ? runtime.log10Value(earned) : fallbackLog)) return true;
    }

    runtime.addCurrentGain(increase * count);
    return false;
  };
}

function runImmediateReset(runtime, debug, priority) {
  if (priority === "generation") {
    if (runtime.canRunGeneration()) {
      debug.runGeneration();
      return "GR";
    }
    if (runtime.canCoreBoost()) {
      debug.runCoreBoost();
      return "CB";
    }
    return null;
  }

  if (runtime.canCoreBoost()) {
    debug.runCoreBoost();
    return "CB";
  }
  if (runtime.canRunGeneration()) {
    debug.runGeneration();
    return "GR";
  }
  return null;
}

async function simulate({ name, priority, buyAllIntervalSeconds, resetPollSeconds = 0.25, maxSeconds = 6 * 60 * 60 }) {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const state = debug.state;
  state.showFloatingText = false;
  state.lightEffects = true;
  installPreInfinityAggregateBatch(runtime);

  let time = 0;
  let nextBuyAll = 0;
  let nextResetPoll = 0;
  let buyAllCalls = 0;
  let generations = 0;
  let coreBoosts = 0;
  const resetTimeline = [];

  while (time < maxSeconds && state.infinityCount === 0) {
    const nextEvent = Math.min(nextBuyAll, nextResetPoll, maxSeconds);
    const delta = Math.max(0, nextEvent - time);
    if (delta > 0) {
      debug.update(delta);
      time = nextEvent;
    }

    if (time + 1e-9 >= nextBuyAll) {
      debug.buyAllUpgrades({ refresh: false, save: false });
      buyAllCalls += 1;
      nextBuyAll += buyAllIntervalSeconds;
    }

    if (time + 1e-9 >= nextResetPoll) {
      const reset = runImmediateReset(runtime, debug, priority);
      if (reset === "GR") generations += 1;
      if (reset === "CB") coreBoosts += 1;
      if (reset) resetTimeline.push({ reset, time });
      nextResetPoll += resetPollSeconds;
    }

    if (nextEvent === maxSeconds) break;
  }

  const firstRun = state.lastInfinityRuns[0] || null;
  return {
    name,
    priority,
    buyAllIntervalSeconds,
    resetPollSeconds,
    reachedInfinity: state.infinityCount > 0,
    firstInfinitySeconds: firstRun ? firstRun.time : null,
    elapsedSeconds: time,
    buyAllCalls,
    generations,
    coreBoosts,
    resetTimeline,
    finalScoreLog10: runtime.currentScoreLog10(),
  };
}

async function runImmediateResetFirstInfinityAudit() {
  const scenarios = [
    {
      name: "generation-priority_buy-all-0.25s",
      priority: "generation",
      buyAllIntervalSeconds: 0.25,
    },
    {
      name: "core-boost-priority_buy-all-0.25s",
      priority: "coreBoost",
      buyAllIntervalSeconds: 0.25,
    },
  ];

  const results = [];
  for (const scenario of scenarios) results.push(await simulate(scenario));

  const report = {
    assumptions: {
      newSave: true,
      noInfinityUpgradesOrAutomation: true,
      buyAllPolicy: "Press Buy All every 0.25 seconds.",
      resetPolicy: "Poll reset buttons every 0.25 seconds and activate the selected priority immediately when available.",
      simultaneousAvailability: "Priority determines whether Generation or Core Boost is clicked first; the resulting reset makes the other unavailable.",
      horizonSeconds: 6 * 60 * 60,
    },
    scenarios: results,
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log("IMMEDIATE_RESET_FIRST_INFINITY_AUDIT", JSON.stringify(results.map((result) => ({
    name: result.name,
    reachedInfinity: result.reachedInfinity,
    firstInfinitySeconds: result.firstInfinitySeconds,
    generations: result.generations,
    coreBoosts: result.coreBoosts,
  }))));
  return report;
}

module.exports = { runImmediateResetFirstInfinityAudit };
