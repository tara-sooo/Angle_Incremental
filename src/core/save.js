import { runtime, expose } from "../runtime/shared.js";

// Extracted mechanically from the next-runtime baseline.
// Numeric helpers and UI hooks remain in src/main.js during this migration phase.

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
  const infiniteScore = runtime.hydrateLogResource(data.infiniteScore, data.infiniteScoreLog10);
  runtime.state.infiniteScore = infiniteScore.value;
  runtime.state.infiniteScoreLog10 = infiniteScore.log;
  runtime.state.infinityUpgradeMask = Math.floor(runtime.sanitizeNumber(data.infinityUpgradeMask, 0));
  if (saveVersion < 3) {
    const refundLog = legacyInfinityUpgradeRefundLog10(data);
    if (refundLog > -Infinity) {
      runtime.state.infinityPointsLog10 = runtime.combineLog10(runtime.currentInfinityPointsLog10(), refundLog);
      runtime.state.infinityPoints = runtime.valueFromLog10(runtime.state.infinityPointsLog10);
    }
    runtime.state.infinityUpgradeMask = 0;
  }
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
  runtime.state.ic8VertexDecayElapsed = runtime.sanitizeNumber(data.ic8VertexDecayElapsed, 0);
  runtime.state.noGenerationCoreBoostReached = Boolean(data.noGenerationCoreBoostReached);
  if (runtime.state.activeChallenge > 0 && !runtime.infinityChallengesUnlocked()) {
    runtime.resetBelowInfinity();
    runtime.state.activeChallenge = 0;
  }
  if (runtime.state.activeChallenge === 2 && runtime.state.vertices > 200) {
    runtime.state.vertices = 200;
    runtime.resetVertexProgress();
  }
  if (runtime.state.activeChallenge === 8 && runtime.state.vertices !== 3) {
    runtime.state.vertices = 3;
    runtime.resetVertexProgress();
  }
  runtime.state.showFloatingText = data.showFloatingText !== false;
  runtime.state.lightEffects = Boolean(data.lightEffects);
  runtime.state.showFps = Boolean(data.showFps);
  runtime.state.language = runtime.normalizeChoice(data.language, ["ja", "en"], "ja");
  runtime.state.numberFormat = runtime.normalizeChoice(data.numberFormat, ["compact", "scientific", "detailed"], data.detailedNumbers ? "detailed" : "compact");
  runtime.state.timeUnit = runtime.normalizeChoice(data.timeUnit, ["auto", "seconds", "milliseconds"], "auto");
  const lastEarned = runtime.hydrateLogResource(data.lastEarned, data.lastEarnedLog10);
  runtime.state.lastEarned = lastEarned.value;
  runtime.state.lastEarnedLog10 = lastEarned.log;
  runtime.state.floatingTexts = [];
}

