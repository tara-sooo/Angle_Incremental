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
      debug.processOfflineElapsed(1, "test");
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
    assert.equal(debug.createCheckpoint("pre-tower-build", { force: true }), true, "event checkpoints should be writable");
    const event = debug.recoveryEntries().checkpoints.find((entry) => entry.reason === "pre-tower-build");
    assert.equal(event.state.generationCount, 40, "event checkpoints should retain the pre-action state");

    const restoreTargetIndex = debug.recoveryEntries().checkpoints.findIndex((entry) => entry.reason === "pre-tower-build");
    state.generationCount = 99;
    assert.equal(debug.restoreCheckpoint(restoreTargetIndex), true, "a checkpoint should be restorable from the recovery list");
    assert.equal(state.generationCount, 40, "checkpoint restoration should apply the selected state");
    assert.equal(debug.restoreUndoSave(), true, "checkpoint restoration should expose an undo action");
    assert.equal(state.generationCount, 99, "checkpoint undo should recover the pre-restore state");

    state.generationCount = 41;
    assert.equal(runtime.reloadForRemoteUpdate("0.9.1"), undefined, "a remote update reload should be deferred by the test location");
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
    assert.equal(debug.createCheckpoint("format-test", { force: true }), true);
    runtime.updateUi();
    const compactSummary = runtime.elements.saveCheckpointList.children[0].children[0].children[2].textContent;
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
