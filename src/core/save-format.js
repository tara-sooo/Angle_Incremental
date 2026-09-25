import { runtime } from "../runtime/shared.js";

const VERSION_9_INFINITY_POINT_CAP = 10_000_000_000n;

function dormantTimeFluxValue(value, fallback) {
  return runtime.sanitizeNumber(value, fallback);
}

export function clampOfflineTickCount(value) {
  return Math.min(
    runtime.OFFLINE_PROGRESS_MAX_TICKS,
    Math.max(runtime.OFFLINE_PROGRESS_MIN_TICKS, Math.floor(runtime.sanitizeNumber(
      value,
      runtime.OFFLINE_PROGRESS_DEFAULT_TICKS,
    ))),
  );
}

function normalizeStoredSave(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const version = Math.floor(runtime.sanitizeNumber(candidate.version, 0));
  if (version <= 0 || version > runtime.SAVE_VERSION || !candidate.state || typeof candidate.state !== "object" || Array.isArray(candidate.state)) {
    return null;
  }
  return {
    version,
    savedAt: runtime.sanitizeNumber(candidate.savedAt, 0),
    serverSavedAt: runtime.sanitizeNumber(candidate.serverSavedAt, 0),
    state: candidate.state,
  };
}

function legacyInfinityUpgradeRefundLog10(data) {
  const ipLevels = Math.floor(runtime.sanitizeNumber(data.ipGainUpgradeLevel, 0));
  const angleLevels = Math.floor(runtime.sanitizeNumber(data.infiniteAngleUpgradeLevel, 0));
  const softcapLevels = Math.floor(runtime.sanitizeNumber(data.softcapUpgradeLevel, 0));
  let refundLog = -Infinity;

  const addGeometricCosts = (levels, firstCostLog, growthLog) => {
    for (let level = 0; level < Math.min(levels, 80); level += 1) {
      refundLog = runtime.combineLog10(refundLog, firstCostLog + growthLog * level);
    }
    if (levels > 80) {
      const lastLog = firstCostLog + growthLog * (levels - 1);
      refundLog = runtime.combineLog10(refundLog, lastLog + Math.log10(1 / (1 - 10 ** -growthLog)));
    }
  };

  addGeometricCosts(ipLevels, 0, runtime.log10Value(2));
  addGeometricCosts(angleLevels, runtime.log10Value(2), runtime.log10Value(2));
  addGeometricCosts(softcapLevels, runtime.log10Value(4), runtime.log10Value(3));
  return refundLog;
}

function sanitizeChallengeTimes(value, count) {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: count }, (_, index) => Math.max(0, runtime.sanitizeNumber(source[index], 0)));
}

function savedInfinityUpgradeOwned(data, id) {
  const upgrade = runtime.INFINITY_UPGRADES?.find((entry) => entry.id === id);
  if (!upgrade) return false;
  const mask = Math.floor(runtime.sanitizeNumber(data.infinityUpgradeMask, runtime.state.infinityUpgradeMask));
  return (mask & (1 << upgrade.bit)) !== 0;
}

function savedChallengeProgress(data) {
  const completed = Math.floor(runtime.sanitizeNumber(data.completedChallenges, runtime.state.completedChallenges));
  const active = Math.floor(runtime.sanitizeNumber(data.activeChallenge, runtime.state.activeChallenge));
  const activeTime = runtime.sanitizeNumber(data.activeChallengeTime, runtime.state.activeChallengeTime);
  const times = Array.isArray(data.fastestInfinityChallengeTimes)
    ? data.fastestInfinityChallengeTimes
    : runtime.state.fastestInfinityChallengeTimes;
  return completed !== 0 || active > 0 || activeTime > 0 || times.some((time) => runtime.sanitizeNumber(time, 0) > 0);
}

