import { runtime, expose } from "../runtime/shared.js";
import { clampOfflineTickCount } from "./save-format.js";

let offlineProcessing = false;
let offlineReport = null;
let simulationBatchDepth = 0;
let simulationUiPending = false;
let simulationSaveReason = "";
let uiUpdateCount = 0;
let simulationFlushActive = false;
let simulationFlushSavePerformed = false;
let offlineProcessPromise = null;
let offlineWorkLedger = null;
let offlineDiagnostics = null;
let offlineEventProbeActive = false;

const OFFLINE_PROCESS_TIME_BUDGET_MS = 8;
const OFFLINE_PROCESS_INITIAL_BATCH_TICKS = 64;
const OFFLINE_PROCESS_TARGET_BATCH_MS = 2;
const OFFLINE_PROCESS_PROGRESS_UPDATE_INTERVAL_MS = 100;
const OFFLINE_PROCESS_ZERO_CLOCK_TICK_LIMIT = 4096;
const OFFLINE_EVENT_BOUNDARY_MAX_ITERATIONS = 16384;
// ponytail: dense event runs fall back to 32 canonical ticks; add event-specific aggregation only if measurements justify it.
const OFFLINE_EVENT_DENSE_FALLBACK_TICKS = 32;
const OFFLINE_EVENT_KEYS = Object.freeze([
  "infinityExecutions",
  "generationResets",
  "coreBoostResets",
  "normalUpgradePurchases",
  "infinityUpgradePurchases",
  "infiniteAnglePurchases",
  "towerBuilds",
  "automaticUnlocks",
  "automaticCompletions",
]);
const OFFLINE_EVENT_FAMILY_KEYS = Object.freeze([
  "autoInfinity",
  "generationCoreBoost",
  "otherAutomation",
]);
const OFFLINE_EVENT_FAMILY_BY_KEY = Object.freeze({
  infinityExecutions: "autoInfinity",
  generationResets: "generationCoreBoost",
  coreBoostResets: "generationCoreBoost",
});
const OFFLINE_EVENT_SIGNATURE_KEYS = Object.freeze([
  "verticesExact",
  "vertices",
  "ic8VertexUpgradeLevelExact",
  "ic8VertexUpgradeLevel",
  "speedLevelExact",
  "speedLevel",
  "gainLevelExact",
  "gainLevel",
  "generationCount",
  "coreBoostCount",
  "infinityCountExact",
  "infinityCount",
  "infinityPointsExact",
  "eternityCountExact",
  "eternityCount",
  "generationScoreMultiplierLog10",
  "generationCostFactor",
  "previousGenerationScoreLog10",
  "infinityUpgradeMask",
  "ipGainUpgradeLevel",
  "infiniteAngleUpgradeLevel",
  "infiniteAngleSpeedLevel",
  "infiniteAngleVertexLevel",
  "infiniteAngleGainLevel",
  "softcapUpgradeLevel",
  "tc4BaseGainLevel",
  "tc4BaseGainPriceStep",
  "tc4InfinityScoreVertexGainLevel",
  "tc4InfinityScoreVertexGainPriceStep",
  "tc4FreeCoreBoostLevel",
  "tc4FreeCoreBoostPriceStep",
  "towerFloor",
  "activeChallenge",
  "completedChallenges",
  "activeTowerChallenge",
  "completedTowerChallenges",
  "infiniteCapBroken",
  "infiniteAngleUnlocked",
  "scoreUnlocked",
  "generationUnlocked",
  "coreBoostUnlocked",
  "infinityUnlocked",
  "eternityUnlocked",
  "unlockedMainTabs",
  "achievementMask",
  "achievementMaskHigh",
  "eternityMilestoneMask",
  "eternityMilestoneChoice",
  "timelinePurchasedNodes",
  "noGenerationCoreBoostReached",
  "currentInfinityRunHadGeneration",
  "currentInfinityRunHadCoreBoost",
  "automationEnabled",
  "autoBuySpeed",
  "autoBuyVertex",
  "autoBuyGain",
  "autoBuyInfinityUpgrades",
  "autoBuildTower",
  "autoRunGeneration",
  "autoRunCoreBoost",
  "autoRunInfinity",
  "autoBuyInfiniteAngleSpeed",
  "autoBuyInfiniteAngleVertex",
  "autoBuyInfiniteAngleGain",
]);

const baseUpdateUi = runtime.updateUi;
const baseSaveGame = runtime.saveGame;

function simulationBatchActive() {
  return simulationBatchDepth > 0;
}

function createOfflineEventCounts() {
  return Object.fromEntries(OFFLINE_EVENT_KEYS.map((key) => [key, 0]));
}

function createOfflineEventFamilyCounts() {
  return Object.fromEntries(OFFLINE_EVENT_FAMILY_KEYS.map((key) => [key, 0]));
}

function beginOfflineDiagnostics(requestedTicks) {
  offlineDiagnostics = {
    requestedTicks,
    processedTicks: 0,
    simulationIterations: 0,
    fullSimulationIterations: 0,
    bulkProcessedTicks: 0,
    bulkIterations: 0,
    aggregatedTicks: 0,
    cyclesAggregated: 0,
    cycleFallbackReason: "",
    eventBoundaryCount: 0,
    eventBoundaryIterations: 0,
    guardedFallbackIterations: 0,
    predictionInvalidations: 0,
    eventProbeIterations: 0,
    wallTimeMs: 0,
    precisionReduced: false,
    eventCounts: createOfflineEventCounts(),
    eventFamilyCounts: createOfflineEventFamilyCounts(),
  };
}

function recordOfflineEvent(name, count = 1) {
  if (offlineEventProbeActive || !offlineProcessing || !offlineDiagnostics || !OFFLINE_EVENT_KEYS.includes(name)) return;
  const normalizedCount = Math.max(0, Math.floor(Number(count) || 0));
  offlineDiagnostics.eventCounts[name] += normalizedCount;
  const family = OFFLINE_EVENT_FAMILY_BY_KEY[name] || "otherAutomation";
  offlineDiagnostics.eventFamilyCounts[family] += normalizedCount;
}

function offlineDiagnosticsSnapshot() {
  if (!offlineDiagnostics) return null;
  return {
    requestedTicks: offlineDiagnostics.requestedTicks,
    processedTicks: offlineDiagnostics.processedTicks,
    simulationIterations: offlineDiagnostics.simulationIterations,
    fullSimulationIterations: offlineDiagnostics.fullSimulationIterations,
    bulkProcessedTicks: offlineDiagnostics.bulkProcessedTicks,
    bulkIterations: offlineDiagnostics.bulkIterations,
    aggregatedTicks: offlineDiagnostics.aggregatedTicks,
    cyclesAggregated: offlineDiagnostics.cyclesAggregated,
    cycleFallbackReason: offlineDiagnostics.cycleFallbackReason,
    eventBoundaryCount: offlineDiagnostics.eventBoundaryCount,
    eventBoundaryIterations: offlineDiagnostics.eventBoundaryIterations,
    guardedFallbackIterations: offlineDiagnostics.guardedFallbackIterations,
    predictionInvalidations: offlineDiagnostics.predictionInvalidations,
    eventProbeIterations: offlineDiagnostics.eventProbeIterations,
    wallTimeMs: offlineDiagnostics.wallTimeMs,
    precisionReduced: offlineDiagnostics.precisionReduced,
    eventCounts: { ...offlineDiagnostics.eventCounts },
    eventFamilyCounts: { ...offlineDiagnostics.eventFamilyCounts },
  };
}

function cloneOfflineDiagnostics(value) {
  if (!value) return null;
  return {
    ...value,
    eventCounts: { ...(value.eventCounts || {}) },
    eventFamilyCounts: { ...(value.eventFamilyCounts || {}) },
  };
}

function offlineEventStateSignature(snapshot = runtime.snapshotRuntimeState()) {
  return JSON.stringify(
    OFFLINE_EVENT_SIGNATURE_KEYS.map((key) => [key, snapshot[key]]),
  );
}

