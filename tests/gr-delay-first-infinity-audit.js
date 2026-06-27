const fs = require("node:fs");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");
const reportPath = path.join(__dirname, "..", "gr-delay-first-infinity-audit-report.json");

// Before first Infinity, the Infinity softcap is inactive. Aggregating ordinary
// core hits therefore preserves the score trajectory while making a six-hour
// policy audit practical.
function installPreInfinityAggregateBatch(runtime) {
  runtime.processManyVertices = function processPreInfinityAggregate(start, end) {
    const count = end - start + 1;
    if (count <= 0) return false;

    const increase = runtime.vertexGainIncrease();
    const coreEvents = runtime.coreVertexIndices()
      .map((coreIndex) => {
        const offset = ((coreIndex - (start % runtime.state.vertices)) + runtime.state.vertices) % runtime.state.vertices;
        const hits = offset >= count ? 0 : Math.floor((count - 1 - offset) / runtime.state.vertices) + 1;
        return { hits, firstStep: offset + 1 };
      })
      .filter((event) => event.hits > 0);

    if (coreEvents.length > 0) {
      let earned = 0;
      let totalHits = 0;
      let finalStep = 0;
      for (const event of coreEvents) {
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

async function runGenerationDelayAudit() {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const state = debug.state;
  state.showFloatingText = false;
  state.lightEffects = true;
  installPreInfinityAggregateBatch(runtime);

  const buyAllIntervalSeconds = 0.25;
  const resetPollSeconds = 0.25;
  const generationDelaySeconds = 10;
  const maxSeconds = 6 * 60 * 60;

  let time = 0;
  let nextBuyAll = 0;
  let nextResetPoll = 0;
  let generationReadySince = null;
  let buyAllCalls = 0;
  let generations = 0;
  let coreBoosts = 0;
  let interruptedGenerationWaits = 0;
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
      // Core Boost remains immediate. If it resets a pending Generation run,
      // the 10-second Generation wait begins again on the next readiness event.
      if (runtime.canCoreBoost()) {
        const pendingWait = generationReadySince === null ? null : time - generationReadySince;
        debug.runCoreBoost();
        coreBoosts += 1;
        if (pendingWait !== null) interruptedGenerationWaits += 1;
        resetTimeline.push({ type: "CB", time, pendingGenerationWaitSeconds: pendingWait });
        generationReadySince = null;
      } else if (runtime.canRunGeneration()) {
        if (generationReadySince === null) generationReadySince = time;
        const waitedSeconds = time - generationReadySince;
        if (waitedSeconds + 1e-9 >= generationDelaySeconds) {
          debug.runGeneration();
          generations += 1;
          resetTimeline.push({ type: "GR", time, waitedSeconds });
          generationReadySince = null;
        }
      } else {
        generationReadySince = null;
      }
      nextResetPoll += resetPollSeconds;
    }

    if (nextEvent === maxSeconds) break;
  }

  const firstRun = state.lastInfinityRuns[0] || null;
  const generationWaits = resetTimeline
    .filter((entry) => entry.type === "GR")
    .map((entry) => entry.waitedSeconds);
  const report = {
    assumptions: {
      newSave: true,
      infinityUpgradesOrAutomation: false,
      buyAllIntervalSeconds,
      generationDelaySeconds,
      coreBoostPolicy: "Run Core Boost on the first 0.25-second poll after it becomes available.",
      generationPolicy: "After Generation becomes available, wait 10 seconds of continued readiness before pressing it. A Core Boost during that wait resets the pending Generation timer.",
      horizonSeconds: maxSeconds,
    },
    result: {
      reachedInfinity: state.infinityCount > 0,
      firstInfinitySeconds: firstRun ? firstRun.time : null,
      finalScoreLog10: runtime.currentScoreLog10(),
      buyAllCalls,
      generations,
      coreBoosts,
      completedGenerationWaitCount: generationWaits.length,
      shortestGenerationWaitSeconds: generationWaits.length > 0 ? Math.min(...generationWaits) : null,
      longestGenerationWaitSeconds: generationWaits.length > 0 ? Math.max(...generationWaits) : null,
      interruptedGenerationWaits,
      resetTimeline,
    },
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log("GR_DELAY_FIRST_INFINITY_AUDIT", JSON.stringify({
    reachedInfinity: report.result.reachedInfinity,
    firstInfinitySeconds: report.result.firstInfinitySeconds,
    finalScoreLog10: report.result.finalScoreLog10,
    generations: report.result.generations,
    coreBoosts: report.result.coreBoosts,
  }));
  return report;
}

module.exports = { runGenerationDelayAudit };
