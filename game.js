const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const elements = {
  mainTabs: Array.from(document.querySelectorAll(".main-tab")),
  mainPanels: Array.from(document.querySelectorAll(".main-panel")),
  scoreValue: document.getElementById("scoreValue"),
  gainValue: document.getElementById("gainValue"),
  vertexGainValue: document.getElementById("vertexGainValue"),
  lapValue: document.getElementById("lapValue"),
  generationStatus: document.getElementById("generationStatus"),
  generationCount: document.getElementById("generationCount"),
  generationMultiplier: document.getElementById("generationMultiplier"),
  generationCostFactor: document.getElementById("generationCostFactor"),
  generationButton: document.getElementById("generationButton"),
  coreBoostCount: document.getElementById("coreBoostCount"),
  coreBoostRequirement: document.getElementById("coreBoostRequirement"),
  coreBoostGainBoost: document.getElementById("coreBoostGainBoost"),
  coreBoostExponent: document.getElementById("coreBoostExponent"),
  coreBoostButton: document.getElementById("coreBoostButton"),
  infinityCount: document.getElementById("infinityCount"),
  infinityPoints: document.getElementById("infinityPoints"),
  infiniteScore: document.getElementById("infiniteScore"),
  infiniteAngleBoost: document.getElementById("infiniteAngleBoost"),
  infinityPointGain: document.getElementById("infinityPointGain"),
  infinityButton: document.getElementById("infinityButton"),
  ipGainUpgrade: document.getElementById("ipGainUpgrade"),
  ipGainUpgradeCost: document.getElementById("ipGainUpgradeCost"),
  infiniteAngleUpgrade: document.getElementById("infiniteAngleUpgrade"),
  infiniteAngleUpgradeCost: document.getElementById("infiniteAngleUpgradeCost"),
  softcapUpgrade: document.getElementById("softcapUpgrade"),
  softcapUpgradeCost: document.getElementById("softcapUpgradeCost"),
  convertIpButton: document.getElementById("convertIpButton"),
  convertIpGain: document.getElementById("convertIpGain"),
  challengeList: document.getElementById("challengeList"),
  challengeStatus: document.getElementById("challengeStatus"),
  breakCapButton: document.getElementById("breakCapButton"),
  buyAllUpgrade: document.getElementById("buyAllUpgrade"),
  speedUpgrade: document.getElementById("speedUpgrade"),
  vertexUpgrade: document.getElementById("vertexUpgrade"),
  gainUpgrade: document.getElementById("gainUpgrade"),
  saveStatus: document.getElementById("saveStatus"),
  resetSaveButton: document.getElementById("resetSaveButton"),
  speedLevel: document.getElementById("speedLevel"),
  vertexCount: document.getElementById("vertexCount"),
  gainLevel: document.getElementById("gainLevel"),
  speedCost: document.getElementById("speedCost"),
  vertexCost: document.getElementById("vertexCost"),
  gainCost: document.getElementById("gainCost"),
  floatingTextToggle: document.getElementById("floatingTextToggle"),
  lightEffectsToggle: document.getElementById("lightEffectsToggle"),
  languageSelect: document.getElementById("languageSelect"),
  numberFormatSelect: document.getElementById("numberFormatSelect"),
  timeUnitSelect: document.getElementById("timeUnitSelect"),
  i18nNodes: Array.from(document.querySelectorAll("[data-i18n]")),
  infinityTabState: document.getElementById("infinityTabState"),
  infinityTabBadge: document.getElementById("infinityTabBadge"),
  infinityUnlockNote: document.getElementById("infinityUnlockNote"),
};

