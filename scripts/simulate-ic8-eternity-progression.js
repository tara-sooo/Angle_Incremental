const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadRuntime } = require("../tests/runtime-harness-esm.js");

const ISSUE = 217;
const CANDIDATE_PATH = path.join(__dirname, "..", "src", "main.js");
const DEFAULT_REPORT_PATH = path.join(__dirname, "..", "reports", "ic8-eternity-progression.json");
const DEFAULT_MARKDOWN_PATH = path.join(__dirname, "..", "reports", "ic8-eternity-progression.md");
const MILESTONE_IDS = Object.freeze([
  "break-infinite-cap",
  "infinite-angle-unlock",
  "tower-floor-1",
  "tc1-unlock",
  "tc1-clear",
  "tc2-unlock",
  "tc2-clear",
  "tc3-unlock",
  "tc3-clear",
  "tc4-unlock",
  "tc4-clear",
  "ic8-clear",
  "ip-1.80e308",
  "eternity-eligibility",
]);
const POLICIES = Object.freeze([
  Object.freeze({
    id: "greedy",
    description: "buy legal upgrades, reset at the first payable Infinity, then take the first legal challenge",
    generationDepthLog10: 0.1,
    infinityGainLog10Reserve: 0,
  }),
  Object.freeze({
    id: "threshold-aware",
    description: "buy legal upgrades, wait for a ten-percent IP reserve or a deeper Generation run, then reset",
    generationDepthLog10: 0.5,
    infinityGainLog10Reserve: 1,
  }),
]);
const CANDIDATES = Object.freeze([
  Object.freeze({
    id: "timeline-free",
    family: "Timeline-free",
    formula: "normal runtime.infinityPointGain()",
    postSoftcapPower: null,
  }),
  Object.freeze({
    id: "real-bc16500",
    family: "Real-BC16500",
    formula: "normal IP gain × (1 + log10(current IP)); factor is 1 at 0/1 IP",
    postSoftcapPower: null,
  }),
  Object.freeze({
    id: "parallel-bc16500-root",
    family: "Parallel-BC16500",
    formula: "normal IP gain × 3^secondsSinceIC8Clear; raw multiplier cap 1e10; post-softcap power 0.50",
    rawMultiplierCap: 1e10,
    postSoftcapPower: 0.5,
  }),
  Object.freeze({
    id: "parallel-bc16500-fourth-root",
    family: "Parallel-BC16500",
    formula: "normal IP gain × 3^secondsSinceIC8Clear; raw multiplier cap 1e10; post-softcap power 0.25",
    rawMultiplierCap: 1e10,
    postSoftcapPower: 0.25,
  }),
]);
const DEFAULT_OPTIONS = Object.freeze({
  maxSetupSeconds: 600,
  maxRunSeconds: 120,
  maxStallSeconds: 30,
  stepSeconds: 1 / 30,
  actionIntervalSeconds: 0.1,
  parallelPostSoftcapPower: null,
  writeReports: true,
});

function parseNumberOption(args, name, fallback, minimum = 0) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = Number(args[index + 1]);
  if (!Number.isFinite(value) || value < minimum) throw new Error(`${name} requires a number >= ${minimum}`);
  return value;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    maxSetupSeconds: parseNumberOption(args, "--max-setup-seconds", DEFAULT_OPTIONS.maxSetupSeconds),
    maxRunSeconds: parseNumberOption(args, "--max-run-seconds", DEFAULT_OPTIONS.maxRunSeconds),
    maxStallSeconds: parseNumberOption(args, "--max-stall-seconds", DEFAULT_OPTIONS.maxStallSeconds),
    stepSeconds: parseNumberOption(args, "--step", DEFAULT_OPTIONS.stepSeconds, Number.MIN_VALUE),
    actionIntervalSeconds: parseNumberOption(args, "--action-interval", DEFAULT_OPTIONS.actionIntervalSeconds, Number.MIN_VALUE),
    parallelPostSoftcapPower: parseNumberOption(args, "--parallel-post-power", null),
    writeReports: !args.includes("--no-write-reports"),
  };
}

