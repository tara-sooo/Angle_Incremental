import { runtime, expose } from "../runtime/shared.js";

// Shared form helpers and the UI update orchestrator.

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

function canSpendLog(amountLog) {
  return runtime.currentScoreLog10() >= amountLog;
}

function canSpend(amount) {
  return canSpendLog(runtime.log10Value(amount));
}

function updateUi() {
  if (runtime.offlineProcessing) return;
  const currentCostLogs = runtime.costLogs();
  const unlockedAchievementsNow = runtime.checkAchievements(true);
  if (unlockedAchievementsNow.length > 0) runtime.saveGame("manual");
  document.documentElement.classList.toggle("light-effects", runtime.state.lightEffects);
  applyLanguage();
  runtime.updateTopBar();
  runtime.elements.scoreValue.textContent = runtime.scoreDisplay();
  runtime.elements.gainValue.textContent = runtime.formatUiLogNumber(runtime.finalScoreGainLog10());
  const vertexGainIncreaseLog10 = runtime.vertexGainIncreaseLog10();
  const vertexGainIncreaseText = vertexGainIncreaseLog10 > 308
    ? runtime.formatUiLogNumber(vertexGainIncreaseLog10)
    : runtime.formatSmallDecimal(runtime.valueFromLog10(vertexGainIncreaseLog10));
  runtime.elements.vertexGainValue.textContent = `+${vertexGainIncreaseText}`;
  runtime.elements.lapValue.textContent = runtime.formatDuration(runtime.lapDuration());
  runtime.elements.lapSpeedValue.textContent = runtime.isLapSpeedSoftcapped()
    ? `${formatMultiplierLog(runtime.effectiveLapSpeedLog10())} ${runtime.t("lapSpeedSoftcapped")} / raw ${formatMultiplierLog(runtime.rawLapSpeedLog10())}`
    : formatMultiplierLog(runtime.effectiveLapSpeedLog10());
  const sponsorBonus = runtime.sponsoredNormalUpgradeBonusLevel();
  runtime.elements.speedLevel.textContent = sponsorBonus > 0
    ? `${runtime.t("level")} ${runtime.state.speedLevel} + ${sponsorBonus}`
    : `${runtime.t("level")} ${runtime.state.speedLevel}`;
  runtime.elements.vertexCount.textContent = runtime.effectiveVertexCount() === runtime.state.vertices
    ? `${runtime.state.vertices} ${runtime.t("vertices")}`
    : `${runtime.effectiveVertexCount()} ${runtime.t("vertices")} (${runtime.state.vertices} + ${runtime.effectiveVertexCount() - runtime.state.vertices})`;
  runtime.elements.gainLevel.textContent = sponsorBonus > 0
    ? `${runtime.t("level")} ${runtime.state.gainLevel} + ${sponsorBonus}`
    : `${runtime.t("level")} ${runtime.state.gainLevel}`;
  runtime.elements.speedCost.textContent = `${runtime.t("cost")} ${runtime.formatUiLogNumber(currentCostLogs.speed)}`;
  runtime.elements.vertexCost.textContent = `${runtime.t("cost")} ${runtime.formatUiLogNumber(currentCostLogs.vertex)}`;
  runtime.elements.gainCost.textContent = `${runtime.t("cost")} ${runtime.formatUiLogNumber(currentCostLogs.gain)}`;
  runtime.elements.speedUpgrade.disabled = !runtime.canBuyNormalUpgrade("speed");
  runtime.elements.vertexUpgrade.disabled = !runtime.canBuyNormalUpgrade("vertex");
  runtime.elements.gainUpgrade.disabled = !runtime.canBuyNormalUpgrade("gain");
  runtime.elements.buyAllUpgrade.disabled = !runtime.canBuyNormalUpgrade("speed") && !runtime.canBuyNormalUpgrade("vertex") && !runtime.canBuyNormalUpgrade("gain");

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
  runtime.elements.coreBoostRequirement.textContent = runtime.formatPowerOfTen(runtime.coreBoostRequirementLog10());
  const nextCoreBoost = runtime.nextCoreBoostValues();
  runtime.elements.coreBoostGainBoost.textContent = formatMultiplierPreview(runtime.coreBoostGainIncreaseMultiplier(), nextCoreBoost.gainMultiplier);
  runtime.elements.coreBoostExponent.textContent = formatExponentPreview(runtime.coreBoostGainExponent(), nextCoreBoost.gainExponent);
  runtime.elements.coreBoostButton.disabled = !runtime.canCoreBoost();

  runtime.elements.infinityCount.textContent = runtime.formatUiNumber(runtime.state.infinityCount);
  const infinityReady = runtime.canInfinity();
  const infinityUnlocked = runtime.state.infinityCount > 0;
  runtime.elements.infinityTabState.textContent = infinityReady ? "READY" : infinityUnlocked ? "OPEN" : "LOCKED";
  runtime.elements.infinityTabBadge.classList.toggle("is-visible", infinityReady);
  runtime.elements.infinityUnlockNote.hidden = infinityUnlocked;
  runtime.elements.infinityPoints.textContent = runtime.formatUiLogNumber(runtime.currentInfinityPointsLog10());
  runtime.elements.infiniteScore.textContent = runtime.formatUiLogNumber(runtime.currentInfiniteScoreLog10());
  runtime.elements.infiniteScorePanel.textContent = runtime.formatUiLogNumber(runtime.currentInfiniteScoreLog10());
  const infiniteAngleBoostLog10 = runtime.infiniteAngleBoostLog10();
  runtime.elements.infiniteAngleBoost.textContent = formatMultiplierLog(infiniteAngleBoostLog10);
  runtime.elements.infiniteAngleBoostPanel.textContent = formatMultiplierLog(infiniteAngleBoostLog10);
  runtime.elements.infinityPointGain.textContent = `+${runtime.formatUiNumber(runtime.infinityPointGain())} IP`;
  runtime.elements.infinityButton.disabled = runtime.state.infinityCount === 0 || !runtime.canInfinity();
  runtime.updateInfinityUpgradeRows();
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
  runtime.elements.infiniteAngleSpeedLevel.textContent = `${runtime.t("level")} ${runtime.state.infiniteAngleSpeedLevel}`;
  runtime.elements.infiniteAngleVertexLevel.textContent = `${runtime.t("level")} ${runtime.state.infiniteAngleVertexLevel}`;
  runtime.elements.infiniteAngleGainLevel.textContent = `${runtime.t("level")} ${runtime.state.infiniteAngleGainLevel}`;
  runtime.elements.infiniteAngleSpeedCost.textContent = `${runtime.t("infinityUpgradeCost")} ${runtime.formatUiLogNumber(infiniteAngleUpgradeCosts.speed)} IP`;
  runtime.elements.infiniteAngleVertexCost.textContent = `${runtime.t("infinityUpgradeCost")} ${runtime.formatUiLogNumber(infiniteAngleUpgradeCosts.vertex)} IP`;
  runtime.elements.infiniteAngleGainCost.textContent = `${runtime.t("infinityUpgradeCost")} ${runtime.formatUiLogNumber(infiniteAngleUpgradeCosts.gain)} IP`;
  runtime.elements.infiniteAngleSpeedUpgrade.disabled = !runtime.canBuyInfiniteAngleUpgrade("speed");
  runtime.elements.infiniteAngleVertexUpgrade.disabled = !runtime.canBuyInfiniteAngleUpgrade("vertex");
  runtime.elements.infiniteAngleGainUpgrade.disabled = !runtime.canBuyInfiniteAngleUpgrade("gain");
  const completed = runtime.completedChallengeCount();
  runtime.elements.challengeStatus.textContent = runtime.state.activeChallenge > 0
    ? `${runtime.challengeName(runtime.state.activeChallenge)} ${runtime.t("challengeRunning")}`
    : !runtime.infinityChallengesUnlocked()
      ? runtime.t("locked")
      : `${completed}/${runtime.INFINITY_CHALLENGE_COUNT} ${runtime.t("completed")}`;
  runtime.elements.challengeTabState.textContent = `IC ${completed}/${runtime.INFINITY_CHALLENGE_COUNT}`;
  runtime.updateChallengeRows();
  runtime.updateTowerChallengeRows();
  const currentTowerFloor = runtime.towerFloor();
  const nextTowerFloor = runtime.towerNextFloor();
  const nextTowerCostLog10 = runtime.towerNextFloorCostLog10();
  const towerGate = runtime.towerGateForFloor(nextTowerFloor);
  const towerGateReady = runtime.towerCanBuildNextFloor();
  const maximumInfinityPointLog10 = runtime.log10ExactInfinityPoints(runtime.MAX_EXACT_INFINITY_POINTS);
  const towerCostAffordable = nextTowerCostLog10 <= maximumInfinityPointLog10
    && runtime.canSpendInfinityPoints(nextTowerCostLog10);
  runtime.elements.towerFloorHeading.textContent = `Floor ${currentTowerFloor}`;
  runtime.elements.towerFloorValue.textContent = String(currentTowerFloor);
  runtime.elements.towerScoreExponentValue.textContent = `^${runtime.towerScoreExponent().toFixed(2)}`;
  runtime.elements.towerNextCost.textContent = `${runtime.formatUiLogNumber(nextTowerCostLog10)} IP`;
  runtime.elements.towerGateStatus.textContent = !towerGateReady
    ? runtime.t("towerNeedChallenge").replace("{index}", String(towerGate))
    : !towerCostAffordable
      ? runtime.t("towerNeedIp")
      : runtime.t("towerBuildReady");
  runtime.elements.towerBuildButton.disabled = !runtime.canBuildTower();
  const breakCapRequirement = runtime.formatPowerOfTen(runtime.BREAK_CAP_REQUIREMENT_LOG10);
  runtime.elements.breakCapRequirement.textContent = runtime.state.infiniteCapBroken
    ? runtime.t("breakCapBroken")
    : runtime.t("breakCapRequirement").replace("{score}", breakCapRequirement);
  runtime.elements.breakCapButton.disabled = !runtime.canBreakInfiniteCap();
  runtime.elements.breakCapButton.textContent = runtime.state.infiniteCapBroken ? "Cap Broken" : "Break Infinite Cap";

  runtime.updateAutomationUi();
  runtime.updateStatisticsUi();
  runtime.updateTimeFluxUi();

  const unlockedAchievements = runtime.achievementCount();
  runtime.elements.achievementTabState.textContent = `${unlockedAchievements}/${runtime.ACHIEVEMENT_COUNT}`;
  runtime.elements.achievementSummary.textContent = `${unlockedAchievements}/${runtime.ACHIEVEMENT_COUNT} ${runtime.t("tabAchievements")}`;
  runtime.elements.achievementBoost.textContent = `×${runtime.achievementGainMultiplier().toFixed(3)}`;
  runtime.updateAchievementRows();

  syncFormControl(runtime.elements.floatingTextToggle, runtime.state.showFloatingText);
  syncFormControl(runtime.elements.lightEffectsToggle, runtime.state.lightEffects);
  syncFormControl(runtime.elements.fpsToggle, runtime.state.showFps);
  syncFormControl(runtime.elements.languageSelect, runtime.state.language);
  syncFormControl(runtime.elements.numberFormatSelect, runtime.state.numberFormat);
  syncFormControl(runtime.elements.timeUnitSelect, runtime.state.timeUnit);
  syncFormControl(runtime.elements.topBarModeSelect, runtime.state.topBarMode);
  syncFormControl(runtime.elements.timeFluxQuickBarToggle, runtime.state.showTimeFluxQuickBar);
  document.documentElement.classList.toggle("show-fps", runtime.state.showFps);
  runtime.elements.fpsCounter.hidden = !runtime.state.showFps;
  if (runtime.state.showFps) runtime.elements.fpsCounter.textContent = `FPS ${Math.round(runtime.smoothedFps)}`;
}

