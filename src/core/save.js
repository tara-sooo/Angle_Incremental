import { runtime, expose } from "../runtime/shared.js";

// Save migration, hydration, local persistence, and reset behavior.

const VERSION_9_INFINITY_POINT_CAP = 10_000_000_000n;
let recoveryRevision = 0;
let lastPeriodicCheckpointMonotonicAt = null;

function currentSaveTimestamp() {
  return runtime.localClockNowMs ? runtime.localClockNowMs() : Date.now();
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

function recoveryEntryFromSave(saveData, reason, backedUpAt = currentSaveTimestamp()) {
  return {
    backedUpAt,
    appVersion: runtime.APP_VERSION,
    saveVersion: saveData.version,
    savedAt: saveData.savedAt,
    serverSavedAt: saveData.serverSavedAt || 0,
    reason,
    state: saveData.state,
  };
}

function parseRecoveryEntry(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const saveCandidate = candidate.save && typeof candidate.save === "object"
    ? candidate.save
    : {
      version: candidate.saveVersion,
      savedAt: candidate.savedAt,
      serverSavedAt: candidate.serverSavedAt,
      state: candidate.state,
    };
  const save = normalizeStoredSave(saveCandidate);
  if (!save) return null;
  return {
    backedUpAt: runtime.sanitizeNumber(candidate.backedUpAt, save.savedAt),
    appVersion: typeof candidate.appVersion === "string" ? candidate.appVersion : "",
    saveVersion: save.version,
    savedAt: save.savedAt,
    serverSavedAt: save.serverSavedAt,
    reason: typeof candidate.reason === "string" ? candidate.reason : "backup",
    state: save.state,
    save,
  };
}

function readRecoveryEntry(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parseRecoveryEntry(JSON.parse(raw)) : null;
  } catch (error) {
    return null;
  }
}

