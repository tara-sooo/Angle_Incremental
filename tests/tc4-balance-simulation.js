const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  CANDIDATE_A,
  CANDIDATE_GRID,
  CORE_BOOST_SOURCE_USE_MANIFEST,
  RESET_POLICIES,
  TC4_SCORE_MILESTONES,
  candidateClassification,
  createReport,
} = require("../scripts/simulate-tc4-balance.js");

const POLICY_IDS = [
  "fixed-60",
  "fixed-120",
  "fixed-300",
  "fixed-600",
  "fixed-1800",
  "gain-aware-2x",
  "threshold-aware",
];
const EVALUATED_POLICY_IDS = ["fixed-60", "gain-aware-2x", "threshold-aware"];

async function runTc4BalanceSimulationTest() {
  const options = {
    maxSeconds: 20,
    stepSeconds: 1,
    maxStates: 2,
    maxRoutes: 2,
    targetLog10: 7777,
    stallSeconds: 20,
    secondaryMaxSeconds: 5,
    secondaryMaxStates: 1,
    secondaryMaxRoutes: 1,
    secondarySearchComplete: false,
  };
  const first = await createReport(options);
  const second = await createReport(options);
  assert.deepEqual(first, second, "TC4 simulation output must be deterministic");
  assert.equal(first.issue, 114);
  assert.equal(first.sourceIssue, 106);
  assert.equal(first.strategySourceIssue, 112);
  assert.equal(first.researchOnly, true);
  assert.deepEqual(first.resetPolicies.map((policy) => policy.id), POLICY_IDS);
  assert.equal(first.resetPolicies.length, RESET_POLICIES.length);
  assert.deepEqual(first.evaluatedResetPolicies, EVALUATED_POLICY_IDS);
  assert.equal(first.resetPolicies.find((policy) => policy.id === "gain-aware-2x").minimumIpGainMultiplier, 2);
  assert.deepEqual(first.resetPolicies.find((policy) => policy.id === "threshold-aware"), {
    id: "threshold-aware",
    type: "threshold-aware",
    minimumRunSeconds: 60,
    progressWindowSeconds: 120,
    progressThresholdLog10: 1,
    lookaheadSeconds: 600,
  });
  assert.deepEqual(first.scoreMilestones, TC4_SCORE_MILESTONES);
  assert.deepEqual(first.candidateGrid, CANDIDATE_GRID);
  assert.equal(first.candidates.length, 9);
  assert.deepEqual(first.candidates.map(({ candidate }) => candidate.id), CANDIDATE_GRID.map(({ id }) => id));
  assert.deepEqual(first.candidateA.candidate, CANDIDATE_A);
  assert.equal(first.candidateComparisons.length, 9);
  assert.equal(first.ranking.adaptive.length, 9);
  assert.equal(first.ranking.fixed60.length, 9);
  assert.ok(first.candidateComparisons.every(({ policyComparisons }) => policyComparisons.length === EVALUATED_POLICY_IDS.length));
  assert.ok(first.candidates.every((candidate) => candidate.policies.every((policy) => [
    ...policy.canonical.routes,
    ...policy.allLegal.routes,
  ].every((route) => route.milestoneTimes && route.milestoneSnapshots))));
  assert.equal(first.candidateA.fixture.towerFloor, 12);
  assert.equal(first.candidateA.fixture.completedTowerChallenges & 0b111, 0b111);
  assert.equal(first.candidateA.fixture.activeTowerChallenge, 4);
  assert.equal(first.candidateA.fixture.iaPurchaseCount, 3);
  assert.equal(first.candidateA.collision.matchesProduction, true);
  assert.equal(first.candidateA.collision.includesDocumentedRange, true);
  assert.ok(first.candidateA.canonical.summary.exploredStates > 0);
  assert.ok(first.candidateA.allLegal.summary.exploredStates > 0);
  assert.ok(first.candidateAComparability.optionsMatch === false);
  assert.equal(first.coreBoostAudit.length, CORE_BOOST_SOURCE_USE_MANIFEST.length);
  assert.ok(first.coreBoostAudit.some((entry) => entry.classification === "benefit"));
  assert.ok(first.coreBoostAudit.some((entry) => entry.classification === "requirement/reset/history"));
  assert.equal(first.nextSearchRecommendation.status, "inconclusive");

  const truncatedPolicy = RESET_POLICIES.map((policy) => ({
    policy,
    canonical: { summary: { allCanonicalSuccessful: false, medianToBest: null, worstToBest: null, strategicDegenerate: false, truncated: true } },
    allLegal: { summary: { truncated: true } },
  }));
  assert.equal(candidateClassification({ policies: truncatedPolicy }), "inconclusive");

  const committedReport = JSON.parse(fs.readFileSync("reports/tc4-balance-sweep.json", "utf8"));
  assert.equal(committedReport.issue, 114);
  assert.equal(committedReport.candidateGrid.length, 9);
  assert.deepEqual(committedReport.evaluatedResetPolicies, EVALUATED_POLICY_IDS);
  assert.equal(committedReport.candidateAComparability.withinTolerance, true);
  assert.ok(Object.values(committedReport.candidateClassifications).includes("inconclusive"));
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
