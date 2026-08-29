const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");
const {
  CANDIDATES,
  CHECKPOINT_DEFINITIONS,
  CURVE_SAMPLE_SECONDS,
  REPRESENTATIVE_FIXTURE,
  applyRepresentativeFixture,
  cloneState,
  createCheckpointFixtures,
  createParallelCurve,
  createReport,
  formatMarkdown,
  installResearchEffect,
  parallelMultiplierLog10,
  realMultiplierLog10,
} = require("../scripts/simulate-ic8-eternity-progression.js");

const RUNTIME_PATH = path.resolve(__dirname, "..", "src", "main.js");
const REPORT_PATH = path.resolve(__dirname, "..", "reports", "ic8-eternity-progression.json");
const MARKDOWN_PATH = path.resolve(__dirname, "..", "reports", "ic8-eternity-progression.md");

async function testResearchBoundaryFeedback() {
  const instance = await loadRuntime(RUNTIME_PATH);
  const { runtime, debug } = instance;
  runtime.updateUi = () => {};
  runtime.saveGame = () => true;
  runtime.createCheckpoint = () => true;
  debug.state.infinityCount = 1;
  debug.state.scoreLog10 = 310;
  debug.state.score = Number.MAX_VALUE;
  runtime.syncInfinityPointCachesFromExact(100n);
  const baselineGain = runtime.infinityPointGain();
  const clock = { nowSeconds: 0, ic8ClearAtSeconds: null };
  const restore = installResearchEffect(runtime, CANDIDATES[1], clock);
  assert.equal(runtime.infinityPointGain(), 9);
  debug.runInfinity(false);
  assert.equal(runtime.currentExactInfinityPoints(), 109n);
  restore();
  assert.equal(baselineGain, 3);

  const parallelClock = { nowSeconds: 2, ic8ClearAtSeconds: 0 };
  const parallelRestore = installResearchEffect(runtime, CANDIDATES[2], parallelClock);
  debug.state.scoreLog10 = 310;
  debug.state.infinityCount = 1;
  runtime.syncInfinityPointCachesFromExact(100n);
  assert.equal(runtime.infinityPointGain(), 27);
  parallelRestore();
}

function testCurve() {
  assert.equal(realMultiplierLog10(-Infinity), 0);
  assert.equal(realMultiplierLog10(0), 0);
  assert.equal(realMultiplierLog10(2), Math.log10(3));
  assert.equal(parallelMultiplierLog10(0, 0.5), 0);
  assert.equal(parallelMultiplierLog10(10 / Math.log10(3), 0.5), 10);
  assert.equal(parallelMultiplierLog10(20 / Math.log10(3), 0.5), 15);
  const curve = createParallelCurve();
  assert.deepEqual(
    curve.samples.map(({ elapsedSeconds }) => elapsedSeconds),
    [...CURVE_SAMPLE_SECONDS],
  );
  const cap = curve.samples.find(({ elapsedLabel }) => elapsedLabel.includes("raw x1e10"));
  assert.equal(cap.rawMultiplierLog10, 10);
  assert.equal(cap.candidates["parallel-bc16500-root"].effectiveMultiplierLog10, 10);
  assert.equal(cap.candidates["parallel-bc16500-fourth-root"].effectiveMultiplierLog10, 10);
  const hour = curve.samples.find(({ elapsedSeconds }) => elapsedSeconds === 3600);
  assert.ok(
    hour.candidates["parallel-bc16500-root"].effectiveMultiplierLog10
      > hour.candidates["parallel-bc16500-fourth-root"].effectiveMultiplierLog10,
  );
}

