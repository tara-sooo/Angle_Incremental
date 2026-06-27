const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { webcrypto } = require("crypto");
const vm = require("vm");

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(value) {
    this.values.add(value);
  }

  remove(value) {
    this.values.delete(value);
  }

  toggle(value, force) {
    if (force === undefined) {
      if (this.values.has(value)) this.values.delete(value);
      else this.values.add(value);
      return this.values.has(value);
    }
    if (force) this.values.add(value);
    else this.values.delete(value);
    return force;
  }

  contains(value) {
    return this.values.has(value);
  }
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
    this.children = [];
    this.classList = new FakeClassList();
    this.parentElement = null;
    this.parentNode = null;
  }

  addEventListener() {}
  setAttribute(name, value) {
    this[name] = value;
  }
  focus() {}
  remove() {
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    }
  }
  append(...children) {
    children.forEach((child) => {
      child.parentElement = this;
      child.parentNode = this;
      this.children.push(child);
    });
  }
  appendChild(child) {
    this.append(child);
    return child;
  }
  querySelector() {
    return new FakeElement();
  }
  querySelectorAll() {
    return [];
  }
  getBoundingClientRect() {
    return { width: 900, height: 620 };
  }
}

function createContext() {
  const elements = new Map();
  const document = {
    createElement: (tag) => new FakeElement(tag),
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, new FakeElement(id));
      return elements.get(id);
    },
    querySelectorAll: (selector) => {
      if (selector === ".main-tab") {
        return ["angle", "infinity", "automation", "statistics", "achievements", "help", "settings"].map((tab) => {
          const element = new FakeElement();
          element.dataset.tab = tab;
          return element;
        });
      }
      if (selector === ".main-panel") {
        return ["angle", "infinity", "automation", "statistics", "achievements", "help", "settings"].map((panel) => {
          const element = new FakeElement();
          element.dataset.panel = panel;
          return element;
        });
      }
      if (selector === ".infinity-subtab") {
        return ["upgrades", "challenges", "angle"].map((tab) => {
          const element = new FakeElement();
          element.dataset.infinityTab = tab;
          return element;
        });
      }
      if (selector === ".infinity-subpanel") {
        return ["upgrades", "challenges", "angle"].map((panel) => {
          const element = new FakeElement();
          element.dataset.infinityPanel = panel;
          return element;
        });
      }
      return [];
    },
    documentElement: new FakeElement("html"),
    fonts: null,
  };
  const canvas = document.getElementById("gameCanvas");
  canvas.width = 900;
  canvas.height = 620;
  canvas.getContext = () => ({
    clearRect() {},
    fillRect() {},
    beginPath() {},
    arc() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    stroke() {},
    fill() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    fillText() {},
    measureText: (text) => ({ width: String(text).length * 8 }),
    setLineDash() {},
  });

  const storage = new Map();
  const context = {
    assert,
    console,
    document,
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    window: {
      addEventListener() {},
      requestAnimationFrame() {},
      setTimeout() {},
      location: { href: "http://localhost/" },
      ResizeObserver: null,
    },
    ResizeObserver: null,
    setTimeout() {},
    URL,
    Math,
    Number,
    Infinity,
    TextDecoder,
    TextEncoder,
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
  };
  context.window.document = document;
  context.window.localStorage = context.localStorage;
  context.window.requestAnimationFrame = () => {};
  context.window.setTimeout = () => {};
  context.window.fetch = null;
  context.window.crypto = webcrypto;
  context.crypto = webcrypto;
  context.window.URL = URL;
  context.window.Math = Math;
  return context;
}

function loadGame() {
  const code = fs.readFileSync(path.join(__dirname, "game.js"), "utf8");
  const context = createContext();
  vm.createContext(context);
  vm.runInContext(code, context, { filename: "game.js" });
  return context;
}

function testSingleEngineSourceAndVersionAlignment() {
  const gameSource = fs.readFileSync(path.join(__dirname, "game.js"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "version.json"), "utf8"));
  assert.ok(gameSource.includes('const APP_VERSION = "0.1.0";'));
  assert.ok(gameSource.includes("// BEGIN INTEGRATED BALANCE RULES"));
  assert.strictEqual(manifest.appVersion, "0.1.0");
  assert.strictEqual(fs.existsSync(path.join(__dirname, "game-core.js")), false);
  assert.strictEqual(fs.existsSync(path.join(__dirname, "balance-config.js")), false);
}

