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
  infinityUpgradeTree: document.getElementById("infinityUpgradeTree"),
  infinityUpgradeDetailName: document.getElementById("infinityUpgradeDetailName"),
  infinityUpgradeDetailState: document.getElementById("infinityUpgradeDetailState"),
  infinityUpgradeDetailEffect: document.getElementById("infinityUpgradeDetailEffect"),
  infinityUpgradeDetailRequires: document.getElementById("infinityUpgradeDetailRequires"),
  infinityUpgradeDetailCost: document.getElementById("infinityUpgradeDetailCost"),
  infinityUpgradeDetailBuy: document.getElementById("infinityUpgradeDetailBuy"),
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
  automationMasterToggle: document.getElementById("automationMasterToggle"),
  autoBuySpeedToggle: document.getElementById("autoBuySpeedToggle"),
  autoBuyVertexToggle: document.getElementById("autoBuyVertexToggle"),
  autoBuyGainToggle: document.getElementById("autoBuyGainToggle"),
  autoCompleteChallengesToggle: document.getElementById("autoCompleteChallengesToggle"),
  automationLockNote: document.getElementById("automationLockNote"),
  currentInfinityRunTime: document.getElementById("currentInfinityRunTime"),
  totalPlayTime: document.getElementById("totalPlayTime"),
  fastestInfinityTime: document.getElementById("fastestInfinityTime"),
  lastInfinityRuns: document.getElementById("lastInfinityRuns"),
  saveCodeArea: document.getElementById("saveCodeArea"),
  exportSaveCodeButton: document.getElementById("exportSaveCodeButton"),
  importSaveCodeButton: document.getElementById("importSaveCodeButton"),
  copySaveCodeButton: document.getElementById("copySaveCodeButton"),
};

