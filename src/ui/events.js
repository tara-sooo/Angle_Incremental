import { runtime, expose } from "../runtime/shared.js";
import "../systems/infinity-point-normalization.js";
import { installNumericStabilityFixes } from "../patches/numeric-stability.js?v=0.12.1";
import "./render-eternity.js?v=0.12.1";

// Input and settings bindings are installed by src/main.js after all modules are composed.

function switchMainTab(tab) {
  runtime.activeMainTab = tab;
  runtime.elements.mainTabs.forEach((button) => {
    const active = button.dataset.tab === runtime.activeMainTab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  runtime.elements.mainPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === runtime.activeMainTab);
  });
  runtime.resizeCanvas();
  runtime.resizeInfiniteAngleCanvas();
}

function switchInfinitySubtab(tab) {
  runtime.activeInfinitySubtab = tab;
  runtime.elements.infinitySubtabs.forEach((button) => {
    const active = button.dataset.infinityTab === runtime.activeInfinitySubtab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  runtime.elements.infinitySubpanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.infinityPanel === runtime.activeInfinitySubtab);
  });
  if (runtime.activeInfinitySubtab === "angle") runtime.resizeInfiniteAngleCanvas();
}

function switchChallengeSubtab(tab) {
  runtime.activeChallengeSubtab = tab;
  runtime.elements.challengeSubtabs.forEach((button) => {
    const active = button.dataset.challengeTab === runtime.activeChallengeSubtab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  runtime.elements.challengeSubpanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.challengePanel === runtime.activeChallengeSubtab);
  });
}

function switchStatisticsSubtab(tab) {
  runtime.activeStatisticsSubtab = tab;
  runtime.elements.statisticsSubtabs.forEach((button) => {
    const active = button.dataset.statisticsTab === runtime.activeStatisticsSubtab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  runtime.elements.statisticsSubpanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.statisticsPanel === runtime.activeStatisticsSubtab);
  });
}

function applySetting(key, value) {
  if (runtime.offlineProcessing || runtime.saveConflictMode) return;
  runtime.state[key] = value;
  if (key === "language") {
    runtime.state.language = runtime.normalizeChoice(value, ["ja", "en"], "ja");
    runtime.appliedLanguage = "";
  }
  if (key === "numberFormat") runtime.state.numberFormat = runtime.normalizeChoice(value, ["compact", "scientific", "detailed"], "compact");
  if (key === "timeUnit") runtime.state.timeUnit = runtime.normalizeChoice(value, ["auto", "seconds", "milliseconds"], "auto");
  if (key === "topBarMode") runtime.state.topBarMode = runtime.normalizeChoice(value, ["news", "resources", "progress", "blank", "hidden"], "news");
  if (key === "offlineProgressEnabled") {
    runtime.state.offlineProgressEnabled = runtime.sanitizeBoolean(value, true);
    runtime.offlineReport = null;
    runtime.invalidateVisibilityResume?.();
    runtime.setOfflineBaseline?.(
      runtime.localClockNowMs ? runtime.localClockNowMs() : Date.now(),
      runtime.serverClockAvailable?.() && runtime.serverClockNowMs ? runtime.serverClockNowMs() : 0,
    );
  }
  if (key === "offlineTickCount") runtime.state.offlineTickCount = runtime.clampOfflineTickCount(value);
  if (key === "showFloatingText" && !value) runtime.state.floatingTexts = [];
  if (key === "lightEffects" && value) runtime.state.floatingTexts = [];
  if (key === "showFps") runtime.state.showFps = Boolean(value);
  if (key === "autoCompleteChallenges") runtime.state.autoCompleteChallenges = Boolean(value);
  if (key === "autoGenerationScoreMultiplierThreshold") {
    runtime.state.autoGenerationScoreMultiplierThreshold = Math.max(0, Number(value) || 0);
    runtime.state.autoGenerationLegacyOrMode = false;
  }
  if (key === "autoGenerationCostMultiplierThreshold") {
    runtime.state.autoGenerationCostMultiplierThreshold = Math.max(0, Number(value) || 0);
    runtime.state.autoGenerationLegacyOrMode = false;
  }
  if (key === "autoGenerationMinimumSeconds") {
    runtime.state.autoGenerationMinimumSeconds = Math.max(0, Number(value) || 0);
    runtime.state.autoGenerationLegacyOrMode = false;
  }
  if (key === "autoInfinityPointThreshold") {
    const thresholdLog10 = Math.max(0, runtime.parseUiLogNumber(value, 0));
    runtime.state.autoInfinityPointThresholdLog10 = thresholdLog10;
    runtime.state.autoInfinityPointThreshold = runtime.valueFromLog10(thresholdLog10);
  }
  runtime.updateUi();
  runtime.draw();
  runtime.saveGame("manual");
}

