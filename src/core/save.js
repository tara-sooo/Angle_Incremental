import { runtime, expose } from "../runtime/shared.js";

// Save migration, hydration, local persistence, and reset behavior.

const VERSION_9_INFINITY_POINT_CAP = 10_000_000_000n;

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

function ic8VertexUpgradeLevelLimit() {
  return runtime.MAX_GAME_VERTICES || 1_000_000_000_000;
}

function applySaveData(data, saveVersion = runtime.SAVE_VERSION) {
  const score = runtime.hydrateLogResource(data.score, data.scoreLog10);
  runtime.state.score = score.value;
  runtime.state.scoreLog10 = score.log;
  const totalScore = runtime.hydrateLogResource(data.totalScore, data.totalScoreLog10, runtime.state.scoreLog10);
  runtime.state.totalScore = totalScore.value;
  runtime.state.totalScoreLog10 = totalScore.log;
  const generationScore = runtime.hydrateLogResource(data.generationScore, data.generationScoreLog10, runtime.state.scoreLog10);
  runtime.state.generationScore = generationScore.value;
  runtime.state.generationScoreLog10 = generationScore.log;
  runtime.state.vertices = Math.min(runtime.MAX_RENDERED_VERTICES, Math.max(3, Math.floor(runtime.sanitizeNumber(data.vertices, 3, 3))));
  runtime.state.ic8VertexUpgradeLevel = Math.max(0, Math.floor(runtime.sanitizeNumber(data.ic8VertexUpgradeLevel, 0)));
  runtime.state.speedLevel = Math.floor(runtime.sanitizeNumber(data.speedLevel, 0));
  runtime.state.gainLevel = Math.floor(runtime.sanitizeNumber(data.gainLevel, 0));
  const currentGain = runtime.hydrateLogResource(data.currentGain, data.currentGainLog10, 0);
  runtime.state.currentGain = currentGain.value || 1;
  runtime.state.currentGainLog10 = Math.max(0, currentGain.log);
  runtime.state.pointProgress = ((runtime.sanitizeNumber(data.pointProgress, 0) % 1) + 1) % 1;
  runtime.state.totalVertexProgress = runtime.sanitizeNumber(data.totalVertexProgress, runtime.state.pointProgress * runtime.state.vertices);
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
  runtime.state.generationCostFactor = Math.max(
    runtime.GENERATION_MIN_NEW_COST_FACTOR,
    Math.min(1, runtime.sanitizeNumber(data.generationCostFactor, 1, runtime.GENERATION_MIN_NEW_COST_FACTOR)),
  );
  runtime.state.coreBoostCount = Math.floor(runtime.sanitizeNumber(data.coreBoostCount, 0));
  runtime.state.infinityCount = Math.floor(runtime.sanitizeNumber(data.infinityCount, 0));
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
  runtime.state.infiniteAngleSpeedLevel = Math.max(0, Math.floor(runtime.sanitizeNumber(data.infiniteAngleSpeedLevel, 0)));
  runtime.state.infiniteAngleVertexLevel = Math.min(
    runtime.MAX_RENDERED_VERTICES - 3,
    Math.max(0, Math.floor(runtime.sanitizeNumber(data.infiniteAngleVertexLevel, 0))),
  );
  runtime.state.infiniteAngleGainLevel = Math.max(0, Math.floor(runtime.sanitizeNumber(data.infiniteAngleGainLevel, 0)));
  const infiniteAngleCurrentGain = runtime.hydrateLogResource(
    data.infiniteAngleCurrentGain,
    data.infiniteAngleCurrentGainLog10,
    0,
  );
  runtime.state.infiniteAngleCurrentGain = infiniteAngleCurrentGain.value || 1;
  runtime.state.infiniteAngleCurrentGainLog10 = Math.max(0, infiniteAngleCurrentGain.log);
  runtime.state.infiniteAnglePointProgress = ((runtime.sanitizeNumber(data.infiniteAnglePointProgress, 0) % 1) + 1) % 1;
  const infiniteAngleVertexCount = Math.max(3, runtime.state.infiniteAngleVertexLevel + 3);
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
  if (saveVersion < 7) {
    if (runtime.state.activeChallenge > 0) {
      runtime.resetBelowInfinity();
      runtime.state.activeChallenge = 0;
    }
    runtime.state.completedChallenges = 0;
  }
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
  runtime.state.totalPlayTime = runtime.sanitizeNumber(data.totalPlayTime, 0);
  runtime.state.currentInfinityRunTime = runtime.sanitizeNumber(data.currentInfinityRunTime, 0);
  runtime.state.fastestInfinityTime = runtime.sanitizeNumber(data.fastestInfinityTime, 0);
  runtime.state.lastInfinityRuns = runtime.sanitizeInfinityRunRecords(data.lastInfinityRuns);
  runtime.state.automationEnabled = runtime.sanitizeBoolean(data.automationEnabled, false);
  runtime.state.autoBuySpeed = runtime.sanitizeBoolean(data.autoBuySpeed, true);
  runtime.state.autoBuyVertex = runtime.sanitizeBoolean(data.autoBuyVertex, true);
  runtime.state.autoBuyGain = runtime.sanitizeBoolean(data.autoBuyGain, true);
  runtime.state.autoCompleteChallenges = runtime.sanitizeBoolean(data.autoCompleteChallenges, false);
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
  runtime.state.autoInfinityPointThreshold = Math.max(1, runtime.sanitizeNumber(data.autoInfinityPointThreshold, 10));
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
  }
  if (runtime.state.activeChallenge === 2 && runtime.state.vertices > 200) {
    runtime.state.vertices = 200;
    runtime.resetVertexProgress();
  }
  if (runtime.state.activeChallenge === 8) {
    if (!Object.hasOwn(data, "ic8VertexUpgradeLevel") && runtime.state.vertices > 3) {
      runtime.state.ic8VertexUpgradeLevel = runtime.state.vertices - 3;
    }
    if (runtime.state.vertices !== 3) runtime.state.vertices = 3;
    if (runtime.state.ic8VertexUpgradeLevel > ic8VertexUpgradeLevelLimit()) {
      runtime.state.ic8VertexUpgradeLevel = ic8VertexUpgradeLevelLimit();
    }
    runtime.resetVertexProgress();
  } else if (runtime.state.ic8VertexUpgradeLevel !== 0) {
    runtime.state.ic8VertexUpgradeLevel = 0;
  }
  runtime.state.showFloatingText = data.showFloatingText !== false;
  runtime.state.lightEffects = Boolean(data.lightEffects);
  runtime.state.showFps = Boolean(data.showFps);
  runtime.state.language = runtime.normalizeChoice(data.language, ["ja", "en"], "ja");
  runtime.state.numberFormat = runtime.normalizeChoice(data.numberFormat, ["compact", "scientific", "detailed"], data.detailedNumbers ? "detailed" : "compact");
  runtime.state.timeUnit = runtime.normalizeChoice(data.timeUnit, ["auto", "seconds", "milliseconds"], "auto");
  runtime.state.topBarMode = runtime.normalizeChoice(data.topBarMode, ["news", "resources", "progress", "blank", "hidden"], "news");
  const lastEarned = runtime.hydrateLogResource(data.lastEarned, data.lastEarnedLog10);
  runtime.state.lastEarned = lastEarned.value;
  runtime.state.lastEarnedLog10 = lastEarned.log;
  runtime.state.floatingTexts = [];
}

