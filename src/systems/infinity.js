import { runtime, expose } from "../runtime/shared.js";

// Extracted mechanically from the next-runtime baseline.
// Functions retain their original global runtime dependencies during the classic-script migration phase.

const INFINITY_POINT_AFFORDABILITY_TOLERANCE_LOG10 = 1e-12;

function infinityUpgradeById(id) {
  return runtime.INFINITY_UPGRADES.find((upgrade) => upgrade.id === id);
}

function hasInfinityUpgrade(id) {
  const upgrade = infinityUpgradeById(id);
  return upgrade ? (runtime.state.infinityUpgradeMask & (1 << upgrade.bit)) !== 0 : false;
}

function infinityUpgradeName(id) {
  const upgrade = infinityUpgradeById(id);
  const language = runtime.TEXT[runtime.state.language] ? runtime.state.language : "ja";
  return upgrade ? upgrade.name[language] : id;
}

function infinityUpgradeEffectText(id) {
  const upgrade = infinityUpgradeById(id);
  const language = runtime.TEXT[runtime.state.language] ? runtime.state.language : "ja";
  return upgrade ? upgrade.effect[language] : "";
}

function infinityUpgradeEffectPower() {
  return 1;
}

function applyInfinityUpgradePower(value) {
  if (value === 1) return 1;
  return Math.pow(value, infinityUpgradeEffectPower());
}

function infinityUpgradePrerequisitesMet(upgrade) {
  return upgrade.requires.every((requiredId) => hasInfinityUpgrade(requiredId));
}

function canBuyInfinityUpgrade(id) {
  const upgrade = infinityUpgradeById(id);
  if (!upgrade || hasInfinityUpgrade(id) || !infinityUpgradePrerequisitesMet(upgrade)) return false;
  return canSpendInfinityPoints(runtime.log10Value(upgrade.cost));
}

function infinityChallengesUnlocked() {
  return runtime.state.infinityCount > 0 && hasInfinityUpgrade("4-1");
}

function infinitySoftcapPower() {
  if (runtime.state.infiniteCapBroken) return 1;
  return Math.min(0.32, 0.08 + completedChallengeCount() * 0.02);
}

function isChallengeCompleted(index) {
  return (runtime.state.completedChallenges & (1 << (index - 1))) !== 0;
}

function completedChallengeCount() {
  let count = 0;
  for (let index = 1; index <= runtime.INFINITY_CHALLENGE_COUNT; index += 1) {
    if (isChallengeCompleted(index)) count += 1;
  }
  return count;
}

function nextChallengeIndex() {
  for (let index = 1; index <= runtime.INFINITY_CHALLENGE_COUNT; index += 1) {
    if (!isChallengeCompleted(index)) return index;
  }
  return 1;
}

function challengeStateText(index) {
  if (!infinityChallengesUnlocked()) return runtime.t("challengeLocked");
  if (runtime.state.activeChallenge === index) return runtime.t("challengeRunning");
  return isChallengeCompleted(index) ? runtime.t("challengeCompleted") : runtime.t("challengeIncomplete");
}

function challengeName(index) {
  return runtime.challengeText(index, "name");
}

function challengeRestriction(index) {
  return runtime.challengeText(index, "restriction");
}

function challengeReward(index) {
  return runtime.challengeText(index, "reward");
}

function infiniteAngleEfficiency() {
  return 1;
}

function infiniteAngleBoost() {
  const scoreLog = runtime.currentInfiniteScoreLog10();
  if (scoreLog === -Infinity) return 1;
  const logOnePlusScore = scoreLog < 12 ? Math.log10(1 + runtime.state.infiniteScore) : scoreLog;
  return 1 + logOnePlusScore * 0.25;
}

function infiniteAngleConversionCostLog10() {
  return runtime.INFINITE_ANGLE_CONVERSION_COST_LOG10;
}

function canInfinity() {
  return runtime.currentScoreLog10() >= runtime.INFINITY_REQUIREMENT_LOG10;
}

function infinityPointGain() {
  if (!canInfinity()) return 0;
  const scoreLog = runtime.currentScoreLog10();
  const base = Math.max(1, Math.floor(scoreLog - 307));
  return Math.max(1, Math.floor(base));
}

function infiniteScoreGainPerIp() {
  return 10 * infiniteAngleEfficiency();
}

