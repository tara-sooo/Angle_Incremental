const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("../tests/runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");
const UPGRADE_ORDER = ["speed", "vertex", "gain"];
// Keep the no-argument check short; long projections opt in with --max-seconds.
const DEFAULT_MAX_SECONDS = 5 * 60;
const DEFAULT_STEP_SECONDS = 10;
const TARGET_LOG10 = 50;
const TOWER_FLOOR_ONE_LOG10 = 50;

function parseNumberOption(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = Number(args[index + 1]);
  if (!Number.isFinite(value)) throw new Error(`${name} requires a finite number`);
  return value;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    growthPower: parseNumberOption(args, "--growth-power", 0.1),
    postLevelScale: parseNumberOption(args, "--post-scale", 0.1),
    maxSeconds: parseNumberOption(args, "--max-seconds", DEFAULT_MAX_SECONDS),
    stepSeconds: parseNumberOption(args, "--step", DEFAULT_STEP_SECONDS),
    initialIpLog10: parseNumberOption(args, "--initial-ip-log10", 5),
    generationMultiplierLog10: parseNumberOption(args, "--generation-multiplier-log10", 0),
    generationScoreThreshold: parseNumberOption(args, "--generation-score", 2),
    generationCostThreshold: parseNumberOption(args, "--generation-cost", 1),
    infinityReserveMultiplier: parseNumberOption(args, "--infinity-reserve", 1.1),
    minimumInfinityGain: parseNumberOption(args, "--minimum-infinity-gain", 1),
    freezeLayers: args.includes("--freeze-layers"),
    disableCoreBoostAutomation: args.includes("--no-core-boost"),
    disableGenerationAutomation: args.includes("--no-generation"),
    sweep: args.includes("--sweep"),
  };
}

function exactCost(runtime, kind) {
  return runtime.exactInfinityPointsFromCostLog10(
    runtime.infiniteAngleUpgradeCostLog10(kind),
  );
}

function minimumUpgradeCost(runtime) {
  return UPGRADE_ORDER.reduce((best, kind) => {
    const cost = exactCost(runtime, kind);
    return cost < best ? cost : best;
  }, runtime.MAX_EXACT_INFINITY_POINTS);
}

function reserveForUpgrade(cost, multiplier) {
  const scaledMultiplier = BigInt(Math.max(1, Math.round(multiplier * 100)));
  return (cost * scaledMultiplier + 99n) / 100n;
}

function log10Number(value) {
  return value > 0 ? Math.log10(value) : -Infinity;
}

function advanceSimulation(runtime, debug, duration) {
  let remaining = duration;
  while (remaining > 0) {
    const step = Math.min(runtime.MAX_SIMULATION_STEP_SECONDS, remaining);
    debug.update(step);
    remaining -= step;
  }
}

function configureIdealSnapshot(instance, options) {
  const { debug, runtime } = instance;
  const { state } = debug;
  const allInfinityUpgrades = (1 << runtime.INFINITY_UPGRADES.length) - 1;
  const allChallenges = (1 << runtime.INFINITY_CHALLENGE_COUNT) - 1;
  const allAchievements = (1 << runtime.ACHIEVEMENT_COUNT) - 1;

  state.infinityCount = 10000;
  state.infinityUpgradeMask = allInfinityUpgrades;
  state.completedChallenges = allChallenges;
  state.achievementMask = allAchievements;
  state.infiniteCapBroken = true;
  state.infiniteAngleUnlocked = true;
  state.towerFloor = 0;
  state.automationEnabled = true;
  state.autoBuySpeed = true;
  state.autoBuyVertex = true;
  state.autoBuyGain = true;
  state.autoRunGeneration = !options.freezeLayers && !options.disableGenerationAutomation;
  state.autoRunCoreBoost = !options.freezeLayers && !options.disableCoreBoostAutomation;
  state.autoRunInfinity = false;
  state.autoGenerationScoreMultiplierThreshold = options.generationScoreThreshold;
  state.autoGenerationCostMultiplierThreshold = options.generationCostThreshold;
  state.autoGenerationMinimumSeconds = 0;
  state.autoGenerationLegacyOrMode = false;
  state.totalPlayTime = 0;
  state.currentInfinityRunTime = 0;
  state.currentGenerationRunTime = 0;
  runtime.syncInfinityPointCachesFromExact(
    runtime.exactInfinityPointsFromLog10(options.initialIpLog10),
  );
  runtime.resetBelowInfinity();
  runtime.syncInfinityPointCachesFromExact(
    runtime.exactInfinityPointsFromLog10(options.initialIpLog10),
  );
  state.generationScoreMultiplierLog10 = Math.max(0, options.generationMultiplierLog10);
  state.generationScoreMultiplier = runtime.valueFromLog10(state.generationScoreMultiplierLog10);
  
  // The simulation intentionally omits DOM work and save I/O from each event.
  runtime.updateUi = () => {};
  runtime.saveGame = () => true;
}

