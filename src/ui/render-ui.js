import { runtime, expose } from "../runtime/shared.js";
import { formatExactInteger } from "./format-exact-integer.js";
import { updateSaveRecoveryUi } from "./render-save-recovery.js";
import { updateTimelineUi } from "./render-timeline.js";
import { updateEternityUi } from "./render-eternity.js";
import { updateTopBar } from "./render-topbar.js";
import { updateChallengeRows, updateTowerChallengeRows } from "./render-challenges.js";
import { updateInfinityUpgradeRows } from "./render-infinity.js";
import { updateAchievementRows } from "./render-achievements.js";
import { updateAutomationUi, updateStatisticsUi } from "./render-automation.js";
import { updateOfflineReportUi } from "./render-offline-report.js";
import { updateHelpUi } from "./render-help.js";

// Shared form helpers and the UI update orchestrator.

let appliedLanguage = "";

function applyLanguage() {
  if (runtime.appliedLanguage === runtime.state.language) return;
  runtime.appliedLanguage = runtime.state.language;
  document.documentElement.lang = runtime.state.language;
  runtime.elements.i18nNodes.forEach((node) => {
    const key = node.dataset.i18n;
    if (key) node.textContent = runtime.t(key);
  });
  if (runtime.elements.numberFormatSelect) {
    runtime.elements.numberFormatSelect.querySelector('[value="compact"]').textContent = runtime.t("numberCompact");
    runtime.elements.numberFormatSelect.querySelector('[value="scientific"]').textContent = runtime.t("numberScientific");
    runtime.elements.numberFormatSelect.querySelector('[value="detailed"]').textContent = runtime.t("numberDetailed");
  }
  if (runtime.elements.timeUnitSelect) {
    runtime.elements.timeUnitSelect.querySelector('[value="auto"]').textContent = runtime.t("timeAuto");
    runtime.elements.timeUnitSelect.querySelector('[value="seconds"]').textContent = runtime.t("timeSeconds");
    runtime.elements.timeUnitSelect.querySelector('[value="milliseconds"]').textContent = runtime.t("timeMilliseconds");
  }
  if (runtime.elements.topBarModeSelect) {
    runtime.elements.topBarModeSelect.querySelector('[value="news"]').textContent = runtime.t("topBarNewsOption");
    runtime.elements.topBarModeSelect.querySelector('[value="resources"]').textContent = runtime.t("topBarResourcesOption");
    runtime.elements.topBarModeSelect.querySelector('[value="progress"]').textContent = runtime.t("topBarProgressOption");
    runtime.elements.topBarModeSelect.querySelector('[value="blank"]').textContent = runtime.t("topBarBlankOption");
    runtime.elements.topBarModeSelect.querySelector('[value="hidden"]').textContent = runtime.t("topBarHiddenOption");
  }
}

function syncFormControl(control, value) {
  if (!control || document.activeElement === control) return;
  if (control.type === "checkbox") {
    control.checked = Boolean(value);
  } else {
    control.value = value;
  }
}

function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function formatInfiniteAngleLevel(kind) {
  const level = runtime.infiniteAngleEffectiveUpgradeLevel(kind);
  const freeLevel = runtime.infiniteAngleFreeUpgradeLevel(kind);
  return `Lv ${level}${freeLevel > 0 ? ` (+${freeLevel})` : ""}`;
}

function exactNormalUpgradeValue(kind, fallback = 0n) {
  return runtime.parseExactInteger(runtime.normalUpgradeLevelExact?.(kind), fallback);
}

function formatNormalUpgradeTotal(level, exactValue = null) {
  if (exactValue !== null) return formatExactInteger(exactValue);
  return level < 1000 ? runtime.formatSmallDecimal(level) : runtime.formatUiNumber(level);
}