function serializeSaveData() {
  runtime.normalizeInfinityPointState();
  runtime.state.infinityCount = Math.max(0, Math.floor(runtime.state.infinityCount));
  const data = {};
  runtime.SAVE_FIELDS.forEach((field) => {
    data[field] = runtime.state[field];
  });
  return {
    version: runtime.SAVE_VERSION,
    savedAt: Date.now(),
    state: data,
  };
}

function saveGame(reason = "auto") {
  try {
    localStorage.setItem(runtime.SAVE_KEY, JSON.stringify(serializeSaveData()));
    runtime.autoSaveElapsed = 0;
    runtime.setSaveStatus(reason === "auto" ? runtime.t("savedAuto") : runtime.t("savedManual"));
    return true;
  } catch (error) {
    runtime.autoSaveElapsed = 0;
    runtime.setSaveStatus(runtime.t("saveFailed"));
    return false;
  }
}

function quarantineSave(raw) {
  try {
    if (raw) {
      localStorage.setItem(runtime.SAVE_QUARANTINE_KEY, JSON.stringify({
        quarantinedAt: Date.now(),
        appVersion: runtime.APP_VERSION,
        raw,
      }));
    }
    localStorage.removeItem(runtime.SAVE_KEY);
  } catch (error) {
    // Quarantine failure should not prevent the game from opening.
  }
}

