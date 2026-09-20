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
  offlineLongResumeWallMs: 5000,
  offlineLateEternityAutomationMillionWallMs: 5000,
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
  for (const [ticks, resume] of Object.entries(report.offlineStress.quietResume)) {
    if (resume.wallMilliseconds > budgets.offlineLongResumeWallMs) {
      violations.push(`offline quiet ${ticks}-tick resume wall ${resume.wallMilliseconds.toFixed(3)}ms > ${budgets.offlineLongResumeWallMs}ms`);
    }
  }
  const lateEternityMillion = report.offlineStress.lateEternityAutomationMillion;
  if (lateEternityMillion.wallMilliseconds > budgets.offlineLateEternityAutomationMillionWallMs) {
    violations.push(`offline late-Eternity automation million wall ${lateEternityMillion.wallMilliseconds.toFixed(3)}ms > ${budgets.offlineLateEternityAutomationMillionWallMs}ms`);
  }
  for (const [route, resume] of Object.entries(report.offlineStress.timelineResume)) {
    if (resume.wallMilliseconds > budgets.offlineLongResumeWallMs) {
      violations.push(`offline Timeline ${route} million-tick resume wall ${resume.wallMilliseconds.toFixed(3)}ms > ${budgets.offlineLongResumeWallMs}ms`);
    }
  }
  return violations;
}

