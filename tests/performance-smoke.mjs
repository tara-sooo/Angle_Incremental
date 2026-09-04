import assert from "node:assert/strict";
import path from "node:path";
import { openGamePage, root, startGameTest, writeReport } from "./browser-harness.mjs";

const reportPath = path.join(root, "output", "performance-smoke.json");
const budgets = Object.freeze({
  simulationP95Ms: 12,
  normalFrameP95Ms: 30,
  highLoadFrameP95Ms: 50,
});
const viewports = Object.freeze([
  Object.freeze({ name: "desktop", width: 1280, height: 800 }),
  Object.freeze({ name: "mobile", width: 390, height: 844 }),
]);
const simulationViewport = viewports[0];
const simulationDeviceScaleFactor = 1;
const renderingDeviceScaleFactors = Object.freeze([1, 2]);
const vertexScenarios = Object.freeze([3, 720, 10000]);

function collectTimingViolations(report) {
  const violations = [];
  const check = (result, scenario, track, metric, value, budget) => {
    if (value > budget) {
      violations.push(
        `${result.viewport.name}/DPR${result.deviceScaleFactor}/${track}/${scenario.vertices} ${metric} p95 ${value.toFixed(3)}ms > ${budget}ms`,
      );
    }
  };
  for (const result of report.simulationResults) {
    for (const scenario of result.scenarios) {
      check(result, scenario, "angle", "simulation", scenario.angle.simulation.p95Ms, budgets.simulationP95Ms);
      check(result, scenario, "infinite-angle", "simulation", scenario.infiniteAngle.simulation.p95Ms, budgets.simulationP95Ms);
    }
  }
  for (const result of report.renderResults) {
    for (const scenario of result.scenarios) {
      const angleBudget = scenario.vertices >= 10000 ? budgets.highLoadFrameP95Ms : budgets.normalFrameP95Ms;
      check(result, scenario, "angle", "frame", scenario.angle.frame.p95Ms, angleBudget);
      check(result, scenario, "infinite-angle", "frame", scenario.infiniteAngle.frame.p95Ms, budgets.highLoadFrameP95Ms);
    }
  }
  return violations;
}

export function budgetViolationKey(violation) {
  return violation
    .replace(/ -?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?ms > -?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?ms$/i, "")
    .trim();
}

async function measureSimulation(page) {
  return page.evaluate(({ vertices }) => {
    const debug = window.__angleDebug;
    const { state } = debug;
    function measure(callback, iterations = 120) {
      for (let index = 0; index < 20; index += 1) callback();
      const samples = [];
      for (let index = 0; index < iterations; index += 1) {
        const startedAt = performance.now();
        callback();
        samples.push(performance.now() - startedAt);
      }
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
    }
    function measureTrack(track, vertices) {
      resetScenario(vertices);
      if (track === "angle") debug.switchMainTab("angle");
      else {
        debug.switchMainTab("infinity");
        debug.switchInfinitySubtab("angle");
      }
      return measure(() => {
        if (track === "angle") debug.update(1 / 60);
        else debug.updateInfiniteAngle(1 / 60);
      });
    }
    return {
      viewport: { name: "desktop", width: 1280, height: 800 },
      deviceScaleFactor: 1,
      scenarios: vertices.map((vertices) => ({
        vertices,
        angle: { simulation: measureTrack("angle", vertices) },
        infiniteAngle: { simulation: measureTrack("infiniteAngle", vertices) },
      })),
    };
  }, { vertices: vertexScenarios });
}

async function measureRendering(page, viewport, deviceScaleFactor) {
  return page.evaluate(({ vertices, viewportData, scaleFactor }) => {
    const debug = window.__angleDebug;
    const { state } = debug;
    function measure(callback, iterations = 120) {
      for (let index = 0; index < 20; index += 1) callback();
      const samples = [];
      for (let index = 0; index < iterations; index += 1) {
        const startedAt = performance.now();
        callback();
        samples.push(performance.now() - startedAt);
      }
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
      const cssWidth = rect?.width ?? 0;
      return {
        cssWidth,
        cssHeight: rect?.height ?? 0,
        pixelWidth: canvas?.width ?? 0,
        pixelHeight: canvas?.height ?? 0,
        backingScale: cssWidth > 0 ? (canvas?.width ?? 0) / cssWidth : 0,
      };
    }
    function measureTrack(track, vertices) {
      resetScenario(vertices);
      if (track === "angle") debug.switchMainTab("angle");
      else {
        debug.switchMainTab("infinity");
        debug.switchInfinitySubtab("angle");
      }
      window.advanceTime(0);
      const frame = measure(() => window.advanceTime(1000 / 60));
      return {
        frame,
        canvas: canvasSnapshot(track === "angle" ? "#gameCanvas" : "#infiniteAngleCanvas"),
      };
    }
    return {
      viewport: viewportData,
      deviceScaleFactor: scaleFactor,
      reportedDevicePixelRatio: window.devicePixelRatio,
      scenarios: vertices.map((vertices) => ({
        vertices,
        angle: measureTrack("angle", vertices),
        infiniteAngle: measureTrack("infiniteAngle", vertices),
      })),
    };
  }, { vertices: vertexScenarios, viewportData: viewport, scaleFactor: deviceScaleFactor });
}

const gameTest = await startGameTest();
try {
  const simulationResults = [];
  const simulationPage = await openGamePage(gameTest.browser, gameTest.origin, {
    viewport: simulationViewport,
    deviceScaleFactor: simulationDeviceScaleFactor,
  });
  try {
    simulationResults.push(await measureSimulation(simulationPage.page));
  } finally {
    await simulationPage.context.close();
  }

  const renderResults = [];
  for (const viewport of viewports) {
    for (const deviceScaleFactor of renderingDeviceScaleFactors) {
      const renderingPage = await openGamePage(gameTest.browser, gameTest.origin, {
        viewport,
        deviceScaleFactor,
      });
      try {
        renderResults.push(await measureRendering(renderingPage.page, viewport, deviceScaleFactor));
      } finally {
        await renderingPage.context.close();
      }
    }
  }

  const report = {
    status: "measured",
    generatedAt: new Date().toISOString(),
    budgets,
    matrix: {
      simulation: {
        viewport: simulationViewport,
        deviceScaleFactors: [simulationDeviceScaleFactor],
        vertexScenarios,
        tracks: ["angle", "infiniteAngle"],
        reason: "simulation does not depend on viewport or input DPR; one initialized context avoids duplicate work",
      },
      rendering: {
        viewports,
        deviceScaleFactors: renderingDeviceScaleFactors,
        vertexScenarios,
        tracks: ["angle", "infiniteAngle"],
        reason: "rendering retains layout, effective-DPR, track, and load timing; input-DPR3 cap is asserted in render-regression",
      },
    },
    simulationResults,
    renderResults,
  };
  const budgetViolations = collectTimingViolations(report);
  report.budgetViolations = budgetViolations;
  report.budgetViolationKeys = budgetViolations.map(budgetViolationKey);
  report.qualityViolations = [];
  report.violations = budgetViolations;
  report.status = budgetViolations.length === 0 ? "passed" : "failed";
  await writeReport(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
  assert.deepEqual(budgetViolations, [], `performance budget violations:\n${budgetViolations.join("\n")}`);
} finally {
  await gameTest.close();
}