const BASE_LAP_SECONDS = 6;
const GENERATION_UNLOCK_SCORE = 1_000_000;
const GENERATION_MIN_NEW_COST_FACTOR = 0.6;
const CORE_BOOST_BASE_REQUIREMENT = 1e20;
const MAX_CORE_BOOST_REQUIREMENT_LOG10 = 308;
const INFINITY_REQUIREMENT_LOG10 = 308 + Math.log10(1.8);
const BREAK_CAP_REQUIREMENT_LOG10 = 333;
const INFINITY_CHALLENGE_COUNT = 3;
const SAVE_KEY = "angle-incremental-save";
const SAVE_VERSION = 1;
const MAX_VERTEX_STEPS_PER_FRAME = 5000;
const MAX_EXACT_CORE_HITS = 50000;
const CORE_HIT_APPROX_SEGMENTS = 2048;
const VERTEX_EPSILON = 1e-9;
const TAU = Math.PI * 2;
const BUY_ALL_LIMIT = 1000;
const TEXT = {
  ja: {
    tabAngle: "図形",
    tabHelp: "説明",
    tabSettings: "設定",
    score: "スコア",
    coreGain: "核到達時の獲得量",
    vertexGain: "頂点通過ごとの増加",
    lapTime: "1周の時間",
    buyAll: "全購入",
    buyAllHint: "通常強化を順番に購入",
    speedUpgrade: "周回速度",
    vertexUpgrade: "角の追加",
    gainUpgrade: "頂点獲得量",
    generation: "世代",
    scoreMultiplier: "スコア倍率",
    costMultiplier: "コスト倍率",
    generationButton: "世代交代",
    coreBoost: "核増幅",
    requiredScore: "必要スコア",
    gainBoost: "増加倍率",
    gainExponent: "獲得指数",
    coreBoostButton: "核増幅",
    infiniteAngleBoost: "Infinite Angle倍率",
    infinityGain: "Infinity獲得",
    ipGainUpgrade: "IP倍率",
    infiniteAngleUpgrade: "IA効率",
    softcapUpgrade: "軟上限緩和",
    convertIp: "IPをIAへ",
    language: "言語",
    numberFormat: "数値表記",
    timeUnit: "時間単位",
    floatingText: "浮遊テキスト",
    lightEffects: "軽量演出",
    save: "セーブ",
    resetSave: "セーブをリセット",
    helpAngle: "左の強化で周回速度、角、頂点獲得量を伸ばします。",
    helpGeneration: "世代スコアが 1,000,000 に届いたら、下部の世代交代で倍率を得ます。",
    helpCoreBoost: "1.00e20 スコアから実行でき、世代以下をリセットして指数と増加倍率を得ます。",
    helpInfinity: "1.80e308 到達で初回は自動発動し、以降は任意発動で IP を得ます。",
    helpChallenge: "Infinity 後に挑戦できます。縛り状態で Infinity に到達すると報酬を得ます。",
    helpBreakCap: "1.00e333 到達で、Infinity 以降の強いソフトキャップを破壊します。",
    helpInfiniteAngle: "IP を Infinite Score に変換し、頂点通過ごとの増加を伸ばします。",
    level: "レベル",
    vertices: "頂点",
    cost: "必要",
    generationReady: "世代交代 可能",
    generationUnlocked: "世代 解放済み",
    generationLocked: "世代 未解放",
    locked: "未解放",
    completed: "完了",
    challengeRunning: "中",
    stopChallenge: "IC中止",
    startChallenge: "開始",
    challengeCompleted: "クリア済み",
    challengeIncomplete: "未クリア",
    challengeLocked: "Infinity後に解放",
    challengeNone: "未挑戦",
    challenge1: "IC1 角追加禁止",
    challenge2: "IC2 周回低速",
    challenge3: "IC3 増加低下",
    core: "核",
    currentGain: "現在の獲得量",
    baseExpression: "基礎乗算表記",
    savedAuto: "自動保存済み",
    savedManual: "保存済み",
    saveFailed: "保存失敗",
    noSave: "未保存",
    loaded: "ロード済み",
    oldSave: "セーブ形式が古い",
    loadFailed: "読み込み失敗",
    resetDone: "リセット済み",
    resetConfirm: "保存済みの進行状況をすべてリセットしますか？",
    under10ms: "10ミリ秒未満",
    secondsUnit: "秒",
    millisecondsUnit: "ミリ秒",
    capSuffix: "以上",
    numberCompact: "省略",
    numberScientific: "科学表記",
    numberDetailed: "詳細",
    timeAuto: "自動",
    timeSeconds: "秒",
    timeMilliseconds: "ミリ秒",
  },
  en: {
    tabAngle: "Angle",
    tabHelp: "Info",
    tabSettings: "System",
    score: "Score",
    coreGain: "Gain on core hit",
    vertexGain: "Gain per vertex",
    lapTime: "Lap time",
    buyAll: "Buy All",
    buyAllHint: "Buys normal upgrades in order",
    speedUpgrade: "Lap Speed",
    vertexUpgrade: "Add Vertex",
    gainUpgrade: "Vertex Gain",
    generation: "Generation",
    scoreMultiplier: "Score multiplier",
    costMultiplier: "Cost multiplier",
    generationButton: "Generate",
    coreBoost: "Core Boost",
    requiredScore: "Required score",
    gainBoost: "Gain boost",
    gainExponent: "Gain exponent",
    coreBoostButton: "Core Boost",
    infiniteAngleBoost: "Infinite Angle boost",
    infinityGain: "Infinity gain",
    ipGainUpgrade: "IP Multiplier",
    infiniteAngleUpgrade: "IA Efficiency",
    softcapUpgrade: "Soften Cap",
    convertIp: "Convert IP to IA",
    language: "Language",
    numberFormat: "Number format",
    timeUnit: "Time unit",
    floatingText: "Floating text",
    lightEffects: "Reduced effects",
    save: "Save",
    resetSave: "Reset save",
    helpAngle: "Use normal upgrades to improve lap speed, vertices, and vertex gain.",
    helpGeneration: "Reach 1,000,000 generation score, then generate for permanent lower-layer boosts.",
    helpCoreBoost: "Starts at 1.00e20 score and resets Generation progress for gain growth and exponent boosts.",
    helpInfinity: "First triggers automatically at 1.80e308, then can be run manually for IP.",
    helpChallenge: "Available after Infinity. Reach Infinity under a restriction to claim a reward.",
    helpBreakCap: "Reach 1.00e333 to break the heavy post-Infinity softcap.",
    helpInfiniteAngle: "Convert IP into Infinite Score to improve gain per vertex.",
    level: "Level",
    vertices: "vertices",
    cost: "Cost",
    generationReady: "Generation ready",
    generationUnlocked: "Generation unlocked",
    generationLocked: "Generation locked",
    locked: "Locked",
    completed: "complete",
    challengeRunning: "running",
    stopChallenge: "Stop IC",
    startChallenge: "Start",
    challengeCompleted: "Complete",
    challengeIncomplete: "Incomplete",
    challengeLocked: "Unlocked after Infinity",
    challengeNone: "No challenge",
    challenge1: "IC1 No Added Vertices",
    challenge2: "IC2 Slow Lap",
    challenge3: "IC3 Lower Growth",
    core: "Core",
    currentGain: "Current gain",
    baseExpression: "Base product",
    savedAuto: "Autosaved",
    savedManual: "Saved",
    saveFailed: "Save failed",
    noSave: "No save",
    loaded: "Loaded",
    oldSave: "Old save format",
    loadFailed: "Load failed",
    resetDone: "Reset",
    resetConfirm: "Reset all saved progress?",
    under10ms: "<10 ms",
    secondsUnit: "s",
    millisecondsUnit: "ms",
    capSuffix: "+",
    numberCompact: "Compact",
    numberScientific: "Scientific",
    numberDetailed: "Detailed",
    timeAuto: "Auto",
    timeSeconds: "Seconds",
    timeMilliseconds: "Milliseconds",
  },
};

const state = {
  score: 0,
  scoreLog10: -Infinity,
  totalScore: 0,
  generationScore: 0,
  vertices: 3,
  speedLevel: 0,
  gainLevel: 0,
  currentGain: 1,
  pointProgress: 0,
  totalVertexProgress: 0,
  lastVertexIndex: 0,
  generationCount: 0,
  generationScoreMultiplier: 1,
  generationCostFactor: 1,
  coreBoostCount: 0,
  infinityCount: 0,
  infinityPoints: 0,
  infiniteScore: 0,
  ipGainUpgradeLevel: 0,
  infiniteAngleUpgradeLevel: 0,
  softcapUpgradeLevel: 0,
  activeChallenge: 0,
  completedChallenges: 0,
  infiniteCapBroken: false,
  showFloatingText: true,
  lightEffects: false,
  language: "ja",
  numberFormat: "compact",
  timeUnit: "auto",
  floatingTexts: [],
  lastEarned: 0,
};

const SAVE_FIELDS = [
  "score",
  "scoreLog10",
  "totalScore",
  "generationScore",
  "vertices",
  "speedLevel",
  "gainLevel",
  "currentGain",
  "pointProgress",
  "totalVertexProgress",
  "lastVertexIndex",
  "generationCount",
  "generationScoreMultiplier",
  "generationCostFactor",
  "coreBoostCount",
  "infinityCount",
  "infinityPoints",
  "infiniteScore",
  "ipGainUpgradeLevel",
  "infiniteAngleUpgradeLevel",
  "softcapUpgradeLevel",
  "activeChallenge",
  "completedChallenges",
  "infiniteCapBroken",
  "showFloatingText",
  "lightEffects",
  "language",
  "numberFormat",
  "timeUnit",
  "lastEarned",
];

let autoSaveElapsed = 0;
let japaneseFontReady = false;
let activeMainTab = "angle";

function t(key) {
  return (TEXT[state.language] && TEXT[state.language][key]) || TEXT.ja[key] || key;
}

function setSaveStatus(text) {
  elements.saveStatus.textContent = text;
}

