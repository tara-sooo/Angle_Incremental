const fs = require("node:fs");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");
const reportPath = path.join(__dirname, "..", "first-infinity-balance-report.json");
const SEARCH_HORIZON_SECONDS = 2 * 60 * 60;

function finiteLog(value) {
  return value === -Infinity ? null : Number(value.toPrecision(12));
}

function seconds(value) {
  return Number(value.toFixed(3));
}

function policyLabel(policy) {
  const generation = policy.useGeneration
    ? `GR first e${policy.firstGenerationLog}, +${policy.generationGapLog} log`
    : "no GR";
  const coreBoost = policy.useCoreBoost
    ? `CB +${policy.coreBufferLog} log`
    : "no CB";
  return `${generation}; ${coreBoost}`;
}

function shouldRunGeneration(runtime, policy) {
  if (!policy.useGeneration || !runtime.canRunGeneration()) return false;
  const generationScoreLog = runtime.currentGenerationScoreLog10();
  if (runtime.state.generationCount <= 0) return generationScoreLog >= policy.firstGenerationLog;
  const nextTarget = Math.max(
    policy.firstGenerationLog,
    runtime.generationRequirementLog10() + policy.generationGapLog,
  );
  return generationScoreLog >= nextTarget;
}

function shouldRunCoreBoost(runtime, policy) {
  if (!policy.useCoreBoost || !runtime.canCoreBoost()) return false;
  return runtime.currentScoreLog10() >= runtime.coreBoostRequirementLog10() + policy.coreBufferLog;
}

function describeEvent(runtime, elapsed, kind) {
  return {
    kind,
    atSeconds: seconds(elapsed),
    scoreLog10: finiteLog(runtime.currentScoreLog10()),
    generationScoreLog10: finiteLog(runtime.currentGenerationScoreLog10()),
    generationCount: runtime.state.generationCount,
    coreBoostCount: runtime.state.coreBoostCount,
    vertices: runtime.state.vertices,
    speedLevel: runtime.state.speedLevel,
    gainLevel: runtime.state.gainLevel,
  };
}

async function simulate(policy, options = {}) {
  const decisionInterval = options.decisionInterval ?? 1;
  const maxSeconds = options.maxSeconds ?? SEARCH_HORIZON_SECONDS;
  const recordEvents = Boolean(options.recordEvents);
  const instance = await loadRuntime(candidatePath);
  const { runtime } = instance;
  const { state, update } = instance.debug;
  const events = [];
  let generationResets = 0;
  let coreBoostResets = 0;
  let elapsed = 0;

  runtime.saveGame = () => true;
  runtime.updateUi = () => {};
  state.showFloatingText = false;
  state.lightEffects = true;

  while (elapsed < maxSeconds && state.infinityCount === 0) {
    if (shouldRunCoreBoost(runtime, policy)) {
      if (recordEvents) events.push(describeEvent(runtime, elapsed, "coreBoost"));
      runtime.runCoreBoost();
      coreBoostResets += 1;
      continue;
    }
    if (shouldRunGeneration(runtime, policy)) {
      if (recordEvents) events.push(describeEvent(runtime, elapsed, "generation"));
      runtime.runGeneration();
      generationResets += 1;
      continue;
    }

    runtime.buyAllUpgrades({ refresh: false, save: false });

    if (shouldRunCoreBoost(runtime, policy)) {
      if (recordEvents) events.push(describeEvent(runtime, elapsed, "coreBoost"));
      runtime.runCoreBoost();
      coreBoostResets += 1;
      continue;
    }
    if (shouldRunGeneration(runtime, policy)) {
      if (recordEvents) events.push(describeEvent(runtime, elapsed, "generation"));
      runtime.runGeneration();
      generationResets += 1;
      continue;
    }

    const dt = Math.min(decisionInterval, maxSeconds - elapsed);
    update(dt);
    elapsed += dt;
  }

  const infinityRecord = state.lastInfinityRuns[0] || null;
  return {
    policy: {
      useGeneration: policy.useGeneration,
      firstGenerationLog: policy.firstGenerationLog ?? null,
      generationGapLog: policy.generationGapLog ?? null,
      useCoreBoost: policy.useCoreBoost,
      coreBufferLog: policy.coreBufferLog ?? null,
      label: policyLabel(policy),
    },
    decisionIntervalSeconds: decisionInterval,
    reachedInfinity: state.infinityCount > 0,
    simulatedSeconds: seconds(elapsed),
    firstInfinitySeconds: infinityRecord ? seconds(infinityRecord.time) : null,
    infinityScoreLog10: infinityRecord ? finiteLog(infinityRecord.scoreLog10) : null,
    generationResets,
    coreBoostResets,
    highestCoreBoostCount: Math.max(state.coreBoostCount, coreBoostResets),
    final: {
      scoreLog10: finiteLog(runtime.currentScoreLog10()),
      generationScoreLog10: finiteLog(runtime.currentGenerationScoreLog10()),
      vertices: state.vertices,
      speedLevel: state.speedLevel,
      gainLevel: state.gainLevel,
      generationCount: state.generationCount,
      coreBoostCount: state.coreBoostCount,
      achievementCount: runtime.achievementCount(),
    },
    events,
  };
}

