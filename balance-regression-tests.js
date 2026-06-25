const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.join(__dirname, "balance-config.js"), "utf8");
const INFINITY_REQUIREMENT_LOG10 = 308 + Math.log10(1.8);

function loadBalanceProfile() {
  const state = {
    activeChallenge: 0,
    vertices: 3,
    score: 0,
    scoreLog10: -Infinity,
    totalScore: 0,
    totalScoreLog10: -Infinity,
    generationScore: 0,
    generationScoreLog10: -Infinity,
    generationCount: 0,
    previousGenerationScore: 0,
    previousGenerationScoreLog10: -Infinity,
    generationScoreMultiplier: 1,
    generationScoreMultiplierLog10: 0,
    generationCostFactor: 1,
    speedLevel: 0,
    gainLevel: 0,
    currentGain: 1,
    currentGainLog10: 0,
    pointProgress: 0,
    totalVertexProgress: 0,
    lastVertexIndex: 0,
    floatingTexts: [],
    coreBoostCount: 0,
    infinityCount: 0,
    infiniteCapBroken: false,
  };
  const purchased = new Set();
  const upgradeCosts = { speed: 0, vertex: 0, gain: 0 };
  let scoreLog10 = -Infinity;
  const context = {
    Math,
    GENERATION_UNLOCK_SCORE: 1e6,
    GENERATION_MIN_NEW_COST_FACTOR: 0.78,
    GENERATION_SCORE_POWER: 2,
    INFINITY_CHALLENGES: Array.from({ length: 8 }, () => ({})),
    INFINITY_UPGRADES: [
      { id: "1-1", bit: 0 }, { id: "1-2", bit: 1 }, { id: "2-1", bit: 2 },
      { id: "3-1", bit: 3 }, { id: "3-2", bit: 4 }, { id: "4-1", bit: 5 },
    ],
    state,
    window: { __angleDebug: {} },
    log10Value: (value) => Math.log10(value),
    valueFromLog10: (value) => value <= 308 ? 10 ** value : Number.MAX_VALUE,
    clampLog10: (value) => value,
    currentScoreLog10: () => scoreLog10,
    currentGenerationScoreLog10: () => state.generationScoreLog10,
    canInfinity: () => scoreLog10 >= INFINITY_REQUIREMENT_LOG10,
    canRunGeneration: () => state.generationScoreLog10 >= 6,
    shouldPreserveVerticesThroughEarlyReset: () => false,
    generationCostPower: () => 1,
    generationScoreMultiplierEffect: () => 1,
    generationScoreMultiplierEffectLog10: () => 0,
    generationScoreMultiplierBaseEffectLog10: (value) => value,
    applyGenerationAchievementRewardLog10: (value) => value,
    generationCostFactorEffect: () => state.generationCostFactor * (purchased.has("3-2") ? 0.95 : 1),
    coreBoostBonusPower: () => 1,
    infiniteAngleBoost: () => 1,
    achievementGainMultiplier: () => 1,
    isChallengeCompleted: () => false,
    hasInfinityUpgrade: (id) => purchased.has(id),
    applyInfinityUpgradePower: (value) => value,
    upgradeCostLog: (kind) => upgradeCosts[kind],
    canSpendLog: () => true,
    stagedUpgradeCostScalingLog10: () => 0,
    generationRewardForLog() {},
    earlyLayerCostScalingFactor() {},
    preGenerationCostScalingLog10() {},
    canBuyNormalUpgrade() {},
    infinityPointGain() {},
    costLog10() {},
    rawLapSpeedLog10() {},
    generationScorePower() {},
    coreBoostGainIncreaseMultiplier() {},
    vertexGainIncrease() {},
    runGeneration() {},
    nextGenerationValues() {},
    resetBelowCoreBoost() { state.score = 0; state.scoreLog10 = -Infinity; },
    resetBelowInfinity() { state.score = 0; state.scoreLog10 = -Infinity; },
    updateUi() {},
    draw() {},
    saveGame() {},
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "balance-config.js" });
  return {
    context,
    state,
    purchased,
    upgradeCosts,
    setScoreLog10: (value) => { scoreLog10 = value; },
  };
}

const { context, state, purchased, upgradeCosts, setScoreLog10 } = loadBalanceProfile();

assert.strictEqual(context.earlyLayerCostScalingFactor(), 1);
assert.ok(Math.abs(context.preGenerationCostScalingLog10("speed", 30) - 0.035) < 1e-12);
assert.ok(Math.abs(context.preGenerationCostScalingLog10("vertex", 25) - 0.14) < 1e-12);
assert.ok(Math.abs(context.preGenerationCostScalingLog10("gain", 22) - 0.065) < 1e-12);

state.activeChallenge = 7;
upgradeCosts.speed = 30;
assert.strictEqual(context.canBuyNormalUpgrade("speed"), true);
upgradeCosts.speed = 30.000001;
assert.strictEqual(context.canBuyNormalUpgrade("speed"), false);
state.activeChallenge = 0;

setScoreLog10(308);
assert.strictEqual(context.infinityPointGain(), 0);
setScoreLog10(333);
state.infiniteCapBroken = false;
assert.strictEqual(context.infinityPointGain(), 26);
state.infiniteCapBroken = true;
assert.strictEqual(context.infinityPointGain(), 799);

const upgradeIds = context.INFINITY_UPGRADES.map((upgrade) => upgrade.id).join(",");
assert.strictEqual(upgradeIds, "1-1,1-2,2-1,3-1,3-2,4-1,5-1,5-2,6-1,6-2,7-1,7-2");
assert.strictEqual(context.INFINITY_UPGRADES.find((upgrade) => upgrade.id === "7-2").cost, 150);
assert.strictEqual(context.INFINITY_UPGRADES.find((upgrade) => upgrade.id === "6-1").requires.join(","), "5-1,5-2");

purchased.add("1-1");
state.infinityCount = 0;
assert.strictEqual(context.vertexGainIncrease(), 0.01);
state.infinityCount = 1;
assert.strictEqual(context.vertexGainIncrease(), 0.02);

purchased.add("5-1");
state.speedLevel = 0;
assert.ok(Math.abs(context.rawLapSpeedLog10() - Math.log10(3)) < 1e-12);

purchased.add("3-1");
purchased.add("6-1");
assert.ok(Math.abs(context.generationScorePower() - 3.6) < 1e-12);
purchased.add("6-2");
assert.strictEqual(context.balanceGenerationMinCostFactor(), 0.70);

state.coreBoostCount = 2;
assert.strictEqual(context.coreBoostGainIncreaseMultiplier(), 2);
purchased.add("7-1");
assert.strictEqual(context.coreBoostGainIncreaseMultiplier(), 3);

purchased.add("7-2");
state.infinityCount = 50;
assert.ok(Math.abs(context.balanceInfinityUpgradeCostExponent() - 0.9) < 1e-12);
state.infinityCount = 51;
assert.ok(context.balanceInfinityUpgradeCostExponent() < 0.9);
assert.ok(context.balanceInfinityUpgradeCostExponent() > 0.899);
state.infinityCount = 1000;
assert.ok(context.balanceInfinityUpgradeCostExponent() > 0.8);
assert.ok(context.balanceInfinityUpgradeCostExponent() < 0.81);

purchased.add("5-2");
state.score = 0;
state.scoreLog10 = -Infinity;
context.resetBelowCoreBoost();
assert.strictEqual(state.score, 100);
assert.strictEqual(state.scoreLog10, 2);
context.resetBelowInfinity();
assert.strictEqual(state.score, 100);
assert.strictEqual(state.scoreLog10, 2);

console.log("balance regression tests passed");
