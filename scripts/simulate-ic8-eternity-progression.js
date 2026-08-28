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
const POLICIES = Object.freeze([Object.freeze({
  id: "representative-m1-2",
  description: "fixed post-IC8 policy; deepen Generation/Core until one Infinity funds the next Tower/IP threshold",
  maxGenerationDepthLog10: 8,
  challengeGenerationDepthLog10: 5,
  infinityGainLog10Reserve: 0,
  buyInfiniteAngleUpgrades: false,
})]);
const REPRESENTATIVE_FIXTURE = Object.freeze({
  id: "eternity-1-milestone-1-2-post-ic8",
  boundary: "representative post-IC8 state; fixture initialization is t = 0",
  exactInfinityPoints: (10n ** 100n).toString(),
  state: Object.freeze({
    score: 100,
    scoreLog10: 2,
    totalScore: 0,
    totalScoreLog10: -Infinity,
    generationScore: 0,
    generationScoreLog10: -Infinity,
    vertices: 3,
    ic8VertexUpgradeLevel: 0,
    speedLevel: 0,
    gainLevel: 0,
    currentGain: 1,
    currentGainLog10: 0,
    pointProgress: 0,
    totalVertexProgress: 0,
    lastVertexIndex: 0,
    generationCount: 0,
    previousGenerationScore: 0,
    previousGenerationScoreLog10: -Infinity,
    generationScoreMultiplier: 1,
    generationScoreMultiplierLog10: 0,
    generationCostFactor: 0.7,
    coreBoostCount: 2,
    infinityCount: 600000,
    eternityCount: 1,
    eternityMilestoneMask: 2,
    eternityMilestoneChoice: "",
    infinityUpgradeMask: (1 << 21) - 1,
    infiniteScore: 0,
    infiniteScoreLog10: -Infinity,
    infiniteAngleUnlocked: true,
    infiniteAngleSpeedLevel: 1000,
    infiniteAngleVertexLevel: 1000,
    infiniteAngleGainLevel: 1000,
    infiniteAngleCurrentGain: 1,
    infiniteAngleCurrentGainLog10: 0,
    infiniteAnglePointProgress: 0,
    infiniteAngleTotalVertexProgress: 0,
    infiniteAngleLastVertexIndex: 0,
    towerFloor: 4,
    ipGainUpgradeLevel: 0,
    infiniteAngleUpgradeLevel: 0,
    softcapUpgradeLevel: 0,
    activeChallenge: 0,
    completedChallenges: (1 << 8) - 1,
    activeChallengeTime: 0,
    activeTowerChallenge: 0,
    completedTowerChallenges: 0,
    activeTowerChallengeTime: 0,
    tc4BaseGainLevel: 0,
    tc4BaseGainPriceStep: 0,
    tc4InfinityScoreVertexGainLevel: 0,
    tc4InfinityScoreVertexGainPriceStep: 0,
    tc4FreeCoreBoostLevel: 0,
    tc4FreeCoreBoostPriceStep: 0,
    fastestInfinityChallengeTimes: Array(8).fill(1),
    fastestTowerChallengeTimes: Array(4).fill(0),
    infiniteCapBroken: true,
    achievementMask: 0x7fffffff,
    achievementMaskHigh: 0x3ff,
    currentInfinityRunTime: 0,
    currentInfinityRealTime: 0,
    currentGenerationRunTime: 0,
    bestInfinityCountPerSecond: 0,
    infinityCountRateRemainder: 0,
    offlineProgressEnabled: false,
    offlineTickCount: 1000,
    timeFlux: 0,
    timeFluxCapacityLevel: 0,
    timeFluxGainLevel: 0,
    timeFluxSpeed: 1,
    timeFluxCustomSpeed: 4,
    automationEnabled: true,
    autoBuySpeed: true,
    autoBuyVertex: true,
    autoBuyGain: true,
    autoBuyInfiniteAngleSpeed: false,
    autoBuyInfiniteAngleVertex: false,
    autoBuyInfiniteAngleGain: false,
    autoBuildTower: false,
    autoRunGeneration: false,
    autoGenerationScoreMultiplierThreshold: 2,
    autoGenerationCostMultiplierThreshold: 1,
    autoGenerationMinimumSeconds: 0,
    autoGenerationLegacyOrMode: false,
    autoRunCoreBoost: false,
    autoRunInfinity: false,
    autoInfinityPointThreshold: 10,
    autoInfinityPointThresholdLog10: 1,
    ic8VertexDecayElapsed: 0,
    currentInfinityRunHadGeneration: false,
    currentInfinityRunHadCoreBoost: false,
  }),
});
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
  maxRunSeconds: 1000 * 365 * 24 * 60 * 60,
  maxStallSeconds: 20 * 365 * 24 * 60 * 60,
  stepSeconds: 30 * 24 * 60 * 60,
  actionIntervalSeconds: 30 * 24 * 60 * 60,
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