function isEditableElement(element) {
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tagName = typeof element.tagName === "string" ? element.tagName.toLowerCase() : "";
  if (tagName === "input" || tagName === "textarea" || tagName === "select") return true;
  if (typeof element.closest === "function" && element.closest("[contenteditable], [role=\"textbox\"]")) return true;
  return typeof element.getAttribute === "function" && element.getAttribute("role") === "textbox";
}

function isEditableKeyboardTarget(target) {
  const activeElement = typeof document === "undefined" ? null : document.activeElement;
  return isEditableElement(target) || isEditableElement(activeElement);
}

function bindEvents() {
  installNumericStabilityFixes();
  runtime.elements.speedUpgrade.addEventListener("click", runtime.buySpeed);
  runtime.elements.vertexUpgrade.addEventListener("click", runtime.buyVertex);
  runtime.elements.gainUpgrade.addEventListener("click", runtime.buyGain);
  runtime.elements.buyAllUpgrade.addEventListener("click", () => runtime.buyAllUpgrades());
  runtime.elements.generationButton.addEventListener("click", runtime.runGeneration);
  runtime.elements.coreBoostButton.addEventListener("click", runtime.runCoreBoost);
  runtime.elements.infinityButton.addEventListener("click", () => runtime.runInfinity(false));
  runtime.elements.infinityUpgradeDetailBuy.addEventListener("click", runtime.buySelectedInfinityUpgrade);
  runtime.elements.infiniteAngleUnlockButton.addEventListener("click", runtime.unlockInfiniteAngle);
  runtime.elements.infiniteAngleBuyAllUpgrade.addEventListener("click", () => runtime.buyAllInfiniteAngleUpgrades());
  runtime.elements.infiniteAngleSpeedUpgrade.addEventListener("click", () => runtime.buyInfiniteAngleUpgrade("speed"));
  runtime.elements.infiniteAngleVertexUpgrade.addEventListener("click", () => runtime.buyInfiniteAngleUpgrade("vertex"));
  runtime.elements.infiniteAngleGainUpgrade.addEventListener("click", () => runtime.buyInfiniteAngleUpgrade("gain"));
  runtime.elements.towerBuildButton.addEventListener("click", runtime.buildTower);
  runtime.elements.breakCapButton.addEventListener("click", runtime.breakInfiniteCap);
  runtime.elements.offlineTickInput.addEventListener("change", () => applySetting(
    "offlineTickCount",
    runtime.elements.offlineTickInput.value,
  ));
  runtime.elements.offlineProgressToggle.addEventListener("change", () => applySetting(
    "offlineProgressEnabled",
    runtime.elements.offlineProgressToggle.checked,
  ));
  runtime.elements.offlineReportClose.addEventListener("click", () => {
    runtime.offlineReport = null;
    runtime.updateUi();
  });
  runtime.elements.resetSaveButton.addEventListener("click", runtime.resetSave);
  runtime.elements.mainTabs.forEach((button) => {
    button.addEventListener("click", () => switchMainTab(button.dataset.tab));
  });
  runtime.elements.infinitySubtabs.forEach((button) => {
    button.addEventListener("click", () => switchInfinitySubtab(button.dataset.infinityTab));
  });
  runtime.elements.challengeSubtabs.forEach((button) => {
    button.addEventListener("click", () => switchChallengeSubtab(button.dataset.challengeTab));
  });
  runtime.elements.statisticsSubtabs.forEach((button) => {
    button.addEventListener("click", () => switchStatisticsSubtab(button.dataset.statisticsTab));
  });
  runtime.elements.floatingTextToggle.addEventListener("change", () => applySetting("showFloatingText", runtime.elements.floatingTextToggle.checked));
  runtime.elements.lightEffectsToggle.addEventListener("change", () => applySetting("lightEffects", runtime.elements.lightEffectsToggle.checked));
  runtime.elements.fpsToggle.addEventListener("change", () => applySetting("showFps", runtime.elements.fpsToggle.checked));
  runtime.elements.automationMasterToggle.addEventListener("change", () => applySetting("automationEnabled", runtime.elements.automationMasterToggle.checked));
  runtime.elements.autoBuySpeedToggle.addEventListener("change", () => applySetting("autoBuySpeed", runtime.elements.autoBuySpeedToggle.checked));
  runtime.elements.autoBuyVertexToggle.addEventListener("change", () => applySetting("autoBuyVertex", runtime.elements.autoBuyVertexToggle.checked));
  runtime.elements.autoBuyGainToggle.addEventListener("change", () => applySetting("autoBuyGain", runtime.elements.autoBuyGainToggle.checked));
  if (runtime.elements.autoCompleteChallengesToggle) runtime.elements.autoCompleteChallengesToggle.addEventListener("change", () => applySetting("autoCompleteChallenges", runtime.elements.autoCompleteChallengesToggle.checked));
  if (runtime.elements.autoRunGenerationToggle) runtime.elements.autoRunGenerationToggle.addEventListener("change", () => applySetting("autoRunGeneration", runtime.elements.autoRunGenerationToggle.checked));
  if (runtime.elements.autoGenerationScoreThresholdInput) runtime.elements.autoGenerationScoreThresholdInput.addEventListener("change", () => applySetting("autoGenerationScoreMultiplierThreshold", runtime.elements.autoGenerationScoreThresholdInput.value));
  if (runtime.elements.autoGenerationCostThresholdInput) runtime.elements.autoGenerationCostThresholdInput.addEventListener("change", () => applySetting("autoGenerationCostMultiplierThreshold", runtime.elements.autoGenerationCostThresholdInput.value));
  if (runtime.elements.autoGenerationMinimumSecondsInput) runtime.elements.autoGenerationMinimumSecondsInput.addEventListener("change", () => applySetting("autoGenerationMinimumSeconds", runtime.elements.autoGenerationMinimumSecondsInput.value));
  if (runtime.elements.autoRunCoreBoostToggle) runtime.elements.autoRunCoreBoostToggle.addEventListener("change", () => applySetting("autoRunCoreBoost", runtime.elements.autoRunCoreBoostToggle.checked));
  if (runtime.elements.autoRunInfinityToggle) runtime.elements.autoRunInfinityToggle.addEventListener("change", () => applySetting("autoRunInfinity", runtime.elements.autoRunInfinityToggle.checked));
  if (runtime.elements.autoInfinityPointThresholdInput) runtime.elements.autoInfinityPointThresholdInput.addEventListener("change", () => applySetting("autoInfinityPointThreshold", runtime.elements.autoInfinityPointThresholdInput.value));
  runtime.elements.languageSelect.addEventListener("change", () => applySetting("language", runtime.elements.languageSelect.value));
  runtime.elements.numberFormatSelect.addEventListener("change", () => applySetting("numberFormat", runtime.elements.numberFormatSelect.value));
  runtime.elements.timeUnitSelect.addEventListener("change", () => applySetting("timeUnit", runtime.elements.timeUnitSelect.value));
  runtime.elements.topBarModeSelect.addEventListener("change", () => applySetting("topBarMode", runtime.elements.topBarModeSelect.value));
  if (runtime.elements.exportSaveCodeButton) runtime.elements.exportSaveCodeButton.addEventListener("click", runtime.exportSaveCode);
  if (runtime.elements.importSaveCodeButton) runtime.elements.importSaveCodeButton.addEventListener("click", runtime.importSaveCodeFromUi);
  if (runtime.elements.copySaveCodeButton) runtime.elements.copySaveCodeButton.addEventListener("click", runtime.copySaveCodeFromUi);
  if (runtime.elements.retryLoadButton) runtime.elements.retryLoadButton.addEventListener("click", () => {
    Promise.resolve(runtime.retryLoad()).finally(() => {
      runtime.updateUi();
      runtime.draw();
    });
  });
  if (runtime.elements.restoreQuarantineButton) runtime.elements.restoreQuarantineButton.addEventListener("click", () => {
    Promise.resolve(runtime.restoreQuarantineSave()).finally(() => {
      runtime.updateUi();
      runtime.draw();
    });
  });
  if (runtime.elements.restorePreImportButton) runtime.elements.restorePreImportButton.addEventListener("click", runtime.restorePreImportSave);
  if (runtime.elements.restoreUndoButton) runtime.elements.restoreUndoButton.addEventListener("click", runtime.restoreUndoSave);
  if (runtime.elements.saveCheckpointList) runtime.elements.saveCheckpointList.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-checkpoint-index]");
    if (button) runtime.restoreCheckpoint(button.dataset.checkpointIndex);
  });
  if (runtime.elements.updateModalClose) runtime.elements.updateModalClose.addEventListener("click", runtime.closeUpdateModal);
  window.addEventListener("beforeunload", () => runtime.saveGame("manual"));
  window.addEventListener("storage", runtime.handleStorageChange);
  if (document.addEventListener) document.addEventListener("visibilitychange", runtime.handleVisibilityChange);
  window.addEventListener("resize", runtime.resizeCanvas);
  window.addEventListener("resize", runtime.resizeInfiniteAngleCanvas);
  const canvasResizeObserver = window.ResizeObserver && runtime.canvas.parentElement
    ? new ResizeObserver(runtime.resizeCanvas)
    : null;
  if (canvasResizeObserver) canvasResizeObserver.observe(runtime.canvas.parentElement);
  const infiniteAngleResizeObserver = window.ResizeObserver && runtime.infiniteAngleCanvas?.parentElement
    ? new ResizeObserver(runtime.resizeInfiniteAngleCanvas)
    : null;
  if (infiniteAngleResizeObserver) infiniteAngleResizeObserver.observe(runtime.infiniteAngleCanvas.parentElement);
  window.addEventListener("keydown", (event) => {
    const updateModalVisible = runtime.elements.updateModal && !runtime.elements.updateModal.hidden;
    if (updateModalVisible && event.key === "Escape") {
      runtime.closeUpdateModal();
      return;
    }
    if (updateModalVisible) return;
    if (
      !event.defaultPrevented
      && !event.isComposing
      && !event.ctrlKey
      && !event.metaKey
      && !event.altKey
      && !event.shiftKey
      && !isEditableKeyboardTarget(event.target)
      && event.key.toLowerCase() === "f"
    ) {
      event.preventDefault();
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    }
  });
}
expose("switchMainTab", () => switchMainTab, (value) => { switchMainTab = value; });
expose("switchInfinitySubtab", () => switchInfinitySubtab, (value) => { switchInfinitySubtab = value; });
expose("switchChallengeSubtab", () => switchChallengeSubtab, (value) => { switchChallengeSubtab = value; });
expose("switchStatisticsSubtab", () => switchStatisticsSubtab, (value) => { switchStatisticsSubtab = value; });
expose("applySetting", () => applySetting, (value) => { applySetting = value; });
expose("isEditableKeyboardTarget", () => isEditableKeyboardTarget, (value) => { isEditableKeyboardTarget = value; });
expose("bindEvents", () => bindEvents, (value) => { bindEvents = value; });