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
    ? String(report.processedTicks)
    : "-";
  elements.offlineReportTimeFlux.textContent = report.offlineProgressEnabled
    ? formatFluxTime(0)
    : formatFluxTime(report.timeFluxGained);
  elements.offlineReportInfinity.textContent = `+${Math.max(
    0,
    report.infinityCountAfter - report.infinityCountBefore,
  )}`;
  elements.offlineReportIp.textContent = runtime.formatUiLogNumber(report.infinityPointsAfterLog10);
  elements.offlineReportNote.textContent = report.capped
    ? runtime.t("offlineReportCapped")
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
  elements.timeFluxAmount.textContent = `${formatFluxTime(state.timeFlux)} / ${formatFluxTime(capacity)}`;
  elements.timeFluxGain.textContent = `${formatFluxTime(runtime.timeFluxGain())}/${runtime.t("hourShort")}`;
  elements.timeFluxSpeed.textContent = `×${speed}`;
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
  runtime.syncFormControl(
    elements.timeFluxCustomSpeedInput,
    speed >= 4 ? speed : 4,
  );
  updateOfflineReportUi();
}

expose("updateTimeFluxUi", () => updateTimeFluxUi);
expose("formatFluxTime", () => formatFluxTime);