function jsonSafeState(state) {
  return Object.fromEntries(Object.entries(state).map(([key, value]) => [
    key,
    Array.isArray(value) ? [...value] : typeof value === "number" ? finiteOrString(value) : value,
  ]));
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

function createMilestoneTracker(runtime, options = {}) {
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
  const clock = { ic8ClearAtSeconds: options.ic8ClearAtSeconds ?? null };
  let firstObservation = true;
  const recordEvent = (event, includeState = false) => {
    if (events.length < MAX_RECORDED_EVENTS) events.push(includeState ? { ...event, state: reportState(runtime) } : event);
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
            milestoneTiming[id] = firstObservation && elapsedSeconds === 0 ? "at-start" : "post-IC8";
          } else if (id !== "ic8-clear") {
            milestoneTiming[id] = "pre-IC8";
          }
          const snapshot = reportState(runtime);
          stateSnapshots.push({ id, absoluteSeconds: elapsedSeconds, relativeSeconds: relativeFirstReachSeconds[id], snapshot });
          recordEvent({ type: "milestone", id, timeSeconds: elapsedSeconds }, true);
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
          recordEvent({ type: "progress", timeSeconds: elapsedSeconds, fields: advancedFields });
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
        recordEvent({ type: "ic8-clear", timeSeconds: elapsedSeconds, timerResetSeconds: 0 }, true);
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
      firstObservation = false;
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
  if (runtime.isChallengeCompleted(8)) return runtime.MAX_TRACKED_LOG10;
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
  const infiniteAnglePurchases = policy.buyInfiniteAngleUpgrades === false
    && !runtime.towerChallengeCompleted(4)
    ? 0
    : debug.buyAllInfiniteAngleUpgrades({ refresh: false, save: false });
  if (infiniteAnglePurchases > 0) count("infiniteAnglePurchase", infiniteAnglePurchases);
  let tc4Purchases = 0;
  if (state.activeTowerChallenge === 4) {
    for (const kind of ["baseGain", "infinityScoreVertexGain", "freeCoreBoost"]) {
      while (runtime.buyTowerChallenge4Upgrade(kind, { refresh: false, save: false })) tc4Purchases += 1;
    }
  }
  if (tc4Purchases > 0) count("tc4Purchase", tc4Purchases);
  let towerPurchases = 0;
  while (debug.buildTower({ refresh: false, save: false })) towerPurchases += 1;
  if (towerPurchases > 0) count("towerPurchase", towerPurchases);

  if (state.activeTowerChallenge > 0) {
    if (runtime.completeTowerChallengeIfReady()) {
      count("towerCompletion");
    } else {
      runGenerationOrCore(instance, policy, count);
    }
    return;
  }

  if (state.activeChallenge > 0) {
    if (runtime.canInfinity() && state.infinityCount > 0) {
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
      || runtime.isChallengeCompleted(8)
      || currentScoreLog10(runtime) >= progressionTargetLog10(runtime) - 1)) {
    const gainLog10 = runtime.log10Value(runtime.infinityPointGain());
    const targetGainLog10 = runtime.isChallengeCompleted(8)
      ? state.towerFloor < 12
        ? runtime.towerNextFloorCostLog10()
        : runtime.log10ExactInfinityPoints(runtime.MAX_EXACT_INFINITY_POINTS)
      : policy.infinityGainLog10Reserve;
    if (gainLog10 >= targetGainLog10) {
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
  const tracker = createMilestoneTracker(runtime, {
    ic8ClearAtSeconds: options.ic8ClearAtStart ? 0 : null,
  });
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

function applyRepresentativeFixture(instance) {
  configureRuntime(instance);
  Object.assign(instance.debug.state, cloneState(REPRESENTATIVE_FIXTURE.state));
  instance.runtime.syncInfinityPointCachesFromExact(BigInt(REPRESENTATIVE_FIXTURE.exactInfinityPoints));
  const { runtime, debug } = instance;
  assert.equal(debug.state.eternityCount, 1);
  assert.equal(runtime.eternityMilestoneActive("1-1"), false);
  assert.equal(runtime.eternityMilestoneActive("1-2"), true);
  assert.equal(runtime.eternityMilestoneActive("1-3"), false);
  assert.equal(runtime.isChallengeCompleted(8), true);
  assert.equal(runtime.achievementCount(), 41);
  assert.equal(debug.state.timeFlux, 0);
  assert.equal(debug.state.offlineProgressEnabled, false);
  return cloneState(debug.state);
}

async function createRepresentativeFixture() {
  const instance = await loadRuntime(CANDIDATE_PATH);
  const state = applyRepresentativeFixture(instance);
  return {
    id: REPRESENTATIVE_FIXTURE.id,
    boundary: REPRESENTATIVE_FIXTURE.boundary,
    exactInfinityPoints: REPRESENTATIVE_FIXTURE.exactInfinityPoints,
    representativeCase: "Eternity 1 / Milestone 1-2 / Achievements 1-41 / IC8 complete",
    state,
    atStart: milestonePredicates(instance.runtime),
    productionPredicates: productionPredicateReport(instance.runtime),
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
    parallelEffectiveMultiplierLog10ByMilestone: Object.fromEntries(postMilestones.map(({ id, relativeSeconds }) => [
      id,
      candidate.postSoftcapPower === null ? 0 : parallelMultiplierLog10(relativeSeconds, candidate.postSoftcapPower),
    ])),
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

async function runCase(fixture, candidate, policy, options) {
  const instance = await loadRuntime(CANDIDATE_PATH);
  configureRuntime(instance);
  Object.assign(instance.debug.state, cloneState(fixture.state));
  instance.runtime.syncInfinityPointCachesFromExact(BigInt(fixture.state.infinityPointsExact));
  assert.equal(instance.debug.state.eternityCount, 1);
  assert.equal(instance.debug.state.eternityMilestoneMask, 2);
  assert.equal(instance.debug.state.completedChallenges, 255);
  assert.equal(instance.debug.state.completedTowerChallenges, 0);
  assert.equal(instance.runtime.achievementCount(), 41);
  const effect = { clock: { nowSeconds: 0, ic8ClearAtSeconds: 0 } };
  const restore = installResearchEffect(instance.runtime, candidate, effect.clock);
  const result = runBoundedLoop(instance, policy, options.maxRunSeconds, {
    ...options,
    ic8ClearAtStart: true,
  }, effect);
  restore();
  const predicates = milestonePredicates(instance.runtime);
  const ipEndpoint = instance.runtime.currentExactInfinityPoints() >= instance.runtime.MAX_EXACT_INFINITY_POINTS;
  const tc4Completed = instance.runtime.towerChallenge4CompletedForEternity() === true;
  return {
    fixtureId: fixture.id,
    representativeMilestone: "1-2",
    candidateId: candidate.id,
    policyId: policy.id,
    selectedMask: instance.debug.state.eternityMilestoneMask,
    status: result.status,
    horizonSeconds: result.horizonSeconds,
    truncatedAtHorizon: result.truncatedAtHorizon,
    elapsedSeconds: result.elapsedSeconds,
    firstReachSeconds: result.firstReachSeconds,
    events: result.events.filter(({ type }) => type !== "progress"),
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
    ic8TimerRule: "representative fixture initialization is IC8 clear = t 0",
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
  const fixture = await createRepresentativeFixture();
  const report = {
    schemaVersion: 3,
    issue: ISSUE,
    title: "Measure the Eternity-1 Milestone 1-2 post-IC8 baseline for Timeline balance",
    researchOnly: true,
    noProductionChanges: true,
    productionRuntime: "src/main.js",
    options: {
      maxRunSeconds: options.maxRunSeconds,
      maxStallSeconds: options.maxStallSeconds,
      requestedStepSeconds: options.stepSeconds,
      actionIntervalSeconds: options.actionIntervalSeconds,
      maxActionsPerTick: options.maxActionsPerTick,
      parallelPostSoftcapPower: options.parallelPostSoftcapPower ?? null,
    },
    policies: POLICIES,
    researchEffects: candidates,
    productionPredicates: fixture.productionPredicates,
    fixture: {
      ...fixture,
      state: jsonSafeState(fixture.state),
    },
    validation: {
      step: {
        requestedSeconds: options.stepSeconds,
        effectiveSeconds: options.stepSeconds,
      },
      fixtureCloning: {
        status: "fresh-runtime-per-candidate",
        criterion: "every candidate receives a fresh clone of fixture.state",
      },
      errors: [],
    },
    cases: [],
    outcome: null,
  };
  for (const candidate of candidates) {
    report.cases.push(await runCase(fixture, candidate, POLICIES[0], options));
  }
  const baseline = report.cases.find(({ candidateId }) => candidateId === "timeline-free");
  const baselineSeconds = baseline?.researchSummary.ic8ToEternitySeconds ?? null;
  report.cases.forEach((entry) => {
    const endpoint = entry.researchSummary.ic8ToEternitySeconds;
    entry.researchSummary.shorteningVsBaselineSeconds = baselineSeconds === null || endpoint === null
      ? null
      : baselineSeconds - endpoint;
  });
  const successful = report.cases.filter(({ status }) => status === "eligible").length;
  report.outcome = successful === report.cases.length
    ? { status: "measured", reason: "all candidates reached production Eternity eligibility from the shared post-IC8 fixture" }
    : { status: "incomplete", reason: `${successful}/${report.cases.length} candidates reached production Eternity eligibility within the configured horizon` };
  return report;
}

function formatSeconds(seconds) {
  if (seconds === null || seconds === undefined) return "not reached";
  const sign = seconds < 0 ? "-" : "";
  const absoluteSeconds = Math.abs(seconds);
  if (absoluteSeconds >= 365 * 24 * 60 * 60) return `${sign}${(absoluteSeconds / (365 * 24 * 60 * 60)).toFixed(2)}y`;
  if (absoluteSeconds >= 24 * 60 * 60) return `${sign}${(absoluteSeconds / (24 * 60 * 60)).toFixed(2)}d`;
  if (absoluteSeconds >= 60 * 60) return `${sign}${(absoluteSeconds / (60 * 60)).toFixed(2)}h`;
  if (absoluteSeconds < 60) return `${sign}${absoluteSeconds.toFixed(1)}s`;
  return `${sign}${(absoluteSeconds / 60).toFixed(2)}m`;
}

function formatLog10Multiplier(log10) {
  if (!Number.isFinite(log10) || log10 <= 0) return "x1";
  return `x10^${log10.toFixed(2)}`;
}

function formatMarkdown(report) {
  const fixture = report.fixture;
  const milestoneValue = (entry, id) => entry.milestoneTiming[id] === "at-start"
    ? "at-start"
    : formatSeconds(entry.relativeFirstReachSeconds[id]);
  const lines = [
    `# Milestone 1-2 post-IC8 progression (Issue #${report.issue})`,
    "",
    "> Research evidence only. No production gameplay, Timeline, or balance formula was changed.",
    "",
    `- Outcome: **${report.outcome.status}** — ${report.outcome.reason}`,
    `- Representative case: **${fixture.representativeCase}**; fixture initialization is **IC8 clear = t 0**.`,
    `- Fixture: IP **1e100**, Infinity **${fixture.state.infinityCount}**, IA levels **${fixture.state.infiniteAngleSpeedLevel}/${fixture.state.infiniteAngleVertexLevel}/${fixture.state.infiniteAngleGainLevel}**, Tower Floor **${fixture.state.towerFloor}**, Time Flux **${fixture.state.timeFlux}**.`,
    `- Step/action interval: **${formatSeconds(report.options.requestedStepSeconds)}**; horizon **${formatSeconds(report.options.maxRunSeconds)}**, stall **${formatSeconds(report.options.maxStallSeconds)}**.`,
    `- Effects: ${report.researchEffects.map((candidate) => `**${candidate.id}**`).join(", ")}`,
    "",
    "## Results",
    "",
    "| Effect | Status | IC8 → Eternity | Longest stage | Shortening vs baseline | Parallel raw x1e10 | Parallel effective at TC4 / end | Collapse risk |",
    "| --- | --- | ---: | --- | ---: | --- | --- | --- |",
  ];
  report.cases.forEach((entry) => {
    const summary = entry.researchSummary;
    const parallelByMilestone = summary.parallelEffectiveMultiplierLog10ByMilestone;
    lines.push(`| ${entry.candidateId} | ${entry.status}${entry.truncatedAtHorizon ? " (horizon)" : ""} | ${formatSeconds(summary.ic8ToEternitySeconds)} | ${summary.longestStage ? `${summary.longestStage.from} → ${summary.longestStage.to} (${formatSeconds(summary.longestStage.durationSeconds)})` : "not reached"} | ${formatSeconds(summary.shorteningVsBaselineSeconds)} | ${entry.candidateId.startsWith("parallel-") ? formatSeconds(summary.parallelRawMultiplierCapSeconds) : "n/a"} | ${entry.candidateId.startsWith("parallel-") ? `${formatLog10Multiplier(parallelByMilestone["tc4-clear"])} / ${formatLog10Multiplier(summary.parallelEffectiveMultiplierLog10AtEndpoint)}` : "n/a"} | ${summary.collapseRisk} |`);
  });
  lines.push(
    "",
    "## Milestones from fixture t = 0",
    "",
    `| Effect | ${MILESTONE_IDS.join(" | ")} |`,
    `| --- | ${MILESTONE_IDS.map(() => "---").join(" | ")} |`,
  );
  report.cases.forEach((entry) => lines.push(
    `| ${entry.candidateId} | ${MILESTONE_IDS.map((id) => milestoneValue(entry, id)).join(" | ")} |`,
  ));
  lines.push(
    "",
    "- `at-start` means the milestone is already true in the documented fixture.",
    "- Every candidate starts in a fresh runtime cloned from the same fixture; only the research IP-gain effect differs.",
    "- Milestone 1-1 and 1-3 are intentionally not compared by this representative study.",
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
  REPRESENTATIVE_FIXTURE,
  applyRepresentativeFixture,
  cloneState,
  createMilestoneTracker,
  createReport,
  createRepresentativeFixture,
  formatMarkdown,
  installResearchEffect,
  parallelMultiplierLog10,
  progressSnapshot,
  productionPredicateReport,
  realMultiplierLog10,
  runBoundedLoop,
  runCase,
  runPolicyAction,
  writeReports,
};
