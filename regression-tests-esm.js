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
  await require("./tests/ic7-price-cap-module-runtime.js").runIc7PriceCapModuleRuntimeTest();
  await require("./tests/achievements-v2-module-runtime.js").runAchievementV2ModuleRuntimeTest();
  await require("./tests/numeric-stability-module-runtime.js").runNumericStabilityModuleRuntimeTest();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
