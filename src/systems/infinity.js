import { runtime, expose } from "../runtime/shared.js";

// Infinity progression, IP, upgrades, challenges, and Infinite Angle.

let infinityUpgradeLookup = null;
let infinityUpgradeSource = null;

function infinityUpgradeById(id) {
  if (infinityUpgradeSource !== runtime.INFINITY_UPGRADES) {
    infinityUpgradeSource = runtime.INFINITY_UPGRADES;
    infinityUpgradeLookup = new Map(runtime.INFINITY_UPGRADES.map((upgrade) => [upgrade.id, upgrade]));
  }
  return infinityUpgradeLookup.get(id);
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
  return 0.08;
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

function canInfinity() {
  return runtime.currentScoreLog10() >= runtime.INFINITY_REQUIREMENT_LOG10;
}

function infinityPointGain() {
  if (!canInfinity()) return 0;
  const scoreLog = runtime.currentScoreLog10();
  const base = Math.max(1, Math.floor(scoreLog - 307));
  const gained = Math.max(1, Math.floor(base));
  let multiplier = 1;
  if (runtime.isAchievementUnlocked(17)) multiplier *= 2;
  if (runtime.isAchievementUnlocked(21)) multiplier *= 2;
  if (runtime.isAchievementUnlocked(31)) multiplier *= 100;
  return gained * multiplier;
}

function infinityPointGainLog10() {
  return runtime.log10Value(runtime.infinityPointGain());
}

function canSpendInfinityPoints(costLog10) {
  runtime.normalizeInfinityPointState();
  return runtime.currentExactInfinityPoints() >= runtime.exactInfinityPointsFromCostLog10(costLog10);
}

function addInfinityPoints(amount) {
  if (amount <= 0) return;
  const current = runtime.currentExactInfinityPoints();
  const added = BigInt(Math.max(0, Math.floor(amount)));
  runtime.syncInfinityPointCachesFromExact(current + added);
}

function spendInfinityPoints(costLog10) {
  if (!canSpendInfinityPoints(costLog10)) return false;
  const current = runtime.currentExactInfinityPoints();
  const cost = runtime.exactInfinityPointsFromCostLog10(costLog10);
  runtime.syncInfinityPointCachesFromExact(current - cost);
  return true;
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
  runtime.state.ic8VertexUpgradeLevel = 0;
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
  runtime.resetInfiniteAngleRun();
  runtime.state.ic8VertexDecayElapsed = 0;
  runtime.state.currentGenerationRunTime = 0;
  runtime.state.currentInfinityRunHadGeneration = false;
  runtime.state.currentInfinityRunHadCoreBoost = false;
  runtime.state.floatingTexts = [];
}

function applyStartingCoreBoosts() {
  if (runtime.state.activeChallenge === 5) {
    runtime.state.coreBoostCount = 0;
    return;
  }
  if (hasInfinityUpgrade("10-1") && runtime.state.coreBoostCount < 2) {
    runtime.state.coreBoostCount = 2;
  }
}

function recordInfinityRun(scoreLog, gained, challenge, noGenerationCoreBoost = false) {
  const elapsed = runtime.state.currentInfinityRunTime;
  const recordedTime = elapsed > 0
    ? Math.max(elapsed, runtime.MIN_RECORDED_INFINITY_SECONDS)
    : 0;
  const record = {
    time: recordedTime,
    scoreLog10: scoreLog,
    ipGain: gained,
    challenge,
  };
  if (noGenerationCoreBoost) record.noGenerationCoreBoost = true;
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
  const completedChallenge = runtime.state.activeChallenge;
  const noGenerationOrCoreBoost = !runtime.state.currentInfinityRunHadGeneration
    && !runtime.state.currentInfinityRunHadCoreBoost;
  if (completedChallenge > 0) {
    runtime.state.completedChallenges |= 1 << (completedChallenge - 1);
    runtime.state.activeChallenge = 0;
    runtime.checkAchievements(true);
  }

  const gained = runtime.infinityPointGain();
  runtime.state.infinityCount = Math.max(0, runtime.state.infinityCount + infinityCountGain());
  addInfinityPoints(gained);
  recordInfinityRun(scoreLogBeforeReset, gained, completedChallenge, noGenerationOrCoreBoost);
  runtime.checkAchievements(true);
  runtime.resetBelowInfinity();
  runtime.state.currentInfinityRunTime = 0;
  runtime.updateUi();
  runtime.saveGame("manual");
}

function buyInfinityUpgrade(id) {
  const upgrade = infinityUpgradeById(id);
  if (!upgrade || !canBuyInfinityUpgrade(id)) return false;
  if (!spendInfinityPoints(runtime.log10Value(upgrade.cost))) return false;
  runtime.state.infinityUpgradeMask |= 1 << upgrade.bit;
  if (id === "10-1") applyStartingCoreBoosts();
  runtime.updateUi();
  runtime.saveGame("manual");
  return true;
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
      runtime.state.ic8VertexUpgradeLevel = 0;
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
expose("canInfinity", () => canInfinity, (value) => { canInfinity = value; });
expose("infinityPointGain", () => infinityPointGain, (value) => { infinityPointGain = value; });
expose("infinityPointGainLog10", () => infinityPointGainLog10, (value) => { infinityPointGainLog10 = value; });
expose("canSpendInfinityPoints", () => canSpendInfinityPoints, (value) => { canSpendInfinityPoints = value; });
expose("addInfinityPoints", () => addInfinityPoints, (value) => { addInfinityPoints = value; });
expose("spendInfinityPoints", () => spendInfinityPoints, (value) => { spendInfinityPoints = value; });
expose("canBreakInfiniteCap", () => canBreakInfiniteCap, (value) => { canBreakInfiniteCap = value; });
expose("completeChallengeIfReady", () => completeChallengeIfReady, (value) => { completeChallengeIfReady = value; });
expose("updateChallengeTimers", () => updateChallengeTimers, (value) => { updateChallengeTimers = value; });
expose("resetBelowInfinity", () => resetBelowInfinity, (value) => { resetBelowInfinity = value; });
expose("applyStartingCoreBoosts", () => applyStartingCoreBoosts, (value) => { applyStartingCoreBoosts = value; });
expose("recordInfinityRun", () => recordInfinityRun, (value) => { recordInfinityRun = value; });
expose("infinityCountGain", () => infinityCountGain, (value) => { infinityCountGain = value; });
expose("runInfinity", () => runInfinity, (value) => { runInfinity = value; });
expose("buyInfinityUpgrade", () => buyInfinityUpgrade, (value) => { buyInfinityUpgrade = value; });
expose("toggleInfinityChallenge", () => toggleInfinityChallenge, (value) => { toggleInfinityChallenge = value; });
expose("breakInfiniteCap", () => breakInfiniteCap, (value) => { breakInfiniteCap = value; });
