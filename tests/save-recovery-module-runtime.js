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

    runtime.updateUi();
    const firstCheckpointRow = runtime.elements.saveCheckpointList.children[0];
    runtime.updateUi();
    assert.equal(
      runtime.elements.saveCheckpointList.children[0],
      firstCheckpointRow,
      "unchanged recovery data should not recreate the focused checkpoint controls",
    );
  }
}

module.exports = { runSaveRecoveryModuleRuntimeTest };
