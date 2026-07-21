import { runtime, expose } from "../runtime/shared.js";

function formatFluxTime(seconds) {
  if (!Number.isFinite(seconds)) return "∞";
  return runtime.formatLongDuration(seconds);
}

function updateOfflineReportUi() {
  const report = runtime.offlineReport;
  const elements = runtime.elements;
  if (!elements.offlineReportPanel) return;
  elements.offlineReportPanel.hidden = !report;
  if (!report) return;

  elements.offlineReportMode.textContent = report.offlineProgressEnabled
    ? runtime.t("offlineReportProgressMode")
    : runtime.t("offlineReportFluxMode");
  elements.offlineReportElapsed.textContent = formatFluxTime(report.elapsedSeconds);
  elements.offlineReportEffective.textContent = report.offlineProgressEnabled
    ? formatFluxTime(report.simulatedSeconds)
    : formatFluxTime(report.timeFluxGained);
  elements.offlineReportTicks.textContent = report.offlineProgressEnabled
    ? report.precisionReduced
      ? `${report.processedTicks} / ${report.requestedTicks}`
      : String(report.processedTicks)
    : "-";
  elements.offlineReportTimeFlux.textContent = report.offlineProgressEnabled
    ? formatFluxTime(0)
    : formatFluxTime(report.timeFluxGained);
  elements.offlineReportInfinity.textContent = `+${Math.max(
    0,
    report.infinityCountAfter - report.infinityCountBefore,
  )}`;
  elements.offlineReportIp.textContent = runtime.formatUiLogNumber(report.infinityPointsAfterLog10);
  elements.offlineReportNote.textContent = report.clockAnomaly
    ? runtime.t("offlineReportClockAnomaly")
    : report.clockSource === "local-fallback"
      ? runtime.t("offlineReportLocalFallback")
      : report.legacyTimestampUsed
        ? runtime.t("offlineReportLegacyTimestamp")
        : report.capped
          ? runtime.t("offlineReportCapped")
          : report.precisionReduced
            ? runtime.t("offlineReportPrecisionReduced")
            : report.capacityReached
              ? runtime.t("offlineReportCapacityReached")
              : "";
}

function updateTimeFluxUi() {
  const elements = runtime.elements;
  if (!elements.timeFluxPanel) return;
  const state = runtime.state;
  const capacity = runtime.timeFluxCapacity();
  const speed = runtime.clampTimeFluxSpeed(state.timeFluxSpeed);
  const amountText = `${formatFluxTime(state.timeFlux)} / ${formatFluxTime(capacity)}`;
  elements.timeFluxAmount.textContent = amountText;
  elements.timeFluxQuickAmount.textContent = amountText;
  elements.timeFluxGain.textContent = `${formatFluxTime(runtime.timeFluxGain())}/${runtime.t("hourShort")}`;
  const speedText = `×${speed}`;
  elements.timeFluxSpeed.textContent = speedText;
  elements.timeFluxQuickSpeed.textContent = speedText;
  const customSpeed = runtime.clampTimeFluxCustomSpeed(state.timeFluxCustomSpeed);
  const customSpeedInputDirty = elements.timeFluxCustomSpeedInput?.dataset.customSpeedDirty === "true";
  const customSpeedButtonValue = customSpeedInputDirty
    ? runtime.clampTimeFluxCustomSpeed(elements.timeFluxCustomSpeedInput.value)
    : customSpeed;
  elements.timeFluxQuickCustomSpeed.textContent = `×${customSpeed}`;
  if (elements.timeFluxQuickCustomSpeedButton) {
    const customActive = speed === customSpeed;
    elements.timeFluxQuickCustomSpeedButton.classList.toggle("is-active", customActive);
    elements.timeFluxQuickCustomSpeedButton.setAttribute("aria-pressed", String(customActive));
    elements.timeFluxQuickCustomSpeedButton.setAttribute(
      "aria-label",
      `${runtime.t("timeFluxCustomSpeedLabel")} ×${customSpeed}`,
    );
  }
  if (elements.timeFluxCustomSpeedApplyValue) {
    elements.timeFluxCustomSpeedApplyValue.textContent = `×${customSpeedButtonValue}`;
  }
  if (elements.timeFluxCustomSpeedApply) {
    const customActive = speed === customSpeedButtonValue;
    elements.timeFluxCustomSpeedApply.classList.toggle("is-active", customActive);
    elements.timeFluxCustomSpeedApply.setAttribute("aria-pressed", String(customActive));
    elements.timeFluxCustomSpeedApply.setAttribute(
      "aria-label",
      `${runtime.t("timeFluxCustomSpeedApply")} ×${customSpeedButtonValue}`,
    );
  }
  elements.timeFluxQuickBar.hidden = !state.showTimeFluxQuickBar;
  const quickBarOverlayTop = state.showTimeFluxQuickBar
    ? Math.ceil(elements.timeFluxQuickBar.getBoundingClientRect().bottom + 10)
    : 0;
  const rootStyle = document.documentElement?.style;
  if (typeof rootStyle?.setProperty === "function") {
    rootStyle.setProperty(
      "--time-flux-quickbar-overlay-top",
      `${quickBarOverlayTop}px`,
    );
  }
  elements.timeFluxOfflineStatus.textContent = state.offlineProgressEnabled
    ? runtime.t("offlineProgressEnabled")
    : runtime.t("offlineProgressDisabled");
  elements.timeFluxGainLevel.textContent = `${runtime.t("level")} ${state.timeFluxGainLevel}`;
  elements.timeFluxCapacityLevel.textContent = `${runtime.t("level")} ${state.timeFluxCapacityLevel}`;
  elements.timeFluxGainEffect.textContent = `${formatFluxTime(runtime.timeFluxGain())}/${runtime.t("hourShort")}`;
  elements.timeFluxCapacityEffect.textContent = formatFluxTime(capacity);
  elements.timeFluxGainCost.textContent = `${runtime.t("cost")} ${formatFluxTime(runtime.timeFluxGainUpgradeCost())}`;
  elements.timeFluxCapacityCost.textContent = `${runtime.t("cost")} ${formatFluxTime(runtime.timeFluxCapacityUpgradeCost())}`;
  elements.timeFluxGainUpgrade.disabled = !runtime.canBuyTimeFluxUpgrade("gain");
  elements.timeFluxCapacityUpgrade.disabled = !runtime.canBuyTimeFluxUpgrade("capacity");

  elements.timeFluxSpeedButtons.forEach((button) => {
    const buttonSpeed = Number(button.dataset.speed);
    const active = buttonSpeed === speed;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  runtime.syncFormControl(elements.timeFluxOfflineToggle, state.offlineProgressEnabled);
  runtime.syncFormControl(elements.timeFluxTickInput, state.offlineTickCount);
  if (!customSpeedInputDirty) runtime.syncFormControl(elements.timeFluxCustomSpeedInput, customSpeed);
  updateOfflineReportUi();
}

expose("updateTimeFluxUi", () => updateTimeFluxUi);
expose("formatFluxTime", () => formatFluxTime);
