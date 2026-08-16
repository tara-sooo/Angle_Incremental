const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("../tests/runtime-harness-esm.js");

const CANDIDATE_A = Object.freeze({ a: 0.20, b: 0.50, c: 1 });
const TC4_KINDS = Object.freeze(["baseGain", "infinityScoreVertexGain", "freeCoreBoost"]);
const TC4_KIND_LABELS = Object.freeze({
  baseGain: "A",
  infinityScoreVertexGain: "B",
  freeCoreBoost: "C",
});
const NORMAL_KINDS = Object.freeze(["speed", "vertex", "gain"]);
const TARGET_LOG10 = 7777;
const DEFAULT_MAX_SECONDS = 24 * 60 * 60;
const DEFAULT_STEP_SECONDS = 10;
const DEFAULT_MAX_STATES = 2000;
const DEFAULT_MAX_ROUTES = 300;
const DEFAULT_STALL_SECONDS = 4 * 60 * 60;
const CANDIDATE_PATH = path.join(__dirname, "..", "src", "main.js");
const GENERATION_RESET_POLICY = Object.freeze({
  infinityMinimumSeconds: 60,
  generationMinimumSeconds: 60,
  generationMinimumScoreMultiplierRatio: 2,
  generationMinimumCostFactorRatio: 1.05,
  priority: "TC4 purchase, Infinity, Core Boost, qualified Generation",
});
const RESET_POLICIES = Object.freeze([
  ...[60, 120, 300, 600, 1800].map((minimumRunSeconds) => Object.freeze({
    id: `fixed-${minimumRunSeconds}`,
    type: "fixed",
    minimumRunSeconds,
  })),
  Object.freeze({
    id: "gain-aware-2x",
    type: "gain-aware",
    minimumRunSeconds: 60,
    minimumIpGainMultiplier: 2,
  }),
  Object.freeze({
    id: "threshold-aware",
    type: "threshold-aware",
    minimumRunSeconds: 60,
    progressWindowSeconds: 120,
    progressThresholdLog10: 1,
    lookaheadSeconds: 600,
  }),
]);

// This is the explicit review ledger for every source use found by
// `rg -n coreBoostCount src`. Free CB is only allowed to affect benefit rows.
const CORE_BOOST_SOURCE_USE_MANIFEST = Object.freeze([
  ["src/patches/numeric-stability.js", "coreBoostRequirementWithoutEarlyCap", "requirement/reset/history"],
  ["src/main.js", "render_game_to_text state.count", "requirement/reset/history"],
  ["src/systems/infinity.js", "resetBelowInfinity", "requirement/reset/history"],
  ["src/systems/infinity.js", "applyStartingCoreBoosts", "requirement/reset/history"],
  ["src/systems/balance-core-boost.js", "canonicalCoreBoostGainIncreaseBaseForCount", "benefit"],
  ["src/systems/angle.js", "lapSpeedSoftcapStart", "benefit"],
  ["src/systems/angle.js", "lapSpeedSoftcapPower", "benefit"],
  ["src/systems/angle.js", "earlyLayerCostScalingFactor", "benefit"],
  ["src/systems/angle.js", "stagedUpgradeCostScalingLog10", "benefit"],
  ["src/systems/achievements.js", "achievement 4 and 8 unlock conditions", "requirement/reset/history"],
  ["src/systems/core-boost.js", "coreBoostRequirementLog10", "requirement/reset/history"],
  ["src/systems/core-boost.js", "coreBoostGainIncreaseMultiplier", "benefit"],
  ["src/systems/core-boost.js", "coreBoostGainExponent", "benefit"],
  ["src/systems/core-boost.js", "nextCoreBoostValues", "benefit"],
  ["src/systems/core-boost.js", "runCoreBoost increment and reset marker", "requirement/reset/history"],
  ["src/core/state.js", "serialized state field", "requirement/reset/history"],
  ["src/core/save.js", "save/load and invalid-save validation", "requirement/reset/history"],
  ["src/ui/render-topbar.js", "progress display", "requirement/reset/history"],
  ["src/ui/render-ui.js", "core boost counter display", "requirement/reset/history"],
  ["src/ui/dom.js", "core boost counter element", "requirement/reset/history"],
]);

function parseNumberOption(args, name, fallback, minimum = -Infinity) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = Number(args[index + 1]);
  if (!Number.isFinite(value) || value < minimum) throw new Error(`${name} requires a number >= ${minimum}`);
  return value;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const format = args.includes("--json") ? "json" : args.includes("--markdown") ? "markdown" : "json";
  return {
    format,
    maxSeconds: parseNumberOption(args, "--max-seconds", DEFAULT_MAX_SECONDS, 1),
    stepSeconds: parseNumberOption(args, "--step-seconds", DEFAULT_STEP_SECONDS, 0.1),
    maxStates: Math.floor(parseNumberOption(args, "--max-states", DEFAULT_MAX_STATES, 1)),
    maxRoutes: Math.floor(parseNumberOption(args, "--max-routes", DEFAULT_MAX_ROUTES, 1)),
    stallSeconds: parseNumberOption(args, "--stall-seconds", DEFAULT_STALL_SECONDS, 1),
    targetLog10: parseNumberOption(args, "--target-log10", TARGET_LOG10, 1),
  };
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  return value;
}

function captureState(state) {
  return cloneValue(state);
}

function restoreState(state, snapshot) {
  Object.keys(snapshot).forEach((key) => {
    state[key] = cloneValue(snapshot[key]);
  });
}

function effectiveCoreBoostCount(runtime, candidate) {
  const free = runtime.state.activeTowerChallenge === 4
    ? Math.max(0, Math.floor(runtime.state.tc4FreeCoreBoostLevel)) * candidate.c
    : 0;
  return Math.max(0, Math.floor(runtime.state.coreBoostCount)) + free;
}

function coreBoostGainBase(runtime, count) {
  const increase = runtime.hasInfinityUpgrade("7-1") ? 1 : 0.5;
  return runtime.hasInfinityUpgrade("12-1")
    ? Math.pow(1 + increase, count)
    : 1 + count * increase;
}

