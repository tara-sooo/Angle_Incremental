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
  assert.ok(context.effectiveLapSpeedLog10() > 36);
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
  assert.strictEqual(context.formatGainExpressionSummary(), "(1.00e24 / 8)^4");
  const activeChallengeLog = context.angleExpressionFromBaseLog10(24);

  state.completedChallenges = 1;
  assert.strictEqual(context.formatGainExpressionSummary(), "(1.00e24 / 8)^4");
  assert.strictEqual(context.angleExpressionFromBaseLog10(24), activeChallengeLog);

  state.activeChallenge = 0;
  assert.strictEqual(context.formatGainExpressionSummary(), "(1.00e24)^4");
  assert.ok(context.angleExpressionFromBaseLog10(24) > activeChallengeLog);
}

function testIc7LocksByUpgradeCostNotScore() {
  const context = loadGame();
  const { state } = context.window.__angleDebug;
  state.activeChallenge = 7;
  state.scoreLog10 = 150;
  state.speedLevel = 0;
  assert.strictEqual(context.canBuyNormalUpgrade("speed"), true);

  state.scoreLog10 = 200;
  state.speedLevel = 1000;
  assert.ok(context.upgradeCostLog("speed") >= 100);
  assert.strictEqual(context.canBuyNormalUpgrade("speed"), false);
}

function testIc8DecayKeepsProgressAndRewardPreservesVertices() {
  const context = loadGame();
  const { state, runGeneration, runCoreBoost } = context.window.__angleDebug;
  state.activeChallenge = 8;
  state.vertices = 100;
  state.totalVertexProgress = 50;
  state.pointProgress = 0.5;
  context.updateChallengeTimers(3);
  assert.strictEqual(state.vertices, 99);
  assert.ok(state.pointProgress > 0.49);

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
  testCoreBoostRequirementGrowsPastE308();
  testIpGainUsesLogMinus307();
  testAchievement12OnlyFirstCoreBoostWithoutGeneration();
  testRawLapSpeedCanGrowPastEffectiveSafetyCap();
  testGainExpressionReflectsChallengeRulesAndNumberFormat();
  testIc7LocksByUpgradeCostNotScore();
  testIc8DecayKeepsProgressAndRewardPreservesVertices();
  testBreakCapRequirementIsE350();
  await testEncryptedSaveCodeRoundTripsAndRejectsTampering();
  testLongDurationOmitsOnlyLeadingZeroUnits();
  testChallengeAutoCompleteRunsInfinityOnlyWhenEnabled();
  console.log("regression tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
