import { runtime, expose } from "./runtime/shared.js";
import "./ui/dom.js";
import "./core/constants.js";
import "./data/i18n.js";
import "./data/infinity-data.js";
import "./core/state.js";
import "./core/numbers.js";
import "./core/save.js";
import "./core/save-code.js";
import "./systems/achievements.js";
import "./systems/tower.js";
import "./ui/render-canvas.js";
import "./ui/render-topbar.js";
import "./ui/render-challenges.js";
import "./ui/render-infinity.js";
import "./ui/render-achievements.js";
import "./ui/render-automation.js";
import "./ui/render-offline-report.js";
import "./ui/render-ui.js";
import "./systems/angle.js";
import "./systems/generation.js";
import "./systems/core-boost.js";
import "./systems/infinity.js";
import "./systems/infinite-angle.js";
import "./ui/events.js";
import "./systems/balance.js";
import "./systems/eternity.js";

let autoSaveElapsed = 0;
let updateCheckElapsed = 0;
let updateCheckInFlight = false;
let japaneseFontReady = false;
let normalAutobuyElapsed = 0;
let uiUpdateElapsed = 0;
let activeMainTab = "angle";
let activeInfinitySubtab = "upgrades";
let activeChallengeSubtab = "ic";
let activeStatisticsSubtab = "overview";
let selectedInfinityUpgradeId = "1-1";
let appliedLanguage = "";
let smoothedFps = 0;
let renderQualityLevel = "high";
let renderQualityOverride = "";
let renderCostEma = 0;
let renderPressureFrames = 0;
let renderRecoveryFrames = 0;
let lastRenderedFrameAt = -Infinity;
let offlineBaselineTimestamp = Date.now();
let offlineBaselineServerTimestamp = 0;
let offlineProcessing = false;
let offlineReport = null;
let visibilityResumeInFlight = false;
let visibilityResumeGeneration = 0;
let saveConflictInFlight = null;
let simulationBatchDepth = 0;
let simulationUiPending = false;
let simulationSaveReason = "";
let uiUpdateCount = 0;
let simulationFlushActive = false;
let simulationFlushSavePerformed = false;
let serverClockAnchor = null;
let serverClockSyncInFlight = null;
let serverClockSource = "local-fallback";
let serverClockAnomaly = false;
let localClockAnomaly = false;
let localClockAnchor = null;
let offlineProcessPromise = null;
let offlineWorkLedger = null;
const OFFLINE_PROCESS_TIME_BUDGET_MS = 8;
const OFFLINE_PROCESS_INITIAL_BATCH_TICKS = 64;
const OFFLINE_PROCESS_TARGET_BATCH_MS = 2;
const OFFLINE_PROCESS_PROGRESS_UPDATE_INTERVAL_MS = 100;
const OFFLINE_PROCESS_ZERO_CLOCK_TICK_LIMIT = 4096;
const requestNextFrame = window.requestAnimationFrame
  ? window.requestAnimationFrame.bind(window)
  : (callback) => window.setTimeout(() => callback(currentFrameTime()), 1000 / 60);

const RENDER_QUALITY_PROFILES = Object.freeze({
  high: Object.freeze({ devicePixelRatio: 2, vertexLimit: 720, frameIntervalMs: 0 }),
  balanced: Object.freeze({ devicePixelRatio: 1.5, vertexLimit: 360, frameIntervalMs: 1000 / 30 }),
  low: Object.freeze({ devicePixelRatio: 1, vertexLimit: 180, frameIntervalMs: 1000 / 30 }),
});

const baseUpdateUi = runtime.updateUi;
const baseSaveGame = runtime.saveGame;

function simulationBatchActive() {
  return simulationBatchDepth > 0;
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
  const track = offlineWorkLedger.tracks[trackName];
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
  if (simulationBatchActive() || offlineProcessing) {
    simulationUiPending = true;
    return undefined;
  }
  uiUpdateCount += 1;
  const result = baseUpdateUi(...args);
  if (runtime.saveConflictMode) setSaveConflictLock(true);
  return result;
}

