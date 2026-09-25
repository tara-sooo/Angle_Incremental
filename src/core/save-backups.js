import { runtime } from "../runtime/shared.js";
import { normalizeStoredSave } from "./save-format.js";

const LEGACY_KEYS = [
  "SAVE_QUARANTINE_KEY",
  "SAVE_LOAD_FAILURE_KEY",
  "SAVE_PRE_IMPORT_KEY",
  "SAVE_RESTORE_UNDO_KEY",
  "SAVE_CHECKPOINTS_KEY",
];
let lastPeriodicCheckpointMonotonicAt = null;

function emptyBackupStore() {
  return { periodic: [], preUpdate: null, reserve: null };
}

function normalizeBackupEntry(entry, reason) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const save = normalizeStoredSave(entry.save);
  if (!save) return null;
  return {
    createdAt: runtime.sanitizeNumber(entry.createdAt, save.savedAt),
    reason: reason || (typeof entry.reason === "string" ? entry.reason : "backup"),
    save,
  };
}

function normalizeBackupStore(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.periodic)) return null;
  const periodic = value.periodic.map((entry) => normalizeBackupEntry(entry, "periodic"));
  if (periodic.some((entry) => !entry) || periodic.length > 3) return null;
  const preUpdate = value.preUpdate === null ? null : normalizeBackupEntry(value.preUpdate, "pre-update");
  const reserve = value.reserve === null ? null : normalizeBackupEntry(value.reserve);
  if ((value.preUpdate !== null && !preUpdate) || (value.reserve !== null && !reserve)) return null;
  return { periodic, preUpdate, reserve };
}

function readBackupStore() {
  try {
    const raw = localStorage.getItem(runtime.SAVE_BACKUPS_KEY);
    if (raw === null) return { store: emptyBackupStore(), exists: false, invalid: false };
    const store = normalizeBackupStore(JSON.parse(raw));
    return store
      ? { store, exists: true, invalid: false }
      : { store: emptyBackupStore(), exists: true, invalid: true };
  } catch (error) {
    return { store: emptyBackupStore(), exists: true, invalid: true };
  }
}

function writeBackupStore(store) {
  const normalized = normalizeBackupStore(store);
  if (!normalized) return false;
  try {
    localStorage.setItem(runtime.SAVE_BACKUPS_KEY, JSON.stringify(normalized));
    return true;
  } catch (error) {
    return false;
  }
}

function periodicBackupDue(save, latest) {
  if (!latest) return true;
  const monotonicNow = runtime.monotonicClockNowMs?.();
  if (Number.isFinite(monotonicNow)
    && Number.isFinite(lastPeriodicCheckpointMonotonicAt)
    && monotonicNow - lastPeriodicCheckpointMonotonicAt < runtime.SAVE_CHECKPOINT_INTERVAL_MS) return false;
  const useServerClock = runtime.serverClockAvailable?.()
    && save.serverSavedAt > 0
    && latest.save.serverSavedAt > 0;
  const elapsed = useServerClock
    ? save.serverSavedAt - latest.save.serverSavedAt
    : save.savedAt - latest.save.savedAt;
  return elapsed < 0 || elapsed >= runtime.SAVE_CHECKPOINT_INTERVAL_MS;
}

function createSaveBackup(saveData, reason = "periodic", options = {}) {
  const save = normalizeStoredSave(saveData);
  if (!save) return false;
  const current = readBackupStore();
  if (current.invalid) return false;
  const store = current.store;
  const entry = {
    createdAt: runtime.localClockNowMs?.() ?? Date.now(),
    reason,
    save,
  };
  if (reason === "periodic") {
    const latest = store.periodic[0] || null;
    if (!options.force && !periodicBackupDue(save, latest)) return { ok: true, changed: false };
    store.periodic = [entry, ...store.periodic].slice(0, 3);
  } else if (reason === "pre-update") {
    store.preUpdate = entry;
  } else {
    store.reserve = entry;
  }
  if (!writeBackupStore(store)) return false;
  if (reason === "periodic") {
    const monotonicNow = runtime.monotonicClockNowMs?.();
    lastPeriodicCheckpointMonotonicAt = Number.isFinite(monotonicNow) ? monotonicNow : null;
  }
  return { ok: true, changed: true };
}

