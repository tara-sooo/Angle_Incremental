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
  elements.offlineReportTicks.textContent = report.precisionReduced
    ? `${report.processedTicks} / ${report.requestedTicks}`
    : String(report.processedTicks);
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
            : "";
}

expose("updateOfflineReportUi", () => updateOfflineReportUi);
expose("formatOfflineTime", () => formatOfflineTime);