function cloneState(state) {
  return Object.fromEntries(Object.entries(state).map(([key, value]) => [
    key,
    Array.isArray(value) ? [...value] : value,
  ]));
}

function finiteOrString(value) {
  return Number.isFinite(value) ? value : String(value);
}

function currentIpLog10(runtime) {
  return runtime.log10ExactInfinityPoints(runtime.currentExactInfinityPoints());
}

function currentScoreLog10(runtime) {
  return runtime.currentScoreLog10();
}

function reportState(runtime) {
  const state = runtime.state;
  return {
    scoreLog10: finiteOrString(currentScoreLog10(runtime)),
    generationScoreLog10: finiteOrString(runtime.currentGenerationScoreLog10()),
    infinityPointLog10: finiteOrString(currentIpLog10(runtime)),
    infinityCount: state.infinityCount,
    generationCount: state.generationCount,
    coreBoostCount: state.coreBoostCount,
    infinityUpgradeMask: state.infinityUpgradeMask,
    infiniteAngleUnlocked: state.infiniteAngleUnlocked,
    towerFloor: state.towerFloor,
    activeChallenge: state.activeChallenge,
    completedChallenges: state.completedChallenges,
    activeTowerChallenge: state.activeTowerChallenge,
    completedTowerChallenges: state.completedTowerChallenges,
    eternityCount: state.eternityCount,
  };
}

function milestonePredicates(runtime) {
  const state = runtime.state;
  const ipEndpoint = runtime.currentExactInfinityPoints() >= runtime.MAX_EXACT_INFINITY_POINTS;
  return {
    "break-infinite-cap": state.infiniteCapBroken === true,
    "infinite-angle-unlock": state.infiniteAngleUnlocked === true,
    "tower-floor-1": state.towerFloor >= 1,
    "tc1-unlock": runtime.towerChallengeUnlocked(1),
    "tc1-clear": runtime.towerChallengeCompleted(1),
    "tc2-unlock": runtime.towerChallengeUnlocked(2),
    "tc2-clear": runtime.towerChallengeCompleted(2),
    "tc3-unlock": runtime.towerChallengeUnlocked(3),
    "tc3-clear": runtime.towerChallengeCompleted(3),
    "tc4-unlock": runtime.towerChallengeUnlocked(4),
    "tc4-clear": runtime.towerChallengeCompleted(4),
    "ic8-clear": runtime.isChallengeCompleted(8),
    "ip-1.80e308": ipEndpoint,
    "eternity-eligibility": runtime.canEternity() === true,
  };
}

function createMilestoneTracker(runtime) {
  const firstReachSeconds = Object.fromEntries(MILESTONE_IDS.map((id) => [id, null]));
  let previousIc8 = runtime.isChallengeCompleted(8);
  let peakScoreLog10 = -Infinity;
  let lastProgressSeconds = 0;
  const events = [];
  const clock = { ic8ClearAtSeconds: null };
  return {
    clock,
    events,
    firstReachSeconds,
    get lastProgressSeconds() { return lastProgressSeconds; },
    get peakScoreLog10() { return peakScoreLog10; },
    observe(elapsedSeconds) {
      const predicates = milestonePredicates(runtime);
      for (const id of MILESTONE_IDS) {
        if (firstReachSeconds[id] === null && predicates[id]) {
          firstReachSeconds[id] = elapsedSeconds;
          events.push({ type: "milestone", id, timeSeconds: elapsedSeconds });
        }
      }
      const scoreLog10 = currentScoreLog10(runtime);
      if (scoreLog10 > peakScoreLog10 + 0.01) {
        peakScoreLog10 = scoreLog10;
        lastProgressSeconds = elapsedSeconds;
      }
      const ic8Completed = runtime.isChallengeCompleted(8);
      if (!previousIc8 && ic8Completed) {
        clock.ic8ClearAtSeconds = elapsedSeconds;
        events.push({ type: "ic8-clear", timeSeconds: elapsedSeconds, timerResetSeconds: 0 });
        lastProgressSeconds = elapsedSeconds;
      }
      previousIc8 = ic8Completed;
      return predicates;
    },
  };
}

