const assert = require("node:assert/strict");
const {
  CORE_BOOST_SOURCE_USE_MANIFEST,
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
    noSweep: true,
  };
  const first = await createReport(options);
  const second = await createReport(options);
  assert.deepEqual(first, second, "TC4 simulation output must be deterministic");
  assert.equal(first.researchOnly, true);
  assert.equal(first.candidateA.fixture.towerFloor, 12);
  assert.equal(first.candidateA.fixture.completedTowerChallenges & 0b111, 0b111);
  assert.equal(first.candidateA.fixture.activeTowerChallenge, 4);
  assert.equal(first.candidateA.fixture.iaPurchaseCount, 3);
  assert.equal(first.candidateA.collision.matchesProduction, true);
  assert.equal(first.candidateA.collision.includesDocumentedRange, true);
  assert.ok(first.candidateA.canonical.summary.exploredStates > 0);
  assert.ok(first.candidateA.allLegal.summary.exploredStates > 0);
  assert.ok(first.candidateA.canonical.routes.some((route) => route.reason === "stalled" || route.reason === "horizon reached"));
  for (const kind of ["baseGain", "infinityScoreVertexGain", "freeCoreBoost"]) {
    assert.equal(first.familyUsefulness[kind].reachable, true, `${kind} must be reachable in the explored routes`);
    assert.equal(first.familyUsefulness[kind].measurableEffect, true, `${kind} must expose a measurable candidate effect`);
  }
  assert.equal(first.coreBoostAudit.length, CORE_BOOST_SOURCE_USE_MANIFEST.length);
  assert.ok(first.coreBoostAudit.some((entry) => entry.classification === "benefit"));
  assert.ok(first.coreBoostAudit.some((entry) => entry.classification === "requirement/reset/history"));
  assert.equal(first.sweep.length, 0);

  const sweep = await createReport({
    maxSeconds: 1,
    stepSeconds: 1,
    maxStates: 1,
    maxRoutes: 1,
    targetLog10: 7777,
    stallSeconds: 1,
  });
  assert.equal(sweep.sweep.length, 9, "a failed primary candidate must evaluate the full 3x3 neighborhood");
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
