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

const coreRunGeneration = runGeneration;
const coreResetBelowCoreBoost = resetBelowCoreBoost;
const coreResetBelowInfinity = resetBelowInfinity;
const coreApplySaveData = applySaveData;

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

applyBalanceInfinityUpgradeDefinitions();
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
  coreResetBelowCoreBoost();
  balanceApplyResetStartScore();
};
resetBelowInfinity = function balanceResetInfinity() {
  coreResetBelowInfinity();
  balanceApplyResetStartScore();
};
applySaveData = function balanceApplySaveDataWrapper(data, saveVersion) {
  coreApplySaveData(data, saveVersion);
  balanceRestoreGenerationCostFactor(data && data.generationCostFactor, data && data.infinityUpgradeMask);
};
createInfinityUpgradeRows = balanceCreateInfinityUpgradeRows;

elements.generationButton.removeEventListener("click", coreRunGeneration);
elements.generationButton.addEventListener("click", runGeneration);

balanceRestoreGenerationCostFactorFromLocalSave();
if (typeof createChallengeRows === "function") createChallengeRows();
createInfinityUpgradeRows();
if (typeof updateUi === "function") updateUi();
if (typeof draw === "function") draw();

if (window.__angleDebug) {
  Object.assign(window.__angleDebug, {
    runGeneration,
    nextGenerationValues,
    costLog10,
    rawLapSpeedLog10,
    coreBoostGainIncreaseMultiplier,
    generationScorePower,
    vertexGainIncrease,
    balanceInfinityUpgradeCostExponent,
  });
}
