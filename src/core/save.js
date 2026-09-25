import { runtime, expose } from "../runtime/shared.js";
import {
  clampOfflineTickCount,
  normalizeStoredSave,
  applySaveData,
  serializeSaveData,
  snapshotRuntimeState,
  restoreRuntimeState,
} from "./save-format.js";
import {
  createSaveBackup,
  migrateLegacyBackups,
  getBackupState,
  clearLegacyRecoveryData,
} from "./save-backups.js";

let recoveryRevision = 0;
let saveRevision = 0;
let lastLocalSaveFingerprint = "";
let lastKnownSaveFingerprint = "";
let loadTransactionActive = false;
let loadInFlight = false;
let loadRecoveryMode = false;
let saveConflictMode = false;
let bootResolution = "UNRESOLVED";

function saveFingerprint(raw) {
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${raw.length}:${hash >>> 0}`;
}

function currentSaveFingerprint() {
  try {
    const raw = localStorage.getItem(runtime.SAVE_KEY);
    return raw === null ? "" : saveFingerprint(raw);
  } catch (error) {
    return "";
  }
}

function saveSourceIsCurrent() {
  return currentSaveFingerprint() === lastKnownSaveFingerprint;
}

function readMainSave() {
  const raw = localStorage.getItem(runtime.SAVE_KEY);
  if (raw === null) return { raw, exists: false, save: null };
  try {
    return { raw, exists: true, save: normalizeStoredSave(JSON.parse(raw)) };
  } catch (error) {
    return { raw, exists: true, save: null };
  }
}

function beginSaveConflict() {
  saveConflictMode = true;
  runtime.setSaveConflictLock?.(true);
  runtime.switchMainTab?.("settings");
  runtime.setSaveStatus(runtime.t("saveConflictDetected"));
  runtime.updateUi?.();
  runtime.elements.saveRecoveryDetails?.scrollIntoView?.({ block: "center" });
  return true;
}

function finishSaveConflict() {
  saveConflictMode = false;
  runtime.setSaveConflictLock?.(false);
}

function finishLoadRecovery() {
  loadRecoveryMode = false;
  if (bootResolution === "RECOVERY") bootResolution = "UNRESOLVED";
}

function enterLoadRecovery(stage = "apply", error = null) {
  loadRecoveryMode = true;
  bootResolution = "RECOVERY";
  runtime.setSaveStatus(runtime.t(stage === "offline" ? "offlineProgressSkipped" : "loadRecoveryRequired"));
  runtime.updateUi?.();
}

function recoveryEntries() {
  return {
    ...getBackupState(),
    bootResolution,
    mainInvalid: (() => {
      try {
        const main = readMainSave();
        return main.exists && !main.save;
      } catch (error) {
        return true;
      }
    })(),
  };
}

function backupCurrentSave(reason = "pre-import") {
  try {
    const main = readMainSave();
    const backup = main.save && createSaveBackup(main.save, reason, { force: true });
    return Boolean(backup?.ok);
  } catch (error) {
    return false;
  }
}

function createCheckpoint(reason = "periodic", options = {}) {
  if (loadRecoveryMode && !options.allowDuringLoadRecovery) return false;
  if (saveConflictMode && !options.allowDuringSaveConflict) return false;
  if (runtime.offlineProcessing && reason === "periodic") return false;
  try {
    if (reason === "pre-update") return backupCurrentSave(reason);
    const save = reason === "periodic" ? readMainSave().save : serializeSaveData();
    if (!save) return false;
    const backup = createSaveBackup(save, reason, { ...options, force: options.force ?? reason !== "periodic" });
    if (backup?.changed) recoveryRevision += 1;
    return Boolean(backup?.ok);
  } catch (error) {
    runtime.setSaveStatus(runtime.t("checkpointSaveFailed"));
    return false;
  }
}

function saveGame(reason = "auto", options = {}) {
  if (loadTransactionActive) return true;
  if (saveConflictMode && !options.allowDuringSaveConflict) {
    runtime.autoSaveElapsed = 0;
    runtime.setSaveStatus(runtime.t("saveConflictDetected"));
    return false;
  }
  if (loadRecoveryMode && !options.allowDuringLoadRecovery) {
    runtime.autoSaveElapsed = 0;
    runtime.setSaveStatus(runtime.t("loadRecoveryRequired"));
    return false;
  }
  if (runtime.offlineProcessing) return true;
  if (!saveSourceIsCurrent()) {
    beginSaveConflict();
    runtime.autoSaveElapsed = 0;
    return false;
  }

  let saveData;
  let serializedSave;
  try {
    saveData = serializeSaveData();
    saveData.savedAt = runtime.localClockNowMs?.() ?? Date.now();
    serializedSave = JSON.stringify(saveData);
    localStorage.setItem(runtime.SAVE_KEY, serializedSave);
  } catch (error) {
    runtime.autoSaveElapsed = 0;
    runtime.setSaveStatus(runtime.t("saveFailed"));
    return false;
  }

  lastLocalSaveFingerprint = saveFingerprint(serializedSave);
  lastKnownSaveFingerprint = lastLocalSaveFingerprint;
  saveRevision += 1;
  runtime.autoSaveElapsed = 0;
  runtime.setOfflineBaseline?.(saveData.savedAt, saveData.serverSavedAt || 0);
  const backup = createSaveBackup(saveData, "periodic");
  if (backup?.changed) recoveryRevision += 1;
  runtime.setSaveStatus(runtime.t(
    backup?.ok ? (reason === "auto" ? "savedAuto" : "savedManual") : "checkpointSaveFailed",
  ));
  return true;
}

function setRecovery(errorKey = "loadRecoveryRequired") {
  loadRecoveryMode = true;
  bootResolution = "RECOVERY";
  runtime.autoSaveElapsed = 0;
  runtime.setSaveStatus(runtime.t(errorKey));
  runtime.updateUi?.();
}

function setOfflineBaselineNow() {
  runtime.setOfflineBaseline?.(
    runtime.localClockNowMs?.() ?? Date.now(),
    runtime.serverClockAvailable?.() ? runtime.serverClockNowMs?.() ?? 0 : 0,
  );
}

async function loadGame(options = {}) {
  const allowDuringLoadRecovery = Boolean(options.allowDuringLoadRecovery);
  const allowDuringSaveConflict = Boolean(options.allowDuringSaveConflict);
  const authoritativeSaveConflict = Boolean(options.authoritativeSaveConflict && allowDuringSaveConflict);
  const skipOfflineProgress = Boolean(options.skipOfflineProgress);
  if (saveConflictMode && !allowDuringSaveConflict) {
    runtime.setSaveStatus(runtime.t("saveConflictDetected"));
    return false;
  }
  if (loadRecoveryMode && !allowDuringLoadRecovery) {
    runtime.setSaveStatus(runtime.t("loadRecoveryRequired"));
    return false;
  }
  if (loadInFlight) return false;
  loadInFlight = true;
  loadTransactionActive = true;
  try {
    const main = readMainSave();
    const migration = migrateLegacyBackups(Boolean(main.save));
    if (main.exists && !main.save) {
      setRecovery("loadFailed");
      return false;
    }
    if (!main.save) {
      const backups = getBackupState();
      if (migration.blocked || migration.invalidStore || backups.invalid || backups.backups.length || backups.legacyRecovery) {
        setRecovery();
        return false;
      }
      runtime.resetState?.();
      runtime.offlineReport = null;
      loadRecoveryMode = false;
      bootResolution = "FRESH";
      lastKnownSaveFingerprint = "";
      lastLocalSaveFingerprint = "";
      setOfflineBaselineNow();
      runtime.setSaveStatus(runtime.t("noSave"));
      return true;
    }

    const loadedFingerprint = saveFingerprint(main.raw);
    try {
      applySaveData(main.save.state, main.save.version);
    } catch (error) {
      lastKnownSaveFingerprint = loadedFingerprint;
      setRecovery("loadFailed");
      return false;
    }

    loadRecoveryMode = false;
    bootResolution = "NORMAL";
    lastKnownSaveFingerprint = loadedFingerprint;
    const eternityResetOnLoad = runtime.maybeForceEternity?.({ save: false, update: false }) || false;
    let offlineProcessed = false;
    let offlineFailed = false;
    const savedAt = runtime.sanitizeNumber(main.save.savedAt, 0);
    const serverSavedAt = runtime.sanitizeNumber(main.save.serverSavedAt, 0);
    if (authoritativeSaveConflict || skipOfflineProgress) {
      setOfflineBaselineNow();
    } else {
      try {
        const elapsed = runtime.offlineElapsedFromSave?.(savedAt, serverSavedAt) || {
          elapsedSeconds: Math.max(0, (Date.now() - savedAt) / 1000),
          clockAnomaly: false,
        };
        if (runtime.processOfflineElapsed && (elapsed.elapsedSeconds > 0 || elapsed.clockAnomaly)) {
          const result = await runtime.processOfflineElapsed(elapsed.elapsedSeconds, "load", { ...elapsed });
          if (result === null) throw new Error("offline progress failed");
          offlineProcessed = true;
        } else {
          setOfflineBaselineNow();
        }
      } catch (error) {
        applySaveData(main.save.state, main.save.version);
        runtime.offlineReport = null;
        setOfflineBaselineNow();
        runtime.setSaveStatus(runtime.t("offlineProgressSkipped"));
        offlineFailed = true;
      }
    }

    if (offlineProcessed || (eternityResetOnLoad && !offlineFailed)) {
      loadTransactionActive = false;
      if (!saveGame("manual", { allowDuringLoadRecovery: true, allowDuringSaveConflict })) {
        if (saveConflictMode) return false;
        if (offlineProcessed) {
          applySaveData(main.save.state, main.save.version);
          runtime.offlineReport = null;
          setOfflineBaselineNow();
          runtime.setSaveStatus(runtime.t("offlineProgressSkipped"));
          offlineFailed = true;
        } else {
          setRecovery("loadFailed");
          return false;
        }
      }
    }

    if ((offlineFailed || (!offlineProcessed && !eternityResetOnLoad))
      && currentSaveFingerprint() !== loadedFingerprint) {
      beginSaveConflict();
      return false;
    }
    if (offlineFailed) {
      lastKnownSaveFingerprint = loadedFingerprint;
      runtime.autoSaveElapsed = 0;
      return true;
    }
    lastKnownSaveFingerprint = currentSaveFingerprint();
    runtime.autoSaveElapsed = 0;
    runtime.setSaveStatus(runtime.t("loaded"));
    return true;
  } catch (error) {
    setRecovery("loadFailed");
    return false;
  } finally {
    loadTransactionActive = false;
    loadInFlight = false;
  }
}

async function retryLoad() {
  const restored = await loadGame({
    allowDuringLoadRecovery: true,
    allowDuringSaveConflict: saveConflictMode,
    authoritativeSaveConflict: saveConflictMode,
  });
  if (restored) {
    finishSaveConflict();
    runtime.startGameLoop?.();
    runtime.updateUi?.();
    runtime.drawActiveView?.();
  }
  return restored;
}

async function replaceSave(candidate, reason = "replacement") {
  const save = normalizeStoredSave(candidate);
  if (!save || loadInFlight || runtime.offlineProcessing || saveConflictMode) {
    runtime.setSaveStatus(runtime.t("recoveryInvalid"));
    return false;
  }
  let current;
  const resolvingRecovery = loadRecoveryMode;
  try {
    current = readMainSave();
  } catch (error) {
    runtime.setSaveStatus(runtime.t("saveReplaceFailed"));
    return false;
  }
  if (!loadRecoveryMode && !saveSourceIsCurrent()) {
    beginSaveConflict();
    return false;
  }
  if (current.save) {
    const backup = createSaveBackup(current.save, reason, { force: true });
    if (!backup?.ok) {
      runtime.setSaveStatus(runtime.t("saveBackupFailed"));
      return false;
    }
    if (backup.changed) recoveryRevision += 1;
  }
  const serialized = JSON.stringify(save);
  try {
    localStorage.setItem(runtime.SAVE_KEY, serialized);
  } catch (error) {
    runtime.setSaveStatus(runtime.t("saveReplaceFailed"));
    return false;
  }
  lastKnownSaveFingerprint = saveFingerprint(serialized);
  lastLocalSaveFingerprint = lastKnownSaveFingerprint;
  recoveryRevision += 1;
  loadRecoveryMode = false;
  runtime.offlineReport = null;
  if (resolvingRecovery) clearLegacyRecoveryData();
  const loaded = await loadGame({
    allowDuringLoadRecovery: true,
    skipOfflineProgress: reason === "pre-reset",
  });
  if (loaded) {
    finishSaveConflict();
    runtime.startGameLoop?.();
    runtime.updateUi?.();
    runtime.drawActiveView?.();
  }
  return loaded;
}

function restoreBackup(slot, index) {
  const normalizedIndex = Math.floor(runtime.sanitizeNumber(index, -1));
  const entry = getBackupState().backups.find((candidate) => (
    candidate.slot === slot && candidate.index === normalizedIndex
  ));
  if (!entry?.save) {
    runtime.setSaveStatus(runtime.t("recoveryInvalid"));
    return false;
  }
  return replaceSave(entry.save, "pre-restore");
}

async function resetSave() {
  if (runtime.offlineProcessing || saveConflictMode) return false;
  runtime.invalidateVisibilityResume?.();
  const previousState = snapshotRuntimeState();
  let freshSave;
  try {
    runtime.resetState?.();
    freshSave = serializeSaveData();
  } catch (error) {
    runtime.setSaveStatus(runtime.t("saveReplaceFailed"));
    return false;
  } finally {
    restoreRuntimeState(previousState);
  }
  return replaceSave(freshSave, "pre-reset");
}

expose("normalizeStoredSave", () => normalizeStoredSave);
expose("clampOfflineTickCount", () => clampOfflineTickCount);
expose("applySaveData", () => applySaveData);
expose("serializeSaveData", () => serializeSaveData);
expose("snapshotRuntimeState", () => snapshotRuntimeState);
expose("restoreRuntimeState", () => restoreRuntimeState);
expose("saveGame", () => saveGame, (value) => { saveGame = value; });
expose("backupCurrentSave", () => backupCurrentSave, (value) => { backupCurrentSave = value; });
expose("createCheckpoint", () => createCheckpoint, (value) => { createCheckpoint = value; });
expose("recoveryEntries", () => recoveryEntries, (value) => { recoveryEntries = value; });
expose("recoveryRevision", () => recoveryRevision);
expose("saveRevision", () => saveRevision);
expose("lastLocalSaveFingerprint", () => lastLocalSaveFingerprint);
expose("lastKnownSaveFingerprint", () => lastKnownSaveFingerprint);
expose("loadInFlight", () => loadInFlight);
expose("loadRecoveryMode", () => loadRecoveryMode);
expose("saveConflictMode", () => saveConflictMode);
expose("bootResolution", () => bootResolution);
expose("beginSaveConflict", () => beginSaveConflict);
expose("finishSaveConflict", () => finishSaveConflict);
expose("finishLoadRecovery", () => finishLoadRecovery);
expose("currentSaveFingerprint", () => currentSaveFingerprint);
expose("saveSourceIsCurrent", () => saveSourceIsCurrent);
expose("enterLoadRecovery", () => enterLoadRecovery);
expose("loadGame", () => loadGame);
expose("retryLoad", () => retryLoad, (value) => { retryLoad = value; });
expose("replaceSave", () => replaceSave, (value) => { replaceSave = value; });
expose("restoreBackup", () => restoreBackup, (value) => { restoreBackup = value; });
expose("resetSave", () => resetSave, (value) => { resetSave = value; });

export { loadGame };
