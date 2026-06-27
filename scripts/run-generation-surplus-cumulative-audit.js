const { runFastAudit } = require("../tests/generation-surplus-cumulative-fast-audit.js");

runFastAudit().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
