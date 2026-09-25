const assert = require("node:assert/strict");
const {
  BASELINE_ID,
  PROBES,
  createSensitivityReport,
  STAGE_1_OPTIONS,
} = require("../scripts/simulate-tc4-balance-sensitivity.js");
const { nextSearchRecommendation } = require("../scripts/simulate-tc4-balance.js");

function comparison(candidate, highestMilestoneIndex, peakScoreLog10, timeToHighestMilestone) {
  return {
    candidate,
    candidateId: candidate.id,
    classification: "failed",
    bestAdaptive: {
      highestMilestoneIndex,
      highestMilestone: [900, 1700, 2500][highestMilestoneIndex] ?? null,
      peakScoreLog10,
      timeToHighestMilestone,
    },
  };
}

function assertMeasuredRecommendation() {
  const baseline = { id: BASELINE_ID, a: 0.25, b: 0.35, c: 1 };
  const aWinner = { id: "A0.40-B0.35-C1", a: 0.40, b: 0.35, c: 1 };
  const bEdge = { id: "A0.25-B1.00-C1", a: 0.25, b: 1.00, c: 1 };
  const comparisons = [
    comparison(baseline, 1, 1814, 1000),
    comparison(aWinner, 2, 1816, 800),
    comparison(bEdge, 1, 1814.2, 990),
  ];
  const recommendation = nextSearchRecommendation(comparisons, {
    allowInconclusive: true,
    marginalEvidence: {
      groups: [
        {
          axis: "A-only",
          bestHighestMilestoneDelta: 1,
          bestPeakDeltaLog10: 2,
          bestTimeGainRatio: 0.2,
        },
        {
          axis: "B-only",
          bestHighestMilestoneDelta: 0,
          bestPeakDeltaLog10: 0.2,
          bestTimeGainRatio: 0.01,
        },
      ],
    },
  });
  assert.equal(recommendation.direction, "increase A");
  assert.notEqual(recommendation.direction, "increase B");
  assert.equal(
    nextSearchRecommendation(comparisons, { allowInconclusive: true }).status,
    "revisit-functional-form",
    "max-A position without measured marginal evidence must not select an axis",
  );
}

async function runTc4BalanceSensitivityTest() {
  assertMeasuredRecommendation();
  const tiny = {
    maxSeconds: 5,
    stepSeconds: 1,
    maxStates: 1,
    maxRoutes: 1,
    stallSeconds: 5,
    policyIds: [...STAGE_1_OPTIONS.policyIds],
    searchComplete: false,
  };
  const first = await createSensitivityReport({ stage1: tiny, stage2: tiny, stage3: tiny });
  const second = await createSensitivityReport({ stage1: tiny, stage2: tiny, stage3: tiny });
  assert.deepEqual(first, second, "sensitivity probe output must be deterministic");
  assert.equal(first.issue, 119);
  assert.equal(first.researchOnly, true);
  assert.deepEqual(first.probeDesign.map(({ id }) => id), PROBES.map(({ id }) => id));
  const stage1Options = first.stages.stage1.candidates.map(({ searchOptions }) => JSON.stringify(searchOptions));
  assert.ok(stage1Options.every((options) => options === stage1Options[0]), "Stage 1 options must be identical");
  assert.equal(first.baseline.candidateId, BASELINE_ID);
  assert.ok(first.sensitivity.rows.some(({ axis }) => axis === "A-only"));
  assert.ok(first.uncertainty.length > 0);
  assert.equal(first.noProductionChanges, true);
}

if (require.main === module) {
  runTc4BalanceSensitivityTest()
    .then(() => console.log("TC4 balance sensitivity tests passed"))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}

module.exports = { runTc4BalanceSensitivityTest };
