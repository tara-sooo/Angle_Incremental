const assert = require("node:assert/strict");
const {
  CORE_BOOST_SOURCE_USE_MANIFEST,
  RESET_POLICIES,
  createReport,
} = require("../scripts/simulate-tc4-balance.js");

async function runTc4BalanceSimulationTest() {
  const options = {
    maxSeconds: 30,
    stepSeconds: 1,
    maxStates: 20,
    maxRoutes: 10,
    targetLog10: 7777,
    stallSeconds: 20,
  };
  const first = await createReport(options);
  const second = await createReport(options);
  assert.deepEqual(first, second, "TC4 simulation output must be deterministic");
  assert.equal(first.issue, 112);
  assert.equal(first.sourceIssue, 106);
  assert.equal(first.researchOnly, true);
  assert.deepEqual(first.resetPolicies.map((policy) => policy.id), [
    "fixed-60",
    "fixed-120",
    "fixed-300",
    "fixed-600",
    "fixed-1800",
    "gain-aware-2x",
    "threshold-aware",
  ]);
  assert.equal(first.resetPolicies.length, RESET_POLICIES.length);
  assert.equal(first.resetPolicies.find((policy) => policy.id === "gain-aware-2x").minimumIpGainMultiplier, 2);
  assert.deepEqual(first.resetPolicies.find((policy) => policy.id === "threshold-aware"), {
    id: "threshold-aware",
    type: "threshold-aware",
    minimumRunSeconds: 60,
    progressWindowSeconds: 120,
    progressThresholdLog10: 1,
    lookaheadSeconds: 600,
  });
  assert.equal(first.candidateA.fixture.towerFloor, 12);
  assert.equal(first.candidateA.fixture.completedTowerChallenges & 0b111, 0b111);
  assert.equal(first.candidateA.fixture.activeTowerChallenge, 4);
  assert.equal(first.candidateA.fixture.iaPurchaseCount, 3);
  assert.equal(first.candidateA.collision.matchesProduction, true);
  assert.equal(first.candidateA.collision.includesDocumentedRange, true);
  assert.ok(first.candidateA.canonical.summary.exploredStates > 0);
  assert.ok(first.candidateA.allLegal.summary.exploredStates > 0);
  assert.equal(first.candidateA.policies.length, RESET_POLICIES.length);
  assert.ok(first.policyComparisons.every((comparison) => comparison.canonical && comparison.allLegal));
  assert.equal(first.baselineComparison.baselinePolicy, "fixed-60");
  const fixed60 = first.candidateA.policies.find(({ policy }) => policy.id === "fixed-60");
  assert.deepEqual(fixed60.canonical, first.candidateA.canonical, "fixed-60 remains the Issue #106 baseline");
  assert.ok(first.candidateA.canonical.routes.some((route) => route.reason === "stalled" || route.reason === "horizon reached"));
  for (const kind of ["baseGain", "infinityScoreVertexGain", "freeCoreBoost"]) {
    assert.equal(first.familyUsefulness[kind].reachable, true, `${kind} must be reachable in the explored routes`);
    assert.equal(first.familyUsefulness[kind].measurableEffect, true, `${kind} must expose a measurable candidate effect`);
  }
  assert.equal(first.coreBoostAudit.length, CORE_BOOST_SOURCE_USE_MANIFEST.length);
  assert.ok(first.coreBoostAudit.some((entry) => entry.classification === "benefit"));
  assert.ok(first.coreBoostAudit.some((entry) => entry.classification === "requirement/reset/history"));
  assert.equal(first.sweep.length, 0);

  const bounded = await createReport({
    maxSeconds: 1,
    stepSeconds: 1,
    maxStates: 1,
    maxRoutes: 1,
    targetLog10: 7777,
    stallSeconds: 1,
  });
  assert.equal(bounded.sweep.length, 0, "policy comparison replaces the old candidate neighborhood sweep");
  assert.equal(bounded.policyComparisons.length, RESET_POLICIES.length);

  const timing = await createReport({
    maxSeconds: 180,
    stepSeconds: 10,
    maxStates: 20,
    maxRoutes: 3,
    targetLog10: 7777,
    stallSeconds: 180,
  });
  const resetTimes = (id) => timing.candidateA.policies
    .find(({ policy }) => policy.id === id)
    .canonical.routes
    .flatMap((route) => route.infinityResetTimes);
  assert.ok(resetTimes("fixed-60").includes(60));
  assert.ok(resetTimes("fixed-120").includes(120));
  assert.ok(!resetTimes("fixed-120").includes(60));
  assert.ok(!resetTimes("fixed-300").includes(60));
  assert.ok(resetTimes("gain-aware-2x").includes(60));
}

if (require.main === module) {
  runTc4BalanceSimulationTest()
    .then(() => console.log("TC4 balance simulation tests passed"))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}

module.exports = { runTc4BalanceSimulationTest };