function coreBoostGainExponentForCount(runtime, count) {
  const base = runtime.hasInfinityUpgrade("12-1") ? Math.pow(1.02, count) : 1 + count * 0.02;
  const ic8Bonus = runtime.state.activeChallenge === 8
    ? runtime.ic8VertexScoreExponentBonus(runtime.state.ic8VertexUpgradeLevel)
    : 0;
  return Math.pow(base, runtime.coreBoostBonusPower())
    + ic8Bonus
    + (runtime.isChallengeCompleted(5) ? 0.01 : 0);
}

function installCandidateEffects(runtime, candidate) {
  const original = {
    coreBoostGainIncreaseMultiplier: runtime.coreBoostGainIncreaseMultiplier,
    coreBoostGainExponent: runtime.coreBoostGainExponent,
    infiniteAngleBoostLog10: runtime.infiniteAngleBoostLog10,
    finalScoreGainFromBaseLog10: runtime.finalScoreGainFromBaseLog10,
    lapSpeedSoftcapStart: runtime.lapSpeedSoftcapStart,
    lapSpeedSoftcapPower: runtime.lapSpeedSoftcapPower,
    earlyLayerCostScalingFactor: runtime.earlyLayerCostScalingFactor,
    stagedUpgradeCostScalingLog10: runtime.stagedUpgradeCostScalingLog10,
  };

  runtime.coreBoostGainIncreaseMultiplier = () => {
    if (runtime.state.activeTowerChallenge !== 4 || candidate.c <= 0) return original.coreBoostGainIncreaseMultiplier();
    return Math.pow(coreBoostGainBase(runtime, effectiveCoreBoostCount(runtime, candidate)), runtime.coreBoostBonusPower());
  };
  runtime.coreBoostGainExponent = () => {
    if (runtime.state.activeTowerChallenge !== 4 || candidate.c <= 0) return original.coreBoostGainExponent();
    return coreBoostGainExponentForCount(runtime, effectiveCoreBoostCount(runtime, candidate));
  };
  runtime.infiniteAngleBoostLog10 = () => {
    const base = original.infiniteAngleBoostLog10();
    if (runtime.state.activeTowerChallenge !== 4 || candidate.b <= 0) return base;
    const scoreLog = runtime.currentInfiniteScoreLog10();
    const level = Math.max(0, Math.floor(runtime.state.tc4InfinityScoreVertexGainLevel));
    return scoreLog === -Infinity ? base : base + scoreLog * candidate.b * level;
  };
  runtime.finalScoreGainFromBaseLog10 = (baseLog) => {
    if (runtime.state.activeTowerChallenge !== 4 || candidate.a <= 0) return original.finalScoreGainFromBaseLog10(baseLog);
    const config = runtime.gainExpressionConfig();
    const parts = Math.max(1, config.parts);
    const exponent = parts + candidate.a * Math.max(0, Math.floor(runtime.state.tc4BaseGainLevel));
    const expression = (baseLog - runtime.log10Value(config.divisor)) * exponent;
    const boostedLog = expression * runtime.coreBoostGainExponent() + runtime.generationScoreMultiplierEffectLog10();
    return boostedLog * runtime.finalScoreGainPower() - runtime.log10Value(runtime.finalScoreGainDivisor());
  };
  runtime.lapSpeedSoftcapStart = () => {
    if (runtime.state.activeTowerChallenge !== 4 || candidate.c <= 0 || runtime.state.generationCount <= 0) {
      return original.lapSpeedSoftcapStart();
    }
    const count = effectiveCoreBoostCount(runtime, candidate);
    const stagedStart = Math.min(runtime.LAP_SPEED_SOFTCAP_START, 60 + (runtime.state.generationCount - 1) * 40 + count * 65);
    const relief = Math.min(1.5, Math.max(0, runtime.currentGenerationScoreMultiplierLog10()) * 0.08);
    return stagedStart * (1 + relief);
  };
  runtime.lapSpeedSoftcapPower = () => {
    if (runtime.state.activeTowerChallenge !== 4 || candidate.c <= 0 || runtime.state.generationCount <= 0) {
      return original.lapSpeedSoftcapPower();
    }
    return Math.min(runtime.LAP_SPEED_SOFTCAP_POWER, 0.24 + (runtime.state.generationCount - 1) * 0.06 + effectiveCoreBoostCount(runtime, candidate) * 0.1);
  };
  runtime.earlyLayerCostScalingFactor = () => {
    if (runtime.state.activeTowerChallenge !== 4 || candidate.c <= 0) return original.earlyLayerCostScalingFactor();
    if (runtime.state.generationCount <= 0) return 1;
    const generationFactor = [1, 0.9, 0.45, 0.2][runtime.state.generationCount] ?? 0.08;
    const count = effectiveCoreBoostCount(runtime, candidate);
    const coreRelief = count <= 0 ? 1 : count === 1 ? 0.35 : count === 2 ? 0.1 : 0;
    return generationFactor * coreRelief;
  };
  runtime.stagedUpgradeCostScalingLog10 = (costLog) => {
    if (runtime.state.activeTowerChallenge !== 4 || candidate.c <= 0) return original.stagedUpgradeCostScalingLog10(costLog);
    const relief = Math.max(0.28, 1 - Math.max(0, runtime.state.generationCount - 1) * 0.06 - effectiveCoreBoostCount(runtime, candidate) * 0.16);
    return runtime.STAGED_UPGRADE_COST_SCALING.reduce((total, stage) => {
      const excess = Math.max(0, costLog - stage.startsAfterLog10);
      return total + excess * excess * stage.logScale * relief;
    }, 0);
  };
}