function beginOfflineWorkBudget(requestedTicks = runtime.OFFLINE_PROGRESS_MAX_TICKS) {
  const parsedTicks = Number(requestedTicks);
  const ticks = Number.isFinite(parsedTicks)
    ? Math.max(1, Math.min(runtime.OFFLINE_PROGRESS_MAX_TICKS, Math.floor(parsedTicks)))
    : runtime.OFFLINE_PROGRESS_MAX_TICKS;
  const bulkBudget = Math.max(0, Math.floor(runtime.OFFLINE_CORE_HIT_WORK_BUDGET));
  const smallBudget = ticks * Math.max(0, Math.floor(runtime.OFFLINE_SMALL_CORE_HIT_EXACT_LIMIT));
  const fallbackBudget = ticks * Math.max(1, Math.floor(runtime.OFFLINE_FALLBACK_APPROX_SEGMENTS));
  // ponytail: tracks stay fixed for one resume; dynamic reserve reallocation can wait for a real need.
  const activeTrackNames = ["angle"];
  if (runtime.state?.infiniteAngleUnlocked) activeTrackNames.push("infiniteAngle");
  const activeTrackCount = activeTrackNames.length;
  const minimumReserve = (budget) => Math.floor(budget / 2);
  const sharedBudget = {
    bulkRemaining: bulkBudget * 2 - activeTrackNames.length * minimumReserve(bulkBudget),
    smallExactRemaining: smallBudget * 2 - activeTrackNames.length * minimumReserve(smallBudget),
    fallbackRemaining: fallbackBudget * 2 - activeTrackNames.length * minimumReserve(fallbackBudget),
  };
  const createTrack = (name) => ({
    active: activeTrackNames.includes(name),
    bulkRemaining: activeTrackNames.includes(name) ? minimumReserve(bulkBudget) : 0,
    smallExactRemaining: activeTrackNames.includes(name) ? minimumReserve(smallBudget) : 0,
    fallbackRemaining: activeTrackNames.includes(name) ? minimumReserve(fallbackBudget) : 0,
    exactIterations: 0,
    approximationIterations: 0,
    bulkIterations: 0,
    smallExactIterations: 0,
    fallbackIterations: 0,
    spilloverIterations: 0,
  });
  offlineWorkLedger = {
    requestedTicks: ticks,
    hardCap: (bulkBudget + smallBudget + fallbackBudget) * 2,
    totalIterations: 0,
    precisionReduced: false,
    activeTrackNames,
    activeTrackCount,
    shared: sharedBudget,
    tracks: {
      angle: createTrack("angle"),
      infiniteAngle: createTrack("infiniteAngle"),
    },
  };
}

function sharedWorkLimit(trackName, bucket) {
  if (!offlineWorkLedger) return 0;
  const track = offlineWorkLedger.tracks?.[trackName];
  if (!track?.active) return 0;
  const remainingKey = bucket === "small"
    ? "smallExactRemaining"
    : bucket === "fallback"
      ? "fallbackRemaining"
      : "bulkRemaining";
  const remaining = offlineWorkLedger.shared[remainingKey];
  return offlineWorkLedger.activeTrackCount > 1
    ? Math.ceil(remaining / offlineWorkLedger.activeTrackCount)
    : remaining;
}

function offlineWorkAvailable(trackName, bucket) {
  const track = offlineWorkLedger?.tracks?.[trackName];
  if (!track) return 0;
  const remainingKey = bucket === "small"
    ? "smallExactRemaining"
    : bucket === "fallback"
      ? "fallbackRemaining"
      : "bulkRemaining";
  return track[remainingKey] + sharedWorkLimit(trackName, bucket);
}

function consumeOfflineWork(trackName, bucket, requested, approximation = false) {
  const track = offlineWorkLedger?.tracks?.[trackName];
  const count = Math.max(0, Math.floor(Number(requested) || 0));
  if (!track || count <= 0) return 0;
  const remainingKey = bucket === "small"
    ? "smallExactRemaining"
    : bucket === "fallback"
      ? "fallbackRemaining"
      : "bulkRemaining";
  const ownAllowed = Math.min(count, track[remainingKey]);
  track[remainingKey] -= ownAllowed;
  const sharedAllowed = Math.min(count - ownAllowed, sharedWorkLimit(trackName, bucket));
  offlineWorkLedger.shared[remainingKey] -= sharedAllowed;
  const allowed = ownAllowed + sharedAllowed;
  track[approximation ? "approximationIterations" : "exactIterations"] += allowed;
  if (bucket === "small") track.smallExactIterations += allowed;
  else if (bucket === "fallback") track.fallbackIterations += allowed;
  else track.bulkIterations += allowed;
  track.spilloverIterations += sharedAllowed;
  offlineWorkLedger.totalIterations += allowed;
  if (approximation && allowed > 0) offlineWorkLedger.precisionReduced = true;
  return allowed;
}

function offlineCoreHitPlan(trackName, coreHits, onlineExactLimit, onlineApproximationSegments) {
  const hits = Math.max(0, Math.floor(Number(coreHits) || 0));
  if (!runtime.offlineProcessing) {
    return hits <= onlineExactLimit
      ? { mode: "exact", iterations: hits }
      : {
        mode: "approximation",
        iterations: Math.min(runtime.CORE_HIT_APPROX_SEGMENTS, onlineApproximationSegments, hits),
      };
  }
  if (!offlineWorkLedger) beginOfflineWorkBudget();
  const smallLimit = Math.max(0, Math.floor(runtime.OFFLINE_SMALL_CORE_HIT_EXACT_LIMIT));
  if (hits <= smallLimit && offlineWorkAvailable(trackName, "small") >= hits) {
    consumeOfflineWork(trackName, "small", hits);
    return { mode: "exact", iterations: hits };
  }
  if (hits <= offlineWorkAvailable(trackName, "bulk")) {
    consumeOfflineWork(trackName, "bulk", hits);
    return { mode: "exact", iterations: hits };
  }
  const approximationSegments = Math.min(
    runtime.CORE_HIT_APPROX_SEGMENTS,
    hits,
    offlineWorkAvailable(trackName, "bulk"),
  );
  if (approximationSegments > 0) {
    consumeOfflineWork(trackName, "bulk", approximationSegments, true);
    return { mode: "approximation", iterations: approximationSegments };
  }
  const fallbackSegments = Math.min(
    Math.max(1, Math.floor(runtime.OFFLINE_FALLBACK_APPROX_SEGMENTS)),
    hits,
    offlineWorkAvailable(trackName, "fallback"),
  );
  if (fallbackSegments > 0) {
    consumeOfflineWork(trackName, "fallback", fallbackSegments, true);
    return { mode: "approximation", iterations: fallbackSegments };
  }
  // The real resume loop allows one fallback batch per track per tick. This is
  // only a defensive path for direct debug calls beyond the configured resume.
  offlineWorkLedger.precisionReduced = true;
  return { mode: "approximation", iterations: 1 };
}

function offlineWorkStatsSnapshot() {
  if (!offlineWorkLedger) return null;
  const copyTrack = (track) => ({
    active: track.active,
    exactIterations: track.exactIterations,
    approximationIterations: track.approximationIterations,
    bulkIterations: track.bulkIterations,
    smallExactIterations: track.smallExactIterations,
    fallbackIterations: track.fallbackIterations,
    spilloverIterations: track.spilloverIterations,
    bulkRemaining: track.bulkRemaining,
    smallExactRemaining: track.smallExactRemaining,
    fallbackRemaining: track.fallbackRemaining,
  });
  return {
    requestedTicks: offlineWorkLedger.requestedTicks,
    hardCap: offlineWorkLedger.hardCap,
    totalIterations: offlineWorkLedger.totalIterations,
    precisionReduced: offlineWorkLedger.precisionReduced,
    activeTrackNames: [...offlineWorkLedger.activeTrackNames],
    shared: { ...offlineWorkLedger.shared },
    tracks: {
      angle: copyTrack(offlineWorkLedger.tracks.angle),
      infiniteAngle: copyTrack(offlineWorkLedger.tracks.infiniteAngle),
    },
  };
}

function cloneOfflineWorkLedger(value = offlineWorkLedger) {
  if (!value) return null;
  return {
    ...value,
    activeTrackNames: [...value.activeTrackNames],
    shared: { ...value.shared },
    tracks: Object.fromEntries(
      Object.entries(value.tracks).map(([name, track]) => [name, { ...track }]),
    ),
  };
}

function offlineBulkSimulationAllowed() {
  const state = runtime.state;
  return runtime.currentExactIntegerState(state, "infinityCountExact", "infinityCount") > 0n
    && !state.automationEnabled
    && state.activeChallenge <= 0
    && state.activeTowerChallenge <= 0
    && runtime.timelineBulkSimulationAllowed?.() === true;
}

function offlineBulkTickLimit(tickSeconds, remainingTicks) {
  if (!offlineBulkSimulationAllowed()) return 1;
  const timeUntilAchievement = 5 * 60 * 60 - runtime.state.totalPlayTime;
  if (
    runtime.isAchievementUnlocked?.(11) !== true
    && timeUntilAchievement > 0
    && Number.isFinite(tickSeconds)
    && tickSeconds > 0
  ) {
    return Math.max(1, Math.min(remainingTicks, Math.ceil(timeUntilAchievement / tickSeconds)));
  }
  return remainingTicks;
}

function setOfflineProcessing(value) {
  const nextValue = Boolean(value);
  if (nextValue === offlineProcessing) return;
  offlineProcessing = nextValue;
  if (nextValue && !offlineWorkLedger) beginOfflineWorkBudget();
}

function queueSimulationSave(reason = "auto") {
  const normalizedReason = reason === "manual" ? "manual" : "auto";
  if (!simulationSaveReason || normalizedReason === "manual") simulationSaveReason = normalizedReason;
}

