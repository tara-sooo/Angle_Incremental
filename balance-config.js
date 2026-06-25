// 0.1.0 pre-Infinity balance profile.
// Generation owns score scaling; initial upgrade scaling no longer changes with GR or CB count.
const BALANCE_PROFILE = Object.freeze({
  generationRewardLogCoefficient: 0.37,
  initialUpgradeCostScaling: Object.freeze({
    speed: Object.freeze({ startsAfter: 20, logScale: 0.00035 }),
    vertex: Object.freeze({ startsAfter: 15, logScale: 0.00140 }),
    gain: Object.freeze({ startsAfter: 12, logScale: 0.00065 }),
  }),
});

function balanceGenerationRewardForLog(generationScoreLog) {
  const depth = Math.max(0, generationScoreLog - log10Value(GENERATION_UNLOCK_SCORE));
  const scoreMultiplierLog10 = Math.min(
    8,
    Math.log10(1 + depth) * BALANCE_PROFILE.generationRewardLogCoefficient,
  );
  return {
    scoreMultiplierLog10,
    scoreMultiplierGain: valueFromLog10(scoreMultiplierLog10),
    costReduction: Math.min(0.22, Math.log10(1 + depth) * 0.04),
  };
}

function balancePreGenerationCostScalingLog10(kind, level) {
  const scaling = BALANCE_PROFILE.initialUpgradeCostScaling[kind];
  if (!scaling) return 0;
  const excess = Math.max(0, level - scaling.startsAfter);
  return excess * excess * scaling.logScale;
}

window.generationRewardForLog = balanceGenerationRewardForLog;
window.earlyLayerCostScalingFactor = () => 1;
window.preGenerationCostScalingLog10 = balancePreGenerationCostScalingLog10;

if (window.__angleDebug) window.__angleDebug.balanceProfile = BALANCE_PROFILE;
if (typeof updateUi === "function") updateUi();
if (typeof draw === "function") draw();