function buyCheapestInfiniteAngleUpgrades(runtime, debug) {
  let purchases = 0;
  while (true) {
    const available = UPGRADE_ORDER
      .map((kind) => ({ kind, cost: exactCost(runtime, kind) }))
      .filter(({ cost }) => cost <= runtime.currentExactInfinityPoints())
      .sort((left, right) => {
        if (left.cost < right.cost) return -1;
        if (left.cost > right.cost) return 1;
        return UPGRADE_ORDER.indexOf(left.kind) - UPGRADE_ORDER.indexOf(right.kind);
      });
    if (available.length === 0) return purchases;
    assert.equal(debug.buyInfiniteAngleUpgrade(available[0].kind), true);
    purchases += 1;
  }
}

function buildTowerBeforeUpgrades(runtime, debug) {
  if (runtime.towerFloor() !== 0) return false;
  if (runtime.currentExactInfinityPoints() < runtime.exactInfinityPointsFromCostLog10(TOWER_FLOOR_ONE_LOG10)) {
    return false;
  }
  assert.equal(debug.buildTower(), true);
  return true;
}

function maybeRunInfinity(runtime, debug, options, infinityRuns) {
  if (!runtime.canInfinity() || runtime.state.infinityCount <= 0) return false;
  const reserveTarget = options.minimumInfinityGain > 0 && infinityRuns === 0
    ? BigInt(Math.max(1, Math.floor(options.minimumInfinityGain)))
    : reserveForUpgrade(minimumUpgradeCost(runtime), options.infinityReserveMultiplier);
  const gainValue = runtime.infinityPointGain();
  const gain = BigInt(Math.max(0, Math.floor(gainValue)));
  if (gain < reserveTarget) return false;
  const snapshot = {
    gain: gainValue,
    gainLog10: log10Number(gainValue),
    scoreLog10: runtime.currentScoreLog10(),
    generationMultiplierEffectLog10: runtime.generationScoreMultiplierEffectLog10(),
  };
  debug.runInfinity(false);
  return snapshot;
}

