const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  FRONTIER_CANDIDATE_IDS,
  createFrontierVerificationReport,
  runFrontierCases,
} = require("../scripts/simulate-tc4-a-form-frontier.js");
const { EVALUATED_POLICY_IDS } = require("../scripts/simulate-tc4-a-form-search.js");

const TINY_OPTIONS = Object.freeze({
  maxSeconds: 120,
  stepSeconds: 10,
  maxStates: 1,
  continuationMaxStates: 2,
  maxRoutes: 3,
  stallSeconds: 60,
});

async function main() {
  const checkpointDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "tc4-a-frontier-"));
  const checkpointPath = path.join(checkpointDirectory, "checkpoint.json");
  try {
    const partial = await runFrontierCases(TINY_OPTIONS, { checkpointPath, maxNewCases: 1 });
    assert.equal(partial.complete, false);
    assert.equal(partial.completedCaseKeys.length, 1);
    assert.equal(fs.existsSync(checkpointPath), true);

    const resumed = await runFrontierCases(TINY_OPTIONS, { checkpointPath });
    assert.equal(resumed.complete, true);
    assert.equal(resumed.completedCaseKeys.length, FRONTIER_CANDIDATE_IDS.length * EVALUATED_POLICY_IDS.length);

    const first = await createFrontierVerificationReport(TINY_OPTIONS, { checkpointPath });
    const second = await createFrontierVerificationReport(TINY_OPTIONS, { checkpointPath });
    const direct = await createFrontierVerificationReport({
      ...TINY_OPTIONS,
      maxStates: TINY_OPTIONS.continuationMaxStates,
      continuationMaxStates: null,
    });
    assert.deepEqual(first.candidates, second.candidates, "frontier verification must be deterministic");
    assert.deepEqual(first.candidates.map(({ candidateId }) => candidateId), FRONTIER_CANDIDATE_IDS);
    assert.deepEqual(first.options.policyIds, EVALUATED_POLICY_IDS);
    assert.equal(first.options.seedMaxStates, TINY_OPTIONS.maxStates);
    assert.equal(first.options.continuationMaxStates, TINY_OPTIONS.continuationMaxStates);
    assert.equal(first.noProductionChanges, true);
    assert.equal(first.execution.completedCaseCount, 9);
    assert.deepEqual(first.candidateDefinitions.map(({ id }) => id), [
      "flat-A1.00-B0.35-C1",
      "log-A1.00-B0.35-C1",
      "flat-A2.00",
    ]);

    first.candidates.forEach((candidate) => {
      assert.equal(candidate.frontierSearch.length, EVALUATED_POLICY_IDS.length);
      const times = candidate.bestAdaptive.firstMilestoneTimes;
      [1700, 2500, 2900, 3300, 4100, 4900, 5300, 5700, 6500, 7300, 7700, 7777]
        .forEach((milestone) => assert.ok(Object.hasOwn(times, "e" + milestone)));
      candidate.frontierSearch.forEach((policy) => {
        assert.equal(policy.canonical.seed.truncationReason, "state-cap");
        assert.equal(policy.canonical.seed.exploredStates, TINY_OPTIONS.maxStates);
        assert.equal(policy.canonical.continuation.exploredStates, TINY_OPTIONS.continuationMaxStates);
        assert.ok(policy.canonical.seed.frontierCount > 0);
        assert.ok(policy.canonical.continuation.frontierCount > 0);
        assert.equal(policy.allLegal.seed.truncationReason, "state-cap");
      });
    });
    first.candidates.forEach((candidate, candidateIndex) => {
      candidate.frontierSearch.forEach((policy, policyIndex) => {
        const directPolicy = direct.candidates[candidateIndex].frontierSearch[policyIndex];
        assert.deepEqual(policy.canonical.continuation, directPolicy.canonical.continuation);
        assert.deepEqual(policy.allLegal.continuation, directPolicy.allLegal.continuation);
      });
    });
    assert.ok([
      "production decision supportable",
      "one narrow refinement",
      "A-only insufficient",
      "still search-inconclusive",
    ].includes(first.outcome.status));
    console.log("TC4 A-form frontier verification tests passed");
  } finally {
    fs.rmSync(checkpointDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
