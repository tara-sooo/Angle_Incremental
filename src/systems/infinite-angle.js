import { runtime, expose } from "../runtime/shared.js";

// Infinite Angle is a separate angle track. It has no Generation, Core Boost,
// challenge, or Infinity Upgrade modifiers; its own upgrades are paid with IP.

const INFINITE_ANGLE_UPGRADES = Object.freeze({
  speed: Object.freeze({ base: 1e20, growth: 1.40, scalingStartsAfter: 25, scalingLogScale: 0.0005 }),
  vertex: Object.freeze({ base: 2.4e20, growth: 1.50, scalingStartsAfter: 25, scalingLogScale: 0.0010 }),
  gain: Object.freeze({ base: 3.6e20, growth: 1.45, scalingStartsAfter: 25, scalingLogScale: 0.0005 }),
});

// The shared coefficients soften the early curve while retaining the role-specific
// base prices and post-level scaling ratios. This value is runtime-only and is not
// part of saved state so the balance simulator can compare candidates safely.
const DEFAULT_INFINITE_ANGLE_COST_CURVE = Object.freeze({
  growthPower: 0.11,
  postLevelScale: 0.35,
});
let infiniteAngleCostCurve = DEFAULT_INFINITE_ANGLE_COST_CURVE;

function setInfiniteAngleCostCurve(value) {
  if (!value || !Number.isFinite(value.growthPower) || !Number.isFinite(value.postLevelScale)) return;
  if (value.growthPower < 0 || value.postLevelScale < 0) return;
  infiniteAngleCostCurve = Object.freeze({
    growthPower: value.growthPower,
    postLevelScale: value.postLevelScale,
  });
}

function infiniteAngleVertexCount() {
  const level = Math.max(0, Math.floor(runtime.state.infiniteAngleVertexLevel));
  return Math.min(runtime.MAX_RENDERED_VERTICES, 3 + level);
}

function infiniteAngleCurrentGainLog10() {
  return runtime.currentLog10ForValue(
    runtime.state.infiniteAngleCurrentGain,
    runtime.state.infiniteAngleCurrentGainLog10,
  );
}

function setInfiniteAngleCurrentGainLog10(log10) {
  const safeLog = Math.max(0, runtime.clampLog10(log10));
  runtime.state.infiniteAngleCurrentGainLog10 = safeLog;
  runtime.state.infiniteAngleCurrentGain = runtime.valueFromLog10(safeLog);
}

function addInfiniteAngleCurrentGain(amount) {
  if (amount <= 0) return;
  setInfiniteAngleCurrentGainLog10(
    runtime.combineLog10(infiniteAngleCurrentGainLog10(), runtime.log10Value(amount)),
  );
}

function infiniteAngleGainIncrease() {
  return 0.011 + Math.max(0, Math.floor(runtime.state.infiniteAngleGainLevel)) * 0.011;
}

function infiniteAngleRawLapSpeedLog10() {
  return runtime.clampLog10(
    Math.max(0, Math.floor(runtime.state.infiniteAngleSpeedLevel)) * runtime.log10Value(1.22),
  );
}

function infiniteAngleEffectiveLapSpeedLog10() {
  const rawLog = infiniteAngleRawLapSpeedLog10();
  const softcapStartLog = runtime.log10Value(runtime.PRE_GENERATION_LAP_SPEED_SOFTCAP_START);
  const softcappedLog = rawLog <= softcapStartLog
    ? rawLog
    : softcapStartLog + (rawLog - softcapStartLog) * runtime.PRE_GENERATION_LAP_SPEED_SOFTCAP_POWER;
  if (softcappedLog <= runtime.LAP_SPEED_SUPER_SOFTCAP_START_LOG10) return softcappedLog;
  return runtime.LAP_SPEED_SUPER_SOFTCAP_START_LOG10
    + Math.log10(1 + softcappedLog - runtime.LAP_SPEED_SUPER_SOFTCAP_START_LOG10)
      * runtime.LAP_SPEED_SUPER_SOFTCAP_LOG_STRENGTH;
}

function infiniteAngleLapSpeedMultiplier() {
  return runtime.valueFromLog10(infiniteAngleEffectiveLapSpeedLog10());
}

function infiniteAngleLapDuration() {
  return runtime.BASE_LAP_SECONDS / infiniteAngleLapSpeedMultiplier();
}

function infiniteAngleGainExpressionParts() {
  return Math.min(Math.floor(Math.sqrt(infiniteAngleVertexCount())), 10);
}

