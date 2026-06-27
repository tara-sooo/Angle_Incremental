const fs = require("node:fs");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");
const reportPath = path.join(__dirname, "..", "generation-surplus-cumulative-first-infinity-report.json");
const ACTION_INTERVAL_SECONDS = 0.25;
const HORIZON_SECONDS = 90 * 60;

function currentLog(runtime, key) {
  return runtime.currentLog10ForValue(runtime.state[key], runtime.state[`${key}Log10`]);
}

function canAffordAnyNormalUpgrade(runtime) {
  const scoreLog = runtime.currentScoreLog10();
  const costs = runtime.costLogs();
  return scoreLog >= Math.min(costs.speed, costs.vertex, costs.gain);
}

// First Infinity is below the Infinity softcap. This only replaces the
// per-frame batching implementation so a policy sweep remains practical.
function installPreInfinityAggregateBatch(runtime) {
  runtime.processManyVertices = function aggregatePreInfinityVertices(start, end) {
    const count = end - start + 1;
    if (count <= 0) return false;
    const increase = runtime.vertexGainIncrease();
    const events = runtime.coreVertexIndices()
      .map((index) => {
        const offset = ((index - (start % runtime.state.vertices)) + runtime.state.vertices) % runtime.state.vertices;
        const hits = offset >= count ? 0 : Math.floor((count - 1 - offset) / runtime.state.vertices) + 1;
        return { firstStep: offset + 1, hits };
      })
      .filter((event) => event.hits > 0);

    if (events.length > 0) {
      let earned = 0;
      let totalHits = 0;
      let lastStep = 0;
      for (const event of events) {
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

async function simulate(policy) {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const state = debug.state;
  state.showFloatingText = false;
  state.lightEffects = true;
  runtime.saveGame = () => {};
  runtime.updateUi = () => {};
  installPreInfinityAggregateBatch(runtime);

  let time = 0;
  let nextAction = 0;
  let buyAllCalls = 0;
  let generations = 0;
  let coreBoosts = 0;
  const resetTimeline = [];

  while (time < HORIZON_SECONDS && state.infinityCount === 0) {
    const nextTime = Math.min(nextAction, HORIZON_SECONDS);
    const delta = Math.max(0, nextTime - time);
    if (delta > 0) {
      debug.update(delta);
      time = nextTime;
    }

    if (time + 1e-9 >= nextAction) {
      if (canAffordAnyNormalUpgrade(runtime)) {
        debug.buyAllUpgrades({ refresh: false, save: false });
        buyAllCalls += 1;
      }
      const scoreLog = runtime.currentScoreLog10();
      const coreRequirementLog = runtime.coreBoostRequirementLog10();
      const generationRequirementLog = runtime.generationRequirementLog10();
      const generationScoreLog = currentLog(runtime, "generationScore");
      const canGeneration = policy.depth !== null
        && state.coreBoostCount >= policy.minimumCoreBoostCount
        && runtime.canRunGeneration()
        && generationScoreLog >= generationRequirementLog + policy.depth;

      if (runtime.canCoreBoost()) {
        debug.runCoreBoost();
        coreBoosts += 1;
        resetTimeline.push({ type: "CB", time, coreBoostCountBefore: state.coreBoostCount - 1, scoreLog10: scoreLog, requirementLog10: coreRequirementLog });
      } else if (canGeneration) {
        debug.runGeneration();
        generations += 1;
        resetTimeline.push({ type: "GR", time, coreBoostCount: state.coreBoostCount, generationCountBefore: state.generationCount - 1, scoreLog10: generationScoreLog, requirementLog10: generationRequirementLog, surplusLog10: generationScoreLog - generationRequirementLog });
      }
      nextAction += ACTION_INTERVAL_SECONDS;
    }

    if (nextTime === HORIZON_SECONDS) break;
  }

  const infinityRun = state.lastInfinityRuns[0] || null;
  const generationsBeforeCb3 = resetTimeline.filter((entry) => entry.type === "GR" && entry.coreBoostCount < 3).length;
  return {
    name: policy.name,
    policy,
    reachedInfinity: state.infinityCount > 0,
    firstInfinitySeconds: infinityRun ? infinityRun.time : null,
    elapsedSeconds: time,
    finalScoreLog10: runtime.currentScoreLog10(),
    buyAllCalls,
    generations,
    coreBoosts,
    generationsBeforeCb3,
    resetTimeline,
  };
}

function createPolicies() {
  return [
    { name: "no-generation", depth: null, minimumCoreBoostCount: Infinity },
    { name: "d5_from-start", depth: 5, minimumCoreBoostCount: 0 },
    { name: "d10_from-start", depth: 10, minimumCoreBoostCount: 0 },
    { name: "d15_from-start", depth: 15, minimumCoreBoostCount: 0 },
    { name: "d20_from-start", depth: 20, minimumCoreBoostCount: 0 },
    { name: "d25_from-start", depth: 25, minimumCoreBoostCount: 0 },
    { name: "d30_from-start", depth: 30, minimumCoreBoostCount: 0 },
    { name: "d20_after-cb2", depth: 20, minimumCoreBoostCount: 2 },
    { name: "d20_after-cb3", depth: 20, minimumCoreBoostCount: 3 },
    { name: "d20_after-cb4", depth: 20, minimumCoreBoostCount: 4 },
  ];
}

async function runGenerationSurplusCumulativeFirstInfinityAudit() {
  const policies = createPolicies();
  const results = [];
  for (const policy of policies) results.push(await simulate(policy));
  const winners = results.filter((result) => result.reachedInfinity).sort((left, right) => left.firstInfinitySeconds - right.firstInfinitySeconds);
  const report = {
    experiment: {
      rewardSource: "Generation Score minus the current Generation requirement",
      rawMultiplierGain: "min(0.8, 0.5 * log10(1 + surplus))",
      rawMultiplierBehavior: "Cumulative until the existing raw multiplier cap of 8",
      costReduction: "min(0.16, 0.04 * log10(1 + surplus))",
    },
    assumptions: {
      newSave: true,
      infinityUpgradesOrAutomation: false,
      buyAllIntervalSeconds: ACTION_INTERVAL_SECONDS,
      coreBoostPolicy: "Run Core Boost as soon as it becomes available.",
      generationPolicy: "Run Generation at requirement + depth after the policy's minimum Core Boost count; no-generation disables it.",
      horizonSeconds: HORIZON_SECONDS,
      candidateCount: policies.length,
      persistence: "Disabled only in the audit runtime; it does not affect game state.",
    },
    best: winners[0] || null,
    winners,
    nonWinners: results.filter((result) => !result.reachedInfinity),
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log("GENERATION_SURPLUS_CUMULATIVE_FIRST_INFINITY", JSON.stringify({ candidates: policies.length, best: report.best && { name: report.best.name, seconds: report.best.firstInfinitySeconds, generations: report.best.generations, generationsBeforeCb3: report.best.generationsBeforeCb3, coreBoosts: report.best.coreBoosts } }));
  return report;
}

module.exports = { runGenerationSurplusCumulativeFirstInfinityAudit };
