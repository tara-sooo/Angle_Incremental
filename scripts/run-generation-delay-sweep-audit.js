const { runGenerationDelaySweepAudit } = require("../tests/gr-delay-sweep-first-infinity-audit.js");

runGenerationDelaySweepAudit().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
