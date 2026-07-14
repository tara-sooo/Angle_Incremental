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
import "./ui/render-time-flux.js";
import "./ui/render-ui.js";
import "./systems/angle.js";
import "./systems/generation.js";
import "./systems/core-boost.js";
import "./systems/infinity.js";
import "./systems/infinite-angle.js";
import "./systems/time-flux.js";
import "./ui/events.js";
import "./systems/balance.js";

let autoSaveElapsed = 0;
let updateCheckElapsed = 0;
let updateCheckInFlight = false;
let japaneseFontReady = false;
let normalAutobuyElapsed = 0;
let uiUpdateElapsed = 0;
let activeMainTab = "angle";
let activeInfinitySubtab = "upgrades";
let activeChallengeSubtab = "ic";
let selectedInfinityUpgradeId = "1-1";
let appliedLanguage = "";
let smoothedFps = 0;
let offlineBaselineTimestamp = Date.now();
let offlineProcessing = false;
let offlineReport = null;
const requestNextFrame = window.requestAnimationFrame
  ? window.requestAnimationFrame.bind(window)
  : (callback) => window.setTimeout(() => callback(currentFrameTime()), 1000 / 60);

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
  if (!runtime.hasInfinityUpgrade("1-2") || !runtime.state.automationEnabled) return;
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
  const infinityAutomationUnlocked = runtime.hasInfinityUpgrade("8-1");
  const generationCoreAutomationUnlocked = runtime.isAchievementUnlocked(19);

  if (
    infinityAutomationUnlocked
    && runtime.state.autoRunInfinity
    && runtime.state.infinityCount > 0
    && runtime.canInfinity()
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

  return false;
}

