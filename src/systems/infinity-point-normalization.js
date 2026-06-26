import { runtime } from "../runtime/shared.js";

const INFINITY_POINT_AFFORDABILITY_TOLERANCE_LOG10 = 1e-12;
const INFINITY_POINT_INTEGER_NORMALIZATION_TOLERANCE = 1e-9;

function normalizeInfinityPointState() {
  const balanceLog10 = runtime.state.infinityPointsLog10;
  const balance = runtime.valueFromLog10(balanceLog10);
  const nearestInteger = Math.round(balance);
  const tolerance = Math.max(
    INFINITY_POINT_INTEGER_NORMALIZATION_TOLERANCE,
    Number.EPSILON * Math.max(1, Math.abs(nearestInteger)) * 16,
  );
  const isNearSafeInteger = Number.isSafeInteger(nearestInteger)
    && Math.abs(balance - nearestInteger) <= tolerance;

  runtime.state.infinityPointsLog10 = isNearSafeInteger
    ? (nearestInteger > 0 ? runtime.log10Value(nearestInteger) : -Infinity)
    : balanceLog10;
  runtime.state.infinityPoints = isNearSafeInteger ? nearestInteger : balance;
}

function setInfinityPointBalanceFromLog10(balanceLog10) {
  runtime.state.infinityPointsLog10 = balanceLog10;
  normalizeInfinityPointState();
}

function canSpendInfinityPoints(costLog10) {
  const currentLog10 = runtime.currentInfinityPointsLog10();
  return currentLog10 >= costLog10
    || (Number.isFinite(currentLog10)
      && Number.isFinite(costLog10)
      && costLog10 - currentLog10 <= INFINITY_POINT_AFFORDABILITY_TOLERANCE_LOG10);
}

function addInfinityPoints(amount) {
  const amountLog10 = runtime.log10Value(amount);
  setInfinityPointBalanceFromLog10(runtime.combineLog10(runtime.currentInfinityPointsLog10(), amountLog10));
}

function spendInfinityPoints(costLog10) {
  if (!canSpendInfinityPoints(costLog10)) return false;
  const currentLog10 = runtime.currentInfinityPointsLog10();
  if (currentLog10 <= costLog10 + INFINITY_POINT_AFFORDABILITY_TOLERANCE_LOG10) {
    setInfinityPointBalanceFromLog10(-Infinity);
    return true;
  }
  setInfinityPointBalanceFromLog10(runtime.subtractLog10(currentLog10, costLog10));
  return true;
}

const applySaveData = runtime.applySaveData;
runtime.applySaveData = (data, saveVersion) => {
  applySaveData(data, saveVersion);
  normalizeInfinityPointState();
};

const serializeSaveData = runtime.serializeSaveData;
runtime.serializeSaveData = () => {
  normalizeInfinityPointState();
  return serializeSaveData();
};

runtime.canSpendInfinityPoints = canSpendInfinityPoints;
runtime.addInfinityPoints = addInfinityPoints;
runtime.spendInfinityPoints = spendInfinityPoints;
runtime.normalizeInfinityPointState = normalizeInfinityPointState;
