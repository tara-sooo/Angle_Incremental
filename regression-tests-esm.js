const fs = require("node:fs");
const path = require("node:path");
const failureReportPath = path.join(__dirname, "regression-failure.txt");

async function main() {
  await require("./tests/runtime-invariants-module-runtime.js").runRuntimeInvariantTests();
  await require("./tests/vertex-gain-display-module-runtime.js").runVertexGainDisplayModuleRuntimeTest();
  await require("./tests/ic7-price-cap-module-runtime.js").runIc7PriceCapModuleRuntimeTest();
  await require("./tests/achievements-v2-module-runtime.js").runAchievementV2ModuleRuntimeTest();
  await require("./tests/numeric-stability-module-runtime.js").runNumericStabilityModuleRuntimeTest();
  await require("./tests/post-generation-upgrade-scaling-module-runtime.js").runPostGenerationUpgradeScalingModuleRuntimeTest();
  await require("./tests/new-infinity-upgrades-module-runtime.js").runNewInfinityUpgradesModuleRuntimeTest();
  await require("./tests/infinite-angle-module-runtime.js").runInfiniteAngleModuleRuntimeTest();
  await require("./tests/tower-module-runtime.js").runTowerModuleRuntimeTest();
  await require("./tests/eternity-module-runtime.js").runEternityModuleRuntimeTest();
  await require("./tests/eternity-save-migration-module-runtime.js").runEternitySaveMigrationModuleRuntimeTest();
  await require("./tests/save-recovery-module-runtime.js").runSaveRecoveryModuleRuntimeTest();
  await require("./tests/time-flux-module-runtime.js").runTimeFluxModuleRuntimeTest();
  await require("./tests/version-consistency-module-runtime.js").runVersionConsistencyModuleRuntimeTest();
  await require("./tests/idd-issue-association-module-runtime.js").runIddIssueAssociationModuleRuntimeTest();
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