function setSaveStatus(text) {
  runtime.elements.saveStatus.textContent = text;
}

function gainExpressionConfig() {
  const parts = gainExpressionParts();
  if (parts <= 1) return { parts, divisor: 1, rewardRemovesDivisor: false };
  if (runtime.state.activeChallenge === 1) return { parts, divisor: parts * 10, rewardRemovesDivisor: false };
  if (runtime.isChallengeCompleted(1)) return { parts, divisor: 1, rewardRemovesDivisor: true };
  return { parts, divisor: parts, rewardRemovesDivisor: false };
}

function formatGainExpression(valueLog10) {
  const config = gainExpressionConfig();
  if (config.parts <= 1) return runtime.formatUiLogNumber(valueLog10);
  const base = runtime.formatUiLogNumber(valueLog10);
  if (config.divisor <= 1) return `(${base})^${config.parts}`;
  return `(${base} / ${config.divisor})^${config.parts}`;
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

expose("applyLanguage", () => applyLanguage, (value) => { applyLanguage = value; });
expose("syncFormControl", () => syncFormControl, (value) => { syncFormControl = value; });
expose("clearElement", () => clearElement, (value) => { clearElement = value; });
expose("canSpendLog", () => canSpendLog, (value) => { canSpendLog = value; });
expose("canSpend", () => canSpend, (value) => { canSpend = value; });
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
