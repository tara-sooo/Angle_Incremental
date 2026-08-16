import { runtime, expose } from "../runtime/shared.js";

// Tower progression persists through Infinity. Costs stay in log space because the
// later floors quickly exceed JavaScript's native numeric range.

const TOWER_FLOOR_COST_LOG10 = Object.freeze({
  1: 50,
  2: 60,
  3: 70,
  4: 85,
  5: 100,
  6: 125,
  7: 150,
  8: 175,
  9: 205,
  10: 235,
  11: 265,
  12: 295,
  13: 345,
});

const TOWER_CHALLENGE_UNLOCK_FLOORS = Object.freeze([3, 5, 8, 12]);
const TOWER_CHALLENGE_1_INFINITY_SCORE_POWER_STEP = 0.077;
const TOWER_CHALLENGE_3_RELAXATION_COUNT = 600000;
const TOWER_CHALLENGE_3_INFINITY_SCORE_SOFTCAP_SPAN = 750000;
const TOWER_CHALLENGE_3_SCORE_GAIN_POWER_START = 0.001;
const TOWER_CHALLENGE_3_SCORE_GAIN_POWER_TARGET = 0.8;
const TOWER_CHALLENGE_3_INFINITY_SCORE_POWER_START = 0.1;
const TOWER_CHALLENGE_3_INFINITY_SCORE_POWER_TARGET = 0.5;
const TOWER_NORMAL_UPGRADE_MULTIPLIER_STEP = 1.05;
const TC4_UPGRADE_DEFINITIONS = Object.freeze({
  baseGain: Object.freeze({
    baseLog10: 100,
    stepLog10: 800,
    levelField: "tc4BaseGainLevel",
    priceStepField: "tc4BaseGainPriceStep",
  }),
  infinityScoreVertexGain: Object.freeze({
    baseLog10: 500,
    stepLog10: 1200,
    levelField: "tc4InfinityScoreVertexGainLevel",
    priceStepField: "tc4InfinityScoreVertexGainPriceStep",
  }),
  freeCoreBoost: Object.freeze({
    baseLog10: 900,
    stepLog10: 1600,
    levelField: "tc4FreeCoreBoostLevel",
    priceStepField: "tc4FreeCoreBoostPriceStep",
  }),
});
const TC4_UPGRADE_KINDS = Object.freeze(Object.keys(TC4_UPGRADE_DEFINITIONS));

const TOWER_CHALLENGES = Object.freeze([
  {
    index: 1,
    unlockFloor: 3,
    targetLog10: 1000,
    name: { ja: "TC1 親友より知り合い", en: "TC1 Better Acquaintances Than Friends" },
    restriction: {
      ja: "TAの通常強化は購入できず、IU11-1の効果上限は/5される",
      en: "Normal The Angle upgrades cannot be purchased, and IU11-1's effect cap is divided by 5.",
    },
    reward: {
      ja: "Infinity Score累乗を解放。Floor 3以降の追加階層ごとに指数を+0.077する",
      en: "Unlocks Infinity Score exponentiation and adds 0.077 per floor after Floor 3.",
    },
    implemented: true,
  },
  {
    index: 2,
    unlockFloor: 5,
    targetLog10: 3000,
    name: { ja: "TC2 核家族世帯撲滅委員会", en: "TC2 Nuclear Family Eradication Committee" },
    restriction: {
      ja: "CBは封印され、GRのスコア倍率は^0.1、コスト倍率は×0.90を下限とする",
      en: "Core Boost is sealed, GR's score multiplier is raised to ^0.1, and its cost factor has a hard floor of x0.90.",
    },
    reward: {
      ja: "Core Boost要求量増加指数を強化。Floor 5以降の追加階層で生指数を下げ、1.50未満ではソフトキャップする",
      en: "Improves Core Boost requirement growth. Additional floors after Floor 5 lower the raw power, with a soft cap below 1.50.",
    },
    implemented: true,
  },
  {
    index: 3,
    unlockFloor: 8,
    targetLog10: 5000,
    name: { ja: "TC3 「『無限』が概念である時代はとうに越した」", en: "TC3 The Age When Infinity Was a Concept Is Long Gone" },
    restriction: {
      ja: "Score獲得は^0.001、Infinity Score獲得は^0.100から開始し、Infinity回数で緩和（現在: Score ^{scoreGainPower} / Infinity Score ^{infinityScorePower}）",
      en: "Score gain starts at ^0.001 and Infinity Score gain at ^0.100; both relax with Infinity count (now: Score ^{scoreGainPower} / Infinity Score ^{infinityScorePower}).",
    },
    reward: {
      ja: "通常強化強化。Floor 8以降、追加階層ごとにSpeed・Vertex・Gainの有効購入数を×1.05する",
      en: "Enhances normal upgrades. Each additional floor after Floor 8 multiplies effective Speed, Vertex, and Gain purchases by x1.05.",
    },
    implemented: true,
  },
  {
    index: 4,
    unlockFloor: 12,
    targetLog10: Infinity,
    name: { ja: "TC4", en: "TC4" },
    restriction: {
      ja: "通常強化とIA強化はレベル1を超えて購入できない",
      en: "Normal and Infinite Angle upgrades cannot be purchased above level 1.",
    },
    reward: { ja: "報酬は今後のリリースで公開", en: "Reward planned for a future release." },
    implemented: true,
  },
]);