function parallelMultiplierLog10(secondsSinceIc8Clear, postSoftcapPower) {
  if (secondsSinceIc8Clear === null || secondsSinceIc8Clear < 0) return 0;
  const rawLog10 = Math.max(0, secondsSinceIc8Clear) * Math.log10(3);
  if (rawLog10 <= 10) return rawLog10;
  return 10 + (rawLog10 - 10) * postSoftcapPower;
}

function realMultiplierLog10(ipLog10) {
  if (!Number.isFinite(ipLog10) || ipLog10 <= 0) return 0;
  return Math.log10(1 + ipLog10);
}

function installResearchEffect(runtime, candidate, clock) {
  const original = runtime.infinityPointGain;
  runtime.infinityPointGain = () => {
    const baseGain = original();
    if (!(baseGain > 0)) return baseGain;
    let multiplierLog10 = 0;
    if (candidate.id === "real-bc16500") {
      multiplierLog10 = realMultiplierLog10(currentIpLog10(runtime));
    } else if (candidate.postSoftcapPower !== null) {
      const nowSeconds = Number.isFinite(clock.nowSeconds) ? clock.nowSeconds : 0;
      const elapsed = clock.ic8ClearAtSeconds === null
        ? null
        : Math.max(0, nowSeconds - clock.ic8ClearAtSeconds);
      multiplierLog10 = parallelMultiplierLog10(elapsed, candidate.postSoftcapPower);
    }
    if (multiplierLog10 <= 0) return baseGain;
    const gainLog10 = runtime.log10Value(baseGain) + multiplierLog10;
    const maximumLog10 = runtime.log10ExactInfinityPoints(runtime.MAX_EXACT_INFINITY_POINTS);
    return Math.max(1, Math.floor(runtime.valueFromLog10(Math.min(gainLog10, maximumLog10))));
  };
  return () => { runtime.infinityPointGain = original; };
}

function configureRuntime(instance) {
  const { runtime } = instance;
  runtime.updateUi = () => {};
  runtime.saveGame = () => true;
  runtime.createCheckpoint = () => true;
}

function buyInfinityUpgrades(runtime, debug) {
  let purchases = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (const upgrade of runtime.INFINITY_UPGRADES) {
      if (debug.buyInfinityUpgrade(upgrade.id)) {
        purchases += 1;
        changed = true;
      }
    }
  }
  return purchases;
}

function configureAutomation(runtime) {
  const state = runtime.state;
  if (!runtime.normalAutomationUnlocked?.()) return false;
  Object.assign(state, {
    automationEnabled: true,
    autoBuySpeed: true,
    autoBuyVertex: true,
    autoBuyGain: true,
    autoBuildTower: false,
    autoRunGeneration: false,
    autoRunCoreBoost: false,
    autoRunInfinity: false,
  });
  return true;
}