function readCheckpointEntries() {
  try {
    const raw = localStorage.getItem(runtime.SAVE_CHECKPOINTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(parseRecoveryEntry).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function writeRecoveryEntry(key, entry) {
  localStorage.setItem(key, JSON.stringify(entry));
  recoveryRevision += 1;
}

function periodicCheckpointDue(saveData, latestPeriodic) {
  const monotonicNow = runtime.monotonicClockNowMs?.();
  if (
    Number.isFinite(monotonicNow)
    && Number.isFinite(lastPeriodicCheckpointMonotonicAt)
    && monotonicNow - lastPeriodicCheckpointMonotonicAt < runtime.SAVE_CHECKPOINT_INTERVAL_MS
  ) {
    return false;
  }

  const currentServerSavedAt = runtime.serverClockAvailable?.() && saveData.serverSavedAt > 0
    ? saveData.serverSavedAt
    : 0;
  const elapsed = currentServerSavedAt > 0 && latestPeriodic.serverSavedAt > 0
    ? currentServerSavedAt - latestPeriodic.serverSavedAt
    : saveData.savedAt - latestPeriodic.savedAt;
  return elapsed < 0 || elapsed >= runtime.SAVE_CHECKPOINT_INTERVAL_MS;
}

function backupCurrentSave(reason = "pre-import", key = runtime.SAVE_PRE_IMPORT_KEY) {
  try {
    const saveData = serializeSaveData();
    writeRecoveryEntry(key, recoveryEntryFromSave(saveData, reason));
    return true;
  } catch (error) {
    runtime.setSaveStatus(runtime.t("saveBackupFailed"));
    return false;
  }
}

function createCheckpoint(reason = "periodic", options = {}) {
  if (runtime.offlineProcessing && reason === "periodic") return false;
  try {
    const saveData = serializeSaveData();
    const entries = readCheckpointEntries();
    const periodic = entries
      .filter((entry) => entry.reason === "periodic")
      .sort((left, right) => right.savedAt - left.savedAt);
    if (
      reason === "periodic"
      && !options.force
      && periodic[0]
      && !periodicCheckpointDue(saveData, periodic[0])
    ) {
      return true;
    }

    const nextEntry = recoveryEntryFromSave(saveData, reason);
    const nextEntries = [nextEntry, ...entries.filter((entry) => entry.reason !== reason || reason === "periodic")];
    const periodicEntries = nextEntries
      .filter((entry) => entry.reason === "periodic")
      .sort((left, right) => right.savedAt - left.savedAt)
      .slice(0, runtime.MAX_PERIODIC_SAVE_CHECKPOINTS);
    const eventEntries = nextEntries
      .filter((entry) => entry.reason !== "periodic")
      .sort((left, right) => right.backedUpAt - left.backedUpAt)
      .slice(0, runtime.MAX_EVENT_SAVE_CHECKPOINTS);
    writeRecoveryEntry(runtime.SAVE_CHECKPOINTS_KEY, [...periodicEntries, ...eventEntries]);
    if (reason === "periodic") {
      const monotonicNow = runtime.monotonicClockNowMs?.();
      lastPeriodicCheckpointMonotonicAt = Number.isFinite(monotonicNow) ? monotonicNow : null;
    }
    return true;
  } catch (error) {
    runtime.setSaveStatus(runtime.t("checkpointSaveFailed"));
    return false;
  }
}

function recoveryEntries() {
  return {
    preImport: readRecoveryEntry(runtime.SAVE_PRE_IMPORT_KEY),
    undo: readRecoveryEntry(runtime.SAVE_RESTORE_UNDO_KEY),
    checkpoints: readCheckpointEntries(),
  };
}

function restoreRecoveryEntry(entry, successMessage = "recoveryRestored") {
  if (!entry?.save) {
    runtime.setSaveStatus(runtime.t("recoveryInvalid"));
    return false;
  }
  const currentSave = serializeSaveData();
  try {
    writeRecoveryEntry(
      runtime.SAVE_RESTORE_UNDO_KEY,
      recoveryEntryFromSave(currentSave, "pre-restore"),
    );
    applySaveData(entry.save.state, entry.save.version);
    if (!runtime.saveGame("manual")) throw new Error("restore save failed");
    runtime.updateUi();
    runtime.draw();
    runtime.setSaveStatus(runtime.t(successMessage));
    return true;
  } catch (error) {
    applySaveData(currentSave.state, currentSave.version);
    if (runtime.setOfflineBaseline) {
      runtime.setOfflineBaseline(currentSave.savedAt, currentSave.serverSavedAt);
    }
    runtime.setSaveStatus(runtime.t("recoveryRestoreFailed"));
    return false;
  }
}

function restorePreImportSave() {
  const entry = readRecoveryEntry(runtime.SAVE_PRE_IMPORT_KEY);
  if (!entry) {
    runtime.setSaveStatus(runtime.t("recoveryInvalid"));
    return false;
  }
  if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm(runtime.t("restorePreImportConfirm"))) {
    return false;
  }
  return restoreRecoveryEntry(entry);
}

function restoreCheckpoint(index) {
  const normalizedIndex = Math.floor(runtime.sanitizeNumber(index, -1));
  const entry = readCheckpointEntries()[normalizedIndex];
  if (!entry) {
    runtime.setSaveStatus(runtime.t("recoveryInvalid"));
    return false;
  }
  if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm(runtime.t("restoreCheckpointConfirm"))) {
    return false;
  }
  return restoreRecoveryEntry(entry);
}

function restoreUndoSave() {
  const entry = readRecoveryEntry(runtime.SAVE_RESTORE_UNDO_KEY);
  if (!entry) {
    runtime.setSaveStatus(runtime.t("recoveryInvalid"));
    return false;
  }
  if (typeof window !== "undefined" && typeof window.confirm === "function" && !window.confirm(runtime.t("restoreUndoConfirm"))) {
    return false;
  }
  return restoreRecoveryEntry(entry, "recoveryUndoRestored");
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

function ic8VertexUpgradeLevelLimit() {
  return runtime.MAX_GAME_VERTICES || 1_000_000_000_000;
}

function sanitizeChallengeTimes(value, count) {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: count }, (_, index) => Math.max(0, runtime.sanitizeNumber(source[index], 0)));
}

