import { runtime, expose } from "../runtime/shared.js";

// Shared form helpers and the UI update orchestrator.

let renderedRecoveryRevision = -1;
let renderedRecoveryLanguage = "";
let renderedRecoveryNumberFormat = "";
let renderedLoadRecoveryMode = false;
let renderedSaveConflictMode = false;
let renderedSaveConflictCheckpointReady = false;

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

function formatRecoveryTimestamp(timestamp) {
  const numeric = Number(timestamp);
  if (!Number.isFinite(numeric) || numeric <= 0) return runtime.t("recoveryUnknownTime");
  try {
    return new Date(numeric).toLocaleString(runtime.state.language === "en" ? "en-US" : "ja-JP");
  } catch (error) {
    return runtime.t("recoveryUnknownTime");
  }
}

function formatInfiniteAngleLevel(kind) {
  const level = runtime.infiniteAngleEffectiveUpgradeLevel(kind);
  const freeLevel = runtime.infiniteAngleFreeUpgradeLevel(kind);
  return `Lv ${level}${freeLevel > 0 ? ` (+${freeLevel})` : ""}`;
}

function formatNormalUpgradeTotal(level) {
  return level < 1000 ? runtime.formatSmallDecimal(level) : runtime.formatUiNumber(level);
}

function formatNormalUpgradeLevel(rawLevel, effectiveLevel, freeLevel) {
  return freeLevel > 0
    ? `Lv ${formatNormalUpgradeTotal(effectiveLevel)} (+${freeLevel})`
    : formatEffectiveLevel(rawLevel, effectiveLevel);
}

function recoveryReasonText(reason) {
  const reasonKeys = {
    periodic: "checkpointReasonPeriodic",
    "save-conflict": "checkpointReasonSaveConflict",
    "pre-import": "checkpointReasonPreImport",
    "pre-update": "checkpointReasonPreUpdate",
    "pre-reset": "checkpointReasonPreReset",
    "pre-infinity-challenge": "checkpointReasonPreInfinityChallenge",
    "pre-break-cap": "checkpointReasonPreBreakCap",
    "pre-infinite-angle": "checkpointReasonPreInfiniteAngle",
    "pre-tower-build": "checkpointReasonPreTowerBuild",
    "pre-tower-challenge": "checkpointReasonPreTowerChallenge",
    "pre-timeline-respec": "checkpointReasonPreTimelineRespec",
    "pre-restore": "checkpointReasonPreRestore",
  };
  return runtime.t(reasonKeys[reason] || "checkpointReasonOther");
}

function countBits(value) {
  let remaining = Math.max(0, Math.floor(Number(value) || 0));
  let count = 0;
  while (remaining > 0) {
    remaining &= remaining - 1;
    count += 1;
  }
  return count;
}

function countAchievementBits(state) {
  let count = 0;
  for (let id = 1; id <= runtime.ACHIEVEMENT_COUNT; id += 1) {
    const mask = id <= 31 ? state.achievementMask : state.achievementMaskHigh;
    const bit = 1 << (id <= 31 ? id - 1 : id - 32);
    if ((((Number(mask) || 0) >>> 0) & bit) !== 0) count += 1;
  }
  return count;
}

function recoveryStateSummary(entry) {
  const state = entry?.state || {};
  const infinityPointsLog10 = runtime.sanitizeLog10(
    state.infinityPointsLog10,
    runtime.log10Value(Math.max(0, Number(state.infinityPoints) || 0)),
  );
  return [
    `${runtime.t("recoveryInfinity")}: ${runtime.formatUiNumber(state.infinityCount || 0)}`,
    `${runtime.t("recoveryIp")}: ${runtime.formatUiLogNumber(infinityPointsLog10)}`,
    `${runtime.t("recoveryChallenges")}: ${countBits(state.completedChallenges)}/${runtime.INFINITY_CHALLENGE_COUNT}`,
    `${runtime.t("recoveryAchievements")}: ${countAchievementBits(state)}/${runtime.ACHIEVEMENT_COUNT}`,
    `${runtime.t("recoveryIa")}: ${state.infiniteAngleUnlocked ? runtime.t("recoveryUnlocked") : runtime.t("recoveryLocked")}`,
    `${runtime.t("recoveryTower")}: ${Math.max(0, Math.floor(Number(state.towerFloor) || 0))}`,
  ].join(" · ");
}

