const assert = require("node:assert/strict");
const {
  BASELINE_ID,
  FRESHNESS_VERIFICATION,
  PROBES,
  createASearchReport,
} = require("../scripts/simulate-tc4-balance-a-search.js");

const TINY_OPTIONS = Object.freeze({
  maxSeconds: 120,
  stepSeconds: 10,
  maxStates: 2,
  maxRoutes: 2,
  stallSeconds: 120,
  policyIds: ["fixed-60", "gain-aware-2x", "threshold-aware"],
  searchComplete: true,
});

async function runTc4ABalanceSearchTest() {
  const first = await createASearchReport({
    stage1: TINY_OPTIONS,
    stage2: TINY_OPTIONS,
    stage3: TINY_OPTIONS,
  });
  const second = await createASearchReport({
    stage1: TINY_OPTIONS,
    stage2: TINY_OPTIONS,
    stage3: TINY_OPTIONS,
  });

  assert.deepEqual(first, second, "A-search output must be deterministic");
  assert.deepEqual(first.probeDesign.map(({ id }) => id), [
    "A0.40-B0.35-C1",
    "A0.50-B0.35-C1",
    "A0.60-B0.35-C1",
    "A0.80-B0.35-C1",
    "A1.00-B0.35-C1",
  ]);
  assert.equal(first.baseline.candidateId, BASELINE_ID);
  assert.equal(first.probeDesign.every(({ b, c }) => b === 0.35 && c === 1), true);
  assert.equal(first.stages.stage1.candidates.length, PROBES.length);
  const stage1Options = first.stages.stage1.candidates.map(({ searchOptions }) => JSON.stringify(searchOptions));
  assert.ok(stage1Options.every((options) => options === stage1Options[0]), "Stage 1 options must match");
  assert.ok(first.stages.stage2.promotedCandidateIds.length >= 1);
  assert.ok(first.stages.stage2.promotedCandidateIds.length < PROBES.length, "the full set must not be auto-promoted");
  assert.ok(first.candidates.every(({ stage1 }) => stage1), "unpromoted Stage 1 evidence must be retained");
  assert.equal(first.noProductionChanges, true);
  assert.equal(first.freshnessVerification.verifiedCommit, FRESHNESS_VERIFICATION.verifiedCommit);
  assert.deepEqual(first.freshnessVerification.observations.map(({ candidateId }) => candidateId), [
    "A0.40-B0.35-C1",
    "A1.00-B0.35-C1",
  ]);
  assert.equal(first.freshnessVerification.observations.every(({ currentHighestMilestone }) => currentHighestMilestone === 1700), true);
  assert.match(require("../scripts/simulate-tc4-balance-a-search.js").formatMarkdown(first), /Freshness after #128 \/ PR #130/);
  assert.ok(first.sensitivity.marginal.every(({ deltaA }) => deltaA > 0), "marginal rows must be numeric A order");
  assert.equal(typeof first.anyReachedE2500, "boolean");
  assert.equal(typeof first.anyReachedE7777, "boolean");
  assert.ok(first.recommendation.status.length > 0);
  return first;
}

if (require.main === module) {
  runTc4ABalanceSearchTest()
    .then(() => console.log("TC4 A-focused balance search tests passed"))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}

module.exports = { runTc4ABalanceSearchTest };
