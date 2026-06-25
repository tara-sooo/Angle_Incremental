// 0.1.0 balance profile.
// Generation owns score scaling; early upgrade scaling no longer changes with GR or CB count.
const BALANCE_PROFILE = Object.freeze({
  generationRewardLogCoefficient: 0.37,
  initialUpgradeCostScaling: Object.freeze({
    speed: Object.freeze({ startsAfter: 20, logScale: 0.00035 }),
    vertex: Object.freeze({ startsAfter: 15, logScale: 0.00140 }),
    gain: Object.freeze({ startsAfter: 12, logScale: 0.00065 }),
  }),
  infinityUpgradeCostReduction: Object.freeze({
    perInfinity: 0.002,
    softcapStartExponent: 0.9,
    softcapAsymptoteExponent: 0.8,
    postSoftcapDecay: 0.005,
  }),
});

const BALANCE_INFINITY_UPGRADES = [
  {
    id: "1-1",
    bit: 0,
    cost: 1,
    requires: [],
    name: { ja: "1-1 リセットは負ではない", en: "1-1 Resets Are Not Negative" },
    effect: {
      ja: "頂点通過ごとの増加が×(Infinity回数+1)される",
      en: "Multiplies gain per vertex by Infinity count + 1.",
    },
  },
  {
    id: "1-2",
    bit: 1,
    cost: 1,
    requires: [],
    name: { ja: "1-2 はじめてのQoL", en: "1-2 First QoL" },
    effect: { ja: "通常強化の自動購入を解放", en: "Unlocks normal-upgrade autobuy." },
  },
  {
    id: "2-1",
    bit: 2,
    cost: 1,
    requires: ["1-1", "1-2"],
    name: { ja: "2-1 最速タイム", en: "2-1 Fastest Time" },
    effect: { ja: "ラップスピードが×1.5される", en: "Multiplies lap speed by 1.5." },
  },
  {
    id: "3-1",
    bit: 3,
    cost: 3,
    requires: ["2-1"],
    name: { ja: "3-1 スコア革命", en: "3-1 Score Revolution" },
    effect: { ja: "GRスコア倍率が^1.5される", en: "Raises the GR score multiplier to ^1.5." },
  },
  {
    id: "3-2",
    bit: 4,
    cost: 3,
    requires: ["2-1"],
    name: { ja: "3-2 コスト革命", en: "3-2 Cost Revolution" },
    effect: { ja: "GRコスト倍率が×0.95される", en: "Multiplies the GR cost factor by 0.95." },
  },
  {
    id: "4-1",
    bit: 5,
    cost: 5,
    requires: ["3-1", "3-2"],
    name: { ja: "4-1 縛り縛られ", en: "4-1 Bound By Restrictions" },
    effect: { ja: "Infinity Challengeを解放", en: "Unlocks Infinity Challenges." },
  },
  {
    id: "5-1",
    bit: 6,
    cost: 10,
    requires: ["4-1"],
    name: { ja: "5-1 スタートダッシュ", en: "5-1 Starting Dash" },
    effect: { ja: "ラップスピードが×3される", en: "Multiplies lap speed by 3." },
  },
  {
    id: "5-2",
    bit: 7,
    cost: 10,
    requires: ["4-1"],
    name: { ja: "5-2 親が地主", en: "5-2 Landlord Parents" },
    effect: { ja: "リセット後、スコア100で開始する", en: "Start every reset with 100 score." },
  },
  {
    id: "6-1",
    bit: 8,
    cost: 50,
    requires: ["5-1", "5-2"],
    name: { ja: "6-1 ほんのりした甘味", en: "6-1 A Hint of Sweetness" },
    effect: { ja: "GRスコア倍率がさらに^1.2される", en: "Further raises the GR score multiplier to ^1.2." },
  },
  {
    id: "6-2",
    bit: 9,
    cost: 50,
    requires: ["5-1", "5-2"],
    name: { ja: "6-2 澄んだ視界", en: "6-2 Clear View" },
    effect: { ja: "GRコスト倍率の下限が×0.70になる", en: "Lowers the GR cost-factor floor to x0.70." },
  },
  {
    id: "7-1",
    bit: 10,
    cost: 150,
    requires: ["6-1", "6-2"],
    name: { ja: "7-1 権力の集中", en: "7-1 Concentration of Power" },
    effect: { ja: "CBごとの増加倍率が+1.0になる", en: "Raises the per-CB gain multiplier increase to +1.0." },
  },
  {
    id: "7-2",
    bit: 11,
    cost: 150,
    requires: ["6-1", "6-2"],
    name: { ja: "7-2 庶民の幸せ", en: "7-2 Commoners' Happiness" },
    effect: { ja: "Infinity回数に応じて通常強化コストを下げる", en: "Lowers normal-upgrade costs based on Infinity count." },
  },
];

