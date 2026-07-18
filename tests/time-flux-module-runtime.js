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
  state.timeFlux = 10;
  state.timeFluxSpeed = 2;
  const twoXGameSeconds = debug.advanceOnlineTime(3);
  assert.equal(twoXGameSeconds, 6, "x2 should turn three real seconds into six game seconds");
  assert.equal(state.timeFlux, 7, "x2 should consume one TF per real second");

  state.totalPlayTime = 0;
  state.timeFlux = 59;
  state.timeFluxSpeed = 60;
  const sixtyXGameSeconds = debug.advanceOnlineTime(1);
  assert.equal(sixtyXGameSeconds, 60, "custom x60 should process sixty game seconds");
  assert.equal(state.timeFlux, 0, "x60 should consume 59 TF per real second");
  assert.equal(state.timeFluxSpeed, 1, "speed should return to x1 when TF is depleted");

  assert.equal(runtime.setTimeFluxSpeed(99), 60, "custom speed should clamp to x60");
  assert.equal(runtime.setTimeFluxSpeed(0), 1, "custom speed should clamp to x1");

  runtime.autoSaveElapsed = 0;
  state.timeFlux = 100;
  state.timeFluxSpeed = 2;
  debug.advanceOnlineTime(3);
  assert.ok(Math.abs(runtime.autoSaveElapsed - 3) < 1e-9, "maintenance timers should use real seconds instead of accelerated game seconds");

  state.offlineProgressEnabled = false;
  state.timeFluxGainLevel = 0;
  state.timeFlux = 0;
  state.totalPlayTime = 0;
  const fluxReport = debug.processOfflineElapsed(3600, "test");
  assert.equal(state.timeFlux, 360, "disabled offline progress should accumulate six minutes of TF per hour");
  assert.equal(state.totalPlayTime, 0, "TF accumulation mode should pause total play time");
  assert.equal(fluxReport.offlineProgressEnabled, false, "the report should identify TF accumulation mode");
  assert.equal(fluxReport.timeFluxGained, 360, "the report should record actual TF gained");

  state.offlineProgressEnabled = true;
  state.timeFlux = 0;
  state.totalPlayTime = 0;
  const originalFrameTime = runtime.currentFrameTime;
  runtime.currentFrameTime = () => 1234;
  const progressReport = debug.processOfflineElapsed(1, "test");
  assert.equal(runtime.lastTime, 1234, "offline resume should reset the frame clock");
  runtime.currentFrameTime = originalFrameTime;
  assert.ok(Math.abs(state.totalPlayTime - 1) < 1e-9, "offline progress should advance total play time");
  assert.equal(state.timeFlux, 0, "offline progress should not also grant TF");
  assert.equal(progressReport.processedTicks, 30, "short offline intervals should use simulation-sized ticks");

  state.offlineProgressEnabled = false;
  state.timeFluxCapacityLevel = 0;
  state.timeFlux = 1800;
  const cappedReport = debug.processOfflineElapsed(3600, "test");
  assert.equal(cappedReport.capacityReached, true, "the report should flag a full TF capacity");
  assert.equal(state.timeFlux, 1800, "TF should never exceed its capacity");

  state.offlineProgressEnabled = true;
  state.timeFlux = 123;
  state.timeFluxCapacityLevel = 2;
  state.timeFluxGainLevel = 3;
  state.timeFluxSpeed = 4;
  state.showTimeFluxQuickBar = false;
  const serialized = runtime.serializeSaveData();
  assert.equal(serialized.state.timeFlux, 123, "Time Flux should be included in local saves");
  assert.equal(serialized.state.timeFluxCapacityLevel, 2, "Time Flux upgrade levels should be saved");
  assert.equal(serialized.state.timeFluxSpeed, 4, "the selected custom speed should be saved");
  assert.equal(serialized.state.showTimeFluxQuickBar, false, "the Time Flux quick bar setting should be saved");

  runtime.resetBelowInfinity();
  assert.equal(state.timeFlux, 123, "Infinity resets should preserve Time Flux");
  assert.equal(state.timeFluxCapacityLevel, 2, "Infinity resets should preserve TF capacity upgrades");
  assert.equal(state.timeFluxGainLevel, 3, "Infinity resets should preserve TF gain upgrades");

  runtime.applySaveData({}, 10);
  assert.equal(state.offlineProgressEnabled, true, "old saves should default to offline progress");
  assert.equal(state.offlineTickCount, 1000, "old saves should default to 1000 offline ticks");
  assert.equal(state.timeFlux, 0, "old saves should default to zero Time Flux");
  assert.equal(state.showTimeFluxQuickBar, true, "old saves should default to a visible Time Flux quick bar");

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
}

module.exports = { runTimeFluxModuleRuntimeTest };