function update(dt) {
  runtime.state.totalPlayTime += dt;
  runtime.state.currentInfinityRunTime += dt;
  runtime.state.currentGenerationRunTime += dt;
  runtime.updateChallengeTimers(dt);
  runtime.updateInfiniteAngle(dt);

  if (runtime.hasInfinityUpgrade("1-2") && runtime.state.automationEnabled) {
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
  if (vertexSteps > runtime.MAX_VERTEX_STEPS_PER_FRAME || estimatedCoreHits > runtime.MAX_CORE_HITS_PER_FRAME) {
    if (runtime.processManyVertices(start, end)) return;
  } else {
    for (let vertex = start; vertex <= end; vertex += 1) {
      if (runtime.passVertex(vertex % vertices)) return;
    }
  }
  if (runtime.completeChallengeIfReady()) return;
  if (runLayerAutomation()) return;

  runtime.normalizeVertexProgress();
  runtime.state.lastVertexIndex = Math.floor(runtime.state.pointProgress * vertices) % vertices;
  runtime.state.floatingTexts = runtime.state.floatingTexts
    .map((item) => ({ ...item, life: item.life - dt, y: item.y - dt * 26 }))
    .filter((item) => item.life > 0);

  if (!offlineProcessing) {
    autoSaveElapsed += dt;
    if (autoSaveElapsed >= 5) runtime.saveGame("auto");

    updateCheckElapsed += dt;
    if (updateCheckElapsed >= runtime.UPDATE_CHECK_INTERVAL_SECONDS) {
      updateCheckElapsed = 0;
      checkForRemoteUpdate();
    }
  }
}

function advanceOnlineTime(realSeconds) {
  const realDt = Math.max(0, runtime.sanitizeNumber(realSeconds, 0));
  if (realDt <= 0) return 0;
  const selectedSpeed = runtime.clampTimeFluxSpeed(runtime.state.timeFluxSpeed);
  const requestedExtra = realDt * Math.max(0, selectedSpeed - 1);
  const consumed = runtime.consumeTimeFlux(requestedExtra);
  const gameSeconds = realDt + consumed;
  if (consumed + 1e-12 < requestedExtra || (selectedSpeed > 1 && runtime.state.timeFlux <= 1e-12)) {
    runtime.state.timeFluxSpeed = 1;
  }

  let remaining = gameSeconds;
  while (remaining > 0) {
    const step = Math.min(runtime.MAX_SIMULATION_STEP_SECONDS, remaining);
    update(step);
    remaining -= step;
  }
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

function processOfflineElapsed(elapsedSeconds, source = "resume") {
  const elapsed = Math.max(0, runtime.sanitizeNumber(elapsedSeconds, 0));
  if (elapsed <= 0) return null;
  const before = offlineSnapshot();
  let simulatedSeconds = 0;
  let processedTicks = 0;
  let timeFluxGained = 0;
  let capacityReached = false;

  if (runtime.state.offlineProgressEnabled) {
    const tickCount = runtime.clampOfflineTickCount(runtime.state.offlineTickCount);
    const maximumSeconds = tickCount * runtime.OFFLINE_PROGRESS_MAX_SECONDS_PER_TICK;
    simulatedSeconds = Math.min(elapsed, maximumSeconds);
    processedTicks = Math.max(
      1,
      Math.min(tickCount, Math.ceil(simulatedSeconds / runtime.MAX_SIMULATION_STEP_SECONDS)),
    );
    const tickSeconds = simulatedSeconds / processedTicks;
    offlineProcessing = true;
    try {
      for (let tick = 0; tick < processedTicks; tick += 1) update(tickSeconds);
    } finally {
      offlineProcessing = false;
    }
  } else {
    const theoreticalGain = runtime.timeFluxGainPerHour() * elapsed / 3600;
    timeFluxGained = runtime.addTimeFlux(theoreticalGain);
    capacityReached = timeFluxGained + 1e-9 < theoreticalGain;
  }

  const after = offlineSnapshot();
  offlineReport = {
    source,
    elapsedSeconds: elapsed,
    simulatedSeconds,
    processedTicks,
    capped: runtime.state.offlineProgressEnabled && simulatedSeconds + 1e-9 < elapsed,
    offlineProgressEnabled: runtime.state.offlineProgressEnabled,
    timeFluxGained,
    capacityReached,
    infinityCountBefore: before.infinityCount,
    infinityCountAfter: after.infinityCount,
    infinityPointsBeforeLog10: before.infinityPointsLog10,
    infinityPointsAfterLog10: after.infinityPointsLog10,
    infiniteScoreBeforeLog10: before.infiniteScoreLog10,
    infiniteScoreAfterLog10: after.infiniteScoreLog10,
  };
  runtime.updateUi();
  runtime.saveGame("manual");
  return offlineReport;
}

function setOfflineBaseline(timestamp = Date.now()) {
  const value = runtime.sanitizeNumber(timestamp, Date.now());
  offlineBaselineTimestamp = Number.isFinite(value) ? value : Date.now();
}

function handleVisibilityChange() {
  if (document.hidden) {
    runtime.saveGame("auto");
    setOfflineBaseline(Date.now());
    return;
  }
  const elapsed = Math.max(0, (Date.now() - offlineBaselineTimestamp) / 1000);
  if (elapsed > 0) processOfflineElapsed(elapsed, "visibility");
  else setOfflineBaseline(Date.now());
}

function currentFrameTime() {
  return window.performance && performance.now ? performance.now() : Date.now();
}

function drawActiveView() {
  if (runtime.activeMainTab === "angle") runtime.draw();
  if (runtime.activeMainTab === "infinity" && runtime.activeInfinitySubtab === "angle") runtime.drawInfiniteAngle();
}

let lastTime = currentFrameTime();
function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.08);
  if (dt > 0) {
    const instantFps = 1 / dt;
    smoothedFps = smoothedFps === 0 ? instantFps : smoothedFps * 0.9 + instantFps * 0.1;
  }
  lastTime = now;
  if (document.hidden) {
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
  drawActiveView();
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
        speedLevel: runtime.state.infiniteAngleSpeedLevel,
        vertexLevel: runtime.state.infiniteAngleVertexLevel,
        gainLevel: runtime.state.infiniteAngleGainLevel,
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
      nextFloor: runtime.towerNextFloor(),
      nextCostLog10: Number(runtime.towerNextFloorCostLog10().toPrecision(6)),
      gate: runtime.towerGateForFloor(runtime.towerNextFloor()),
      canBuild: runtime.canBuildTower(),
      challengeCount: runtime.TOWER_CHALLENGE_COUNT,
    },
    achievements: {
      unlocked: runtime.achievementCount(),
      total: runtime.ACHIEVEMENT_COUNT,
      gainMultiplier: Number(runtime.achievementGainMultiplier().toFixed(4)),
      vertexGainIncrease: Number(runtime.vertexGainIncrease().toPrecision(6)),
      vertexGainIncreaseLog10: Number(runtime.vertexGainIncreaseLog10().toPrecision(6)),
      mask: runtime.state.achievementMask,
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
      activeMainTab,
      activeInfinitySubtab,
      activeChallengeSubtab,
    },
    automation: {
      unlocked: runtime.hasInfinityUpgrade("1-2"),
      layerUnlocked: runtime.hasInfinityUpgrade("8-1"),
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
      currentInfinityRunTime: Number(runtime.state.currentInfinityRunTime.toFixed(1)),
      fastestInfinityTime: runtime.state.fastestInfinityTime > 0 ? Number(runtime.state.fastestInfinityTime.toFixed(1)) : null,
      lastInfinityRuns: runtime.state.lastInfinityRuns,
    },
    timeFlux: {
      amount: Number(runtime.state.timeFlux.toPrecision(6)),
      capacity: Number(runtime.timeFluxCapacity().toPrecision(6)),
      gainPerHour: Number(runtime.timeFluxGain().toPrecision(6)),
      capacityLevel: runtime.state.timeFluxCapacityLevel,
      gainLevel: runtime.state.timeFluxGainLevel,
      speed: runtime.state.timeFluxSpeed,
      offlineProgressEnabled: runtime.state.offlineProgressEnabled,
      offlineTickCount: runtime.state.offlineTickCount,
      report: offlineReport,
    },
  });
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
expose("selectedInfinityUpgradeId", () => selectedInfinityUpgradeId, (value) => { selectedInfinityUpgradeId = value; });
expose("appliedLanguage", () => appliedLanguage, (value) => { appliedLanguage = value; });
expose("smoothedFps", () => smoothedFps, (value) => { smoothedFps = value; });
expose("offlineBaselineTimestamp", () => offlineBaselineTimestamp, (value) => { offlineBaselineTimestamp = value; });
expose("offlineProcessing", () => offlineProcessing, (value) => { offlineProcessing = value; });
expose("offlineReport", () => offlineReport, (value) => { offlineReport = value; });
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
expose("update", () => update, (value) => { update = value; });
expose("advanceOnlineTime", () => advanceOnlineTime, (value) => { advanceOnlineTime = value; });
expose("processOfflineElapsed", () => processOfflineElapsed, (value) => { processOfflineElapsed = value; });
expose("setOfflineBaseline", () => setOfflineBaseline, (value) => { setOfflineBaseline = value; });
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
  state: runtime.state,
  addScore: runtime.addScore,
  update,
  buySpeed: runtime.buySpeed,
  runGeneration: runtime.runGeneration,
  runCoreBoost: runtime.runCoreBoost,
  runInfinity: runtime.runInfinity,
  buyInfinityUpgrade: runtime.buyInfinityUpgrade,
  buyAllUpgrades: runtime.buyAllUpgrades,
  generationRewardFor: runtime.generationRewardFor,
  generationScoreMultiplierEffectLog10: runtime.generationScoreMultiplierEffectLog10,
  unlockInfiniteAngle: runtime.unlockInfiniteAngle,
  buyInfiniteAngleUpgrade: runtime.buyInfiniteAngleUpgrade,
  buyTimeFluxUpgrade: runtime.buyTimeFluxUpgrade,
  setTimeFluxSpeed: runtime.setTimeFluxSpeed,
  updateInfiniteAngle: runtime.updateInfiniteAngle,
  toggleInfinityChallenge: runtime.toggleInfinityChallenge,
  breakInfiniteCap: runtime.breakInfiniteCap,
  checkAchievements: runtime.checkAchievements,
  switchMainTab: runtime.switchMainTab,
  switchInfinitySubtab: runtime.switchInfinitySubtab,
  switchChallengeSubtab: runtime.switchChallengeSubtab,
  buildTower: runtime.buildTower,
  applySetting: runtime.applySetting,
  advanceOnlineTime,
  processOfflineElapsed,
  saveGame: runtime.saveGame,
  loadGame: runtime.loadGame,
  resetSave: runtime.resetSave,
  exportSaveCode: runtime.exportSaveCode,
  importSaveCode: runtime.importSaveCode,
  completeChallengeIfReady: runtime.completeChallengeIfReady,
};

runtime.bindEvents();
runtime.createChallengeRows();
runtime.createTowerChallengeRows();
runtime.createInfinityUpgradeRows();
runtime.createAchievementRows();
runtime.loadGame();
runtime.switchMainTab(activeMainTab);
runtime.switchInfinitySubtab(activeInfinitySubtab);
runtime.switchChallengeSubtab(activeChallengeSubtab);
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
