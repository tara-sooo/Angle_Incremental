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
  state.offlineTickCount = 1000;
  state.timeFlux = 987654;
  state.totalPlayTime = 0;
  state.totalRealPlayTime = 0;
  const disabledBaseline = Date.now() - 60 * 1000;
  runtime.setOfflineBaseline(disabledBaseline, 0);
  const disabledBefore = {
    totalPlayTime: state.totalPlayTime,
    totalRealPlayTime: state.totalRealPlayTime,
    currentInfinityRunTime: state.currentInfinityRunTime,
    currentInfinityRealTime: state.currentInfinityRealTime,
    timeFlux: state.timeFlux,
  };
  const disabledOfflineResult = await debug.processOfflineElapsed(1, "test", { clockSource: "server" });
  assert.equal(state.offlineProgressEnabled, false, "the offline progress setting should remain disabled");
  assert.deepEqual({
    totalPlayTime: state.totalPlayTime,
    totalRealPlayTime: state.totalRealPlayTime,
    currentInfinityRunTime: state.currentInfinityRunTime,
    currentInfinityRealTime: state.currentInfinityRealTime,
    timeFlux: state.timeFlux,
  }, disabledBefore, "disabled offline progress should not change game state");
  assert.equal(disabledOfflineResult.skipped, true, "disabled offline processing should return a successful skip result");
  assert.equal(runtime.offlineReport, null, "disabled offline processing should not show a report");
  assert.ok(runtime.offlineBaselineTimestamp > disabledBaseline, "disabled offline processing should rebase the local baseline");
  state.offlineProgressEnabled = true;

  const originalUpdate = runtime.update;
  let boundedUpdateCalls = 0;
  runtime.update = () => {
    boundedUpdateCalls += 1;
  };
  try {
    state.offlineTickCount = runtime.OFFLINE_PROGRESS_MIN_TICKS;
    const longSeconds = 8 * 86400;
    const trustedLongReport = await debug.processOfflineElapsed(longSeconds, "test", { clockSource: "server" });
    assert.equal(trustedLongReport.capped, false, "server-clock offline progress should not use the local seven-day cap");
    assert.equal(trustedLongReport.effectiveElapsedSeconds, longSeconds, "trusted server time should be processed in full");
    assert.equal(trustedLongReport.requestedTicks, runtime.OFFLINE_PROGRESS_MIN_TICKS, "long intervals should respect configured ticks");
    assert.equal(boundedUpdateCalls, trustedLongReport.processedTicks, "long intervals should use bounded simulation work");

    boundedUpdateCalls = 0;
    const localReport = await debug.processOfflineElapsed(longSeconds, "test", { clockSource: "local-fallback" });
    assert.equal(localReport.capped, true, "local fallback progress should retain the seven-day cap");
    assert.equal(localReport.effectiveElapsedSeconds, 7 * 86400, "local fallback progress should use seven days");
  } finally {
    runtime.update = originalUpdate;
  }

  const timeFluxBeforeClockAnomaly = state.timeFlux;
  const clockAnomalyReport = await debug.processOfflineElapsed(3600, "test", {
    clockSource: "server",
    clockAnomaly: true,
  });
  assert.equal(clockAnomalyReport.clockAnomaly, true, "clock anomalies should be reported");
  assert.equal(clockAnomalyReport.rewardSuppressed, true, "clock anomalies should suppress progress");
  assert.equal(state.timeFlux, timeFluxBeforeClockAnomaly, "clock anomalies should not change dormant Time Flux");
  const invalidElapsedReport = await debug.processOfflineElapsed(Infinity, "test", { clockSource: "server" });
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
  assert.equal(state.offlineProgressEnabled, false, "loading an explicit disabled-progress save should preserve the flag");
  assert.equal(state.timeFlux, 1500000, "dormant balances should not be capacity-clamped");
  assert.equal(state.timeFluxCapacityLevel, 60, "dormant capacity levels should be preserved");
  assert.equal(state.timeFluxGainLevel, 3, "dormant gain levels should be preserved");
  assert.equal(state.timeFluxSpeed, 120, "dormant saved speeds should be preserved");
  assert.equal(state.timeFluxCustomSpeed, 99, "dormant custom speeds should be preserved");
  assert.equal(state.showTimeFluxQuickBar, false, "dormant visibility settings should be preserved");

  const serialized = runtime.serializeSaveData();
  assert.equal(serialized.state.offlineProgressEnabled, false, "normal saves should persist the disabled offline mode");
  assert.equal(serialized.state.timeFlux, 1500000, "dormant balances should round-trip through local saves");
  assert.equal(serialized.state.timeFluxCapacityLevel, 60, "dormant capacity levels should be saved");
  assert.equal(serialized.state.timeFluxGainLevel, 3, "dormant gain levels should be saved");
  assert.equal(serialized.state.timeFluxSpeed, 120, "dormant speeds should be saved");
  assert.equal(serialized.state.timeFluxCustomSpeed, 99, "dormant custom speeds should be saved");
  assert.equal(serialized.state.showTimeFluxQuickBar, false, "dormant visibility settings should be saved");

  state.bestInfinityCountPerSecond = 12.5;
  state.infinityCountRateRemainder = 0.75;
  const rateSerialized = runtime.serializeSaveData();
  assert.equal(rateSerialized.state.bestInfinityCountPerSecond, 12.5, "the best Infinity rate should be saved");
  assert.equal(rateSerialized.state.infinityCountRateRemainder, 0.75, "the Infinity rate remainder should be saved");

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
        state: { timeFlux: 777 },
      }),
    ],
  ]));
  assert.equal(loadedInstance.debug.state.offlineProgressEnabled, true, "old saves without the setting should default to enabled");
  assert.equal(loadedInstance.debug.state.timeFlux, 777, "old dormant balances should survive loading and offline processing");
  assert.equal(loadedInstance.runtime.offlineReport.offlineProgressEnabled, true, "loaded offline reports should use normal progress");
  assert.equal(loadedInstance.runtime.offlineReport.clockSource, "local-fallback", "the harness should identify local fallback time");
  assert.match(
    loadedInstance.context.document.getElementById("offlineReportNote").textContent,
    /サーバー時刻を取得できなかった/,
    "local fallback should remain visible in the offline report",
  );

  const disabledLoadedInstance = await loadRuntime(candidatePath, new Map([
    [
      "angle-incremental-save",
      JSON.stringify({
        version: 10,
        savedAt: oldSaveTimestamp,
        state: { offlineProgressEnabled: false, timeFlux: 778 },
      }),
    ],
  ]));
  assert.equal(disabledLoadedInstance.debug.state.offlineProgressEnabled, false, "disabled saves should remain disabled after loading");
  assert.equal(disabledLoadedInstance.debug.state.timeFlux, 778, "disabled saves should preserve dormant balances");
  assert.equal(disabledLoadedInstance.debug.state.totalPlayTime, 0, "disabled loads should not grant offline play time");
  assert.equal(disabledLoadedInstance.runtime.offlineReport, null, "disabled loads should not show an offline report");
  const disabledLoadedSave = JSON.parse(
    disabledLoadedInstance.context.localStorage.getItem(disabledLoadedInstance.runtime.SAVE_KEY),
  );
  assert.ok(disabledLoadedSave.savedAt > oldSaveTimestamp, "disabled loads should persist the rebased timestamp");
  assert.equal(disabledLoadedSave.state.offlineProgressEnabled, false, "disabled loads should persist the disabled setting");

  const toggleInstance = await loadRuntime(candidatePath);
  const toggleDebug = toggleInstance.debug;
  const toggleRuntime = toggleInstance.runtime;
  toggleRuntime.setOfflineBaseline(Date.now() - 60 * 1000, 0);
  toggleDebug.applySetting("offlineProgressEnabled", false);
  const disabledToggleSave = JSON.parse(
    toggleInstance.context.localStorage.getItem(toggleRuntime.SAVE_KEY),
  );
  assert.equal(disabledToggleSave.state.offlineProgressEnabled, false, "turning offline progress off should persist immediately");
  assert.ok(disabledToggleSave.savedAt > oldSaveTimestamp, "turning offline progress off should reset the saved baseline");
  toggleDebug.applySetting("offlineProgressEnabled", true);
  const reenabledToggleSave = JSON.parse(
    toggleInstance.context.localStorage.getItem(toggleRuntime.SAVE_KEY),
  );
  assert.equal(reenabledToggleSave.state.offlineProgressEnabled, true, "turning offline progress on should persist immediately");
  const reenabledInstance = await loadRuntime(candidatePath, new Map([
    [toggleRuntime.SAVE_KEY, JSON.stringify(reenabledToggleSave)],
  ]));
  assert.ok(reenabledInstance.debug.state.totalPlayTime < 1, "reenabling offline progress should not replay the disabled interval");

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
  resumeDebug.state.offlineProgressEnabled = true;
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

  const disabledResumeInstance = await loadRuntime(candidatePath);
  const disabledResumeDebug = disabledResumeInstance.debug;
  const disabledResumeRuntime = disabledResumeInstance.runtime;
  const disabledResumeBaseline = Date.now() - 60 * 1000;
  disabledResumeRuntime.setOfflineBaseline(disabledResumeBaseline, 0);
  disabledResumeDebug.state.offlineProgressEnabled = false;
  disabledResumeDebug.state.totalPlayTime = 12;
  disabledResumeDebug.state.currentInfinityRunTime = 7;
  disabledResumeRuntime.normalAutobuyElapsed = 0.37;
  const disabledResumeState = disabledResumeRuntime.snapshotRuntimeState();
  const disabledResumeAutobuyElapsed = disabledResumeRuntime.normalAutobuyElapsed;
  let disabledResumeClockRequested = false;
  const pendingDisabledResumeClockRequest = new Promise(() => {});
  disabledResumeInstance.context.window.fetch = () => {
    disabledResumeClockRequested = true;
    return pendingDisabledResumeClockRequest;
  };
  const disabledResumeResult = await Promise.race([
    disabledResumeRuntime.handleVisibilityChange().then(() => "completed"),
    new Promise((resolve) => setTimeout(() => resolve("timed out"), 100)),
  ]);
  assert.equal(disabledResumeResult, "completed", "disabled visibility resume should not wait for server clock synchronization");
  assert.equal(disabledResumeClockRequested, false, "disabled visibility resume should skip the server clock request");
  assert.deepEqual(disabledResumeRuntime.snapshotRuntimeState(), disabledResumeState, "disabled visibility resume should not advance game state");
  assert.equal(disabledResumeRuntime.normalAutobuyElapsed, disabledResumeAutobuyElapsed, "disabled visibility resume should not advance automation timing");
  assert.equal(disabledResumeRuntime.offlineReport, null, "disabled visibility resume should not show an offline report");
  assert.ok(disabledResumeRuntime.offlineBaselineTimestamp > disabledResumeBaseline, "disabled visibility resume should rebase the baseline");
  const disabledResumeSave = JSON.parse(
    disabledResumeInstance.context.localStorage.getItem(disabledResumeRuntime.SAVE_KEY),
  );
  assert.equal(disabledResumeSave.state.offlineProgressEnabled, false, "disabled visibility resume should persist the setting");
  assert.ok(disabledResumeSave.savedAt > disabledResumeBaseline, "disabled visibility resume should persist the rebased timestamp");

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
  visibilitySaveFailureDebug.state.offlineProgressEnabled = true;
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
    assert.equal(await visibilitySaveFailureDebug.retryLoad(), true, "retry should apply the captured interval");
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
      assert.equal(await visibilitySaveFailureDebug.loadGame(), true, "a recovered save should remain loadable");
    } finally {
      visibilitySaveFailureRuntime.processOfflineElapsed = originalProcessOfflineElapsed;
    }
    assert.ok(!reloadRetryBaseline || reloadRetryBaseline.savedAt === recoveredSave.savedAt, "a stale retry baseline must not be reused");
  } finally {
    visibilitySaveFailureInstance.context.localStorage.setItem = visibilitySaveFailureOriginalSetItem;
    visibilitySaveFailureInstance.context.localStorage.removeItem = visibilitySaveFailureOriginalRemoveItem;
  }

  const preResumeConcurrentInstance = await loadRuntime(candidatePath);
  const preResumeConcurrentDebug = preResumeConcurrentInstance.debug;
  const preResumeConcurrentRuntime = preResumeConcurrentInstance.runtime;
  preResumeConcurrentDebug.state.timeFlux = 120;
  assert.equal(preResumeConcurrentRuntime.saveGame("manual"), true, "the pre-resume concurrency test should seed a save");
  preResumeConcurrentRuntime.setOfflineBaseline(Date.now() - 60 * 1000, 0);
  const preResumeReplacement = JSON.parse(
    preResumeConcurrentInstance.context.localStorage.getItem(preResumeConcurrentRuntime.SAVE_KEY),
  );
  preResumeReplacement.savedAt = Date.now();
  preResumeReplacement.state.totalPlayTime = 9876;
  preResumeReplacement.state.timeFlux = 120;
  preResumeConcurrentInstance.context.localStorage.setItem(
    preResumeConcurrentRuntime.SAVE_KEY,
    JSON.stringify(preResumeReplacement),
  );
  await preResumeConcurrentRuntime.handleVisibilityChange();
  assert.equal(preResumeConcurrentRuntime.loadRecoveryMode, false, "a save replaced before resume should reload normally");
  assert.ok(
    preResumeConcurrentDebug.state.totalPlayTime >= preResumeReplacement.state.totalPlayTime,
    "a save replaced before resume should become the recovery base",
  );
  assert.ok(
    preResumeConcurrentDebug.state.totalPlayTime < preResumeReplacement.state.totalPlayTime + 10,
    "resume must not replay the old tab's captured interval after a replacement",
  );
  const persistedPreResumeReplacement = JSON.parse(
    preResumeConcurrentInstance.context.localStorage.getItem(preResumeConcurrentRuntime.SAVE_KEY),
  );
  assert.ok(
    persistedPreResumeReplacement.state.totalPlayTime >= preResumeReplacement.state.totalPlayTime,
    "resume must not overwrite a replacement that already existed before it started",
  );

  const hiddenConcurrentInstance = await loadRuntime(candidatePath);
  const hiddenConcurrentDebug = hiddenConcurrentInstance.debug;
  const hiddenConcurrentRuntime = hiddenConcurrentInstance.runtime;
  hiddenConcurrentDebug.state.timeFlux = 120;
  assert.equal(hiddenConcurrentRuntime.saveGame("manual"), true, "the hidden concurrency test should seed a save");
  hiddenConcurrentRuntime.setOfflineBaseline(Date.now() - 60 * 1000, 0);
  const hiddenReplacement = JSON.parse(
    hiddenConcurrentInstance.context.localStorage.getItem(hiddenConcurrentRuntime.SAVE_KEY),
  );
  hiddenReplacement.savedAt = Date.now();
  hiddenReplacement.state.totalPlayTime = 5432;
  hiddenReplacement.state.timeFlux = 120;
  hiddenConcurrentInstance.context.localStorage.setItem(
    hiddenConcurrentRuntime.SAVE_KEY,
    JSON.stringify(hiddenReplacement),
  );
  hiddenConcurrentInstance.context.document.hidden = true;
  try {
    await hiddenConcurrentRuntime.handleVisibilityChange();
  } finally {
    hiddenConcurrentInstance.context.document.hidden = false;
  }
  assert.equal(hiddenConcurrentRuntime.loadRecoveryMode, false, "a save replaced before hiding should reload normally");
  assert.ok(
    hiddenConcurrentDebug.state.totalPlayTime >= hiddenReplacement.state.totalPlayTime,
    "a save replaced before hiding should become the save base",
  );
  assert.ok(
    hiddenConcurrentDebug.state.totalPlayTime < hiddenReplacement.state.totalPlayTime + 10,
    "hidden save must not replay the old tab's interval after a replacement",
  );
  const persistedHiddenReplacement = JSON.parse(
    hiddenConcurrentInstance.context.localStorage.getItem(hiddenConcurrentRuntime.SAVE_KEY),
  );
  assert.ok(
    persistedHiddenReplacement.state.totalPlayTime >= hiddenReplacement.state.totalPlayTime,
    "hidden save must not overwrite a replacement that already existed",
  );

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
      await automationRollbackDebug.processOfflineElapsed(0.01, "test", { clockSource: "server" }),
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

  const millionTickInstance = await loadRuntime(candidatePath);
  const millionTickRuntime = millionTickInstance.runtime;
  const millionTickDebug = millionTickInstance.debug;
  millionTickDebug.state.offlineTickCount = millionTickRuntime.OFFLINE_PROGRESS_MAX_TICKS;
  const millionTickOriginalUpdate = millionTickRuntime.update;
  const millionTickOriginalNow = millionTickInstance.context.performance.now;
  const millionTickOriginalSetTimeout = millionTickInstance.context.window.setTimeout;
  let millionTickClock = 0;
  let millionTickClockFlat = false;
  let millionTickUpdateCalls = 0;
  let millionTickProgressUpdates = 0;
  let millionTickProgressValue = 0;
  let millionTickUpdatesAtLastYield = 0;
  const millionTickYieldBatches = [];
  Object.defineProperty(millionTickRuntime.elements.offlineReportProgress, "value", {
    configurable: true,
    get: () => millionTickProgressValue,
    set: (value) => {
      millionTickProgressValue = value;
      millionTickProgressUpdates += 1;
    },
  });
  millionTickInstance.context.performance.now = () => millionTickClock;
  millionTickInstance.context.window.setTimeout = (callback) => {
    millionTickYieldBatches.push({
      updates: millionTickUpdateCalls - millionTickUpdatesAtLastYield,
      end: millionTickUpdateCalls,
    });
    millionTickUpdatesAtLastYield = millionTickUpdateCalls;
    callback();
    return 0;
  };
  millionTickRuntime.update = () => {
    millionTickUpdateCalls += 1;
    if (millionTickClockFlat) return;
    millionTickClock += millionTickUpdateCalls <= 448
      ? 0
      : millionTickUpdateCalls < 20000
        ? 0.0005
        : 0.01;
  };
  try {
    millionTickClockFlat = true;
    millionTickClock = 0;
    millionTickUpdateCalls = 0;
    millionTickYieldBatches.length = 0;
    millionTickUpdatesAtLastYield = 0;
    millionTickProgressUpdates = 0;
    const flatClockReport = await millionTickDebug.processOfflineElapsed(
      10000 * millionTickRuntime.MAX_SIMULATION_STEP_SECONDS,
      "test",
      { clockSource: "server" },
    );
    assert.equal(flatClockReport.processedTicks, 10000, "flat clocks should still process the requested ticks");
    assert.ok(millionTickYieldBatches.length > 0, "flat clocks should trigger a bounded fallback yield");
    assert.ok(millionTickYieldBatches[0].end < 10000, "flat clocks should yield before the whole batch completes");

    millionTickClockFlat = false;
    millionTickClock = 0;
    millionTickUpdateCalls = 0;
    millionTickYieldBatches.length = 0;
    millionTickUpdatesAtLastYield = 0;
    millionTickProgressUpdates = 0;
    const millionTickReport = await millionTickDebug.processOfflineElapsed(
      millionTickRuntime.OFFLINE_PROGRESS_MAX_TICKS * millionTickRuntime.MAX_SIMULATION_STEP_SECONDS,
      "test",
      { clockSource: "server" },
    );
    assert.equal(millionTickReport.configuredTicks, 1000000, "offline settings should allow one million configured ticks");
    assert.equal(millionTickReport.requestedTicks, 1000000, "offline processing should request one million ticks");
    assert.equal(millionTickReport.processedTicks, 1000000, "offline processing should not retain a hidden tick cap");
    assert.equal(millionTickUpdateCalls, 1000000, "one million ticks should be simulated exactly once");
    assert.ok(millionTickProgressUpdates > 1, "large offline processing should publish incremental progress");
    assert.ok(
      millionTickYieldBatches[0]?.end > 448,
      "zero-duration batches should grow without yielding until the clock advances",
    );
    assert.ok(
      millionTickYieldBatches.some((batch) => batch.updates > 1000),
      "fast offline processing should grow beyond the removed fixed batch size",
    );
    assert.ok(
      millionTickYieldBatches.some((batch) => batch.end >= 20000 && batch.updates < 1000),
      "adaptive offline processing should shrink after simulated work slows down",
    );
    assert.ok(millionTickProgressUpdates < 1000, "offline progress DOM updates should be throttled");
  } finally {
    millionTickRuntime.update = millionTickOriginalUpdate;
    millionTickInstance.context.performance.now = millionTickOriginalNow;
    millionTickInstance.context.window.setTimeout = millionTickOriginalSetTimeout;
  }

  const floatingTextInstance = await loadRuntime(candidatePath);
  const floatingTextRuntime = floatingTextInstance.runtime;
  const floatingTextState = floatingTextInstance.debug.state;
  floatingTextState.floatingTexts = [{ life: 1, y: 10 }];
  floatingTextRuntime.offlineProcessing = true;
  floatingTextInstance.debug.update(1 / 60);
  assert.equal(floatingTextState.floatingTexts[0].life, 1, "offline processing should pause Floating Text updates");
  floatingTextRuntime.offlineProcessing = false;
  floatingTextInstance.debug.update(1 / 60);
  assert.ok(floatingTextState.floatingTexts[0].life < 1, "online processing should continue Floating Text updates");

  const reentrancyInstance = await loadRuntime(candidatePath);
  const reentrancyRuntime = reentrancyInstance.runtime;
  const reentrancyDebug = reentrancyInstance.debug;
  const reentrancyOriginalUpdate = reentrancyRuntime.update;
  const reentrancyOriginalNow = reentrancyInstance.context.performance.now;
  const reentrancyOriginalSetTimeout = reentrancyInstance.context.window.setTimeout;
  let reentrancyYielded = false;
  let reentrancyClock = 0;
  let reentrancyUpdateCalls = 0;
  reentrancyDebug.state.generationCount = 7;
  reentrancyDebug.state.offlineTickCount = reentrancyRuntime.OFFLINE_PROGRESS_MAX_TICKS;
  reentrancyInstance.context.performance.now = () => reentrancyClock;
  reentrancyRuntime.update = () => {
    reentrancyUpdateCalls += 1;
    reentrancyClock += reentrancyUpdateCalls <= 448 ? 0 : 0.1;
  };
  reentrancyInstance.context.window.setTimeout = (callback) => {
    if (!reentrancyYielded) {
      reentrancyYielded = true;
      reentrancyDebug.resetSave();
      reentrancyDebug.applySetting("offlineProgressEnabled", false);
      reentrancyRuntime.offlineReport = null;
    }
    callback();
    return 0;
  };
  try {
    const reentrancyReport = await reentrancyDebug.processOfflineElapsed(
      2000 * reentrancyRuntime.MAX_SIMULATION_STEP_SECONDS,
      "test",
      { clockSource: "server" },
    );
    assert.ok(reentrancyReport.processedTicks >= 2000, "chunked offline processing should survive a cleared shared report");
    assert.equal(reentrancyDebug.state.generationCount, 7, "offline processing should lock reset actions while yielding");
    assert.equal(reentrancyDebug.state.offlineProgressEnabled, true, "offline processing should lock settings while yielding");
  } finally {
    reentrancyRuntime.update = reentrancyOriginalUpdate;
    reentrancyInstance.context.performance.now = reentrancyOriginalNow;
    reentrancyInstance.context.window.setTimeout = reentrancyOriginalSetTimeout;
  }

  const rateInstance = await loadRuntime(candidatePath);
  const rateRuntime = rateInstance.runtime;
  const rateState = rateInstance.debug.state;
  rateRuntime.recordInfinityRun(0, 0, 1, false, 1, 0);
  rateRuntime.recordInfinityRun(0, 0, 0, false, 1, 2);
  rateRuntime.offlineProcessing = true;
  rateRuntime.recordInfinityRun(0, 0, 0, false, 1, 0);
  rateRuntime.offlineProcessing = false;
  rateState.activeTowerChallenge = 2;
  rateRuntime.recordInfinityRun(0, 0, 0, false, 1, 0);
  rateState.activeTowerChallenge = 0;
  assert.equal(rateState.bestInfinityCountPerSecond, 0, "challenge Infinity runs should not set the best rate");
  rateState.infinityCount = 1;
  rateState.score = Number.MAX_VALUE;
  rateState.scoreLog10 = 309;
  rateState.currentInfinityRealTime = 0.01;
  rateState.activeChallenge = 0;
  rateState.activeTowerChallenge = 0;
  rateRuntime.runInfinity(false);
  assert.equal(rateState.bestInfinityCountPerSecond, 30, "Infinity rate should use the one-thirtieth-second minimum");

  const aggregationInstance = await loadRuntime(candidatePath);
  const aggregationRuntime = aggregationInstance.runtime;
  const aggregationState = aggregationInstance.debug.state;
  const infinityAutomationUpgrade = aggregationRuntime.INFINITY_UPGRADES.find((upgrade) => upgrade.id === "8-1");
  aggregationState.infinityUpgradeMask = 1 << infinityAutomationUpgrade.bit;
  aggregationState.infinityCount = 1;
  aggregationState.bestInfinityCountPerSecond = 2;
  aggregationState.infinityCountRateRemainder = 0.5;
  aggregationState.automationEnabled = true;
  aggregationState.autoRunInfinity = true;
  aggregationState.autoInfinityPointThresholdLog10 = 0;
  aggregationState.offlineTickCount = 1000;
  aggregationState.lastInfinityRuns = [];
  const aggregationOriginalUpdate = aggregationRuntime.update;
  aggregationRuntime.update = () => {};
  try {
    const aggregateReport = await aggregationInstance.debug.processOfflineElapsed(10, "test", { clockSource: "server" });
    assert.equal(aggregateReport.normalInfinityCountGain, 0, "the aggregate test should have no normal Infinity gain");
    assert.equal(aggregateReport.aggregatedInfinityCountGain, 20, "aggregation should add only the target shortfall");
    assert.equal(aggregateReport.totalInfinityCountGain, 20, "the report should include normal and aggregate gains");
    assert.equal(aggregationState.infinityCount, 21, "aggregated Infinity should be added directly");
    assert.equal(aggregationState.infinityCountRateRemainder, 0.5, "fractional Infinity gain should carry forward");
    assert.equal(aggregationState.lastInfinityRuns.length, 0, "aggregation should not create Infinity history entries");

    aggregationState.infinityCount = 1;
    aggregationState.infinityCountRateRemainder = 0;
    let normalGainApplied = false;
    aggregationRuntime.update = () => {
      if (!normalGainApplied) {
        aggregationState.infinityCount += 5;
        normalGainApplied = true;
      }
    };
    const mixedReport = await aggregationInstance.debug.processOfflineElapsed(10, "test", { clockSource: "server" });
    assert.equal(mixedReport.normalInfinityCountGain, 5, "the report should separate simulated Infinity gain");
    assert.equal(mixedReport.aggregatedInfinityCountGain, 15, "aggregation should subtract simulated Infinity gain");
    assert.equal(aggregationState.infinityCount, 21, "normal and aggregate Infinity gains should not double count");

    aggregationState.infinityCount = 1;
    aggregationState.infinityCountRateRemainder = 0;
    let overshootGainApplied = false;
    aggregationRuntime.update = () => {
      if (!overshootGainApplied) {
        aggregationState.infinityCount += 1;
        overshootGainApplied = true;
      }
    };
    const overshootReport = await aggregationInstance.debug.processOfflineElapsed(0.25, "test", { clockSource: "server" });
    assert.equal(overshootReport.normalInfinityCountGain, 1, "the overshoot test should include normal simulation gain");
    assert.equal(overshootReport.aggregatedInfinityCountGain, 0, "normal gain above the aggregate target should need no extra Infinity");
    assert.equal(aggregationState.infinityCountRateRemainder, 0, "normal gain above the aggregate target must not leave a remainder");

    aggregationState.infinityCount = 1;
    aggregationState.infinityCountRateRemainder = 0.25;
    aggregationState.autoInfinityPointThresholdLog10 = 1;
    const thresholdReport = await aggregationInstance.debug.processOfflineElapsed(10, "test", { clockSource: "server" });
    assert.equal(thresholdReport.aggregatedInfinityCountGain, 0, "non-minimum Infinity thresholds should disable aggregation");
    assert.equal(aggregationState.infinityCount, 1, "disabled aggregation should not add Infinity");
    assert.equal(aggregationState.infinityCountRateRemainder, 0.25, "disabled aggregation should preserve the remainder");

    for (const [field, value, message] of [
      ["automationEnabled", false, "disabled automation"],
      ["autoRunInfinity", false, "disabled Infinity automation"],
      ["activeChallenge", 1, "active Infinity Challenges"],
      ["activeTowerChallenge", 1, "active Tower Challenges"],
    ]) {
      aggregationState.automationEnabled = true;
      aggregationState.autoRunInfinity = true;
      aggregationState.autoInfinityPointThresholdLog10 = 0;
      aggregationState.activeChallenge = 0;
      aggregationState.activeTowerChallenge = 0;
      aggregationState.infinityCount = 1;
      aggregationState.infinityCountRateRemainder = 0.25;
      aggregationState[field] = value;
      const gatedReport = await aggregationInstance.debug.processOfflineElapsed(10, "test", { clockSource: "server" });
      assert.equal(gatedReport.aggregatedInfinityCountGain, 0, `${message} should disable aggregation`);
      assert.equal(aggregationState.infinityCount, 1, `${message} should not add Infinity`);
      assert.equal(aggregationState.infinityCountRateRemainder, 0.25, `${message} should preserve the remainder`);
    }
  } finally {
    aggregationRuntime.update = aggregationOriginalUpdate;
  }

  console.log("Time Flux removal and offline compatibility tests passed");
}

module.exports = { runTimeFluxModuleRuntimeTest };
