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
import "./ui/render-help.js";
import "./ui/render-eternity.js";
import "./ui/render-ui.js";
import "./systems/angle.js";
import "./systems/generation.js";
import "./systems/core-boost.js";
import "./systems/infinity.js";
import "./systems/infinite-angle.js";
import "./ui/events.js";
import "./systems/eternity.js";
import "./systems/timeline.js";
import "./core/offline-progress.js";

let autoSaveElapsed = 0;
let updateCheckElapsed = 0;
let updateCheckInFlight = false;
let japaneseFontReady = false;
let normalAutobuyElapsed = 0;
let uiUpdateElapsed = 0;
let activeMainTab = "angle";
let activeEternitySubtab = "milestone";
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
let visibilityResumeInFlight = false;
let visibilityResumeGeneration = 0;
let saveConflictInFlight = null;
let serverClockAnchor = null;
let serverClockSyncInFlight = null;
let serverClockSource = "local-fallback";
let serverClockAnomaly = false;
let localClockAnomaly = false;
let localClockAnchor = null;
const requestNextFrame = window.requestAnimationFrame
  ? window.requestAnimationFrame.bind(window)
  : (callback) => window.setTimeout(() => callback(currentFrameTime()), 1000 / 60);

const RENDER_QUALITY_PROFILES = Object.freeze({
  high: Object.freeze({ devicePixelRatio: 2, vertexLimit: 720, frameIntervalMs: 0 }),
  balanced: Object.freeze({ devicePixelRatio: 1.5, vertexLimit: 360, frameIntervalMs: 1000 / 30 }),
  low: Object.freeze({ devicePixelRatio: 1, vertexLimit: 180, frameIntervalMs: 1000 / 30 }),
});

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
  const normalPurchases = runtime.buyAllUpgrades({
    refresh: false,
    save: false,
    allowSpeed: runtime.state.autoBuySpeed,
    allowVertex: runtime.state.autoBuyVertex,
    allowGain: runtime.state.autoBuyGain,
  });
  runtime.recordOfflineEvent("normalUpgradePurchases", normalPurchases);
  if (runtime.state.autoBuyInfinityUpgrades) {
    const infinityPurchases = runtime.buyAllInfinityUpgrades({
      refresh: false,
      save: false,
    });
    runtime.recordOfflineEvent("infinityUpgradePurchases", infinityPurchases);
  }
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

function runEternityMilestoneAutomation({ refresh = false, save = true } = {}) {
  let changed = false;
  const unlocked = (
    runtime.eternityMilestoneActive?.("5") === true
    && runtime.unlockInfiniteAngle?.({ refresh, save: false }) === true
  );
  if (unlocked) {
    changed = true;
    runtime.recordOfflineEvent("automaticUnlocks");
  }
  const capBroken = (
    runtime.eternityMilestoneActive?.("6") === true
    && runtime.breakInfiniteCap?.({ refresh, save: false }) === true
  );
  if (capBroken) {
    changed = true;
    runtime.recordOfflineEvent("automaticCompletions");
  }
  if (changed && save) runtime.saveGame("manual");
  return changed;
}

function runLayerAutomation() {
  const milestoneAutomationRan = runEternityMilestoneAutomation();
  if (!runtime.state.automationEnabled) return milestoneAutomationRan;
  const infinityAutomationUnlocked = runtime.infinityAutomationUnlocked?.() || false;
  const generationCoreAutomationUnlocked = runtime.isAchievementUnlocked(19);
  const milestoneEightAutomationRan = runEternityMilestoneEightAutomation();

  if (
    infinityAutomationUnlocked
    && runtime.state.autoRunInfinity
    && runtime.currentExactIntegerState(runtime.state, "infinityCountExact", "infinityCount") > 0n
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
    runtime.recordOfflineEvent("infinityExecutions");
    return true;
  }

  if (generationCoreAutomationUnlocked && runtime.state.autoRunCoreBoost && runtime.canCoreBoost()) {
    runtime.runCoreBoost();
    runtime.recordOfflineEvent("coreBoostResets");
    return true;
  }

  if (generationCoreAutomationUnlocked && runtime.state.autoRunGeneration && shouldAutoRunGeneration()) {
    runtime.runGeneration();
    runtime.recordOfflineEvent("generationResets");
    return true;
  }

  return milestoneEightAutomationRan || milestoneAutomationRan;
}

