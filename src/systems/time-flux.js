import { runtime, expose } from "../runtime/shared.js";

// Time Flux is a persistent online accelerator. Offline progress and TF
// accumulation are mutually exclusive by design.

function clampOfflineTickCount(value) {
  return Math.min(
    runtime.OFFLINE_PROGRESS_MAX_TICKS,
    Math.max(runtime.OFFLINE_PROGRESS_MIN_TICKS, Math.floor(runtime.sanitizeNumber(
      value,
      runtime.OFFLINE_PROGRESS_DEFAULT_TICKS,
    ))),
  );
}

function clampTimeFluxSpeed(value) {
  return Math.min(
    runtime.TIME_FLUX_MAX_SPEED,
    Math.max(runtime.TIME_FLUX_MIN_SPEED, Math.floor(runtime.sanitizeNumber(value, 1))),
  );
}

function clampTimeFluxCustomSpeed(value) {
  return Math.max(runtime.TIME_FLUX_CUSTOM_SPEED_MIN, clampTimeFluxSpeed(value));
}

function clampTimeFluxCapacityLevel(value) {
  return Math.min(
    runtime.TIME_FLUX_MAX_CAPACITY_LEVEL,
    Math.max(0, Math.floor(runtime.sanitizeNumber(value, 0))),
  );
}

function timeFluxCapacitySeconds(level = runtime.state.timeFluxCapacityLevel) {
  return runtime.TIME_FLUX_CAPACITY_SECONDS_BY_LEVEL[clampTimeFluxCapacityLevel(level)];
}

function timeFluxGainPerHour(level = runtime.state.timeFluxGainLevel) {
  const safeLevel = Math.max(0, Math.floor(runtime.sanitizeNumber(level, 0)));
  return 3600 * (safeLevel + 1) / (safeLevel + 10);
}

function timeFluxGainUpgradeCost(level = runtime.state.timeFluxGainLevel) {
  const safeLevel = Math.max(0, Math.floor(runtime.sanitizeNumber(level, 0)));
  const cost = runtime.TIME_FLUX_GAIN_COST_BASE_SECONDS * (runtime.TIME_FLUX_GAIN_COST_GROWTH ** safeLevel);
  return Number.isFinite(cost) ? cost : Infinity;
}

function timeFluxCapacityUpgradeCost(level = runtime.state.timeFluxCapacityLevel) {
  const safeLevel = clampTimeFluxCapacityLevel(level);
  if (safeLevel >= runtime.TIME_FLUX_MAX_CAPACITY_LEVEL) return Infinity;
  return timeFluxCapacitySeconds(safeLevel) * runtime.TIME_FLUX_CAPACITY_COST_FACTOR;
}

function timeFluxUpgradeCost(kind) {
  if (kind === "gain") return timeFluxGainUpgradeCost();
  if (kind === "capacity") return timeFluxCapacityUpgradeCost();
  return Infinity;
}

function timeFluxCapacity() {
  return timeFluxCapacitySeconds();
}

function timeFluxGain() {
  return timeFluxGainPerHour();
}

function canBuyTimeFluxUpgrade(kind) {
  if (kind === "capacity" && clampTimeFluxCapacityLevel(runtime.state.timeFluxCapacityLevel)
    >= runtime.TIME_FLUX_MAX_CAPACITY_LEVEL) return false;
  const cost = timeFluxUpgradeCost(kind);
  if (!Number.isFinite(cost) || cost <= 0 || runtime.state.timeFlux < cost) return false;
  return kind === "gain" || kind === "capacity";
}

function buyTimeFluxUpgrade(kind) {
  if (!canBuyTimeFluxUpgrade(kind)) return false;
  const cost = timeFluxUpgradeCost(kind);
  runtime.state.timeFlux = Math.max(0, runtime.state.timeFlux - cost);
  if (kind === "gain") runtime.state.timeFluxGainLevel += 1;
  else runtime.state.timeFluxCapacityLevel += 1;
  runtime.state.timeFlux = Math.min(runtime.state.timeFlux, timeFluxCapacitySeconds());
  runtime.updateUi();
  runtime.saveGame("manual");
  return true;
}

function setTimeFluxSpeed(value) {
  runtime.state.timeFluxSpeed = clampTimeFluxSpeed(value);
  runtime.updateUi();
  runtime.saveGame("manual");
  return runtime.state.timeFluxSpeed;
}

function setTimeFluxCustomSpeed(value) {
  const speed = clampTimeFluxCustomSpeed(value);
  runtime.state.timeFluxCustomSpeed = speed;
  runtime.state.timeFluxSpeed = speed;
  runtime.updateUi();
  runtime.saveGame("manual");
  return speed;
}

function addTimeFlux(seconds) {
  const amount = Math.max(0, runtime.sanitizeNumber(seconds, 0));
  const before = runtime.state.timeFlux;
  runtime.state.timeFlux = Math.min(timeFluxCapacitySeconds(), before + amount);
  return runtime.state.timeFlux - before;
}

function consumeTimeFlux(seconds) {
  const amount = Math.max(0, runtime.sanitizeNumber(seconds, 0));
  const consumed = Math.min(runtime.state.timeFlux, amount);
  runtime.state.timeFlux -= consumed;
  return consumed;
}

expose("clampOfflineTickCount", () => clampOfflineTickCount, (value) => { clampOfflineTickCount = value; });
expose("clampTimeFluxSpeed", () => clampTimeFluxSpeed, (value) => { clampTimeFluxSpeed = value; });
expose("clampTimeFluxCustomSpeed", () => clampTimeFluxCustomSpeed, (value) => { clampTimeFluxCustomSpeed = value; });
expose("clampTimeFluxCapacityLevel", () => clampTimeFluxCapacityLevel, (value) => { clampTimeFluxCapacityLevel = value; });
expose("timeFluxCapacitySeconds", () => timeFluxCapacitySeconds, (value) => { timeFluxCapacitySeconds = value; });
expose("timeFluxGainPerHour", () => timeFluxGainPerHour, (value) => { timeFluxGainPerHour = value; });
expose("timeFluxGainUpgradeCost", () => timeFluxGainUpgradeCost, (value) => { timeFluxGainUpgradeCost = value; });
expose("timeFluxCapacityUpgradeCost", () => timeFluxCapacityUpgradeCost, (value) => { timeFluxCapacityUpgradeCost = value; });
expose("timeFluxUpgradeCost", () => timeFluxUpgradeCost, (value) => { timeFluxUpgradeCost = value; });
expose("timeFluxCapacity", () => timeFluxCapacity, (value) => { timeFluxCapacity = value; });
expose("timeFluxGain", () => timeFluxGain, (value) => { timeFluxGain = value; });
expose("canBuyTimeFluxUpgrade", () => canBuyTimeFluxUpgrade, (value) => { canBuyTimeFluxUpgrade = value; });
expose("buyTimeFluxUpgrade", () => buyTimeFluxUpgrade, (value) => { buyTimeFluxUpgrade = value; });
expose("setTimeFluxSpeed", () => setTimeFluxSpeed, (value) => { setTimeFluxSpeed = value; });
expose("setTimeFluxCustomSpeed", () => setTimeFluxCustomSpeed, (value) => { setTimeFluxCustomSpeed = value; });
expose("addTimeFlux", () => addTimeFlux, (value) => { addTimeFlux = value; });
expose("consumeTimeFlux", () => consumeTimeFlux, (value) => { consumeTimeFlux = value; });
