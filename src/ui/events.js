import { runtime, expose } from "../runtime/shared.js";
import "../systems/infinity-point-normalization.js";

// Extracted mechanically from the next-runtime baseline.
// bindEvents is called by src/main.js at the original initialization point.

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
}

function applySetting(key, value) {
  runtime.state[key] = value;
  if (key === "language") {
    runtime.state.language = runtime.normalizeChoice(value, ["ja", "en"], "ja");
    runtime.appliedLanguage = "";
  }
  if (key === "numberFormat") runtime.state.numberFormat = runtime.normalizeChoice(value, ["compact", "scientific", "detailed"], "compact");
  if (key === "timeUnit") runtime.state.timeUnit = runtime.normalizeChoice(value, ["auto", "seconds", "milliseconds"], "auto");
  if (key === "showFloatingText" && !value) runtime.state.floatingTexts = [];
  if (key === "lightEffects" && value) runtime.state.floatingTexts = [];
  if (key === "showFps") runtime.state.showFps = Boolean(value);
  if (key === "autoCompleteChallenges") runtime.state.autoCompleteChallenges = Boolean(value);
  runtime.updateUi();
  runtime.draw();
  runtime.saveGame("manual");
}

function bindEvents() {
  runtime.elements.speedUpgrade.addEventListener("click", runtime.buySpeed);
  runtime.elements.vertexUpgrade.addEventListener("click", runtime.buyVertex);
  runtime.elements.gainUpgrade.addEventListener("click", runtime.buyGain);
  runtime.elements.buyAllUpgrade.addEventListener("click", () => runtime.buyAllUpgrades());
  runtime.elements.generationButton.addEventListener("click", runtime.runGeneration);
  runtime.elements.coreBoostButton.addEventListener("click", runtime.runCoreBoost);
  runtime.elements.infinityButton.addEventListener("click", () => runtime.runInfinity(false));
  runtime.elements.infinityUpgradeDetailBuy.addEventListener("click", runtime.buySelectedInfinityUpgrade);
  runtime.elements.convertIpButton.addEventListener("click", runtime.convertIpToInfiniteScore);
  runtime.elements.breakCapButton.addEventListener("click", runtime.breakInfiniteCap);
  runtime.elements.resetSaveButton.addEventListener("click", runtime.resetSave);
  runtime.elements.mainTabs.forEach((button) => {
    button.addEventListener("click", () => switchMainTab(button.dataset.tab));
  });
  runtime.elements.infinitySubtabs.forEach((button) => {
    button.addEventListener("click", () => switchInfinitySubtab(button.dataset.infinityTab));
  });
  runtime.elements.floatingTextToggle.addEventListener("change", () => applySetting("showFloatingText", runtime.elements.floatingTextToggle.checked));
  runtime.elements.lightEffectsToggle.addEventListener("change", () => applySetting("lightEffects", runtime.elements.lightEffectsToggle.checked));
  runtime.elements.fpsToggle.addEventListener("change", () => applySetting("showFps", runtime.elements.fpsToggle.checked));
  runtime.elements.automationMasterToggle.addEventListener("change", () => applySetting("automationEnabled", runtime.elements.automationMasterToggle.checked));
  runtime.elements.autoBuySpeedToggle.addEventListener("change", () => applySetting("autoBuySpeed", runtime.elements.autoBuySpeedToggle.checked));
  runtime.elements.autoBuyVertexToggle.addEventListener("change", () => applySetting("autoBuyVertex", runtime.elements.autoBuyVertexToggle.checked));
  runtime.elements.autoBuyGainToggle.addEventListener("change", () => applySetting("autoBuyGain", runtime.elements.autoBuyGainToggle.checked));
  if (runtime.elements.autoCompleteChallengesToggle) runtime.elements.autoCompleteChallengesToggle.addEventListener("change", () => applySetting("autoCompleteChallenges", runtime.elements.autoCompleteChallengesToggle.checked));
  runtime.elements.languageSelect.addEventListener("change", () => applySetting("language", runtime.elements.languageSelect.value));
  runtime.elements.numberFormatSelect.addEventListener("change", () => applySetting("numberFormat", runtime.elements.numberFormatSelect.value));
  runtime.elements.timeUnitSelect.addEventListener("change", () => applySetting("timeUnit", runtime.elements.timeUnitSelect.value));
  if (runtime.elements.exportSaveCodeButton) runtime.elements.exportSaveCodeButton.addEventListener("click", runtime.exportSaveCode);
  if (runtime.elements.importSaveCodeButton) runtime.elements.importSaveCodeButton.addEventListener("click", runtime.importSaveCodeFromUi);
  if (runtime.elements.copySaveCodeButton) runtime.elements.copySaveCodeButton.addEventListener("click", runtime.copySaveCodeFromUi);
  if (runtime.elements.updateModalClose) runtime.elements.updateModalClose.addEventListener("click", runtime.closeUpdateModal);
  window.addEventListener("beforeunload", () => runtime.saveGame("manual"));
  window.addEventListener("resize", runtime.resizeCanvas);
  const canvasResizeObserver = window.ResizeObserver && runtime.canvas.parentElement
    ? new ResizeObserver(runtime.resizeCanvas)
    : null;
  if (canvasResizeObserver) canvasResizeObserver.observe(runtime.canvas.parentElement);
  window.addEventListener("keydown", (event) => {
    const updateModalVisible = runtime.elements.updateModal && !runtime.elements.updateModal.hidden;
    if (updateModalVisible && event.key === "Escape") {
      runtime.closeUpdateModal();
      return;
    }
    if (updateModalVisible) return;
    if (event.key.toLowerCase() === "f") {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    }
  });
}
expose("switchMainTab", () => switchMainTab, (value) => { switchMainTab = value; });
expose("switchInfinitySubtab", () => switchInfinitySubtab, (value) => { switchInfinitySubtab = value; });
expose("applySetting", () => applySetting, (value) => { applySetting = value; });
expose("bindEvents", () => bindEvents, (value) => { bindEvents = value; });
