const assert = require("assert");
const fs = require("fs");
const path = require("path");
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

testCoreBoostRequirementGrowsPastE308();
testIpGainUsesLogMinus307();
testAchievement12OnlyFirstCoreBoostWithoutGeneration();
console.log("regression tests passed");
