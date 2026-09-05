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
  parallelLogarithmicMultiplierLog10,
  parallelMultiplierLog10,
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
  assert.equal(runtime.infinityPointGain(), 3, "superseded Real research must not change IP gain");
  debug.runInfinity(false);
  assert.equal(runtime.currentExactInfinityPoints(), 103n);
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
  assert.equal(parallelMultiplierLog10(0, 0.5), 0);
  assert.equal(parallelMultiplierLog10(10 / Math.log10(3), 0.5), 10);
  assert.equal(parallelMultiplierLog10(20 / Math.log10(3), 0.5), 15);
  assert.equal(parallelLogarithmicMultiplierLog10(10 / Math.log10(3)), 10);
  assert.equal(parallelLogarithmicMultiplierLog10(20 / Math.log10(3)), 10 + 10 * Math.log10(2));
  const curve = createParallelCurve();
  const parallelCandidates = CANDIDATES.filter(({ family }) => family === "Parallel-BC16500");
  assert.deepEqual(
    curve.samples.map(({ elapsedSeconds }) => elapsedSeconds),
    [...CURVE_SAMPLE_SECONDS],
  );
  const cap = curve.samples.find(({ elapsedLabel }) => elapsedLabel.includes("raw x1e10"));
  assert.equal(cap.rawMultiplierLog10, 10);
  assert.deepEqual(Object.keys(cap.candidates), parallelCandidates.map(({ id }) => id));
  parallelCandidates.forEach(({ id }) => {
    assert.equal(cap.candidates[id].effectiveMultiplierLog10, 10);
  });
  const hour = curve.samples.find(({ elapsedSeconds }) => elapsedSeconds === 3600);
  assert.ok(
    hour.candidates["parallel-bc16500-root"].effectiveMultiplierLog10
      > hour.candidates["parallel-bc16500-fourth-root"].effectiveMultiplierLog10,
  );
  assert.ok(
    hour.candidates["parallel-bc16500-1-32"].effectiveMultiplierLog10
      > hour.candidates["parallel-bc16500-1-64"].effectiveMultiplierLog10,
  );
  const expectedSamples = {
    30: [10.13, 10.07, 11.56],
    60: [10.58, 10.29, 14.57],
    300: [14.16, 12.08, 21.56],
    600: [18.63, 14.32, 24.57],
    1800: [36.53, 23.26, 29.34],
    3600: [63.36, 36.68, 32.35],
  };
  Object.entries(expectedSamples).forEach(([elapsedSeconds, values]) => {
    const sample = curve.samples.find((entry) => entry.elapsedSeconds === Number(elapsedSeconds));
    ["parallel-bc16500-1-32", "parallel-bc16500-1-64", "parallel-bc16500-logarithmic"]
      .forEach((id, index) => {
        assert.ok(Math.abs(sample.candidates[id].effectiveMultiplierLog10 - values[index]) < 0.01, id);
      });
  });
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
  assert.equal(first.schemaVersion, 8);
  assert.equal(first.researchOnly, true);
  assert.equal(first.noProductionChanges, true);
  assert.equal(first.studyType, "representative-post-IC8-checkpoint-study");
  assert.equal(first.outcome.status, "measured");
  assert.equal(first.validation.status, "passed");
  assert.equal(first.checkpoints.length, 7);
  assert.equal(first.cases.length, 49);
  assert.deepEqual(first.options.localProbeElapsedSeconds, [...CURVE_SAMPLE_SECONDS]);
  assert.deepEqual(first.researchEffects.map(({ id }) => id), CANDIDATES.map(({ id }) => id));
  assert.equal(first.researchEffects.find(({ id }) => id === "real-bc16500").semanticStatus, "superseded");
  assert.equal(first.productionPredicates.towerChallengeTargets[3].targetLog10, 7777);
  assert.equal(first.productionPredicates.tc3RelaxationReferenceCount, 600000);
  assert.match(first.productionPredicates.tc3EntryRule, /no Infinity-count prerequisite/);
  assert.equal(first.excludedEvidence.balanceConclusionEligible, false);
  assert.equal(first.interpretation.leastDisruptiveMeasuredCandidate, null);
  assert.match(first.interpretation.realReading, /SUPERSEDED/);
  assert.equal(first.interpretation.scoreGateCollapseCounts["parallel-bc16500-root"], 4);
  assert.equal(first.interpretation.scoreGateCollapseCounts["parallel-bc16500-fourth-root"], 4);
  assert.equal(first.interpretation.scoreGateCollapseCounts["parallel-bc16500-1-32"], 0);
  assert.equal(first.interpretation.scoreGateCollapseCounts["parallel-bc16500-1-64"], 0);
  assert.equal(first.interpretation.scoreGateCollapseCounts["parallel-bc16500-logarithmic"], 0);
  assert.equal(first.interpretation.productionDecision, "none");
  first.cases.forEach((entry) => {
    assert.equal(entry.status, "measured");
    assert.equal(entry.initialStateDigest, entry.checkpointStateDigest);
    assert.equal(entry.finalStateDigest, entry.initialStateDigest);
    assert.equal(entry.effectIsolation, true);
    assert.equal(entry.probes.length, CURVE_SAMPLE_SECONDS.length);
    assert.ok(Object.prototype.hasOwnProperty.call(entry, "firstSampledCollapseOrSkip"));
  });
  const realCases = first.cases.filter(({ candidateId }) => candidateId === "real-bc16500");
  assert.equal(realCases.length, CHECKPOINT_DEFINITIONS.length);
  realCases.forEach((entry) => {
    assert.equal(entry.semanticStatus, "superseded");
    entry.probes.forEach((probe) => {
      assert.equal(probe.candidateGainLog10, probe.normalGainLog10, "superseded Real probes must preserve IP gain");
    });
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
  const postIc8OneThirtySecond = first.cases.find((entry) => (
    entry.checkpointId === "post-ic8-pre-ia"
      && entry.candidateId === "parallel-bc16500-1-32"
  ));
  assert.equal(postIc8OneThirtySecond.firstSampledCollapseOrSkip.elapsedSeconds, 10 * 60);
  const postIc8Logarithmic = first.cases.find((entry) => (
    entry.checkpointId === "post-ic8-pre-ia"
      && entry.candidateId === "parallel-bc16500-logarithmic"
  ));
  assert.equal(postIc8Logarithmic.firstSampledCollapseOrSkip.reason, "candidate-skips-next-IP-gate");
  assert.equal(postIc8Logarithmic.firstSampledCollapseOrSkip.elapsedSeconds, 60);
  const postIc8OneSixtyFourth = first.cases.find((entry) => (
    entry.checkpointId === "post-ic8-pre-ia"
      && entry.candidateId === "parallel-bc16500-1-64"
  ));
  assert.equal(postIc8OneSixtyFourth.firstSampledCollapseOrSkip.elapsedSeconds, 30 * 60);
  assert.ok(
    postIc8OneSixtyFourth.firstSampledCollapseOrSkip.elapsedSeconds
      > postIc8OneThirtySecond.firstSampledCollapseOrSkip.elapsedSeconds,
  );

  const markdown = formatMarkdown(first);
  assert.match(markdown, /checkpoint study/);
  assert.match(markdown, /raw x1e10/);
  assert.match(markdown, /tc3-era/);
  assert.match(markdown, /600000/);
  assert.match(markdown, /excluded from balance conclusions/);
  assert.match(markdown, /SUPERSEDED/);
  assert.match(markdown, /Semantic status/);
  assert.match(markdown, /1\/32/);
  assert.match(markdown, /First sampled collapse\/skip/);
  const candidateRows = markdown.split("\n").filter((line) => (
    line.startsWith("| ")
      && CHECKPOINT_DEFINITIONS.some(({ id }) => line.startsWith("| " + id + " |"))
      && CANDIDATES.some(({ id }) => line.includes("| " + id + " |"))
  ));
  assert.equal(candidateRows.length, 49, "Markdown must contain every JSON case");

  const committed = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
  assert.equal(committed.issue, 237);
  assert.equal(committed.schemaVersion, 8);
  assert.equal(committed.validation.status, "passed");
  assert.equal(committed.outcome.status, "measured");
  assert.equal(committed.checkpoints.length, 7);
  assert.equal(committed.cases.length, 49);
  assert.equal(committed.researchEffects.find(({ id }) => id === "real-bc16500").semanticStatus, "superseded");
  assert.equal(committed.interpretation.leastDisruptiveMeasuredCandidate, null);
  assert.match(committed.interpretation.realReading, /SUPERSEDED/);
  assert.equal(committed.cases.filter(({ candidateId, semanticStatus }) => (
    candidateId === "real-bc16500" && semanticStatus === "superseded"
  )).length, CHECKPOINT_DEFINITIONS.length);
  assert.deepEqual(committed.options.localProbeElapsedSeconds, [...CURVE_SAMPLE_SECONDS]);
  assert.equal(committed.checkpoints.find(({ id }) => id === "tc3-era").consistency.tc3EntryWithout600000, true);
  const committedMarkdown = fs.readFileSync(MARKDOWN_PATH, "utf8");
  assert.match(committedMarkdown, /No production Timeline formula/);
  assert.match(committedMarkdown, /SUPERSEDED/);
  assert.match(committedMarkdown, /Semantic status/);

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
