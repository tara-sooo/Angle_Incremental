import { runtime, expose } from "../runtime/shared.js";

// Extracted mechanically from the next-runtime baseline.
// State-dependent progression and UI formatting remain outside this helper module.

function parseSavedNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  const trimmed = value.trim();
  if (!trimmed) return NaN;
  if (trimmed === "Infinity") return Infinity;
  if (trimmed === "-Infinity") return -Infinity;
  return Number(trimmed);
}

function sanitizeNumber(value, fallback, min = 0) {
  const parsed = parseSavedNumber(value);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

function sanitizeLog10(value, fallback = -Infinity) {
  const parsed = parseSavedNumber(value);
  if (parsed === -Infinity) return -Infinity;
  if (parsed === Infinity) return runtime.MAX_TRACKED_LOG10;
  return Number.isFinite(parsed) ? Math.min(parsed, runtime.MAX_TRACKED_LOG10) : fallback;
}

function clampLog10(value) {
  if (value === -Infinity) return -Infinity;
  if (!Number.isFinite(value)) return value === Infinity ? runtime.MAX_TRACKED_LOG10 : -Infinity;
  return Math.min(value, runtime.MAX_TRACKED_LOG10);
}

function logFromSavedValue(value, fallback = -Infinity) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const match = trimmed.match(/^([+-]?(?:\d+\.?\d*|\.\d+))(?:e|\*10\^)([+-]?\d+)$/i);
    if (match) {
      const mantissa = Number(match[1]);
      const exponent = Number(match[2]);
      if (mantissa > 0 && Number.isFinite(exponent)) {
        return clampLog10(Math.log10(mantissa) + exponent);
      }
    }
  }
  const parsed = parseSavedNumber(value);
  if (parsed === Infinity || parsed === Number.MAX_VALUE) return Math.log10(Number.MAX_VALUE);
  const log = log10Value(parsed);
  return log > -Infinity ? log : fallback;
}

function hydrateLog10(savedLog, savedValue, fallback = -Infinity) {
  const log = sanitizeLog10(savedLog, null);
  return log === null ? logFromSavedValue(savedValue, fallback) : log;
}

function hydrateLogResource(savedValue, savedLog, fallbackLog = -Infinity, integer = false) {
  const log = hydrateLog10(savedLog, savedValue, fallbackLog);
  let value = valueFromLog10(log);
  if (integer && value !== Number.MAX_VALUE) value = Math.floor(value);
  return { value, log };
}

function sanitizeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeInfinityRunRecords(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).map((record) => ({
    time: sanitizeNumber(record && record.time, 0),
    scoreLog10: sanitizeLog10(record && record.scoreLog10, -Infinity),
    ipGain: Math.max(0, Math.floor(sanitizeNumber(record && record.ipGain, 0))),
    challenge: Math.max(0, Math.floor(sanitizeNumber(record && record.challenge, 0))),
  }));
}

function valueFromLog10(log) {
  log = clampLog10(log);
  if (log === -Infinity) return 0;
  return Number.isFinite(log) && log <= 308 ? 10 ** log : Number.MAX_VALUE;
}

function subtractLog10(currentLog, amountLog) {
  if (currentLog === -Infinity || amountLog === -Infinity) return currentLog;
  if (currentLog === Infinity) return runtime.MAX_TRACKED_LOG10;
  if (amountLog > currentLog) return currentLog;
  if (currentLog - amountLog > 15) return currentLog;
  const remainingFactor = 1 - 10 ** (amountLog - currentLog);
  return remainingFactor <= 0 ? -Infinity : currentLog + Math.log10(remainingFactor);
}



function log10Value(value) {
  if (value === Infinity) return Infinity;
  return value > 0 && Number.isFinite(value) ? Math.log10(value) : -Infinity;
}

function combineLog10(a, b) {
  if (a === -Infinity) return b;
  if (b === -Infinity) return a;
  if (a === Infinity || b === Infinity) return runtime.MAX_TRACKED_LOG10;
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  if (high - low > 15) return high;
  return clampLog10(high + Math.log10(1 + 10 ** (low - high)));
}

// Mechanically appended from src/main.js during the parity-preserving migration.

function formatNumber(value) {
  if (value === Infinity) return formatLogNumber(Infinity);
  if (!Number.isFinite(value)) return "0";
  if (value < 1000) return value.toFixed(value < 10 ? 2 : 0).replace(/\.00$/, "");
  if (value < 1000000) return Math.round(value).toLocaleString("en-US");
  if (value >= 1e18) return value.toExponential(2).replace("e+", "e");
  const units = ["M", "B", "T", "Qa", "Qi", "Sx"];
  let scaled = value / 1000000;
  let unitIndex = 0;
  while (scaled >= 1000 && unitIndex < units.length - 1) {
    scaled /= 1000;
    unitIndex += 1;
  }
  return `${scaled.toFixed(scaled >= 100 ? 1 : 2)}${units[unitIndex]}`;
}

function formatUiNumber(value) {
  if (runtime.state.numberFormat === "compact" || value <= 0 || !Number.isFinite(value)) return formatNumber(value);
  const valueLog = log10Value(value);
  if (runtime.state.numberFormat === "scientific") return formatScientificLog(valueLog);
  if (runtime.state.numberFormat === "detailed" && valueLog < 3) return formatNumber(value);
  return formatLogNumber(valueLog);
}