function towerFloor() {
  return Math.max(0, Math.floor(runtime.state.towerFloor));
}

function towerFloorCostLog10(floor) {
  const normalizedFloor = Math.max(1, Math.floor(floor));
  if (TOWER_FLOOR_COST_LOG10[normalizedFloor] !== undefined) {
    return TOWER_FLOOR_COST_LOG10[normalizedFloor];
  }
  const post13Steps = normalizedFloor - 13;
  return runtime.clampLog10(345 * Math.pow(runtime.TOWER_POST_13_COST_POWER, post13Steps));
}

function towerNextFloor() {
  return towerFloor() + 1;
}

function towerNextFloorCostLog10() {
  return towerFloorCostLog10(towerNextFloor());
}

function towerScoreExponent() {
  return 1 + towerFloor() * runtime.TOWER_SCORE_EXPONENT_STEP;
}

function towerChallenge3RelaxedPower(
  startPower,
  targetPower,
  postTargetSpan = TOWER_CHALLENGE_3_RELAXATION_COUNT,
) {
  const rawCount = Number(runtime.state.infinityCount);
  const count = Number.isFinite(rawCount) ? Math.max(0, rawCount) : 0;
  if (count <= TOWER_CHALLENGE_3_RELAXATION_COUNT) {
    return startPower + (targetPower - startPower) * count / TOWER_CHALLENGE_3_RELAXATION_COUNT;
  }
  const excess = count - TOWER_CHALLENGE_3_RELAXATION_COUNT;
  return targetPower + (1 - targetPower) * excess / (excess + postTargetSpan);
}

function towerChallenge3ScoreGainPower() {
  return towerChallenge3RelaxedPower(
    TOWER_CHALLENGE_3_SCORE_GAIN_POWER_START,
    TOWER_CHALLENGE_3_SCORE_GAIN_POWER_TARGET,
  );
}

function towerChallenge3InfinityScorePower() {
  return towerChallenge3RelaxedPower(
    TOWER_CHALLENGE_3_INFINITY_SCORE_POWER_START,
    TOWER_CHALLENGE_3_INFINITY_SCORE_POWER_TARGET,
    TOWER_CHALLENGE_3_INFINITY_SCORE_SOFTCAP_SPAN,
  );
}

function towerChallenge1InfinityScorePowerBonus() {
  if (!towerChallengeCompleted(1)) return 0;
  return Math.max(0, towerFloor() - 3) * TOWER_CHALLENGE_1_INFINITY_SCORE_POWER_STEP;
}

function towerChallengeUnlockFloor(index) {
  const normalizedIndex = Math.floor(index) - 1;
  return TOWER_CHALLENGES[normalizedIndex]?.unlockFloor || Infinity;
}

function towerChallengeUnlocked(index) {
  return towerFloor() >= towerChallengeUnlockFloor(index);
}

