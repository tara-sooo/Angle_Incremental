import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = path.join(root, "output", "performance-smoke.json");
const expectedAppVersion = JSON.parse(await readFile(path.join(root, "version.json"), "utf8")).appVersion;
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};
const budgets = Object.freeze({
  simulationP95Ms: 12,
  normalFrameP95Ms: 30,
  highLoadFrameP95Ms: 50,
  offlineProcessingWallMs: 1000,
  offlineAutoInfinityWallMs: 1500,
  offlineAutoInfinityUiUpdates: 2,
  offlineCoreHitWallMs: 250,
  offlineCoreHitErrorLog10: 0.001,
});
const viewports = Object.freeze([
  Object.freeze({ name: "desktop", width: 1280, height: 800 }),
  Object.freeze({ name: "mobile", width: 390, height: 844 }),
]);
const deviceScaleFactors = Object.freeze([1, 2, 3]);
const vertexScenarios = Object.freeze([3, 720, 10000]);

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://127.0.0.1").pathname);
  const relative = path.normalize((pathname === "/" ? "/index.html" : pathname).replace(/^\/+/, ""));
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return path.join(root, relative);
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (ratio) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
  return {
    count: samples.length,
    meanMs: samples.reduce((total, sample) => total + sample, 0) / samples.length,
    p50Ms: percentile(0.50),
    p95Ms: percentile(0.95),
    maxMs: sorted[sorted.length - 1],
  };
}

function collectBudgetViolations(report) {
  const violations = [];
  if (report.offlineProcessing?.wallMilliseconds > budgets.offlineProcessingWallMs) {
    violations.push(
      `offline processing wall ${report.offlineProcessing.wallMilliseconds.toFixed(3)}ms > ${budgets.offlineProcessingWallMs}ms`,
    );
  }
  const autoInfinity = report.offlineStress?.autoInfinity;
  if (autoInfinity?.wallMilliseconds > budgets.offlineAutoInfinityWallMs) {
    violations.push(
      `offline Auto Infinity wall ${autoInfinity.wallMilliseconds.toFixed(3)}ms > ${budgets.offlineAutoInfinityWallMs}ms`,
    );
  }
  if (autoInfinity?.uiUpdateCalls > budgets.offlineAutoInfinityUiUpdates) {
    violations.push(
      `offline Auto Infinity full UI updates ${autoInfinity.uiUpdateCalls} > ${budgets.offlineAutoInfinityUiUpdates}`,
    );
  }
  Object.entries(report.offlineStress?.coreHitBoundary || {}).forEach(([track, boundary]) => {
    if (boundary.offlineWallMilliseconds > budgets.offlineCoreHitWallMs) {
      violations.push(
        `offline ${track} core-hit wall ${boundary.offlineWallMilliseconds.toFixed(3)}ms > ${budgets.offlineCoreHitWallMs}ms`,
      );
    }
    if (Math.abs(boundary.scoreDeltaLog10) > budgets.offlineCoreHitErrorLog10) {
      violations.push(
        `offline ${track} core-hit log10 error ${boundary.scoreDeltaLog10} > ${budgets.offlineCoreHitErrorLog10}`,
      );
    }
    if (track === "infiniteAngle"
      && boundary.offlineWallMilliseconds >= boundary.exactWallMilliseconds) {
      violations.push(
        `offline ${track} core-hit wall ${boundary.offlineWallMilliseconds.toFixed(3)}ms was not faster than exact ${boundary.exactWallMilliseconds.toFixed(3)}ms`,
      );
    }
  });
  const infiniteAngleExactWork = report.offlineStress?.infiniteAngleExactWork;
  if (infiniteAngleExactWork?.wallMilliseconds > budgets.offlineCoreHitWallMs) {
    violations.push(
      `offline Infinite Angle exact-work wall ${infiniteAngleExactWork.wallMilliseconds.toFixed(3)}ms > ${budgets.offlineCoreHitWallMs}ms`,
    );
  }
  if (infiniteAngleExactWork?.direct?.wallMilliseconds > budgets.offlineCoreHitWallMs) {
    violations.push(
      `offline Infinite Angle direct exact-work wall ${infiniteAngleExactWork.direct.wallMilliseconds.toFixed(3)}ms > ${budgets.offlineCoreHitWallMs}ms`,
    );
  }
  report.results.forEach((result) => {
    result.scenarios.forEach((scenario) => {
      if (scenario.angle.simulation.p95Ms > budgets.simulationP95Ms) {
        violations.push(`${result.viewport.name}/DPR${result.deviceScaleFactor}/angle/${scenario.vertices} simulation p95 ${scenario.angle.simulation.p95Ms.toFixed(3)}ms > ${budgets.simulationP95Ms}ms`);
      }
      if (scenario.infiniteAngle.simulation.p95Ms > budgets.simulationP95Ms) {
        violations.push(`${result.viewport.name}/DPR${result.deviceScaleFactor}/infinite-angle/${scenario.vertices} simulation p95 ${scenario.infiniteAngle.simulation.p95Ms.toFixed(3)}ms > ${budgets.simulationP95Ms}ms`);
      }
      const angleFrameBudget = scenario.vertices >= 10000
        ? budgets.highLoadFrameP95Ms
        : budgets.normalFrameP95Ms;
      if (scenario.angle.frame.p95Ms > angleFrameBudget) {
        violations.push(`${result.viewport.name}/DPR${result.deviceScaleFactor}/angle/${scenario.vertices} frame p95 ${scenario.angle.frame.p95Ms.toFixed(3)}ms > ${angleFrameBudget}ms`);
      }
      if (scenario.infiniteAngle.frame.p95Ms > budgets.highLoadFrameP95Ms) {
        violations.push(`${result.viewport.name}/DPR${result.deviceScaleFactor}/infinite-angle/${scenario.vertices} frame p95 ${scenario.infiniteAngle.frame.p95Ms.toFixed(3)}ms > ${budgets.highLoadFrameP95Ms}ms`);
      }
    });
  });
  return violations;
}

