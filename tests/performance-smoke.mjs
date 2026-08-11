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
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  assert.deepEqual(violations, [], `performance budget violations:\n${violations.join("\n")}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