function legacyBackupEntry(value, fallbackReason) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value.save && typeof value.save === "object"
    ? value.save
    : {
      version: value.saveVersion,
      savedAt: value.savedAt,
      serverSavedAt: value.serverSavedAt,
      state: value.state,
    };
  const save = normalizeStoredSave(candidate);
  if (!save) return null;
  return {
    createdAt: runtime.sanitizeNumber(value.backedUpAt, save.savedAt),
    reason: typeof value.reason === "string" ? value.reason : fallbackReason,
    save,
  };
}

function readLegacyValue(keyName) {
  const key = runtime[keyName];
  return key ? localStorage.getItem(key) : null;
}

function migrateLegacyBackups(mainIsValid = false) {
  const current = readBackupStore();
  if (current.invalid) return { store: current.store, blocked: !mainIsValid, invalidStore: true };
  const raw = {};
  try {
    LEGACY_KEYS.forEach((name) => { raw[name] = readLegacyValue(name); });
  } catch (error) {
    return { store: current.store, blocked: !mainIsValid, unreadable: true };
  }

  const periodic = [];
  const preUpdate = [];
  const reserve = [];
  let checkpointsMalformed = false;
  if (raw.SAVE_CHECKPOINTS_KEY !== null) {
    try {
      const parsed = JSON.parse(raw.SAVE_CHECKPOINTS_KEY);
      if (!Array.isArray(parsed)) checkpointsMalformed = true;
      else parsed.forEach((value) => {
        const entry = legacyBackupEntry(value, "legacy-checkpoint");
        if (!entry) { checkpointsMalformed = true; return; }
        if (entry.reason === "periodic") periodic.push(entry);
        else if (entry.reason === "pre-update") preUpdate.push(entry);
        else reserve.push(entry);
      });
    } catch (error) {
      checkpointsMalformed = true;
    }
  }

  const legacySources = [
    ["SAVE_PRE_IMPORT_KEY", "pre-import", reserve],
    ["SAVE_RESTORE_UNDO_KEY", "pre-restore", reserve],
  ];
  const malformedKeys = new Set(checkpointsMalformed ? ["SAVE_CHECKPOINTS_KEY"] : []);
  for (const [keyName, reason, target] of legacySources) {
    if (raw[keyName] === null) continue;
    try {
      const entry = legacyBackupEntry(JSON.parse(raw[keyName]), reason);
      if (entry) target.push(entry);
      else malformedKeys.add(keyName);
    } catch (error) {
      malformedKeys.add(keyName);
    }
  }

  let quarantine = null;
  if (raw.SAVE_QUARANTINE_KEY !== null) {
    try {
      const parsed = JSON.parse(raw.SAVE_QUARANTINE_KEY);
      const save = typeof parsed?.raw === "string" ? normalizeStoredSave(JSON.parse(parsed.raw)) : null;
      if (save) {
        quarantine = {
          createdAt: runtime.sanitizeNumber(parsed.quarantinedAt, save.savedAt),
          reason: "legacy-quarantine",
          save,
        };
        reserve.push(quarantine);
      } else malformedKeys.add("SAVE_QUARANTINE_KEY");
    } catch (error) {
      malformedKeys.add("SAVE_QUARANTINE_KEY");
    }
  }

  let loadFailureMalformed = false;
  if (raw.SAVE_LOAD_FAILURE_KEY !== null) {
    try {
      const failure = JSON.parse(raw.SAVE_LOAD_FAILURE_KEY);
      if (!failure || typeof failure !== "object" || Array.isArray(failure)) loadFailureMalformed = true;
    } catch (error) {
      loadFailureMalformed = true;
    }
  }
  if (loadFailureMalformed && !mainIsValid) malformedKeys.add("SAVE_LOAD_FAILURE_KEY");

  const originalStore = JSON.stringify(current.store);
  const store = current.store;
  const uniqueEntries = (entries) => {
    const seen = new Set();
    return entries
      .filter((entry) => {
        const key = JSON.stringify(entry.save);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) => right.createdAt - left.createdAt);
  };
  store.periodic = uniqueEntries([...store.periodic, ...periodic]).slice(0, 3);
  store.preUpdate = uniqueEntries([...(store.preUpdate ? [store.preUpdate] : []), ...preUpdate])[0] || null;
  store.reserve = uniqueEntries([...(store.reserve ? [store.reserve] : []), ...reserve])[0] || null;

  const changed = JSON.stringify(store) !== originalStore;
  if (changed && !writeBackupStore(store)) {
    return { store: current.store, blocked: !mainIsValid, migrationFailed: true };
  }

  const durable = !changed || !readBackupStore().invalid;
  const quarantineWasMigrated = quarantine && [
    ...store.periodic,
    ...(store.preUpdate ? [store.preUpdate] : []),
    ...(store.reserve ? [store.reserve] : []),
  ].some((entry) => JSON.stringify(entry.save) === JSON.stringify(quarantine.save));
  const removable = [
    ...(!checkpointsMalformed ? ["SAVE_CHECKPOINTS_KEY"] : []),
    ...legacySources.filter(([keyName]) => !malformedKeys.has(keyName)).map(([keyName]) => keyName),
    ...(quarantineWasMigrated ? ["SAVE_QUARANTINE_KEY"] : []),
    ...(mainIsValid ? ["SAVE_LOAD_FAILURE_KEY"] : []),
  ].filter((keyName) => durable && raw[keyName] !== null && !malformedKeys.has(keyName));
  for (const keyName of removable) {
    try { localStorage.removeItem(runtime[keyName]); } catch (error) { /* keep healthy main authoritative */ }
  }

  const unresolvedLegacy = Object.keys(raw).some((keyName) => (
    raw[keyName] !== null && !removable.includes(keyName)
  ));
  return {
    store,
    blocked: !mainIsValid && (unresolvedLegacy || store.periodic.length > 0 || store.preUpdate || store.reserve),
    unresolvedLegacy,
    legacyQuarantine: raw.SAVE_QUARANTINE_KEY !== null && !quarantine,
  };
}