function collectQualityViolations(report) {
  const violations = [];
  const expectedProfiles = {
    high: { devicePixelRatio: 2, vertexLimit: 720, frameIntervalMs: 0 },
    balanced: { devicePixelRatio: 1.5, vertexLimit: 360, frameIntervalMs: 1000 / 30 },
    low: { devicePixelRatio: 1, vertexLimit: 180, frameIntervalMs: 1000 / 30 },
  };
  report.results.forEach((result) => {
    const prefix = `${result.viewport.name}/DPR${result.deviceScaleFactor}`;
    const angleBefore = result.cache.angleBeforeDynamic.angleBuilds;
    const angleAfterDynamic = result.cache.angleAfterDynamic.angleBuilds;
    const angleAfterGeometry = result.cache.angleAfterGeometry.angleBuilds;
    const infiniteBefore = result.cache.infiniteAngleBeforeDynamic.infiniteAngleBuilds;
    const infiniteAfterDynamic = result.cache.infiniteAngleAfterDynamic.infiniteAngleBuilds;
    if (angleAfterDynamic !== angleBefore) {
      violations.push(`${prefix}/angle dynamic update rebuilt the static cache`);
    }
    if (angleAfterGeometry <= angleAfterDynamic) {
      violations.push(`${prefix}/angle geometry change did not rebuild the static cache`);
    }
    if (infiniteAfterDynamic !== infiniteBefore) {
      violations.push(`${prefix}/infinite-angle dynamic update rebuilt the static cache`);
    }
    result.qualityModes.forEach((mode) => {
      const expected = expectedProfiles[mode.level];
      if (!expected) {
        violations.push(`${prefix}/unknown render quality mode ${mode.level}`);
        return;
      }
      if (mode.state.vertexLimit !== expected.vertexLimit) {
        violations.push(`${prefix}/${mode.level} vertex limit ${mode.state.vertexLimit} !== ${expected.vertexLimit}`);
      }
      if (Math.abs(mode.state.frameIntervalMs - expected.frameIntervalMs) > 0.01) {
        violations.push(`${prefix}/${mode.level} frame interval ${mode.state.frameIntervalMs} !== ${expected.frameIntervalMs}`);
      }
      const expectedScale = Math.min(result.deviceScaleFactor, expected.devicePixelRatio);
      const actualScale = mode.canvas.cssWidth > 0 ? mode.canvas.pixelWidth / mode.canvas.cssWidth : 0;
      if (Math.abs(actualScale - expectedScale) > 0.02) {
        violations.push(`${prefix}/${mode.level} backing scale ${actualScale.toFixed(3)} !== ${expectedScale}`);
      }
    });
    const automaticTransitions = result.automaticTransitions;
    if (automaticTransitions?.idleThirtyFps?.level !== "high") {
      violations.push(`${prefix}/automatic quality degraded at 30 FPS with a 5ms render cost`);
    }
    if (automaticTransitions?.balancedAtSixtyFps?.level !== "balanced") {
      violations.push(`${prefix}/automatic quality incorrectly degraded Balanced at 60 FPS with a 20ms render cost`);
    }
    if (automaticTransitions?.afterBalanced?.level !== "balanced") {
      violations.push(`${prefix}/automatic quality did not degrade high -> balanced`);
    }
    if (automaticTransitions?.afterLow?.level !== "low") {
      violations.push(`${prefix}/automatic quality did not degrade balanced -> low`);
    }
    if (automaticTransitions?.hiddenCanvas?.level !== "low") {
      violations.push(`${prefix}/hidden canvas unexpectedly advanced quality recovery`);
    }
    if (automaticTransitions?.recoveredBalanced?.level !== "balanced") {
      violations.push(`${prefix}/automatic quality did not recover low -> balanced`);
    }
    if (automaticTransitions?.recoveredHigh?.level !== "high") {
      violations.push(`${prefix}/automatic quality did not recover balanced -> high`);
    }
  });
  return violations;
}