async function configureBaseline(instance) {
  const { runtime, debug } = instance;
  const state = debug.state;
  const allInfinityUpgrades = (1 << runtime.INFINITY_UPGRADES.length) - 1;
  const allChallenges = (1 << runtime.INFINITY_CHALLENGE_COUNT) - 1;
  const allAchievementsHigh = (2 ** (runtime.ACHIEVEMENT_COUNT - 31)) - 1;
  const persistent = {
    towerFloor: 12,
    completedTowerChallenges: 0b111,
    activeTowerChallenge: 4,
    completedChallenges: allChallenges,
    infinityUpgradeMask: allInfinityUpgrades,
    infiniteCapBroken: true,
    infiniteAngleUnlocked: true,
    infinityCount: 600000,
    achievementMask: 0x7fffffff,
    achievementMaskHigh: allAchievementsHigh,
  };

  runtime.updateUi = () => {};
  runtime.saveGame = () => true;
  runtime.createCheckpoint = () => true;
  runtime.syncInfinityPointCachesFromExact(runtime.exactInfinityPointsFromLog10(25));
  Object.assign(state, persistent);
  runtime.resetBelowInfinity();
  Object.assign(state, persistent, {
    activeChallenge: 0,
    tc4BaseGainLevel: 0,
    tc4BaseGainPriceStep: 0,
    tc4InfinityScoreVertexGainLevel: 0,
    tc4InfinityScoreVertexGainPriceStep: 0,
    tc4FreeCoreBoostLevel: 0,
    tc4FreeCoreBoostPriceStep: 0,
    automationEnabled: false,
    autoBuySpeed: true,
    autoBuyVertex: true,
    autoBuyGain: true,
    autoRunGeneration: false,
    autoRunCoreBoost: false,
    autoRunInfinity: false,
  });
  runtime.syncInfinityPointCachesFromExact(runtime.exactInfinityPointsFromLog10(25));
  const iaPurchases = runtime.buyAllInfiniteAngleUpgrades({ refresh: false, save: false });
  assert.equal(iaPurchases, 3, "the Floor-12 fixture must afford exactly the legal IA level-1 purchases");
  assert.deepEqual(
    [state.infiniteAngleSpeedLevel, state.infiniteAngleVertexLevel, state.infiniteAngleGainLevel],
    [1, 1, 1],
  );
  assert.equal(runtime.towerChallenge4AllowsNormalUpgrade("speed"), true);
  assert.equal(runtime.towerChallenge4AllowsInfiniteAngleUpgrade("speed"), false);
  assert.equal(runtime.towerChallenge4UpgradePriceLog10("baseGain"), 100);

  return {
    towerFloor: state.towerFloor,
    completedTowerChallenges: state.completedTowerChallenges,
    activeTowerChallenge: state.activeTowerChallenge,
    completedInfinityChallenges: state.completedChallenges,
    infinityUpgradeMask: state.infinityUpgradeMask,
    infinityUpgradeCount: runtime.INFINITY_UPGRADES.length,
    infiniteCapBroken: state.infiniteCapBroken,
    infinityCount: state.infinityCount,
    achievementMask: state.achievementMask,
    infiniteAngleUnlocked: state.infiniteAngleUnlocked,
    iaPurchaseCount: iaPurchases,
    iaLevels: {
      speed: state.infiniteAngleSpeedLevel,
      vertex: state.infiniteAngleVertexLevel,
      gain: state.infiniteAngleGainLevel,
    },
    startingInfinityPointsLog10: runtime.log10ExactInfinityPoints(runtime.currentExactInfinityPoints()),
    automation: "manual-normal-level-1; compare fixed 60/120/300/600/1800s, gain-aware-2x, and threshold-aware Infinity resets; Core Boost and qualified Generation after each reset",
    approximation: "10-second production-runtime steps; event timing is reported at step resolution",
  };
}

function canonicalCollisionSequence(runtime, stopAt = 7700) {
  const steps = Object.fromEntries(TC4_KINDS.map((kind) => [kind, 0]));
  const sequence = [];
  for (let i = 0; i < 100; i += 1) {
    const prices = Object.fromEntries(TC4_KINDS.map((kind) => {
      const definition = runtime.TC4_UPGRADE_DEFINITIONS[kind];
      return [kind, definition.baseLog10 + definition.stepLog10 * steps[kind]];
    }));
    const price = Math.min(...Object.values(prices));
    const kind = TC4_KINDS.find((entry) => prices[entry] === price);
    sequence.push({ kind, priceLog10: price });
    TC4_KINDS.forEach((entry) => {
      if (entry === kind || prices[entry] === price) steps[entry] += 1;
    });
    if (price >= stopAt) break;
  }
  return sequence;
}

function validateProductionCollision(runtime) {
  const snapshot = captureState(runtime.state);
  const scoreLog = TARGET_LOG10 + 1000;
  runtime.state.scoreLog10 = runtime.rawScoreLog10FromEffective(scoreLog);
  runtime.state.score = runtime.valueFromLog10(runtime.state.scoreLog10);
  runtime.state.tc4BaseGainLevel = 0;
  runtime.state.tc4BaseGainPriceStep = 0;
  runtime.state.tc4InfinityScoreVertexGainLevel = 0;
  runtime.state.tc4InfinityScoreVertexGainPriceStep = 0;
  runtime.state.tc4FreeCoreBoostLevel = 0;
  runtime.state.tc4FreeCoreBoostPriceStep = 0;
  const expected = canonicalCollisionSequence(runtime);
  const observed = [];
  expected.forEach(({ kind, priceLog10 }) => {
    assert.equal(runtime.towerChallenge4UpgradePriceLog10(kind), priceLog10);
    assert.equal(runtime.buyTowerChallenge4Upgrade(kind, { refresh: false, save: false }), true);
    observed.push({ kind, priceLog10 });
  });
  restoreState(runtime.state, snapshot);
  return {
    matchesProduction: JSON.stringify(expected) === JSON.stringify(observed),
    sequence: expected,
    includesDocumentedRange: expected[0].priceLog10 === 100 && expected.some((entry) => entry.priceLog10 === 7700),
  };
}

function setEffectiveScore(runtime, effectiveLog) {
  if (effectiveLog === -Infinity) {
    runtime.state.scoreLog10 = -Infinity;
    runtime.state.score = 0;
    return;
  }
  const rawLog = runtime.rawScoreLog10FromEffective(effectiveLog);
  runtime.state.scoreLog10 = rawLog;
  runtime.state.score = runtime.valueFromLog10(rawLog);
}

function spendEffectiveScore(runtime, costLog) {
  const current = runtime.currentScoreLog10();
  if (current < costLog) return false;
  setEffectiveScore(runtime, runtime.subtractLog10(current, costLog));
  return true;
}

function availablePurchases(runtime) {
  const score = runtime.currentScoreLog10();
  return TC4_KINDS.filter((kind) => runtime.towerChallenge4UpgradePriceLog10(kind) <= score + 1e-9);
}

