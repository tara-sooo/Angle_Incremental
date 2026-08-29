const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");
const {
  CANDIDATES,
  MILESTONE_IDS,
  POLICIES,
  REPRESENTATIVE_FIXTURE,
  applyRepresentativeFixture,
  cloneState,
  coreBoostActionAvailable,
  createMilestoneTracker,
  createReport,
  createRepresentativeFixture,
  formatMarkdown,
  generationActionAvailable,
  infinityResetReady,
  installResearchEffect,
  parallelMultiplierLog10,
  progressSnapshot,
  progressionObjective,
  realMultiplierLog10,
  runBoundedLoop,
  runPolicyAction,
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
  assert.equal("maxCoreBoostCount" in POLICIES[0], false);
  assert.equal("maxGenerationDepthLog10" in POLICIES[0], false);
  assert.deepEqual(MILESTONE_IDS.slice(-4), ["tc4-clear", "ic8-clear", "ip-1.80e308", "eternity-eligibility"]);

  const fixture = await createRepresentativeFixture();
  assert.equal(fixture.id, REPRESENTATIVE_FIXTURE.id);
  assert.equal(fixture.state.eternityCount, 1);
  assert.equal(fixture.state.eternityMilestoneMask, 2);
  assert.equal(fixture.state.completedChallenges, 255);
  assert.equal(fixture.state.achievementMask, 0x7fffffff);
  assert.equal(fixture.state.achievementMaskHigh, 0x3ff);
  assert.equal(fixture.state.timeFlux, 0);
  assert.equal(fixture.state.offlineProgressEnabled, true);
  assert.equal(fixture.state.infinityPointsExact, "100000");
  assert.equal(fixture.state.infinityCount, 10000);
  assert.deepEqual(fixture.notOwnedInfinityUpgradeIds, ["12-1", "13-1", "14-1"]);
  assert.equal(fixture.state.fastestInfinityChallengeTimes[0], 0);
  assert.equal(fixture.atStart["tc2-unlock"], false);
  assert.equal(fixture.atStart["break-infinite-cap"], true);
  assert.equal(fixture.atStart["ic8-clear"], true);
  const cloneA = cloneState(fixture.state);
  const cloneB = cloneState(fixture.state);
  cloneA.infinityCount += 1;
  cloneA.fastestInfinityChallengeTimes[0] = 99;
  assert.equal(cloneB.infinityCount, fixture.state.infinityCount, "candidate fixture clones must not share scalar mutations");
  assert.equal(cloneB.fastestInfinityChallengeTimes[0], 0, "candidate fixture clones must not share array mutations");

  const actionInstance = await loadRuntime(path.resolve(__dirname, "..", "src", "main.js"));
  const actionState = applyRepresentativeFixture(actionInstance);
  const actionResult = runBoundedLoop(actionInstance, POLICIES[0], 0, {
    maxRunSeconds: 0,
    maxStallSeconds: 1,
    stepSeconds: 1,
    maxActionsPerFixedPoint: 4096,
    actionSearchIterations: 2,
  });
  assert.equal(actionResult.timeAdvances, 0, "zero-time actions must run before the first production advance");
  assert.ok(actionResult.actionCounts.normalPurchase > 0, "the initial fixed point must buy immediately affordable upgrades");
  assert.equal(actionResult.status, "policy-stall");
  assert.equal(actionResult.objective.kind, "ip-threshold");
  assert.equal(actionResult.diagnostics.elapsedSeconds, 0);
  assert.equal(actionResult.diagnostics.infinityPointsExact, "100000");
  assert.equal(actionResult.diagnostics.towerFloor, 0);
  assert.equal(actionState.infinityPointsExact, "100000");

  const objectiveInstance = await loadRuntime(path.resolve(__dirname, "..", "src", "main.js"));
  applyRepresentativeFixture(objectiveInstance);
  const objectiveRuntime = objectiveInstance.runtime;
  let objective = progressionObjective(objectiveRuntime);
  assert.equal(objective.kind, "ip-threshold");
  assert.equal(objective.reason, "buy Infinity Upgrade 12-1");
  objectiveRuntime.syncInfinityPointCachesFromExact(10000000n);
  assert.equal(objectiveInstance.debug.buyInfinityUpgrade("12-1"), true);
  objective = progressionObjective(objectiveRuntime);
  assert.equal(objective.reason, "unlock Infinite Angle");
  objectiveRuntime.state.infiniteAngleUnlocked = true;
  objectiveRuntime.state.infinityUpgradeMask = objectiveRuntime.INFINITY_UPGRADES
    .reduce((mask, upgrade) => mask | (1 << upgrade.bit), 0);
  objectiveRuntime.syncInfinityPointCachesFromExact(10n ** 50n);
  objective = progressionObjective(objectiveRuntime);
  assert.equal(objective.kind, "tower-build");
  assert.equal(objective.targetFloor, 1);
  objectiveRuntime.state.towerFloor = 8;
  objectiveRuntime.state.completedTowerChallenges = 3;
  objectiveRuntime.state.infinityCount = 599996;
  objective = progressionObjective(objectiveRuntime);
  assert.equal(objective.kind, "infinity-count");
  assert.equal(objective.targetCount, 600000);
  objectiveRuntime.state.infinityCount = 600000;
  objective = progressionObjective(objectiveRuntime);
  assert.equal(objective.kind, "tower-challenge");
  assert.equal(objective.challenge, 3);

  const rewardInstance = await loadRuntime(path.resolve(__dirname, "..", "src", "main.js"));
  applyRepresentativeFixture(rewardInstance);
  rewardInstance.runtime.state.generationScore = 10 ** 10;
  rewardInstance.runtime.state.generationScoreLog10 = 10;
  rewardInstance.runtime.state.currentGenerationRunTime = 60;
  assert.equal(generationActionAvailable(rewardInstance.runtime, POLICIES[0]), true);
  rewardInstance.runtime.state.currentGenerationRunTime = 0;
  assert.equal(generationActionAvailable(rewardInstance.runtime, POLICIES[0]), false);

  rewardInstance.runtime.state.scoreLog10 = 100;
  rewardInstance.runtime.state.score = 10 ** 100;
  assert.equal(coreBoostActionAvailable(rewardInstance.runtime, POLICIES[0]), true);

  const gainInstance = await loadRuntime(path.resolve(__dirname, "..", "src", "main.js"));
  applyRepresentativeFixture(gainInstance);
  gainInstance.runtime.syncInfinityPointCachesFromExact(1000000n);
  gainInstance.runtime.state.score = Number.MAX_VALUE;
  gainInstance.runtime.state.scoreLog10 = 258;
  assert.equal(infinityResetReady(gainInstance.runtime, progressionObjective(gainInstance.runtime), POLICIES[0]), false);
  gainInstance.runtime.state.scoreLog10 = 10000000;
  assert.equal(infinityResetReady(gainInstance.runtime, progressionObjective(gainInstance.runtime), POLICIES[0]), true);

  const countFarm = await loadRuntime(path.resolve(__dirname, "..", "src", "main.js"));
  applyRepresentativeFixture(countFarm);
  countFarm.runtime.state.infiniteAngleUnlocked = true;
  countFarm.runtime.state.infinityUpgradeMask = countFarm.runtime.INFINITY_UPGRADES
    .reduce((mask, upgrade) => mask | (1 << upgrade.bit), 0);
  countFarm.runtime.state.towerFloor = 8;
  countFarm.runtime.state.completedTowerChallenges = 3;
  countFarm.runtime.state.infinityCount = 599996;
  countFarm.runtime.state.score = Number.MAX_VALUE;
  countFarm.runtime.state.scoreLog10 = 310;
  countFarm.runtime.syncInfinityPointCachesFromExact(1n);
  runPolicyAction(countFarm, POLICIES[0], {});
  assert.equal(countFarm.runtime.state.infinityCount, 600000, "TC3 preparation must use normal Infinity count gain");
  assert.equal(countFarm.runtime.state.activeTowerChallenge, 0);

  const first = await createReport({
    maxRunSeconds: 0,
    maxStallSeconds: 1,
    stepSeconds: 1,
    actionSearchIterations: 2,
    convergenceCheck: true,
    writeReports: false,
  });
  const second = await createReport({
    maxRunSeconds: 0,
    maxStallSeconds: 1,
    stepSeconds: 1,
    actionSearchIterations: 2,
    convergenceCheck: true,
    writeReports: false,
  });
  assert.deepEqual(first, second, "bounded setup output must be deterministic");
  assert.equal(first.issue, 237);
  assert.equal(first.researchOnly, true);
  assert.equal(first.noProductionChanges, true);
  assert.equal(first.outcome.status, "incomplete");
  assert.equal(first.cases.length, 4);
  assert.equal(first.options.actionStrategy, "immediate fixed point before and after every production step");
  assert.equal(first.options.requestedStepSeconds, 1);
  assert.equal(first.options.actionSearchIterations, 2);
  assert.equal(first.validation.cadence.canonicalStepNotCalendarScale, true);
  assert.equal(first.validation.convergence.status, "passed");
  assert.equal(first.validation.sanity.status, "not-applicable");
  first.cases.forEach((entry) => {
    assert.equal(entry.fixtureId, fixture.id);
    assert.equal(entry.representativeMilestone, "1-2");
    assert.equal(entry.ic8ClearAtSeconds, 0);
    assert.equal(entry.relativeFirstReachSeconds["ic8-clear"], 0);
    assert.equal(entry.milestoneTiming["ic8-clear"], "at-start");
    assert.equal(entry.milestoneTiming["break-infinite-cap"], "at-start");
    assert.equal(entry.relativeFirstReachSeconds["tc2-unlock"], null);
    assert.equal(entry.diagnostics.objective.kind, "ip-threshold");
  });
  assert.deepEqual(first.researchEffects.map(({ id }) => id), CANDIDATES.map(({ id }) => id));
  assert.equal(first.productionPredicates.towerChallengeTargets.find(({ index }) => index === 4).targetLog10, 7777);
  assert.match(first.fixture.representativeCase, /Milestone 1-2/);

  const instance = await loadRuntime(path.resolve(__dirname, "..", "src", "main.js"));
  const tracker = createMilestoneTracker(instance.runtime);
  const initialProgress = progressSnapshot(instance.runtime);
  tracker.observe(0);
  instance.debug.state.generationScore = 10;
  instance.debug.state.generationScoreLog10 = 10;
  assert.ok(progressSnapshot(instance.runtime).generationScoreLog10 > initialProgress.generationScoreLog10);
  tracker.observe(5);
  assert.equal(tracker.lastProgressSeconds, 5, "Generation score progress must refresh the stall clock");
  instance.debug.state.infinityUpgradeMask = 1;
  tracker.observe(6);
  assert.equal(tracker.lastProgressSeconds, 6, "Infinity purchases must refresh the stall clock");

  const relativeTracker = createMilestoneTracker(instance.runtime);
  relativeTracker.observe(2);
  instance.debug.state.completedChallenges = 1 << 7;
  relativeTracker.observe(12);
  assert.equal(relativeTracker.clock.ic8ClearAtSeconds, 12);
  assert.equal(relativeTracker.relativeFirstReachSeconds["ic8-clear"], 0);
  assert.equal(relativeTracker.milestoneTiming["ic8-clear"], "post-IC8");
  assert.equal(relativeTracker.events.find(({ type }) => type === "ic8-clear").timerResetSeconds, 0);
  instance.debug.state.infiniteCapBroken = true;
  relativeTracker.observe(20);
  assert.equal(relativeTracker.relativeFirstReachSeconds["break-infinite-cap"], 8);
  assert.equal(relativeTracker.milestoneTiming["break-infinite-cap"], "post-IC8");

  const mappingMarkdown = formatMarkdown(first);
  assert.match(mappingMarkdown, /Milestone 1-2 post-IC8 progression/);
  assert.match(mappingMarkdown, /ic8-clear/);
  assert.match(mappingMarkdown, /IP \*\*1e5\*\*/);
  assert.match(mappingMarkdown, /no calendar-scale action interval/);
  assert.match(mappingMarkdown, /Objective policy/);
  assert.match(mappingMarkdown, /policy-stall/);
  const baselineLine = mappingMarkdown.split("\n")
    .filter((line) => line.startsWith("| timeline-free |"))
    .at(-1);
  assert.match(baselineLine, /at-start/);

  const towerChallenge = await loadRuntime(path.resolve(__dirname, "..", "src", "main.js"));
  towerChallenge.runtime.updateUi = () => {};
  towerChallenge.runtime.saveGame = () => true;
  towerChallenge.debug.state.infinityCount = 1;
  towerChallenge.debug.state.towerFloor = 3;
  towerChallenge.debug.state.activeTowerChallenge = 1;
  towerChallenge.debug.state.score = Number.MAX_VALUE;
  towerChallenge.debug.state.scoreLog10 = 310;
  runPolicyAction(towerChallenge, POLICIES[0], {});
  assert.equal(towerChallenge.debug.state.activeTowerChallenge, 1, "TC1 must remain active below its production target");
  assert.equal(towerChallenge.debug.state.infinityCount, 1, "the policy must not Infinity-reset at 1e308 inside TC1");

  await testResearchBoundaryFeedback();

  const committed = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "reports", "ic8-eternity-progression.json"), "utf8"));
  assert.equal(committed.issue, 237);
  assert.equal(committed.schemaVersion, 5);
  assert.equal(committed.noProductionChanges, true);
  assert.equal(committed.fixture.id, REPRESENTATIVE_FIXTURE.id);
  assert.equal(committed.fixture.state.eternityMilestoneMask, 2);
  assert.equal(committed.fixture.exactInfinityPoints, "100000");
  assert.deepEqual(committed.fixture.notOwnedInfinityUpgradeIds, ["12-1", "13-1", "14-1"]);
  assert.equal(committed.cases.length, 4);
  committed.cases.forEach((entry) => {
    assert.equal(entry.status, "policy-stall");
    assert.ok(entry.diagnostics.objective.kind);
    assert.ok(entry.diagnostics.elapsedSeconds > 0);
  });
  assert.equal(committed.validation.convergence.status, "passed");
  assert.equal(committed.validation.realSlowdown.status, "passed");
  assert.equal(committed.validation.sanity.status, "failed");
  assert.equal(committed.outcome.status, "invalid");
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
