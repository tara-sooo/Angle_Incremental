import { runtime, expose } from "../runtime/shared.js";

const FIRST_TIER_MILESTONE_BITS = Object.freeze({
  "1-1": 1,
  "1-2": 2,
  "1-3": 4,
});

const COUNT_MILESTONE_REQUIREMENTS = Object.freeze({
  2: 5,
  3: 8,
  4: 12,
  5: 20,
});

const FIRST_TIER_MILESTONE_MASK = Object.values(FIRST_TIER_MILESTONE_BITS)
  .reduce((mask, bit) => mask | bit, 0);

function normalizedEternityCount() {
  return Math.max(0, Math.floor(runtime.state.eternityCount));
}

function normalizeEternityMilestoneMask(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) & FIRST_TIER_MILESTONE_MASK : 0;
}

function normalizeEternityMilestoneChoice(value) {
  return typeof value === "string" && Object.hasOwn(FIRST_TIER_MILESTONE_BITS, value) ? value : "";
}

function eternityMilestoneActive(id) {
  const bit = FIRST_TIER_MILESTONE_BITS[id];
  if (bit) return (normalizeEternityMilestoneMask(runtime.state.eternityMilestoneMask) & bit) !== 0;
  const requiredCount = COUNT_MILESTONE_REQUIREMENTS[id];
  return requiredCount !== undefined && normalizedEternityCount() >= requiredCount;
}

function availableEternityMilestoneChoices() {
  return Object.keys(FIRST_TIER_MILESTONE_BITS).filter((id) => !eternityMilestoneActive(id));
}

function selectEternityMilestone(id) {
  const normalizedId = normalizeEternityMilestoneChoice(id);
  if (!normalizedId || eternityMilestoneActive(normalizedId)) return false;
  runtime.state.eternityMilestoneChoice = normalizedId;
  return true;
}

function acquireEternityMilestone(id) {
  const normalizedId = normalizeEternityMilestoneChoice(id);
  const bit = FIRST_TIER_MILESTONE_BITS[normalizedId];
  if (!bit || eternityMilestoneActive(normalizedId)) return false;
  runtime.state.eternityMilestoneMask = normalizeEternityMilestoneMask(
    runtime.state.eternityMilestoneMask,
  ) | bit;
  return true;
}

function eternityMilestoneNormalUpgradeBonusLevel() {
  return eternityMilestoneActive("1-2") ? normalizedEternityCount() * 10 : 0;
}

function eternityMilestoneIc7RewardActive() {
  return eternityMilestoneActive("2");
}

function eternityMilestonePreservesGenerationReset() {
  return eternityMilestoneActive("3");
}

function eternityMilestonePreservesCoreBoostReset() {
  return eternityMilestoneActive("3");
}

function eternityMilestoneCoreBoostRequirementLog10(requirementLog10) {
  return eternityMilestoneActive("4") ? requirementLog10 * 0.9 : requirementLog10;
}

function normalAutomationUnlocked() {
  return runtime.hasInfinityUpgrade("1-2") || eternityMilestoneActive("1-1");
}

function infinityAutomationUnlocked() {
  return runtime.hasInfinityUpgrade("8-1") || eternityMilestoneActive("5");
}

function applyEternityMilestoneStartingLevels() {
  if (!eternityMilestoneActive("1-3")) return;
  runtime.state.infiniteAngleSpeedLevel = Math.max(5, Math.floor(runtime.state.infiniteAngleSpeedLevel));
  runtime.state.infiniteAngleVertexLevel = Math.max(5, Math.floor(runtime.state.infiniteAngleVertexLevel));
  runtime.state.infiniteAngleGainLevel = Math.max(5, Math.floor(runtime.state.infiniteAngleGainLevel));
}

function eternityRequirementExact() {
  return runtime.exactInfinityPointsFromLog10(runtime.ETERNITY_REQUIREMENT_LOG10);
}

function eternityIpThresholdMet() {
  return runtime.currentExactInfinityPoints() >= eternityRequirementExact();
}

function canEternity() {
  return eternityIpThresholdMet()
    && runtime.towerChallenge4CompletedForEternity?.() === true;
}

function shouldForceEternity() {
  return canEternity();
}

