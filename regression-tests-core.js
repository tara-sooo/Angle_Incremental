const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { webcrypto } = require("crypto");
const vm = require("vm");

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
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
  contains(value) { return this.values.has(value); }
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
  setAttribute(name, value) { this[name] = value; }
  focus() {}
  remove() {
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
  }
  append(...children) {
    children.forEach((child) => {
      child.parentElement = this;
      child.parentNode = this;
      this.children.push(child);
    });
  }
  appendChild(child) { this.append(child); return child; }
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
      }[selector];
      if (!values) return [];
      return values.map((value) => {
        const element = new FakeElement();
        if (selector.includes("main")) element.dataset[selector.endsWith("tab") ? "tab" : "panel"] = value;
        else element.dataset[selector.endsWith("subtab") ? "infinityTab" : "infinityPanel"] = value;
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
    clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, moveTo() {}, lineTo() {},
    closePath() {}, stroke() {}, fill() {}, save() {}, restore() {}, translate() {},
    rotate() {}, fillText() {}, measureText: (text) => ({ width: String(text).length * 8 }),
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

function testSingleSourceAndVersionAlignment() {
  const gamePath = path.join(__dirname, "game.js");
  const gameSource = fs.readFileSync(gamePath, "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "version.json"), "utf8"));
  assert.ok(gameSource.includes('const APP_VERSION = "0.1.0";'));
  assert.strictEqual(manifest.appVersion, "0.1.0");
  assert.ok(gameSource.includes("// BEGIN INTEGRATED BALANCE RULES"));
  assert.ok(!fs.existsSync(path.join(__dirname, "game-core.js")));
  assert.ok(!fs.existsSync(path.join(__dirname, "balance-config.js")));
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

function testBreakCapInfinityPointFormula() {
  const context = loadGame();
  const { state } = context.window.__angleDebug;
  state.scoreLog10 = 333;
  state.infiniteCapBroken = false;
  assert.strictEqual(context.infinityPointGain(), 26);
  state.infiniteCapBroken = true;
  assert.strictEqual(context.infinityPointGain(), 799);
}

function testInfinityUpgradeEffectsAndResetStartScore() {
  const context = loadGame();
  const { state } = context.window.__angleDebug;
  state.infinityUpgradeMask = 1 << 6;
  state.speedLevel = 0;
  assert.ok(Math.abs(context.rawLapSpeedLog10() - Math.log10(3)) < 1e-12);

  state.infinityUpgradeMask = 1 << 7;
  state.score = 1000;
  state.scoreLog10 = 3;
  context.resetBelowCoreBoost();
  assert.strictEqual(state.score, 100);
  assert.strictEqual(state.scoreLog10, 2);
}

function testInfinityUpgradeTreeContainsSevenTiers() {
  const context = loadGame();
  const tree = context.document.getElementById("infinityUpgradeTree");
  assert.strictEqual(tree.children.length, 7);
}

function run() {
  testSingleSourceAndVersionAlignment();
  testIc7LocksByPriceAndRewardRequiresAffordableCost();
  testBreakCapInfinityPointFormula();
  testInfinityUpgradeEffectsAndResetStartScore();
  testInfinityUpgradeTreeContainsSevenTiers();
  console.log("regression tests passed");
}

run();
