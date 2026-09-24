import assert from "node:assert/strict";
import {
  BATCH_COUNT,
  PERFORMANCE_METRIC_VERSION,
  TIMED_ITERATIONS,
  aggregatePerformanceMetric,
  readPerformanceMetricP95,
} from "../scripts/performance-metrics.mjs";
import { classifyRuns, collectTimingMeasurements, RUN_COUNT } from "../scripts/local-performance-gate.mjs";

const measuredMetric = (p95Values, budgetMs) => aggregatePerformanceMetric({
  batches: p95Values.map((p95Ms) => ({
    count: TIMED_ITERATIONS,
    meanMs: p95Ms,
    p50Ms: p95Ms,
    p95Ms,
    maxMs: p95Ms,
  })),
}, budgetMs);

const healthyMetric = measuredMetric([9, 10, 11], 12);
assert.equal(healthyMetric.metricVersion, PERFORMANCE_METRIC_VERSION);
assert.equal(healthyMetric.batchCount, BATCH_COUNT);
assert.equal(healthyMetric.aggregateStatistic, "median-batch-p95");
assert.equal(healthyMetric.p95Ms, 10);
assert.equal(healthyMetric.overBudgetBatchCount, 0);
assert.equal(healthyMetric.passed, true);

const isolatedOverage = measuredMetric([9, 13, 10], 12);
assert.equal(isolatedOverage.p95Ms, 10);
assert.equal(isolatedOverage.overBudgetBatchCount, 1);
assert.equal(isolatedOverage.passed, true);

const reproducibleOverage = measuredMetric([13, 14, 15], 12);
assert.equal(reproducibleOverage.p95Ms, 14);
assert.equal(reproducibleOverage.overBudgetBatchCount, 3);
assert.equal(reproducibleOverage.passed, false);

const clearlySlower = measuredMetric([30, 31, 32], 12);
assert.equal(clearlySlower.passed, false);
assert.match(clearlySlower.reason, /median exceeded budget/);

assert.throws(() => measuredMetric([9, 10], 12), /exactly 3 batches/);
assert.throws(() => aggregatePerformanceMetric({
  batches: [{ count: TIMED_ITERATIONS, meanMs: 1, p50Ms: 1, p95Ms: Number.NaN, maxMs: 1 }, ...healthyMetric.batches.slice(0, 2)],
}, 12), /invalid p95Ms/);
assert.equal(readPerformanceMetricP95({ p95Ms: 11 }), 11, "legacy baseline reports must remain readable");

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

const repeatedStrictBudgetOnly = classifyRuns(
  repeatedRuns("desktop/DPR1/angle/720 simulation p95"),
  cleanRuns(),
);
assert.equal(repeatedStrictBudgetOnly.classification, "local-performance-regression");
assert.equal(repeatedStrictBudgetOnly.hostedCiRequired, false);
assert.notEqual(repeatedStrictBudgetOnly.classification, "hosted-ci-hold");

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
  performanceMetricVersion: PERFORMANCE_METRIC_VERSION,
  budgets: { simulationP95Ms: 12, normalFrameP95Ms: 30, highLoadFrameP95Ms: 50 },
  simulationResults: [{
    viewport: { name: "desktop" },
    deviceScaleFactor: 1,
    scenarios: [{
      vertices: 3,
      angle: { simulation: measuredMetric([10, 11, 11], 12) },
      infiniteAngle: { simulation: measuredMetric([12, 12.5, 12], 12) },
    }],
  }],
  renderResults: [{
    viewport: { name: "desktop" },
    deviceScaleFactor: 1,
    scenarios: [{
      vertices: 3,
      angle: { frame: measuredMetric([20, 21, 22], 30) },
      infiniteAngle: { frame: measuredMetric([31, 32, 33], 50) },
    }],
  }],
});
assert.deepEqual(timingMeasurements, [
  { scenario: "desktop/DPR1/angle/3", metric: "simulation", p95Ms: 11, budgetMs: 12 },
  { scenario: "desktop/DPR1/infinite-angle/3", metric: "simulation", p95Ms: 12, budgetMs: 12 },
  { scenario: "desktop/DPR1/angle/3", metric: "frame", p95Ms: 21, budgetMs: 30 },
  { scenario: "desktop/DPR1/infinite-angle/3", metric: "frame", p95Ms: 32, budgetMs: 50 },
]);

assert.throws(() => collectTimingMeasurements({
  performanceMetricVersion: PERFORMANCE_METRIC_VERSION,
  budgets: { simulationP95Ms: 12, normalFrameP95Ms: 30, highLoadFrameP95Ms: 50 },
  simulationResults: [{
    viewport: { name: "desktop" },
    deviceScaleFactor: 1,
    scenarios: [{
      vertices: 3,
      angle: { simulation: { metricVersion: PERFORMANCE_METRIC_VERSION, budgetMs: 12, batches: healthyMetric.batches.slice(0, 2) } },
    }],
  }],
  renderResults: [],
}), /exactly 3 batches/);

assert.throws(() => collectTimingMeasurements({
  performanceMetricVersion: PERFORMANCE_METRIC_VERSION,
  budgets: { simulationP95Ms: 12, normalFrameP95Ms: 30, highLoadFrameP95Ms: 50 },
  simulationResults: [{
    viewport: { name: "desktop" },
    deviceScaleFactor: 1,
    scenarios: [{
      vertices: 3,
      angle: { simulation: measuredMetric([10, 10, 10], 30) },
    }],
  }],
  renderResults: [],
}), /budget does not match/);

console.log("local performance gate classifier checks passed");