function inferUnlockedMainTabs(data) {
  const eternityCount = runtime.currentExactIntegerState(runtime.state, "eternityCountExact", "eternityCount");
  const infinityCount = runtime.currentExactIntegerState(runtime.state, "infinityCountExact", "infinityCount");
  const milestoneMask = runtime.state.eternityMilestoneMask;
  const achievementMask = runtime.state.achievementMask;
  const automationSettings = [
    "automationEnabled",
    "autoBuyInfinityUpgrades",
    "autoBuyInfiniteAngleSpeed",
    "autoBuyInfiniteAngleVertex",
    "autoBuyInfiniteAngleGain",
    "autoBuildTower",
    "autoRunGeneration",
    "autoRunCoreBoost",
    "autoRunInfinity",
  ];
  const automationEvidence = automationSettings.some((key) => data[key] === true || runtime.state[key] === true);
  const towerFloor = Math.max(0, Math.floor(runtime.sanitizeNumber(data.towerFloor, runtime.state.towerFloor)));
  const tc4UnlockFloor = runtime.towerChallengeUnlockFloor?.(4) ?? 12;
  const completedTowerChallenges = Math.floor(runtime.sanitizeNumber(
    data.completedTowerChallenges,
    runtime.state.completedTowerChallenges,
  ));
  const tc4Progress = Math.floor(runtime.sanitizeNumber(data.activeTowerChallenge, runtime.state.activeTowerChallenge)) === 4
    || (completedTowerChallenges & (1 << 3)) !== 0
    || runtime.state.tc4BaseGainLevel > 0
    || runtime.state.tc4InfinityScoreVertexGainLevel > 0
    || runtime.state.tc4FreeCoreBoostLevel > 0;
  const discovered = [];

  if (eternityCount > 0n || infinityCount > 0n) discovered.push("infinity");
  if (
    eternityCount > 0n
    || savedInfinityUpgradeOwned(data, "4-1")
    || savedChallengeProgress(data)
  ) discovered.push("challenges");
  if (
    eternityCount > 0n
    || savedInfinityUpgradeOwned(data, "1-2")
    || savedInfinityUpgradeOwned(data, "8-1")
    || (milestoneMask & 1) !== 0
    || eternityCount >= 20n
    || eternityCount >= 81n
    || (achievementMask & (1 << (19 - 1))) !== 0
    || automationEvidence
  ) discovered.push("automation");
  if (eternityCount > 0n || towerFloor >= tc4UnlockFloor || tc4Progress) discovered.push("eternity");
  if (eternityCount > 0n) discovered.push("timeline");
  runtime.markMainTabsUnlocked(discovered);
}

function cloneStateValue(value) {
  if (Array.isArray(value)) return value.map(cloneStateValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneStateValue(entry)]));
  }
  return value;
}

function snapshotRuntimeState() {
  return Object.fromEntries(
    Object.entries(runtime.state).map(([key, value]) => [key, cloneStateValue(value)]),
  );
}

function restoreRuntimeState(snapshot) {
  Object.entries(snapshot).forEach(([key, value]) => {
    runtime.state[key] = cloneStateValue(value);
  });
}

