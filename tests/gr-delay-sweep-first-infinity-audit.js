const fs = require("node:fs");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");
const reportPath = path.join(__dirname, "..", "gr-delay-sweep-first-infinity-audit-report.json");

// The first-Infinity interval never applies the Infinity score softcap. This
// aggregates normal core hits for a practical policy sweep; the live exact
// batching algorithm is covered separately by numeric stability regression.
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

async function simulateGenerationDelay(generationDelaySeconds) {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const state = debug.state;
  state.showFloatingText = false;
  state.lightEffects = true;
  runtime.saveGame = () => {};
  installPreInfinityAggregateBatch(runtime);

  const buyAllIntervalSeconds = 0.25;
  const resetPollSeconds = 0.25;
  const horizonSeconds = 6 * 60 * 60;
  let time = 0;
  let nextBuyAll = 0;
  let nextResetPoll = 0;
  let generationReadySince = null;
  let buyAllCalls = 0;
  let generations = 0;
  let coreBoosts = 0;
  let interruptedGenerationWaits = 0;
  const generationWaits = [];

  while (time < horizonSeconds && state.infinityCount === 0) {
    const nextEvent = Math.min(nextBuyAll, nextResetPoll, horizonSeconds);
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
      // Core Boost remains immediate. It resets a pending Generation timer,
      // because the run has been reset and Generation must become available again.
      if (runtime.canCoreBoost()) {
        if (generationReadySince !== null) interruptedGenerationWaits += 1;
        debug.runCoreBoost();
        coreBoosts += 1;
        generationReadySince = null;
      } else if (runtime.canRunGeneration()) {
        if (generationReadySince === null) generationReadySince = time;
        const waited = time - generationReadySince;
        if (waited + 1e-9 >= generationDelaySeconds) {
          debug.runGeneration();
          generations += 1;
          generationWaits.push(waited);
          generationReadySince = null;
        }
      } else {
        generationReadySince = null;
      }
      nextResetPoll += resetPollSeconds;
    }

    if (nextEvent === horizonSeconds) break;
  }

  const firstInfinity = state.lastInfinityRuns[0] || null;
  return {
    generationDelaySeconds,
    reachedInfinity: state.infinityCount > 0,
    firstInfinitySeconds: firstInfinity ? firstInfinity.time : null,
    elapsedSeconds: time,
    finalScoreLog10: runtime.currentScoreLog10(),
    buyAllCalls,
    generations,
    coreBoosts,
    interruptedGenerationWaits,
    completedGenerationWaits: generationWaits.length,
    shortestGenerationWaitSeconds: generationWaits.length ? Math.min(...generationWaits) : null,
    longestGenerationWaitSeconds: generationWaits.length ? Math.max(...generationWaits) : null,
  };
}

async function runGenerationDelaySweepAudit() {
  const delays = [5, 15, 20, 30];
  const scenarios = [];
  for (const delay of delays) scenarios.push(await simulateGenerationDelay(delay));

  const report = {
    assumptions: {
      newSave: true,
      infinityUpgradesOrAutomation: false,
      buyAllIntervalSeconds: 0.25,
      coreBoostPolicy: "Run Core Boost on the first 0.25-second poll after it becomes available.",
      generationPolicy: "Run Generation after it has remained continuously available for the specified delay. A Core Boost restarts the wait because it resets the run.",
      persistence: "Disabled only in the audit runtime; saving does not affect simulation state.",
      horizonSeconds: 6 * 60 * 60,
      timingResolutionSeconds: 0.25,
    },
    scenarios,
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log("GR_DELAY_SWEEP_FIRST_INFINITY_AUDIT", JSON.stringify(scenarios.map((scenario) => ({
    delay: scenario.generationDelaySeconds,
    reachedInfinity: scenario.reachedInfinity,
    seconds: scenario.firstInfinitySeconds,
    scoreLog10: scenario.finalScoreLog10,
    generations: scenario.generations,
    coreBoosts: scenario.coreBoosts,
  }))));
  return report;
}

module.exports = { runGenerationDelaySweepAudit };
