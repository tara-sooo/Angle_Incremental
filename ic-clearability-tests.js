const fs = require("fs");
const path = require("path");

const root = __dirname;
const originalReadFileSync = fs.readFileSync.bind(fs);
const gamePath = path.join(root, "game.js");
const gameCorePath = path.join(root, "game-core.js");
const balanceProfilePath = path.join(root, "balance-config.js");
const source = originalReadFileSync(path.join(root, "regression-tests-core.js"), "utf8");
const patched = source.replace(
  /run\(\)\.catch\(\(error\) => \{[\s\S]*?\n\}\);\s*$/,
  "return { loadGame };\n",
);
if (patched === source) throw new Error("Could not expose the regression harness helpers.");
const { loadGame } = new Function("require", "__dirname", "__filename", patched)(
  require,
  root,
  path.join(root, "regression-tests-core.js"),
);

const ALL_IU = (1 << 6) - 1;
const INFINITY_LOG10 = 308 + Math.log10(1.8);
const MILESTONES = [8, 12, 16, 20, 30, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 292, 300, 304];

function withBalance(callback) {
  fs.readFileSync = (filePath, ...args) => path.resolve(filePath) === gamePath
    ? `${originalReadFileSync(gameCorePath, ...args)}\n${originalReadFileSync(balanceProfilePath, ...args)}`
    : originalReadFileSync(filePath, ...args);
  try {
    return callback();
  } finally {
    fs.readFileSync = originalReadFileSync;
  }
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);
  return hours > 0 ? `${hours}h ${minutes}m ${secs}s` : `${minutes}m ${secs}s`;
}

function runChallenge(index, allowVertexAutobuy) {
  return withBalance(() => {
    const context = loadGame();
    const debug = context.window.__angleDebug;
    const { state } = debug;
    state.showFloatingText = false;
    state.lightEffects = true;
    state.infinityCount = 14;
    state.infinityUpgradeMask = ALL_IU;
    state.completedChallenges = index === 1 ? 0 : (1 << (index - 1)) - 1;
    state.automationEnabled = false;
    debug.toggleInfinityChallenge(index);

    let generations = 0;
    let coreBoosts = 0;
    let maxScoreLog10 = -Infinity;
    const dt = 5;
    const maxSeconds = 8 * 60 * 60;

    for (let elapsed = 0; elapsed <= maxSeconds; elapsed += dt) {
      const scoreLog = context.currentScoreLog10();
      maxScoreLog10 = Math.max(maxScoreLog10, scoreLog);

      if (scoreLog >= INFINITY_LOG10 || context.canInfinity()) {
        debug.runInfinity(false);
        if (state.activeChallenge === 0 && (state.completedChallenges & (1 << (index - 1))) !== 0) {
          return { cleared: true, elapsed, generations, coreBoosts, maxScoreLog10 };
        }
      }

      const coreAllowed = index !== 5;
      const coreRequirement = context.coreBoostRequirementLog10();
      const previousGenerationScore = context.currentPreviousGenerationScoreLog10();
      if (coreAllowed && scoreLog >= coreRequirement) {
        if (context.canRunGeneration() && previousGenerationScore < coreRequirement - 0.05) {
          debug.runGeneration();
          generations += 1;
          continue;
        }
        if (context.canCoreBoost()) {
          debug.runCoreBoost();
          coreBoosts += 1;
          continue;
        }
      }

      const ceiling = coreAllowed ? Math.min(coreRequirement - 0.05, 304) : 304;
      const target = MILESTONES.find((milestone) => milestone > previousGenerationScore + 0.05 && milestone <= ceiling);
      if (target !== undefined && scoreLog >= target && context.canRunGeneration()) {
        debug.runGeneration();
        generations += 1;
        continue;
      }

      debug.buyAllUpgrades({
        refresh: false,
        save: false,
        allowSpeed: true,
        allowVertex: allowVertexAutobuy,
        allowGain: true,
      });
      debug.update(dt);
    }

    return {
      cleared: false,
      elapsed: maxSeconds,
      generations,
      coreBoosts,
      maxScoreLog10,
      finalScoreLog10: context.currentScoreLog10(),
    };
  });
}

const results = [];
for (let index = 1; index <= 8; index += 1) {
  const modes = index === 1 ? [false, true] : [true];
  let best = null;
  for (const allowVertexAutobuy of modes) {
    const result = runChallenge(index, allowVertexAutobuy);
    result.allowVertexAutobuy = allowVertexAutobuy;
    if (result.cleared && (!best || result.elapsed < best.elapsed)) best = result;
    results.push({ index, ...result });
  }
  if (best) {
    console.log(`IC${index}: CLEAR | ${formatTime(best.elapsed)} | GR ${best.generations} | CB ${best.coreBoosts} | max e${best.maxScoreLog10.toFixed(2)} | vertex autobuy ${best.allowVertexAutobuy}`);
  } else {
    const attempts = results.filter((result) => result.index === index);
    const furthest = attempts.reduce((left, right) => left.maxScoreLog10 >= right.maxScoreLog10 ? left : right);
    console.log(`IC${index}: NOT CLEARED | best e${furthest.maxScoreLog10.toFixed(2)} after ${formatTime(furthest.elapsed)} | GR ${furthest.generations} | CB ${furthest.coreBoosts} | vertex autobuy ${furthest.allowVertexAutobuy}`);
  }
}

if (results.filter((result) => !result.cleared).length > 0) process.exitCode = 1;