function normalizeChoice(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function sanitizeNumber(value, fallback, min = 0) {
  return Number.isFinite(value) && value >= min ? value : fallback;
}

function applySaveData(data) {
  state.score = sanitizeNumber(data.score, 0);
  state.scoreLog10 = sanitizeNumber(data.scoreLog10, log10Value(state.score), -Infinity);
  state.totalScore = sanitizeNumber(data.totalScore, state.score);
  state.generationScore = sanitizeNumber(data.generationScore, state.score);
  state.vertices = Math.max(3, Math.floor(sanitizeNumber(data.vertices, 3, 3)));
  state.speedLevel = Math.floor(sanitizeNumber(data.speedLevel, 0));
  state.gainLevel = Math.floor(sanitizeNumber(data.gainLevel, 0));
  state.currentGain = sanitizeNumber(data.currentGain, 1);
  state.pointProgress = sanitizeNumber(data.pointProgress, 0) % 1;
  state.totalVertexProgress = sanitizeNumber(data.totalVertexProgress, state.pointProgress * state.vertices);
  state.lastVertexIndex = Math.floor(sanitizeNumber(data.lastVertexIndex, 0));
  state.generationCount = Math.floor(sanitizeNumber(data.generationCount, 0));
  state.generationScoreMultiplier = sanitizeNumber(data.generationScoreMultiplier, 1, 1);
  state.generationCostFactor = Math.min(1, sanitizeNumber(data.generationCostFactor, 1, 0.25));
  state.coreBoostCount = Math.floor(sanitizeNumber(data.coreBoostCount, 0));
  state.infinityCount = Math.floor(sanitizeNumber(data.infinityCount, 0));
  state.infinityPoints = Math.floor(sanitizeNumber(data.infinityPoints, 0));
  state.infiniteScore = sanitizeNumber(data.infiniteScore, 0);
  state.ipGainUpgradeLevel = Math.floor(sanitizeNumber(data.ipGainUpgradeLevel, 0));
  state.infiniteAngleUpgradeLevel = Math.floor(sanitizeNumber(data.infiniteAngleUpgradeLevel, 0));
  state.softcapUpgradeLevel = Math.floor(sanitizeNumber(data.softcapUpgradeLevel, 0));
  state.activeChallenge = Math.min(INFINITY_CHALLENGE_COUNT, Math.floor(sanitizeNumber(data.activeChallenge, 0)));
  state.completedChallenges = Math.floor(sanitizeNumber(data.completedChallenges, 0));
  state.infiniteCapBroken = Boolean(data.infiniteCapBroken);
  if (state.infinityCount <= 0) state.activeChallenge = 0;
  state.showFloatingText = data.showFloatingText !== false;
  state.lightEffects = Boolean(data.lightEffects);
  state.language = normalizeChoice(data.language, ["ja", "en"], "ja");
  state.numberFormat = normalizeChoice(data.numberFormat, ["compact", "scientific", "detailed"], data.detailedNumbers ? "detailed" : "compact");
  state.timeUnit = normalizeChoice(data.timeUnit, ["auto", "seconds", "milliseconds"], "auto");
  state.lastEarned = sanitizeNumber(data.lastEarned, 0);
  state.floatingTexts = [];
}

function serializeSaveData() {
  const data = {};
  SAVE_FIELDS.forEach((field) => {
    data[field] = state[field];
  });
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    state: data,
  };
}

function saveGame(reason = "auto") {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(serializeSaveData()));
    autoSaveElapsed = 0;
    setSaveStatus(reason === "auto" ? t("savedAuto") : t("savedManual"));
    return true;
  } catch (error) {
    autoSaveElapsed = 0;
    setSaveStatus(t("saveFailed"));
    return false;
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      setSaveStatus(t("noSave"));
      return;
    }

    const parsed = JSON.parse(raw);
    if (parsed.version !== SAVE_VERSION || !parsed.state || typeof parsed.state !== "object") {
      setSaveStatus(t("oldSave"));
      return;
    }

    applySaveData(parsed.state);
    autoSaveElapsed = 0;
    setSaveStatus(t("loaded"));
  } catch (error) {
    setSaveStatus(t("loadFailed"));
  }
}

function resetSave() {
  const confirmed = window.confirm(t("resetConfirm"));
  if (!confirmed) return;
  localStorage.removeItem(SAVE_KEY);
  Object.assign(state, {
    score: 0,
    scoreLog10: -Infinity,
    totalScore: 0,
    generationScore: 0,
    vertices: 3,
    speedLevel: 0,
    gainLevel: 0,
    currentGain: 1,
    pointProgress: 0,
    totalVertexProgress: 0,
    lastVertexIndex: 0,
    generationCount: 0,
    generationScoreMultiplier: 1,
    generationCostFactor: 1,
    coreBoostCount: 0,
    infinityCount: 0,
    infinityPoints: 0,
    infiniteScore: 0,
    ipGainUpgradeLevel: 0,
    infiniteAngleUpgradeLevel: 0,
    softcapUpgradeLevel: 0,
    activeChallenge: 0,
    completedChallenges: 0,
    infiniteCapBroken: false,
    showFloatingText: true,
    lightEffects: false,
    language: "ja",
    numberFormat: "compact",
    timeUnit: "auto",
    floatingTexts: [],
    lastEarned: 0,
  });
  autoSaveElapsed = 0;
  setSaveStatus(t("resetDone"));
  updateUi();
  draw();
}

function formatNumber(value) {
  if (value === Infinity) return "∞";
  if (!Number.isFinite(value)) return "0";
  if (value < 1000) return value.toFixed(value < 10 ? 2 : 0).replace(/\.00$/, "");
  if (value < 1_000_000) return Math.floor(value).toLocaleString("en-US");
  if (value >= 1e18) return value.toExponential(2).replace("e+", "e");
  const units = ["M", "B", "T", "Qa", "Qi", "Sx"];
  let scaled = value;
  let unitIndex = -1;
  while (scaled >= 1000 && unitIndex < units.length - 1) {
    scaled /= 1000;
    unitIndex += 1;
  }
  return `${scaled.toFixed(scaled >= 100 ? 1 : 2)}${units[unitIndex]}`;
}

function formatUiNumber(value) {
  if (state.numberFormat === "compact" || value <= 0 || !Number.isFinite(value)) return formatNumber(value);
  const valueLog = log10Value(value);
  if (state.numberFormat === "scientific") return formatScientificLog(valueLog);
  if (state.numberFormat === "detailed" && valueLog < 3) return formatNumber(value);
  return formatLogNumber(valueLog);
}

function formatLogNumber(log10Value, capSuffix = false) {
  if (!Number.isFinite(log10Value)) return log10Value === -Infinity ? "0" : "∞";
  if (log10Value < 18) return formatNumber(10 ** log10Value);
  const exponent = Math.floor(log10Value);
  const mantissa = 10 ** (log10Value - exponent);
  const suffix = capSuffix ? t("capSuffix") : "";
  return `${mantissa.toFixed(2)}e${exponent.toLocaleString("en-US")}${suffix}`;
}

function formatScientificLog(log10Value) {
  if (!Number.isFinite(log10Value)) return log10Value === -Infinity ? "0" : "∞";
  if (log10Value < 3) return formatNumber(10 ** log10Value);
  const exponent = Math.floor(log10Value);
  const mantissa = 10 ** (log10Value - exponent);
  return `${mantissa.toFixed(2)}e${exponent.toLocaleString("en-US")}`;
}

function formatPowerOfTen(log10Value) {
  return formatLogNumber(log10Value, log10Value >= MAX_CORE_BOOST_REQUIREMENT_LOG10);
}

