import { runtime, expose } from "../runtime/shared.js";

// Log-space resource arithmetic and display formatting.
// State-dependent progression and UI formatting remain outside this helper module.

const COMPACT_UNIT_LOG10 = Object.freeze({
  m: 6,
  b: 9,
  t: 12,
  qa: 15,
  qi: 18,
  sx: 21,
});
// ponytail: keep exact progression bounded to the finite native range; lift this
// ceiling only when the game needs arbitrary-precision counts above 309 digits.
const MAX_EXACT_INTEGER = BigInt(Number.MAX_VALUE);
const exactStateSyncRecords = new WeakMap();

function parseSavedNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  const trimmed = value.trim();
  if (!trimmed) return NaN;
  if (trimmed === "Infinity") return Infinity;
  if (trimmed === "-Infinity") return -Infinity;
  return Number(trimmed);
}

function parseExactInteger(value, fallback = null) {
  if (typeof value === "bigint") {
    return value >= 0n ? (value > MAX_EXACT_INTEGER ? MAX_EXACT_INTEGER : value) : fallback;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return fallback;
    const exact = BigInt(Math.floor(value));
    return exact > MAX_EXACT_INTEGER ? MAX_EXACT_INTEGER : exact;
  }
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (/^\d+$/.test(trimmed)) {
    const exact = BigInt(trimmed);
    return exact > MAX_EXACT_INTEGER ? MAX_EXACT_INTEGER : exact;
  }
  const parsed = parseSavedNumber(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  const exact = BigInt(Math.floor(parsed));
  return exact > MAX_EXACT_INTEGER ? MAX_EXACT_INTEGER : exact;
}

function normalizeExactInteger(value, fallback = 0n) {
  const parsed = parseExactInteger(value, null);
  if (parsed !== null) return parsed;
  return normalizeExactInteger(fallback, 0n);
}

function exactIntegerFromLog10(log10) {
  const normalized = sanitizeLog10(log10, -Infinity);
  if (normalized === -Infinity || normalized <= 0) return normalized === 0 ? 1n : 0n;
  if (normalized >= Math.log10(Number.MAX_VALUE)) return MAX_EXACT_INTEGER;
  if (normalized < 15) {
    const value = 10 ** normalized;
    return normalizeExactInteger(
      Math.max(0, Math.floor(value + Math.max(1, value) * Number.EPSILON * 8)),
    );
  }
  const exponent = Math.floor(normalized);
  const mantissa = 10 ** (normalized - exponent);
  const significant = Math.max(1, Math.round(mantissa * (10 ** 15)));
  if (significant >= 10 ** 16) {
    return normalizeExactInteger(BigInt("1" + "0".repeat(exponent + 1)));
  }
  const digits = String(significant);
  const zeros = exponent - (digits.length - 1);
  if (zeros >= 0) return normalizeExactInteger(BigInt(digits + "0".repeat(zeros)));
  return normalizeExactInteger(BigInt(digits.slice(0, Math.max(1, digits.length + zeros))));
}

function log10ExactInteger(value) {
  const exact = normalizeExactInteger(value);
  if (exact <= 0n) return -Infinity;
  const text = exact.toString();
  if (text.length <= 15) return Math.log10(Number(text));
  const leadingDigits = 16;
  const leading = Number(text.slice(0, leadingDigits)) / (10 ** (leadingDigits - 1));
  return Math.min(
    Math.log10(leading) + text.length - 1,
    runtime.MAX_TRACKED_LOG10,
  );
}

function numberFromExactInteger(value) {
  const exact = normalizeExactInteger(value);
  return Number(exact);
}

function exactStateRecord(state, exactField, valueField) {
  if (!state || typeof state !== "object") return null;
  let records = exactStateSyncRecords.get(state);
  if (!records) {
    records = new Map();
    exactStateSyncRecords.set(state, records);
  }
  const key = exactField + ":" + valueField;
  let record = records.get(key);
  if (!record) {
    record = { exact: "", value: 0n, projection: 0 };
    records.set(key, record);
  }
  return record;
}

function setExactIntegerState(state, exactField, valueField, value) {
  const exact = normalizeExactInteger(value);
  const exactText = exact.toString();
  const projection = numberFromExactInteger(exact);
  const record = exactStateRecord(state, exactField, valueField);
  if (state[exactField] !== exactText) state[exactField] = exactText;
  if (!Object.is(state[valueField], projection)) state[valueField] = projection;
  if (record) {
    record.exact = exactText;
    record.value = exact;
    record.projection = projection;
  }
  return exact;
}

function currentExactIntegerState(state, exactField, valueField, fallback = 0n) {
  const record = exactStateRecord(state, exactField, valueField);
  if (record && state?.[exactField] === record.exact && Object.is(state?.[valueField], record.projection)) {
    return record.value;
  }
  const parsedExact = parseExactInteger(state?.[exactField], null);
  let exact = parsedExact;
  if (exact === null) {
    exact = parseExactInteger(state?.[valueField], fallback);
  } else if (record && !Object.is(state?.[valueField], record.projection)) {
    exact = parseExactInteger(state?.[valueField], fallback);
  } else if (
    record
    && record.exact === ""
    && !Object.is(state?.[valueField], numberFromExactInteger(0n))
  ) {
    exact = parseExactInteger(state?.[valueField], fallback);
  }
  return setExactIntegerState(state, exactField, valueField, exact ?? fallback);
}

function hydrateExactIntegerState(state, exactField, valueField, exactValue, legacyValue, fallback = 0n) {
  const exact = parseExactInteger(exactValue, null);
  const legacy = parseExactInteger(legacyValue, null);
  const legacyDiffers = legacy !== null
    && exact !== null
    && !Object.is(numberFromExactInteger(exact), numberFromExactInteger(legacy));
  return setExactIntegerState(
    state,
    exactField,
    valueField,
    exact === null || legacyDiffers || (exact === 0n && legacy !== null && legacy > 0n)
      ? legacy ?? fallback
      : exact,
  );
}

function addExactIntegerState(state, exactField, valueField, amount) {
  const current = currentExactIntegerState(state, exactField, valueField);
  const parsedAmount = parseExactInteger(amount, null);
  if (parsedAmount === null || parsedAmount <= 0n) return current;
  return setExactIntegerState(state, exactField, valueField, current + parsedAmount);
}

function exactIntegerStatePositive(state, exactField, valueField) {
  return currentExactIntegerState(state, exactField, valueField) > 0n;
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

function parseUiLogNumber(value, fallback = -Infinity) {
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/,/g, "");
    const compactMatch = trimmed.match(/^([+-]?(?:\d+\.?\d*|\.\d+))\s*(M|B|T|Qa|Qi|Sx)$/i);
    if (compactMatch) {
      const mantissa = Number(compactMatch[1]);
      const exponent = COMPACT_UNIT_LOG10[compactMatch[2].toLowerCase()];
      if (mantissa > 0 && Number.isFinite(mantissa) && exponent !== undefined) {
        return clampLog10(Math.log10(mantissa) + exponent);
      }
    }
    return logFromSavedValue(trimmed, fallback);
  }
  return logFromSavedValue(value, fallback);
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
  return value.slice(0, 10).map((record) => {
    const normalized = {
      time: sanitizeNumber(record && record.time, 0),
      realTime: sanitizeNumber(record && record.realTime, null),
      scoreLog10: sanitizeLog10(record && record.scoreLog10, -Infinity),
      ipGain: Math.max(0, Math.floor(sanitizeNumber(record && record.ipGain, 0))),
      challenge: Math.max(0, Math.floor(sanitizeNumber(record && record.challenge, 0))),
    };
    const ipGainLog10 = sanitizeLog10(record && record.ipGainLog10, null);
    if (ipGainLog10 !== null) normalized.ipGainLog10 = ipGainLog10;
    return normalized;
  });
}

