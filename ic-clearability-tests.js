const fs = require("fs");
const path = require("path");

const root = __dirname;
const originalReadFileSync = fs.readFileSync.bind(fs);
const gamePath = path.join(root, "game.js");
const gameCorePath = path.join(root, "game-core.js");
const balanceProfilePath = path.join(root, "balance-config.js");

function loadRegressionHelpers() {
  const source = originalReadFileSync(path.join(root, "regression-tests-core.js"), "utf8");
  const patched = source.replace(
    /run\(\)\.catch\(\(error\) => \{[\s\S]*?\n\}\);\s*$/,
    "return { loadGame };\n",
  );
  if (patched === source) throw new Error("Could not expose the regression harness helpers.");
  return new Function("require", "__dirname", "__filename", patched)(
    require,
    root,
    path.join(root, "regression-tests-core.js"),
  );
}

const helpers = loadRegressionHelpers();

function withActiveBalanceProfile(callback) {
  fs.readFileSync = (filePath, ...args) => {
    if (path.resolve(filePath) === gamePath) {
      return `${originalReadFileSync(gameCorePath, ...args)}\n${originalReadFileSync(balanceProfilePath, ...args)}`;
    }
    return originalReadFileSync(filePath, ...args);
  };
  try {
    return callback();
  } finally {
    fs.readFileSync = originalReadFileSync;
  }
}

const ALL_INFINITY_UPGRADES_MASK = (1 << 6) - 1;
const BASELINE_INFINITY_COUNT = 14;
const INFINITY_LOG10 = 308 + Math.log10(1.8);
const CORE_FORBIDDEN_CHALLENGE = 5;

const plans = [
  {
    id: "core-checkpoints",
    milestones: [10, 20, 40, 80, 120, 160, 200, 240, 280, 300, 304],
    maxSeconds: 4 * 60 * 60,
  },
  {
    id: "dense-generations",
    milestones: [8, 12, 16, 20, 30, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 292, 300, 304],
    maxSeconds: 4 * 60 * 60,
  },
  {
    id: "late-generations",
    milestones: [14, 28, 50, 80, 115, 150, 185, 220, 255, 285, 300, 304],
    maxSeconds: 6 * 60 * 60,
  },
];

function formatTime(seconds) {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  return `${minutes}m ${secs}s`;
}

function challengeStartingMask(index) {
  return index <= 1 ? 0 : (1 << (index - 1)) - 1;
}

function setupChallenge(index, allowVertexAutobuy) {
  const context = helpers.loadGame();
  const debug = context.window.__angleDebug;
  const { state } = debug;

  state.showFloatingText = false;
  state.lightEffects = true;
  state.infinityCount = BASELINE_INFINITY_COUNT;
  state.infinityUpgradeMask = ALL_INFINITY_UPGRADES_MASK;
  state.completedChallenges = challengeStartingMask(index);
  state.automationEnabled = true;
  state.autoBuySpeed = true;
  state.autoBuyVertex = allowVertexAutobuy;
  state.autoBuyGain = true;

  debug.toggleInfinityChallenge(index);
  if (state.activeChallenge !== index) {
    throw new Error(`Could not start IC${index}.`);
  }
  return { context, debug, state };
}

function nextMilestone(previousGenerationScoreLog, maximum) {
  return plans[0].milestones.find(() => false);
}

function simulateChallenge(index, plan, allowVertexAutobuy) {
  return withActiveBalanceProfile(() => {
    const { context, debug, state } = setupChallenge(index, allowVertexAutobuy);
    const result = {
      challenge: `IC${index}`,
      plan: plan.id,
      vertexAutobuy: allowVertexAutobuy,
      cleared: false,
      simulatedSeconds: 0,
      generations: 0,
      coreBoosts: 0,
      maxScoreLog10: -Infinity,
      finalScoreLog10: -Infinity,
      finalGenerationCount: 0,
      finalCoreBoostCount: 0,
    };

    const dt = 0.1;
    const steps = Math.ceil(plan.maxSeconds / dt);
    for (let step = 0; step < steps; step += 1) {
      const scoreLog = context.currentScoreLog10();
      result.maxScoreLog10 = Math.max(result.maxScoreLog10, scoreLog);

      if (scoreLog >= INFINITY_LOG10 || context.canInfinity()) {
        debug.runInfinity(false);
        result.simulatedSeconds = state.currentInfinityRunTime;
        if (state.activeChallenge === 0 && (state.completedChallenges & (1 << (index - 1))) !== 0) {
          result.cleared = true;
          break;
        }
      }

      const coreAllowed = index !== CORE_FORBIDDEN_CHALLENGE;
      const coreRequirement = context.coreBoostRequirementLog10();
      const previousGenerationScoreLog = context.currentPreviousGenerationScoreLog10();

      if (coreAllowed && scoreLog >= coreRequirement) {
        if (context.canRunGeneration() && previousGenerationScoreLog < coreRequirement - 0.05) {
          debug.runGeneration();
          result.generations += 1;
          continue;
        }
        if (context.canCoreBoost()) {
          debug.runCoreBoost();
          result.coreBoosts += 1;
          continue;
        }
      }

      const generationCeiling = coreAllowed
        ? Math.min(coreRequirement - 0.05, 304)
        : 304;
      const target = plan.milestones.find((milestone) => (
        milestone > previousGenerationScoreLog + 0.05
        && milestone <= generationCeiling + 1e-9
      ));
      if (target !== undefined && scoreLog >= target && context.canRunGeneration()) {
        debug.runGeneration();
        result.generations += 1;
        continue;
      }

      debug.update(dt);
    }

    result.finalScoreLog10 = context.currentScoreLog10();
    result.finalGenerationCount = state.generationCount;
    result.finalCoreBoostCount = state.coreBoostCount;
    if (!result.cleared) result.simulatedSeconds = plan.maxSeconds;
    return result;
  });
}

function validateAllChallenges() {
  const allResults = [];
  for (let index = 1; index <= 8; index += 1) {
    const vertexModes = index === 1 ? [false, true] : [true];
    let winner = null;
    const attempts = [];

    for (const allowVertexAutobuy of vertexModes) {
      for (const plan of plans) {
        const result = simulateChallenge(index, plan, allowVertexAutobuy);
        attempts.push(result);
        if (result.cleared && (!winner || result.simulatedSeconds < winner.simulatedSeconds)) {
          winner = result;
        }
      }
    }

    allResults.push({
      challenge: `IC${index}`,
      cleared: Boolean(winner),
      best: winner,
      attempts,
    });
  }
  return allResults;
}

const results = validateAllChallenges();
for (const result of results) {
  if (result.cleared) {
    const best = result.best;
    console.log(`${result.challenge}: CLEAR | ${formatTime(best.simulatedSeconds)} | ${best.plan} | GR ${best.generations} | CB ${best.coreBoosts} | max e${best.maxScoreLog10.toFixed(2)} | vertex autobuy ${best.vertexAutobuy}`);
  } else {
    const bestProgress = result.attempts.reduce((best, attempt) => (
      !best || attempt.maxScoreLog10 > best.maxScoreLog10 ? attempt : best
    ), null);
    console.log(`${result.challenge}: NOT CLEARED | best e${bestProgress.maxScoreLog10.toFixed(2)} after ${formatTime(bestProgress.simulatedSeconds)} | ${bestProgress.plan} | GR ${bestProgress.generations} | CB ${bestProgress.coreBoosts} | vertex autobuy ${bestProgress.vertexAutobuy}`);
  }
}

const failures = results.filter((result) => !result.cleared);
if (failures.length > 0) {
  process.exitCode = 1;
}
