const fs = require("node:fs");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");
const reportPath = path.join(__dirname, "..", "first-infinity-strategy-refine-report.json");
const ACTION_INTERVAL_SECONDS = 0.25;
const INCUMBENT_SECONDS = 1814.25;

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

function depthFor(policy, coreBoostCount) {
  if (policy.kind === "fixed") return policy.depth;
  if (policy.kind === "by-core") return policy.depths[Math.min(coreBoostCount, policy.depths.length - 1)];
  throw new Error(`Unknown policy kind: ${policy.kind}`);
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
      const generationDepth = depthFor(policy, state.coreBoostCount);

      if (runtime.canCoreBoost() && scoreLog >= coreTarget) {
        debug.runCoreBoost();
        coreBoosts += 1;
        resetTimeline.push({ type: "CB", time, coreBoostCountBefore: state.coreBoostCount - 1, scoreLog10: scoreLog, requirementLog10: coreRequirement, targetLog10: coreTarget });
      } else if (runtime.canRunGeneration() && generationScoreLog >= generationRequirement + generationDepth) {
        debug.runGeneration();
        generations += 1;
        resetTimeline.push({ type: "GR", time, coreBoostCount: state.coreBoostCount, generationCountBefore: state.generationCount - 1, scoreLog10: generationScoreLog, requirementLog10: generationRequirement, depth: generationDepth });
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
  return { name, kind: "fixed", depth, coreDelayLog: 0, ...extra };
}

function byCore(name, stage, depth) {
  const depths = [60, 60, 60, 60, 60];
  depths[stage] = depth;
  return { name, kind: "by-core", depths, coreDelayLog: 0 };
}

function createCandidates() {
  const candidates = [fixed("incumbent_fixed_d60", 60)];
  for (const depth of [45, 50, 52, 54, 55, 56, 57, 58, 59, 61, 62, 64, 66, 68, 70, 72, 75, 80, 90, 100, 120, 140]) {
    candidates.push(fixed(`fixed_d${depth}`, depth));
  }
  for (const coreDelayLog of [0.25, 0.5, 1, 2, 5]) candidates.push(fixed(`d60_core-delay-${coreDelayLog}`, 60, { coreDelayLog }));
  for (const stage of [2, 3, 4]) {
    for (const depth of [40, 50, 55, 65, 70, 80, 100]) {
      candidates.push(byCore(`d60_stage${stage}_d${depth}`, stage, depth));
    }
  }
  return candidates;
}

async function runFirstInfinityStrategyRefineAudit() {
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
      coreBoostPolicy: "Use Core Boost immediately unless the candidate explicitly delays it in log10 Score.",
      generationPolicy: "Run Generation when its current run reaches the candidate's requirement + depth threshold.",
      candidateCount: candidates.length,
      candidateFamilies: ["fixed +depth around +60", "small Core Boost delays", "CB2/CB3/CB4 phase-specific depth"],
      persistence: "Disabled only in the audit runtime; it does not affect simulation state.",
    },
    incumbent: results.find((result) => result.name === "incumbent_fixed_d60"),
    best: winners[0] || null,
    winners,
    nonWinners: results.filter((result) => !result.reachedInfinity),
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log("FIRST_INFINITY_STRATEGY_REFINE", JSON.stringify({
    candidates: candidates.length,
    incumbentSeconds: report.incumbent && report.incumbent.firstInfinitySeconds,
    best: report.best && { name: report.best.name, seconds: report.best.firstInfinitySeconds, generations: report.best.generations, coreBoosts: report.best.coreBoosts },
    beatingIncumbent: winners.filter((result) => result.firstInfinitySeconds < INCUMBENT_SECONDS).length,
  }));
  return report;
}

module.exports = { runFirstInfinityStrategyRefineAudit };