function sanitizeEternityRunRecords(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).map((record) => {
    const exactField = parseExactInteger(record && record.infinityCountExact, null);
    const exactCount = exactField ?? parseExactInteger(record && record.infinityCount, 0n);
    const normalized = {
      time: sanitizeNumber(record && record.time, 0),
      realTime: sanitizeNumber(record && record.realTime, null),
      infinityCount: numberFromExactInteger(exactCount),
    };
    if (exactField !== null || exactCount > BigInt(Number.MAX_SAFE_INTEGER)) {
      normalized.infinityCountExact = exactCount.toString();
    }
    return normalized;
  });
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

function formatNumber(value, truncate = false) {
  if (value === Infinity) return formatLogNumber(Infinity);
  if (!Number.isFinite(value)) return "0";
  if (value < 1000) {
    const decimals = value < 10 ? 2 : 0;
    const displayValue = truncate ? Math.floor(value * (10 ** decimals)) / (10 ** decimals) : value;
    return displayValue.toFixed(decimals).replace(/\.00$/, "");
  }
  if (value < 1000000) return (truncate ? Math.floor(value) : Math.round(value)).toLocaleString("en-US");
  if (value >= 1e18) return truncate
    ? formatScientificLog(log10Value(value), true)
    : value.toExponential(2).replace("e+", "e");
  const units = ["M", "B", "T", "Qa", "Qi", "Sx"];
  let scaled = value / 1000000;
  let unitIndex = 0;
  while (scaled >= 1000 && unitIndex < units.length - 1) {
    scaled /= 1000;
    unitIndex += 1;
  }
  const decimals = scaled >= 100 ? 1 : 2;
  const displayValue = truncate ? Math.floor(scaled * (10 ** decimals)) / (10 ** decimals) : scaled;
  return `${displayValue.toFixed(decimals)}${units[unitIndex]}`;
}

