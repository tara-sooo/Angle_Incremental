const { runGenerationSurplusCumulativeFirstInfinityAudit } = require("../tests/generation-surplus-cumulative-first-infinity-audit.js");

runGenerationSurplusCumulativeFirstInfinityAudit().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
