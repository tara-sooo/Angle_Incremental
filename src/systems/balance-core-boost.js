import { runtime, expose } from "../runtime/shared.js";

function canonicalCoreBoostBonusPower() {
  return 1;
}

function canonicalCoreBoostGainIncreaseBaseForCount(coreBoostCount) {
  const increasePerCoreBoost = runtime.hasInfinityUpgrade("7-1") ? 1 : 0.5;
  return runtime.hasInfinityUpgrade("12-1")
    ? Math.pow(1 + increasePerCoreBoost, coreBoostCount)
    : 1 + coreBoostCount * increasePerCoreBoost;
}

function balanceCoreBoostGainIncreaseMultiplier() {
  return Math.pow(
    canonicalCoreBoostGainIncreaseBaseForCount(runtime.effectiveCoreBoostCount()),
    canonicalCoreBoostBonusPower(),
  );
}

expose("balanceCoreBoostGainIncreaseMultiplier", () => balanceCoreBoostGainIncreaseMultiplier);