function formatNormalUpgradeLevel(kind, rawLevel, effectiveLevel, freeLevel, freeExact) {
  const rawValue = exactNormalUpgradeValue(
    kind,
    BigInt(Math.max(0, Math.floor(Number(rawLevel) || 0))),
  );
  const rawText = formatExactInteger(rawValue);
  const freeText = formatExactInteger(freeExact, BigInt(Math.max(0, Math.floor(Number(freeLevel) || 0))));
  return freeLevel > 0
    ? `Lv ${formatNormalUpgradeTotal(effectiveLevel)} (+${freeText})`
    : formatEffectiveLevel(rawText, effectiveLevel, rawValue);
}

function canSpendLog(amountLog) {
  return runtime.currentScoreLog10() >= amountLog;
}

function canSpend(amount) {
  return canSpendLog(runtime.log10Value(amount));
}

function formatVertexGainIncrease(log10Value) {
  if (typeof log10Value !== "number" || Number.isNaN(log10Value) || log10Value === -Infinity) return "0";
  if (log10Value === Infinity || log10Value === Number.MAX_VALUE) return "∞";
  if (log10Value < 3) return runtime.formatSmallDecimal(runtime.valueFromLog10(log10Value));
  return runtime.formatUiLogNumber(log10Value);
}

function updateUi() {
  if (runtime.offlineProcessing) {
    updateEternityUi();
    return;
  }
  const currentCostLogs = runtime.costLogs();
  const unlockedAchievementsNow = runtime.checkAchievements(true);
  const discoveredMainTabs = runtime.discoverMainTabs?.() === true;
  if (unlockedAchievementsNow.length > 0 || discoveredMainTabs) runtime.saveGame("manual");
  document.documentElement.classList.toggle("light-effects", runtime.state.lightEffects);
  runtime.elements.shell.classList.toggle("main-tabs-right", runtime.state.mainTabPosition !== "bottom");
  applyLanguage();
  updateHelpUi();
  runtime.updateMainTabVisibility?.();
  updateTopBar();
  runtime.elements.scoreValue.textContent = runtime.scoreDisplay();
  runtime.elements.gainValue.textContent = runtime.formatUiLogNumber(runtime.finalScoreGainLog10());
  const vertexGainIncreaseLog10 = runtime.vertexGainIncreaseLog10();
  runtime.elements.vertexGainValue.textContent = `+${formatVertexGainIncrease(vertexGainIncreaseLog10)}`;
  runtime.elements.lapValue.textContent = runtime.formatDuration(runtime.lapDuration());
  runtime.elements.lapSpeedValue.textContent = formatMultiplierLog(runtime.effectiveLapSpeedLog10());
  if (runtime.isLapSpeedSoftcapped()) runtime.elements.lapSpeedValue.textContent += " " + runtime.t("lapSpeedSoftcapped");
  const freeNormalUpgradeLevelExact = runtime.parseExactInteger(
    runtime.eternityMilestoneNormalUpgradeBonusLevelExact?.(),
    0n,
  );
  const freeNormalUpgradeLevel = runtime.numberFromExactInteger(freeNormalUpgradeLevelExact);
  const effectiveSpeedLevel = runtime.effectiveSpeedLevel();
  const effectiveVertexCount = runtime.effectiveVertexCount();
  const effectiveGainLevel = runtime.effectiveGainLevel();
  runtime.elements.speedLevel.textContent = formatNormalUpgradeLevel(
    "speed",
    runtime.state.speedLevel,
    effectiveSpeedLevel,
    freeNormalUpgradeLevel,
    freeNormalUpgradeLevelExact,
  );
  const verticesExact = runtime.currentExactIntegerState(runtime.state, "verticesExact", "vertices", 3n);
  const vertices = runtime.numberFromExactInteger(verticesExact);
  const effectiveVertexText = formatNormalUpgradeTotal(effectiveVertexCount);
  runtime.elements.vertexCount.textContent = freeNormalUpgradeLevel > 0
    ? `${effectiveVertexText} ${runtime.t("vertices")} (+${formatExactInteger(freeNormalUpgradeLevelExact)})`
    : effectiveVertexCount === vertices
      ? `${formatExactInteger(verticesExact)} ${runtime.t("vertices")}`
      : Number.isFinite(vertices)
        && Number.isFinite(effectiveVertexCount)
        && Math.abs(vertices) < Number.MAX_SAFE_INTEGER
        && Math.abs(effectiveVertexCount) < Number.MAX_SAFE_INTEGER
        ? `${effectiveVertexText} ${runtime.t("vertices")} (${vertices} + ${effectiveVertexCount - vertices})`
        : `${effectiveVertexText} ${runtime.t("vertices")} (purchased ${formatExactInteger(verticesExact)})`;
  runtime.elements.gainLevel.textContent = formatNormalUpgradeLevel(
    "gain",
    runtime.state.gainLevel,
    effectiveGainLevel,
    freeNormalUpgradeLevel,
    freeNormalUpgradeLevelExact,
  );
  runtime.elements.speedCost.textContent = `${runtime.t("cost")} ${runtime.formatUiLogNumber(currentCostLogs.speed)}`;
  runtime.elements.vertexCost.textContent = `${runtime.t("cost")} ${runtime.formatUiLogNumber(currentCostLogs.vertex)}`;
  runtime.elements.gainCost.textContent = `${runtime.t("cost")} ${runtime.formatUiLogNumber(currentCostLogs.gain)}`;
  const canBuyNormal = {
    speed: runtime.canBuyNormalUpgrade("speed"),
    vertex: runtime.canBuyNormalUpgrade("vertex"),
    gain: runtime.canBuyNormalUpgrade("gain"),
  };
  runtime.elements.speedUpgrade.disabled = !canBuyNormal.speed;
  runtime.elements.vertexUpgrade.disabled = !canBuyNormal.vertex;
  runtime.elements.gainUpgrade.disabled = !canBuyNormal.gain;
  runtime.elements.buyAllUpgrade.disabled = !canBuyNormal.speed && !canBuyNormal.vertex && !canBuyNormal.gain;

  const ready = runtime.canRunGeneration();
  runtime.elements.generationButton.disabled = !ready;
  runtime.elements.generationCount.textContent = String(runtime.state.generationCount);
  const previousGenerationScoreLog10 = runtime.currentPreviousGenerationScoreLog10();
  runtime.elements.previousGenerationScore.textContent = Number.isFinite(previousGenerationScoreLog10)
    ? runtime.formatUiLogNumber(previousGenerationScoreLog10)
    : runtime.t("generationNotRun");
  const nextGeneration = runtime.nextGenerationValues();
  runtime.elements.generationMultiplier.textContent = formatMultiplierLogPreview(runtime.generationScoreMultiplierEffectLog10(), nextGeneration.scoreMultiplierLog10);
  runtime.elements.generationCostFactor.textContent = formatMultiplierPreview(runtime.generationCostFactorEffect(), nextGeneration.costFactor);

  runtime.elements.coreBoostCount.textContent = String(runtime.state.coreBoostCount);
  runtime.elements.coreBoostRequirement.textContent = runtime.formatUiLogNumber(runtime.coreBoostRequirementLog10());
  runtime.elements.coreBoostRequirementGrowthPower.textContent = `^${runtime.coreBoostRequirementGrowthPower().toFixed(3)}`;
  const nextCoreBoost = runtime.nextCoreBoostValues();
  runtime.elements.coreBoostGainBoost.textContent = formatMultiplierPreview(runtime.coreBoostGainIncreaseMultiplier(), nextCoreBoost.gainMultiplier);
  runtime.elements.coreBoostExponent.textContent = formatExponentPreview(runtime.coreBoostGainExponent(), nextCoreBoost.gainExponent);
  runtime.elements.coreBoostButton.disabled = !runtime.canCoreBoost();

  const infinityCountExact = runtime.currentExactIntegerState(runtime.state, "infinityCountExact", "infinityCount");
  runtime.elements.infinityCount.textContent = formatExactInteger(infinityCountExact);
  const infinityReady = runtime.canInfinity();
  const infinityUnlocked = infinityCountExact > 0n;
  runtime.elements.infinityTabState.textContent = infinityReady ? "READY" : infinityUnlocked ? "OPEN" : "LOCKED";
  runtime.elements.infinityUnlockNote.hidden = infinityUnlocked;
  runtime.elements.infinityUnlockNote.textContent = runtime.t("infinityUnlockNote")
    .replace("{score}", runtime.formatUiLogNumber(runtime.INFINITY_REQUIREMENT_LOG10));
  runtime.elements.infinityPoints.textContent = runtime.formatHeldUiLogNumber(
    runtime.currentInfinityPointsLog10(),
    runtime.state.infinityPointsExact,
  );
  runtime.elements.infiniteScorePanel.textContent = runtime.formatHeldUiLogNumber(runtime.currentInfiniteScoreLog10());
  const infiniteAngleBoostLog10 = runtime.infiniteAngleBoostLog10();
  runtime.elements.infiniteAngleBoostPanel.textContent = formatMultiplierLog(infiniteAngleBoostLog10);
  runtime.elements.infinityPointGain.textContent = `+${runtime.formatUiLogNumber(runtime.infinityPointGainLog10())} IP`;
  runtime.elements.infinityButton.disabled = infinityCountExact === 0n || !runtime.canInfinity();
  updateInfinityUpgradeRows();
  const infiniteAngleUnlocked = runtime.state.infiniteAngleUnlocked;
  const infiniteAngleUnlockCostLog10 = runtime.infiniteAngleUnlockCostLog10();
  const infiniteAngleUpgradeCosts = {
    speed: runtime.infiniteAngleUpgradeCostLog10("speed"),
    vertex: runtime.infiniteAngleUpgradeCostLog10("vertex"),
    gain: runtime.infiniteAngleUpgradeCostLog10("gain"),
  };
  runtime.elements.infiniteAngleUnlockNote.hidden = infiniteAngleUnlocked;
  runtime.elements.infiniteAngleUnlockButton.hidden = infiniteAngleUnlocked;
  runtime.elements.infiniteAngleUnlockButton.disabled = !runtime.canUnlockInfiniteAngle();
  runtime.elements.infiniteAngleBuyAllUpgrade.disabled = !runtime.canBuyInfiniteAngleUpgrade("speed")
    && !runtime.canBuyInfiniteAngleUpgrade("vertex")
    && !runtime.canBuyInfiniteAngleUpgrade("gain");
  runtime.elements.infiniteAngleUnlockCost.textContent = `${runtime.t("infinityUpgradeCost")} ${runtime.formatUiLogNumber(infiniteAngleUnlockCostLog10)} IP`;
  runtime.elements.infiniteAngleVertexCount.textContent = `${runtime.infiniteAngleVertexCount()} ${runtime.t("infiniteAngleVertices")}`;
  runtime.elements.infiniteAngleCurrentGain.textContent = runtime.formatUiLogNumber(runtime.infiniteAngleCurrentGainLog10());
  runtime.elements.infiniteAngleLap.textContent = runtime.formatDuration(runtime.infiniteAngleLapDuration());
  runtime.elements.infiniteAngleSpeedLevel.textContent = formatInfiniteAngleLevel("speed");
  runtime.elements.infiniteAngleVertexLevel.textContent = formatInfiniteAngleLevel("vertex");
  runtime.elements.infiniteAngleGainLevel.textContent = formatInfiniteAngleLevel("gain");
  runtime.elements.infiniteAngleSpeedCost.textContent = `${runtime.t("infinityUpgradeCost")} ${runtime.formatUiLogNumber(infiniteAngleUpgradeCosts.speed)} IP`;
  runtime.elements.infiniteAngleVertexCost.textContent = `${runtime.t("infinityUpgradeCost")} ${runtime.formatUiLogNumber(infiniteAngleUpgradeCosts.vertex)} IP`;
  runtime.elements.infiniteAngleGainCost.textContent = `${runtime.t("infinityUpgradeCost")} ${runtime.formatUiLogNumber(infiniteAngleUpgradeCosts.gain)} IP`;
  const canBuyInfiniteAngle = {
    speed: runtime.canBuyInfiniteAngleUpgrade("speed"),
    vertex: runtime.canBuyInfiniteAngleUpgrade("vertex"),
    gain: runtime.canBuyInfiniteAngleUpgrade("gain"),
  };
  runtime.elements.infiniteAngleSpeedUpgrade.disabled = !canBuyInfiniteAngle.speed;
  runtime.elements.infiniteAngleVertexUpgrade.disabled = !canBuyInfiniteAngle.vertex;
  runtime.elements.infiniteAngleGainUpgrade.disabled = !canBuyInfiniteAngle.gain;
  const completed = runtime.completedChallengeCount();
  runtime.elements.challengeStatus.textContent = runtime.state.activeChallenge > 0
    ? `${runtime.challengeName(runtime.state.activeChallenge)} ${runtime.t("challengeRunning")}`
    : !runtime.infinityChallengesUnlocked()
      ? runtime.t("locked")
      : `${completed}/${runtime.INFINITY_CHALLENGE_COUNT} ${runtime.t("completed")}`;
  runtime.elements.challengeTabState.textContent = `IC ${completed}/${runtime.INFINITY_CHALLENGE_COUNT}`;
  updateChallengeRows();
  updateTowerChallengeRows();
  const currentTowerFloor = runtime.towerFloor();
  const nextTowerFloor = runtime.towerNextFloor();
  const nextTowerCostLog10 = runtime.towerNextFloorCostLog10();
  const towerGate = runtime.towerGateForFloor(nextTowerFloor);
  const towerGateReady = runtime.towerCanBuildNextFloor();
  const maximumInfinityPointLog10 = runtime.log10ExactInfinityPoints(runtime.MAX_EXACT_INFINITY_POINTS);
  const towerCostAffordable = (!runtime.infinityPointCapActive() || nextTowerCostLog10 <= maximumInfinityPointLog10)
    && runtime.canSpendInfinityPoints(nextTowerCostLog10);
  runtime.elements.towerFloorHeading.textContent = `Floor ${currentTowerFloor}`;
  runtime.elements.towerFloorValue.textContent = String(currentTowerFloor);
  runtime.elements.towerScoreExponentValue.textContent = `^${runtime.towerScoreExponent().toFixed(2)}`;
  runtime.elements.towerChallenge1ScorePower.textContent = `^${runtime.infiniteAngleScorePower().toFixed(3)}`;
  runtime.elements.towerNextCost.textContent = `${runtime.formatUiLogNumber(nextTowerCostLog10)} IP`;
  runtime.elements.towerGateStatus.textContent = !towerGateReady
    ? runtime.t("towerNeedChallenge").replace("{index}", String(towerGate))
    : !towerCostAffordable
      ? runtime.t("towerNeedIp")
      : runtime.t("towerBuildReady");
  runtime.elements.towerBuildButton.disabled = !runtime.canBuildTower();
  const breakCapRequirement = runtime.formatUiLogNumber(runtime.BREAK_CAP_REQUIREMENT_LOG10);
  runtime.elements.breakCapRequirement.textContent = runtime.state.infiniteCapBroken
    ? runtime.t("breakCapBroken")
    : runtime.t("breakCapRequirement").replace("{score}", breakCapRequirement);
  runtime.elements.breakCapButton.disabled = !runtime.canBreakInfiniteCap();
  runtime.elements.breakCapButton.textContent = runtime.state.infiniteCapBroken ? "Cap Broken" : "Break Infinite Cap";

  updateAutomationUi();
  updateStatisticsUi();
  updateOfflineReportUi();
  updateTimelineUi();

  const unlockedAchievements = runtime.achievementCount();
  runtime.elements.achievementTabState.textContent = `${unlockedAchievements}/${runtime.ACHIEVEMENT_COUNT}`;
  runtime.elements.achievementSummary.textContent = `${unlockedAchievements}/${runtime.ACHIEVEMENT_COUNT} ${runtime.t("tabAchievements")}`;
  runtime.elements.achievementBoost.textContent = `×${runtime.achievementGainMultiplier().toFixed(3)}`;
  updateAchievementRows();

  syncFormControl(runtime.elements.floatingTextToggle, runtime.state.showFloatingText);
  syncFormControl(runtime.elements.lightEffectsToggle, runtime.state.lightEffects);
  syncFormControl(runtime.elements.fpsToggle, runtime.state.showFps);
  syncFormControl(runtime.elements.languageSelect, runtime.state.language);
  syncFormControl(runtime.elements.numberFormatSelect, runtime.state.numberFormat);
  syncFormControl(runtime.elements.timeUnitSelect, runtime.state.timeUnit);
  syncFormControl(runtime.elements.topBarModeSelect, runtime.state.topBarMode);
  syncFormControl(runtime.elements.mainTabPositionSelect, runtime.state.mainTabPosition);
  syncFormControl(
    runtime.elements.skipTimelineRespecConfirmationToggle,
    runtime.state.skipTimelineRespecConfirmation,
  );
  syncFormControl(runtime.elements.offlineProgressToggle, runtime.state.offlineProgressEnabled);
  syncFormControl(runtime.elements.offlineTickInput, runtime.state.offlineTickCount);
  document.documentElement.classList.toggle("show-fps", runtime.state.showFps);
  runtime.elements.fpsCounter.hidden = !runtime.state.showFps;
  if (runtime.state.showFps) runtime.elements.fpsCounter.textContent = `FPS ${Math.round(runtime.smoothedFps)}`;
  const rootStyle = document.documentElement?.style;
  if (typeof rootStyle?.setProperty === "function") {
    const fpsHeight = runtime.elements.fpsCounter.hidden
      ? 0
      : Math.ceil(runtime.elements.fpsCounter.getBoundingClientRect().height);
    rootStyle.setProperty("--fps-counter-height", `${fpsHeight}px`);
  }
  updateSaveRecoveryUi();
  updateEternityUi();
}