function batchedUpdateUi(...args) {
  if (offlineEventProbeActive) return undefined;
  if (simulationBatchActive() || offlineProcessing) {
    simulationUiPending = true;
    return undefined;
  }
  uiUpdateCount += 1;
  const result = baseUpdateUi(...args);
  if (runtime.saveConflictMode) runtime.setSaveConflictLock(true);
  return result;
}

function batchedSaveGame(reason = "auto", options = {}) {
  if (offlineEventProbeActive) return true;
  if (simulationBatchActive()) {
    queueSimulationSave(reason);
    return true;
  }
  if (simulationFlushActive) simulationFlushSavePerformed = true;
  return baseSaveGame(reason, options);
}

runtime.updateUi = batchedUpdateUi;
runtime.saveGame = batchedSaveGame;

function flushSimulationSideEffects() {
  if (simulationBatchActive()) return;
  const shouldUpdateUi = simulationUiPending;
  const saveReason = simulationSaveReason;
  simulationUiPending = false;
  simulationSaveReason = "";
  if (!shouldUpdateUi && !saveReason) return;

  simulationFlushActive = true;
  simulationFlushSavePerformed = false;
  try {
    if (shouldUpdateUi) runtime.updateUi();
    if (saveReason && !simulationFlushSavePerformed) runtime.saveGame(saveReason);
  } finally {
    simulationFlushActive = false;
    simulationFlushSavePerformed = false;
  }
}

function runSimulationBatch(callback) {
  simulationBatchDepth += 1;
  try {
    return callback();
  } finally {
    simulationBatchDepth -= 1;
    if (simulationBatchDepth === 0) flushSimulationSideEffects();
  }
}


function offlineSnapshot() {
  const state = runtime.state;
  const generationCount = Math.max(0, Math.floor(Number(state.generationCount) || 0));
  const coreBoostCount = Math.max(0, Math.floor(Number(state.coreBoostCount) || 0));
  const infinityCountExact = runtime.currentExactIntegerState(state, "infinityCountExact", "infinityCount");
  const eternityCountExact = runtime.currentExactIntegerState(state, "eternityCountExact", "eternityCount");
  const infinityCount = runtime.numberFromExactInteger(infinityCountExact);
  const eternityCount = runtime.numberFromExactInteger(eternityCountExact);
  return {
    scoreLog10: runtime.currentScoreLog10(),
    generationCount,
    coreBoostCount,
    infinityCount,
    infinityCountExact: infinityCountExact.toString(),
    infinityPointsLog10: runtime.currentInfinityPointsLog10(),
    infinityPointsExact: typeof state.infinityPointsExact === "string" ? state.infinityPointsExact : "",
    infiniteScoreLog10: runtime.currentInfiniteScoreLog10(),
    eternityCount,
    eternityCountExact: eternityCountExact.toString(),
    scoreUnlocked: true,
    generationUnlocked: generationCount > 0
      || runtime.currentTotalScoreLog10() >= runtime.log10Value(runtime.GENERATION_UNLOCK_SCORE),
    coreBoostUnlocked: coreBoostCount > 0,
    infinityUnlocked: infinityCount > 0,
    infiniteAngleUnlocked: Boolean(state.infiniteAngleUnlocked),
    eternityUnlocked: eternityCount > 0,
    timeFlux: state.timeFlux,
    totalPlayTime: state.totalPlayTime,
  };
}

function exactSnapshotDifference(after, before, exactKey, legacyKey) {
  const afterValue = runtime.parseExactInteger(after?.[exactKey], runtime.parseExactInteger(after?.[legacyKey], 0n));
  const beforeValue = runtime.parseExactInteger(before?.[exactKey], runtime.parseExactInteger(before?.[legacyKey], 0n));
  return afterValue > beforeValue ? afterValue - beforeValue : 0n;
}

function offlineInfinityAggregationEnabled() {
  return runtime.state.automationEnabled
    && runtime.state.autoRunInfinity
    && runtime.state.autoInfinityPointThresholdLog10 === 0
    && runtime.currentExactIntegerState(runtime.state, "infinityCountExact", "infinityCount") > 0n
    && (runtime.infinityAutomationUnlocked?.() || false)
    && runtime.state.activeChallenge <= 0
    && runtime.state.activeTowerChallenge <= 0;
}

function applyOfflineInfinityAggregation(
  effectiveElapsedSeconds,
  normalInfinityCountGain,
  bestRate,
  rateRemainder,
) {
  if (!Number.isFinite(bestRate) || bestRate <= 0 || effectiveElapsedSeconds <= 0) {
    return { added: 0, remainder: rateRemainder };
  }
  const target = bestRate * effectiveElapsedSeconds * runtime.OFFLINE_INFINITY_AGGREGATION_EFFICIENCY
    + Math.max(0, rateRemainder);
  if (!Number.isFinite(target) || target <= 0) return { added: 0, remainder: rateRemainder };
  const targetCount = Math.floor(target);
  const additional = Math.max(0, targetCount - normalInfinityCountGain);
  const added = runtime.addAggregatedInfinityCount(additional);
  runtime.state.infinityCountRateRemainder = Math.max(
    0,
    target - normalInfinityCountGain - added,
  );
  return {
    added,
    remainder: runtime.state.infinityCountRateRemainder,
  };
}

const OFFLINE_INFINITY_CYCLE_IGNORED_FIELDS = Object.freeze([
  "infinityCount",
  "infinityCountExact",
  "infinityPoints",
  "infinityPointsLog10",
  "infinityPointsExact",
  "lastInfinityRuns",
  "totalPlayTime",
  "currentInfinityRunTime",
  "currentInfinityRealTime",
  "currentEternityRunTime",
  "currentGenerationRunTime",
]);

function offlineInfinityCycleStateSignatureFromSnapshot(snapshot) {
  const normalized = { ...snapshot };
  const latestInfinityRun = Array.isArray(normalized.lastInfinityRuns)
    ? normalized.lastInfinityRuns[0] || null
    : null;
  OFFLINE_INFINITY_CYCLE_IGNORED_FIELDS.forEach((field) => delete normalized[field]);
  return JSON.stringify({ state: normalized, latestInfinityRun });
}

function offlineInfinityCycleGainLog10Matches(expected, actual) {
  if (Object.is(expected, actual)) return true;
  return Number.isFinite(expected)
    && Number.isFinite(actual)
    && Math.abs(expected - actual) <= 1e-12;
}

function offlineInfinityCyclePathEligible(tickSeconds, requestedTicks, bestRate, rateRemainder) {
  if (!offlineInfinityAggregationEnabled() || requestedTicks < 2 || !runtime.canInfinity()) return false;
  if (!Number.isFinite(tickSeconds) || tickSeconds <= 0) return false;
  if (!Number.isFinite(bestRate) || bestRate <= 0) return false;
  if (!Number.isFinite(rateRemainder) || rateRemainder < 0 || rateRemainder >= 1) return false;
  if (runtime.OFFLINE_INFINITY_AGGREGATION_EFFICIENCY !== 1) return false;
  if (Math.abs(bestRate * tickSeconds - 1) > 1e-6) return false;
  if (runtime.state.infiniteAngleUnlocked) return false;
  if (Array.isArray(runtime.state.timelinePurchasedNodes) && runtime.state.timelinePurchasedNodes.length > 0) return false;
  if (runtime.state.eternityMilestoneMask !== 0) return false;
  return ![
    "autoBuySpeed",
    "autoBuyVertex",
    "autoBuyGain",
    "autoBuyInfinityUpgrades",
    "autoBuildTower",
    "autoRunGeneration",
    "autoRunCoreBoost",
    "autoBuyInfiniteAngleSpeed",
    "autoBuyInfiniteAngleVertex",
    "autoBuyInfiniteAngleGain",
  ].some((field) => runtime.state[field]);
}

