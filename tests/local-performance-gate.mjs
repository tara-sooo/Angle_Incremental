import assert from "node:assert/strict";
import { classifyRuns, collectTimingMeasurements, RUN_COUNT } from "../scripts/local-performance-gate.mjs";

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

const stableCandidateAndBaselineFailures = classifyRuns(
  repeatedRuns("desktop/DPR1/angle/3 simulation p95"),
  repeatedRuns("desktop/DPR1/angle/720 simulation p95"),
);
assert.equal(stableCandidateAndBaselineFailures.classification, "local-performance-regression");
assert.deepEqual(stableCandidateAndBaselineFailures.candidateOnlyFailures, ["desktop/DPR1/angle/3 simulation p95"]);
assert.deepEqual(stableCandidateAndBaselineFailures.movingFailures, ["desktop/DPR1/angle/720 simulation p95"]);

const shared = classifyRuns(repeatedRuns("desktop/DPR1/angle/3 simulation p95"), repeatedRuns("desktop/DPR1/angle/3 simulation p95"));
assert.equal(shared.classification, "local-performance-inconclusive");
assert.equal(shared.hostedCiRequired, true);

const moving = classifyRuns(
  [run("desktop/DPR1/angle/3 simulation p95"), run("desktop/DPR1/angle/720 simulation p95"), run("desktop/DPR2/angle/3 simulation p95")],
  [run(), run(), run()],
);
assert.equal(moving.classification, "local-performance-inconclusive");
assert.equal(moving.hostedCiRequired, true);

const timingMeasurements = collectTimingMeasurements({
  budgets: { simulationP95Ms: 12, normalFrameP95Ms: 30, highLoadFrameP95Ms: 50 },
  simulationResults: [{
    viewport: { name: "desktop" },
    deviceScaleFactor: 1,
    scenarios: [{
      vertices: 3,
      angle: { simulation: { p95Ms: 11 } },
      infiniteAngle: { simulation: { p95Ms: 12.5 } },
    }],
  }],
  renderResults: [{
    viewport: { name: "desktop" },
    deviceScaleFactor: 1,
    scenarios: [{
      vertices: 3,
      angle: { frame: { p95Ms: 20 } },
      infiniteAngle: { frame: { p95Ms: 31 } },
    }],
  }],
});
assert.deepEqual(timingMeasurements, [
  { scenario: "desktop/DPR1/angle/3", metric: "simulation", p95Ms: 11, budgetMs: 12 },
  { scenario: "desktop/DPR1/infinite-angle/3", metric: "simulation", p95Ms: 12.5, budgetMs: 12 },
  { scenario: "desktop/DPR1/angle/3", metric: "frame", p95Ms: 20, budgetMs: 30 },
  { scenario: "desktop/DPR1/infinite-angle/3", metric: "frame", p95Ms: 31, budgetMs: 50 },
]);

console.log("local performance gate classifier checks passed");
