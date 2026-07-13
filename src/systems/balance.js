import { runtime, expose } from "../runtime/shared.js";
import "./balance-angle.js";
import "./balance-generation.js";
import "./balance-core-boost.js";
import "./balance-infinity.js";
import "./balance-ui.js";

const baseResetBelowCoreBoost = runtime.resetBelowCoreBoost;
const baseResetBelowInfinity = runtime.resetBelowInfinity;
const baseApplySaveData = runtime.applySaveData;

function resetBelowCoreBoostWithBalance() {
  baseResetBelowCoreBoost();
  runtime.balanceApplyResetStartScore();
}

function resetBelowInfinityWithBalance() {
  baseResetBelowInfinity();
  runtime.applyStartingCoreBoosts();
  runtime.balanceApplyResetStartScore();
}

function applySaveDataWithBalance(data, saveVersion) {
  baseApplySaveData(data, saveVersion);
  runtime.balanceRestoreGenerationCostFactor(data && data.generationCostFactor, data && data.infinityUpgradeMask);
  runtime.applyStartingCoreBoosts();
}

function installBalanceProfile() {
  runtime.INFINITY_CHALLENGES[6].restriction = {
    ja: "ショップの価格が1e30を超えると、通常アップグレードを購入できなくなる",
    en: "Normal upgrades whose cost exceeds 1e30 cannot be bought.",
  };

  runtime.generationRewardForLog = runtime.balanceGenerationRewardForLog;
  runtime.earlyLayerCostScalingFactor = () => 1;
  runtime.preGenerationCostScalingLog10 = runtime.balancePreGenerationCostScalingLog10;
  runtime.canBuyNormalUpgrade = runtime.balanceCanBuyNormalUpgrade;
  runtime.infinityPointGain = runtime.balanceInfinityPointGain;
  runtime.costLog10 = runtime.balanceCostLog10;
  runtime.rawLapSpeedLog10 = runtime.balanceRawLapSpeedLog10;
  runtime.generationScorePower = runtime.balanceGenerationScorePower;
  runtime.coreBoostGainIncreaseMultiplier = runtime.balanceCoreBoostGainIncreaseMultiplier;
  runtime.vertexGainIncreaseLog10 = runtime.balanceVertexGainIncreaseLog10;
  runtime.vertexGainIncrease = runtime.balanceVertexGainIncrease;
  runtime.runGeneration = runtime.balanceRunGeneration;
  runtime.nextGenerationValues = runtime.balanceNextGenerationValues;
  runtime.resetBelowCoreBoost = resetBelowCoreBoostWithBalance;
  runtime.resetBelowInfinity = resetBelowInfinityWithBalance;
  runtime.applySaveData = applySaveDataWithBalance;
  runtime.createInfinityUpgradeRows = runtime.balanceCreateInfinityUpgradeRows;
  runtime.balanceRestoreGenerationCostFactorFromLocalSave();
}

expose("balanceResetBelowCoreBoost", () => baseResetBelowCoreBoost);
expose("balanceResetBelowInfinity", () => baseResetBelowInfinity);
expose("balanceApplySaveData", () => baseApplySaveData);

installBalanceProfile();