function applyTc4Purchase(runtime, kind, elapsed, purchases) {
  const selectedPrice = runtime.towerChallenge4UpgradePriceLog10(kind);
  const prePurchasePrices = Object.fromEntries(TC4_KINDS.map((entry) => [entry, runtime.towerChallenge4UpgradePriceLog10(entry)]));
  assert.equal(spendEffectiveScore(runtime, selectedPrice), true);
  TC4_KINDS.forEach((entry) => {
    const definition = runtime.TC4_UPGRADE_DEFINITIONS[entry];
    if (entry === kind || prePurchasePrices[entry] === selectedPrice) runtime.state[definition.priceStepField] += 1;
    if (entry === kind) runtime.state[definition.levelField] += 1;
  });
  purchases.push({
    timeSeconds: elapsed,
    kind,
    label: TC4_KIND_LABELS[kind],
    priceLog10: selectedPrice,
    levels: Object.fromEntries(TC4_KINDS.map((entry) => [entry, runtime.towerChallenge4UpgradeLevel(entry)])),
    priceSteps: Object.fromEntries(TC4_KINDS.map((entry) => [entry, runtime.towerChallenge4UpgradePriceStep(entry)])),
  });
}

function buyNormalLevelOne(runtime) {
  let bought = false;
  NORMAL_KINDS.forEach((kind) => {
    const level = kind === "speed"
      ? runtime.state.speedLevel
      : kind === "gain"
        ? runtime.state.gainLevel
        : runtime.state.vertices - 3;
    if (level >= 1 || !runtime.towerChallenge4AllowsNormalUpgrade(kind)) return;
    const cost = runtime.upgradeCostLog(kind);
    if (runtime.currentScoreLog10() < cost || !spendEffectiveScore(runtime, cost)) return;
    if (kind === "speed") runtime.state.speedLevel += 1;
    if (kind === "gain") runtime.state.gainLevel += 1;
    if (kind === "vertex") {
      runtime.state.vertices += 1;
      runtime.resetVertexProgress();
    }
    bought = true;
  });
  return bought;
}

function createResetPolicyState(runtime) {
  const scoreLog10 = runtime.currentScoreLog10();
  const runStartScoreLog10 = Number.isFinite(scoreLog10) ? scoreLog10 : 0;
  return {
    lastInfinityPointGainLog10: -Infinity,
    lastScoreLog10: scoreLog10,
    lastScoreSampleAt: 0,
    runStartScoreLog10,
    runPeakScoreLog10: scoreLog10,
    runPeakAt: 0,
    lastPositiveScoreRateLog10: 0,
    lastPositiveScoreRateAt: 0,
  };
}

function rebaseResetPolicyState(runtime, state, elapsed) {
  const scoreLog10 = runtime.currentScoreLog10();
  state.lastScoreLog10 = scoreLog10;
  state.lastScoreSampleAt = elapsed;
  state.runStartScoreLog10 = Number.isFinite(scoreLog10) ? scoreLog10 : 0;
  state.runPeakScoreLog10 = scoreLog10;
  state.runPeakAt = elapsed;
  state.lastPositiveScoreRateLog10 = 0;
  state.lastPositiveScoreRateAt = elapsed;
}

function updateResetPolicyState(runtime, state, elapsed) {
  const scoreLog10 = runtime.currentScoreLog10();
  const sampleSeconds = elapsed - state.lastScoreSampleAt;
  if (Number.isFinite(scoreLog10) && Number.isFinite(state.lastScoreLog10) && sampleSeconds > 0) {
    const scoreDeltaLog10 = scoreLog10 - state.lastScoreLog10;
    if (scoreDeltaLog10 > 0) {
      state.lastPositiveScoreRateLog10 = scoreDeltaLog10 / sampleSeconds;
      state.lastPositiveScoreRateAt = elapsed;
    }
  }
  if (Number.isFinite(scoreLog10)
    && (!Number.isFinite(state.runPeakScoreLog10) || scoreLog10 > state.runPeakScoreLog10)) {
    state.runPeakScoreLog10 = scoreLog10;
    state.runPeakAt = elapsed;
  }
  state.lastScoreLog10 = scoreLog10;
  state.lastScoreSampleAt = elapsed;
}

function cheapestTc4PriceLog10(runtime) {
  return Math.min(...TC4_KINDS.map((kind) => runtime.towerChallenge4UpgradePriceLog10(kind)));
}

function infinityResetDecision(runtime, policy, state, elapsed) {
  const minimumRunSeconds = policy.minimumRunSeconds;
  const runSeconds = runtime.state.currentInfinityRunTime;
  if (!runtime.canInfinity() || runSeconds < minimumRunSeconds) {
    return { shouldReset: false, reason: "minimum-run-not-met", runSeconds };
  }

  if (policy.type === "fixed") {
    return { shouldReset: true, reason: "fixed-threshold", runSeconds };
  }

  const ipGainLog10 = runtime.infinityPointGainLog10();
  if (policy.type === "gain-aware") {
    const requiredGainLog10 = Number.isFinite(state.lastInfinityPointGainLog10)
      ? state.lastInfinityPointGainLog10 + runtime.log10Value(policy.minimumIpGainMultiplier)
      : -Infinity;
    return {
      shouldReset: ipGainLog10 >= requiredGainLog10,
      reason: ipGainLog10 >= requiredGainLog10 ? "ip-gain-improved" : "ip-gain-below-improvement",
      runSeconds,
      ipGainLog10,
      requiredGainLog10,
    };
  }

  const scoreLog10 = runtime.currentScoreLog10();
  const progressAgeSeconds = elapsed - state.runPeakAt;
  const progressDeltaLog10 = Number.isFinite(state.runPeakScoreLog10)
    ? state.runPeakScoreLog10 - state.runStartScoreLog10
    : 0;
  const meaningfulProgress = progressDeltaLog10 >= policy.progressThresholdLog10
    && progressAgeSeconds <= policy.progressWindowSeconds;
  const rateAgeSeconds = elapsed - state.lastPositiveScoreRateAt;
  const priceGapLog10 = Number.isFinite(scoreLog10)
    ? Math.max(0, cheapestTc4PriceLog10(runtime) - scoreLog10)
    : Infinity;
  const thresholdReachable = state.lastPositiveScoreRateLog10 > 0
    && rateAgeSeconds <= policy.progressWindowSeconds
    && priceGapLog10 <= state.lastPositiveScoreRateLog10 * policy.lookaheadSeconds;
  const shouldReset = !meaningfulProgress && !thresholdReachable;
  return {
    shouldReset,
    reason: shouldReset ? "progress-and-threshold-stalled" : meaningfulProgress ? "score-progressing" : "threshold-plausible",
    runSeconds,
    scoreLog10,
    progressDeltaLog10,
    progressAgeSeconds,
    priceGapLog10,
    scoreRateLog10PerSecond: state.lastPositiveScoreRateLog10,
    thresholdReachable,
  };
}

