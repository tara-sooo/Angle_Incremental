const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.join(__dirname, "balance-config.js"), "utf8");
const INFINITY_REQUIREMENT_LOG10 = 308 + Math.log10(1.8);

function loadBalanceProfile() {
  const state = { activeChallenge: 0, vertices: 3, infiniteCapBroken: false };
  const upgradeCosts = { speed: 0, vertex: 0, gain: 0 };
  let scoreLog10 = -Infinity;
  const context = {
    Math,
    GENERATION_UNLOCK_SCORE: 1e6,
    INFINITY_CHALLENGES: Array.from({ length: 8 }, () => ({})),
    state,
    window: { __angleDebug: {} },
    log10Value: (value) => Math.log10(value),
    valueFromLog10: (value) => 10 ** value,
    currentScoreLog10: () => scoreLog10,
    canInfinity: () => scoreLog10 >= INFINITY_REQUIREMENT_LOG10,
    upgradeCostLog: (kind) => upgradeCosts[kind],
    canSpendLog: () => true,
    generationRewardForLog() {},
    earlyLayerCostScalingFactor() {},
    preGenerationCostScalingLog10() {},
    canBuyNormalUpgrade() {},
    infinityPointGain() {},
    updateUi() {},
    draw() {},
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "balance-config.js" });
  return {
    context,
    state,
    upgradeCosts,
    setScoreLog10: (value) => { scoreLog10 = value; },
  };
}

const { context, state, upgradeCosts, setScoreLog10 } = loadBalanceProfile();

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
upgradeCosts.speed = 100;
assert.strictEqual(context.canBuyNormalUpgrade("speed"), true);

state.activeChallenge = 8;
assert.strictEqual(context.canBuyNormalUpgrade("vertex"), false);

assert.ok(context.INFINITY_CHALLENGES[6].restriction.ja.includes("ショップの価格"));
assert.ok(context.INFINITY_CHALLENGES[6].restriction.en.includes("cost"));

setScoreLog10(308);
assert.strictEqual(context.infinityPointGain(), 0);

setScoreLog10(333);
state.infiniteCapBroken = false;
assert.strictEqual(context.infinityPointGain(), 26);

state.infiniteCapBroken = true;
assert.strictEqual(context.infinityPointGain(), 799);

setScoreLog10(INFINITY_REQUIREMENT_LOG10);
assert.strictEqual(context.infinityPointGain(), 717);

console.log("balance regression tests passed");
