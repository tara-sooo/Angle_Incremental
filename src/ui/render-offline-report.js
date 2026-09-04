import { runtime, expose } from "../runtime/shared.js";

const OFFLINE_REPORT_ENTRIES = Object.freeze([
  {
    key: "score",
    labelKey: "offlineReportScore",
    value: (snapshot) => snapshot.scoreLog10,
    unlocked: (snapshot) => snapshot.scoreUnlocked ?? true,
    format: (value) => runtime.formatUiLogNumber(value, true),
  },
  {
    key: "generation",
    labelKey: "offlineReportGeneration",
    value: (snapshot) => snapshot.generationCount,
    unlocked: (snapshot) => snapshot.generationUnlocked ?? snapshot.generationCount > 0,
    format: (value) => runtime.formatUiNumber(value),
  },
  {
    key: "coreBoost",
    labelKey: "offlineReportCoreBoost",
    value: (snapshot) => snapshot.coreBoostCount,
    unlocked: (snapshot) => snapshot.coreBoostUnlocked ?? snapshot.coreBoostCount > 0,
    format: (value) => runtime.formatUiNumber(value),
  },
  {
    key: "infinityCount",
    labelKey: "offlineReportInfinityCount",
    value: (snapshot) => snapshot.infinityCount,
    unlocked: (snapshot) => snapshot.infinityUnlocked ?? snapshot.infinityCount > 0,
    format: (value) => runtime.formatUiNumber(value),
  },
  {
    key: "infinityPoints",
    labelKey: "offlineReportInfinityPoints",
    value: (snapshot) => snapshot.infinityPointsLog10,
    unlocked: (snapshot) => snapshot.infinityUnlocked ?? snapshot.infinityCount > 0,
    format: (value, snapshot) => runtime.formatHeldUiLogNumber(value, snapshot.infinityPointsExact),
  },
  {
    key: "infiniteScore",
    labelKey: "offlineReportInfiniteScore",
    value: (snapshot) => snapshot.infiniteScoreLog10,
    unlocked: (snapshot) => snapshot.infiniteAngleUnlocked === true,
    format: (value) => runtime.formatHeldUiLogNumber(value),
  },
  {
    key: "eternityCount",
    labelKey: "offlineReportEternityCount",
    value: (snapshot) => snapshot.eternityCount,
    unlocked: (snapshot) => snapshot.eternityUnlocked ?? snapshot.eternityCount > 0,
    format: (value) => runtime.formatUiNumber(value),
  },
]);

function formatOfflineTime(seconds) {
  if (!Number.isFinite(seconds)) return "∞";
  return runtime.formatLongDuration(seconds);
}

function clearElement(element) {
  while (element?.firstChild) element.removeChild(element.firstChild);
}

function isEntryUnlocked(entry, before, after) {
  return Boolean(entry.unlocked(before) || entry.unlocked(after));
}

function increasedEntry(entry, before, after) {
  if (!before || !after || !isEntryUnlocked(entry, before, after)) return false;
  const beforeValue = entry.value(before);
  const afterValue = entry.value(after);
  return !Number.isNaN(afterValue) && afterValue > beforeValue;
}

function appendChangeRow(container, entry, before, after) {
  const row = document.createElement("div");
  row.className = "offline-report-change";
  row.dataset.offlineReportChange = entry.key;

  const label = document.createElement("span");
  label.className = "offline-report-change-label";
  label.textContent = runtime.t(entry.labelKey);

  const values = document.createElement("span");
  values.className = "offline-report-change-values";
  const beforeValue = document.createElement("span");
  beforeValue.className = "offline-report-change-before";
  beforeValue.textContent = entry.format(entry.value(before), before);
  const arrow = document.createElement("span");
  arrow.className = "offline-report-change-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "→";
  const afterValue = document.createElement("strong");
  afterValue.className = "offline-report-change-after";
  afterValue.textContent = entry.format(entry.value(after), after);
  values.append(beforeValue, arrow, afterValue);
  row.append(label, values);
  container.append(row);
}

function renderOfflineChanges(report) {
  const elements = runtime.elements;
  if (!elements.offlineReportChanges || !elements.offlineReportNoChanges) return;
  clearElement(elements.offlineReportChanges);
  const before = report.before;
  const after = report.after;
  const changedEntries = OFFLINE_REPORT_ENTRIES.filter((entry) => increasedEntry(entry, before, after));
  changedEntries.forEach((entry) => appendChangeRow(elements.offlineReportChanges, entry, before, after));
  elements.offlineReportNoChanges.hidden = changedEntries.length > 0;
}

function updateOfflineReportUi() {
  const report = runtime.offlineReport;
  const elements = runtime.elements;
  if (!elements.offlineReportPanel) return;
  elements.offlineReportPanel.hidden = !report;
  if (!report) return;

  const processing = report.processing === true;
  elements.offlineReportMode.textContent = runtime.t(
    processing ? "offlineReportProcessing" : "offlineReportProgressMode",
  );
  if (elements.offlineReportProgress) {
    elements.offlineReportProgress.hidden = !processing;
    if (processing) {
      const progress = report.requestedTicks > 0
        ? Math.min(1, report.processedTicks / report.requestedTicks)
        : 1;
      elements.offlineReportProgress.value = progress;
      elements.offlineReportProgress.setAttribute("aria-valuenow", String(report.processedTicks));
      elements.offlineReportProgress.setAttribute("aria-valuemax", String(report.requestedTicks));
    }
  }
  if (elements.offlineReportResult) elements.offlineReportResult.hidden = processing;
  if (elements.offlineReportClose) elements.offlineReportClose.hidden = processing;
  if (elements.offlineReportElapsed) elements.offlineReportElapsed.textContent = formatOfflineTime(report.elapsedSeconds);
  if (!processing) renderOfflineChanges(report);

  const noteText = report.clockAnomaly
    ? runtime.t("offlineReportClockAnomaly")
    : report.clockSource === "local-fallback"
      ? runtime.t("offlineReportLocalFallback")
      : report.legacyTimestampUsed
        ? runtime.t("offlineReportLegacyTimestamp")
        : report.capped
          ? runtime.t("offlineReportCapped")
          : "";
  elements.offlineReportNote.textContent = noteText;
  elements.offlineReportNote.hidden = processing || !noteText;
}

expose("updateOfflineReportUi", () => updateOfflineReportUi);
expose("formatOfflineTime", () => formatOfflineTime);
