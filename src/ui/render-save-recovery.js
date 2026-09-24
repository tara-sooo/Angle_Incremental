import { runtime, expose } from "../runtime/shared.js";
import { formatExactInteger } from "./format-exact-integer.js";

let renderedRecoveryRevision = -1;
let renderedRecoveryLanguage = "";
let renderedRecoveryNumberFormat = "";
let renderedLoadRecoveryMode = false;
let renderedSaveConflictMode = false;
let renderedSaveConflictCheckpointReady = false;

function formatRecoveryTimestamp(timestamp) {
  const numeric = Number(timestamp);
  if (!Number.isFinite(numeric) || numeric <= 0) return runtime.t("recoveryUnknownTime");
  try {
    return new Date(numeric).toLocaleString(runtime.state.language === "en" ? "en-US" : "ja-JP");
  } catch (error) {
    return runtime.t("recoveryUnknownTime");
  }
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
  const infinityCountExact = runtime.parseExactInteger(
    state.infinityCountExact,
    runtime.parseExactInteger(state.infinityCount, 0n),
  );
  return [
    `${runtime.t("recoveryInfinity")}: ${formatExactInteger(infinityCountExact)}`,
    `${runtime.t("recoveryIp")}: ${runtime.formatHeldUiLogNumber(infinityPointsLog10, state.infinityPointsExact)}`,
    `${runtime.t("recoveryChallenges")}: ${countBits(state.completedChallenges)}/${runtime.INFINITY_CHALLENGE_COUNT}`,
    `${runtime.t("recoveryAchievements")}: ${countAchievementBits(state)}/${runtime.ACHIEVEMENT_COUNT}`,
    `${runtime.t("recoveryIa")}: ${state.infiniteAngleUnlocked ? runtime.t("recoveryUnlocked") : runtime.t("recoveryLocked")}`,
    `${runtime.t("recoveryTower")}: ${Math.max(0, Math.floor(Number(state.towerFloor) || 0))}`,
  ].join(" · ");
}

export function updateSaveRecoveryUi() {
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
  if (
    elements.saveRecoveryDetails
    && (recovery.loadFailure
      || runtime.loadRecoveryMode
      || runtime.saveConflictMode
      || recovery.quarantine
      || recovery.preImport
      || recovery.undo)
  ) {
    elements.saveRecoveryDetails.open = true;
  }
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
  runtime.clearElement(elements.saveCheckpointList);
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

expose("updateSaveRecoveryUi", () => updateSaveRecoveryUi);