function applyOfflineInfinityCycleAggregation(
  remainingTicks,
  tickSeconds,
  bestRate,
  rateRemainder,
  cycleInputState,
  cycleIpGainLog10,
) {
  const remainingSeconds = tickSeconds * remainingTicks;
  const target = bestRate * remainingSeconds * runtime.OFFLINE_INFINITY_AGGREGATION_EFFICIENCY
    + Math.max(0, rateRemainder);
  if (!Number.isFinite(target) || target <= 0) {
    return { used: false, cyclesAggregated: 0, reason: "invalid-target" };
  }
  const cyclesAggregated = Math.floor(target + Math.max(1, Math.abs(target)) * Number.EPSILON * 8);
  if (cyclesAggregated <= 0 || cyclesAggregated !== remainingTicks) {
    return { used: false, cyclesAggregated: 0, reason: "cycle-count-out-of-range" };
  }
  const cycleIpGainExact = runtime.exactInfinityPointsFromLog10(cycleIpGainLog10);
  if (cycleIpGainExact <= 0n) return { used: false, cyclesAggregated: 0, reason: "invalid-ip-gain" };

  const actualState = runtime.snapshotRuntimeState();
  const countBefore = runtime.currentExactIntegerState(runtime.state, "infinityCountExact", "infinityCount");
  const ipBefore = runtime.currentExactInfinityPoints();
  const countAdded = BigInt(cyclesAggregated);
  const ipAdded = cycleIpGainExact * countAdded;
  let safe = false;
  try {
    runtime.state.totalPlayTime += remainingSeconds;
    runtime.setExactIntegerState(
      runtime.state,
      "infinityCountExact",
      "infinityCount",
      countBefore + countAdded,
    );
    runtime.syncInfinityPointCachesFromExact(ipBefore + ipAdded);
    runtime.state.score = cycleInputState.score;
    runtime.state.scoreLog10 = cycleInputState.scoreLog10;
    runtime.state.totalScore = cycleInputState.totalScore;
    runtime.state.totalScoreLog10 = cycleInputState.totalScoreLog10;
    runtime.state.generationScore = cycleInputState.generationScore;
    runtime.state.generationScoreLog10 = cycleInputState.generationScoreLog10;
    runtime.checkAchievements(false);
    safe = runtime.infinityCountGainExact() === 1n
      && offlineInfinityCycleGainLog10Matches(
        cycleIpGainLog10,
        runtime.infinityPointGainLog10(),
      );
  } finally {
    runtime.restoreRuntimeState(actualState);
  }
  if (!safe) return { used: false, cyclesAggregated: 0, reason: "formula-changed" };

  runtime.setExactIntegerState(
    runtime.state,
    "infinityCountExact",
    "infinityCount",
    countBefore + countAdded,
  );
  runtime.syncInfinityPointCachesFromExact(ipBefore + ipAdded);
  runtime.state.totalPlayTime += remainingSeconds;
  runtime.state.currentEternityRunTime += remainingSeconds;
  runtime.state.currentInfinityRunTime = 0;
  runtime.state.currentInfinityRealTime = 0;
  runtime.state.currentGenerationRunTime = 0;
  if (runtime.normalAutomationUnlocked?.() && runtime.state.automationEnabled) {
    runtime.normalAutobuyElapsed += remainingSeconds;
    if (runtime.normalAutobuyElapsed >= runtime.AUTOBUY_INTERVAL_SECONDS) {
      runtime.normalAutobuyElapsed %= runtime.AUTOBUY_INTERVAL_SECONDS;
      if (runtime.AUTOBUY_INTERVAL_SECONDS - runtime.normalAutobuyElapsed <= 1e-9) runtime.normalAutobuyElapsed = 0;
    }
  } else {
    runtime.normalAutobuyElapsed = 0;
  }
  runtime.state.pointProgress = 0;
  runtime.state.totalVertexProgress = 0;
  runtime.state.lastVertexIndex = 0;
  runtime.state.infinityCountRateRemainder = Math.max(0, target - cyclesAggregated);
  runtime.checkAchievements(true);
  return {
    used: true,
    cyclesAggregated,
    aggregatedCountExact: countAdded,
    aggregatedTicks: remainingTicks,
  };
}

function tryOfflineInfinityCyclePath(tickSeconds, requestedTicks, bestRate, rateRemainder) {
  const fallback = (processedTicks, reason = "ineligible") => ({
    used: false,
    processedTicks,
    simulationIterations: processedTicks,
    eventBoundaryCount: processedTicks,
    eventBoundaryIterations: processedTicks,
    aggregatedTicks: 0,
    cyclesAggregated: 0,
    aggregatedCountExact: 0n,
    reason,
  });
  if (!offlineInfinityCyclePathEligible(tickSeconds, requestedTicks, bestRate, rateRemainder)) {
    return fallback(0, "eligibility-guard");
  }

  const firstInputState = runtime.snapshotRuntimeState();
  const firstIpGainLog10 = runtime.infinityPointGainLog10();
  runtime.update(tickSeconds, true);
  const firstAfter = runtime.snapshotRuntimeState();
  const firstCountGain = exactSnapshotDifference(
    firstAfter,
    firstInputState,
    "infinityCountExact",
    "infinityCount",
  );
  if (firstCountGain !== 1n || !Number.isFinite(firstIpGainLog10)) return fallback(1, "first-cycle-gain");
  if (!runtime.canInfinity()) return fallback(1, "reset-not-ready");

  const secondInputState = runtime.snapshotRuntimeState();
  const secondIpGainLog10 = runtime.infinityPointGainLog10();
  runtime.update(tickSeconds, true);
  const secondAfter = runtime.snapshotRuntimeState();
  const secondCountGain = exactSnapshotDifference(
    secondAfter,
    firstAfter,
    "infinityCountExact",
    "infinityCount",
  );
  const stable = secondCountGain === firstCountGain
    && offlineInfinityCycleGainLog10Matches(firstIpGainLog10, secondIpGainLog10)
    && offlineInfinityCycleStateSignatureFromSnapshot(firstAfter) === offlineInfinityCycleStateSignatureFromSnapshot(secondAfter);
  if (!stable) return fallback(2, "cycle-not-stable");

  const remainingTicks = requestedTicks - 2;
  if (remainingTicks <= 0) return fallback(2, "no-remaining-cycles");
  const aggregation = applyOfflineInfinityCycleAggregation(
    remainingTicks,
    tickSeconds,
    bestRate,
    rateRemainder,
    secondInputState,
    secondIpGainLog10,
  );
  if (!aggregation.used) return fallback(2, aggregation.reason);
  return {
    used: true,
    processedTicks: requestedTicks,
    simulationIterations: 2,
    eventBoundaryCount: 2,
    eventBoundaryIterations: 2,
    aggregatedTicks: aggregation.aggregatedTicks,
    cyclesAggregated: aggregation.cyclesAggregated,
    aggregatedCountExact: aggregation.aggregatedCountExact,
  };
}

function offlineGenerationCoreEventPathEligible(tickSeconds, remainingTicks) {
  const state = runtime.state;
  if (!Number.isFinite(tickSeconds) || tickSeconds <= 0 || remainingTicks < 2) return false;
  if (!state.automationEnabled || runtime.isAchievementUnlocked?.(19) !== true) return false;
  if (!state.autoRunGeneration && !state.autoRunCoreBoost) return false;
  if (state.activeChallenge > 0 || state.activeTowerChallenge > 0) return false;
  if (state.eternityMilestoneMask !== 0) return false;
  if (Array.isArray(state.timelinePurchasedNodes) && state.timelinePurchasedNodes.length > 0) return false;
  return ![
    "autoBuySpeed",
    "autoBuyVertex",
    "autoBuyGain",
    "autoBuyInfinityUpgrades",
    "autoBuildTower",
    "autoBuyInfiniteAngleSpeed",
    "autoBuyInfiniteAngleVertex",
    "autoBuyInfiniteAngleGain",
  ].some((field) => state[field]);
}

function offlineAutomationEventPathEligible(tickSeconds, remainingTicks) {
  const state = runtime.state;
  if (!Number.isFinite(tickSeconds) || tickSeconds <= 0 || remainingTicks < 2) return false;
  const normalPurchaseAutomation = state.automationEnabled
    && runtime.normalAutomationUnlocked?.() === true
    && [
      "autoBuySpeed",
      "autoBuyVertex",
      "autoBuyGain",
      "autoBuyInfinityUpgrades",
    ].some((field) => state[field]);
  const infiniteAnglePurchaseAutomation = state.automationEnabled
    && runtime.eternityMilestoneActive?.("8") === true
    && [
      "autoBuildTower",
      "autoBuyInfiniteAngleSpeed",
      "autoBuyInfiniteAngleVertex",
      "autoBuyInfiniteAngleGain",
    ].some((field) => state[field]);
  const purchaseAutomation = normalPurchaseAutomation || infiniteAnglePurchaseAutomation;
  const combinedResetAutomation = state.automationEnabled
    && state.autoRunInfinity
    && (purchaseAutomation || state.autoRunGeneration || state.autoRunCoreBoost);
  const milestoneTransition = (
    (runtime.eternityMilestoneActive?.("5") === true && !state.infiniteAngleUnlocked)
    || (runtime.eternityMilestoneActive?.("6") === true && !state.infiniteCapBroken)
    || (runtime.eternityMilestoneActive?.("7") === true && state.activeTowerChallenge > 0)
  ) && (!state.autoRunInfinity || purchaseAutomation || state.autoRunGeneration || state.autoRunCoreBoost);
  return purchaseAutomation || combinedResetAutomation || milestoneTransition;
}

function snapshotOfflineEventProbe() {
  return {
    state: runtime.snapshotRuntimeState(),
    normalAutobuyElapsed: runtime.normalAutobuyElapsed,
    offlineDiagnostics: cloneOfflineDiagnostics(offlineDiagnostics),
    offlineWorkLedger: cloneOfflineWorkLedger(),
    offlineReport,
    simulationUiPending,
    simulationSaveReason,
  };
}