function runResetPolicy(runtime, events, elapsed, policy, state) {
  let actions = 0;
  while (actions < 12) {
    const decision = infinityResetDecision(runtime, policy, state, elapsed);
    if (decision.shouldReset) {
      const ipGainLog10 = runtime.infinityPointGainLog10();
      runtime.runInfinity(false);
      state.lastInfinityPointGainLog10 = ipGainLog10;
      rebaseResetPolicyState(runtime, state, elapsed);
      events.push({
        timeSeconds: elapsed,
        type: "infinity",
        policy: policy.id,
        decision: decision.reason,
        ipGainLog10,
        count: runtime.state.infinityCount,
      });
      actions += 1;
      continue;
    }
    if (runtime.canCoreBoost()) {
      runtime.runCoreBoost();
      rebaseResetPolicyState(runtime, state, elapsed);
      events.push({ timeSeconds: elapsed, type: "core-boost", count: runtime.state.coreBoostCount });
      actions += 1;
      continue;
    }
    const nextGeneration = runtime.nextGenerationValues();
    const currentScoreMultiplier = runtime.generationScoreMultiplierEffectLog10();
    const currentCostFactor = runtime.generationCostFactorEffect();
    const generationIsWorthwhile = runtime.state.currentGenerationRunTime >= GENERATION_RESET_POLICY.generationMinimumSeconds
      && nextGeneration.scoreMultiplierLog10 - currentScoreMultiplier >= runtime.log10Value(GENERATION_RESET_POLICY.generationMinimumScoreMultiplierRatio)
      && currentCostFactor / nextGeneration.costFactor >= GENERATION_RESET_POLICY.generationMinimumCostFactorRatio;
    if (runtime.canRunGeneration() && generationIsWorthwhile) {
      runtime.runGeneration();
      rebaseResetPolicyState(runtime, state, elapsed);
      events.push({ timeSeconds: elapsed, type: "generation", count: runtime.state.generationCount });
      actions += 1;
      continue;
    }
    break;
  }
  return actions;
}

function roundedRouteValue(value, scale = 1000) {
  return Number.isFinite(value) ? Math.round(value * scale) / scale : String(value);
}

function routeKey(runtime, node) {
  const policyState = node.policyState;
  const fields = TC4_KINDS.flatMap((kind) => {
    const definition = runtime.TC4_UPGRADE_DEFINITIONS[kind];
    return [runtime.state[definition.levelField], runtime.state[definition.priceStepField]];
  });
  return [
    node.policy.id,
    roundedRouteValue(policyState.lastInfinityPointGainLog10),
    roundedRouteValue(policyState.lastScoreLog10),
    Math.floor(policyState.lastScoreSampleAt),
    roundedRouteValue(policyState.runStartScoreLog10),
    roundedRouteValue(policyState.runPeakScoreLog10),
    Math.floor(policyState.runPeakAt),
    roundedRouteValue(policyState.lastPositiveScoreRateLog10, 1e6),
    Math.floor(policyState.lastPositiveScoreRateAt),
    ...fields,
    roundedRouteValue(runtime.currentScoreLog10()),
    roundedRouteValue(runtime.currentInfiniteScoreLog10()),
    roundedRouteValue(runtime.state.generationScoreMultiplierLog10),
    roundedRouteValue(runtime.state.generationCostFactor, 1e6),
    roundedRouteValue(runtime.state.currentInfinityRunTime, 10),
    roundedRouteValue(runtime.state.currentGenerationRunTime, 10),
    runtime.state.infinityCount,
    runtime.state.generationCount,
    runtime.state.coreBoostCount,
    Math.floor(node.elapsed),
    roundedRouteValue(node.peakScoreLog10),
    Math.floor(node.peakScoreAt),
    Math.floor(node.lastProgressAt),
  ].join("|");
}

function routeMetrics(runtime, node, status, reason, validation) {
  const levels = Object.fromEntries(TC4_KINDS.map((kind) => [kind, runtime.towerChallenge4UpgradeLevel(kind)]));
  const free = levels.freeCoreBoost;
  const realCoreBoost = Math.max(0, Math.floor(runtime.state.coreBoostCount));
  const effective = realCoreBoost + free;
  const currentInfiniteScore = runtime.currentInfiniteScoreLog10();
  const candidatePower = runtime.infiniteAngleScorePower() + node.candidate.b * levels.infinityScoreVertexGain;
  const infinityEvents = node.events.filter((event) => event.type === "infinity");
  return {
    status,
    reason,
    policy: node.policy,
    elapsedSeconds: node.elapsed,
    purchaseSequence: node.purchases,
    finalLevels: levels,
    finalPriceSteps: Object.fromEntries(TC4_KINDS.map((kind) => [kind, runtime.towerChallenge4UpgradePriceStep(kind)])),
    thresholdTimes: node.purchases.map((purchase) => ({ kind: purchase.kind, timeSeconds: purchase.timeSeconds, priceLog10: purchase.priceLog10 })),
    resetEvents: node.events,
    infinityResetCount: infinityEvents.length,
    infinityResetTimes: infinityEvents.map((event) => event.timeSeconds),
    realCoreBoost,
    freeCoreBoost: free,
    effectiveCoreBoost: effective,
    representativeInfinityScoreLog10: Number.isFinite(currentInfiniteScore) ? currentInfiniteScore : null,
    representativeInfinityScorePower: candidatePower,
    representativeVertexGainIncreaseLog10: runtime.vertexGainIncreaseLog10(),
    finalScoreLog10: runtime.currentScoreLog10(),
    peakScoreLog10: node.peakScoreLog10,
    peakScoreAtSeconds: node.peakScoreAt,
    peakInfiniteScoreLog10: node.peakInfiniteScoreLog10,
    targetLog10: node.options.targetLog10,
    productionCollisionValidated: validation.matchesProduction,
  };
}