function formatSmallDecimal(value) {
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function formatGainExpression(value) {
  const parts = gainExpressionParts();
  if (parts <= 1) return formatNumber(value);
  const factor = Math.pow(Math.max(value, 1), 1 / parts);
  return Array.from({ length: parts }, () => formatUiNumber(factor)).join(" × ");
}

function gainExpressionParts() {
  return Math.min(Math.floor(Math.sqrt(state.vertices)), 10);
}

function hasMultiplicativeGainExpression() {
  return gainExpressionParts() > 1;
}

function formatGainExpressionSummary(value) {
  const expression = formatGainExpression(value);
  if (expression.length <= 42) return expression;
  const term = state.language === "ja" ? "項" : " terms";
  return `${formatUiNumber(Math.pow(Math.max(value, 1), 1 / gainExpressionParts()))} × ... × ${gainExpressionParts()}${term}`;
}

function lapSpeedMultiplier() {
  const challengeReward = isChallengeCompleted(2) ? 1.2 : 1;
  return Math.pow(1.22, state.speedLevel) * challengeReward;
}

function lapDuration() {
  const challengePenalty = state.activeChallenge === 2 ? 3 : 1;
  return (BASE_LAP_SECONDS / lapSpeedMultiplier()) * challengePenalty;
}

function formatDuration(seconds) {
  if (state.timeUnit === "seconds") return `${seconds.toFixed(2)}${t("secondsUnit")}`;
  if (state.timeUnit === "milliseconds") {
    const milliseconds = seconds * 1000;
    return `${milliseconds >= 10 ? Math.round(milliseconds) : milliseconds.toFixed(2)}${t("millisecondsUnit")}`;
  }
  if (seconds >= 1) return `${seconds.toFixed(2)}${t("secondsUnit")}`;
  if (seconds >= 0.01) return `${Math.round(seconds * 1000)}${t("millisecondsUnit")}`;
  return t("under10ms");
}

function log10Value(value) {
  if (value === Infinity) return Infinity;
  return value > 0 && Number.isFinite(value) ? Math.log10(value) : -Infinity;
}

function combineLog10(a, b) {
  if (a === -Infinity) return b;
  if (b === -Infinity) return a;
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  if (high - low > 15) return high;
  return high + Math.log10(1 + 10 ** (low - high));
}

function currentScoreLog10() {
  return Math.max(log10Value(state.score), Number.isFinite(state.scoreLog10) ? state.scoreLog10 : -Infinity);
}

function scoreDisplay() {
  const scoreLog = currentScoreLog10();
  if (state.numberFormat === "scientific" && scoreLog > -Infinity) return formatScientificLog(scoreLog);
  if (scoreLog >= (state.numberFormat === "detailed" ? 3 : 18)) return formatLogNumber(scoreLog);
  return formatNumber(state.score);
}

function infinitySoftcapPower() {
  if (state.infiniteCapBroken) return 1;
  return Math.min(0.32, 0.08 + state.softcapUpgradeLevel * 0.035 + completedChallengeCount() * 0.02);
}

function applyInfinitySoftcap(rawLog10) {
  if (state.infiniteCapBroken || rawLog10 <= INFINITY_REQUIREMENT_LOG10) return rawLog10;
  return INFINITY_REQUIREMENT_LOG10 + (rawLog10 - INFINITY_REQUIREMENT_LOG10) * infinitySoftcapPower();
}

function vertexGainIncrease() {
  const challengeFactor = state.activeChallenge === 3 ? 0.35 : 1;
  return (0.01 + state.gainLevel * 0.01) * coreBoostGainIncreaseMultiplier() * infiniteAngleBoost() * challengeFactor;
}

function coreBoostRequirementLog10() {
  return Math.min(Math.log10(CORE_BOOST_BASE_REQUIREMENT) * (2 ** state.coreBoostCount), MAX_CORE_BOOST_REQUIREMENT_LOG10);
}

function coreBoostRequirement() {
  const requirementLog10 = coreBoostRequirementLog10();
  return requirementLog10 > 308 ? Infinity : 10 ** requirementLog10;
}

function canCoreBoost() {
  return currentScoreLog10() >= coreBoostRequirementLog10();
}

function coreBoostGainIncreaseMultiplier() {
  return 1 + state.coreBoostCount * 0.5;
}

function coreBoostGainExponent() {
  const challengeReward = isChallengeCompleted(1) ? 0.02 : 0;
  return 1 + state.coreBoostCount * 0.05 + challengeReward;
}

function finalScoreGain(baseGain = state.currentGain) {
  return Math.pow(baseGain, coreBoostGainExponent()) * state.generationScoreMultiplier;
}

function finalScoreGainLog10(baseGain = state.currentGain) {
  return log10Value(Math.max(baseGain, 0)) * coreBoostGainExponent() + log10Value(state.generationScoreMultiplier);
}

function isChallengeCompleted(index) {
  return (state.completedChallenges & (1 << (index - 1))) !== 0;
}

function completedChallengeCount() {
  let count = 0;
  for (let index = 1; index <= INFINITY_CHALLENGE_COUNT; index += 1) {
    if (isChallengeCompleted(index)) count += 1;
  }
  return count;
}

function nextChallengeIndex() {
  for (let index = 1; index <= INFINITY_CHALLENGE_COUNT; index += 1) {
    if (!isChallengeCompleted(index)) return index;
  }
  return 1;
}

function challengeStateText(index) {
  if (state.infinityCount <= 0) return t("challengeLocked");
  if (state.activeChallenge === index) return t("challengeRunning");
  return isChallengeCompleted(index) ? t("challengeCompleted") : t("challengeIncomplete");
}

function challengeName(index) {
  if (index === 1) return t("challenge1");
  if (index === 2) return t("challenge2");
  if (index === 3) return t("challenge3");
  return t("challengeNone");
}

function infiniteAngleEfficiency() {
  const challengeReward = isChallengeCompleted(3) ? 1.5 : 1;
  return (1 + state.infiniteAngleUpgradeLevel) * challengeReward;
}

function infiniteAngleBoost() {
  return 1 + Math.log10(1 + state.infiniteScore) * 0.25;
}

function ipGainUpgradeCost() {
  return Math.floor(1 * 2 ** state.ipGainUpgradeLevel);
}

function infiniteAngleUpgradeCost() {
  return Math.floor(2 * 2 ** state.infiniteAngleUpgradeLevel);
}

function softcapUpgradeCost() {
  return Math.floor(4 * 3 ** state.softcapUpgradeLevel);
}

function canInfinity() {
  return currentScoreLog10() >= INFINITY_REQUIREMENT_LOG10;
}

function infinityPointGain() {
  if (!canInfinity()) return 0;
  const scoreLog = currentScoreLog10();
  const depth = Math.max(0, scoreLog - INFINITY_REQUIREMENT_LOG10);
  const base = 1 + Math.floor(depth / 25);
  const upgradeMultiplier = 1 + state.ipGainUpgradeLevel;
  return Math.max(1, base * upgradeMultiplier);
}

function infiniteScoreGainPerIp() {
  return 10 * infiniteAngleEfficiency();
}

function canBreakInfiniteCap() {
  return !state.infiniteCapBroken && currentScoreLog10() >= BREAK_CAP_REQUIREMENT_LOG10;
}

function sumCoreHitGains(firstCoreStep, coreHits, increase) {
  const exponent = coreBoostGainExponent();
  const multiplier = state.generationScoreMultiplier;
  const stride = state.vertices;
  const baseGain = state.currentGain;

  if (coreHits > MAX_EXACT_CORE_HITS) {
    let earned = 0;
    const segmentSize = coreHits / CORE_HIT_APPROX_SEGMENTS;
    for (let segment = 0; segment < CORE_HIT_APPROX_SEGMENTS; segment += 1) {
      const midHit = (segment + 0.5) * segmentSize;
      const stepAtMid = firstCoreStep + midHit * stride;
      earned += Math.pow(baseGain + increase * stepAtMid, exponent) * multiplier * segmentSize;
    }
    return earned;
  }

  let earned = 0;
  for (let hit = 0; hit < coreHits; hit += 1) {
    earned += Math.pow(baseGain + increase * (firstCoreStep + hit * stride), exponent) * multiplier;
  }
  return earned;
}

function cost(base, level, growth) {
  return Math.ceil(base * Math.pow(growth, level) * state.generationCostFactor);
}

function costs() {
  return {
    speed: cost(5, state.speedLevel, 1.55),
    vertex: cost(12, state.vertices - 3, 1.72),
    gain: cost(18, state.gainLevel, 1.68),
  };
}

function generationRewardFor(generationScore) {
  const depth = Math.max(0, log10Value(generationScore / GENERATION_UNLOCK_SCORE));
  return {
    scoreMultiplierGain: 1 + Math.min(1.25, 0.12 + Math.log10(1 + depth) * 0.22),
    costReduction: Math.min(0.08, 0.01 + Math.log10(1 + depth) * 0.012),
  };
}

function addScore(amount, amountLog10 = log10Value(amount)) {
  const previousScoreLog = currentScoreLog10();
  const rawScoreLog = combineLog10(previousScoreLog, amountLog10);
  const cappedScoreLog = applyInfinitySoftcap(rawScoreLog);

  state.scoreLog10 = cappedScoreLog;
  state.score = cappedScoreLog <= 308 ? 10 ** cappedScoreLog : Number.MAX_VALUE;
  if (Number.isFinite(amount)) {
    state.totalScore += amount;
    state.generationScore += amount;
  } else {
    state.totalScore = Number.MAX_VALUE;
    state.generationScore = Number.MAX_VALUE;
  }
  state.lastEarned = amount;

  if (state.infinityCount === 0 && canInfinity()) {
    runInfinity(true);
    return true;
  }

  return false;
}

function passVertex(index) {
  state.currentGain += vertexGainIncrease();
  if (index === 0) {
    const earned = finalScoreGain();
    const resetByInfinity = addScore(earned, finalScoreGainLog10());
    if (resetByInfinity) return true;
    if (state.showFloatingText && !state.lightEffects) {
      state.floatingTexts.push({
        text: `+${formatUiNumber(earned)}`,
        life: 1,
        x: canvas.width / 2,
        y: canvas.height * 0.16,
      });
    }
  }
  return false;
}

function processManyVertices(start, end) {
  const count = end - start + 1;
  if (count <= 0) return;

  const increase = vertexGainIncrease();
  const coreOffset = ((state.vertices - (start % state.vertices)) % state.vertices);
  const coreHits = coreOffset >= count ? 0 : Math.floor((count - 1 - coreOffset) / state.vertices) + 1;

  if (coreHits > 0) {
    const firstCoreStep = coreOffset + 1;
    const earned = sumCoreHitGains(firstCoreStep, coreHits, increase);
    const lastCoreStep = firstCoreStep + (coreHits - 1) * state.vertices;
    const batchLog = log10Value(Math.max(coreHits, 1)) + finalScoreGainLog10(state.currentGain + increase * lastCoreStep);
    const resetByInfinity = addScore(earned, Number.isFinite(earned) ? log10Value(earned) : batchLog);
    if (resetByInfinity) return true;
    if (state.showFloatingText && !state.lightEffects) {
      state.floatingTexts.push({
        text: `+${formatUiNumber(earned)}`,
        life: 1,
        x: canvas.width / 2,
        y: canvas.height * 0.16,
      });
    }
  }

  state.currentGain += increase * count;
  return false;
}

function update(dt) {
  const previousAbsolute = state.totalVertexProgress;
  state.totalVertexProgress += (dt / lapDuration()) * state.vertices;
  const nearestVertex = Math.round(state.totalVertexProgress);
  if (Math.abs(state.totalVertexProgress - nearestVertex) < VERTEX_EPSILON) {
    state.totalVertexProgress = nearestVertex;
  }
  state.pointProgress = (state.totalVertexProgress / state.vertices) % 1;

  const start = Math.floor(previousAbsolute + VERTEX_EPSILON) + 1;
  const end = Math.floor(state.totalVertexProgress + VERTEX_EPSILON);
  const vertexSteps = end - start + 1;
  if (vertexSteps > MAX_VERTEX_STEPS_PER_FRAME) {
    if (processManyVertices(start, end)) return;
  } else {
    for (let vertex = start; vertex <= end; vertex += 1) {
      if (passVertex(vertex % state.vertices)) return;
    }
  }

  state.lastVertexIndex = Math.floor(state.pointProgress * state.vertices) % state.vertices;
  state.floatingTexts = state.floatingTexts
    .map((item) => ({ ...item, life: item.life - dt, y: item.y - dt * 26 }))
    .filter((item) => item.life > 0);

  autoSaveElapsed += dt;
  if (autoSaveElapsed >= 5) saveGame("auto");
}

function polygonPoints() {
  const size = Math.min(canvas.width, canvas.height);
  const radius = size * 0.31;
  const cx = canvas.width / 2;
  const cy = canvas.height * 0.54;
  return Array.from({ length: state.vertices }, (_, index) => {
    const angle = -Math.PI / 2 + (index / state.vertices) * TAU;
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      angle,
    };
  });
}