function runPolicyAction(instance, policy, actionCounts) {
  const { runtime, debug } = instance;
  const state = runtime.state;
  const count = (name, amount = 1) => { actionCounts[name] = (actionCounts[name] || 0) + amount; };
  configureAutomation(runtime);

  if (!state.infiniteCapBroken && runtime.canBreakInfiniteCap()) {
    debug.breakInfiniteCap();
    count("breakInfiniteCap");
  }
  const normalPurchases = debug.buyAllUpgrades({ refresh: false, save: false });
  if (normalPurchases > 0) count("normalPurchase", normalPurchases);
  const infinityPurchases = buyInfinityUpgrades(runtime, debug);
  if (infinityPurchases > 0) count("infinityPurchase", infinityPurchases);

  if (!state.infiniteAngleUnlocked && currentIpLog10(runtime) >= runtime.INFINITE_ANGLE_UNLOCK_COST_LOG10) {
    if (debug.unlockInfiniteAngle()) count("infiniteAngleUnlock");
  }
  const infiniteAnglePurchases = debug.buyAllInfiniteAngleUpgrades({ refresh: false, save: false });
  if (infiniteAnglePurchases > 0) count("infiniteAnglePurchase", infiniteAnglePurchases);
  let towerPurchases = 0;
  while (debug.buildTower({ refresh: false, save: false })) towerPurchases += 1;
  if (towerPurchases > 0) count("towerPurchase", towerPurchases);

  if (state.activeChallenge > 0 || state.activeTowerChallenge > 0) {
    if (runtime.canInfinity() && state.infinityCount > 0) {
      debug.runInfinity(false);
      count("infinityReset");
    } else if (runtime.completeTowerChallengeIfReady()) {
      count("towerCompletion");
    }
    return;
  }

  if (runtime.canInfinity() && state.infinityCount > 0) {
    const gainLog10 = runtime.log10Value(runtime.infinityPointGain());
    const ipLog10 = currentIpLog10(runtime);
    const threshold = policy.id === "greedy"
      ? policy.infinityGainLog10Reserve
      : Math.max(policy.infinityGainLog10Reserve, Number.isFinite(ipLog10) ? ipLog10 - 1 : 0);
    if (gainLog10 >= threshold) {
      debug.runInfinity(false);
      count("infinityReset");
      return;
    }
  }

  if (runtime.infinityChallengesUnlocked?.()) {
    const nextChallenge = runtime.nextChallengeIndex();
    if (nextChallenge <= runtime.INFINITY_CHALLENGE_COUNT) {
      debug.toggleInfinityChallenge(nextChallenge);
      if (state.activeChallenge === nextChallenge) {
        count("infinityChallengeStart");
        return;
      }
    }
  }

  for (let index = 1; index <= runtime.TOWER_CHALLENGE_COUNT; index += 1) {
    if (runtime.towerChallengeUnlocked(index)
      && !runtime.towerChallengeCompleted(index)
      && debug.toggleTowerChallenge(index)) {
      count("towerChallengeStart");
      return;
    }
  }

  if (runtime.canRunGeneration()
    && runtime.currentGenerationScoreLog10() >= runtime.generationRequirementLog10() + policy.generationDepthLog10) {
    debug.runGeneration();
    count("generationReset");
    return;
  }
  if (runtime.canCoreBoost()) {
    debug.runCoreBoost();
    count("coreBoost");
  }
}

function runBoundedLoop(instance, policy, maxSeconds, options, effect = null) {
  const { runtime, debug } = instance;
  const tracker = createMilestoneTracker(runtime);
  const actionCounts = {};
  let elapsedSeconds = 0;
  let nextActionSeconds = 0;
  let status = "horizon";
  const effectiveStepSeconds = Math.min(options.stepSeconds, runtime.MAX_SIMULATION_STEP_SECONDS);
  const syncEffectClock = () => {
    if (!effect) return;
    effect.clock.nowSeconds = elapsedSeconds;
    effect.clock.ic8ClearAtSeconds = tracker.clock.ic8ClearAtSeconds;
  };
  tracker.observe(0);
  syncEffectClock();
  while (elapsedSeconds < maxSeconds) {
    const step = Math.min(effectiveStepSeconds, maxSeconds - elapsedSeconds);
    debug.update(step);
    elapsedSeconds += step;
    tracker.clock.nowSeconds = elapsedSeconds;
    tracker.observe(elapsedSeconds);
    syncEffectClock();
    if (elapsedSeconds + 1e-9 >= nextActionSeconds) {
      runPolicyAction(instance, policy, actionCounts);
      tracker.clock.nowSeconds = elapsedSeconds;
      tracker.observe(elapsedSeconds);
      syncEffectClock();
      nextActionSeconds += options.actionIntervalSeconds;
    }
    if (runtime.canEternity()) {
      status = "eligible";
      break;
    }
    if (elapsedSeconds - tracker.lastProgressSeconds >= options.maxStallSeconds) {
      status = "stall-no-new-progress";
      break;
    }
  }
  if (status === "horizon" && elapsedSeconds < maxSeconds - 1e-9) status = "stall-no-new-progress";
  return {
    status,
    elapsedSeconds,
    effectiveStepSeconds,
    firstReachSeconds: tracker.firstReachSeconds,
    events: tracker.events,
    actionCounts,
    lastState: reportState(runtime),
    peakScoreLog10: finiteOrString(tracker.peakScoreLog10),
    ic8ClearAtSeconds: tracker.clock.ic8ClearAtSeconds,
    productionPredicates: productionPredicateReport(runtime),
  };
}