function towerChallengeCompleted(index) {
  const normalizedIndex = Math.floor(index);
  if (normalizedIndex < 1 || normalizedIndex > runtime.TOWER_CHALLENGE_COUNT) return false;
  return (runtime.state.completedTowerChallenges & (1 << (normalizedIndex - 1))) !== 0;
}

function towerNormalUpgradeMultiplier() {
  if (!towerChallengeCompleted(3)) return 1;
  return Math.pow(
    TOWER_NORMAL_UPGRADE_MULTIPLIER_STEP,
    Math.max(0, towerFloor() - 8),
  );
}

function towerChallengeDefinition(index) {
  const normalizedIndex = Math.floor(index);
  return normalizedIndex >= 1 && normalizedIndex <= runtime.TOWER_CHALLENGE_COUNT
    ? TOWER_CHALLENGES[normalizedIndex - 1]
    : null;
}

function towerChallengeImplemented(index) {
  return Boolean(towerChallengeDefinition(index)?.implemented);
}

function towerChallenge4AllowsNormalUpgrade(kind) {
  if (runtime.state.activeTowerChallenge !== 4) return true;
  if (kind === "speed") return runtime.state.speedLevel < 1;
  if (kind === "gain") return runtime.state.gainLevel < 1;
  if (kind === "vertex") {
    const level = runtime.state.activeChallenge === 8
      ? runtime.state.ic8VertexUpgradeLevel
      : runtime.state.vertices - 3;
    return Math.max(0, Math.floor(level)) < 1;
  }
  return false;
}

function towerChallenge4AllowsInfiniteAngleUpgrade(kind) {
  if (runtime.state.activeTowerChallenge !== 4) return true;
  if (kind === "speed") return runtime.state.infiniteAngleSpeedLevel < 1;
  if (kind === "vertex") return runtime.state.infiniteAngleVertexLevel < 1;
  if (kind === "gain") return runtime.state.infiniteAngleGainLevel < 1;
  return false;
}

function resetTowerChallenge4Upgrades() {
  runtime.state.infiniteAngleSpeedLevel = 0;
  runtime.state.infiniteAngleVertexLevel = 0;
  runtime.state.infiniteAngleGainLevel = 0;
}

function resetTowerChallenge4ExclusiveUpgrades() {
  TC4_UPGRADE_KINDS.forEach((kind) => {
    const definition = TC4_UPGRADE_DEFINITIONS[kind];
    runtime.state[definition.levelField] = 0;
    runtime.state[definition.priceStepField] = 0;
  });
}

function normalizeTowerChallenge4State() {
  TC4_UPGRADE_KINDS.forEach((kind) => {
    const definition = TC4_UPGRADE_DEFINITIONS[kind];
    runtime.state[definition.levelField] = Math.floor(runtime.sanitizeNumber(runtime.state[definition.levelField], 0));
    runtime.state[definition.priceStepField] = Math.floor(runtime.sanitizeNumber(runtime.state[definition.priceStepField], 0));
  });
  if (runtime.state.activeTowerChallenge !== 4 || !towerChallengeUnlocked(4)) {
    resetTowerChallenge4ExclusiveUpgrades();
  }
}

function towerChallenge4UpgradeDefinition(kind) {
  return TC4_UPGRADE_DEFINITIONS[kind] || null;
}

function towerChallenge4UpgradeLevel(kind) {
  const definition = towerChallenge4UpgradeDefinition(kind);
  return definition ? runtime.state[definition.levelField] : 0;
}

function towerChallenge4UpgradePriceStep(kind) {
  const definition = towerChallenge4UpgradeDefinition(kind);
  return definition ? runtime.state[definition.priceStepField] : 0;
}

function towerChallenge4UpgradePriceLog10(kind) {
  const definition = towerChallenge4UpgradeDefinition(kind);
  if (!definition) return Infinity;
  return definition.baseLog10 + definition.stepLog10 * towerChallenge4UpgradePriceStep(kind);
}