function advanceToDecision(runtime, node) {
  let elapsed = node.elapsed;
  const events = node.events.slice();
  const policyState = { ...node.policyState };
  let peakScoreAt = node.peakScoreAt;
  while (elapsed < node.options.maxSeconds) {
    if (runtime.currentScoreLog10() >= node.options.targetLog10) {
      return {
        type: "success",
        node: { ...node, elapsed, events, policyState, peakScoreAt, peakScoreLog10: node.peakScoreLog10 },
        reason: "target reached",
      };
    }
    const available = availablePurchases(runtime);
    if (available.length > 0) {
      return {
        type: "decision",
        elapsed,
        events,
        available,
        snapshot: captureState(runtime.state),
        policyState,
        peakScoreAt,
        peakScoreLog10: node.peakScoreLog10,
        peakInfiniteScoreLog10: node.peakInfiniteScoreLog10,
      };
    }

    buyNormalLevelOne(runtime);
    const step = Math.min(node.options.stepSeconds, node.options.maxSeconds - elapsed);
    const beforeGeneration = runtime.state.generationCount;
    const beforeCoreBoost = runtime.state.coreBoostCount;
    node.debug.update(step);
    elapsed += step;
    const previousPeakScoreLog10 = node.peakScoreLog10;
    const peakScoreLog10 = Math.max(previousPeakScoreLog10, runtime.currentScoreLog10());
    node.peakInfiniteScoreLog10 = Math.max(node.peakInfiniteScoreLog10, runtime.currentInfiniteScoreLog10());
    node.peakScoreLog10 = peakScoreLog10;
    if (peakScoreLog10 > previousPeakScoreLog10) {
      node.lastProgressAt = elapsed;
      peakScoreAt = elapsed;
    }
    updateResetPolicyState(runtime, policyState, elapsed);
    if (runtime.currentScoreLog10() >= node.options.targetLog10) {
      return {
        type: "success",
        node: { ...node, elapsed, events, policyState, peakScoreAt, peakScoreLog10 },
        reason: "target reached",
      };
    }
    const postUpdateAvailable = availablePurchases(runtime);
    if (postUpdateAvailable.length > 0) {
      return {
        type: "decision",
        elapsed,
        events,
        available: postUpdateAvailable,
        snapshot: captureState(runtime.state),
        policyState,
        peakScoreAt,
        peakScoreLog10,
        peakInfiniteScoreLog10: node.peakInfiniteScoreLog10,
      };
    }
    runResetPolicy(runtime, events, elapsed, node.policy, policyState);
    if (runtime.state.generationCount !== beforeGeneration && !events.some((event) => event.timeSeconds === elapsed && event.type === "generation")) {
      events.push({ timeSeconds: elapsed, type: "generation", count: runtime.state.generationCount });
    }
    if (runtime.state.coreBoostCount !== beforeCoreBoost && !events.some((event) => event.timeSeconds === elapsed && event.type === "core-boost")) {
      events.push({ timeSeconds: elapsed, type: "core-boost", count: runtime.state.coreBoostCount });
    }
    if (elapsed - node.lastProgressAt >= node.options.stallSeconds) {
      return {
        type: "timeout",
        node: { ...node, elapsed, events, policyState, peakScoreAt },
        reason: "stalled",
      };
    }
  }
  return {
    type: "timeout",
    node: { ...node, elapsed, events, policyState, peakScoreAt, peakScoreLog10: node.peakScoreLog10 },
    reason: "horizon reached",
  };
}

function runSearch(runtime, rootSnapshot, candidate, options, validation, frontierOnly, policy) {
  const pending = [{
    snapshot: rootSnapshot,
    elapsed: 0,
    events: [],
    purchases: [],
    peakScoreLog10: -Infinity,
    peakScoreAt: 0,
    peakInfiniteScoreLog10: -Infinity,
    lastProgressAt: 0,
    policy,
    policyState: createResetPolicyState(runtime),
    candidate,
    options,
    debug: options.debug,
  }];
  const seen = new Set();
  const routes = [];
  let exploredStates = 0;
  let truncated = false;

  while (pending.length > 0 && routes.length < options.maxRoutes) {
    if (exploredStates >= options.maxStates) {
      truncated = true;
      break;
    }
    const node = pending.shift();
    restoreState(runtime.state, node.snapshot);
    const key = routeKey(runtime, node);
    if (seen.has(key)) continue;
    seen.add(key);
    exploredStates += 1;
    const result = advanceToDecision(runtime, node);
    if (result.type !== "decision") {
      routes.push(routeMetrics(runtime, result.node, result.type, result.reason, validation));
      continue;
    }

    const cheapest = Math.min(...result.available.map((kind) => runtime.towerChallenge4UpgradePriceLog10(kind)));
    const choices = frontierOnly
      ? result.available.filter((kind) => runtime.towerChallenge4UpgradePriceLog10(kind) === cheapest)
      : result.available;
    for (const kind of choices) {
      restoreState(runtime.state, result.snapshot);
      const purchases = result.node?.purchases ? result.node.purchases.slice() : node.purchases.slice();
      applyTc4Purchase(runtime, kind, result.elapsed, purchases);
      pending.push({
        snapshot: captureState(runtime.state),
        elapsed: result.elapsed,
        events: result.events.slice(),
        purchases,
        peakScoreAt: result.peakScoreAt,
        peakScoreLog10: result.peakScoreLog10,
        peakInfiniteScoreLog10: result.peakInfiniteScoreLog10,
        lastProgressAt: result.elapsed,
        policy,
        policyState: { ...result.policyState },
        candidate,
        options,
        debug: options.debug,
      });
    }
  }
  if (pending.length > 0) truncated = true;
  return { exploredStates, routeCount: routes.length, truncated, routes };
}