function updateSaveRecoveryUi() {
  const elements = runtime.elements;
  if (!elements.preImportBackupStatus || !elements.saveCheckpointList || !runtime.recoveryEntries) return;
  const currentRevision = typeof runtime.recoveryRevision === "number" ? runtime.recoveryRevision : null;
  if (
    currentRevision !== null
    && currentRevision === renderedRecoveryRevision
    && renderedRecoveryLanguage === runtime.state.language
    && renderedRecoveryNumberFormat === runtime.state.numberFormat
    && renderedLoadRecoveryMode === Boolean(runtime.loadRecoveryMode)
    && renderedSaveConflictMode === Boolean(runtime.saveConflictMode)
    && renderedSaveConflictCheckpointReady === Boolean(runtime.saveConflictCheckpointReady)
  ) return;
  const recovery = runtime.recoveryEntries();
  elements.preImportBackupStatus.textContent = recovery.preImport
    ? `${runtime.t("preImportBackupAvailable")} ${formatRecoveryTimestamp(recovery.preImport.backedUpAt)}`
    : runtime.t("noPreImportBackup");
  if (elements.loadFailureStatus) {
    const failure = recovery.loadFailure;
    if (failure) {
      const stageText = runtime.t(failure.stage === "offline" ? "loadFailureOffline" : "loadFailureApply");
      const detail = failure.errorMessage ? `: ${failure.errorMessage}` : "";
      elements.loadFailureStatus.textContent = `${runtime.t("loadFailureDetected")} ${stageText}${detail}`;
    } else if (runtime.saveConflictMode) {
      elements.loadFailureStatus.textContent = runtime.t(
        runtime.saveConflictCheckpointReady ? "saveConflictDetected" : "saveConflictBackupFailed",
      );
    } else {
      elements.loadFailureStatus.textContent = runtime.loadRecoveryMode
        ? runtime.t("loadRecoveryRequired")
        : "";
    }
  }
  if (elements.quarantineStatus) {
    elements.quarantineStatus.textContent = recovery.quarantine
      ? `${runtime.t("quarantineAvailable")} ${formatRecoveryTimestamp(recovery.quarantine.quarantinedAt)}`
      : "";
  }
  if (elements.retryLoadButton) elements.retryLoadButton.hidden = !runtime.loadRecoveryMode;
  if (elements.restoreQuarantineButton) elements.restoreQuarantineButton.hidden = !recovery.quarantine;
  if (elements.restorePreImportButton) elements.restorePreImportButton.hidden = !recovery.preImport;
  if (elements.restoreUndoButton) elements.restoreUndoButton.hidden = !recovery.undo;
  renderedRecoveryRevision = currentRevision === null ? renderedRecoveryRevision : currentRevision;
  renderedRecoveryLanguage = runtime.state.language;
  renderedRecoveryNumberFormat = runtime.state.numberFormat;
  renderedLoadRecoveryMode = Boolean(runtime.loadRecoveryMode);
  renderedSaveConflictMode = Boolean(runtime.saveConflictMode);
  renderedSaveConflictCheckpointReady = Boolean(runtime.saveConflictCheckpointReady);
  clearElement(elements.saveCheckpointList);
  if (recovery.checkpoints.length === 0) {
    elements.saveCheckpointList.textContent = runtime.t("noCheckpoints");
    return;
  }
  recovery.checkpoints.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "save-checkpoint-row";
    const details = document.createElement("div");
    details.className = "save-checkpoint-details";
    const title = document.createElement("strong");
    title.textContent = recoveryReasonText(entry.reason);
    const timestamp = document.createElement("span");
    timestamp.textContent = formatRecoveryTimestamp(entry.backedUpAt);
    const summary = document.createElement("small");
    summary.textContent = recoveryStateSummary(entry);
    details.append(title, timestamp, summary);
    const restoreButton = document.createElement("button");
    restoreButton.type = "button";
    restoreButton.className = "reset-button";
    restoreButton.dataset.checkpointIndex = String(index);
    restoreButton.textContent = runtime.t("restoreCheckpoint");
    row.append(details, restoreButton);
    elements.saveCheckpointList.append(row);
  });
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

function setTimelineTrackStatus(element, met) {
  if (!element) return;
  element.textContent = runtime.t(met ? "timelineRequirementMet" : "timelineRequirementMissing");
  element.classList.toggle("is-met", met);
  element.classList.toggle("is-missing", !met);
}

function formatTimelineEternityRequirement() {
  const claims = runtime.timelineTrackClaimCount("eternity");
  const requirement = runtime.timelineEternityRequirement();
  return requirement !== null && requirement <= 1000000n
    ? requirement.toString()
    : `2^${claims + 1}`;
}