function serializeSaveData() {
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

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function cryptoApi() {
  return globalThis.crypto && globalThis.crypto.subtle ? globalThis.crypto : null;
}

async function saveCodeKey() {
  const api = cryptoApi();
  if (!api) throw new Error("crypto unavailable");
  const encoder = new TextEncoder();
  const material = await api.subtle.importKey(
    "raw",
    encoder.encode(runtime.SAVE_CODE_SECRET),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return api.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(runtime.SAVE_CODE_SALT),
      iterations: 120000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function exportSaveCode() {
  const api = cryptoApi();
  if (!api) {
    runtime.setSaveStatus(runtime.t("saveCodeCryptoUnavailable"));
    return "";
  }
  const iv = api.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(serializeSaveData()));
  const encrypted = new Uint8Array(await api.subtle.encrypt({ name: "AES-GCM", iv }, await saveCodeKey(), plaintext));
  const envelope = {
    v: 2,
    i: bytesToBase64Url(iv),
    d: bytesToBase64Url(encrypted),
  };
  const code = `${runtime.SAVE_CODE_PREFIX}${bytesToBase64Url(encoder.encode(JSON.stringify(envelope)))}`;
  if (runtime.elements.saveCodeArea) runtime.elements.saveCodeArea.value = code;
  runtime.setSaveStatus(runtime.t("saveCodeExported"));
  return code;
}

async function importSaveCode(code) {
  try {
    const trimmed = String(code || "").trim();
    if (!trimmed.startsWith(runtime.SAVE_CODE_PREFIX)) throw new Error("bad prefix");
    const api = cryptoApi();
    if (!api) throw new Error("crypto unavailable");
    const decoder = new TextDecoder();
    const envelope = JSON.parse(decoder.decode(base64UrlToBytes(trimmed.slice(runtime.SAVE_CODE_PREFIX.length))));
    if (!envelope || envelope.v !== 2 || !envelope.i || !envelope.d) throw new Error("bad envelope");
    const decrypted = await api.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlToBytes(envelope.i) },
      await saveCodeKey(),
      base64UrlToBytes(envelope.d),
    );
    const parsed = JSON.parse(decoder.decode(new Uint8Array(decrypted)));
    if (!parsed || !parsed.version || parsed.version > runtime.SAVE_VERSION || !parsed.state) throw new Error("bad save");
    applySaveData(parsed.state, parsed.version);
    saveGame("manual");
    runtime.updateUi();
    runtime.draw();
    runtime.setSaveStatus(runtime.t("saveCodeImported"));
    return true;
  } catch (error) {
    runtime.setSaveStatus(cryptoApi() ? runtime.t("saveCodeInvalid") : runtime.t("saveCodeCryptoUnavailable"));
    return false;
  }
}

async function importSaveCodeFromUi() {
  const ok = await importSaveCode(runtime.elements.saveCodeArea ? runtime.elements.saveCodeArea.value : "");
  if (!ok) runtime.updateUi();
}

async function copySaveCodeFromUi() {
  const code = runtime.elements.saveCodeArea ? runtime.elements.saveCodeArea.value.trim() : "";
  if (!code) return;
  try {
    const clipboard = globalThis.navigator && globalThis.navigator.clipboard;
    if (clipboard && clipboard.writeText) await clipboard.writeText(code);
    else if (runtime.elements.saveCodeArea) {
      runtime.elements.saveCodeArea.focus();
      runtime.elements.saveCodeArea.select();
      document.execCommand("copy");
    }
    runtime.setSaveStatus(runtime.t("saveCodeCopied"));
  } catch (error) {
    runtime.setSaveStatus(runtime.t("saveCodeInvalid"));
  }
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
    infiniteScore: 0,
    infiniteScoreLog10: -Infinity,
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
    ic8VertexDecayElapsed: 0,
    noGenerationCoreBoostReached: false,
    showFloatingText: true,
    lightEffects: false,
    showFps: false,
    language: "ja",
    numberFormat: "compact",
    timeUnit: "auto",
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
expose("bytesToBase64Url", () => bytesToBase64Url, (value) => { bytesToBase64Url = value; });
expose("base64UrlToBytes", () => base64UrlToBytes, (value) => { base64UrlToBytes = value; });
expose("cryptoApi", () => cryptoApi, (value) => { cryptoApi = value; });
expose("saveCodeKey", () => saveCodeKey, (value) => { saveCodeKey = value; });
expose("exportSaveCode", () => exportSaveCode, (value) => { exportSaveCode = value; });
expose("importSaveCode", () => importSaveCode, (value) => { importSaveCode = value; });
expose("importSaveCodeFromUi", () => importSaveCodeFromUi, (value) => { importSaveCodeFromUi = value; });
expose("copySaveCodeFromUi", () => copySaveCodeFromUi, (value) => { copySaveCodeFromUi = value; });
expose("saveGame", () => saveGame, (value) => { saveGame = value; });
expose("quarantineSave", () => quarantineSave, (value) => { quarantineSave = value; });
expose("loadGame", () => loadGame, (value) => { loadGame = value; });
expose("resetSave", () => resetSave, (value) => { resetSave = value; });