function runSimulation(options) {
  return loadRuntime(candidatePath).then((instance) => {
    const { debug, runtime } = instance;
    runtime.infiniteAngleCostCurve = {
      growthPower: options.growthPower,
      postLevelScale: options.postLevelScale,
    };
    configureIdealSnapshot(instance, options);

    let elapsed = 0;
    let infinityRuns = 0;
    let upgrades = 0;
    let towerBuiltAt = null;
    let targetReachedAt = null;
    let postTowerIp = null;
    let previousIp = runtime.currentExactInfinityPoints();
    let postTowerGrowth = 0n;
    const progressMarks = new Map();
    const generationPeakEvents = [];
    const infinityGainSamples = [];
    const peakGeneration = {
      elapsed: null,
      count: 0,
      previousScoreLog10: null,
      multiplierLog10: 0,
      multiplierEffectLog10: 0,
      ic8MultiplierLog10: 0,
    };
    const peakInfinityGain = {
      elapsed: null,
      gain: 0,
      gainLog10: -Infinity,
      scoreLog10: null,
      generationMultiplierEffectLog10: 0,
    };
    let previousGenerationCount = runtime.state.generationCount;

    upgrades += buyCheapestInfiniteAngleUpgrades(runtime, debug);

    while (elapsed < options.maxSeconds) {
      const interval = Math.min(options.stepSeconds, options.maxSeconds - elapsed);
      advanceSimulation(runtime, debug, interval);
      elapsed += interval;

      if (runtime.state.generationCount !== previousGenerationCount) {
        const multiplierEffectLog10 = runtime.generationScoreMultiplierEffectLog10();
        const ic8MultiplierLog10 = runtime.isChallengeCompleted(8)
          ? Math.max(0, multiplierEffectLog10 - 20)
          : 0;
        if (multiplierEffectLog10 > peakGeneration.multiplierEffectLog10) {
          Object.assign(peakGeneration, {
            elapsed,
            count: runtime.state.generationCount,
            previousScoreLog10: runtime.state.previousGenerationScoreLog10,
            multiplierLog10: runtime.state.generationScoreMultiplierLog10,
            multiplierEffectLog10,
            ic8MultiplierLog10,
          });
          generationPeakEvents.push({
            elapsed,
            count: runtime.state.generationCount,
            previousScoreLog10: runtime.state.previousGenerationScoreLog10,
            multiplierEffectLog10,
            ic8MultiplierLog10,
          });
          if (generationPeakEvents.length > 20) generationPeakEvents.shift();
        }
        previousGenerationCount = runtime.state.generationCount;
      }

      const infinitySnapshot = maybeRunInfinity(runtime, debug, options, infinityRuns);
      if (infinitySnapshot) {
        infinityRuns += 1;
        if (infinityGainSamples.length < 3) {
          infinityGainSamples.push({ elapsed, ...infinitySnapshot });
        }
        if (infinitySnapshot.gain >= peakInfinityGain.gain) {
          Object.assign(peakInfinityGain, { elapsed, ...infinitySnapshot });
        }
        const ipBeforePurchases = runtime.currentExactInfinityPoints();
        if (targetReachedAt === null && ipBeforePurchases >= runtime.exactInfinityPointsFromCostLog10(TARGET_LOG10)) {
          targetReachedAt = elapsed;
          postTowerIp = ipBeforePurchases;
        }
        if (buildTowerBeforeUpgrades(runtime, debug) && towerBuiltAt === null) {
          towerBuiltAt = elapsed;
        }
        upgrades += buyCheapestInfiniteAngleUpgrades(runtime, debug);
      }

      const currentIp = runtime.currentExactInfinityPoints();
      if (towerBuiltAt !== null && currentIp > previousIp) postTowerGrowth += currentIp - previousIp;
      previousIp = currentIp;
      if (targetReachedAt === null && currentIp >= runtime.exactInfinityPointsFromCostLog10(TARGET_LOG10)) {
        targetReachedAt = elapsed;
        postTowerIp = currentIp;
      }

      [20, 30, 40, 45, 50, 60].forEach((mark) => {
        if (!progressMarks.has(mark) && runtime.log10ExactInfinityPoints(currentIp) >= mark) {
          progressMarks.set(mark, elapsed);
        }
      });
      if (targetReachedAt !== null && elapsed >= targetReachedAt + 24 * 60 * 60) break;
    }

    return {
      growthPower: options.growthPower,
      postLevelScale: options.postLevelScale,
      elapsedSeconds: elapsed,
      targetReachedAt,
      towerBuiltAt,
      postTowerIp: postTowerIp === null ? null : postTowerIp.toString(),
      postTowerGrowthLog10: postTowerGrowth > 0n ? runtime.log10ExactInfinityPoints(postTowerGrowth) : null,
      infinityRuns,
      upgrades,
      levels: {
        speed: runtime.state.infiniteAngleSpeedLevel,
        vertex: runtime.state.infiniteAngleVertexLevel,
        gain: runtime.state.infiniteAngleGainLevel,
      },
      state: {
        scoreLog10: runtime.currentScoreLog10(),
        generationCount: runtime.state.generationCount,
        generationScoreMultiplierLog10: runtime.state.generationScoreMultiplierLog10,
        generationScoreMultiplierEffectLog10: runtime.generationScoreMultiplierEffectLog10(),
        coreBoostCount: runtime.state.coreBoostCount,
        infinityCount: runtime.state.infinityCount,
        infiniteScoreLog10: runtime.currentInfiniteScoreLog10(),
        ic8Completed: runtime.isChallengeCompleted(8),
        infinityPointGain: runtime.infinityPointGain(),
      },
      peakGeneration,
      peakInfinityGain,
      generationPeakEvents,
      infinityGainSamples,
      ipLog10: runtime.log10ExactInfinityPoints(runtime.currentExactInfinityPoints()),
      progressMarks: Object.fromEntries(progressMarks),
      costs: Object.fromEntries(UPGRADE_ORDER.map((kind) => [
        kind,
        runtime.infiniteAngleUpgradeCostLog10(kind),
      ])),
    };
  });
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return "not reached";
  const hours = seconds / 3600;
  if (hours < 1) return `${seconds.toFixed(1)}s`;
  if (hours < 48) return `${hours.toFixed(2)}h`;
  return `${(hours / 24).toFixed(2)}d`;
}

function printResult(result) {
  console.log(JSON.stringify({
    ...result,
    targetReached: formatDuration(result.targetReachedAt),
    towerBuilt: formatDuration(result.towerBuiltAt),
  }, null, 2));
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.stepSeconds <= 0 || options.maxSeconds <= 0) throw new Error("step and max-seconds must be positive");
  if (options.sweep) {
    const results = [];
    for (let growthPower = 0.35; growthPower <= 1.0001; growthPower += 0.05) {
      for (let postLevelScale = 0; postLevelScale <= 1.0001; postLevelScale += 0.1) {
        results.push(await runSimulation({
          ...options,
          growthPower: Number(growthPower.toFixed(2)),
          postLevelScale: Number(postLevelScale.toFixed(1)),
          maxSeconds: Math.min(options.maxSeconds, 24 * 60 * 60),
        }));
      }
    }
    results
      .sort((left, right) => (left.targetReachedAt ?? Infinity) - (right.targetReachedAt ?? Infinity));
    console.log(JSON.stringify(results.map((result) => ({
      growthPower: result.growthPower,
      postLevelScale: result.postLevelScale,
      targetReached: formatDuration(result.targetReachedAt),
      targetReachedAt: result.targetReachedAt,
      towerBuilt: formatDuration(result.towerBuiltAt),
      towerBuiltAt: result.towerBuiltAt,
      ipLog10: result.ipLog10,
      upgrades: result.upgrades,
    })), null, 2));
    return;
  }
  printResult(await runSimulation(options));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
