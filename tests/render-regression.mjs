import assert from "node:assert/strict";
import path from "node:path";
import { openGamePage, root, startGameTest, writeReport } from "./browser-harness.mjs";

const reportPath = path.join(root, "output", "render-regression.json");
const contexts = Object.freeze([
  Object.freeze({ name: "desktop", width: 1280, height: 800, deviceScaleFactor: 1 }),
  Object.freeze({ name: "mobile", width: 390, height: 844, deviceScaleFactor: 3 }),
]);

function collectViolations(result) {
  const violations = [];
  const prefix = `${result.viewport.name}/DPR${result.deviceScaleFactor}`;
  const expectedProfiles = {
    high: { devicePixelRatio: 2, vertexLimit: 720, frameIntervalMs: 0 },
    balanced: { devicePixelRatio: 1.5, vertexLimit: 360, frameIntervalMs: 1000 / 30 },
    low: { devicePixelRatio: 1, vertexLimit: 180, frameIntervalMs: 1000 / 30 },
  };
  const angleBefore = result.cache.angleBeforeDynamic.angleBuilds;
  const angleAfterDynamic = result.cache.angleAfterDynamic.angleBuilds;
  const angleAfterGeometry = result.cache.angleAfterGeometry.angleBuilds;
  const infiniteBefore = result.cache.infiniteAngleBeforeDynamic.infiniteAngleBuilds;
  const infiniteAfter = result.cache.infiniteAngleAfterDynamic.infiniteAngleBuilds;
  if (angleAfterDynamic !== angleBefore) violations.push(`${prefix}/angle dynamic update rebuilt the static cache`);
  if (angleAfterGeometry <= angleAfterDynamic) violations.push(`${prefix}/angle geometry change did not rebuild the static cache`);
  if (infiniteAfter !== infiniteBefore) violations.push(`${prefix}/infinite-angle dynamic update rebuilt the static cache`);

  for (const mode of result.qualityModes) {
    const expected = expectedProfiles[mode.level];
    if (!expected) {
      violations.push(`${prefix}/unknown render quality mode ${mode.level}`);
      continue;
    }
    if (Math.abs(mode.state.devicePixelRatio - expected.devicePixelRatio) > 0.001) {
      violations.push(`${prefix}/${mode.level} device pixel ratio ${mode.state.devicePixelRatio} !== ${expected.devicePixelRatio}`);
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
  }

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
  return violations;
}

async function inspectRendering(page, context) {
  return page.evaluate(({ contextData }) => {
    const debug = window.__angleDebug;
    const { state } = debug;
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
    const infiniteAngleBeforeDynamic = debug.canvasCacheStats();
    state.infiniteAnglePointProgress = 0.37;
    window.advanceTime(0);
    const infiniteAngleAfterDynamic = debug.canvasCacheStats();

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
    const automaticTransitions = { initial: debug.renderQualityState() };
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

    return {
      viewport: contextData,
      deviceScaleFactor: contextData.deviceScaleFactor,
      reportedDevicePixelRatio: window.devicePixelRatio,
      cache: {
        angleBeforeDynamic: cacheBeforeDynamic,
        angleAfterDynamic: cacheAfterDynamic,
        angleAfterGeometry: cacheAfterGeometry,
        infiniteAngleBeforeDynamic,
        infiniteAngleAfterDynamic,
      },
      qualityModes,
      automaticTransitions,
    };
  }, { contextData: context });
}

const gameTest = await startGameTest();
try {
  const results = [];
  for (const context of contexts) {
    const gamePage = await openGamePage(gameTest.browser, gameTest.origin, {
      viewport: { width: context.width, height: context.height },
      deviceScaleFactor: context.deviceScaleFactor,
    });
    try {
      results.push(await inspectRendering(gamePage.page, context));
    } finally {
      await gamePage.context.close();
    }
  }
  const violations = results.flatMap(collectViolations);
  const report = {
    status: violations.length === 0 ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    matrix: { contexts, qualityModes: ["high", "balanced", "low"], inputDpr3Cap: true },
    results,
    violations,
  };
  await writeReport(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
  assert.deepEqual(violations, [], `render regression failures:\n${violations.join("\n")}`);
} finally {
  await gameTest.close();
}