function restoreOfflineEventProbe(snapshot) {
  runtime.restoreRuntimeState(snapshot.state);
  runtime.normalAutobuyElapsed = snapshot.normalAutobuyElapsed;
  offlineDiagnostics = cloneOfflineDiagnostics(snapshot.offlineDiagnostics);
  offlineWorkLedger = cloneOfflineWorkLedger(snapshot.offlineWorkLedger);
  offlineReport = snapshot.offlineReport;
  simulationUiPending = snapshot.simulationUiPending;
  simulationSaveReason = snapshot.simulationSaveReason;
}

function probeOfflineEventInterval(snapshot, seconds, baselineSignature) {
  let changed = false;
  offlineEventProbeActive = true;
  try {
    runtime.update(seconds, true);
    changed = offlineEventStateSignature() !== baselineSignature;
  } finally {
    try {
      restoreOfflineEventProbe(snapshot);
    } finally {
      offlineEventProbeActive = false;
    }
  }
  return changed;
}

function inspectOfflineGenerationCoreEventFamily(tickSeconds, remainingTicks, batchTicks) {
  if (!offlineGenerationCoreEventPathEligible(tickSeconds, remainingTicks)) {
    return { eligible: false, safe: false, reason: "eligibility-guard" };
  }
  const requestedBatchTicks = Number.isFinite(batchTicks) ? Math.floor(batchTicks) : 64;
  const candidateTicks = Math.min(remainingTicks, Math.max(2, requestedBatchTicks));
  if (candidateTicks < 2 || !offlineProgressNumericallySafe(tickSeconds * candidateTicks)) {
    return { eligible: true, safe: false, reason: "numeric-guard" };
  }
  return {
    eligible: true,
    safe: true,
    candidateTicks,
    family: "generationCoreBoost",
  };
}

function inspectOfflineEventFamily(tickSeconds, remainingTicks, batchTicks) {
  if (offlineAutomationEventPathEligible(tickSeconds, remainingTicks)) {
    // Automation probes search the whole remaining segment for the first canonical
    // action; limiting this to the render batch turns idle automation into O(ticks).
    const candidateTicks = remainingTicks;
    if (candidateTicks < 2 || !offlineProgressNumericallySafe(tickSeconds * candidateTicks)) {
      return { eligible: true, safe: false, reason: "numeric-guard" };
    }
    return {
      eligible: true,
      safe: true,
      candidateTicks,
      family: "otherAutomation",
    };
  }
  return inspectOfflineGenerationCoreEventFamily(tickSeconds, remainingTicks, batchTicks);
}

function runOfflineEventBoundaryEngine({
  tickSeconds,
  remainingTicks,
  batchTicks,
  eventFamily = inspectOfflineEventFamily,
  eventBoundaryIterations = 0,
  cyclePath = null,
}) {
  if (typeof cyclePath === "function") {
    const cycleResult = cyclePath();
    if (cycleResult.used || cycleResult.processedTicks > 0) {
      return {
        ...cycleResult,
        handled: true,
        family: "autoInfinity",
        eventBoundaryIterations: cycleResult.eventBoundaryIterations
          ?? cycleResult.eventBoundaryCount
          ?? 0,
        predictionInvalidations: cycleResult.predictionInvalidations || 0,
      };
    }
  }

  const family = eventFamily(tickSeconds, remainingTicks, batchTicks);
  if (!family.eligible) {
    return {
      used: false,
      handled: false,
      eligible: false,
      safe: false,
      reason: family.reason,
      eventBoundaryIterations: 0,
      predictionInvalidations: 0,
    };
  }
  if (!family.safe) {
    return {
      used: false,
      handled: false,
      eligible: true,
      safe: false,
      disableFamily: true,
      reason: family.reason,
      eventBoundaryIterations: 0,
      predictionInvalidations: 1,
    };
  }
  if (eventBoundaryIterations >= OFFLINE_EVENT_BOUNDARY_MAX_ITERATIONS) {
    return {
      used: false,
      handled: false,
      eligible: true,
      safe: false,
      disableFamily: true,
      reason: "event-boundary-limit",
      eventBoundaryIterations: 0,
      predictionInvalidations: 1,
    };
  }

  const startingSnapshot = snapshotOfflineEventProbe();
  const baselineSignature = offlineEventStateSignature(startingSnapshot.state);
  let eventProbeIterations = 0;
  let probeFailure = "";
  const probe = (ticks) => {
    eventProbeIterations += 1;
    try {
      return probeOfflineEventInterval(
        startingSnapshot,
        tickSeconds * ticks,
        baselineSignature,
      );
    } catch {
      probeFailure = "probe-failed";
      return false;
    }
  };

  const probeFailureResult = () => {
    restoreOfflineEventProbe(startingSnapshot);
    return {
      used: false,
      handled: false,
      eligible: true,
      safe: false,
      disableFamily: true,
      reason: probeFailure,
      eventProbeIterations,
      eventBoundaryIterations: 0,
      predictionInvalidations: 1,
    };
  };

  let low = 0;
  let high = 0;
  let searchTicks = 1;
  while (high === 0) {
    const candidateTicks = Math.min(family.candidateTicks, searchTicks);
    if (probe(candidateTicks)) {
      high = candidateTicks;
      break;
    }
    if (probeFailure) return probeFailureResult();
    low = candidateTicks;
    if (low >= family.candidateTicks) {
      runtime.update(tickSeconds * family.candidateTicks, true);
      return {
        used: true,
        handled: true,
        safe: true,
        eligible: true,
        family: family.family,
        processedTicks: family.candidateTicks,
        simulationIterations: 1,
        bulkIterations: family.candidateTicks > 1 ? 1 : 0,
        bulkProcessedTicks: family.candidateTicks > 1 ? family.candidateTicks : 0,
        eventBoundaryCount: 0,
        eventBoundaryIterations: 0,
        predictionInvalidations: 0,
        eventProbeIterations,
      };
    }
    searchTicks = Math.min(family.candidateTicks, searchTicks * 2);
  }

  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (probe(middle)) high = middle;
    else if (probeFailure) {
      return probeFailureResult();
    } else low = middle;
  }

  if (!Number.isInteger(high) || high < 1 || high > family.candidateTicks) {
    restoreOfflineEventProbe(startingSnapshot);
    return {
      used: false,
      handled: false,
      eligible: true,
      safe: false,
      disableFamily: true,
      reason: "invalid-boundary",
      eventProbeIterations,
      eventBoundaryIterations: 0,
      predictionInvalidations: 1,
    };
  }
  restoreOfflineEventProbe(startingSnapshot);
  const preBoundaryTicks = high - 1;
  if (preBoundaryTicks > 0) runtime.update(tickSeconds * preBoundaryTicks, true);
  runtime.update(tickSeconds, true);
  return {
    used: true,
    handled: true,
    safe: true,
    eligible: true,
    family: family.family,
    processedTicks: high,
    simulationIterations: preBoundaryTicks > 0 ? 2 : 1,
    bulkIterations: preBoundaryTicks > 1 ? 1 : 0,
    bulkProcessedTicks: preBoundaryTicks > 1 ? preBoundaryTicks : 0,
    eventBoundaryCount: 1,
    eventBoundaryIterations: 1,
    predictionInvalidations: 1,
    eventProbeIterations,
    denseEvent: family.family === "otherAutomation" && high <= 4,
  };
}

function offlineProgressNumericallySafe(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return false;
  if (!Number.isFinite(runtime.state.totalPlayTime + seconds)) return false;
  if (!Number.isFinite(runtime.state.currentInfinityRunTime + seconds)) return false;
  if (!Number.isFinite(runtime.state.currentEternityRunTime + seconds)) return false;
  if (!Number.isFinite(runtime.state.currentGenerationRunTime + seconds)) return false;
  if (!Number.isFinite(runtime.state.timelineParallelSecondsSinceIc8Clear + seconds)) return false;

  const lapDuration = runtime.lapDuration();
  const vertices = runtime.effectiveVertexCount();
  const progressDelta = lapDuration > 0 && vertices > 0
    ? seconds / lapDuration * vertices
    : NaN;
  if (!Number.isFinite(progressDelta)
    || !Number.isFinite(runtime.state.totalVertexProgress + progressDelta)) return false;

  if (runtime.state.infiniteAngleUnlocked) {
    const infiniteLapDuration = runtime.infiniteAngleLapDuration();
    const infiniteVertices = runtime.infiniteAngleVertexCount();
    const infiniteProgressDelta = infiniteLapDuration > 0 && infiniteVertices > 0
      ? seconds / infiniteLapDuration * infiniteVertices
      : NaN;
    if (!Number.isFinite(infiniteProgressDelta)
      || !Number.isFinite(runtime.state.infiniteAngleTotalVertexProgress + infiniteProgressDelta)) return false;
  }

  return true;
}

