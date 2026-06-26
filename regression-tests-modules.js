const fs = require("fs");
const path = require("path");
const Module = require("module");

const root = __dirname;
const originalReadFileSync = fs.readFileSync.bind(fs);
const runtimeSource = [
  originalReadFileSync(path.join(root, "src/runtime/core.js"), "utf8"),
  "\n// BEGIN INTEGRATED BALANCE RULES\n",
  originalReadFileSync(path.join(root, "src/data/progression-definitions.js"), "utf8"),
  originalReadFileSync(path.join(root, "src/data/balance-profile.js"), "utf8"),
  originalReadFileSync(path.join(root, "src/systems/balance-formulas.js"), "utf8"),
  originalReadFileSync(path.join(root, "src/systems/balance-runtime.js"), "utf8"),
  originalReadFileSync(path.join(root, "src/systems/progression-data-runtime.js"), "utf8"),
].join("\n");

fs.readFileSync = (file, options) => {
  if (path.resolve(String(file)) === path.join(root, "game.js")) {
    const encoding = typeof options === "string" ? options : options && options.encoding;
    return encoding ? runtimeSource : Buffer.from(runtimeSource);
  }
  return originalReadFileSync(file, options);
};

const coreTestPath = path.join(root, "regression-tests-core.js");
const coreTestSource = originalReadFileSync(coreTestPath, "utf8").replace(
  "  addEventListener() {}",
  "  addEventListener() {}\n  removeEventListener() {}",
);
const testModule = new Module(coreTestPath, module);
testModule.filename = coreTestPath;
testModule.paths = Module._nodeModulePaths(root);
testModule._compile(coreTestSource, coreTestPath);
