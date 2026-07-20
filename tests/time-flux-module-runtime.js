const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

async function runTimeFluxModuleRuntimeTest() {
  const instance = await loadRuntime(candidatePath);
  const { debug, runtime } = instance;
  const { state } = debug;

  assert.equal(state.offlineProgressEnabled, true, "offline progress should default to enabled");
  assert.equal(state.offlineTickCount, 1000, "offline ticks should default to 1000");
  assert.equal(state.showTimeFluxQuickBar, true, "the Time Flux quick bar should default to visible");
  assert.equal(state.timeFlux, 0, "new saves should start without Time Flux");
  assert.equal(state.timeFluxCustomSpeed, 4, "the custom speed should default to x4");
  assert.equal(state.totalRealPlayTime, 0, "new saves should start without real play time");
  assert.equal(state.currentInfinityRealTime, 0, "new Infinity runs should start without real play time");
  assert.equal(state.fastestInfinityRealTime, 0, "new saves should start without a fastest real Infinity time");
  assert.equal(runtime.timeFluxCapacity(), 1800, "initial Time Flux capacity should be 30 minutes");
  assert.equal(runtime.timeFluxGain(), 360, "initial Time Flux gain should be six minutes per hour");
  assert.equal(runtime.timeFluxGainUpgradeCost(), 1800, "the first gain upgrade should cost 30 minutes");
  assert.equal(runtime.timeFluxCapacityUpgradeCost(), 1350, "the first capacity upgrade should cost 22.5 minutes");

  state.timeFlux = 1350;
  assert.equal(debug.buyTimeFluxUpgrade("capacity"), true, "capacity upgrade should spend TF");
  assert.equal(state.timeFluxCapacityLevel, 1, "capacity level should increase");
  assert.equal(runtime.timeFluxCapacity(), 3600, "capacity should double after the first upgrade");
  assert.equal(state.timeFlux, 0, "capacity upgrade should consume its exact cost");

  state.timeFlux = 1800;
  assert.equal(debug.buyTimeFluxUpgrade("gain"), true, "gain upgrade should spend TF");
  assert.equal(state.timeFluxGainLevel, 1, "gain level should increase");
  assert.equal(runtime.timeFluxGain(), 7200 / 11, "gain should use the diminishing formula");
  assert.equal(state.timeFlux, 0, "gain upgrade should consume its exact cost");

  state.totalPlayTime = 0;
  state.totalRealPlayTime = 0;
  state.currentInfinityRunTime = 0;
  state.currentInfinityRealTime = 0;
  state.timeFlux = 10;
  state.timeFluxSpeed = 2;
  const twoXGameSeconds = debug.advanceOnlineTime(3);
  assert.equal(twoXGameSeconds, 6, "x2 should turn three real seconds into six game seconds");
  assert.equal(state.timeFlux, 7, "x2 should consume one TF per real second");
  assert.equal(state.totalPlayTime, 6, "x2 should advance game time by six seconds");
  assert.equal(state.totalRealPlayTime, 3, "x2 should advance real play time by three seconds");
  assert.equal(state.currentInfinityRunTime, 6, "x2 should advance the game-time Infinity timer by six seconds");
  assert.equal(state.currentInfinityRealTime, 3, "x2 should advance the real-time Infinity timer by three seconds");

  state.totalPlayTime = 0;
  state.totalRealPlayTime = 0;
  state.currentInfinityRunTime = 0;
  state.currentInfinityRealTime = 0;
  state.timeFlux = 59;
  state.timeFluxSpeed = 60;
  const sixtyXGameSeconds = debug.advanceOnlineTime(1);
  assert.equal(sixtyXGameSeconds, 60, "custom x60 should process sixty game seconds");
  assert.equal(state.timeFlux, 0, "x60 should consume 59 TF per real second");
  assert.equal(state.timeFluxSpeed, 1, "speed should return to x1 when TF is depleted");
  assert.equal(state.timeFluxCustomSpeed, 4, "depletion should not erase the configured custom speed");

  {
    const batchedInstance = await loadRuntime(candidatePath);
    const { context: batchedContext, debug: batchedDebug, runtime: batchedRuntime } = batchedInstance;
    const batchedState = batchedDebug.state;
    batchedState.automationEnabled = true;
    batchedState.autoRunInfinity = true;
    batchedState.autoInfinityPointThreshold = 1;
    batchedState.autoInfinityPointThresholdLog10 = 0;
    batchedState.infinityCount = 1;
    batchedState.infinityUpgradeMask = (1 << 13) - 1;
    batchedState.achievementMask = -1;
    batchedState.timeFlux = 1800;
    batchedState.timeFluxSpeed = 60;
    const originalCanInfinity = batchedRuntime.canInfinity;
    const originalRunInfinity = batchedRuntime.runInfinity;
    const scoreElement = batchedRuntime.elements.scoreValue;
    const originalScoreTextDescriptor = Object.getOwnPropertyDescriptor(scoreElement, "textContent");
    const originalSetItem = batchedContext.localStorage.setItem;
    let infinityRuns = 0;
    let uiUpdates = 0;
    let saveWrites = 0;
    batchedRuntime.canInfinity = () => true;
    batchedRuntime.runInfinity = (...args) => {
      infinityRuns += 1;
      return originalRunInfinity(...args);
    };
    let scoreText = originalScoreTextDescriptor.value;
    Object.defineProperty(scoreElement, "textContent", {
      configurable: true,
      get: () => scoreText,
      set: (value) => {
        uiUpdates += 1;
        scoreText = value;
      },
    });
    batchedContext.localStorage.setItem = (key, value) => {
      if (key === batchedRuntime.SAVE_KEY) saveWrites += 1;
      return originalSetItem(key, value);
    };
    try {
      const gameSeconds = batchedDebug.advanceOnlineTime(1);
      assert.equal(gameSeconds, 60, "x60 should still simulate sixty game seconds");
      assert.equal(batchedState.timeFlux, 1741, "x60 should still consume 59 TF per real second");
      assert.ok(infinityRuns > 1000, "the simulation should preserve high-frequency auto-Infinity progression");
      assert.equal(uiUpdates, 1, "auto-Infinity UI updates should be flushed once per simulation batch");
      assert.equal(saveWrites, 1, "auto-Infinity saves should be flushed once per simulation batch");
    } finally {
      batchedRuntime.canInfinity = originalCanInfinity;
      batchedRuntime.runInfinity = originalRunInfinity;
      Object.defineProperty(scoreElement, "textContent", originalScoreTextDescriptor);
      batchedContext.localStorage.setItem = originalSetItem;
    }
  }

  assert.equal(runtime.setTimeFluxCustomSpeed(99), 60, "custom speed should clamp to x60");
  assert.equal(state.timeFluxCustomSpeed, 60, "setting a custom speed should remember it separately");
  assert.equal(runtime.setTimeFluxSpeed(2), 2, "preset speed should select x2");
  assert.equal(state.timeFluxCustomSpeed, 60, "preset speed changes should preserve the custom speed");
  assert.equal(runtime.setTimeFluxCustomSpeed(0), 4, "custom speed should clamp to x4");

  runtime.autoSaveElapsed = 0;
  state.timeFlux = 100;
  state.timeFluxSpeed = 2;
  debug.advanceOnlineTime(3);
  assert.ok(Math.abs(runtime.autoSaveElapsed - 3) < 1e-9, "maintenance timers should use real seconds instead of accelerated game seconds");

  state.offlineProgressEnabled = false;
  state.timeFluxGainLevel = 0;
  state.timeFlux = 0;
  state.totalPlayTime = 0;
  state.totalRealPlayTime = 0;
  const fluxReport = debug.processOfflineElapsed(3600, "test");
  assert.equal(state.timeFlux, 360, "disabled offline progress should accumulate six minutes of TF per hour");
  assert.equal(state.totalPlayTime, 0, "TF accumulation mode should pause total play time");
  assert.equal(state.totalRealPlayTime, 0, "TF accumulation mode should not add real play time");
  assert.equal(fluxReport.offlineProgressEnabled, false, "the report should identify TF accumulation mode");
  assert.equal(fluxReport.timeFluxGained, 360, "the report should record actual TF gained");

  state.offlineProgressEnabled = true;
  state.timeFlux = 0;
  state.totalPlayTime = 0;
  state.totalRealPlayTime = 0;
  const originalFrameTime = runtime.currentFrameTime;
  runtime.currentFrameTime = () => 1234;
  const progressReport = debug.processOfflineElapsed(1, "test");
  assert.equal(runtime.lastTime, 1234, "offline resume should reset the frame clock");
  runtime.currentFrameTime = originalFrameTime;
  assert.ok(Math.abs(state.totalPlayTime - 1) < 1e-9, "offline progress should advance total play time");
  assert.equal(state.totalRealPlayTime, 0, "offline progress should not advance real play time");
  assert.equal(state.timeFlux, 0, "offline progress should not also grant TF");
  assert.equal(progressReport.processedTicks, 30, "short offline intervals should use simulation-sized ticks");

  state.offlineProgressEnabled = false;
  state.timeFluxCapacityLevel = 0;
  state.timeFlux = 1800;
  const cappedReport = debug.processOfflineElapsed(3600, "test");
  assert.equal(cappedReport.capacityReached, true, "the report should flag a full TF capacity");
  assert.equal(state.timeFlux, 1800, "TF should never exceed its capacity");

  state.timeFluxCapacityLevel = 10;
  state.timeFlux = 0;
  const trustedCapReport = debug.processOfflineElapsed(8 * 86400, "test", { clockSource: "server" });
  assert.equal(trustedCapReport.capped, true, "offline rewards should be capped at seven trusted days");
  assert.equal(trustedCapReport.effectiveElapsedSeconds, 7 * 86400, "the trusted offline cap should be seven days");
  assert.ok(state.timeFlux > 0, "a capped trusted interval should still grant its allowed reward");

  const timeFluxBeforeClockAnomaly = state.timeFlux;
  const clockAnomalyReport = debug.processOfflineElapsed(3600, "test", {
    clockSource: "server",
    clockAnomaly: true,
  });
  assert.equal(clockAnomalyReport.clockAnomaly, true, "clock anomalies should be recorded in the offline report");
  assert.equal(clockAnomalyReport.rewardSuppressed, true, "clock anomalies should suppress offline rewards");
  assert.equal(state.timeFlux, timeFluxBeforeClockAnomaly, "clock anomalies must not change Time Flux");

  const futureSave = debug.offlineElapsedFromSave(Date.now() + 10 * 60 * 1000, 0);
  assert.equal(futureSave.clockAnomaly, true, "a future local save timestamp should be rejected");

  state.offlineProgressEnabled = true;
  state.timeFlux = 123;
  state.timeFluxCapacityLevel = 2;
  state.timeFluxGainLevel = 3;
  state.totalRealPlayTime = 12.5;
  state.currentInfinityRealTime = 3.5;
  state.fastestInfinityRealTime = 2.5;
  runtime.setTimeFluxCustomSpeed(4);
  state.showTimeFluxQuickBar = false;
  const serialized = runtime.serializeSaveData();
  assert.equal(serialized.state.timeFlux, 123, "Time Flux should be included in local saves");
  assert.equal(serialized.state.timeFluxCapacityLevel, 2, "Time Flux upgrade levels should be saved");
  assert.equal(serialized.state.timeFluxSpeed, 4, "the selected custom speed should be saved");
  assert.equal(serialized.state.timeFluxCustomSpeed, 4, "the configured custom speed should be saved separately");
  assert.equal(serialized.state.showTimeFluxQuickBar, false, "the Time Flux quick bar setting should be saved");
  assert.equal(serialized.state.totalRealPlayTime, 12.5, "real play time should be included in local saves");
  assert.equal(serialized.state.currentInfinityRealTime, 3.5, "current real Infinity time should be saved");
  assert.equal(serialized.state.fastestInfinityRealTime, 2.5, "fastest real Infinity time should be saved");

  runtime.resetBelowInfinity();
  assert.equal(state.timeFlux, 123, "Infinity resets should preserve Time Flux");
  assert.equal(state.timeFluxCapacityLevel, 2, "Infinity resets should preserve TF capacity upgrades");
  assert.equal(state.timeFluxGainLevel, 3, "Infinity resets should preserve TF gain upgrades");

  runtime.applySaveData({}, 10);
  assert.equal(state.offlineProgressEnabled, true, "old saves should default to offline progress");
  assert.equal(state.offlineTickCount, 1000, "old saves should default to 1000 offline ticks");
  assert.equal(state.timeFlux, 0, "old saves should default to zero Time Flux");
  assert.equal(state.timeFluxCustomSpeed, 4, "old saves should default to a x4 custom speed");
  assert.equal(state.showTimeFluxQuickBar, true, "old saves should default to a visible Time Flux quick bar");
  assert.equal(state.totalRealPlayTime, 0, "old saves should default to zero real play time");
  assert.equal(state.currentInfinityRealTime, 0, "old saves should default to zero real Infinity time");
  assert.equal(state.fastestInfinityRealTime, 0, "old saves should default to no fastest real Infinity time");

  runtime.applySaveData({
    lastInfinityRuns: [{ time: 4, scoreLog10: 3, ipGain: 2, challenge: 0 }],
  }, 10);
  assert.equal(state.lastInfinityRuns[0].realTime, null, "legacy Infinity history should show unknown real time");
  runtime.applySaveData({
    lastInfinityRuns: [{ time: 4, realTime: 1.5, scoreLog10: 3, ipGain: 2, challenge: 0 }],
  }, 10);
  assert.equal(state.lastInfinityRuns[0].realTime, 1.5, "new Infinity history should preserve real time");

  runtime.applySaveData({ timeFluxSpeed: 12 }, 10);
  assert.equal(state.timeFluxSpeed, 12, "old saves should preserve their selected speed");
  assert.equal(state.timeFluxCustomSpeed, 12, "old saves should migrate a custom selected speed");
  runtime.applySaveData({ timeFluxSpeed: 2, timeFluxCustomSpeed: 99 }, 10);
  assert.equal(state.timeFluxSpeed, 2, "saved preset speed should remain the active speed");
  assert.equal(state.timeFluxCustomSpeed, 60, "saved custom speed should be clamped independently");
  runtime.applySaveData({}, 10);

  const originalUpdate = runtime.update;
  let offlineUpdateCalls = 0;
  runtime.update = () => {
    offlineUpdateCalls += 1;
  };
  try {
    state.offlineProgressEnabled = true;
    state.offlineTickCount = 1000000;
    const boundedReport = debug.processOfflineElapsed(86400, "test");
    assert.equal(
      offlineUpdateCalls,
      runtime.OFFLINE_PROGRESS_MAX_SIMULATION_TICKS,
      "offline resume should enforce a synchronous tick safety limit",
    );
    assert.equal(boundedReport.precisionReduced, true, "the report should identify reduced offline precision");
  } finally {
    runtime.update = originalUpdate;
  }

  const savedAt = Date.now() - 3600 * 1000;
  const loadedInstance = await loadRuntime(candidatePath, new Map([
    [
      "angle-incremental-save",
      JSON.stringify({
        version: 10,
        savedAt,
        state: { offlineProgressEnabled: false, timeFlux: 0 },
      }),
    ],
  ]));
  assert.ok(
    Math.abs(loadedInstance.debug.state.timeFlux - 360) < 0.1,
    "a saved timestamp should trigger TF accumulation when offline progress is disabled",
  );
  assert.equal(
    loadedInstance.runtime.offlineReport.clockSource,
    "local-fallback",
    "the no-fetch harness should identify local-clock fallback processing",
  );
  assert.match(
    loadedInstance.context.document.getElementById("offlineReportNote").textContent,
    /サーバー時刻を取得できなかった/,
    "local-clock fallback should be visible in the offline report",
  );

  const saveFailureInstance = await loadRuntime(candidatePath);
  const saveFailureDebug = saveFailureInstance.debug;
  const saveFailureRuntime = saveFailureInstance.runtime;
  saveFailureRuntime.setOfflineBaseline(1, 0);
  const originalSetItem = saveFailureInstance.context.localStorage.setItem;
  saveFailureInstance.context.localStorage.setItem = () => {
    throw new Error("storage unavailable");
  };
  try {
    assert.equal(saveFailureDebug.saveGame("manual"), false, "storage failures should report a failed save");
    assert.ok(
      saveFailureRuntime.offlineBaselineTimestamp > 1,
      "a failed save should still rebase the in-memory offline baseline",
    );
  } finally {
    saveFailureInstance.context.localStorage.setItem = originalSetItem;
  }

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
  assert.equal(
    resumeDebug.state.totalPlayTime,
    playTimeBeforeResume,
    "online simulation should pause while visibility resume synchronizes the clock",
  );
  resumeRuntime.saveGame("manual");
  resolveClockRequest({
    ok: true,
    headers: { get: () => new Date().toUTCString() },
  });
  await resumePromise;
  assert.ok(
    resumeRuntime.offlineReport.elapsedSeconds >= 50,
    "visibility resume should retain the interval captured before a pending save rebases the baseline",
  );
  assert.ok(resumeDebug.state.timeFlux > 0, "the retained resume interval should grant Time Flux");

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
  assert.equal(resetResumeDebug.state.totalPlayTime, 0, "reset should not receive stale pending offline progress");
  assert.equal(resetResumeDebug.state.timeFlux, 0, "reset should not receive stale pending Time Flux");
  assert.equal(resetResumeRuntime.offlineReport, null, "reset should clear the pending offline report");
}

module.exports = { runTimeFluxModuleRuntimeTest };
