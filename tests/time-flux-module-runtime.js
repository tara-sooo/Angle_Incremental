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

  {
    const achievementInstance = await loadRuntime(candidatePath);
    const { debug: achievementDebug, runtime: achievementRuntime } = achievementInstance;
    const achievementState = achievementDebug.state;
    const originalUpdate = achievementRuntime.update;
    achievementState.achievementMask = 0;
    achievementState.generationCount = 0;
    achievementState.generationScore = Number.MAX_VALUE;
    achievementState.generationScoreLog10 = 1e6;
    achievementRuntime.update = () => {
      achievementRuntime.runGeneration();
      achievementState.score = 1e25;
      achievementState.scoreLog10 = 25;
      achievementRuntime.runCoreBoost();
    };
    try {
      achievementDebug.advanceOnlineTime(1);
      assert.equal(
        achievementState.achievementMask & (1 << 1),
        1 << 1,
        "Generation achievement should unlock before a batched Core Boost reset",
      );
      assert.equal(
        achievementState.achievementMask & (1 << 2),
        1 << 2,
        "Generation multiplier achievement should unlock before a batched Core Boost reset",
      );
    } finally {
      achievementRuntime.update = originalUpdate;
    }
  }

  {
    const autobuyGenerationInstance = await loadRuntime(candidatePath);
    const { debug: autobuyGenerationDebug, runtime: autobuyGenerationRuntime } = autobuyGenerationInstance;
    const autobuyGenerationState = autobuyGenerationDebug.state;
    const originalUpdate = autobuyGenerationRuntime.update;
    const normalAutobuyUpgrade = autobuyGenerationRuntime.INFINITY_UPGRADES.find((upgrade) => upgrade.id === "1-2");
    autobuyGenerationState.infinityUpgradeMask = 1 << normalAutobuyUpgrade.bit;
    autobuyGenerationState.automationEnabled = true;
    autobuyGenerationState.achievementMask = 0;
    autobuyGenerationState.generationCount = 0;
    autobuyGenerationState.score = Number.MAX_VALUE;
    autobuyGenerationState.scoreLog10 = 1000;
    autobuyGenerationState.totalScore = Number.MAX_VALUE;
    autobuyGenerationState.totalScoreLog10 = 1000;
    autobuyGenerationState.generationScore = Number.MAX_VALUE;
    autobuyGenerationState.generationScoreLog10 = 1000;
    autobuyGenerationRuntime.update = () => {
      autobuyGenerationRuntime.runAutobuyers();
      autobuyGenerationRuntime.runGeneration();
    };
    try {
      autobuyGenerationDebug.advanceOnlineTime(1);
      for (const [id, label] of [[1, "vertex"], [5, "lap speed"], [6, "vertex count"]]) {
        const bit = 1 << (id - 1);
        assert.equal(
          autobuyGenerationState.achievementMask & bit,
          bit,
          `${label} achievement should survive an autobuy-plus-Generation reset`,
        );
      }
    } finally {
      autobuyGenerationRuntime.update = originalUpdate;
    }
  }

  {
    const transientAchievementInstance = await loadRuntime(candidatePath);
    const { debug: transientAchievementDebug, runtime: transientAchievementRuntime } = transientAchievementInstance;
    const transientAchievementState = transientAchievementDebug.state;
    const originalUpdate = transientAchievementRuntime.update;
    transientAchievementState.achievementMask = 0;
    transientAchievementState.generationCount = 0;
    transientAchievementState.speedLevel = 32;
    transientAchievementState.generationScore = 1e7;
    transientAchievementState.generationScoreLog10 = 7;
    assert.ok(
      transientAchievementRuntime.lapSpeedMultiplier() < 100,
      "the pre-Generation lap speed should remain below the achievement threshold",
    );
    transientAchievementRuntime.update = () => transientAchievementRuntime.runGeneration();
    try {
      transientAchievementDebug.advanceOnlineTime(1);
      assert.equal(
        transientAchievementState.achievementMask & (1 << 4),
        0,
        "lap speed achievement should not use the post-Generation softcap",
      );
      assert.equal(
        transientAchievementState.achievementMask & (1 << 1),
        1 << 1,
        "Generation achievement should still unlock after the reset",
      );
    } finally {
      transientAchievementRuntime.update = originalUpdate;
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
  const trustedLongReport = debug.processOfflineElapsed(8 * 86400, "test", { clockSource: "server" });
  assert.equal(trustedLongReport.capped, false, "server-clock offline rewards should not be capped at seven days");
  assert.equal(trustedLongReport.effectiveElapsedSeconds, 8 * 86400, "trusted offline time should be processed in full");
  assert.equal(trustedLongReport.timeFluxGained, 8 * 24 * 360, "trusted long intervals should grant the full TF reward");

  state.timeFlux = 0;
  const localCapReport = debug.processOfflineElapsed(8 * 86400, "test", { clockSource: "local-fallback" });
  assert.equal(localCapReport.capped, true, "local-clock fallback rewards should remain capped at seven days");
  assert.equal(localCapReport.effectiveElapsedSeconds, 7 * 86400, "local-clock fallback rewards should use the seven-day cap");

  state.timeFlux = 0;
  const legacyLocalCapReport = debug.processOfflineElapsed(8 * 86400, "test", {
    clockSource: "legacy-local",
    legacyTimestampUsed: true,
  });
  assert.equal(legacyLocalCapReport.capped, true, "legacy local timestamps should remain capped at seven days");
  assert.equal(legacyLocalCapReport.effectiveElapsedSeconds, 7 * 86400, "legacy local timestamps should use the seven-day cap");

  const originalOfflineUpdate = runtime.update;
  let longOfflineUpdateCalls = 0;
  runtime.update = () => {
    longOfflineUpdateCalls += 1;
  };
  try {
    state.offlineProgressEnabled = true;
    state.offlineTickCount = runtime.OFFLINE_PROGRESS_MIN_TICKS;
    const longProgressSeconds = runtime.OFFLINE_PROGRESS_MIN_TICKS
      * runtime.OFFLINE_PROGRESS_APPROXIMATION_THRESHOLD_SECONDS_PER_TICK + 1;
    const longProgressReport = debug.processOfflineElapsed(longProgressSeconds, "test", { clockSource: "server" });
    assert.equal(longProgressReport.capped, false, "long trusted offline progress should not be capped");
    assert.equal(longProgressReport.simulatedSeconds, longProgressSeconds, "long trusted offline progress should use all elapsed time");
    assert.equal(longProgressReport.requestedTicks, runtime.OFFLINE_PROGRESS_MIN_TICKS, "long intervals should respect the configured tick count");
    assert.equal(longOfflineUpdateCalls, runtime.OFFLINE_PROGRESS_MIN_TICKS, "long intervals should be distributed across configured ticks");
  } finally {
    runtime.update = originalOfflineUpdate;
  }

  const extremeServerInstance = await loadRuntime(candidatePath);
  const extremeServerDebug = extremeServerInstance.debug;
  const extremeServerRuntime = extremeServerInstance.runtime;
  extremeServerInstance.context.window.fetch = async () => ({
    ok: true,
    headers: { get: () => new Date().toUTCString() },
  });
  await extremeServerRuntime.syncServerClock();
  const ancientServerSavedAt = Date.now() - 1e12;
  const extremeServerElapsed = extremeServerRuntime.offlineElapsedFromSave(
    Date.now(),
    ancientServerSavedAt,
  );
  assert.equal(extremeServerElapsed.clockSource, "server", "an available server clock should be used for ancient saves");
  assert.ok(extremeServerElapsed.elapsedSeconds > 1e8, "the trusted server interval should remain unlimited");
  extremeServerDebug.state.offlineProgressEnabled = true;
  extremeServerRuntime.state.offlineTickCount = extremeServerRuntime.OFFLINE_PROGRESS_MAX_SIMULATION_TICKS;
  const originalExtremeServerUpdate = extremeServerRuntime.update;
  let extremeServerUpdateCalls = 0;
  extremeServerRuntime.update = () => {
    extremeServerUpdateCalls += 1;
  };
  try {
    const extremeServerReport = extremeServerDebug.processOfflineElapsed(
      extremeServerElapsed.elapsedSeconds,
      "test",
      extremeServerElapsed,
    );
    assert.equal(extremeServerReport.capped, false, "ancient trusted server intervals should not use a duration cap");
    assert.equal(
      extremeServerReport.effectiveElapsedSeconds,
      extremeServerElapsed.elapsedSeconds,
      "ancient trusted server intervals should retain their full duration",
    );
    assert.ok(
      extremeServerReport.processedTicks <= extremeServerRuntime.OFFLINE_PROGRESS_MAX_SIMULATION_TICKS,
      "ancient trusted server intervals should use bounded processing",
    );
    assert.equal(
      extremeServerUpdateCalls,
      extremeServerReport.processedTicks,
      "bounded offline processing should not expand with the interval duration",
    );
  } finally {
    extremeServerRuntime.update = originalExtremeServerUpdate;
  }

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

  state.timeFlux = 123;
  const invalidElapsedReport = debug.processOfflineElapsed(Infinity, "test", { clockSource: "server" });
  assert.equal(invalidElapsedReport.clockAnomaly, true, "non-finite offline intervals should be treated as clock anomalies");
  assert.equal(invalidElapsedReport.rewardSuppressed, true, "non-finite offline intervals should suppress rewards");
  assert.equal(state.timeFlux, 123, "non-finite offline intervals must not change Time Flux");

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

  runtime.applySaveData({ timeFluxCapacityLevel: 60, timeFlux: 1500000 }, 10);
  assert.equal(state.timeFluxCapacityLevel, 60, "existing TF capacity levels should remain unchanged");
  assert.equal(state.timeFlux, 1500000, "existing TF balances should remain unchanged when below the legacy capacity");

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

  const visibilityExceptionInstance = await loadRuntime(candidatePath);
  const visibilityExceptionDebug = visibilityExceptionInstance.debug;
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
  assert.deepEqual(
    visibilityExceptionRuntime.snapshotRuntimeState(),
    visibilityExceptionState,
    "a visibility resume exception should restore the complete game state",
  );
  assert.equal(
    visibilityExceptionRuntime.normalAutobuyElapsed,
    visibilityExceptionNormalAutobuyElapsed,
    "a visibility resume exception should restore the normal autobuy timer",
  );
  assert.equal(
    visibilityExceptionRuntime.offlineBaselineTimestamp,
    visibilityExceptionBaseline,
    "a visibility resume exception should restore the local baseline",
  );
  assert.equal(
    visibilityExceptionRuntime.offlineReport,
    previousVisibilityExceptionReport,
    "a visibility resume exception should restore the previous report",
  );
  assert.equal(visibilityExceptionRuntime.offlineProcessing, false, "offline processing should always be cleared");
  assert.equal(visibilityExceptionRuntime.autoSaveElapsed, 0, "recovery should consume the autosave timer");
  assert.equal(visibilityExceptionRuntime.lastTime, visibilityExceptionLastTime, "resume rollback should restore frame timing");
  assert.equal(visibilityExceptionRuntime.loadRecoveryMode, true, "a visibility resume exception should enter recovery mode");

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
    assert.equal(
      visibilitySaveFailureRuntime.saveGame("manual"),
      true,
      "a save during clock synchronization should succeed before the resume save fails",
    );
    const pendingResumeSave = JSON.parse(
      visibilitySaveFailureInstance.context.localStorage.getItem(visibilitySaveFailureRuntime.SAVE_KEY),
    );
    assert.ok(
      pendingResumeSave.savedAt > visibilitySaveFailureBaseline,
      "the pending resume save should advance the persisted timestamp",
    );
    visibilitySaveFailureInstance.context.localStorage.setItem = (key, value) => {
      if (key === visibilitySaveFailureRuntime.SAVE_KEY) throw new Error("save storage unavailable");
      return visibilitySaveFailureOriginalSetItem(key, value);
    };
    resolveVisibilitySaveFailureClockRequest({
      ok: true,
      headers: { get: () => new Date().toUTCString() },
    });
    await visibilitySaveFailurePromise;
    assert.equal(
      visibilitySaveFailureDebug.state.timeFlux,
      0,
      "a failed visibility save should roll back offline rewards",
    );
    assert.equal(
      visibilitySaveFailureRuntime.offlineReport,
      null,
      "a failed visibility save should clear the offline report",
    );
    assert.equal(
      visibilitySaveFailureRuntime.offlineBaselineTimestamp,
      visibilitySaveFailureBaseline,
      "a failed visibility save should restore the previous offline baseline",
    );
    assert.equal(
      visibilitySaveFailureRuntime.loadRecoveryMode,
      true,
      "a failed visibility save should require save recovery",
    );
    assert.equal(
      JSON.parse(visibilitySaveFailureInstance.context.localStorage.getItem(visibilitySaveFailureRuntime.SAVE_LOAD_FAILURE_KEY))
        .offlineRetrySavedAt,
      visibilitySaveFailureBaseline,
      "save recovery should preserve the visibility interval baseline for retry",
    );
    visibilitySaveFailureInstance.context.localStorage.setItem = visibilitySaveFailureOriginalSetItem;
    visibilitySaveFailureInstance.context.localStorage.removeItem = (key) => {
      if (key === visibilitySaveFailureRuntime.SAVE_LOAD_FAILURE_KEY) {
        throw new Error("recovery diagnostic removal unavailable");
      }
      return visibilitySaveFailureOriginalRemoveItem(key);
    };
    assert.equal(
      visibilitySaveFailureDebug.retryLoad(),
      true,
      "retry should apply the captured visibility interval after the save failure",
    );
    assert.ok(
      visibilitySaveFailureDebug.state.timeFlux > 0,
      "retry should restore the offline reward from the captured visibility interval",
    );
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
      assert.equal(
        visibilitySaveFailureDebug.loadGame(),
        true,
        "a successful recovery should remain loadable when its diagnostic cannot be removed",
      );
    } finally {
      visibilitySaveFailureRuntime.processOfflineElapsed = originalProcessOfflineElapsed;
    }
    assert.ok(
      !reloadRetryBaseline || reloadRetryBaseline.savedAt === recoveredSave.savedAt,
      "a stale retry baseline must not be reused after a successful recovery",
    );
  } finally {
    visibilitySaveFailureInstance.context.localStorage.setItem = visibilitySaveFailureOriginalSetItem;
    visibilitySaveFailureInstance.context.localStorage.removeItem = visibilitySaveFailureOriginalRemoveItem;
  }

  const concurrentSaveInstance = await loadRuntime(candidatePath);
  const concurrentSaveDebug = concurrentSaveInstance.debug;
  const concurrentSaveRuntime = concurrentSaveInstance.runtime;
  concurrentSaveDebug.state.offlineProgressEnabled = false;
  concurrentSaveDebug.state.timeFlux = 0;
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
    assert.equal(
      concurrentSaveRuntime.loadRecoveryMode,
      false,
      "a concurrent save replacement should reload without entering recovery",
    );
    assert.equal(
      concurrentSaveDebug.state.totalPlayTime,
      replacementSave.state.totalPlayTime,
      "a concurrent save replacement should preserve the newer tab's state",
    );
    assert.equal(
      concurrentSaveDebug.state.timeFlux >= replacementSave.state.timeFlux,
      true,
      "a concurrent save replacement should not restore the old tab's Time Flux",
    );
    const persistedAfterConcurrentResume = JSON.parse(
      concurrentSaveInstance.context.localStorage.getItem(concurrentSaveRuntime.SAVE_KEY),
    );
    assert.equal(
      persistedAfterConcurrentResume.state.totalPlayTime,
      replacementSave.state.totalPlayTime,
      "the old tab must not overwrite a concurrent save replacement",
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
  automationRollbackDebug.state.offlineProgressEnabled = true;
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
    assert.equal(
      automationRollbackRuntime.normalAutobuyElapsed,
      normalAutobuyElapsedBeforeFailure,
      "a failed offline save should roll back the normal autobuy timer",
    );
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
  assert.equal(resetResumeDebug.state.totalPlayTime, 0, "reset should not receive stale pending offline progress");
  assert.equal(resetResumeDebug.state.timeFlux, 0, "reset should not receive stale pending Time Flux");
  assert.equal(resetResumeRuntime.offlineReport, null, "reset should clear the pending offline report");
}

module.exports = { runTimeFluxModuleRuntimeTest };