async function runPrelude(policy, options) {
  const instance = await loadRuntime(CANDIDATE_PATH);
  configureRuntime(instance);
  const result = runBoundedLoop(instance, policy, options.maxSetupSeconds, options);
  if (result.status !== "eligible") {
    return { policy: policy.id, result, checkpoint: null };
  }
  const { debug, runtime } = instance;
  const preEternity = reportState(runtime);
  assert.equal(debug.canEternity(), true);
  assert.equal(debug.performEternity({ save: false, update: false }), true);
  assert.equal(debug.state.eternityCount, 1);
  const checkpoint = {
    source: "runtime.performEternity({ save: false, update: false })",
    precondition: preEternity,
    postcondition: {
      eternityCount: debug.state.eternityCount,
      completedChallenges: debug.state.completedChallenges,
      completedTowerChallenges: debug.state.completedTowerChallenges,
      currentInfinityPointsLog10: finiteOrString(currentIpLog10(runtime)),
      canEternity: debug.canEternity(),
    },
    state: cloneState(debug.state),
  };
  return { policy: policy.id, result, checkpoint };
}

async function runCase(checkpoint, milestoneId, candidate, policy, options) {
  const instance = await loadRuntime(CANDIDATE_PATH);
  configureRuntime(instance);
  Object.assign(instance.debug.state, cloneState(checkpoint.state));
  assert.equal(instance.debug.state.eternityCount, 1);
  assert.equal(instance.debug.state.completedChallenges, 0);
  assert.equal(instance.debug.state.completedTowerChallenges, 0);
  assert.equal(instance.debug.selectEternityMilestone(milestoneId), true);
  const tracker = createMilestoneTracker(instance.runtime);
  const effect = { clock: tracker.clock };
  const restore = installResearchEffect(instance.runtime, candidate, effect.clock);
  const result = runBoundedLoop(instance, policy, options.maxRunSeconds, options, effect);
  restore();
  const predicates = milestonePredicates(instance.runtime);
  const ipEndpoint = instance.runtime.currentExactInfinityPoints() >= instance.runtime.MAX_EXACT_INFINITY_POINTS;
  const tc4Completed = instance.runtime.towerChallenge4CompletedForEternity() === true;
  return {
    milestoneId,
    candidateId: candidate.id,
    policyId: policy.id,
    selectedMask: instance.debug.state.eternityMilestoneMask,
    status: result.status,
    firstReachSeconds: result.firstReachSeconds,
    events: result.events,
    actionCounts: result.actionCounts,
    ic8ClearAtSeconds: result.ic8ClearAtSeconds,
    finalState: result.lastState,
    predicates,
    formulaChecks: {
      currentRunTc4Completed: tc4Completed,
      ipEndpointReached: ipEndpoint,
      canEternityConjunction: instance.debug.canEternity() === (ipEndpoint && tc4Completed),
      eternityCountRemainedOne: instance.debug.state.eternityCount === 1,
    },
  };
}