function testCoreBoostRequirementGrowsPastE308() {
  const context = loadGame();
  const { state } = context.window.__angleDebug;
  state.coreBoostCount = 4;
  assert.strictEqual(context.coreBoostRequirementLog10(), 320);
  state.scoreLog10 = 308.3;
  assert.strictEqual(context.canCoreBoost(), false);
}

function testIpGainUsesLogMinus307() {
  const context = loadGame();
  const { state } = context.window.__angleDebug;
  state.scoreLog10 = 333;
  assert.strictEqual(context.infinityPointGain(), 26);
}

function testBreakCapUsesLog2InfinityPointFormula() {
  const context = loadGame();
  const { state } = context.window.__angleDebug;
  state.scoreLog10 = 333;
  state.infiniteCapBroken = true;
  assert.strictEqual(context.infinityPointGain(), 799);
}

function testAchievement12OnlyFirstCoreBoostWithoutGeneration() {
  const context = loadGame();
  const { state, runCoreBoost } = context.window.__angleDebug;
  state.scoreLog10 = 100;
  state.generationCount = 0;
  state.coreBoostCount = 1;
  runCoreBoost();
  assert.strictEqual(state.noGenerationCoreBoostReached, false);
}

function testRawLapSpeedCanGrowPastEffectiveSafetyCap() {
  const context = loadGame();
  const { state } = context.window.__angleDebug;
  state.speedLevel = 10000;
  assert.ok(context.rawLapSpeedLog10() > 42);
  assert.ok(context.effectiveLapSpeedLog10() > 22);
  assert.ok(context.effectiveLapSpeedLog10() < 24);
  assert.ok(context.effectiveLapSpeedLog10() < context.rawLapSpeedLog10());
  assert.ok(Number.isFinite(context.lapSpeedMultiplier()));
}

function testGainExpressionReflectsChallengeRulesAndNumberFormat() {
  const context = loadGame();
  const { state } = context.window.__angleDebug;
  state.vertices = 16;
  state.currentGainLog10 = 24;
  state.currentGain = 1e24;

  state.numberFormat = "scientific";
  assert.strictEqual(context.formatGainExpressionSummary(), "(1.00e24 / 4)^4");

  state.activeChallenge = 1;
  assert.strictEqual(context.formatGainExpressionSummary(), "(1.00e24 / 40)^4");
  const activeChallengeLog = context.angleExpressionFromBaseLog10(24);

  state.completedChallenges = 1;
  assert.strictEqual(context.formatGainExpressionSummary(), "(1.00e24 / 40)^4");
  assert.strictEqual(context.angleExpressionFromBaseLog10(24), activeChallengeLog);

  state.activeChallenge = 0;
  assert.strictEqual(context.formatGainExpressionSummary(), "(1.00e24)^4");
  assert.ok(context.angleExpressionFromBaseLog10(24) > activeChallengeLog);
}

