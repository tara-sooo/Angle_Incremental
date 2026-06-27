const { runPrecisionAudit } = require("../tests/generation-surplus-cumulative-precision-audit.js");

runPrecisionAudit().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
