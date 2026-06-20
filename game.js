const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const elements = {
  mainTabs: Array.from(document.querySelectorAll(".main-tab")),
  mainPanels: Array.from(document.querySelectorAll(".main-panel")),
  infinitySubtabs: Array.from(document.querySelectorAll(".infinity-subtab")),
  infinitySubpanels: Array.from(document.querySelectorAll(".infinity-subpanel")),
  scoreValue: document.getElementById("scoreValue"),
  gainValue: document.getElementById("gainValue"),
  vertexGainValue: document.getElementById("vertexGainValue"),
  lapValue: document.getElementById("lapValue"),
  lapSpeedValue: document.getElementById("lapSpeedValue"),
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
  infiniteScorePanel: document.getElementById("infiniteScorePanel"),
  infiniteAngleBoost: document.getElementById("infiniteAngleBoost"),
  infiniteAngleBoostPanel: document.getElementById("infiniteAngleBoostPanel"),
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
  achievementList: document.getElementById("achievementList"),
  achievementSummary: document.getElementById("achievementSummary"),
  achievementBoost: document.getElementById("achievementBoost"),
  achievementTabState: document.getElementById("achievementTabState"),
  achievementToasts: document.getElementById("achievementToasts"),
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
  fpsToggle: document.getElementById("fpsToggle"),
  fpsCounter: document.getElementById("fpsCounter"),
  languageSelect: document.getElementById("languageSelect"),
  numberFormatSelect: document.getElementById("numberFormatSelect"),
  timeUnitSelect: document.getElementById("timeUnitSelect"),
  updateModal: document.getElementById("updateModal"),
  updateModalClose: document.getElementById("updateModalClose"),
  i18nNodes: Array.from(document.querySelectorAll("[data-i18n]")),
  infinityTabState: document.getElementById("infinityTabState"),
  infinityTabBadge: document.getElementById("infinityTabBadge"),
  infinityUnlockNote: document.getElementById("infinityUnlockNote"),
};