function resetEternityProgression() {
  const resetBelowInfinity = runtime.balanceResetBelowInfinity || runtime.resetBelowInfinity;
  resetBelowInfinity();
  Object.assign(runtime.state, {
    coreBoostCount: 0,
    infinityCount: 0,
    infinityUpgradeMask: 0,
    infiniteScore: 0,
    infiniteScoreLog10: -Infinity,
    infiniteAngleUnlocked: false,
    infiniteAngleSpeedLevel: 0,
    infiniteAngleVertexLevel: 0,
    infiniteAngleGainLevel: 0,
    infiniteAngleCurrentGain: 1,
    infiniteAngleCurrentGainLog10: 0,
    infiniteAnglePointProgress: 0,
    infiniteAngleTotalVertexProgress: 0,
    infiniteAngleLastVertexIndex: 0,
    towerFloor: 0,
    ipGainUpgradeLevel: 0,
    infiniteAngleUpgradeLevel: 0,
    softcapUpgradeLevel: 0,
    activeChallenge: 0,
    completedChallenges: 0,
    activeChallengeTime: 0,
    activeTowerChallenge: 0,
    completedTowerChallenges: 0,
    activeTowerChallengeTime: 0,
    tc4BaseGainLevel: 0,
    tc4BaseGainPriceStep: 0,
    tc4InfinityScoreVertexGainLevel: 0,
    tc4InfinityScoreVertexGainPriceStep: 0,
    tc4FreeCoreBoostLevel: 0,
    tc4FreeCoreBoostPriceStep: 0,
    infiniteCapBroken: false,
    currentInfinityRunTime: 0,
    currentInfinityRealTime: 0,
    bestInfinityCountPerSecond: 0,
    infinityCountRateRemainder: 0,
    ic8VertexDecayElapsed: 0,
    currentInfinityRunHadGeneration: false,
    currentInfinityRunHadCoreBoost: false,
    lastEarned: 0,
    lastEarnedLog10: -Infinity,
  });
  runtime.syncInfinityPointCachesFromExact(0n);
  runtime.resetInfiniteAngleRun?.();
  runtime.normalizeTowerChallenge4State?.();
}

function performEternity(options = {}) {
  if (!shouldForceEternity()) return false;
  if (runtime.createCheckpoint && !runtime.createCheckpoint("pre-eternity", { force: true })) return false;
  resetEternityProgression();
  runtime.state.eternityCount = Math.max(0, Math.floor(runtime.state.eternityCount)) + 1;
  runtime.checkAchievements(true);
  const selectedMilestone = Object.hasOwn(options, "milestoneChoice")
    ? options.milestoneChoice
    : runtime.state.eternityMilestoneChoice;
  acquireEternityMilestone(selectedMilestone);
  runtime.state.eternityMilestoneChoice = "";
  applyEternityMilestoneStartingLevels();
  if (options.update !== false) runtime.updateUi?.();
  if (options.save !== false) runtime.saveGame?.("manual");
  return true;
}

function maybeForceEternity(options = {}) {
  return performEternity(options);
}

expose("eternityRequirementExact", () => eternityRequirementExact);
expose("eternityIpThresholdMet", () => eternityIpThresholdMet);
expose("normalizeEternityMilestoneMask", () => normalizeEternityMilestoneMask);
expose("normalizeEternityMilestoneChoice", () => normalizeEternityMilestoneChoice);
expose("eternityMilestoneActive", () => eternityMilestoneActive);
expose("availableEternityMilestoneChoices", () => availableEternityMilestoneChoices);
expose("selectEternityMilestone", () => selectEternityMilestone);
expose("eternityMilestoneNormalUpgradeBonusLevel", () => eternityMilestoneNormalUpgradeBonusLevel);
expose("eternityMilestoneIc7RewardActive", () => eternityMilestoneIc7RewardActive);
expose("eternityMilestonePreservesGenerationReset", () => eternityMilestonePreservesGenerationReset);
expose("eternityMilestonePreservesCoreBoostReset", () => eternityMilestonePreservesCoreBoostReset);
expose("eternityMilestoneCoreBoostRequirementLog10", () => eternityMilestoneCoreBoostRequirementLog10);
expose("normalAutomationUnlocked", () => normalAutomationUnlocked);
expose("infinityAutomationUnlocked", () => infinityAutomationUnlocked);
expose("applyEternityMilestoneStartingLevels", () => applyEternityMilestoneStartingLevels);
expose("canEternity", () => canEternity);
expose("shouldForceEternity", () => shouldForceEternity);
expose("resetEternityProgression", () => resetEternityProgression);
expose("performEternity", () => performEternity);
expose("maybeForceEternity", () => maybeForceEternity);