const server = createServer(async (request, response) => {
  const filePath = resolveRequestPath(request.url || "/");
  if (!filePath) {
    response.writeHead(403).end();
    return;
  }
  try {
    const metadata = await stat(filePath);
    if (!metadata.isFile()) throw new Error("not a file");
    response.writeHead(200, { "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("failed to bind performance server");

const browser = await chromium.launch({ headless: true, args: ["--use-gl=disabled"] });
try {
  const results = [];
  for (const viewport of viewports) {
    for (const deviceScaleFactor of deviceScaleFactors) {
      const context = await browser.newContext({ viewport, deviceScaleFactor });
      const page = await context.newPage();
      await page.addInitScript(({ appVersion }) => {
        window.requestAnimationFrame = () => 0;
        localStorage.setItem("angle-incremental-seen-version", appVersion);
      }, { appVersion: expectedAppVersion });
      await page.goto(`http://127.0.0.1:${address.port}/index.html`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => Boolean(window.__angleDebug?.state && window.__angleDebug?.ready));
      await page.evaluate(() => window.__angleDebug.ready);

      const result = await page.evaluate(async ({ viewportName, viewportWidth, viewportHeight, scaleFactor }) => {
        const debug = window.__angleDebug;
        const state = debug.state;
        const runtime = debug.runtime;
        const vertexScenarios = [3, 720, 10000];

        function measure(callback, iterations = 120) {
          for (let index = 0; index < 20; index += 1) callback();
          const samples = [];
          for (let index = 0; index < iterations; index += 1) {
            const start = performance.now();
            callback();
            samples.push(performance.now() - start);
          }
          return summarize(samples);
        }

        function summarize(samples) {
          const sorted = [...samples].sort((a, b) => a - b);
          const percentile = (ratio) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
          return {
            count: samples.length,
            meanMs: samples.reduce((total, sample) => total + sample, 0) / samples.length,
            p50Ms: percentile(0.50),
            p95Ms: percentile(0.95),
            maxMs: sorted[sorted.length - 1],
          };
        }

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
          state.activeChallenge = 0;
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
          const tickSeconds = coreHits * (
            track === "angle" ? runtime.lapDuration() : runtime.infiniteAngleLapDuration()
          );
          const exactStartedAt = performance.now();
          if (track === "angle") debug.update(tickSeconds, true);
          else debug.updateInfiniteAngle(tickSeconds);
          const exactWallMilliseconds = performance.now() - exactStartedAt;
          const exactScoreLog10 = track === "angle" ? state.scoreLog10 : state.infiniteScoreLog10;

          configureCoreHitScenario(track);
          const offlineStartedAt = performance.now();
          const report = await debug.processOfflineElapsed(tickSeconds, "performance-boundary", {
            clockSource: "server",
          });
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
          state.activeChallenge = 0;
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
          const exactWorkBudget = runtime.OFFLINE_INFINITE_ANGLE_EXACT_WORK_BUDGET;
          const simulatedTicks = Math.ceil(exactWorkBudget / coreHitsPerTick) + 1;
          configureInfiniteAngleOfflineScenario(302);
          const tickSeconds = coreHitsPerTick * runtime.infiniteAngleLapDuration();
          const startedAt = performance.now();
          runtime.offlineProcessing = true;
          try {
            for (let tick = 0; tick < simulatedTicks; tick += 1) {
              debug.updateInfiniteAngle(tickSeconds);
            }
          } finally {
            runtime.offlineProcessing = false;
          }
          const batched = {
            exactIterations: runtime.infiniteAngleOfflineExactIterations,
            simulatedTicks,
            wallMilliseconds: performance.now() - startedAt,
          };

          configureInfiniteAngleOfflineScenario(99);
          const directTickSeconds = 1 / 30;
          const directCoreHitsPerTick = Math.max(
            1,
            Math.floor(directTickSeconds / runtime.infiniteAngleLapDuration()),
          );
          const directSimulatedTicks = Math.ceil(exactWorkBudget / directCoreHitsPerTick) + 1;
          const directStartedAt = performance.now();
          runtime.offlineProcessing = true;
          try {
            for (let tick = 0; tick < directSimulatedTicks; tick += 1) {
              debug.updateInfiniteAngle(directTickSeconds);
            }
          } finally {
            runtime.offlineProcessing = false;
          }
          return {
            exactWorkBudget,
            exactIterations: batched.exactIterations,
            simulatedTicks: batched.simulatedTicks,
            wallMilliseconds: batched.wallMilliseconds,
            direct: {
              exactIterations: runtime.infiniteAngleOfflineExactIterations,
              simulatedTicks: directSimulatedTicks,
              wallMilliseconds: performance.now() - directStartedAt,
            },
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
          state.autoCompleteChallenges = false;
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

        function canvasSnapshot(selector) {
          const canvas = document.querySelector(selector);
          const rect = canvas?.getBoundingClientRect();
          return {
            cssWidth: rect?.width ?? 0,
            cssHeight: rect?.height ?? 0,
            pixelWidth: canvas?.width ?? 0,
            pixelHeight: canvas?.height ?? 0,
          };
        }

        function measureTrack(track, vertices) {
          resetScenario(vertices);
          if (track === "angle") {
            debug.switchMainTab("angle");
          } else {
            debug.switchMainTab("infinity");
            debug.switchInfinitySubtab("angle");
          }
          window.advanceTime(0);
          const simulation = measure(() => {
            if (track === "angle") debug.update(1 / 60);
            else debug.updateInfiniteAngle(1 / 60);
          });

          resetScenario(vertices);
          if (track === "angle") {
            debug.switchMainTab("angle");
          } else {
            debug.switchMainTab("infinity");
            debug.switchInfinitySubtab("angle");
          }
          window.advanceTime(0);
          const frame = measure(() => window.advanceTime(1000 / 60));
          return { simulation, frame, canvas: canvasSnapshot(track === "angle" ? "#gameCanvas" : "#infiniteAngleCanvas") };
        }

        const scenarios = vertexScenarios.map((vertices) => ({
          vertices,
          angle: measureTrack("angle", vertices),
          infiniteAngle: measureTrack("infiniteAngle", vertices),
        }));

        debug.setRenderQualityForTest("high");
        resetScenario(720);
        debug.switchMainTab("angle");
        window.advanceTime(0);
        const cacheBeforeDynamic = debug.canvasCacheStats();
        state.pointProgress = 0.37;
        window.advanceTime(0);
        const cacheAfterDynamic = debug.canvasCacheStats();
        state.vertices = 721;
        window.advanceTime(0);
        const cacheAfterGeometry = debug.canvasCacheStats();

        resetScenario(720);
        debug.switchMainTab("infinity");
        debug.switchInfinitySubtab("angle");
        window.advanceTime(0);
        const infiniteCacheBeforeDynamic = debug.canvasCacheStats();
        state.infiniteAnglePointProgress = 0.37;
        window.advanceTime(0);
        const infiniteCacheAfterDynamic = debug.canvasCacheStats();

        const qualityModes = ["high", "balanced", "low"].map((level) => {
          debug.setRenderQualityForTest(level);
          debug.switchMainTab("angle");
          window.advanceTime(0);
          return {
            level,
            state: debug.renderQualityState(),
            canvas: canvasSnapshot("#gameCanvas"),
          };
        });
        debug.setRenderQualityForTest("auto");
        const automaticTransitions = {
          initial: debug.renderQualityState(),
        };
        for (let index = 0; index < 30; index += 1) debug.updateRenderQualityForTest(40, 60, true);
        for (let index = 0; index < 60; index += 1) debug.updateRenderQualityForTest(20, 60, true);
        automaticTransitions.balancedAtSixtyFps = debug.renderQualityState();
        debug.setRenderQualityForTest("auto");
        for (let index = 0; index < 120; index += 1) debug.updateRenderQualityForTest(5, 30, true);
        automaticTransitions.idleThirtyFps = debug.renderQualityState();
        for (let index = 0; index < 60; index += 1) debug.updateRenderQualityForTest(40, 30, true);
        automaticTransitions.afterBalanced = debug.renderQualityState();
        for (let index = 0; index < 60; index += 1) debug.updateRenderQualityForTest(40, 30, true);
        automaticTransitions.afterLow = debug.renderQualityState();
        for (let index = 0; index < 120; index += 1) debug.updateRenderQualityForTest(5, 30, false);
        automaticTransitions.hiddenCanvas = debug.renderQualityState();
        for (let index = 0; index < 240; index += 1) debug.updateRenderQualityForTest(5, 30, true);
        automaticTransitions.recoveredBalanced = debug.renderQualityState();
        for (let index = 0; index < 240; index += 1) debug.updateRenderQualityForTest(5, 30, true);
        automaticTransitions.recoveredHigh = debug.renderQualityState();
        debug.setRenderQualityForTest("auto");

        let offlineProcessing = null;
        let offlineStress = null;
        if (viewportName === "desktop" && scaleFactor === 1) {
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
          state.autoCompleteChallenges = false;
          state.activeChallenge = 0;
          state.activeTowerChallenge = 0;
          const offlineStartedAt = performance.now();
          const report = await debug.processOfflineElapsed(100000 / 30, "performance", { clockSource: "server" });
          offlineProcessing = {
            requestedTicks: report?.requestedTicks ?? 0,
            processedTicks: report?.processedTicks ?? 0,
            processingMilliseconds: report?.processingMilliseconds ?? NaN,
            wallMilliseconds: performance.now() - offlineStartedAt,
          };
          offlineStress = {
            autoInfinity: await measureAutoInfinityStress(),
            coreHitBoundary: {
              angle: await measureCoreHitBoundary("angle"),
              infiniteAngle: await measureCoreHitBoundary("infiniteAngle"),
            },
            infiniteAngleExactWork: measureInfiniteAngleExactWorkBudget(),
          };
        }

        return {
          viewport: { name: viewportName, width: viewportWidth, height: viewportHeight },
          deviceScaleFactor: scaleFactor,
          reportedDevicePixelRatio: window.devicePixelRatio,
          scenarios,
          cache: {
            angleBeforeDynamic: cacheBeforeDynamic,
            angleAfterDynamic: cacheAfterDynamic,
            angleAfterGeometry: cacheAfterGeometry,
            infiniteAngleBeforeDynamic: infiniteCacheBeforeDynamic,
            infiniteAngleAfterDynamic: infiniteCacheAfterDynamic,
          },
          qualityModes,
          automaticTransitions,
          offlineProcessing,
          offlineStress,
        };
      }, {
        viewportName: viewport.name,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        scaleFactor: deviceScaleFactor,
      });
      results.push(result);
      await context.close();
    }
  }

  const report = {
    status: "measured",
    generatedAt: new Date().toISOString(),
    budgets,
    matrix: {
      viewports,
      deviceScaleFactors,
      vertexScenarios,
    },
    results,
    offlineProcessing: results.find((result) => result.offlineProcessing)?.offlineProcessing || null,
    offlineStress: results.find((result) => result.offlineStress)?.offlineStress || null,
  };
  const violations = [
    ...collectBudgetViolations(report),
    ...collectQualityViolations(report),
  ];
  report.status = violations.length === 0 ? "passed" : "failed";
  report.violations = violations;
  assert.ok(report.offlineProcessing, "the performance smoke should measure the real offline processing path");
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
  assert.ok(report.offlineStress?.autoInfinity, "the performance smoke should measure offline Auto Infinity");
  assert.equal(report.offlineStress.autoInfinity.requestedTicks, 10000, "Auto Infinity stress should request 10000 ticks");
  assert.equal(report.offlineStress.autoInfinity.processedTicks, 10000, "Auto Infinity stress should process 10000 ticks exactly");
  assert.equal(report.offlineStress.autoInfinity.infinityCountGain, 10000, "Auto Infinity stress should run once per tick");
  assert.ok(report.offlineStress.coreHitBoundary?.angle, "the performance smoke should measure normal core-hit boundaries");
  assert.ok(report.offlineStress.coreHitBoundary?.infiniteAngle, "the performance smoke should measure Infinite Angle core-hit boundaries");
  for (const [track, boundary] of Object.entries(report.offlineStress.coreHitBoundary)) {
    assert.equal(boundary.coreHits, 48000, `${track} boundary should use 48000 core hits`);
    assert.equal(boundary.requestedTicks, 1, `${track} boundary should fit in one offline tick`);
    assert.equal(boundary.processedTicks, 1, `${track} boundary should process one offline tick`);
    assert.ok(Number.isFinite(boundary.exactScoreLog10), `${track} exact boundary score should be finite`);
    assert.ok(Number.isFinite(boundary.offlineScoreLog10), `${track} offline boundary score should be finite`);
  }
  const infiniteAngleExactWork = report.offlineStress.infiniteAngleExactWork;
  assert.ok(infiniteAngleExactWork, "the performance smoke should measure the offline IA exact-work budget");
  assert.ok(
    infiniteAngleExactWork.exactIterations > 0
      && infiniteAngleExactWork.exactIterations <= infiniteAngleExactWork.exactWorkBudget,
    "offline IA exact work must stay within its total budget",
  );
  assert.ok(
    Number.isFinite(infiniteAngleExactWork.wallMilliseconds)
      && infiniteAngleExactWork.wallMilliseconds >= 0,
    "offline IA exact-work measurement should report a finite duration",
  );
  assert.ok(infiniteAngleExactWork.direct, "the performance smoke should measure direct offline IA work");
  assert.ok(
    infiniteAngleExactWork.direct.exactIterations > 0
      && infiniteAngleExactWork.direct.exactIterations <= infiniteAngleExactWork.exactWorkBudget,
    "direct offline IA exact work must stay within its total budget",
  );
  assert.ok(
    Number.isFinite(infiniteAngleExactWork.direct.wallMilliseconds)
      && infiniteAngleExactWork.direct.wallMilliseconds >= 0,
    "direct offline IA exact-work measurement should report a finite duration",
  );
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  assert.deepEqual(violations, [], `performance budget violations:\n${violations.join("\n")}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