function infiniteAngleScoreGainLog10(baseLog10 = infiniteAngleCurrentGainLog10()) {
  const parts = infiniteAngleGainExpressionParts();
  const scoreLog10 = parts <= 1
    ? baseLog10
    : (baseLog10 - runtime.log10Value(parts)) * parts;
  return runtime.state.activeTowerChallenge === 3
    ? scoreLog10 * runtime.towerChallenge3InfinityScorePower()
    : scoreLog10;
}

function addInfiniteAngleScoreLog(amountLog10) {
  if (amountLog10 === -Infinity) return;
  runtime.state.infiniteScoreLog10 = runtime.combineLog10(
    runtime.currentInfiniteScoreLog10(),
    amountLog10,
  );
  runtime.state.infiniteScore = runtime.valueFromLog10(runtime.state.infiniteScoreLog10);
}

function infiniteAngleUpgradeLevel(kind) {
  if (kind === "speed") return Math.max(0, Math.floor(runtime.state.infiniteAngleSpeedLevel));
  if (kind === "vertex") return Math.max(0, Math.floor(runtime.state.infiniteAngleVertexLevel));
  if (kind === "gain") return Math.max(0, Math.floor(runtime.state.infiniteAngleGainLevel));
  return 0;
}

function infiniteAngleUpgradeCostLog10(kind) {
  const definition = INFINITE_ANGLE_UPGRADES[kind];
  if (!definition) return Infinity;
  const level = infiniteAngleUpgradeLevel(kind);
  const rawLog = runtime.log10Value(definition.base)
    + level * runtime.log10Value(definition.growth) * infiniteAngleCostCurve.growthPower;
  const excess = Math.max(0, level - definition.scalingStartsAfter);
  return runtime.clampLog10(
    rawLog + excess * excess * definition.scalingLogScale * infiniteAngleCostCurve.postLevelScale,
  );
}

function infiniteAngleUnlockCostLog10() {
  return runtime.INFINITE_ANGLE_UNLOCK_COST_LOG10;
}

function canUnlockInfiniteAngle() {
  return !runtime.state.infiniteAngleUnlocked
    && runtime.canSpendInfinityPoints(infiniteAngleUnlockCostLog10());
}

function resetInfiniteAngleRun() {
  runtime.state.infiniteAngleCurrentGain = 1;
  runtime.state.infiniteAngleCurrentGainLog10 = 0;
  resetInfiniteAnglePosition();
}

function resetInfiniteAnglePosition() {
  runtime.state.infiniteAnglePointProgress = 0;
  runtime.state.infiniteAngleTotalVertexProgress = 0;
  runtime.state.infiniteAngleLastVertexIndex = 0;
}

function unlockInfiniteAngle() {
  if (!canUnlockInfiniteAngle()) return false;
  if (runtime.createCheckpoint && !runtime.createCheckpoint("pre-infinite-angle", { force: true })) return false;
  if (!runtime.spendInfinityPoints(infiniteAngleUnlockCostLog10())) return false;
  runtime.state.infiniteAngleUnlocked = true;
  resetInfiniteAngleRun();
  runtime.updateUi();
  runtime.saveGame("manual");
  return true;
}

function canBuyInfiniteAngleUpgrade(kind) {
  const costLog10 = infiniteAngleUpgradeCostLog10(kind);
  const maximumCostLog10 = runtime.log10ExactInfinityPoints(runtime.MAX_EXACT_INFINITY_POINTS);
  return runtime.state.infiniteAngleUnlocked
    && Boolean(INFINITE_ANGLE_UPGRADES[kind])
    && runtime.towerChallenge4AllowsInfiniteAngleUpgrade(kind)
    && (kind !== "vertex" || infiniteAngleUpgradeLevel("vertex") < runtime.MAX_RENDERED_VERTICES - 3)
    && costLog10 <= maximumCostLog10
    && runtime.canSpendInfinityPoints(costLog10);
}

function purchaseInfiniteAngleUpgrade(kind) {
  if (!canBuyInfiniteAngleUpgrade(kind)) return false;
  if (!runtime.spendInfinityPoints(infiniteAngleUpgradeCostLog10(kind))) return false;
  if (kind === "speed") runtime.state.infiniteAngleSpeedLevel += 1;
  if (kind === "vertex") {
    runtime.state.infiniteAngleVertexLevel = Math.min(
      runtime.MAX_RENDERED_VERTICES - 3,
      runtime.state.infiniteAngleVertexLevel + 1,
    );
    resetInfiniteAnglePosition();
  }
  if (kind === "gain") runtime.state.infiniteAngleGainLevel += 1;
  return true;
}