function setSaveStatus(text) {
  runtime.elements.saveStatus.textContent = text;
}

function gainExpressionConfig() {
  const parts = gainExpressionParts();
  const effectiveParts = runtime.tc4EffectiveGainExpressionParts(parts);
  if (parts <= 1) return { parts, effectiveParts, divisor: 1, rewardRemovesDivisor: false };
  if (runtime.state.activeChallenge === 1) return { parts, effectiveParts, divisor: parts * 10, rewardRemovesDivisor: false };
  if (runtime.isChallengeCompleted(1)) return { parts, effectiveParts, divisor: 1, rewardRemovesDivisor: true };
  return { parts, effectiveParts, divisor: parts, rewardRemovesDivisor: false };
}

function formatGainExpression(valueLog10) {
  const config = gainExpressionConfig();
  if (config.effectiveParts <= 1) return runtime.formatUiLogNumber(valueLog10);
  const base = runtime.formatUiLogNumber(valueLog10);
  const exponent = Number.isInteger(config.effectiveParts)
    ? String(config.effectiveParts)
    : config.effectiveParts.toFixed(2);
  if (config.divisor <= 1) return `(${base})^${exponent}`;
  return `(${base} / ${config.divisor})^${exponent}`;
}

function formatEffectiveLevel(rawText, effectiveLevel, rawValue = null) {
  const label = `${runtime.t("level")} ${rawText}`;
  const projectedRawValue = rawValue === null ? Number(rawText) : runtime.numberFromExactInteger(rawValue);
  return effectiveLevel === projectedRawValue
    ? label
    : `${label} → ${runtime.t("effectiveLevel")} ${effectiveLevel < 1000
      ? runtime.formatSmallDecimal(effectiveLevel)
      : runtime.formatUiNumber(effectiveLevel)}`;
}