function canBuyTowerChallenge4Upgrade(kind) {
  return runtime.state.activeTowerChallenge === 4
    && towerChallengeUnlocked(4)
    && Boolean(towerChallenge4UpgradeDefinition(kind))
    && runtime.canSpendLog(towerChallenge4UpgradePriceLog10(kind));
}

function purchaseTowerChallenge4Upgrade(kind) {
  if (!canBuyTowerChallenge4Upgrade(kind)) return false;
  const selectedPrice = towerChallenge4UpgradePriceLog10(kind);
  const prePurchasePrices = Object.fromEntries(
    TC4_UPGRADE_KINDS.map((upgradeKind) => [upgradeKind, towerChallenge4UpgradePriceLog10(upgradeKind)]),
  );
  if (!runtime.spendLog(selectedPrice)) return false;
  TC4_UPGRADE_KINDS.forEach((upgradeKind) => {
    const definition = TC4_UPGRADE_DEFINITIONS[upgradeKind];
    if (upgradeKind === kind || prePurchasePrices[upgradeKind] === selectedPrice) {
      runtime.state[definition.priceStepField] += 1;
    }
    if (upgradeKind === kind) runtime.state[definition.levelField] += 1;
  });
  return true;
}

function buyTowerChallenge4Upgrade(kind, options = {}) {
  if (typeof Event !== "undefined" && options instanceof Event) options = {};
  if (!purchaseTowerChallenge4Upgrade(kind)) return false;
  if (options.refresh !== false) runtime.updateUi();
  if (options.save !== false) runtime.saveGame("manual");
  return true;
}

function towerChallengeTargetLog10(index) {
  return towerChallengeDefinition(index)?.targetLog10 ?? Infinity;
}

function towerChallengeText(index, field) {
  const definition = towerChallengeDefinition(index);
  const language = runtime.TEXT?.[runtime.state.language] ? runtime.state.language : "ja";
  return definition?.[field]?.[language] || definition?.[field]?.ja || "";
}

function towerChallengeName(index) {
  return towerChallengeText(index, "name");
}

function towerChallengeRestriction(index) {
  const text = towerChallengeText(index, "restriction");
  if (Math.floor(index) !== 3) return text;
  return text
    .replace("{scoreGainPower}", towerChallenge3ScoreGainPower().toFixed(3))
    .replace("{infinityScorePower}", towerChallenge3InfinityScorePower().toFixed(3));
}

function towerChallengeReward(index) {
  return towerChallengeText(index, "reward");
}

function towerChallengeCanComplete(index = runtime.state.activeTowerChallenge) {
  const normalizedIndex = Math.floor(index);
  return towerChallengeImplemented(normalizedIndex)
    && runtime.state.activeTowerChallenge === normalizedIndex
    && runtime.currentScoreLog10() >= towerChallengeTargetLog10(normalizedIndex);
}

function towerChallengeRewardUnlocked(index) {
  return towerChallengeCompleted(index);
}

function recordTowerChallengeTime(index, elapsed) {
  const normalizedIndex = Math.floor(index);
  if (normalizedIndex < 1 || normalizedIndex > runtime.TOWER_CHALLENGE_COUNT) return;
  const candidate = Math.max(0, runtime.sanitizeNumber(elapsed, 0));
  if (candidate <= 0) return;
  const recorded = Math.max(candidate, runtime.MIN_RECORDED_INFINITY_SECONDS);
  if (!Array.isArray(runtime.state.fastestTowerChallengeTimes)) {
    runtime.state.fastestTowerChallengeTimes = Array(runtime.TOWER_CHALLENGE_COUNT).fill(0);
  }
  const current = runtime.state.fastestTowerChallengeTimes[normalizedIndex - 1];
  if (!(current > 0) || recorded < current) runtime.state.fastestTowerChallengeTimes[normalizedIndex - 1] = recorded;
}