function applySaveDataUnsafe(data, saveVersion = runtime.SAVE_VERSION) {
  if (runtime.invalidateVisibilityResume) runtime.invalidateVisibilityResume();
  const score = runtime.hydrateLogResource(data.score, data.scoreLog10);
  runtime.state.score = score.value;
  runtime.state.scoreLog10 = score.log;
  const totalScore = runtime.hydrateLogResource(data.totalScore, data.totalScoreLog10, runtime.state.scoreLog10);
  runtime.state.totalScore = totalScore.value;
  runtime.state.totalScoreLog10 = totalScore.log;
  const generationScore = runtime.hydrateLogResource(data.generationScore, data.generationScoreLog10, runtime.state.scoreLog10);
  runtime.state.generationScore = generationScore.value;
  runtime.state.generationScoreLog10 = generationScore.log;
  runtime.hydrateExactIntegerState(
    runtime.state,
    "verticesExact",
    "vertices",
    data.verticesExact,
    data.vertices,
    3n,
  );
  runtime.hydrateExactIntegerState(
    runtime.state,
    "ic8VertexUpgradeLevelExact",
    "ic8VertexUpgradeLevel",
    data.ic8VertexUpgradeLevelExact,
    data.ic8VertexUpgradeLevel,
  );
  runtime.hydrateExactIntegerState(
    runtime.state,
    "speedLevelExact",
    "speedLevel",
    data.speedLevelExact,
    data.speedLevel,
  );
  runtime.hydrateExactIntegerState(
    runtime.state,
    "gainLevelExact",
    "gainLevel",
    data.gainLevelExact,
    data.gainLevel,
  );
  const currentGain = runtime.hydrateLogResource(data.currentGain, data.currentGainLog10, 0);
  runtime.state.currentGain = currentGain.value || 1;
  runtime.state.currentGainLog10 = Math.max(0, currentGain.log);
  runtime.state.pointProgress = ((runtime.sanitizeNumber(data.pointProgress, 0) % 1) + 1) % 1;
  runtime.state.totalVertexProgress = runtime.sanitizeNumber(
    data.totalVertexProgress,
    runtime.state.pointProgress * runtime.numberFromExactInteger(
      runtime.currentExactIntegerState(runtime.state, "verticesExact", "vertices", 3n),
    ),
  );
  runtime.state.lastVertexIndex = Math.floor(runtime.sanitizeNumber(data.lastVertexIndex, Math.floor(runtime.state.totalVertexProgress)));
  runtime.state.generationCount = Math.floor(runtime.sanitizeNumber(data.generationCount, 0));
  const previousGenerationScore = runtime.hydrateLogResource(
    data.previousGenerationScore,
    data.previousGenerationScoreLog10,
    runtime.state.generationCount > 0 ? runtime.log10Value(runtime.GENERATION_UNLOCK_SCORE) : -Infinity,
  );
  runtime.state.previousGenerationScore = previousGenerationScore.value;
  runtime.state.previousGenerationScoreLog10 = previousGenerationScore.log;
  const savedGenerationMultiplierLog = runtime.sanitizeLog10(data.generationScoreMultiplierLog10, null);
  runtime.state.generationScoreMultiplierLog10 = savedGenerationMultiplierLog === null
    ? runtime.log10Value(runtime.sanitizeNumber(data.generationScoreMultiplier, 1, 1))
    : savedGenerationMultiplierLog;
  runtime.state.generationScoreMultiplier = runtime.valueFromLog10(runtime.state.generationScoreMultiplierLog10);
  const savedGenerationCostFactor = runtime.sanitizeNumber(
    data.generationCostFactor,
    1,
    runtime.GENERATION_MIN_NEW_COST_FACTOR,
  );
  runtime.state.generationCostFactor = Math.max(
    runtime.GENERATION_MIN_NEW_COST_FACTOR,
    Math.min(1, savedGenerationCostFactor),
  );
  const savedInfinityUpgradeMask = Math.floor(Number(data.infinityUpgradeMask) || 0);
  if ((savedInfinityUpgradeMask & (1 << 9)) !== 0) {
    const parsedGenerationCostFactor = runtime.parseSavedNumber(data.generationCostFactor);
    if (Number.isFinite(parsedGenerationCostFactor)) {
      runtime.state.generationCostFactor = Math.max(0.70, Math.min(1, parsedGenerationCostFactor));
    }
  }
  runtime.state.coreBoostCount = Math.floor(runtime.sanitizeNumber(data.coreBoostCount, 0));
  runtime.hydrateExactIntegerState(
    runtime.state,
    "infinityCountExact",
    "infinityCount",
    data.infinityCountExact,
    data.infinityCount,
  );
  runtime.hydrateExactIntegerState(
    runtime.state,
    "eternityCountExact",
    "eternityCount",
    data.eternityCountExact,
    data.eternityCount,
  );
  runtime.state.scoreTfClaims = runtime.normalizeTimelineClaimCount?.(data.scoreTfClaims, 0) ?? 0;
  runtime.state.ipTfClaims = runtime.normalizeTimelineClaimCount?.(data.ipTfClaims, 0) ?? 0;
  runtime.state.eternityTfClaims = runtime.normalizeTimelineClaimCount?.(data.eternityTfClaims, 0) ?? 0;
  runtime.state.timelinePurchasedNodes = runtime.normalizeTimelinePurchasedNodes?.(data.timelinePurchasedNodes) ?? [];
  runtime.state.timelineParallelSecondsSinceIc8Clear = runtime.normalizeTimelineSeconds?.(
    data.timelineParallelSecondsSinceIc8Clear,
  ) ?? 0;
  runtime.state.eternityMilestoneMask = runtime.normalizeEternityMilestoneMask?.(data.eternityMilestoneMask) ?? 0;
  runtime.state.eternityMilestoneChoice = runtime.normalizeEternityMilestoneChoice?.(data.eternityMilestoneChoice) || "";
  const infiniteAngleFreeLevel = runtime.eternityMilestoneActive?.("1-3") === true ? 5 : 0;
  const legacyInfiniteAngleFreeLevel = saveVersion < 11 ? infiniteAngleFreeLevel : 0;
  const normalizeInfiniteAngleLevel = (value) => Math.max(
    0,
    Math.floor(runtime.sanitizeNumber(value, 0)) - legacyInfiniteAngleFreeLevel,
  );
  const infinityPoints = runtime.hydrateLogResource(data.infinityPoints, data.infinityPointsLog10, -Infinity, true);
  runtime.state.infinityPoints = infinityPoints.value;
  runtime.state.infinityPointsLog10 = infinityPoints.log;
  runtime.state.infinityPointsExact = typeof data.infinityPointsExact === "string" ? data.infinityPointsExact : "";
  const infiniteScore = runtime.hydrateLogResource(data.infiniteScore, data.infiniteScoreLog10);
  runtime.state.infiniteScore = infiniteScore.value;
  runtime.state.infiniteScoreLog10 = infiniteScore.log;
  runtime.state.infinityUpgradeMask = Math.floor(runtime.sanitizeNumber(data.infinityUpgradeMask, 0));
  if (saveVersion < 3) {
    const refundLog = legacyInfinityUpgradeRefundLog10(data);
    if (refundLog > -Infinity) {
      runtime.normalizeInfinityPointState();
      runtime.syncInfinityPointCachesFromExact(
        runtime.currentExactInfinityPoints() + runtime.exactInfinityPointsFromLog10(refundLog),
      );
    }
    runtime.state.infinityUpgradeMask = 0;
  }
  runtime.normalizeInfinityPointState();
  if (saveVersion === 9) {
    if (runtime.currentExactInfinityPoints() > VERSION_9_INFINITY_POINT_CAP) {
      runtime.syncInfinityPointCachesFromExact(VERSION_9_INFINITY_POINT_CAP);
    }
    runtime.state.infiniteScore = 0;
    runtime.state.infiniteScoreLog10 = -Infinity;
  }
  const legacyInfiniteAngleUnlocked = saveVersion >= 10 && (
    infiniteScore.log > -Infinity
    || runtime.sanitizeNumber(data.infiniteAngleUpgradeLevel, 0) > 0
  );
  runtime.state.infiniteAngleUnlocked = runtime.sanitizeBoolean(data.infiniteAngleUnlocked, legacyInfiniteAngleUnlocked);
  runtime.state.infiniteAngleSpeedLevel = normalizeInfiniteAngleLevel(data.infiniteAngleSpeedLevel);
  runtime.state.infiniteAngleVertexLevel = Math.min(
    Math.max(0, runtime.MAX_RENDERED_VERTICES - 3 - infiniteAngleFreeLevel),
    normalizeInfiniteAngleLevel(data.infiniteAngleVertexLevel),
  );
  runtime.state.infiniteAngleGainLevel = normalizeInfiniteAngleLevel(data.infiniteAngleGainLevel);
  const infiniteAngleCurrentGain = runtime.hydrateLogResource(
    data.infiniteAngleCurrentGain,
    data.infiniteAngleCurrentGainLog10,
    0,
  );
  runtime.state.infiniteAngleCurrentGain = infiniteAngleCurrentGain.value || 1;
  runtime.state.infiniteAngleCurrentGainLog10 = Math.max(0, infiniteAngleCurrentGain.log);
  runtime.state.infiniteAnglePointProgress = ((runtime.sanitizeNumber(data.infiniteAnglePointProgress, 0) % 1) + 1) % 1;
  const infiniteAngleVertexCount = runtime.infiniteAngleVertexCount?.()
    ?? Math.max(3, runtime.state.infiniteAngleVertexLevel + 3);
  const loadedInfiniteAngleProgress = Math.max(
    0,
    runtime.sanitizeNumber(
      data.infiniteAngleTotalVertexProgress,
      runtime.state.infiniteAnglePointProgress * infiniteAngleVertexCount,
    ),
  );
  runtime.state.infiniteAngleTotalVertexProgress = loadedInfiniteAngleProgress > runtime.MAX_VERTEX_PROGRESS_TRACKED
    ? loadedInfiniteAngleProgress % infiniteAngleVertexCount
    : loadedInfiniteAngleProgress;
  runtime.state.infiniteAngleLastVertexIndex = Math.max(0, Math.floor(runtime.sanitizeNumber(data.infiniteAngleLastVertexIndex, 0)));
  runtime.state.towerFloor = Math.max(0, Math.floor(runtime.sanitizeNumber(data.towerFloor, 0)));
  runtime.state.ipGainUpgradeLevel = 0;
  runtime.state.infiniteAngleUpgradeLevel = 0;
  runtime.state.softcapUpgradeLevel = 0;
  runtime.state.activeChallenge = Math.min(runtime.INFINITY_CHALLENGE_COUNT, Math.floor(runtime.sanitizeNumber(data.activeChallenge, 0)));
  runtime.state.completedChallenges = Math.floor(runtime.sanitizeNumber(data.completedChallenges, 0));
  runtime.state.activeChallengeTime = Math.max(0, runtime.sanitizeNumber(data.activeChallengeTime, 0));
  runtime.state.activeTowerChallenge = Math.min(
    runtime.TOWER_CHALLENGE_COUNT,
    Math.floor(runtime.sanitizeNumber(data.activeTowerChallenge, 0)),
  );
  runtime.state.completedTowerChallenges = Math.floor(runtime.sanitizeNumber(data.completedTowerChallenges, 0))
    & ((1 << runtime.TOWER_CHALLENGE_COUNT) - 1);
  runtime.state.activeTowerChallengeTime = Math.max(0, runtime.sanitizeNumber(data.activeTowerChallengeTime, 0));
  runtime.state.tc4BaseGainLevel = Math.floor(runtime.sanitizeNumber(data.tc4BaseGainLevel, 0));
  runtime.state.tc4BaseGainPriceStep = Math.floor(runtime.sanitizeNumber(data.tc4BaseGainPriceStep, 0));
  runtime.state.tc4InfinityScoreVertexGainLevel = Math.floor(runtime.sanitizeNumber(data.tc4InfinityScoreVertexGainLevel, 0));
  runtime.state.tc4InfinityScoreVertexGainPriceStep = Math.floor(runtime.sanitizeNumber(data.tc4InfinityScoreVertexGainPriceStep, 0));
  runtime.state.tc4FreeCoreBoostLevel = Math.floor(runtime.sanitizeNumber(data.tc4FreeCoreBoostLevel, 0));
  runtime.state.tc4FreeCoreBoostPriceStep = Math.floor(runtime.sanitizeNumber(data.tc4FreeCoreBoostPriceStep, 0));
  runtime.state.fastestInfinityChallengeTimes = sanitizeChallengeTimes(
    data.fastestInfinityChallengeTimes,
    runtime.INFINITY_CHALLENGE_COUNT,
  );
  runtime.state.fastestTowerChallengeTimes = sanitizeChallengeTimes(
    data.fastestTowerChallengeTimes,
    runtime.TOWER_CHALLENGE_COUNT,
  );
  if (saveVersion < 7) {
    if (runtime.state.activeChallenge > 0) {
      runtime.resetBelowInfinity();
      runtime.state.activeChallenge = 0;
      runtime.state.activeChallengeTime = 0;
    }
    runtime.state.completedChallenges = 0;
  }
  if (
    runtime.state.activeTowerChallenge > 0
    && (!runtime.towerChallengeImplemented?.(runtime.state.activeTowerChallenge)
      || !runtime.towerChallengeUnlocked?.(runtime.state.activeTowerChallenge))
  ) {
    runtime.resetBelowInfinity();
    runtime.state.activeTowerChallenge = 0;
    runtime.state.activeTowerChallengeTime = 0;
  }
  runtime.normalizeTowerChallenge4State?.();
  runtime.state.infiniteCapBroken = Boolean(data.infiniteCapBroken);
  const loadedAchievementMask = Math.floor(runtime.sanitizeNumber(data.achievementMask, 0));
  if (saveVersion < 4) {
    const preservedMask = (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 5);
    runtime.state.achievementMask = loadedAchievementMask & preservedMask;
    if ((loadedAchievementMask & (1 << 7)) !== 0) runtime.state.achievementMask |= 1 << 6;
  } else if (saveVersion < 9) {
    const through23Mask = (1 << 23) - 1;
    runtime.state.achievementMask = loadedAchievementMask & through23Mask;
    if ((loadedAchievementMask & (1 << (25 - 1))) !== 0) runtime.state.achievementMask |= 1 << (25 - 1);
    if ((loadedAchievementMask & (1 << (24 - 1))) !== 0) runtime.state.achievementMask |= 1 << (30 - 1);
  } else {
    runtime.state.achievementMask = loadedAchievementMask;
  }
  const loadedAchievementMaskHigh = runtime.parseSavedNumber(data.achievementMaskHigh);
  runtime.state.achievementMaskHigh = Number.isFinite(loadedAchievementMaskHigh)
    && loadedAchievementMaskHigh >= -2147483648
    && loadedAchievementMaskHigh <= 0xffffffff
    ? Math.floor(loadedAchievementMaskHigh) >>> 0
    : 0;
  runtime.state.totalPlayTime = runtime.sanitizeNumber(data.totalPlayTime, 0);
  runtime.state.totalRealPlayTime = runtime.sanitizeNumber(data.totalRealPlayTime, 0);
  runtime.state.currentInfinityRunTime = runtime.sanitizeNumber(data.currentInfinityRunTime, 0);
  runtime.state.currentInfinityRealTime = runtime.sanitizeNumber(data.currentInfinityRealTime, 0);
  runtime.state.fastestInfinityTime = runtime.sanitizeNumber(data.fastestInfinityTime, 0);
  runtime.state.fastestInfinityRealTime = runtime.sanitizeNumber(data.fastestInfinityRealTime, 0);
  runtime.state.lastInfinityRuns = runtime.sanitizeInfinityRunRecords(data.lastInfinityRuns);
  runtime.state.currentEternityRunTime = runtime.sanitizeNumber(data.currentEternityRunTime, 0);
  runtime.state.currentEternityRealTime = runtime.sanitizeNumber(data.currentEternityRealTime, 0);
  runtime.state.fastestEternityTime = runtime.sanitizeNumber(data.fastestEternityTime, 0);
  runtime.state.fastestEternityRealTime = runtime.sanitizeNumber(data.fastestEternityRealTime, 0);
  runtime.state.lastEternityRuns = runtime.sanitizeEternityRunRecords(data.lastEternityRuns);
  runtime.state.bestInfinityCountPerSecond = Math.max(
    0,
    runtime.sanitizeNumber(data.bestInfinityCountPerSecond, 0),
  );
  runtime.state.infinityCountRateRemainder = Math.max(
    0,
    Math.min(0.9999999999999999, runtime.sanitizeNumber(data.infinityCountRateRemainder, 0)),
  );
  runtime.state.offlineProgressEnabled = runtime.sanitizeBoolean(data.offlineProgressEnabled, true);
  runtime.state.offlineTickCount = clampOfflineTickCount(data.offlineTickCount);
  runtime.state.timeFluxCapacityLevel = dormantTimeFluxValue(data.timeFluxCapacityLevel, 0);
  runtime.state.timeFluxGainLevel = dormantTimeFluxValue(data.timeFluxGainLevel, 0);
  runtime.state.timeFlux = dormantTimeFluxValue(data.timeFlux, 0);
  const loadedTimeFluxSpeed = dormantTimeFluxValue(data.timeFluxSpeed, 1);
  const hasCustomTimeFluxSpeed = Object.prototype.hasOwnProperty.call(data, "timeFluxCustomSpeed");
  const loadedCustomTimeFluxSpeed = dormantTimeFluxValue(
    hasCustomTimeFluxSpeed ? data.timeFluxCustomSpeed : Math.max(4, loadedTimeFluxSpeed),
    4,
  );
  runtime.state.timeFluxSpeed = loadedTimeFluxSpeed;
  runtime.state.timeFluxCustomSpeed = loadedCustomTimeFluxSpeed;
  runtime.state.automationEnabled = runtime.sanitizeBoolean(data.automationEnabled, false);
  runtime.state.autoBuySpeed = runtime.sanitizeBoolean(data.autoBuySpeed, true);
  runtime.state.autoBuyVertex = runtime.sanitizeBoolean(data.autoBuyVertex, true);
  runtime.state.autoBuyGain = runtime.sanitizeBoolean(data.autoBuyGain, true);
  runtime.state.autoBuyInfinityUpgrades = runtime.sanitizeBoolean(data.autoBuyInfinityUpgrades, false);
  runtime.state.autoBuyInfiniteAngleSpeed = runtime.sanitizeBoolean(data.autoBuyInfiniteAngleSpeed, false);
  runtime.state.autoBuyInfiniteAngleVertex = runtime.sanitizeBoolean(data.autoBuyInfiniteAngleVertex, false);
  runtime.state.autoBuyInfiniteAngleGain = runtime.sanitizeBoolean(data.autoBuyInfiniteAngleGain, false);
  runtime.state.autoBuildTower = runtime.sanitizeBoolean(data.autoBuildTower, false);
  runtime.state.autoRunGeneration = runtime.sanitizeBoolean(data.autoRunGeneration, false);
  const legacyScoreThreshold = Math.max(0, runtime.sanitizeNumber(data.autoGenerationScoreThreshold, 10));
  const legacyCostThreshold = Math.max(0, runtime.sanitizeNumber(data.autoGenerationCostThreshold, 1));
  const legacyCostDenominator = 1 - legacyCostThreshold / 100;
  const hasGenerationScoreMultiplierThreshold = Object.prototype.hasOwnProperty.call(
    data,
    "autoGenerationScoreMultiplierThreshold",
  );
  const hasGenerationCostMultiplierThreshold = Object.prototype.hasOwnProperty.call(
    data,
    "autoGenerationCostMultiplierThreshold",
  );
  const legacyGenerationMode = runtime.normalizeChoice(data.autoGenerationMode, ["or", "and"], "or");
  const isLegacyGenerationAutomationSave = !hasGenerationScoreMultiplierThreshold
    && !hasGenerationCostMultiplierThreshold;
  const migratedGenerationCostMultiplierThreshold = legacyCostDenominator > 0
    ? 1 / legacyCostDenominator
    : 1e12;
  runtime.state.autoGenerationScoreMultiplierThreshold = Math.max(
    0,
    runtime.sanitizeNumber(
      data.autoGenerationScoreMultiplierThreshold,
      hasGenerationScoreMultiplierThreshold
        ? 2
        : Object.prototype.hasOwnProperty.call(data, "autoGenerationScoreThreshold")
          ? 1 + legacyScoreThreshold / 100
          : 2,
    ),
  );
  runtime.state.autoGenerationCostMultiplierThreshold = Math.max(
    0,
    runtime.sanitizeNumber(
      data.autoGenerationCostMultiplierThreshold,
      hasGenerationCostMultiplierThreshold
        ? 1
        : Object.prototype.hasOwnProperty.call(data, "autoGenerationCostThreshold")
          ? migratedGenerationCostMultiplierThreshold
          : 1,
    ),
  );
  runtime.state.autoGenerationMinimumSeconds = Math.max(0, runtime.sanitizeNumber(data.autoGenerationMinimumSeconds, 0));
  runtime.state.autoGenerationLegacyOrMode = runtime.sanitizeBoolean(
    data.autoGenerationLegacyOrMode,
    isLegacyGenerationAutomationSave && legacyGenerationMode === "or",
  );
  runtime.state.autoRunCoreBoost = runtime.sanitizeBoolean(data.autoRunCoreBoost, false);
  runtime.state.autoRunInfinity = runtime.sanitizeBoolean(data.autoRunInfinity, false);
  const savedAutoInfinityPointThresholdLog10 = runtime.sanitizeLog10(
    data.autoInfinityPointThresholdLog10,
    null,
  );
  const autoInfinityPointThresholdLog10 = Math.max(
    0,
    savedAutoInfinityPointThresholdLog10 === null
      ? runtime.parseUiLogNumber(data.autoInfinityPointThreshold, runtime.log10Value(10))
      : savedAutoInfinityPointThresholdLog10,
  );
  runtime.state.autoInfinityPointThresholdLog10 = autoInfinityPointThresholdLog10;
  runtime.state.autoInfinityPointThreshold = runtime.valueFromLog10(autoInfinityPointThresholdLog10);
  runtime.state.currentGenerationRunTime = Math.max(0, runtime.sanitizeNumber(data.currentGenerationRunTime, 0));
  runtime.state.ic8VertexDecayElapsed = runtime.sanitizeNumber(data.ic8VertexDecayElapsed, 0);
  runtime.state.noGenerationCoreBoostReached = Boolean(data.noGenerationCoreBoostReached);
  runtime.state.currentInfinityRunHadGeneration = runtime.sanitizeBoolean(
    data.currentInfinityRunHadGeneration,
    runtime.state.generationCount > 0,
  );
  runtime.state.currentInfinityRunHadCoreBoost = runtime.sanitizeBoolean(
    data.currentInfinityRunHadCoreBoost,
    runtime.state.coreBoostCount > (runtime.hasInfinityUpgrade("10-1") ? 2 : 0),
  );
  if (runtime.state.activeChallenge > 0 && !runtime.infinityChallengesUnlocked()) {
    runtime.resetBelowInfinity();
    runtime.state.activeChallenge = 0;
    runtime.state.activeChallengeTime = 0;
  }
  const currentVertices = runtime.currentExactIntegerState(runtime.state, "verticesExact", "vertices", 3n);
  if (runtime.state.activeChallenge === 2 && currentVertices > 200n) {
    runtime.setExactIntegerState(runtime.state, "verticesExact", "vertices", 200n);
    runtime.resetVertexProgress();
  }
  if (runtime.state.activeChallenge === 8) {
    if (
      !Object.hasOwn(data, "ic8VertexUpgradeLevel")
      && !Object.hasOwn(data, "ic8VertexUpgradeLevelExact")
      && currentVertices > 3n
    ) {
      runtime.setExactIntegerState(
        runtime.state,
        "ic8VertexUpgradeLevelExact",
        "ic8VertexUpgradeLevel",
        currentVertices - 3n,
      );
    }
    if (currentVertices !== 3n) {
      runtime.setExactIntegerState(runtime.state, "verticesExact", "vertices", 3n);
    }
    runtime.resetVertexProgress();
  } else if (runtime.currentExactIntegerState(
    runtime.state,
    "ic8VertexUpgradeLevelExact",
    "ic8VertexUpgradeLevel",
  ) !== 0n) {
    runtime.setExactIntegerState(runtime.state, "ic8VertexUpgradeLevelExact", "ic8VertexUpgradeLevel", 0n);
  }
  runtime.state.showFloatingText = data.showFloatingText !== false;
  runtime.state.lightEffects = Boolean(data.lightEffects);
  runtime.state.showFps = Boolean(data.showFps);
  runtime.state.language = runtime.normalizeChoice(data.language, ["ja", "en"], "ja");
  runtime.state.numberFormat = runtime.normalizeChoice(data.numberFormat, ["compact", "scientific", "detailed"], data.detailedNumbers ? "detailed" : "compact");
  runtime.state.timeUnit = runtime.normalizeChoice(data.timeUnit, ["auto", "seconds", "milliseconds"], "auto");
  runtime.state.topBarMode = runtime.normalizeChoice(data.topBarMode, ["news", "resources", "progress", "blank", "hidden"], "news");
  runtime.state.mainTabPosition = runtime.normalizeChoice(data.mainTabPosition, ["right", "bottom"], "right");
  runtime.state.showTimeFluxQuickBar = data.showTimeFluxQuickBar !== false;
  runtime.state.skipTimelineRespecConfirmation = runtime.sanitizeBoolean(
    data.skipTimelineRespecConfirmation,
    false,
  );
  runtime.state.hiddenTabs = runtime.normalizeHiddenTabs(data.hiddenTabs);
  runtime.state.unlockedMainTabs = runtime.normalizeUnlockedMainTabs(data.unlockedMainTabs);
  inferUnlockedMainTabs(data);
  const lastEarned = runtime.hydrateLogResource(data.lastEarned, data.lastEarnedLog10);
  runtime.state.lastEarned = lastEarned.value;
  runtime.state.lastEarnedLog10 = lastEarned.log;
  runtime.state.floatingTexts = [];
}

