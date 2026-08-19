import { runtime, expose } from "../runtime/shared.js";

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
  if (options.update !== false) runtime.updateUi?.();
  if (options.save !== false) runtime.saveGame?.("manual");
  return true;
}

function maybeForceEternity(options = {}) {
  return performEternity(options);
}

expose("eternityRequirementExact", () => eternityRequirementExact);
expose("eternityIpThresholdMet", () => eternityIpThresholdMet);
expose("canEternity", () => canEternity);
expose("shouldForceEternity", () => shouldForceEternity);
expose("resetEternityProgression", () => resetEternityProgression);
expose("performEternity", () => performEternity);
expose("maybeForceEternity", () => maybeForceEternity);