function batchedSaveGame(reason = "auto", options = {}) {
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

function monotonicClockNow() {
  const performanceApi = window.performance;
  return performanceApi && typeof performanceApi.now === "function" ? performanceApi.now() : Date.now();
}

function renderQualityProfile() {
  return RENDER_QUALITY_PROFILES[renderQualityOverride || renderQualityLevel] || RENDER_QUALITY_PROFILES.high;
}

function renderVertexLimit() {
  return renderQualityProfile().vertexLimit;
}

function renderDevicePixelRatio() {
  return Math.min(window.devicePixelRatio || 1, renderQualityProfile().devicePixelRatio);
}

function renderFrameIntervalMs() {
  return renderQualityProfile().frameIntervalMs;
}

function resetRenderQualityCounters() {
  renderCostEma = 0;
  renderPressureFrames = 0;
  renderRecoveryFrames = 0;
  lastRenderedFrameAt = -Infinity;
}

function setRenderQualityLevel(level) {
  if (!RENDER_QUALITY_PROFILES[level] || level === renderQualityLevel) return false;
  renderQualityLevel = level;
  resetRenderQualityCounters();
  if (runtime.resizeCanvas) runtime.resizeCanvas();
  if (runtime.resizeInfiniteAngleCanvas) runtime.resizeInfiniteAngleCanvas();
  return true;
}

function observedFrameBudgetMs() {
  return smoothedFps > 0 && Number.isFinite(smoothedFps) ? 1000 / smoothedFps : 1000 / 60;
}

function updateRenderQuality(renderCostMs, canvasRendered = true) {
  if (!canvasRendered || renderQualityOverride) return;
  const measuredCostMs = Number.isFinite(renderCostMs) ? Math.max(0, renderCostMs) : 0;
  renderCostEma = renderCostEma === 0
    ? measuredCostMs
    : renderCostEma * 0.9 + measuredCostMs * 0.1;
  const frameBudgetMs = Math.max(
    observedFrameBudgetMs(),
    renderFrameIntervalMs(),
  );
  const pressured = renderCostEma > frameBudgetMs;
  if (pressured) {
    renderPressureFrames += 1;
    renderRecoveryFrames = 0;
    if (renderPressureFrames >= 30) {
      if (renderQualityLevel === "high") setRenderQualityLevel("balanced");
      else if (renderQualityLevel === "balanced") setRenderQualityLevel("low");
    }
    return;
  }
  renderPressureFrames = 0;
  if (renderCostEma < frameBudgetMs * 0.75) {
    renderRecoveryFrames += 1;
    if (renderRecoveryFrames >= 120) {
      if (renderQualityLevel === "low") setRenderQualityLevel("balanced");
      else if (renderQualityLevel === "balanced") setRenderQualityLevel("high");
    }
  } else {
    renderRecoveryFrames = 0;
  }
}

function shouldRenderFrame(now) {
  const interval = renderFrameIntervalMs();
  if (interval <= 0 || now - lastRenderedFrameAt >= interval) {
    lastRenderedFrameAt = now;
    return true;
  }
  return false;
}

function renderQualityState() {
  const profile = renderQualityProfile();
  return {
    level: renderQualityOverride || renderQualityLevel,
    automaticLevel: renderQualityLevel,
    devicePixelRatio: profile.devicePixelRatio,
    vertexLimit: profile.vertexLimit,
    frameIntervalMs: profile.frameIntervalMs,
    renderCostEma,
  };
}

function setRenderQualityForTest(level) {
  if (level === "auto") {
    renderQualityOverride = "";
    renderQualityLevel = "high";
    resetRenderQualityCounters();
    if (runtime.resizeCanvas) runtime.resizeCanvas();
    if (runtime.resizeInfiniteAngleCanvas) runtime.resizeInfiniteAngleCanvas();
    return true;
  }
  if (!RENDER_QUALITY_PROFILES[level]) return false;
  renderQualityOverride = level;
  renderQualityLevel = level;
  resetRenderQualityCounters();
  if (runtime.resizeCanvas) runtime.resizeCanvas();
  if (runtime.resizeInfiniteAngleCanvas) runtime.resizeInfiniteAngleCanvas();
  return true;
}

function updateRenderQualityForTest(renderCostMs, fps, canvasRendered = true) {
  const previousFps = smoothedFps;
  if (Number.isFinite(fps)) smoothedFps = fps;
  updateRenderQuality(renderCostMs, canvasRendered);
  smoothedFps = previousFps;
  return renderQualityState();
}

function localClockNow() {
  return Date.now();
}

function finitePositiveNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function localClockAnomalyDetected() {
  if (!localClockAnchor) {
    localClockAnchor = { localMs: localClockNow(), monotonicMs: monotonicClockNow() };
    return false;
  }
  const currentLocalMs = localClockNow();
  const currentMonotonicMs = monotonicClockNow();
  const expectedLocalMs = localClockAnchor.localMs + Math.max(0, currentMonotonicMs - localClockAnchor.monotonicMs);
  if (Math.abs(currentLocalMs - expectedLocalMs) > runtime.SERVER_CLOCK_BACKWARD_TOLERANCE_SECONDS * 1000) {
    localClockAnomaly = true;
  }
  return localClockAnomaly;
}

function rebaseLocalClock() {
  localClockAnchor = { localMs: localClockNow(), monotonicMs: monotonicClockNow() };
  localClockAnomaly = false;
}

function estimatedServerNowMs() {
  if (!serverClockAnchor) return 0;
  return serverClockAnchor.serverMs + Math.max(0, monotonicClockNow() - serverClockAnchor.monotonicMs);
}

function serverClockAvailable() {
  return serverClockSource === "server" && Boolean(serverClockAnchor) && !serverClockAnomaly;
}

function trustedClockNowMs() {
  return serverClockAvailable() ? estimatedServerNowMs() : localClockNow();
}

async function syncServerClock() {
  if (serverClockSyncInFlight) return serverClockSyncInFlight;
  serverClockSyncInFlight = (async () => {
    if (!window.fetch) {
      serverClockSource = "local-fallback";
      return { available: false, anomaly: false, source: serverClockSource };
    }

    const startedAt = monotonicClockNow();
    const abortController = typeof window.AbortController === "function" ? new window.AbortController() : null;
    const timeoutId = abortController && typeof window.setTimeout === "function"
      ? window.setTimeout(() => abortController.abort(), runtime.SERVER_CLOCK_SYNC_TIMEOUT_MS)
      : null;
    try {
      const response = await window.fetch(`${runtime.VERSION_MANIFEST_URL}?clock=${Math.floor(localClockNow())}`, {
        cache: "no-store",
        ...(abortController ? { signal: abortController.signal } : {}),
      });
      const finishedAt = monotonicClockNow();
      if (!response.ok) throw new Error("server clock response failed");
      // The response header is an external value; accept it only after strict date parsing.
      const serverDateMs = Date.parse(response.headers?.get("date") || "");
      if (!Number.isFinite(serverDateMs)) throw new Error("server clock header missing");

      const estimatedAtResponse = serverDateMs + Math.max(0, finishedAt - startedAt) / 2;
      const previousEstimate = estimatedServerNowMs();
      if (
        serverClockAnchor
        && estimatedAtResponse < previousEstimate - runtime.SERVER_CLOCK_BACKWARD_TOLERANCE_SECONDS * 1000
      ) {
        serverClockAnomaly = true;
        serverClockSource = "server";
        return { available: false, anomaly: true, source: serverClockSource };
      }

      serverClockAnchor = { serverMs: estimatedAtResponse, monotonicMs: finishedAt };
      serverClockSource = "server";
      serverClockAnomaly = false;
      return { available: true, anomaly: false, source: serverClockSource };
    } catch (error) {
      if (!serverClockAnomaly) serverClockSource = "local-fallback";
      return { available: false, anomaly: serverClockAnomaly, source: serverClockSource };
    } finally {
      if (timeoutId !== null && typeof window.clearTimeout === "function") window.clearTimeout(timeoutId);
    }
  })();

  try {
    return await serverClockSyncInFlight;
  } finally {
    serverClockSyncInFlight = null;
  }
}

function offlineElapsedFromSave(savedAt, serverSavedAt) {
  const localSavedAt = finitePositiveNumber(savedAt);
  const recordedServerAt = finitePositiveNumber(serverSavedAt);
  const currentLocalAt = localClockNow();
  const localAnomalyDetected = localClockAnomalyDetected()
    || (localSavedAt > 0 && currentLocalAt < localSavedAt - runtime.SERVER_CLOCK_BACKWARD_TOLERANCE_SECONDS * 1000);

  if (serverClockAnomaly || (localAnomalyDetected && !serverClockAvailable())) {
    return {
      elapsedSeconds: 0,
      clockSource: serverClockAnomaly ? "server" : serverClockSource,
      clockAnomaly: true,
      legacyTimestampUsed: false,
    };
  }

  if (serverClockAvailable() && recordedServerAt > 0) {
    const currentServerAt = estimatedServerNowMs();
    const elapsedMilliseconds = currentServerAt - recordedServerAt;
    if (!Number.isFinite(currentServerAt)
      || !Number.isFinite(elapsedMilliseconds)
      || elapsedMilliseconds < -runtime.SERVER_CLOCK_BACKWARD_TOLERANCE_SECONDS * 1000) {
      return {
        elapsedSeconds: 0,
        clockSource: "server",
        clockAnomaly: true,
        legacyTimestampUsed: false,
      };
    }
    return {
      elapsedSeconds: Math.max(0, elapsedMilliseconds / 1000),
      clockSource: "server",
      clockAnomaly: false,
      legacyTimestampUsed: false,
    };
  }

  if (localSavedAt <= 0) {
    return {
      elapsedSeconds: 0,
      clockSource: serverClockAvailable() ? "server" : "local-fallback",
      clockAnomaly: false,
      legacyTimestampUsed: false,
    };
  }

  const elapsedMilliseconds = currentLocalAt - localSavedAt;
  if (!Number.isFinite(currentLocalAt) || !Number.isFinite(elapsedMilliseconds)) {
    return {
      elapsedSeconds: 0,
      clockSource: serverClockAvailable() ? "legacy-local" : "local-fallback",
      clockAnomaly: true,
      legacyTimestampUsed: serverClockAvailable(),
    };
  }

  return {
    elapsedSeconds: Math.max(0, elapsedMilliseconds / 1000),
    clockSource: serverClockAvailable() ? "legacy-local" : "local-fallback",
    clockAnomaly: false,
    legacyTimestampUsed: serverClockAvailable(),
  };
}

function shouldShowUpdateModal() {
  try {
    return localStorage.getItem(runtime.UPDATE_SEEN_KEY) !== runtime.APP_VERSION;
  } catch (error) {
    return false;
  }
}

function closeUpdateModal() {
  if (!runtime.elements.updateModal) return;
  runtime.elements.updateModal.hidden = true;
  try {
    localStorage.setItem(runtime.UPDATE_SEEN_KEY, runtime.APP_VERSION);
  } catch (error) {
    // Non-critical: private browsing or blocked storage should not affect gameplay.
  }
}

function showUpdateModalIfNeeded() {
  if (!runtime.elements.updateModal || !shouldShowUpdateModal()) return;
  runtime.elements.updateModal.hidden = false;
  if (runtime.elements.updateModalClose) runtime.elements.updateModalClose.focus();
}

function storedUpdateReloadTime() {
  try {
    return runtime.sanitizeNumber(localStorage.getItem(runtime.UPDATE_RELOAD_TIME_KEY), 0);
  } catch (error) {
    return 0;
  }
}

function markUpdateDeferred(targetVersion) {
  try {
    localStorage.setItem(runtime.UPDATE_DEFERRED_TARGET_KEY, targetVersion);
  } catch (error) {
    // Non-critical: the visible save status still tells the player what to do.
  }
  runtime.setSaveStatus(runtime.t("updateReloadDeferred"));
}

function reloadForRemoteUpdate(targetVersion) {
  const now = Date.now();
  if (runtime.createCheckpoint && !runtime.createCheckpoint("pre-update", { force: true })) {
    markUpdateDeferred(targetVersion);
    return;
  }
  try {
    const previousTarget = localStorage.getItem(runtime.UPDATE_RELOAD_TARGET_KEY);
    const previousTime = storedUpdateReloadTime();
    if (previousTarget === targetVersion) {
      markUpdateDeferred(targetVersion);
      return;
    }
    if (previousTime > 0 && now - previousTime < runtime.UPDATE_RETRY_COOLDOWN_MS) {
      markUpdateDeferred(targetVersion);
      return;
    }
    localStorage.setItem(runtime.UPDATE_RELOAD_TARGET_KEY, targetVersion);
    localStorage.setItem(runtime.UPDATE_RELOAD_TIME_KEY, String(now));
    localStorage.removeItem(runtime.UPDATE_DEFERRED_TARGET_KEY);
  } catch (error) {
    markUpdateDeferred(targetVersion);
    return;
  }

  runtime.saveGame("manual");
  const url = new URL(window.location.href);
  url.searchParams.set("v", targetVersion);
  window.location.replace(url.toString());
}

async function checkForRemoteUpdate() {
  if (updateCheckInFlight || !window.fetch) return;
  updateCheckInFlight = true;
  try {
    const response = await fetch(`${runtime.VERSION_MANIFEST_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return;
    const manifest = await response.json();
    if (!manifest || typeof manifest.appVersion !== "string") return;
    if (manifest.appVersion && manifest.appVersion !== runtime.APP_VERSION) {
      reloadForRemoteUpdate(manifest.appVersion);
    }
  } catch (error) {
    // Update checks should never interrupt gameplay.
  } finally {
    updateCheckInFlight = false;
  }
}

function runAutobuyers() {
  if (!runtime.normalAutomationUnlocked?.() || !runtime.state.automationEnabled) return;
  runtime.buyAllUpgrades({
    refresh: false,
    save: false,
    allowSpeed: runtime.state.autoBuySpeed,
    allowVertex: runtime.state.autoBuyVertex,
    allowGain: runtime.state.autoBuyGain,
  });
}

function shouldAutoRunGeneration() {
  if (!runtime.canRunGeneration()) return false;

  const currentScoreLog = runtime.generationScoreMultiplierEffectLog10();
  const currentCostFactor = runtime.generationCostFactorEffect();
  const next = runtime.nextGenerationValues();
  const checks = [];
  const scoreThreshold = Math.max(0, runtime.state.autoGenerationScoreMultiplierThreshold);
  const costThreshold = Math.max(0, runtime.state.autoGenerationCostMultiplierThreshold);
  const secondsThreshold = Math.max(0, runtime.state.autoGenerationMinimumSeconds);

  if (scoreThreshold > 0) {
    checks.push(next.scoreMultiplierLog10 - currentScoreLog >= runtime.log10Value(scoreThreshold));
  }
  if (costThreshold > 0) {
    checks.push(currentCostFactor > 0 && next.costFactor > 0 && currentCostFactor / next.costFactor >= costThreshold);
  }
  if (secondsThreshold > 0) {
    checks.push(runtime.state.currentGenerationRunTime >= secondsThreshold);
  }

  if (checks.length === 0) return true;
  return runtime.state.autoGenerationLegacyOrMode
    ? checks.some(Boolean)
    : checks.every(Boolean);
}

function runLayerAutomation() {
  if (!runtime.state.automationEnabled) return false;
  const infinityAutomationUnlocked = runtime.infinityAutomationUnlocked?.() || false;
  const generationCoreAutomationUnlocked = runtime.isAchievementUnlocked(19);

  if (
    infinityAutomationUnlocked
    && runtime.state.autoRunInfinity
    && runtime.state.infinityCount > 0
    && runtime.canInfinity()
    && (runtime.state.activeTowerChallenge <= 0 || runtime.towerChallengeCanComplete())
    && runtime.infinityPointGainLog10() >= Math.max(
      0,
      runtime.sanitizeLog10(
        runtime.state.autoInfinityPointThresholdLog10,
        runtime.log10Value(Math.max(1, runtime.state.autoInfinityPointThreshold)),
      ),
    )
  ) {
    runtime.runInfinity(false);
    return true;
  }

  if (generationCoreAutomationUnlocked && runtime.state.autoRunCoreBoost && runtime.canCoreBoost()) {
    runtime.runCoreBoost();
    return true;
  }

  if (generationCoreAutomationUnlocked && runtime.state.autoRunGeneration && shouldAutoRunGeneration()) {
    runtime.runGeneration();
    return true;
  }

  if (runEternityMilestoneEightAutomation()) return true;
  return false;
}

function runEternityMilestoneEightAutomation() {
  if (runtime.eternityMilestoneActive?.("8") !== true || !runtime.state.automationEnabled) return false;
  let changed = false;
  if (runtime.state.autoBuildTower && runtime.buildTower({ refresh: false, save: false })) changed = true;
  const purchases = runtime.buyAllInfiniteAngleUpgrades({
    refresh: false,
    save: false,
    allowSpeed: runtime.state.autoBuyInfiniteAngleSpeed,
    allowVertex: runtime.state.autoBuyInfiniteAngleVertex,
    allowGain: runtime.state.autoBuyInfiniteAngleGain,
  });
  return changed || purchases > 0;
}

function update(dt, allowOffline = false) {
  if (runtime.saveConflictMode && !(allowOffline && runtime.loadInFlight)) return;
  if (offlineProcessing && !allowOffline) return;
  runtime.state.totalPlayTime += dt;
  runtime.state.currentInfinityRunTime += dt;
  runtime.state.currentGenerationRunTime += dt;
  runtime.updateChallengeTimers(dt);
  runtime.updateInfiniteAngle(dt);

  if (runtime.normalAutomationUnlocked?.() && runtime.state.automationEnabled) {
    normalAutobuyElapsed += dt;
    if (normalAutobuyElapsed >= runtime.AUTOBUY_INTERVAL_SECONDS) {
      normalAutobuyElapsed %= runtime.AUTOBUY_INTERVAL_SECONDS;
      runAutobuyers();
    }
  } else {
    normalAutobuyElapsed = 0;
  }

  const previousAbsolute = runtime.state.totalVertexProgress;
  const vertices = runtime.effectiveVertexCount();
  runtime.state.totalVertexProgress += (dt / runtime.lapDuration()) * vertices;
  const nearestVertex = Math.round(runtime.state.totalVertexProgress);
  if (Math.abs(runtime.state.totalVertexProgress - nearestVertex) < runtime.VERTEX_EPSILON) {
    runtime.state.totalVertexProgress = nearestVertex;
  }
  runtime.state.pointProgress = (runtime.state.totalVertexProgress / vertices) % 1;

  const start = Math.floor(previousAbsolute + runtime.VERTEX_EPSILON) + 1;
  const end = Math.floor(runtime.state.totalVertexProgress + runtime.VERTEX_EPSILON);
  const vertexSteps = end - start + 1;
  const estimatedCoreHits = vertexSteps > 0
    ? Math.ceil(vertexSteps / Math.max(3, vertices)) * runtime.coreVertexIndices().length
    : 0;
  const useOfflineApproximation = offlineProcessing
    && dt > runtime.OFFLINE_PROGRESS_APPROXIMATION_THRESHOLD_SECONDS_PER_TICK;
  if (offlineProcessing
    || useOfflineApproximation
    || vertexSteps > runtime.MAX_VERTEX_STEPS_PER_FRAME
    || estimatedCoreHits > runtime.MAX_CORE_HITS_PER_FRAME) {
    if (runtime.processManyVertices(start, end)) return;
  } else {
    for (let vertex = start; vertex <= end; vertex += 1) {
      if (runtime.passVertex(vertex % vertices)) return;
    }
  }
  if (runtime.completeTowerChallengeIfReady()) return;
  if (runtime.completeChallengeIfReady()) return;
  if (runLayerAutomation()) return;

  runtime.normalizeVertexProgress();
  runtime.state.lastVertexIndex = Math.floor(runtime.state.pointProgress * vertices) % vertices;
  if (!offlineProcessing) {
    runtime.state.floatingTexts = runtime.state.floatingTexts
      .map((item) => ({ ...item, life: item.life - dt, y: item.y - dt * 26 }))
      .filter((item) => item.life > 0);
  }
}

function runRealTimeMaintenance(realSeconds) {
  if (offlineProcessing || runtime.saveConflictMode || realSeconds <= 0) return;
  if (runtime.loadRecoveryMode) {
    autoSaveElapsed = 0;
  } else {
    autoSaveElapsed += realSeconds;
    if (autoSaveElapsed >= 5) runtime.saveGame("auto");
  }

  updateCheckElapsed += realSeconds;
  if (updateCheckElapsed >= runtime.UPDATE_CHECK_INTERVAL_SECONDS) {
    updateCheckElapsed %= runtime.UPDATE_CHECK_INTERVAL_SECONDS;
    syncServerClock();
    checkForRemoteUpdate();
  }
}

function advanceOnlineTime(realSeconds) {
  if (offlineProcessing || runtime.saveConflictMode) return 0;
  const realDt = Math.max(0, runtime.sanitizeNumber(realSeconds, 0));
  if (realDt <= 0) return 0;
  runtime.state.totalRealPlayTime += realDt;
  runtime.state.currentInfinityRealTime += realDt;
  const gameSeconds = realDt;

  runSimulationBatch(() => {
    let remaining = gameSeconds;
    while (remaining > 0) {
      const step = Math.min(runtime.MAX_SIMULATION_STEP_SECONDS, remaining);
      update(step);
      remaining -= step;
    }
    runRealTimeMaintenance(realDt);
  });
  return gameSeconds;
}

function offlineSnapshot() {
  return {
    infinityCount: runtime.state.infinityCount,
    infinityPointsLog10: runtime.currentInfinityPointsLog10(),
    infiniteScoreLog10: runtime.currentInfiniteScoreLog10(),
    timeFlux: runtime.state.timeFlux,
    totalPlayTime: runtime.state.totalPlayTime,
  };
}

function offlineInfinityAggregationEnabled() {
  return runtime.state.automationEnabled
    && runtime.state.autoRunInfinity
    && runtime.state.autoInfinityPointThresholdLog10 === 0
    && runtime.state.infinityCount > 0
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

function offlineProgressNumericallySafe(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return false;
  if (!Number.isFinite(runtime.state.totalPlayTime + seconds)) return false;
  if (!Number.isFinite(runtime.state.currentInfinityRunTime + seconds)) return false;
  if (!Number.isFinite(runtime.state.currentGenerationRunTime + seconds)) return false;

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
    normalAutobuyElapsed,
    autoSaveElapsed,
    offlineBaselineTimestamp,
    offlineBaselineServerTimestamp,
    offlineReport,
    lastTime,
  };
}

function restoreOfflineTransaction(snapshot, error, retryBaseline) {
  try {
    runtime.restoreRuntimeState(snapshot.state);
  } catch (restoreError) {
    // Recovery mode still prevents further writes when in-memory restoration fails.
  }
  normalAutobuyElapsed = snapshot.normalAutobuyElapsed;
  offlineReport = snapshot.offlineReport;
  setOfflineProcessing(false);
  try {
    setOfflineBaseline(retryBaseline.savedAt, retryBaseline.serverSavedAt);
  } catch (baselineError) {
    offlineBaselineTimestamp = snapshot.offlineBaselineTimestamp;
    offlineBaselineServerTimestamp = snapshot.offlineBaselineServerTimestamp;
  }
  autoSaveElapsed = 0;
  lastTime = snapshot.lastTime;
  try {
    runtime.enterLoadRecovery("offline", error, null, retryBaseline);
  } catch (recoveryError) {
    // The save module sets recovery mode before reporting the diagnostic.
  }
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

function setOfflineProcessingLock(locked) {
  if (!document.querySelectorAll) return;
  document.querySelectorAll("button, input, select, textarea").forEach((control) => {
    if (!control.dataset) return;
    if (locked) {
      if (control.disabled) return;
      control.dataset.offlineProcessingLocked = "true";
      control.disabled = true;
    } else if (control.dataset.offlineProcessingLocked === "true") {
      control.disabled = false;
      delete control.dataset.offlineProcessingLocked;
    }
  });
}

function setSaveConflictLock(locked) {
  if (!document.querySelectorAll) return;
  document.querySelectorAll("button, input, select, textarea").forEach((control) => {
    if (!control.dataset) return;
    const recoveryControl = control.closest?.(".save-recovery")
      || ["exportSaveCodeButton", "copySaveCodeButton", "saveCodeArea", "resetSaveButton"].includes(control.id);
    const navigationControl = [
      "main-tab",
      "infinity-subtab",
      "challenge-subtab",
      "statistics-subtab",
    ].some((className) => control.classList?.contains(className));
    if (recoveryControl || navigationControl) return;
    if (locked) {
      if (control.disabled) return;
      control.dataset.saveConflictLocked = "true";
      control.disabled = true;
    } else if (control.dataset.saveConflictLocked === "true") {
      control.disabled = false;
      delete control.dataset.saveConflictLocked;
    }
  });
}

function refreshOfflineReportProgress(
  report,
  before,
  startedAt,
  updateUi = true,
  currentTime = monotonicClockNow(),
) {
  const current = offlineSnapshot();
  report.infinityCountAfter = current.infinityCount;
  report.infinityPointsAfterLog10 = current.infinityPointsLog10;
  report.infiniteScoreAfterLog10 = current.infiniteScoreLog10;
  report.normalInfinityCountGain = Math.max(0, current.infinityCount - before.infinityCount);
  report.totalInfinityCountGain = report.normalInfinityCountGain + report.aggregatedInfinityCountGain;
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
  let retryBaseline = {
    savedAt: transactionSnapshot.offlineBaselineTimestamp,
    serverSavedAt: transactionSnapshot.offlineBaselineServerTimestamp,
    saveFingerprint: "",
  };
  try {
    const numericElapsed = runtime.sanitizeNumber(elapsedSeconds, NaN);
    const invalidElapsed = !Number.isFinite(numericElapsed);
    const elapsed = invalidElapsed ? 0 : Math.max(0, numericElapsed);
    const clockSource = clockContext.clockSource
      || (serverClockAvailable() ? "server" : "local-fallback");
    let clockAnomaly = Boolean(clockContext.clockAnomaly) || invalidElapsed;
    if (elapsed <= 0 && !clockAnomaly) return null;
    retryBaseline = {
      savedAt: clockContext.retryBaseline?.savedAt ?? transactionSnapshot.offlineBaselineTimestamp,
      serverSavedAt: clockContext.retryBaseline?.serverSavedAt ?? transactionSnapshot.offlineBaselineServerTimestamp,
      saveFingerprint: clockContext.retryBaseline
        ? typeof clockContext.retryBaseline.saveFingerprint === "string"
          ? clockContext.retryBaseline.saveFingerprint
          : ""
        : runtime.currentSaveFingerprint?.() || "",
    };
    if (!runtime.state.offlineProgressEnabled) {
      offlineReport = null;
      setOfflineBaseline(
        localClockNow(),
        serverClockAvailable() ? estimatedServerNowMs() : 0,
      );
      runtime.updateUi();
      if (!runtime.saveGame("manual")) {
        if (runtime.saveConflictMode) {
          if (runtime.loadInFlight) return null;
          await handleSaveConflict();
          return null;
        }
        restoreOfflineTransaction(
          transactionSnapshot,
          new Error("offline progress baseline save failed"),
          retryBaseline,
        );
        return null;
      }
      lastTime = currentFrameTime();
      if (clockAnomaly) rebaseLocalClock();
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
    let precisionReduced = false;

    if (!clockAnomaly) {
      const tickCount = runtime.clampOfflineTickCount(runtime.state.offlineTickCount);
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
      } else {
        const tickSeconds = simulatedSeconds / requestedTicks;
        const startedAt = monotonicClockNow();
        const progressReport = offlineReport = {
          source,
          elapsedSeconds: elapsed,
          effectiveElapsedSeconds: simulatedSeconds,
          simulatedSeconds,
          configuredTicks,
          processedTicks: 0,
          requestedTicks,
          processingMilliseconds: 0,
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
          aggregatedInfinityCountGain: 0,
          totalInfinityCountGain: 0,
        };
        beginOfflineWorkBudget(requestedTicks);
        setOfflineProcessing(true);
        setOfflineProcessingLock(true);
        const offlineFloatingTextSetting = runtime.state.showFloatingText;
        runtime.state.showFloatingText = false;
        try {
          let batchTicks = Math.min(requestedTicks, OFFLINE_PROCESS_INITIAL_BATCH_TICKS);
          let estimatedTicksPerMs = 0;
          let zeroClockTicksSinceYield = 0;
          let lastBatchFinishedAt = null;
          let budgetStartedAt = monotonicClockNow();
          let lastProgressUiAt = budgetStartedAt;
          while (processedTicks < requestedTicks) {
            const batchStartedAt = monotonicClockNow();
            const remainingTicks = requestedTicks - processedTicks;
            const clockHasNotAdvanced = lastBatchFinishedAt !== null
              && batchStartedAt === lastBatchFinishedAt;
            const currentBatchTicks = Math.min(
              batchTicks,
              remainingTicks,
              clockHasNotAdvanced
                ? Math.max(1, OFFLINE_PROCESS_ZERO_CLOCK_TICK_LIMIT - zeroClockTicksSinceYield)
                : remainingTicks,
            );
            const batchEnd = processedTicks + currentBatchTicks;
            while (processedTicks < batchEnd) {
              update(tickSeconds, true);
              processedTicks += 1;
            }
            precisionReduced = Boolean(runtime.offlinePrecisionReduced);
            const batchFinishedAt = monotonicClockNow();
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
              budgetStartedAt = monotonicClockNow();
              zeroClockTicksSinceYield = 0;
            }
          }
        } finally {
          runtime.state.showFloatingText = offlineFloatingTextSetting;
          setOfflineProcessingLock(false);
          setOfflineProcessing(false);
          simulationUiPending = false;
        }
      }
    }

    precisionReduced = !clockAnomaly && Boolean(runtime.offlinePrecisionReduced);

    const normalAfter = offlineSnapshot();
    const normalInfinityCountGain = Math.max(0, normalAfter.infinityCount - before.infinityCount);
    const aggregation = !clockAnomaly && aggregationEligible
      ? applyOfflineInfinityAggregation(
        simulatedSeconds,
        normalInfinityCountGain,
        bestRateAtStart,
        rateRemainderAtStart,
      )
      : { added: 0, remainder: rateRemainderAtStart };
    const after = offlineSnapshot();
    const effectiveElapsedSeconds = clockAnomaly
      ? 0
      : simulatedSeconds;
    offlineReport = {
      source,
      elapsedSeconds: elapsed,
      effectiveElapsedSeconds,
      simulatedSeconds,
      configuredTicks,
      processedTicks,
      requestedTicks,
      processingMilliseconds,
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
      aggregatedInfinityCountGain: aggregation.added,
      totalInfinityCountGain: Math.max(0, after.infinityCount - before.infinityCount),
    };
    runtime.updateUi();
    if (!runtime.saveGame("manual")) {
      if (runtime.saveConflictMode) {
        if (runtime.loadInFlight) return null;
        await handleSaveConflict();
        return null;
      }
      restoreOfflineTransaction(
        transactionSnapshot,
        new Error("offline progress save failed"),
        retryBaseline,
      );
      return null;
    }
    lastTime = currentFrameTime();
    if (clockAnomaly) rebaseLocalClock();
    return offlineReport;
  } catch (error) {
    restoreOfflineTransaction(transactionSnapshot, error, retryBaseline);
    return null;
  }
}

function setOfflineBaseline(timestamp = localClockNow(), serverTimestamp = 0) {
  const localValue = runtime.sanitizeNumber(timestamp, localClockNow());
  const serverValue = runtime.sanitizeNumber(serverTimestamp, 0);
  offlineBaselineTimestamp = Number.isFinite(localValue) ? localValue : localClockNow();
  offlineBaselineServerTimestamp = Number.isFinite(serverValue) && serverValue > 0 ? serverValue : 0;
}

function invalidateVisibilityResume() {
  visibilityResumeGeneration += 1;
}

function saveSourceIsCurrent() {
  return runtime.saveSourceIsCurrent ? runtime.saveSourceIsCurrent() : true;
}

async function reloadAfterSaveConflict() {
  offlineReport = null;
  if (!await runtime.loadGame({
    allowDuringLoadRecovery: true,
    allowDuringSaveConflict: true,
    authoritativeSaveConflict: true,
  })) return false;
  runtime.updateUi();
  drawActiveView();
  return true;
}

async function handleSaveConflict() {
  if (saveConflictInFlight) return saveConflictInFlight;
  if (offlineProcessing || runtime.loadInFlight) return false;
  if (!runtime.saveConflictMode || !runtime.saveConflictCheckpointReady) {
    if (!runtime.beginSaveConflict()) return false;
  }
  saveConflictInFlight = (async () => {
    const reloaded = await reloadAfterSaveConflict();
    if (!reloaded) {
      runtime.updateUi();
      drawActiveView();
      return false;
    }
    runtime.finishSaveConflict();
    runtime.updateUi();
    drawActiveView();
    return true;
  })().catch(() => {
    runtime.setSaveStatus(runtime.t("loadFailed"));
    runtime.updateUi();
    return false;
  }).finally(() => {
    saveConflictInFlight = null;
  });
  return saveConflictInFlight;
}

function handleStorageChange(event) {
  if ((event?.key !== null && event?.key !== runtime.SAVE_KEY) || offlineProcessing || visibilityResumeInFlight) return;
  if (saveSourceIsCurrent() && !runtime.saveConflictMode) return;
  return handleSaveConflict();
}

async function handleVisibilityChange() {
  if (offlineProcessing) return;
  if (runtime.saveConflictMode) {
    if (!document.hidden) await handleSaveConflict();
    return;
  }
  if (document.hidden) {
    const transactionSnapshot = snapshotOfflineTransaction();
    const retryBaseline = {
      savedAt: offlineBaselineTimestamp,
      serverSavedAt: offlineBaselineServerTimestamp,
      saveFingerprint: runtime.lastKnownSaveFingerprint || "",
    };
    try {
      if (!saveSourceIsCurrent()) {
        await handleSaveConflict();
        return;
      }
      const saved = runtime.saveGame("auto");
      if (!saved) {
        if (runtime.saveConflictMode) {
          await handleSaveConflict();
          return;
        }
        restoreOfflineTransaction(
          transactionSnapshot,
          new Error("visibility hide save failed"),
          retryBaseline,
        );
      }
    } catch (error) {
      restoreOfflineTransaction(transactionSnapshot, error, retryBaseline);
    }
    return;
  }
  if (visibilityResumeInFlight) return;
  if (runtime.loadRecoveryMode) return;
  visibilityResumeInFlight = true;
  const transactionSnapshot = snapshotOfflineTransaction();
  // Saving while the clock request is pending may rebase the shared baseline.
  // Keep the interval that this resume began with so it cannot be discarded.
  const resumeBaselineTimestamp = offlineBaselineTimestamp;
  const resumeBaselineServerTimestamp = offlineBaselineServerTimestamp;
  const resumeBaselineSaveFingerprint = runtime.lastKnownSaveFingerprint || "";
  const resumeBaselineSaveRevision = runtime.saveRevision;
  const resumeGeneration = visibilityResumeGeneration;
  const retryBaseline = {
    savedAt: resumeBaselineTimestamp,
    serverSavedAt: resumeBaselineServerTimestamp,
    saveFingerprint: resumeBaselineSaveFingerprint,
  };
  try {
    if (!saveSourceIsCurrent()) {
      await handleSaveConflict();
      return;
    }
    if (!runtime.state.offlineProgressEnabled) {
      offlineReport = null;
      rebaseLocalClock();
      setOfflineBaseline(
        localClockNow(),
        serverClockAvailable() ? estimatedServerNowMs() : 0,
      );
      runtime.updateUi();
      if (!runtime.saveGame("manual")) {
        if (runtime.saveConflictMode) {
          await handleSaveConflict();
          return;
        }
        restoreOfflineTransaction(
          transactionSnapshot,
          new Error("disabled offline progress baseline save failed"),
          retryBaseline,
        );
        return;
      }
      lastTime = currentFrameTime();
      return;
    }
    await syncServerClock();
    if (resumeGeneration !== visibilityResumeGeneration) return;

    const expectedSaveFingerprint = runtime.saveRevision !== resumeBaselineSaveRevision
      ? runtime.lastLocalSaveFingerprint || runtime.lastKnownSaveFingerprint || ""
      : resumeBaselineSaveFingerprint;
    const currentFingerprint = runtime.currentSaveFingerprint?.() || "";
    if (currentFingerprint !== expectedSaveFingerprint) {
      await handleSaveConflict();
      return;
    }
    // A successful local save may have rebased SAVE_KEY while the clock request was pending.
    // Retry the captured interval against that latest local save, not its old fingerprint.
    retryBaseline.saveFingerprint = expectedSaveFingerprint;

    const elapsed = offlineElapsedFromSave(resumeBaselineTimestamp, resumeBaselineServerTimestamp);
    if (elapsed.elapsedSeconds > 0 || elapsed.clockAnomaly) {
      await processOfflineElapsed(elapsed.elapsedSeconds, "visibility", {
        ...elapsed,
        retryBaseline,
      });
    } else {
      setOfflineBaseline(
        localClockNow(),
        serverClockAvailable() ? estimatedServerNowMs() : 0,
      );
    }
  } catch (error) {
    restoreOfflineTransaction(transactionSnapshot, error, retryBaseline);
  } finally {
    visibilityResumeInFlight = false;
  }
}

function currentFrameTime() {
  return window.performance && performance.now ? performance.now() : Date.now();
}

function drawActiveView() {
  if (runtime.activeMainTab === "angle") {
    runtime.draw();
    return true;
  }
  if (runtime.activeMainTab === "infinity" && runtime.activeInfinitySubtab === "angle") {
    runtime.drawInfiniteAngle();
    return true;
  }
  return false;
}

let lastTime = currentFrameTime();
function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.08);
  if (dt > 0) {
    const instantFps = 1 / dt;
    smoothedFps = smoothedFps === 0 ? instantFps : smoothedFps * 0.9 + instantFps * 0.1;
  }
  lastTime = now;
  if (document.hidden || visibilityResumeInFlight || offlineProcessing || runtime.saveConflictMode) {
    requestNextFrame(frame);
    return;
  }
  let remaining = dt;
  while (remaining > 0) {
    const step = Math.min(runtime.MAX_SIMULATION_STEP_SECONDS, remaining);
    advanceOnlineTime(step);
    remaining -= step;
  }
  uiUpdateElapsed += dt;
  if (uiUpdateElapsed >= runtime.UI_UPDATE_INTERVAL_SECONDS) {
    uiUpdateElapsed %= runtime.UI_UPDATE_INTERVAL_SECONDS;
    runtime.updateUi();
  }
  const renderStartedAt = monotonicClockNow();
  if (shouldRenderFrame(now)) {
    const canvasRendered = drawActiveView();
    if (canvasRendered) updateRenderQuality(Math.max(0, monotonicClockNow() - renderStartedAt));
  }
  requestNextFrame(frame);
}

function renderGameToText() {
  const points = runtime.polygonPoints();
  const point = runtime.pointPosition();
  const corePoint = runtime.vertexPoint(0);
  const scoreLog = runtime.currentScoreLog10();
  const finalGainLog = runtime.finalScoreGainLog10();
  const totalScoreLog = runtime.currentTotalScoreLog10();
  const generationScoreLog = runtime.currentGenerationScoreLog10();
  const infinityPointsLog = runtime.currentInfinityPointsLog10();
  const infiniteScoreLog = runtime.currentInfiniteScoreLog10();
  const infiniteAngleBoostLog10 = runtime.infiniteAngleBoostLog10();
  const infiniteAngleCostLogs = {
    speed: runtime.infiniteAngleUpgradeCostLog10("speed"),
    vertex: runtime.infiniteAngleUpgradeCostLog10("vertex"),
    gain: runtime.infiniteAngleUpgradeCostLog10("gain"),
  };
  const currentGainLog = runtime.currentGainLog10();
  const currentCostLogs = runtime.costLogs();
  const gainExpression = runtime.gainExpressionConfig();
  return JSON.stringify({
    coordinateSystem: "canvas pixels, origin top-left, x right, y down",
    score: runtime.scoreDisplay(),
    scoreLog10: Number.isFinite(scoreLog) ? Number(scoreLog.toPrecision(6)) : null,
    totalScore: runtime.formatUiLogNumber(totalScoreLog),
    totalScoreLog10: Number.isFinite(totalScoreLog) ? Number(totalScoreLog.toPrecision(6)) : null,
    generationScore: runtime.formatUiLogNumber(generationScoreLog),
    generationScoreLog10: Number.isFinite(generationScoreLog) ? Number(generationScoreLog.toPrecision(6)) : null,
    currentGain: runtime.formatUiLogNumber(currentGainLog),
    currentGainLog10: Number.isFinite(currentGainLog) ? Number(currentGainLog.toPrecision(6)) : null,
    finalGainOnCore: runtime.formatUiLogNumber(finalGainLog),
    finalGainOnCoreLog10: Number.isFinite(finalGainLog) ? Number(finalGainLog.toPrecision(6)) : null,
    baseGainExpression: runtime.formatGainExpressionSummary(),
    baseGainExpressionDivisor: gainExpression.divisor,
    baseGainExpressionParts: gainExpression.parts,
    vertices: runtime.effectiveVertexCount(),
    lapSeconds: Number(runtime.lapDuration().toPrecision(6)),
    lapSpeedMultiplier: Number(runtime.lapSpeedMultiplier().toPrecision(6)),
    lapSpeedLog10: Number(runtime.effectiveLapSpeedLog10().toPrecision(6)),
    rawLapSpeedMultiplier: runtime.valueFromLog10(runtime.rawLapSpeedLog10()),
    rawLapSpeedLog10: Number(runtime.rawLapSpeedLog10().toPrecision(6)),
    lapSpeedSoftcapStart: Number(runtime.lapSpeedSoftcapStart().toPrecision(6)),
    lapSpeedSoftcapPower: Number(runtime.lapSpeedSoftcapPower().toPrecision(6)),
    lapSpeedSoftcapped: runtime.isLapSpeedSoftcapped(),
    point: { x: Number(point.x.toFixed(1)), y: Number(point.y.toFixed(1)), progress: Number(runtime.state.pointProgress.toFixed(3)) },
    core: { x: Number(corePoint.x.toFixed(1)), y: Number(corePoint.y.toFixed(1)) },
    coreCount: runtime.coreVertexIndices().length,
    upgrades: {
      speedLevel: runtime.state.speedLevel,
      gainLevel: runtime.state.gainLevel,
      costs: {
        speed: runtime.formatUiLogNumber(currentCostLogs.speed),
        speedLog10: Number(currentCostLogs.speed.toPrecision(6)),
        vertex: runtime.formatUiLogNumber(currentCostLogs.vertex),
        vertexLog10: Number(currentCostLogs.vertex.toPrecision(6)),
        gain: runtime.formatUiLogNumber(currentCostLogs.gain),
        gainLog10: Number(currentCostLogs.gain.toPrecision(6)),
      },
    },
    generation: {
      unlocked: runtime.currentTotalScoreLog10() >= runtime.log10Value(runtime.GENERATION_UNLOCK_SCORE),
      canGenerate: runtime.canRunGeneration(),
      requirement: runtime.formatUiLogNumber(runtime.generationRequirementLog10()),
      requirementLog10: Number(runtime.generationRequirementLog10().toPrecision(6)),
      count: runtime.state.generationCount,
      previousGenerationScore: runtime.formatUiLogNumber(runtime.currentPreviousGenerationScoreLog10()),
      previousGenerationScoreLog10: Number.isFinite(runtime.currentPreviousGenerationScoreLog10()) ? Number(runtime.currentPreviousGenerationScoreLog10().toPrecision(6)) : null,
      rawScoreMultiplier: runtime.formatUiLogNumber(runtime.currentGenerationScoreMultiplierLog10()),
      rawScoreMultiplierLog10: Number(runtime.currentGenerationScoreMultiplierLog10().toPrecision(6)),
      achievementScoreMultiplier: runtime.formatUiLogNumber(runtime.generationScoreMultiplierBaseEffectLog10()),
      scoreMultiplier: runtime.formatUiLogNumber(runtime.generationScoreMultiplierEffectLog10()),
      scoreMultiplierLog10: Number(runtime.generationScoreMultiplierEffectLog10().toPrecision(6)),
      costFactor: Number(runtime.generationCostFactorEffect().toFixed(2)),
    },
    coreBoost: {
      canBoost: runtime.canCoreBoost(),
      count: runtime.state.coreBoostCount,
      requirement: runtime.formatPowerOfTen(runtime.coreBoostRequirementLog10()),
      requirementLog10: runtime.coreBoostRequirementLog10(),
      requirementText: runtime.formatPowerOfTen(runtime.coreBoostRequirementLog10()),
      requirementGrowthPowerRaw: runtime.coreBoostRequirementRawGrowthPower(),
      requirementGrowthPower: runtime.coreBoostRequirementGrowthPower(),
      gainIncreaseMultiplier: Number(runtime.coreBoostGainIncreaseMultiplier().toFixed(2)),
      gainExponent: Number(runtime.coreBoostGainExponent().toFixed(2)),
    },
    infinity: {
      canInfinity: runtime.canInfinity(),
      count: runtime.state.infinityCount,
      points: runtime.formatUiLogNumber(infinityPointsLog),
      pointsLog10: Number.isFinite(infinityPointsLog) ? Number(infinityPointsLog.toPrecision(6)) : null,
      pointGain: runtime.infinityPointGain(),
      infiniteScore: runtime.formatUiLogNumber(infiniteScoreLog),
      infiniteScoreLog10: Number.isFinite(infiniteScoreLog) ? Number(infiniteScoreLog.toPrecision(6)) : null,
      infiniteAngleBoost: Number(runtime.infiniteAngleBoost().toFixed(2)),
      infiniteAngleBoostLog10: Number.isFinite(infiniteAngleBoostLog10) ? Number(infiniteAngleBoostLog10.toPrecision(6)) : null,
      infiniteAngle: {
        unlocked: runtime.state.infiniteAngleUnlocked,
        score: runtime.formatUiLogNumber(infiniteScoreLog),
        scoreLog10: Number.isFinite(infiniteScoreLog) ? Number(infiniteScoreLog.toPrecision(6)) : null,
        boost: Number(runtime.infiniteAngleBoost().toPrecision(6)),
        boostLog10: Number.isFinite(infiniteAngleBoostLog10) ? Number(infiniteAngleBoostLog10.toPrecision(6)) : null,
        vertices: runtime.infiniteAngleVertexCount(),
        purchasedSpeedLevel: runtime.infiniteAnglePurchasedUpgradeLevel("speed"),
        purchasedVertexLevel: runtime.infiniteAnglePurchasedUpgradeLevel("vertex"),
        purchasedGainLevel: runtime.infiniteAnglePurchasedUpgradeLevel("gain"),
        freeSpeedLevel: runtime.infiniteAngleFreeUpgradeLevel("speed"),
        freeVertexLevel: runtime.infiniteAngleFreeUpgradeLevel("vertex"),
        freeGainLevel: runtime.infiniteAngleFreeUpgradeLevel("gain"),
        speedLevel: runtime.infiniteAngleEffectiveUpgradeLevel("speed"),
        vertexLevel: runtime.infiniteAngleEffectiveUpgradeLevel("vertex"),
        gainLevel: runtime.infiniteAngleEffectiveUpgradeLevel("gain"),
        currentGain: runtime.formatUiLogNumber(runtime.infiniteAngleCurrentGainLog10()),
        currentGainLog10: Number(runtime.infiniteAngleCurrentGainLog10().toPrecision(6)),
        lapSeconds: Number(runtime.infiniteAngleLapDuration().toPrecision(6)),
        costs: {
          speed: runtime.formatUiLogNumber(infiniteAngleCostLogs.speed),
          vertex: runtime.formatUiLogNumber(infiniteAngleCostLogs.vertex),
          gain: runtime.formatUiLogNumber(infiniteAngleCostLogs.gain),
          speedLog10: Number(infiniteAngleCostLogs.speed.toPrecision(6)),
          vertexLog10: Number(infiniteAngleCostLogs.vertex.toPrecision(6)),
          gainLog10: Number(infiniteAngleCostLogs.gain.toPrecision(6)),
        },
      },
      activeChallenge: runtime.state.activeChallenge,
      completedChallenges: runtime.completedChallengeCount(),
      challengeCount: runtime.INFINITY_CHALLENGE_COUNT,
      challengesUnlocked: runtime.infinityChallengesUnlocked(),
      activeChallengeName: runtime.state.activeChallenge > 0 ? runtime.challengeName(runtime.state.activeChallenge) : runtime.challengeName(0),
      softcapPower: Number(runtime.infinitySoftcapPower().toFixed(3)),
      capBroken: runtime.state.infiniteCapBroken,
      canBreakCap: runtime.canBreakInfiniteCap(),
      infiniteAngleUnlockCostLog10: runtime.INFINITE_ANGLE_UNLOCK_COST_LOG10,
      selectedUpgrade: selectedInfinityUpgradeId,
      selectedUpgradeCanBuy: runtime.canBuyInfinityUpgrade(selectedInfinityUpgradeId),
      upgrades: runtime.INFINITY_UPGRADES.map((upgrade) => ({
        id: upgrade.id,
        purchased: runtime.hasInfinityUpgrade(upgrade.id),
        canBuy: runtime.canBuyInfinityUpgrade(upgrade.id),
      })),
    },
    tower: {
      floor: runtime.towerFloor(),
      scoreExponent: Number(runtime.towerScoreExponent().toFixed(4)),
      challenge1ScorePowerBase: runtime.hasInfinityUpgrade("13-1") ? 0.5 : runtime.INFINITE_ANGLE_SCORE_POWER,
      challenge1ScorePowerBonus: runtime.towerChallenge1InfinityScorePowerBonus(),
      challenge1ScorePower: runtime.infiniteAngleScorePower(),
      nextFloor: runtime.towerNextFloor(),
      nextCostLog10: Number(runtime.towerNextFloorCostLog10().toPrecision(6)),
      gate: runtime.towerGateForFloor(runtime.towerNextFloor()),
      canBuild: runtime.canBuildTower(),
      challengeCount: runtime.TOWER_CHALLENGE_COUNT,
      activeChallenge: runtime.state.activeTowerChallenge,
      completedChallenges: runtime.state.completedTowerChallenges,
      challenges: runtime.TOWER_CHALLENGES.map((challenge) => ({
        index: challenge.index,
        name: runtime.towerChallengeName(challenge.index),
        implemented: runtime.towerChallengeImplemented(challenge.index),
        unlocked: runtime.towerChallengeUnlocked(challenge.index),
        completed: runtime.towerChallengeCompleted(challenge.index),
        targetLog10: Number.isFinite(challenge.targetLog10) ? challenge.targetLog10 : null,
      })),
    },
    achievements: {
      unlocked: runtime.achievementCount(),
      total: runtime.ACHIEVEMENT_COUNT,
      gainMultiplier: Number(runtime.achievementGainMultiplier().toFixed(4)),
      vertexGainIncrease: Number(runtime.vertexGainIncrease().toPrecision(6)),
      vertexGainIncreaseLog10: Number(runtime.vertexGainIncreaseLog10().toPrecision(6)),
      mask: runtime.state.achievementMask,
      maskHigh: runtime.state.achievementMaskHigh,
      generationMultiplierReward: runtime.isAchievementUnlocked(3),
      totalPlayTime: Number(runtime.state.totalPlayTime.toFixed(1)),
      noGenerationCoreBoostReached: runtime.state.noGenerationCoreBoostReached,
    },
    settings: {
      showFloatingText: runtime.state.showFloatingText,
      lightEffects: runtime.state.lightEffects,
      showFps: runtime.state.showFps,
      fps: Number(smoothedFps.toFixed(1)),
      language: runtime.state.language,
      numberFormat: runtime.state.numberFormat,
      timeUnit: runtime.state.timeUnit,
      showTimeFluxQuickBar: runtime.state.showTimeFluxQuickBar,
      hiddenTabs: runtime.normalizeHiddenTabs(runtime.state.hiddenTabs),
      activeMainTab,
      activeInfinitySubtab,
      activeChallengeSubtab,
      activeStatisticsSubtab,
    },
    automation: {
      unlocked: runtime.normalAutomationUnlocked?.() || false,
      layerUnlocked: runtime.infinityAutomationUnlocked?.() || false,
      enabled: runtime.state.automationEnabled,
      speed: runtime.state.autoBuySpeed,
      vertex: runtime.state.autoBuyVertex,
      gain: runtime.state.autoBuyGain,
      generation: runtime.state.autoRunGeneration,
      generationScoreMultiplierThreshold: runtime.state.autoGenerationScoreMultiplierThreshold,
      generationCostMultiplierThreshold: runtime.state.autoGenerationCostMultiplierThreshold,
      generationMinimumSeconds: runtime.state.autoGenerationMinimumSeconds,
      currentGenerationRunTime: Number(runtime.state.currentGenerationRunTime.toFixed(1)),
      coreBoost: runtime.state.autoRunCoreBoost,
      infinity: runtime.state.autoRunInfinity,
      infinityPointThreshold: runtime.state.autoInfinityPointThreshold,
      infinityPointThresholdLog10: runtime.state.autoInfinityPointThresholdLog10,
    },
    statistics: {
      totalPlayTime: Number(runtime.state.totalPlayTime.toFixed(1)),
      totalRealPlayTime: Number(runtime.state.totalRealPlayTime.toFixed(1)),
      currentInfinityRunTime: Number(runtime.state.currentInfinityRunTime.toFixed(1)),
      currentInfinityRealTime: Number(runtime.state.currentInfinityRealTime.toFixed(1)),
      fastestInfinityTime: runtime.state.fastestInfinityTime > 0 ? Number(runtime.state.fastestInfinityTime.toFixed(1)) : null,
      fastestInfinityRealTime: runtime.state.fastestInfinityRealTime > 0
        ? Number(runtime.state.fastestInfinityRealTime.toFixed(1))
        : null,
      fastestInfinityChallengeTimes: runtime.state.fastestInfinityChallengeTimes,
      fastestTowerChallengeTimes: runtime.state.fastestTowerChallengeTimes,
      lastInfinityRuns: runtime.state.lastInfinityRuns,
    },
    timeFlux: {
      dormant: true,
      amount: runtime.state.timeFlux,
      capacityLevel: runtime.state.timeFluxCapacityLevel,
      gainLevel: runtime.state.timeFluxGainLevel,
      speed: runtime.state.timeFluxSpeed,
      customSpeed: runtime.state.timeFluxCustomSpeed,
      offlineProgressEnabled: runtime.state.offlineProgressEnabled,
      offlineTickCount: runtime.state.offlineTickCount,
      report: offlineReport,
    },
  });
}

async function initializeGame() {
  await syncServerClock();
  runtime.bindEvents();
  runtime.createChallengeRows();
  runtime.createTowerChallengeRows();
  runtime.createInfinityUpgradeRows();
  runtime.createAchievementRows();
  await runtime.loadGame();
  runtime.switchMainTab(activeMainTab);
  runtime.switchInfinitySubtab(activeInfinitySubtab);
  runtime.switchChallengeSubtab(activeChallengeSubtab);
  runtime.switchStatisticsSubtab(activeStatisticsSubtab);
  runtime.resizeCanvas();
  runtime.resizeInfiniteAngleCanvas();
  runtime.updateUi();
  showUpdateModalIfNeeded();
  checkForRemoteUpdate();
  if (document.fonts) {
    document.fonts.ready.then(() => {
      japaneseFontReady = true;
      runtime.updateUi();
      runtime.draw();
      runtime.drawInfiniteAngle();
    });
  } else {
    japaneseFontReady = true;
  }
  requestNextFrame(frame);
}

expose("autoSaveElapsed", () => autoSaveElapsed, (value) => { autoSaveElapsed = value; });
expose("updateCheckElapsed", () => updateCheckElapsed, (value) => { updateCheckElapsed = value; });
expose("updateCheckInFlight", () => updateCheckInFlight, (value) => { updateCheckInFlight = value; });
expose("japaneseFontReady", () => japaneseFontReady, (value) => { japaneseFontReady = value; });
expose("normalAutobuyElapsed", () => normalAutobuyElapsed, (value) => { normalAutobuyElapsed = value; });
expose("uiUpdateElapsed", () => uiUpdateElapsed, (value) => { uiUpdateElapsed = value; });
expose("activeMainTab", () => activeMainTab, (value) => { activeMainTab = value; });
expose("activeInfinitySubtab", () => activeInfinitySubtab, (value) => { activeInfinitySubtab = value; });
expose("activeChallengeSubtab", () => activeChallengeSubtab, (value) => { activeChallengeSubtab = value; });
expose("activeStatisticsSubtab", () => activeStatisticsSubtab, (value) => { activeStatisticsSubtab = value; });
expose("selectedInfinityUpgradeId", () => selectedInfinityUpgradeId, (value) => { selectedInfinityUpgradeId = value; });
expose("appliedLanguage", () => appliedLanguage, (value) => { appliedLanguage = value; });
expose("smoothedFps", () => smoothedFps, (value) => { smoothedFps = value; });
expose("renderQualityState", () => renderQualityState);
expose("renderVertexLimit", () => renderVertexLimit);
expose("renderDevicePixelRatio", () => renderDevicePixelRatio);
expose("renderFrameIntervalMs", () => renderFrameIntervalMs);
expose("setRenderQualityForTest", () => setRenderQualityForTest);
expose("offlineBaselineTimestamp", () => offlineBaselineTimestamp, (value) => { offlineBaselineTimestamp = value; });
expose("offlineBaselineServerTimestamp", () => offlineBaselineServerTimestamp, (value) => { offlineBaselineServerTimestamp = value; });
expose("offlineProcessing", () => offlineProcessing, setOfflineProcessing);
expose("offlineReport", () => offlineReport, (value) => { offlineReport = value; });
expose("beginOfflineWorkBudget", () => beginOfflineWorkBudget);
expose("offlineCoreHitPlan", () => offlineCoreHitPlan);
expose("offlineWorkStats", () => offlineWorkStatsSnapshot());
expose("offlinePrecisionReduced", () => Boolean(offlineWorkLedger?.precisionReduced));
expose("serverClockSource", () => serverClockSource);
expose("serverClockAnomaly", () => serverClockAnomaly);
expose("serverClockAvailable", () => serverClockAvailable);
expose("serverClockNowMs", () => trustedClockNowMs);
expose("localClockNowMs", () => localClockNow);
expose("monotonicClockNowMs", () => monotonicClockNow);
expose("syncServerClock", () => syncServerClock);
expose("offlineElapsedFromSave", () => offlineElapsedFromSave);
expose("rebaseLocalClock", () => rebaseLocalClock);
expose("requestNextFrame", () => requestNextFrame);
expose("shouldShowUpdateModal", () => shouldShowUpdateModal, (value) => { shouldShowUpdateModal = value; });
expose("closeUpdateModal", () => closeUpdateModal, (value) => { closeUpdateModal = value; });
expose("showUpdateModalIfNeeded", () => showUpdateModalIfNeeded, (value) => { showUpdateModalIfNeeded = value; });
expose("storedUpdateReloadTime", () => storedUpdateReloadTime, (value) => { storedUpdateReloadTime = value; });
expose("markUpdateDeferred", () => markUpdateDeferred, (value) => { markUpdateDeferred = value; });
expose("reloadForRemoteUpdate", () => reloadForRemoteUpdate, (value) => { reloadForRemoteUpdate = value; });
expose("checkForRemoteUpdate", () => checkForRemoteUpdate, (value) => { checkForRemoteUpdate = value; });
expose("runAutobuyers", () => runAutobuyers, (value) => { runAutobuyers = value; });
expose("shouldAutoRunGeneration", () => shouldAutoRunGeneration, (value) => { shouldAutoRunGeneration = value; });
expose("runLayerAutomation", () => runLayerAutomation, (value) => { runLayerAutomation = value; });
expose("runEternityMilestoneEightAutomation", () => runEternityMilestoneEightAutomation);
expose("update", () => update, (value) => { update = value; });
expose("advanceOnlineTime", () => advanceOnlineTime, (value) => { advanceOnlineTime = value; });
expose("processOfflineElapsed", () => processOfflineElapsed, (value) => { processOfflineElapsed = value; });
expose("setOfflineBaseline", () => setOfflineBaseline, (value) => { setOfflineBaseline = value; });
expose("setSaveConflictLock", () => setSaveConflictLock, (value) => { setSaveConflictLock = value; });
expose("handleSaveConflict", () => handleSaveConflict, (value) => { handleSaveConflict = value; });
expose("handleStorageChange", () => handleStorageChange, (value) => { handleStorageChange = value; });
expose("invalidateVisibilityResume", () => invalidateVisibilityResume);
expose("handleVisibilityChange", () => handleVisibilityChange, (value) => { handleVisibilityChange = value; });
expose("currentFrameTime", () => currentFrameTime, (value) => { currentFrameTime = value; });
expose("lastTime", () => lastTime, (value) => { lastTime = value; });
expose("frame", () => frame, (value) => { frame = value; });
expose("renderGameToText", () => renderGameToText, (value) => { renderGameToText = value; });
window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) advanceOnlineTime(1 / 60);
  uiUpdateElapsed = 0;
  runtime.updateUi();
  drawActiveView();
};
window.__angleDebug = {
  runtime,
  state: runtime.state,
  uiUpdateCount: () => uiUpdateCount,
  addScore: runtime.addScore,
  update,
  buySpeed: runtime.buySpeed,
  runGeneration: runtime.runGeneration,
  runCoreBoost: runtime.runCoreBoost,
  runInfinity: runtime.runInfinity,
  canEternity: runtime.canEternity,
  performEternity: runtime.performEternity,
  maybeForceEternity: runtime.maybeForceEternity,
  selectEternityMilestone: runtime.selectEternityMilestone,
  buyInfinityUpgrade: runtime.buyInfinityUpgrade,
  buyAllUpgrades: runtime.buyAllUpgrades,
  generationRewardFor: runtime.generationRewardFor,
  generationScoreMultiplierEffectLog10: runtime.generationScoreMultiplierEffectLog10,
  unlockInfiniteAngle: runtime.unlockInfiniteAngle,
  buyInfiniteAngleUpgrade: runtime.buyInfiniteAngleUpgrade,
  buyAllInfiniteAngleUpgrades: runtime.buyAllInfiniteAngleUpgrades,
  updateInfiniteAngle: runtime.updateInfiniteAngle,
  toggleInfinityChallenge: runtime.toggleInfinityChallenge,
  breakInfiniteCap: runtime.breakInfiniteCap,
  checkAchievements: runtime.checkAchievements,
  switchMainTab: runtime.switchMainTab,
  mainTabIsUnlocked: runtime.mainTabIsUnlocked,
  mainTabIsVisible: runtime.mainTabIsVisible,
  setMainTabVisibility: runtime.setMainTabVisibility,
  switchInfinitySubtab: runtime.switchInfinitySubtab,
  switchChallengeSubtab: runtime.switchChallengeSubtab,
  switchStatisticsSubtab: runtime.switchStatisticsSubtab,
  buildTower: runtime.buildTower,
  toggleTowerChallenge: runtime.toggleTowerChallenge,
  completeTowerChallengeIfReady: runtime.completeTowerChallengeIfReady,
  applySetting: runtime.applySetting,
  advanceOnlineTime,
  processOfflineElapsed,
  handleSaveConflict,
  handleStorageChange,
  saveGame: runtime.saveGame,
  backupCurrentSave: runtime.backupCurrentSave,
  createCheckpoint: runtime.createCheckpoint,
  recoveryEntries: runtime.recoveryEntries,
  restorePreImportSave: runtime.restorePreImportSave,
  restoreCheckpoint: runtime.restoreCheckpoint,
  restoreUndoSave: runtime.restoreUndoSave,
  retryLoad: runtime.retryLoad,
  restoreQuarantineSave: runtime.restoreQuarantineSave,
  loadGame: runtime.loadGame,
  resetSave: runtime.resetSave,
  exportSaveCode: runtime.exportSaveCode,
  importSaveCode: runtime.importSaveCode,
  completeChallengeIfReady: runtime.completeChallengeIfReady,
  syncServerClock,
  offlineElapsedFromSave,
  renderQualityState,
  setRenderQualityForTest,
  updateRenderQualityForTest,
  canvasCacheStats: runtime.canvasCacheStats,
  serverClockAvailable,
  serverClockNowMs: trustedClockNowMs,
  serverClockSource: () => serverClockSource,
  ready: null,
};

window.__angleDebug.ready = initializeGame();
