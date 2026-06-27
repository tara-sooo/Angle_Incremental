const fs = require("node:fs");
const path = require("node:path");

const originalReadFileSync = fs.readFileSync.bind(fs);
const legacyGamePath = path.join(__dirname, "game.js");
const baselineRuntimePath = path.join(__dirname, "tests", "fixtures", "next-runtime.js");
const failureReportPath = path.join(__dirname, "regression-failure.txt");

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
  await require("./tests/first-infinity-strategy-search-audit.js").runFirstInfinityStrategySearchAudit();
}

main().catch((error) => {
  const detail = error instanceof Error ? error.stack || error.message : String(error);
  try {
    fs.writeFileSync(failureReportPath, `${detail}\n`);
  } catch (writeError) {
    console.error("failed to write regression failure diagnostics", writeError);
  }
  console.error(error);
  process.exitCode = 1;
});