function pointPosition(points) {
  const edgeProgress = state.pointProgress * state.vertices;
  const fromIndex = Math.floor(edgeProgress) % state.vertices;
  const toIndex = (fromIndex + 1) % state.vertices;
  const local = edgeProgress - Math.floor(edgeProgress);
  const from = points[fromIndex];
  const to = points[toIndex];
  return {
    x: from.x + (to.x - from.x) * local,
    y: from.y + (to.y - from.y) * local,
  };
}

function drawBackground() {
  ctx.fillStyle = "#0b1630";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(150, 174, 231, 0.10)";
  ctx.lineWidth = 1;
  const gap = 36;
  for (let x = -canvas.height; x < canvas.width; x += gap) {
    ctx.beginPath();
    ctx.moveTo(x, canvas.height);
    ctx.lineTo(x + canvas.height, 0);
    ctx.stroke();
  }
}

function draw() {
  drawBackground();
  const points = polygonPoints();
  const point = pointPosition(points);
  const canDrawJapanese = japaneseFontReady || !document.fonts;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  points.forEach((p, index) => {
    if (index === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(84, 130, 206, 0.16)";
  ctx.fill();
  ctx.strokeStyle = "#dbe7ff";
  ctx.lineWidth = 5;
  ctx.stroke();

  points.forEach((p, index) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, index === 0 ? 11 : 7, 0, TAU);
    ctx.fillStyle = index === 0 ? "#ff7659" : "#55d5ee";
    ctx.fill();
  });

  ctx.beginPath();
  ctx.arc(point.x, point.y, 10, 0, TAU);
  ctx.fillStyle = "#f2b84b";
  ctx.fill();
  ctx.strokeStyle = "#07101f";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = "center";
  if (canDrawJapanese) {
    ctx.font = "700 16px 'Noto Sans JP', sans-serif";
    ctx.fillStyle = "#eef4ff";
    ctx.fillText(t("core"), points[0].x, points[0].y - 22);
  }

  ctx.font = "800 28px 'Noto Sans JP', sans-serif";
  ctx.fillStyle = "#f2b84b";
  ctx.fillText(formatUiNumber(finalScoreGain()), canvas.width / 2, canvas.height - 68);

  if (canDrawJapanese) {
    ctx.font = "700 15px 'Noto Sans JP', sans-serif";
    ctx.fillStyle = "#b9c6e4";
    ctx.fillText(t("currentGain"), canvas.width / 2, canvas.height - 42);
    if (hasMultiplicativeGainExpression()) {
      ctx.font = "700 13px 'Noto Sans JP', sans-serif";
      ctx.fillText(`${t("baseExpression")}: ${formatGainExpressionSummary(state.currentGain)}`, canvas.width / 2, canvas.height - 20);
    }
  }

  state.floatingTexts.forEach((item) => {
    ctx.globalAlpha = Math.max(item.life, 0);
    ctx.font = "900 24px 'Noto Sans JP', sans-serif";
    ctx.fillStyle = "#ff7659";
    ctx.fillText(item.text, item.x, item.y);
    ctx.globalAlpha = 1;
  });

  ctx.restore();
}

function applyLanguage() {
  document.documentElement.lang = state.language;
  elements.i18nNodes.forEach((node) => {
    const key = node.dataset.i18n;
    if (key) node.textContent = t(key);
  });
  if (elements.languageSelect) elements.languageSelect.value = state.language;
  if (elements.numberFormatSelect) {
    elements.numberFormatSelect.value = state.numberFormat;
    elements.numberFormatSelect.querySelector('[value="compact"]').textContent = t("numberCompact");
    elements.numberFormatSelect.querySelector('[value="scientific"]').textContent = t("numberScientific");
    elements.numberFormatSelect.querySelector('[value="detailed"]').textContent = t("numberDetailed");
  }
  if (elements.timeUnitSelect) {
    elements.timeUnitSelect.value = state.timeUnit;
    elements.timeUnitSelect.querySelector('[value="auto"]').textContent = t("timeAuto");
    elements.timeUnitSelect.querySelector('[value="seconds"]').textContent = t("timeSeconds");
    elements.timeUnitSelect.querySelector('[value="milliseconds"]').textContent = t("timeMilliseconds");
  }
}

function createChallengeRows() {
  elements.challengeList.replaceChildren();
  for (let index = 1; index <= INFINITY_CHALLENGE_COUNT; index += 1) {
    const row = document.createElement("div");
    row.className = "challenge-row";
    row.dataset.challenge = String(index);

    const info = document.createElement("div");
    info.className = "challenge-info";

    const name = document.createElement("strong");
    name.className = "challenge-name";

    const status = document.createElement("small");
    status.className = "challenge-state";

    const button = document.createElement("button");
    button.className = "challenge-start-button";
    button.type = "button";
    button.addEventListener("click", () => toggleInfinityChallenge(index));

    info.append(name, status);
    row.append(info, button);
    elements.challengeList.append(row);
  }
}

function updateChallengeRows() {
  elements.challengeList.querySelectorAll(".challenge-row").forEach((row) => {
    const index = Number(row.dataset.challenge);
    const active = state.activeChallenge === index;
    const completed = isChallengeCompleted(index);
    const locked = state.infinityCount <= 0;
    const button = row.querySelector("button");

    row.classList.toggle("is-active", active);
    row.classList.toggle("is-completed", completed);
    row.querySelector(".challenge-name").textContent = challengeName(index);
    row.querySelector(".challenge-state").textContent = challengeStateText(index);
    button.textContent = active ? t("stopChallenge") : t("startChallenge");
    button.disabled = locked || (state.activeChallenge > 0 && !active);
  });
}

function canSpend(amount) {
  return currentScoreLog10() >= log10Value(amount);
}

function updateUi() {
  const currentCosts = costs();
  document.documentElement.classList.toggle("light-effects", state.lightEffects);
  applyLanguage();
  elements.scoreValue.textContent = scoreDisplay();
  elements.gainValue.textContent = formatUiNumber(finalScoreGain());
  elements.vertexGainValue.textContent = `+${formatSmallDecimal(vertexGainIncrease())}`;
  elements.lapValue.textContent = formatDuration(lapDuration());
  elements.speedLevel.textContent = `${t("level")} ${state.speedLevel}`;
  elements.vertexCount.textContent = `${state.vertices} ${t("vertices")}`;
  elements.gainLevel.textContent = `${t("level")} ${state.gainLevel}`;
  elements.speedCost.textContent = `${t("cost")} ${formatUiNumber(currentCosts.speed)}`;
  elements.vertexCost.textContent = `${t("cost")} ${formatUiNumber(currentCosts.vertex)}`;
  elements.gainCost.textContent = `${t("cost")} ${formatUiNumber(currentCosts.gain)}`;
  elements.speedUpgrade.disabled = !canSpend(currentCosts.speed);
  elements.vertexUpgrade.disabled = !canSpend(currentCosts.vertex) || state.activeChallenge === 1;
  elements.gainUpgrade.disabled = !canSpend(currentCosts.gain);
  elements.buyAllUpgrade.disabled = !canSpend(Math.min(currentCosts.speed, currentCosts.gain, state.activeChallenge === 1 ? Infinity : currentCosts.vertex));

  const unlocked = state.totalScore >= GENERATION_UNLOCK_SCORE;
  const ready = state.generationScore >= GENERATION_UNLOCK_SCORE;
  elements.generationStatus.textContent = ready
    ? t("generationReady")
    : unlocked
      ? t("generationUnlocked")
      : t("generationLocked");
  elements.generationButton.disabled = !ready;
  elements.generationCount.textContent = String(state.generationCount);
  elements.generationMultiplier.textContent = `×${state.generationScoreMultiplier.toFixed(2)}`;
  elements.generationCostFactor.textContent = `×${state.generationCostFactor.toFixed(2)}`;

  elements.coreBoostCount.textContent = String(state.coreBoostCount);
  elements.coreBoostRequirement.textContent = formatPowerOfTen(coreBoostRequirementLog10());
  elements.coreBoostGainBoost.textContent = `×${coreBoostGainIncreaseMultiplier().toFixed(2)}`;
  elements.coreBoostExponent.textContent = `^${coreBoostGainExponent().toFixed(2)}`;
  elements.coreBoostButton.disabled = !canCoreBoost();

  elements.infinityCount.textContent = String(state.infinityCount);
  const infinityReady = canInfinity();
  const infinityUnlocked = state.infinityCount > 0;
  elements.infinityTabState.textContent = infinityReady ? "READY" : infinityUnlocked ? "OPEN" : "LOCKED";
  elements.infinityTabBadge.classList.toggle("is-visible", infinityReady);
  elements.infinityUnlockNote.hidden = infinityUnlocked;
  elements.infinityPoints.textContent = formatUiNumber(state.infinityPoints);
  elements.infiniteScore.textContent = formatUiNumber(state.infiniteScore);
  elements.infiniteAngleBoost.textContent = `×${infiniteAngleBoost().toFixed(2)}`;
  elements.infinityPointGain.textContent = `+${formatUiNumber(infinityPointGain())} IP`;
  elements.infinityButton.disabled = state.infinityCount === 0 || !canInfinity();
  elements.ipGainUpgradeCost.textContent = `${formatUiNumber(ipGainUpgradeCost())} IP`;
  elements.infiniteAngleUpgradeCost.textContent = `${formatUiNumber(infiniteAngleUpgradeCost())} IP`;
  elements.softcapUpgradeCost.textContent = `${formatUiNumber(softcapUpgradeCost())} IP`;
  elements.ipGainUpgrade.disabled = state.infinityPoints < ipGainUpgradeCost();
  elements.infiniteAngleUpgrade.disabled = state.infinityPoints < infiniteAngleUpgradeCost();
  elements.softcapUpgrade.disabled = state.infinityPoints < softcapUpgradeCost();
  elements.convertIpButton.disabled = state.infinityPoints < 1;
  elements.convertIpGain.textContent = `+${formatUiNumber(infiniteScoreGainPerIp())}`;
  const completed = completedChallengeCount();
  elements.challengeStatus.textContent = state.activeChallenge > 0
    ? `${challengeName(state.activeChallenge)} ${t("challengeRunning")}`
    : state.infinityCount <= 0
      ? t("locked")
      : `${completed}/${INFINITY_CHALLENGE_COUNT} ${t("completed")}`;
  updateChallengeRows();
  elements.breakCapButton.disabled = !canBreakInfiniteCap();
  elements.breakCapButton.textContent = state.infiniteCapBroken ? "Cap Broken" : "Break Infinite Cap";

  elements.floatingTextToggle.checked = state.showFloatingText;
  elements.lightEffectsToggle.checked = state.lightEffects;
  elements.languageSelect.value = state.language;
  elements.numberFormatSelect.value = state.numberFormat;
  elements.timeUnitSelect.value = state.timeUnit;
}

function spend(amount) {
  const scoreLog = currentScoreLog10();
  const amountLog = log10Value(amount);

  if (scoreLog > 308) {
    if (amountLog > scoreLog) return false;
    if (scoreLog - amountLog > 15) return true;

    const remainingFactor = 1 - 10 ** (amountLog - scoreLog);
    if (remainingFactor <= 0) {
      state.score = 0;
      state.scoreLog10 = -Infinity;
    } else {
      state.scoreLog10 = scoreLog + Math.log10(remainingFactor);
      state.score = state.scoreLog10 <= 308 ? 10 ** state.scoreLog10 : Number.MAX_VALUE;
    }
    return true;
  }

  if (state.score < amount) return false;
  if (scoreLog > 18 && amount < state.score * 1e-12) return true;
  state.score -= amount;
  state.scoreLog10 = log10Value(state.score);
  return true;
}

function buySpeed() {
  const price = costs().speed;
  if (!spend(price)) return;
  state.speedLevel += 1;
  updateUi();
  saveGame("manual");
}

function buyVertex() {
  if (state.activeChallenge === 1) return;
  const price = costs().vertex;
  if (!spend(price)) return;
  state.vertices += 1;
  state.pointProgress = 0;
  state.totalVertexProgress = 0;
  state.lastVertexIndex = 0;
  updateUi();
  saveGame("manual");
}

function buyGain() {
  const price = costs().gain;
  if (!spend(price)) return;
  state.gainLevel += 1;
  updateUi();
  saveGame("manual");
}

function buyAllUpgrades() {
  let purchases = 0;
  let bought = true;
  while (bought && purchases < BUY_ALL_LIMIT) {
    bought = false;
    const speedPrice = costs().speed;
    if (spend(speedPrice)) {
      state.speedLevel += 1;
      purchases += 1;
      bought = true;
      if (purchases >= BUY_ALL_LIMIT) break;
    }

    if (state.activeChallenge !== 1) {
      const vertexPrice = costs().vertex;
      if (spend(vertexPrice)) {
        state.vertices += 1;
        state.pointProgress = 0;
        state.totalVertexProgress = 0;
        state.lastVertexIndex = 0;
        purchases += 1;
        bought = true;
        if (purchases >= BUY_ALL_LIMIT) break;
      }
    }

    const gainPrice = costs().gain;
    if (spend(gainPrice)) {
      state.gainLevel += 1;
      purchases += 1;
      bought = true;
    }
  }

  if (purchases > 0) {
    updateUi();
    saveGame("manual");
  }
  return purchases;
}

function runGeneration() {
  if (state.generationScore < GENERATION_UNLOCK_SCORE) return;

  const reward = generationRewardFor(state.generationScore);
  const nextCostFactor = state.generationCostFactor * (1 - reward.costReduction);
  state.generationCount += 1;
  state.generationScoreMultiplier *= reward.scoreMultiplierGain;
  state.generationCostFactor = state.generationCostFactor < GENERATION_MIN_NEW_COST_FACTOR
    ? state.generationCostFactor
    : Math.max(GENERATION_MIN_NEW_COST_FACTOR, nextCostFactor);

  state.score = 0;
  state.scoreLog10 = -Infinity;
  state.generationScore = 0;
  state.vertices = 3;
  state.speedLevel = 0;
  state.gainLevel = 0;
  state.currentGain = 1;
  state.pointProgress = 0;
  state.totalVertexProgress = 0;
  state.lastVertexIndex = 0;
  state.floatingTexts = [];
  updateUi();
  saveGame("manual");
}

function resetBelowCoreBoost() {
  state.score = 0;
  state.scoreLog10 = -Infinity;
  state.totalScore = 0;
  state.generationScore = 0;
  state.vertices = 3;
  state.speedLevel = 0;
  state.gainLevel = 0;
  state.currentGain = 1;
  state.pointProgress = 0;
  state.totalVertexProgress = 0;
  state.lastVertexIndex = 0;
  state.generationCount = 0;
  state.generationScoreMultiplier = 1;
  state.generationCostFactor = 1;
  state.floatingTexts = [];
}

function runCoreBoost() {
  if (!canCoreBoost()) return;
  state.coreBoostCount += 1;
  resetBelowCoreBoost();
  updateUi();
  saveGame("manual");
}

function resetBelowInfinity() {
  state.score = 0;
  state.scoreLog10 = -Infinity;
  state.totalScore = 0;
  state.generationScore = 0;
  state.vertices = 3;
  state.speedLevel = 0;
  state.gainLevel = 0;
  state.currentGain = 1;
  state.pointProgress = 0;
  state.totalVertexProgress = 0;
  state.lastVertexIndex = 0;
  state.generationCount = 0;
  state.generationScoreMultiplier = 1;
  state.generationCostFactor = 1;
  state.coreBoostCount = 0;
  state.infiniteScore = 0;
  state.floatingTexts = [];
}

function runInfinity(forced = false) {
  if (!canInfinity()) return;
  if (!forced && state.infinityCount === 0) return;

  const gained = infinityPointGain();
  if (state.activeChallenge > 0) {
    state.completedChallenges |= 1 << (state.activeChallenge - 1);
    state.activeChallenge = 0;
  }

  state.infinityCount += 1;
  state.infinityPoints += gained;
  resetBelowInfinity();
  updateUi();
  saveGame("manual");
}

function buyIpGainUpgrade() {
  const price = ipGainUpgradeCost();
  if (state.infinityPoints < price) return;
  state.infinityPoints -= price;
  state.ipGainUpgradeLevel += 1;
  updateUi();
  saveGame("manual");
}

function buyInfiniteAngleUpgrade() {
  const price = infiniteAngleUpgradeCost();
  if (state.infinityPoints < price) return;
  state.infinityPoints -= price;
  state.infiniteAngleUpgradeLevel += 1;
  updateUi();
  saveGame("manual");
}

function buySoftcapUpgrade() {
  const price = softcapUpgradeCost();
  if (state.infinityPoints < price) return;
  state.infinityPoints -= price;
  state.softcapUpgradeLevel += 1;
  updateUi();
  saveGame("manual");
}

function convertIpToInfiniteScore() {
  if (state.infinityPoints < 1) return;
  state.infinityPoints -= 1;
  state.infiniteScore += infiniteScoreGainPerIp();
  updateUi();
  saveGame("manual");
}

function toggleInfinityChallenge(index = nextChallengeIndex()) {
  if (state.infinityCount <= 0) return;
  if (state.activeChallenge === index) {
    state.activeChallenge = 0;
  } else if (state.activeChallenge > 0) {
    return;
  } else {
    state.activeChallenge = Math.min(INFINITY_CHALLENGE_COUNT, Math.max(1, Math.floor(index)));
    resetBelowInfinity();
  }
  updateUi();
  saveGame("manual");
}

function switchMainTab(tab) {
  activeMainTab = tab;
  elements.mainTabs.forEach((button) => {
    const active = button.dataset.tab === activeMainTab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  elements.mainPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === activeMainTab);
  });
  resizeCanvas();
}

