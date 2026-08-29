const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadRuntime } = require("../tests/runtime-harness-esm.js");

const ISSUE = 237;
const CANDIDATE_PATH = path.join(__dirname, "..", "src", "main.js");
const DEFAULT_REPORT_PATH = path.join(__dirname, "..", "reports", "ic8-eternity-progression.json");
const DEFAULT_MARKDOWN_PATH = path.join(__dirname, "..", "reports", "ic8-eternity-progression.md");
const MAX_RECORDED_EVENTS = 4096;
const SIM_TIME_SCALE = 1_000_000n;
const SIM_TIME_SCALE_NUMBER = Number(SIM_TIME_SCALE);
const MAX_REPORTABLE_NUMBER_SECONDS = 1e15;
const MIN_INFINITY_COUNT_BEFORE_IC3 = 100;
const TC3_INFINITY_COUNT_TARGET = 600000;
const REQUIRED_INFINITY_UPGRADE_IDS_BEFORE_IC7 = Object.freeze(["11-1", "11-2"]);
const MILESTONE_IDS = Object.freeze([
  "break-infinite-cap",
  "infinite-angle-unlock",
  "tower-floor-1",
  "tc1-unlock",
  "tc1-clear",
  "tc2-unlock",
  "tc2-clear",
  "infinity-count-600000",
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
  description: "objective-driven post-IC8 policy; compound IP by gain-aware resets and clear staged Tower Challenges",
  buyInfiniteAngleUpgrades: true,
  generationMinimumSeconds: 60,
  generationMinimumScoreMultiplierRatio: 1.05,
  generationMinimumCostFactorRatio: 1.01,
  minimumCoreBoostBenefitLog10: 0.001,
  heldInfinityResetGainMarginLog10: 0,
})]);
const REPRESENTATIVE_INFINITY_UPGRADE_IDS = Object.freeze([
  "1-1", "1-2", "2-1", "3-1", "3-2", "4-1",
  "5-1", "5-2", "6-1", "6-2", "7-1", "7-2",
  "8-1", "9-1", "10-1", "10-2", "11-1", "11-2",
]);
const REPRESENTATIVE_FIXTURE = Object.freeze({
  id: "eternity-1-milestone-1-2-post-ic8",
  boundary: "Eternity 1 / Milestone 1-2 / Achievements 1-41 / IC1-IC8 complete; post-IC8 t = 0",
  exactInfinityPoints: "100000",
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
    generationCostFactor: 1,
    coreBoostCount: 2,
    infinityCount: 10000,
    eternityCount: 1,
    eternityMilestoneMask: 2,
    eternityMilestoneChoice: "",
    infinityUpgradeMask: (1 << 18) - 1,
    infiniteScore: 0,
    infiniteScoreLog10: -Infinity,
    infiniteAngleUnlocked: false,
    infiniteAngleSpeedLevel: 0,
    infiniteAngleVertexLevel: 0,
    infiniteAngleGainLevel: 0,
    infiniteAngleCurrentGain: 1,
    infiniteAngleCurrentGainLog10: 0,
    infiniteAnglePointProgress: 0,
    infiniteAngleTotalVertexProgress: 0,
    infiniteAngleLastVertexIndex: 0,
    towerFloor: 0,
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
    fastestInfinityChallengeTimes: Array(8).fill(0),
    fastestTowerChallengeTimes: Array(4).fill(0),
    infiniteCapBroken: true,
    achievementMask: 0x7fffffff,
    achievementMaskHigh: 0x3ff,
    currentInfinityRunTime: 0,
    currentInfinityRealTime: 0,
    currentGenerationRunTime: 0,
    bestInfinityCountPerSecond: 0,
    infinityCountRateRemainder: 0,
    offlineProgressEnabled: true,
    offlineTickCount: 1000,
    timeFlux: 0,
    timeFluxCapacityLevel: 0,
    timeFluxGainLevel: 0,
    timeFluxSpeed: 1,
    timeFluxCustomSpeed: 4,
    automationEnabled: false,
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
    totalPlayTime: 0,
    totalRealPlayTime: 0,
    fastestInfinityTime: 0,
    fastestInfinityRealTime: 0,
    lastInfinityRuns: [],
    noGenerationCoreBoostReached: false,
  }),
});

function timeFromNumber(seconds) {
  if (!(seconds > 0)) return 0n;
  if (!Number.isFinite(seconds)) throw new Error("simulation time must be finite");
  const exponential = seconds.toExponential(15);
  const [coefficient, exponentText] = exponential.split("e");
  const digits = coefficient.replace(".", "");
  const decimalPlaces = coefficient.includes(".") ? coefficient.length - coefficient.indexOf(".") - 1 : 0;
  const scalePower = Number(exponentText) - decimalPlaces + 6;
  const integerDigits = BigInt(digits);
  if (scalePower >= 0) return integerDigits * (10n ** BigInt(scalePower));
  const divisor = 10n ** BigInt(-scalePower);
  return (integerDigits + divisor / 2n) / divisor;
}

function timeToNumber(time) {
  const wholeSeconds = time / SIM_TIME_SCALE;
  const fractionalMicroseconds = time % SIM_TIME_SCALE;
  return Number(wholeSeconds) + Number(fractionalMicroseconds) / SIM_TIME_SCALE_NUMBER;
}

function timeToReportValue(time) {
  if (time === null || time === undefined) return null;
  if (time <= BigInt(MAX_REPORTABLE_NUMBER_SECONDS * SIM_TIME_SCALE_NUMBER)) return timeToNumber(time);
  const digits = time.toString();
  const integerDigits = digits.length - 6;
  const significant = `${digits.slice(0, 1)}.${digits.slice(1, 16)}`.replace(/\.?0+$/, "");
  return `${significant}e+${integerDigits - 1}`;
}

function addTime(time, seconds) {
  return time + timeFromNumber(seconds);
}

function timeDifferenceToNumber(later, earlier) {
  return timeToNumber(later - earlier);
}

function timeDifferenceToReport(later, earlier) {
  return timeToReportValue(later - earlier);
}

function setResearchClock(clock, nowTime, ic8ClearTime) {
  clock.nowTime = nowTime;
  clock.ic8ClearTime = ic8ClearTime;
  clock.nowSeconds = timeToNumber(nowTime);
  clock.ic8ClearAtSeconds = ic8ClearTime === null ? null : timeToNumber(ic8ClearTime);
}

