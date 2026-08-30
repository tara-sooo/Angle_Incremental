import { runtime, expose } from "../runtime/shared.js";

function formatOfflineTime(seconds) {
  if (!Number.isFinite(seconds)) return "∞";
  return runtime.formatLongDuration(seconds);
}

function updateOfflineReportUi() {
  const report = runtime.offlineReport;
  const elements = runtime.elements;
  if (!elements.offlineReportPanel) return;
  elements.offlineReportPanel.hidden = !report;
  if (!report) return;

  elements.offlineReportMode.textContent = runtime.t("offlineReportProgressMode");
  elements.offlineReportElapsed.textContent = formatOfflineTime(report.elapsedSeconds);
  elements.offlineReportEffective.textContent = formatOfflineTime(report.simulatedSeconds);
  if (elements.offlineReportProgress) {
    const progress = report.requestedTicks > 0
      ? Math.min(1, report.processedTicks / report.requestedTicks)
      : 1;
    elements.offlineReportProgress.value = progress;
    elements.offlineReportProgress.setAttribute("aria-valuenow", String(report.processedTicks));
    elements.offlineReportProgress.setAttribute("aria-valuemax", String(report.requestedTicks));
  }
  if (elements.offlineReportConfiguredTicks) {
    elements.offlineReportConfiguredTicks.textContent = String(report.configuredTicks ?? report.requestedTicks ?? 0);
  }
  if (elements.offlineReportRequestedTicks) {
    elements.offlineReportRequestedTicks.textContent = String(report.requestedTicks ?? 0);
  }
  elements.offlineReportTicks.textContent = report.precisionReduced
    ? `${report.processedTicks} / ${report.requestedTicks}`
    : String(report.processedTicks);
  if (elements.offlineReportProcessingTime) {
    elements.offlineReportProcessingTime.textContent = `${Math.max(0, Math.round(report.processingMilliseconds || 0))}ms`;
  }
  if (elements.offlineReportNormalInfinity) {
    elements.offlineReportNormalInfinity.textContent = `+${Math.max(0, report.normalInfinityCountGain || 0)}`;
  }
  if (elements.offlineReportAggregatedInfinity) {
    elements.offlineReportAggregatedInfinity.textContent = `+${Math.max(0, report.aggregatedInfinityCountGain || 0)}`;
  }
  elements.offlineReportInfinity.textContent = `+${Math.max(
    0,
    report.infinityCountAfter - report.infinityCountBefore,
  )}`;
  elements.offlineReportIp.textContent = runtime.formatHeldUiLogNumber(
    report.infinityPointsAfterLog10,
    runtime.state.infinityPointsExact,
  );
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
            : "";
}

expose("updateOfflineReportUi", () => updateOfflineReportUi);
expose("formatOfflineTime", () => formatOfflineTime);
