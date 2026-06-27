const fs = require("node:fs");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");
const reportPath = path.join(__dirname, "..", "generation-surplus-cumulative-first-infinity-report.json");
const STEP = 0.25;
const HORIZON = 3600;

function currentLog(runtime, key) {
  return runtime.currentLog10ForValue(runtime.state[key], runtime.state[`${key}Log10`]);
}

function installFastBatch(runtime) {
  runtime.processManyVertices = function(start, end) {
    const count = end - start + 1;
    if (count <= 0) return false;
    const increase = runtime.vertexGainIncrease();
    const stride = runtime.state.vertices;
    const coreIndex = 0;
    const offset = ((coreIndex - (start % stride)) + stride) % stride;
    const hits = offset >= count ? 0 : Math.floor((count - 1 - offset) / stride) + 1;
    let totalLog = -Infinity;
    if (hits > 0) {
      const segments = Math.min(64, hits);
      const width = hits / segments;
      for (let segment = 0; segment < segments; segment += 1) {
        const midHit = (segment + 0.5) * width - 0.5;
        const gainLog = runtime.gainAfterIncreaseLog10(increase, offset + 1 + midHit * stride);
        const scoreLog = runtime.finalScoreGainFromBaseLog10(gainLog) + runtime.log10Value(width);
        totalLog = runtime.combineLog10(totalLog, scoreLog);
      }
      if (runtime.addScore(runtime.valueFromLog10(totalLog), totalLog)) return true;
    }
    runtime.addCurrentGain(increase * count);
    return false;
  };
}

function canBuy(runtime) {
  const costs = runtime.costLogs();
  return runtime.currentScoreLog10() >= Math.min(costs.speed, costs.vertex, costs.gain);
}

async function simulate(policy) {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const state = debug.state;
  state.showFloatingText = false;
  state.lightEffects = true;
  runtime.saveGame = () => {};
  runtime.updateUi = () => {};
  installFastBatch(runtime);

  let time = 0;
  let nextAction = 0;
  let buyAllCalls = 0;
  let generations = 0;
  let coreBoosts = 0;
  const resetTimeline = [];

  while (time < HORIZON && state.infinityCount === 0) {
    const nextTime = Math.min(nextAction, HORIZON);
    if (nextTime > time) {
      debug.update(nextTime - time);
      time = nextTime;
    }
    if (time + 1e-9 >= nextAction) {
      if (canBuy(runtime)) {
        debug.buyAllUpgrades({ refresh: false, save: false });
        buyAllCalls += 1;
      }
      const scoreLog = runtime.currentScoreLog10();
      const generationRequirementLog = runtime.generationRequirementLog10();
      const generationScoreLog = currentLog(runtime, "generationScore");
      const canGeneration = policy.depth !== null
        && state.coreBoostCount >= policy.minimumCoreBoostCount
        && runtime.canRunGeneration()
        && generationScoreLog >= generationRequirementLog + policy.depth;
      if (runtime.canCoreBoost()) {
        const requirementLog10 = runtime.coreBoostRequirementLog10();
        debug.runCoreBoost();
        coreBoosts += 1;
        resetTimeline.push({ type: "CB", time, coreBoostCountBefore: state.coreBoostCount - 1, scoreLog10: scoreLog, requirementLog10 });
      } else if (canGeneration) {
        debug.runGeneration();
        generations += 1;
        resetTimeline.push({ type: "GR", time, coreBoostCount: state.coreBoostCount, generationCountBefore: state.generationCount - 1, scoreLog10: generationScoreLog, requirementLog10: generationRequirementLog, surplusLog10: generationScoreLog - generationRequirementLog });
      }
      nextAction += STEP;
    }
  }

  const infinityRun = state.lastInfinityRuns[0] || null;
  const generationsBeforeCb3 = resetTimeline.filter((entry) => entry.type === "GR" && entry.coreBoostCount < 3).length;
  return { name: policy.name, policy, reachedInfinity: state.infinityCount > 0, firstInfinitySeconds: infinityRun ? infinityRun.time : null, elapsedSeconds: time, finalScoreLog10: runtime.currentScoreLog10(), buyAllCalls, generations, coreBoosts, generationsBeforeCb3, resetTimeline };
}

async function runFastAudit() {
  const policies = [
    { name: "no-generation", depth: null, minimumCoreBoostCount: Infinity },
    { name: "d10_from-start", depth: 10, minimumCoreBoostCount: 0 },
    { name: "d20_from-start", depth: 20, minimumCoreBoostCount: 0 },
    { name: "d30_from-start", depth: 30, minimumCoreBoostCount: 0 },
    { name: "d20_after-cb3", depth: 20, minimumCoreBoostCount: 3 },
  ];
  const results = [];
  for (const policy of policies) results.push(await simulate(policy));
  const winners = results.filter((result) => result.reachedInfinity).sort((a, b) => a.firstInfinitySeconds - b.firstInfinitySeconds);
  const report = {
    experiment: {
      rewardSource: "Generation Score minus the current Generation requirement",
      rawMultiplierGain: "min(0.8, 0.5 * log10(1 + surplus))",
      rawMultiplierBehavior: "Cumulative until raw multiplier log 8",
      costReduction: "min(0.16, 0.04 * log10(1 + surplus))",
    },
    assumptions: {
      newSave: true,
      buyAllIntervalSeconds: STEP,
      horizonSeconds: HORIZON,
      candidateCount: policies.length,
      coreBoostPolicy: "Immediate",
      auditCoreSum: "64-segment log-space midpoint sum per large batch",
    },
    best: winners[0] || null,
    winners,
    nonWinners: results.filter((result) => !result.reachedInfinity),
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log("GENERATION_SURPLUS_FAST_AUDIT", JSON.stringify({ best: report.best && { name: report.best.name, seconds: report.best.firstInfinitySeconds, generationsBeforeCb3: report.best.generationsBeforeCb3 } }));
  return report;
}

module.exports = { runFastAudit };