function summarizeSearch(search) {
  const successful = search.routes.filter((route) => route.status === "success").map((route) => route.elapsedSeconds).sort((a, b) => a - b);
  const stalledRoutes = search.routes.filter((route) => route.reason === "stalled").length;
  const horizonTimeouts = search.routes.filter((route) => route.reason === "horizon reached").length;
  const best = successful[0] ?? null;
  const worst = successful.at(-1) ?? null;
  const peakScoreLog10 = search.routes.reduce((peak, route) => Math.max(peak, route.peakScoreLog10), -Infinity);
  const median = successful.length === 0
    ? null
    : successful.length % 2 === 1
      ? successful[(successful.length - 1) / 2]
      : (successful[successful.length / 2 - 1] + successful[successful.length / 2]) / 2;
  const nearBest = best === null ? 0 : successful.filter((time) => time <= best * 1.1).length;
  return {
    exploredStates: search.exploredStates,
    routeCount: search.routeCount,
    truncated: search.truncated,
    successfulRoutes: successful.length,
    stalledRoutes,
    horizonTimeouts,
    bestSeconds: best,
    medianSeconds: median,
    worstSeconds: worst,
    peakScoreLog10: Number.isFinite(peakScoreLog10) ? peakScoreLog10 : null,
    terminalAllocations: search.routes.map((route) => ({
      status: route.status,
      reason: route.reason,
      finalLevels: route.finalLevels,
      finalPriceSteps: route.finalPriceSteps,
      peakScoreLog10: route.peakScoreLog10,
    })),
    medianToBest: best && median ? median / best : null,
    worstToBest: best && worst ? worst / best : null,
    strategicDegenerate: successful.length > 0 && nearBest < 2,
    allCanonicalSuccessful: search.routes.length > 0 && search.routes.every((route) => route.status === "success") && !search.truncated,
  };
}

async function runCandidate(candidate, options) {
  const instance = await loadRuntime(CANDIDATE_PATH);
  const { runtime } = instance;
  const fixture = await configureBaseline(instance);
  installCandidateEffects(runtime, candidate);
  const collision = validateProductionCollision(runtime);
  const rootSnapshot = captureState(runtime.state);
  const searchOptions = { ...options, debug: instance.debug };
  const policies = RESET_POLICIES.map((policy) => {
    restoreState(runtime.state, rootSnapshot);
    const canonical = runSearch(runtime, rootSnapshot, candidate, searchOptions, collision, true, policy);
    restoreState(runtime.state, rootSnapshot);
    const allLegal = runSearch(runtime, rootSnapshot, candidate, searchOptions, collision, false, policy);
    return {
      policy,
      canonical: { summary: summarizeSearch(canonical), routes: canonical.routes },
      allLegal: { summary: summarizeSearch(allLegal), routes: allLegal.routes },
    };
  });
  const baseline = policies.find(({ policy }) => policy.id === "fixed-60");
  return {
    candidate,
    fixture,
    collision,
    canonical: baseline.canonical,
    allLegal: baseline.allLegal,
    policies,
  };
}

function policyRoutes(policyResult) {
  return [...policyResult.canonical.routes, ...policyResult.allLegal.routes];
}

function policyComparison(policyResult) {
  const routes = policyRoutes(policyResult);
  const bestRoute = routes.reduce((best, route) => route.peakScoreLog10 > (best?.peakScoreLog10 ?? -Infinity) ? route : best, null);
  const thresholds = [900, 1700, 2500];
  return {
    policy: policyResult.policy,
    canonical: policyResult.canonical.summary,
    allLegal: policyResult.allLegal.summary,
    peakScoreLog10: bestRoute?.peakScoreLog10 ?? null,
    peakScoreAtSeconds: bestRoute?.peakScoreAtSeconds ?? null,
    infinityResetCount: routes.reduce((count, route) => Math.max(count, route.infinityResetCount), 0),
    thresholdReached: Object.fromEntries(thresholds.map((threshold) => [
      `e${threshold}`,
      routes.some((route) => route.peakScoreLog10 >= threshold),
    ])),
    e900PurchaseKinds: [...new Set(routes.flatMap((route) => {
      const purchase = route.purchaseSequence.find((entry) => entry.priceLog10 >= 900);
      return purchase ? [purchase.kind] : [];
    }))],
  };
}

function candidateClassification(result) {
  const viable = result.policies.some(({ canonical }) => {
    const summary = canonical.summary;
    return summary.allCanonicalSuccessful
      && summary.medianToBest <= 3
      && summary.worstToBest <= 10
      && !summary.strategicDegenerate;
  });
  if (viable) return "viable";
  const complete = result.policies.every(({ canonical, allLegal }) => !canonical.summary.truncated && !allLegal.summary.truncated);
  return complete ? "failed" : "inconclusive";
}

function candidatePassesInitialTargets(result) {
  return candidateClassification(result) === "viable";
}

function auditReport() {
  return CORE_BOOST_SOURCE_USE_MANIFEST.map(([pathName, use, classification]) => ({ path: pathName, use, classification }));
}

function familyUsefulness(candidate, searches) {
  const routes = searches.policies.flatMap(policyRoutes);
  return Object.fromEntries(TC4_KINDS.map((kind) => {
    const reachable = routes.filter((route) => route.finalLevels[kind] > 0);
    const contexts = reachable.map((route) => {
      const level = route.finalLevels[kind];
      const effectDelta = kind === "baseGain"
        ? candidate.a * level
        : kind === "infinityScoreVertexGain"
          ? candidate.b * level
          : route.freeCoreBoost;
      return {
        status: route.status,
        level,
        effectDelta,
        purchaseSequence: route.purchaseSequence.map((purchase) => `${purchase.label}@e${purchase.priceLog10}`),
      };
    });
    return [kind, {
      reachable: reachable.length > 0,
      measurableEffect: contexts.some((context) => context.effectDelta > 0),
      contexts: contexts.slice(0, 5),
    }];
  }));
}

