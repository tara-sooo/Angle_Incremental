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

const TOWER_CHALLENGES = Object.freeze([
  {
    index: 1,
    unlockFloor: 3,
    targetLog10: 308,
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
    targetLog10: 1555,
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
    targetLog10: Infinity,
    name: { ja: "TC3", en: "TC3" },
    restriction: { ja: "内容は今後のリリースで公開", en: "Details planned for a future release." },
    reward: { ja: "報酬は今後のリリースで公開", en: "Reward planned for a future release." },
    implemented: false,
  },
  {
    index: 4,
    unlockFloor: 12,
    targetLog10: Infinity,
    name: { ja: "TC4", en: "TC4" },
    restriction: { ja: "内容は今後のリリースで公開", en: "Details planned for a future release." },
    reward: { ja: "報酬は今後のリリースで公開", en: "Reward planned for a future release." },
    implemented: false,
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

function towerChallengeDefinition(index) {
  const normalizedIndex = Math.floor(index);
  return normalizedIndex >= 1 && normalizedIndex <= runtime.TOWER_CHALLENGE_COUNT
    ? TOWER_CHALLENGES[normalizedIndex - 1]
    : null;
}

function towerChallengeImplemented(index) {
  return Boolean(towerChallengeDefinition(index)?.implemented);
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
  return towerChallengeText(index, "restriction");
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
    runtime.runInfinity(false);
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
expose("TOWER_CHALLENGES", () => TOWER_CHALLENGES);
expose("towerFloor", () => towerFloor);
expose("towerFloorCostLog10", () => towerFloorCostLog10);
expose("towerNextFloor", () => towerNextFloor);
expose("towerNextFloorCostLog10", () => towerNextFloorCostLog10);
expose("towerScoreExponent", () => towerScoreExponent);
expose("towerChallenge1InfinityScorePowerBonus", () => towerChallenge1InfinityScorePowerBonus);
expose("towerChallengeUnlockFloor", () => towerChallengeUnlockFloor);
expose("towerChallengeUnlocked", () => towerChallengeUnlocked);
expose("towerChallengeCompleted", () => towerChallengeCompleted);
expose("towerChallengeDefinition", () => towerChallengeDefinition);
expose("towerChallengeImplemented", () => towerChallengeImplemented);
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