function toggleTowerChallenge(index) {
  const normalizedIndex = Math.min(
    runtime.TOWER_CHALLENGE_COUNT,
    Math.max(1, Math.floor(index)),
  );
  if (!towerChallengeImplemented(normalizedIndex) || !towerChallengeUnlocked(normalizedIndex)) return false;
  if (runtime.state.activeTowerChallenge === normalizedIndex) {
    runtime.state.activeTowerChallenge = 0;
    runtime.state.activeTowerChallengeTime = 0;
    if (normalizedIndex === 4) resetTowerChallenge4ExclusiveUpgrades();
    runtime.resetBelowInfinity();
    runtime.updateUi();
    runtime.saveGame("manual");
    return true;
  }
  if (runtime.state.activeTowerChallenge > 0) return false;
  if (runtime.createCheckpoint && !runtime.createCheckpoint("pre-tower-challenge", { force: true })) return false;
  runtime.state.activeTowerChallenge = normalizedIndex;
  runtime.state.activeTowerChallengeTime = 0;
  runtime.resetBelowInfinity();
  if (normalizedIndex === 4) {
    resetTowerChallenge4Upgrades();
    resetTowerChallenge4ExclusiveUpgrades();
  }
  runtime.updateUi();
  runtime.saveGame("manual");
  return true;
}

function completeTowerChallengeIfReady() {
  const index = runtime.state.activeTowerChallenge;
  if (!towerChallengeCanComplete(index)) return false;
  if (index === 1) {
    if (runtime.createCheckpoint && !runtime.createCheckpoint("pre-tower-challenge", { force: true })) return false;
    recordTowerChallengeTime(index, runtime.state.activeTowerChallengeTime);
    runtime.state.completedTowerChallenges |= 1 << (index - 1);
    runtime.state.activeTowerChallenge = 0;
    runtime.state.activeTowerChallengeTime = 0;
    runtime.resetBelowInfinity();
    runtime.state.currentInfinityRunTime = 0;
    runtime.state.currentInfinityRealTime = 0;
    runtime.updateUi();
    runtime.saveGame("manual");
    return true;
  }
  if (runtime.canInfinity()) {
    const completedIndex = index;
    runtime.runInfinity(false);
    if (completedIndex === 4 && runtime.state.activeTowerChallenge !== completedIndex) {
      resetTowerChallenge4ExclusiveUpgrades();
    }
    return runtime.state.activeTowerChallenge !== index;
  }
  return false;
}

function towerGateForFloor(floor) {
  const normalizedFloor = Math.max(1, Math.floor(floor));
  const challengeIndex = TOWER_CHALLENGE_UNLOCK_FLOORS.indexOf(normalizedFloor - 1) + 1;
  return challengeIndex > 0 ? challengeIndex : 0;
}

function towerCanBuildNextFloor() {
  const gate = towerGateForFloor(towerNextFloor());
  return gate === 0 || towerChallengeCompleted(gate);
}

function canBuildTower() {
  const costLog10 = towerNextFloorCostLog10();
  const maximumCostLog10 = runtime.log10ExactInfinityPoints(runtime.MAX_EXACT_INFINITY_POINTS);
  return towerCanBuildNextFloor()
    && costLog10 <= maximumCostLog10
    && runtime.canSpendInfinityPoints(costLog10);
}

function buildTower() {
  if (!canBuildTower()) return false;
  if (runtime.createCheckpoint && !runtime.createCheckpoint("pre-tower-build", { force: true })) return false;
  if (!runtime.spendInfinityPoints(towerNextFloorCostLog10())) return false;
  runtime.state.towerFloor = towerNextFloor();
  runtime.updateUi();
  runtime.saveGame("manual");
  return true;
}

