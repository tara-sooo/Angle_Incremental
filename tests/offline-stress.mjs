import assert from "node:assert/strict";
import path from "node:path";
import { openGamePage, root, startGameTest, writeReport } from "./browser-harness.mjs";

const reportPath = path.join(root, "output", "offline-stress.json");
const budgets = Object.freeze({
  offlineProcessingWallMs: 1000,
  offlineAutoInfinityWallMs: 1500,
  offlineAutoInfinityUiUpdates: 2,
  offlineCoreHitWallMs: 250,
  offlineCoreHitErrorLog10: 0.001,
  offlineLongResumeWallMs: 120000,
});

function collectViolations(report) {
  const violations = [];
  if (report.offlineProcessing.wallMilliseconds > budgets.offlineProcessingWallMs) {
    violations.push(`offline processing wall ${report.offlineProcessing.wallMilliseconds.toFixed(3)}ms > ${budgets.offlineProcessingWallMs}ms`);
  }
  const autoInfinity = report.offlineStress.autoInfinity;
  if (autoInfinity.wallMilliseconds > budgets.offlineAutoInfinityWallMs) {
    violations.push(`offline Auto Infinity wall ${autoInfinity.wallMilliseconds.toFixed(3)}ms > ${budgets.offlineAutoInfinityWallMs}ms`);
  }
  if (autoInfinity.uiUpdateCalls > budgets.offlineAutoInfinityUiUpdates) {
    violations.push(`offline Auto Infinity full UI updates ${autoInfinity.uiUpdateCalls} > ${budgets.offlineAutoInfinityUiUpdates}`);
  }
  for (const [track, boundary] of Object.entries(report.offlineStress.coreHitBoundary)) {
    if (boundary.offlineWallMilliseconds > budgets.offlineCoreHitWallMs) {
      violations.push(`offline ${track} core-hit wall ${boundary.offlineWallMilliseconds.toFixed(3)}ms > ${budgets.offlineCoreHitWallMs}ms`);
    }
    if (Math.abs(boundary.scoreDeltaLog10) > budgets.offlineCoreHitErrorLog10) {
      violations.push(`offline ${track} core-hit log10 error ${boundary.scoreDeltaLog10} > ${budgets.offlineCoreHitErrorLog10}`);
    }
    if (track === "infiniteAngle" && boundary.offlineWallMilliseconds >= boundary.exactWallMilliseconds) {
      violations.push(`offline ${track} core-hit wall ${boundary.offlineWallMilliseconds.toFixed(3)}ms was not faster than exact ${boundary.exactWallMilliseconds.toFixed(3)}ms`);
    }
  }
  const exactWork = report.offlineStress.infiniteAngleExactWork;
  if (exactWork.wallMilliseconds > budgets.offlineCoreHitWallMs) {
    violations.push(`offline Infinite Angle exact-work wall ${exactWork.wallMilliseconds.toFixed(3)}ms > ${budgets.offlineCoreHitWallMs}ms`);
  }
  if (exactWork.direct.wallMilliseconds > budgets.offlineCoreHitWallMs) {
    violations.push(`offline Infinite Angle direct exact-work wall ${exactWork.direct.wallMilliseconds.toFixed(3)}ms > ${budgets.offlineCoreHitWallMs}ms`);
  }
  for (const [name, resume] of Object.entries(report.offlineStress.longResumeWork)) {
    if (resume.wallMilliseconds > budgets.offlineLongResumeWallMs) {
      violations.push(`offline ${name} long-resume wall ${resume.wallMilliseconds.toFixed(3)}ms > ${budgets.offlineLongResumeWallMs}ms`);
    }
  }
  return violations;
}