async function measureOfflineStress(page) {
  return page.evaluate(async () => {
    const debug = window.__angleDebug;
    const { runtime, state } = debug;
    const differentialExactFields = Object.freeze([
      "vertices",
      "verticesExact",
      "ic8VertexUpgradeLevel",
      "ic8VertexUpgradeLevelExact",
      "speedLevel",
      "speedLevelExact",
      "gainLevel",
      "gainLevelExact",
      "lastVertexIndex",
      "generationCount",
      "coreBoostCount",
      "infinityCount",
      "infinityCountExact",
      "infinityPointsExact",
      "eternityCount",
      "eternityCountExact",
      "scoreTfClaims",
      "ipTfClaims",
      "eternityTfClaims",
      "infiniteAngleUnlocked",
      "infiniteAngleSpeedLevel",
      "infiniteAngleVertexLevel",
      "infiniteAngleGainLevel",
      "infiniteAngleLastVertexIndex",
      "infinityUpgradeMask",
      "ipGainUpgradeLevel",
      "infiniteAngleUpgradeLevel",
      "softcapUpgradeLevel",
      "tc4BaseGainLevel",
      "tc4BaseGainPriceStep",
      "tc4InfinityScoreVertexGainLevel",
      "tc4InfinityScoreVertexGainPriceStep",
      "tc4FreeCoreBoostLevel",
      "tc4FreeCoreBoostPriceStep",
      "towerFloor",
      "activeChallenge",
      "completedChallenges",
      "activeTowerChallenge",
      "completedTowerChallenges",
      "infiniteCapBroken",
      "achievementMask",
      "achievementMaskHigh",
      "eternityMilestoneMask",
      "eternityMilestoneChoice",
      "timelinePurchasedNodes",
      "unlockedMainTabs",
      "fastestInfinityChallengeTimes",
      "fastestTowerChallengeTimes",
      "fastestInfinityTime",
      "fastestInfinityRealTime",
      "fastestEternityTime",
      "fastestEternityRealTime",
      "lastInfinityRuns",
      "lastEternityRuns",
      "noGenerationCoreBoostReached",
      "currentInfinityRunHadGeneration",
      "currentInfinityRunHadCoreBoost",
      "automationEnabled",
      "autoBuySpeed",
      "autoBuyVertex",
      "autoBuyGain",
      "autoBuyInfinityUpgrades",
      "autoBuildTower",
      "autoRunGeneration",
      "autoRunCoreBoost",
      "autoRunInfinity",
      "autoBuyInfiniteAngleSpeed",
      "autoBuyInfiniteAngleVertex",
      "autoBuyInfiniteAngleGain",
      "offlineProgressEnabled",
      "offlineTickCount",
      "timeFluxCapacityLevel",
      "timeFluxGainLevel",
    ]);
    const differentialApproximateFields = Object.freeze({
      scoreLog10: 1e-9,
      totalScoreLog10: 1e-9,
      generationScoreLog10: 1e-9,
      previousGenerationScoreLog10: 1e-9,
      generationScoreMultiplierLog10: 1e-9,
      currentGainLog10: 1e-9,
      generationCostFactor: 1e-12,
      infiniteScoreLog10: 1e-9,
      infiniteAngleCurrentGainLog10: 1e-9,
      infinityPointsLog10: 1e-9,
      timeFlux: 1e-9,
      pointProgress: 1e-6,
      totalVertexProgress: 1e-6,
      infiniteAnglePointProgress: 1e-6,
      infiniteAngleTotalVertexProgress: 1e-6,
      totalPlayTime: 1e-6,
      totalRealPlayTime: 1e-6,
      currentInfinityRunTime: 1e-6,
      currentInfinityRealTime: 1e-6,
      currentEternityRunTime: 1e-6,
      currentEternityRealTime: 1e-6,
      currentGenerationRunTime: 1e-6,
      activeChallengeTime: 1e-6,
      activeTowerChallengeTime: 1e-6,
      timelineParallelSecondsSinceIc8Clear: 1e-6,
      ic8VertexDecayElapsed: 1e-6,
      lastEarnedLog10: 1e-9,
    });
    const differentialReportExactFields = Object.freeze([
      "generationCount",
      "coreBoostCount",
      "infinityCountExact",
      "infinityPointsExact",
      "eternityCountExact",
      "scoreUnlocked",
      "generationUnlocked",
      "coreBoostUnlocked",
      "infinityUnlocked",
      "infiniteAngleUnlocked",
      "eternityUnlocked",
    ]);
    const differentialReportApproximateFields = Object.freeze({
      scoreLog10: 1e-9,
      infinityPointsLog10: 1e-9,
      infiniteScoreLog10: 1e-9,
      timeFlux: 1e-9,
      totalPlayTime: 1e-6,
    });

    function stateProjection(
      snapshot,
      { omitHistory = false, approximateFields = differentialApproximateFields } = {},
    ) {
      const exactFields = omitHistory
        ? differentialExactFields.filter((key) => key !== "lastInfinityRuns")
        : differentialExactFields;
      return {
        exact: Object.fromEntries(exactFields.map((key) => [key, snapshot[key]])),
        approximate: Object.fromEntries(
          Object.keys(approximateFields).map((key) => [key, snapshot[key]]),
        ),
      };
    }

    function exactMismatch(expected, actual, path, mismatches) {
      if (mismatches.length >= 20 || Object.is(expected, actual)) return;
      if (typeof expected !== typeof actual || Array.isArray(expected) !== Array.isArray(actual)) {
        mismatches.push({ path, expected, actual, policy: "exact" });
        return;
      }
      if (expected === null || actual === null) {
        mismatches.push({ path, expected, actual, policy: "exact" });
        return;
      }
      if (Array.isArray(expected)) {
        if (expected.length !== actual.length) {
          mismatches.push({
            path: path + ".length",
            expected: expected.length,
            actual: actual.length,
            policy: "exact",
          });
          return;
        }
        expected.forEach((value, index) => exactMismatch(value, actual[index], path + "[" + index + "]", mismatches));
        return;
      }
      if (expected && typeof expected === "object") {
        const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
        keys.forEach((key) => exactMismatch(expected[key], actual[key], path + "." + key, mismatches));
        return;
      }
      mismatches.push({ path, expected, actual, policy: "exact" });
    }

    function approximateMismatch(expected, actual, path, tolerance, mismatches) {
      if (mismatches.length >= 20 || Object.is(expected, actual)) return;
      if (
        typeof expected !== "number"
        || typeof actual !== "number"
        || !Number.isFinite(expected)
        || !Number.isFinite(actual)
        || Math.abs(expected - actual) > tolerance
      ) {
        mismatches.push({ path, expected, actual, tolerance, policy: "approximate" });
      }
    }

    function compareProjection(
      expected,
      actual,
      path,
      mismatches,
      approximateFields = differentialApproximateFields,
    ) {
      differentialExactFields.forEach((key) => exactMismatch(
        expected.exact[key],
        actual.exact[key],
        path + ".exact." + key,
        mismatches,
      ));
      Object.entries(approximateFields).forEach(([key, tolerance]) => approximateMismatch(
        expected.approximate[key],
        actual.approximate[key],
        path + ".approximate." + key,
        tolerance,
        mismatches,
      ));
    }

    function compareOfflineSnapshot(
      expected,
      actual,
      path,
      mismatches,
      approximateFields = differentialReportApproximateFields,
    ) {
      if (!expected || !actual) {
        exactMismatch(expected, actual, path, mismatches);
        return;
      }
      differentialReportExactFields.forEach((key) => exactMismatch(
        expected[key],
        actual[key],
        path + "." + key,
        mismatches,
      ));
      Object.entries(approximateFields).forEach(([key, tolerance]) => approximateMismatch(
        expected[key],
        actual[key],
        path + "." + key,
        tolerance,
        mismatches,
      ));
    }

    function setLogState(prefix, log10) {
      state[prefix + "Log10"] = log10;
      state[prefix] = runtime.valueFromLog10(log10);
    }

    function configureDifferentialBase(ticks, nodes = []) {
      resetScenario(3);
      Object.assign(state, {
        activeChallenge: 0,
        activeTowerChallenge: 0,
        automationEnabled: false,
        autoBuySpeed: false,
        autoBuyVertex: false,
        autoBuyGain: false,
        autoBuyInfinityUpgrades: false,
        autoBuildTower: false,
        autoRunGeneration: false,
        autoRunCoreBoost: false,
        autoRunInfinity: false,
        autoBuyInfiniteAngleSpeed: false,
        autoBuyInfiniteAngleVertex: false,
        autoBuyInfiniteAngleGain: false,
        completedChallenges: (1 << (6 - 1)) | (1 << (8 - 1)),
        completedTowerChallenges: 0,
        timelinePurchasedNodes: nodes.map((id) => ({ id })),
        timelineParallelSecondsSinceIc8Clear: 5,
        towerFloor: 10,
        infiniteCapBroken: true,
        generationCount: 0,
        coreBoostCount: 0,
        infinityUpgradeMask: 0,
        ipGainUpgradeLevel: 0,
        infiniteAngleUpgradeLevel: 0,
        softcapUpgradeLevel: 0,
        speedLevel: 0,
        gainLevel: 0,
        pointProgress: 0,
        totalVertexProgress: 0,
        infiniteAngleUnlocked: nodes.length > 0,
        infiniteAngleSpeedLevel: 0,
        infiniteAngleVertexLevel: 0,
        infiniteAngleGainLevel: 0,
        infiniteAnglePointProgress: 0,
        infiniteAngleTotalVertexProgress: 0,
        currentGain: 1,
        currentGainLog10: 0,
        infinityCount: 1,
        eternityCount: 8,
        infinityPoints: 0,
        infinityPointsLog10: -Infinity,
        infinityPointsExact: "0",
        lastInfinityRuns: [],
        lastEternityRuns: [],
        fastestInfinityChallengeTimes: Array(8).fill(0),
        fastestTowerChallengeTimes: Array(4).fill(0),
        fastestInfinityTime: 0,
        fastestInfinityRealTime: 0,
        fastestEternityTime: 0,
        fastestEternityRealTime: 0,
        achievementMask: 0,
        achievementMaskHigh: 0,
        eternityMilestoneMask: 0,
        eternityMilestoneChoice: "",
        unlockedMainTabs: [],
        totalPlayTime: 0,
        totalRealPlayTime: 0,
        currentInfinityRunTime: 0,
        currentInfinityRealTime: 0,
        currentEternityRunTime: 0,
        currentEternityRealTime: 0,
        currentGenerationRunTime: 0,
        activeChallengeTime: 0,
        activeTowerChallengeTime: 0,
        bestInfinityCountPerSecond: 0,
        infinityCountRateRemainder: 0,
        offlineProgressEnabled: true,
        offlineTickCount: ticks,
        showFloatingText: false,
        noGenerationCoreBoostReached: false,
        currentInfinityRunHadGeneration: false,
        currentInfinityRunHadCoreBoost: false,
      });
      setLogState("score", 100);
      setLogState("totalScore", 100);
      setLogState("generationScore", 100);
      setLogState("infiniteScore", nodes.length > 0 ? 50 : -Infinity);
      runtime.setExactIntegerState(state, "verticesExact", "vertices", 3n);
      runtime.setExactIntegerState(state, "ic8VertexUpgradeLevelExact", "ic8VertexUpgradeLevel", 0n);
      runtime.setExactIntegerState(state, "speedLevelExact", "speedLevel", 0n);
      runtime.setExactIntegerState(state, "gainLevelExact", "gainLevel", 0n);
      runtime.setExactIntegerState(state, "infinityCountExact", "infinityCount", 1n);
      runtime.setExactIntegerState(state, "eternityCountExact", "eternityCount", 8n);
      runtime.syncInfinityPointCachesFromExact(10n ** 6n);
    }

    function configureAutoInfinityVariant(
      ticks,
      nodes = [],
      completedChallenges = 0,
      thresholdLog10 = 0,
    ) {
      configureDifferentialBase(ticks, nodes);
      Object.assign(state, {
        automationEnabled: true,
        autoRunInfinity: true,
        completedChallenges,
        infinityUpgradeMask: (1 << 1) | (1 << 12),
        achievementMask: 1 << (19 - 1),
        autoInfinityPointThresholdLog10: thresholdLog10,
        autoInfinityPointThreshold: runtime.valueFromLog10(thresholdLog10),
        bestInfinityCountPerSecond: 30,
        infinityCountRateRemainder: 0,
      });
      setLogState("score", 309);
      setLogState("totalScore", 309);
      setLogState("generationScore", 309);
    }

    function configureAutoInfinityDifferential(ticks) {
      configureAutoInfinityVariant(ticks);
    }

    function configureAutoInfinityRemainderDifferential(ticks) {
      configureAutoInfinityVariant(ticks);
      state.infinityCountRateRemainder = 0.5;
    }

    function configureAutoInfinityCustomThresholdDifferential(ticks) {
      configureAutoInfinityVariant(ticks, [], 0, 1);
    }

    function configureAutoInfinityIc6Differential(ticks) {
      configureAutoInfinityVariant(ticks, [], 1 << (6 - 1));
    }

    function configureAutoInfinityTimelineDifferential(ticks) {
      configureAutoInfinityVariant(ticks, ["Real-BC16500"]);
    }

    function configureAutoInfinityAutobuyDifferential(ticks) {
      configureAutoInfinityVariant(ticks);
      state.autoBuySpeed = true;
    }

    function configureGenerationDifferential(ticks) {
      configureDifferentialBase(ticks);
      Object.assign(state, {
        automationEnabled: true,
        autoRunGeneration: true,
        achievementMask: 1 << (19 - 1),
        autoGenerationScoreMultiplierThreshold: 0,
        autoGenerationCostMultiplierThreshold: 0,
        autoGenerationMinimumSeconds: 0,
        autoGenerationLegacyOrMode: false,
      });
      setLogState("score", 7);
      setLogState("totalScore", 7);
      setLogState("generationScore", 7);
    }

    function configureCoreBoostDifferential(ticks) {
      configureDifferentialBase(ticks);
      Object.assign(state, {
        generationCount: 1,
        automationEnabled: true,
        autoRunCoreBoost: true,
        achievementMask: 1 << (19 - 1),
      });
      setLogState("score", 20);
      setLogState("totalScore", 20);
      setLogState("generationScore", 20);
    }

    function configureGenerationCoreBoostDifferential(ticks) {
      configureDifferentialBase(ticks);
      Object.assign(state, {
        generationCount: 1,
        automationEnabled: true,
        autoRunGeneration: true,
        autoRunCoreBoost: true,
        achievementMask: 1 << (19 - 1),
        autoGenerationScoreMultiplierThreshold: 0,
        autoGenerationCostMultiplierThreshold: 0,
        autoGenerationMinimumSeconds: 0,
        autoGenerationLegacyOrMode: false,
      });
      setLogState("score", 20);
      setLogState("totalScore", 20);
      setLogState("generationScore", 20);
    }

    function configureAutoInfinityGenerationDifferential(ticks) {
      configureAutoInfinityVariant(ticks);
      Object.assign(state, {
        autoRunGeneration: true,
        autoGenerationScoreMultiplierThreshold: 0,
        autoGenerationCostMultiplierThreshold: 0,
        autoGenerationMinimumSeconds: 0,
        autoGenerationLegacyOrMode: false,
      });
    }

    function configureAutoInfinityCoreBoostDifferential(ticks) {
      configureAutoInfinityVariant(ticks);
      Object.assign(state, {
        generationCount: 1,
        autoRunCoreBoost: true,
      });
    }

    function configureAutoInfinityGenerationCoreBoostDifferential(ticks) {
      configureAutoInfinityGenerationDifferential(ticks);
      state.generationCount = 1;
      state.autoRunCoreBoost = true;
    }

    function configureGenerationUnsupportedChallengeDifferential(ticks) {
      configureGenerationDifferential(ticks);
      state.activeChallenge = 5;
    }

    function configureGenerationSingleTickDifferential(ticks) {
      configureGenerationDifferential(ticks);
    }

    async function runDifferential(
      name,
      configure,
      ticks,
      {
        reprimeScore = false,
        aggregateHistory = false,
        omitApproximateStateFields = [],
        omitApproximateReportFields = [],
      } = {},
    ) {
      const approximateStateFields = Object.fromEntries(
        Object.entries(differentialApproximateFields)
          .filter(([key]) => !omitApproximateStateFields.includes(key)),
      );
      const approximateReportFields = Object.fromEntries(
        Object.entries(differentialReportApproximateFields)
          .filter(([key]) => !omitApproximateReportFields.includes(key)),
      );
      configure(ticks);
      const startingState = runtime.snapshotRuntimeState();
      const startingNormalAutobuyElapsed = runtime.normalAutobuyElapsed;
      const originalUpdateUi = runtime.updateUi;
      const originalSaveGame = runtime.saveGame;
      const originalCreateCheckpoint = runtime.createCheckpoint;
      const originalUpdateOfflineReportUi = runtime.updateOfflineReportUi;
      const originalResetBelowInfinity = reprimeScore ? runtime.resetBelowInfinity : null;
      if (reprimeScore) {
        runtime.resetBelowInfinity = (...args) => {
          const result = originalResetBelowInfinity(...args);
          setLogState("score", 309);
          return result;
        };
      }
      const tickSeconds = runtime.MAX_SIMULATION_STEP_SECONDS;
      const restoreStartingState = () => {
        runtime.restoreRuntimeState(startingState);
        runtime.normalAutobuyElapsed = startingNormalAutobuyElapsed;
        runtime.offlineReport = null;
        runtime.offlineProcessing = false;
      };
      let canonical;
      let accelerated;
      try {
        runtime.updateUi = () => {};
        runtime.saveGame = () => true;
        runtime.createCheckpoint = () => true;
        runtime.updateOfflineReportUi = () => {};

        restoreStartingState();
        const canonicalBefore = runtime.offlineSnapshot();
        const canonicalStartedAt = performance.now();
        for (let tick = 0; tick < ticks; tick += 1) debug.update(tickSeconds);
        canonical = {
          before: canonicalBefore,
          after: runtime.offlineSnapshot(),
          state: stateProjection(runtime.snapshotRuntimeState(), {
            omitHistory: aggregateHistory,
            approximateFields: approximateStateFields,
          }),
          wallTimeMs: performance.now() - canonicalStartedAt,
          fullSimulationIterations: ticks,
          normalAutobuyElapsed: runtime.normalAutobuyElapsed,
        };

        restoreStartingState();
        const acceleratedStartedAt = performance.now();
        const report = await debug.processOfflineElapsed(
          tickSeconds * ticks,
          "differential-" + name,
          { clockSource: "server" },
        );
        accelerated = {
          report,
          before: report?.before ?? null,
          after: report?.after ?? runtime.offlineSnapshot(),
          state: stateProjection(runtime.snapshotRuntimeState(), {
            omitHistory: aggregateHistory,
            approximateFields: approximateStateFields,
          }),
          wallTimeMs: performance.now() - acceleratedStartedAt,
          diagnostics: runtime.offlineDiagnostics,
          work: runtime.offlineWorkStats,
          normalAutobuyElapsed: runtime.normalAutobuyElapsed,
        };
      } finally {
        runtime.updateUi = originalUpdateUi;
        runtime.saveGame = originalSaveGame;
        runtime.createCheckpoint = originalCreateCheckpoint;
        runtime.updateOfflineReportUi = originalUpdateOfflineReportUi;
        if (reprimeScore) runtime.resetBelowInfinity = originalResetBelowInfinity;
      }

      const mismatches = [];
      compareProjection(
        canonical.state,
        accelerated.state,
        "state",
        mismatches,
        approximateStateFields,
      );
      compareOfflineSnapshot(
        canonical.before,
        accelerated.before,
        "report.before",
        mismatches,
        approximateReportFields,
      );
      compareOfflineSnapshot(
        canonical.after,
        accelerated.after,
        "report.after",
        mismatches,
        approximateReportFields,
      );
      if (Math.abs(canonical.normalAutobuyElapsed - accelerated.normalAutobuyElapsed) > 1e-9) {
        mismatches.push({
          path: "normalAutobuyElapsed",
          expected: canonical.normalAutobuyElapsed,
          actual: accelerated.normalAutobuyElapsed,
          tolerance: 1e-9,
          policy: "approximate",
        });
      }
      return {
        name,
        elapsedSeconds: tickSeconds * ticks,
        requestedTicks: ticks,
        policy: {
          exactStateFields: differentialExactFields.filter(
            (key) => !aggregateHistory || key !== "lastInfinityRuns",
          ),
          approximateStateFields,
          exactReportFields: [...differentialReportExactFields],
          approximateReportFields,
          aggregateHistory,
        },
        canonical,
        accelerated,
        comparison: {
          matched: mismatches.length === 0,
          mismatches,
        },
      };
    }

    function collectObservedEventCounts(before, after) {
      const countDelta = (key) => Math.max(
        0,
        Math.floor(Number(after?.[key]) || 0) - Math.floor(Number(before?.[key]) || 0),
      );
      const exactDelta = (key) => {
        try {
          return Number(
            BigInt(String(after?.[key] ?? 0)) - BigInt(String(before?.[key] ?? 0)),
          );
        } catch {
          return 0;
        }
      };
      const bitCount = (value) => {
        let bits = Math.floor(Number(value) || 0) >>> 0;
        let count = 0;
        while (bits !== 0) {
          count += bits & 1;
          bits >>>= 1;
        }
        return count;
      };
      return {
        infinityExecutions: Math.max(0, exactDelta("infinityCountExact")),
        generationResets: countDelta("generationCount"),
        coreBoostResets: countDelta("coreBoostCount"),
        towerBuilds: countDelta("towerFloor"),
        automaticUnlocks: Number(Boolean(after?.infiniteAngleUnlocked) && !Boolean(before?.infiniteAngleUnlocked)),
        automaticCompletions: bitCount(after?.completedChallenges) - bitCount(before?.completedChallenges)
          + bitCount(after?.completedTowerChallenges) - bitCount(before?.completedTowerChallenges),
      };
    }

    async function measureEventfulBaseline(name, ticks, configure, { reprimeScore = false } = {}) {
      configure(ticks);
      const beforeState = runtime.snapshotRuntimeState();
      const originalResetBelowInfinity = reprimeScore ? runtime.resetBelowInfinity : null;
      if (reprimeScore) {
        runtime.resetBelowInfinity = (...args) => {
          const result = originalResetBelowInfinity(...args);
          setLogState("score", 309);
          return result;
        };
      }
      const startedAt = performance.now();
      try {
        const report = await debug.processOfflineElapsed(
          runtime.MAX_SIMULATION_STEP_SECONDS * ticks,
          "baseline-" + name,
          { clockSource: "server" },
        );
        const afterState = runtime.snapshotRuntimeState();
        return {
          name,
          baselineOnly: true,
          requestedTicks: report?.requestedTicks ?? 0,
          processedTicks: report?.processedTicks ?? 0,
          fullSimulationIterations: runtime.offlineDiagnostics?.fullSimulationIterations ?? report?.simulationIterations ?? 0,
          bulkProcessedTicks: runtime.offlineDiagnostics?.bulkProcessedTicks ?? report?.bulkProcessedTicks ?? 0,
          bulkIterations: runtime.offlineDiagnostics?.bulkIterations ?? report?.bulkIterations ?? 0,
          aggregatedTicks: runtime.offlineDiagnostics?.aggregatedTicks ?? 0,
          cyclesAggregated: runtime.offlineDiagnostics?.cyclesAggregated ?? 0,
          eventBoundaryCount: runtime.offlineDiagnostics?.eventBoundaryCount ?? 0,
          eventBoundaryIterations: runtime.offlineDiagnostics?.eventBoundaryIterations ?? 0,
          guardedFallbackIterations: runtime.offlineDiagnostics?.guardedFallbackIterations ?? 0,
          predictionInvalidations: runtime.offlineDiagnostics?.predictionInvalidations ?? 0,
          eventProbeIterations: runtime.offlineDiagnostics?.eventProbeIterations ?? 0,
          precisionReduced: runtime.offlineDiagnostics?.precisionReduced ?? false,
          wallTimeMs: runtime.offlineDiagnostics?.wallTimeMs ?? (performance.now() - startedAt),
          wallMilliseconds: performance.now() - startedAt,
          eventCounts: runtime.offlineDiagnostics?.eventCounts ?? {},
          eventFamilyCounts: runtime.offlineDiagnostics?.eventFamilyCounts ?? {},
          observedEventCounts: collectObservedEventCounts(beforeState, afterState),
          before: report?.before ?? null,
          after: report?.after ?? null,
        };
      } finally {
        if (reprimeScore) runtime.resetBelowInfinity = originalResetBelowInfinity;
      }
    }

    async function measureLateEternityAutomationMillion() {
      const requestedTicks = runtime.OFFLINE_PROGRESS_MAX_TICKS;
      configureLateEternityAutomationMillion(requestedTicks);
      const startedAt = performance.now();
      const report = await debug.processOfflineElapsed(
        runtime.MAX_SIMULATION_STEP_SECONDS * requestedTicks,
        "performance-late-eternity-automation-million",
        { clockSource: "server" },
      );
      const diagnostics = runtime.offlineDiagnostics;
      return {
        requestedTicks: report?.requestedTicks ?? 0,
        processedTicks: report?.processedTicks ?? 0,
        simulationIterations: report?.simulationIterations ?? 0,
        fullSimulationIterations: diagnostics?.fullSimulationIterations ?? report?.simulationIterations ?? 0,
        bulkIterations: diagnostics?.bulkIterations ?? 0,
        bulkProcessedTicks: diagnostics?.bulkProcessedTicks ?? 0,
        eventBoundaryCount: diagnostics?.eventBoundaryCount ?? 0,
        eventBoundaryIterations: diagnostics?.eventBoundaryIterations ?? 0,
        guardedFallbackIterations: diagnostics?.guardedFallbackIterations ?? 0,
        predictionInvalidations: diagnostics?.predictionInvalidations ?? 0,
        eventProbeIterations: diagnostics?.eventProbeIterations ?? 0,
        precisionReduced: diagnostics?.precisionReduced ?? false,
        wallTimeMs: diagnostics?.wallTimeMs ?? (performance.now() - startedAt),
        wallMilliseconds: performance.now() - startedAt,
        eventCounts: diagnostics?.eventCounts ?? {},
        eventFamilyCounts: diagnostics?.eventFamilyCounts ?? {},
        work: runtime.offlineWorkStats,
        final: {
          infinityCountExact: state.infinityCountExact,
          generationCount: state.generationCount,
          coreBoostCount: state.coreBoostCount,
          towerFloor: state.towerFloor,
          infiniteAngleSpeedLevel: state.infiniteAngleSpeedLevel,
          infiniteAngleVertexLevel: state.infiniteAngleVertexLevel,
          infiniteAngleGainLevel: state.infiniteAngleGainLevel,
        },
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
      state.completedChallenges = 0;
      state.completedTowerChallenges = 0;
      state.eternityMilestoneMask = 0;
      state.timelinePurchasedNodes = [];
      runtime.setExactIntegerState(state, "infinityCountExact", "infinityCount", 0n);
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
        const diagnostics = runtime.offlineDiagnostics;
        return {
          requestedTicks: report?.requestedTicks ?? 0,
          processedTicks: report?.processedTicks ?? 0,
          simulationIterations: report?.simulationIterations ?? 0,
          fullSimulationIterations: diagnostics?.fullSimulationIterations ?? report?.simulationIterations ?? 0,
          bulkIterations: report?.bulkIterations ?? 0,
          bulkProcessedTicks: report?.bulkProcessedTicks ?? 0,
          aggregatedTicks: diagnostics?.aggregatedTicks ?? 0,
          cyclesAggregated: diagnostics?.cyclesAggregated ?? 0,
          cycleFallbackReason: diagnostics?.cycleFallbackReason ?? "",
          eventBoundaryCount: diagnostics?.eventBoundaryCount ?? 0,
          eventBoundaryIterations: diagnostics?.eventBoundaryIterations ?? 0,
          guardedFallbackIterations: diagnostics?.guardedFallbackIterations ?? 0,
          predictionInvalidations: diagnostics?.predictionInvalidations ?? 0,
          eventProbeIterations: diagnostics?.eventProbeIterations ?? 0,
          precisionReduced: report?.precisionReduced ?? false,
          work: runtime.offlineWorkStats,
          wallTimeMs: diagnostics?.wallTimeMs ?? (performance.now() - startedAt),
          eventCounts: diagnostics?.eventCounts ?? {},
          eventFamilyCounts: diagnostics?.eventFamilyCounts ?? {},
          wallMilliseconds: performance.now() - startedAt,
        };
      };
      return {
        four: await measure(4, "performance-four-hit-offline-work"),
        eight: await measure(8, "performance-eight-hit-offline-work"),
        high: await measure(16, "performance-high-load-offline-work"),
      };
    }

    function configureGenerationCoreAutomationMillion(mode) {
      resetScenario(3);
      Object.assign(state, {
        activeChallenge: 0,
        activeTowerChallenge: 0,
        automationEnabled: true,
        autoRunInfinity: false,
        autoRunGeneration: mode === "generation" || mode === "combined",
        autoRunCoreBoost: mode === "coreBoost" || mode === "combined",
        autoGenerationScoreMultiplierThreshold: 0,
        autoGenerationCostMultiplierThreshold: 0,
        autoGenerationMinimumSeconds: 0,
        autoGenerationLegacyOrMode: false,
        achievementMask: 1 << (19 - 1),
        infinityCount: 1,
        generationCount: mode === "generation" ? 0 : 1,
        coreBoostCount: 0,
        infiniteAngleUnlocked: false,
        speedLevel: 0,
        gainLevel: 0,
        offlineProgressEnabled: true,
        offlineTickCount: runtime.OFFLINE_PROGRESS_MAX_TICKS,
        timelinePurchasedNodes: [],
      });
      state.autoBuySpeed = false;
      state.autoBuyVertex = false;
      state.autoBuyGain = false;
      state.autoBuyInfinityUpgrades = false;
      state.autoBuildTower = false;
      state.autoBuyInfiniteAngleSpeed = false;
      state.autoBuyInfiniteAngleVertex = false;
      state.autoBuyInfiniteAngleGain = false;
      runtime.setExactIntegerState(state, "infinityCountExact", "infinityCount", 1n);
      runtime.setExactIntegerState(state, "speedLevelExact", "speedLevel", 0n);
      runtime.setExactIntegerState(state, "gainLevelExact", "gainLevel", 0n);
      setLogState("score", mode === "generation" ? 8 : 20);
      setLogState("totalScore", mode === "generation" ? 8 : 20);
      setLogState("generationScore", mode === "generation" ? 8 : 20);
      return 1 / 30;
    }

    async function measureGenerationCoreAutomationMillion() {
      const measure = async (mode) => {
        const tickSeconds = configureGenerationCoreAutomationMillion(mode);
        const startedAt = performance.now();
        const report = await debug.processOfflineElapsed(
          tickSeconds * runtime.OFFLINE_PROGRESS_MAX_TICKS,
          "performance-" + mode + "-automation-million",
          { clockSource: "server" },
        );
        const diagnostics = runtime.offlineDiagnostics;
        const work = runtime.offlineWorkStats;
        const fallbackIterations = (work?.tracks?.angle?.fallbackIterations ?? 0)
          + (work?.tracks?.infiniteAngle?.fallbackIterations ?? 0);
        return {
          mode,
          requestedTicks: report?.requestedTicks ?? 0,
          processedTicks: report?.processedTicks ?? 0,
          simulationIterations: report?.simulationIterations ?? 0,
          fullSimulationIterations: diagnostics?.fullSimulationIterations ?? report?.simulationIterations ?? 0,
          eventProbeIterations: diagnostics?.eventProbeIterations ?? 0,
          bulkIterations: diagnostics?.bulkIterations ?? 0,
          bulkProcessedTicks: diagnostics?.bulkProcessedTicks ?? 0,
          fallbackIterations,
          eventBoundaryCount: diagnostics?.eventBoundaryCount ?? 0,
          eventBoundaryIterations: diagnostics?.eventBoundaryIterations ?? 0,
          guardedFallbackIterations: diagnostics?.guardedFallbackIterations ?? 0,
          predictionInvalidations: diagnostics?.predictionInvalidations ?? 0,
          precisionReduced: diagnostics?.precisionReduced ?? false,
          eventCounts: diagnostics?.eventCounts ?? {},
          eventFamilyCounts: diagnostics?.eventFamilyCounts ?? {},
          work,
          wallTimeMs: diagnostics?.wallTimeMs ?? (performance.now() - startedAt),
          wallMilliseconds: performance.now() - startedAt,
          final: {
            generationCount: state.generationCount,
            coreBoostCount: state.coreBoostCount,
            infinityCountExact: state.infinityCountExact,
          },
        };
      };
      return {
        generation: await measure("generation"),
        coreBoost: await measure("coreBoost"),
        combined: await measure("combined"),
      };
    }
    async function measureQuietOfflineResume(requestedTicks) {
      resetScenario(3);
      state.activeTowerChallenge = 0;
      state.automationEnabled = false;
      state.autoRunInfinity = false;
      state.autoRunGeneration = false;
      state.autoRunCoreBoost = false;
      state.infinityCount = 1;
      state.infiniteAngleUnlocked = false;
      state.offlineProgressEnabled = true;
      state.offlineTickCount = requestedTicks;
      state.timelinePurchasedNodes = [];
      state.totalPlayTime = 0;
      state.currentInfinityRunTime = 0;
      state.currentEternityRunTime = 0;
      state.currentGenerationRunTime = 0;
      const startedAt = performance.now();
      const report = await debug.processOfflineElapsed(
        requestedTicks * runtime.MAX_SIMULATION_STEP_SECONDS,
        `performance-quiet-${requestedTicks}`,
        { clockSource: "server" },
      );
      const diagnostics = runtime.offlineDiagnostics;
      return {
        requestedTicks: report?.requestedTicks ?? 0,
        processedTicks: report?.processedTicks ?? 0,
        simulationIterations: report?.simulationIterations ?? 0,
        fullSimulationIterations: diagnostics?.fullSimulationIterations ?? report?.simulationIterations ?? 0,
        bulkIterations: report?.bulkIterations ?? 0,
        bulkProcessedTicks: report?.bulkProcessedTicks ?? 0,
        aggregatedTicks: diagnostics?.aggregatedTicks ?? 0,
        cyclesAggregated: diagnostics?.cyclesAggregated ?? 0,
        eventBoundaryCount: diagnostics?.eventBoundaryCount ?? 0,
        eventBoundaryIterations: diagnostics?.eventBoundaryIterations ?? 0,
        guardedFallbackIterations: diagnostics?.guardedFallbackIterations ?? 0,
        predictionInvalidations: diagnostics?.predictionInvalidations ?? 0,
        precisionReduced: diagnostics?.precisionReduced ?? false,
        wallTimeMs: diagnostics?.wallTimeMs ?? (performance.now() - startedAt),
        eventCounts: diagnostics?.eventCounts ?? {},
        eventFamilyCounts: diagnostics?.eventFamilyCounts ?? {},
        wallMilliseconds: performance.now() - startedAt,
      };
    }
    function configureTimelineOfflineScenario(nodes) {
      const requestedTicks = runtime.OFFLINE_PROGRESS_MAX_TICKS;
      resetScenario(720);
      state.activeTowerChallenge = 0;
      state.automationEnabled = false;
      state.autoRunInfinity = false;
      state.autoRunGeneration = false;
      state.autoRunCoreBoost = false;
      state.completedChallenges = (1 << (6 - 1)) | (1 << (8 - 1));
      state.timelinePurchasedNodes = nodes.map((id) => ({ id }));
      state.timelineParallelSecondsSinceIc8Clear = 5;
      state.towerFloor = 10;
      state.score = Number.MAX_VALUE;
      state.scoreLog10 = 14000;
      state.totalScore = Number.MAX_VALUE;
      state.totalScoreLog10 = 14000;
      state.generationScore = Number.MAX_VALUE;
      state.generationScoreLog10 = 14000;
      state.infiniteCapBroken = true;
      state.currentGain = 1;
      state.currentGainLog10 = 0;
      state.infiniteScore = Number.MAX_VALUE;
      state.infiniteScoreLog10 = 100;
      state.offlineProgressEnabled = true;
      state.offlineTickCount = requestedTicks;
      state.totalPlayTime = 0;
      state.currentInfinityRunTime = 0;
      state.currentEternityRunTime = 0;
      state.currentGenerationRunTime = 0;
      runtime.setExactIntegerState(state, "infinityCountExact", "infinityCount", 100n);
      runtime.setExactIntegerState(state, "eternityCountExact", "eternityCount", 8n);
      runtime.syncInfinityPointCachesFromExact(10n ** 6n);
      return requestedTicks;
    }
    async function measureTimelineOfflineResume(route, nodes) {
      const requestedTicks = configureTimelineOfflineScenario(nodes);
      const tickSeconds = runtime.MAX_SIMULATION_STEP_SECONDS;
      const startedAt = performance.now();
      const report = await debug.processOfflineElapsed(
        tickSeconds * requestedTicks,
        `performance-timeline-${route}`,
        { clockSource: "server" },
      );
      const diagnostics = runtime.offlineDiagnostics;
      return {
        route,
        nodes,
        requestedTicks: report?.requestedTicks ?? 0,
        processedTicks: report?.processedTicks ?? 0,
        simulationIterations: report?.simulationIterations ?? 0,
        fullSimulationIterations: diagnostics?.fullSimulationIterations ?? report?.simulationIterations ?? 0,
        bulkIterations: report?.bulkIterations ?? 0,
        bulkProcessedTicks: report?.bulkProcessedTicks ?? 0,
        aggregatedTicks: diagnostics?.aggregatedTicks ?? 0,
        cyclesAggregated: diagnostics?.cyclesAggregated ?? 0,
        eventBoundaryCount: diagnostics?.eventBoundaryCount ?? 0,
        eventBoundaryIterations: diagnostics?.eventBoundaryIterations ?? 0,
        guardedFallbackIterations: diagnostics?.guardedFallbackIterations ?? 0,
        predictionInvalidations: diagnostics?.predictionInvalidations ?? 0,
        precisionReduced: report?.precisionReduced ?? false,
        wallTimeMs: diagnostics?.wallTimeMs ?? (performance.now() - startedAt),
        eventCounts: diagnostics?.eventCounts ?? {},
        eventFamilyCounts: diagnostics?.eventFamilyCounts ?? {},
        work: runtime.offlineWorkStats,
        before: report?.before ?? null,
        after: report?.after ?? null,
        timelineSeconds: state.timelineParallelSecondsSinceIc8Clear,
        expectedTimelineSeconds: 5 + tickSeconds * requestedTicks,
        final: {
          scoreLog10: runtime.currentScoreLog10(),
          infiniteScoreLog10: runtime.currentInfiniteScoreLog10(),
          infinityPointsLog10: runtime.currentInfinityPointsLog10(),
          parallelTimerEffectLog10: runtime.timelineParallelEffectiveLog10(),
          realCountEffectLog10: runtime.timelineRealInfinityCountGainMultiplierLog10(),
          towerScoreExponent: runtime.towerScoreExponent(),
          infinityPointGainLog10: runtime.infinityPointGainLog10(),
          eternityGainExact: runtime.eternityGainExact().toString(),
          infiniteAngleUnlocked: state.infiniteAngleUnlocked,
        },
        wallMilliseconds: performance.now() - startedAt,
      };
    }
    async function measureAutoInfinityStress(requestedTicks, { rateRemainder = 0 } = {}) {
      resetScenario(3);
      state.offlineProgressEnabled = true;
      state.offlineTickCount = requestedTicks;
      state.speedLevel = 0;
      state.gainLevel = 0;
      state.infiniteAngleUnlocked = false;
      state.automationEnabled = true;
      state.autoRunInfinity = true;
      state.autoRunGeneration = false;
      state.autoRunCoreBoost = false;
      state.autoInfinityPointThresholdLog10 = 0;
      state.autoInfinityPointThreshold = 1;
      state.activeChallenge = 0;
      state.activeTowerChallenge = 0;
      state.completedChallenges = 0;
      state.completedTowerChallenges = 0;
      state.eternityMilestoneMask = 0;
      state.infiniteCapBroken = false;
      state.autoBuySpeed = false;
      state.autoBuyVertex = false;
      state.autoBuyGain = false;
      state.autoBuyInfinityUpgrades = false;
      state.autoBuildTower = false;
      state.autoBuyInfiniteAngleSpeed = false;
      state.autoBuyInfiniteAngleVertex = false;
      state.autoBuyInfiniteAngleGain = false;
      state.achievementMask = 0;
      state.achievementMaskHigh = 0;
      state.infinityCount = 1;
      state.infinityUpgradeMask = (1 << 1) | (1 << 12);
      state.bestInfinityCountPerSecond = 30;
      state.infinityCountRateRemainder = rateRemainder;
      state.totalPlayTime = 0;
      state.currentInfinityRunTime = 0;
      state.currentInfinityRealTime = 0;
      state.currentEternityRunTime = 0;
      state.currentGenerationRunTime = 0;
      state.currentInfinityRunHadGeneration = false;
      state.currentInfinityRunHadCoreBoost = false;
      state.fastestInfinityTime = 0;
      state.fastestInfinityRealTime = 0;
      state.lastInfinityRuns = [];
      state.score = Number.MAX_VALUE;
      state.scoreLog10 = 309;
      runtime.syncInfinityPointCachesFromExact(0n);
      runtime.setExactIntegerState(state, "infinityCountExact", "infinityCount", 1n);
      const beforeState = runtime.snapshotRuntimeState();

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
        const report = await debug.processOfflineElapsed(
          requestedTicks * runtime.MAX_SIMULATION_STEP_SECONDS,
          "performance-auto-infinity-" + requestedTicks,
          {
          clockSource: "server",
          },
        );
        const afterState = runtime.snapshotRuntimeState();
        const diagnostics = runtime.offlineDiagnostics;
        return {
          baselineOnly: false,
          requestedTicks: report?.requestedTicks ?? 0,
          processedTicks: report?.processedTicks ?? 0,
          simulationIterations: report?.simulationIterations ?? 0,
          fullSimulationIterations: diagnostics?.fullSimulationIterations ?? report?.simulationIterations ?? 0,
          bulkIterations: report?.bulkIterations ?? 0,
          bulkProcessedTicks: report?.bulkProcessedTicks ?? 0,
          aggregatedTicks: diagnostics?.aggregatedTicks ?? 0,
          cyclesAggregated: diagnostics?.cyclesAggregated ?? 0,
          cycleFallbackReason: diagnostics?.cycleFallbackReason ?? "",
          eventBoundaryCount: diagnostics?.eventBoundaryCount ?? 0,
          eventBoundaryIterations: diagnostics?.eventBoundaryIterations ?? 0,
          guardedFallbackIterations: diagnostics?.guardedFallbackIterations ?? 0,
          predictionInvalidations: diagnostics?.predictionInvalidations ?? 0,
          precisionReduced: diagnostics?.precisionReduced ?? false,
          infinityCountGain: report?.normalInfinityCountGain ?? 0,
          processingMilliseconds: report?.processingMilliseconds ?? NaN,
          wallTimeMs: diagnostics?.wallTimeMs ?? (performance.now() - startedAt),
          wallMilliseconds: performance.now() - startedAt,
          uiUpdateCalls: debug.uiUpdateCount() - uiUpdatesBefore,
          eventCounts: diagnostics?.eventCounts ?? {},
          eventFamilyCounts: diagnostics?.eventFamilyCounts ?? {},
          finalInfinityCountExact: afterState.infinityCountExact,
          infinityCountRateRemainder: afterState.infinityCountRateRemainder,
          normalInfinityCountGainExact: report?.normalInfinityCountGainExact ?? "0",
          aggregatedInfinityCountGainExact: report?.aggregatedInfinityCountGainExact ?? "0",
          observedEventCounts: collectObservedEventCounts(beforeState, afterState),
        };
      } finally {
        runtime.resetBelowInfinity = originalResetBelowInfinity;
      }
    }

    function configureLateEternityBaseline(ticks) {
      configureDifferentialBase(ticks, [
        "Parallel-BC16500",
        "Parallel-BC6000",
        "Parallel-AD30",
      ]);
      Object.assign(state, {
        completedChallenges: (1 << 8) - 1,
        completedTowerChallenges: (1 << 4) - 1,
        eternityMilestoneMask: (1 << 8) - 1,
        automationEnabled: true,
        autoBuySpeed: true,
        autoBuyVertex: true,
        autoBuyGain: true,
        autoBuyInfinityUpgrades: true,
        autoBuildTower: true,
        autoRunGeneration: true,
        autoRunCoreBoost: true,
        autoRunInfinity: true,
        autoBuyInfiniteAngleSpeed: true,
        autoBuyInfiniteAngleVertex: true,
        autoBuyInfiniteAngleGain: true,
        infinityUpgradeMask: 1 << 12,
        achievementMask: 1 << (19 - 1),
        autoInfinityPointThresholdLog10: 0,
        autoInfinityPointThreshold: 1,
        towerFloor: 12,
        infiniteAngleUnlocked: true,
        fastestInfinityTime: 60,
      });
      setLogState("score", 309);
      setLogState("totalScore", 309);
      setLogState("generationScore", 309);
      setLogState("infiniteScore", 100);
      runtime.setExactIntegerState(state, "infinityCountExact", "infinityCount", 1000000n);
      runtime.setExactIntegerState(state, "eternityCountExact", "eternityCount", 100n);
      runtime.syncInfinityPointCachesFromExact(10n ** 300n);
    }

    function configureLateEternityAutomationMillion(ticks) {
      configureLateEternityBaseline(ticks);
      Object.assign(state, {
        autoBuySpeed: false,
        autoBuyVertex: false,
        autoBuyGain: false,
        autoRunGeneration: false,
        autoRunCoreBoost: false,
        towerFloor: 11,
        autoInfinityPointThresholdLog10: 1000,
        autoInfinityPointThreshold: runtime.valueFromLog10(1000),
        autoGenerationScoreMultiplierThreshold: 1e300,
        autoGenerationCostMultiplierThreshold: 1e300,
        autoGenerationMinimumSeconds: 1e9,
      });
    }

    function configurePurchaseAutomationDifferential(ticks, kind) {
      configureDifferentialBase(ticks);
      const usesInfiniteAngle = kind === "infinite-angle" || kind === "tower" || kind === "tc4";
      const usesInfinityUpgradeAutomation = kind === "infinity-upgrade";
      Object.assign(state, {
        automationEnabled: true,
        achievementMask: 1 << (19 - 1),
        infinityUpgradeMask: 1 << 1,
        autoBuySpeed: kind === "normal",
        autoBuyVertex: kind === "normal",
        autoBuyGain: kind === "normal",
        autoBuyInfinityUpgrades: usesInfinityUpgradeAutomation,
        autoBuildTower: kind === "tower",
        autoRunGeneration: false,
        autoRunCoreBoost: false,
        autoRunInfinity: false,
        autoBuyInfiniteAngleSpeed: usesInfiniteAngle,
        autoBuyInfiniteAngleVertex: usesInfiniteAngle,
        autoBuyInfiniteAngleGain: usesInfiniteAngle,
        infiniteAngleUnlocked: usesInfiniteAngle || usesInfinityUpgradeAutomation,
        infiniteCapBroken: true,
        activeChallenge: ["normal", "tower", "tc4"].includes(kind) ? 6 : 0,
        activeTowerChallenge: kind === "tc4" ? 4 : 0,
        towerFloor: usesInfiniteAngle ? (kind === "tc4" ? 12 : 11) : 10,
        completedTowerChallenges: usesInfiniteAngle ? (1 << 4) - 1 : 0,
        eternityCount: usesInfinityUpgradeAutomation ? 20 : usesInfiniteAngle ? 81 : 8,
        eternityMilestoneMask: usesInfiniteAngle ? 7 : 0,
      });
      setLogState("score", kind === "tc4" ? -Infinity : kind === "normal" ? 20 : 100);
      setLogState("totalScore", kind === "tc4" ? -Infinity : kind === "normal" ? 20 : 100);
      setLogState("generationScore", kind === "tc4" ? -Infinity : kind === "normal" ? 20 : 100);
      setLogState("infiniteScore", -Infinity);
      runtime.setExactIntegerState(
        state,
        "eternityCountExact",
        "eternityCount",
        BigInt(usesInfinityUpgradeAutomation ? 20 : usesInfiniteAngle ? 81 : 8),
      );
      runtime.syncInfinityPointCachesFromExact(10n ** 300n);
    }

    function configureMilestoneTransitionDifferential(ticks) {
      configureDifferentialBase(ticks);
      Object.assign(state, {
        automationEnabled: false,
        eternityCount: 44,
        infiniteAngleUnlocked: false,
        infiniteCapBroken: false,
        activeTowerChallenge: 1,
        towerFloor: 3,
        completedTowerChallenges: 0,
      });
      setLogState("score", 1200);
      setLogState("totalScore", 1200);
      setLogState("generationScore", 1200);
      runtime.setExactIntegerState(state, "eternityCountExact", "eternityCount", 44n);
      runtime.syncInfinityPointCachesFromExact(10n ** 300n);
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
    state.infinityCount = 1;
    state.timelinePurchasedNodes = [];
    const offlineStartedAt = performance.now();
    const offlineReport = await debug.processOfflineElapsed(100000 / 30, "performance", { clockSource: "server" });
    const offlineDiagnostics = runtime.offlineDiagnostics;
    const offlineProcessing = {
      requestedTicks: offlineReport?.requestedTicks ?? 0,
      processedTicks: offlineReport?.processedTicks ?? 0,
      simulationIterations: offlineReport?.simulationIterations ?? 0,
      fullSimulationIterations: offlineDiagnostics?.fullSimulationIterations ?? offlineReport?.simulationIterations ?? 0,
      bulkIterations: offlineReport?.bulkIterations ?? 0,
      bulkProcessedTicks: offlineReport?.bulkProcessedTicks ?? 0,
      aggregatedTicks: offlineDiagnostics?.aggregatedTicks ?? 0,
      cyclesAggregated: offlineDiagnostics?.cyclesAggregated ?? 0,
      eventBoundaryCount: offlineDiagnostics?.eventBoundaryCount ?? 0,
      eventBoundaryIterations: offlineDiagnostics?.eventBoundaryIterations ?? 0,
      guardedFallbackIterations: offlineDiagnostics?.guardedFallbackIterations ?? 0,
      predictionInvalidations: offlineDiagnostics?.predictionInvalidations ?? 0,
      eventProbeIterations: offlineDiagnostics?.eventProbeIterations ?? 0,
      precisionReduced: offlineDiagnostics?.precisionReduced ?? false,
      processingMilliseconds: offlineReport?.processingMilliseconds ?? NaN,
      wallTimeMs: offlineDiagnostics?.wallTimeMs ?? (performance.now() - offlineStartedAt),
      eventCounts: offlineDiagnostics?.eventCounts ?? {},
      eventFamilyCounts: offlineDiagnostics?.eventFamilyCounts ?? {},
      wallMilliseconds: performance.now() - offlineStartedAt,
    };
    const differential = {
      quiet: await runDifferential("quiet", (ticks) => configureDifferentialBase(ticks), 120),
      timelineReal: await runDifferential(
        "timeline-real",
        (ticks) => configureDifferentialBase(ticks, ["Real-BC16500", "Real-BC6000", "Real-AD30"]),
        120,
      ),
      timelineParallel: await runDifferential(
        "timeline-parallel",
        (ticks) => configureDifferentialBase(ticks, ["Parallel-BC16500", "Parallel-BC6000", "Parallel-AD30"]),
        120,
      ),
      autoInfinity: await runDifferential(
        "auto-infinity",
        configureAutoInfinityDifferential,
        120,
        { reprimeScore: true, aggregateHistory: true },
      ),
      autoInfinityRemainder: await runDifferential(
        "auto-infinity-remainder",
        configureAutoInfinityRemainderDifferential,
        120,
        { reprimeScore: true, aggregateHistory: true },
      ),
      autoInfinityCustomThreshold: await runDifferential(
        "auto-infinity-custom-threshold",
        configureAutoInfinityCustomThresholdDifferential,
        12,
        { reprimeScore: true },
      ),
      autoInfinityIc6: await runDifferential(
        "auto-infinity-ic6",
        configureAutoInfinityIc6Differential,
        12,
        { reprimeScore: true },
      ),
      autoInfinityTimeline: await runDifferential(
        "auto-infinity-timeline-real",
        configureAutoInfinityTimelineDifferential,
        12,
        { reprimeScore: true },
      ),
      autoInfinityAutobuy: await runDifferential(
        "auto-infinity-autobuy",
        configureAutoInfinityAutobuyDifferential,
        12,
        { reprimeScore: true },
      ),
      normalAutobuy: await runDifferential(
        "normal-autobuy",
        (ticks) => configurePurchaseAutomationDifferential(ticks, "normal"),
        3,
        { omitApproximateStateFields: ["lastEarnedLog10"] },
      ),
      infinityUpgradeAutobuy: await runDifferential(
        "infinity-upgrade-autobuy",
        (ticks) => configurePurchaseAutomationDifferential(ticks, "infinity-upgrade"),
        3,
      ),
      infiniteAngleTowerAutobuy: await runDifferential(
        "infinite-angle-tower-autobuy",
        (ticks) => configurePurchaseAutomationDifferential(ticks, "tower"),
        2,
        {
          omitApproximateStateFields: [
            "scoreLog10",
            "totalScoreLog10",
            "generationScoreLog10",
            "lastEarnedLog10",
          ],
          omitApproximateReportFields: ["scoreLog10"],
        },
      ),
      milestoneTransitions: await runDifferential(
        "milestone-transitions",
        configureMilestoneTransitionDifferential,
        12,
      ),
      tc4Restriction: await runDifferential(
        "tc4-restriction",
        (ticks) => configurePurchaseAutomationDifferential(ticks, "tc4"),
        1,
        {
          omitApproximateStateFields: [
            "scoreLog10",
            "totalScoreLog10",
            "generationScoreLog10",
            "lastEarnedLog10",
          ],
          omitApproximateReportFields: ["scoreLog10"],
        },
      ),
      generation: await runDifferential("generation", configureGenerationDifferential, 120),
      coreBoost: await runDifferential("core-boost", configureCoreBoostDifferential, 120),
      generationCoreBoost: await runDifferential(
        "generation-core-boost",
        configureGenerationCoreBoostDifferential,
        120,
      ),
      autoInfinityGeneration: await runDifferential(
        "auto-infinity-generation",
        configureAutoInfinityGenerationDifferential,
        24,
        { reprimeScore: true, aggregateHistory: true },
      ),
      autoInfinityCoreBoost: await runDifferential(
        "auto-infinity-core-boost",
        configureAutoInfinityCoreBoostDifferential,
        24,
        { reprimeScore: true, aggregateHistory: true },
      ),
      autoInfinityGenerationCoreBoost: await runDifferential(
        "auto-infinity-generation-core-boost",
        configureAutoInfinityGenerationCoreBoostDifferential,
        24,
        { reprimeScore: true, aggregateHistory: true },
      ),
      generationUnsupportedChallenge: await runDifferential(
        "generation-unsupported-challenge",
        configureGenerationUnsupportedChallengeDifferential,
        24,
      ),
      generationSingleTickGuard: await runDifferential(
        "generation-single-tick-guard",
        configureGenerationSingleTickDifferential,
        1,
      ),
    };
    const rendered = JSON.parse(window.render_game_to_text());
    return {
      offlineProcessing,
      offlineStress: {
        autoInfinity: await measureAutoInfinityStress(10000),
        autoInfinityRemainder: await measureAutoInfinityStress(120, { rateRemainder: 0.5 }),
        autoInfinityMillion: await measureAutoInfinityStress(runtime.OFFLINE_PROGRESS_MAX_TICKS),
        differential,
        generationAutomation: await measureEventfulBaseline("generation", 120, configureGenerationDifferential),
        coreBoostAutomation: await measureEventfulBaseline("core-boost", 120, configureCoreBoostDifferential),
        generationCoreBoostAutomation: await measureEventfulBaseline(
          "generation-core-boost",
          120,
          configureGenerationCoreBoostDifferential,
        ),
        lateEternityAutomation: await measureEventfulBaseline(
          "late-eternity",
          120,
          configureLateEternityBaseline,
        ),
        lateEternityAutomationMillion: await measureLateEternityAutomationMillion(),
        coreHitBoundary: {
          angle: await measureCoreHitBoundary("angle"),
          infiniteAngle: await measureCoreHitBoundary("infiniteAngle"),
        },
        infiniteAngleExactWork: measureInfiniteAngleExactWorkBudget(),
        longResumeWork: await measureLongOfflineResumeWork(),
        generationCoreAutomationMillion: await measureGenerationCoreAutomationMillion(),
        quietResume: {
          1000: await measureQuietOfflineResume(1000),
          10000: await measureQuietOfflineResume(10000),
          100000: await measureQuietOfflineResume(100000),
          1000000: await measureQuietOfflineResume(1000000),
        },
        timelineResume: {
          real: await measureTimelineOfflineResume(
            "real",
            ["Real-BC16500", "Real-BC6000", "Real-AD30"],
          ),
          parallel: await measureTimelineOfflineResume(
            "parallel",
            ["Parallel-BC16500", "Parallel-BC6000", "Parallel-AD30"],
          ),
        },
      },
      playerFacingOfflineReportKeys: Object.keys(rendered.timeFlux?.report ?? {}),
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
      scenarios: [
        "offline-processing",
        "differential-guarded-canonical",
        "auto-infinity-cycle",
        "auto-infinity-million",
        "auto-infinity-fallbacks",
        "generation-core-boost-event-differentials",
        "generation-automation-baseline",
        "core-boost-automation-baseline",
        "late-eternity-automation-baseline",
        "late-eternity-automation-million",
        "generation-core-boost-automation-million",
        "core-hit-boundary",
        "infinite-angle-exact-work",
        "long-resume",
        "quiet-resume-scale",
        "timeline-enabled",
      ],
      baselinePolicy: "eventful scenarios are baseline-only observations; they are not release performance targets",
      differentialPolicy: {
        exact: "discrete counts, levels, unlocks, masks, challenges, achievements, timers/history, and automation settings; aggregate-history paths retain only canonical material entries",
        approximate: "log-valued resources within 1e-9 and timer/progress values within 1e-6",
      },
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
  assert.ok(report.offlineProcessing.bulkIterations > 0, "the real quiet offline path should use bulk iterations");
  assert.equal(
    report.offlineProcessing.fullSimulationIterations,
    report.offlineProcessing.simulationIterations + report.offlineProcessing.eventProbeIterations,
    "the full-simulation diagnostic should include committed and speculative iterations",
  );
  assert.ok(report.offlineProcessing.eventBoundaryCount >= 0, "the offline path should expose an event-boundary count");
  assert.ok(report.offlineProcessing.eventBoundaryIterations >= 0, "the offline path should expose committed event-boundary iterations");
  assert.ok(report.offlineProcessing.guardedFallbackIterations >= 0, "the offline path should expose guarded fallback iterations");
  assert.ok(report.offlineProcessing.predictionInvalidations >= 0, "the offline path should expose prediction invalidations");
  assert.ok(report.offlineProcessing.eventFamilyCounts, "the offline path should expose event-family counts");
  assert.ok(Number.isFinite(report.offlineProcessing.wallTimeMs), "the offline path should expose finite diagnostic wall time");
  assert.equal(
    report.offlineProcessing.processedTicks,
    report.offlineProcessing.bulkProcessedTicks
      + report.offlineProcessing.simulationIterations
      - report.offlineProcessing.bulkIterations
      + report.offlineProcessing.aggregatedTicks,
    "the real quiet offline path should account for bulk, single-tick, and aggregated ticks",
  );

  const autoInfinity = report.offlineStress.autoInfinity;
  assert.equal(autoInfinity.requestedTicks, 10000, "Auto Infinity stress should request 10000 ticks");
  assert.equal(autoInfinity.processedTicks, 10000, "Auto Infinity stress should process 10000 ticks exactly");
  assert.equal(autoInfinity.infinityCountGain, 2, "Auto Infinity stress should retain canonical probe gain separately");
  assert.equal(autoInfinity.simulationIterations, 2, "Auto Infinity stress should use two canonical probe iterations");
  assert.equal(autoInfinity.bulkIterations, 0, "Auto Infinity should not use bulk iterations across reset events");
  assert.equal(autoInfinity.aggregatedTicks, 9998, "Auto Infinity should account for skipped ticks as aggregated work");
  assert.equal(autoInfinity.cyclesAggregated, 9998, "Auto Infinity should aggregate the remaining stable cycles");
  assert.equal(autoInfinity.eventBoundaryCount, 2, "Auto Infinity should expose the directly processed boundaries");
  assert.equal(autoInfinity.eventBoundaryIterations, 2, "Auto Infinity should expose two committed cycle boundaries");
  assert.equal(autoInfinity.eventFamilyCounts.autoInfinity, 2, "Auto Infinity should expose family event counts");
  assert.equal(autoInfinity.eventCounts.infinityExecutions, 2, "Auto Infinity diagnostics should count direct reset events");
  assert.equal(autoInfinity.aggregatedInfinityCountGainExact, "9998", "Auto Infinity should report exact aggregated count gain");
  assert.equal(autoInfinity.finalInfinityCountExact, "10001", "Auto Infinity should preserve the final exact count");
  const autoInfinityMillion = report.offlineStress.autoInfinityMillion;
  assert.equal(autoInfinityMillion.baselineOnly, false, "the Auto Infinity million-tick run should measure the supported path");
  assert.equal(autoInfinityMillion.requestedTicks, 1000000, "Auto Infinity million stress should request one million ticks");
  assert.equal(autoInfinityMillion.processedTicks, 1000000, "Auto Infinity million stress should process one million ticks exactly");
  assert.equal(autoInfinityMillion.fullSimulationIterations, 2, "Auto Infinity million stress should use bounded canonical work");
  assert.equal(autoInfinityMillion.aggregatedTicks, 999998, "Auto Infinity million stress should aggregate the remaining ticks");
  assert.equal(autoInfinityMillion.cyclesAggregated, 999998, "Auto Infinity million stress should aggregate the remaining cycles");
  assert.equal(autoInfinityMillion.bulkIterations, 0, "Auto Infinity million stress should not bulk across reset events");
  assert.equal(autoInfinityMillion.eventCounts.infinityExecutions, 2, "Auto Infinity million diagnostics should count direct reset events");
  assert.equal(autoInfinityMillion.aggregatedInfinityCountGainExact, "999998", "Auto Infinity million should report exact aggregated count gain");
  assert.equal(autoInfinityMillion.finalInfinityCountExact, "1000001", "Auto Infinity million should preserve the final exact count");
  const autoInfinityRemainder = report.offlineStress.autoInfinityRemainder;
  assert.equal(autoInfinityRemainder.cyclesAggregated, 118, "Auto Infinity should preserve a fractional rate remainder while aggregating cycles");
  assert.equal(autoInfinityRemainder.aggregatedTicks, 118, "Auto Infinity remainder aggregation should account for skipped ticks");
  assert.equal(autoInfinityRemainder.eventCounts.infinityExecutions, 2, "Auto Infinity remainder aggregation should retain direct event counts");
  assert.equal(autoInfinityRemainder.aggregatedInfinityCountGainExact, "118", "Auto Infinity remainder aggregation should use exact count gain");
  assert.equal(autoInfinityRemainder.infinityCountRateRemainder, 0.5, "Auto Infinity should carry the rate remainder forward");
  for (const name of ["autoInfinityCustomThreshold", "autoInfinityIc6", "autoInfinityTimeline"]) {
    const fallback = report.offlineStress.differential[name];
    assert.equal(fallback.comparison.matched, true, `${name} should match the guarded canonical fallback`);
    assert.equal(fallback.accelerated.diagnostics.cyclesAggregated, 0, `${name} should not aggregate unsupported cycles`);
    assert.equal(fallback.accelerated.diagnostics.aggregatedTicks, 0, `${name} should not skip unsupported ticks`);
    assert.notEqual(fallback.accelerated.diagnostics.cycleFallbackReason, "", `${name} should record a fallback reason`);
  }
  const autoInfinityAutobuy = report.offlineStress.differential.autoInfinityAutobuy;
  assert.equal(autoInfinityAutobuy.comparison.matched, true, "Auto Infinity with normal autobuy should match canonical ordering");
  assert.equal(autoInfinityAutobuy.accelerated.diagnostics.cyclesAggregated, 0, "Auto Infinity with normal autobuy should not use the incompatible cycle shortcut");
  assert.ok(autoInfinityAutobuy.accelerated.diagnostics.eventCounts.normalUpgradePurchases > 0, "Auto Infinity with normal autobuy should record canonical purchases");
  assert.ok(autoInfinityAutobuy.accelerated.diagnostics.predictionInvalidations > 0, "Auto Infinity with normal autobuy should invalidate reset predictions");
  assert.ok(
    report.offlineStress.differential.generationUnsupportedChallenge.accelerated.diagnostics.guardedFallbackIterations > 0,
    "unsupported challenge automation should use guarded fallback iterations",
  );
  assert.equal(
    report.offlineStress.differential.generationSingleTickGuard.accelerated.diagnostics.eventBoundaryIterations,
    0,
    "a one-tick interval should not enter the event-boundary engine",
  );
  assert.ok(
    report.offlineStress.differential.generationSingleTickGuard.accelerated.diagnostics.guardedFallbackIterations > 0,
    "a zero-candidate interval should use guarded fallback",
  );
  for (const [name, baseline] of Object.entries({
    generation: report.offlineStress.generationAutomation,
    coreBoost: report.offlineStress.coreBoostAutomation,
    generationCoreBoost: report.offlineStress.generationCoreBoostAutomation,
    lateEternity: report.offlineStress.lateEternityAutomation,
  })) {
    assert.equal(baseline.baselineOnly, true, `${name} automation should be marked baseline-only`);
    assert.equal(baseline.requestedTicks, 120, `${name} automation should request its configured ticks`);
    assert.equal(baseline.processedTicks, 120, `${name} automation should process its configured ticks`);
    assert.ok(baseline.fullSimulationIterations > 0, `${name} automation should report full simulation work`);
    assert.ok(baseline.eventBoundaryCount > 0, `${name} automation should expose event boundaries`);
    if (["generation", "coreBoost", "generationCoreBoost"].includes(name)) {
      assert.ok(baseline.eventBoundaryIterations > 0, `${name} automation should expose committed event-boundary iterations`);
    }
    assert.ok(Number.isFinite(baseline.wallTimeMs), `${name} automation should report finite diagnostic wall time`);
  }
  assert.ok(report.offlineStress.generationAutomation.eventCounts.generationResets > 0, "Generation baseline should observe a Generation reset");
  assert.ok(report.offlineStress.generationAutomation.eventFamilyCounts.generationCoreBoost > 0, "Generation baseline should expose the shared family");
  assert.ok(report.offlineStress.coreBoostAutomation.eventCounts.coreBoostResets > 0, "Core Boost baseline should observe a Core Boost reset");
  assert.ok(report.offlineStress.coreBoostAutomation.eventFamilyCounts.generationCoreBoost > 0, "Core Boost baseline should expose the shared family");
  assert.ok(
    report.offlineStress.generationCoreBoostAutomation.eventCounts.generationResets > 0
      && report.offlineStress.generationCoreBoostAutomation.eventCounts.coreBoostResets > 0,
    "combined baseline should observe both canonical reset events",
  );
  assert.ok(
    report.offlineStress.generationCoreBoostAutomation.eventFamilyCounts.generationCoreBoost > 0,
    "combined automation should expose the shared family",
  );
  assert.ok(
    report.offlineStress.lateEternityAutomation.eventCounts.infinityExecutions > 0
      || report.offlineStress.lateEternityAutomation.eventCounts.generationResets > 0
      || report.offlineStress.lateEternityAutomation.eventCounts.coreBoostResets > 0
      || report.offlineStress.lateEternityAutomation.eventCounts.towerBuilds > 0
      || report.offlineStress.lateEternityAutomation.eventCounts.infiniteAnglePurchases > 0,
    "late-Eternity automation baseline should observe at least one practical event",
  );
  const lateEternityAutomationMillion = report.offlineStress.lateEternityAutomationMillion;
  assert.equal(lateEternityAutomationMillion.requestedTicks, 1000000, "late-Eternity automation million should request one million ticks");
  assert.equal(lateEternityAutomationMillion.processedTicks, 1000000, "late-Eternity automation million should process one million ticks");
  assert.ok(
    lateEternityAutomationMillion.fullSimulationIterations < lateEternityAutomationMillion.requestedTicks,
    "late-Eternity automation million should reduce full simulation iterations",
  );
  assert.ok(lateEternityAutomationMillion.bulkIterations > 0, "late-Eternity automation million should use bulk iterations");
  assert.equal(
    lateEternityAutomationMillion.processedTicks,
    lateEternityAutomationMillion.bulkProcessedTicks
      + lateEternityAutomationMillion.simulationIterations
      - lateEternityAutomationMillion.bulkIterations,
    "late-Eternity automation million should account for bulk and boundary iterations",
  );
  assert.equal(
    lateEternityAutomationMillion.fullSimulationIterations,
    lateEternityAutomationMillion.simulationIterations
      + lateEternityAutomationMillion.eventProbeIterations,
    "late-Eternity automation million should separate committed and probe iterations",
  );
  assert.ok(lateEternityAutomationMillion.eventBoundaryIterations > 0, "late-Eternity automation million should commit event boundaries");
  assert.ok(
    lateEternityAutomationMillion.predictionInvalidations >= lateEternityAutomationMillion.eventBoundaryIterations,
    "late-Eternity automation million should invalidate predictions at event boundaries",
  );
  assert.ok(
    lateEternityAutomationMillion.eventCounts.infinityUpgradePurchases > 0
      && lateEternityAutomationMillion.eventCounts.infiniteAnglePurchases > 0
      && lateEternityAutomationMillion.eventCounts.towerBuilds > 0,
    "late-Eternity automation million should exercise Infinity Upgrade, Infinite Angle, and tower automation",
  );
  assert.ok(Number.isFinite(lateEternityAutomationMillion.wallMilliseconds), "late-Eternity automation million should report finite wall time");
  assert.ok(report.offlineStress.differential.normalAutobuy.accelerated.diagnostics.eventCounts.normalUpgradePurchases > 0, "normal autobuy differential should purchase normal upgrades");
  assert.ok(report.offlineStress.differential.infinityUpgradeAutobuy.accelerated.diagnostics.eventCounts.infinityUpgradePurchases > 0, "Infinity Upgrade autobuy differential should purchase Infinity Upgrades");
  assert.ok(
    report.offlineStress.differential.infiniteAngleTowerAutobuy.accelerated.diagnostics.eventCounts.infiniteAnglePurchases > 0
      && report.offlineStress.differential.infiniteAngleTowerAutobuy.accelerated.diagnostics.eventCounts.towerBuilds > 0,
    "Infinite Angle and tower autobuy differential should use canonical purchases and builds",
  );
  assert.ok(
    report.offlineStress.differential.milestoneTransitions.accelerated.diagnostics.eventCounts.automaticUnlocks > 0
      && report.offlineStress.differential.milestoneTransitions.accelerated.diagnostics.eventCounts.automaticCompletions > 0,
    "EM5/EM6/EM7 differential should record canonical one-shot transitions",
  );
  const tc4Restriction = report.offlineStress.differential.tc4Restriction;
  assert.equal(tc4Restriction.accelerated.diagnostics.eventCounts.normalUpgradePurchases, 0, "TC4 should block normal autobuy purchases");
  assert.equal(tc4Restriction.accelerated.diagnostics.eventCounts.infiniteAnglePurchases, 0, "TC4 should block Infinite Angle autobuy purchases");
  assert.equal(tc4Restriction.accelerated.diagnostics.eventCounts.towerBuilds, 0, "TC4 should block tower builds while active");
  for (const [name, result] of Object.entries(report.offlineStress.differential)) {
    assert.equal(result.comparison.matched, true, `${name} differential should match the guarded canonical simulation: ${JSON.stringify(result.comparison.mismatches)}`);
    assert.equal(result.accelerated.diagnostics.requestedTicks, result.requestedTicks, `${name} differential should expose requested tick diagnostics`);
    assert.equal(result.accelerated.diagnostics.processedTicks, result.requestedTicks, `${name} differential should expose processed tick diagnostics`);
    assert.ok(result.accelerated.work.totalIterations <= result.accelerated.work.hardCap, `${name} differential work should stay within its hard cap`);
    assert.equal(result.accelerated.diagnostics.precisionReduced, result.accelerated.work.precisionReduced, `${name} differential precision status should match its work ledger`);
    assert.ok(result.accelerated.diagnostics.eventBoundaryIterations >= 0, `${name} should report event-boundary iterations`);
    assert.ok(result.accelerated.diagnostics.guardedFallbackIterations >= 0, `${name} should report guarded fallback iterations`);
    assert.ok(result.accelerated.diagnostics.predictionInvalidations >= 0, `${name} should report prediction invalidations`);
  }
  for (const result of Object.values(report.offlineStress.differential)) {
    assert.equal(
      result.accelerated.diagnostics.fullSimulationIterations,
      result.accelerated.diagnostics.simulationIterations
        + result.accelerated.diagnostics.eventProbeIterations,
      "differential diagnostics should separate committed and probe iterations",
    );
  }
  for (const key of [
    "fullSimulationIterations",
    "eventBoundaryCount",
    "eventBoundaryIterations",
    "guardedFallbackIterations",
    "predictionInvalidations",
    "wallTimeMs",
    "eventCounts",
    "eventFamilyCounts",
  ]) {
    assert.equal(report.playerFacingOfflineReportKeys.includes(key), false, `player-facing offline reports must omit ${key}`);
  }
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
    assert.ok(resume.simulationIterations < resume.requestedTicks, `${name} long resume should reduce full update iterations`);
    assert.ok(resume.bulkIterations > 0, `${name} long resume should use bulk iterations`);
    assert.equal(
      resume.processedTicks,
      resume.bulkProcessedTicks + resume.simulationIterations - resume.bulkIterations
        + (resume.aggregatedTicks ?? 0),
      `${name} long resume should account for bulk and single-tick iterations`,
    );
    assert.ok(resume.work.totalIterations <= resume.work.hardCap, `${name} offline work must stay within its hard cap`);
    assert.ok(Number.isFinite(resume.wallMilliseconds), `${name} long resume should report finite wall time`);
  }
  assert.equal(longResumeWork.four.precisionReduced, true, "four-hit million-tick batches should report bounded approximation");
  assert.equal(longResumeWork.eight.precisionReduced, true, "eight-hit million-tick batches should report bounded approximation");
  for (const name of ["four", "eight"]) {
    assert.ok(
      longResumeWork[name].work.tracks.angle.exactIterations > 0
        && longResumeWork[name].work.tracks.infiniteAngle.exactIterations > 0
        && longResumeWork[name].work.tracks.angle.approximationIterations > 0
        && longResumeWork[name].work.tracks.infiniteAngle.approximationIterations > 0,
      `${name}-hit batches on both tracks should use exact work before bounded approximation`,
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
  const generationCoreAutomationMillion = report.offlineStress.generationCoreAutomationMillion;
  for (const measurement of Object.values(generationCoreAutomationMillion)) {
    assert.equal(measurement.requestedTicks, 1000000, "automation million runs should request one million ticks");
    assert.equal(measurement.processedTicks, 1000000, "automation million runs should process one million ticks");
    assert.ok(measurement.simulationIterations < measurement.requestedTicks, "automation million runs should reduce committed updates");
    assert.equal(
      measurement.fullSimulationIterations,
      measurement.simulationIterations + measurement.eventProbeIterations,
      "automation million runs should account for speculative probe iterations",
    );
    assert.ok(measurement.bulkIterations > 0, "automation million runs should use stable bulk intervals");
    assert.ok(measurement.eventBoundaryCount > 0, "automation million runs should commit event boundaries");
    assert.ok(measurement.eventBoundaryIterations > 0, "automation million runs should report event-boundary iterations");
    assert.ok(measurement.predictionInvalidations >= measurement.eventBoundaryIterations, "automation million runs should invalidate boundary predictions");
    assert.equal(
      measurement.processedTicks,
      measurement.bulkProcessedTicks + measurement.simulationIterations - measurement.bulkIterations,
      "automation million runs should account for bulk and boundary commits",
    );
    assert.ok(Number.isFinite(measurement.wallMilliseconds), "automation million runs should report finite wall time");
  }
  assert.ok(
    generationCoreAutomationMillion.generation.eventCounts.generationResets > 0,
    "Generation-heavy automation should execute Generation",
  );
  assert.ok(
    generationCoreAutomationMillion.coreBoost.eventCounts.coreBoostResets > 0,
    "Core-Boost-heavy automation should execute Core Boost",
  );
  assert.ok(
    generationCoreAutomationMillion.combined.eventCounts.generationResets > 0
      && generationCoreAutomationMillion.combined.eventCounts.coreBoostResets > 0,
    "combined automation should execute both canonical reset paths",
  );
  const quietResume = report.offlineStress.quietResume;
  for (const [ticks, resume] of Object.entries(quietResume)) {
    assert.equal(resume.requestedTicks, Number(ticks), `quiet ${ticks}-tick resume should request its configured ticks`);
    assert.equal(resume.processedTicks, Number(ticks), `quiet ${ticks}-tick resume should process its configured ticks`);
    assert.ok(resume.simulationIterations < resume.requestedTicks, `quiet ${ticks}-tick resume should use fewer full updates`);
    assert.ok(resume.bulkIterations > 0, `quiet ${ticks}-tick resume should use bulk iterations`);
    assert.equal(
      resume.processedTicks,
      resume.bulkProcessedTicks + resume.simulationIterations - resume.bulkIterations
        + (resume.aggregatedTicks ?? 0),
      `quiet ${ticks}-tick resume should account for bulk and single-tick iterations`,
    );
    assert.ok(Number.isFinite(resume.wallMilliseconds), `quiet ${ticks}-tick resume should report finite wall time`);
  }
  const timelineResume = report.offlineStress.timelineResume;
  for (const [route, resume] of Object.entries(timelineResume)) {
    assert.equal(resume.requestedTicks, 1000000, `${route} Timeline resume should request one million ticks`);
    assert.equal(resume.processedTicks, 1000000, `${route} Timeline resume should process one million ticks`);
    assert.ok(resume.simulationIterations < resume.requestedTicks, `${route} Timeline resume should reduce full updates`);
    assert.ok(resume.bulkIterations > 0, `${route} Timeline resume should use bulk updates`);
    assert.equal(
      resume.processedTicks,
      resume.bulkProcessedTicks + resume.simulationIterations - resume.bulkIterations
        + (resume.aggregatedTicks ?? 0),
      `${route} Timeline bulk diagnostics should account for every processed tick`,
    );
    assert.ok(resume.work.totalIterations <= resume.work.hardCap, `${route} Timeline work should stay within its hard cap`);
    assert.equal(resume.precisionReduced, resume.work.precisionReduced, `${route} Timeline precision status should match its work ledger`);
    assert.equal(resume.final.infiniteAngleUnlocked, true, `${route} Timeline measurement should keep Infinite Angle active`);
    assert.ok(Number.isFinite(resume.wallMilliseconds), `${route} Timeline resume should report finite wall time`);
    assert.match(resume.final.eternityGainExact, /^\d+$/, `${route} AD30 gain should be recorded exactly`);
    assert.ok(BigInt(resume.final.eternityGainExact) > 1n, `${route} AD30 gain should remain active in the representative state`);
    assert.ok(
      Math.abs(resume.timelineSeconds - resume.expectedTimelineSeconds) < 1e-6,
      `${route} Timeline elapsed state should preserve the full offline duration`,
    );
  }
  assert.ok(
    timelineResume.parallel.final.parallelTimerEffectLog10 > 0,
    "Parallel-BC16500 should expose its accumulated post-IC8 effect",
  );
  assert.deepEqual(violations, [], `offline stress budget violations:\n${violations.join("\n")}`);
} finally {
  await gameTest.close();
}
