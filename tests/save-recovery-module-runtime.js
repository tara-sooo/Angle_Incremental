const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

function makeSave(runtime, generationCount, savedAt = Date.now() + 10000) {
  const save = runtime.serializeSaveData();
  save.savedAt = savedAt;
  save.state.generationCount = generationCount;
  save.state.offlineProgressEnabled = false;
  return save;
}

function backupEntry(save, reason = "periodic", createdAt = save.savedAt) {
  return { createdAt, reason, save };
}

function backupContainer({ periodic = [], preUpdate = null, reserve = null } = {}) {
  return { periodic, preUpdate, reserve };
}

async function runSaveRecoveryModuleRuntimeTest() {
  {
    const fresh = await loadRuntime(candidatePath);
    assert.equal(fresh.runtime.bootResolution, "FRESH", "an empty store should resolve as a true fresh start");
    assert.equal(fresh.context.animationFrameRequests(), 1, "a fresh game may start its loop");
  }

  const source = await loadRuntime(candidatePath);
  const backupSave = makeSave(source.runtime, 42);
  const validBackups = backupContainer({ periodic: [backupEntry(backupSave)] });

  {
    const recovered = await loadRuntime(candidatePath, new Map([
      ["angle-incremental-save-backups", JSON.stringify(validBackups)],
    ]));
    assert.equal(recovered.runtime.bootResolution, "RECOVERY", "a backup without a main save must block fresh boot");
    assert.equal(recovered.storage.has(recovered.runtime.SAVE_KEY), false, "recovery must not synthesize a main save");
    assert.equal(recovered.context.animationFrameRequests(), 0, "recovery must not start the game loop");
    const totalPlayTime = recovered.debug.state.totalPlayTime;
    assert.equal(recovered.debug.advanceOnlineTime(1), 0, "recovery blocks online progression");
    assert.equal(recovered.debug.state.totalPlayTime, totalPlayTime);
    assert.equal(recovered.debug.saveGame("auto"), false, "recovery blocks saving");
    recovered.runtime.offlineElapsedFromSave = () => ({ elapsedSeconds: 0, clockAnomaly: false });
    assert.equal(await recovered.debug.restoreBackup("periodic", 0), true, "an explicit restore should load a valid backup");
    assert.equal(recovered.runtime.bootResolution, "NORMAL");
    assert.equal(recovered.debug.state.generationCount, 42);
    assert.equal(recovered.context.animationFrameRequests(), 1, "the loop starts after explicit recovery succeeds");
  }

  {
    const invalidRaw = "{not a save";
    const invalid = await loadRuntime(candidatePath, new Map([["angle-incremental-save", invalidRaw]]));
    assert.equal(invalid.runtime.bootResolution, "RECOVERY", "an invalid main save must not become a fresh start");
    assert.equal(invalid.storage.get(invalid.runtime.SAVE_KEY), invalidRaw, "invalid main data must remain untouched");
    assert.equal(invalid.context.animationFrameRequests(), 0);
    assert.equal(await invalid.debug.resetSave(), true, "an explicit new-save action should resolve invalid-main recovery");
    assert.equal(invalid.runtime.bootResolution, "NORMAL");
    assert.equal(invalid.debug.state.generationCount, 0);
  }

  {
    const invalidRaw = "unsupported save payload";
    const invalid = await loadRuntime(candidatePath, new Map([
      ["angle-incremental-save", invalidRaw],
      ["angle-incremental-save-backups", JSON.stringify(validBackups)],
    ]));
    assert.equal(invalid.storage.get(invalid.runtime.SAVE_KEY), invalidRaw);
    invalid.runtime.offlineElapsedFromSave = () => ({ elapsedSeconds: 0, clockAnomaly: false });
    assert.equal(await invalid.debug.restoreBackup("periodic", 0), true);
    assert.equal(invalid.debug.state.generationCount, 42);
    const reserve = JSON.parse(invalid.storage.get(invalid.runtime.SAVE_BACKUPS_KEY)).reserve;
    assert.equal(reserve, null, "an invalid main is not copied into reserve");
  }

  {
    const currentSave = makeSave(source.runtime, 10);
    const olderBackup = makeSave(source.runtime, 5);
    const instance = await loadRuntime(candidatePath, new Map([
      ["angle-incremental-save", JSON.stringify(currentSave)],
      ["angle-incremental-save-backups", JSON.stringify(backupContainer({
        periodic: [backupEntry(olderBackup, "periodic", olderBackup.savedAt - 1)],
      }))],
    ]));
    instance.runtime.offlineElapsedFromSave = () => ({ elapsedSeconds: 0, clockAnomaly: false });
    assert.equal(instance.runtime.bootResolution, "NORMAL", "a valid main remains authoritative");
    const backup = instance.runtime.recoveryEntries().backups.find((entry) => entry.save.state.generationCount === 5);
    assert.ok(backup, "the older periodic save should remain available");
    assert.equal(await instance.debug.restoreBackup(backup.slot, backup.index), true);
    assert.equal(instance.debug.state.generationCount, 5);
    const store = JSON.parse(instance.storage.get(instance.runtime.SAVE_BACKUPS_KEY));
    assert.equal(store.reserve.save.state.generationCount, 10, "restore must reserve the current valid main first");
    const mainAfterRestore = instance.storage.get(instance.runtime.SAVE_KEY);
    assert.equal(JSON.parse(mainAfterRestore).state.generationCount, 5);
    const originalSetItem = instance.context.localStorage.setItem;
    instance.context.localStorage.setItem = (key, value) => {
      if (key === instance.runtime.SAVE_KEY) throw new Error("restore write failed");
      return originalSetItem(key, value);
    };
    assert.equal(await instance.debug.restoreBackup("reserve", -1), false, "a failed restore write should fail cleanly");
    assert.equal(instance.storage.get(instance.runtime.SAVE_KEY), mainAfterRestore,
      "a failed restore write must leave the current main unchanged");
    instance.context.localStorage.setItem = originalSetItem;
  }

  {
    const currentSave = makeSave(source.runtime, 11);
    const importer = await loadRuntime(candidatePath, new Map([
      ["angle-incremental-save", JSON.stringify(currentSave)],
    ]));
    const importedSource = await loadRuntime(candidatePath);
    importedSource.debug.state.generationCount = 77;
    const code = await importedSource.debug.exportSaveCode();
    importer.runtime.offlineElapsedFromSave = () => ({ elapsedSeconds: 0, clockAnomaly: false });
    assert.equal(await importer.debug.importSaveCode(code), true, "save-code import compatibility should remain intact");
    assert.equal(importer.debug.state.generationCount, 77);
    assert.equal(JSON.parse(importer.storage.get(importer.runtime.SAVE_BACKUPS_KEY)).reserve.save.state.generationCount, 11);

    const beforeFailure = importer.storage.get(importer.runtime.SAVE_KEY);
    const failedSource = await loadRuntime(candidatePath);
    failedSource.debug.state.generationCount = 99;
    const failedCode = await failedSource.debug.exportSaveCode();
    const originalSetItem = importer.context.localStorage.setItem;
    importer.context.localStorage.setItem = (key, value) => {
      if (key === importer.runtime.SAVE_KEY) throw new Error("main write failed");
      return originalSetItem(key, value);
    };
    assert.equal(await importer.debug.importSaveCode(failedCode), false, "a failed import write should fail cleanly");
    assert.equal(importer.storage.get(importer.runtime.SAVE_KEY), beforeFailure, "failed import must leave main unchanged");
    importer.context.localStorage.setItem = originalSetItem;

    assert.equal(await importer.debug.resetSave(), true, "reset should use the same replacement path");
    assert.equal(importer.debug.state.generationCount, 0);
    const afterReset = JSON.parse(importer.storage.get(importer.runtime.SAVE_BACKUPS_KEY));
    assert.equal(afterReset.reserve.save.state.generationCount, 77, "reset must remain recoverable through reserve");
  }

  {
    const currentSave = makeSave(source.runtime, 3);
    const instance = await loadRuntime(candidatePath, new Map([
      ["angle-incremental-save", JSON.stringify(currentSave)],
    ]));
    instance.debug.state.generationCount = 200;
    const periodicCount = instance.runtime.recoveryEntries().store.periodic.length;
    assert.equal(instance.debug.createCheckpoint("pre-update", { force: true }), true);
    const store = JSON.parse(instance.storage.get(instance.runtime.SAVE_BACKUPS_KEY));
    assert.equal(store.preUpdate.save.state.generationCount, 3, "pre-update captures the valid persisted main");
    assert.equal(store.periodic.length, periodicCount, "event saves do not enter periodic rotation");
  }

  {
    const base = makeSave(source.runtime, 0);
    const instance = await loadRuntime(candidatePath, new Map([
      ["angle-incremental-save", JSON.stringify(base)],
      ["angle-incremental-save-backups", JSON.stringify(backupContainer({
        periodic: [backupEntry(base)],
      }))],
    ]));
    const persisted = JSON.parse(instance.storage.get(instance.runtime.SAVE_KEY));
    let wall = persisted.savedAt;
    let monotonic = instance.runtime.monotonicClockNowMs();
    Object.defineProperty(instance.runtime, "localClockNowMs", { configurable: true, value: () => wall });
    Object.defineProperty(instance.runtime, "monotonicClockNowMs", { configurable: true, value: () => monotonic });
    assert.equal(instance.debug.createCheckpoint("periodic", { force: true }), true);
    const seededStore = JSON.parse(instance.storage.get(instance.runtime.SAVE_BACKUPS_KEY));
    seededStore.periodic = [seededStore.periodic[0]];
    instance.storage.set(instance.runtime.SAVE_BACKUPS_KEY, JSON.stringify(seededStore));
    wall += 5000;
    monotonic += 5000;
    const recoveryRevision = instance.runtime.recoveryRevision;
    assert.equal(instance.debug.saveGame("auto"), true);
    assert.equal(JSON.parse(instance.storage.get(instance.runtime.SAVE_BACKUPS_KEY)).periodic.length, 1,
      "five-second autosaves do not rotate periodic backups");
    assert.equal(instance.runtime.recoveryRevision, recoveryRevision,
      "a periodic no-op should not rerender the backup list");
    for (let generation = 1; generation <= 4; generation += 1) {
      wall += instance.runtime.SAVE_CHECKPOINT_INTERVAL_MS - (generation === 1 ? 5000 : 0);
      monotonic += instance.runtime.SAVE_CHECKPOINT_INTERVAL_MS - (generation === 1 ? 5000 : 0);
      instance.debug.state.generationCount = generation;
      assert.equal(instance.debug.saveGame("auto"), true);
    }
    let periodic = JSON.parse(instance.storage.get(instance.runtime.SAVE_BACKUPS_KEY)).periodic;
    assert.equal(periodic.length, 3, "periodic history is capped at three saves");
    assert.equal(periodic[0].save.state.generationCount, 4);
    const lengthBeforeRollback = periodic.length;
    wall -= 60 * 60 * 1000;
    monotonic += instance.runtime.SAVE_CHECKPOINT_INTERVAL_MS;
    instance.debug.state.generationCount = 5;
    assert.equal(instance.debug.saveGame("auto"), true);
    periodic = JSON.parse(instance.storage.get(instance.runtime.SAVE_BACKUPS_KEY)).periodic;
    assert.equal(periodic.length, lengthBeforeRollback);
    assert.equal(periodic[0].save.state.generationCount, 5, "wall-clock rollback must not stop rotation");
  }

  {
    const legacySave = makeSave(source.runtime, 18);
    const legacyEntry = {
      backedUpAt: legacySave.savedAt,
      appVersion: "0.14.0",
      saveVersion: legacySave.version,
      savedAt: legacySave.savedAt,
      serverSavedAt: 0,
      reason: "periodic",
      state: legacySave.state,
    };
    const migrated = await loadRuntime(candidatePath, new Map([
      ["angle-incremental-save-checkpoints", JSON.stringify([legacyEntry])],
    ]));
    assert.equal(migrated.runtime.bootResolution, "RECOVERY", "legacy backups also block a fresh start");
    assert.equal(migrated.storage.has("angle-incremental-save-checkpoints"), false,
      "legacy keys are removed after durable migration");
    assert.equal(JSON.parse(migrated.storage.get(migrated.runtime.SAVE_BACKUPS_KEY)).periodic[0].save.state.generationCount, 18);

    const invalidQuarantine = JSON.stringify({ raw: "{not recoverable", quarantinedAt: Date.now() });
    const blocked = await loadRuntime(candidatePath, new Map([
      ["angle-incremental-save-quarantine", invalidQuarantine],
    ]));
    assert.equal(blocked.runtime.bootResolution, "RECOVERY", "unconvertible quarantine blocks fresh boot");
    assert.equal(blocked.storage.get("angle-incremental-save-quarantine"), invalidQuarantine,
      "unconvertible quarantine remains until explicit resolution");
    assert.equal(await blocked.debug.resetSave(), true, "explicit new-save resolves the legacy blocker");
    assert.equal(blocked.storage.has("angle-incremental-save-quarantine"), false);

    const recoverableLegacy = makeSave(source.runtime, 55);
    const recoverableCheckpoint = {
      backedUpAt: recoverableLegacy.savedAt,
      saveVersion: recoverableLegacy.version,
      savedAt: recoverableLegacy.savedAt,
      reason: "periodic",
      state: recoverableLegacy.state,
    };
    const invalidUnifiedStore = await loadRuntime(candidatePath, new Map([
      ["angle-incremental-save-backups", "{invalid backup store"],
      ["angle-incremental-save-checkpoints", JSON.stringify([recoverableCheckpoint])],
    ]));
    const fallbackBackup = invalidUnifiedStore.runtime.recoveryEntries().backups
      .find((entry) => entry.slot === "legacyCheckpoint");
    assert.ok(fallbackBackup, "valid legacy data remains visible when the unified store is corrupt");
    assert.equal(invalidUnifiedStore.storage.has("angle-incremental-save-checkpoints"), true,
      "unmigrated legacy data remains until explicit recovery");
    invalidUnifiedStore.runtime.offlineElapsedFromSave = () => ({ elapsedSeconds: 0, clockAnomaly: false });
    assert.equal(await invalidUnifiedStore.debug.restoreBackup(fallbackBackup.slot, fallbackBackup.index), true,
      "a visible legacy backup can recover without overwriting a valid main");
    assert.equal(invalidUnifiedStore.debug.state.generationCount, 55);
    assert.equal(invalidUnifiedStore.storage.has("angle-incremental-save-checkpoints"), false,
      "successful explicit recovery resolves old keys");
  }

  {
    const healthySave = makeSave(source.runtime, 23);
    const staleLegacy = [{
      backedUpAt: healthySave.savedAt,
      saveVersion: healthySave.version,
      savedAt: healthySave.savedAt,
      serverSavedAt: 0,
      reason: "periodic",
      state: healthySave.state,
    }];
    const healthy = await loadRuntime(candidatePath, new Map([
      ["angle-incremental-save", JSON.stringify(healthySave)],
      ["angle-incremental-save-checkpoints", JSON.stringify(staleLegacy)],
    ]));
    assert.equal(healthy.runtime.bootResolution, "NORMAL", "a healthy main remains authoritative over legacy recovery data");
    assert.equal(healthy.storage.has("angle-incremental-save-checkpoints"), false);
  }

  {
    const offline = await loadRuntime(candidatePath);
    const original = makeSave(offline.runtime, 31);
    const raw = JSON.stringify(original);
    offline.storage.set(offline.runtime.SAVE_KEY, raw);
    offline.runtime.offlineElapsedFromSave = () => ({ elapsedSeconds: 60, clockAnomaly: false });
    offline.runtime.processOfflineElapsed = async () => { throw new Error("offline simulation failed"); };
    assert.equal(await offline.debug.loadGame(), true, "offline failure should fall back to the loaded main save");
    assert.equal(offline.storage.get(offline.runtime.SAVE_KEY), raw, "offline failure must not rewrite persisted main");
    assert.equal(offline.runtime.loadRecoveryMode, false, "offline failure skips the interval rather than blocking boot");
    assert.equal(offline.debug.state.generationCount, 31);
    assert.equal(offline.storage.has(offline.runtime.SAVE_LOAD_FAILURE_KEY), false,
      "new failures do not create legacy diagnostics");
  }

  {
    const stale = await loadRuntime(candidatePath);
    stale.debug.state.generationCount = 2;
    assert.equal(stale.debug.saveGame("manual"), true);
    const remote = makeSave(stale.runtime, 3);
    const remoteRaw = JSON.stringify(remote);
    stale.storage.set(stale.runtime.SAVE_KEY, remoteRaw);
    const staleState = stale.debug.state.generationCount;
    await stale.runtime.handleStorageChange({ key: stale.runtime.SAVE_KEY });
    assert.equal(stale.runtime.saveConflictMode, true, "a changed main enters conflict mode");
    assert.equal(stale.debug.state.generationCount, staleState, "conflict detection must not auto-reload");
    const playTime = stale.debug.state.totalPlayTime;
    assert.equal(stale.debug.advanceOnlineTime(1), 0, "conflict mode stops progression");
    assert.equal(stale.debug.state.totalPlayTime, playTime);
    assert.equal(stale.debug.saveGame("auto"), false, "conflict mode blocks writes");
    assert.ok(await stale.debug.exportSaveCode(), "current stale-tab state remains exportable");
    assert.equal(stale.storage.get(stale.runtime.SAVE_KEY), remoteRaw, "conflict detection leaves remote main untouched");
    assert.equal(await stale.debug.retryLoad(), true, "explicit reload-latest resolves the conflict");
    assert.equal(stale.debug.state.generationCount, 3);
    assert.equal(stale.runtime.saveConflictMode, false);
  }
}

module.exports = { runSaveRecoveryModuleRuntimeTest };