function snapshotOfflineTransaction() {
  return {
    state: runtime.snapshotRuntimeState(),
    normalAutobuyElapsed: runtime.normalAutobuyElapsed,
    autoSaveElapsed: runtime.autoSaveElapsed,
    offlineBaselineTimestamp: runtime.offlineBaselineTimestamp,
    offlineBaselineServerTimestamp: runtime.offlineBaselineServerTimestamp,
    offlineReport,
    offlineDiagnostics: offlineDiagnosticsSnapshot(),
    lastTime: runtime.lastTime,
  };
}

function restoreOfflineTransaction(snapshot) {
  try {
    runtime.restoreRuntimeState(snapshot.state);
  } catch (restoreError) {
    // Recovery mode still prevents further writes when in-memory restoration fails.
  }
  runtime.normalAutobuyElapsed = snapshot.normalAutobuyElapsed;
  offlineReport = snapshot.offlineReport;
  offlineDiagnostics = snapshot.offlineDiagnostics
    ? {
      ...snapshot.offlineDiagnostics,
      eventCounts: { ...snapshot.offlineDiagnostics.eventCounts },
      eventFamilyCounts: { ...snapshot.offlineDiagnostics.eventFamilyCounts },
    }
    : null;
  setOfflineProcessing(false);
  try {
    runtime.setOfflineBaseline(
      runtime.localClockNowMs?.() ?? Date.now(),
      runtime.serverClockAvailable?.() ? runtime.serverClockNowMs?.() ?? 0 : 0,
    );
  } catch (baselineError) {
    runtime.offlineBaselineTimestamp = snapshot.offlineBaselineTimestamp;
    runtime.offlineBaselineServerTimestamp = snapshot.offlineBaselineServerTimestamp;
  }
  runtime.autoSaveElapsed = 0;
  runtime.lastTime = snapshot.lastTime;
  runtime.setSaveStatus(runtime.t("offlineProgressSkipped"));
  try {
    runtime.updateUi();
  } catch (updateError) {
    // Recovery must not turn a handled save failure into an unhandled resume error.
  }
}

function yieldToEventLoop() {
  if (typeof window.scheduler?.yield === "function") {
    try {
      return window.scheduler.yield();
    } catch (error) {
      // Fall through to the broadly supported task queues.
    }
  }
  if (typeof window.MessageChannel === "function") {
    try {
      const channel = new window.MessageChannel();
      const promise = new Promise((resolve) => {
        channel.port1.onmessage = () => {
          channel.port1.close();
          channel.port2.close();
          resolve();
        };
      });
      channel.port2.postMessage(0);
      return promise;
    } catch (error) {
      // Fall through to setTimeout when MessageChannel is unavailable.
    }
  }
  return new Promise((resolve) => {
    if (typeof window.setTimeout === "function") {
      window.setTimeout(resolve, 0);
      return;
    }
    if (typeof setTimeout === "function") {
      setTimeout(resolve, 0);
      return;
    }
    resolve();
  });
}


function refreshOfflineReportProgress(
  report,
  before,
  startedAt,
  updateUi = true,
  currentTime = runtime.monotonicClockNowMs(),
) {
  const current = offlineSnapshot();
  report.after = current;
  report.infinityCountAfter = current.infinityCount;
  report.infinityPointsAfterLog10 = current.infinityPointsLog10;
  report.infiniteScoreAfterLog10 = current.infiniteScoreLog10;
  const normalInfinityCountGainExact = exactSnapshotDifference(
    current,
    before,
    "infinityCountExact",
    "infinityCount",
  );
  report.normalInfinityCountGain = runtime.numberFromExactInteger(normalInfinityCountGainExact);
  report.normalInfinityCountGainExact = normalInfinityCountGainExact.toString();
  const aggregatedInfinityCountGainExact = runtime.parseExactInteger(
    report.aggregatedInfinityCountGainExact,
    runtime.parseExactInteger(report.aggregatedInfinityCountGain, 0n),
  );
  const totalInfinityCountGainExact = normalInfinityCountGainExact + aggregatedInfinityCountGainExact;
  report.totalInfinityCountGain = runtime.numberFromExactInteger(totalInfinityCountGainExact);
  report.totalInfinityCountGainExact = totalInfinityCountGainExact.toString();
  const processingElapsed = currentTime - startedAt;
  if (Number.isFinite(processingElapsed) && processingElapsed >= 0) {
    report.processingMilliseconds = processingElapsed;
  }
  if (!updateUi) return;
  try {
    runtime.updateOfflineReportUi?.();
  } catch (error) {
    // Progress rendering must not interrupt the transactional simulation.
  }
}

function processOfflineElapsed(elapsedSeconds, source = "resume", clockContext = {}) {
  if (offlineProcessPromise) return offlineProcessPromise;
  const promise = processOfflineElapsedInternal(elapsedSeconds, source, clockContext);
  offlineProcessPromise = promise.finally(() => {
    offlineProcessPromise = null;
  });
  return offlineProcessPromise;
}

