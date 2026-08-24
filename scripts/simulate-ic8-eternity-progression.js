const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadRuntime } = require("../tests/runtime-harness-esm.js");

const ISSUE = 237;
const CANDIDATE_PATH = path.join(__dirname, "..", "src", "main.js");
const DEFAULT_REPORT_PATH = path.join(__dirname, "..", "reports", "ic8-eternity-progression.json");
const DEFAULT_MARKDOWN_PATH = path.join(__dirname, "..", "reports", "ic8-eternity-progression.md");
const MAX_RECORDED_EVENTS = 4096;
const MIN_INFINITY_COUNT_BEFORE_IC3 = 100;
const REQUIRED_INFINITY_UPGRADE_IDS_BEFORE_IC7 = Object.freeze(["11-1", "11-2"]);
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
    maxGenerationDepthLog10: 5,
    challengeGenerationDepthLog10: 5,
    infinityGainLog10Reserve: 0,
  }),
  Object.freeze({
    id: "threshold-aware",
    description: "buy legal upgrades, use a deeper Generation run where possible, then reset at the next legal IP threshold",
    maxGenerationDepthLog10: 8,
    challengeGenerationDepthLog10: 5,
    infinityGainLog10Reserve: 0,
  }),
]);
const REQUIRED_INFINITY_UPGRADE_IDS = Object.freeze([
  "1-1", "1-2", "2-1", "3-1", "3-2", "4-1",
  "5-1", "5-2", "6-1", "6-2", "7-1", "7-2", "8-1", "9-1", "10-1", "10-2",
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
  maxSetupSeconds: 10 * 365 * 24 * 60 * 60,
  maxRunSeconds: 10 * 365 * 24 * 60 * 60,
  maxStallSeconds: 30 * 24 * 60 * 60,
  stepSeconds: 3600,
  actionIntervalSeconds: 3600,
  maxActionsPerTick: 256,
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
    maxActionsPerTick: parseNumberOption(args, "--max-actions-per-tick", DEFAULT_OPTIONS.maxActionsPerTick, 1),
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

function progressSnapshot(runtime) {
  const state = runtime.state;
  return {
    scoreLog10: currentScoreLog10(runtime),
    generationScoreLog10: runtime.currentGenerationScoreLog10(),
    totalScoreLog10: runtime.currentTotalScoreLog10?.() ?? state.totalScoreLog10,
    vertices: state.vertices,
    speedLevel: state.speedLevel,
    gainLevel: state.gainLevel,
    generationCount: state.generationCount,
    coreBoostCount: state.coreBoostCount,
    infinityCount: state.infinityCount,
    infinityPointLog10: currentIpLog10(runtime),
    infinityUpgradeMask: state.infinityUpgradeMask,
    infiniteAngleUnlocked: state.infiniteAngleUnlocked,
    infiniteAngleSpeedLevel: state.infiniteAngleSpeedLevel,
    infiniteAngleVertexLevel: state.infiniteAngleVertexLevel,
    infiniteAngleGainLevel: state.infiniteAngleGainLevel,
    towerFloor: state.towerFloor,
    activeChallenge: state.activeChallenge,
    completedChallenges: state.completedChallenges,
    activeTowerChallenge: state.activeTowerChallenge,
    completedTowerChallenges: state.completedTowerChallenges,
    infiniteCapBroken: state.infiniteCapBroken,
  };
}

function reportState(runtime) {
  const state = runtime.state;
  return {
    scoreLog10: finiteOrString(currentScoreLog10(runtime)),
    generationScoreLog10: finiteOrString(runtime.currentGenerationScoreLog10()),
    previousGenerationScoreLog10: finiteOrString(runtime.currentPreviousGenerationScoreLog10?.()),
    generationScoreMultiplierLog10: finiteOrString(state.generationScoreMultiplierLog10),
    generationCostFactor: finiteOrString(state.generationCostFactor),
    coreBoostRequirementLog10: finiteOrString(runtime.coreBoostRequirementLog10?.()),
    totalScoreLog10: finiteOrString(runtime.currentTotalScoreLog10?.() ?? state.totalScoreLog10),
    vertices: state.vertices,
    speedLevel: state.speedLevel,
    gainLevel: state.gainLevel,
    infinityPointLog10: finiteOrString(currentIpLog10(runtime)),
    infinityCount: state.infinityCount,
    generationCount: state.generationCount,
    coreBoostCount: state.coreBoostCount,
    infinityUpgradeMask: state.infinityUpgradeMask,
    infiniteAngleUnlocked: state.infiniteAngleUnlocked,
    infiniteAngleSpeedLevel: state.infiniteAngleSpeedLevel,
    infiniteAngleVertexLevel: state.infiniteAngleVertexLevel,
    infiniteAngleGainLevel: state.infiniteAngleGainLevel,
    towerFloor: state.towerFloor,
    activeChallenge: state.activeChallenge,
    completedChallenges: state.completedChallenges,
    activeTowerChallenge: state.activeTowerChallenge,
    completedTowerChallenges: state.completedTowerChallenges,
    tc4BaseGainLevel: state.tc4BaseGainLevel,
    tc4InfinityScoreVertexGainLevel: state.tc4InfinityScoreVertexGainLevel,
    tc4FreeCoreBoostLevel: state.tc4FreeCoreBoostLevel,
    infiniteCapBroken: state.infiniteCapBroken,
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
  const relativeFirstReachSeconds = Object.fromEntries(MILESTONE_IDS.map((id) => [id, null]));
  const milestoneTiming = Object.fromEntries(MILESTONE_IDS.map((id) => [id, null]));
  const stateSnapshots = [];
  let previousIc8 = runtime.isChallengeCompleted(8);
  let peakScoreLog10 = -Infinity;
  let lastProgressSeconds = 0;
  let previousSnapshot = null;
  let bestLog10 = {
    scoreLog10: -Infinity,
    generationScoreLog10: -Infinity,
    totalScoreLog10: -Infinity,
    infinityPointLog10: -Infinity,
  };
  let lastProgressEventSeconds = -Infinity;
  let lastProgressEventScoreLog10 = -Infinity;
  const events = [];
  let droppedEvents = 0;
  const clock = { ic8ClearAtSeconds: null };
  const recordEvent = (event) => {
    if (events.length < MAX_RECORDED_EVENTS) events.push({ ...event, state: reportState(runtime) });
    else droppedEvents += 1;
  };
  const stateChanged = (current, previous) => previous && Object.keys(current).some((key) => {
    if (key.endsWith("Log10")) return false;
    return current[key] !== previous[key];
  });
  return {
    clock,
    events,
    get droppedEvents() { return droppedEvents; },
    firstReachSeconds,
    relativeFirstReachSeconds,
    milestoneTiming,
    stateSnapshots,
    get lastProgressSeconds() { return lastProgressSeconds; },
    get peakScoreLog10() { return peakScoreLog10; },
    observe(elapsedSeconds) {
      const predicates = milestonePredicates(runtime);
      for (const id of MILESTONE_IDS) {
        if (firstReachSeconds[id] === null && predicates[id]) {
          firstReachSeconds[id] = elapsedSeconds;
          if (clock.ic8ClearAtSeconds !== null) {
            relativeFirstReachSeconds[id] = Math.max(0, elapsedSeconds - clock.ic8ClearAtSeconds);
            milestoneTiming[id] = "post-IC8";
          } else if (id !== "ic8-clear") {
            milestoneTiming[id] = "pre-IC8";
          }
          const snapshot = reportState(runtime);
          stateSnapshots.push({ id, absoluteSeconds: elapsedSeconds, relativeSeconds: relativeFirstReachSeconds[id], snapshot });
          recordEvent({ type: "milestone", id, timeSeconds: elapsedSeconds });
        }
      }
      const snapshot = progressSnapshot(runtime);
      const scoreLog10 = snapshot.scoreLog10;
      if (scoreLog10 > peakScoreLog10 + 0.01) {
        peakScoreLog10 = scoreLog10;
      }
      const advancedFields = [];
      for (const key of ["scoreLog10", "generationScoreLog10", "totalScoreLog10", "infinityPointLog10"]) {
        if (snapshot[key] > bestLog10[key] + 0.01) {
          bestLog10[key] = snapshot[key];
          advancedFields.push(key);
        }
        if (previousSnapshot && snapshot[key] > previousSnapshot[key] + 0.01 && !advancedFields.includes(key)) {
          advancedFields.push(key);
        }
      }
      if (stateChanged(snapshot, previousSnapshot)) {
        for (const key of Object.keys(snapshot)) {
          if (snapshot[key] !== previousSnapshot[key] && !advancedFields.includes(key)) advancedFields.push(key);
        }
      }
      if (advancedFields.length > 0) {
        lastProgressSeconds = elapsedSeconds;
        const shouldRecord = advancedFields.some((key) => !key.endsWith("Log10"))
          || elapsedSeconds - lastProgressEventSeconds >= 60
          || snapshot.scoreLog10 - lastProgressEventScoreLog10 >= 1;
        if (shouldRecord) {
          recordEvent({ type: "progress", timeSeconds: elapsedSeconds, fields: advancedFields, snapshot: reportState(runtime) });
          lastProgressEventSeconds = elapsedSeconds;
          lastProgressEventScoreLog10 = snapshot.scoreLog10;
        }
      }
      const ic8Completed = runtime.isChallengeCompleted(8);
      if (!previousIc8 && ic8Completed) {
        clock.ic8ClearAtSeconds = elapsedSeconds;
        relativeFirstReachSeconds["ic8-clear"] = 0;
        milestoneTiming["ic8-clear"] = "post-IC8";
        const ic8Snapshot = reportState(runtime);
        stateSnapshots.push({ id: "ic8-clear", absoluteSeconds: elapsedSeconds, relativeSeconds: 0, snapshot: ic8Snapshot });
        recordEvent({ type: "ic8-clear", timeSeconds: elapsedSeconds, timerResetSeconds: 0 });
        lastProgressSeconds = elapsedSeconds;
        if (firstReachSeconds["ic8-clear"] === null) firstReachSeconds["ic8-clear"] = elapsedSeconds;
        for (const id of MILESTONE_IDS) {
          if (firstReachSeconds[id] !== null && firstReachSeconds[id] >= elapsedSeconds && id !== "ic8-clear") {
            relativeFirstReachSeconds[id] = firstReachSeconds[id] - elapsedSeconds;
            milestoneTiming[id] = "post-IC8";
          }
        }
      }
      previousIc8 = ic8Completed;
      previousSnapshot = snapshot;
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

function hasAffordableInfinityUpgrade(runtime) {
  return runtime.INFINITY_UPGRADES.some((upgrade) => runtime.canBuyInfinityUpgrade(upgrade.id));
}

function hasUnownedInfinityUpgrade(runtime) {
  return REQUIRED_INFINITY_UPGRADE_IDS.some((id) => {
    const upgrade = runtime.infinityUpgradeById(id);
    return upgrade && !runtime.hasInfinityUpgrade(id) && runtime.infinityUpgradePrerequisitesMet(upgrade);
  });
}

function hasUnownedInfinityUpgradeIds(runtime, ids) {
  return ids.some((id) => {
    const upgrade = runtime.infinityUpgradeById(id);
    return upgrade && !runtime.hasInfinityUpgrade(id) && runtime.infinityUpgradePrerequisitesMet(upgrade);
  });
}

function progressionTargetLog10(runtime) {
  if (runtime.state.activeTowerChallenge > 0) {
    return runtime.towerChallengeTargetLog10(runtime.state.activeTowerChallenge);
  }
  if (runtime.state.activeChallenge > 0) return runtime.INFINITY_REQUIREMENT_LOG10;
  return runtime.state.infiniteCapBroken
    ? runtime.INFINITY_REQUIREMENT_LOG10
    : runtime.BREAK_CAP_REQUIREMENT_LOG10;
}

function runGenerationOrCore(instance, policy, count) {
  const { runtime, debug } = instance;
  const targetLog10 = progressionTargetLog10(runtime);
  const currentScore = currentScoreLog10(runtime);
  const generationRequirement = runtime.generationRequirementLog10();
  const isIc7 = runtime.state.activeChallenge === 7;
  if (isIc7) {
    if (runtime.state.coreBoostCount < 3 && runtime.canCoreBoost()) {
      debug.runCoreBoost();
      count("coreBoost");
      return true;
    }
    const generationReadyAt = generationRequirement + 5;
    if (runtime.canRunGeneration()
      && runtime.currentGenerationScoreLog10() >= generationReadyAt
      && currentScore < targetLog10) {
      debug.runGeneration();
      count("generationReset");
      return true;
    }
    return false;
  }
  const maxGenerationDepth = runtime.state.activeChallenge > 0 || runtime.state.activeTowerChallenge > 0
    ? policy.challengeGenerationDepthLog10
    : policy.maxGenerationDepthLog10;
  const generationDepth = Math.min(maxGenerationDepth, Math.max(0.1, targetLog10 - generationRequirement - 1));
  const generationReadyAt = generationRequirement + generationDepth;
  const nearTarget = !isIc7 && currentScore >= targetLog10 - 5;
  if (runtime.canRunGeneration()
    && (runtime.currentGenerationScoreLog10() >= generationReadyAt || nearTarget)
    && currentScore < targetLog10) {
    debug.runGeneration();
    count("generationReset");
    return true;
  }
  const generationScore = runtime.currentGenerationScoreLog10();
  if (currentScore >= generationReadyAt - 1
    && currentScore < targetLog10 - 1
    && currentScore <= generationScore + 1) return false;
  if (runtime.canCoreBoost()
    && runtime.coreBoostRequirementLog10() < targetLog10 - 1) {
    debug.runCoreBoost();
    count("coreBoost");
    return true;
  }
  return false;
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
  const manualNormalPurchaseNeeded = !runtime.normalAutomationUnlocked?.()
    || state.activeChallenge !== 7
    || currentScoreLog10(runtime) < 30;
  if (manualNormalPurchaseNeeded) {
    const normalPurchases = debug.buyAllUpgrades({ refresh: false, save: false });
    if (normalPurchases > 0) count("normalPurchase", normalPurchases);
  }
  const infinityPurchases = buyInfinityUpgrades(runtime, debug);
  if (infinityPurchases > 0) count("infinityPurchase", infinityPurchases);

  if (!state.infiniteAngleUnlocked && currentIpLog10(runtime) >= runtime.INFINITE_ANGLE_UNLOCK_COST_LOG10) {
    if (debug.unlockInfiniteAngle()) count("infiniteAngleUnlock");
  }
  const infiniteAnglePurchases = debug.buyAllInfiniteAngleUpgrades({ refresh: false, save: false });
  if (infiniteAnglePurchases > 0) count("infiniteAnglePurchase", infiniteAnglePurchases);
  let tc4Purchases = 0;
  if (state.activeTowerChallenge === 4) {
    for (const kind of ["baseGain", "infinityScoreVertexGain", "freeCoreBoost"]) {
      while (debug.buyTowerChallenge4Upgrade(kind, { refresh: false, save: false })) tc4Purchases += 1;
    }
  }
  if (tc4Purchases > 0) count("tc4Purchase", tc4Purchases);
  let towerPurchases = 0;
  while (debug.buildTower({ refresh: false, save: false })) towerPurchases += 1;
  if (towerPurchases > 0) count("towerPurchase", towerPurchases);

  if (state.activeChallenge > 0 || state.activeTowerChallenge > 0) {
    if (runtime.completeTowerChallengeIfReady()) {
      count("towerCompletion");
    } else if (runtime.canInfinity() && state.infinityCount > 0) {
      debug.runInfinity(false);
      count("infinityReset");
    } else {
      runGenerationOrCore(instance, policy, count);
    }
    return;
  }

  if (runtime.infinityChallengesUnlocked?.()
    && runtime.completedChallengeCount() < runtime.INFINITY_CHALLENGE_COUNT) {
    const nextChallenge = runtime.nextChallengeIndex();
    const challengeNeedsBrokenCap = nextChallenge >= 7 && !state.infiniteCapBroken;
    const challengeNeedsInfinityReserve = nextChallenge >= 3
      && state.infinityCount < MIN_INFINITY_COUNT_BEFORE_IC3;
    const challengeNeedsPostCapUpgrades = nextChallenge === 7
      && state.infiniteCapBroken
      && hasUnownedInfinityUpgradeIds(runtime, REQUIRED_INFINITY_UPGRADE_IDS_BEFORE_IC7);
    if (nextChallenge <= runtime.INFINITY_CHALLENGE_COUNT
      && !challengeNeedsBrokenCap
      && !challengeNeedsInfinityReserve
      && !challengeNeedsPostCapUpgrades) {
      debug.toggleInfinityChallenge(nextChallenge);
      if (state.activeChallenge === nextChallenge) {
        count("infinityChallengeStart");
        return;
      }
    }
  }

  const holdingForCap = !state.infiniteCapBroken
    && runtime.completedChallengeCount() >= 6
    && !hasUnownedInfinityUpgrade(runtime)
    && currentScoreLog10(runtime) >= runtime.INFINITY_REQUIREMENT_LOG10;
  if (runtime.canInfinity()
    && state.infinityCount > 0
    && !hasAffordableInfinityUpgrade(runtime)
    && !holdingForCap
    && (hasUnownedInfinityUpgrade(runtime)
      || currentScoreLog10(runtime) >= progressionTargetLog10(runtime) - 1)) {
    const gainLog10 = runtime.log10Value(runtime.infinityPointGain());
    if (gainLog10 >= policy.infinityGainLog10Reserve) {
      debug.runInfinity(false);
      count("infinityReset");
      return;
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

  runGenerationOrCore(instance, policy, count);
}

function runBoundedLoop(instance, policy, maxSeconds, options, effect = null) {
  const { runtime, debug } = instance;
  const tracker = createMilestoneTracker(runtime);
  const actionCounts = {};
  let elapsedSeconds = 0;
  let nextActionSeconds = 0;
  let status = "horizon";
  // The production update path accepts larger deterministic research ticks. The
  // default remains one production frame; CLI callers can choose a larger tick
  // when a long-horizon report would otherwise be impractical.
  const effectiveStepSeconds = options.stepSeconds;
  const syncEffectClock = () => {
    if (!effect) return;
    effect.clock.nowSeconds = elapsedSeconds;
    effect.clock.ic8ClearAtSeconds = tracker.clock.ic8ClearAtSeconds;
  };
  tracker.observe(0);
  runPolicyAction(instance, policy, actionCounts);
  tracker.observe(0);
  nextActionSeconds = options.actionIntervalSeconds;
  syncEffectClock();
  while (elapsedSeconds < maxSeconds) {
    const restrictedChallengeStep = runtime.state.activeChallenge === 7
      ? currentScoreLog10(runtime) < 30
        ? runtime.MAX_SIMULATION_STEP_SECONDS
        : effectiveStepSeconds
      : effectiveStepSeconds;
    const step = Math.min(restrictedChallengeStep, maxSeconds - elapsedSeconds);
    if (effect) effect.clock.nowSeconds = elapsedSeconds + step;
    debug.update(step);
    elapsedSeconds += step;
    tracker.clock.nowSeconds = elapsedSeconds;
    tracker.observe(elapsedSeconds);
    syncEffectClock();
    let actionsThisTick = 0;
    const maxActionsPerTick = options.maxActionsPerTick ?? DEFAULT_OPTIONS.maxActionsPerTick;
    while (elapsedSeconds + 1e-9 >= nextActionSeconds && actionsThisTick < maxActionsPerTick) {
      runPolicyAction(instance, policy, actionCounts);
      tracker.clock.nowSeconds = elapsedSeconds;
      tracker.observe(elapsedSeconds);
      syncEffectClock();
      const ic7PurchaseWindow = runtime.state.activeChallenge === 7
        && currentScoreLog10(runtime) < 30;
      nextActionSeconds += ic7PurchaseWindow
        ? runtime.MAX_SIMULATION_STEP_SECONDS
        : options.actionIntervalSeconds;
      actionsThisTick += 1;
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
    horizonSeconds: maxSeconds,
    truncatedAtHorizon: status === "horizon",
    elapsedSeconds,
    effectiveStepSeconds,
    firstReachSeconds: tracker.firstReachSeconds,
    relativeFirstReachSeconds: tracker.relativeFirstReachSeconds,
    milestoneTiming: tracker.milestoneTiming,
    stateSnapshots: tracker.stateSnapshots,
    events: tracker.events,
    droppedEvents: tracker.droppedEvents,
    actionCounts,
    state: cloneState(runtime.state),
    lastState: reportState(runtime),
    peakScoreLog10: finiteOrString(tracker.peakScoreLog10),
    ic8ClearAtSeconds: tracker.clock.ic8ClearAtSeconds,
    productionPredicates: productionPredicateReport(runtime),
  };
}

function captureEternityCheckpoint(instance) {
  const { debug, runtime } = instance;
  assert.equal(runtime.canEternity(), true);
  const preEternity = reportState(runtime);
  assert.equal(debug.performEternity({ save: false, update: false }), true);
  assert.equal(debug.state.eternityCount, 1);
  return {
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
}

function runSummary(firstReachSeconds, relativeFirstReachSeconds, candidate, finalState, status) {
  const postMilestones = MILESTONE_IDS
    .filter((id) => relativeFirstReachSeconds[id] !== null)
    .map((id) => ({ id, relativeSeconds: relativeFirstReachSeconds[id] }));
  const stages = postMilestones.slice(1).map((milestone, index) => ({
    from: postMilestones[index].id,
    to: milestone.id,
    durationSeconds: milestone.relativeSeconds - postMilestones[index].relativeSeconds,
  }));
  const longestStage = stages.reduce((longest, stage) => (
    !longest || stage.durationSeconds > longest.durationSeconds ? stage : longest
  ), null);
  const endpointSeconds = relativeFirstReachSeconds["eternity-eligibility"];
  const rawMultiplierCapSeconds = 10 / Math.log10(3);
  const parallelEffectiveMultiplierLog10 = candidate.postSoftcapPower === null || endpointSeconds === null
    ? 0
    : parallelMultiplierLog10(endpointSeconds, candidate.postSoftcapPower);
  const finalIpLog10 = Number(finalState.infinityPointLog10);
  const realAtEndpointLog10 = realMultiplierLog10(finalIpLog10);
  return {
    ic8ToEternitySeconds: endpointSeconds,
    postIc8Milestones: postMilestones,
    stages,
    longestStage,
    realMultiplierLog10AtEndpoint: realAtEndpointLog10,
    parallelRawMultiplierCapSeconds: rawMultiplierCapSeconds,
    parallelRawX1e10Reached: endpointSeconds !== null && endpointSeconds >= rawMultiplierCapSeconds,
    parallelEffectiveMultiplierLog10AtEndpoint: parallelEffectiveMultiplierLog10,
    collapseRisk: status !== "eligible"
      ? "unmeasured-horizon"
      : candidate.postSoftcapPower === null
        ? "not-applicable"
        : endpointSeconds >= rawMultiplierCapSeconds * 2
          ? "cap-exposed"
          : "not-observed",
    preIc8Milestones: MILESTONE_IDS.filter((id) => (
      firstReachSeconds[id] !== null && relativeFirstReachSeconds[id] === null
    )),
  };
}

async function runPrelude(policy, options) {
  const instance = await loadRuntime(CANDIDATE_PATH);
  configureRuntime(instance);
  const result = runBoundedLoop(instance, policy, options.maxSetupSeconds, options);
  if (result.status !== "eligible") {
    return { policy: policy.id, result, checkpoint: null };
  }
  return { policy: policy.id, result, checkpoint: captureEternityCheckpoint(instance) };
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
    horizonSeconds: result.horizonSeconds,
    truncatedAtHorizon: result.truncatedAtHorizon,
    elapsedSeconds: result.elapsedSeconds,
    firstReachSeconds: result.firstReachSeconds,
    events: result.events,
    actionCounts: result.actionCounts,
    ic8ClearAtSeconds: result.ic8ClearAtSeconds,
    relativeFirstReachSeconds: result.relativeFirstReachSeconds,
    milestoneTiming: result.milestoneTiming,
    stateSnapshots: result.stateSnapshots,
    finalState: result.lastState,
    droppedEvents: result.droppedEvents,
    predicates,
    researchSummary: runSummary(
      result.firstReachSeconds,
      result.relativeFirstReachSeconds,
      candidate,
      result.lastState,
      result.status,
    ),
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
      horizonSeconds: attempt.result.horizonSeconds,
      truncatedAtHorizon: attempt.result.truncatedAtHorizon,
      elapsedSeconds: attempt.result.elapsedSeconds,
      effectiveStepSeconds: attempt.result.effectiveStepSeconds,
      firstReachSeconds: attempt.result.firstReachSeconds,
      relativeFirstReachSeconds: attempt.result.relativeFirstReachSeconds,
      milestoneTiming: attempt.result.milestoneTiming,
      stateSnapshots: attempt.result.stateSnapshots,
      droppedEvents: attempt.result.droppedEvents,
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
    schemaVersion: 2,
    issue: ISSUE,
    title: "Make the IC8-to-Eternity simulator produce a real Eternity-1 post-IC8 baseline",
    researchOnly: true,
    noProductionChanges: true,
    productionRuntime: "src/main.js",
    options: {
      maxSetupSeconds: options.maxSetupSeconds,
      maxRunSeconds: options.maxRunSeconds,
      maxStallSeconds: options.maxStallSeconds,
      requestedStepSeconds: options.stepSeconds,
      actionIntervalSeconds: options.actionIntervalSeconds,
      maxActionsPerTick: options.maxActionsPerTick,
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
        criterion: "same production checkpoint and fresh runtime per 1-1/1-2/1-3 case; endpoint deltas are reported only after a real checkpoint exists",
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
      : { status: "setup-stall", reason: "bounded production prelude did not reach a real first Eternity; no IC8 or post-IC8 snapshot was fabricated" },
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
  if (seconds >= 24 * 60 * 60) return `${(seconds / (24 * 60 * 60)).toFixed(2)}d`;
  if (seconds >= 60 * 60) return `${(seconds / (60 * 60)).toFixed(2)}h`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${(seconds / 60).toFixed(2)}m`;
}

function formatLog10Multiplier(log10) {
  if (!Number.isFinite(log10) || log10 <= 0) return "x1";
  return `x10^${log10.toFixed(2)}`;
}

function formatMarkdown(report) {
  const lines = [
    `# IC8-to-Eternity progression (Issue #${report.issue})`,
    "",
    "> Research evidence only. No production gameplay, Timeline, or balance formula was changed.",
    "",
    `- Outcome: **${report.outcome.status}** — ${report.outcome.reason}`,
    `- Step: requested **${report.options.requestedStepSeconds}s**, action interval **${report.options.actionIntervalSeconds}s**; every tick calls the production runtime update path.`,
    `- Horizons: setup **${formatSeconds(report.options.maxSetupSeconds)}**, case **${formatSeconds(report.options.maxRunSeconds)}**, stall **${formatSeconds(report.options.maxStallSeconds)}**; truncation is reported per attempt/case.`,
    `- Effects: ${report.researchEffects.map((candidate) => `**${candidate.id}**`).join(", ")}`,
    "",
    "## Prelude",
    "",
    "| Policy | Status | Elapsed | Peak score log10 | IC8 clear | Eternity eligibility |",
    "| --- | --- | ---: | ---: | --- | --- |",
  ];
  report.prelude.attempts.forEach((attempt) => lines.push(
    `| ${attempt.policy} | ${attempt.status}${attempt.truncatedAtHorizon ? " (horizon)" : ""} | ${formatSeconds(attempt.elapsedSeconds)} | ${attempt.peakScoreLog10} | ${formatSeconds(attempt.firstReachSeconds["ic8-clear"])} | ${formatSeconds(attempt.firstReachSeconds["eternity-eligibility"])} |`,
  ));
  if (report.prelude.checkpoint) {
    lines.push(
      "",
      "- Canonical checkpoint source: " + report.prelude.checkpoint.source
        + "; postcondition eternityCount=" + report.prelude.checkpoint.postcondition.eternityCount + ".",
      "",
      "## Case results",
      "",
      "| Milestone | Effect | Policy | Status | IC8 clear (relative) | Eternity eligibility (relative) |",
      "| --- | --- | --- | --- | ---: | ---: |",
    );
    report.cases.forEach((entry) => lines.push(
      `| ${entry.milestoneId} | ${entry.candidateId} | ${entry.policyId} | ${entry.status}${entry.truncatedAtHorizon ? " (horizon)" : ""} | ${formatSeconds(entry.relativeFirstReachSeconds["ic8-clear"])} | ${formatSeconds(entry.researchSummary.ic8ToEternitySeconds)} |`,
    ));
    lines.push(
      "",
      "## Human-readable research answers",
      "",
      "| Case | Effect | Policy | IC8 → Eternity | Longest post-IC8 stage | Real shortening | Parallel raw x1e10 | Parallel effective multiplier | Collapse risk |",
      "| --- | --- | --- | ---: | --- | --- | --- | --- |",
    );
    report.cases.forEach((entry) => {
      const summary = entry.researchSummary;
      lines.push(
        `| ${entry.milestoneId} | ${entry.candidateId} | ${entry.policyId} | ${formatSeconds(summary.ic8ToEternitySeconds)} | ${summary.longestStage ? `${summary.longestStage.from} → ${summary.longestStage.to} (${formatSeconds(summary.longestStage.durationSeconds)})` : "not reached"} | ${formatLog10Multiplier(summary.realMultiplierLog10AtEndpoint)} IP gain | ${summary.parallelRawX1e10Reached ? "reached" : `not reached (at ${formatSeconds(summary.parallelRawMultiplierCapSeconds)})`} | ${formatLog10Multiplier(summary.parallelEffectiveMultiplierLog10AtEndpoint)} | ${summary.collapseRisk} |`,
      );
    });
  } else {
    lines.push("", "No post-Eternity cases were run because the canonical setup did not reach a real first Eternity.");
  }
  lines.push(
    "",
    "## Required milestones",
    "",
    `- ${MILESTONE_IDS.join(", ")}`,
    "- IC8 timer starts only on the observed completed-challenges bit transition; setup-stall never claims IC8 completion.",
    "- Greedy and threshold-aware are bounded comparison policies, not a global-optimality claim.",
    "- A post-IC8 state is reported only after a real runtime `performEternity()` checkpoint and a fresh case runtime.",
  );
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
  captureEternityCheckpoint,
  createMilestoneTracker,
  createReport,
  formatMarkdown,
  installResearchEffect,
  parallelMultiplierLog10,
  progressSnapshot,
  productionPredicateReport,
  realMultiplierLog10,
  runBoundedLoop,
  runPolicyAction,
  runPrelude,
  writeReports,
};