function loadGame() {
  let raw = null;
  try {
    raw = localStorage.getItem(runtime.SAVE_KEY);
    if (!raw) {
      runtime.setSaveStatus(runtime.t("noSave"));
      return;
    }

    const parsed = JSON.parse(raw);
    if (!parsed.version || parsed.version > runtime.SAVE_VERSION || !parsed.state || typeof parsed.state !== "object") {
      quarantineSave(raw);
      runtime.setSaveStatus(runtime.t("oldSave"));
      return;
    }

    applySaveData(parsed.state, parsed.version);
    runtime.autoSaveElapsed = 0;
    runtime.setSaveStatus(runtime.t("loaded"));
  } catch (error) {
    quarantineSave(raw);
    runtime.setSaveStatus(runtime.t("loadFailed"));
  }
}

function resetSave() {
  const confirmed = window.confirm(runtime.t("resetConfirm"));
  if (!confirmed) return;
  localStorage.removeItem(runtime.SAVE_KEY);
  Object.assign(runtime.state, {
    score: 0,
    scoreLog10: -Infinity,
    totalScore: 0,
    totalScoreLog10: -Infinity,
    generationScore: 0,
    generationScoreLog10: -Infinity,
    vertices: 3,
    ic8VertexUpgradeLevel: 0,
    speedLevel: 0,
    gainLevel: 0,
    currentGain: 1,
    currentGainLog10: 0,
    pointProgress: 0,
    totalVertexProgress: 0,
    lastVertexIndex: 0,
    generationCount: 0,
    previousGenerationScore: 0,
    previousGenerationScoreLog10: -Infinity,
    generationScoreMultiplier: 1,
    generationScoreMultiplierLog10: 0,
    generationCostFactor: 1,
    coreBoostCount: 0,
    infinityCount: 0,
    infinityPoints: 0,
    infinityPointsLog10: -Infinity,
    infinityPointsExact: "0",
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
    infinityUpgradeMask: 0,
    ipGainUpgradeLevel: 0,
    infiniteAngleUpgradeLevel: 0,
    softcapUpgradeLevel: 0,
    activeChallenge: 0,
    completedChallenges: 0,
    infiniteCapBroken: false,
    achievementMask: 0,
    totalPlayTime: 0,
    currentInfinityRunTime: 0,
    fastestInfinityTime: 0,
    lastInfinityRuns: [],
    automationEnabled: false,
    autoBuySpeed: true,
    autoBuyVertex: true,
    autoBuyGain: true,
    autoCompleteChallenges: false,
    autoRunGeneration: false,
    autoGenerationScoreMultiplierThreshold: 2,
    autoGenerationCostMultiplierThreshold: 1,
    autoGenerationMinimumSeconds: 0,
    autoGenerationLegacyOrMode: false,
    autoRunCoreBoost: false,
    autoRunInfinity: false,
    autoInfinityPointThreshold: 10,
    currentGenerationRunTime: 0,
    ic8VertexDecayElapsed: 0,
    noGenerationCoreBoostReached: false,
    currentInfinityRunHadGeneration: false,
    currentInfinityRunHadCoreBoost: false,
    showFloatingText: true,
    lightEffects: false,
    showFps: false,
    language: "ja",
    numberFormat: "compact",
    timeUnit: "auto",
    topBarMode: "news",
    floatingTexts: [],
    lastEarned: 0,
    lastEarnedLog10: -Infinity,
  });
  runtime.autoSaveElapsed = 0;
  runtime.setSaveStatus(runtime.t("resetDone"));
  runtime.updateUi();
  runtime.draw();
}

expose("legacyInfinityUpgradeRefundLog10", () => legacyInfinityUpgradeRefundLog10, (value) => { legacyInfinityUpgradeRefundLog10 = value; });
expose("applySaveData", () => applySaveData, (value) => { applySaveData = value; });
expose("serializeSaveData", () => serializeSaveData, (value) => { serializeSaveData = value; });
expose("saveGame", () => saveGame, (value) => { saveGame = value; });
expose("quarantineSave", () => quarantineSave, (value) => { quarantineSave = value; });
expose("loadGame", () => loadGame, (value) => { loadGame = value; });
expose("resetSave", () => resetSave, (value) => { resetSave = value; });