function buildPolicies() {
  const policies = [
    {
      useGeneration: false,
      useCoreBoost: false,
      firstGenerationLog: null,
      generationGapLog: null,
      coreBufferLog: null,
    },
    {
      useGeneration: false,
      useCoreBoost: true,
      firstGenerationLog: null,
      generationGapLog: null,
      coreBufferLog: 0,
    },
    {
      useGeneration: false,
      useCoreBoost: true,
      firstGenerationLog: null,
      generationGapLog: null,
      coreBufferLog: 25,
    },
  ];

  [12, 20, 35, 50, 80].forEach((firstGenerationLog) => {
    [5, 15, 30, 60].forEach((generationGapLog) => {
      [0, 20, 50].forEach((coreBufferLog) => {
        policies.push({
          useGeneration: true,
          firstGenerationLog,
          generationGapLog,
          useCoreBoost: true,
          coreBufferLog,
        });
      });
    });
  });

  return policies;
}

function resultOrder(left, right) {
  if (left.reachedInfinity !== right.reachedInfinity) return left.reachedInfinity ? -1 : 1;
  if (left.reachedInfinity && right.reachedInfinity) return left.firstInfinitySeconds - right.firstInfinitySeconds;
  const leftScore = left.final.scoreLog10 ?? -Infinity;
  const rightScore = right.final.scoreLog10 ?? -Infinity;
  return rightScore - leftScore;
}

async function runFirstInfinityBalanceAudit() {
  const policies = buildPolicies();
  const gridResults = [];
  for (const policy of policies) {
    gridResults.push(await simulate(policy, { decisionInterval: 1 }));
  }
  gridResults.sort(resultOrder);

  const leadingPolicies = gridResults.filter((result) => result.reachedInfinity).slice(0, 3);
  const fallbackPolicies = leadingPolicies.length > 0 ? leadingPolicies : gridResults.slice(0, 3);
  const sensitivity = [];
  for (const selected of fallbackPolicies) {
    const policy = {
      useGeneration: selected.policy.useGeneration,
      firstGenerationLog: selected.policy.firstGenerationLog,
      generationGapLog: selected.policy.generationGapLog,
      useCoreBoost: selected.policy.useCoreBoost,
      coreBufferLog: selected.policy.coreBufferLog,
    };
    for (const decisionInterval of [0.1, 1, 3, 5]) {
      sensitivity.push(await simulate(policy, {
        decisionInterval,
        recordEvents: decisionInterval === 1,
      }));
    }
  }

  const report = {
    scope: "Initial Infinity time from a new save on release/0.1.0",
    assumptions: {
      normalUpgradePurchase: "Press Buy All once per decision interval; the in-game Buy All order is used.",
      resetPriority: "Core Boost is taken before Generation when both rules are ready.",
      firstInfinity: "The first Infinity is the automatic Infinity reset triggered when score reaches 1.8e308.",
      noInfinityBenefits: "No Infinity Upgrade or automation is used before the first Infinity.",
      searchHorizonSeconds: SEARCH_HORIZON_SECONDS,
      policySearch: "First GR targets e12/e20/e35/e50/e80; later GR gaps +5/+15/+30/+60 log; CB buffers +0/+20/+50 log.",
    },
    searchedPolicyCount: policies.length,
    reachedWithinHorizonCount: gridResults.filter((result) => result.reachedInfinity).length,
    topGridResults: gridResults.slice(0, 12),
    baselineReferences: gridResults.filter((result) => !result.policy.useGeneration || !result.policy.useCoreBoost),
    sensitivity,
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  const best = gridResults[0];
  console.log("FIRST_INFINITY_BALANCE_AUDIT", JSON.stringify({
    searchedPolicyCount: policies.length,
    reachedWithinHorizonCount: report.reachedWithinHorizonCount,
    best: {
      policy: best.policy,
      firstInfinitySeconds: best.firstInfinitySeconds,
      reachedInfinity: best.reachedInfinity,
      finalScoreLog10: best.final.scoreLog10,
    },
  }));
  return report;
}

if (require.main === module) {
  runFirstInfinityBalanceAudit().catch((error) => {
    fs.writeFileSync(reportPath, `${JSON.stringify({ failure: error.stack || String(error) }, null, 2)}\n`);
    throw error;
  });
}

module.exports = { runFirstInfinityBalanceAudit };
