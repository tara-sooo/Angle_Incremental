const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

async function runTimeFluxModuleRuntimeTest() {
  const instance = await loadRuntime(candidatePath);
  const { context, debug, runtime } = instance;
  const { state } = debug;

  assert.equal(state.offlineProgressEnabled, true, "offline progress should default to enabled");
  assert.equal(state.offlineTickCount, 1000, "offline ticks should default to 1000");
  assert.equal(state.showTimeFluxQuickBar, true, "legacy Time Flux visibility should default to true");
  assert.equal(state.timeFlux, 0, "new saves should start without dormant Time Flux");
  assert.equal(state.timeFluxCustomSpeed, 4, "the dormant custom speed should default to x4");
  assert.equal(typeof runtime.clampOfflineTickCount, "function", "offline tick clamping should remain available");

  state.totalPlayTime = 0;
  state.totalRealPlayTime = 0;
  state.currentInfinityRunTime = 0;
  state.currentInfinityRealTime = 0;
  state.timeFlux = 123456;
  state.timeFluxSpeed = 60;
  const onlineSeconds = debug.advanceOnlineTime(3);
  assert.equal(onlineSeconds, 3, "online progress should always use x1");
  assert.equal(state.timeFlux, 123456, "online progress should not consume dormant Time Flux");
  assert.equal(state.timeFluxSpeed, 60, "the saved dormant speed should not be rewritten");
  assert.ok(Math.abs(state.totalPlayTime - 3) < 1e-9, "online game time should advance by real seconds");
  assert.ok(Math.abs(state.totalRealPlayTime - 3) < 1e-9, "online real time should advance normally");
  assert.ok(Math.abs(state.currentInfinityRunTime - 3) < 1e-9, "online Infinity time should use x1");
  assert.ok(Math.abs(state.currentInfinityRealTime - 3) < 1e-9, "online real Infinity time should advance normally");

  state.offlineProgressEnabled = false;
  state.offlineTickCount = 500;
  state.timeFlux = 987654;
  state.totalPlayTime = 0;
  state.totalRealPlayTime = 0;
  const migratedOfflineReport = debug.processOfflineElapsed(1, "test", { clockSource: "server" });
  assert.equal(state.offlineProgressEnabled, true, "offline progress should migrate to the always-on mode");
  assert.equal(state.timeFlux, 987654, "normal offline progress should not grant or consume Time Flux");
  assert.ok(Math.abs(state.totalPlayTime - 1) < 1e-9, "old disabled-progress saves should receive normal offline progress");
  assert.equal(state.totalRealPlayTime, 0, "offline progress should not count as real play time");
  assert.equal(migratedOfflineReport.offlineProgressEnabled, true, "offline reports should use the normal mode");
  assert.equal(Object.hasOwn(migratedOfflineReport, "timeFluxGained"), false, "offline reports should not expose TF rewards");

  const originalUpdate = runtime.update;
  let boundedUpdateCalls = 0;
  runtime.update = () => {
    boundedUpdateCalls += 1;
  };
  try {
    state.offlineTickCount = runtime.OFFLINE_PROGRESS_MIN_TICKS;
    const longSeconds = 8 * 86400;
    const trustedLongReport = debug.processOfflineElapsed(longSeconds, "test", { clockSource: "server" });
    assert.equal(trustedLongReport.capped, false, "server-clock offline progress should not use the local seven-day cap");
    assert.equal(trustedLongReport.effectiveElapsedSeconds, longSeconds, "trusted server time should be processed in full");
    assert.equal(trustedLongReport.requestedTicks, runtime.OFFLINE_PROGRESS_MIN_TICKS, "long intervals should respect configured ticks");
    assert.equal(boundedUpdateCalls, trustedLongReport.processedTicks, "long intervals should use bounded simulation work");

    boundedUpdateCalls = 0;
    const localReport = debug.processOfflineElapsed(longSeconds, "test", { clockSource: "local-fallback" });
    assert.equal(localReport.capped, true, "local fallback progress should retain the seven-day cap");
    assert.equal(localReport.effectiveElapsedSeconds, 7 * 86400, "local fallback progress should use seven days");
  } finally {
    runtime.update = originalUpdate;
  }

  const timeFluxBeforeClockAnomaly = state.timeFlux;
  const clockAnomalyReport = debug.processOfflineElapsed(3600, "test", {
    clockSource: "server",
    clockAnomaly: true,
  });
  assert.equal(clockAnomalyReport.clockAnomaly, true, "clock anomalies should be reported");
  assert.equal(clockAnomalyReport.rewardSuppressed, true, "clock anomalies should suppress progress");
  assert.equal(state.timeFlux, timeFluxBeforeClockAnomaly, "clock anomalies should not change dormant Time Flux");
  const invalidElapsedReport = debug.processOfflineElapsed(Infinity, "test", { clockSource: "server" });
  assert.equal(invalidElapsedReport.clockAnomaly, true, "non-finite intervals should be treated as anomalies");
  assert.equal(state.timeFlux, timeFluxBeforeClockAnomaly, "invalid intervals should not change dormant Time Flux");

  runtime.applySaveData({
    offlineProgressEnabled: false,
    timeFlux: 1500000,
    timeFluxCapacityLevel: 60,
    timeFluxGainLevel: 3,
    timeFluxSpeed: 120,
    timeFluxCustomSpeed: 99,
    showTimeFluxQuickBar: false,
  }, 10);
  assert.equal(state.offlineProgressEnabled, true, "loading an old disabled-progress save should normalize the flag");
  assert.equal(state.timeFlux, 1500000, "dormant balances should not be capacity-clamped");
  assert.equal(state.timeFluxCapacityLevel, 60, "dormant capacity levels should be preserved");
  assert.equal(state.timeFluxGainLevel, 3, "dormant gain levels should be preserved");
  assert.equal(state.timeFluxSpeed, 120, "dormant saved speeds should be preserved");
  assert.equal(state.timeFluxCustomSpeed, 99, "dormant custom speeds should be preserved");
  assert.equal(state.showTimeFluxQuickBar, false, "dormant visibility settings should be preserved");

  const serialized = runtime.serializeSaveData();
  assert.equal(serialized.state.offlineProgressEnabled, true, "normal saves should persist the migrated offline mode");
  assert.equal(serialized.state.timeFlux, 1500000, "dormant balances should round-trip through local saves");
  assert.equal(serialized.state.timeFluxCapacityLevel, 60, "dormant capacity levels should be saved");
  assert.equal(serialized.state.timeFluxGainLevel, 3, "dormant gain levels should be saved");
  assert.equal(serialized.state.timeFluxSpeed, 120, "dormant speeds should be saved");
  assert.equal(serialized.state.timeFluxCustomSpeed, 99, "dormant custom speeds should be saved");
  assert.equal(serialized.state.showTimeFluxQuickBar, false, "dormant visibility settings should be saved");

  state.timeFlux = 123;
  state.timeFluxCapacityLevel = 2;
  state.timeFluxGainLevel = 3;
  runtime.resetBelowInfinity();
  assert.equal(state.timeFlux, 123, "Infinity resets should preserve dormant Time Flux");
  assert.equal(state.timeFluxCapacityLevel, 2, "Infinity resets should preserve dormant capacity levels");
  assert.equal(state.timeFluxGainLevel, 3, "Infinity resets should preserve dormant gain levels");

  const oldSaveTimestamp = Date.now() - 3600 * 1000;
  const loadedInstance = await loadRuntime(candidatePath, new Map([
    [
      "angle-incremental-save",
      JSON.stringify({
        version: 10,
        savedAt: oldSaveTimestamp,
        state: { offlineProgressEnabled: false, timeFlux: 777 },
      }),
    ],
  ]));
  assert.equal(loadedInstance.debug.state.offlineProgressEnabled, true, "old saves should migrate to normal offline progress");
  assert.equal(loadedInstance.debug.state.timeFlux, 777, "old dormant balances should survive loading and offline processing");
  assert.equal(loadedInstance.runtime.offlineReport.offlineProgressEnabled, true, "loaded offline reports should use normal progress");
  assert.equal(loadedInstance.runtime.offlineReport.clockSource, "local-fallback", "the harness should identify local fallback time");
  assert.match(
    loadedInstance.context.document.getElementById("offlineReportNote").textContent,
    /サーバー時刻を取得できなかった/,
    "local fallback should remain visible in the offline report",
  );

  const saveFailureInstance = await loadRuntime(candidatePath);
  const saveFailureRuntime = saveFailureInstance.runtime;
  saveFailureRuntime.setOfflineBaseline(1, 0);
  const originalSetItem = saveFailureInstance.context.localStorage.setItem;
  saveFailureInstance.context.localStorage.setItem = () => {
    throw new Error("storage unavailable");
  };
  try {
    assert.equal(saveFailureInstance.debug.saveGame("manual"), false, "storage failures should report a failed save");
    assert.equal(saveFailureRuntime.offlineBaselineTimestamp, 1, "failed saves should not advance the offline baseline");
  } finally {
    saveFailureInstance.context.localStorage.setItem = originalSetItem;
  }

  const hiddenSaveFailureInstance = await loadRuntime(candidatePath);
  const hiddenSaveFailureRuntime = hiddenSaveFailureInstance.runtime;
  const hiddenSaveFailureBaseline = Date.now() - 60 * 1000;
  hiddenSaveFailureRuntime.setOfflineBaseline(hiddenSaveFailureBaseline, 0);
  const hiddenSaveFailureReport = { source: "before-hidden-save" };
  hiddenSaveFailureRuntime.offlineReport = hiddenSaveFailureReport;
  const hiddenSaveFailureState = hiddenSaveFailureRuntime.snapshotRuntimeState();
  const hiddenSaveFailureOriginalSetItem = hiddenSaveFailureInstance.context.localStorage.setItem;
  hiddenSaveFailureInstance.context.document.hidden = true;
  hiddenSaveFailureInstance.context.localStorage.setItem = (key, value) => {
    if (key === hiddenSaveFailureRuntime.SAVE_KEY) throw new Error("storage unavailable");
    return hiddenSaveFailureOriginalSetItem(key, value);
  };
  try {
    await assert.doesNotReject(
      hiddenSaveFailureRuntime.handleVisibilityChange(),
      "a hidden-save failure should be converted into recovery mode",
    );
  } finally {
    hiddenSaveFailureInstance.context.localStorage.setItem = hiddenSaveFailureOriginalSetItem;
    hiddenSaveFailureInstance.context.document.hidden = false;
  }
  assert.deepEqual(
    hiddenSaveFailureRuntime.snapshotRuntimeState(),
    hiddenSaveFailureState,
    "a hidden-save failure should restore the game state",
  );
  assert.equal(hiddenSaveFailureRuntime.offlineBaselineTimestamp, hiddenSaveFailureBaseline, "hidden-save failure should preserve the baseline");
  assert.equal(hiddenSaveFailureRuntime.offlineReport, hiddenSaveFailureReport, "hidden-save failure should preserve the report");
  assert.equal(hiddenSaveFailureRuntime.loadRecoveryMode, true, "hidden-save failure should enter recovery mode");
  assert.equal(hiddenSaveFailureRuntime.autoSaveElapsed, 0, "hidden-save failure should reset the autosave timer");

  const resumeInstance = await loadRuntime(candidatePath);
  const resumeDebug = resumeInstance.debug;
  const resumeRuntime = resumeInstance.runtime;
  let resolveClockRequest;
  const pendingClockRequest = new Promise((resolve) => {
    resolveClockRequest = resolve;
  });
  resumeInstance.context.window.fetch = () => pendingClockRequest;
  resumeRuntime.setOfflineBaseline(Date.now() - 60 * 1000, 0);
  resumeDebug.state.offlineProgressEnabled = false;
  resumeDebug.state.timeFlux = 0;
  const playTimeBeforeResume = resumeDebug.state.totalPlayTime;
  const resumePromise = resumeRuntime.handleVisibilityChange();
  await Promise.resolve();
  resumeRuntime.frame(resumeRuntime.lastTime + 1000);
  assert.equal(resumeDebug.state.totalPlayTime, playTimeBeforeResume, "simulation should pause during clock synchronization");
  resumeRuntime.saveGame("manual");
  resolveClockRequest({
    ok: true,
    headers: { get: () => new Date().toUTCString() },
  });
  await resumePromise;
  assert.ok(resumeRuntime.offlineReport.elapsedSeconds >= 50, "visibility resume should retain its captured interval");
  assert.ok(resumeDebug.state.totalPlayTime > playTimeBeforeResume, "visibility resume should apply normal offline progress");
  assert.equal(resumeDebug.state.timeFlux, 0, "visibility resume should not grant dormant Time Flux");

  const visibilityExceptionInstance = await loadRuntime(candidatePath);
  const visibilityExceptionRuntime = visibilityExceptionInstance.runtime;
  const visibilityExceptionBaseline = Date.now() - 60 * 1000;
  visibilityExceptionRuntime.setOfflineBaseline(visibilityExceptionBaseline, 0);
  visibilityExceptionRuntime.normalAutobuyElapsed = 0.37;
  visibilityExceptionRuntime.autoSaveElapsed = 1.25;
  const previousVisibilityExceptionReport = { source: "before-resume" };
  visibilityExceptionRuntime.offlineReport = previousVisibilityExceptionReport;
  const visibilityExceptionState = visibilityExceptionRuntime.snapshotRuntimeState();
  const visibilityExceptionNormalAutobuyElapsed = visibilityExceptionRuntime.normalAutobuyElapsed;
  const visibilityExceptionLastTime = visibilityExceptionRuntime.lastTime;
  const visibilityExceptionOriginalUpdate = visibilityExceptionRuntime.update;
  let visibilityExceptionUpdateCount = 0;
  visibilityExceptionRuntime.update = (...args) => {
    visibilityExceptionUpdateCount += 1;
    const result = visibilityExceptionOriginalUpdate(...args);
    if (visibilityExceptionUpdateCount === 1) throw new Error("injected visibility update failure");
    return result;
  };
  visibilityExceptionInstance.context.window.fetch = async () => ({
    ok: true,
    headers: { get: () => new Date().toUTCString() },
  });
  try {
    await assert.doesNotReject(
      visibilityExceptionRuntime.handleVisibilityChange(),
      "visibility resume failures should be converted into recovery mode",
    );
  } finally {
    visibilityExceptionRuntime.update = visibilityExceptionOriginalUpdate;
  }
  assert.deepEqual(visibilityExceptionRuntime.snapshotRuntimeState(), visibilityExceptionState, "visibility failure should restore state");
  assert.equal(visibilityExceptionRuntime.normalAutobuyElapsed, visibilityExceptionNormalAutobuyElapsed, "visibility failure should restore automation timing");
  assert.equal(visibilityExceptionRuntime.offlineBaselineTimestamp, visibilityExceptionBaseline, "visibility failure should restore the baseline");
  assert.equal(visibilityExceptionRuntime.offlineReport, previousVisibilityExceptionReport, "visibility failure should restore the report");
  assert.equal(visibilityExceptionRuntime.offlineProcessing, false, "offline processing should always be cleared");
  assert.equal(visibilityExceptionRuntime.autoSaveElapsed, 0, "recovery should consume the autosave timer");
  assert.equal(visibilityExceptionRuntime.lastTime, visibilityExceptionLastTime, "visibility failure should restore frame timing");
  assert.equal(visibilityExceptionRuntime.loadRecoveryMode, true, "visibility failure should enter recovery mode");

  const visibilitySaveFailureInstance = await loadRuntime(candidatePath);
  const visibilitySaveFailureDebug = visibilitySaveFailureInstance.debug;
  const visibilitySaveFailureRuntime = visibilitySaveFailureInstance.runtime;
  const visibilitySaveFailureBaseline = Date.now() - 60 * 1000;
  let resolveVisibilitySaveFailureClockRequest;
  const pendingVisibilitySaveFailureClockRequest = new Promise((resolve) => {
    resolveVisibilitySaveFailureClockRequest = resolve;
  });
  visibilitySaveFailureInstance.context.window.fetch = () => pendingVisibilitySaveFailureClockRequest;
  visibilitySaveFailureRuntime.setOfflineBaseline(visibilitySaveFailureBaseline, 0);
  visibilitySaveFailureDebug.state.offlineProgressEnabled = false;
  visibilitySaveFailureDebug.state.timeFlux = 0;
  const visibilitySaveFailureOriginalSetItem = visibilitySaveFailureInstance.context.localStorage.setItem;
  const visibilitySaveFailureOriginalRemoveItem = visibilitySaveFailureInstance.context.localStorage.removeItem;
  try {
    const visibilitySaveFailurePromise = visibilitySaveFailureRuntime.handleVisibilityChange();
    await Promise.resolve();
    assert.equal(visibilitySaveFailureRuntime.saveGame("manual"), true, "a save during clock synchronization should succeed");
    const pendingResumeSave = JSON.parse(
      visibilitySaveFailureInstance.context.localStorage.getItem(visibilitySaveFailureRuntime.SAVE_KEY),
    );
    assert.ok(pendingResumeSave.savedAt > visibilitySaveFailureBaseline, "the pending save should advance its timestamp");
    const pendingResumeSaveFingerprint = visibilitySaveFailureRuntime.currentSaveFingerprint();
    visibilitySaveFailureInstance.context.localStorage.setItem = (key, value) => {
      if (key === visibilitySaveFailureRuntime.SAVE_KEY) throw new Error("save storage unavailable");
      return visibilitySaveFailureOriginalSetItem(key, value);
    };
    resolveVisibilitySaveFailureClockRequest({
      ok: true,
      headers: { get: () => new Date().toUTCString() },
    });
    await visibilitySaveFailurePromise;
    assert.equal(visibilitySaveFailureDebug.state.timeFlux, 0, "a failed visibility save should not change dormant Time Flux");
    assert.equal(visibilitySaveFailureRuntime.offlineReport, null, "a failed visibility save should clear the report");
    assert.equal(visibilitySaveFailureRuntime.offlineBaselineTimestamp, visibilitySaveFailureBaseline, "a failed visibility save should restore the baseline");
    assert.equal(visibilitySaveFailureRuntime.loadRecoveryMode, true, "a failed visibility save should require recovery");
    const diagnostic = JSON.parse(
      visibilitySaveFailureInstance.context.localStorage.getItem(visibilitySaveFailureRuntime.SAVE_LOAD_FAILURE_KEY),
    );
    assert.equal(diagnostic.offlineRetrySavedAt, visibilitySaveFailureBaseline, "recovery should retain the interval baseline");
    assert.equal(diagnostic.offlineRetrySaveFingerprint, pendingResumeSaveFingerprint, "recovery should fingerprint the latest save");
    visibilitySaveFailureInstance.context.localStorage.setItem = visibilitySaveFailureOriginalSetItem;
    visibilitySaveFailureInstance.context.localStorage.removeItem = (key) => {
      if (key === visibilitySaveFailureRuntime.SAVE_LOAD_FAILURE_KEY) throw new Error("diagnostic removal unavailable");
      return visibilitySaveFailureOriginalRemoveItem(key);
    };
    assert.equal(visibilitySaveFailureDebug.retryLoad(), true, "retry should apply the captured interval");
    assert.ok(visibilitySaveFailureDebug.state.totalPlayTime > 0, "retry should restore normal offline progress");
    const recoveredSave = JSON.parse(
      visibilitySaveFailureInstance.context.localStorage.getItem(visibilitySaveFailureRuntime.SAVE_KEY),
    );
    const originalProcessOfflineElapsed = visibilitySaveFailureRuntime.processOfflineElapsed;
    let reloadRetryBaseline;
    visibilitySaveFailureRuntime.processOfflineElapsed = (elapsed, source, clockContext) => {
      reloadRetryBaseline = clockContext?.retryBaseline;
      return originalProcessOfflineElapsed(elapsed, source, clockContext);
    };
    try {
      assert.equal(visibilitySaveFailureDebug.loadGame(), true, "a recovered save should remain loadable");
    } finally {
      visibilitySaveFailureRuntime.processOfflineElapsed = originalProcessOfflineElapsed;
    }
    assert.ok(!reloadRetryBaseline || reloadRetryBaseline.savedAt === recoveredSave.savedAt, "a stale retry baseline must not be reused");
  } finally {
    visibilitySaveFailureInstance.context.localStorage.setItem = visibilitySaveFailureOriginalSetItem;
    visibilitySaveFailureInstance.context.localStorage.removeItem = visibilitySaveFailureOriginalRemoveItem;
  }

  const concurrentSaveInstance = await loadRuntime(candidatePath);
  const concurrentSaveDebug = concurrentSaveInstance.debug;
  const concurrentSaveRuntime = concurrentSaveInstance.runtime;
  concurrentSaveDebug.state.timeFlux = 120;
  assert.equal(concurrentSaveRuntime.saveGame("manual"), true, "the concurrent-save test should seed a save");
  const concurrentSaveBaseline = Date.now() - 60 * 1000;
  concurrentSaveRuntime.setOfflineBaseline(concurrentSaveBaseline, 0);
  let resolveConcurrentClockRequest;
  const pendingConcurrentClockRequest = new Promise((resolve) => {
    resolveConcurrentClockRequest = resolve;
  });
  concurrentSaveInstance.context.window.fetch = () => pendingConcurrentClockRequest;
  const concurrentSaveOriginalSetItem = concurrentSaveInstance.context.localStorage.setItem;
  const concurrentResumePromise = concurrentSaveRuntime.handleVisibilityChange();
  await Promise.resolve();
  const replacementSave = JSON.parse(
    concurrentSaveInstance.context.localStorage.getItem(concurrentSaveRuntime.SAVE_KEY),
  );
  replacementSave.savedAt = Date.now() - 1000;
  replacementSave.state.totalPlayTime = 9876;
  replacementSave.state.timeFlux = 120;
  concurrentSaveOriginalSetItem.call(
    concurrentSaveInstance.context.localStorage,
    concurrentSaveRuntime.SAVE_KEY,
    JSON.stringify(replacementSave),
  );
  try {
    resolveConcurrentClockRequest({
      ok: true,
      headers: { get: () => new Date().toUTCString() },
    });
    await concurrentResumePromise;
    assert.equal(concurrentSaveRuntime.loadRecoveryMode, false, "a concurrent replacement should reload normally");
    assert.ok(
      concurrentSaveDebug.state.totalPlayTime >= replacementSave.state.totalPlayTime,
      "the newer tab's state should remain the recovery base",
    );
    assert.equal(concurrentSaveDebug.state.timeFlux, replacementSave.state.timeFlux, "the newer tab's dormant fields should win");
    const persistedAfterConcurrentResume = JSON.parse(
      concurrentSaveInstance.context.localStorage.getItem(concurrentSaveRuntime.SAVE_KEY),
    );
    assert.ok(
      persistedAfterConcurrentResume.state.totalPlayTime >= replacementSave.state.totalPlayTime,
      "the old tab must not overwrite the replacement",
    );
  } finally {
    concurrentSaveInstance.context.localStorage.setItem = concurrentSaveOriginalSetItem;
  }

  const automationRollbackInstance = await loadRuntime(candidatePath);
  const automationRollbackDebug = automationRollbackInstance.debug;
  const automationRollbackRuntime = automationRollbackInstance.runtime;
  const autoBuySpeedUpgrade = automationRollbackRuntime.INFINITY_UPGRADES.find((upgrade) => upgrade.id === "1-2");
  automationRollbackDebug.state.infinityUpgradeMask = 1 << autoBuySpeedUpgrade.bit;
  automationRollbackDebug.state.automationEnabled = true;
  automationRollbackRuntime.normalAutobuyElapsed = 0.02;
  const normalAutobuyElapsedBeforeFailure = automationRollbackRuntime.normalAutobuyElapsed;
  const automationRollbackOriginalSetItem = automationRollbackInstance.context.localStorage.setItem;
  automationRollbackInstance.context.localStorage.setItem = (key, value) => {
    if (key === automationRollbackRuntime.SAVE_KEY) throw new Error("save storage unavailable");
    return automationRollbackOriginalSetItem(key, value);
  };
  try {
    assert.equal(
      automationRollbackDebug.processOfflineElapsed(0.01, "test", { clockSource: "server" }),
      null,
      "an automation save failure should abort offline processing",
    );
    assert.equal(automationRollbackRuntime.normalAutobuyElapsed, normalAutobuyElapsedBeforeFailure, "failed offline saves should roll back automation timing");
  } finally {
    automationRollbackInstance.context.localStorage.setItem = automationRollbackOriginalSetItem;
  }

  const resetResumeInstance = await loadRuntime(candidatePath);
  const resetResumeDebug = resetResumeInstance.debug;
  const resetResumeRuntime = resetResumeInstance.runtime;
  let resolveResetClockRequest;
  const pendingResetClockRequest = new Promise((resolve) => {
    resolveResetClockRequest = resolve;
  });
  resetResumeInstance.context.window.fetch = () => pendingResetClockRequest;
  resetResumeRuntime.setOfflineBaseline(Date.now() - 60 * 1000, 0);
  const resetResumePromise = resetResumeRuntime.handleVisibilityChange();
  await Promise.resolve();
  resetResumeRuntime.resetSave();
  resolveResetClockRequest({
    ok: true,
    headers: { get: () => new Date().toUTCString() },
  });
  await resetResumePromise;
  assert.equal(resetResumeDebug.state.totalPlayTime, 0, "reset should not receive stale offline progress");
  assert.equal(resetResumeDebug.state.timeFlux, 0, "reset should clear dormant Time Flux");
  assert.equal(resetResumeRuntime.offlineReport, null, "reset should clear the pending offline report");

  console.log("Time Flux removal and offline compatibility tests passed");
}

module.exports = { runTimeFluxModuleRuntimeTest };