function formatUiNumber(value, truncate = false) {
  if (runtime.state.numberFormat === "compact" || value <= 0 || !Number.isFinite(value)) return formatNumber(value, truncate);
  const valueLog = log10Value(value);
  if (runtime.state.numberFormat === "scientific") return formatScientificLog(valueLog, truncate);
  if (runtime.state.numberFormat === "detailed" && valueLog < 3) return formatNumber(value, truncate);
  return formatLogNumber(valueLog, false, truncate);
}

function formatUiLogNumber(log10Value, truncate = false) {
  if (log10Value === -Infinity) return "0";
  if (!Number.isFinite(log10Value)) return formatLogNumber(log10Value, false, truncate);
  if (log10Value < 18) return formatUiNumber(10 ** log10Value, truncate);
  return formatLogNumber(log10Value, false, truncate);
}

function formatScientificMantissa(log10Value, truncate = false) {
  let exponent = Math.floor(log10Value);
  let mantissa = 10 ** (log10Value - exponent);
  if (mantissa >= 10) {
    exponent += 1;
    mantissa /= 10;
  }
  const displayMantissa = truncate ? Math.floor(mantissa * 100) / 100 : mantissa;
  const mantissaText = displayMantissa.toFixed(2);
  if (mantissaText === "10.00") {
    return { mantissa: "1.00", exponent: exponent + 1 };
  }
  return { mantissa: mantissaText, exponent };
}

function formatLogNumber(log10Value, capSuffix = false, truncate = false) {
  log10Value = clampLog10(log10Value);
  if (log10Value === -Infinity) return "0";
  if (log10Value < 18) return formatNumber(10 ** log10Value, truncate);
  const { mantissa, exponent } = formatScientificMantissa(log10Value, truncate);
  const suffix = capSuffix ? runtime.t("capSuffix") : "";
  return `${mantissa}e${exponent.toLocaleString("en-US")}${suffix}`;
}

function formatScientificLog(log10Value, truncate = false) {
  if (!Number.isFinite(log10Value)) return log10Value === -Infinity ? "0" : "∞";
  if (log10Value < 3) return formatNumber(10 ** log10Value, truncate);
  const { mantissa, exponent } = formatScientificMantissa(log10Value, truncate);
  return `${mantissa}e${exponent.toLocaleString("en-US")}`;
}

function formatExactHeldScientific(exactValue) {
  if (typeof exactValue !== "string" && typeof exactValue !== "bigint") return null;
  const digits = String(exactValue).trim().replace(/^0+/, "");
  if (!/^\d+$/.test(digits) || digits.length <= 18) return null;
  return `${digits[0]}.${digits.slice(1, 3).padEnd(2, "0")}e${(digits.length - 1).toLocaleString("en-US")}`;
}