BALANCE_INFINITY_UPGRADES.forEach((definition) => {
  const existing = INFINITY_UPGRADES.find((upgrade) => upgrade.id === definition.id);
  if (existing) Object.assign(existing, definition);
  else INFINITY_UPGRADES.push(definition);
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

function balanceCanBuyNormalUpgrade(kind) {
  const costLog = upgradeCostLog(kind);
  if (state.activeChallenge === 7 && costLog > 30) return false;
  if (kind === "vertex") {
    if (state.activeChallenge === 8) return false;
    if (state.activeChallenge === 2 && state.vertices >= 200) return false;
  }
  return canSpendLog(costLog);
}

function balanceInfinityPointGain() {
  if (!canInfinity()) return 0;
  const scoreLog10 = currentScoreLog10();
  const base = state.infiniteCapBroken
    ? Math.floor(scoreLog10 / Math.log10(2) - 307)
    : Math.floor(scoreLog10 - 307);
  return Math.max(1, base);
}

function balanceGenerationMinCostFactor() {
  return hasInfinityUpgrade("6-2") ? 0.70 : GENERATION_MIN_NEW_COST_FACTOR;
}

function balanceRestoreGenerationCostFactor(rawValue, upgradeMask = state.infinityUpgradeMask) {
  if ((Math.floor(Number(upgradeMask) || 0) & (1 << 9)) === 0) return;
  const value = parseSavedNumber(rawValue);
  if (!Number.isFinite(value)) return;
  state.generationCostFactor = Math.max(0.70, Math.min(1, value));
}

function balanceRestoreGenerationCostFactorFromLocalSave() {
  if (typeof localStorage === "undefined" || typeof SAVE_KEY === "undefined") return;
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (saved && saved.state) {
      balanceRestoreGenerationCostFactor(
        saved.state.generationCostFactor,
        saved.state.infinityUpgradeMask,
      );
    }
  } catch (error) {
    // The core save loader already handles malformed saves safely.
  }
}

function balanceInfinityUpgradeCostExponent() {
  if (!hasInfinityUpgrade("7-2")) return 1;
  const config = BALANCE_PROFILE.infinityUpgradeCostReduction;
  const infinityCount = Math.max(0, state.infinityCount);
  const rawExponent = 1 - infinityCount * config.perInfinity;
  if (rawExponent >= config.softcapStartExponent) return rawExponent;
  const postSoftcapInfinities = infinityCount - (1 - config.softcapStartExponent) / config.perInfinity;
  return config.softcapAsymptoteExponent
    + (config.softcapStartExponent - config.softcapAsymptoteExponent)
      * Math.exp(-Math.max(0, postSoftcapInfinities) * config.postSoftcapDecay);
}

function balanceCostLog10(kind, base, level, growth) {
  const growthLog = log10Value(growth) * (state.activeChallenge === 3 && kind === "speed" ? 2 : 1);
  const rawLog = log10Value(base) + level * growthLog;
  const costFactor = generationCostFactorEffect();
  const adjustedLog = rawLog <= 300
    ? log10Value(Math.ceil(base + (10 ** rawLog - base) * costFactor))
    : rawLog + log10Value(costFactor);
  const earlyAdjustedLog = adjustedLog + preGenerationCostScalingLog10(kind, level);
  const scaledLog = earlyAdjustedLog + stagedUpgradeCostScalingLog10(earlyAdjustedLog);
  const challengeAdjustedLog = isChallengeCompleted(2) ? scaledLog * 0.95 : scaledLog;
  return challengeAdjustedLog * balanceInfinityUpgradeCostExponent();
}

function balanceRawLapSpeedLog10() {
  let multiplierLog = state.speedLevel * log10Value(1.22);
  if (hasInfinityUpgrade("2-1")) multiplierLog += log10Value(applyInfinityUpgradePower(1.5));
  if (hasInfinityUpgrade("5-1")) multiplierLog += log10Value(applyInfinityUpgradePower(3));
  if (isChallengeCompleted(3)) multiplierLog += log10Value(1.1);
  if (state.activeChallenge === 3) multiplierLog *= 0.8;
  return clampLog10(multiplierLog);
}

function balanceGenerationScorePower() {
  let power = GENERATION_SCORE_POWER;
  if (hasInfinityUpgrade("3-1")) power *= applyInfinityUpgradePower(1.5);
  if (hasInfinityUpgrade("6-1")) power *= applyInfinityUpgradePower(1.2);
  return power;
}

function balanceCoreBoostGainIncreaseMultiplier() {
  const increasePerCoreBoost = hasInfinityUpgrade("7-1") ? 1 : 0.5;
  return Math.pow(1 + state.coreBoostCount * increasePerCoreBoost, coreBoostBonusPower());
}

function balanceVertexGainIncrease() {
  const infinityResetBoost = hasInfinityUpgrade("1-1")
    ? applyInfinityUpgradePower(state.infinityCount + 1)
    : 1;
  let gain = (0.01 + state.gainLevel * 0.01)
    * coreBoostGainIncreaseMultiplier()
    * infiniteAngleBoost()
    * achievementGainMultiplier()
    * infinityResetBoost;
  if (state.activeChallenge === 6) return 0.001;
  if (state.activeChallenge === 4) gain = Math.pow(gain, 0.5);
  if (isChallengeCompleted(4)) gain = Math.pow(gain, 1.1);
  return gain;
}

function balanceApplyResetStartScore() {
  if (!hasInfinityUpgrade("5-2")) return;
  state.score = 100;
  state.scoreLog10 = 2;
}

function balanceRunGeneration() {
  if (!canRunGeneration()) return;
  const generationScoreBeforeResetLog = currentGenerationScoreLog10();
  const reward = generationRewardForLog(generationScoreBeforeResetLog);
  const nextCostFactor = state.generationCostFactor * (1 - reward.costReduction);
  const preservedVertices = shouldPreserveVerticesThroughEarlyReset() ? state.vertices : 3;
  state.generationCount += 1;
  state.previousGenerationScoreLog10 = generationScoreBeforeResetLog;
  state.previousGenerationScore = valueFromLog10(generationScoreBeforeResetLog);
  state.generationScoreMultiplierLog10 = reward.scoreMultiplierLog10;
  state.generationScoreMultiplier = valueFromLog10(state.generationScoreMultiplierLog10);
  state.generationCostFactor = Math.max(balanceGenerationMinCostFactor(), nextCostFactor);
  state.score = 0;
  state.scoreLog10 = -Infinity;
  state.generationScore = 0;
  state.generationScoreLog10 = -Infinity;
  state.vertices = preservedVertices;
  state.speedLevel = 0;
  state.gainLevel = 0;
  state.currentGain = 1;
  state.currentGainLog10 = 0;
  state.pointProgress = 0;
  state.totalVertexProgress = 0;
  state.lastVertexIndex = 0;
  state.floatingTexts = [];
  balanceApplyResetStartScore();
  updateUi();
  saveGame("manual");
}

function balanceNextGenerationValues() {
  if (!canRunGeneration()) {
    return {
      scoreMultiplier: generationScoreMultiplierEffect(),
      scoreMultiplierLog10: generationScoreMultiplierEffectLog10(),
      costFactor: generationCostFactorEffect(),
    };
  }
  const reward = generationRewardForLog(currentGenerationScoreLog10());
  const nextRawScoreMultiplierLog = reward.scoreMultiplierLog10;
  const nextRawCostFactor = Math.max(
    balanceGenerationMinCostFactor(),
    state.generationCostFactor * (1 - reward.costReduction),
  );
  return {
    scoreMultiplier: valueFromLog10(applyGenerationAchievementRewardLog10(generationScoreMultiplierBaseEffectLog10(nextRawScoreMultiplierLog))),
    scoreMultiplierLog10: applyGenerationAchievementRewardLog10(generationScoreMultiplierBaseEffectLog10(nextRawScoreMultiplierLog)),
    costFactor: Math.pow(nextRawCostFactor, generationCostPower()) * (hasInfinityUpgrade("3-2") ? applyInfinityUpgradePower(0.95) : 1),
  };
}

const balanceResetBelowCoreBoost = resetBelowCoreBoost;
const balanceResetBelowInfinity = resetBelowInfinity;
const balanceApplySaveData = applySaveData;

function balanceCreateInfinityUpgradeRows() {
  clearElement(elements.infinityUpgradeTree);
  const tiers = [
    ["1-1", "1-2"],
    ["2-1"],
    ["3-1", "3-2"],
    ["4-1"],
    ["5-1", "5-2"],
    ["6-1", "6-2"],
    ["7-1", "7-2"],
  ];
  tiers.forEach((rowIds, rowIndex) => {
    const tier = document.createElement("div");
    tier.className = "infinity-upgrade-tier";
    tier.dataset.tier = String(rowIndex + 1);
    rowIds.forEach((id) => {
      const upgrade = infinityUpgradeById(id);
      if (!upgrade) return;
      const button = document.createElement("button");
      button.className = "infinity-upgrade-node";
      button.type = "button";
      button.dataset.upgrade = upgrade.id;
      button.addEventListener("click", () => selectInfinityUpgrade(upgrade.id));
      const name = document.createElement("strong");
      name.className = "infinity-upgrade-name";
      const status = document.createElement("small");
      status.className = "infinity-upgrade-state";
      button.append(name, status);
      tier.append(button);
    });
    elements.infinityUpgradeTree.append(tier);
  });
}

INFINITY_CHALLENGES[6].restriction = {
  ja: "ショップの価格が1e30を超えると、通常アップグレードを購入できなくなる",
  en: "Normal upgrades whose cost exceeds 1e30 cannot be bought.",
};

generationRewardForLog = balanceGenerationRewardForLog;
earlyLayerCostScalingFactor = () => 1;
preGenerationCostScalingLog10 = balancePreGenerationCostScalingLog10;
canBuyNormalUpgrade = balanceCanBuyNormalUpgrade;
infinityPointGain = balanceInfinityPointGain;
costLog10 = balanceCostLog10;
rawLapSpeedLog10 = balanceRawLapSpeedLog10;
generationScorePower = balanceGenerationScorePower;
coreBoostGainIncreaseMultiplier = balanceCoreBoostGainIncreaseMultiplier;
vertexGainIncrease = balanceVertexGainIncrease;
runGeneration = balanceRunGeneration;
nextGenerationValues = balanceNextGenerationValues;
resetBelowCoreBoost = function balanceResetCoreBoost() {
  balanceResetBelowCoreBoost();
  balanceApplyResetStartScore();
};
resetBelowInfinity = function balanceResetInfinity() {
  balanceResetBelowInfinity();
  balanceApplyResetStartScore();
};
applySaveData = function balanceApplySaveDataWrapper(data, saveVersion) {
  balanceApplySaveData(data, saveVersion);
  balanceRestoreGenerationCostFactor(data && data.generationCostFactor, data && data.infinityUpgradeMask);
};
createInfinityUpgradeRows = balanceCreateInfinityUpgradeRows;

balanceRestoreGenerationCostFactorFromLocalSave();
if (typeof elements !== "undefined" && elements.infinityUpgradeTree) createInfinityUpgradeRows();
if (window.__angleDebug) window.__angleDebug.balanceProfile = BALANCE_PROFILE;
if (typeof updateUi === "function") updateUi();
if (typeof draw === "function") draw();