async function createReport(options = {}) {
  const normalized = {
    maxSeconds: options.maxSeconds ?? DEFAULT_MAX_SECONDS,
    stepSeconds: options.stepSeconds ?? DEFAULT_STEP_SECONDS,
    maxStates: options.maxStates ?? DEFAULT_MAX_STATES,
    maxRoutes: options.maxRoutes ?? DEFAULT_MAX_ROUTES,
    targetLog10: options.targetLog10 ?? TARGET_LOG10,
    stallSeconds: options.stallSeconds ?? DEFAULT_STALL_SECONDS,
  };
  const primary = await runCandidate(CANDIDATE_A, normalized);
  const policyComparisons = primary.policies.map(policyComparison);
  const baseline = policyComparisons.find(({ policy }) => policy.id === "fixed-60");
  const bestPolicy = policyComparisons.reduce((best, comparison) => best === null
    || (comparison.peakScoreLog10 ?? -Infinity) > (best.peakScoreLog10 ?? -Infinity)
    ? comparison
    : best, null);
  const classification = candidateClassification(primary);
  const report = {
    issue: 112,
    title: "Expand TC4 Balance Candidate A reset-strategy search",
    researchOnly: true,
    sourceIssue: 106,
    targetLog10: normalized.targetLog10,
    horizonSeconds: normalized.maxSeconds,
    stepSeconds: normalized.stepSeconds,
    routeSearchLimits: { maxStates: normalized.maxStates, maxRoutes: normalized.maxRoutes },
    stallSeconds: normalized.stallSeconds,
    resetPolicies: RESET_POLICIES,
    generationResetPolicy: GENERATION_RESET_POLICY,
    candidateA: primary,
    candidateClassification: classification,
    candidateAPassesInitialTargets: classification === "viable",
    policyComparisons,
    baselineComparison: {
      baselinePolicy: baseline.policy.id,
      bestPolicy: bestPolicy?.policy.id ?? null,
      baselinePeakScoreLog10: baseline.peakScoreLog10,
      bestPeakScoreLog10: bestPolicy?.peakScoreLog10 ?? null,
      peakDeltaLog10: bestPolicy && baseline.peakScoreLog10 !== null
        ? bestPolicy.peakScoreLog10 - baseline.peakScoreLog10
        : null,
      e900PurchaseKinds: bestPolicy?.e900PurchaseKinds ?? [],
      laterThresholds: bestPolicy?.thresholdReached ?? {},
    },
    coreBoostAudit: auditReport(),
    familyUsefulness: familyUsefulness(primary.candidate, primary),
    sweep: [],
  };
  return report;
}

function formatSeconds(seconds) {
  if (seconds === null || seconds === undefined) return "not reached";
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(2)}h`;
}

function formatMarkdown(report) {
  const lines = [
    `# TC4 Balance Candidate A (Issue #${report.issue})`,
    "",
    "> Research output only. No provisional effect is installed in production formulas.",
    "",
    `- Source comparison: **Issue #${report.sourceIssue}** fixed-60 simulator`,
    `- Target: **1e${report.targetLog10} Score**`,
    `- Horizon: **${formatSeconds(report.horizonSeconds)}**`,
    `- Runtime step: **${report.stepSeconds}s** (reported times have this resolution)`,
    `- Search limits: **${report.routeSearchLimits.maxStates} states / ${report.routeSearchLimits.maxRoutes} routes**`,
    "",
    "## Reset-policy comparison",
    "",
    "| Policy | Canonical best | All-legal best | Peak Score | e900 | e1700 | e2500 | resets | truncated |",
    "| --- | ---: | ---: | ---: | --- | --- | --- | ---: | --- |",
  ];
  report.policyComparisons.forEach((comparison) => {
    const policy = comparison.policy;
    const truncated = comparison.canonical.truncated || comparison.allLegal.truncated;
    lines.push(`| ${policy.id} | ${formatSeconds(comparison.canonical.bestSeconds)} | ${formatSeconds(comparison.allLegal.bestSeconds)} | ${comparison.peakScoreLog10 === null ? "not reached" : `e${comparison.peakScoreLog10.toFixed(0)}`} | ${comparison.thresholdReached.e900 ? "yes" : "no"} | ${comparison.thresholdReached.e1700 ? "yes" : "no"} | ${comparison.thresholdReached.e2500 ? "yes" : "no"} | ${comparison.infinityResetCount} | ${truncated ? "yes" : "no"} |`);
  });
  lines.push("", `Candidate A classification: **${report.candidateClassification}**`, `- Initial target gate: **${report.candidateAPassesInitialTargets ? "pass" : "not passed"}**`, `- Baseline policy: **${report.baselineComparison.baselinePolicy}**`, `- Best peak policy: **${report.baselineComparison.bestPolicy ?? "not reached"}**`, `- Peak delta vs fixed-60: **${report.baselineComparison.peakDeltaLog10?.toFixed(3) ?? "—"} log10**`, `- e900 purchase kinds at best peak: **${report.baselineComparison.e900PurchaseKinds.join(", ") || "none"}**`, "");
  lines.push("## Canonical collision validation", "", `- Production match: **${report.candidateA.collision.matchesProduction ? "yes" : "no"}**`, `- Documented e100…e7700 range present: **${report.candidateA.collision.includesDocumentedRange ? "yes" : "no"}**`, `- Sequence: ${report.candidateA.collision.sequence.map((entry) => `${entry.kind}@e${entry.priceLog10}`).join(" → ")}`, "");
  lines.push("", "## Family usefulness", "", "| Family | Reachable | Measurable effect |", "| --- | --- | --- |", ...Object.entries(report.familyUsefulness).map(([kind, value]) => `| ${kind} | ${value.reachable ? "yes" : "no"} | ${value.measurableEffect ? "yes" : "no"} |`));
  lines.push("## Core Boost audit", "", "| Source | Use | Classification |", "| --- | --- | --- |");
  report.coreBoostAudit.forEach((entry) => lines.push(`| \`${entry.path}\` | ${entry.use} | ${entry.classification} |`));
  lines.push("", "## Baseline", "", "```json", JSON.stringify(report.candidateA.fixture, null, 2), "```", "");
  lines.push("## Caveats", "", "- The simulator uses production runtime updates in fixed steps; it is a deterministic balance comparison, not a replacement for frame-by-frame gameplay.", `- Stall cutoff: ${formatSeconds(report.stallSeconds)} without a new peak Score; stalled routes count as failures.`, "- Any route/search truncation or timeout is retained as a failure signal.", "- Gain-aware-2x and threshold-aware policies are bounded heuristics; they are comparison candidates, not production automation settings.");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArgs(process.argv);
  const report = await createReport(options);
  process.stdout.write(options.format === "markdown" ? formatMarkdown(report) : `${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  CANDIDATE_A,
  CORE_BOOST_SOURCE_USE_MANIFEST,
  RESET_POLICIES,
  TARGET_LOG10,
  canonicalCollisionSequence,
  candidatePassesInitialTargets,
  createReport,
  formatMarkdown,
  parseArgs,
};