function formatHeldUiLogNumber(log10Value, exactValue = null) {
  const exact = parseExactInteger(exactValue, null);
  if (exact !== null && exact <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return formatUiNumber(Number(exact));
  }
  return formatExactHeldScientific(exactValue) || formatUiLogNumber(log10Value, true);
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
expose("MAX_EXACT_INTEGER", () => MAX_EXACT_INTEGER);
expose("parseExactInteger", () => parseExactInteger, (value) => { parseExactInteger = value; });
expose("normalizeExactInteger", () => normalizeExactInteger, (value) => { normalizeExactInteger = value; });
expose("exactIntegerFromLog10", () => exactIntegerFromLog10, (value) => { exactIntegerFromLog10 = value; });
expose("log10ExactInteger", () => log10ExactInteger, (value) => { log10ExactInteger = value; });
expose("numberFromExactInteger", () => numberFromExactInteger, (value) => { numberFromExactInteger = value; });
expose("setExactIntegerState", () => setExactIntegerState, (value) => { setExactIntegerState = value; });
expose("currentExactIntegerState", () => currentExactIntegerState, (value) => { currentExactIntegerState = value; });
expose("hydrateExactIntegerState", () => hydrateExactIntegerState, (value) => { hydrateExactIntegerState = value; });
expose("addExactIntegerState", () => addExactIntegerState, (value) => { addExactIntegerState = value; });
expose("exactIntegerStatePositive", () => exactIntegerStatePositive, (value) => { exactIntegerStatePositive = value; });
expose("sanitizeNumber", () => sanitizeNumber, (value) => { sanitizeNumber = value; });
expose("sanitizeLog10", () => sanitizeLog10, (value) => { sanitizeLog10 = value; });
expose("clampLog10", () => clampLog10, (value) => { clampLog10 = value; });
expose("logFromSavedValue", () => logFromSavedValue, (value) => { logFromSavedValue = value; });
expose("parseUiLogNumber", () => parseUiLogNumber, (value) => { parseUiLogNumber = value; });
expose("hydrateLog10", () => hydrateLog10, (value) => { hydrateLog10 = value; });
expose("hydrateLogResource", () => hydrateLogResource, (value) => { hydrateLogResource = value; });
expose("sanitizeBoolean", () => sanitizeBoolean, (value) => { sanitizeBoolean = value; });
expose("sanitizeInfinityRunRecords", () => sanitizeInfinityRunRecords, (value) => { sanitizeInfinityRunRecords = value; });
expose("sanitizeEternityRunRecords", () => sanitizeEternityRunRecords, (value) => { sanitizeEternityRunRecords = value; });
expose("valueFromLog10", () => valueFromLog10, (value) => { valueFromLog10 = value; });
expose("subtractLog10", () => subtractLog10, (value) => { subtractLog10 = value; });
expose("log10Value", () => log10Value, (value) => { log10Value = value; });
expose("combineLog10", () => combineLog10, (value) => { combineLog10 = value; });
expose("formatNumber", () => formatNumber, (value) => { formatNumber = value; });
expose("formatUiNumber", () => formatUiNumber, (value) => { formatUiNumber = value; });
expose("formatUiLogNumber", () => formatUiLogNumber, (value) => { formatUiLogNumber = value; });
expose("formatHeldUiLogNumber", () => formatHeldUiLogNumber, (value) => { formatHeldUiLogNumber = value; });
expose("formatLogNumber", () => formatLogNumber, (value) => { formatLogNumber = value; });
expose("formatScientificLog", () => formatScientificLog, (value) => { formatScientificLog = value; });
expose("formatPowerOfTen", () => formatPowerOfTen, (value) => { formatPowerOfTen = value; });
expose("formatSmallDecimal", () => formatSmallDecimal, (value) => { formatSmallDecimal = value; });
expose("formatDuration", () => formatDuration, (value) => { formatDuration = value; });
expose("formatLongDuration", () => formatLongDuration, (value) => { formatLongDuration = value; });