function updateTimelineUi() {
  if (!runtime.elements.timelineEarnedTf || typeof runtime.timelineEarnedTf !== "function") return;
  runtime.normalizeTimelineState?.();
  const earned = runtime.timelineEarnedTf();
  const available = runtime.timelineAvailableTf();
  const spent = runtime.timelineSpentTf();
  runtime.elements.timelineEarnedTf.textContent = `${runtime.formatUiNumber(earned)} TF`;
  runtime.elements.timelineAvailableTf.textContent = `${runtime.formatUiNumber(available)} TF`;
  runtime.elements.timelineAvailableTfSummary.textContent = `${runtime.formatUiNumber(available)} TF`;
  runtime.elements.timelineSpentTf.textContent = `${runtime.formatUiNumber(spent)} TF`;
  runtime.elements.timelineSpentTfBuild.textContent = `${runtime.formatUiNumber(spent)} TF`;

  const tracks = [
    {
      id: "score",
      claims: runtime.elements.timelineScoreClaims,
      requirement: runtime.elements.timelineScoreRequirement,
      status: runtime.elements.timelineScoreStatus,
      button: runtime.elements.timelineScoreClaimButton,
      requirementText: `${runtime.formatPowerOfTen(runtime.timelineScoreRequirementLog10())} Score`,
    },
    {
      id: "ip",
      claims: runtime.elements.timelineIpClaims,
      requirement: runtime.elements.timelineIpRequirement,
      status: runtime.elements.timelineIpStatus,
      button: runtime.elements.timelineIpClaimButton,
      requirementText: `${runtime.formatPowerOfTen(runtime.timelineIpRequirementLog10())} IP`,
    },
    {
      id: "eternity",
      claims: runtime.elements.timelineEternityClaims,
      requirement: runtime.elements.timelineEternityRequirement,
      status: runtime.elements.timelineEternityStatus,
      button: runtime.elements.timelineEternityClaimButton,
      requirementText: formatTimelineEternityRequirement(),
    },
  ];
  tracks.forEach((track) => {
    const met = runtime.timelineRequirementMet(track.id);
    if (track.claims) track.claims.textContent = runtime.formatUiNumber(runtime.timelineTrackClaimCount(track.id));
    if (track.requirement) track.requirement.textContent = track.requirementText;
    setTimelineTrackStatus(track.status, met);
    if (track.button) {
      track.button.disabled = !runtime.canClaimTimelineTf(track.id);
      track.button.textContent = runtime.t("timelineClaim");
    }
  });

  const purchasedNodes = runtime.state.timelinePurchasedNodes || [];
  if (runtime.elements.timelinePurchasedNodes) {
    runtime.elements.timelinePurchasedNodes.textContent = purchasedNodes.length === 0
      ? runtime.t("timelineNoNodes")
      : `${runtime.t("timelinePurchasedNodeCount").replace("{count}", String(purchasedNodes.length))}: ${purchasedNodes.map((node) => node.id).join(", ")}`;
  }
  if (runtime.elements.timelineRespecButton) {
    runtime.elements.timelineRespecButton.disabled = runtime.timelineDiscovered?.() !== true;
  }
}