const BASE_LAP_SECONDS = 6;
const GENERATION_UNLOCK_SCORE = 1000000;
const GENERATION_MIN_NEW_COST_FACTOR = 0.6;
const CORE_BOOST_BASE_REQUIREMENT = 1e20;
const MAX_CORE_BOOST_REQUIREMENT_LOG10 = 308;
const INFINITY_REQUIREMENT_LOG10 = 308 + Math.log10(1.8);
const BREAK_CAP_REQUIREMENT_LOG10 = 333;
const INFINITY_CHALLENGE_COUNT = 8;
const ACHIEVEMENT_COUNT = 8;
const SAVE_KEY = "angle-incremental-save";
const SAVE_VERSION = 1;
const APP_VERSION = "2026.06.20-gain-expression-order";
const UPDATE_SEEN_KEY = "angle-incremental-seen-version";
const MAX_VERTEX_STEPS_PER_FRAME = 5000;
const MAX_EXACT_CORE_HITS = 50000;
const CORE_HIT_APPROX_SEGMENTS = 2048;
const LAP_SPEED_SOFTCAP_START = 200;
const LAP_SPEED_SOFTCAP_POWER = 0.5;
const GENERATION_SCORE_POWER = 2;
const GENERATION_SCORE_POWER_IC3_REWARD = 2.1;
const GENERATION_COST_POWER_IC3_REWARD = 1.08;
const VERTEX_EPSILON = 1e-9;
const TAU = Math.PI * 2;
const BUY_ALL_LIMIT = 1000;
const TEXT = {
  ja: {
    tabAngle: "図形",
    tabAchievements: "実績",
    tabHelp: "説明",
    tabSettings: "設定",
    score: "スコア",
    coreGain: "核到達時の獲得量",
    vertexGain: "頂点通過ごとの増加",
    lapTime: "1周の時間",
    lapSpeed: "ラップ速度",
    lapSpeedSoftcapped: "軟上限中",
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
    achievementBoost: "実績増加倍率",
    achievementReward: "共通報酬",
    achievementRewardText: "達成ごとに頂点通過ごとの増加 ×1.01",
    achievementUnlocked: "達成済み",
    achievementLocked: "未達成",
    achievementNotice: "実績達成",
    language: "言語",
    numberFormat: "数値表記",
    timeUnit: "時間単位",
    floatingText: "浮遊テキスト",
    lightEffects: "軽量演出",
    showFps: "FPS表示",
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
    generationWaitingPrevious: "前回GR超過待ち",
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
    challengeRestrictionLabel: "制約",
    challengeRewardLabel: "報酬",
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
    updateTitle: "アップデート",
    updateSummary: "Generation仕様とリセット欄表示を更新しました。",
    updateResetDock: "GenerationとCore Boostの全ステータスをスクロールで確認できるようにしました。",
    updateCanvas: "GR倍率、コスト増加軽減、前回GR超過条件を新仕様へ調整しました。",
    updateModalNote: "(x/y)^y式はThe Angle由来の基礎獲得量に適用されます。",
    updateClose: "閉じる",
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
    tabAchievements: "Achievements",
    tabHelp: "Info",
    tabSettings: "System",
    score: "Score",
    coreGain: "Gain on core hit",
    vertexGain: "Gain per vertex",
    lapTime: "Lap time",
    lapSpeed: "Lap speed",
    lapSpeedSoftcapped: "softcapped",
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
    achievementBoost: "Achievement boost",
    achievementReward: "Shared reward",
    achievementRewardText: "Each achievement multiplies gain per vertex by 1.01",
    achievementUnlocked: "Unlocked",
    achievementLocked: "Locked",
    achievementNotice: "Achievement unlocked",
    language: "Language",
    numberFormat: "Number format",
    timeUnit: "Time unit",
    floatingText: "Floating text",
    lightEffects: "Reduced effects",
    showFps: "Show FPS",
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
    generationWaitingPrevious: "Beat previous GR",
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
    challengeRestrictionLabel: "Restriction",
    challengeRewardLabel: "Reward",
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
    updateTitle: "Update",
    updateSummary: "Generation rules and reset-layer layout were updated.",
    updateResetDock: "All Generation and Core Boost stats can be reached by scrolling.",
    updateCanvas: "GR scaling, cost-growth reduction, and repeat Generation rules were adjusted.",
    updateModalNote: "The (x/y)^y formula now applies to The Angle's base gain.",
    updateClose: "Close",
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

const ACHIEVEMENTS = [
  {
    title: { ja: "頂点すなわち角度", en: "A Vertex Is an Angle" },
    condition: { ja: "角の数を増やす", en: "Increase the number of vertices." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.vertices > 3,
  },
  {
    title: { ja: "世代を超えて", en: "Beyond Generations" },
    condition: { ja: "Generationを実行する", en: "Run Generation." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.generationCount > 0,
  },
  {
    title: { ja: "e(この実績の番号)分のブースト", en: "An e3 Boost" },
    condition: { ja: "GR由来の単純なスコア獲得量の実効乗算値が1000を超える", en: "Make the effective GR score multiplier exceed 1000." },
    reward: { ja: "GRの単純なスコア獲得量の乗算の効果が2倍", en: "Doubles the effect of the GR score multiplier." },
    isUnlocked: () => generationAchievementMultiplier() > 1000,
  },
  {
    title: { ja: "角と核はダブルミーニングでもあり", en: "Angle and Core, Doubled" },
    condition: { ja: "Core Boost1に到達", en: "Reach Core Boost 1." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.coreBoostCount >= 1,
  },
  {
    title: { ja: "目視できない", en: "Too Fast to See" },
    condition: { ja: "ラップスピードが10を超える", en: "Raise lap speed above 10." },
    reward: { ja: "", en: "" },
    isUnlocked: () => lapSpeedMultiplier() > 10,
  },
  {
    title: { ja: "contagon", en: "contagon" },
    condition: { ja: "頂点の数が30を超える", en: "Raise vertices above 30." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.vertices > 30,
  },
  {
    title: { ja: "再びe(この実績の番号)分のブースト", en: "Another e7 Boost" },
    condition: { ja: "GR由来の単純なスコア獲得量の実効乗算値が10000000を超える", en: "Make the effective GR score multiplier exceed 10,000,000." },
    reward: { ja: "", en: "" },
    isUnlocked: () => generationAchievementMultiplier() > 10000000,
  },
  {
    title: { ja: "スケーリングは始まっている", en: "Scaling Has Begun" },
    condition: { ja: "所持スコアがe30を超える", en: "Hold more than 1e30 score." },
    reward: { ja: "", en: "" },
    isUnlocked: () => currentScoreLog10() > 30,
  },
];

const INFINITY_CHALLENGES = [
  {
    name: { ja: "IC1 Generation停止", en: "IC1 No Generation" },
    restriction: { ja: "Generationは機能しない", en: "Generation does not function." },
    reward: { ja: "IPの獲得量が2倍", en: "Doubles IP gain." },
  },
  {
    name: { ja: "IC2 核増幅圧縮", en: "IC2 Compressed Core" },
    restriction: { ja: "CBボーナス獲得量が^0.6される", en: "Core Boost bonuses are raised to ^0.6." },
    reward: { ja: "CBボーナス獲得量が^1.1される", en: "Core Boost bonuses are raised to ^1.1." },
  },
  {
    name: { ja: "IC3 逆世代", en: "IC3 Reversed Generation" },
    restriction: { ja: "Generationの効果が逆転し、Generationボーナスが^0.7される", en: "Generation effects invert and Generation bonuses are raised to ^0.7." },
    reward: { ja: "Generationが少し強い", en: "Generation is slightly stronger." },
  },
  {
    name: { ja: "IC4 二重核", en: "IC4 Double Core" },
    restriction: { ja: "核の数は2で固定され、スコアはラップスピード+10で割られる", en: "The core count is fixed at 2, and score gain is divided by lap speed + 10." },
    reward: { ja: "スコア獲得量は^2される", en: "Score gain is raised to ^2." },
  },
  {
    name: { ja: "IC5 Infinity Upgrade圧縮", en: "IC5 Compressed Infinity Upgrades" },
    restriction: { ja: "Infinity Upgradeの効果が^0.1される", en: "Infinity Upgrade effects are raised to ^0.1." },
    reward: { ja: "Infinity Upgrade効果が^3される", en: "Infinity Upgrade effects are raised to ^3." },
  },
  {
    name: { ja: "IC6 粘性軌道", en: "IC6 Viscous Orbit" },
    restriction: { ja: "ラップスピードボーナスが平方根化される", en: "Lap speed bonuses are square-rooted." },
    reward: { ja: "ラップスピードボーナスが少し強い", en: "Lap speed bonuses are slightly stronger." },
  },
  {
    name: { ja: "IC7 多角崩壊", en: "IC7 Vertex Collapse" },
    restriction: { ja: "頂点が多いほどスコア獲得量が割られる", en: "More vertices divide score gain." },
    reward: { ja: "頂点数に応じて頂点通過ごとの増加が伸びる", en: "Vertices improve gain per vertex." },
  },
  {
    name: { ja: "IC8 無限圧縮", en: "IC8 Infinite Compression" },
    restriction: { ja: "最終スコア獲得量が^0.45される", en: "Final score gain is raised to ^0.45." },
    reward: { ja: "クリア済みICに応じてIP獲得量が増える", en: "Completed ICs increase IP gain." },
  },
];

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
  previousGenerationScore: 0,
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
  achievementMask: 0,
  showFloatingText: true,
  lightEffects: false,
  showFps: false,
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
  "previousGenerationScore",
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
  "achievementMask",
  "showFloatingText",
  "lightEffects",
  "showFps",
  "language",
  "numberFormat",
  "timeUnit",
  "lastEarned",
];

let autoSaveElapsed = 0;
let japaneseFontReady = false;
let activeMainTab = "angle";
let activeInfinitySubtab = "upgrades";
let appliedLanguage = "";
let smoothedFps = 0;
const requestNextFrame = window.requestAnimationFrame
  ? window.requestAnimationFrame.bind(window)
  : (callback) => window.setTimeout(() => callback(currentFrameTime()), 1000 / 60);

function t(key) {
  return (TEXT[state.language] && TEXT[state.language][key]) || TEXT.ja[key] || key;
}

function setSaveStatus(text) {
  elements.saveStatus.textContent = text;
}

function shouldShowUpdateModal() {
  try {
    return localStorage.getItem(UPDATE_SEEN_KEY) !== APP_VERSION;
  } catch (error) {
    return false;
  }
}

function closeUpdateModal() {
  if (!elements.updateModal) return;
  elements.updateModal.hidden = true;
  try {
    localStorage.setItem(UPDATE_SEEN_KEY, APP_VERSION);
  } catch (error) {
    // Non-critical: private browsing or blocked storage should not affect gameplay.
  }
}

function showUpdateModalIfNeeded() {
  if (!elements.updateModal || !shouldShowUpdateModal()) return;
  elements.updateModal.hidden = false;
  if (elements.updateModalClose) elements.updateModalClose.focus();
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
  state.previousGenerationScore = sanitizeNumber(
    data.previousGenerationScore,
    state.generationCount > 0 ? GENERATION_UNLOCK_SCORE : 0,
  );
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
  state.achievementMask = Math.floor(sanitizeNumber(data.achievementMask, 0));
  if (state.infinityCount <= 0) state.activeChallenge = 0;
  state.showFloatingText = data.showFloatingText !== false;
  state.lightEffects = Boolean(data.lightEffects);
  state.showFps = Boolean(data.showFps);
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
    previousGenerationScore: 0,
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
    achievementMask: 0,
    showFloatingText: true,
    lightEffects: false,
    showFps: false,
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
  if (value < 1000000) return Math.floor(value).toLocaleString("en-US");
  if (value >= 1e18) return value.toExponential(2).replace("e+", "e");
  const units = ["M", "B", "T", "Qa", "Qi", "Sx"];
  let scaled = value / 1000000;
  let unitIndex = 0;
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

function formatGainExpression(valueLog10) {
  const parts = gainExpressionParts();
  if (parts <= 1) return formatLogNumber(valueLog10);
  const base = formatLogNumber(valueLog10);
  return `(${base} / ${parts})^${parts}`;
}

function gainExpressionParts() {
  return Math.min(Math.floor(Math.sqrt(state.vertices)), 10);
}

function hasMultiplicativeGainExpression() {
  return gainExpressionParts() > 1;
}

function formatGainExpressionSummary() {
  return formatGainExpression(preExpressionScoreGainLog10());
}

function challengeText(index, key) {
  const challenge = INFINITY_CHALLENGES[index - 1];
  const language = TEXT[state.language] ? state.language : "ja";
  return challenge ? challenge[key][language] : t("challengeNone");
}

function rawLapSpeedMultiplier() {
  let multiplier = Math.pow(1.22, state.speedLevel);
  if (state.activeChallenge === 6) multiplier = Math.pow(multiplier, 0.5);
  if (isChallengeCompleted(6)) multiplier = Math.pow(multiplier, 1.08);
  return multiplier;
}

function lapSpeedMultiplier() {
  const rawMultiplier = rawLapSpeedMultiplier();
  const softcapStart = lapSpeedSoftcapStart();
  if (rawMultiplier <= softcapStart) return rawMultiplier;
  return softcapStart * Math.pow(rawMultiplier / softcapStart, LAP_SPEED_SOFTCAP_POWER);
}

function isLapSpeedSoftcapped() {
  return rawLapSpeedMultiplier() > lapSpeedSoftcapStart();
}

function lapSpeedSoftcapStart() {
  if (state.activeChallenge === 1) return LAP_SPEED_SOFTCAP_START;
  const relief = Math.min(1.5, Math.max(0, log10Value(state.generationScoreMultiplier)) * 0.15);
  return LAP_SPEED_SOFTCAP_START * (1 + relief);
}

function lapDuration() {
  return BASE_LAP_SECONDS / lapSpeedMultiplier();
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
  return Math.min(0.32, 0.08 + infinityUpgradeEffect(state.softcapUpgradeLevel) * 0.035 + completedChallengeCount() * 0.02);
}

function applyInfinitySoftcap(rawLog10) {
  if (state.infiniteCapBroken || rawLog10 <= INFINITY_REQUIREMENT_LOG10) return rawLog10;
  return INFINITY_REQUIREMENT_LOG10 + (rawLog10 - INFINITY_REQUIREMENT_LOG10) * infinitySoftcapPower();
}

function vertexGainIncrease() {
  const vertexReward = isChallengeCompleted(7) ? 1 + Math.max(0, state.vertices - 3) * 0.01 : 1;
  return (0.01 + state.gainLevel * 0.01) * coreBoostGainIncreaseMultiplier() * infiniteAngleBoost() * achievementGainMultiplier() * vertexReward;
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

function coreBoostBonusPower() {
  if (state.activeChallenge === 2) return 0.6;
  return isChallengeCompleted(2) ? 1.1 : 1;
}

function coreBoostGainIncreaseMultiplier() {
  return Math.pow(1 + state.coreBoostCount * 0.5, coreBoostBonusPower());
}

function coreBoostGainExponent() {
  return Math.pow(1 + state.coreBoostCount * 0.05, coreBoostBonusPower());
}

function generationScorePower() {
  return isChallengeCompleted(3) ? GENERATION_SCORE_POWER_IC3_REWARD : GENERATION_SCORE_POWER;
}

function generationCostPower() {
  return isChallengeCompleted(3) ? GENERATION_COST_POWER_IC3_REWARD : 1;
}

function generationScoreMultiplierBaseEffect(rawMultiplier = state.generationScoreMultiplier) {
  return Math.pow(rawMultiplier, generationScorePower());
}

function generationAchievementMultiplier() {
  return generationScoreMultiplierBaseEffect();
}

function applyGenerationAchievementReward(baseMultiplier) {
  if (!isAchievementUnlocked(3)) return baseMultiplier;
  return 1 + (baseMultiplier - 1) * 2;
}

function generationScoreMultiplierEffect(includeAchievementReward = true) {
  if (state.activeChallenge === 1) return 1;
  if (state.activeChallenge === 3) return 1 / Math.pow(Math.max(state.generationScoreMultiplier, 1), 0.7);

  const baseMultiplier = generationScoreMultiplierBaseEffect();
  return includeAchievementReward ? applyGenerationAchievementReward(baseMultiplier) : baseMultiplier;
}

function generationCostFactorEffect() {
  if (state.activeChallenge === 1) return 1;
  if (state.activeChallenge === 3) return 1 / Math.pow(Math.max(state.generationCostFactor, 0.01), 0.7);
  return Math.pow(state.generationCostFactor, generationCostPower());
}

function finalScoreGainPower() {
  let power = isChallengeCompleted(4) ? 2 : 1;
  if (state.activeChallenge === 8) power *= 0.45;
  return power;
}

function finalScoreGainDivisor() {
  let divisor = 1;
  if (state.activeChallenge === 4) divisor *= lapSpeedMultiplier() + 10;
  if (state.activeChallenge === 7) divisor *= Math.max(1, state.vertices);
  return divisor;
}

function finalScoreGain(baseGain = state.currentGain) {
  const gainLog = finalScoreGainLog10(baseGain);
  return gainLog <= 308 ? 10 ** gainLog : Infinity;
}

function angleExpressionLog10(baseGain = state.currentGain) {
  const baseLog = log10Value(Math.max(baseGain, 0));
  const parts = gainExpressionParts();
  if (parts <= 1) return baseLog;
  return (baseLog - log10Value(parts)) * parts;
}

function preExpressionScoreGainLog10(baseGain = state.currentGain) {
  return angleExpressionLog10(baseGain);
}

function finalScoreGainLog10(baseGain = state.currentGain) {
  const angleLog = angleExpressionLog10(baseGain) * coreBoostGainExponent();
  const boostedLog = angleLog + log10Value(generationScoreMultiplierEffect());
  return boostedLog * finalScoreGainPower() - log10Value(finalScoreGainDivisor());
}

function isAchievementUnlocked(id) {
  return (state.achievementMask & (1 << (id - 1))) !== 0;
}

function achievementCount() {
  let count = 0;
  for (let id = 1; id <= ACHIEVEMENT_COUNT; id += 1) {
    if (isAchievementUnlocked(id)) count += 1;
  }
  return count;
}

function achievementGainMultiplier() {
  return Math.pow(1.01, achievementCount());
}

function showAchievementNotification(id) {
  if (!elements.achievementToasts) return;
  const language = TEXT[state.language] ? state.language : "ja";
  const achievement = ACHIEVEMENTS[id - 1];
  const toast = document.createElement("div");
  toast.className = "achievement-toast";
  toast.innerHTML = `<span>${t("achievementNotice")}</span><strong>${achievement.title[language]}</strong>`;
  elements.achievementToasts.append(toast);
  window.setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 4200);
}

function checkAchievements(notify = false) {
  const unlockedIds = [];
  ACHIEVEMENTS.forEach((achievement, index) => {
    const id = index + 1;
    if (!isAchievementUnlocked(id) && achievement.isUnlocked()) {
      state.achievementMask |= 1 << index;
      unlockedIds.push(id);
      if (notify) showAchievementNotification(id);
    }
  });
  return unlockedIds;
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
  return challengeText(index, "name");
}

function challengeRestriction(index) {
  return challengeText(index, "restriction");
}

function challengeReward(index) {
  return challengeText(index, "reward");
}

function coreVertexIndices() {
  if (state.activeChallenge !== 4) return [0];
  const secondCore = Math.floor(state.vertices / 2) % state.vertices;
  return secondCore === 0 ? [0] : [0, secondCore];
}

function isCoreVertex(index) {
  return coreVertexIndices().includes(index);
}

function infiniteAngleEfficiency() {
  return 1 + infinityUpgradeEffect(state.infiniteAngleUpgradeLevel);
}

function infiniteAngleBoost() {
  return 1 + Math.log10(1 + state.infiniteScore) * 0.25;
}

function infinityUpgradeEffect(level) {
  if (level <= 0) return 0;
  const power = state.activeChallenge === 5 ? 0.1 : isChallengeCompleted(5) ? 3 : 1;
  return Math.pow(level, power);
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
  const upgradeMultiplier = 1 + infinityUpgradeEffect(state.ipGainUpgradeLevel);
  const challenge1Reward = isChallengeCompleted(1) ? 2 : 1;
  const challenge8Reward = isChallengeCompleted(8) ? 1 + completedChallengeCount() * 0.25 : 1;
  return Math.max(1, Math.floor(base * upgradeMultiplier * challenge1Reward * challenge8Reward));
}

function infiniteScoreGainPerIp() {
  return 10 * infiniteAngleEfficiency();
}

function canBreakInfiniteCap() {
  return !state.infiniteCapBroken && currentScoreLog10() >= BREAK_CAP_REQUIREMENT_LOG10;
}

function sumCoreHitGains(firstCoreStep, coreHits, increase) {
  const stride = state.vertices;
  const baseGain = state.currentGain;

  if (coreHits > MAX_EXACT_CORE_HITS) {
    let earned = 0;
    const segmentSize = coreHits / CORE_HIT_APPROX_SEGMENTS;
    for (let segment = 0; segment < CORE_HIT_APPROX_SEGMENTS; segment += 1) {
      const midHit = (segment + 0.5) * segmentSize;
      const stepAtMid = firstCoreStep + midHit * stride;
      earned += finalScoreGain(baseGain + increase * stepAtMid) * segmentSize;
    }
    return earned;
  }

  let earned = 0;
  for (let hit = 0; hit < coreHits; hit += 1) {
    earned += finalScoreGain(baseGain + increase * (firstCoreStep + hit * stride));
  }
  return earned;
}

function cost(base, level, growth) {
  const rawCost = base * Math.pow(growth, level);
  return Math.ceil(base + (rawCost - base) * generationCostFactorEffect());
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

function generationRequirement() {
  if (state.generationCount <= 0) return GENERATION_UNLOCK_SCORE;
  return Math.max(GENERATION_UNLOCK_SCORE, state.previousGenerationScore);
}

function canRunGeneration() {
  if (state.activeChallenge === 1) return false;
  if (state.generationCount <= 0) return state.generationScore >= GENERATION_UNLOCK_SCORE;
  return state.generationScore > generationRequirement();
}

function nextGenerationValues() {
  if (!canRunGeneration()) {
    return {
      scoreMultiplier: generationScoreMultiplierEffect(),
      costFactor: generationCostFactorEffect(),
    };
  }

  const reward = generationRewardFor(state.generationScore);
  const nextRawScoreMultiplier = state.generationScoreMultiplier * reward.scoreMultiplierGain;
  const nextRawCostFactor = state.generationCostFactor < GENERATION_MIN_NEW_COST_FACTOR
    ? state.generationCostFactor
    : Math.max(GENERATION_MIN_NEW_COST_FACTOR, state.generationCostFactor * (1 - reward.costReduction));

  return {
    scoreMultiplier: applyGenerationAchievementReward(generationScoreMultiplierBaseEffect(nextRawScoreMultiplier)),
    costFactor: Math.pow(nextRawCostFactor, generationCostPower()),
  };
}

function nextCoreBoostValues() {
  const currentCoreBoostCount = state.coreBoostCount;
  const nextCoreBoostCount = canCoreBoost() ? currentCoreBoostCount + 1 : currentCoreBoostCount;
  const power = coreBoostBonusPower();
  return {
    gainMultiplier: Math.pow(1 + nextCoreBoostCount * 0.5, power),
    gainExponent: Math.pow(1 + nextCoreBoostCount * 0.05, power),
  };
}

function formatMultiplierPreview(current, next) {
  const currentText = `×${current.toFixed(2)}`;
  const nextText = `×${next.toFixed(2)}`;
  return currentText === nextText ? currentText : `${currentText} → ${nextText}`;
}

function formatExponentPreview(current, next) {
  const currentText = `^${current.toFixed(2)}`;
  const nextText = `^${next.toFixed(2)}`;
  return currentText === nextText ? currentText : `${currentText} → ${nextText}`;
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

  if (checkAchievements(true).length > 0) saveGame("manual");
  if (state.infinityCount === 0 && canInfinity()) {
    runInfinity(true);
    return true;
  }

  return false;
}

function passVertex(index) {
  state.currentGain += vertexGainIncrease();
  if (isCoreVertex(index)) {
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
  const coreBatches = coreVertexIndices()
    .map((coreIndex) => {
      const coreOffset = ((coreIndex - (start % state.vertices)) + state.vertices) % state.vertices;
      const coreHits = coreOffset >= count ? 0 : Math.floor((count - 1 - coreOffset) / state.vertices) + 1;
      return {
        coreHits,
        firstCoreStep: coreOffset + 1,
      };
    })
    .filter((batch) => batch.coreHits > 0);
  const coreHits = coreBatches.reduce((total, batch) => total + batch.coreHits, 0);

  if (coreHits > 0) {
    let earned = 0;
    let lastCoreStep = 0;
    coreBatches.forEach((batch) => {
      earned += sumCoreHitGains(batch.firstCoreStep, batch.coreHits, increase);
      lastCoreStep = Math.max(lastCoreStep, batch.firstCoreStep + (batch.coreHits - 1) * state.vertices);
    });
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
  const compactCanvas = canvas.getBoundingClientRect().height < 260;

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

  const coreIndices = coreVertexIndices();
  points.forEach((p, index) => {
    ctx.beginPath();
    const core = coreIndices.includes(index);
    ctx.arc(p.x, p.y, core ? 11 : 7, 0, TAU);
    ctx.fillStyle = core ? "#ff7659" : "#55d5ee";
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

  if (!compactCanvas) {
    ctx.font = "800 28px 'Noto Sans JP', sans-serif";
    ctx.fillStyle = "#f2b84b";
    ctx.fillText(formatUiNumber(finalScoreGain()), canvas.width / 2, canvas.height - 68);

    if (canDrawJapanese) {
      ctx.font = "700 15px 'Noto Sans JP', sans-serif";
      ctx.fillStyle = "#b9c6e4";
      ctx.fillText(t("currentGain"), canvas.width / 2, canvas.height - 42);
      if (hasMultiplicativeGainExpression()) {
        ctx.font = "700 13px 'Noto Sans JP', sans-serif";
        ctx.fillText(`${t("baseExpression")}: ${formatGainExpressionSummary()}`, canvas.width / 2, canvas.height - 20);
      }
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
  if (appliedLanguage === state.language) return;
  appliedLanguage = state.language;
  document.documentElement.lang = state.language;
  elements.i18nNodes.forEach((node) => {
    const key = node.dataset.i18n;
    if (key) node.textContent = t(key);
  });
  if (elements.numberFormatSelect) {
    elements.numberFormatSelect.querySelector('[value="compact"]').textContent = t("numberCompact");
    elements.numberFormatSelect.querySelector('[value="scientific"]').textContent = t("numberScientific");
    elements.numberFormatSelect.querySelector('[value="detailed"]').textContent = t("numberDetailed");
  }
  if (elements.timeUnitSelect) {
    elements.timeUnitSelect.querySelector('[value="auto"]').textContent = t("timeAuto");
    elements.timeUnitSelect.querySelector('[value="seconds"]').textContent = t("timeSeconds");
    elements.timeUnitSelect.querySelector('[value="milliseconds"]').textContent = t("timeMilliseconds");
  }
}

function syncFormControl(control, value) {
  if (!control || document.activeElement === control) return;
  if (control.type === "checkbox") {
    control.checked = Boolean(value);
  } else {
    control.value = value;
  }
}

function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function createChallengeRows() {
  clearElement(elements.challengeList);
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

    const restriction = document.createElement("p");
    restriction.className = "challenge-restriction";

    const reward = document.createElement("p");
    reward.className = "challenge-reward";

    const button = document.createElement("button");
    button.className = "challenge-start-button";
    button.type = "button";
    button.addEventListener("click", () => toggleInfinityChallenge(index));

    info.append(name, status, restriction, reward);
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
    row.querySelector(".challenge-restriction").textContent = `${t("challengeRestrictionLabel")}: ${challengeRestriction(index)}`;
    row.querySelector(".challenge-reward").textContent = `${t("challengeRewardLabel")}: ${challengeReward(index)}`;
    button.textContent = active ? t("stopChallenge") : t("startChallenge");
    button.disabled = locked || (state.activeChallenge > 0 && !active);
  });
}

function createAchievementRows() {
  clearElement(elements.achievementList);
  ACHIEVEMENTS.forEach((achievement, index) => {
    const row = document.createElement("article");
    row.className = "achievement-row";
    row.dataset.achievement = String(index + 1);

    const number = document.createElement("strong");
    number.className = "achievement-number";

    const body = document.createElement("div");
    body.className = "achievement-body";

    const title = document.createElement("h2");
    title.className = "achievement-title";

    const condition = document.createElement("p");
    condition.className = "achievement-condition";

    const reward = document.createElement("p");
    reward.className = "achievement-reward";

    const status = document.createElement("span");
    status.className = "achievement-status";

    body.append(title, condition, reward);
    row.append(number, body, status);
    elements.achievementList.append(row);
  });
}

function updateAchievementRows() {
  const language = TEXT[state.language] ? state.language : "ja";
  elements.achievementList.querySelectorAll(".achievement-row").forEach((row) => {
    const id = Number(row.dataset.achievement);
    const achievement = ACHIEVEMENTS[id - 1];
    const unlocked = isAchievementUnlocked(id);
    const extraReward = achievement.reward[language];

    row.classList.toggle("is-unlocked", unlocked);
    row.querySelector(".achievement-number").textContent = String(id);
    row.querySelector(".achievement-title").textContent = achievement.title[language];
    row.querySelector(".achievement-condition").textContent = achievement.condition[language];
    row.querySelector(".achievement-reward").textContent = extraReward
      ? `${t("achievementReward")}: ${extraReward}`
      : t("achievementRewardText");
    row.querySelector(".achievement-status").textContent = unlocked ? t("achievementUnlocked") : t("achievementLocked");
  });
}

function canSpend(amount) {
  return currentScoreLog10() >= log10Value(amount);
}

function updateUi() {
  const currentCosts = costs();
  const unlockedAchievementsNow = checkAchievements(true);
  if (unlockedAchievementsNow.length > 0) saveGame("manual");
  document.documentElement.classList.toggle("light-effects", state.lightEffects);
  applyLanguage();
  elements.scoreValue.textContent = scoreDisplay();
  elements.gainValue.textContent = formatUiNumber(finalScoreGain());
  elements.vertexGainValue.textContent = `+${formatSmallDecimal(vertexGainIncrease())}`;
  elements.lapValue.textContent = formatDuration(lapDuration());
  elements.lapSpeedValue.textContent = isLapSpeedSoftcapped()
    ? `×${lapSpeedMultiplier().toFixed(2)} ${t("lapSpeedSoftcapped")}`
    : `×${lapSpeedMultiplier().toFixed(2)}`;
  elements.speedLevel.textContent = `${t("level")} ${state.speedLevel}`;
  elements.vertexCount.textContent = `${state.vertices} ${t("vertices")}`;
  elements.gainLevel.textContent = `${t("level")} ${state.gainLevel}`;
  elements.speedCost.textContent = `${t("cost")} ${formatUiNumber(currentCosts.speed)}`;
  elements.vertexCost.textContent = `${t("cost")} ${formatUiNumber(currentCosts.vertex)}`;
  elements.gainCost.textContent = `${t("cost")} ${formatUiNumber(currentCosts.gain)}`;
  elements.speedUpgrade.disabled = !canSpend(currentCosts.speed);
  elements.vertexUpgrade.disabled = !canSpend(currentCosts.vertex);
  elements.gainUpgrade.disabled = !canSpend(currentCosts.gain);
  elements.buyAllUpgrade.disabled = !canSpend(Math.min(currentCosts.speed, currentCosts.gain, currentCosts.vertex));

  const unlocked = state.totalScore >= GENERATION_UNLOCK_SCORE;
  const ready = canRunGeneration();
  const waitingPrevious = unlocked
    && state.generationCount > 0
    && state.generationScore >= GENERATION_UNLOCK_SCORE
    && !ready
    && state.activeChallenge !== 1;
  elements.generationStatus.textContent = ready
    ? t("generationReady")
    : waitingPrevious
      ? t("generationWaitingPrevious")
      : unlocked
      ? t("generationUnlocked")
      : t("generationLocked");
  elements.generationButton.disabled = !ready;
  elements.generationCount.textContent = String(state.generationCount);
  const nextGeneration = nextGenerationValues();
  elements.generationMultiplier.textContent = formatMultiplierPreview(generationScoreMultiplierEffect(), nextGeneration.scoreMultiplier);
  elements.generationCostFactor.textContent = formatMultiplierPreview(generationCostFactorEffect(), nextGeneration.costFactor);

  elements.coreBoostCount.textContent = String(state.coreBoostCount);
  elements.coreBoostRequirement.textContent = formatPowerOfTen(coreBoostRequirementLog10());
  const nextCoreBoost = nextCoreBoostValues();
  elements.coreBoostGainBoost.textContent = formatMultiplierPreview(coreBoostGainIncreaseMultiplier(), nextCoreBoost.gainMultiplier);
  elements.coreBoostExponent.textContent = formatExponentPreview(coreBoostGainExponent(), nextCoreBoost.gainExponent);
  elements.coreBoostButton.disabled = !canCoreBoost();

  elements.infinityCount.textContent = String(state.infinityCount);
  const infinityReady = canInfinity();
  const infinityUnlocked = state.infinityCount > 0;
  elements.infinityTabState.textContent = infinityReady ? "READY" : infinityUnlocked ? "OPEN" : "LOCKED";
  elements.infinityTabBadge.classList.toggle("is-visible", infinityReady);
  elements.infinityUnlockNote.hidden = infinityUnlocked;
  elements.infinityPoints.textContent = formatUiNumber(state.infinityPoints);
  elements.infiniteScore.textContent = formatUiNumber(state.infiniteScore);
  elements.infiniteScorePanel.textContent = formatUiNumber(state.infiniteScore);
  elements.infiniteAngleBoost.textContent = `×${infiniteAngleBoost().toFixed(2)}`;
  elements.infiniteAngleBoostPanel.textContent = `×${infiniteAngleBoost().toFixed(2)}`;
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

  const unlockedAchievements = achievementCount();
  elements.achievementTabState.textContent = `${unlockedAchievements}/${ACHIEVEMENT_COUNT}`;
  elements.achievementSummary.textContent = `${unlockedAchievements}/${ACHIEVEMENT_COUNT} ${t("tabAchievements")}`;
  elements.achievementBoost.textContent = `×${achievementGainMultiplier().toFixed(3)}`;
  updateAchievementRows();

  syncFormControl(elements.floatingTextToggle, state.showFloatingText);
  syncFormControl(elements.lightEffectsToggle, state.lightEffects);
  syncFormControl(elements.fpsToggle, state.showFps);
  syncFormControl(elements.languageSelect, state.language);
  syncFormControl(elements.numberFormatSelect, state.numberFormat);
  syncFormControl(elements.timeUnitSelect, state.timeUnit);
  elements.fpsCounter.hidden = !state.showFps;
  if (state.showFps) elements.fpsCounter.textContent = `FPS ${Math.round(smoothedFps)}`;
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
  if (!canRunGeneration()) return;

  const generationScoreBeforeReset = state.generationScore;
  const reward = generationRewardFor(state.generationScore);
  const nextCostFactor = state.generationCostFactor * (1 - reward.costReduction);
  state.generationCount += 1;
  state.previousGenerationScore = generationScoreBeforeReset;
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
  state.previousGenerationScore = 0;
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
  state.previousGenerationScore = 0;
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

function switchInfinitySubtab(tab) {
  activeInfinitySubtab = tab;
  elements.infinitySubtabs.forEach((button) => {
    const active = button.dataset.infinityTab === activeInfinitySubtab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  elements.infinitySubpanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.infinityPanel === activeInfinitySubtab);
  });
}

function applySetting(key, value) {
  state[key] = value;
  if (key === "language") {
    state.language = normalizeChoice(value, ["ja", "en"], "ja");
    appliedLanguage = "";
  }
  if (key === "numberFormat") state.numberFormat = normalizeChoice(value, ["compact", "scientific", "detailed"], "compact");
  if (key === "timeUnit") state.timeUnit = normalizeChoice(value, ["auto", "seconds", "milliseconds"], "auto");
  if (key === "showFloatingText" && !value) state.floatingTexts = [];
  if (key === "lightEffects" && value) state.floatingTexts = [];
  if (key === "showFps") state.showFps = Boolean(value);
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
  const width = Math.max(1, Math.floor(rect.width * scale));
  const height = Math.max(1, Math.floor(rect.height * scale));
  if (canvas.width === width && canvas.height === height) {
    draw();
    return;
  }
  canvas.width = width;
  canvas.height = height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  draw();
}

function currentFrameTime() {
  return window.performance && performance.now ? performance.now() : Date.now();
}

let lastTime = currentFrameTime();
function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.08);
  if (dt > 0) {
    const instantFps = 1 / dt;
    smoothedFps = smoothedFps === 0 ? instantFps : smoothedFps * 0.9 + instantFps * 0.1;
  }
  lastTime = now;
  update(dt);
  updateUi();
  draw();
  requestNextFrame(frame);
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
    lapSpeedMultiplier: Number(lapSpeedMultiplier().toPrecision(6)),
    rawLapSpeedMultiplier: Number(rawLapSpeedMultiplier().toPrecision(6)),
    lapSpeedSoftcapStart: Number(lapSpeedSoftcapStart().toPrecision(6)),
    lapSpeedSoftcapped: isLapSpeedSoftcapped(),
    point: { x: Number(point.x.toFixed(1)), y: Number(point.y.toFixed(1)), progress: Number(state.pointProgress.toFixed(3)) },
    core: { x: Number(points[0].x.toFixed(1)), y: Number(points[0].y.toFixed(1)) },
    coreCount: coreVertexIndices().length,
    upgrades: {
      speedLevel: state.speedLevel,
      gainLevel: state.gainLevel,
      costs: costs(),
    },
    generation: {
      unlocked: state.totalScore >= GENERATION_UNLOCK_SCORE,
      canGenerate: canRunGeneration(),
      requirement: Number(generationRequirement().toPrecision(6)),
      count: state.generationCount,
      previousGenerationScore: Number(state.previousGenerationScore.toPrecision(6)),
      rawScoreMultiplier: Number(state.generationScoreMultiplier.toFixed(2)),
      achievementScoreMultiplier: Number(generationAchievementMultiplier().toFixed(2)),
      scoreMultiplier: Number(generationScoreMultiplierEffect().toFixed(2)),
      costFactor: Number(generationCostFactorEffect().toFixed(2)),
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
      challengeCount: INFINITY_CHALLENGE_COUNT,
      activeChallengeName: state.activeChallenge > 0 ? challengeName(state.activeChallenge) : challengeName(0),
      softcapPower: Number(infinitySoftcapPower().toFixed(3)),
      capBroken: state.infiniteCapBroken,
      canBreakCap: canBreakInfiniteCap(),
      ipUpgradeEffect: Number(infinityUpgradeEffect(state.ipGainUpgradeLevel).toPrecision(6)),
    },
    achievements: {
      unlocked: achievementCount(),
      total: ACHIEVEMENT_COUNT,
      gainMultiplier: Number(achievementGainMultiplier().toFixed(4)),
      vertexGainIncrease: Number(vertexGainIncrease().toPrecision(6)),
      mask: state.achievementMask,
      generationMultiplierReward: isAchievementUnlocked(3),
    },
    settings: {
      showFloatingText: state.showFloatingText,
      lightEffects: state.lightEffects,
      showFps: state.showFps,
      fps: Number(smoothedFps.toFixed(1)),
      language: state.language,
      numberFormat: state.numberFormat,
      timeUnit: state.timeUnit,
      activeMainTab,
      activeInfinitySubtab,
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
  checkAchievements,
  switchMainTab,
  switchInfinitySubtab,
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
elements.infinitySubtabs.forEach((button) => {
  button.addEventListener("click", () => switchInfinitySubtab(button.dataset.infinityTab));
});
elements.floatingTextToggle.addEventListener("change", () => applySetting("showFloatingText", elements.floatingTextToggle.checked));
elements.lightEffectsToggle.addEventListener("change", () => applySetting("lightEffects", elements.lightEffectsToggle.checked));
elements.fpsToggle.addEventListener("change", () => applySetting("showFps", elements.fpsToggle.checked));
elements.languageSelect.addEventListener("change", () => applySetting("language", elements.languageSelect.value));
elements.numberFormatSelect.addEventListener("change", () => applySetting("numberFormat", elements.numberFormatSelect.value));
elements.timeUnitSelect.addEventListener("change", () => applySetting("timeUnit", elements.timeUnitSelect.value));
if (elements.updateModalClose) elements.updateModalClose.addEventListener("click", closeUpdateModal);
window.addEventListener("beforeunload", () => saveGame("manual"));
window.addEventListener("resize", resizeCanvas);
const canvasResizeObserver = window.ResizeObserver && canvas.parentElement
  ? new ResizeObserver(resizeCanvas)
  : null;
if (canvasResizeObserver) canvasResizeObserver.observe(canvas.parentElement);
window.addEventListener("keydown", (event) => {
  const updateModalVisible = elements.updateModal && !elements.updateModal.hidden;
  if (updateModalVisible && event.key === "Escape") {
    closeUpdateModal();
    return;
  }
  if (updateModalVisible) return;
  if (event.key.toLowerCase() === "f") {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }
});

loadGame();
createChallengeRows();
createAchievementRows();
switchMainTab(activeMainTab);
switchInfinitySubtab(activeInfinitySubtab);
resizeCanvas();
updateUi();
showUpdateModalIfNeeded();
if (document.fonts) {
  document.fonts.ready.then(() => {
    japaneseFontReady = true;
    updateUi();
    draw();
  });
} else {
  japaneseFontReady = true;
}
requestNextFrame(frame);