async function measureOfflineStress(page) {
  return page.evaluate(async () => {
    const debug = window.__angleDebug;
    const { runtime, state } = debug;
    function resetScenario(vertices) {
      state.activeChallenge = 0;
      state.vertices = vertices;
      state.speedLevel = 300;
      state.gainLevel = 100;
      state.pointProgress = 0;
      state.totalVertexProgress = 0;
      state.score = 0;
      state.scoreLog10 = -Infinity;
      state.totalScore = 0;
      state.totalScoreLog10 = -Infinity;
      state.generationScore = 0;
      state.generationScoreLog10 = -Infinity;
      state.floatingTexts = [];
      state.infiniteAngleUnlocked = true;
      state.infiniteAngleVertexLevel = vertices - 3;
      state.infiniteAngleSpeedLevel = 300;
      state.infiniteAngleGainLevel = 100;
      state.infiniteAnglePointProgress = 0;
      state.infiniteAngleTotalVertexProgress = 0;
      state.infiniteAngleCurrentGain = 1;
      state.infiniteAngleCurrentGainLog10 = 0;
      debug.setRenderQualityForTest("high");
    }
    function configureCoreHitScenario(track) {
      resetScenario(3);
      state.activeTowerChallenge = 0;
      state.automationEnabled = false;
      state.autoRunInfinity = false;
      state.autoRunGeneration = false;
      state.autoRunCoreBoost = false;
      state.infinityUpgradeMask = 0;
      state.infinityCount = 0;
      state.vertices = 3;
      state.speedLevel = track === "angle" ? 302 : 0;
      state.gainLevel = 0;
      state.pointProgress = 0;
      state.totalVertexProgress = 0;
      state.score = 0;
      state.scoreLog10 = -Infinity;
      state.currentGain = 1;
      state.currentGainLog10 = 0;
      state.infiniteAngleUnlocked = track === "infiniteAngle";
      state.infiniteAngleVertexLevel = 0;
      state.infiniteAngleSpeedLevel = track === "infiniteAngle" ? 302 : 0;
      state.infiniteAngleGainLevel = 0;
      state.infiniteAnglePointProgress = 0;
      state.infiniteAngleTotalVertexProgress = 0;
      state.infiniteAngleCurrentGain = 1;
      state.infiniteAngleCurrentGainLog10 = 0;
      state.infiniteScore = 0;
      state.infiniteScoreLog10 = -Infinity;
      state.offlineProgressEnabled = true;
      state.offlineTickCount = 1000;
    }
    async function measureCoreHitBoundary(track) {
      const coreHits = 48000;
      configureCoreHitScenario(track);
      const tickSeconds = coreHits * (track === "angle" ? runtime.lapDuration() : runtime.infiniteAngleLapDuration());
      const exactStartedAt = performance.now();
      if (track === "angle") debug.update(tickSeconds, true);
      else debug.updateInfiniteAngle(tickSeconds);
      const exactWallMilliseconds = performance.now() - exactStartedAt;
      const exactScoreLog10 = track === "angle" ? state.scoreLog10 : state.infiniteScoreLog10;

      configureCoreHitScenario(track);
      const offlineStartedAt = performance.now();
      const report = await debug.processOfflineElapsed(tickSeconds, "performance-boundary", { clockSource: "server" });
      const offlineWallMilliseconds = performance.now() - offlineStartedAt;
      const offlineScoreLog10 = track === "angle" ? state.scoreLog10 : state.infiniteScoreLog10;
      return {
        coreHits,
        requestedTicks: report?.requestedTicks ?? 0,
        processedTicks: report?.processedTicks ?? 0,
        exactWallMilliseconds,
        offlineWallMilliseconds,
        exactScoreLog10,
        offlineScoreLog10,
        scoreDeltaLog10: offlineScoreLog10 - exactScoreLog10,
      };
    }
    function configureInfiniteAngleOfflineScenario(speedLevel) {
      resetScenario(720);
      state.activeTowerChallenge = 0;
      state.automationEnabled = false;
      state.autoRunInfinity = false;
      state.autoRunGeneration = false;
      state.autoRunCoreBoost = false;
      state.infinityUpgradeMask = 0;
      state.infinityCount = 0;
      state.infiniteAngleSpeedLevel = speedLevel;
      state.infiniteAngleGainLevel = 0;
      state.infiniteAnglePointProgress = 0;
      state.infiniteAngleTotalVertexProgress = 0;
      state.infiniteAngleCurrentGain = 1;
      state.infiniteAngleCurrentGainLog10 = 0;
      state.infiniteScore = 0;
      state.infiniteScoreLog10 = -Infinity;
      state.offlineProgressEnabled = true;
      state.offlineTickCount = runtime.OFFLINE_PROGRESS_MAX_TICKS;
    }
    function measureInfiniteAngleExactWorkBudget() {
      const coreHitsPerTick = runtime.CORE_HIT_APPROX_SEGMENTS * 2;
      const exactWorkBudget = runtime.OFFLINE_CORE_HIT_WORK_BUDGET;
      const simulatedTicks = Math.ceil(exactWorkBudget / coreHitsPerTick) + 1;
      configureInfiniteAngleOfflineScenario(302);
      const tickSeconds = coreHitsPerTick * runtime.infiniteAngleLapDuration();
      const startedAt = performance.now();
      runtime.beginOfflineWorkBudget(simulatedTicks);
      runtime.offlineProcessing = true;
      try {
        for (let tick = 0; tick < simulatedTicks; tick += 1) debug.updateInfiniteAngle(tickSeconds);
      } finally {
        runtime.offlineProcessing = false;
      }
      const batched = {
        exactIterations: runtime.infiniteAngleOfflineExactIterations,
        approximationIterations: runtime.infiniteAngleOfflineApproximationIterations,
        work: runtime.offlineWorkStats,
        simulatedTicks,
        wallMilliseconds: performance.now() - startedAt,
      };

      configureInfiniteAngleOfflineScenario(99);
      const directTickSeconds = 1 / 30;
      const directCoreHitsPerTick = Math.max(1, Math.ceil(directTickSeconds / runtime.infiniteAngleLapDuration()));
      const directSimulatedTicks = Math.ceil(
        exactWorkBudget / Math.max(1, Math.floor(directTickSeconds / runtime.infiniteAngleLapDuration())),
      ) + 1;
      const directStartedAt = performance.now();
      runtime.beginOfflineWorkBudget(directSimulatedTicks);
      runtime.offlineProcessing = true;
      try {
        for (let tick = 0; tick < directSimulatedTicks; tick += 1) debug.updateInfiniteAngle(directTickSeconds);
      } finally {
        runtime.offlineProcessing = false;
      }
      return {
        exactWorkBudget,
        exactIterations: batched.exactIterations,
        approximationIterations: batched.approximationIterations,
        simulatedTicks: batched.simulatedTicks,
        wallMilliseconds: batched.wallMilliseconds,
        direct: {
          exactIterations: runtime.infiniteAngleOfflineExactIterations,
          approximationIterations: runtime.infiniteAngleOfflineApproximationIterations,
          work: runtime.offlineWorkStats,
          coreHitsPerTick: directCoreHitsPerTick,
          simulatedTicks: directSimulatedTicks,
          wallMilliseconds: performance.now() - directStartedAt,
        },
      };
    }
    function configureCombinedOfflineScenario(targetHits) {
      resetScenario(720);
      state.activeTowerChallenge = 0;
      state.automationEnabled = false;
      state.autoRunInfinity = false;
      state.autoRunGeneration = false;
      state.autoRunCoreBoost = false;
      state.infinityUpgradeMask = 0;
      state.infinityCount = 1;
      state.gainLevel = 0;
      state.infiniteAngleGainLevel = 0;
      state.score = 0;
      state.scoreLog10 = -Infinity;
      state.totalScore = 0;
      state.totalScoreLog10 = -Infinity;
      state.infiniteScore = 0;
      state.infiniteScoreLog10 = -Infinity;
      state.currentGain = 1;
      state.currentGainLog10 = 0;
      state.infiniteAngleCurrentGain = 1;
      state.infiniteAngleCurrentGainLog10 = 0;
      state.pointProgress = 0;
      state.totalVertexProgress = 0;
      state.infiniteAnglePointProgress = 0;
      state.infiniteAngleTotalVertexProgress = 0;
      state.offlineProgressEnabled = true;
      state.offlineTickCount = runtime.OFFLINE_PROGRESS_MAX_TICKS;

      const tickSeconds = 1 / 30;
      let normalSpeed = 0;
      let infiniteSpeed = 0;
      for (let level = 0; level <= 500; level += 1) {
        state.speedLevel = level;
        if (Math.ceil(tickSeconds / runtime.lapDuration()) <= targetHits) normalSpeed = level;
        state.infiniteAngleSpeedLevel = level;
        if (Math.ceil(tickSeconds / runtime.infiniteAngleLapDuration()) <= targetHits) infiniteSpeed = level;
      }
      state.speedLevel = normalSpeed;
      state.infiniteAngleSpeedLevel = infiniteSpeed;
      return tickSeconds;
    }
    async function measureLongOfflineResumeWork() {
      const requestedTicks = runtime.OFFLINE_PROGRESS_MAX_TICKS;
      const measure = async (targetHits, reason) => {
        const tickSeconds = configureCombinedOfflineScenario(targetHits);
        const startedAt = performance.now();
        const report = await debug.processOfflineElapsed(
          tickSeconds * requestedTicks,
          reason,
          { clockSource: "server" },
        );
        return {
          requestedTicks: report?.requestedTicks ?? 0,
          processedTicks: report?.processedTicks ?? 0,
          precisionReduced: report?.precisionReduced ?? false,
          work: runtime.offlineWorkStats,
          wallMilliseconds: performance.now() - startedAt,
        };
      };
      return {
        four: await measure(4, "performance-four-hit-offline-work"),
        eight: await measure(8, "performance-eight-hit-offline-work"),
        high: await measure(16, "performance-high-load-offline-work"),
      };
    }
    async function measureAutoInfinityStress() {
      resetScenario(3);
      state.offlineProgressEnabled = true;
      state.offlineTickCount = 10000;
      state.speedLevel = 0;
      state.gainLevel = 0;
      state.infiniteAngleUnlocked = false;
      state.automationEnabled = true;
      state.autoRunInfinity = true;
      state.autoRunGeneration = false;
      state.autoRunCoreBoost = false;
      state.autoInfinityPointThresholdLog10 = 0;
      state.activeChallenge = 0;
      state.activeTowerChallenge = 0;
      state.infinityCount = 1;
      state.infinityUpgradeMask = 1 << 12;
      state.score = Number.MAX_VALUE;
      state.scoreLog10 = 309;

      const originalResetBelowInfinity = runtime.resetBelowInfinity;
      const uiUpdatesBefore = debug.uiUpdateCount();
      runtime.resetBelowInfinity = (...args) => {
        const result = originalResetBelowInfinity(...args);
        state.score = Number.MAX_VALUE;
        state.scoreLog10 = 309;
        return result;
      };
      try {
        const startedAt = performance.now();
        const report = await debug.processOfflineElapsed(10000 / 30, "performance-auto-infinity", {
          clockSource: "server",
        });
        return {
          requestedTicks: report?.requestedTicks ?? 0,
          processedTicks: report?.processedTicks ?? 0,
          infinityCountGain: report?.normalInfinityCountGain ?? 0,
          processingMilliseconds: report?.processingMilliseconds ?? NaN,
          wallMilliseconds: performance.now() - startedAt,
          uiUpdateCalls: debug.uiUpdateCount() - uiUpdatesBefore,
        };
      } finally {
        runtime.resetBelowInfinity = originalResetBelowInfinity;
      }
    }

    function primeRegressionState() {
      for (const vertices of [3, 720, 10000]) {
        resetScenario(vertices);
        debug.switchMainTab("angle");
        window.advanceTime(0);
        for (let index = 0; index < 20 + 120; index += 1) debug.update(1 / 60);
        resetScenario(vertices);
        debug.switchMainTab("infinity");
        debug.switchInfinitySubtab("angle");
        window.advanceTime(0);
        for (let index = 0; index < 20 + 120; index += 1) debug.updateInfiniteAngle(1 / 60);
      }
    }

    primeRegressionState();
    resetScenario(3);
    state.offlineProgressEnabled = true;
    state.offlineTickCount = 100000;
    state.speedLevel = 0;
    state.gainLevel = 0;
    state.infiniteAngleUnlocked = false;
    state.automationEnabled = false;
    state.autoRunInfinity = false;
    state.autoRunGeneration = false;
    state.autoRunCoreBoost = false;
    state.activeChallenge = 0;
    state.activeTowerChallenge = 0;
    const offlineStartedAt = performance.now();
    const offlineReport = await debug.processOfflineElapsed(100000 / 30, "performance", { clockSource: "server" });
    const offlineProcessing = {
      requestedTicks: offlineReport?.requestedTicks ?? 0,
      processedTicks: offlineReport?.processedTicks ?? 0,
      processingMilliseconds: offlineReport?.processingMilliseconds ?? NaN,
      wallMilliseconds: performance.now() - offlineStartedAt,
    };
    return {
      offlineProcessing,
      offlineStress: {
        autoInfinity: await measureAutoInfinityStress(),
        coreHitBoundary: {
          angle: await measureCoreHitBoundary("angle"),
          infiniteAngle: await measureCoreHitBoundary("infiniteAngle"),
        },
        infiniteAngleExactWork: measureInfiniteAngleExactWorkBudget(),
        longResumeWork: await measureLongOfflineResumeWork(),
      },
    };
  });
}