expose("TOWER_FLOOR_COST_LOG10", () => TOWER_FLOOR_COST_LOG10);
expose("TOWER_CHALLENGE_UNLOCK_FLOORS", () => TOWER_CHALLENGE_UNLOCK_FLOORS);
expose("TOWER_CHALLENGE_1_INFINITY_SCORE_POWER_STEP", () => TOWER_CHALLENGE_1_INFINITY_SCORE_POWER_STEP);
expose("TOWER_CHALLENGE_3_RELAXATION_COUNT", () => TOWER_CHALLENGE_3_RELAXATION_COUNT);
expose("TOWER_CHALLENGE_3_SCORE_GAIN_POWER_START", () => TOWER_CHALLENGE_3_SCORE_GAIN_POWER_START);
expose("TOWER_CHALLENGE_3_SCORE_GAIN_POWER_TARGET", () => TOWER_CHALLENGE_3_SCORE_GAIN_POWER_TARGET);
expose("TOWER_CHALLENGE_3_INFINITY_SCORE_POWER_START", () => TOWER_CHALLENGE_3_INFINITY_SCORE_POWER_START);
expose("TOWER_CHALLENGE_3_INFINITY_SCORE_POWER_TARGET", () => TOWER_CHALLENGE_3_INFINITY_SCORE_POWER_TARGET);
expose("TOWER_NORMAL_UPGRADE_MULTIPLIER_STEP", () => TOWER_NORMAL_UPGRADE_MULTIPLIER_STEP);
expose("TOWER_CHALLENGES", () => TOWER_CHALLENGES);
expose("TC4_UPGRADE_DEFINITIONS", () => TC4_UPGRADE_DEFINITIONS);
expose("towerFloor", () => towerFloor);
expose("towerFloorCostLog10", () => towerFloorCostLog10);
expose("towerNextFloor", () => towerNextFloor);
expose("towerNextFloorCostLog10", () => towerNextFloorCostLog10);
expose("towerScoreExponent", () => towerScoreExponent);
expose("towerChallenge1InfinityScorePowerBonus", () => towerChallenge1InfinityScorePowerBonus);
expose("towerChallenge3ScoreGainPower", () => towerChallenge3ScoreGainPower);
expose("towerChallenge3InfinityScorePower", () => towerChallenge3InfinityScorePower);
expose("towerNormalUpgradeMultiplier", () => towerNormalUpgradeMultiplier);
expose("towerChallengeUnlockFloor", () => towerChallengeUnlockFloor);
expose("towerChallengeUnlocked", () => towerChallengeUnlocked);
expose("towerChallengeCompleted", () => towerChallengeCompleted);
expose("towerChallengeDefinition", () => towerChallengeDefinition);
expose("towerChallengeImplemented", () => towerChallengeImplemented);
expose("towerChallenge4AllowsNormalUpgrade", () => towerChallenge4AllowsNormalUpgrade);
expose("towerChallenge4AllowsInfiniteAngleUpgrade", () => towerChallenge4AllowsInfiniteAngleUpgrade);
expose("resetTowerChallenge4ExclusiveUpgrades", () => resetTowerChallenge4ExclusiveUpgrades);
expose("normalizeTowerChallenge4State", () => normalizeTowerChallenge4State);
expose("towerChallenge4UpgradeDefinition", () => towerChallenge4UpgradeDefinition);
expose("towerChallenge4UpgradeLevel", () => towerChallenge4UpgradeLevel);
expose("towerChallenge4UpgradePriceStep", () => towerChallenge4UpgradePriceStep);
expose("towerChallenge4UpgradePriceLog10", () => towerChallenge4UpgradePriceLog10);
expose("canBuyTowerChallenge4Upgrade", () => canBuyTowerChallenge4Upgrade);
expose("purchaseTowerChallenge4Upgrade", () => purchaseTowerChallenge4Upgrade);
expose("buyTowerChallenge4Upgrade", () => buyTowerChallenge4Upgrade);
expose("towerChallengeTargetLog10", () => towerChallengeTargetLog10);
expose("towerChallengeText", () => towerChallengeText);
expose("towerChallengeName", () => towerChallengeName);
expose("towerChallengeRestriction", () => towerChallengeRestriction);
expose("towerChallengeReward", () => towerChallengeReward);
expose("towerChallengeCanComplete", () => towerChallengeCanComplete);
expose("towerChallengeRewardUnlocked", () => towerChallengeRewardUnlocked);
expose("recordTowerChallengeTime", () => recordTowerChallengeTime);
expose("toggleTowerChallenge", () => toggleTowerChallenge);
expose("completeTowerChallengeIfReady", () => completeTowerChallengeIfReady);
expose("towerGateForFloor", () => towerGateForFloor);
expose("towerCanBuildNextFloor", () => towerCanBuildNextFloor);
expose("canBuildTower", () => canBuildTower);
expose("buildTower", () => buildTower);
