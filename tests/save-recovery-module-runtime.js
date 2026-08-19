const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

async function runSaveRecoveryModuleRuntimeTest() {
  {
    const instance = await loadRuntime(candidatePath);
    const { context, debug, runtime, storage } = instance;
    const { state } = debug;
    state.generationCount = 7;
    state.previousGenerationScore = 1e12;
    state.previousGenerationScoreLog10 = 12;
    const code = await debug.exportSaveCode();

    state.generationCount = 99;
    state.previousGenerationScore = 1e99;
    state.previousGenerationScoreLog10 = 99;
    assert.equal(await debug.importSaveCode(code), true, "a valid import should succeed");
    assert.equal(state.generationCount, 7, "the imported state should replace the current state");

    const backup = JSON.parse(storage.get(runtime.SAVE_PRE_IMPORT_KEY));
    assert.equal(backup.reason, "pre-import", "a successful import should retain its reason");
    assert.equal(backup.state.generationCount, 99, "the backup should contain the state immediately before import");

    context.window.confirm = () => true;
    assert.equal(debug.restorePreImportSave(), true, "the pre-import state should be restorable");
    assert.equal(state.generationCount, 99, "restoring should recover the state immediately before import");
    assert.ok(storage.has(runtime.SAVE_RESTORE_UNDO_KEY), "restoring should keep an undo snapshot");

    const backupBeforeInvalidImport = storage.get(runtime.SAVE_PRE_IMPORT_KEY);
    assert.equal(await debug.importSaveCode("ANGLE_SAVE_V2:invalid"), false, "an invalid import should fail");
    assert.equal(
      storage.get(runtime.SAVE_PRE_IMPORT_KEY),
      backupBeforeInvalidImport,
      "an invalid import must not replace the existing pre-import backup",
    );
  }

  {
    const staleTab = await loadRuntime(candidatePath);
    staleTab.debug.state.generationCount = 10;
    assert.equal(staleTab.debug.saveGame("manual"), true, "the stale tab baseline should save");
    const latestTab = await loadRuntime(candidatePath, staleTab.storage);
    latestTab.debug.state.generationCount = 11;
    assert.equal(latestTab.debug.saveGame("manual"), true, "the replacement tab should save");
    const latestRaw = latestTab.storage.get(latestTab.runtime.SAVE_KEY);
    staleTab.storage.set(staleTab.runtime.SAVE_KEY, latestRaw);

    staleTab.debug.state.generationCount = 100;
    assert.equal(staleTab.debug.saveGame("auto"), false, "a stale tab save should be rejected");
    assert.equal(
      staleTab.runtime.recoveryEntries().checkpoints.find((entry) => entry.reason === "save-conflict")?.state.generationCount,
      100,
      "a rejected save should checkpoint the in-memory state before reloading",
    );
    const originalOfflineElapsedFromSave = staleTab.runtime.offlineElapsedFromSave;
    staleTab.runtime.offlineElapsedFromSave = () => ({
      elapsedSeconds: 1,
      clockSource: "local-fallback",
      clockAnomaly: false,
      legacyTimestampUsed: false,
    });
    try {
      assert.equal(await staleTab.runtime.handleSaveConflict(), true, "a save conflict should reload after checkpointing");
    } finally {
      staleTab.runtime.offlineElapsedFromSave = originalOfflineElapsedFromSave;
    }
    assert.equal(staleTab.debug.state.generationCount, 11, "conflict recovery should load the latest persisted state");
    assert.equal(staleTab.storage.get(staleTab.runtime.SAVE_KEY), latestRaw, "authoritative conflict recovery must not rewrite the shared save");
    assert.equal(staleTab.runtime.saveConflictMode, false, "successful conflict recovery should clear conflict mode");
    assert.equal(
      staleTab.runtime.recoveryEntries().checkpoints.find((entry) => entry.reason === "save-conflict")?.state.generationCount,
      100,
      "conflict recovery should retain the stale in-memory state as a checkpoint",
    );
    latestTab.storage.set(latestTab.runtime.SAVE_KEY, staleTab.storage.get(staleTab.runtime.SAVE_KEY));
    await latestTab.runtime.handleStorageChange({ key: latestTab.runtime.SAVE_KEY });
    assert.equal(
      latestTab.runtime.recoveryEntries().checkpoints.some((entry) => entry.reason === "save-conflict"),
      false,
      "an authoritative conflict reload must not send a replacement storage event to the other tab",
    );
  }

  {
    const staleTab = await loadRuntime(candidatePath);
    staleTab.debug.state.generationCount = 20;
    assert.equal(staleTab.debug.saveGame("manual"), true, "the storage-event baseline should save");
    const latestTab = await loadRuntime(candidatePath, staleTab.storage);
    latestTab.debug.state.generationCount = 21;
    assert.equal(latestTab.debug.saveGame("manual"), true, "the storage-event replacement should save");
    staleTab.storage.set(staleTab.runtime.SAVE_KEY, latestTab.storage.get(latestTab.runtime.SAVE_KEY));
    staleTab.debug.state.generationCount = 200;
    await staleTab.runtime.handleStorageChange({ key: staleTab.runtime.SAVE_KEY });
    assert.equal(staleTab.debug.state.generationCount, 21, "a storage event should use the shared conflict recovery");
    assert.equal(
      staleTab.runtime.recoveryEntries().checkpoints.find((entry) => entry.reason === "save-conflict")?.state.generationCount,
      200,
      "a storage-event conflict should checkpoint the current in-memory state",
    );
    latestTab.debug.state.generationCount = 22;
    assert.equal(latestTab.debug.saveGame("manual"), true, "a storage clear replacement should save");
    staleTab.storage.set(staleTab.runtime.SAVE_KEY, latestTab.storage.get(latestTab.runtime.SAVE_KEY));
    staleTab.debug.state.generationCount = 220;
    await staleTab.runtime.handleStorageChange({ key: null });
    assert.equal(staleTab.debug.state.generationCount, 22, "a storage clear event should use the shared conflict recovery");
  }

  {
    const staleTab = await loadRuntime(candidatePath);
    staleTab.debug.state.generationCount = 30;
    assert.equal(staleTab.debug.saveGame("manual"), true, "the visibility baseline should save");
    const latestTab = await loadRuntime(candidatePath, staleTab.storage);
    latestTab.debug.state.generationCount = 31;
    assert.equal(latestTab.debug.saveGame("manual"), true, "the visibility replacement should save");
    staleTab.storage.set(staleTab.runtime.SAVE_KEY, latestTab.storage.get(latestTab.runtime.SAVE_KEY));
    staleTab.debug.state.generationCount = 300;
    staleTab.context.document.hidden = true;
    await staleTab.runtime.handleVisibilityChange();
    assert.equal(staleTab.debug.state.generationCount, 31, "visibility conflict recovery should load the latest persisted state");
    assert.equal(
      staleTab.runtime.recoveryEntries().checkpoints.find((entry) => entry.reason === "save-conflict")?.state.generationCount,
      300,
      "visibility conflict recovery should checkpoint the stale in-memory state",
    );
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { context, debug, runtime, storage } = instance;
    debug.state.generationCount = 300;
    assert.equal(debug.saveGame("manual"), true, "the backup-failure baseline should save");
    const replacement = await loadRuntime(candidatePath, storage);
    replacement.debug.state.generationCount = 301;
    assert.equal(replacement.debug.saveGame("manual"), true, "the backup-failure replacement should save");
    storage.set(runtime.SAVE_KEY, replacement.storage.get(runtime.SAVE_KEY));
    debug.state.generationCount = 999;
    const originalSetItem = context.localStorage.setItem;
    context.localStorage.setItem = (key, value) => {
      if (key === runtime.SAVE_CHECKPOINTS_KEY) throw new Error("storage full");
      return originalSetItem(key, value);
    };
    try {
      assert.equal(await runtime.handleStorageChange({ key: runtime.SAVE_KEY }), false, "a failed conflict backup must stop before reload");
      assert.equal(debug.state.generationCount, 999, "a failed conflict backup must preserve in-memory progress");
      assert.equal(runtime.saveConflictMode, true, "a failed conflict backup must keep the tab stopped");
      assert.equal(JSON.parse(storage.get(runtime.SAVE_KEY)).state.generationCount, 301, "backup failure must keep the latest persisted save");
    } finally {
      context.localStorage.setItem = originalSetItem;
    }
    assert.equal(await runtime.retryLoad(), true, "a conflict should be retryable after storage recovers");
    assert.equal(runtime.saveConflictMode, false, "a successful conflict retry should unlock the tab");
    assert.equal(debug.state.generationCount, 301, "a retried conflict should load the persisted state");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { context, debug, runtime, storage } = instance;
    debug.state.generationCount = 400;
    assert.equal(debug.saveGame("manual"), true, "the offline conflict baseline should save");
    const staleSave = JSON.parse(storage.get(runtime.SAVE_KEY));
    staleSave.savedAt = Math.max(1, Date.now() - 10000);
    staleSave.serverSavedAt = 0;
    const staleRaw = JSON.stringify(staleSave);
    storage.set(runtime.SAVE_KEY, staleRaw);

    const latestTab = await loadRuntime(candidatePath, storage);
    latestTab.debug.state.generationCount = 401;
    assert.equal(latestTab.debug.saveGame("manual"), true, "the offline conflict replacement should save");
    const latestRaw = latestTab.storage.get(runtime.SAVE_KEY);
    storage.set(runtime.SAVE_KEY, staleRaw);

    const originalProcessOfflineElapsed = runtime.processOfflineElapsed;
    const originalSetItem = context.localStorage.setItem;
    runtime.processOfflineElapsed = (elapsedSeconds, source, clockContext) => {
      debug.state.generationCount = 999;
      storage.set(runtime.SAVE_KEY, latestRaw);
      return originalProcessOfflineElapsed(elapsedSeconds, source, clockContext);
    };
    context.localStorage.setItem = (key, value) => {
      if (key === runtime.SAVE_CHECKPOINTS_KEY) throw new Error("storage full");
      return originalSetItem(key, value);
    };
    try {
      assert.equal(await debug.loadGame(), false, "a conflict during offline processing must fail safely");
      assert.equal(debug.state.generationCount, 999, "failed conflict backup must preserve processed memory state");
      assert.equal(runtime.saveConflictMode, true, "failed conflict backup must keep conflict mode active");
      assert.equal(runtime.saveConflictCheckpointReady, false, "failed conflict backup must report no checkpoint");
      assert.equal(runtime.loadRecoveryMode, false, "failed conflict backup must not enter ordinary load recovery");
    } finally {
      runtime.processOfflineElapsed = originalProcessOfflineElapsed;
      context.localStorage.setItem = originalSetItem;
    }
    assert.equal(await runtime.handleSaveConflict(), true, "the offline conflict should be retryable after storage recovers");
    assert.equal(debug.state.generationCount, 401, "retrying the offline conflict should load the latest save");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    for (let index = 0; index < runtime.MAX_EVENT_SAVE_CHECKPOINTS; index += 1) {
      debug.state.generationCount = index;
      assert.equal(debug.createCheckpoint(`test-event-${index}`, { force: true }), true, "event checkpoints should fill their retention limit");
    }
    debug.state.generationCount = 1234;
    assert.equal(runtime.beginSaveConflict(), true, "a conflict checkpoint should fit a full event history");
    const checkpoints = runtime.recoveryEntries().checkpoints;
    assert.equal(checkpoints.length, runtime.MAX_EVENT_SAVE_CHECKPOINTS, "conflict retention should stay within the event limit");
    assert.equal(
      checkpoints.some((entry) => entry.reason === "save-conflict" && entry.state.generationCount === 1234),
      true,
      "a newly created conflict checkpoint must not be evicted immediately",
    );
    runtime.finishSaveConflict();
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { context, runtime } = instance;
    const mainTab = {
      classList: { contains: (name) => name === "main-tab" },
      dataset: {},
      disabled: false,
    };
    const gameplayButton = {
      classList: { contains: () => false },
      dataset: {},
      disabled: false,
    };
    const recoveryButton = {
      classList: { contains: () => false },
      closest: () => ({}),
      dataset: {},
      disabled: false,
    };
    const originalQuerySelectorAll = context.document.querySelectorAll;
    context.document.querySelectorAll = (selector) => selector === "button, input, select, textarea"
      ? [mainTab, gameplayButton, recoveryButton]
      : originalQuerySelectorAll(selector);
    try {
      assert.equal(runtime.beginSaveConflict(), true, "a conflict should lock gameplay controls");
      assert.equal(mainTab.disabled, false, "main tabs must remain available during conflict recovery");
      assert.equal(gameplayButton.disabled, true, "gameplay controls should be locked during conflict recovery");
      assert.equal(recoveryButton.disabled, false, "recovery controls must remain available during conflict recovery");
      runtime.finishSaveConflict();
      assert.equal(gameplayButton.disabled, false, "gameplay controls should unlock after conflict recovery");
    } finally {
      context.document.querySelectorAll = originalQuerySelectorAll;
    }
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime, storage } = instance;
    debug.state.generationCount = 500;
    assert.equal(debug.saveGame("manual"), true, "the incompatible-save baseline should save");
    assert.equal(runtime.beginSaveConflict(), true, "an incompatible-save conflict should be checkpointed");
    const newerRaw = JSON.stringify({
      version: runtime.SAVE_VERSION + 1,
      savedAt: Date.now(),
      state: runtime.serializeSaveData().state,
    });
    storage.set(runtime.SAVE_KEY, newerRaw);
    assert.equal(await runtime.handleSaveConflict(), false, "an incompatible conflict save should remain in recovery");
    assert.equal(storage.get(runtime.SAVE_KEY), newerRaw, "conflict recovery must not delete a newer-format shared save");
    assert.equal(JSON.parse(storage.get(runtime.SAVE_QUARANTINE_KEY)).raw, newerRaw, "the newer save should still be quarantined");
    runtime.updateUi();
    assert.equal(runtime.elements.retryLoadButton.hidden, false, "a failed conflict reload should expose retry controls");
    const compatibleRaw = JSON.stringify(runtime.serializeSaveData());
    storage.set(runtime.SAVE_KEY, compatibleRaw);
    assert.equal(await runtime.retryLoad(), true, "a conflict recovery retry should load a later compatible save");
    assert.equal(runtime.saveConflictMode, false, "a successful conflict recovery retry should clear conflict mode");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    const purchasedMask = (1 << 19) | (1 << 20);
    assert.equal(runtime.SAVE_VERSION, 10, "IU14-1 must keep the save version at 10");
    debug.state.infinityUpgradeMask = purchasedMask;
    assert.equal(debug.createCheckpoint("periodic", { force: true }), true, "IU14-1 state should be checkpointed");
    debug.state.infinityUpgradeMask = 0;
    const checkpointIndex = debug.recoveryEntries().checkpoints.findIndex((entry) => entry.reason === "periodic");
    instance.context.window.confirm = () => true;
    assert.equal(debug.restoreCheckpoint(checkpointIndex), true, "IU14-1 checkpoint state should be restorable");
    assert.equal(debug.state.infinityUpgradeMask, purchasedMask, "checkpoint restore must recover IU14-1");
    assert.equal(debug.restoreUndoSave(), true, "checkpoint restore should expose an undo path for IU14-1");
    assert.equal(debug.state.infinityUpgradeMask, 0, "checkpoint undo must recover the state before the IU14-1 restore");
    assert.equal(debug.restoreUndoSave(), true, "the undo entry should itself be reversible for IU14-1");
    assert.equal(debug.state.infinityUpgradeMask, purchasedMask, "reversing the undo must recover IU14-1 again");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime, storage } = instance;
    const originalSave = runtime.serializeSaveData();
    originalSave.savedAt = Date.now();
    const rawSave = JSON.stringify(originalSave);
    storage.set(runtime.SAVE_KEY, rawSave);
    const originalApply = runtime.applySaveData;
    runtime.applySaveData = () => {
      throw new Error("test apply failure");
    };
    try {
      assert.equal(await debug.loadGame(), false, "an apply failure should fail the load transaction");
      assert.equal(storage.get(runtime.SAVE_KEY), rawSave, "an apply failure must keep the normal save");
      assert.equal(storage.has(runtime.SAVE_QUARANTINE_KEY), false, "an apply failure must not quarantine the save");
      const failure = JSON.parse(storage.get(runtime.SAVE_LOAD_FAILURE_KEY));
      assert.equal(failure.stage, "apply", "apply failures should be diagnosed separately");
      assert.equal(debug.saveGame("auto"), false, "regular saves must stop until recovery succeeds");
      assert.equal(runtime.autoSaveElapsed, 0, "a blocked autosave should consume its timer");
      runtime.updateUi();
      assert.equal(runtime.elements.retryLoadButton.hidden, false, "the recovery UI should offer a retry");
    } finally {
      runtime.applySaveData = originalApply;
    }
    assert.equal(await debug.retryLoad(), true, "a successful retry should finish the load recovery");
    assert.equal(runtime.loadRecoveryMode, false, "successful retry should resume normal saving");
    assert.equal(storage.has(runtime.SAVE_LOAD_FAILURE_KEY), false, "successful retry should clear the diagnostic");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime, storage } = instance;
    const save = runtime.serializeSaveData();
    save.savedAt = Date.now() - 1000;
    storage.set(runtime.SAVE_KEY, JSON.stringify(save));
    const originalOfflineElapsedFromSave = runtime.offlineElapsedFromSave;
    const originalProcessOfflineElapsed = runtime.processOfflineElapsed;
    let resolveOffline;
    runtime.offlineElapsedFromSave = () => ({
      elapsedSeconds: 1,
      clockSource: "server",
      clockAnomaly: false,
      legacyTimestampUsed: false,
    });
    runtime.processOfflineElapsed = () => new Promise((resolve) => {
      resolveOffline = resolve;
    });
    try {
      const firstLoad = debug.loadGame();
      while (!resolveOffline) await Promise.resolve();
      assert.equal(await debug.loadGame(), false, "a concurrent recovery load should be rejected while the first load is active");
      resolveOffline({});
      assert.equal(await firstLoad, true, "the first recovery load should finish normally");
    } finally {
      runtime.offlineElapsedFromSave = originalOfflineElapsedFromSave;
      runtime.processOfflineElapsed = originalProcessOfflineElapsed;
    }
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { context, debug, runtime, storage } = instance;
    const { state } = debug;
    state.generationCount = 41;
    assert.equal(
      debug.createCheckpoint("periodic", { force: true }),
      true,
      "an apply-failure recovery test should have a checkpoint to restore",
    );
    state.generationCount = 7;
    const originalSave = runtime.serializeSaveData();
    originalSave.savedAt = Date.now();
    const rawSave = JSON.stringify(originalSave);
    storage.set(runtime.SAVE_KEY, rawSave);
    const checkpointIndex = debug.recoveryEntries().checkpoints.findIndex(
      (entry) => entry.reason === "periodic" && entry.state.generationCount === 41,
    );
    assert.notEqual(checkpointIndex, -1, "the recovery test checkpoint should be available");
    const originalApply = runtime.applySaveData;
    runtime.applySaveData = () => {
      throw new Error("test checkpoint apply failure");
    };
    try {
      assert.equal(await debug.loadGame(), false, "an apply failure should enter recovery before checkpoint restore");
    } finally {
      runtime.applySaveData = originalApply;
    }
    context.window.confirm = () => true;
    assert.equal(
      debug.restoreCheckpoint(checkpointIndex),
      true,
      "checkpoint restoration should save after an apply failure",
    );
    assert.equal(state.generationCount, 41, "checkpoint restoration should recover the selected state");
    assert.equal(
      JSON.parse(storage.get(runtime.SAVE_KEY)).state.generationCount,
      41,
      "checkpoint restoration after an apply failure should persist the recovered state",
    );
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    const { state } = debug;
    state.score = 123;
    state.scoreLog10 = Math.log10(123);
    state.generationCount = 41;
    state.lastInfinityRuns = [{ time: 3, realTime: 2, scoreLog10: 1, ipGain: 4, challenge: 0 }];
    const before = {
      score: state.score,
      scoreLog10: state.scoreLog10,
      generationCount: state.generationCount,
      lastInfinityRuns: state.lastInfinityRuns.map((run) => ({ ...run })),
    };
    const originalSanitizeInfinityRunRecords = runtime.sanitizeInfinityRunRecords;
    runtime.sanitizeInfinityRunRecords = () => {
      throw new Error("test partial apply failure");
    };
    try {
      assert.throws(
        () => runtime.applySaveData({ score: 999, scoreLog10: 999, generationCount: 99 }, 10),
        /test partial apply failure/,
        "a partial save-data application should surface its error",
      );
    } finally {
      runtime.sanitizeInfinityRunRecords = originalSanitizeInfinityRunRecords;
    }
    assert.equal(state.score, before.score, "a partial apply failure must restore the score");
    assert.equal(state.scoreLog10, before.scoreLog10, "a partial apply failure must restore score log data");
    assert.equal(state.generationCount, before.generationCount, "a partial apply failure must restore generation state");
    assert.equal(
      JSON.stringify(state.lastInfinityRuns),
      JSON.stringify(before.lastInfinityRuns),
      "a partial apply failure must restore nested state",
    );
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime, storage } = instance;
    const originalSave = runtime.serializeSaveData();
    originalSave.savedAt = Date.now();
    const rawSave = JSON.stringify(originalSave);
    storage.set(runtime.SAVE_KEY, rawSave);
    const originalProcessOfflineElapsed = runtime.processOfflineElapsed;
    runtime.processOfflineElapsed = () => {
      throw new Error("test offline failure");
    };
    try {
      const originalOfflineElapsedFromSave = runtime.offlineElapsedFromSave;
      runtime.offlineElapsedFromSave = () => ({
        elapsedSeconds: 60,
        clockSource: "local-fallback",
        clockAnomaly: false,
        legacyTimestampUsed: false,
      });
      try {
        assert.equal(await debug.loadGame(), false, "an offline failure should fail the load transaction");
      } finally {
        runtime.offlineElapsedFromSave = originalOfflineElapsedFromSave;
      }
      assert.equal(storage.get(runtime.SAVE_KEY), rawSave, "an offline failure must keep the normal save");
      assert.equal(storage.has(runtime.SAVE_QUARANTINE_KEY), false, "an offline failure must not quarantine the save");
      const failure = JSON.parse(storage.get(runtime.SAVE_LOAD_FAILURE_KEY));
      assert.equal(failure.stage, "offline", "offline failures should be diagnosed separately");
    } finally {
      runtime.processOfflineElapsed = originalProcessOfflineElapsed;
    }
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { context, debug, runtime, storage } = instance;
    const { state } = debug;
    state.generationCount = 8;
    const originalSave = runtime.serializeSaveData();
    originalSave.savedAt = Date.now();
    const rawSave = JSON.stringify(originalSave);
    const originalProcessOfflineElapsed = runtime.processOfflineElapsed;
    const originalOfflineElapsedFromSave = runtime.offlineElapsedFromSave;
    const originalSetItem = context.localStorage.setItem;
    storage.set(runtime.SAVE_KEY, rawSave);
    runtime.offlineElapsedFromSave = () => ({
      elapsedSeconds: 60,
      clockSource: "local-fallback",
      clockAnomaly: false,
      legacyTimestampUsed: false,
    });
    runtime.processOfflineElapsed = () => {
      runtime.state.generationCount += 1;
    };
    context.localStorage.setItem = (key, value) => {
      if (key === runtime.SAVE_KEY) throw new Error("storage full");
      return originalSetItem(key, value);
    };
    try {
      assert.equal(await debug.loadGame(), false, "offline progress must fail when the post-progress save fails");
      assert.equal(state.generationCount, 8, "a failed post-offline save must roll back the applied reward");
      assert.equal(storage.get(runtime.SAVE_KEY), rawSave, "a failed post-offline save must keep the original save");
      assert.equal(runtime.loadRecoveryMode, true, "a failed post-offline save must require recovery");
      const failure = JSON.parse(storage.get(runtime.SAVE_LOAD_FAILURE_KEY));
      assert.equal(failure.stage, "offline", "post-offline save failures should use offline diagnostics");

      context.localStorage.setItem = originalSetItem;
      assert.equal(await debug.retryLoad(), true, "retry should succeed after the storage failure is removed");
      assert.equal(state.generationCount, 9, "retry should apply the offline reward exactly once");
      assert.equal(JSON.parse(storage.get(runtime.SAVE_KEY)).state.generationCount, 9, "retry should persist the applied reward");
    } finally {
      context.localStorage.setItem = originalSetItem;
      runtime.processOfflineElapsed = originalProcessOfflineElapsed;
      runtime.offlineElapsedFromSave = originalOfflineElapsedFromSave;
    }
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime, storage } = instance;
    const invalidRaw = "{not-json";
    storage.set(runtime.SAVE_KEY, invalidRaw);
    assert.equal(await debug.loadGame(), false, "invalid JSON should fail the load");
    assert.equal(storage.has(runtime.SAVE_KEY), false, "invalid JSON should remove the normal save after quarantine");
    const quarantine = JSON.parse(storage.get(runtime.SAVE_QUARANTINE_KEY));
    assert.equal(quarantine.raw, invalidRaw, "invalid JSON should be preserved verbatim");
    assert.equal(storage.has(runtime.SAVE_LOAD_FAILURE_KEY), false, "format failures should use quarantine without load diagnostics");
    runtime.updateUi();
    assert.equal(storage.has(runtime.SAVE_KEY), false, "the initial state must not be autosaved after a format failure");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { context, debug, runtime, storage } = instance;
    const invalidRaw = "{quota-failure";
    storage.set(runtime.SAVE_KEY, invalidRaw);
    const originalSetItem = context.localStorage.setItem;
    context.localStorage.setItem = (key, value) => {
      if (key === runtime.SAVE_QUARANTINE_KEY) throw new Error("storage full");
      return originalSetItem(key, value);
    };
    assert.equal(await debug.loadGame(), false, "a format failure should still fail when quarantine storage is full");
    assert.equal(
      storage.get(runtime.SAVE_KEY),
      invalidRaw,
      "a quarantine storage failure must keep the original save",
    );
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime, storage } = instance;
    const recoverableRaw = JSON.stringify(runtime.serializeSaveData());
    storage.set(runtime.SAVE_QUARANTINE_KEY, JSON.stringify({
      quarantinedAt: Date.now(),
      appVersion: runtime.APP_VERSION,
      raw: recoverableRaw,
    }));
    assert.equal(await debug.restoreQuarantineSave(), true, "a quarantined valid save should be restorable");
    assert.equal(storage.has(runtime.SAVE_QUARANTINE_KEY), false, "successful quarantine restore should consume the quarantine copy");
    assert.equal(storage.has(runtime.SAVE_KEY), true, "successful quarantine restore should write the normal save");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    const { state } = debug;
    const originalLapDuration = runtime.lapDuration;
    runtime.lapDuration = () => Infinity;
    state.infinityCount = 1;
    state.activeChallenge = 1;
    state.autoCompleteChallenges = true;
    state.score = Number.MAX_VALUE;
    state.scoreLog10 = 309;
    try {
      await debug.processOfflineElapsed(1, "test");
      assert.equal(state.activeChallenge, 0, "offline automation should complete the active Infinity Challenge");
      assert.equal(state.completedChallenges & 1, 1, "offline challenge completion should persist its reward state");
      assert.equal(state.infinityCount, 2, "offline challenge completion should continue with a fresh Infinity run");
      assert.ok(state.infinityPointsLog10 > -Infinity, "offline challenge completion should grant Infinity Points");
    } finally {
      runtime.lapDuration = originalLapDuration;
    }
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { context, debug, runtime } = instance;
    const { state } = debug;
    state.generationCount = 12;
    const originalSetItem = context.localStorage.setItem;
    context.localStorage.setItem = (key, value) => {
      if (key === runtime.SAVE_PRE_IMPORT_KEY) throw new Error("storage full");
      return originalSetItem(key, value);
    };
    const code = await debug.exportSaveCode();
    state.generationCount = 34;
    assert.equal(await debug.importSaveCode(code), false, "an import must stop when its backup cannot be stored");
    assert.equal(state.generationCount, 34, "failed backup must leave the current state untouched");
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime, storage } = instance;
    const { state } = debug;
    state.generationCount = 23;
    assert.equal(debug.createCheckpoint("periodic", { force: true }), true, "periodic checkpoints should be writable");
    state.generationCount = 24;
    assert.equal(debug.createCheckpoint("periodic", { force: true }), true, "a second periodic checkpoint should be writable");
    state.generationCount = 25;
    assert.equal(debug.createCheckpoint("periodic", { force: true }), true, "a third periodic checkpoint should be writable");
    state.generationCount = 26;
    assert.equal(debug.createCheckpoint("periodic", { force: true }), true, "a fourth periodic checkpoint should rotate the oldest one");
    const periodic = debug.recoveryEntries().checkpoints.filter((entry) => entry.reason === "periodic");
    assert.equal(periodic.length, 3, "periodic checkpoints should retain three generations");
    assert.deepEqual(
      Array.from(periodic, (entry) => entry.state.generationCount),
      [26, 25, 24],
      "periodic checkpoint rotation should retain the newest generations",
    );

    const rawCheckpoints = JSON.parse(storage.get(runtime.SAVE_CHECKPOINTS_KEY));
    rawCheckpoints.push({ corrupted: true });
    storage.set(runtime.SAVE_CHECKPOINTS_KEY, JSON.stringify(rawCheckpoints));
    assert.equal(debug.recoveryEntries().checkpoints.length, 3, "one corrupt checkpoint must not block valid checkpoints");

    state.generationCount = 40;
    state.achievementMask = 1 << (31 - 1);
    state.achievementMaskHigh = 0b111111;
    assert.equal(debug.createCheckpoint("pre-tower-build", { force: true }), true, "event checkpoints should be writable");
    const checkpointsAfterEvent = debug.recoveryEntries().checkpoints;
    const event = checkpointsAfterEvent.find((entry) => entry.reason === "pre-tower-build");
    assert.equal(event.state.generationCount, 40, "event checkpoints should retain the pre-action state");
    assert.equal(event.state.achievementMask, 1 << (31 - 1), "event checkpoints should retain the low achievement mask");
    assert.equal(event.state.achievementMaskHigh, 0b111111, "event checkpoints should retain the high achievement mask");
    assert.equal(
      checkpointsAfterEvent.filter((entry) => entry.reason === "periodic").length,
      3,
      "event checkpoints must not displace periodic recovery points",
    );
    assert.equal(
      checkpointsAfterEvent.filter((entry) => entry.reason === "pre-tower-build").length,
      1,
      "event checkpoints must be stored only once",
    );

    const rollbackNow = Date.now();
    const fullEventHistory = Array.from(
      { length: runtime.MAX_EVENT_SAVE_CHECKPOINTS },
      (_, index) => ({
        appVersion: "0.9.0",
        saveVersion: 10,
        savedAt: rollbackNow + (index + 1) * 60 * 1000,
        backedUpAt: rollbackNow + (index + 1) * 60 * 1000,
        reason: `pre-event-${index}`,
        state: { score: 0, scoreLog10: -Infinity, generationCount: index },
      }),
    );
    const rollbackEventInstance = await loadRuntime(candidatePath, new Map([
      ["angle-incremental-save-checkpoints", JSON.stringify(fullEventHistory)],
    ]));
    const { debug: rollbackEventDebug, runtime: rollbackEventRuntime } = rollbackEventInstance;
    Object.defineProperty(rollbackEventRuntime, "localClockNowMs", {
      configurable: true,
      value: () => rollbackNow,
    });
    rollbackEventDebug.state.generationCount = 99;
    assert.equal(
      rollbackEventDebug.createCheckpoint("pre-tower-build", { force: true }),
      true,
      "a new event checkpoint should be writable after a local clock rollback",
    );
    const rollbackEventEntries = rollbackEventDebug.recoveryEntries().checkpoints;
    assert.equal(
      rollbackEventEntries.filter((entry) => entry.reason === "pre-tower-build").length,
      1,
      "a rolled-back event checkpoint must not be discarded or duplicated",
    );
    assert.equal(
      rollbackEventEntries.length,
      rollbackEventRuntime.MAX_EVENT_SAVE_CHECKPOINTS,
      "event retention should remain capped after pinning the new checkpoint",
    );

    const restoreTargetIndex = debug.recoveryEntries().checkpoints.findIndex((entry) => entry.reason === "pre-tower-build");
    state.generationCount = 99;
    state.achievementMask = 0;
    state.achievementMaskHigh = 0;
    assert.equal(debug.restoreCheckpoint(restoreTargetIndex), true, "a checkpoint should be restorable from the recovery list");
    assert.equal(state.generationCount, 40, "checkpoint restoration should apply the selected state");
    assert.equal(state.achievementMask & (1 << (31 - 1)), 1 << (31 - 1), "checkpoint restoration should restore the low achievement mask");
    assert.equal(state.achievementMaskHigh, 0b111111, "checkpoint restoration should restore the high achievement mask");
    assert.equal(debug.restoreUndoSave(), true, "checkpoint restoration should expose an undo action");
    assert.equal(state.generationCount, 99, "checkpoint undo should recover the pre-restore state");
    assert.equal(state.achievementMask & (1 << (31 - 1)), 0, "checkpoint undo should recover the previous low achievement mask");
    assert.equal(state.achievementMaskHigh, 0, "checkpoint undo should recover the previous high achievement mask");

    state.generationCount = 41;
    assert.equal(runtime.reloadForRemoteUpdate("test-update"), undefined, "a remote update reload should be deferred by the test location");
    assert.equal(
      debug.recoveryEntries().checkpoints.some((entry) => entry.reason === "pre-update"),
      true,
      "a remote update should create a pre-update checkpoint",
    );

    runtime.updateUi();
    const firstCheckpointRow = runtime.elements.saveCheckpointList.children[0];
    runtime.updateUi();
    assert.equal(
      runtime.elements.saveCheckpointList.children[0],
      firstCheckpointRow,
      "unchanged recovery data should not recreate the focused checkpoint controls",
    );
  }

  {
    const instance = await loadRuntime(candidatePath);
    const { debug, runtime } = instance;
    const { state } = debug;
    state.infinityCount = 1234567;
    state.infinityPoints = 1234567;
    state.infinityPointsLog10 = Math.log10(state.infinityPoints);
    state.achievementMask = 0x7fffffff;
    state.achievementMaskHigh = 0b1111111111;
    assert.equal(debug.createCheckpoint("format-test", { force: true }), true);
    runtime.updateUi();
    const compactSummary = runtime.elements.saveCheckpointList.children[0].children[0].children[2].textContent;
    assert.match(compactSummary, /実績: 41\/41/, "recovery summaries should count achievements from both masks");
    state.numberFormat = "scientific";
    runtime.updateUi();
    const scientificSummary = runtime.elements.saveCheckpointList.children[0].children[0].children[2].textContent;
    assert.notEqual(compactSummary, scientificSummary, "changing number format should refresh recovery summaries");
  }

  {
    const legacyCheckpoint = {
      appVersion: "0.7.0",
      saveVersion: 7,
      savedAt: 1,
      backedUpAt: 1,
      reason: "legacy-checkpoint",
      state: {
        score: 0,
        scoreLog10: -Infinity,
        infinityCount: 2,
        infinityPoints: 0,
        infinityPointsLog10: -Infinity,
      },
    };
    const instance = await loadRuntime(candidatePath, new Map([
      ["angle-incremental-save-checkpoints", JSON.stringify([legacyCheckpoint])],
    ]));
    const { context, debug } = instance;
    context.window.confirm = () => true;
    assert.equal(debug.restoreCheckpoint(0), true, "a legacy checkpoint should be restorable");
    assert.equal(debug.state.infinityCount, 2, "legacy checkpoint state should be migrated before restore");
    assert.equal(debug.state.towerFloor, 0, "legacy checkpoint migration should supply newer defaults");
    assert.equal(debug.state.activeChallenge, 0, "legacy checkpoint migration should clear unavailable challenge state");
  }

  {
    const futureCheckpoint = {
      appVersion: "0.9.0",
      saveVersion: 10,
      savedAt: Date.now() + 60 * 60 * 1000,
      backedUpAt: Date.now() + 60 * 60 * 1000,
      reason: "periodic",
      state: { score: 0, scoreLog10: -Infinity },
    };
    const instance = await loadRuntime(candidatePath, new Map([
      ["angle-incremental-save-checkpoints", JSON.stringify([futureCheckpoint])],
    ]));
    const { debug, storage } = instance;
    debug.state.generationCount = 1;
    assert.equal(debug.saveGame("auto"), true, "a clock rollback should still allow one periodic checkpoint");
    const firstPeriodic = debug.recoveryEntries().checkpoints.filter((entry) => entry.reason === "periodic");
    assert.equal(firstPeriodic.length, 2, "a clock rollback should append a recovery point instead of stopping checkpoints");
    debug.state.generationCount = 2;
    assert.equal(debug.saveGame("auto"), true, "repeated autosaves should remain successful during a clock anomaly");
    const secondPeriodic = debug.recoveryEntries().checkpoints.filter((entry) => entry.reason === "periodic");
    assert.equal(secondPeriodic.length, 2, "the monotonic guard should prevent rapid checkpoint rotation");

    const reloadedInstance = await loadRuntime(candidatePath, new Map(storage));
    const { debug: reloadedDebug } = reloadedInstance;
    reloadedDebug.state.generationCount = 3;
    assert.equal(
      reloadedDebug.saveGame("auto"),
      true,
      "a reload after a clock rollback should still allow autosaves",
    );
    const afterReloadPeriodic = reloadedDebug.recoveryEntries().checkpoints
      .filter((entry) => entry.reason === "periodic");
    assert.equal(
      afterReloadPeriodic.length,
      2,
      "a stale future checkpoint must not trigger rotation on every post-reload autosave",
    );
    assert.equal(
      afterReloadPeriodic.some((entry) => entry.state.generationCount === 1),
      true,
      "the valid pre-rollback checkpoint should remain available after reload",
    );

    const fullFutureNow = Date.now() + 60 * 60 * 1000;
    const fullFutureHistory = [1, 2, 3].map((generationCount, index) => ({
      appVersion: "0.9.0",
      saveVersion: 10,
      savedAt: fullFutureNow + (index + 1) * 60 * 60 * 1000,
      backedUpAt: fullFutureNow + (index + 1) * 60 * 60 * 1000,
      reason: "periodic",
      state: { score: 0, scoreLog10: -Infinity, generationCount },
    }));
    const fullFutureInstance = await loadRuntime(candidatePath, new Map([
      ["angle-incremental-save-checkpoints", JSON.stringify(fullFutureHistory)],
    ]));
    const { debug: fullFutureDebug } = fullFutureInstance;
    fullFutureDebug.state.generationCount = 4;
    assert.equal(
      fullFutureDebug.saveGame("auto"),
      true,
      "a rollback should still write a checkpoint when future entries already fill the limit",
    );
    const fullFuturePeriodic = fullFutureDebug.recoveryEntries().checkpoints
      .filter((entry) => entry.reason === "periodic");
    assert.equal(fullFuturePeriodic.length, 3, "future checkpoint histories should keep the periodic limit");
    assert.equal(
      fullFuturePeriodic.some((entry) => entry.state.generationCount === 4),
      true,
      "the newly created rollback recovery point must survive periodic rotation",
    );

    const mixedNow = Date.now();
    const mixedHistory = [
      {
        appVersion: "0.9.0",
        saveVersion: 10,
        savedAt: mixedNow - 20 * 60 * 1000,
        serverSavedAt: mixedNow - 20 * 60 * 1000,
        backedUpAt: mixedNow - 20 * 60 * 1000,
        reason: "periodic",
        state: { score: 0, scoreLog10: -Infinity, generationCount: 0 },
      },
      {
        appVersion: "0.9.0",
        saveVersion: 10,
        savedAt: mixedNow - 5 * 60 * 1000,
        backedUpAt: mixedNow - 5 * 60 * 1000,
        reason: "periodic",
        state: { score: 0, scoreLog10: -Infinity, generationCount: 1 },
      },
    ];
    const mixedInstance = await loadRuntime(candidatePath, new Map([
      ["angle-incremental-save-checkpoints", JSON.stringify(mixedHistory)],
    ]));
    const { debug: mixedDebug, runtime: mixedRuntime } = mixedInstance;
    Object.defineProperty(mixedRuntime, "serverClockAvailable", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(mixedRuntime, "serverClockNowMs", {
      configurable: true,
      value: () => mixedNow,
    });
    mixedDebug.state.generationCount = 2;
    assert.equal(
      mixedDebug.saveGame("auto"),
      true,
      "server clock recovery should preserve a recent local-only checkpoint",
    );
    assert.equal(
      mixedDebug.recoveryEntries().checkpoints.filter((entry) => entry.reason === "periodic").length,
      2,
      "a mixed server/local checkpoint history should not rotate before ten minutes",
    );

    const serverRollbackHistory = [
      {
        appVersion: "0.9.0",
        saveVersion: 10,
        savedAt: mixedNow - 20 * 60 * 1000,
        serverSavedAt: mixedNow - 20 * 60 * 1000,
        backedUpAt: mixedNow - 20 * 60 * 1000,
        reason: "periodic",
        state: { score: 0, scoreLog10: -Infinity, generationCount: 0 },
      },
      {
        appVersion: "0.9.0",
        saveVersion: 10,
        savedAt: mixedNow - 15 * 60 * 1000,
        serverSavedAt: mixedNow + 60 * 60 * 1000,
        backedUpAt: mixedNow - 15 * 60 * 1000,
        reason: "periodic",
        state: { score: 0, scoreLog10: -Infinity, generationCount: 1 },
      },
      {
        appVersion: "0.9.0",
        saveVersion: 10,
        savedAt: mixedNow - 5 * 60 * 1000,
        backedUpAt: mixedNow - 5 * 60 * 1000,
        reason: "periodic",
        state: { score: 0, scoreLog10: -Infinity, generationCount: 2 },
      },
    ];
    const serverRollbackInstance = await loadRuntime(candidatePath, new Map([
      ["angle-incremental-save-checkpoints", JSON.stringify(serverRollbackHistory)],
    ]));
    const { debug: serverRollbackDebug, runtime: serverRollbackRuntime, storage: serverRollbackStorage } = serverRollbackInstance;
    Object.defineProperty(serverRollbackRuntime, "serverClockAvailable", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(serverRollbackRuntime, "serverClockNowMs", {
      configurable: true,
      value: () => mixedNow,
    });
    serverRollbackDebug.state.generationCount = 3;
    assert.equal(serverRollbackDebug.saveGame("auto"), true, "a server clock rollback should create a checkpoint in a mixed history");
    assert.equal(
      serverRollbackDebug.recoveryEntries().checkpoints.filter((entry) => entry.reason === "periodic").length,
      3,
      "a future server checkpoint should remain detectable alongside an eligible server entry and recent local-only checkpoint",
    );
    assert.equal(
      serverRollbackDebug.recoveryEntries().checkpoints.some((entry) => entry.state.generationCount === 3),
      true,
      "server rollback handling should retain the newly created checkpoint after rotation",
    );

    const reloadedServerRollback = await loadRuntime(candidatePath, new Map(serverRollbackStorage));
    const { debug: reloadedServerRollbackDebug, runtime: reloadedServerRollbackRuntime } = reloadedServerRollback;
    Object.defineProperty(reloadedServerRollbackRuntime, "serverClockAvailable", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(reloadedServerRollbackRuntime, "serverClockNowMs", {
      configurable: true,
      value: () => mixedNow,
    });
    reloadedServerRollbackDebug.state.generationCount = 4;
    assert.equal(reloadedServerRollbackDebug.saveGame("auto"), true, "a recovered server clock should remain throttled after reload");
    assert.equal(
      reloadedServerRollbackDebug.recoveryEntries().checkpoints.filter((entry) => entry.reason === "periodic").length,
      3,
      "a handled server rollback should not rotate repeatedly after reload",
    );

    const recentServerHistory = [
      {
        appVersion: "0.9.0",
        saveVersion: 10,
        savedAt: mixedNow - 5 * 60 * 1000,
        serverSavedAt: mixedNow - 5 * 60 * 1000,
        backedUpAt: mixedNow - 5 * 60 * 1000,
        reason: "periodic",
        state: { score: 0, scoreLog10: -Infinity, generationCount: 0 },
      },
      {
        appVersion: "0.9.0",
        saveVersion: 10,
        savedAt: mixedNow - 4 * 60 * 1000,
        serverSavedAt: mixedNow + 60 * 60 * 1000,
        backedUpAt: mixedNow - 4 * 60 * 1000,
        reason: "periodic",
        state: { score: 0, scoreLog10: -Infinity, generationCount: 1 },
      },
      {
        appVersion: "0.9.0",
        saveVersion: 10,
        savedAt: mixedNow - 1 * 60 * 1000,
        backedUpAt: mixedNow - 1 * 60 * 1000,
        reason: "periodic",
        state: { score: 0, scoreLog10: -Infinity, generationCount: 2 },
      },
    ];
    const recentServerInstance = await loadRuntime(candidatePath, new Map([
      ["angle-incremental-save-checkpoints", JSON.stringify(recentServerHistory)],
    ]));
    const { debug: recentServerDebug, runtime: recentServerRuntime } = recentServerInstance;
    Object.defineProperty(recentServerRuntime, "serverClockAvailable", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(recentServerRuntime, "serverClockNowMs", {
      configurable: true,
      value: () => mixedNow,
    });
    recentServerDebug.state.generationCount = 3;
    assert.equal(recentServerDebug.saveGame("auto"), true, "a recent server checkpoint should throttle a mixed rollback history");
    assert.equal(
      recentServerDebug.recoveryEntries().checkpoints.some((entry) => entry.state.generationCount === 3),
      false,
      "a future server timestamp must not bypass a recent eligible server checkpoint",
    );

  }
}

module.exports = { runSaveRecoveryModuleRuntimeTest };