function normalizedSavedVertices(data) {
  const savedExact = runtime.parseExactInteger(data && data.verticesExact, null);
  const legacy = runtime.parseExactInteger(data && data.vertices, 3n);
  const raw = savedExact === null ? legacy : savedExact;
  return raw < 3n ? 3n : raw;
}

function loadedTowerChallengeIsInvalid(data) {
  const activeTowerChallenge = Math.min(
    runtime.TOWER_CHALLENGE_COUNT || 0,
    Math.max(0, Math.floor(runtime.sanitizeNumber(data && data.activeTowerChallenge, 0))),
  );
  return activeTowerChallenge > 0
    && (!runtime.towerChallengeImplemented?.(activeTowerChallenge)
      || !runtime.towerChallengeUnlocked?.(activeTowerChallenge));
}

function restoreVerticesAfterLoad(data) {
  if (
    runtime.state.activeChallenge === 2
    || runtime.state.activeChallenge === 8
    || loadedTowerChallengeIsInvalid(data)
  ) return;
  runtime.setExactIntegerState(
    runtime.state,
    "verticesExact",
    "vertices",
    normalizedSavedVertices(data),
  );
  if (runtime.state.totalVertexProgress > runtime.MAX_VERTEX_PROGRESS_TRACKED) {
    runtime.normalizeVertexProgress();
  }
  const vertices = runtime.numberFromExactInteger(
    runtime.currentExactIntegerState(runtime.state, "verticesExact", "vertices", 3n),
  );
  runtime.state.lastVertexIndex = Math.floor(runtime.state.pointProgress * vertices) % vertices;
}

