const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

class FakeClassList {
  add() {}
  remove() {}
  toggle() {}
  contains() { return false; }
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
  removeEventListener() {}
  setAttribute(name, value) { this[name] = value; }
  focus() {}
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
  querySelector() { return new FakeElement(); }
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { width: 900, height: 620 }; }
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
      const values = {
        ".main-tab": ["angle", "infinity", "automation", "statistics", "achievements", "help", "settings"],
        ".main-panel": ["angle", "infinity", "automation", "statistics", "achievements", "help", "settings"],
        ".infinity-subtab": ["upgrades", "challenges", "angle"],
        ".infinity-subpanel": ["upgrades", "challenges", "angle"],
      }[selector] || [];
      return values.map((value) => {
        const element = new FakeElement();
        if (selector === ".main-tab") element.dataset.tab = value;
        if (selector === ".main-panel") element.dataset.panel = value;
        if (selector === ".infinity-subtab") element.dataset.infinityTab = value;
        if (selector === ".infinity-subpanel") element.dataset.infinityPanel = value;
        return element;
      });
    },
    documentElement: new FakeElement("html"),
    fonts: null,
  };
  const canvas = document.getElementById("gameCanvas");
  canvas.width = 900;
  canvas.height = 620;
  canvas.getContext = () => ({
    clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, moveTo() {}, lineTo() {}, closePath() {},
    stroke() {}, fill() {}, save() {}, restore() {}, translate() {}, rotate() {}, fillText() {},
    measureText: (text) => ({ width: String(text).length * 8 }), setLineDash() {}, setTransform() {},
  });

  const storage = new Map();
  const context = {
    console,
    document,
    localStorage: {
      getItem: (key) => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    window: {
      addEventListener() {}, requestAnimationFrame() {}, setTimeout() {}, location: { href: "http://localhost/" },
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
  context.window.URL = URL;
  context.window.Math = Math;
  return context;
}

function loadGame() {
  const context = createContext();
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "game.js"), "utf8"), context, { filename: "game.js" });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "iu5-7.js"), "utf8"), context, { filename: "iu5-7.js" });
  return context;
}

function hasBit(bit) {
  return 1 << bit;
}

function testUpgradeTreeAndFormulaEffects() {
  const context = loadGame();
  const { state } = context.window.__angleDebug;
  assert.strictEqual(context.INFINITY_UPGRADES.length, 12);

  state.infinityUpgradeMask = hasBit(6);
  assert.ok(Math.abs(context.rawLapSpeedLog10() - Math.log10(3)) < 1e-12);
  state.activeChallenge = 3;
  assert.ok(Math.abs(context.rawLapSpeedLog10() - Math.log10(3) * 0.8) < 1e-12);

  state.activeChallenge = 0;
  state.infinityUpgradeMask = hasBit(10);
  state.coreBoostCount = 3;
  assert.strictEqual(context.coreBoostGainIncreaseMultiplier(), 4);

  state.infinityUpgradeMask = hasBit(3) | hasBit(8);
  assert.strictEqual(context.generationScorePower(), 3.6);
}

function testIu5_2AndIu6_2ResetEffects() {
  const context = loadGame();
  const { state, runGeneration, runCoreBoost } = context.window.__angleDebug;

  state.infinityUpgradeMask = hasBit(7);
  state.scoreLog10 = 20;
  runCoreBoost();
  assert.strictEqual(state.score, 100);
  assert.strictEqual(state.scoreLog10, 2);

  state.infinityUpgradeMask = hasBit(9);
  state.generationCount = 1;
  state.generationScoreLog10 = 7;
  state.generationCostFactor = 0.78;
  runGeneration();
  assert.ok(state.generationCostFactor < 0.78);
  assert.ok(state.generationCostFactor >= 0.70);
}

function testIu7_2CostExponent() {
  const context = loadGame();
  const { state, costLog10, iu7_2CostExponent } = context.window.__angleDebug;
  state.infinityCount = 50;
  const baseline = costLog10("speed", 5, 20, 1.55);
  state.infinityUpgradeMask = hasBit(11);
  const reduced = costLog10("speed", 5, 20, 1.55);
  assert.strictEqual(iu7_2CostExponent(), 0.9);
  assert.ok(Math.abs(reduced - baseline * 0.9) < 1e-9);
}

function run() {
  testUpgradeTreeAndFormulaEffects();
  testIu5_2AndIu6_2ResetEffects();
  testIu7_2CostExponent();
  console.log("IU5-IU7 regression tests passed");
}

run();
