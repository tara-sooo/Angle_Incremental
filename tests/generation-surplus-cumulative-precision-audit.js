const fs = require("node:fs");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");
const reportPath = path.join(__dirname, "..", "generation-surplus-cumulative-precision-report.json");
const STEP = 0.25;
const HORIZON = 3600;
const SEGMENTS = 512;

function currentLog(runtime, key) {
  return runtime.currentLog10ForValue(runtime.state[key], runtime.state[`${key}Log10`]);
}

function installPrecisionBatch(runtime) {
  runtime.processManyVertices = function(start, end) {
    const count = end - start + 1;
    if (count <= 0) return false;
    const increase = runtime.vertexGainIncrease();
    const stride = runtime.state.vertices;
    const offset = ((0 - (start % stride)) + stride) % stride;
    const hits = offset >= count ? 0 : Math.floor((count - 1 - offset) / stride) + 1;
    if (hits > 0) {
      const segments = Math.min(SEGMENTS, hits);
      const width = hits / segments;
      let totalLog = -Infinity;
      for (let segment = 0; segment < segments; segment += 1) {
        const midHit = (segment + 0.5) * width - 0.5;
        const gainLog = runtime.gainAfterIncreaseLog10(increase, offset + 1 + midHit * stride);
        totalLog = runtime.combineLog10(totalLog, runtime.finalScoreGainFromBaseLog10(gainLog) + runtime.log10Value(width));
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
  installPrecisionBatch(runtime);

  let time = 0;
  let nextAction = 0;
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
      if (canBuy(runtime)) debug.buyAllUpgrades({ refresh: false, save: false });
      const generationRequirementLog = runtime.generationRequirementLog10();
      const generationScoreLog = currentLog(runtime, "generationScore");
      const canGeneration = state.coreBoostCount >= policy.minimumCoreBoostCount
        && runtime.canRunGeneration()
        && generationScoreLog >= generationRequirementLog + policy.depth;
      if (runtime.canCoreBoost()) {
        debug.runCoreBoost();
        coreBoosts += 1;
        resetTimeline.push({ type: "CB", time, coreBoostCountBefore: state.coreBoostCount - 1 });
      } else if (canGeneration) {
        debug.runGeneration();
        generations += 1;
        resetTimeline.push({ type: "GR", time, coreBoostCount: state.coreBoostCount, surplusLog10: generationScoreLog - generationRequirementLog });
      }
      nextAction += STEP;
    }
  }

  const run = state.lastInfinityRuns[0] || null;
  return {
    name: policy.name,
    policy,
    reachedInfinity: state.infinityCount > 0,
    firstInfinitySeconds: run ? run.time : null,
    elapsedSeconds: time,
    generations,
    coreBoosts,
    generationsBeforeCb3: resetTimeline.filter((entry) => entry.type === "GR" && entry.coreBoostCount < 3).length,
    resetTimeline,
  };
}

async function runPrecisionAudit() {
  const policies = [
    { name: "d20_after-cb3", depth: 20, minimumCoreBoostCount: 3 },
    { name: "d30_from-start", depth: 30, minimumCoreBoostCount: 0 },
  ];
  const results = [];
  for (const policy of policies) results.push(await simulate(policy));
  results.sort((a, b) => (a.firstInfinitySeconds ?? Infinity) - (b.firstInfinitySeconds ?? Infinity));
  const report = {
    assumptions: {
      buyAllIntervalSeconds: STEP,
      horizonSeconds: HORIZON,
      coreSum: "512-segment log-space midpoint sum per batch",
      candidates: policies,
    },
    results,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log("GENERATION_SURPLUS_PRECISION_AUDIT", JSON.stringify(results.map((r) => ({ name: r.name, seconds: r.firstInfinitySeconds, generationsBeforeCb3: r.generationsBeforeCb3 }))));
  return report;
}

module.exports = { runPrecisionAudit };
