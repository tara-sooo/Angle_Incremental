const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const candidateRuntimePath = path.resolve(__dirname, "..", "src", "main.js");

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
  removeEventListener() {}
  setAttribute(name, value) {
    this[name] = value;
  }
  focus() {}
  select() {}
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

function createContext(initialStorage = new Map()) {
  const elements = new Map();
  const document = {
    createElement: (tag) => new FakeElement(tag),
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, new FakeElement(id));
      return elements.get(id);
    },
    querySelectorAll: (selector) => {
      const values = selector === ".main-tab" || selector === ".main-panel"
        ? ["angle", "infinity", "automation", "statistics", "achievements", "help", "settings"]
        : selector === ".infinity-subtab" || selector === ".infinity-subpanel"
          ? ["upgrades", "challenges", "angle"]
          : [];
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
    fullscreenElement: null,
    head: new FakeElement("head"),
    exitFullscreen() {},
    execCommand() {
      return true;
    },
  };
  document.documentElement.requestFullscreen = () => {};

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
    setTransform() {},
  });

  const storage = new Map(initialStorage);
  const performance = { now: () => 0 };
  const location = {
    href: "http://localhost/",
    replace(next) {
      this.href = next;
    },
  };
  const context = {
    console,
    document,
    performance,
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    window: {
      addEventListener() {},
      removeEventListener() {},
      requestAnimationFrame() {},
      setTimeout() {},
      confirm: () => true,
      location,
      ResizeObserver: null,
      performance,
      fetch: null,
      crypto: webcrypto,
      devicePixelRatio: 1,
    },
    ResizeObserver: null,
    setTimeout() {},
    URL,
    Math,
    Number,
    Infinity,
    TextDecoder,
    TextEncoder,
    crypto: webcrypto,
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    btoa: (value) => Buffer.from(value, "binary").toString("base64"),
  };
  context.window.document = document;
  context.window.localStorage = context.localStorage;
  context.window.URL = URL;
  context.window.Math = Math;
  context.window.requestAnimationFrame = () => {};
  context.window.setTimeout = () => {};
  return { context, storage };
}

async function evaluateEsmRuntime(context, entryPath) {
  if (typeof vm.SourceTextModule !== "function") {
    throw new Error("vm.SourceTextModule requires Node --experimental-vm-modules");
  }
  const cache = new Map();

  async function loadModule(filePath) {
    const resolved = path.resolve(filePath);
    if (cache.has(resolved)) return cache.get(resolved);
    const source = fs.readFileSync(resolved, "utf8");
    const module = new vm.SourceTextModule(source, {
      context,
      identifier: resolved,
      initializeImportMeta(meta) {
        meta.url = `file://${resolved}`;
      },
    });
    cache.set(resolved, module);
    await module.link(async (specifier, referencingModule) => {
      if (!specifier.startsWith(".")) {
        throw new Error(`Unsupported module specifier: ${specifier}`);
      }
      return loadModule(path.resolve(path.dirname(referencingModule.identifier), specifier));
    });
    return module;
  }

  const entry = await loadModule(entryPath);
  await entry.evaluate();
}

async function loadRuntime(runtimePath, initialStorage) {
  const { context, storage } = createContext(initialStorage);
  vm.createContext(context);
  if (path.resolve(runtimePath) === candidateRuntimePath) {
    await evaluateEsmRuntime(context, runtimePath);
  } else {
    const source = fs.readFileSync(runtimePath, "utf8");
    vm.runInContext(source, context, { filename: path.basename(runtimePath) });
  }
  return { context, storage, debug: context.window.__angleDebug };
}

function stableValue(value) {
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    if (value === Infinity) return "+Infinity";
    if (value === -Infinity) return "-Infinity";
    return value;
  }
  if (Array.isArray(value)) return Array.from(value, stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, stableValue(entry)]));
  }
  return value;
}

function snapshot(instance) {
  return {
    state: stableValue(instance.debug.state),
    view: stableValue(JSON.parse(instance.context.window.render_game_to_text())),
  };
}

module.exports = { loadRuntime, snapshot, stableValue };
