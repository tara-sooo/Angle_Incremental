const fs = require("node:fs");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");
const reportPath = path.join(__dirname, "..", "first-infinity-strategy-final-refine-report.json");
const ACTION_INTERVAL_SECONDS = 0.25;
const INCUMBENT_SECONDS = 1694.25;

function currentLog(runtime, key) {
  return runtime.currentLog10ForValue(runtime.state[key], runtime.state[`${key}Log10`]);
}

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

function targetDepth(policy, coreBoostCount) {
  return policy.depths[Math.min(coreBoostCount, policy.depths.length - 1)];
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
  let generations = 0;
  let coreBoosts = 0;
  const resetTimeline = [];

  while (time < INCUMBENT_SECONDS && state.infinityCount === 0) {
    const nextTime = Math.min(nextAction, INCUMBENT_SECONDS);
    const delta = Math.max(0, nextTime - time);
    if (delta > 0) {
      debug.update(delta);
      time = nextTime;
    }

    if (time + 1e-9 >= nextAction) {
      debug.buyAllUpgrades({ refresh: false, save: false });
      const scoreLog = runtime.currentScoreLog10();
      const coreRequirement = runtime.coreBoostRequirementLog10();
      const coreTarget = coreRequirement + (policy.coreDelayLog || 0);
      const generationRequirement = runtime.generationRequirementLog10();
      const generationScoreLog = currentLog(runtime, "generationScore");
      const depth = targetDepth(policy, state.coreBoostCount);
      const allowedGeneration = policy.maxGenerationAfterCore4 === undefined
        || state.coreBoostCount < 4
        || state.generationCount < policy.maxGenerationAfterCore4;

      if (runtime.canCoreBoost() && scoreLog >= coreTarget) {
        debug.runCoreBoost();
        coreBoosts += 1;
        resetTimeline.push({ type: "CB", time, coreBoostCountBefore: state.coreBoostCount - 1, scoreLog10: scoreLog, requirementLog10: coreRequirement, targetLog10: coreTarget });
      } else if (runtime.canRunGeneration() && allowedGeneration && generationScoreLog >= generationRequirement + depth) {
        debug.runGeneration();
        generations += 1;
        resetTimeline.push({ type: "GR", time, coreBoostCount: state.coreBoostCount, generationCountBefore: state.generationCount - 1, scoreLog10: generationScoreLog, requirementLog10: generationRequirement, depth });
      }
      nextAction += ACTION_INTERVAL_SECONDS;
    }

    if (nextTime === INCUMBENT_SECONDS) break;
  }

  const infinityRun = state.lastInfinityRuns[0] || null;
  return {
    name: policy.name,
    policy,
    reachedInfinity: state.infinityCount > 0,
    firstInfinitySeconds: infinityRun ? infinityRun.time : null,
    elapsedSeconds: time,
    finalScoreLog10: runtime.currentScoreLog10(),
    generations,
    coreBoosts,
    resetTimeline,
  };
}

function fixed(name, depth, extra = {}) {
  return { name, depths: [depth, depth, depth, depth, depth], coreDelayLog: 0, ...extra };
}

function stageVariant(name, stage, depth) {
  const depths = [75, 75, 75, 75, 75];
  depths[stage] = depth;
  return { name, depths, coreDelayLog: 0 };
}

function createCandidates() {
  const candidates = [fixed("incumbent_fixed_d75", 75)];
  for (const depth of [70, 71, 72, 73, 74, 74.25, 74.5, 74.75, 75.25, 75.5, 75.75, 76, 76.5, 77, 77.5, 78, 79, 80, 81, 82, 83, 84, 85, 87, 90]) {
    candidates.push(fixed(`fixed_d${depth}`, depth));
  }
  for (const stage of [2, 3, 4]) {
    for (const depth of [60, 65, 70, 72, 73, 74, 74.5, 75.5, 76, 78, 80, 85, 90, 100]) {
      candidates.push(stageVariant(`d75_stage${stage}_d${depth}`, stage, depth));
    }
  }
  for (const maxGenerationAfterCore4 of [0, 1, 2, 3]) {
    candidates.push(fixed(`d75_limit-after-cb4_${maxGenerationAfterCore4}`, 75, { maxGenerationAfterCore4 }));
  }
  for (const coreDelayLog of [0.25, 0.5, 1]) candidates.push(fixed(`d75_core-delay-${coreDelayLog}`, 75, { coreDelayLog }));
  return candidates;
}

async function runFirstInfinityStrategyFinalRefineAudit() {
  const candidates = createCandidates();
  const results = [];
  for (const candidate of candidates) results.push(await simulate(candidate));
  const winners = results.filter((result) => result.reachedInfinity).sort((left, right) => left.firstInfinitySeconds - right.firstInfinitySeconds);
  const report = {
    assumptions: {
      newSave: true,
      infinityUpgradesOrAutomation: false,
      buyAllIntervalSeconds: ACTION_INTERVAL_SECONDS,
      incumbentSeconds: INCUMBENT_SECONDS,
      coreBoostPolicy: "Use Core Boost immediately except for explicit small log-delay variants.",
      generationPolicy: "Use a fixed or Core-Boost-stage-specific requirement + depth target.",
      candidateCount: candidates.length,
      candidateFamilies: ["fine fixed +depth sweep", "CB2/CB3/CB4-specific targets", "post-CB4 Generation count limit", "small Core Boost delays"],
      persistence: "Disabled only in the audit runtime; it does not affect simulation state.",
    },
    incumbent: results.find((result) => result.name === "incumbent_fixed_d75"),
    best: winners[0] || null,
    winners,
    nonWinners: results.filter((result) => !result.reachedInfinity),
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log("FIRST_INFINITY_STRATEGY_FINAL_REFINE", JSON.stringify({
    candidates: candidates.length,
    incumbentSeconds: report.incumbent && report.incumbent.firstInfinitySeconds,
    best: report.best && { name: report.best.name, seconds: report.best.firstInfinitySeconds, generations: report.best.generations, coreBoosts: report.best.coreBoosts },
    beatingIncumbent: winners.filter((result) => result.firstInfinitySeconds < INCUMBENT_SECONDS).length,
  }));
  return report;
}

module.exports = { runFirstInfinityStrategyFinalRefineAudit };