function infiniteScoreGainPerIpLog10() {
  return runtime.log10Value(infiniteScoreGainPerIp());
}

function canSpendInfinityPoints(costLog) {
  const currentLog = runtime.currentInfinityPointsLog10();
  return currentLog >= costLog
    || (Number.isFinite(currentLog)
      && Number.isFinite(costLog)
      && costLog - currentLog <= INFINITY_POINT_AFFORDABILITY_TOLERANCE_LOG10);
}

function addInfinityPoints(amount) {
  const amountLog = runtime.log10Value(amount);
  runtime.state.infinityPointsLog10 = runtime.combineLog10(runtime.currentInfinityPointsLog10(), amountLog);
  runtime.state.infinityPoints = runtime.valueFromLog10(runtime.state.infinityPointsLog10);
}

function spendInfinityPoints(costLog) {
  if (!canSpendInfinityPoints(costLog)) return false;
  const currentLog = runtime.currentInfinityPointsLog10();
  if (currentLog <= costLog + INFINITY_POINT_AFFORDABILITY_TOLERANCE_LOG10) {
    runtime.state.infinityPointsLog10 = -Infinity;
    runtime.state.infinityPoints = 0;
    return true;
  }
  runtime.state.infinityPointsLog10 = runtime.subtractLog10(currentLog, costLog);
  runtime.state.infinityPoints = runtime.valueFromLog10(runtime.state.infinityPointsLog10);
  return true;
}

function addInfiniteScoreLog(amountLog) {
  runtime.state.infiniteScoreLog10 = runtime.combineLog10(runtime.currentInfiniteScoreLog10(), amountLog);
  runtime.state.infiniteScore = runtime.valueFromLog10(runtime.state.infiniteScoreLog10);
}

function canBreakInfiniteCap() {
  return !runtime.state.infiniteCapBroken && runtime.currentScoreLog10() >= runtime.BREAK_CAP_REQUIREMENT_LOG10;
}

function completeChallengeIfReady() {
  if (!runtime.state.autoCompleteChallenges || runtime.state.activeChallenge <= 0 || !canInfinity()) return false;
  runInfinity(false);
  return true;
}

function updateChallengeTimers(dt) {
  if (runtime.state.activeChallenge !== 8) runtime.state.ic8VertexDecayElapsed = 0;
}

function resetBelowInfinity() {
  runtime.state.score = 0;
  runtime.state.scoreLog10 = -Infinity;
  runtime.state.totalScore = 0;
  runtime.state.totalScoreLog10 = -Infinity;
  runtime.state.generationScore = 0;
  runtime.state.generationScoreLog10 = -Infinity;
  runtime.state.vertices = 3;
  runtime.state.speedLevel = 0;
  runtime.state.gainLevel = 0;
  runtime.state.currentGain = 1;
  runtime.state.currentGainLog10 = 0;
  runtime.state.pointProgress = 0;
  runtime.state.totalVertexProgress = 0;
  runtime.state.lastVertexIndex = 0;
  runtime.state.generationCount = 0;
  runtime.state.previousGenerationScore = 0;
  runtime.state.previousGenerationScoreLog10 = -Infinity;
  runtime.state.generationScoreMultiplier = 1;
  runtime.state.generationScoreMultiplierLog10 = 0;
  runtime.state.generationCostFactor = 1;
  runtime.state.coreBoostCount = 0;
  runtime.state.infiniteScore = 0;
  runtime.state.infiniteScoreLog10 = -Infinity;
  runtime.state.ic8VertexDecayElapsed = 0;
  runtime.state.floatingTexts = [];
}

function recordInfinityRun(scoreLog, gained, challenge) {
  const record = {
    time: runtime.state.currentInfinityRunTime,
    scoreLog10: scoreLog,
    ipGain: gained,
    challenge,
  };
  runtime.state.lastInfinityRuns.unshift(record);
  runtime.state.lastInfinityRuns = runtime.state.lastInfinityRuns.slice(0, 10);
  if (record.time > 0 && (runtime.state.fastestInfinityTime <= 0 || record.time < runtime.state.fastestInfinityTime)) {
    runtime.state.fastestInfinityTime = record.time;
  }
}

function infinityCountGain() {
  return isChallengeCompleted(6) ? 2 : 1;
}