function buyInfiniteAngleUpgrade(kind, options = {}) {
  if (typeof Event !== "undefined" && options instanceof Event) options = {};
  const purchased = purchaseInfiniteAngleUpgrade(kind);
  if (!purchased) return false;
  if (options.refresh !== false) runtime.updateUi();
  if (options.save !== false) runtime.saveGame("manual");
  return true;
}

function buyAllInfiniteAngleUpgrades(options = {}) {
  if (typeof Event !== "undefined" && options instanceof Event) options = {};
  const refresh = options.refresh !== false;
  const persist = options.save !== false;
  const allowSpeed = options.allowSpeed !== false;
  const allowVertex = options.allowVertex !== false;
  const allowGain = options.allowGain !== false;
  let purchases = 0;
  let bought = true;
  while (bought && purchases < runtime.BUY_ALL_LIMIT) {
    bought = false;
    if (allowSpeed && purchaseInfiniteAngleUpgrade("speed")) {
      purchases += 1;
      bought = true;
      if (purchases >= runtime.BUY_ALL_LIMIT) break;
    }
    if (allowVertex && purchaseInfiniteAngleUpgrade("vertex")) {
      purchases += 1;
      bought = true;
      if (purchases >= runtime.BUY_ALL_LIMIT) break;
    }
    if (allowGain && purchaseInfiniteAngleUpgrade("gain")) {
      purchases += 1;
      bought = true;
    }
  }
  if (purchases > 0) {
    if (refresh) runtime.updateUi();
    if (persist) runtime.saveGame("manual");
  }
  return purchases;
}

function infiniteAngleScorePower() {
  const basePower = runtime.hasInfinityUpgrade("13-1") ? 0.5 : runtime.INFINITE_ANGLE_SCORE_POWER;
  return basePower + runtime.towerChallenge1InfinityScorePowerBonus();
}

function infiniteAngleBoostLog10() {
  const scoreLog10 = runtime.currentInfiniteScoreLog10();
  if (scoreLog10 === -Infinity) return 0;
  return runtime.clampLog10(Math.max(0, scoreLog10 * infiniteAngleScorePower()));
}

function infiniteAngleBoost() {
  return runtime.valueFromLog10(infiniteAngleBoostLog10());
}

function processInfiniteAngleVertices(start, end) {
  const count = end - start + 1;
  if (count <= 0) return;

  const vertices = infiniteAngleVertexCount();
  const increase = infiniteAngleGainIncrease();
  const coreOffset = ((-start % vertices) + vertices) % vertices;
  const coreHits = coreOffset >= count ? 0 : Math.floor((count - 1 - coreOffset) / vertices) + 1;

  if (coreHits > 0) {
    let earnedLog10 = -Infinity;
    const addCoreGain = (step) => {
      const gainLog10 = runtime.combineLog10(
        infiniteAngleCurrentGainLog10(),
        runtime.log10Value(increase) + runtime.log10Value(step),
      );
      earnedLog10 = runtime.combineLog10(earnedLog10, infiniteAngleScoreGainLog10(gainLog10));
    };

    const plan = runtime.offlineCoreHitPlan(
      "infiniteAngle",
      coreHits,
      runtime.MAX_EXACT_CORE_HITS,
      runtime.CORE_HIT_APPROX_SEGMENTS,
    );
    if (plan.mode === "approximation") {
      const approximationSegments = plan.iterations;
      const segmentSize = coreHits / approximationSegments;
      for (let segment = 0; segment < approximationSegments; segment += 1) {
        const midHit = (segment + 0.5) * segmentSize;
        const step = coreOffset + 1 + midHit * vertices;
        const gainLog10 = runtime.combineLog10(
          infiniteAngleCurrentGainLog10(),
          runtime.log10Value(increase) + runtime.log10Value(step),
        );
        earnedLog10 = runtime.combineLog10(
          earnedLog10,
          infiniteAngleScoreGainLog10(gainLog10) + runtime.log10Value(segmentSize),
        );
      }
    } else {
      for (let hit = 0; hit < coreHits; hit += 1) {
        addCoreGain(coreOffset + 1 + hit * vertices);
      }
    }
    addInfiniteAngleScoreLog(earnedLog10);
  }

  addInfiniteAngleCurrentGain(increase * count);
}