function testUpdatedChallengeRulesAndRewards() {
  const context = loadGame();
  const { state, runInfinity } = context.window.__angleDebug;

  assert.ok(context.challengeRestriction(1).includes("10倍"));
  assert.ok(context.challengeRestriction(2).includes("200"));
  assert.ok(context.challengeRestriction(3).includes("^0.8"));
  assert.ok(context.challengeRestriction(4).includes("^0.5"));
  assert.ok(context.challengeRestriction(6).includes("0.001"));
  assert.ok(context.challengeRestriction(7).includes("1e30"));
  assert.ok(context.challengeName(8).includes("反出生主義"));

  state.activeChallenge = 2;
  state.vertices = 200;
  state.scoreLog10 = 100;
  assert.strictEqual(context.canBuyNormalUpgrade("vertex"), false);

  state.activeChallenge = 3;
  state.speedLevel = 100;
  const rawWithoutIc3 = 100 * Math.log10(1.22);
  assert.ok(Math.abs(context.rawLapSpeedLog10() - rawWithoutIc3 * 0.8) < 1e-9);
  assert.ok(Math.abs(context.costLog10("speed", 5, 1, 1.55) - Math.log10(Math.ceil(5 * 1.55 ** 2))) < 0.01);

  state.activeChallenge = 4;
  state.gainLevel = 10;
  const challengedGain = context.vertexGainIncrease();
  state.activeChallenge = 0;
  const normalGain = context.vertexGainIncrease();
  assert.ok(Math.abs(challengedGain - Math.pow(normalGain, 0.5)) < 1e-9);

  state.activeChallenge = 6;
  assert.strictEqual(context.vertexGainIncrease(), 0.001);
  state.activeChallenge = 0;
  state.completedChallenges = 1 << 5;
  state.infinityCount = 1;
  state.scoreLog10 = 309;
  const ipBefore = context.infinityPointGain();
  runInfinity(false);
  assert.strictEqual(state.infinityCount, 3);
  assert.strictEqual(state.infinityPoints, ipBefore);
}

function testIc7LocksByPriceAndRewardRequiresAffordableCost() {
  const context = loadGame();
  const { state, buySpeed } = context.window.__angleDebug;
  state.activeChallenge = 7;
  state.scoreLog10 = 100;
  state.speedLevel = 0;
  assert.strictEqual(context.canBuyNormalUpgrade("speed"), true);

  state.speedLevel = 160;
  assert.strictEqual(context.canBuyNormalUpgrade("speed"), false);

  state.activeChallenge = 0;
  state.completedChallenges = 1 << 6;
  state.scoreLog10 = 0;
  state.speedLevel = 10;
  const lockedLevel = state.speedLevel;
  buySpeed();
  assert.strictEqual(state.speedLevel, lockedLevel);

  state.speedLevel = 0;
  state.scoreLog10 = 2;
  const beforeScore = state.scoreLog10;
  buySpeed();
  assert.strictEqual(state.speedLevel, 1);
  assert.strictEqual(state.scoreLog10, beforeScore);
}

function testIc8StartsAtThreeAndPreservesVerticesDuringChallengeAndReward() {
  const context = loadGame();
  const { state, runGeneration, runCoreBoost, toggleInfinityChallenge } = context.window.__angleDebug;
  assert.ok(context.challengeRestriction(8).includes("GRとCBでリセットされない"));
  state.infinityCount = 1;
  state.infinityUpgradeMask = 1 << 5;
  toggleInfinityChallenge(8);
  assert.strictEqual(state.activeChallenge, 8);
  assert.strictEqual(state.vertices, 3);
  context.updateChallengeTimers(30);
  assert.strictEqual(state.vertices, 3);
  assert.strictEqual(context.canBuyNormalUpgrade("vertex"), false);

  state.vertices = 12;
  state.totalScoreLog10 = 10;
  state.generationScoreLog10 = 10;
  runGeneration();
  assert.strictEqual(state.vertices, 12);
  assert.strictEqual(state.activeChallenge, 8);

  state.vertices = 9;
  state.scoreLog10 = 25;
  runCoreBoost();
  assert.strictEqual(state.vertices, 9);
  assert.strictEqual(state.activeChallenge, 8);

  toggleInfinityChallenge(8);
  assert.strictEqual(state.activeChallenge, 0);
  assert.strictEqual(state.vertices, 3);

  state.activeChallenge = 0;
  state.completedChallenges = 1 << 7;
  state.vertices = 42;
  state.totalScoreLog10 = 10;
  state.generationScoreLog10 = 10;
  runGeneration();
  assert.strictEqual(state.vertices, 42);

  state.scoreLog10 = 25;
  runCoreBoost();
  assert.strictEqual(state.vertices, 42);
}

