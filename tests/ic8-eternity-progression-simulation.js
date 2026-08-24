const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");
const {
  CANDIDATES,
  MILESTONE_IDS,
  createMilestoneTracker,
  createReport,
  installResearchEffect,
  parallelMultiplierLog10,
  realMultiplierLog10,
} = require("../scripts/simulate-ic8-eternity-progression.js");

async function testResearchBoundaryFeedback() {
  const instance = await loadRuntime(path.resolve(__dirname, "..", "src", "main.js"));
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
  assert.equal(runtime.infinityPointGain(), 9, "Real-BC16500 must change the normal IP gain boundary");
  debug.runInfinity(false);
  assert.equal(runtime.currentExactInfinityPoints(), 109n, "modified gain must flow through normal Infinity reset accounting");
  restore();
  assert.equal(baselineGain, 3);

  const parallelClock = { nowSeconds: 2, ic8ClearAtSeconds: 0 };
  const parallelRestore = installResearchEffect(runtime, CANDIDATES[2], parallelClock);
  debug.state.scoreLog10 = 310;
  debug.state.infinityCount = 1;
  runtime.syncInfinityPointCachesFromExact(100n);
  assert.equal(runtime.infinityPointGain(), 27, "Parallel must use 3^secondsSinceIC8Clear before its raw cap");
  parallelRestore();
}

async function runIc8EternityProgressionSimulationTest() {
  assert.equal(realMultiplierLog10(-Infinity), 0);
  assert.equal(realMultiplierLog10(0), 0);
  assert.equal(realMultiplierLog10(2), Math.log10(3));
  assert.equal(parallelMultiplierLog10(0, 0.5), 0);
  assert.equal(parallelMultiplierLog10(10 / Math.log10(3), 0.5), 10);
  assert.equal(parallelMultiplierLog10(20 / Math.log10(3), 0.5), 15);
  assert.deepEqual(MILESTONE_IDS.slice(-4), ["tc4-clear", "ic8-clear", "ip-1.80e308", "eternity-eligibility"]);

  const first = await createReport({
    maxSetupSeconds: 0,
    maxRunSeconds: 0,
    maxStallSeconds: 1,
    stepSeconds: 1 / 30,
    actionIntervalSeconds: 0.1,
    writeReports: false,
  });
  const second = await createReport({
    maxSetupSeconds: 0,
    maxRunSeconds: 0,
    maxStallSeconds: 1,
    stepSeconds: 1 / 30,
    actionIntervalSeconds: 0.1,
    writeReports: false,
  });
  assert.deepEqual(first, second, "bounded setup output must be deterministic");
  assert.equal(first.issue, 217);
  assert.equal(first.researchOnly, true);
  assert.equal(first.noProductionChanges, true);
  assert.equal(first.prelude.status, "setup-stall");
  assert.equal(first.prelude.checkpoint, null, "a stalled prelude must not fabricate a post-Eternity checkpoint");
  assert.equal(first.cases.length, 0);
  assert.deepEqual(first.researchEffects.map(({ id }) => id), CANDIDATES.map(({ id }) => id));
  assert.equal(first.productionPredicates.towerChallengeTargets.find(({ index }) => index === 4).targetLog10, 7777);
  assert.match(first.outcome.reason, /no IC8 snapshot was fabricated/);

  const instance = await loadRuntime(path.resolve(__dirname, "..", "src", "main.js"));
  const tracker = createMilestoneTracker(instance.runtime);
  instance.debug.state.completedChallenges = 1 << 7;
  tracker.observe(12);
  assert.equal(tracker.clock.ic8ClearAtSeconds, 12);
  assert.deepEqual(tracker.events.find(({ type }) => type === "ic8-clear"), {
    type: "ic8-clear",
    timeSeconds: 12,
    timerResetSeconds: 0,
  });

  await testResearchBoundaryFeedback();

  const committed = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "reports", "ic8-eternity-progression.json"), "utf8"));
  assert.equal(committed.issue, 217);
  assert.equal(committed.noProductionChanges, true);
  assert.equal(committed.prelude.status, "setup-stall");
  assert.equal(committed.prelude.checkpoint, null);
  assert.equal(committed.cases.length, 0);
}

if (require.main === module) {
  runIc8EternityProgressionSimulationTest()
    .then(() => console.log("IC8-to-Eternity progression simulation tests passed"))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}

module.exports = { runIc8EternityProgressionSimulationTest };