function applySetting(key, value) {
  state[key] = value;
  if (key === "language") state.language = normalizeChoice(value, ["ja", "en"], "ja");
  if (key === "numberFormat") state.numberFormat = normalizeChoice(value, ["compact", "scientific", "detailed"], "compact");
  if (key === "timeUnit") state.timeUnit = normalizeChoice(value, ["auto", "seconds", "milliseconds"], "auto");
  if (key === "showFloatingText" && !value) state.floatingTexts = [];
  if (key === "lightEffects" && value) state.floatingTexts = [];
  updateUi();
  draw();
  saveGame("manual");
}

function breakInfiniteCap() {
  if (!canBreakInfiniteCap()) return;
  state.infiniteCapBroken = true;
  updateUi();
  saveGame("manual");
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(640, Math.floor(rect.width * scale));
  canvas.height = Math.max(420, Math.floor(rect.height * scale));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  draw();
}

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.08);
  lastTime = now;
  update(dt);
  updateUi();
  draw();
  requestAnimationFrame(frame);
}

function renderGameToText() {
  const points = polygonPoints();
  const point = pointPosition(points);
  const scoreLog = currentScoreLog10();
  return JSON.stringify({
    coordinateSystem: "canvas pixels, origin top-left, x right, y down",
    score: scoreDisplay(),
    scoreLog10: Number.isFinite(scoreLog) ? Number(scoreLog.toPrecision(6)) : null,
    totalScore: Number(state.totalScore.toFixed(2)),
    generationScore: Number(state.generationScore.toFixed(2)),
    currentGain: Number(state.currentGain.toFixed(2)),
    finalGainOnCore: Number(finalScoreGain().toPrecision(6)),
    vertices: state.vertices,
    lapSeconds: Number(lapDuration().toPrecision(6)),
    point: { x: Number(point.x.toFixed(1)), y: Number(point.y.toFixed(1)), progress: Number(state.pointProgress.toFixed(3)) },
    core: { x: Number(points[0].x.toFixed(1)), y: Number(points[0].y.toFixed(1)) },
    upgrades: {
      speedLevel: state.speedLevel,
      gainLevel: state.gainLevel,
      costs: costs(),
    },
    generation: {
      unlocked: state.totalScore >= GENERATION_UNLOCK_SCORE,
      canGenerate: state.generationScore >= GENERATION_UNLOCK_SCORE,
      count: state.generationCount,
      scoreMultiplier: Number(state.generationScoreMultiplier.toFixed(2)),
      costFactor: Number(state.generationCostFactor.toFixed(2)),
    },
    coreBoost: {
      canBoost: canCoreBoost(),
      count: state.coreBoostCount,
      requirement: coreBoostRequirement(),
      requirementLog10: coreBoostRequirementLog10(),
      requirementText: formatPowerOfTen(coreBoostRequirementLog10()),
      gainIncreaseMultiplier: Number(coreBoostGainIncreaseMultiplier().toFixed(2)),
      gainExponent: Number(coreBoostGainExponent().toFixed(2)),
    },
    infinity: {
      canInfinity: canInfinity(),
      count: state.infinityCount,
      points: state.infinityPoints,
      pointGain: infinityPointGain(),
      infiniteScore: Number(state.infiniteScore.toPrecision(6)),
      infiniteAngleBoost: Number(infiniteAngleBoost().toFixed(2)),
      activeChallenge: state.activeChallenge,
      completedChallenges: completedChallengeCount(),
      softcapPower: Number(infinitySoftcapPower().toFixed(3)),
      capBroken: state.infiniteCapBroken,
      canBreakCap: canBreakInfiniteCap(),
    },
    settings: {
      showFloatingText: state.showFloatingText,
      lightEffects: state.lightEffects,
      language: state.language,
      numberFormat: state.numberFormat,
      timeUnit: state.timeUnit,
      activeMainTab,
    },
  });
}