async function processOfflineElapsedInternal(elapsedSeconds, source = "resume", clockContext = {}) {
  const transactionSnapshot = snapshotOfflineTransaction();
  try {
    const numericElapsed = runtime.sanitizeNumber(elapsedSeconds, NaN);
    const invalidElapsed = !Number.isFinite(numericElapsed);
    const elapsed = invalidElapsed ? 0 : Math.max(0, numericElapsed);
    const clockSource = clockContext.clockSource
      || (runtime.serverClockAvailable() ? "server" : "local-fallback");
    let clockAnomaly = Boolean(clockContext.clockAnomaly) || invalidElapsed;
    if (elapsed <= 0 && !clockAnomaly) return null;
    if (!runtime.state.offlineProgressEnabled) {
      offlineDiagnostics = null;
      offlineReport = null;
      runtime.setOfflineBaseline(
        runtime.localClockNowMs(),
        runtime.serverClockAvailable() ? runtime.serverClockNowMs() : 0,
      );
      runtime.updateUi();
      if (!runtime.saveGame("manual")) {
        if (runtime.saveConflictMode) {
          if (runtime.loadInFlight) return null;
          await runtime.handleSaveConflict();
          return null;
        }
        restoreOfflineTransaction(transactionSnapshot);
        return null;
      }
      runtime.lastTime = runtime.currentFrameTime();
      if (clockAnomaly) runtime.rebaseLocalClock();
      return {
        source,
        skipped: true,
        elapsedSeconds: elapsed,
        effectiveElapsedSeconds: 0,
        simulatedSeconds: 0,
        configuredTicks: 0,
        processedTicks: 0,
        requestedTicks: 0,
        processingMilliseconds: 0,
        precisionReduced: false,
        capped: false,
        offlineProgressEnabled: false,
        clockSource,
        clockAnomaly,
        rewardSuppressed: false,
      };
    }
    const before = offlineSnapshot();
    const aggregationEligible = offlineInfinityAggregationEnabled();
    const bestRateAtStart = runtime.state.bestInfinityCountPerSecond;
    const rateRemainderAtStart = runtime.state.infinityCountRateRemainder;
    const usesLocalRewardCap = clockSource !== "server";
    const trustedElapsed = clockAnomaly
      ? 0
      : usesLocalRewardCap
        ? Math.min(elapsed, runtime.OFFLINE_LOCAL_REWARD_MAX_SECONDS)
        : elapsed;
    let simulatedSeconds = 0;
    let configuredTicks = 0;
    let processedTicks = 0;
    let requestedTicks = 0;
    let processingMilliseconds = 0;
    let simulationIterations = 0;
    let bulkIterations = 0;
    let bulkProcessedTicks = 0;
    let aggregatedTicks = 0;
    let cyclesAggregated = 0;
    let cycleAggregatedCountExact = 0n;
    let precisionReduced = false;
    let eventBoundaryCount = 0;
    let eventBoundaryIterations = 0;
    let guardedFallbackIterations = 0;
    let predictionInvalidations = 0;
    let eventProbeIterations = 0;
    offlineDiagnostics = null;

    if (!clockAnomaly) {
      const tickCount = clampOfflineTickCount(runtime.state.offlineTickCount);
      configuredTicks = tickCount;
      simulatedSeconds = trustedElapsed;
      requestedTicks = Math.max(
        1,
        Math.min(tickCount, Math.ceil(simulatedSeconds / runtime.MAX_SIMULATION_STEP_SECONDS)),
      );
      precisionReduced = false;
      if (!offlineProgressNumericallySafe(simulatedSeconds)) {
        clockAnomaly = true;
        simulatedSeconds = 0;
        requestedTicks = 0;
        processedTicks = 0;
        precisionReduced = false;
        beginOfflineDiagnostics(0);
      } else {
        const tickSeconds = simulatedSeconds / requestedTicks;
        const startedAt = runtime.monotonicClockNowMs();
        const progressReport = offlineReport = {
          source,
          processing: true,
          before,
          after: before,
          elapsedSeconds: elapsed,
          effectiveElapsedSeconds: simulatedSeconds,
          simulatedSeconds,
          configuredTicks,
          processedTicks: 0,
          requestedTicks,
          processingMilliseconds: 0,
          simulationIterations: 0,
          bulkIterations: 0,
          bulkProcessedTicks: 0,
          precisionReduced,
          capped: simulatedSeconds + 1e-9 < elapsed,
          offlineProgressEnabled: runtime.state.offlineProgressEnabled,
          clockSource,
          clockAnomaly,
          rewardSuppressed: false,
          legacyTimestampUsed: Boolean(clockContext.legacyTimestampUsed),
          infinityCountBefore: before.infinityCount,
          infinityCountAfter: before.infinityCount,
          infinityPointsBeforeLog10: before.infinityPointsLog10,
          infinityPointsAfterLog10: before.infinityPointsLog10,
          infiniteScoreBeforeLog10: before.infiniteScoreLog10,
          infiniteScoreAfterLog10: before.infiniteScoreLog10,
          normalInfinityCountGain: 0,
          normalInfinityCountGainExact: "0",
          aggregatedInfinityCountGain: 0,
          aggregatedInfinityCountGainExact: "0",
          totalInfinityCountGain: 0,
          totalInfinityCountGainExact: "0",
        };
        beginOfflineDiagnostics(requestedTicks);
        beginOfflineWorkBudget(requestedTicks);
        setOfflineProcessing(true);
        runtime.setOfflineProcessingLock(true);
        const offlineFloatingTextSetting = runtime.state.showFloatingText;
        runtime.state.showFloatingText = false;
        try {
          let batchTicks = Math.min(requestedTicks, OFFLINE_PROCESS_INITIAL_BATCH_TICKS);
          let estimatedTicksPerMs = 0;
          let zeroClockTicksSinceYield = 0;
          let lastBatchFinishedAt = null;
          let budgetStartedAt = runtime.monotonicClockNowMs();
          let lastProgressUiAt = budgetStartedAt;
          let eventPathDisabled = false;
          let denseEventBoundaryStreak = 0;
          let denseEventFallbackTicks = 0;
          const noteEventStep = (eventStep) => {
            if (eventStep?.disableFamily) eventPathDisabled = true;
            if (eventStep?.denseEvent) {
              denseEventBoundaryStreak += 1;
              if (denseEventBoundaryStreak >= 3) {
                denseEventFallbackTicks = OFFLINE_EVENT_DENSE_FALLBACK_TICKS;
                denseEventBoundaryStreak = 0;
              }
            } else if (eventStep?.handled) {
              denseEventBoundaryStreak = 0;
            }
          };
          const initialEventStep = runOfflineEventBoundaryEngine({
            tickSeconds,
            remainingTicks: requestedTicks,
            batchTicks: Math.max(64, batchTicks),
            eventFamily: inspectOfflineEventFamily,
            eventBoundaryIterations,
            cyclePath: () => tryOfflineInfinityCyclePath(
              tickSeconds,
              requestedTicks,
              bestRateAtStart,
              rateRemainderAtStart,
            ),
          });
          noteEventStep(initialEventStep);
          processedTicks = initialEventStep.processedTicks || 0;
          simulationIterations += initialEventStep.simulationIterations || 0;
          eventBoundaryCount += initialEventStep.eventBoundaryCount || 0;
          eventBoundaryIterations += initialEventStep.eventBoundaryIterations || 0;
          guardedFallbackIterations += initialEventStep.guardedFallbackIterations || 0;
          predictionInvalidations += initialEventStep.predictionInvalidations || 0;
          eventProbeIterations += initialEventStep.eventProbeIterations || 0;
          bulkIterations += initialEventStep.bulkIterations || 0;
          bulkProcessedTicks += initialEventStep.bulkProcessedTicks || 0;
          aggregatedTicks += initialEventStep.aggregatedTicks || 0;
          cyclesAggregated += initialEventStep.cyclesAggregated || 0;
          cycleAggregatedCountExact += initialEventStep.aggregatedCountExact || 0n;
          offlineDiagnostics.processedTicks = processedTicks;
          offlineDiagnostics.simulationIterations = simulationIterations;
          offlineDiagnostics.fullSimulationIterations = simulationIterations + eventProbeIterations;
          offlineDiagnostics.eventBoundaryIterations = eventBoundaryIterations;
          offlineDiagnostics.guardedFallbackIterations = guardedFallbackIterations;
          offlineDiagnostics.predictionInvalidations = predictionInvalidations;
          offlineDiagnostics.eventProbeIterations = eventProbeIterations;
          offlineDiagnostics.bulkProcessedTicks = bulkProcessedTicks;
          offlineDiagnostics.bulkIterations = bulkIterations;
          offlineDiagnostics.aggregatedTicks = aggregatedTicks;
          offlineDiagnostics.cyclesAggregated = cyclesAggregated;
          offlineDiagnostics.cycleFallbackReason = initialEventStep.reason || "";
          offlineDiagnostics.eventBoundaryCount = eventBoundaryCount;
          while (processedTicks < requestedTicks) {
            const batchStartedAt = runtime.monotonicClockNowMs();
            const remainingTicks = requestedTicks - processedTicks;
            let eventStep = null;
            if (!eventPathDisabled && denseEventFallbackTicks <= 0) {
              eventStep = runOfflineEventBoundaryEngine({
                tickSeconds,
                remainingTicks,
                batchTicks: Math.max(64, batchTicks),
                eventFamily: inspectOfflineEventFamily,
                eventBoundaryIterations,
              });
              noteEventStep(eventStep);
            }
            const clockHasNotAdvanced = lastBatchFinishedAt !== null
              && batchStartedAt === lastBatchFinishedAt;
            const currentBatchTicks = eventStep?.handled
              ? eventStep.processedTicks
              : denseEventFallbackTicks > 0
                ? 1
              : Math.min(
                batchTicks,
                remainingTicks,
                offlineBulkTickLimit(tickSeconds, remainingTicks),
                clockHasNotAdvanced
                  ? Math.max(1, OFFLINE_PROCESS_ZERO_CLOCK_TICK_LIMIT - zeroClockTicksSinceYield)
                  : remainingTicks,
              );
            const batchEnd = processedTicks + currentBatchTicks;
            if (eventStep?.handled) {
              simulationIterations += eventStep.simulationIterations;
              eventProbeIterations += eventStep.eventProbeIterations;
              bulkIterations += eventStep.bulkIterations;
              bulkProcessedTicks += eventStep.bulkProcessedTicks;
              eventBoundaryCount += eventStep.eventBoundaryCount;
              eventBoundaryIterations += eventStep.eventBoundaryIterations || 0;
              predictionInvalidations += eventStep.predictionInvalidations || 0;
            } else {
              runtime.update(tickSeconds * currentBatchTicks, true);
              simulationIterations += 1;
              guardedFallbackIterations += 1;
              if (currentBatchTicks > 1) {
                bulkIterations += 1;
                bulkProcessedTicks += currentBatchTicks;
              } else {
                eventBoundaryCount += 1;
              }
            }
            if (!eventStep?.handled && denseEventFallbackTicks > 0) {
              denseEventFallbackTicks -= currentBatchTicks;
            }
            processedTicks = batchEnd;
            precisionReduced = Boolean(runtime.offlinePrecisionReduced);
            offlineDiagnostics.processedTicks = processedTicks;
            offlineDiagnostics.simulationIterations = simulationIterations;
            offlineDiagnostics.fullSimulationIterations = simulationIterations + eventProbeIterations;
            offlineDiagnostics.eventBoundaryIterations = eventBoundaryIterations;
            offlineDiagnostics.guardedFallbackIterations = guardedFallbackIterations;
            offlineDiagnostics.predictionInvalidations = predictionInvalidations;
            offlineDiagnostics.eventProbeIterations = eventProbeIterations;
            offlineDiagnostics.bulkProcessedTicks = bulkProcessedTicks;
            offlineDiagnostics.bulkIterations = bulkIterations;
            offlineDiagnostics.aggregatedTicks = aggregatedTicks;
            offlineDiagnostics.cyclesAggregated = cyclesAggregated;
            offlineDiagnostics.eventBoundaryCount = eventBoundaryCount;
            offlineDiagnostics.precisionReduced = precisionReduced;
            const batchFinishedAt = runtime.monotonicClockNowMs();
            const batchElapsed = batchFinishedAt - batchStartedAt;
            const validBatchElapsed = Number.isFinite(batchElapsed) && batchElapsed > 0;
            if (validBatchElapsed) {
              zeroClockTicksSinceYield = 0;
              const measuredTicksPerMs = currentBatchTicks / batchElapsed;
              if (Number.isFinite(measuredTicksPerMs) && measuredTicksPerMs > 0) {
                estimatedTicksPerMs = estimatedTicksPerMs > 0
                  ? estimatedTicksPerMs * 0.75 + measuredTicksPerMs * 0.25
                  : measuredTicksPerMs;
                const targetBatchTicks = Math.max(
                  1,
                  Math.round(estimatedTicksPerMs * OFFLINE_PROCESS_TARGET_BATCH_MS),
                );
                batchTicks = Math.max(
                  Math.ceil(batchTicks / 2),
                  Math.min(Math.floor(batchTicks * 2), targetBatchTicks),
                );
              }
            } else if (batchElapsed === 0) {
              zeroClockTicksSinceYield += currentBatchTicks;
              batchTicks = Math.max(
                1,
                Math.min(
                  requestedTicks - processedTicks,
                  batchTicks * 2,
                  Math.max(1, OFFLINE_PROCESS_ZERO_CLOCK_TICK_LIMIT - zeroClockTicksSinceYield),
                ),
              );
            } else {
              zeroClockTicksSinceYield = 0;
              batchTicks = Math.max(1, Math.floor(batchTicks / 2));
            }
            lastBatchFinishedAt = batchFinishedAt;
            progressReport.processedTicks = processedTicks;
            progressReport.simulationIterations = simulationIterations;
            progressReport.bulkIterations = bulkIterations;
            progressReport.bulkProcessedTicks = bulkProcessedTicks;
            progressReport.precisionReduced = precisionReduced;
            const progressElapsed = batchFinishedAt - lastProgressUiAt;
            const zeroClockFallback = zeroClockTicksSinceYield >= OFFLINE_PROCESS_ZERO_CLOCK_TICK_LIMIT;
            const shouldUpdateUi = processedTicks >= requestedTicks
              || (Number.isFinite(progressElapsed)
                && progressElapsed >= OFFLINE_PROCESS_PROGRESS_UPDATE_INTERVAL_MS)
              || zeroClockFallback;
            refreshOfflineReportProgress(
              progressReport,
              before,
              startedAt,
              shouldUpdateUi,
              batchFinishedAt,
            );
            if (shouldUpdateUi) lastProgressUiAt = batchFinishedAt;
            processingMilliseconds = progressReport.processingMilliseconds;
            const budgetElapsed = batchFinishedAt - budgetStartedAt;
            const shouldYield = !Number.isFinite(budgetElapsed)
              || budgetElapsed < 0
              || budgetElapsed >= OFFLINE_PROCESS_TIME_BUDGET_MS
              || zeroClockFallback;
            if (processedTicks < requestedTicks && shouldYield) {
              await yieldToEventLoop();
              budgetStartedAt = runtime.monotonicClockNowMs();
              zeroClockTicksSinceYield = 0;
            }
          }
          if (processingMilliseconds <= 0) {
            const elapsedProcessing = runtime.monotonicClockNowMs() - startedAt;
            if (Number.isFinite(elapsedProcessing) && elapsedProcessing >= 0) {
              processingMilliseconds = elapsedProcessing;
            }
          }
          progressReport.aggregatedTicks = aggregatedTicks;
          progressReport.cyclesAggregated = cyclesAggregated;
        } finally {
          runtime.state.showFloatingText = offlineFloatingTextSetting;
          runtime.setOfflineProcessingLock(false);
          setOfflineProcessing(false);
          simulationUiPending = false;
        }
      }
    }

    precisionReduced = !clockAnomaly && Boolean(runtime.offlinePrecisionReduced);
    if (offlineDiagnostics) {
      offlineDiagnostics.processedTicks = processedTicks;
      offlineDiagnostics.simulationIterations = simulationIterations;
      offlineDiagnostics.fullSimulationIterations = simulationIterations + eventProbeIterations;
      offlineDiagnostics.eventBoundaryIterations = eventBoundaryIterations;
      offlineDiagnostics.guardedFallbackIterations = guardedFallbackIterations;
      offlineDiagnostics.predictionInvalidations = predictionInvalidations;
      offlineDiagnostics.eventProbeIterations = eventProbeIterations;
      offlineDiagnostics.bulkProcessedTicks = bulkProcessedTicks;
      offlineDiagnostics.bulkIterations = bulkIterations;
      offlineDiagnostics.aggregatedTicks = aggregatedTicks;
      offlineDiagnostics.cyclesAggregated = cyclesAggregated;
      offlineDiagnostics.eventBoundaryCount = eventBoundaryCount;
      offlineDiagnostics.wallTimeMs = processingMilliseconds;
      offlineDiagnostics.precisionReduced = precisionReduced;
    }

    const normalAfter = offlineSnapshot();
    const totalObservedInfinityCountGainExact = exactSnapshotDifference(
      normalAfter,
      before,
      "infinityCountExact",
      "infinityCount",
    );
    const normalInfinityCountGainExact = cycleAggregatedCountExact > 0n
      ? totalObservedInfinityCountGainExact > cycleAggregatedCountExact
        ? totalObservedInfinityCountGainExact - cycleAggregatedCountExact
        : 0n
      : totalObservedInfinityCountGainExact;
    const normalInfinityCountGain = runtime.numberFromExactInteger(normalInfinityCountGainExact);
    const aggregation = !clockAnomaly && aggregationEligible && cyclesAggregated === 0
      ? applyOfflineInfinityAggregation(
        simulatedSeconds,
        normalInfinityCountGain,
        bestRateAtStart,
        rateRemainderAtStart,
      )
      : { added: 0, remainder: rateRemainderAtStart };
    const after = offlineSnapshot();
    const totalInfinityCountGainExact = exactSnapshotDifference(
      after,
      before,
      "infinityCountExact",
      "infinityCount",
    );
    const aggregatedInfinityCountGainExact = cycleAggregatedCountExact > 0n
      ? cycleAggregatedCountExact
      : totalInfinityCountGainExact > normalInfinityCountGainExact
      ? totalInfinityCountGainExact - normalInfinityCountGainExact
      : 0n;
    const effectiveElapsedSeconds = clockAnomaly
      ? 0
      : simulatedSeconds;
    offlineReport = {
      source,
      processing: false,
      before,
      after,
      elapsedSeconds: elapsed,
      effectiveElapsedSeconds,
      simulatedSeconds,
      configuredTicks,
      processedTicks,
      requestedTicks,
      processingMilliseconds,
      simulationIterations,
      bulkIterations,
      bulkProcessedTicks,
      precisionReduced,
      capped: effectiveElapsedSeconds + 1e-9 < elapsed,
      offlineProgressEnabled: runtime.state.offlineProgressEnabled,
      clockSource,
      clockAnomaly,
      rewardSuppressed: clockAnomaly,
      legacyTimestampUsed: Boolean(clockContext.legacyTimestampUsed),
      infinityCountBefore: before.infinityCount,
      infinityCountAfter: after.infinityCount,
      infinityPointsBeforeLog10: before.infinityPointsLog10,
      infinityPointsAfterLog10: after.infinityPointsLog10,
      infiniteScoreBeforeLog10: before.infiniteScoreLog10,
      infiniteScoreAfterLog10: after.infiniteScoreLog10,
      normalInfinityCountGain,
      normalInfinityCountGainExact: normalInfinityCountGainExact.toString(),
      aggregatedInfinityCountGain: runtime.numberFromExactInteger(aggregatedInfinityCountGainExact),
      aggregatedInfinityCountGainExact: aggregatedInfinityCountGainExact.toString(),
      totalInfinityCountGain: runtime.numberFromExactInteger(totalInfinityCountGainExact),
      totalInfinityCountGainExact: totalInfinityCountGainExact.toString(),
    };
    runtime.updateUi();
    if (!runtime.saveGame("manual")) {
      if (runtime.saveConflictMode) {
        if (runtime.loadInFlight) return null;
        await runtime.handleSaveConflict();
        return null;
      }
      restoreOfflineTransaction(transactionSnapshot);
      return null;
    }
    runtime.lastTime = runtime.currentFrameTime();
    if (clockAnomaly) runtime.rebaseLocalClock();
    return offlineReport;
  } catch {
    restoreOfflineTransaction(transactionSnapshot);
    return null;
  }
}

expose("offlineProcessing", () => offlineProcessing, setOfflineProcessing);
expose("offlineReport", () => offlineReport, (value) => { offlineReport = value; });
expose("beginOfflineWorkBudget", () => beginOfflineWorkBudget);
expose("offlineCoreHitPlan", () => offlineCoreHitPlan);
expose("offlineWorkStats", () => offlineWorkStatsSnapshot());
expose("offlinePrecisionReduced", () => Boolean(offlineWorkLedger?.precisionReduced));
expose("offlineDiagnostics", () => offlineDiagnosticsSnapshot());
expose("offlineSnapshot", () => offlineSnapshot);
expose("processOfflineElapsed", () => processOfflineElapsed, (value) => { processOfflineElapsed = value; });
expose("recordOfflineEvent", () => recordOfflineEvent);
expose("runSimulationBatch", () => runSimulationBatch);
expose("snapshotOfflineTransaction", () => snapshotOfflineTransaction);
expose("restoreOfflineTransaction", () => restoreOfflineTransaction);
expose("uiUpdateCount", () => uiUpdateCount);
