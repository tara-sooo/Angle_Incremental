import { runtime, expose } from "./runtime/shared.js";
import "./ui/dom.js";
import "./core/constants.js";
import "./data/i18n.js";
import "./data/infinity-data.js";
import "./core/state.js";
import "./core/numbers.js";
import "./core/save.js";
import "./systems/achievements.js";
import "./ui/render-canvas.js";
import "./ui/render-ui.js";
import "./systems/angle.js";
import "./systems/generation.js";
import "./systems/core-boost.js";
import "./systems/infinity.js";
import "./ui/events.js";











let autoSaveElapsed = 0;
let updateCheckElapsed = 0;
let updateCheckInFlight = false;
let japaneseFontReady = false;
let normalAutobuyElapsed = 0;
let uiUpdateElapsed = 0;
let activeMainTab = "angle";
let activeInfinitySubtab = "upgrades";
let selectedInfinityUpgradeId = "1-1";
let appliedLanguage = "";
let smoothedFps = 0;
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





function update(dt) {
  runtime.state.totalPlayTime += dt;
  runtime.state.currentInfinityRunTime += dt;
  runtime.updateChallengeTimers(dt);

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
  runtime.state.totalVertexProgress += (dt / runtime.lapDuration()) * runtime.state.vertices;
  const nearestVertex = Math.round(runtime.state.totalVertexProgress);
  if (Math.abs(runtime.state.totalVertexProgress - nearestVertex) < runtime.VERTEX_EPSILON) {
    runtime.state.totalVertexProgress = nearestVertex;
  }
  runtime.state.pointProgress = (runtime.state.totalVertexProgress / runtime.state.vertices) % 1;

  const start = Math.floor(previousAbsolute + runtime.VERTEX_EPSILON) + 1;
  const end = Math.floor(runtime.state.totalVertexProgress + runtime.VERTEX_EPSILON);
  const vertexSteps = end - start + 1;
  if (vertexSteps > runtime.MAX_VERTEX_STEPS_PER_FRAME) {
    if (runtime.processManyVertices(start, end)) return;
  } else {
    for (let vertex = start; vertex <= end; vertex += 1) {
      if (runtime.passVertex(vertex % runtime.state.vertices)) return;
    }
  }
  if (runtime.completeChallengeIfReady()) return;

  runtime.normalizeVertexProgress();
  runtime.state.lastVertexIndex = Math.floor(runtime.state.pointProgress * runtime.state.vertices) % runtime.state.vertices;
  runtime.state.floatingTexts = runtime.state.floatingTexts
    .map((item) => ({ ...item, life: item.life - dt, y: item.y - dt * 26 }))
    .filter((item) => item.life > 0);

  autoSaveElapsed += dt;
  if (autoSaveElapsed >= 5) runtime.saveGame("auto");

  updateCheckElapsed += dt;
  if (updateCheckElapsed >= runtime.UPDATE_CHECK_INTERVAL_SECONDS) {
    updateCheckElapsed = 0;
    checkForRemoteUpdate();
  }
}





















































function currentFrameTime() {
  return window.performance && performance.now ? performance.now() : Date.now();
}