function runInfinity(forced = false) {
  if (!canInfinity()) return;
  if (!forced && runtime.state.infinityCount === 0) return;

  const scoreLogBeforeReset = runtime.currentScoreLog10();
  const gained = infinityPointGain();
  const completedChallenge = runtime.state.activeChallenge;
  if (runtime.state.activeChallenge > 0) {
    runtime.state.completedChallenges |= 1 << (runtime.state.activeChallenge - 1);
    runtime.state.activeChallenge = 0;
  }

  runtime.state.infinityCount += infinityCountGain();
  addInfinityPoints(gained);
  recordInfinityRun(scoreLogBeforeReset, gained, completedChallenge);
  resetBelowInfinity();
  runtime.state.currentInfinityRunTime = 0;
  runtime.updateUi();
  runtime.saveGame("manual");
}

function buyInfinityUpgrade(id) {
  const upgrade = infinityUpgradeById(id);
  if (!upgrade || !canBuyInfinityUpgrade(id)) return;
  if (!spendInfinityPoints(runtime.log10Value(upgrade.cost))) return;
  runtime.state.infinityUpgradeMask |= 1 << upgrade.bit;
  runtime.updateUi();
  runtime.saveGame("manual");
}

function convertIpToInfiniteScore() {
  if (!spendInfinityPoints(infiniteAngleConversionCostLog10())) return;
  addInfiniteScoreLog(infiniteScoreGainPerIpLog10());
  runtime.updateUi();
  runtime.saveGame("manual");
}

function toggleInfinityChallenge(index = nextChallengeIndex()) {
  if (!infinityChallengesUnlocked()) return;
  if (runtime.state.activeChallenge === index) {
    runtime.state.activeChallenge = 0;
    resetBelowInfinity();
  } else if (runtime.state.activeChallenge > 0) {
    return;
  } else {
    runtime.state.activeChallenge = Math.min(runtime.INFINITY_CHALLENGE_COUNT, Math.max(1, Math.floor(index)));
    resetBelowInfinity();
    if (runtime.state.activeChallenge === 2) {
      runtime.state.vertices = Math.min(runtime.state.vertices, 200);
      runtime.resetVertexProgress();
    } else if (runtime.state.activeChallenge === 8) {
      runtime.state.vertices = 3;
      runtime.resetVertexProgress();
    }
  }
  runtime.updateUi();
  runtime.saveGame("manual");
}

function breakInfiniteCap() {
  if (!canBreakInfiniteCap()) return;
  runtime.state.infiniteCapBroken = true;
  runtime.updateUi();
  runtime.saveGame("manual");
}

function balanceInfinityPointGain() {
  if (!canInfinity()) return 0;
  const scoreLog10 = runtime.currentScoreLog10();
  const base = runtime.state.infiniteCapBroken
    ? Math.floor(scoreLog10 / Math.log10(2) - 307)
    : Math.floor(scoreLog10 - 307);
  return Math.max(1, base);
}

