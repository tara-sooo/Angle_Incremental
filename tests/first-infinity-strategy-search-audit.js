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

function policyDepth(policy, coreBoostCount, generationCount) {
  if (policy.kind === "fixed") return policy.depth;
  if (policy.kind === "by-core") return policy.depths[Math.min(coreBoostCount, policy.depths.length - 1)];
  if (policy.kind === "late-split") {
    if (coreBoostCount < 4) return policy.baseDepth;
    return generationCount < policy.switchAfter ? policy.earlyDepth : policy.lateDepth;
  }
  throw new Error(`Unknown policy kind: ${policy.kind}`);
}

function allowGeneration(policy, coreBoostCount, generationCount) {
  if (policy.maxGenerationAfterCore4 === undefined) return true;
  return coreBoostCount < 4 || generationCount < policy.maxGenerationAfterCore4;
}

async function simulate(policy, cutoffSeconds = BASELINE_CUTOFF_SECONDS) {
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

  while (time < cutoffSeconds && state.infinityCount === 0) {
    const nextTime = Math.min(nextAction, cutoffSeconds);
    const dt = Math.max(0, nextTime - time);
    if (dt > 0) {
      debug.update(dt);
      time = nextTime;
    }

    if (time + 1e-9 >= nextAction) {
      buyByMode(debug, policy.purchaseMode || "all");
      buyAllCalls += 1;
      const scoreLog = runtime.currentScoreLog10();
      const coreRequirement = runtime.coreBoostRequirementLog10();
      const coreTarget = coreRequirement + (policy.coreDelayLog || 0);
      const generationRequirement = runtime.generationRequirementLog10();
      const generationDepth = policyDepth(policy, state.coreBoostCount, state.generationCount);
      const generationScoreLog = currentLog(runtime, "generationScore");
      const canCore = runtime.canCoreBoost() && scoreLog >= coreTarget;
      const canGeneration = runtime.canRunGeneration()
        && allowGeneration(policy, state.coreBoostCount, state.generationCount)
        && generationScoreLog >= generationRequirement + generationDepth;

      if (policy.priority === "generation" && canGeneration) {
        debug.runGeneration();
        generations += 1;
        resetTimeline.push({ type: "GR", time, coreBoostCount: state.coreBoostCount, generationCountBefore: state.generationCount - 1, requirementLog10: generationRequirement, scoreLog10: generationScoreLog, depth: generationDepth });
      } else if (canCore) {
        debug.runCoreBoost();
        coreBoosts += 1;
        resetTimeline.push({ type: "CB", time, coreBoostCountBefore: state.coreBoostCount - 1, requirementLog10: coreRequirement, targetLog10: coreTarget, scoreLog10: scoreLog });
      } else if (canGeneration) {
        debug.runGeneration();
        generations += 1;
        resetTimeline.push({ type: "GR", time, coreBoostCount: state.coreBoostCount, generationCountBefore: state.generationCount - 1, requirementLog10: generationRequirement, scoreLog10: generationScoreLog, depth: generationDepth });
      }
      nextAction += ACTION_INTERVAL_SECONDS;
    }
    if (nextTime === cutoffSeconds) break;
  }

  const infinityRun = state.lastInfinityRuns[0] || null;
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
    resetTimeline,
  };
}

function fixed(name, depth, extra = {}) {
  return { name, kind: "fixed", depth, purchaseMode: "all", coreDelayLog: 0, priority: "core", ...extra };
}

function createCandidates() {
  const candidates = [fixed("reference_fixed_d20", 20)];
  for (const depth of [10, 12, 14, 16, 18, 19, 21, 22, 24, 26, 28, 30, 35, 40, 45, 50, 60]) candidates.push(fixed(`fixed_d${depth}`, depth));
  for (const coreDelayLog of [2, 5, 10, 20]) candidates.push(fixed(`d20_core-delay-${coreDelayLog}`, 20, { coreDelayLog }));
  for (const depth of [24, 30]) candidates.push(fixed(`d${depth}_core-delay-5`, depth, { coreDelayLog: 5 }));
  for (const purchaseMode of ["speed-gain", "speed-vertex", "vertex-gain"]) candidates.push(fixed(`d20_${purchaseMode}`, 20, { purchaseMode }));
  for (let maxGenerationAfterCore4 = 0; maxGenerationAfterCore4 <= 8; maxGenerationAfterCore4 += 1) candidates.push(fixed(`d20_limit-after-cb4_${maxGenerationAfterCore4}`, 20, { maxGenerationAfterCore4 }));
  for (const coreStage of [1, 2, 3, 4]) {
    for (const depth of [12, 16, 24, 30, 40]) {
      const depths = [20, 20, 20, 20, 20];
      depths[coreStage] = depth;
      candidates.push({ name: `by-core_stage${coreStage}_d${depth}`, kind: "by-core", depths, purchaseMode: "all", coreDelayLog: 0, priority: "core" });
    }
  }
  for (const switchAfter of [1, 2]) {
    for (const earlyDepth of [15, 20]) {
      for (const lateDepth of [30, 40, 60]) candidates.push({ name: `late-split_after${switchAfter}_early${earlyDepth}_late${lateDepth}`, kind: "late-split", baseDepth: 20, switchAfter, earlyDepth, lateDepth, purchaseMode: "all", coreDelayLog: 0, priority: "core" });
    }
  }
  return candidates;
}

async function runFirstInfinityStrategySearchAudit() {
  const candidates = createCandidates();
  const results = [];
  for (const candidate of candidates) results.push(await simulate(candidate));
  const winners = results.filter((result) => result.reachedInfinity).sort((left, right) => left.firstInfinitySeconds - right.firstInfinitySeconds);
  const report = {
    assumptions: {
      newSave: true,
      infinityUpgradesOrAutomation: false,
      buyAllIntervalSeconds: ACTION_INTERVAL_SECONDS,
      baselineCutoffSeconds: BASELINE_CUTOFF_SECONDS,
      coreBoostPolicy: "Core Boost is immediate unless a candidate explicitly adds a log-delay.",
      generationPolicy: "Generation occurs when Generation Score reaches the policy's requirement + depth threshold.",
      candidateCount: candidates.length,
      candidateFamilies: ["fixed depth", "Core Boost delay", "selective purchases", "post-CB4 Generation limit", "per-Core-Boost depth", "late-phase split depth"],
      persistence: "Disabled only in the audit runtime; it does not affect game state.",
    },
    reference: results.find((result) => result.name === "reference_fixed_d20"),
    best: winners[0] || null,
    winners,
    nonWinners: results.filter((result) => !result.reachedInfinity),
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log("FIRST_INFINITY_STRATEGY_SEARCH", JSON.stringify({ candidates: candidates.length, referenceSeconds: report.reference && report.reference.firstInfinitySeconds, best: report.best && { name: report.best.name, seconds: report.best.firstInfinitySeconds, generations: report.best.generations, coreBoosts: report.best.coreBoosts }, beatingReference: winners.filter((result) => result.firstInfinitySeconds < BASELINE_CUTOFF_SECONDS).length }));
  return report;
}

module.exports = { runFirstInfinityStrategySearchAudit };