window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) update(1 / 60);
  updateUi();
  draw();
};
window.__angleDebug = {
  state,
  addScore,
  runGeneration,
  runCoreBoost,
  runInfinity,
  buyIpGainUpgrade,
  buyInfiniteAngleUpgrade,
  buySoftcapUpgrade,
  buyAllUpgrades,
  generationRewardFor,
  convertIpToInfiniteScore,
  toggleInfinityChallenge,
  breakInfiniteCap,
  switchMainTab,
  applySetting,
  saveGame,
  loadGame,
  resetSave,
};

elements.speedUpgrade.addEventListener("click", buySpeed);
elements.vertexUpgrade.addEventListener("click", buyVertex);
elements.gainUpgrade.addEventListener("click", buyGain);
elements.buyAllUpgrade.addEventListener("click", buyAllUpgrades);
elements.generationButton.addEventListener("click", runGeneration);
elements.coreBoostButton.addEventListener("click", runCoreBoost);
elements.infinityButton.addEventListener("click", () => runInfinity(false));
elements.ipGainUpgrade.addEventListener("click", buyIpGainUpgrade);
elements.infiniteAngleUpgrade.addEventListener("click", buyInfiniteAngleUpgrade);
elements.softcapUpgrade.addEventListener("click", buySoftcapUpgrade);
elements.convertIpButton.addEventListener("click", convertIpToInfiniteScore);
elements.breakCapButton.addEventListener("click", breakInfiniteCap);
elements.resetSaveButton.addEventListener("click", resetSave);
elements.mainTabs.forEach((button) => {
  button.addEventListener("click", () => switchMainTab(button.dataset.tab));
});
elements.floatingTextToggle.addEventListener("change", () => applySetting("showFloatingText", elements.floatingTextToggle.checked));
elements.lightEffectsToggle.addEventListener("change", () => applySetting("lightEffects", elements.lightEffectsToggle.checked));
elements.languageSelect.addEventListener("change", () => applySetting("language", elements.languageSelect.value));
elements.numberFormatSelect.addEventListener("change", () => applySetting("numberFormat", elements.numberFormatSelect.value));
elements.timeUnitSelect.addEventListener("change", () => applySetting("timeUnit", elements.timeUnitSelect.value));
window.addEventListener("beforeunload", () => saveGame("manual"));
window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "f") {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }
});

loadGame();
createChallengeRows();
switchMainTab(activeMainTab);
resizeCanvas();
updateUi();
if (document.fonts) {
  document.fonts.ready.then(() => {
    japaneseFontReady = true;
    updateUi();
    draw();
  });
} else {
  japaneseFontReady = true;
}
requestAnimationFrame(frame);
