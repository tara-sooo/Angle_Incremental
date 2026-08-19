import assert from "node:assert/strict";
import { classifyRuns, RUN_COUNT } from "../scripts/local-performance-gate.mjs";

const run = (...violationKeys) => ({ violationKeys });
const cleanRuns = () => Array.from({ length: RUN_COUNT }, () => run());
const repeatedRuns = (key) => Array.from({ length: RUN_COUNT }, () => run(key));

const clean = classifyRuns(cleanRuns(), cleanRuns());
assert.equal(clean.classification, "local-performance-pass");
assert.equal(clean.hostedCiRequired, false);

const candidateOnly = classifyRuns(
  Array.from({ length: RUN_COUNT }, () => ({
    budgetViolations: ["desktop/DPR1/angle/3 simulation p95 13.000ms > 12ms"],
  })),
  cleanRuns(),
);
assert.equal(candidateOnly.classification, "local-performance-regression");
assert.deepEqual(candidateOnly.candidateOnlyFailures, ["desktop/DPR1/angle/3 simulation p95"]);

const shared = classifyRuns(repeatedRuns("desktop/DPR1/angle/3 simulation p95"), repeatedRuns("desktop/DPR1/angle/3 simulation p95"));
assert.equal(shared.classification, "local-performance-inconclusive");
assert.equal(shared.hostedCiRequired, true);

const moving = classifyRuns(
  [run("desktop/DPR1/angle/3 simulation p95"), run("desktop/DPR1/angle/720 simulation p95"), run("desktop/DPR2/angle/3 simulation p95")],
  [run(), run(), run()],
);
assert.equal(moving.classification, "local-performance-inconclusive");
assert.equal(moving.hostedCiRequired, true);

console.log("local performance gate classifier checks passed");