function formatUiLogNumber(log10Value) {
  if (log10Value === -Infinity) return "0";
  if (!Number.isFinite(log10Value)) return formatLogNumber(log10Value);
  if (log10Value < 18) return formatUiNumber(10 ** log10Value);
  return formatLogNumber(log10Value);
}

function formatLogNumber(log10Value, capSuffix = false) {
  log10Value = clampLog10(log10Value);
  if (log10Value === -Infinity) return "0";
  if (log10Value < 18) return formatNumber(10 ** log10Value);
  const exponent = Math.floor(log10Value);
  const mantissa = 10 ** (log10Value - exponent);
  const suffix = capSuffix ? runtime.t("capSuffix") : "";
  return `${mantissa.toFixed(2)}e${exponent.toLocaleString("en-US")}${suffix}`;
}

function formatScientificLog(log10Value) {
  if (!Number.isFinite(log10Value)) return log10Value === -Infinity ? "0" : "∞";
  if (log10Value < 3) return formatNumber(10 ** log10Value);
  const exponent = Math.floor(log10Value);
  const mantissa = 10 ** (log10Value - exponent);
  return `${mantissa.toFixed(2)}e${exponent.toLocaleString("en-US")}`;
}

function formatPowerOfTen(log10Value) {
  return formatLogNumber(log10Value);
}

function formatSmallDecimal(value) {
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function formatDuration(seconds) {
  if (runtime.state.timeUnit === "seconds") return `${seconds.toFixed(2)}${runtime.t("secondsUnit")}`;
  if (runtime.state.timeUnit === "milliseconds") {
    const milliseconds = seconds * 1000;
    return `${milliseconds >= 10 ? Math.round(milliseconds) : milliseconds.toFixed(2)}${runtime.t("millisecondsUnit")}`;
  }
  if (seconds >= 1) return `${seconds.toFixed(2)}${runtime.t("secondsUnit")}`;
  if (seconds >= 0.01) return `${Math.round(seconds * 1000)}${runtime.t("millisecondsUnit")}`;
  return runtime.t("under10ms");
}

function formatLongDuration(seconds) {
  if (runtime.state.timeUnit === "milliseconds") {
    const milliseconds = Math.max(0, sanitizeNumber(seconds, 0) * 1000);
    return `${milliseconds >= 10 ? Math.round(milliseconds) : milliseconds.toFixed(2)}${runtime.t("millisecondsUnit")}`;
  }
  const totalSeconds = Math.max(0, Math.floor(sanitizeNumber(seconds, 0)));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const units = [
    { value: days, label: runtime.state.language === "en" ? "d" : "日" },
    { value: hours, label: runtime.state.language === "en" ? "h" : "時間" },
    { value: minutes, label: runtime.state.language === "en" ? "m" : "分" },
    { value: secs, label: runtime.state.language === "en" ? "s" : "秒" },
  ];
  const firstNonZero = units.findIndex((unit) => unit.value > 0);
  return units
    .slice(firstNonZero === -1 ? units.length - 1 : firstNonZero)
    .map((unit) => `${unit.value}${unit.label}`)
    .join("");
}
expose("parseSavedNumber", () => parseSavedNumber, (value) => { parseSavedNumber = value; });
expose("sanitizeNumber", () => sanitizeNumber, (value) => { sanitizeNumber = value; });
expose("sanitizeLog10", () => sanitizeLog10, (value) => { sanitizeLog10 = value; });
expose("clampLog10", () => clampLog10, (value) => { clampLog10 = value; });
expose("logFromSavedValue", () => logFromSavedValue, (value) => { logFromSavedValue = value; });
expose("hydrateLog10", () => hydrateLog10, (value) => { hydrateLog10 = value; });
expose("hydrateLogResource", () => hydrateLogResource, (value) => { hydrateLogResource = value; });
expose("sanitizeBoolean", () => sanitizeBoolean, (value) => { sanitizeBoolean = value; });
expose("sanitizeInfinityRunRecords", () => sanitizeInfinityRunRecords, (value) => { sanitizeInfinityRunRecords = value; });
expose("valueFromLog10", () => valueFromLog10, (value) => { valueFromLog10 = value; });
expose("subtractLog10", () => subtractLog10, (value) => { subtractLog10 = value; });
expose("log10Value", () => log10Value, (value) => { log10Value = value; });
expose("combineLog10", () => combineLog10, (value) => { combineLog10 = value; });
expose("formatNumber", () => formatNumber, (value) => { formatNumber = value; });
expose("formatUiNumber", () => formatUiNumber, (value) => { formatUiNumber = value; });
expose("formatUiLogNumber", () => formatUiLogNumber, (value) => { formatUiLogNumber = value; });
expose("formatLogNumber", () => formatLogNumber, (value) => { formatLogNumber = value; });
expose("formatScientificLog", () => formatScientificLog, (value) => { formatScientificLog = value; });
expose("formatPowerOfTen", () => formatPowerOfTen, (value) => { formatPowerOfTen = value; });
expose("formatSmallDecimal", () => formatSmallDecimal, (value) => { formatSmallDecimal = value; });
expose("formatDuration", () => formatDuration, (value) => { formatDuration = value; });
expose("formatLongDuration", () => formatLongDuration, (value) => { formatLongDuration = value; });