const BASE_LAP_SECONDS = 6;
const GENERATION_UNLOCK_SCORE = 1000000;
const GENERATION_MIN_NEW_COST_FACTOR = 0.78;
const CORE_BOOST_BASE_REQUIREMENT = 1e20;
const INFINITY_REQUIREMENT_LOG10 = 308 + Math.log10(1.8);
const BREAK_CAP_REQUIREMENT_LOG10 = 350;
const MAX_TRACKED_LOG10 = 1000000000;
const MAX_RENDERED_VERTICES = 10000;
const MAX_DRAW_VERTICES = 720;
const LAP_SPEED_SUPER_SOFTCAP_START_LOG10 = 22;
const LAP_SPEED_SUPER_SOFTCAP_LOG_STRENGTH = 0.25;
const INFINITY_CHALLENGE_COUNT = 8;
const ACHIEVEMENT_COUNT = 14;
const SAVE_KEY = "angle-incremental-save";
const SAVE_QUARANTINE_KEY = "angle-incremental-save-quarantine";
const SAVE_VERSION = 7;
const APP_VERSION = "0.1.0";
const SAVE_CODE_PREFIX = "ANGLE_SAVE_V2:";
const SAVE_CODE_SALT = "angle-incremental-save-code-v2";
const SAVE_CODE_SECRET = "Angle Incremental local save code obfuscation";
const UPDATE_SEEN_KEY = "angle-incremental-seen-version";
const UPDATE_RELOAD_TARGET_KEY = "angle-incremental-update-reload-target";
const UPDATE_RELOAD_TIME_KEY = "angle-incremental-update-reload-time";
const UPDATE_DEFERRED_TARGET_KEY = "angle-incremental-update-deferred-target";
const VERSION_MANIFEST_URL = "version.json";
const UPDATE_CHECK_INTERVAL_SECONDS = 60;
const UPDATE_RETRY_COOLDOWN_MS = 10 * 60 * 1000;
const UI_UPDATE_INTERVAL_SECONDS = 0.1;
const MAX_SIMULATION_STEP_SECONDS = 1 / 30;
const MAX_VERTEX_STEPS_PER_FRAME = 5000;
const MAX_EXACT_CORE_HITS = 50000;
const CORE_HIT_APPROX_SEGMENTS = 2048;
const LAP_SPEED_SOFTCAP_START = 200;
const LAP_SPEED_SOFTCAP_POWER = 0.5;
const PRE_GENERATION_LAP_SPEED_SOFTCAP_START = 35;
const PRE_GENERATION_LAP_SPEED_SOFTCAP_POWER = 0.22;
const PRE_GENERATION_COST_SCALING = {
  speed: { startsAfter: 20, logScale: 0.3 },
  vertex: { startsAfter: 15, logScale: 1.2 },
  gain: { startsAfter: 12, logScale: 0.55 },
};
const STAGED_UPGRADE_COST_SCALING = [
  { startsAfterLog10: 30, logScale: 0.02 },
  { startsAfterLog10: 100, logScale: 0.006 },
];
const INFINITE_ANGLE_CONVERSION_COST_LOG10 = 20;
const GENERATION_SCORE_POWER = 2;
const GENERATION_SCORE_POWER_IC3_REWARD = 2.1;
const GENERATION_COST_POWER_IC3_REWARD = 1.08;
const VERTEX_EPSILON = 1e-9;
const TAU = Math.PI * 2;
const BUY_ALL_LIMIT = 1000;
const AUTOBUY_INTERVAL_SECONDS = 0.1;
const MAX_VERTEX_PROGRESS_TRACKED = 1000000000000;
const TEXT = {
  ja: {
    tabAngle: "図形",
    tabAutomation: "自動化",
    tabStatistics: "統計",
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
    automation: "自動化",
    automationLocked: "IU 1-2で解放",
    automationMaster: "自動購入",
    autoBuySpeed: "周回速度 自動購入",
    autoBuyVertex: "角追加 自動購入",
    autoBuyGain: "頂点獲得量 自動購入",
    autoCompleteChallenges: "IC自動完了",
    statistics: "統計",
    currentInfinityRun: "現在のInfinity周回",
    totalPlayTimeLabel: "総プレイ時間",
    fastestInfinity: "最速Infinity",
    lastInfinityRunsLabel: "過去10回のInfinity",
    noInfinityRuns: "記録なし",
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
    infinityUpgradePurchased: "購入済み",
    infinityUpgradeAvailable: "購入可能",
    infinityUpgradeLocked: "未解放",
    infinityUpgradeNeedIp: "IP不足",
    infinityUpgradeCost: "必要",
    infinityUpgradeRequires: "前提",
    infinityUpgradeNoRequires: "前提なし",
    infinityUpgradeSelected: "選択中",
    buyInfinityUpgrade: "購入",
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
    saveCode: "セーブコード",
    exportSaveCode: "書き出し",
    importSaveCode: "読み込み",
    copySaveCode: "コピー",
    resetSave: "セーブをリセット",
    helpAngle: "左の強化で周回速度、角、頂点獲得量を伸ばします。",
    helpGeneration: "世代スコアが 1,000,000 に届いたら、下部の世代交代で倍率を得ます。",
    helpCoreBoost: "1.00e20 スコアから実行でき、世代以下をリセットして指数と増加倍率を得ます。",
    helpInfinity: "1.80e308 到達で初回は自動発動し、以降は任意発動で IP を得ます。",
    helpChallenge: "Infinity Upgrade 4-1 後に挑戦できます。縛り状態で Infinity に到達すると報酬を得ます。",
    helpBreakCap: "1.00e350 到達で、Infinity 以降の強いソフトキャップを破壊します。",
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
    challengeLocked: "IU 4-1後に解放",
    challengeNone: "未挑戦",
    challengeRestrictionLabel: "制約",
    challengeRewardLabel: "報酬",
    core: "核",
    currentGain: "核到達時の獲得量",
    baseExpression: "基礎獲得式",
    savedAuto: "自動保存済み",
    savedManual: "保存済み",
    saveCodeExported: "セーブコードを書き出しました",
    saveCodeImported: "セーブコードを読み込みました",
    saveCodeCopied: "セーブコードをコピーしました",
    saveCodeInvalid: "セーブコードが無効です",
    saveCodeCryptoUnavailable: "暗号化機能を利用できません",
    saveFailed: "保存失敗",
    noSave: "未保存",
    loaded: "ロード済み",
    oldSave: "セーブ形式が古い",
    loadFailed: "読み込み失敗",
    updateReloadDeferred: "更新待機中：手動リロードしてください",
    resetDone: "リセット済み",
    resetConfirm: "保存済みの進行状況をすべてリセットしますか？",
    updateTitle: "アップデート",
    updateSummary: "Infinity ChallengeとGenerationを再調整しました。",
    updateResetDock: "IC1からIC8までの制約と報酬を新仕様へ更新しました。",
    updateCanvas: "Generation倍率をlog管理にし、速度の追加ソフトキャップを強化しました。",
    updateModalNote: "IC7報酬、自動購入頻度、統計のミリ秒表示を修正しました。",
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
    tabAutomation: "Automation",
    tabStatistics: "Stats",
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
    automation: "Automation",
    automationLocked: "Unlocked by IU 1-2",
    automationMaster: "Autobuy",
    autoBuySpeed: "Autobuy lap speed",
    autoBuyVertex: "Autobuy vertices",
    autoBuyGain: "Autobuy vertex gain",
    autoCompleteChallenges: "Auto-complete IC",
    statistics: "Statistics",
    currentInfinityRun: "Current Infinity run",
    totalPlayTimeLabel: "Total play time",
    fastestInfinity: "Fastest Infinity",
    lastInfinityRunsLabel: "Last 10 Infinity runs",
    noInfinityRuns: "No records",
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
    infinityUpgradePurchased: "Purchased",
    infinityUpgradeAvailable: "Available",
    infinityUpgradeLocked: "Locked",
    infinityUpgradeNeedIp: "Need IP",
    infinityUpgradeCost: "Cost",
    infinityUpgradeRequires: "Requires",
    infinityUpgradeNoRequires: "No prerequisite",
    infinityUpgradeSelected: "Selected",
    buyInfinityUpgrade: "Buy",
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
    saveCode: "Save code",
    exportSaveCode: "Export",
    importSaveCode: "Import",
    copySaveCode: "Copy",
    resetSave: "Reset save",
    helpAngle: "Use normal upgrades to improve lap speed, vertices, and vertex gain.",
    helpGeneration: "Reach 1,000,000 generation score, then generate for permanent lower-layer boosts.",
    helpCoreBoost: "Starts at 1.00e20 score and resets Generation progress for gain growth and exponent boosts.",
    helpInfinity: "First triggers automatically at 1.80e308, then can be run manually for IP.",
    helpChallenge: "Available after Infinity Upgrade 4-1. Reach Infinity under a restriction to claim a reward.",
    helpBreakCap: "Reach 1.00e350 to break the heavy post-Infinity softcap.",
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
    challengeLocked: "Unlocked after IU 4-1",
    challengeNone: "No challenge",
    challengeRestrictionLabel: "Restriction",
    challengeRewardLabel: "Reward",
    core: "Core",
    currentGain: "Gain on core hit",
    baseExpression: "Base gain formula",
    savedAuto: "Autosaved",
    savedManual: "Saved",
    saveCodeExported: "Save code exported",
    saveCodeImported: "Save code imported",
    saveCodeCopied: "Save code copied",
    saveCodeInvalid: "Invalid save code",
    saveCodeCryptoUnavailable: "Crypto is unavailable",
    saveFailed: "Save failed",
    noSave: "No save",
    loaded: "Loaded",
    oldSave: "Old save format",
    loadFailed: "Load failed",
    updateReloadDeferred: "Update waiting: reload manually",
    resetDone: "Reset",
    resetConfirm: "Reset all saved progress?",
    updateTitle: "Update",
    updateSummary: "Infinity Challenges and Generation were rebalanced.",
    updateResetDock: "IC1 through IC8 restrictions and rewards were updated to the new spec.",
    updateCanvas: "Generation multipliers now use log tracking, and the extra lap-speed softcap is stronger.",
    updateModalNote: "IC7 rewards, autobuy frequency, and statistics millisecond display were fixed.",
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
    condition: { ja: "ラップスピードが100を超える", en: "Raise lap speed above 100." },
    reward: { ja: "", en: "" },
    isUnlocked: () => lapSpeedMultiplier() > 100,
  },
  {
    title: { ja: "contagon", en: "contagon" },
    condition: { ja: "頂点の数が30を超える", en: "Raise vertices above 30." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.vertices > 30,
  },
  {
    title: { ja: "スケーリングは始まっている", en: "Scaling Has Begun" },
    condition: { ja: "所持スコアがe30を超える", en: "Hold more than 1e30 score." },
    reward: { ja: "", en: "" },
    isUnlocked: () => currentScoreLog10() > 30,
  },
  {
    title: { ja: "増幅、増幅、増幅", en: "Boost, Boost, Boost" },
    condition: { ja: "CB3に到達", en: "Reach Core Boost 3." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.coreBoostCount >= 3,
  },
  {
    title: { ja: "宇宙は収縮する", en: "The Universe Contracts" },
    condition: { ja: "Infinityに到達", en: "Reach Infinity." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.infinityCount > 0,
  },
  {
    title: { ja: "根元から", en: "From the Root" },
    condition: { ja: "Infinity Upgradesを購入", en: "Buy an Infinity Upgrade." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.infinityUpgradeMask !== 0,
  },
  {
    title: { ja: "Tips:目を休める時間です", en: "Tip: Time to Rest Your Eyes" },
    condition: { ja: "累計5時間プレイする", en: "Play for 5 total hours." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.totalPlayTime >= 5 * 60 * 60,
  },
  {
    title: { ja: "一代で成り上がれ", en: "Rise in One Lifetime" },
    condition: { ja: "GRなしでCB1に到達", en: "Reach Core Boost 1 without Generation." },
    reward: { ja: "", en: "" },
    isUnlocked: () => state.noGenerationCoreBoostReached,
  },
  {
    title: { ja: "かつての記憶", en: "Former Memory" },
    condition: { ja: "IU4-1を購入", en: "Buy IU 4-1." },
    reward: { ja: "", en: "" },
    isUnlocked: () => hasInfinityUpgrade("4-1"),
  },
  {
    title: { ja: "乗り越える時", en: "Time to Overcome" },
    condition: { ja: "Infinite Challengeを1つクリア", en: "Complete one Infinity Challenge." },
    reward: { ja: "", en: "" },
    isUnlocked: () => completedChallengeCount() > 0,
  },
];

const INFINITY_CHALLENGES = [
  {
    name: { ja: "IC1 改悪された計算式", en: "IC1 Worsened Formula" },
    restriction: { ja: "基礎獲得式の(x/y)^zのyが10倍される", en: "The y in the base (x/y)^z formula is multiplied by 10." },
    reward: { ja: "yは撤廃される", en: "Removes y from the base formula." },
  },
  {
    name: { ja: "IC2 現実的に書ける範囲で", en: "IC2 Within Writable Bounds" },
    restriction: { ja: "角の数は200を超えない", en: "Vertices cannot exceed 200." },
    reward: { ja: "upgrade購入スコアが^0.95される", en: "Normal upgrade score costs are raised to ^0.95." },
  },
  {
    name: { ja: "IC3 ナメクジよりは早い", en: "IC3 Faster Than a Slug" },
    restriction: { ja: "ラップスピードが^0.8され、周回速度アップグレードのコスト増加が2倍になる", en: "Lap speed is raised to ^0.8 and speed upgrade cost growth is doubled." },
    reward: { ja: "ラップスピードx1.1", en: "Lap speed x1.1." },
  },
  {
    name: { ja: "IC4 うん、それ以上もそれ以下もないよ", en: "IC4 Nothing More, Nothing Less" },
    restriction: { ja: "頂点獲得量が^0.5される", en: "Gain per vertex is raised to ^0.5." },
    reward: { ja: "頂点獲得量が^1.1される", en: "Gain per vertex is raised to ^1.1." },
  },
  {
    name: { ja: "IC5 環境配慮", en: "IC5 Environmental Consideration" },
    restriction: { ja: "核増幅は使えない", en: "Core Boost cannot be used." },
    reward: { ja: "核増幅の獲得指数+0.01", en: "Core Boost gain exponent +0.01." },
  },
  {
    name: { ja: "IC6 最初だけ強い", en: "IC6 Strong Only at First" },
    restriction: { ja: "頂点通過ごとの増加は0.001で固定される", en: "Gain per vertex is fixed at 0.001." },
    reward: { ja: "Infinity獲得量を×2", en: "Infinity count gain x2." },
  },
  {
    name: { ja: "IC7 倹約家もどき", en: "IC7 Pretend Saver" },
    restriction: { ja: "スコアが1e30を超えると、アップグレードを購入できなくなる", en: "Normal upgrades cannot be bought above 1e30 score." },
    reward: { ja: "購入価格以上のスコアがあれば、通常アップグレード購入時にスコアを消費しない", en: "Normal upgrades no longer spend score, but still require enough score to afford them." },
  },
  {
    name: { ja: "IC8 反出生主義", en: "IC8 Anti-Natalism" },
    restriction: { ja: "角の数は3で始まり角増加アップグレードは購入できず、角はGRとCBでリセットされない", en: "Starts at 3 vertices, vertex upgrades cannot be bought, and vertices are not reset by Generation or Core Boost." },
    reward: { ja: "角の数はGRとCBでリセットされなくなる", en: "Vertices are no longer reset by Generation or Core Boost." },
  },
];

const INFINITY_UPGRADES = [
  {
    id: "1-1",
    bit: 0,
    cost: 1,
    requires: [],
    name: { ja: "1-1 リセットは負ではない", en: "1-1 Resets Are Not Negative" },
    effect: {
      ja: "頂点通過ごとの増加がInfinity回数に応じて強化される",
      en: "Gain per vertex scales with Infinity count.",
    },
  },
  {
    id: "1-2",
    bit: 1,
    cost: 1,
    requires: [],
    name: { ja: "1-2 はじめてのQoL", en: "1-2 First QoL" },
    effect: { ja: "通常強化の自動購入を解放", en: "Unlocks normal-upgrade autobuy." },
  },
  {
    id: "2-1",
    bit: 2,
    cost: 1,
    requires: ["1-1", "1-2"],
    name: { ja: "2-1 最速タイム", en: "2-1 Fastest Time" },
    effect: { ja: "ラップスピードが×1.5される", en: "Multiplies lap speed by 1.5." },
  },
  {
    id: "3-1",
    bit: 3,
    cost: 3,
    requires: ["2-1"],
    name: { ja: "3-1 実績3を獲得するにはこれがほぼ必須です", en: "3-1 Almost Required For Achievement 3" },
    effect: { ja: "GRスコア倍率が^1.5される", en: "Raises GR score multiplier to ^1.5." },
  },
  {
    id: "3-2",
    bit: 4,
    cost: 3,
    requires: ["2-1"],
    name: { ja: "3-2 (必須じゃない方だけど強い)", en: "3-2 Optional, But Strong" },
    effect: { ja: "GRコスト倍率が×0.95される", en: "Multiplies GR cost factor by 0.95." },
  },
  {
    id: "4-1",
    bit: 5,
    cost: 5,
    requires: ["3-1", "3-2"],
    name: { ja: "4-1 縛り縛られ", en: "4-1 Bound By Restrictions" },
    effect: { ja: "Infinity Challengeを解放", en: "Unlocks Infinity Challenges." },
  },
];

const state = {
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
};

const SAVE_FIELDS = [
  "score",
  "scoreLog10",
  "totalScore",
  "totalScoreLog10",
  "generationScore",
  "generationScoreLog10",
  "vertices",
  "speedLevel",
  "gainLevel",
  "currentGain",
  "currentGainLog10",
  "pointProgress",
  "totalVertexProgress",
  "lastVertexIndex",
  "generationCount",
  "previousGenerationScore",
  "previousGenerationScoreLog10",
  "generationScoreMultiplier",
  "generationScoreMultiplierLog10",
  "generationCostFactor",
  "coreBoostCount",
  "infinityCount",
  "infinityPoints",
  "infinityPointsLog10",
  "infiniteScore",
  "infiniteScoreLog10",
  "infinityUpgradeMask",
  "ipGainUpgradeLevel",
  "infiniteAngleUpgradeLevel",
  "softcapUpgradeLevel",
  "activeChallenge",
  "completedChallenges",
  "infiniteCapBroken",
  "achievementMask",
  "totalPlayTime",
  "currentInfinityRunTime",
  "fastestInfinityTime",
  "lastInfinityRuns",
  "automationEnabled",
  "autoBuySpeed",
  "autoBuyVertex",
  "autoBuyGain",
  "autoCompleteChallenges",
  "ic8VertexDecayElapsed",
  "noGenerationCoreBoostReached",
  "showFloatingText",
  "lightEffects",
  "showFps",
  "language",
  "numberFormat",
  "timeUnit",
  "lastEarned",
  "lastEarnedLog10",
];

let autoSaveElapsed = 0;
let updateCheckElapsed = 0;
let updateCheckInFlight = false;
let japaneseFontReady = false;
let normalAutobuyElapsed = 0;
let uiUpdateElapsed = 0;
let activeMainTab = "angle";
let activeInfinitySubtab = "upgrades";
let selectedInfinityUpgradeId = "1-1";
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

function storedUpdateReloadTime() {
  try {
    return sanitizeNumber(localStorage.getItem(UPDATE_RELOAD_TIME_KEY), 0);
  } catch (error) {
    return 0;
  }
}

function markUpdateDeferred(targetVersion) {
  try {
    localStorage.setItem(UPDATE_DEFERRED_TARGET_KEY, targetVersion);
  } catch (error) {
    // Non-critical: the visible save status still tells the player what to do.
  }
  setSaveStatus(t("updateReloadDeferred"));
}

function reloadForRemoteUpdate(targetVersion) {
  const now = Date.now();
  try {
    const previousTarget = localStorage.getItem(UPDATE_RELOAD_TARGET_KEY);
    const previousTime = storedUpdateReloadTime();
    if (previousTarget === targetVersion) {
      markUpdateDeferred(targetVersion);
      return;
    }
    if (previousTime > 0 && now - previousTime < UPDATE_RETRY_COOLDOWN_MS) {
      markUpdateDeferred(targetVersion);
      return;
    }
    localStorage.setItem(UPDATE_RELOAD_TARGET_KEY, targetVersion);
    localStorage.setItem(UPDATE_RELOAD_TIME_KEY, String(now));
    localStorage.removeItem(UPDATE_DEFERRED_TARGET_KEY);
  } catch (error) {
    markUpdateDeferred(targetVersion);
    return;
  }

  saveGame("manual");
  const url = new URL(window.location.href);
  url.searchParams.set("v", targetVersion);
  window.location.replace(url.toString());
}

async function checkForRemoteUpdate() {
  if (updateCheckInFlight || !window.fetch) return;
  updateCheckInFlight = true;
  try {
    const response = await fetch(`${VERSION_MANIFEST_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return;
    const manifest = await response.json();
    if (!manifest || typeof manifest.appVersion !== "string") return;
    if (manifest.appVersion && manifest.appVersion !== APP_VERSION) {
      reloadForRemoteUpdate(manifest.appVersion);
    }
  } catch (error) {
    // Update checks should never interrupt gameplay.
  } finally {
    updateCheckInFlight = false;
  }
}

function normalizeChoice(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function parseSavedNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  const trimmed = value.trim();
  if (!trimmed) return NaN;
  if (trimmed === "Infinity") return Infinity;
  if (trimmed === "-Infinity") return -Infinity;
  return Number(trimmed);
}

function sanitizeNumber(value, fallback, min = 0) {
  const parsed = parseSavedNumber(value);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

function sanitizeLog10(value, fallback = -Infinity) {
  const parsed = parseSavedNumber(value);
  if (parsed === -Infinity) return -Infinity;
  if (parsed === Infinity) return MAX_TRACKED_LOG10;
  return Number.isFinite(parsed) ? Math.min(parsed, MAX_TRACKED_LOG10) : fallback;
}

function clampLog10(value) {
  if (value === -Infinity) return -Infinity;
  if (!Number.isFinite(value)) return value === Infinity ? MAX_TRACKED_LOG10 : -Infinity;
  return Math.min(value, MAX_TRACKED_LOG10);
}

function logFromSavedValue(value, fallback = -Infinity) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const match = trimmed.match(/^([+-]?(?:\d+\.?\d*|\.\d+))(?:e|\*10\^)([+-]?\d+)$/i);
    if (match) {
      const mantissa = Number(match[1]);
      const exponent = Number(match[2]);
      if (mantissa > 0 && Number.isFinite(exponent)) {
        return clampLog10(Math.log10(mantissa) + exponent);
      }
    }
  }
  const parsed = parseSavedNumber(value);
  if (parsed === Infinity || parsed === Number.MAX_VALUE) return Math.log10(Number.MAX_VALUE);
  const log = log10Value(parsed);
  return log > -Infinity ? log : fallback;
}

function hydrateLog10(savedLog, savedValue, fallback = -Infinity) {
  const log = sanitizeLog10(savedLog, null);
  return log === null ? logFromSavedValue(savedValue, fallback) : log;
}

function hydrateLogResource(savedValue, savedLog, fallbackLog = -Infinity, integer = false) {
  const log = hydrateLog10(savedLog, savedValue, fallbackLog);
  let value = valueFromLog10(log);
  if (integer && value !== Number.MAX_VALUE) value = Math.floor(value);
  return { value, log };
}

function sanitizeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeInfinityRunRecords(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).map((record) => ({
    time: sanitizeNumber(record && record.time, 0),
    scoreLog10: sanitizeLog10(record && record.scoreLog10, -Infinity),
    ipGain: Math.max(0, Math.floor(sanitizeNumber(record && record.ipGain, 0))),
    challenge: Math.max(0, Math.floor(sanitizeNumber(record && record.challenge, 0))),
  }));
}

function valueFromLog10(log) {
  log = clampLog10(log);
  if (log === -Infinity) return 0;
  return Number.isFinite(log) && log <= 308 ? 10 ** log : Number.MAX_VALUE;
}

function subtractLog10(currentLog, amountLog) {
  if (currentLog === -Infinity || amountLog === -Infinity) return currentLog;
  if (currentLog === Infinity) return MAX_TRACKED_LOG10;
  if (amountLog > currentLog) return currentLog;
  if (currentLog - amountLog > 15) return currentLog;
  const remainingFactor = 1 - 10 ** (amountLog - currentLog);
  return remainingFactor <= 0 ? -Infinity : currentLog + Math.log10(remainingFactor);
}

function legacyInfinityUpgradeRefundLog10(data) {
  const ipLevels = Math.floor(sanitizeNumber(data.ipGainUpgradeLevel, 0));
  const angleLevels = Math.floor(sanitizeNumber(data.infiniteAngleUpgradeLevel, 0));
  const softcapLevels = Math.floor(sanitizeNumber(data.softcapUpgradeLevel, 0));
  let refundLog = -Infinity;

  const addGeometricCosts = (levels, firstCostLog, growthLog) => {
    for (let level = 0; level < Math.min(levels, 80); level += 1) {
      refundLog = combineLog10(refundLog, firstCostLog + growthLog * level);
    }
    if (levels > 80) {
      const lastLog = firstCostLog + growthLog * (levels - 1);
      refundLog = combineLog10(refundLog, lastLog + Math.log10(1 / (1 - 10 ** -growthLog)));
    }
  };

  addGeometricCosts(ipLevels, 0, log10Value(2));
  addGeometricCosts(angleLevels, log10Value(2), log10Value(2));
  addGeometricCosts(softcapLevels, log10Value(4), log10Value(3));
  return refundLog;
}

function applySaveData(data, saveVersion = SAVE_VERSION) {
  const score = hydrateLogResource(data.score, data.scoreLog10);
  state.score = score.value;
  state.scoreLog10 = score.log;
  const totalScore = hydrateLogResource(data.totalScore, data.totalScoreLog10, state.scoreLog10);
  state.totalScore = totalScore.value;
  state.totalScoreLog10 = totalScore.log;
  const generationScore = hydrateLogResource(data.generationScore, data.generationScoreLog10, state.scoreLog10);
  state.generationScore = generationScore.value;
  state.generationScoreLog10 = generationScore.log;
  state.vertices = Math.min(MAX_RENDERED_VERTICES, Math.max(3, Math.floor(sanitizeNumber(data.vertices, 3, 3))));
  state.speedLevel = Math.floor(sanitizeNumber(data.speedLevel, 0));
  state.gainLevel = Math.floor(sanitizeNumber(data.gainLevel, 0));
  const currentGain = hydrateLogResource(data.currentGain, data.currentGainLog10, 0);
  state.currentGain = currentGain.value || 1;
  state.currentGainLog10 = Math.max(0, currentGain.log);
  state.pointProgress = ((sanitizeNumber(data.pointProgress, 0) % 1) + 1) % 1;
  state.totalVertexProgress = sanitizeNumber(data.totalVertexProgress, state.pointProgress * state.vertices);
  state.lastVertexIndex = Math.floor(sanitizeNumber(data.lastVertexIndex, Math.floor(state.totalVertexProgress)));
  state.generationCount = Math.floor(sanitizeNumber(data.generationCount, 0));
  const previousGenerationScore = hydrateLogResource(
    data.previousGenerationScore,
    data.previousGenerationScoreLog10,
    state.generationCount > 0 ? log10Value(GENERATION_UNLOCK_SCORE) : -Infinity,
  );
  state.previousGenerationScore = previousGenerationScore.value;
  state.previousGenerationScoreLog10 = previousGenerationScore.log;
  const savedGenerationMultiplierLog = sanitizeLog10(data.generationScoreMultiplierLog10, null);
  state.generationScoreMultiplierLog10 = savedGenerationMultiplierLog === null
    ? log10Value(sanitizeNumber(data.generationScoreMultiplier, 1, 1))
    : savedGenerationMultiplierLog;
  state.generationScoreMultiplier = valueFromLog10(state.generationScoreMultiplierLog10);
  state.generationCostFactor = Math.max(
    GENERATION_MIN_NEW_COST_FACTOR,
    Math.min(1, sanitizeNumber(data.generationCostFactor, 1, GENERATION_MIN_NEW_COST_FACTOR)),
  );
  state.coreBoostCount = Math.floor(sanitizeNumber(data.coreBoostCount, 0));
  state.infinityCount = Math.floor(sanitizeNumber(data.infinityCount, 0));
  const infinityPoints = hydrateLogResource(data.infinityPoints, data.infinityPointsLog10, -Infinity, true);
  state.infinityPoints = infinityPoints.value;
  state.infinityPointsLog10 = infinityPoints.log;
  const infiniteScore = hydrateLogResource(data.infiniteScore, data.infiniteScoreLog10);
  state.infiniteScore = infiniteScore.value;
  state.infiniteScoreLog10 = infiniteScore.log;
  state.infinityUpgradeMask = Math.floor(sanitizeNumber(data.infinityUpgradeMask, 0));
  if (saveVersion < 3) {
    const refundLog = legacyInfinityUpgradeRefundLog10(data);
    if (refundLog > -Infinity) {
      state.infinityPointsLog10 = combineLog10(currentInfinityPointsLog10(), refundLog);
      state.infinityPoints = valueFromLog10(state.infinityPointsLog10);
    }
    state.infinityUpgradeMask = 0;
  }
  state.ipGainUpgradeLevel = 0;
  state.infiniteAngleUpgradeLevel = 0;
  state.softcapUpgradeLevel = 0;
  state.activeChallenge = Math.min(INFINITY_CHALLENGE_COUNT, Math.floor(sanitizeNumber(data.activeChallenge, 0)));
  state.completedChallenges = Math.floor(sanitizeNumber(data.completedChallenges, 0));
  if (saveVersion < 7) {
    if (state.activeChallenge > 0) {
      resetBelowInfinity();
      state.activeChallenge = 0;
    }
    state.completedChallenges = 0;
  }
  state.infiniteCapBroken = Boolean(data.infiniteCapBroken);
  const loadedAchievementMask = Math.floor(sanitizeNumber(data.achievementMask, 0));
  if (saveVersion < 4) {
    const preservedMask = (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 5);
    state.achievementMask = loadedAchievementMask & preservedMask;
    if ((loadedAchievementMask & (1 << 7)) !== 0) state.achievementMask |= 1 << 6;
  } else {
    state.achievementMask = loadedAchievementMask;
  }
  state.totalPlayTime = sanitizeNumber(data.totalPlayTime, 0);
  state.currentInfinityRunTime = sanitizeNumber(data.currentInfinityRunTime, 0);
  state.fastestInfinityTime = sanitizeNumber(data.fastestInfinityTime, 0);
  state.lastInfinityRuns = sanitizeInfinityRunRecords(data.lastInfinityRuns);
  state.automationEnabled = sanitizeBoolean(data.automationEnabled, false);
  state.autoBuySpeed = sanitizeBoolean(data.autoBuySpeed, true);
  state.autoBuyVertex = sanitizeBoolean(data.autoBuyVertex, true);
  state.autoBuyGain = sanitizeBoolean(data.autoBuyGain, true);
  state.autoCompleteChallenges = sanitizeBoolean(data.autoCompleteChallenges, false);
  state.ic8VertexDecayElapsed = sanitizeNumber(data.ic8VertexDecayElapsed, 0);
  state.noGenerationCoreBoostReached = Boolean(data.noGenerationCoreBoostReached);
  if (state.activeChallenge > 0 && !infinityChallengesUnlocked()) {
    resetBelowInfinity();
    state.activeChallenge = 0;
  }
  if (state.activeChallenge === 2 && state.vertices > 200) {
    state.vertices = 200;
    resetVertexProgress();
  }
  if (state.activeChallenge === 8 && state.vertices !== 3) {
    state.vertices = 3;
    resetVertexProgress();
  }
  state.showFloatingText = data.showFloatingText !== false;
  state.lightEffects = Boolean(data.lightEffects);
  state.showFps = Boolean(data.showFps);
  state.language = normalizeChoice(data.language, ["ja", "en"], "ja");
  state.numberFormat = normalizeChoice(data.numberFormat, ["compact", "scientific", "detailed"], data.detailedNumbers ? "detailed" : "compact");
  state.timeUnit = normalizeChoice(data.timeUnit, ["auto", "seconds", "milliseconds"], "auto");
  const lastEarned = hydrateLogResource(data.lastEarned, data.lastEarnedLog10);
  state.lastEarned = lastEarned.value;
  state.lastEarnedLog10 = lastEarned.log;
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
    encoder.encode(SAVE_CODE_SECRET),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return api.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(SAVE_CODE_SALT),
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
    setSaveStatus(t("saveCodeCryptoUnavailable"));
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
  const code = `${SAVE_CODE_PREFIX}${bytesToBase64Url(encoder.encode(JSON.stringify(envelope)))}`;
  if (elements.saveCodeArea) elements.saveCodeArea.value = code;
  setSaveStatus(t("saveCodeExported"));
  return code;
}

async function importSaveCode(code) {
  try {
    const trimmed = String(code || "").trim();
    if (!trimmed.startsWith(SAVE_CODE_PREFIX)) throw new Error("bad prefix");
    const api = cryptoApi();
    if (!api) throw new Error("crypto unavailable");
    const decoder = new TextDecoder();
    const envelope = JSON.parse(decoder.decode(base64UrlToBytes(trimmed.slice(SAVE_CODE_PREFIX.length))));
    if (!envelope || envelope.v !== 2 || !envelope.i || !envelope.d) throw new Error("bad envelope");
    const decrypted = await api.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlToBytes(envelope.i) },
      await saveCodeKey(),
      base64UrlToBytes(envelope.d),
    );
    const parsed = JSON.parse(decoder.decode(new Uint8Array(decrypted)));
    if (!parsed || !parsed.version || parsed.version > SAVE_VERSION || !parsed.state) throw new Error("bad save");
    applySaveData(parsed.state, parsed.version);
    saveGame("manual");
    updateUi();
    draw();
    setSaveStatus(t("saveCodeImported"));
    return true;
  } catch (error) {
    setSaveStatus(cryptoApi() ? t("saveCodeInvalid") : t("saveCodeCryptoUnavailable"));
    return false;
  }
}

async function importSaveCodeFromUi() {
  const ok = await importSaveCode(elements.saveCodeArea ? elements.saveCodeArea.value : "");
  if (!ok) updateUi();
}

async function copySaveCodeFromUi() {
  const code = elements.saveCodeArea ? elements.saveCodeArea.value.trim() : "";
  if (!code) return;
  try {
    const clipboard = globalThis.navigator && globalThis.navigator.clipboard;
    if (clipboard && clipboard.writeText) await clipboard.writeText(code);
    else if (elements.saveCodeArea) {
      elements.saveCodeArea.focus();
      elements.saveCodeArea.select();
      document.execCommand("copy");
    }
    setSaveStatus(t("saveCodeCopied"));
  } catch (error) {
    setSaveStatus(t("saveCodeInvalid"));
  }
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

function quarantineSave(raw) {
  try {
    if (raw) {
      localStorage.setItem(SAVE_QUARANTINE_KEY, JSON.stringify({
        quarantinedAt: Date.now(),
        appVersion: APP_VERSION,
        raw,
      }));
    }
    localStorage.removeItem(SAVE_KEY);
  } catch (error) {
    // Quarantine failure should not prevent the game from opening.
  }
}

function loadGame() {
  let raw = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      setSaveStatus(t("noSave"));
      return;
    }

    const parsed = JSON.parse(raw);
    if (!parsed.version || parsed.version > SAVE_VERSION || !parsed.state || typeof parsed.state !== "object") {
      quarantineSave(raw);
      setSaveStatus(t("oldSave"));
      return;
    }

    applySaveData(parsed.state, parsed.version);
    autoSaveElapsed = 0;
    setSaveStatus(t("loaded"));
  } catch (error) {
    quarantineSave(raw);
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
  autoSaveElapsed = 0;
  setSaveStatus(t("resetDone"));
  updateUi();
  draw();
}

function formatNumber(value) {
  if (value === Infinity) return formatLogNumber(Infinity);
  if (!Number.isFinite(value)) return "0";
  if (value < 1000) return value.toFixed(value < 10 ? 2 : 0).replace(/\.00$/, "");
  if (value < 1000000) return Math.round(value).toLocaleString("en-US");
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

function formatUiLogNumber(log10Value) {
  if (log10Value === -Infinity) return "0";
  if (!Number.isFinite(log10Value)) return formatLogNumber(log10Value);
  if (log10Value < 18) return formatUiNumber(10 ** log10Value);
  return formatLogNumber(log10Value);
}

function formatLogNumber(log10Value, capSuffix = false) {
  log10Value = clampLog10(log10Value);
  if (log10Value === -Infinity) return "0";
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
  return formatLogNumber(log10Value);
}

function formatSmallDecimal(value) {
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function gainExpressionConfig() {
  const parts = gainExpressionParts();
  if (parts <= 1) return { parts, divisor: 1, rewardRemovesDivisor: false };
  if (state.activeChallenge === 1) return { parts, divisor: parts * 10, rewardRemovesDivisor: false };
  if (isChallengeCompleted(1)) return { parts, divisor: 1, rewardRemovesDivisor: true };
  return { parts, divisor: parts, rewardRemovesDivisor: false };
}

function formatGainExpression(valueLog10) {
  const config = gainExpressionConfig();
  if (config.parts <= 1) return formatUiLogNumber(valueLog10);
  const base = formatUiLogNumber(valueLog10);
  if (config.divisor <= 1) return `(${base})^${config.parts}`;
  return `(${base} / ${config.divisor})^${config.parts}`;
}

function gainExpressionParts() {
  return Math.min(Math.floor(Math.sqrt(state.vertices)), 10);
}

function hasMultiplicativeGainExpression() {
  return gainExpressionParts() > 1;
}

function formatGainExpressionSummary() {
  return formatGainExpression(currentGainLog10());
}

function challengeText(index, key) {
  const challenge = INFINITY_CHALLENGES[index - 1];
  const language = TEXT[state.language] ? state.language : "ja";
  return challenge ? challenge[key][language] : t("challengeNone");
}

function infinityUpgradeById(id) {
  return INFINITY_UPGRADES.find((upgrade) => upgrade.id === id);
}

function hasInfinityUpgrade(id) {
  const upgrade = infinityUpgradeById(id);
  return upgrade ? (state.infinityUpgradeMask & (1 << upgrade.bit)) !== 0 : false;
}

function infinityUpgradeName(id) {
  const upgrade = infinityUpgradeById(id);
  const language = TEXT[state.language] ? state.language : "ja";
  return upgrade ? upgrade.name[language] : id;
}

function infinityUpgradeEffectText(id) {
  const upgrade = infinityUpgradeById(id);
  const language = TEXT[state.language] ? state.language : "ja";
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
  return canSpendInfinityPoints(log10Value(upgrade.cost));
}

function infinityChallengesUnlocked() {
  return state.infinityCount > 0 && hasInfinityUpgrade("4-1");
}

function rawLapSpeedLog10() {
  let multiplierLog = state.speedLevel * log10Value(1.22);
  if (hasInfinityUpgrade("2-1")) multiplierLog += log10Value(applyInfinityUpgradePower(1.5));
  if (isChallengeCompleted(3)) multiplierLog += log10Value(1.1);
  if (state.activeChallenge === 3) multiplierLog *= 0.8;
  return clampLog10(multiplierLog);
}

function rawLapSpeedMultiplier() {
  return valueFromLog10(rawLapSpeedLog10());
}

function effectiveLapSpeedLog10() {
  const rawLog = rawLapSpeedLog10();
  const softcapStart = lapSpeedSoftcapStart();
  const softcapStartLog = log10Value(softcapStart);
  const softcappedLog = rawLog <= softcapStartLog
    ? rawLog
    : softcapStartLog + (rawLog - softcapStartLog) * lapSpeedSoftcapPower();
  if (softcappedLog <= LAP_SPEED_SUPER_SOFTCAP_START_LOG10) return softcappedLog;
  return LAP_SPEED_SUPER_SOFTCAP_START_LOG10
    + Math.log10(1 + softcappedLog - LAP_SPEED_SUPER_SOFTCAP_START_LOG10) * LAP_SPEED_SUPER_SOFTCAP_LOG_STRENGTH;
}

function lapSpeedMultiplier() {
  return valueFromLog10(effectiveLapSpeedLog10());
}

function isLapSpeedSoftcapped() {
  return rawLapSpeedLog10() > log10Value(lapSpeedSoftcapStart());
}

function lapSpeedSoftcapStart() {
  if (state.generationCount <= 0) return PRE_GENERATION_LAP_SPEED_SOFTCAP_START;
  const stagedStart = Math.min(
    LAP_SPEED_SOFTCAP_START,
    60 + (state.generationCount - 1) * 40 + state.coreBoostCount * 65,
  );
  const relief = Math.min(1.5, Math.max(0, currentGenerationScoreMultiplierLog10()) * 0.08);
  return stagedStart * (1 + relief);
}

function lapSpeedSoftcapPower() {
  if (state.generationCount <= 0) return PRE_GENERATION_LAP_SPEED_SOFTCAP_POWER;
  return Math.min(
    LAP_SPEED_SOFTCAP_POWER,
    0.24 + (state.generationCount - 1) * 0.06 + state.coreBoostCount * 0.1,
  );
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

function formatLongDuration(seconds) {
  if (state.timeUnit === "milliseconds") {
    const milliseconds = Math.max(0, sanitizeNumber(seconds, 0) * 1000);
    return `${milliseconds >= 10 ? Math.round(milliseconds) : milliseconds.toFixed(2)}${t("millisecondsUnit")}`;
  }
  const totalSeconds = Math.max(0, Math.floor(sanitizeNumber(seconds, 0)));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const units = [
    { value: days, label: state.language === "en" ? "d" : "日" },
    { value: hours, label: state.language === "en" ? "h" : "時間" },
    { value: minutes, label: state.language === "en" ? "m" : "分" },
    { value: secs, label: state.language === "en" ? "s" : "秒" },
  ];
  const firstNonZero = units.findIndex((unit) => unit.value > 0);
  return units
    .slice(firstNonZero === -1 ? units.length - 1 : firstNonZero)
    .map((unit) => `${unit.value}${unit.label}`)
    .join("");
}

function log10Value(value) {
  if (value === Infinity) return Infinity;
  return value > 0 && Number.isFinite(value) ? Math.log10(value) : -Infinity;
}

function combineLog10(a, b) {
  if (a === -Infinity) return b;
  if (b === -Infinity) return a;
  if (a === Infinity || b === Infinity) return MAX_TRACKED_LOG10;
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  if (high - low > 15) return high;
  return clampLog10(high + Math.log10(1 + 10 ** (low - high)));
}

function currentScoreLog10() {
  return currentLog10ForValue(state.score, state.scoreLog10);
}

function currentLog10ForValue(value, savedLog) {
  const log = sanitizeLog10(savedLog);
  if (value === Number.MAX_VALUE && log > -Infinity) return log;
  return Math.max(log10Value(value), log);
}

function currentTotalScoreLog10() {
  return currentLog10ForValue(state.totalScore, state.totalScoreLog10);
}

function currentGenerationScoreLog10() {
  return currentLog10ForValue(state.generationScore, state.generationScoreLog10);
}

function currentGainLog10() {
  return currentLog10ForValue(state.currentGain, state.currentGainLog10);
}

function setCurrentGainLog10(log) {
  state.currentGainLog10 = Math.max(0, clampLog10(log));
  state.currentGain = valueFromLog10(state.currentGainLog10);
}

function addCurrentGain(amount) {
  if (amount <= 0) return;
  setCurrentGainLog10(combineLog10(currentGainLog10(), log10Value(amount)));
}

function gainAfterIncreaseLog10(increase, stepCount) {
  if (stepCount <= 0 || increase <= 0) return currentGainLog10();
  return combineLog10(currentGainLog10(), log10Value(increase) + log10Value(stepCount));
}

function currentPreviousGenerationScoreLog10() {
  return currentLog10ForValue(state.previousGenerationScore, state.previousGenerationScoreLog10);
}

function currentInfinityPointsLog10() {
  return currentLog10ForValue(state.infinityPoints, state.infinityPointsLog10);
}

function currentInfiniteScoreLog10() {
  return currentLog10ForValue(state.infiniteScore, state.infiniteScoreLog10);
}

function scoreDisplay() {
  const scoreLog = currentScoreLog10();
  if (state.numberFormat === "scientific" && scoreLog > -Infinity) return formatScientificLog(scoreLog);
  if (scoreLog >= (state.numberFormat === "detailed" ? 3 : 18)) return formatLogNumber(scoreLog);
  return formatNumber(state.score);
}

function infinitySoftcapPower() {
  if (state.infiniteCapBroken) return 1;
  return Math.min(0.32, 0.08 + completedChallengeCount() * 0.02);
}

function applyInfinitySoftcap(rawLog10) {
  if (state.infiniteCapBroken || rawLog10 <= INFINITY_REQUIREMENT_LOG10) return rawLog10;
  return INFINITY_REQUIREMENT_LOG10 + (rawLog10 - INFINITY_REQUIREMENT_LOG10) * infinitySoftcapPower();
}

function vertexGainIncrease() {
  const infinityResetBoost = hasInfinityUpgrade("1-1") ? applyInfinityUpgradePower(Math.max(1, state.infinityCount)) : 1;
  let gain = (0.01 + state.gainLevel * 0.01)
    * coreBoostGainIncreaseMultiplier()
    * infiniteAngleBoost()
    * achievementGainMultiplier()
    * infinityResetBoost;
  if (state.activeChallenge === 6) return 0.001;
  if (state.activeChallenge === 4) gain = Math.pow(gain, 0.5);
  if (isChallengeCompleted(4)) gain = Math.pow(gain, 1.1);
  return gain;
}

function coreBoostRequirementLog10() {
  const multiplier = 2 ** state.coreBoostCount;
  if (!Number.isFinite(multiplier)) return MAX_TRACKED_LOG10;
  return Math.min(Math.log10(CORE_BOOST_BASE_REQUIREMENT) * multiplier, MAX_TRACKED_LOG10);
}

function coreBoostRequirement() {
  const requirementLog10 = coreBoostRequirementLog10();
  return requirementLog10 > 308 ? Infinity : 10 ** requirementLog10;
}

function canCoreBoost() {
  if (state.activeChallenge === 5) return false;
  return currentScoreLog10() >= coreBoostRequirementLog10();
}

function coreBoostBonusPower() {
  return 1;
}

function coreBoostGainIncreaseMultiplier() {
  return Math.pow(1 + state.coreBoostCount * 0.5, coreBoostBonusPower());
}

function coreBoostGainExponent() {
  return Math.pow(1 + state.coreBoostCount * 0.02, coreBoostBonusPower()) + (isChallengeCompleted(5) ? 0.01 : 0);
}

function generationScorePower() {
  let power = GENERATION_SCORE_POWER;
  if (hasInfinityUpgrade("3-1")) power *= applyInfinityUpgradePower(1.5);
  return power;
}

function generationCostPower() {
  return 1;
}

function currentGenerationScoreMultiplierLog10() {
  const savedLog = sanitizeLog10(state.generationScoreMultiplierLog10, null);
  return savedLog === null ? log10Value(state.generationScoreMultiplier) : savedLog;
}

function generationScoreMultiplierBaseEffectLog10(rawMultiplierLog = currentGenerationScoreMultiplierLog10()) {
  return clampLog10(rawMultiplierLog * generationScorePower());
}

function generationScoreMultiplierBaseEffect(rawMultiplier = state.generationScoreMultiplier) {
  return valueFromLog10(generationScoreMultiplierBaseEffectLog10(log10Value(rawMultiplier)));
}

function generationAchievementMultiplier() {
  return generationScoreMultiplierBaseEffect();
}

function applyGenerationAchievementRewardLog10(baseLog) {
  if (!isAchievementUnlocked(3)) return baseLog;
  if (baseLog <= 12) return log10Value(1 + (10 ** baseLog - 1) * 2);
  return clampLog10(baseLog + log10Value(2));
}

function applyGenerationAchievementReward(baseMultiplier) {
  if (!isAchievementUnlocked(3)) return baseMultiplier;
  return 1 + (baseMultiplier - 1) * 2;
}

function generationScoreMultiplierEffectLog10(includeAchievementReward = true) {
  const baseLog = generationScoreMultiplierBaseEffectLog10();
  return includeAchievementReward ? applyGenerationAchievementRewardLog10(baseLog) : baseLog;
}

function generationScoreMultiplierEffect(includeAchievementReward = true) {
  return valueFromLog10(generationScoreMultiplierEffectLog10(includeAchievementReward));
}

function generationCostFactorEffect() {
  const upgradeFactor = hasInfinityUpgrade("3-2") ? applyInfinityUpgradePower(0.95) : 1;
  return Math.pow(state.generationCostFactor, generationCostPower()) * upgradeFactor;
}

function finalScoreGainPower() {
  return 1;
}

function finalScoreGainDivisor() {
  return 1;
}

function finalScoreGain(baseGain = state.currentGain) {
  const gainLog = finalScoreGainLog10(baseGain);
  return gainLog <= 308 ? 10 ** gainLog : Infinity;
}

function angleExpressionFromBaseLog10(baseLog) {
  const config = gainExpressionConfig();
  if (config.parts <= 1) return baseLog;
  return (baseLog - log10Value(config.divisor)) * config.parts;
}

function angleExpressionLog10(baseGain = state.currentGain) {
  return angleExpressionFromBaseLog10(log10Value(Math.max(baseGain, 0)));
}

function preExpressionScoreGainLog10(baseGain = state.currentGain) {
  return angleExpressionLog10(baseGain);
}

function finalScoreGainFromBaseLog10(baseLog) {
  const angleLog = angleExpressionFromBaseLog10(baseLog) * coreBoostGainExponent();
  const boostedLog = angleLog + generationScoreMultiplierEffectLog10();
  return boostedLog * finalScoreGainPower() - log10Value(finalScoreGainDivisor());
}

function finalScoreGainLog10(baseGain = state.currentGain) {
  if (baseGain === state.currentGain) return finalScoreGainFromBaseLog10(currentGainLog10());
  return finalScoreGainFromBaseLog10(log10Value(Math.max(baseGain, 0)));
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
  if (!infinityChallengesUnlocked()) return t("challengeLocked");
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
  return [0];
}

function isCoreVertex(index) {
  return coreVertexIndices().includes(index);
}

function infiniteAngleEfficiency() {
  return 1;
}

function infiniteAngleBoost() {
  const scoreLog = currentInfiniteScoreLog10();
  if (scoreLog === -Infinity) return 1;
  const logOnePlusScore = scoreLog < 12 ? Math.log10(1 + state.infiniteScore) : scoreLog;
  return 1 + logOnePlusScore * 0.25;
}

function infiniteAngleConversionCostLog10() {
  return INFINITE_ANGLE_CONVERSION_COST_LOG10;
}

function canInfinity() {
  return currentScoreLog10() >= INFINITY_REQUIREMENT_LOG10;
}

function infinityPointGain() {
  if (!canInfinity()) return 0;
  const scoreLog = currentScoreLog10();
  const base = Math.max(1, Math.floor(scoreLog - 307));
  return Math.max(1, Math.floor(base));
}

function infiniteScoreGainPerIp() {
  return 10 * infiniteAngleEfficiency();
}

function infiniteScoreGainPerIpLog10() {
  return log10Value(infiniteScoreGainPerIp());
}

function canSpendInfinityPoints(costLog) {
  return currentInfinityPointsLog10() >= costLog;
}

function addInfinityPoints(amount) {
  const amountLog = log10Value(amount);
  state.infinityPointsLog10 = combineLog10(currentInfinityPointsLog10(), amountLog);
  state.infinityPoints = valueFromLog10(state.infinityPointsLog10);
}

function spendInfinityPoints(costLog) {
  if (!canSpendInfinityPoints(costLog)) return false;
  state.infinityPointsLog10 = subtractLog10(currentInfinityPointsLog10(), costLog);
  state.infinityPoints = valueFromLog10(state.infinityPointsLog10);
  return true;
}

function addInfiniteScoreLog(amountLog) {
  state.infiniteScoreLog10 = combineLog10(currentInfiniteScoreLog10(), amountLog);
  state.infiniteScore = valueFromLog10(state.infiniteScoreLog10);
}

function canBreakInfiniteCap() {
  return !state.infiniteCapBroken && currentScoreLog10() >= BREAK_CAP_REQUIREMENT_LOG10;
}

function sumCoreHitGains(firstCoreStep, coreHits, increase) {
  const stride = state.vertices;

  if (coreHits > MAX_EXACT_CORE_HITS) {
    let earned = 0;
    const segmentSize = coreHits / CORE_HIT_APPROX_SEGMENTS;
    for (let segment = 0; segment < CORE_HIT_APPROX_SEGMENTS; segment += 1) {
      const midHit = (segment + 0.5) * segmentSize;
      const stepAtMid = firstCoreStep + midHit * stride;
      const gainLog = gainAfterIncreaseLog10(increase, stepAtMid);
      const scoreLog = finalScoreGainFromBaseLog10(gainLog);
      earned += valueFromLog10(scoreLog) * segmentSize;
    }
    return earned;
  }

  let earned = 0;
  for (let hit = 0; hit < coreHits; hit += 1) {
    const gainLog = gainAfterIncreaseLog10(increase, firstCoreStep + hit * stride);
    earned += valueFromLog10(finalScoreGainFromBaseLog10(gainLog));
  }
  return earned;
}

function earlyLayerCostScalingFactor() {
  let generationFactor;
  if (state.generationCount <= 0) generationFactor = 1;
  else if (state.generationCount === 1) generationFactor = 0.9;
  else if (state.generationCount === 2) generationFactor = 0.45;
  else if (state.generationCount === 3) generationFactor = 0.2;
  else generationFactor = 0.08;

  let coreRelief;
  if (state.coreBoostCount <= 0) coreRelief = 1;
  else if (state.coreBoostCount === 1) coreRelief = 0.35;
  else if (state.coreBoostCount === 2) coreRelief = 0.1;
  else coreRelief = 0;

  return generationFactor * coreRelief;
}

function preGenerationCostScalingLog10(kind, level) {
  const scalingFactor = earlyLayerCostScalingFactor();
  if (scalingFactor <= 0) return 0;
  const scaling = PRE_GENERATION_COST_SCALING[kind];
  if (!scaling) return 0;
  const excess = Math.max(0, level - scaling.startsAfter);
  return excess * excess * scaling.logScale * scalingFactor;
}

function stagedUpgradeCostScalingLog10(costLog) {
  const relief = Math.max(
    0.28,
    1 - Math.max(0, state.generationCount - 1) * 0.06 - state.coreBoostCount * 0.16,
  );
  return STAGED_UPGRADE_COST_SCALING.reduce((total, stage) => {
    const excess = Math.max(0, costLog - stage.startsAfterLog10);
    return total + excess * excess * stage.logScale * relief;
  }, 0);
}

function costLog10(kind, base, level, growth) {
  const growthLog = log10Value(growth) * (state.activeChallenge === 3 && kind === "speed" ? 2 : 1);
  const rawLog = log10Value(base) + level * growthLog;
  const costFactor = generationCostFactorEffect();
  let adjustedLog;

  if (rawLog <= 300) {
    const rawCost = 10 ** rawLog;
    adjustedLog = log10Value(Math.ceil(base + (rawCost - base) * costFactor));
  } else {
    adjustedLog = rawLog + log10Value(costFactor);
  }

  const earlyAdjustedLog = adjustedLog + preGenerationCostScalingLog10(kind, level);
  const scaledLog = earlyAdjustedLog + stagedUpgradeCostScalingLog10(earlyAdjustedLog);
  return isChallengeCompleted(2) ? scaledLog * 0.95 : scaledLog;
}

function cost(kind, base, level, growth) {
  return valueFromLog10(costLog10(kind, base, level, growth));
}

function costLogs() {
  return {
    speed: costLog10("speed", 5, state.speedLevel, 1.55),
    vertex: costLog10("vertex", 12, state.vertices - 3, 1.72),
    gain: costLog10("gain", 18, state.gainLevel, 1.68),
  };
}

function costs() {
  return {
    speed: cost("speed", 5, state.speedLevel, 1.55),
    vertex: cost("vertex", 12, state.vertices - 3, 1.72),
    gain: cost("gain", 18, state.gainLevel, 1.68),
  };
}

function generationRewardForLog(generationScoreLog) {
  const depth = Math.max(0, generationScoreLog - log10Value(GENERATION_UNLOCK_SCORE));
  return {
    scoreMultiplierLog10: Math.min(8, Math.log10(1 + depth) * 2),
    scoreMultiplierGain: valueFromLog10(Math.min(8, Math.log10(1 + depth) * 2)),
    costReduction: Math.min(0.22, Math.log10(1 + depth) * 0.04),
  };
}

function generationRewardFor(generationScore) {
  return generationRewardForLog(log10Value(generationScore));
}

function generationRequirementLog10() {
  if (state.generationCount <= 0) return log10Value(GENERATION_UNLOCK_SCORE);
  return Math.max(log10Value(GENERATION_UNLOCK_SCORE), currentPreviousGenerationScoreLog10());
}

function generationRequirement() {
  return valueFromLog10(generationRequirementLog10());
}

function canRunGeneration() {
  const generationScoreLog = currentGenerationScoreLog10();
  if (state.generationCount <= 0) return generationScoreLog >= log10Value(GENERATION_UNLOCK_SCORE);
  return generationScoreLog > generationRequirementLog10();
}

function nextGenerationValues() {
  if (!canRunGeneration()) {
    return {
      scoreMultiplier: generationScoreMultiplierEffect(),
      scoreMultiplierLog10: generationScoreMultiplierEffectLog10(),
      costFactor: generationCostFactorEffect(),
    };
  }

  const reward = generationRewardForLog(currentGenerationScoreLog10());
  const nextRawScoreMultiplierLog = reward.scoreMultiplierLog10;
  const nextRawCostFactor = Math.max(GENERATION_MIN_NEW_COST_FACTOR, state.generationCostFactor * (1 - reward.costReduction));

  return {
    scoreMultiplier: valueFromLog10(applyGenerationAchievementRewardLog10(generationScoreMultiplierBaseEffectLog10(nextRawScoreMultiplierLog))),
    scoreMultiplierLog10: applyGenerationAchievementRewardLog10(generationScoreMultiplierBaseEffectLog10(nextRawScoreMultiplierLog)),
    costFactor: Math.pow(nextRawCostFactor, generationCostPower()) * (hasInfinityUpgrade("3-2") ? applyInfinityUpgradePower(0.95) : 1),
  };
}

function nextCoreBoostValues() {
  const currentCoreBoostCount = state.coreBoostCount;
  const nextCoreBoostCount = canCoreBoost() ? currentCoreBoostCount + 1 : currentCoreBoostCount;
  const power = coreBoostBonusPower();
  return {
    gainMultiplier: Math.pow(1 + nextCoreBoostCount * 0.5, power),
    gainExponent: Math.pow(1 + nextCoreBoostCount * 0.02, power),
  };
}

function formatMultiplierPreview(current, next) {
  const currentText = `×${current.toFixed(2)}`;
  const nextText = `×${next.toFixed(2)}`;
  return currentText === nextText ? currentText : `${currentText} → ${nextText}`;
}

function formatMultiplierLog(log) {
  return `×${formatUiLogNumber(log)}`;
}

function formatMultiplierLogPreview(currentLog, nextLog) {
  const currentText = formatMultiplierLog(currentLog);
  const nextText = formatMultiplierLog(nextLog);
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
  const cappedScoreLog = clampLog10(applyInfinitySoftcap(rawScoreLog));

  state.scoreLog10 = cappedScoreLog;
  state.score = cappedScoreLog <= 308 ? 10 ** cappedScoreLog : Number.MAX_VALUE;
  state.totalScoreLog10 = combineLog10(currentTotalScoreLog10(), amountLog10);
  state.generationScoreLog10 = combineLog10(currentGenerationScoreLog10(), amountLog10);
  state.totalScore = valueFromLog10(state.totalScoreLog10);
  state.generationScore = valueFromLog10(state.generationScoreLog10);
  state.lastEarnedLog10 = amountLog10;
  state.lastEarned = valueFromLog10(amountLog10);

  if (checkAchievements(true).length > 0) saveGame("manual");
  if (state.infinityCount === 0 && canInfinity()) {
    runInfinity(true);
    return true;
  }

  return false;
}

function passVertex(index) {
  addCurrentGain(vertexGainIncrease());
  if (isCoreVertex(index)) {
    const earned = finalScoreGain();
    const resetByInfinity = addScore(earned, finalScoreGainLog10());
    if (resetByInfinity) return true;
    if (state.showFloatingText && !state.lightEffects) {
      state.floatingTexts.push({
        text: `+${formatUiLogNumber(finalScoreGainLog10())}`,
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
    const batchLog = log10Value(Math.max(coreHits, 1)) + finalScoreGainFromBaseLog10(gainAfterIncreaseLog10(increase, lastCoreStep));
    const resetByInfinity = addScore(earned, Number.isFinite(earned) ? log10Value(earned) : batchLog);
    if (resetByInfinity) return true;
    if (state.showFloatingText && !state.lightEffects) {
      state.floatingTexts.push({
        text: `+${formatUiLogNumber(Number.isFinite(earned) ? log10Value(earned) : batchLog)}`,
        life: 1,
        x: canvas.width / 2,
        y: canvas.height * 0.16,
      });
    }
  }

  addCurrentGain(increase * count);
  return false;
}

function normalizeVertexProgress() {
  if (state.totalVertexProgress <= MAX_VERTEX_PROGRESS_TRACKED) return;
  const wrapped = ((state.totalVertexProgress % state.vertices) + state.vertices) % state.vertices;
  state.totalVertexProgress = wrapped;
  state.pointProgress = wrapped / state.vertices;
  state.lastVertexIndex = Math.floor(wrapped) % state.vertices;
}

function runAutobuyers() {
  if (!hasInfinityUpgrade("1-2") || !state.automationEnabled) return;
  buyAllUpgrades({
    refresh: false,
    save: false,
    allowSpeed: state.autoBuySpeed,
    allowVertex: state.autoBuyVertex,
    allowGain: state.autoBuyGain,
  });
}

function completeChallengeIfReady() {
  if (!state.autoCompleteChallenges || state.activeChallenge <= 0 || !canInfinity()) return false;
  runInfinity(false);
  return true;
}

function updateChallengeTimers(dt) {
  if (state.activeChallenge !== 8) state.ic8VertexDecayElapsed = 0;
}

function update(dt) {
  state.totalPlayTime += dt;
  state.currentInfinityRunTime += dt;
  updateChallengeTimers(dt);

  if (hasInfinityUpgrade("1-2") && state.automationEnabled) {
    normalAutobuyElapsed += dt;
    if (normalAutobuyElapsed >= AUTOBUY_INTERVAL_SECONDS) {
      normalAutobuyElapsed %= AUTOBUY_INTERVAL_SECONDS;
      runAutobuyers();
    }
  } else {
    normalAutobuyElapsed = 0;
  }

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
  if (completeChallengeIfReady()) return;

  normalizeVertexProgress();
  state.lastVertexIndex = Math.floor(state.pointProgress * state.vertices) % state.vertices;
  state.floatingTexts = state.floatingTexts
    .map((item) => ({ ...item, life: item.life - dt, y: item.y - dt * 26 }))
    .filter((item) => item.life > 0);

  autoSaveElapsed += dt;
  if (autoSaveElapsed >= 5) saveGame("auto");

  updateCheckElapsed += dt;
  if (updateCheckElapsed >= UPDATE_CHECK_INTERVAL_SECONDS) {
    updateCheckElapsed = 0;
    checkForRemoteUpdate();
  }
}

function vertexPoint(index, total = state.vertices) {
  const size = Math.min(canvas.width, canvas.height);
  const radius = size * 0.31;
  const cx = canvas.width / 2;
  const cy = canvas.height * 0.54;
  const angle = -Math.PI / 2 + (index / total) * TAU;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
    angle,
  };
}

function polygonPoints() {
  const drawCount = Math.min(state.vertices, MAX_DRAW_VERTICES);
  return Array.from({ length: drawCount }, (_, index) => vertexPoint((index / drawCount) * state.vertices));
}

function pointPosition() {
  const edgeProgress = state.pointProgress * state.vertices;
  const fromIndex = Math.floor(edgeProgress) % state.vertices;
  const toIndex = (fromIndex + 1) % state.vertices;
  const local = edgeProgress - Math.floor(edgeProgress);
  const from = vertexPoint(fromIndex);
  const to = vertexPoint(toIndex);
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
  const point = pointPosition();
  const corePoint = vertexPoint(0);
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

  points.forEach((p, index) => {
    if (state.vertices > MAX_DRAW_VERTICES && index % 12 !== 0) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, TAU);
    ctx.fillStyle = "#55d5ee";
    ctx.fill();
  });

  ctx.beginPath();
  ctx.arc(corePoint.x, corePoint.y, 11, 0, TAU);
  ctx.fillStyle = "#ff7659";
  ctx.fill();

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
    ctx.fillText(t("core"), corePoint.x, corePoint.y - 22);
  }

  if (!compactCanvas) {
    ctx.font = "800 28px 'Noto Sans JP', sans-serif";
    ctx.fillStyle = "#f2b84b";
    ctx.fillText(formatUiLogNumber(finalScoreGainLog10()), canvas.width / 2, canvas.height - 68);

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
    const locked = !infinityChallengesUnlocked();
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

function createInfinityUpgradeRows() {
  clearElement(elements.infinityUpgradeTree);
  const upgradeRows = [["1-1", "1-2"], ["2-1"], ["3-1", "3-2"], ["4-1"]];

  upgradeRows.forEach((rowIds, rowIndex) => {
    const tier = document.createElement("div");
    tier.className = "infinity-upgrade-tier";
    tier.dataset.tier = String(rowIndex + 1);

    rowIds.forEach((id) => {
      const upgrade = infinityUpgradeById(id);
      if (!upgrade) return;
      const button = document.createElement("button");
      button.className = "infinity-upgrade-node";
      button.type = "button";
      button.dataset.upgrade = upgrade.id;
      button.addEventListener("click", () => selectInfinityUpgrade(upgrade.id));

      const name = document.createElement("strong");
      name.className = "infinity-upgrade-name";

      const status = document.createElement("small");
      status.className = "infinity-upgrade-state";

      button.append(name, status);
      tier.append(button);
    });

    elements.infinityUpgradeTree.append(tier);
  });
}

function selectInfinityUpgrade(id) {
  if (!infinityUpgradeById(id)) return;
  selectedInfinityUpgradeId = id;
  updateInfinityUpgradeRows();
}

function infinityUpgradeStateText(upgrade) {
  if (hasInfinityUpgrade(upgrade.id)) return t("infinityUpgradePurchased");
  if (!infinityUpgradePrerequisitesMet(upgrade)) return t("infinityUpgradeLocked");
  if (!canSpendInfinityPoints(log10Value(upgrade.cost))) return t("infinityUpgradeNeedIp");
  return t("infinityUpgradeAvailable");
}

function updateInfinityUpgradeDetail() {
  const upgrade = infinityUpgradeById(selectedInfinityUpgradeId) || INFINITY_UPGRADES[0];
  selectedInfinityUpgradeId = upgrade.id;
  const purchased = hasInfinityUpgrade(upgrade.id);
  const prerequisitesMet = infinityUpgradePrerequisitesMet(upgrade);
  const affordable = canSpendInfinityPoints(log10Value(upgrade.cost));
  const canBuy = !purchased && prerequisitesMet && affordable;
  const requiresText = upgrade.requires.length > 0
    ? `${t("infinityUpgradeRequires")}: ${upgrade.requires.join(", ")}`
    : t("infinityUpgradeNoRequires");

  elements.infinityUpgradeDetailName.textContent = infinityUpgradeName(upgrade.id);
  elements.infinityUpgradeDetailState.textContent = `${t("infinityUpgradeSelected")} · ${infinityUpgradeStateText(upgrade)}`;
  elements.infinityUpgradeDetailEffect.textContent = infinityUpgradeEffectText(upgrade.id);
  elements.infinityUpgradeDetailRequires.textContent = requiresText;
  elements.infinityUpgradeDetailCost.textContent = `${t("infinityUpgradeCost")} ${formatUiLogNumber(log10Value(upgrade.cost))} IP`;
  elements.infinityUpgradeDetailBuy.textContent = purchased ? t("infinityUpgradePurchased") : t("buyInfinityUpgrade");
  elements.infinityUpgradeDetailBuy.disabled = !canBuy;
}

function updateInfinityUpgradeRows() {
  elements.infinityUpgradeTree.querySelectorAll(".infinity-upgrade-node").forEach((node) => {
    const upgrade = infinityUpgradeById(node.dataset.upgrade);
    if (!upgrade) return;
    const purchased = hasInfinityUpgrade(upgrade.id);
    const prerequisitesMet = infinityUpgradePrerequisitesMet(upgrade);
    const affordable = canSpendInfinityPoints(log10Value(upgrade.cost));
    const available = !purchased && prerequisitesMet && affordable;
    const selected = selectedInfinityUpgradeId === upgrade.id;

    node.classList.toggle("is-selected", selected);
    node.classList.toggle("is-purchased", purchased);
    node.classList.toggle("is-available", available);
    node.classList.toggle("is-locked", !purchased && !prerequisitesMet);
    node.classList.toggle("is-unaffordable", !purchased && prerequisitesMet && !affordable);
    node.querySelector(".infinity-upgrade-name").textContent = upgrade.id;
    node.querySelector(".infinity-upgrade-state").textContent = infinityUpgradeStateText(upgrade);
  });

  updateInfinityUpgradeDetail();
}

function buySelectedInfinityUpgrade() {
  buyInfinityUpgrade(selectedInfinityUpgradeId);
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

function canSpendLog(amountLog) {
  return currentScoreLog10() >= amountLog;
}

function canSpend(amount) {
  return canSpendLog(log10Value(amount));
}

function updateAutomationUi() {
  const unlocked = hasInfinityUpgrade("1-2");
  if (!elements.automationMasterToggle) return;
  elements.automationLockNote.textContent = unlocked ? t("infinityUpgradeAvailable") : t("automationLocked");
  elements.automationMasterToggle.disabled = !unlocked;
  elements.autoBuySpeedToggle.disabled = !unlocked;
  elements.autoBuyVertexToggle.disabled = !unlocked;
  elements.autoBuyGainToggle.disabled = !unlocked;
  if (elements.autoCompleteChallengesToggle) elements.autoCompleteChallengesToggle.disabled = !infinityChallengesUnlocked();
  syncFormControl(elements.automationMasterToggle, unlocked && state.automationEnabled);
  syncFormControl(elements.autoBuySpeedToggle, state.autoBuySpeed);
  syncFormControl(elements.autoBuyVertexToggle, state.autoBuyVertex);
  syncFormControl(elements.autoBuyGainToggle, state.autoBuyGain);
  if (elements.autoCompleteChallengesToggle) syncFormControl(elements.autoCompleteChallengesToggle, state.autoCompleteChallenges);
}

function infinityRunRecordText(record, index) {
  const challenge = record.challenge > 0 ? ` IC${record.challenge}` : "";
  return `#${index + 1}${challenge} ${formatLongDuration(record.time)} / ${formatPowerOfTen(record.scoreLog10)} / +${formatUiNumber(record.ipGain)} IP`;
}

function updateStatisticsUi() {
  if (!elements.totalPlayTime) return;
  elements.totalPlayTime.textContent = formatLongDuration(state.totalPlayTime);
  elements.currentInfinityRunTime.textContent = formatLongDuration(state.currentInfinityRunTime);
  elements.fastestInfinityTime.textContent = state.fastestInfinityTime > 0 ? formatLongDuration(state.fastestInfinityTime) : t("noInfinityRuns");
  elements.lastInfinityRuns.innerHTML = "";
  if (state.lastInfinityRuns.length === 0) {
    const row = document.createElement("li");
    row.textContent = t("noInfinityRuns");
    elements.lastInfinityRuns.append(row);
    return;
  }
  state.lastInfinityRuns.forEach((record, index) => {
    const row = document.createElement("li");
    row.textContent = infinityRunRecordText(record, index);
    elements.lastInfinityRuns.append(row);
  });
}

function updateUi() {
  const currentCostLogs = costLogs();
  const unlockedAchievementsNow = checkAchievements(true);
  if (unlockedAchievementsNow.length > 0) saveGame("manual");
  document.documentElement.classList.toggle("light-effects", state.lightEffects);
  applyLanguage();
  elements.scoreValue.textContent = scoreDisplay();
  elements.gainValue.textContent = formatUiLogNumber(finalScoreGainLog10());
  elements.vertexGainValue.textContent = `+${formatSmallDecimal(vertexGainIncrease())}`;
  elements.lapValue.textContent = formatDuration(lapDuration());
  elements.lapSpeedValue.textContent = isLapSpeedSoftcapped()
    ? `${formatMultiplierLog(effectiveLapSpeedLog10())} ${t("lapSpeedSoftcapped")} / raw ${formatMultiplierLog(rawLapSpeedLog10())}`
    : formatMultiplierLog(effectiveLapSpeedLog10());
  elements.speedLevel.textContent = `${t("level")} ${state.speedLevel}`;
  elements.vertexCount.textContent = `${state.vertices} ${t("vertices")}`;
  elements.gainLevel.textContent = `${t("level")} ${state.gainLevel}`;
  elements.speedCost.textContent = `${t("cost")} ${formatUiLogNumber(currentCostLogs.speed)}`;
  elements.vertexCost.textContent = `${t("cost")} ${formatUiLogNumber(currentCostLogs.vertex)}`;
  elements.gainCost.textContent = `${t("cost")} ${formatUiLogNumber(currentCostLogs.gain)}`;
  elements.speedUpgrade.disabled = !canBuyNormalUpgrade("speed");
  elements.vertexUpgrade.disabled = !canBuyNormalUpgrade("vertex");
  elements.gainUpgrade.disabled = !canBuyNormalUpgrade("gain");
  elements.buyAllUpgrade.disabled = !canBuyNormalUpgrade("speed") && !canBuyNormalUpgrade("vertex") && !canBuyNormalUpgrade("gain");

  const unlocked = currentTotalScoreLog10() >= log10Value(GENERATION_UNLOCK_SCORE);
  const ready = canRunGeneration();
  const waitingPrevious = unlocked
    && state.generationCount > 0
    && currentGenerationScoreLog10() >= log10Value(GENERATION_UNLOCK_SCORE)
    && !ready;
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
  elements.generationMultiplier.textContent = formatMultiplierLogPreview(generationScoreMultiplierEffectLog10(), nextGeneration.scoreMultiplierLog10);
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
  elements.infinityPoints.textContent = formatUiLogNumber(currentInfinityPointsLog10());
  elements.infiniteScore.textContent = formatUiLogNumber(currentInfiniteScoreLog10());
  elements.infiniteScorePanel.textContent = formatUiLogNumber(currentInfiniteScoreLog10());
  elements.infiniteAngleBoost.textContent = `×${infiniteAngleBoost().toFixed(2)}`;
  elements.infiniteAngleBoostPanel.textContent = `×${infiniteAngleBoost().toFixed(2)}`;
  elements.infinityPointGain.textContent = `+${formatUiNumber(infinityPointGain())} IP`;
  elements.infinityButton.disabled = state.infinityCount === 0 || !canInfinity();
  updateInfinityUpgradeRows();
  elements.convertIpButton.disabled = !canSpendInfinityPoints(infiniteAngleConversionCostLog10());
  elements.convertIpGain.textContent = `${formatUiLogNumber(infiniteAngleConversionCostLog10())} IP -> +${formatUiLogNumber(infiniteScoreGainPerIpLog10())}`;
  const completed = completedChallengeCount();
  elements.challengeStatus.textContent = state.activeChallenge > 0
    ? `${challengeName(state.activeChallenge)} ${t("challengeRunning")}`
    : !infinityChallengesUnlocked()
      ? t("locked")
      : `${completed}/${INFINITY_CHALLENGE_COUNT} ${t("completed")}`;
  updateChallengeRows();
  elements.breakCapButton.disabled = !canBreakInfiniteCap();
  elements.breakCapButton.textContent = state.infiniteCapBroken ? "Cap Broken" : "Break Infinite Cap";

  updateAutomationUi();
  updateStatisticsUi();

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

function spendLog(amountLog) {
  const scoreLog = currentScoreLog10();
  if (!canSpendLog(amountLog)) return false;

  if (scoreLog > 18 && scoreLog - amountLog > 12) {
    return true;
  }

  const remainingLog = subtractLog10(scoreLog, amountLog);
  state.scoreLog10 = remainingLog;
  state.score = valueFromLog10(remainingLog);
  return true;
}

function spend(amount) {
  return spendLog(log10Value(amount));
}

function upgradeCostLog(kind) {
  const currentCostLogs = costLogs();
  return currentCostLogs[kind];
}

function canBuyNormalUpgrade(kind) {
  if (state.activeChallenge === 7 && currentScoreLog10() > 30) return false;
  if (kind === "vertex") {
    if (state.activeChallenge === 8) return false;
    if (state.activeChallenge === 2 && state.vertices >= 200) return false;
  }
  return canSpendLog(upgradeCostLog(kind));
}

function spendNormalUpgrade(kind) {
  if (!canBuyNormalUpgrade(kind)) return false;
  if (isChallengeCompleted(7)) return true;
  return spendLog(upgradeCostLog(kind));
}

function resetVertexProgress() {
  state.pointProgress = 0;
  state.totalVertexProgress = 0;
  state.lastVertexIndex = 0;
}

function buySpeed() {
  if (!spendNormalUpgrade("speed")) return;
  state.speedLevel += 1;
  updateUi();
  saveGame("manual");
}

function buyVertex() {
  if (!spendNormalUpgrade("vertex")) return;
  state.vertices += 1;
  resetVertexProgress();
  updateUi();
  saveGame("manual");
}

function buyGain() {
  if (!spendNormalUpgrade("gain")) return;
  state.gainLevel += 1;
  updateUi();
  saveGame("manual");
}

function buyAllUpgrades(options = {}) {
  if (typeof Event !== "undefined" && options instanceof Event) options = {};
  const refresh = options.refresh !== false;
  const persist = options.save !== false;
  const allowSpeed = options.allowSpeed !== false;
  const allowVertex = options.allowVertex !== false;
  const allowGain = options.allowGain !== false;
  let purchases = 0;
  let bought = true;
  while (bought && purchases < BUY_ALL_LIMIT) {
    bought = false;
    if (allowSpeed && spendNormalUpgrade("speed")) {
      state.speedLevel += 1;
      purchases += 1;
      bought = true;
      if (purchases >= BUY_ALL_LIMIT) break;
    }

    if (allowVertex && spendNormalUpgrade("vertex")) {
      state.vertices += 1;
      resetVertexProgress();
      purchases += 1;
      bought = true;
      if (purchases >= BUY_ALL_LIMIT) break;
    }

    if (allowGain && spendNormalUpgrade("gain")) {
      state.gainLevel += 1;
      purchases += 1;
      bought = true;
    }
  }

  if (purchases > 0) {
    if (refresh) updateUi();
    if (persist) saveGame("manual");
  }
  return purchases;
}

function shouldPreserveVerticesThroughEarlyReset() {
  return state.activeChallenge === 8 || isChallengeCompleted(8);
}

function runGeneration() {
  if (!canRunGeneration()) return;

  const generationScoreBeforeResetLog = currentGenerationScoreLog10();
  const reward = generationRewardForLog(generationScoreBeforeResetLog);
  const nextCostFactor = state.generationCostFactor * (1 - reward.costReduction);
  const preservedVertices = shouldPreserveVerticesThroughEarlyReset() ? state.vertices : 3;
  state.generationCount += 1;
  state.previousGenerationScoreLog10 = generationScoreBeforeResetLog;
  state.previousGenerationScore = valueFromLog10(generationScoreBeforeResetLog);
  state.generationScoreMultiplierLog10 = reward.scoreMultiplierLog10;
  state.generationScoreMultiplier = valueFromLog10(state.generationScoreMultiplierLog10);
  state.generationCostFactor = Math.max(GENERATION_MIN_NEW_COST_FACTOR, nextCostFactor);

  state.score = 0;
  state.scoreLog10 = -Infinity;
  state.generationScore = 0;
  state.generationScoreLog10 = -Infinity;
  state.vertices = preservedVertices;
  state.speedLevel = 0;
  state.gainLevel = 0;
  state.currentGain = 1;
  state.currentGainLog10 = 0;
  state.pointProgress = 0;
  state.totalVertexProgress = 0;
  state.lastVertexIndex = 0;
  state.floatingTexts = [];
  updateUi();
  saveGame("manual");
}

function resetBelowCoreBoost() {
  const preservedVertices = shouldPreserveVerticesThroughEarlyReset() ? state.vertices : 3;
  state.score = 0;
  state.scoreLog10 = -Infinity;
  state.totalScore = 0;
  state.totalScoreLog10 = -Infinity;
  state.generationScore = 0;
  state.generationScoreLog10 = -Infinity;
  state.vertices = preservedVertices;
  state.speedLevel = 0;
  state.gainLevel = 0;
  state.currentGain = 1;
  state.currentGainLog10 = 0;
  state.pointProgress = 0;
  state.totalVertexProgress = 0;
  state.lastVertexIndex = 0;
  state.generationCount = 0;
  state.previousGenerationScore = 0;
  state.previousGenerationScoreLog10 = -Infinity;
  state.generationScoreMultiplier = 1;
  state.generationScoreMultiplierLog10 = 0;
  state.generationCostFactor = 1;
  state.floatingTexts = [];
}

function runCoreBoost() {
  if (!canCoreBoost()) return;
  if (state.coreBoostCount === 0 && state.generationCount <= 0) state.noGenerationCoreBoostReached = true;
  state.coreBoostCount += 1;
  resetBelowCoreBoost();
  updateUi();
  saveGame("manual");
}

function resetBelowInfinity() {
  state.score = 0;
  state.scoreLog10 = -Infinity;
  state.totalScore = 0;
  state.totalScoreLog10 = -Infinity;
  state.generationScore = 0;
  state.generationScoreLog10 = -Infinity;
  state.vertices = 3;
  state.speedLevel = 0;
  state.gainLevel = 0;
  state.currentGain = 1;
  state.currentGainLog10 = 0;
  state.pointProgress = 0;
  state.totalVertexProgress = 0;
  state.lastVertexIndex = 0;
  state.generationCount = 0;
  state.previousGenerationScore = 0;
  state.previousGenerationScoreLog10 = -Infinity;
  state.generationScoreMultiplier = 1;
  state.generationScoreMultiplierLog10 = 0;
  state.generationCostFactor = 1;
  state.coreBoostCount = 0;
  state.infiniteScore = 0;
  state.infiniteScoreLog10 = -Infinity;
  state.ic8VertexDecayElapsed = 0;
  state.floatingTexts = [];
}

function recordInfinityRun(scoreLog, gained, challenge) {
  const record = {
    time: state.currentInfinityRunTime,
    scoreLog10: scoreLog,
    ipGain: gained,
    challenge,
  };
  state.lastInfinityRuns.unshift(record);
  state.lastInfinityRuns = state.lastInfinityRuns.slice(0, 10);
  if (record.time > 0 && (state.fastestInfinityTime <= 0 || record.time < state.fastestInfinityTime)) {
    state.fastestInfinityTime = record.time;
  }
}

function infinityCountGain() {
  return isChallengeCompleted(6) ? 2 : 1;
}

function runInfinity(forced = false) {
  if (!canInfinity()) return;
  if (!forced && state.infinityCount === 0) return;

  const scoreLogBeforeReset = currentScoreLog10();
  const gained = infinityPointGain();
  const completedChallenge = state.activeChallenge;
  if (state.activeChallenge > 0) {
    state.completedChallenges |= 1 << (state.activeChallenge - 1);
    state.activeChallenge = 0;
  }

  state.infinityCount += infinityCountGain();
  addInfinityPoints(gained);
  recordInfinityRun(scoreLogBeforeReset, gained, completedChallenge);
  resetBelowInfinity();
  state.currentInfinityRunTime = 0;
  updateUi();
  saveGame("manual");
}

function buyInfinityUpgrade(id) {
  const upgrade = infinityUpgradeById(id);
  if (!upgrade || !canBuyInfinityUpgrade(id)) return;
  if (!spendInfinityPoints(log10Value(upgrade.cost))) return;
  state.infinityUpgradeMask |= 1 << upgrade.bit;
  updateUi();
  saveGame("manual");
}

function convertIpToInfiniteScore() {
  if (!spendInfinityPoints(infiniteAngleConversionCostLog10())) return;
  addInfiniteScoreLog(infiniteScoreGainPerIpLog10());
  updateUi();
  saveGame("manual");
}

function toggleInfinityChallenge(index = nextChallengeIndex()) {
  if (!infinityChallengesUnlocked()) return;
  if (state.activeChallenge === index) {
    state.activeChallenge = 0;
    resetBelowInfinity();
  } else if (state.activeChallenge > 0) {
    return;
  } else {
    state.activeChallenge = Math.min(INFINITY_CHALLENGE_COUNT, Math.max(1, Math.floor(index)));
    resetBelowInfinity();
    if (state.activeChallenge === 2) {
      state.vertices = Math.min(state.vertices, 200);
      resetVertexProgress();
    } else if (state.activeChallenge === 8) {
      state.vertices = 3;
      resetVertexProgress();
    }
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
  if (key === "autoCompleteChallenges") state.autoCompleteChallenges = Boolean(value);
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
  let remaining = dt;
  while (remaining > 0) {
    const step = Math.min(MAX_SIMULATION_STEP_SECONDS, remaining);
    update(step);
    remaining -= step;
  }
  uiUpdateElapsed += dt;
  if (uiUpdateElapsed >= UI_UPDATE_INTERVAL_SECONDS) {
    uiUpdateElapsed %= UI_UPDATE_INTERVAL_SECONDS;
    updateUi();
  }
  draw();
  requestNextFrame(frame);
}

function renderGameToText() {
  const points = polygonPoints();
  const point = pointPosition();
  const corePoint = vertexPoint(0);
  const scoreLog = currentScoreLog10();
  const finalGainLog = finalScoreGainLog10();
  const totalScoreLog = currentTotalScoreLog10();
  const generationScoreLog = currentGenerationScoreLog10();
  const infinityPointsLog = currentInfinityPointsLog10();
  const infiniteScoreLog = currentInfiniteScoreLog10();
  const currentGainLog = currentGainLog10();
  const currentCostLogs = costLogs();
  const gainExpression = gainExpressionConfig();
  return JSON.stringify({
    coordinateSystem: "canvas pixels, origin top-left, x right, y down",
    score: scoreDisplay(),
    scoreLog10: Number.isFinite(scoreLog) ? Number(scoreLog.toPrecision(6)) : null,
    totalScore: formatUiLogNumber(totalScoreLog),
    totalScoreLog10: Number.isFinite(totalScoreLog) ? Number(totalScoreLog.toPrecision(6)) : null,
    generationScore: formatUiLogNumber(generationScoreLog),
    generationScoreLog10: Number.isFinite(generationScoreLog) ? Number(generationScoreLog.toPrecision(6)) : null,
    currentGain: formatUiLogNumber(currentGainLog),
    currentGainLog10: Number.isFinite(currentGainLog) ? Number(currentGainLog.toPrecision(6)) : null,
    finalGainOnCore: formatUiLogNumber(finalGainLog),
    finalGainOnCoreLog10: Number.isFinite(finalGainLog) ? Number(finalGainLog.toPrecision(6)) : null,
    baseGainExpression: formatGainExpressionSummary(),
    baseGainExpressionDivisor: gainExpression.divisor,
    baseGainExpressionParts: gainExpression.parts,
    vertices: state.vertices,
    lapSeconds: Number(lapDuration().toPrecision(6)),
    lapSpeedMultiplier: Number(lapSpeedMultiplier().toPrecision(6)),
    lapSpeedLog10: Number(effectiveLapSpeedLog10().toPrecision(6)),
    rawLapSpeedMultiplier: valueFromLog10(rawLapSpeedLog10()),
    rawLapSpeedLog10: Number(rawLapSpeedLog10().toPrecision(6)),
    lapSpeedSoftcapStart: Number(lapSpeedSoftcapStart().toPrecision(6)),
    lapSpeedSoftcapPower: Number(lapSpeedSoftcapPower().toPrecision(6)),
    lapSpeedSoftcapped: isLapSpeedSoftcapped(),
    point: { x: Number(point.x.toFixed(1)), y: Number(point.y.toFixed(1)), progress: Number(state.pointProgress.toFixed(3)) },
    core: { x: Number(corePoint.x.toFixed(1)), y: Number(corePoint.y.toFixed(1)) },
    coreCount: coreVertexIndices().length,
    upgrades: {
      speedLevel: state.speedLevel,
      gainLevel: state.gainLevel,
      costs: {
        speed: formatUiLogNumber(currentCostLogs.speed),
        speedLog10: Number(currentCostLogs.speed.toPrecision(6)),
        vertex: formatUiLogNumber(currentCostLogs.vertex),
        vertexLog10: Number(currentCostLogs.vertex.toPrecision(6)),
        gain: formatUiLogNumber(currentCostLogs.gain),
        gainLog10: Number(currentCostLogs.gain.toPrecision(6)),
      },
    },
    generation: {
      unlocked: currentTotalScoreLog10() >= log10Value(GENERATION_UNLOCK_SCORE),
      canGenerate: canRunGeneration(),
      requirement: formatUiLogNumber(generationRequirementLog10()),
      requirementLog10: Number(generationRequirementLog10().toPrecision(6)),
      count: state.generationCount,
      previousGenerationScore: formatUiLogNumber(currentPreviousGenerationScoreLog10()),
      previousGenerationScoreLog10: Number.isFinite(currentPreviousGenerationScoreLog10()) ? Number(currentPreviousGenerationScoreLog10().toPrecision(6)) : null,
      rawScoreMultiplier: formatUiLogNumber(currentGenerationScoreMultiplierLog10()),
      rawScoreMultiplierLog10: Number(currentGenerationScoreMultiplierLog10().toPrecision(6)),
      achievementScoreMultiplier: formatUiLogNumber(generationScoreMultiplierBaseEffectLog10()),
      scoreMultiplier: formatUiLogNumber(generationScoreMultiplierEffectLog10()),
      scoreMultiplierLog10: Number(generationScoreMultiplierEffectLog10().toPrecision(6)),
      costFactor: Number(generationCostFactorEffect().toFixed(2)),
    },
    coreBoost: {
      canBoost: canCoreBoost(),
      count: state.coreBoostCount,
      requirement: formatPowerOfTen(coreBoostRequirementLog10()),
      requirementLog10: coreBoostRequirementLog10(),
      requirementText: formatPowerOfTen(coreBoostRequirementLog10()),
      gainIncreaseMultiplier: Number(coreBoostGainIncreaseMultiplier().toFixed(2)),
      gainExponent: Number(coreBoostGainExponent().toFixed(2)),
    },
    infinity: {
      canInfinity: canInfinity(),
      count: state.infinityCount,
      points: formatUiLogNumber(infinityPointsLog),
      pointsLog10: Number.isFinite(infinityPointsLog) ? Number(infinityPointsLog.toPrecision(6)) : null,
      pointGain: infinityPointGain(),
      infiniteScore: formatUiLogNumber(infiniteScoreLog),
      infiniteScoreLog10: Number.isFinite(infiniteScoreLog) ? Number(infiniteScoreLog.toPrecision(6)) : null,
      infiniteAngleBoost: Number(infiniteAngleBoost().toFixed(2)),
      activeChallenge: state.activeChallenge,
      completedChallenges: completedChallengeCount(),
      challengeCount: INFINITY_CHALLENGE_COUNT,
      challengesUnlocked: infinityChallengesUnlocked(),
      activeChallengeName: state.activeChallenge > 0 ? challengeName(state.activeChallenge) : challengeName(0),
      softcapPower: Number(infinitySoftcapPower().toFixed(3)),
      capBroken: state.infiniteCapBroken,
      canBreakCap: canBreakInfiniteCap(),
      infiniteAngleConversionCost: formatUiLogNumber(infiniteAngleConversionCostLog10()),
      infiniteAngleConversionCostLog10: INFINITE_ANGLE_CONVERSION_COST_LOG10,
      selectedUpgrade: selectedInfinityUpgradeId,
      selectedUpgradeCanBuy: canBuyInfinityUpgrade(selectedInfinityUpgradeId),
      upgrades: INFINITY_UPGRADES.map((upgrade) => ({
        id: upgrade.id,
        purchased: hasInfinityUpgrade(upgrade.id),
        canBuy: canBuyInfinityUpgrade(upgrade.id),
      })),
    },
    achievements: {
      unlocked: achievementCount(),
      total: ACHIEVEMENT_COUNT,
      gainMultiplier: Number(achievementGainMultiplier().toFixed(4)),
      vertexGainIncrease: Number(vertexGainIncrease().toPrecision(6)),
      mask: state.achievementMask,
      generationMultiplierReward: isAchievementUnlocked(3),
      totalPlayTime: Number(state.totalPlayTime.toFixed(1)),
      noGenerationCoreBoostReached: state.noGenerationCoreBoostReached,
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
    automation: {
      unlocked: hasInfinityUpgrade("1-2"),
      enabled: state.automationEnabled,
      speed: state.autoBuySpeed,
      vertex: state.autoBuyVertex,
      gain: state.autoBuyGain,
    },
    statistics: {
      totalPlayTime: Number(state.totalPlayTime.toFixed(1)),
      currentInfinityRunTime: Number(state.currentInfinityRunTime.toFixed(1)),
      fastestInfinityTime: state.fastestInfinityTime > 0 ? Number(state.fastestInfinityTime.toFixed(1)) : null,
      lastInfinityRuns: state.lastInfinityRuns,
    },
  });
}

// BEGIN INTEGRATED BALANCE RULES
// This section is part of the engine so reset, save, UI, and input bindings share one source of truth.
// 0.1.0 balance profile.
// Generation owns score scaling; early upgrade scaling no longer changes with GR or CB count.
const BALANCE_PROFILE = Object.freeze({
  generationRewardLogCoefficient: 0.20,
  initialUpgradeCostScaling: Object.freeze({
    speed: Object.freeze({ startsAfter: 10, logScale: 0.00140 }),
    vertex: Object.freeze({ startsAfter: 8, logScale: 0.00560 }),
    gain: Object.freeze({ startsAfter: 6, logScale: 0.00260 }),
  }),
  infinityUpgradeCostReduction: Object.freeze({
    perInfinity: 0.002,
    softcapStartExponent: 0.9,
    softcapAsymptoteExponent: 0.8,
    postSoftcapDecay: 0.005,
  }),
});

const BALANCE_INFINITY_UPGRADES = [
  {
    id: "1-1",
    bit: 0,
    cost: 1,
    requires: [],
    name: { ja: "1-1 リセットは負ではない", en: "1-1 Resets Are Not Negative" },
    effect: {
      ja: "頂点通過ごとの増加が×(Infinity回数+1)される",
      en: "Multiplies gain per vertex by Infinity count + 1.",
    },
  },
  {
    id: "1-2",
    bit: 1,
    cost: 1,
    requires: [],
    name: { ja: "1-2 はじめてのQoL", en: "1-2 First QoL" },
    effect: { ja: "通常強化の自動購入を解放", en: "Unlocks normal-upgrade autobuy." },
  },
  {
    id: "2-1",
    bit: 2,
    cost: 1,
    requires: ["1-1", "1-2"],
    name: { ja: "2-1 最速タイム", en: "2-1 Fastest Time" },
    effect: { ja: "ラップスピードが×1.5される", en: "Multiplies lap speed by 1.5." },
  },
  {
    id: "3-1",
    bit: 3,
    cost: 3,
    requires: ["2-1"],
    name: { ja: "3-1 スコア革命", en: "3-1 Score Revolution" },
    effect: { ja: "GRスコア倍率が^1.5される", en: "Raises the GR score multiplier to ^1.5." },
  },
  {
    id: "3-2",
    bit: 4,
    cost: 3,
    requires: ["2-1"],
    name: { ja: "3-2 コスト革命", en: "3-2 Cost Revolution" },
    effect: { ja: "GRコスト倍率が×0.95される", en: "Multiplies the GR cost factor by 0.95." },
  },
  {
    id: "4-1",
    bit: 5,
    cost: 5,
    requires: ["3-1", "3-2"],
    name: { ja: "4-1 縛り縛られ", en: "4-1 Bound By Restrictions" },
    effect: { ja: "Infinity Challengeを解放", en: "Unlocks Infinity Challenges." },
  },
  {
    id: "5-1",
    bit: 6,
    cost: 10,
    requires: ["4-1"],
    name: { ja: "5-1 スタートダッシュ", en: "5-1 Starting Dash" },
    effect: { ja: "ラップスピードが×3される", en: "Multiplies lap speed by 3." },
  },
  {
    id: "5-2",
    bit: 7,
    cost: 10,
    requires: ["4-1"],
    name: { ja: "5-2 親が地主", en: "5-2 Landlord Parents" },
    effect: { ja: "リセット後、スコア100で開始する", en: "Start every reset with 100 score." },
  },
  {
    id: "6-1",
    bit: 8,
    cost: 50,
    requires: ["5-1", "5-2"],
    name: { ja: "6-1 ほんのりした甘味", en: "6-1 A Hint of Sweetness" },
    effect: { ja: "GRスコア倍率がさらに^1.2される", en: "Further raises the GR score multiplier to ^1.2." },
  },
  {
    id: "6-2",
    bit: 9,
    cost: 50,
    requires: ["5-1", "5-2"],
    name: { ja: "6-2 澄んだ視界", en: "6-2 Clear View" },
    effect: { ja: "GRコスト倍率の下限が×0.70になる", en: "Lowers the GR cost-factor floor to x0.70." },
  },
  {
    id: "7-1",
    bit: 10,
    cost: 150,
    requires: ["6-1", "6-2"],
    name: { ja: "7-1 権力の集中", en: "7-1 Concentration of Power" },
    effect: { ja: "CBごとの増加倍率が+1.0になる", en: "Raises the per-CB gain multiplier increase to +1.0." },
  },
  {
    id: "7-2",
    bit: 11,
    cost: 150,
    requires: ["6-1", "6-2"],
    name: { ja: "7-2 庶民の幸せ", en: "7-2 Commoners' Happiness" },
    effect: { ja: "Infinity回数に応じて通常強化コストを下げる", en: "Lowers normal-upgrade costs based on Infinity count." },
  },
];

BALANCE_INFINITY_UPGRADES.forEach((definition) => {
  const existing = INFINITY_UPGRADES.find((upgrade) => upgrade.id === definition.id);
  if (existing) Object.assign(existing, definition);
  else INFINITY_UPGRADES.push(definition);
});

function balanceGenerationRewardForLog(generationScoreLog) {
  const depth = Math.max(0, generationScoreLog - log10Value(GENERATION_UNLOCK_SCORE));
  const shallowScoreLift = 0.60 * (1 - Math.exp(-depth / 4));
  const shallowCostLift = 0.13 * (1 - Math.exp(-depth / 5));
  const scoreMultiplierLog10 = Math.min(
    8,
    Math.log10(1 + depth) * BALANCE_PROFILE.generationRewardLogCoefficient + shallowScoreLift,
  );
  return {
    scoreMultiplierLog10,
    scoreMultiplierGain: valueFromLog10(scoreMultiplierLog10),
    costReduction: Math.min(0.24, Math.log10(1 + depth) * 0.04 + shallowCostLift),
  };
}

function balancePreGenerationCostScalingLog10(kind, level) {
  const scaling = BALANCE_PROFILE.initialUpgradeCostScaling[kind];
  if (!scaling) return 0;
  const excess = Math.max(0, level - scaling.startsAfter);
  let generationRelief = 1;
  if (state.generationCount === 1) generationRelief = 0.35;
  else if (state.generationCount === 2) generationRelief = 0.16;
  else if (state.generationCount >= 3) generationRelief = 0.08;
  return excess * excess * scaling.logScale * generationRelief;
}

function balanceCanBuyNormalUpgrade(kind) {
  const costLog = upgradeCostLog(kind);
  if (state.activeChallenge === 7 && costLog > 30) return false;
  if (kind === "vertex") {
    if (state.activeChallenge === 8) return false;
    if (state.activeChallenge === 2 && state.vertices >= 200) return false;
  }
  return canSpendLog(costLog);
}

function balanceInfinityPointGain() {
  if (!canInfinity()) return 0;
  const scoreLog10 = currentScoreLog10();
  const base = state.infiniteCapBroken
    ? Math.floor(scoreLog10 / Math.log10(2) - 307)
    : Math.floor(scoreLog10 - 307);
  return Math.max(1, base);
}

function balanceGenerationMinCostFactor() {
  return hasInfinityUpgrade("6-2") ? 0.70 : GENERATION_MIN_NEW_COST_FACTOR;
}

function balanceRestoreGenerationCostFactor(rawValue, upgradeMask = state.infinityUpgradeMask) {
  if ((Math.floor(Number(upgradeMask) || 0) & (1 << 9)) === 0) return;
  const value = parseSavedNumber(rawValue);
  if (!Number.isFinite(value)) return;
  state.generationCostFactor = Math.max(0.70, Math.min(1, value));
}

function balanceRestoreGenerationCostFactorFromLocalSave() {
  if (typeof localStorage === "undefined" || typeof SAVE_KEY === "undefined") return;
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (saved && saved.state) {
      balanceRestoreGenerationCostFactor(
        saved.state.generationCostFactor,
        saved.state.infinityUpgradeMask,
      );
    }
  } catch (error) {
    // The core save loader already handles malformed saves safely.
  }
}

function balanceInfinityUpgradeCostExponent() {
  if (!hasInfinityUpgrade("7-2")) return 1;
  const config = BALANCE_PROFILE.infinityUpgradeCostReduction;
  const infinityCount = Math.max(0, state.infinityCount);
  const rawExponent = 1 - infinityCount * config.perInfinity;
  if (rawExponent >= config.softcapStartExponent) return rawExponent;
  const postSoftcapInfinities = infinityCount - (1 - config.softcapStartExponent) / config.perInfinity;
  return config.softcapAsymptoteExponent
    + (config.softcapStartExponent - config.softcapAsymptoteExponent)
      * Math.exp(-Math.max(0, postSoftcapInfinities) * config.postSoftcapDecay);
}

function balanceCostLog10(kind, base, level, growth) {
  const growthLog = log10Value(growth) * (state.activeChallenge === 3 && kind === "speed" ? 2 : 1);
  const rawLog = log10Value(base) + level * growthLog;
  const costFactor = generationCostFactorEffect();
  const adjustedLog = rawLog <= 300
    ? log10Value(Math.ceil(base + (10 ** rawLog - base) * costFactor))
    : rawLog + log10Value(costFactor);
  const earlyAdjustedLog = adjustedLog + preGenerationCostScalingLog10(kind, level);
  const scaledLog = earlyAdjustedLog + stagedUpgradeCostScalingLog10(earlyAdjustedLog);
  const challengeAdjustedLog = isChallengeCompleted(2) ? scaledLog * 0.95 : scaledLog;
  return challengeAdjustedLog * balanceInfinityUpgradeCostExponent();
}

function balanceRawLapSpeedLog10() {
  let multiplierLog = state.speedLevel * log10Value(1.22);
  if (hasInfinityUpgrade("2-1")) multiplierLog += log10Value(applyInfinityUpgradePower(1.5));
  if (hasInfinityUpgrade("5-1")) multiplierLog += log10Value(applyInfinityUpgradePower(3));
  if (isChallengeCompleted(3)) multiplierLog += log10Value(1.1);
  if (state.activeChallenge === 3) multiplierLog *= 0.8;
  return clampLog10(multiplierLog);
}

function balanceGenerationScorePower() {
  let power = GENERATION_SCORE_POWER;
  if (hasInfinityUpgrade("3-1")) power *= applyInfinityUpgradePower(1.5);
  if (hasInfinityUpgrade("6-1")) power *= applyInfinityUpgradePower(1.2);
  return power;
}

function balanceCoreBoostGainIncreaseMultiplier() {
  const increasePerCoreBoost = hasInfinityUpgrade("7-1") ? 1 : 0.5;
  return Math.pow(1 + state.coreBoostCount * increasePerCoreBoost, coreBoostBonusPower());
}

function balanceVertexGainIncrease() {
  const infinityResetBoost = hasInfinityUpgrade("1-1")
    ? applyInfinityUpgradePower(state.infinityCount + 1)
    : 1;
  let gain = (0.01 + state.gainLevel * 0.01)
    * coreBoostGainIncreaseMultiplier()
    * infiniteAngleBoost()
    * achievementGainMultiplier()
    * infinityResetBoost;
  if (state.activeChallenge === 6) return 0.001;
  if (state.activeChallenge === 4) gain = Math.pow(gain, 0.5);
  if (isChallengeCompleted(4)) gain = Math.pow(gain, 1.1);
  return gain;
}

function balanceApplyResetStartScore() {
  if (!hasInfinityUpgrade("5-2")) return;
  state.score = 100;
  state.scoreLog10 = 2;
}

function balanceRunGeneration() {
  if (!canRunGeneration()) return;
  const generationScoreBeforeResetLog = currentGenerationScoreLog10();
  const reward = generationRewardForLog(generationScoreBeforeResetLog);
  const nextCostFactor = state.generationCostFactor * (1 - reward.costReduction);
  const preservedVertices = shouldPreserveVerticesThroughEarlyReset() ? state.vertices : 3;
  state.generationCount += 1;
  state.previousGenerationScoreLog10 = generationScoreBeforeResetLog;
  state.previousGenerationScore = valueFromLog10(generationScoreBeforeResetLog);
  state.generationScoreMultiplierLog10 = reward.scoreMultiplierLog10;
  state.generationScoreMultiplier = valueFromLog10(state.generationScoreMultiplierLog10);
  state.generationCostFactor = Math.max(balanceGenerationMinCostFactor(), nextCostFactor);
  state.score = 0;
  state.scoreLog10 = -Infinity;
  state.generationScore = 0;
  state.generationScoreLog10 = -Infinity;
  state.vertices = preservedVertices;
  state.speedLevel = 0;
  state.gainLevel = 0;
  state.currentGain = 1;
  state.currentGainLog10 = 0;
  state.pointProgress = 0;
  state.totalVertexProgress = 0;
  state.lastVertexIndex = 0;
  state.floatingTexts = [];
  balanceApplyResetStartScore();
  updateUi();
  saveGame("manual");
}

function balanceNextGenerationValues() {
  if (!canRunGeneration()) {
    return {
      scoreMultiplier: generationScoreMultiplierEffect(),
      scoreMultiplierLog10: generationScoreMultiplierEffectLog10(),
      costFactor: generationCostFactorEffect(),
    };
  }
  const reward = generationRewardForLog(currentGenerationScoreLog10());
  const nextRawScoreMultiplierLog = reward.scoreMultiplierLog10;
  const nextRawCostFactor = Math.max(
    balanceGenerationMinCostFactor(),
    state.generationCostFactor * (1 - reward.costReduction),
  );
  return {
    scoreMultiplier: valueFromLog10(applyGenerationAchievementRewardLog10(generationScoreMultiplierBaseEffectLog10(nextRawScoreMultiplierLog))),
    scoreMultiplierLog10: applyGenerationAchievementRewardLog10(generationScoreMultiplierBaseEffectLog10(nextRawScoreMultiplierLog)),
    costFactor: Math.pow(nextRawCostFactor, generationCostPower()) * (hasInfinityUpgrade("3-2") ? applyInfinityUpgradePower(0.95) : 1),
  };
}

const balanceResetBelowCoreBoost = resetBelowCoreBoost;
const balanceResetBelowInfinity = resetBelowInfinity;
const balanceApplySaveData = applySaveData;

function balanceCreateInfinityUpgradeRows() {
  clearElement(elements.infinityUpgradeTree);
  const tiers = [
    ["1-1", "1-2"],
    ["2-1"],
    ["3-1", "3-2"],
    ["4-1"],
    ["5-1", "5-2"],
    ["6-1", "6-2"],
    ["7-1", "7-2"],
  ];
  tiers.forEach((rowIds, rowIndex) => {
    const tier = document.createElement("div");
    tier.className = "infinity-upgrade-tier";
    tier.dataset.tier = String(rowIndex + 1);
    rowIds.forEach((id) => {
      const upgrade = infinityUpgradeById(id);
      if (!upgrade) return;
      const button = document.createElement("button");
      button.className = "infinity-upgrade-node";
      button.type = "button";
      button.dataset.upgrade = upgrade.id;
      button.addEventListener("click", () => selectInfinityUpgrade(upgrade.id));
      const name = document.createElement("strong");
      name.className = "infinity-upgrade-name";
      const status = document.createElement("small");
      status.className = "infinity-upgrade-state";
      button.append(name, status);
      tier.append(button);
    });
    elements.infinityUpgradeTree.append(tier);
  });
}

INFINITY_CHALLENGES[6].restriction = {
  ja: "ショップの価格が1e30を超えると、通常アップグレードを購入できなくなる",
  en: "Normal upgrades whose cost exceeds 1e30 cannot be bought.",
};

generationRewardForLog = balanceGenerationRewardForLog;
earlyLayerCostScalingFactor = () => 1;
preGenerationCostScalingLog10 = balancePreGenerationCostScalingLog10;
canBuyNormalUpgrade = balanceCanBuyNormalUpgrade;
infinityPointGain = balanceInfinityPointGain;
costLog10 = balanceCostLog10;
rawLapSpeedLog10 = balanceRawLapSpeedLog10;
generationScorePower = balanceGenerationScorePower;
coreBoostGainIncreaseMultiplier = balanceCoreBoostGainIncreaseMultiplier;
vertexGainIncrease = balanceVertexGainIncrease;
runGeneration = balanceRunGeneration;
nextGenerationValues = balanceNextGenerationValues;
resetBelowCoreBoost = function balanceResetCoreBoost() {
  balanceResetBelowCoreBoost();
  balanceApplyResetStartScore();
};
resetBelowInfinity = function balanceResetInfinity() {
  balanceResetBelowInfinity();
  balanceApplyResetStartScore();
};
applySaveData = function balanceApplySaveDataWrapper(data, saveVersion) {
  balanceApplySaveData(data, saveVersion);
  balanceRestoreGenerationCostFactor(data && data.generationCostFactor, data && data.infinityUpgradeMask);
};
createInfinityUpgradeRows = balanceCreateInfinityUpgradeRows;

balanceRestoreGenerationCostFactorFromLocalSave();
if (typeof updateUi === "function") updateUi();
if (typeof draw === "function") draw();
// END INTEGRATED BALANCE RULES

window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) update(1 / 60);
  uiUpdateElapsed = 0;
  updateUi();
  draw();
};
window.__angleDebug = {
  state,
  addScore,
  update,
  buySpeed,
  runGeneration,
  runCoreBoost,
  runInfinity,
  buyInfinityUpgrade,
  buyAllUpgrades,
  generationRewardFor,
  generationScoreMultiplierEffectLog10,
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
  exportSaveCode,
  importSaveCode,
  completeChallengeIfReady,
};

elements.speedUpgrade.addEventListener("click", buySpeed);
elements.vertexUpgrade.addEventListener("click", buyVertex);
elements.gainUpgrade.addEventListener("click", buyGain);
elements.buyAllUpgrade.addEventListener("click", () => buyAllUpgrades());
elements.generationButton.addEventListener("click", runGeneration);
elements.coreBoostButton.addEventListener("click", runCoreBoost);
elements.infinityButton.addEventListener("click", () => runInfinity(false));
elements.infinityUpgradeDetailBuy.addEventListener("click", buySelectedInfinityUpgrade);
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
elements.automationMasterToggle.addEventListener("change", () => applySetting("automationEnabled", elements.automationMasterToggle.checked));
elements.autoBuySpeedToggle.addEventListener("change", () => applySetting("autoBuySpeed", elements.autoBuySpeedToggle.checked));
elements.autoBuyVertexToggle.addEventListener("change", () => applySetting("autoBuyVertex", elements.autoBuyVertexToggle.checked));
elements.autoBuyGainToggle.addEventListener("change", () => applySetting("autoBuyGain", elements.autoBuyGainToggle.checked));
if (elements.autoCompleteChallengesToggle) elements.autoCompleteChallengesToggle.addEventListener("change", () => applySetting("autoCompleteChallenges", elements.autoCompleteChallengesToggle.checked));
elements.languageSelect.addEventListener("change", () => applySetting("language", elements.languageSelect.value));
elements.numberFormatSelect.addEventListener("change", () => applySetting("numberFormat", elements.numberFormatSelect.value));
elements.timeUnitSelect.addEventListener("change", () => applySetting("timeUnit", elements.timeUnitSelect.value));
if (elements.exportSaveCodeButton) elements.exportSaveCodeButton.addEventListener("click", exportSaveCode);
if (elements.importSaveCodeButton) elements.importSaveCodeButton.addEventListener("click", importSaveCodeFromUi);
if (elements.copySaveCodeButton) elements.copySaveCodeButton.addEventListener("click", copySaveCodeFromUi);
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

createChallengeRows();
createInfinityUpgradeRows();
createAchievementRows();
loadGame();
switchMainTab(activeMainTab);
switchInfinitySubtab(activeInfinitySubtab);
resizeCanvas();
updateUi();
showUpdateModalIfNeeded();
checkForRemoteUpdate();
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
