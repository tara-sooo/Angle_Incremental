import { runtime, expose } from "../runtime/shared.js";

const IC8_IP_MULTIPLIER_DIVISOR_LOG10 = 20;

function generationIpMultiplierLog10() {
  if (!runtime.isChallengeCompleted(8)) return 0;
  return Math.max(0, runtime.generationScoreMultiplierEffectLog10() - IC8_IP_MULTIPLIER_DIVISOR_LOG10);
}

function floorWithFloatingPointTolerance(value) {
  return Math.floor(value + Math.max(1, Math.abs(value)) * Number.EPSILON * 8);
}

function baseInfinityPointGain() {
  if (!runtime.canInfinity()) return 0;
  const scoreLog10 = runtime.currentScoreLog10();
  let base;
  if (runtime.state.infiniteCapBroken) base = Math.floor(scoreLog10 / Math.log10(2) - 307);
  else if (runtime.hasInfinityUpgrade("9-1")) base = Math.floor(scoreLog10 / Math.log10(7) - 307);
  else base = Math.floor(scoreLog10 - 307);
  return Math.max(1, base);
}

function balanceInfinityPointGainRawLog10() {
  const gained = baseInfinityPointGain();
  if (gained <= 0) return -Infinity;
  let gainLog10 = runtime.log10Value(gained);
  if (runtime.isAchievementUnlocked(17)) gainLog10 += Math.log10(2);
  if (runtime.isAchievementUnlocked(21)) gainLog10 += Math.log10(2);
  if (runtime.isAchievementUnlocked(31)) gainLog10 += 2;
  return gainLog10
    + generationIpMultiplierLog10()
    + (runtime.timelineIpGainMultiplierLog10?.() ?? 0);
}

function balanceInfinityPointGain() {
  const gainLog10 = balanceInfinityPointGainRawLog10();
  if (gainLog10 === -Infinity) return 0;
  const gainValue = runtime.valueFromLog10(gainLog10);
  if (gainValue === Number.MAX_VALUE) return Number.MAX_VALUE;
  return Math.max(1, floorWithFloatingPointTolerance(gainValue));
}

function balanceInfinityPointGainLog10() {
  return runtime.log10Value(balanceInfinityPointGain());
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
expose("balanceInfinityPointGainLog10", () => balanceInfinityPointGainLog10);
expose("balanceInfinityPointGainRawLog10", () => balanceInfinityPointGainRawLog10);
expose("balanceInfinityUpgradeCostExponent", () => balanceInfinityUpgradeCostExponent);
