import { runtime, expose } from "./shared.js";

let autoSaveElapsed = 0;
let updateCheckElapsed = 0;
let uiUpdateElapsed = 0;
let smoothedFps = 0;
let renderQualityLevel = "high";
let renderQualityOverride = "";
let renderCostEma = 0;
let renderPressureFrames = 0;
let renderRecoveryFrames = 0;
let lastRenderedFrameAt = -Infinity;

const requestNextFrame = window.requestAnimationFrame
  ? window.requestAnimationFrame.bind(window)
  : (callback) => window.setTimeout(() => callback(currentFrameTime()), 1000 / 60);

const RENDER_QUALITY_PROFILES = Object.freeze({
  high: Object.freeze({ devicePixelRatio: 2, vertexLimit: 720, frameIntervalMs: 0 }),
  balanced: Object.freeze({ devicePixelRatio: 1.5, vertexLimit: 360, frameIntervalMs: 1000 / 30 }),
  low: Object.freeze({ devicePixelRatio: 1, vertexLimit: 180, frameIntervalMs: 1000 / 30 }),
});

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
    runtime.normalAutobuyElapsed += dt;
    if (runtime.normalAutobuyElapsed >= runtime.AUTOBUY_INTERVAL_SECONDS) {
      runtime.normalAutobuyElapsed %= runtime.AUTOBUY_INTERVAL_SECONDS;
      if (runtime.AUTOBUY_INTERVAL_SECONDS - runtime.normalAutobuyElapsed <= 1e-9) runtime.normalAutobuyElapsed = 0;
      runtime.runAutobuyers();
    }
  } else {
    runtime.normalAutobuyElapsed = 0;
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
  if (runtime.runLayerAutomation()) return;

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
    runtime.syncServerClock();
    runtime.checkForRemoteUpdate();
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
  if (document.hidden || runtime.visibilityResumeInFlight || runtime.offlineProcessing || runtime.saveConflictMode) {
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
  const renderStartedAt = runtime.monotonicClockNowMs();
  if (shouldRenderFrame(now)) {
    const canvasRendered = drawActiveView();
    if (canvasRendered) updateRenderQuality(Math.max(0, runtime.monotonicClockNowMs() - renderStartedAt));
  }
  requestNextFrame(frame);
}

expose("autoSaveElapsed", () => autoSaveElapsed, (value) => { autoSaveElapsed = value; });
expose("updateCheckElapsed", () => updateCheckElapsed, (value) => { updateCheckElapsed = value; });
expose("uiUpdateElapsed", () => uiUpdateElapsed, (value) => { uiUpdateElapsed = value; });
expose("smoothedFps", () => smoothedFps, (value) => { smoothedFps = value; });
expose("renderQualityState", () => renderQualityState);
expose("renderVertexLimit", () => renderVertexLimit);
expose("renderDevicePixelRatio", () => renderDevicePixelRatio);
expose("renderFrameIntervalMs", () => renderFrameIntervalMs);
expose("setRenderQualityForTest", () => setRenderQualityForTest);
expose("updateRenderQualityForTest", () => updateRenderQualityForTest);
expose("requestNextFrame", () => requestNextFrame);
expose("currentFrameTime", () => currentFrameTime, (value) => { currentFrameTime = value; });
expose("lastTime", () => lastTime, (value) => { lastTime = value; });
expose("frame", () => frame);
expose("update", () => update, (value) => { update = value; });
expose("advanceOnlineTime", () => advanceOnlineTime, (value) => { advanceOnlineTime = value; });
expose("drawActiveView", () => drawActiveView);

export { requestNextFrame, frame };