function balanceInfinityUpgradeCostExponent() {
  if (!hasInfinityUpgrade("7-2")) return 1;
  const config = runtime.BALANCE_PROFILE.infinityUpgradeCostReduction;
  const infinityCount = Math.max(0, runtime.state.infinityCount);
  const rawExponent = 1 - infinityCount * config.perInfinity;
  if (rawExponent >= config.softcapStartExponent) return rawExponent;
  const postSoftcapInfinities = infinityCount - (1 - config.softcapStartExponent) / config.perInfinity;
  return config.softcapAsymptoteExponent
    + (config.softcapStartExponent - config.softcapAsymptoteExponent)
      * Math.exp(-Math.max(0, postSoftcapInfinities) * config.postSoftcapDecay);
}
expose("infinityUpgradeById", () => infinityUpgradeById, (value) => { infinityUpgradeById = value; });
expose("hasInfinityUpgrade", () => hasInfinityUpgrade, (value) => { hasInfinityUpgrade = value; });
expose("infinityUpgradeName", () => infinityUpgradeName, (value) => { infinityUpgradeName = value; });
expose("infinityUpgradeEffectText", () => infinityUpgradeEffectText, (value) => { infinityUpgradeEffectText = value; });
expose("infinityUpgradeEffectPower", () => infinityUpgradeEffectPower, (value) => { infinityUpgradeEffectPower = value; });
expose("applyInfinityUpgradePower", () => applyInfinityUpgradePower, (value) => { applyInfinityUpgradePower = value; });
expose("infinityUpgradePrerequisitesMet", () => infinityUpgradePrerequisitesMet, (value) => { infinityUpgradePrerequisitesMet = value; });
expose("canBuyInfinityUpgrade", () => canBuyInfinityUpgrade, (value) => { canBuyInfinityUpgrade = value; });
expose("infinityChallengesUnlocked", () => infinityChallengesUnlocked, (value) => { infinityChallengesUnlocked = value; });
expose("infinitySoftcapPower", () => infinitySoftcapPower, (value) => { infinitySoftcapPower = value; });
expose("isChallengeCompleted", () => isChallengeCompleted, (value) => { isChallengeCompleted = value; });
expose("completedChallengeCount", () => completedChallengeCount, (value) => { completedChallengeCount = value; });
expose("nextChallengeIndex", () => nextChallengeIndex, (value) => { nextChallengeIndex = value; });
expose("challengeStateText", () => challengeStateText, (value) => { challengeStateText = value; });
expose("challengeName", () => challengeName, (value) => { challengeName = value; });
expose("challengeRestriction", () => challengeRestriction, (value) => { challengeRestriction = value; });
expose("challengeReward", () => challengeReward, (value) => { challengeReward = value; });
expose("infiniteAngleEfficiency", () => infiniteAngleEfficiency, (value) => { infiniteAngleEfficiency = value; });
expose("infiniteAngleBoost", () => infiniteAngleBoost, (value) => { infiniteAngleBoost = value; });
expose("infiniteAngleConversionCostLog10", () => infiniteAngleConversionCostLog10, (value) => { infiniteAngleConversionCostLog10 = value; });
expose("canInfinity", () => canInfinity, (value) => { canInfinity = value; });
expose("infinityPointGain", () => infinityPointGain, (value) => { infinityPointGain = value; });
expose("infiniteScoreGainPerIp", () => infiniteScoreGainPerIp, (value) => { infiniteScoreGainPerIp = value; });
expose("infiniteScoreGainPerIpLog10", () => infiniteScoreGainPerIpLog10, (value) => { infiniteScoreGainPerIpLog10 = value; });
expose("canSpendInfinityPoints", () => canSpendInfinityPoints, (value) => { canSpendInfinityPoints = value; });
expose("addInfinityPoints", () => addInfinityPoints, (value) => { addInfinityPoints = value; });
expose("spendInfinityPoints", () => spendInfinityPoints, (value) => { spendInfinityPoints = value; });
expose("addInfiniteScoreLog", () => addInfiniteScoreLog, (value) => { addInfiniteScoreLog = value; });
expose("canBreakInfiniteCap", () => canBreakInfiniteCap, (value) => { canBreakInfiniteCap = value; });
expose("completeChallengeIfReady", () => completeChallengeIfReady, (value) => { completeChallengeIfReady = value; });
expose("updateChallengeTimers", () => updateChallengeTimers, (value) => { updateChallengeTimers = value; });
expose("resetBelowInfinity", () => resetBelowInfinity, (value) => { resetBelowInfinity = value; });
expose("recordInfinityRun", () => recordInfinityRun, (value) => { recordInfinityRun = value; });
expose("infinityCountGain", () => infinityCountGain, (value) => { infinityCountGain = value; });
expose("runInfinity", () => runInfinity, (value) => { runInfinity = value; });
expose("buyInfinityUpgrade", () => buyInfinityUpgrade, (value) => { buyInfinityUpgrade = value; });
expose("convertIpToInfiniteScore", () => convertIpToInfiniteScore, (value) => { convertIpToInfiniteScore = value; });
expose("toggleInfinityChallenge", () => toggleInfinityChallenge, (value) => { toggleInfinityChallenge = value; });
expose("breakInfiniteCap", () => breakInfiniteCap, (value) => { breakInfiniteCap = value; });
expose("balanceInfinityPointGain", () => balanceInfinityPointGain, (value) => { balanceInfinityPointGain = value; });
expose("balanceInfinityUpgradeCostExponent", () => balanceInfinityUpgradeCostExponent, (value) => { balanceInfinityUpgradeCostExponent = value; });