function runEternityMilestoneEightAutomation() {
  if (runtime.eternityMilestoneActive?.("8") !== true || !runtime.state.automationEnabled) return false;
  let changed = false;
  if (runtime.state.autoBuildTower && runtime.buildTower({ refresh: false, save: false })) {
    runtime.recordOfflineEvent("towerBuilds");
    changed = true;
  }
  const purchases = runtime.buyAllInfiniteAngleUpgrades({
    refresh: false,
    save: false,
    allowSpeed: runtime.state.autoBuyInfiniteAngleSpeed,
    allowVertex: runtime.state.autoBuyInfiniteAngleVertex,
    allowGain: runtime.state.autoBuyInfiniteAngleGain,
  });
  runtime.recordOfflineEvent("infiniteAnglePurchases", purchases);
  return changed || purchases > 0;
}

function update(dt, allowOffline = false) {
  if (runtime.saveConflictMode && !(allowOffline && runtime.loadInFlight)) return;
  if (runtime.offlineProcessing && !allowOffline) return;
  runtime.state.totalPlayTime += dt;
  runtime.state.currentInfinityRunTime += dt;
  runtime.state.currentEternityRunTime += dt;
  runtime.state.currentGenerationRunTime += dt;
  runtime.advanceTimelineRunTime?.(dt);
  runtime.updateChallengeTimers(dt);
  runtime.updateInfiniteAngle(dt);

  if (runtime.normalAutomationUnlocked?.() && runtime.state.automationEnabled) {
    normalAutobuyElapsed += dt;
    if (normalAutobuyElapsed >= runtime.AUTOBUY_INTERVAL_SECONDS) {
      normalAutobuyElapsed %= runtime.AUTOBUY_INTERVAL_SECONDS;
      if (runtime.AUTOBUY_INTERVAL_SECONDS - normalAutobuyElapsed <= 1e-9) normalAutobuyElapsed = 0;
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
  const useOfflineApproximation = runtime.offlineProcessing
    && dt > runtime.OFFLINE_PROGRESS_APPROXIMATION_THRESHOLD_SECONDS_PER_TICK;
  if (runtime.offlineProcessing
    || useOfflineApproximation
    || vertexSteps > runtime.MAX_VERTEX_STEPS_PER_FRAME
    || estimatedCoreHits > runtime.MAX_CORE_HITS_PER_FRAME) {
    if (runtime.processManyVertices(start, end)) return;
  } else {
    for (let vertex = start; vertex <= end; vertex += 1) {
      if (runtime.passVertex(vertex % vertices)) return;
    }
  }
  if (runtime.completeTowerChallengeIfReady()) {
    runtime.recordOfflineEvent("automaticCompletions");
    return;
  }
  if (runLayerAutomation()) return;

  runtime.normalizeVertexProgress();
  runtime.state.lastVertexIndex = Math.floor(runtime.state.pointProgress * vertices) % vertices;
  if (!runtime.offlineProcessing) {
    runtime.state.floatingTexts = runtime.state.floatingTexts
      .map((item) => ({ ...item, life: item.life - dt, y: item.y - dt * 26 }))
      .filter((item) => item.life > 0);
  }
}

function runRealTimeMaintenance(realSeconds) {
  if (runtime.offlineProcessing || runtime.saveConflictMode || realSeconds <= 0) return;
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
  if (runtime.offlineProcessing || runtime.saveConflictMode) return 0;
  const realDt = Math.max(0, runtime.sanitizeNumber(realSeconds, 0));
  if (realDt <= 0) return 0;
  runtime.state.totalRealPlayTime += realDt;
  runtime.state.currentInfinityRealTime += realDt;
  runtime.state.currentEternityRealTime += realDt;
  const gameSeconds = realDt;

  runtime.runSimulationBatch(() => {
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
      "subtab",
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
  runtime.offlineReport = null;
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
  if (runtime.offlineProcessing || runtime.loadInFlight) return false;
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
  if ((event?.key !== null && event?.key !== runtime.SAVE_KEY) || runtime.offlineProcessing || visibilityResumeInFlight) return;
  if (saveSourceIsCurrent() && !runtime.saveConflictMode) return;
  return handleSaveConflict();
}

async function handleVisibilityChange() {
  if (runtime.offlineProcessing) return;
  if (runtime.saveConflictMode) {
    if (!document.hidden) await handleSaveConflict();
    return;
  }
  if (document.hidden) {
    const transactionSnapshot = runtime.snapshotOfflineTransaction();
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
        runtime.restoreOfflineTransaction(
          transactionSnapshot,
          new Error("visibility hide save failed"),
          retryBaseline,
        );
      }
    } catch (error) {
      runtime.restoreOfflineTransaction(transactionSnapshot, error, retryBaseline);
    }
    return;
  }
  if (visibilityResumeInFlight) return;
  if (runtime.loadRecoveryMode) return;
  visibilityResumeInFlight = true;
  const transactionSnapshot = runtime.snapshotOfflineTransaction();
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
      runtime.offlineReport = null;
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
        runtime.restoreOfflineTransaction(
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
      await runtime.processOfflineElapsed(elapsed.elapsedSeconds, "visibility", {
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
    runtime.restoreOfflineTransaction(transactionSnapshot, error, retryBaseline);
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
  if (document.hidden || visibilityResumeInFlight || runtime.offlineProcessing || runtime.saveConflictMode) {
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
  const verticesExact = runtime.currentExactIntegerState(runtime.state, "verticesExact", "vertices", 3n);
  const speedLevelExact = runtime.currentExactIntegerState(runtime.state, "speedLevelExact", "speedLevel");
  const gainLevelExact = runtime.currentExactIntegerState(runtime.state, "gainLevelExact", "gainLevel");
  const infinityCountExact = runtime.currentExactIntegerState(runtime.state, "infinityCountExact", "infinityCount");
  const eternityCountExact = runtime.currentExactIntegerState(runtime.state, "eternityCountExact", "eternityCount");
  const scoreLog = runtime.currentScoreLog10();
  const finalGainLog = runtime.finalScoreGainLog10();
  const totalScoreLog = runtime.currentTotalScoreLog10();
  const generationScoreLog = runtime.currentGenerationScoreLog10();
  const infinityPointsLog = runtime.currentInfinityPointsLog10();
  const infinityPointGain = runtime.infinityPointGain();
  const infinityPointGainLog10 = runtime.infinityPointGainLog10();
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
  const eternityGainLog10 = runtime.eternityGainLog10();
  const timelineEternityRequirement = runtime.timelineEternityRequirement();
  return JSON.stringify({
    coordinateSystem: "canvas pixels, origin top-left, x right, y down",
    score: runtime.scoreDisplay(),
    scoreLog10: Number.isFinite(scoreLog) ? Number(scoreLog.toPrecision(6)) : null,
    totalScore: runtime.formatHeldUiLogNumber(totalScoreLog),
    totalScoreLog10: Number.isFinite(totalScoreLog) ? Number(totalScoreLog.toPrecision(6)) : null,
    generationScore: runtime.formatHeldUiLogNumber(generationScoreLog),
    generationScoreLog10: Number.isFinite(generationScoreLog) ? Number(generationScoreLog.toPrecision(6)) : null,
    currentGain: runtime.formatUiLogNumber(currentGainLog),
    currentGainLog10: Number.isFinite(currentGainLog) ? Number(currentGainLog.toPrecision(6)) : null,
    finalGainOnCore: runtime.formatUiLogNumber(finalGainLog),
    finalGainOnCoreLog10: Number.isFinite(finalGainLog) ? Number(finalGainLog.toPrecision(6)) : null,
    baseGainExpression: runtime.formatGainExpressionSummary(),
    baseGainExpressionDivisor: gainExpression.divisor,
    baseGainExpressionParts: gainExpression.parts,
    vertices: runtime.effectiveVertexCount(),
    verticesExact: verticesExact.toString(),
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
      speedLevelExact: speedLevelExact.toString(),
      gainLevel: runtime.state.gainLevel,
      gainLevelExact: gainLevelExact.toString(),
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
      countExact: infinityCountExact.toString(),
      points: runtime.formatHeldUiLogNumber(infinityPointsLog, runtime.state.infinityPointsExact),
      pointsLog10: Number.isFinite(infinityPointsLog) ? Number(infinityPointsLog.toPrecision(6)) : null,
      pointGain: infinityPointGainLog10 > runtime.log10Value(Number.MAX_VALUE)
        ? runtime.formatUiLogNumber(infinityPointGainLog10)
        : infinityPointGain,
      pointGainLog10: Number.isFinite(infinityPointGainLog10) ? Number(infinityPointGainLog10.toPrecision(6)) : null,
      infiniteScore: runtime.formatHeldUiLogNumber(infiniteScoreLog),
      infiniteScoreLog10: Number.isFinite(infiniteScoreLog) ? Number(infiniteScoreLog.toPrecision(6)) : null,
      infiniteAngleBoost: Number(runtime.infiniteAngleBoost().toFixed(2)),
      infiniteAngleBoostLog10: Number.isFinite(infiniteAngleBoostLog10) ? Number(infiniteAngleBoostLog10.toPrecision(6)) : null,
      infiniteAngle: {
        unlocked: runtime.state.infiniteAngleUnlocked,
        score: runtime.formatHeldUiLogNumber(infiniteScoreLog),
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
    eternity: {
      count: runtime.state.eternityCount,
      countExact: eternityCountExact.toString(),
      canEternity: runtime.canEternity(),
      pendingGain: runtime.formatUiLogNumber(eternityGainLog10),
      pendingGainLog10: Number.isFinite(eternityGainLog10) ? Number(eternityGainLog10.toPrecision(6)) : null,
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
    timeline: {
      discovered: runtime.timelineDiscovered(),
      earnedTf: runtime.timelineEarnedTf(),
      availableTf: runtime.timelineAvailableTf(),
      spentTf: runtime.timelineSpentTf(),
      parallelSecondsSinceIc8Clear: runtime.timelineParallelSecondsSinceIc8Clear(),
      parallelRawLog10: runtime.timelineParallelRawLog10(),
      parallelEffectiveLog10: runtime.timelineParallelEffectiveLog10(),
      ipGainMultiplierLog10: runtime.timelineIpGainMultiplierLog10(),
      realInfinityCountGainMultiplier: runtime.timelineRealInfinityCountGainMultiplier?.() ?? 1,
      claims: {
        score: runtime.timelineTrackClaimCount("score"),
        ip: runtime.timelineTrackClaimCount("ip"),
        eternity: runtime.timelineTrackClaimCount("eternity"),
      },
      nextRequirements: {
        scoreLog10: runtime.timelineScoreRequirementLog10(),
        ipLog10: runtime.timelineIpRequirementLog10(),
        eternity: timelineEternityRequirement?.toString() || null,
      },
      canClaim: {
        score: runtime.canClaimTimelineTf("score"),
        ip: runtime.canClaimTimelineTf("ip"),
        eternity: runtime.canClaimTimelineTf("eternity"),
      },
      nodes: runtime.timelineNodes().map((node) => {
        const availability = runtime.timelineNodeAvailability(node.id);
        return {
          id: node.id,
          era: node.era,
          route: node.route,
          costTF: node.costTF,
          prerequisites: node.prerequisites,
          name: node.name?.[runtime.state.language] || node.name?.en || node.name?.ja || "",
          canPurchase: availability.canPurchase,
          state: availability.state,
          reason: availability.reason,
        };
      }),
      purchasedNodes: runtime.state.timelinePurchasedNodes,
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
      mainTabPosition: runtime.state.mainTabPosition,
      showTimeFluxQuickBar: runtime.state.showTimeFluxQuickBar,
      hiddenTabs: runtime.normalizeHiddenTabs(runtime.state.hiddenTabs),
      unlockedMainTabs: runtime.normalizeUnlockedMainTabs(runtime.state.unlockedMainTabs),
      activeMainTab,
      activeEternitySubtab,
      activeInfinitySubtab,
      activeChallengeSubtab,
      activeStatisticsSubtab,
    },
    automation: {
      unlocked: runtime.normalAutomationUnlocked?.() || false,
      layerUnlocked: runtime.infinityAutomationUnlocked?.() || false,
      infinityUpgradeUnlocked: runtime.infinityUpgradeAutomationUnlocked?.() || false,
      enabled: runtime.state.automationEnabled,
      speed: runtime.state.autoBuySpeed,
      vertex: runtime.state.autoBuyVertex,
      gain: runtime.state.autoBuyGain,
      infinityUpgrades: runtime.state.autoBuyInfinityUpgrades,
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
      currentEternityRunTime: Number(runtime.state.currentEternityRunTime.toFixed(1)),
      currentEternityRealTime: Number(runtime.state.currentEternityRealTime.toFixed(1)),
      fastestEternityTime: runtime.state.fastestEternityTime > 0 ? Number(runtime.state.fastestEternityTime.toFixed(1)) : null,
      fastestEternityRealTime: runtime.state.fastestEternityRealTime > 0
        ? Number(runtime.state.fastestEternityRealTime.toFixed(1))
        : null,
      lastEternityRuns: runtime.state.lastEternityRuns,
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
      report: runtime.offlineReport,
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
  runtime.switchEternitySubtab(activeEternitySubtab);
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
expose("activeEternitySubtab", () => activeEternitySubtab, (value) => { activeEternitySubtab = value; });
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
expose("runEternityMilestoneAutomation", () => runEternityMilestoneAutomation);
expose("runEternityMilestoneEightAutomation", () => runEternityMilestoneEightAutomation);
expose("update", () => update, (value) => { update = value; });
expose("advanceOnlineTime", () => advanceOnlineTime, (value) => { advanceOnlineTime = value; });
expose("setOfflineBaseline", () => setOfflineBaseline, (value) => { setOfflineBaseline = value; });
expose("setSaveConflictLock", () => setSaveConflictLock, (value) => { setSaveConflictLock = value; });
expose("setOfflineProcessingLock", () => setOfflineProcessingLock);
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
  uiUpdateCount: () => runtime.uiUpdateCount,
  addScore: runtime.addScore,
  update,
  buySpeed: runtime.buySpeed,
  runGeneration: runtime.runGeneration,
  runCoreBoost: runtime.runCoreBoost,
  runInfinity: runtime.runInfinity,
  runEternityMilestoneAutomation: runtime.runEternityMilestoneAutomation,
  canEternity: runtime.canEternity,
  performEternity: runtime.performEternity,
  eternityGain: runtime.eternityGain,
  eternityGainLog10: runtime.eternityGainLog10,
  claimTimelineTf: runtime.claimTimelineTf,
  claimScoreTf: runtime.claimScoreTf,
  claimIpTf: runtime.claimIpTf,
  claimEternityTf: runtime.claimEternityTf,
  canClaimTimelineTf: runtime.canClaimTimelineTf,
  timelineEarnedTf: runtime.timelineEarnedTf,
  timelineAvailableTf: runtime.timelineAvailableTf,
  timelineSpentTf: runtime.timelineSpentTf,
  timelineParallelSecondsSinceIc8Clear: runtime.timelineParallelSecondsSinceIc8Clear,
  timelineParallelRawLog10: runtime.timelineParallelRawLog10,
  timelineParallelEffectiveLog10: runtime.timelineParallelEffectiveLog10,
  timelineRealInfinityCountGainMultiplier: runtime.timelineRealInfinityCountGainMultiplier,
  timelineIpGainMultiplierLog10: runtime.timelineIpGainMultiplierLog10,
  advanceTimelineRunTime: runtime.advanceTimelineRunTime,
  timelineNodes: runtime.timelineNodes,
  timelineNodeAvailability: runtime.timelineNodeAvailability,
  canPurchaseTimelineNode: runtime.canPurchaseTimelineNode,
  purchaseTimelineNode: runtime.purchaseTimelineNode,
  respecTimeline: runtime.respecTimeline,
  maybeForceEternity: runtime.maybeForceEternity,
  selectEternityMilestone: runtime.selectEternityMilestone,
  buyInfinityUpgrade: runtime.buyInfinityUpgrade,
  buyAllInfinityUpgrades: runtime.buyAllInfinityUpgrades,
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
  switchEternitySubtab: runtime.switchEternitySubtab,
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
  processOfflineElapsed: runtime.processOfflineElapsed,
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