async function runIc8EternityProgressionSimulationTest() {
  testCurve();
  const fixture = await createCheckpointFixtures();
  assert.equal(fixture.checkpoints.length, 7);
  assert.equal(fixture.checkpoints[0].id, CHECKPOINT_DEFINITIONS[0].id);
  assert.equal(fixture.checkpoints[0].state.eternityCount, 1);
  assert.equal(fixture.checkpoints[0].state.eternityMilestoneMask, 2);
  assert.equal(fixture.checkpoints[0].state.completedChallenges, 255);
  assert.equal(fixture.checkpoints[0].state.achievementMask, 0x7fffffff);
  assert.equal(fixture.checkpoints[0].state.achievementMaskHigh, 0x3ff);
  assert.equal(fixture.checkpoints[0].state.timeFlux, 0);
  assert.equal(fixture.checkpoints[0].state.infinityPointsExact, "100000");
  assert.equal(fixture.checkpoints[0].state.infinityCount, 10000);
  assert.deepEqual(fixture.checkpoints[0].ownedInfinityUpgradeIds.slice(-2), ["11-1", "11-2"]);
  assert.equal(fixture.checkpoints[0].nextLocalGate.id, "infinite-angle-unlock");
  assert.equal(fixture.checkpoints[1].nextLocalGate.id, "tower-floor-1");
  assert.equal(fixture.checkpoints[2].nextLocalGate.id, "tc1");
  assert.equal(fixture.checkpoints[3].nextLocalGate.id, "tc2");
  assert.equal(fixture.checkpoints[4].nextLocalGate.id, "tc3");
  assert.equal(fixture.checkpoints[5].nextLocalGate.id, "tc4");
  assert.equal(fixture.checkpoints[6].predicates.canEternity, true);
  assert.equal(fixture.checkpoints[4].infinityCount, 10000);
  assert.equal(fixture.checkpoints[4].consistency.tc3EntryWithout600000, true);
  fixture.checkpoints.forEach((checkpoint) => {
    assert.equal(checkpoint.consistency.status, "passed");
    assert.equal(checkpoint.stateDigest, checkpoint.consistency.stateDigest);
  });

  const cloneA = cloneState(fixture.checkpoints[0].state);
  const cloneB = cloneState(fixture.checkpoints[0].state);
  cloneA.infinityCount += 1;
  cloneA.fastestTowerChallengeTimes[0] = 99;
  assert.equal(cloneB.infinityCount, 10000);
  assert.equal(cloneB.fastestTowerChallengeTimes[0], 0);

  const first = await createReport({ writeReports: false });
  const second = await createReport({ writeReports: false });
  assert.equal(JSON.stringify(first), JSON.stringify(second), "checkpoint output must be deterministic");
  assert.equal(first.issue, 237);
  assert.equal(first.schemaVersion, 6);
  assert.equal(first.researchOnly, true);
  assert.equal(first.noProductionChanges, true);
  assert.equal(first.studyType, "representative-post-IC8-checkpoint-study");
  assert.equal(first.outcome.status, "measured");
  assert.equal(first.validation.status, "passed");
  assert.equal(first.checkpoints.length, 7);
  assert.equal(first.cases.length, 28);
  assert.deepEqual(first.researchEffects.map(({ id }) => id), CANDIDATES.map(({ id }) => id));
  assert.equal(first.productionPredicates.towerChallengeTargets[3].targetLog10, 7777);
  assert.equal(first.productionPredicates.tc3RelaxationReferenceCount, 600000);
  assert.match(first.productionPredicates.tc3EntryRule, /no Infinity-count prerequisite/);
  assert.equal(first.excludedEvidence.balanceConclusionEligible, false);
  assert.equal(first.interpretation.leastDisruptiveMeasuredCandidate, "real-bc16500");
  assert.equal(first.interpretation.scoreGateCollapseCounts.root, 4);
  assert.equal(first.interpretation.scoreGateCollapseCounts.fourthRoot, 4);
  assert.equal(first.interpretation.productionDecision, "none");
  first.cases.forEach((entry) => {
    assert.equal(entry.status, "measured");
    assert.equal(entry.initialStateDigest, entry.checkpointStateDigest);
    assert.equal(entry.finalStateDigest, entry.initialStateDigest);
    assert.equal(entry.effectIsolation, true);
    assert.equal(entry.probes.length, 2);
  });
  const postIc8Root = first.cases.find((entry) => (
    entry.checkpointId === "post-ic8-pre-ia"
      && entry.candidateId === "parallel-bc16500-root"
  ));
  assert.equal(postIc8Root.collapseRisk, "candidate-skips-next-IP-gate");
  assert.equal(postIc8Root.probes.at(-1).nextGateCovered, true);
  const tc1Root = first.cases.find((entry) => (
    entry.checkpointId === "early-tower-tc1"
      && entry.candidateId === "parallel-bc16500-root"
  ));
  assert.equal(tc1Root.collapseRisk, "final-IP-cap-before-score-gate");

  const markdown = formatMarkdown(first);
  assert.match(markdown, /checkpoint study/);
  assert.match(markdown, /raw x1e10/);
  assert.match(markdown, /tc3-era/);
  assert.match(markdown, /600000/);
  assert.match(markdown, /excluded from balance conclusions/);
  assert.match(markdown, /least disruptive measured reference/);
  const candidateRows = markdown.split("\n").filter((line) => (
    line.startsWith("| ")
      && CANDIDATES.some(({ id }) => line.includes("| " + id + " |"))
  ));
  assert.equal(candidateRows.length, 28, "Markdown must contain every JSON case");

  const committed = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
  assert.equal(committed.issue, 237);
  assert.equal(committed.schemaVersion, 6);
  assert.equal(committed.validation.status, "passed");
  assert.equal(committed.outcome.status, "measured");
  assert.equal(committed.checkpoints.length, 7);
  assert.equal(committed.cases.length, 28);
  assert.equal(committed.checkpoints.find(({ id }) => id === "tc3-era").consistency.tc3EntryWithout600000, true);
  assert.match(fs.readFileSync(MARKDOWN_PATH, "utf8"), /No production Timeline formula/);

  await testResearchBoundaryFeedback();

  const representativeInstance = await loadRuntime(RUNTIME_PATH);
  const representativeState = applyRepresentativeFixture(representativeInstance);
  assert.equal(representativeState.infinityPointsExact, "100000");
  assert.equal(representativeState.eternityMilestoneMask, REPRESENTATIVE_FIXTURE.state.eternityMilestoneMask);
  assert.equal(representativeState.completedChallenges, REPRESENTATIVE_FIXTURE.state.completedChallenges);
}

if (require.main === module) {
  runIc8EternityProgressionSimulationTest()
    .then(() => console.log("IC8 checkpoint research tests passed"))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}

module.exports = { runIc8EternityProgressionSimulationTest };
