const assert = require("node:assert/strict");
const {
  FOLLOWUP_CANDIDATES,
  STAGE_1_OPTIONS,
  createFollowupReport,
  selectLeader,
} = require("../scripts/simulate-tc4-balance-followup.js");

async function runTc4BalanceFollowupTest() {
  const tiny = {
    maxSeconds: 20,
    stepSeconds: 1,
    maxStates: 2,
    maxRoutes: 2,
    stallSeconds: 20,
    policyIds: [...STAGE_1_OPTIONS.policyIds],
    searchComplete: false,
  };
  const first = await createFollowupReport({ baseline: tiny, stage1: tiny, stage2: tiny, stage3: tiny });
  const second = await createFollowupReport({ baseline: tiny, stage1: tiny, stage2: tiny, stage3: tiny });

  assert.deepEqual(first, second, "follow-up simulation output must be deterministic");
  assert.equal(first.issue, 117);
  assert.equal(first.researchOnly, true);
  assert.deepEqual(first.candidateGrid.map(({ id }) => id), FOLLOWUP_CANDIDATES.map(({ id }) => id));
  assert.equal(first.stages.stage1.candidates.length, FOLLOWUP_CANDIDATES.length);
  assert.ok(first.stages.stage1.candidates.every(({ searchOptions }) =>
    JSON.stringify(searchOptions) === JSON.stringify(first.stages.stage1.candidates[0].searchOptions)));
  assert.ok(first.stages.stage1.candidates.every(({ promotionReasons }) =>
    promotionReasons.includes("stage-1-truncated-or-inconclusive")));
  assert.equal(first.stages.stage2.promotedCandidateIds.length, FOLLOWUP_CANDIDATES.length);
  assert.equal(first.stages.stage3.finalistId, selectLeader(first.stages.stage2.candidates).candidateId);
  assert.equal(first.ranking.adaptive[0], selectLeader(first.candidates).candidateId);
  assert.ok(first.candidates.every(({ milestoneRows }) => milestoneRows.length === first.scoreMilestones.length));
  assert.ok(first.candidates.every(({ bestAdaptive }) =>
    Object.hasOwn(bestAdaptive.firstMilestoneSnapshots, "e900")));
  assert.ok(first.candidates.every(({ classification }) => classification === "inconclusive"));
  assert.match(first.nextSearchRecommendation.status, /inconclusive|bounded-recommendation|not-needed/);
  assert.match(first.candidateA.comparabilityWithIssue112.referenceReport, /reports\/tc4-balance-candidate-a\.json/);
}

if (require.main === module) {
  runTc4BalanceFollowupTest()
    .then(() => console.log("TC4 balance follow-up tests passed"))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}

module.exports = { runTc4BalanceFollowupTest };