function researchElapsedSeconds(clock) {
  if (typeof clock.nowTime === "bigint") {
    if (clock.ic8ClearTime === null) return null;
    if (typeof clock.ic8ClearTime === "bigint") {
      return clock.nowTime < clock.ic8ClearTime
        ? 0
        : timeDifferenceToNumber(clock.nowTime, clock.ic8ClearTime);
    }
  }
  if (clock.ic8ClearAtSeconds === null || clock.ic8ClearAtSeconds === undefined) return null;
  return Math.max(0, clock.nowSeconds - clock.ic8ClearAtSeconds);
}
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
  maxRunSeconds: 365 * 24 * 60 * 60,
  maxStallSeconds: 14 * 24 * 60 * 60,
  stepSeconds: 1,
  maxActionsPerFixedPoint: 4096,
  actionSearchIterations: 6,
  convergenceCheck: true,
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
  const legacyActionLimit = parseNumberOption(args, "--max-actions-per-tick", DEFAULT_OPTIONS.maxActionsPerFixedPoint, 1);
  return {
    maxRunSeconds: parseNumberOption(args, "--max-run-seconds", DEFAULT_OPTIONS.maxRunSeconds),
    maxStallSeconds: parseNumberOption(args, "--max-stall-seconds", DEFAULT_OPTIONS.maxStallSeconds),
    stepSeconds: parseNumberOption(args, "--step", DEFAULT_OPTIONS.stepSeconds, Number.MIN_VALUE),
    maxActionsPerFixedPoint: parseNumberOption(args, "--max-actions-per-fixed-point", legacyActionLimit, 1),
    actionSearchIterations: parseNumberOption(args, "--action-search-iterations", DEFAULT_OPTIONS.actionSearchIterations, 0),
    parallelPostSoftcapPower: parseNumberOption(args, "--parallel-post-power", null),
    convergenceCheck: !args.includes("--no-convergence-check"),
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

function policyDiagnostics(runtime, objective = progressionObjective(runtime), elapsedSeconds = null) {
  return {
    objective: {
      kind: objective.kind,
      reason: objective.reason,
      targetLog10: objective.targetLog10 === undefined ? null : finiteOrString(objective.targetLog10),
      targetCount: objective.targetCount ?? null,
      targetFloor: objective.targetFloor ?? null,
      challenge: objective.challenge ?? null,
    },
    elapsedSeconds: elapsedSeconds === null ? null : timeToReportValue(elapsedSeconds),
    scoreLog10: finiteOrString(currentScoreLog10(runtime)),
    generationScoreLog10: finiteOrString(runtime.currentGenerationScoreLog10()),
    generationScoreMultiplierLog10: finiteOrString(runtime.generationScoreMultiplierEffectLog10()),
    generationCount: runtime.state.generationCount,
    infinityPointLog10: finiteOrString(currentIpLog10(runtime)),
    infinityPointsExact: runtime.currentExactInfinityPoints().toString(),
    infinityPointGainLog10: finiteOrString(infinityPointGainLog10(runtime)),
    infinityCount: runtime.state.infinityCount,
    coreBoostCount: runtime.state.coreBoostCount,
    coreBoostRequirementLog10: finiteOrString(runtime.coreBoostRequirementLog10?.()),
    infiniteAngleUnlocked: runtime.state.infiniteAngleUnlocked,
    infiniteAngleLevels: {
      speed: runtime.state.infiniteAngleSpeedLevel,
      vertex: runtime.state.infiniteAngleVertexLevel,
      gain: runtime.state.infiniteAngleGainLevel,
    },
    towerFloor: runtime.state.towerFloor,
    activeChallenge: runtime.state.activeChallenge,
    completedChallenges: runtime.state.completedChallenges,
    activeTowerChallenge: runtime.state.activeTowerChallenge,
    completedTowerChallenges: runtime.state.completedTowerChallenges,
    canEternity: runtime.canEternity() === true,
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
    "infinity-count-600000": state.infinityCount >= TC3_INFINITY_COUNT_TARGET,
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
  const firstReachTimes = Object.fromEntries(MILESTONE_IDS.map((id) => [id, null]));
  const relativeFirstReachTimes = Object.fromEntries(MILESTONE_IDS.map((id) => [id, null]));
  const stateSnapshots = [];
  let previousIc8 = runtime.isChallengeCompleted(8);
  let peakScoreLog10 = -Infinity;
  let lastProgressTime = 0n;
  let previousSnapshot = null;
  let bestLog10 = {
    scoreLog10: -Infinity,
    generationScoreLog10: -Infinity,
    totalScoreLog10: -Infinity,
    infinityPointLog10: -Infinity,
  };
  let lastProgressEventTime = 0n;
  let lastProgressEventScoreLog10 = -Infinity;
  const events = [];
  let droppedEvents = 0;
  let ic8ClearTime = options.ic8ClearAtSeconds === null || options.ic8ClearAtSeconds === undefined
    ? null
    : timeFromNumber(options.ic8ClearAtSeconds);
  const clock = {
    nowSeconds: 0,
    ic8ClearAtSeconds: timeToReportValue(ic8ClearTime),
  };
  let firstObservation = true;
  const snapshotWithObjective = () => ({
    ...reportState(runtime),
    objective: options.objectiveForRuntime ? options.objectiveForRuntime(runtime) : null,
  });
  const recordEvent = (event, includeState = false) => {
    if (events.length < MAX_RECORDED_EVENTS) events.push(includeState ? { ...event, state: snapshotWithObjective() } : event);
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
    firstReachTimes,
    relativeFirstReachTimes,
    get ic8ClearTime() { return ic8ClearTime; },
    get lastProgressSeconds() { return timeToReportValue(lastProgressTime); },
    get lastProgressTime() { return lastProgressTime; },
    get peakScoreLog10() { return peakScoreLog10; },
    observe(elapsedTime) {
      elapsedTime = typeof elapsedTime === "bigint" ? elapsedTime : timeFromNumber(elapsedTime);
      const predicates = milestonePredicates(runtime);
      for (const id of MILESTONE_IDS) {
        if (firstReachSeconds[id] === null && predicates[id]) {
          firstReachTimes[id] = elapsedTime;
          firstReachSeconds[id] = timeToReportValue(elapsedTime);
          if (ic8ClearTime !== null) {
            relativeFirstReachTimes[id] = elapsedTime >= ic8ClearTime ? elapsedTime - ic8ClearTime : 0n;
            relativeFirstReachSeconds[id] = timeToReportValue(relativeFirstReachTimes[id]);
            milestoneTiming[id] = firstObservation && elapsedTime === 0n ? "at-start" : "post-IC8";
          } else if (id !== "ic8-clear") {
            milestoneTiming[id] = "pre-IC8";
          }
          const snapshot = snapshotWithObjective();
          stateSnapshots.push({
            id,
            absoluteSeconds: firstReachSeconds[id],
            relativeSeconds: relativeFirstReachSeconds[id],
            snapshot,
          });
          recordEvent({ type: "milestone", id, timeSeconds: firstReachSeconds[id] }, true);
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
        lastProgressTime = elapsedTime;
        const shouldRecord = advancedFields.some((key) => !key.endsWith("Log10"))
          || timeDifferenceToNumber(elapsedTime, lastProgressEventTime) >= 60
          || snapshot.scoreLog10 - lastProgressEventScoreLog10 >= 1;
        if (shouldRecord) {
          recordEvent({ type: "progress", timeSeconds: timeToReportValue(elapsedTime), fields: advancedFields });
          lastProgressEventTime = elapsedTime;
          lastProgressEventScoreLog10 = snapshot.scoreLog10;
        }
      }
      const ic8Completed = runtime.isChallengeCompleted(8);
      if (!previousIc8 && ic8Completed) {
        ic8ClearTime = elapsedTime;
        clock.ic8ClearAtSeconds = timeToReportValue(ic8ClearTime);
        relativeFirstReachTimes["ic8-clear"] = 0n;
        relativeFirstReachSeconds["ic8-clear"] = 0;
        milestoneTiming["ic8-clear"] = "post-IC8";
        const ic8Snapshot = snapshotWithObjective();
        stateSnapshots.push({ id: "ic8-clear", absoluteSeconds: timeToReportValue(elapsedTime), relativeSeconds: 0, snapshot: ic8Snapshot });
        recordEvent({ type: "ic8-clear", timeSeconds: timeToReportValue(elapsedTime), timerResetSeconds: 0 }, true);
        lastProgressTime = elapsedTime;
        if (firstReachSeconds["ic8-clear"] === null) {
          firstReachTimes["ic8-clear"] = elapsedTime;
          firstReachSeconds["ic8-clear"] = timeToReportValue(elapsedTime);
        }
        for (const id of MILESTONE_IDS) {
          if (firstReachTimes[id] !== null && firstReachTimes[id] >= elapsedTime && id !== "ic8-clear") {
            relativeFirstReachTimes[id] = firstReachTimes[id] - elapsedTime;
            relativeFirstReachSeconds[id] = timeToReportValue(relativeFirstReachTimes[id]);
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
      const elapsed = researchElapsedSeconds(clock);
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

function addNormalUpgradeLevels(runtime, kind, amount) {
  if (kind === "vertex" && runtime.state.activeChallenge === 8) runtime.state.ic8VertexUpgradeLevel += amount;
  else if (kind === "vertex") runtime.state.vertices += amount;
  else runtime.state[`${kind}Level`] += amount;
  if (kind === "vertex") runtime.resetVertexProgress();
}

function buyNormalUpgrades(runtime) {
  let purchases = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (const kind of ["speed", "vertex", "gain"]) {
      if (!runtime.canBuyNormalUpgrade?.(kind)) continue;
      const scoreLog10 = currentScoreLog10(runtime);
      const freePurchaseLimit = scoreLog10 - 12;
      if (scoreLog10 > 18 && freePurchaseLimit > runtime.upgradeCostLog(kind)) {
        let low = 0;
        let high = 1;
        while (high < 1000000) {
          addNormalUpgradeLevels(runtime, kind, high);
          const affordable = runtime.upgradeCostLog(kind) <= freePurchaseLimit;
          addNormalUpgradeLevels(runtime, kind, -high);
          if (!affordable) break;
          low = high;
          high *= 2;
        }
        let left = low;
        let right = high;
        while (left + 1 < right) {
          const middle = Math.floor((left + right) / 2);
          addNormalUpgradeLevels(runtime, kind, middle);
          const affordable = runtime.upgradeCostLog(kind) <= freePurchaseLimit;
          addNormalUpgradeLevels(runtime, kind, -middle);
          if (affordable) left = middle;
          else right = middle;
        }
        if (left > 0) {
          addNormalUpgradeLevels(runtime, kind, left);
          purchases += left;
          changed = true;
          continue;
        }
      }
      if (runtime.spendNormalUpgrade(kind)) {
        addNormalUpgradeLevels(runtime, kind, 1);
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

function log10Add(first, second) {
  if (first === -Infinity) return second;
  if (second === -Infinity) return first;
  const maximum = Math.max(first, second);
  const difference = Math.abs(first - second);
  return maximum + Math.log10(1 + 10 ** -difference);
}

function infinityPointGainLog10(runtime) {
  return runtime.infinityPointGainLog10?.() ?? runtime.log10Value(runtime.infinityPointGain());
}

function nextUnownedInfinityUpgrade(runtime) {
  return runtime.INFINITY_UPGRADES.find((upgrade) => (
    !runtime.hasInfinityUpgrade(upgrade.id)
      && runtime.infinityUpgradePrerequisitesMet(upgrade)
  )) || null;
}

function nextTowerChallengeIndex(runtime) {
  for (let index = 1; index <= runtime.TOWER_CHALLENGE_COUNT; index += 1) {
    if (!runtime.towerChallengeCompleted(index)) return index;
  }
  return 0;
}

function towerBuildLimit(runtime) {
  const nextChallenge = nextTowerChallengeIndex(runtime);
  return nextChallenge > 0
    ? runtime.towerChallengeUnlockFloor(nextChallenge)
    : 12;
}

function towerBuildAvailable(runtime) {
  return runtime.state.activeChallenge === 0
    && runtime.state.activeTowerChallenge === 0
    && runtime.state.infiniteAngleUnlocked === true
    && runtime.state.towerFloor < towerBuildLimit(runtime)
    && runtime.canBuildTower();
}

function nextTowerChallengeCanStart(runtime) {
  const nextChallenge = nextTowerChallengeIndex(runtime);
  if (nextChallenge <= 0 || !runtime.towerChallengeUnlocked(nextChallenge)) return false;
  return nextChallenge !== 3 || runtime.state.infinityCount >= TC3_INFINITY_COUNT_TARGET;
}

function ipThresholdObjective(targetLog10, reason) {
  return {
    kind: "ip-threshold",
    targetLog10,
    reason,
  };
}

function progressionObjective(runtime) {
  if (runtime.state.activeTowerChallenge > 0) {
    const index = runtime.state.activeTowerChallenge;
    return {
      kind: "tower-challenge",
      challenge: index,
      targetLog10: runtime.towerChallengeTargetLog10(index),
      reason: `clear TC${index}`,
    };
  }
  if (runtime.state.activeChallenge > 0) {
    return ipThresholdObjective(runtime.INFINITY_REQUIREMENT_LOG10, "clear active Infinity Challenge");
  }

  const nextChallenge = nextTowerChallengeIndex(runtime);
  if (nextChallenge > 0) {
    if (!runtime.towerChallengeUnlocked(nextChallenge)) {
      const nextFloorCostLog10 = runtime.towerNextFloorCostLog10();
      const nextUpgrade = nextUnownedInfinityUpgrade(runtime);
      const upgradeCostLog10 = nextUpgrade ? runtime.log10Value(nextUpgrade.cost) : Infinity;
      const ipObjectives = [];
      if (!runtime.state.infiniteAngleUnlocked) {
        ipObjectives.push(ipThresholdObjective(
          runtime.INFINITE_ANGLE_UNLOCK_COST_LOG10,
          "unlock Infinite Angle",
        ));
      }
      if (nextUpgrade) ipObjectives.push(ipThresholdObjective(upgradeCostLog10, `buy Infinity Upgrade ${nextUpgrade.id}`));
      if (towerBuildAvailable(runtime)) {
        return {
          kind: "tower-build",
          targetFloor: runtime.towerNextFloor(),
          targetLog10: nextFloorCostLog10,
          reason: `build Tower Floor ${runtime.towerNextFloor()}`,
        };
      }
      ipObjectives.push(ipThresholdObjective(nextFloorCostLog10, `reach Tower Floor ${runtime.towerNextFloor()} cost`));
      return ipObjectives.reduce((nearest, objective) => (
        objective.targetLog10 < nearest.targetLog10 ? objective : nearest
      ));
    }
    if (nextChallenge === 3 && runtime.state.infinityCount < TC3_INFINITY_COUNT_TARGET) {
      return {
        kind: "infinity-count",
        targetCount: TC3_INFINITY_COUNT_TARGET,
        reason: "farm normal Infinity resets before TC3",
      };
    }
    return {
      kind: "tower-challenge",
      challenge: nextChallenge,
      targetLog10: runtime.towerChallengeTargetLog10(nextChallenge),
      reason: `start and clear TC${nextChallenge}`,
    };
  }

  const nextUpgrade = nextUnownedInfinityUpgrade(runtime);
  if (nextUpgrade) return ipThresholdObjective(runtime.log10Value(nextUpgrade.cost), `buy Infinity Upgrade ${nextUpgrade.id}`);
  const maximumLog10 = runtime.log10ExactInfinityPoints(runtime.MAX_EXACT_INFINITY_POINTS);
  const currentIp = currentIpLog10(runtime);
  return currentIp >= maximumLog10
    ? { kind: "eternity", targetLog10: maximumLog10, reason: "satisfy Eternity IP threshold" }
    : ipThresholdObjective(maximumLog10, "reach final Eternity IP threshold");
}

function infinityResetReady(runtime, objective, policy) {
  if (runtime.state.activeTowerChallenge > 0 || !runtime.canInfinity() || runtime.state.infinityCount <= 0) return false;
  const gainLog10 = infinityPointGainLog10(runtime);
  if (!Number.isFinite(gainLog10)) return false;
  const heldLog10 = currentIpLog10(runtime);
  const projectedLog10 = log10Add(heldLog10, gainLog10);
  const targetReached = Number.isFinite(objective.targetLog10) && projectedLog10 >= objective.targetLog10;
  const heldGainReached = gainLog10 >= heldLog10 + policy.heldInfinityResetGainMarginLog10;
  return targetReached || heldGainReached;
}

function generationRewardSnapshot(runtime) {
  const currentScoreMultiplierLog10 = runtime.generationScoreMultiplierEffectLog10();
  const currentCostFactor = runtime.generationCostFactorEffect();
  const next = runtime.nextGenerationValues();
  return {
    next,
    scoreMultiplierGainLog10: next.scoreMultiplierLog10 - currentScoreMultiplierLog10,
    costFactorRatio: currentCostFactor > 0 && next.costFactor > 0
      ? currentCostFactor / next.costFactor
      : 0,
  };
}

function generationActionAvailable(runtime, policy) {
  if (!runtime.canRunGeneration() || runtime.state.currentGenerationRunTime < policy.generationMinimumSeconds) return false;
  const reward = generationRewardSnapshot(runtime);
  return reward.scoreMultiplierGainLog10 >= runtime.log10Value(policy.generationMinimumScoreMultiplierRatio)
    || reward.costFactorRatio >= policy.generationMinimumCostFactorRatio;
}

function coreBoostBenefitLog10(runtime) {
  if (!runtime.canCoreBoost()) return -Infinity;
  const next = runtime.nextCoreBoostValues();
  const multiplierGain = runtime.log10Value(next.gainMultiplier)
    - runtime.log10Value(runtime.coreBoostGainIncreaseMultiplier());
  const exponentGain = next.gainExponent - runtime.coreBoostGainExponent();
  return Math.max(multiplierGain, exponentGain);
}

function coreBoostActionAvailable(runtime, policy, objective = progressionObjective(runtime)) {
  if (!runtime.canCoreBoost() || objective.kind === "eternity") return false;
  return coreBoostBenefitLog10(runtime) >= policy.minimumCoreBoostBenefitLog10
    && !infinityResetReady(runtime, objective, policy);
}

function runGenerationOrCore(instance, policy, count) {
  const { runtime, debug } = instance;
  const objective = progressionObjective(runtime);
  if (runtime.state.activeChallenge > 0 && runtime.canInfinity()) return false;
  if (runtime.state.activeTowerChallenge === 0 && runtime.state.activeChallenge === 0
    && infinityResetReady(runtime, objective, policy)) return false;
  if (generationActionAvailable(runtime, policy)) {
    debug.runGeneration();
    count("generationReset");
    return true;
  }
  if (coreBoostActionAvailable(runtime, policy, objective)) {
    debug.runCoreBoost();
    count("coreBoost");
    return true;
  }
  return false;
}

function generationOrCoreAvailable(runtime, policy) {
  const objective = progressionObjective(runtime);
  if (runtime.state.activeChallenge > 0 && runtime.canInfinity()) return false;
  if (runtime.state.activeTowerChallenge === 0 && runtime.state.activeChallenge === 0
    && infinityResetReady(runtime, objective, policy)) return false;
  return generationActionAvailable(runtime, policy) || coreBoostActionAvailable(runtime, policy, objective);
}

function hasPolicyAction(instance, policy, includeNormalPurchases = true) {
  const { runtime } = instance;
  const state = runtime.state;
  if (includeNormalPurchases && ["speed", "vertex", "gain"].some((kind) => runtime.canBuyNormalUpgrade?.(kind))) return true;
  if (!state.infiniteCapBroken && runtime.canBreakInfiniteCap()) return true;
  if (hasAffordableInfinityUpgrade(runtime)) return true;
  if (!state.infiniteAngleUnlocked && currentIpLog10(runtime) >= runtime.INFINITE_ANGLE_UNLOCK_COST_LOG10) return true;
  if (policy.buyInfiniteAngleUpgrades === true
    && ["speed", "vertex", "gain"].some((kind) => runtime.canBuyInfiniteAngleUpgrade?.(kind))) return true;
  if (state.activeTowerChallenge === 4
    && ["baseGain", "infinityScoreVertexGain", "freeCoreBoost"].some((kind) => runtime.canBuyTowerChallenge4Upgrade(kind))) return true;
  if (towerBuildAvailable(runtime)) return true;
  if (state.activeTowerChallenge > 0) {
    return runtime.towerChallengeCanComplete() || generationOrCoreAvailable(runtime, policy);
  }
  if (state.activeChallenge > 0) {
    return (runtime.canInfinity() && state.infinityCount > 0) || generationOrCoreAvailable(runtime, policy);
  }
  if (runtime.infinityChallengesUnlocked?.()
    && runtime.completedChallengeCount() < runtime.INFINITY_CHALLENGE_COUNT) {
    const nextChallenge = runtime.nextChallengeIndex();
    const challengeNeedsBrokenCap = nextChallenge >= 7 && !state.infiniteCapBroken;
    const challengeNeedsInfinityReserve = nextChallenge >= 3 && state.infinityCount < MIN_INFINITY_COUNT_BEFORE_IC3;
    const challengeNeedsPostCapUpgrades = nextChallenge === 7
      && state.infiniteCapBroken
      && hasUnownedInfinityUpgradeIds(runtime, REQUIRED_INFINITY_UPGRADE_IDS_BEFORE_IC7);
      if (nextChallenge <= runtime.INFINITY_CHALLENGE_COUNT
        && !challengeNeedsBrokenCap
        && !challengeNeedsInfinityReserve
        && !challengeNeedsPostCapUpgrades) return true;
  }
  if (nextTowerChallengeCanStart(runtime)) return true;
  if (generationOrCoreAvailable(runtime, policy)) return true;
  const holdingForCap = !state.infiniteCapBroken
    && runtime.completedChallengeCount() >= 6
    && !hasUnownedInfinityUpgrade(runtime)
    && currentScoreLog10(runtime) >= runtime.INFINITY_REQUIREMENT_LOG10;
  return !holdingForCap && infinityResetReady(runtime, progressionObjective(runtime), policy);
}

function runPolicyAction(instance, policy, actionCounts) {
  const { runtime, debug } = instance;
  const state = runtime.state;
  const count = (name, amount = 1) => { actionCounts[name] = (actionCounts[name] || 0) + amount; };
  let actionTaken = false;

  if (!state.infiniteCapBroken && runtime.canBreakInfiniteCap()) {
    debug.breakInfiniteCap();
    if (state.infiniteCapBroken) {
      count("breakInfiniteCap");
      actionTaken = true;
    }
  }
  // Numeric safety ceiling only; MAX_TRACKED_LOG10 is never a progression objective.
  const normalPurchases = currentScoreLog10(runtime) < runtime.MAX_TRACKED_LOG10
    ? buyNormalUpgrades(runtime)
    : 0;
  if (normalPurchases > 0) {
    count("normalPurchase", normalPurchases);
    actionTaken = true;
  }
  const infinityPurchases = buyInfinityUpgrades(runtime, debug);
  if (infinityPurchases > 0) {
    count("infinityPurchase", infinityPurchases);
    actionTaken = true;
  }

  if (!state.infiniteAngleUnlocked && currentIpLog10(runtime) >= runtime.INFINITE_ANGLE_UNLOCK_COST_LOG10) {
    if (debug.unlockInfiniteAngle()) {
      count("infiniteAngleUnlock");
      actionTaken = true;
    }
  }
  const infiniteAnglePurchases = policy.buyInfiniteAngleUpgrades === true
    ? debug.buyAllInfiniteAngleUpgrades({ refresh: false, save: false })
    : 0;
  if (infiniteAnglePurchases > 0) {
    count("infiniteAnglePurchase", infiniteAnglePurchases);
    actionTaken = true;
  }
  let tc4Purchases = 0;
  if (state.activeTowerChallenge === 4) {
    for (const kind of ["baseGain", "infinityScoreVertexGain", "freeCoreBoost"]) {
      while (runtime.buyTowerChallenge4Upgrade(kind, { refresh: false, save: false })) tc4Purchases += 1;
    }
  }
  if (tc4Purchases > 0) {
    count("tc4Purchase", tc4Purchases);
    actionTaken = true;
  }
  let towerPurchases = 0;
  const towerLimit = towerBuildLimit(runtime);
  while (state.infiniteAngleUnlocked === true
    && state.activeChallenge === 0
    && state.activeTowerChallenge === 0
    && state.towerFloor < towerLimit
    && debug.buildTower({ refresh: false, save: false })) towerPurchases += 1;
  if (towerPurchases > 0) {
    count("towerPurchase", towerPurchases);
    actionTaken = true;
  }

  if (state.activeTowerChallenge > 0) {
    if (runtime.completeTowerChallengeIfReady()) {
      count("towerCompletion");
      actionTaken = true;
    } else {
      actionTaken = runGenerationOrCore(instance, policy, count) || actionTaken;
    }
    return actionTaken;
  }

  if (state.activeChallenge > 0) {
    if (runtime.canInfinity() && state.infinityCount > 0) {
      debug.runInfinity(false);
      count("infinityReset");
      actionTaken = true;
    } else {
      actionTaken = runGenerationOrCore(instance, policy, count) || actionTaken;
    }
    return actionTaken;
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
        return true;
      }
    }
  }

  if (nextTowerChallengeCanStart(runtime)) {
    const nextChallenge = nextTowerChallengeIndex(runtime);
    if (debug.toggleTowerChallenge(nextChallenge)) {
      count("towerChallengeStart");
      return true;
    }
  }

  const generationOrCoreAction = runGenerationOrCore(instance, policy, count);
  if (generationOrCoreAction) return true;

  const holdingForCap = !state.infiniteCapBroken
    && runtime.completedChallengeCount() >= 6
    && !hasUnownedInfinityUpgrade(runtime)
    && currentScoreLog10(runtime) >= runtime.INFINITY_REQUIREMENT_LOG10;
  if (!holdingForCap && infinityResetReady(runtime, progressionObjective(runtime), policy)) {
    debug.runInfinity(false);
    count("infinityReset");
    return true;
  }

  return actionTaken;
}

function exhaustImmediateActions(instance, policy, elapsedSeconds, options, tracker, effect, actionCounts) {
  const maxActions = options.maxActionsPerFixedPoint
    ?? options.maxActionsPerTick
    ?? DEFAULT_OPTIONS.maxActionsPerFixedPoint;
  let actions = 0;
  const sync = () => {
    tracker.clock.nowSeconds = timeToNumber(elapsedSeconds);
    tracker.observe(elapsedSeconds);
    if (effect) setResearchClock(effect.clock, elapsedSeconds, tracker.ic8ClearTime);
  };
  while (actions < maxActions && runPolicyAction(instance, policy, actionCounts)) {
    actions += 1;
    sync();
  }
  return { actions, reachedFixedPoint: actions < maxActions };
}

function restoreRuntimeState(runtime, snapshot) {
  Object.assign(runtime.state, cloneState(snapshot));
  runtime.syncInfinityPointCachesFromExact(BigInt(snapshot.infinityPointsExact));
  runtime.normalizeTowerChallenge4State?.();
}

function findNextUsefulActionSeconds(instance, policy, elapsedSeconds, remainingSeconds, options, tracker, effect) {
  const { runtime, debug } = instance;
  const snapshot = cloneState(runtime.state);
  const initialObjective = progressionObjective(runtime);
  const initialEventSearch = elapsedSeconds === 0n;
  let cachedSeconds = null;
  let cachedState = null;
  const actionAt = (seconds) => {
    if (effect) setResearchClock(effect.clock, addTime(elapsedSeconds, seconds), tracker.ic8ClearTime);
    if (cachedSeconds !== null && seconds >= cachedSeconds) {
      restoreRuntimeState(runtime, cachedState);
      debug.update(seconds - cachedSeconds);
    } else {
      restoreRuntimeState(runtime, snapshot);
      debug.update(seconds);
    }
    const objectiveAfter = progressionObjective(runtime);
    const objectiveChanged = ["kind", "reason", "targetLog10", "targetCount", "targetFloor", "challenge"]
      .some((key) => initialObjective[key] !== objectiveAfter[key]);
    const useful = objectiveChanged || hasPolicyAction(instance, policy, false);
    if (cachedSeconds === null || seconds >= cachedSeconds) {
      cachedSeconds = seconds;
      cachedState = cloneState(runtime.state);
    }
    return useful;
  };
  let low = 0;
  let high = Math.min(remainingSeconds, Math.max(options.stepSeconds, 1));
  let highIsUseful = actionAt(high);
  while (high < remainingSeconds && !highIsUseful) {
    low = high;
    high = Math.min(remainingSeconds, high * 16);
    highIsUseful = actionAt(high);
  }
  if (!highIsUseful) {
    restoreRuntimeState(runtime, snapshot);
    return remainingSeconds;
  }
  const searchIterations = initialEventSearch
    ? 12
    : high >= 1e6 ? options.actionSearchIterations : 0;
  for (let iteration = 0; iteration < searchIterations; iteration += 1) {
    const middle = low + (high - low) / 2;
    if (middle === low || middle === high) break;
    if (actionAt(middle)) high = middle;
    else low = middle;
  }
  restoreRuntimeState(runtime, snapshot);
  if (effect) setResearchClock(effect.clock, elapsedSeconds, tracker.ic8ClearTime);
  return high;
}

function runBoundedLoop(instance, policy, maxSeconds, options, effect = null) {
  const { runtime, debug } = instance;
  const tracker = createMilestoneTracker(runtime, {
    ic8ClearAtSeconds: options.ic8ClearAtStart ? 0 : null,
    objectiveForRuntime: progressionObjective,
  });
  const actionCounts = {};
  let elapsedTime = 0n;
  const horizonTime = timeFromNumber(maxSeconds);
  let status = "horizon";
  let timeAdvances = 0;
  let immediateActions = 0;
  let fixedPointLimitReached = false;
  const effectiveStepSeconds = options.stepSeconds;
  const observe = () => {
    tracker.clock.nowSeconds = timeToNumber(elapsedTime);
    tracker.observe(elapsedTime);
    if (effect) setResearchClock(effect.clock, elapsedTime, tracker.ic8ClearTime);
  };

  observe();
  const initialActions = exhaustImmediateActions(
    instance,
    policy,
    elapsedTime,
    options,
    tracker,
    effect,
    actionCounts,
  );
  immediateActions += initialActions.actions;
  fixedPointLimitReached = !initialActions.reachedFixedPoint;
  while (!fixedPointLimitReached && elapsedTime < horizonTime) {
    if (runtime.canEternity()) {
      status = "eligible";
      break;
    }
    if (timeDifferenceToNumber(elapsedTime, tracker.lastProgressTime) >= options.maxStallSeconds) {
      status = "stall-no-new-progress";
      break;
    }

    const nextActionSeconds = findNextUsefulActionSeconds(
      instance,
      policy,
      elapsedTime,
      timeDifferenceToNumber(horizonTime, elapsedTime),
      options,
      tracker,
      effect,
    );
    const step = Math.min(
      timeDifferenceToNumber(horizonTime, elapsedTime),
      nextActionSeconds,
    );
    if (!(step > 0)) {
      status = "numeric-time-limit";
      break;
    }
    if (effect) setResearchClock(effect.clock, addTime(elapsedTime, step), tracker.ic8ClearTime);
    debug.update(step);
    elapsedTime = addTime(elapsedTime, step);
    timeAdvances += 1;
    observe();

    const actions = exhaustImmediateActions(
      instance,
      policy,
      elapsedTime,
      options,
      tracker,
      effect,
      actionCounts,
    );
    immediateActions += actions.actions;
    fixedPointLimitReached = !actions.reachedFixedPoint;
  }
  if (fixedPointLimitReached) status = "action-fixed-point-limit";
  else if (status === "horizon" && elapsedTime < horizonTime) status = "stall-no-new-progress";
  else if (status === "horizon" && elapsedTime >= horizonTime && !runtime.canEternity()) status = "policy-stall";
  const diagnostics = policyDiagnostics(runtime, progressionObjective(runtime), elapsedTime);
  diagnostics.horizonSeconds = maxSeconds;
  diagnostics.status = status;
  const result = {
    status,
    horizonSeconds: maxSeconds,
    truncatedAtHorizon: status === "horizon" || status === "policy-stall",
    elapsedSeconds: timeToReportValue(elapsedTime),
    effectiveStepSeconds,
    actionStrategy: "immediate-fixed-point-before-and-after-each-production-step",
    timeAdvances,
    immediateActions,
    fixedPointLimitReached,
    firstReachSeconds: tracker.firstReachSeconds,
    relativeFirstReachSeconds: tracker.relativeFirstReachSeconds,
    milestoneTiming: tracker.milestoneTiming,
    stateSnapshots: tracker.stateSnapshots,
    events: tracker.events,
    droppedEvents: tracker.droppedEvents,
    actionCounts,
    state: cloneState(runtime.state),
    lastState: reportState(runtime),
    objective: diagnostics.objective,
    diagnostics,
    peakScoreLog10: finiteOrString(tracker.peakScoreLog10),
    ic8ClearAtSeconds: tracker.clock.ic8ClearAtSeconds,
    productionPredicates: productionPredicateReport(runtime),
  };
  Object.defineProperties(result, {
    elapsedTime: { value: elapsedTime },
    horizonTime: { value: horizonTime },
    firstReachTimes: { value: tracker.firstReachTimes },
    relativeFirstReachTimes: { value: tracker.relativeFirstReachTimes },
  });
  return result;
}

function applyRepresentativeFixture(instance) {
  configureRuntime(instance);
  Object.assign(instance.debug.state, cloneState(REPRESENTATIVE_FIXTURE.state));
  const { runtime, debug } = instance;
  runtime.resetBelowInfinity();
  runtime.syncInfinityPointCachesFromExact(BigInt(REPRESENTATIVE_FIXTURE.exactInfinityPoints));
  runtime.normalizeTowerChallenge4State?.();
  const expectedUpgradeMask = REPRESENTATIVE_INFINITY_UPGRADE_IDS.reduce((mask, id) => {
    const upgrade = runtime.infinityUpgradeById(id);
    assert.ok(upgrade, `representative fixture upgrade ${id} exists`);
    return mask | (1 << upgrade.bit);
  }, 0);
  assert.equal(debug.state.infinityUpgradeMask, expectedUpgradeMask);
  assert.deepEqual(
    [...runtime.INFINITY_UPGRADES.filter(({ id }) => runtime.hasInfinityUpgrade(id)).map(({ id }) => id)],
    REPRESENTATIVE_INFINITY_UPGRADE_IDS,
  );
  assert.equal(debug.state.eternityCount, 1);
  assert.equal(runtime.eternityMilestoneActive("1-1"), false);
  assert.equal(runtime.eternityMilestoneActive("1-2"), true);
  assert.equal(runtime.eternityMilestoneActive("1-3"), false);
  assert.equal(runtime.isChallengeCompleted(8), true);
  assert.equal(runtime.achievementCount(), 41);
  assert.equal(currentIpLog10(runtime), 5);
  assert.equal(debug.state.scoreLog10, 2);
  assert.equal(debug.state.generationCount, 0);
  assert.equal(debug.state.generationCostFactor, 1);
  assert.equal(debug.state.coreBoostCount, 2);
  assert.equal(debug.state.towerFloor, 0);
  assert.equal(debug.state.activeChallenge, 0);
  assert.equal(debug.state.activeTowerChallenge, 0);
  assert.equal(debug.state.completedTowerChallenges, 0);
  assert.equal(debug.state.infiniteAngleUnlocked, false);
  assert.equal(debug.state.timeFlux, 0);
  assert.equal(debug.state.currentInfinityRunTime, 0);
  assert.equal(debug.state.currentInfinityRealTime, 0);
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
    resetSemantics: "fresh runtime state with the listed IU mask, then production resetBelowInfinity()",
    ownedInfinityUpgradeIds: [...REPRESENTATIVE_INFINITY_UPGRADE_IDS],
    notOwnedInfinityUpgradeIds: ["12-1", "13-1", "14-1"],
    state,
    atStart: milestonePredicates(instance.runtime),
    productionPredicates: productionPredicateReport(instance.runtime),
  };
}

function runSummary(
  firstReachSeconds,
  relativeFirstReachSeconds,
  milestoneTiming,
  candidate,
  finalState,
  status,
  timeData = {},
) {
  const relativeTimes = timeData.relativeFirstReachTimes || Object.fromEntries(
    MILESTONE_IDS.map((id) => [
      id,
      relativeFirstReachSeconds[id] === null ? null : timeFromNumber(Number(relativeFirstReachSeconds[id])),
    ]),
  );
  const milestoneOrder = new Map(MILESTONE_IDS.map((id, index) => [id, index]));
  const postMilestones = MILESTONE_IDS
    .filter((id) => id !== "ic8-clear"
      && relativeTimes[id] !== null
      && milestoneTiming[id] !== "at-start")
    .map((id) => ({ id, relativeTime: relativeTimes[id] }));
  if (relativeTimes["ic8-clear"] !== null) postMilestones.push({ id: "ic8-clear", relativeTime: 0n });
  postMilestones.sort((a, b) => (
    a.relativeTime < b.relativeTime ? -1
      : a.relativeTime > b.relativeTime ? 1
        : milestoneOrder.get(a.id) - milestoneOrder.get(b.id)
  ));
  const stages = postMilestones.slice(1).map((milestone, index) => {
    const previous = postMilestones[index];
    const durationTime = milestone.relativeTime - previous.relativeTime;
    return {
      from: previous.id,
      to: milestone.id,
      durationSeconds: timeDifferenceToReport(milestone.relativeTime, previous.relativeTime),
      durationTime,
    };
  });
  const longestStage = stages.reduce((longest, stage) => (
    !longest || stage.durationTime > longest.durationTime ? stage : longest
  ), null);
  const endpointTime = relativeTimes["eternity-eligibility"];
  const endpointSeconds = endpointTime === null ? null : timeToNumber(endpointTime);
  const rawMultiplierCapSeconds = 10 / Math.log10(3);
  const parallelEffectiveMultiplierLog10 = candidate.postSoftcapPower === null || endpointSeconds === null
    ? 0
    : parallelMultiplierLog10(endpointSeconds, candidate.postSoftcapPower);
  const finalIpLog10 = Number(finalState.infinityPointLog10);
  const realAtEndpointLog10 = realMultiplierLog10(finalIpLog10);
  const summary = {
    ic8ToEternitySeconds: endpointTime === null ? null : timeToReportValue(endpointTime),
    postIc8Milestones: [],
    stages: stages.map(({ durationTime, ...stage }) => stage),
    longestStage: longestStage ? (({ durationTime, ...stage }) => stage)(longestStage) : null,
    realMultiplierLog10AtEndpoint: realAtEndpointLog10,
    parallelRawMultiplierCapSeconds: rawMultiplierCapSeconds,
    parallelRawX1e10Reached: endpointSeconds !== null && endpointSeconds >= rawMultiplierCapSeconds,
    parallelEffectiveMultiplierLog10AtEndpoint: parallelEffectiveMultiplierLog10,
    parallelEffectiveMultiplierLog10ByMilestone: Object.fromEntries(postMilestones.map(({ id }) => [
      id,
      candidate.postSoftcapPower === null ? 0 : parallelMultiplierLog10(timeToNumber(relativeTimes[id]), candidate.postSoftcapPower),
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
  summary.postIc8Milestones = postMilestones.map(({ id, relativeTime }) => ({
    id,
    relativeSeconds: timeToReportValue(relativeTime),
  }));
  Object.defineProperties(summary, {
    endpointTime: { value: endpointTime },
    relativeTimes: { value: relativeTimes },
  });
  return summary;
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
  const effect = { clock: { nowSeconds: 0, ic8ClearAtSeconds: 0, nowTime: 0n, ic8ClearTime: 0n } };
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
    objective: result.objective,
    diagnostics: result.diagnostics,
    droppedEvents: result.droppedEvents,
    predicates,
    researchSummary: runSummary(
      result.firstReachSeconds,
      result.relativeFirstReachSeconds,
      result.milestoneTiming,
      candidate,
      result.lastState,
      result.status,
      { relativeFirstReachTimes: result.relativeFirstReachTimes },
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
    tc3InfinityCountTarget: TC3_INFINITY_COUNT_TARGET,
    eternityRule: "currentExactInfinityPoints() >= MAX_EXACT_INFINITY_POINTS && towerChallenge4CompletedForEternity() === true",
    ic8TimerRule: "representative fixture initialization is IC8 clear = t 0",
    errorHandling: "exact IP stays BigInt in the production runtime; research multipliers are clamped to the production exact-IP ceiling before normal addInfinityPoints()",
  };
}

function relativeTimeDifference(first, second) {
  if (first === null || second === null) return null;
  const firstSeconds = timeToNumber(first);
  const secondSeconds = timeToNumber(second);
  const denominator = Math.max(Math.abs(firstSeconds), Math.abs(secondSeconds));
  if (denominator === 0) return 0;
  return Math.abs(firstSeconds - secondSeconds) / denominator;
}

async function runConvergenceCheck(fixture, candidate, policy, options, coarseTimes) {
  const fineStepSeconds = options.stepSeconds / 2;
  const fine = await runCase(fixture, candidate, policy, {
    ...options,
    stepSeconds: fineStepSeconds,
    convergenceCheck: false,
  });
  const fineTimes = fine.researchSummary.relativeTimes;
  const comparedMilestones = MILESTONE_IDS.filter((id) => (
    coarseTimes?.[id] !== null && coarseTimes?.[id] !== undefined
      && fineTimes?.[id] !== null && fineTimes?.[id] !== undefined
  ));
  const differences = comparedMilestones.map((id) => relativeTimeDifference(coarseTimes[id], fineTimes[id]));
  const maxRelativeDifference = differences.length > 0 ? Math.max(...differences) : 0;
  const coarseEligible = coarseTimes?.["eternity-eligibility"] !== null
    && coarseTimes?.["eternity-eligibility"] !== undefined;
  const status = (!coarseEligible || fine.status === "eligible") && maxRelativeDifference <= 0.05
    ? "passed"
    : "failed";
  return {
    status,
    candidateId: candidate.id,
    coarseStepSeconds: options.stepSeconds,
    fineStepSeconds,
    actionSearchIterations: options.actionSearchIterations,
    comparedMilestones,
    maxRelativeDifference,
    tolerance: 0.05,
    fineStatus: fine.status,
  };
}

const ROUTE_ORDER = Object.freeze([
  "ic8-clear",
  "infinite-angle-unlock",
  "tower-floor-1",
  "tc1-unlock",
  "tc1-clear",
  "tc2-unlock",
  "tc2-clear",
  "infinity-count-600000",
  "tc3-unlock",
  "tc3-clear",
  "tc4-unlock",
  "tc4-clear",
  "ip-1.80e308",
  "eternity-eligibility",
]);
const IP_STAGE_MILESTONES = Object.freeze([
  "infinite-angle-unlock",
  "tower-floor-1",
  "tc1-unlock",
  "tc2-unlock",
  "tc3-unlock",
  "tc4-unlock",
  "ip-1.80e308",
]);

function milestoneTime(entry, id) {
  return entry.researchSummary?.relativeTimes?.[id] ?? null;
}

function compareMilestoneTimes(first, second, ids, comparator) {
  const compared = [];
  const failures = [];
  for (const id of ids) {
    const firstTime = milestoneTime(first, id);
    const secondTime = milestoneTime(second, id);
    if (firstTime === null || secondTime === null) continue;
    compared.push(id);
    if (!comparator(timeToNumber(firstTime), timeToNumber(secondTime))) failures.push(id);
  }
  return { compared, failures };
}

function validateSanity(cases, horizonSeconds) {
  const errors = [];
  const route = cases.map((entry) => {
    const reached = ROUTE_ORDER.filter((id) => milestoneTime(entry, id) !== null);
    let ordered = true;
    for (let index = 1; index < reached.length; index += 1) {
      if (milestoneTime(entry, reached[index]) < milestoneTime(entry, reached[index - 1])) ordered = false;
    }
    if (!ordered) errors.push(`${entry.candidateId}: route milestones are out of order`);
    const absurd = reached.filter((id) => timeToNumber(milestoneTime(entry, id)) > horizonSeconds);
    const horizonBoundary = reached.filter((id) => (
      id !== "ic8-clear"
      && timeToNumber(milestoneTime(entry, id)) >= horizonSeconds * 0.99
    ));
    if (absurd.length > 0) errors.push(`${entry.candidateId}: major milestone exceeds configured horizon (${absurd.join(", ")})`);
    if (horizonBoundary.length > 0) errors.push(`${entry.candidateId}: major milestone is horizon-bound (${horizonBoundary.join(", ")})`);
    return {
      candidateId: entry.candidateId,
      reached,
      ordered,
      absurdMajorMilestones: absurd,
      horizonBoundaryMajorMilestones: horizonBoundary,
    };
  });

  const baseline = cases.find(({ candidateId }) => candidateId === "timeline-free");
  const real = cases.find(({ candidateId }) => candidateId === "real-bc16500");
  const root = cases.find(({ candidateId }) => candidateId === "parallel-bc16500-root");
  const fourthRoot = cases.find(({ candidateId }) => candidateId === "parallel-bc16500-fourth-root");
  const realComparison = baseline && real
    ? compareMilestoneTimes(real, baseline, IP_STAGE_MILESTONES, (candidate, base) => candidate <= base * 1.01)
    : { compared: [], failures: [] };
  const rootComparison = root && fourthRoot
    ? compareMilestoneTimes(root, fourthRoot, ROUTE_ORDER.filter((id) => id !== "ic8-clear"), (candidate, fourth) => candidate <= fourth * 1.01)
    : { compared: [], failures: [] };
  const parallelPositiveOnly = cases
    .filter(({ candidateId }) => candidateId.startsWith("parallel-"))
    .map((entry) => ({
      candidateId: entry.candidateId,
      ...compareMilestoneTimes(entry, baseline, IP_STAGE_MILESTONES, (candidate, base) => candidate <= base * 1.01),
    }));
  if (realComparison.failures.length > 0) errors.push(`Real-BC16500 is slower in IP stages: ${realComparison.failures.join(", ")}`);
  if (rootComparison.failures.length > 0) errors.push(`Parallel root is slower than fourth root: ${rootComparison.failures.join(", ")}`);
  parallelPositiveOnly.forEach((comparison) => {
    if (comparison.failures.length > 0) errors.push(`${comparison.candidateId} is slower in positive-only IP stages: ${comparison.failures.join(", ")}`);
  });
  const compared = realComparison.compared.length + rootComparison.compared.length
    + parallelPositiveOnly.reduce((sum, comparison) => sum + comparison.compared.length, 0);
  return {
    status: errors.length > 0 ? "failed" : compared > 0 ? "passed" : "not-applicable",
    errors,
    route,
    realIpStages: realComparison,
    parallelRootVsFourthRoot: rootComparison,
    parallelPositiveOnlyIpStages: parallelPositiveOnly,
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
  if (options.stepSeconds <= 0) throw new Error("step must be positive");
  const fixture = await createRepresentativeFixture();
  const report = {
    schemaVersion: 5,
    issue: ISSUE,
    title: "Measure the Eternity-1 Milestone 1-2 post-IC8 baseline with an objective-driven policy",
    researchOnly: true,
    noProductionChanges: true,
    productionRuntime: "src/main.js",
    options: {
      maxRunSeconds: options.maxRunSeconds,
      maxStallSeconds: options.maxStallSeconds,
      requestedStepSeconds: options.stepSeconds,
      actionStrategy: "immediate fixed point before and after every production step",
      maxActionsPerFixedPoint: options.maxActionsPerFixedPoint,
      actionSearchIterations: options.actionSearchIterations,
      convergenceCheck: options.convergenceCheck !== false,
      parallelPostSoftcapPower: options.parallelPostSoftcapPower ?? null,
      objectivePolicy: "ip-threshold → tower-build → tower-challenge → infinity-count → eternity",
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
      cadence: {
        actionStrategy: "immediate-fixed-point",
        timeAdvanceOnlyWhenFixedPoint: true,
        canonicalStepNotCalendarScale: options.stepSeconds < 24 * 60 * 60,
        maxActionsPerFixedPoint: options.maxActionsPerFixedPoint,
        actionSearchIterations: options.actionSearchIterations,
      },
      fixtureCloning: {
        status: "fresh-runtime-per-candidate",
        criterion: "every candidate receives a fresh clone of fixture.state",
      },
      objectivePolicy: {
        status: "implemented",
        noMaxTrackedScoreObjective: true,
        tc3InfinityCountTarget: TC3_INFINITY_COUNT_TARGET,
        actionOrder: "normal/IU/IA/TC4 purchases → bounded Tower build → active challenge completion → challenge starts → reward-aware GR → benefit-aware Core Boost → gain-aware Infinity reset",
        resetRule: "reach the next IP objective or gain at least the currently held IP; no IP target uses the same gain-aware tie-break",
        generationRule: "nextGenerationValues() with a meaningful score-multiplier or cost-factor improvement",
        coreBoostRule: "nextCoreBoostValues() benefit while the current objective still needs production",
        failureRule: "unfinished human-scale runs return policy-stall diagnostics",
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
  const baselineTime = baseline?.researchSummary.endpointTime ?? null;
  report.cases.forEach((entry) => {
    const endpointTime = entry.researchSummary.endpointTime ?? null;
    entry.researchSummary.shorteningVsBaselineSeconds = baselineTime === null || endpointTime === null
      ? null
      : timeDifferenceToReport(baselineTime, endpointTime);
  });
  if (options.convergenceCheck !== false) {
    const baselineCandidate = candidates.find(({ id }) => id === "timeline-free");
    const baselineTimes = baseline?.researchSummary.relativeTimes ?? null;
    report.validation.convergence = await runConvergenceCheck(
      fixture,
      baselineCandidate,
      POLICIES[0],
      options,
      baselineTimes,
    );
    if (report.validation.convergence.status !== "passed") {
      report.validation.errors.push("fine-step convergence check failed");
    }
  } else {
    report.validation.convergence = { status: "skipped", reason: "explicitly disabled for exploratory run" };
  }
  const successful = report.cases.filter(({ status }) => status === "eligible").length;
  const realCase = report.cases.find(({ candidateId }) => candidateId === "real-bc16500");
  const realEndpointTime = realCase?.researchSummary.endpointTime ?? null;
  const realSlower = baselineTime !== null && realEndpointTime !== null
    && timeToNumber(realEndpointTime) > timeToNumber(baselineTime) * 1.01;
  report.validation.realSlowdown = {
    status: realSlower ? "failed" : "passed",
    materiallySlower: realSlower,
    tolerance: 0.01,
  };
  report.validation.sanity = validateSanity(report.cases, options.maxRunSeconds);
  report.validation.errors.push(...report.validation.sanity.errors);
  report.outcome = report.validation.errors.length > 0 || realSlower
    ? { status: "invalid", reason: report.validation.errors.join("; ") || "Real-BC16500 finished materially slower than Timeline-free" }
    : successful === report.cases.length
    ? { status: "measured", reason: "all candidates reached production Eternity eligibility from the shared post-IC8 fixture" }
    : { status: "incomplete", reason: `${successful}/${report.cases.length} candidates reached production Eternity eligibility within the configured horizon` };
  return report;
}

function formatSeconds(seconds) {
  if (seconds === null || seconds === undefined) return "not reached";
  const numericSeconds = typeof seconds === "number" ? seconds : Number(seconds);
  if (!Number.isFinite(numericSeconds)) return "not reached";
  const sign = numericSeconds < 0 ? "-" : "";
  const absoluteSeconds = Math.abs(numericSeconds);
  const scaled = (value, unit, suffix) => value / unit >= 1e21
    ? `${(value / unit).toExponential(2)}${suffix}`
    : `${(value / unit).toFixed(2)}${suffix}`;
  if (absoluteSeconds >= 365 * 24 * 60 * 60) return `${sign}${scaled(absoluteSeconds, 365 * 24 * 60 * 60, "y")}`;
  if (absoluteSeconds >= 24 * 60 * 60) return `${sign}${scaled(absoluteSeconds, 24 * 60 * 60, "d")}`;
  if (absoluteSeconds >= 60 * 60) return `${sign}${scaled(absoluteSeconds, 60 * 60, "h")}`;
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
    `- Fixture: IP **1e5**, Infinity **${fixture.state.infinityCount}**, IA levels **${fixture.state.infiniteAngleSpeedLevel}/${fixture.state.infiniteAngleVertexLevel}/${fixture.state.infiniteAngleGainLevel}**, Tower Floor **${fixture.state.towerFloor}**, Time Flux **${fixture.state.timeFlux}**.`,
    `- Cadence: **${formatSeconds(report.options.requestedStepSeconds)}** production seed; immediate actions are exhausted at a fixed point before and after each advance; no calendar-scale action interval is used.`,
    `- Objective policy: **${report.options.objectivePolicy}**; TC3 is blocked until exactly **${report.productionPredicates.tc3InfinityCountTarget}** normal Infinity count.`,
    `- Horizon/stall guard: **${formatSeconds(report.options.maxRunSeconds)}** / **${formatSeconds(report.options.maxStallSeconds)}**; action search iterations **${report.options.actionSearchIterations}** after the initial bracket.`,
    `- Convergence: **${report.validation.convergence.status}**${report.validation.convergence.maxRelativeDifference === undefined ? "" : ` (max relative difference ${report.validation.convergence.maxRelativeDifference})`}; sanity guards: **${report.validation.sanity.status}**.`,
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
    "## Final policy diagnostics",
    "",
    "| Effect | Status | Objective | Target | Elapsed | IP / gain | Infinity | GR / multiplier | CB | Tower / TC |",
    "| --- | --- | --- | ---: | ---: | --- | ---: | --- | ---: | --- |",
  );
  report.cases.forEach((entry) => {
    const diagnostics = entry.diagnostics;
    const objective = diagnostics.objective;
    const target = objective.targetCount ?? objective.targetLog10 ?? "n/a";
    lines.push(`| ${entry.candidateId} | ${entry.status} | ${objective.kind} (${objective.reason}) | ${target} | ${formatSeconds(diagnostics.elapsedSeconds)} | ${diagnostics.infinityPointLog10} / ${diagnostics.infinityPointGainLog10} | ${diagnostics.infinityCount} | ${diagnostics.generationCount} / ${diagnostics.generationScoreMultiplierLog10} | ${diagnostics.coreBoostCount} | F${diagnostics.towerFloor} / ${diagnostics.activeTowerChallenge || "-"} (${diagnostics.completedTowerChallenges}) |`);
  });
  lines.push(
    "",
    "## Stage durations from fixture t = 0",
    "",
    "| Effect | From | To | Duration |",
    "| --- | --- | --- | ---: |",
  );
  report.cases.forEach((entry) => entry.researchSummary.stages.forEach((stage) => {
    lines.push(`| ${entry.candidateId} | ${stage.from} | ${stage.to} | ${formatSeconds(stage.durationSeconds)} |`);
  }));
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
    "- An unfinished run is reported as `policy-stall` with its current objective and state; no astronomical extrapolation is used.",
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
  coreBoostActionAvailable,
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
  generationActionAvailable,
  hasPolicyAction,
  infinityResetReady,
  installResearchEffect,
  parallelMultiplierLog10,
  progressSnapshot,
  productionPredicateReport,
  realMultiplierLog10,
  progressionObjective,
  runBoundedLoop,
  runCase,
  runPolicyAction,
  writeReports,
};