function applySaveData(data, saveVersion = runtime.SAVE_VERSION) {
  const snapshot = snapshotRuntimeState();
  try {
    applySaveDataUnsafe(data, saveVersion);
    runtime.normalizeEternityMilestoneCompletionState?.();
    runtime.applyStartingCoreBoosts();
    restoreVerticesAfterLoad(data);
  } catch (error) {
    restoreRuntimeState(snapshot);
    throw error;
  }
}

function serializeSaveData() {
  runtime.normalizeInfinityPointState();
  runtime.normalizeTowerChallenge4State?.();
  runtime.normalizeTimelineState?.();
  [
    ["verticesExact", "vertices"],
    ["ic8VertexUpgradeLevelExact", "ic8VertexUpgradeLevel"],
    ["speedLevelExact", "speedLevel"],
    ["gainLevelExact", "gainLevel"],
    ["infinityCountExact", "infinityCount"],
    ["eternityCountExact", "eternityCount"],
  ].forEach(([exactField, valueField]) => {
    runtime.currentExactIntegerState(runtime.state, exactField, valueField);
  });
  runtime.state.achievementMaskHigh = ((Number(runtime.state.achievementMaskHigh) || 0) >>> 0);
  runtime.state.unlockedMainTabs = runtime.normalizeUnlockedMainTabs(runtime.state.unlockedMainTabs);
  const data = {};
  runtime.SAVE_FIELDS.forEach((field) => {
    data[field] = runtime.state[field];
  });
  const savedAt = runtime.localClockNowMs ? runtime.localClockNowMs() : Date.now();
  const saveData = {
    version: runtime.SAVE_VERSION,
    savedAt,
    state: data,
  };
  // Browser storage is user-controlled, so serverSavedAt is preferred when a server clock is available.
  if (runtime.serverClockAvailable?.() && runtime.serverClockNowMs) {
    saveData.serverSavedAt = runtime.serverClockNowMs();
  }
  return saveData;
}


export { normalizeStoredSave, legacyInfinityUpgradeRefundLog10, applySaveData, serializeSaveData, snapshotRuntimeState, restoreRuntimeState };