function gainExpressionParts() {
  return Math.min(Math.floor(Math.sqrt(runtime.effectiveVertexCount())), 10);
}

function hasMultiplicativeGainExpression() {
  return gainExpressionParts() > 1;
}

function formatGainExpressionSummary() {
  return formatGainExpression(runtime.currentGainLog10());
}

function challengeText(index, key) {
  const challenge = runtime.INFINITY_CHALLENGES[index - 1];
  const language = runtime.TEXT[runtime.state.language] ? runtime.state.language : "ja";
  return challenge ? challenge[key][language] : runtime.t("challengeNone");
}

function formatMultiplierPreview(current, next) {
  const currentText = `×${current.toFixed(2)}`;
  const nextText = `×${next.toFixed(2)}`;
  return currentText === nextText ? currentText : `${currentText} → ${nextText}`;
}

function formatMultiplierLog(log) {
  return `×${runtime.formatUiLogNumber(log)}`;
}

function formatMultiplierLogPreview(currentLog, nextLog) {
  const currentText = formatMultiplierLog(currentLog);
  const nextText = formatMultiplierLog(nextLog);
  return currentText === nextText ? currentText : `${currentText} → ${nextText}`;
}

function formatExponentPreview(current, next) {
  const currentText = `^${current.toFixed(2)}`;
  const nextText = `^${next.toFixed(2)}`;
  return currentText === nextText ? currentText : `${currentText} → ${nextText}`;
}