function productionPredicateReport(runtime = null) {
  return {
    infinityRequirementLog10: runtime?.INFINITY_REQUIREMENT_LOG10 ?? 308 + Math.log10(1.8),
    eternityIpThresholdLog10: runtime
      ? runtime.log10ExactInfinityPoints(runtime.MAX_EXACT_INFINITY_POINTS)
      : null,
    towerChallengeTargets: [1, 2, 3, 4].map((index) => ({
      index,
      targetLog10: runtime?.towerChallengeTargetLog10(index) ?? null,
    })),
    eternityRule: "currentExactInfinityPoints() >= MAX_EXACT_INFINITY_POINTS && towerChallenge4CompletedForEternity() === true",
    ic8TimerRule: "secondsSinceIC8Clear starts at the observed completedChallenges bit-8 transition",
    errorHandling: "exact IP stays BigInt in the production runtime; research multipliers are clamped to the production exact-IP ceiling before normal addInfinityPoints()",
  };
}

async function createReport(rawOptions = {}) {
  const options = { ...DEFAULT_OPTIONS, ...rawOptions };
  const candidates = options.parallelPostSoftcapPower === null || options.parallelPostSoftcapPower === undefined
    ? CANDIDATES
    : CANDIDATES.map((candidate) => candidate.postSoftcapPower === null
      ? candidate
      : {
        ...candidate,
        postSoftcapPower: options.parallelPostSoftcapPower,
        rawMultiplierCap: candidate.rawMultiplierCap,
        formula: candidate.formula.replace(/post-softcap power [0-9.]+/, `post-softcap power ${options.parallelPostSoftcapPower}`),
      });
  if (options.stepSeconds <= 0 || options.actionIntervalSeconds <= 0) throw new Error("step and action interval must be positive");
  const attempts = [];
  let canonicalPrelude = null;
  for (const policy of POLICIES) {
    const attempt = await runPrelude(policy, options);
    attempts.push({
      policy: attempt.policy,
      status: attempt.result.status,
      elapsedSeconds: attempt.result.elapsedSeconds,
      effectiveStepSeconds: attempt.result.effectiveStepSeconds,
      firstReachSeconds: attempt.result.firstReachSeconds,
      actionCounts: attempt.result.actionCounts,
      lastState: attempt.result.lastState,
      peakScoreLog10: attempt.result.peakScoreLog10,
      events: attempt.result.events,
      productionPredicates: attempt.result.productionPredicates,
    });
    if (attempt.checkpoint) {
      canonicalPrelude = attempt;
      break;
    }
  }

  const report = {
    schemaVersion: 1,
    issue: ISSUE,
    title: "Simulate IC8-to-Eternity progression for Timeline balance",
    researchOnly: true,
    noProductionChanges: true,
    productionRuntime: "src/main.js",
    options: {
      maxSetupSeconds: options.maxSetupSeconds,
      maxRunSeconds: options.maxRunSeconds,
      maxStallSeconds: options.maxStallSeconds,
      requestedStepSeconds: options.stepSeconds,
      actionIntervalSeconds: options.actionIntervalSeconds,
      parallelPostSoftcapPower: options.parallelPostSoftcapPower ?? null,
    },
    policies: POLICIES,
    researchEffects: candidates,
    productionPredicates: attempts[0]?.productionPredicates || productionPredicateReport(),
    validation: {
      step: {
        requestedSeconds: options.stepSeconds,
        effectiveSeconds: attempts[0]?.effectiveStepSeconds ?? null,
      },
      convergence: {
        status: canonicalPrelude ? "case-dependent" : "not-applicable-setup-stall",
        criterion: "same production checkpoint and fixed policy replay; endpoint deltas are reported only after a real checkpoint exists",
        endpointDeltaLog10: null,
      },
      errors: [],
      stall: {
        maxSeconds: options.maxStallSeconds,
        attempts: attempts.map(({ policy, status, elapsedSeconds }) => ({ policy, status, elapsedSeconds })),
      },
    },
    prelude: {
      status: canonicalPrelude ? "completed-first-eternity" : "setup-stall",
      attempts,
      canonicalPolicy: canonicalPrelude?.policy || null,
      checkpoint: canonicalPrelude?.checkpoint || null,
    },
    cases: [],
    outcome: canonicalPrelude
      ? { status: "measured", reason: "production-generated first-Eternity checkpoint replayed" }
      : { status: "setup-stall", reason: "bounded production prelude did not reach a real first Eternity; no IC8 snapshot was fabricated" },
  };

  if (!canonicalPrelude) return report;
  const milestoneIds = ["1-1", "1-2", "1-3"];
  for (const milestoneId of milestoneIds) {
    for (const policy of POLICIES) {
      for (const candidate of candidates) {
        report.cases.push(await runCase(canonicalPrelude.checkpoint, milestoneId, candidate, policy, options));
      }
    }
  }
  return report;
}