function getBackupState() {
  const { store, invalid } = readBackupStore();
  let legacyRecovery = false;
  const legacy = {};
  try {
    LEGACY_KEYS.forEach((name) => { legacy[name] = readLegacyValue(name); });
    legacyRecovery = Object.values(legacy).some((raw) => raw !== null);
  } catch (error) {
    legacyRecovery = true;
  }
  const backups = [
    ...store.periodic.map((entry, index) => ({ ...entry, slot: "periodic", index })),
    ...(store.preUpdate ? [{ ...store.preUpdate, slot: "preUpdate", index: -1 }] : []),
    ...(store.reserve ? [{ ...store.reserve, slot: "reserve", index: -1 }] : []),
  ];
  const appendLegacy = (candidate, slot, index, reason) => {
    const entry = legacyBackupEntry(candidate, reason);
    if (entry && !backups.some((backup) => JSON.stringify(backup.save) === JSON.stringify(entry.save))) {
      backups.push({ ...entry, slot, index });
    }
  };
  if (legacy.SAVE_CHECKPOINTS_KEY !== null) {
    try {
      const checkpoints = JSON.parse(legacy.SAVE_CHECKPOINTS_KEY);
      if (Array.isArray(checkpoints)) checkpoints.forEach((entry, index) => {
        appendLegacy(entry, "legacyCheckpoint", index, "legacy-checkpoint");
      });
    } catch (error) {
      // Leave malformed legacy data as a blocker; it is not a restore candidate.
    }
  }
  for (const [keyName, slot, reason] of [
    ["SAVE_PRE_IMPORT_KEY", "legacyPreImport", "pre-import"],
    ["SAVE_RESTORE_UNDO_KEY", "legacyUndo", "pre-restore"],
  ]) {
    if (legacy[keyName] === null) continue;
    try { appendLegacy(JSON.parse(legacy[keyName]), slot, 0, reason); } catch (error) { /* keep the blocker */ }
  }
  if (legacy.SAVE_QUARANTINE_KEY !== null) {
    try {
      const value = JSON.parse(legacy.SAVE_QUARANTINE_KEY);
      const save = typeof value?.raw === "string" ? normalizeStoredSave(JSON.parse(value.raw)) : null;
      if (save) appendLegacy({ backedUpAt: value.quarantinedAt, save }, "legacyQuarantine", 0, "legacy-quarantine");
    } catch (error) {
      // Leave malformed legacy data as a blocker; it is not a restore candidate.
    }
  }
  backups.sort((a, b) => b.createdAt - a.createdAt);
  return { store, backups, invalid, legacyRecovery };
}

function clearLegacyRecoveryData() {
  let cleared = true;
  for (const name of LEGACY_KEYS) {
    try { localStorage.removeItem(runtime[name]); } catch (error) { cleared = false; }
  }
  return cleared;
}

export { createSaveBackup, migrateLegacyBackups, getBackupState, clearLegacyRecoveryData };