expose("appliedLanguage", () => appliedLanguage, (value) => { appliedLanguage = value; });
expose("applyLanguage", () => applyLanguage, (value) => { applyLanguage = value; });
expose("syncFormControl", () => syncFormControl, (value) => { syncFormControl = value; });
expose("clearElement", () => clearElement, (value) => { clearElement = value; });
expose("canSpendLog", () => canSpendLog, (value) => { canSpendLog = value; });
expose("canSpend", () => canSpend, (value) => { canSpend = value; });
expose("formatVertexGainIncrease", () => formatVertexGainIncrease, (value) => { formatVertexGainIncrease = value; });
expose("updateUi", () => updateUi, (value) => { updateUi = value; });
expose("setSaveStatus", () => setSaveStatus, (value) => { setSaveStatus = value; });
expose("gainExpressionConfig", () => gainExpressionConfig, (value) => { gainExpressionConfig = value; });
expose("formatGainExpression", () => formatGainExpression, (value) => { formatGainExpression = value; });
expose("gainExpressionParts", () => gainExpressionParts, (value) => { gainExpressionParts = value; });
expose("hasMultiplicativeGainExpression", () => hasMultiplicativeGainExpression, (value) => { hasMultiplicativeGainExpression = value; });
expose("formatGainExpressionSummary", () => formatGainExpressionSummary, (value) => { formatGainExpressionSummary = value; });
expose("challengeText", () => challengeText, (value) => { challengeText = value; });
expose("formatMultiplierPreview", () => formatMultiplierPreview, (value) => { formatMultiplierPreview = value; });
expose("formatMultiplierLog", () => formatMultiplierLog, (value) => { formatMultiplierLog = value; });
expose("formatMultiplierLogPreview", () => formatMultiplierLogPreview, (value) => { formatMultiplierLogPreview = value; });
expose("formatExponentPreview", () => formatExponentPreview, (value) => { formatExponentPreview = value; });