function applySaveData(data, saveVersion = runtime.SAVE_VERSION) {
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
  runtime.state.activeChallengeTime = Math.max(0, runtime.sanitizeNumber(data.activeChallengeTime, 0));
  runtime.state.activeTowerChallenge = Math.min(
    runtime.TOWER_CHALLENGE_COUNT,
    Math.floor(runtime.sanitizeNumber(data.activeTowerChallenge, 0)),
  );
  runtime.state.completedTowerChallenges = Math.floor(runtime.sanitizeNumber(data.completedTowerChallenges, 0))
    & ((1 << runtime.TOWER_CHALLENGE_COUNT) - 1);
  runtime.state.activeTowerChallengeTime = Math.max(0, runtime.sanitizeNumber(data.activeTowerChallengeTime, 0));
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
  runtime.state.totalRealPlayTime = runtime.sanitizeNumber(data.totalRealPlayTime, 0);
  runtime.state.currentInfinityRunTime = runtime.sanitizeNumber(data.currentInfinityRunTime, 0);
  runtime.state.currentInfinityRealTime = runtime.sanitizeNumber(data.currentInfinityRealTime, 0);
  runtime.state.fastestInfinityTime = runtime.sanitizeNumber(data.fastestInfinityTime, 0);
  runtime.state.fastestInfinityRealTime = runtime.sanitizeNumber(data.fastestInfinityRealTime, 0);
  runtime.state.lastInfinityRuns = runtime.sanitizeInfinityRunRecords(data.lastInfinityRuns);
  runtime.state.offlineProgressEnabled = runtime.sanitizeBoolean(
    data.offlineProgressEnabled,
    runtime.OFFLINE_PROGRESS_DEFAULT_ENABLED,
  );
  runtime.state.offlineTickCount = runtime.clampOfflineTickCount(data.offlineTickCount);
  runtime.state.timeFluxCapacityLevel = Math.max(0, Math.floor(runtime.sanitizeNumber(data.timeFluxCapacityLevel, 0)));
  runtime.state.timeFluxGainLevel = Math.max(0, Math.floor(runtime.sanitizeNumber(data.timeFluxGainLevel, 0)));
  runtime.state.timeFlux = Math.min(
    runtime.timeFluxCapacitySeconds(),
    Math.max(0, runtime.sanitizeNumber(data.timeFlux, 0)),
  );
  const loadedTimeFluxSpeed = runtime.clampTimeFluxSpeed(data.timeFluxSpeed);
  const hasCustomTimeFluxSpeed = Object.prototype.hasOwnProperty.call(data, "timeFluxCustomSpeed");
  const loadedCustomTimeFluxSpeed = runtime.clampTimeFluxCustomSpeed(
    hasCustomTimeFluxSpeed ? data.timeFluxCustomSpeed : Math.max(4, loadedTimeFluxSpeed),
  );
  runtime.state.timeFluxSpeed = loadedTimeFluxSpeed;
  runtime.state.timeFluxCustomSpeed = loadedCustomTimeFluxSpeed;
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
  runtime.state.showTimeFluxQuickBar = data.showTimeFluxQuickBar !== false;
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

function saveGame(reason = "auto") {
  if (runtime.offlineProcessing) return true;
  let savedAt = Date.now();
  let serverSavedAt = 0;
  try {
    savedAt = runtime.localClockNowMs ? runtime.localClockNowMs() : Date.now();
    const saveData = serializeSaveData();
    saveData.savedAt = savedAt;
    serverSavedAt = saveData.serverSavedAt || 0;
    localStorage.setItem(runtime.SAVE_KEY, JSON.stringify(saveData));
    runtime.autoSaveElapsed = 0;
    const checkpointSaved = createCheckpoint("periodic");
    runtime.setSaveStatus(
      checkpointSaved
        ? reason === "auto" ? runtime.t("savedAuto") : runtime.t("savedManual")
        : runtime.t("checkpointSaveFailed"),
    );
    return true;
  } catch (error) {
    runtime.autoSaveElapsed = 0;
    runtime.setSaveStatus(runtime.t("saveFailed"));
    return false;
  } finally {
    if (runtime.setOfflineBaseline) runtime.setOfflineBaseline(savedAt, serverSavedAt);
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

    const parsed = normalizeStoredSave(JSON.parse(raw));
    if (!parsed) {
      quarantineSave(raw);
      runtime.setSaveStatus(runtime.t("oldSave"));
      return;
    }

    applySaveData(parsed.state, parsed.version);
    const savedAt = runtime.sanitizeNumber(parsed.savedAt, 0);
    const serverSavedAt = runtime.sanitizeNumber(parsed.serverSavedAt, 0);
    const offlineElapsed = runtime.offlineElapsedFromSave
      ? runtime.offlineElapsedFromSave(savedAt, serverSavedAt)
      : {
        elapsedSeconds: Math.max(0, (Date.now() - savedAt) / 1000),
        clockSource: "local-fallback",
        clockAnomaly: false,
        legacyTimestampUsed: false,
      };
    if (
      runtime.processOfflineElapsed
      && (offlineElapsed.elapsedSeconds > 0 || offlineElapsed.clockAnomaly)
    ) {
      runtime.processOfflineElapsed(offlineElapsed.elapsedSeconds, "load", offlineElapsed);
    } else if (runtime.setOfflineBaseline) {
      runtime.setOfflineBaseline(
        runtime.localClockNowMs ? runtime.localClockNowMs() : Date.now(),
        runtime.serverClockAvailable?.() && runtime.serverClockNowMs ? runtime.serverClockNowMs() : 0,
      );
    }
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
  if (!createCheckpoint("pre-reset", { force: true })) return;
  if (runtime.invalidateVisibilityResume) runtime.invalidateVisibilityResume();
  localStorage.removeItem(runtime.SAVE_KEY);
  runtime.offlineReport = null;
  if (runtime.rebaseLocalClock) runtime.rebaseLocalClock();
  if (runtime.setOfflineBaseline) {
    runtime.setOfflineBaseline(
      runtime.localClockNowMs ? runtime.localClockNowMs() : Date.now(),
      runtime.serverClockAvailable?.() && runtime.serverClockNowMs ? runtime.serverClockNowMs() : 0,
    );
  }
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
    activeChallengeTime: 0,
    activeTowerChallenge: 0,
    completedTowerChallenges: 0,
    activeTowerChallengeTime: 0,
    fastestInfinityChallengeTimes: Array(8).fill(0),
    fastestTowerChallengeTimes: Array(4).fill(0),
    infiniteCapBroken: false,
    achievementMask: 0,
    totalPlayTime: 0,
    totalRealPlayTime: 0,
    currentInfinityRunTime: 0,
    currentInfinityRealTime: 0,
    fastestInfinityTime: 0,
    fastestInfinityRealTime: 0,
    lastInfinityRuns: [],
    offlineProgressEnabled: true,
    offlineTickCount: 1000,
    timeFlux: 0,
    timeFluxCapacityLevel: 0,
    timeFluxGainLevel: 0,
    timeFluxSpeed: 1,
    timeFluxCustomSpeed: 4,
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
    autoInfinityPointThresholdLog10: 1,
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
    showTimeFluxQuickBar: true,
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
expose("backupCurrentSave", () => backupCurrentSave, (value) => { backupCurrentSave = value; });
expose("createCheckpoint", () => createCheckpoint, (value) => { createCheckpoint = value; });
expose("recoveryEntries", () => recoveryEntries, (value) => { recoveryEntries = value; });
expose("recoveryRevision", () => recoveryRevision);
expose("restorePreImportSave", () => restorePreImportSave, (value) => { restorePreImportSave = value; });
expose("restoreCheckpoint", () => restoreCheckpoint, (value) => { restoreCheckpoint = value; });
expose("restoreUndoSave", () => restoreUndoSave, (value) => { restoreUndoSave = value; });
expose("quarantineSave", () => quarantineSave, (value) => { quarantineSave = value; });
expose("loadGame", () => loadGame, (value) => { loadGame = value; });
expose("resetSave", () => resetSave, (value) => { resetSave = value; });