let lastTime = currentFrameTime();
function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.08);
  if (dt > 0) {
    const instantFps = 1 / dt;
    smoothedFps = smoothedFps === 0 ? instantFps : smoothedFps * 0.9 + instantFps * 0.1;
  }
  lastTime = now;
  let remaining = dt;
  while (remaining > 0) {
    const step = Math.min(runtime.MAX_SIMULATION_STEP_SECONDS, remaining);
    update(step);
    remaining -= step;
  }
  uiUpdateElapsed += dt;
  if (uiUpdateElapsed >= runtime.UI_UPDATE_INTERVAL_SECONDS) {
    uiUpdateElapsed %= runtime.UI_UPDATE_INTERVAL_SECONDS;
    runtime.updateUi();
  }
  runtime.draw();
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
    vertices: runtime.state.vertices,
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
      activeChallenge: runtime.state.activeChallenge,
      completedChallenges: runtime.completedChallengeCount(),
      challengeCount: runtime.INFINITY_CHALLENGE_COUNT,
      challengesUnlocked: runtime.infinityChallengesUnlocked(),
      activeChallengeName: runtime.state.activeChallenge > 0 ? runtime.challengeName(runtime.state.activeChallenge) : runtime.challengeName(0),
      softcapPower: Number(runtime.infinitySoftcapPower().toFixed(3)),
      capBroken: runtime.state.infiniteCapBroken,
      canBreakCap: runtime.canBreakInfiniteCap(),
      infiniteAngleConversionCost: runtime.formatUiLogNumber(runtime.infiniteAngleConversionCostLog10()),
      infiniteAngleConversionCostLog10: runtime.INFINITE_ANGLE_CONVERSION_COST_LOG10,
      selectedUpgrade: selectedInfinityUpgradeId,
      selectedUpgradeCanBuy: runtime.canBuyInfinityUpgrade(selectedInfinityUpgradeId),
      upgrades: runtime.INFINITY_UPGRADES.map((upgrade) => ({
        id: upgrade.id,
        purchased: runtime.hasInfinityUpgrade(upgrade.id),
        canBuy: runtime.canBuyInfinityUpgrade(upgrade.id),
      })),
    },
    achievements: {
      unlocked: runtime.achievementCount(),
      total: runtime.ACHIEVEMENT_COUNT,
      gainMultiplier: Number(runtime.achievementGainMultiplier().toFixed(4)),
      vertexGainIncrease: Number(runtime.vertexGainIncrease().toPrecision(6)),
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
    },
    automation: {
      unlocked: runtime.hasInfinityUpgrade("1-2"),
      enabled: runtime.state.automationEnabled,
      speed: runtime.state.autoBuySpeed,
      vertex: runtime.state.autoBuyVertex,
      gain: runtime.state.autoBuyGain,
    },
    statistics: {
      totalPlayTime: Number(runtime.state.totalPlayTime.toFixed(1)),
      currentInfinityRunTime: Number(runtime.state.currentInfinityRunTime.toFixed(1)),
      fastestInfinityTime: runtime.state.fastestInfinityTime > 0 ? Number(runtime.state.fastestInfinityTime.toFixed(1)) : null,
      lastInfinityRuns: runtime.state.lastInfinityRuns,
    },
  });
}

// BEGIN INTEGRATED BALANCE RULES
// This section is part of the engine so reset, save, UI, and input bindings share one source of truth.
// 0.1.0 balance profile.
// Generation owns score scaling; early upgrade scaling no longer changes with GR or CB count.






































const balanceResetBelowCoreBoost = runtime.resetBelowCoreBoost;
const balanceResetBelowInfinity = runtime.resetBelowInfinity;
const balanceApplySaveData = runtime.applySaveData;



expose("autoSaveElapsed", () => autoSaveElapsed, (value) => { autoSaveElapsed = value; });
expose("updateCheckElapsed", () => updateCheckElapsed, (value) => { updateCheckElapsed = value; });
expose("updateCheckInFlight", () => updateCheckInFlight, (value) => { updateCheckInFlight = value; });
expose("japaneseFontReady", () => japaneseFontReady, (value) => { japaneseFontReady = value; });
expose("normalAutobuyElapsed", () => normalAutobuyElapsed, (value) => { normalAutobuyElapsed = value; });
expose("uiUpdateElapsed", () => uiUpdateElapsed, (value) => { uiUpdateElapsed = value; });
expose("activeMainTab", () => activeMainTab, (value) => { activeMainTab = value; });
expose("activeInfinitySubtab", () => activeInfinitySubtab, (value) => { activeInfinitySubtab = value; });
expose("selectedInfinityUpgradeId", () => selectedInfinityUpgradeId, (value) => { selectedInfinityUpgradeId = value; });
expose("appliedLanguage", () => appliedLanguage, (value) => { appliedLanguage = value; });
expose("smoothedFps", () => smoothedFps, (value) => { smoothedFps = value; });
expose("requestNextFrame", () => requestNextFrame);
expose("shouldShowUpdateModal", () => shouldShowUpdateModal, (value) => { shouldShowUpdateModal = value; });
expose("closeUpdateModal", () => closeUpdateModal, (value) => { closeUpdateModal = value; });
expose("showUpdateModalIfNeeded", () => showUpdateModalIfNeeded, (value) => { showUpdateModalIfNeeded = value; });
expose("storedUpdateReloadTime", () => storedUpdateReloadTime, (value) => { storedUpdateReloadTime = value; });
expose("markUpdateDeferred", () => markUpdateDeferred, (value) => { markUpdateDeferred = value; });
expose("reloadForRemoteUpdate", () => reloadForRemoteUpdate, (value) => { reloadForRemoteUpdate = value; });
expose("checkForRemoteUpdate", () => checkForRemoteUpdate, (value) => { checkForRemoteUpdate = value; });
expose("runAutobuyers", () => runAutobuyers, (value) => { runAutobuyers = value; });
expose("update", () => update, (value) => { update = value; });
expose("currentFrameTime", () => currentFrameTime, (value) => { currentFrameTime = value; });
expose("lastTime", () => lastTime, (value) => { lastTime = value; });
expose("frame", () => frame, (value) => { frame = value; });
expose("renderGameToText", () => renderGameToText, (value) => { renderGameToText = value; });
expose("balanceResetBelowCoreBoost", () => balanceResetBelowCoreBoost);
expose("balanceResetBelowInfinity", () => balanceResetBelowInfinity);
expose("balanceApplySaveData", () => balanceApplySaveData);

