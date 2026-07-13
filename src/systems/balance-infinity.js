import { runtime, expose } from "../runtime/shared.js";

function generationIpMultiplierLog10() {
  if (!runtime.isChallengeCompleted(8)) return 0;
  return Math.max(0, runtime.generationScoreMultiplierEffectLog10() - 21);
}

function floorWithFloatingPointTolerance(value) {
  return Math.floor(value + Math.max(1, Math.abs(value)) * Number.EPSILON * 8);
}

function doubleIpGainExactly(gain) {
  return gain > Number.MAX_VALUE / 2 ? Number.MAX_VALUE : gain * 2;
}

function balanceInfinityPointGain() {
  if (!runtime.canInfinity()) return 0;
  const scoreLog10 = runtime.currentScoreLog10();
  let base;
  if (runtime.state.infiniteCapBroken) base = Math.floor(scoreLog10 / Math.log10(2) - 307);
  else if (runtime.hasInfinityUpgrade("9-1")) base = Math.floor(scoreLog10 / Math.log10(7) - 307);
  else base = Math.floor(scoreLog10 - 307);
  const gained = Math.max(1, base);
  let gainedWithExactMultipliers = gained;
  if (runtime.isAchievementUnlocked(17)) gainedWithExactMultipliers = doubleIpGainExactly(gainedWithExactMultipliers);
  if (runtime.isAchievementUnlocked(21)) gainedWithExactMultipliers = doubleIpGainExactly(gainedWithExactMultipliers);
  const ic8MultiplierLog10 = generationIpMultiplierLog10();
  if (ic8MultiplierLog10 === 0) return gainedWithExactMultipliers;
  const gainValue = runtime.valueFromLog10(runtime.log10Value(gainedWithExactMultipliers) + ic8MultiplierLog10);
  if (gainValue === Number.MAX_VALUE) return Number.MAX_VALUE;
  return Math.max(1, floorWithFloatingPointTolerance(gainValue));
}

function balanceInfinityUpgradeCostExponent() {
  if (!runtime.hasInfinityUpgrade("7-2")) return 1;
  const config = runtime.BALANCE_PROFILE.infinityUpgradeCostReduction;
  const infinityCount = Math.max(0, runtime.state.infinityCount);
  const rawExponent = 1 - infinityCount * config.perInfinity;
  if (rawExponent >= config.softcapStartExponent) return rawExponent;
  const postSoftcapInfinities = infinityCount - (1 - config.softcapStartExponent) / config.perInfinity;
  return config.softcapAsymptoteExponent
    + (config.softcapStartExponent - config.softcapAsymptoteExponent)
      * Math.exp(-Math.max(0, postSoftcapInfinities) * config.postSoftcapDecay);
}

expose("balanceInfinityPointGain", () => balanceInfinityPointGain);
expose("balanceInfinityUpgradeCostExponent", () => balanceInfinityUpgradeCostExponent);