function testInfinityUpgradeRules() {
  {
    const context = loadGame();
    const { state } = context.window.__angleDebug;
    state.infinityUpgradeMask = 1 << 0;
    state.infinityCount = 2;
    state.gainLevel = 0;
    state.coreBoostCount = 0;
    assert.ok(Math.abs(context.vertexGainIncrease() - 0.03) < 1e-12);
  }

  {
    const context = loadGame();
    const { state } = context.window.__angleDebug;
    state.infinityUpgradeMask = 1 << 6;
    state.speedLevel = 0;
    assert.ok(Math.abs(context.rawLapSpeedLog10() - Math.log10(3)) < 1e-12);
  }

  {
    const context = loadGame();
    const { state, runGeneration } = context.window.__angleDebug;
    state.infinityUpgradeMask = 1 << 7;
    state.totalScoreLog10 = 10;
    state.generationScoreLog10 = 10;
    runGeneration();
    assert.strictEqual(state.score, 100);
    assert.strictEqual(state.scoreLog10, 2);
    assert.strictEqual(state.totalScoreLog10, 10);
    assert.strictEqual(state.generationScoreLog10, -Infinity);
  }

  {
    const context = loadGame();
    const { state, runGeneration } = context.window.__angleDebug;
    state.infinityUpgradeMask = 1 << 9;
    state.generationCount = 1;
    state.generationCostFactor = 0.69;
    state.totalScoreLog10 = 100;
    state.generationScoreLog10 = 100;
    runGeneration();
    assert.strictEqual(state.generationCostFactor, 0.7);
  }

  {
    const context = loadGame();
    const { state } = context.window.__angleDebug;
    state.infinityUpgradeMask = 1 << 10;
    state.coreBoostCount = 2;
    assert.strictEqual(context.coreBoostGainIncreaseMultiplier(), 3);
  }

  {
    const context = loadGame();
    const { state } = context.window.__angleDebug;
    state.infinityUpgradeMask = 1 << 11;
    state.generationCount = 0;
    state.generationCostFactor = 1;
    state.infinityCount = 0;
    const baselineCostLog = context.costLog10("speed", 5, 0, 1.55);
    state.infinityCount = 50;
    const reducedCostLog = context.costLog10("speed", 5, 0, 1.55);
    assert.ok(Math.abs(reducedCostLog / baselineCostLog - 0.9) < 1e-12);
  }
}

function testBreakCapRequirementIsE350() {
  const context = loadGame();
  const { state } = context.window.__angleDebug;
  state.scoreLog10 = 349.99;
  assert.strictEqual(context.canBreakInfiniteCap(), false);
  state.scoreLog10 = 350;
  assert.strictEqual(context.canBreakInfiniteCap(), true);
}

async function testEncryptedSaveCodeRoundTripsAndRejectsTampering() {
  const context = loadGame();
  const { state } = context.window.__angleDebug;
  state.scoreLog10 = 123;
  state.vertices = 77;
  const code = await context.exportSaveCode();
  assert.match(code, /^ANGLE_SAVE_V2:/);
  assert.ok(!code.includes("\"scoreLog10\""));

  state.scoreLog10 = 0;
  state.vertices = 3;
  assert.strictEqual(await context.importSaveCode(code), true);
  assert.strictEqual(state.scoreLog10, 123);
  assert.strictEqual(state.vertices, 77);

  const tampered = `${code.slice(0, -1)}${code.endsWith("A") ? "B" : "A"}`;
  state.scoreLog10 = 55;
  assert.strictEqual(await context.importSaveCode(tampered), false);
  assert.strictEqual(state.scoreLog10, 55);
}

function testLongDurationOmitsOnlyLeadingZeroUnits() {
  const context = loadGame();
  assert.strictEqual(context.formatLongDuration(45), "45秒");
  assert.strictEqual(context.formatLongDuration(3 * 3600 + 12 * 60 + 4), "3時間12分4秒");
  assert.strictEqual(context.formatLongDuration(2 * 86400 + 3 * 3600 + 5), "2日3時間0分5秒");
  context.window.__angleDebug.state.timeUnit = "milliseconds";
  assert.strictEqual(context.formatLongDuration(1.25), "1250ミリ秒");
}

function testGenerationMultiplierUsesLogAndDoesNotOverflow() {
  const context = loadGame();
  const { state, runGeneration } = context.window.__angleDebug;
  for (let index = 0; index < 180; index += 1) {
    state.totalScoreLog10 = 1000 + index;
    state.generationScoreLog10 = 1000 + index;
    runGeneration();
  }
  assert.ok(Number.isFinite(state.generationScoreMultiplierLog10));
  assert.ok(state.generationScoreMultiplierLog10 <= 8);
  assert.ok(Number.isFinite(context.generationScoreMultiplierEffectLog10()));
}

