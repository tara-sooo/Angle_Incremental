import { runtime } from "../runtime/shared.js";

const INFINITY_POINT_INTEGER_NORMALIZATION_TOLERANCE = 1e-12;

// Infinity Points are an integer resource. Any residual that is only floating-
// point noise is converted to its canonical integer value and canonical log.
function normalizeInfinityPointState() {
  const balanceLog10 = runtime.state.infinityPointsLog10;
  const balance = runtime.valueFromLog10(balanceLog10);
  const nearestInteger = Math.round(balance);
  const tolerance = Math.max(
    INFINITY_POINT_INTEGER_NORMALIZATION_TOLERANCE,
    Number.EPSILON * Math.max(1, Math.abs(nearestInteger)) * 32,
  );
  const isNearSafeInteger = Number.isSafeInteger(nearestInteger)
    && Math.abs(balance - nearestInteger) <= tolerance;

  runtime.state.infinityPointsLog10 = isNearSafeInteger
    ? (nearestInteger > 0 ? runtime.log10Value(nearestInteger) : -Infinity)
    : balanceLog10;
  runtime.state.infinityPoints = isNearSafeInteger ? nearestInteger : balance;
}

runtime.normalizeInfinityPointState = normalizeInfinityPointState;
