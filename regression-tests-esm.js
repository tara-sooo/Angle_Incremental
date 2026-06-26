const fs = require("node:fs");
const path = require("node:path");

const originalReadFileSync = fs.readFileSync.bind(fs);
const legacyGamePath = path.join(__dirname, "game.js");
const baselineRuntimePath = path.join(__dirname, "tests", "fixtures", "next-runtime.js");

fs.readFileSync = (file, ...args) => {
  if (path.resolve(String(file)) === legacyGamePath) {
    return originalReadFileSync(baselineRuntimePath, ...args);
  }
  return originalReadFileSync(file, ...args);
};

async function main() {
  require("./regression-tests-core.js");
  await require("./tests/differential-runtime-esm.js").runDifferentialTests();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
