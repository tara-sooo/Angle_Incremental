import assert from "node:assert/strict";
import path from "node:path";
import { openGamePage, root, startGameTest, writeReport } from "./browser-harness.mjs";
import {
  AGGREGATION_STATISTIC,
  BATCH_COUNT,
  PERFORMANCE_METRIC_VERSION,
  TIMED_ITERATIONS,
  WARMUP_ITERATIONS,
  aggregatePerformanceMetric,
  readPerformanceMetricP95,
} from "../scripts/performance-metrics.mjs";

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
const measurement = Object.freeze({
  batchCount: BATCH_COUNT,
  warmupIterations: WARMUP_ITERATIONS,
  timedIterations: TIMED_ITERATIONS,
  aggregateStatistic: AGGREGATION_STATISTIC,
  resetSemantics: "resetScenario restores deterministic progression counters, gains, scores, timers, and positions before every batch; state advances during that batch's warmup and timed samples",
});

function collectTimingViolations(report) {
  const violations = [];
  const check = (result, scenario, track, metricName, metric, budget) => {
    const value = readPerformanceMetricP95(metric, PERFORMANCE_METRIC_VERSION);
    if (metric.budgetMs !== budget) throw new Error(`${track} ${metricName} budget does not match the selected scenario budget`);
    if (value > budget) {
      violations.push(
        `${result.viewport.name}/DPR${result.deviceScaleFactor}/${track}/${scenario.vertices} ${metricName} p95 ${value.toFixed(3)}ms > ${budget}ms`,
      );
    }
  };
  for (const result of report.simulationResults) {
    for (const scenario of result.scenarios) {
      check(result, scenario, "angle", "simulation", scenario.angle.simulation, budgets.simulationP95Ms);
      check(result, scenario, "infinite-angle", "simulation", scenario.infiniteAngle.simulation, budgets.simulationP95Ms);
    }
  }
  for (const result of report.renderResults) {
    for (const scenario of result.scenarios) {
      const angleBudget = scenario.vertices >= 10000 ? budgets.highLoadFrameP95Ms : budgets.normalFrameP95Ms;
      check(result, scenario, "angle", "frame", scenario.angle.frame, angleBudget);
      check(result, scenario, "infinite-angle", "frame", scenario.infiniteAngle.frame, budgets.highLoadFrameP95Ms);
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
  return page.evaluate(({ vertices, batchCount, warmupIterations, timedIterations }) => {
    const debug = window.__angleDebug;
    const { state } = debug;
    const initialState = structuredClone(state);
    function measure(callback) {
      for (let index = 0; index < warmupIterations; index += 1) callback();
      const samples = [];
      for (let index = 0; index < timedIterations; index += 1) {
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
    function measureBatches(callback) {
      const batches = [];
      for (let index = 0; index < batchCount; index += 1) batches.push(callback());
      return { batches };
    }
    function resetScenario(vertices) {
      Object.assign(state, structuredClone(initialState), {
        activeChallenge: 0,
        activeChallengeTime: 0,
        activeTowerChallenge: 0,
        activeTowerChallengeTime: 0,
        vertices,
        verticesExact: String(vertices),
        speedLevel: 300,
        speedLevelExact: "300",
        gainLevel: 100,
        gainLevelExact: "100",
        infiniteAngleUnlocked: true,
        infiniteAngleVertexLevel: vertices - 3,
        infiniteAngleSpeedLevel: 300,
        infiniteAngleGainLevel: 100,
      });
    }
    function measureTrack(track, vertices) {
      if (track === "angle") debug.switchMainTab("angle");
      else {
        debug.switchMainTab("infinity");
        debug.switchInfinitySubtab("angle");
      }
      return measureBatches(() => {
        resetScenario(vertices);
        return measure(() => {
          if (track === "angle") debug.update(1 / 60);
          else debug.updateInfiniteAngle(1 / 60);
        });
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
  }, {
    vertices: vertexScenarios,
    batchCount: BATCH_COUNT,
    warmupIterations: WARMUP_ITERATIONS,
    timedIterations: TIMED_ITERATIONS,
  });
}

async function measureRendering(page, viewport, deviceScaleFactor) {
  return page.evaluate(({ vertices, viewportData, scaleFactor, batchCount, warmupIterations, timedIterations }) => {
    const debug = window.__angleDebug;
    const { state } = debug;
    const initialState = structuredClone(state);
    function measure(callback) {
      for (let index = 0; index < warmupIterations; index += 1) callback();
      const samples = [];
      for (let index = 0; index < timedIterations; index += 1) {
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
    function measureBatches(callback) {
      const batches = [];
      for (let index = 0; index < batchCount; index += 1) batches.push(callback());
      return { batches };
    }
    function resetScenario(vertices) {
      Object.assign(state, structuredClone(initialState), {
        activeChallenge: 0,
        activeChallengeTime: 0,
        activeTowerChallenge: 0,
        activeTowerChallengeTime: 0,
        vertices,
        verticesExact: String(vertices),
        speedLevel: 300,
        speedLevelExact: "300",
        gainLevel: 100,
        gainLevelExact: "100",
        infiniteAngleUnlocked: true,
        infiniteAngleVertexLevel: vertices - 3,
        infiniteAngleSpeedLevel: 300,
        infiniteAngleGainLevel: 100,
      });
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
      if (track === "angle") debug.switchMainTab("angle");
      else {
        debug.switchMainTab("infinity");
        debug.switchInfinitySubtab("angle");
      }
      const metric = measureBatches(() => {
        resetScenario(vertices);
        window.advanceTime(0);
        return measure(() => window.advanceTime(1000 / 60));
      });
      return {
        frame: metric,
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
  }, {
    vertices: vertexScenarios,
    viewportData: viewport,
    scaleFactor: deviceScaleFactor,
    batchCount: BATCH_COUNT,
    warmupIterations: WARMUP_ITERATIONS,
    timedIterations: TIMED_ITERATIONS,
  });
}

function finalizeSimulationResults(results) {
  return results.map((result) => ({
    ...result,
    scenarios: result.scenarios.map((scenario) => ({
      ...scenario,
      angle: {
        ...scenario.angle,
        simulation: aggregatePerformanceMetric(scenario.angle.simulation, budgets.simulationP95Ms),
      },
      infiniteAngle: {
        ...scenario.infiniteAngle,
        simulation: aggregatePerformanceMetric(scenario.infiniteAngle.simulation, budgets.simulationP95Ms),
      },
    })),
  }));
}

function finalizeRenderResults(results) {
  return results.map((result) => ({
    ...result,
    scenarios: result.scenarios.map((scenario) => ({
      ...scenario,
      angle: {
        ...scenario.angle,
        frame: aggregatePerformanceMetric(
          scenario.angle.frame,
          scenario.vertices >= 10000 ? budgets.highLoadFrameP95Ms : budgets.normalFrameP95Ms,
        ),
      },
      infiniteAngle: {
        ...scenario.infiniteAngle,
        frame: aggregatePerformanceMetric(scenario.infiniteAngle.frame, budgets.highLoadFrameP95Ms),
      },
    })),
  }));
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
    performanceMetricVersion: PERFORMANCE_METRIC_VERSION,
    measurement,
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
    simulationResults: finalizeSimulationResults(simulationResults),
    renderResults: finalizeRenderResults(renderResults),
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