function formatSeconds(seconds) {
  if (seconds === null || seconds === undefined) return "not reached";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${(seconds / 60).toFixed(2)}m`;
}

function formatMarkdown(report) {
  const lines = [
    `# IC8-to-Eternity progression (Issue #${report.issue})`,
    "",
    "> Research evidence only. No production gameplay, Timeline, or balance formula was changed.",
    "",
    `- Outcome: **${report.outcome.status}** — ${report.outcome.reason}`,
    `- Step: requested **${report.options.requestedStepSeconds}s**, action interval **${report.options.actionIntervalSeconds}s**; all runtime updates are bounded by the production simulation step.`,
    `- Effects: ${report.researchEffects.map((candidate) => `**${candidate.id}**`).join(", ")}`,
    "",
    "## Prelude",
    "",
    "| Policy | Status | Elapsed | Peak score log10 | IC8 clear | Eternity eligibility |",
    "| --- | --- | ---: | ---: | --- | --- |",
  ];
  report.prelude.attempts.forEach((attempt) => lines.push(
    `| ${attempt.policy} | ${attempt.status} | ${formatSeconds(attempt.elapsedSeconds)} | ${attempt.peakScoreLog10} | ${formatSeconds(attempt.firstReachSeconds["tc4-clear"])} | ${formatSeconds(attempt.firstReachSeconds["eternity-eligibility"])} |`,
  ));
  if (report.prelude.checkpoint) {
    lines.push(
      "",
      "- Canonical checkpoint source: " + report.prelude.checkpoint.source
        + "; postcondition eternityCount=" + report.prelude.checkpoint.postcondition.eternityCount + ".",
      "",
      "## Case results",
      "",
      "| Milestone | Effect | Policy | Status | IC8 clear | Eternity eligibility |",
      "| --- | --- | --- | --- | ---: | ---: |",
    );
    report.cases.forEach((entry) => lines.push(
      `| ${entry.milestoneId} | ${entry.candidateId} | ${entry.policyId} | ${entry.status} | ${formatSeconds(entry.firstReachSeconds["ic8-clear"])} | ${formatSeconds(entry.firstReachSeconds["eternity-eligibility"])} |`,
    ));
  } else {
    lines.push("", "No post-Eternity cases were run because the canonical setup did not reach a real first Eternity.");
  }
  lines.push("", "## Required milestones", "", `- ${MILESTONE_IDS.join(", ")}`, "- IC8 timer starts only on the observed completed-challenges bit transition; setup-stall never claims IC8 completion.", "- Greedy and threshold-aware are bounded comparison policies, not a global-optimality claim.");
  return `${lines.join("\n")}\n`;
}

function writeReports(report, reportPath = DEFAULT_REPORT_PATH, markdownPath = DEFAULT_MARKDOWN_PATH) {
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, formatMarkdown(report));
}

async function main() {
  const options = parseArgs(process.argv);
  const report = await createReport(options);
  if (options.writeReports) writeReports(report);
  process.stdout.write(`${JSON.stringify({ issue: report.issue, outcome: report.outcome, cases: report.cases.length }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  CANDIDATES,
  DEFAULT_OPTIONS,
  MILESTONE_IDS,
  POLICIES,
  cloneState,
  createMilestoneTracker,
  createReport,
  formatMarkdown,
  installResearchEffect,
  parallelMultiplierLog10,
  productionPredicateReport,
  realMultiplierLog10,
  writeReports,
};
