import { runtime, expose } from "./shared.js";

let offlineBaselineTimestamp = Date.now();
let offlineBaselineServerTimestamp = 0;
let visibilityResumeInFlight = false;
let visibilityResumeGeneration = 0;
function setOfflineProcessingLock(locked) {
  if (!document.querySelectorAll) return;
  document.querySelectorAll("button, input, select, textarea").forEach((control) => {
    if (!control.dataset) return;
    if (locked) {
      if (control.disabled) return;
      control.dataset.offlineProcessingLocked = "true";
      control.disabled = true;
    } else if (control.dataset.offlineProcessingLocked === "true") {
      control.disabled = false;
      delete control.dataset.offlineProcessingLocked;
    }
  });
}

function setSaveConflictLock(locked) {
  if (!document.querySelectorAll) return;
  document.querySelectorAll("button, input, select, textarea").forEach((control) => {
    if (!control.dataset) return;
    const recoveryControl = [
      "reloadLatestSaveButton",
      "exportSaveCodeButton",
      "copySaveCodeButton",
      "saveCodeArea",
    ].includes(control.id);
    const navigationControl = [
      "main-tab",
      "subtab",
      "infinity-subtab",
      "challenge-subtab",
      "statistics-subtab",
    ].some((className) => control.classList?.contains(className));
    if (recoveryControl || navigationControl) return;
    if (locked) {
      if (control.disabled) return;
      control.dataset.saveConflictLocked = "true";
      control.disabled = true;
    } else if (control.dataset.saveConflictLocked === "true") {
      control.disabled = false;
      delete control.dataset.saveConflictLocked;
    }
  });
}

function setOfflineBaseline(timestamp = runtime.localClockNowMs(), serverTimestamp = 0) {
  const localValue = runtime.sanitizeNumber(timestamp, runtime.localClockNowMs());
  const serverValue = runtime.sanitizeNumber(serverTimestamp, 0);
  offlineBaselineTimestamp = Number.isFinite(localValue) ? localValue : runtime.localClockNowMs();
  offlineBaselineServerTimestamp = Number.isFinite(serverValue) && serverValue > 0 ? serverValue : 0;
}

function invalidateVisibilityResume() {
  visibilityResumeGeneration += 1;
}

function saveSourceIsCurrent() {
  return runtime.saveSourceIsCurrent ? runtime.saveSourceIsCurrent() : true;
}

async function handleSaveConflict() {
  if (runtime.offlineProcessing || runtime.loadInFlight) return false;
  runtime.beginSaveConflict?.();
  runtime.updateUi();
  return false;
}

function handleStorageChange(event) {
  if ((event?.key !== null && event?.key !== runtime.SAVE_KEY) || runtime.offlineProcessing || visibilityResumeInFlight) return;
  if (saveSourceIsCurrent() && !runtime.saveConflictMode) return;
  return handleSaveConflict();
}

async function handleVisibilityChange(hidden = document.hidden) {
  if (runtime.offlineProcessing || runtime.saveConflictMode || runtime.loadRecoveryMode) return;
  if (hidden) {
    const transactionSnapshot = runtime.snapshotOfflineTransaction();
    try {
      if (!saveSourceIsCurrent()) {
        await handleSaveConflict();
        return;
      }
      const saved = runtime.saveGame("auto");
      if (!saved) {
        if (runtime.saveConflictMode) {
          await handleSaveConflict();
          return;
        }
        runtime.restoreOfflineTransaction(transactionSnapshot);
      }
    } catch {
      runtime.restoreOfflineTransaction(transactionSnapshot);
    }
    return;
  }
  if (visibilityResumeInFlight) return;
  visibilityResumeInFlight = true;
  const transactionSnapshot = runtime.snapshotOfflineTransaction();
  // Saving while the clock request is pending may rebase the shared baseline.
  // Keep the interval that this resume began with so it cannot be discarded.
  const resumeBaselineTimestamp = offlineBaselineTimestamp;
  const resumeBaselineServerTimestamp = offlineBaselineServerTimestamp;
  const resumeBaselineSaveFingerprint = runtime.lastKnownSaveFingerprint || "";
  const resumeBaselineSaveRevision = runtime.saveRevision;
  const resumeGeneration = visibilityResumeGeneration;
  try {
    if (!saveSourceIsCurrent()) {
      await handleSaveConflict();
      return;
    }
    if (!runtime.state.offlineProgressEnabled) {
      runtime.offlineReport = null;
      runtime.rebaseLocalClock();
      setOfflineBaseline(
        runtime.localClockNowMs(),
        runtime.serverClockAvailable() ? runtime.serverClockNowMs() : 0,
      );
      runtime.updateUi();
      if (!runtime.saveGame("manual")) {
        if (runtime.saveConflictMode) {
          await handleSaveConflict();
          return;
        }
        runtime.restoreOfflineTransaction(transactionSnapshot);
        return;
      }
      runtime.lastTime = runtime.currentFrameTime();
      return;
    }
    await runtime.syncServerClock();
    if (resumeGeneration !== visibilityResumeGeneration) return;

    const expectedSaveFingerprint = runtime.saveRevision !== resumeBaselineSaveRevision
      ? runtime.lastLocalSaveFingerprint || runtime.lastKnownSaveFingerprint || ""
      : resumeBaselineSaveFingerprint;
    const currentFingerprint = runtime.currentSaveFingerprint?.() || "";
    if (currentFingerprint !== expectedSaveFingerprint) {
      await handleSaveConflict();
      return;
    }
    const elapsed = runtime.offlineElapsedFromSave(resumeBaselineTimestamp, resumeBaselineServerTimestamp);
    if (elapsed.elapsedSeconds > 0 || elapsed.clockAnomaly) {
      await runtime.processOfflineElapsed(elapsed.elapsedSeconds, "visibility", elapsed);
    } else {
      setOfflineBaseline(
        runtime.localClockNowMs(),
        runtime.serverClockAvailable() ? runtime.serverClockNowMs() : 0,
      );
    }
  } catch {
    runtime.restoreOfflineTransaction(transactionSnapshot);
  } finally {
    visibilityResumeInFlight = false;
  }
}

expose("offlineBaselineTimestamp", () => offlineBaselineTimestamp, (value) => { offlineBaselineTimestamp = value; });
expose("offlineBaselineServerTimestamp", () => offlineBaselineServerTimestamp, (value) => { offlineBaselineServerTimestamp = value; });
expose("setOfflineBaseline", () => setOfflineBaseline, (value) => { setOfflineBaseline = value; });
expose("setSaveConflictLock", () => setSaveConflictLock, (value) => { setSaveConflictLock = value; });
expose("setOfflineProcessingLock", () => setOfflineProcessingLock);
expose("handleSaveConflict", () => handleSaveConflict, (value) => { handleSaveConflict = value; });
expose("handleStorageChange", () => handleStorageChange, (value) => { handleStorageChange = value; });
expose("invalidateVisibilityResume", () => invalidateVisibilityResume);
expose("handleVisibilityChange", () => handleVisibilityChange, (value) => { handleVisibilityChange = value; });
expose("visibilityResumeInFlight", () => visibilityResumeInFlight);
