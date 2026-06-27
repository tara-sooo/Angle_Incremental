const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");
const reportPath = path.join(__dirname, "..", "first-infinity-balance-audit-report.json");

function resourceLog(runtime, key) {
  return runtime.currentLog10ForValue(
    runtime.state[key],
    runtime.state[`${key}Log10`],
  );
}

async function runScenario({
  name,
  actionIntervalSeconds,
  generationDepth,
  minimumGenerationsBeforeCore = 0,
  maxSeconds = 24 * 60 * 60,
}) {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const state = debug.state;
  state.showFloatingText = false;
  state.lightEffects = true;

  let elapsed = 0;
  let nextActionAt = 0;
  let buyAllCalls = 0;
  let generations = 0;
  let coreBoosts = 0;
  const resets = [];
  const step = Math.min(0.25, actionIntervalSeconds);

  while (elapsed < maxSeconds && state.infinityCount === 0) {
    if (elapsed + 1e-12 >= nextActionAt) {
      debug.buyAllUpgrades({ refresh: false, save: false });
      buyAllCalls += 1;

      if (runtime.canCoreBoost() && state.generationCount >= minimumGenerationsBeforeCore) {
        const requirementLog10 = runtime.coreBoostRequirementLog10();
        debug.runCoreBoost();
        coreBoosts += 1;
        resets.push({ type: "CB", time: elapsed, requirementLog10 });
      } else {
        const requirementLog10 = runtime.generationRequirementLog10();
        const generationScoreLog10 = resourceLog(runtime, "generationScore");
        if (runtime.canRunGeneration() && generationScoreLog10 >= requirementLog10 + generationDepth) {
          debug.runGeneration();
          generations += 1;
          resets.push({ type: "GR", time: elapsed, generationScoreLog10 });
        }
      }
      nextActionAt += actionIntervalSeconds;
    }

    const dt = Math.min(step, maxSeconds - elapsed);
    debug.update(dt);
    elapsed += dt;
  }

  const firstRun = state.lastInfinityRuns[0] || null;
  return {
    name,
    actionIntervalSeconds,
    generationDepth,
    minimumGenerationsBeforeCore,
    reachedInfinity: state.infinityCount > 0,
    elapsedSeconds: elapsed,
    recordedInfinitySeconds: firstRun ? firstRun.time : null,
    buyAllCalls,
    generations,
    coreBoosts,
    resets,
    firstInfinity: firstRun ? {
      scoreLog10: firstRun.scoreLog10,
      ipGain: firstRun.ipGain,
    } : null,
  };
}

async function runFirstInfinityBalanceAudit() {
  const scenarios = [
    { name: "near-optimal_d4_0.25s", actionIntervalSeconds: 0.25, generationDepth: 4 },
    { name: "near-optimal_d8_0.25s", actionIntervalSeconds: 0.25, generationDepth: 8 },
    { name: "near-optimal_d12_0.25s", actionIntervalSeconds: 0.25, generationDepth: 12 },
    { name: "near-optimal_d20_0.25s", actionIntervalSeconds: 0.25, generationDepth: 20 },
    { name: "practical_d8_1s", actionIntervalSeconds: 1, generationDepth: 8 },
    { name: "practical_d12_1s", actionIntervalSeconds: 1, generationDepth: 12 },
    { name: "practical_d20_1s", actionIntervalSeconds: 1, generationDepth: 20 },
    { name: "conservative_d20_3s", actionIntervalSeconds: 3, generationDepth: 20 },
    {
      name: "core-after-one-generation_d12_1s",
      actionIntervalSeconds: 1,
      generationDepth: 12,
      minimumGenerationsBeforeCore: 1,
    },
  ];

  const results = [];
  for (const scenario of scenarios) results.push(await runScenario(scenario));

  results.forEach((result) => {
    assert.equal(result.reachedInfinity, true, `${result.name}: first Infinity did not occur within 24 hours`);
    assert.ok(result.recordedInfinitySeconds > 0, `${result.name}: first Infinity time was not recorded`);
  });

  const ordered = [...results].sort((left, right) => left.recordedInfinitySeconds - right.recordedInfinitySeconds);
  const report = {
    assumptions: {
      newSave: true,
      noInfinityUpgradesOrAutomation: true,
      buyAllPolicy: "Press Buy All at the configured fixed interval.",
      generationPolicy: "Run Generation once Generation Score is at least the prior Generation requirement plus the configured log10 depth.",
      coreBoostPolicy: "Run Core Boost as soon as available, unless the scenario requires at least one Generation first.",
      simulationStepSeconds: "min(0.25, action interval)",
    },
    fastest: ordered[0],
    slowest: ordered[ordered.length - 1],
    scenarios: results,
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log("FIRST_INFINITY_BALANCE_AUDIT", JSON.stringify({
    fastest: {
      name: report.fastest.name,
      seconds: report.fastest.recordedInfinitySeconds,
      generations: report.fastest.generations,
      coreBoosts: report.fastest.coreBoosts,
    },
    slowest: {
      name: report.slowest.name,
      seconds: report.slowest.recordedInfinitySeconds,
    },
  }));
  return report;
}

module.exports = { runFirstInfinityBalanceAudit };