runtime.INFINITY_CHALLENGES[6].restriction = {
  ja: "ショップの価格が1e30を超えると、通常アップグレードを購入できなくなる",
  en: "Normal upgrades whose cost exceeds 1e30 cannot be bought.",
};

runtime.generationRewardForLog = runtime.balanceGenerationRewardForLog;
runtime.earlyLayerCostScalingFactor = () => 1;
runtime.preGenerationCostScalingLog10 = runtime.balancePreGenerationCostScalingLog10;
runtime.canBuyNormalUpgrade = runtime.balanceCanBuyNormalUpgrade;
runtime.infinityPointGain = runtime.balanceInfinityPointGain;
runtime.costLog10 = runtime.balanceCostLog10;
runtime.rawLapSpeedLog10 = runtime.balanceRawLapSpeedLog10;
runtime.generationScorePower = runtime.balanceGenerationScorePower;
runtime.coreBoostGainIncreaseMultiplier = runtime.balanceCoreBoostGainIncreaseMultiplier;
runtime.vertexGainIncrease = runtime.balanceVertexGainIncrease;
runtime.runGeneration = runtime.balanceRunGeneration;
runtime.nextGenerationValues = runtime.balanceNextGenerationValues;
runtime.resetBelowCoreBoost = function balanceResetCoreBoost() {
  balanceResetBelowCoreBoost();
  runtime.balanceApplyResetStartScore();
};
runtime.resetBelowInfinity = function balanceResetInfinity() {
  balanceResetBelowInfinity();
  runtime.balanceApplyResetStartScore();
};
runtime.applySaveData = function balanceApplySaveDataWrapper(data, saveVersion) {
  balanceApplySaveData(data, saveVersion);
  runtime.balanceRestoreGenerationCostFactor(data && data.generationCostFactor, data && data.infinityUpgradeMask);
};
runtime.createInfinityUpgradeRows = runtime.balanceCreateInfinityUpgradeRows;

runtime.balanceRestoreGenerationCostFactorFromLocalSave();
if (typeof runtime.updateUi === "function") runtime.updateUi();
if (typeof runtime.draw === "function") runtime.draw();
// END INTEGRATED BALANCE RULES

window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) update(1 / 60);
  uiUpdateElapsed = 0;
  runtime.updateUi();
  runtime.draw();
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
  convertIpToInfiniteScore: runtime.convertIpToInfiniteScore,
  toggleInfinityChallenge: runtime.toggleInfinityChallenge,
  breakInfiniteCap: runtime.breakInfiniteCap,
  checkAchievements: runtime.checkAchievements,
  switchMainTab: runtime.switchMainTab,
  switchInfinitySubtab: runtime.switchInfinitySubtab,
  applySetting: runtime.applySetting,
  saveGame: runtime.saveGame,
  loadGame: runtime.loadGame,
  resetSave: runtime.resetSave,
  exportSaveCode: runtime.exportSaveCode,
  importSaveCode: runtime.importSaveCode,
  completeChallengeIfReady: runtime.completeChallengeIfReady,
};

runtime.bindEvents();
runtime.createChallengeRows();
runtime.createInfinityUpgradeRows();
runtime.createAchievementRows();
runtime.loadGame();
runtime.switchMainTab(activeMainTab);
runtime.switchInfinitySubtab(activeInfinitySubtab);
runtime.resizeCanvas();
runtime.updateUi();
showUpdateModalIfNeeded();
checkForRemoteUpdate();
if (document.fonts) {
  document.fonts.ready.then(() => {
    japaneseFontReady = true;
    runtime.updateUi();
    runtime.draw();
  });
} else {
  japaneseFontReady = true;
}
requestNextFrame(frame);
