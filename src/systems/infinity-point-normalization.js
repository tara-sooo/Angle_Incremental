import { runtime } from "../runtime/shared.js";

const MAX_EXACT_INFINITY_POINTS = BigInt("17976931348623157") * (10n ** 292n);

function clampExactInfinityPoints(value) {
  if (value <= 0n) return 0n;
  return value > MAX_EXACT_INFINITY_POINTS ? MAX_EXACT_INFINITY_POINTS : value;
}

function parseExactInfinityPoints(value) {
  if (typeof value === "bigint") return clampExactInfinityPoints(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return 0n;
    return clampExactInfinityPoints(BigInt(Math.floor(value)));
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return clampExactInfinityPoints(BigInt(trimmed));
  const parsedLog = runtime.logFromSavedValue(trimmed, -Infinity);
  return exactInfinityPointsFromLog10(parsedLog);
}

function exactInfinityPointsFromLog10(log) {
  log = runtime.sanitizeLog10(log, -Infinity);
  if (log === -Infinity) return 0n;
  const maxLog = Math.log10(Number.MAX_VALUE);
  if (log >= maxLog) return MAX_EXACT_INFINITY_POINTS;
  if (log < 15) return clampExactInfinityPoints(BigInt(Math.floor(10 ** log + 1e-12)));

  const exponent = Math.floor(log);
  const mantissa = 10 ** (log - exponent);
  const precision = 16;
  const scaled = Math.floor(mantissa * (10 ** (precision - 1)) + 1e-9);
  const digits = String(Math.max(1, scaled));
  const zeros = exponent - (digits.length - 1);
  if (zeros >= 0) return clampExactInfinityPoints(BigInt(digits + "0".repeat(zeros)));
  return clampExactInfinityPoints(BigInt(digits.slice(0, Math.max(1, digits.length + zeros))));
}

function exactInfinityPointsFromCostLog10(log) {
  const exact = exactInfinityPointsFromLog10(log);
  return exact <= 0n ? 0n : exact;
}

function log10ExactInfinityPoints(value) {
  value = clampExactInfinityPoints(value);
  if (value <= 0n) return -Infinity;
  const text = value.toString();
  if (text.length <= 15) return Math.log10(Number(text));
  const leadingDigits = 16;
  const leading = Number(text.slice(0, leadingDigits)) / (10 ** (leadingDigits - 1));
  return Math.log10(leading) + text.length - 1;
}

function syncInfinityPointCachesFromExact(exact) {
  exact = clampExactInfinityPoints(exact);
  const log = log10ExactInfinityPoints(exact);
  runtime.state.infinityPointsExact = exact.toString();
  runtime.state.infinityPointsLog10 = log;
  runtime.state.infinityPoints = exact <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(exact)
    : runtime.valueFromLog10(log);
}

function currentExactInfinityPoints() {
  const parsedExact = parseExactInfinityPoints(runtime.state.infinityPointsExact);
  const savedLog = runtime.sanitizeLog10(runtime.state.infinityPointsLog10, null);
  const cachedExact = savedLog === null
    ? parseExactInfinityPoints(runtime.state.infinityPoints) || 0n
    : exactInfinityPointsFromLog10(savedLog);
  const exact = parsedExact === null || cachedExact > parsedExact ? cachedExact : parsedExact;
  syncInfinityPointCachesFromExact(exact);
  return exact;
}

function normalizeInfinityPointState() {
  currentExactInfinityPoints();
}

runtime.MAX_EXACT_INFINITY_POINTS = MAX_EXACT_INFINITY_POINTS;
runtime.parseExactInfinityPoints = parseExactInfinityPoints;
runtime.exactInfinityPointsFromLog10 = exactInfinityPointsFromLog10;
runtime.exactInfinityPointsFromCostLog10 = exactInfinityPointsFromCostLog10;
runtime.log10ExactInfinityPoints = log10ExactInfinityPoints;
runtime.syncInfinityPointCachesFromExact = syncInfinityPointCachesFromExact;
runtime.currentExactInfinityPoints = currentExactInfinityPoints;
runtime.normalizeInfinityPointState = normalizeInfinityPointState;