const gameTest = await startGameTest();
try {
  const gamePage = await openGamePage(gameTest.browser, gameTest.origin, {
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  let data;
  try {
    data = await measureOfflineStress(gamePage.page);
  } finally {
    await gamePage.context.close();
  }

  const report = {
    status: "measured",
    generatedAt: new Date().toISOString(),
    matrix: {
      viewport: { name: "desktop", width: 1280, height: 800 },
      deviceScaleFactor: 1,
      preparation: "unmeasured 3/720/10000 Angle and Infinite Angle updates prime the progressed achievement state used by the original boundary coverage",
      scenarios: ["offline-processing", "auto-infinity", "core-hit-boundary", "infinite-angle-exact-work", "long-resume"],
    },
    budgets,
    ...data,
  };
  const violations = collectViolations(report);
  report.budgetViolations = violations;
  report.violations = violations;
  report.status = violations.length === 0 ? "passed" : "failed";
  await writeReport(reportPath, report);
  console.log(JSON.stringify(report, null, 2));

  assert.ok(report.offlineProcessing, "the offline stress test should measure the real offline processing path");
  assert.equal(report.offlineProcessing.requestedTicks, 100000, "the real offline path should request 100000 ticks");
  assert.equal(report.offlineProcessing.processedTicks, 100000, "the real offline path should process 100000 ticks exactly");
  assert.ok(
    Number.isFinite(report.offlineProcessing.processingMilliseconds)
      && report.offlineProcessing.processingMilliseconds >= 0,
    "the real offline path should report a finite processing duration",
  );
  assert.ok(
    Number.isFinite(report.offlineProcessing.wallMilliseconds)
      && report.offlineProcessing.wallMilliseconds >= 0,
    "the real offline path should report a finite wall duration",
  );

  const autoInfinity = report.offlineStress.autoInfinity;
  assert.equal(autoInfinity.requestedTicks, 10000, "Auto Infinity stress should request 10000 ticks");
  assert.equal(autoInfinity.processedTicks, 10000, "Auto Infinity stress should process 10000 ticks exactly");
  assert.equal(autoInfinity.infinityCountGain, 10000, "Auto Infinity stress should run once per tick");
  for (const [track, boundary] of Object.entries(report.offlineStress.coreHitBoundary)) {
    assert.equal(boundary.coreHits, 48000, `${track} boundary should use 48000 core hits`);
    assert.equal(boundary.requestedTicks, 1, `${track} boundary should fit in one offline tick`);
    assert.equal(boundary.processedTicks, 1, `${track} boundary should process one offline tick`);
    assert.ok(Number.isFinite(boundary.exactScoreLog10), `${track} exact boundary score should be finite`);
    assert.ok(Number.isFinite(boundary.offlineScoreLog10), `${track} offline boundary score should be finite`);
  }
  const exactWork = report.offlineStress.infiniteAngleExactWork;
  assert.ok(exactWork.exactIterations > 0 && exactWork.exactIterations <= exactWork.exactWorkBudget, "offline IA exact work must stay within its total budget");
  assert.ok(Number.isFinite(exactWork.wallMilliseconds), "offline IA exact-work measurement should report a finite duration");
  assert.ok(exactWork.direct?.work, "direct offline IA work should expose its work ledger");
  assert.ok(exactWork.direct.exactIterations > 0 && exactWork.direct.work.totalIterations <= exactWork.direct.work.hardCap, "direct offline IA work must stay within its total budget");
  assert.ok(
    exactWork.direct.approximationIterations >= 0
      && exactWork.direct.approximationIterations <= exactWork.direct.work.hardCap
      && exactWork.direct.work.tracks.infiniteAngle.fallbackIterations <= exactWork.direct.simulatedTicks,
    "direct offline IA approximation and fallback work must stay bounded",
  );
  assert.ok(Number.isFinite(exactWork.direct.wallMilliseconds), "direct offline IA exact-work measurement should report a finite duration");

  const longResumeWork = report.offlineStress.longResumeWork;
  assert.ok(longResumeWork?.four && longResumeWork?.eight && longResumeWork?.high, "the offline stress test should measure all long-resume work budgets");
  for (const [name, resume] of Object.entries(longResumeWork)) {
    assert.equal(resume.requestedTicks, 1000000, `${name} long resume should request the maximum tick count`);
    assert.equal(resume.processedTicks, 1000000, `${name} long resume should process the maximum tick count`);
    assert.ok(resume.work.totalIterations <= resume.work.hardCap, `${name} offline work must stay within its hard cap`);
    assert.ok(Number.isFinite(resume.wallMilliseconds), `${name} long resume should report finite wall time`);
  }
  assert.equal(longResumeWork.four.precisionReduced, false, "four-hit offline batches should remain exact");
  assert.equal(longResumeWork.eight.precisionReduced, false, "eight-hit offline batches should remain exact");
  for (const name of ["four", "eight"]) {
    assert.ok(
      longResumeWork[name].work.tracks.angle.exactIterations > 0
        && longResumeWork[name].work.tracks.infiniteAngle.exactIterations > 0
        && longResumeWork[name].work.tracks.angle.approximationIterations === 0
        && longResumeWork[name].work.tracks.infiniteAngle.approximationIterations === 0,
      `${name}-hit batches on both tracks should remain exact within the long-resume budget`,
    );
  }
  assert.equal(longResumeWork.high.precisionReduced, true, "high-load offline batches should report bounded approximation after the bulk reserve");
  assert.equal(longResumeWork.high.work.precisionReduced, true, "high-load offline work should mark the ledger as precision-reduced");
  assert.equal(
    longResumeWork.high.work.tracks.angle.approximationIterations > 0
      && longResumeWork.high.work.tracks.infiniteAngle.approximationIterations > 0,
    true,
    "high-load batches on both tracks should use bounded approximation after the reserve",
  );
  assert.ok(
    longResumeWork.high.work.tracks.angle.fallbackIterations <= 1000000
      && longResumeWork.high.work.tracks.infiniteAngle.fallbackIterations <= 1000000,
    "high-load fallback work should stay bounded by the resume length",
  );
  assert.deepEqual(violations, [], `offline stress budget violations:\n${violations.join("\n")}`);
} finally {
  await gameTest.close();
}