function updateUi() {
  if (runtime.offlineProcessing) return;
  const currentCostLogs = runtime.costLogs();
  const unlockedAchievementsNow = runtime.checkAchievements(true);
  const discoveredMainTabs = runtime.discoverMainTabs?.() === true;
  if (unlockedAchievementsNow.length > 0 || discoveredMainTabs) runtime.saveGame("manual");
  document.documentElement.classList.toggle("light-effects", runtime.state.lightEffects);
  applyLanguage();
  runtime.updateMainTabVisibility?.();
  runtime.updateTopBar();
  runtime.elements.scoreValue.textContent = runtime.scoreDisplay();
  runtime.elements.gainValue.textContent = runtime.formatUiLogNumber(runtime.finalScoreGainLog10());
  const vertexGainIncreaseLog10 = runtime.vertexGainIncreaseLog10();
  runtime.elements.vertexGainValue.textContent = `+${formatVertexGainIncrease(vertexGainIncreaseLog10)}`;
  runtime.elements.lapValue.textContent = runtime.formatDuration(runtime.lapDuration());
  runtime.elements.lapSpeedValue.textContent = runtime.isLapSpeedSoftcapped()
    ? `${formatMultiplierLog(runtime.effectiveLapSpeedLog10())} ${runtime.t("lapSpeedSoftcapped")} / raw ${formatMultiplierLog(runtime.rawLapSpeedLog10())}`
    : formatMultiplierLog(runtime.effectiveLapSpeedLog10());
  const freeNormalUpgradeLevel = runtime.eternityMilestoneNormalUpgradeBonusLevel?.() || 0;
  const effectiveSpeedLevel = runtime.effectiveSpeedLevel();
  const effectiveVertexCount = runtime.effectiveVertexCount();
  const effectiveGainLevel = runtime.effectiveGainLevel();
  runtime.elements.speedLevel.textContent = formatNormalUpgradeLevel(
    runtime.state.speedLevel,
    effectiveSpeedLevel,
    freeNormalUpgradeLevel,
  );
  runtime.elements.vertexCount.textContent = freeNormalUpgradeLevel > 0
    ? `${formatNormalUpgradeTotal(effectiveVertexCount)} ${runtime.t("vertices")} (+${freeNormalUpgradeLevel})`
    : effectiveVertexCount === runtime.state.vertices
      ? `${runtime.state.vertices} ${runtime.t("vertices")}`
      : `${effectiveVertexCount} ${runtime.t("vertices")} (${runtime.state.vertices} + ${effectiveVertexCount - runtime.state.vertices})`;
  runtime.elements.gainLevel.textContent = formatNormalUpgradeLevel(
    runtime.state.gainLevel,
    effectiveGainLevel,
    freeNormalUpgradeLevel,
  );
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
  runtime.elements.coreBoostRequirementGrowthPowerRaw.textContent = `^${runtime.coreBoostRequirementRawGrowthPower().toFixed(3)}`;
  runtime.elements.coreBoostRequirementGrowthPower.textContent = `^${runtime.coreBoostRequirementGrowthPower().toFixed(3)}`;
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
  runtime.elements.infiniteAngleSpeedLevel.textContent = formatInfiniteAngleLevel("speed");
  runtime.elements.infiniteAngleVertexLevel.textContent = formatInfiniteAngleLevel("vertex");
  runtime.elements.infiniteAngleGainLevel.textContent = formatInfiniteAngleLevel("gain");
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
  const towerCostAffordable = (!runtime.infinityPointCapActive() || nextTowerCostLog10 <= maximumInfinityPointLog10)
    && runtime.canSpendInfinityPoints(nextTowerCostLog10);
  runtime.elements.towerFloorHeading.textContent = `Floor ${currentTowerFloor}`;
  runtime.elements.towerFloorValue.textContent = String(currentTowerFloor);
  runtime.elements.towerScoreExponentValue.textContent = `^${runtime.towerScoreExponent().toFixed(2)}`;
  const towerChallenge1ScorePowerBase = runtime.hasInfinityUpgrade("13-1") ? 0.5 : runtime.INFINITE_ANGLE_SCORE_POWER;
  const towerChallenge1ScorePowerBonus = runtime.towerChallenge1InfinityScorePowerBonus();
  const towerChallenge1ScorePowerTotal = runtime.infiniteAngleScorePower();
  runtime.elements.towerChallenge1ScorePowerBase.textContent = `^${towerChallenge1ScorePowerBase.toFixed(3)}`;
  runtime.elements.towerChallenge1ScorePowerBonus.textContent = `+^${towerChallenge1ScorePowerBonus.toFixed(3)}`;
  runtime.elements.towerChallenge1ScorePowerTotal.textContent = `^${towerChallenge1ScorePowerTotal.toFixed(3)}`;
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
  runtime.updateOfflineReportUi();
  updateTimelineUi();

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

function formatEffectiveLevel(rawLevel, effectiveLevel) {
  const label = `${runtime.t("level")} ${rawLevel}`;
  return effectiveLevel === rawLevel
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

expose("applyLanguage", () => applyLanguage, (value) => { applyLanguage = value; });
expose("syncFormControl", () => syncFormControl, (value) => { syncFormControl = value; });
expose("clearElement", () => clearElement, (value) => { clearElement = value; });
expose("updateSaveRecoveryUi", () => updateSaveRecoveryUi, (value) => { updateSaveRecoveryUi = value; });
expose("canSpendLog", () => canSpendLog, (value) => { canSpendLog = value; });
expose("canSpend", () => canSpend, (value) => { canSpend = value; });
expose("formatVertexGainIncrease", () => formatVertexGainIncrease, (value) => { formatVertexGainIncrease = value; });
expose("updateTimelineUi", () => updateTimelineUi);
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