function testGenerationRewardFavorsShallowRunsWithoutDeepSpike() {
  const context = loadGame();
  const shallow = context.window.__angleDebug.generationRewardFor(1e10);
  const deep = context.window.__angleDebug.generationRewardFor(1e106);

  assert.ok(shallow.scoreMultiplierLog10 > 0.48);
  assert.ok(shallow.costReduction > 0.09);
  assert.ok(deep.scoreMultiplierLog10 < 1.3);
  assert.ok(deep.costReduction <= 0.24);
}

function testGenerationRewardDoesNotDecreaseAtHigherDepth() {
  const context = loadGame();
  const earlier = context.window.__angleDebug.generationRewardFor(1e25);
  const later = context.window.__angleDebug.generationRewardFor(1e46);

  assert.ok(later.scoreMultiplierLog10 >= earlier.scoreMultiplierLog10);
  assert.ok(later.costReduction >= earlier.costReduction);
}

function testGenerationRelievesEarlyUpgradeScaling() {
  const context = loadGame();
  const { state } = context.window.__angleDebug;

  state.speedLevel = 80;
  state.generationCount = 0;
  const beforeGeneration = context.costLog10("speed", 5, state.speedLevel, 1.55);

  state.generationCount = 1;
  const afterGeneration = context.costLog10("speed", 5, state.speedLevel, 1.55);

  assert.ok(afterGeneration < beforeGeneration - 0.5);
}

function testAutobuyRunsAtTenTimesPerSecond() {
  const context = loadGame();
  const { state } = context.window.__angleDebug;
  state.infinityUpgradeMask = 1 << 1;
  state.automationEnabled = true;
  state.autoBuySpeed = true;
  state.autoBuyVertex = false;
  state.autoBuyGain = false;
  state.scoreLog10 = 20;
  context.update(0.1);
  assert.ok(state.speedLevel > 0);
}

function testChallengeAutoCompleteRunsInfinityOnlyWhenEnabled() {
  const context = loadGame();
  const { state } = context.window.__angleDebug;
  state.infinityCount = 1;
  state.infinityUpgradeMask = 1 << 5;
  state.activeChallenge = 1;
  state.scoreLog10 = 309;
  state.autoCompleteChallenges = false;
  context.completeChallengeIfReady();
  assert.strictEqual(state.activeChallenge, 1);

  state.autoCompleteChallenges = true;
  context.completeChallengeIfReady();
  assert.strictEqual(state.activeChallenge, 0);
  assert.ok((state.completedChallenges & 1) !== 0);
}

async function run() {
  testSingleEngineSourceAndVersionAlignment();
  testCoreBoostRequirementGrowsPastE308();
  testIpGainUsesLogMinus307();
  testBreakCapUsesLog2InfinityPointFormula();
  testAchievement12OnlyFirstCoreBoostWithoutGeneration();
  testRawLapSpeedCanGrowPastEffectiveSafetyCap();
  testGainExpressionReflectsChallengeRulesAndNumberFormat();
  testUpdatedChallengeRulesAndRewards();
  testIc7LocksByPriceAndRewardRequiresAffordableCost();
  testIc8StartsAtThreeAndPreservesVerticesDuringChallengeAndReward();
  testInfinityUpgradeRules();
  testBreakCapRequirementIsE350();
  await testEncryptedSaveCodeRoundTripsAndRejectsTampering();
  testLongDurationOmitsOnlyLeadingZeroUnits();
  testGenerationMultiplierUsesLogAndDoesNotOverflow();
  testGenerationRewardFavorsShallowRunsWithoutDeepSpike();
  testGenerationRewardDoesNotDecreaseAtHigherDepth();
  testGenerationRelievesEarlyUpgradeScaling();
  testAutobuyRunsAtTenTimesPerSecond();
  testChallengeAutoCompleteRunsInfinityOnlyWhenEnabled();
  console.log("regression tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