function updateInfiniteAngle(dt) {
  if (!runtime.state.infiniteAngleUnlocked || !Number.isFinite(dt) || dt <= 0) return;

  const vertices = infiniteAngleVertexCount();
  const previousAbsolute = runtime.state.infiniteAngleTotalVertexProgress;
  const rawProgressDelta = (dt / infiniteAngleLapDuration()) * vertices;
  const progressDelta = Number.isFinite(rawProgressDelta)
    ? rawProgressDelta
    : runtime.MAX_VERTEX_PROGRESS_TRACKED;
  runtime.state.infiniteAngleTotalVertexProgress += progressDelta;
  const nearestVertex = Math.round(runtime.state.infiniteAngleTotalVertexProgress);
  if (Math.abs(runtime.state.infiniteAngleTotalVertexProgress - nearestVertex) < runtime.VERTEX_EPSILON) {
    runtime.state.infiniteAngleTotalVertexProgress = nearestVertex;
  }
  runtime.state.infiniteAnglePointProgress = (runtime.state.infiniteAngleTotalVertexProgress / vertices) % 1;

  const start = Math.floor(previousAbsolute + runtime.VERTEX_EPSILON) + 1;
  const end = Math.floor(runtime.state.infiniteAngleTotalVertexProgress + runtime.VERTEX_EPSILON);
  const vertexSteps = end - start + 1;
  if (runtime.offlineProcessing || vertexSteps > runtime.MAX_VERTEX_STEPS_PER_FRAME) {
    processInfiniteAngleVertices(start, end);
  } else {
    for (let vertex = start; vertex <= end; vertex += 1) {
      addInfiniteAngleCurrentGain(infiniteAngleGainIncrease());
      if (vertex % vertices === 0) addInfiniteAngleScoreLog(infiniteAngleScoreGainLog10());
    }
  }

  if (runtime.state.infiniteAngleTotalVertexProgress > runtime.MAX_VERTEX_PROGRESS_TRACKED) {
    const wrapped = ((runtime.state.infiniteAngleTotalVertexProgress % vertices) + vertices) % vertices;
    runtime.state.infiniteAngleTotalVertexProgress = wrapped;
    runtime.state.infiniteAnglePointProgress = wrapped / vertices;
  }
  runtime.state.infiniteAngleLastVertexIndex = Math.floor(runtime.state.infiniteAnglePointProgress * vertices) % vertices;
}

expose("infiniteAngleVertexCount", () => infiniteAngleVertexCount);
expose("infiniteAngleCurrentGainLog10", () => infiniteAngleCurrentGainLog10);
expose("infiniteAngleRawLapSpeedLog10", () => infiniteAngleRawLapSpeedLog10);
expose("infiniteAngleEffectiveLapSpeedLog10", () => infiniteAngleEffectiveLapSpeedLog10);
expose("infiniteAngleLapSpeedMultiplier", () => infiniteAngleLapSpeedMultiplier);
expose("infiniteAngleLapDuration", () => infiniteAngleLapDuration);
expose("infiniteAngleGainExpressionParts", () => infiniteAngleGainExpressionParts);
expose("infiniteAngleScoreGainLog10", () => infiniteAngleScoreGainLog10);
expose("infiniteAngleUpgradeCostLog10", () => infiniteAngleUpgradeCostLog10);
expose("DEFAULT_INFINITE_ANGLE_COST_CURVE", () => DEFAULT_INFINITE_ANGLE_COST_CURVE);
expose("infiniteAngleCostCurve", () => infiniteAngleCostCurve, setInfiniteAngleCostCurve);
expose("infiniteAngleUnlockCostLog10", () => infiniteAngleUnlockCostLog10);
expose("canUnlockInfiniteAngle", () => canUnlockInfiniteAngle);
expose("unlockInfiniteAngle", () => unlockInfiniteAngle);
expose("canBuyInfiniteAngleUpgrade", () => canBuyInfiniteAngleUpgrade);
expose("buyInfiniteAngleUpgrade", () => buyInfiniteAngleUpgrade);
expose("buyAllInfiniteAngleUpgrades", () => buyAllInfiniteAngleUpgrades);
expose("infiniteAngleOfflineExactIterations", () => runtime.offlineWorkStats?.tracks?.infiniteAngle?.exactIterations ?? 0);
expose("infiniteAngleOfflineApproximationIterations", () => runtime.offlineWorkStats?.tracks?.infiniteAngle?.approximationIterations ?? 0);
expose("infiniteAngleBoostLog10", () => infiniteAngleBoostLog10);
expose("infiniteAngleBoost", () => infiniteAngleBoost);
expose("infiniteAngleScorePower", () => infiniteAngleScorePower);
expose("resetInfiniteAngleRun", () => resetInfiniteAngleRun);
expose("updateInfiniteAngle", () => updateInfiniteAngle);
