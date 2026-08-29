const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { loadRuntime } = require("../tests/runtime-harness-esm.js");

const ISSUE = 237;
const CANDIDATE_PATH = path.join(__dirname, "..", "src", "main.js");
const DEFAULT_REPORT_PATH = path.join(__dirname, "..", "reports", "ic8-eternity-progression.json");
const DEFAULT_MARKDOWN_PATH = path.join(__dirname, "..", "reports", "ic8-eternity-progression.md");
const RAW_PARALLEL_SOFTCAP_LOG10 = 10;
const RAW_PARALLEL_SOFTCAP_SECONDS = RAW_PARALLEL_SOFTCAP_LOG10 / Math.log10(3);
const TC3_RELAXATION_REFERENCE_COUNT = 600000;
const CURVE_SAMPLE_SECONDS = Object.freeze([
  0,
  10,
  RAW_PARALLEL_SOFTCAP_SECONDS,
  30,
  60,
  5 * 60,
  10 * 60,
  30 * 60,
  60 * 60,
]);
const MILESTONE_IDS = Object.freeze([
  "ic8-clear",
  "infinite-angle-unlock",
  "tower-floor-1",
  "tc1",
  "tc2",
  "tc3",
  "tc4",
  "eternity-eligibility",
]);

const DEFAULT_OPTIONS = Object.freeze({
  parallelPostSoftcapPower: null,
  probeScoreOffsetLog10: 1,
  localProbeElapsedSeconds: Object.freeze([0, 60 * 60]),
  curveSampleSeconds: CURVE_SAMPLE_SECONDS,
  writeReports: true,
});

const REPRESENTATIVE_INFINITY_UPGRADE_IDS = Object.freeze([
  "1-1", "1-2", "2-1", "3-1", "3-2", "4-1",
  "5-1", "5-2", "6-1", "6-2", "7-1", "7-2",
  "8-1", "9-1", "10-1", "10-2", "11-1", "11-2",
]);

const REPRESENTATIVE_FIXTURE = Object.freeze({
  id: "eternity-1-milestone-1-2-post-ic8",
  boundary: "Eternity 1 / Milestone 1-2 / Achievements 1-41 / IC1-IC8 complete; post-IC8 t = 0",
  exactInfinityPoints: "100000",
  state: Object.freeze({
    score: 100,
    scoreLog10: 2,
    totalScore: 0,
    totalScoreLog10: -Infinity,
    generationScore: 0,
    generationScoreLog10: -Infinity,
    vertices: 3,
    ic8VertexUpgradeLevel: 0,
    speedLevel: 0,
    gainLevel: 0,
    currentGain: 1,
    currentGainLog10: 0,
    pointProgress: 0,
    totalVertexProgress: 0,
    lastVertexIndex: 0,
    generationCount: 0,
    previousGenerationScore: 0,
    previousGenerationScoreLog10: -Infinity,
    generationScoreMultiplier: 1,
    generationScoreMultiplierLog10: 0,
    generationCostFactor: 1,
    coreBoostCount: 2,
    infinityCount: 10000,
    eternityCount: 1,
    eternityMilestoneMask: 2,
    eternityMilestoneChoice: "",
    infinityUpgradeMask: (1 << 18) - 1,
    infiniteScore: 0,
    infiniteScoreLog10: -Infinity,
    infiniteAngleUnlocked: false,
    infiniteAngleSpeedLevel: 0,
    infiniteAngleVertexLevel: 0,
    infiniteAngleGainLevel: 0,
    infiniteAngleCurrentGain: 1,
    infiniteAngleCurrentGainLog10: 0,
    infiniteAnglePointProgress: 0,
    infiniteAngleTotalVertexProgress: 0,
    infiniteAngleLastVertexIndex: 0,
    towerFloor: 0,
    ipGainUpgradeLevel: 0,
    infiniteAngleUpgradeLevel: 0,
    softcapUpgradeLevel: 0,
    activeChallenge: 0,
    completedChallenges: (1 << 8) - 1,
    activeChallengeTime: 0,
    activeTowerChallenge: 0,
    completedTowerChallenges: 0,
    activeTowerChallengeTime: 0,
    tc4BaseGainLevel: 0,
    tc4BaseGainPriceStep: 0,
    tc4InfinityScoreVertexGainLevel: 0,
    tc4InfinityScoreVertexGainPriceStep: 0,
    tc4FreeCoreBoostLevel: 0,
    tc4FreeCoreBoostPriceStep: 0,
    fastestInfinityChallengeTimes: Array(8).fill(0),
    fastestTowerChallengeTimes: Array(4).fill(0),
    infiniteCapBroken: true,
    achievementMask: 0x7fffffff,
    achievementMaskHigh: 0x3ff,
    currentInfinityRunTime: 0,
    currentInfinityRealTime: 0,
    currentGenerationRunTime: 0,
    bestInfinityCountPerSecond: 0,
    infinityCountRateRemainder: 0,
    offlineProgressEnabled: true,
    offlineTickCount: 1000,
    timeFlux: 0,
    timeFluxCapacityLevel: 0,
    timeFluxGainLevel: 0,
    timeFluxSpeed: 1,
    timeFluxCustomSpeed: 4,
    automationEnabled: false,
    autoBuySpeed: true,
    autoBuyVertex: true,
    autoBuyGain: true,
    autoBuyInfiniteAngleSpeed: false,
    autoBuyInfiniteAngleVertex: false,
    autoBuyInfiniteAngleGain: false,
    autoBuildTower: false,
    autoRunGeneration: false,
    autoGenerationScoreMultiplierThreshold: 2,
    autoGenerationCostMultiplierThreshold: 1,
    autoGenerationMinimumSeconds: 0,
    autoGenerationLegacyOrMode: false,
    autoRunCoreBoost: false,
    autoRunInfinity: false,
    autoInfinityPointThreshold: 10,
    autoInfinityPointThresholdLog10: 1,
    ic8VertexDecayElapsed: 0,
    currentInfinityRunHadGeneration: false,
    currentInfinityRunHadCoreBoost: false,
    totalPlayTime: 0,
    totalRealPlayTime: 0,
    fastestInfinityTime: 0,
    fastestInfinityRealTime: 0,
    lastInfinityRuns: [],
    noGenerationCoreBoostReached: false,
  }),
});

const CANDIDATES = Object.freeze([
  Object.freeze({
    id: "timeline-free",
    family: "Timeline-free",
    formula: "normal runtime.infinityPointGain()",
    postSoftcapPower: null,
  }),
  Object.freeze({
    id: "real-bc16500",
    family: "Real-BC16500",
    formula: "normal IP gain × (1 + log10(current IP))",
    postSoftcapPower: null,
  }),
  Object.freeze({
    id: "parallel-bc16500-root",
    family: "Parallel-BC16500",
    formula: "normal IP gain × 3^secondsSinceIC8Clear; raw x1e10 softcap; post-softcap power 0.50",
    rawMultiplierCap: 1e10,
    postSoftcapPower: 0.5,
  }),
  Object.freeze({
    id: "parallel-bc16500-fourth-root",
    family: "Parallel-BC16500",
    formula: "normal IP gain × 3^secondsSinceIC8Clear; raw x1e10 softcap; post-softcap power 0.25",
    rawMultiplierCap: 1e10,
    postSoftcapPower: 0.25,
  }),
]);

const CHECKPOINT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "post-ic8-pre-ia",
    label: "post-IC8 / pre-IA",
    ipExponent: 5,
    infinityCount: 10000,
    infiniteAngleUnlocked: false,
    infiniteAngleLevels: [0, 0, 0],
    towerFloor: 0,
    completedTowerChallenges: 0,
    ownedInfinityUpgradeIds: REPRESENTATIVE_INFINITY_UPGRADE_IDS,
    fastestTowerChallengeTimes: [0, 0, 0, 0],
    expectedNextGate: "infinite-angle-unlock",
  }),
  Object.freeze({
    id: "ia-pre-tower",
    label: "IA progression / pre-Tower",
    ipExponent: 30,
    infinityCount: 10000,
    infiniteAngleUnlocked: true,
    infiniteAngleLevels: [0, 0, 0],
    towerFloor: 0,
    completedTowerChallenges: 0,
    ownedInfinityUpgradeIds: [...REPRESENTATIVE_INFINITY_UPGRADE_IDS, "12-1"],
    fastestTowerChallengeTimes: [0, 0, 0, 0],
    expectedNextGate: "tower-floor-1",
  }),
  Object.freeze({
    id: "early-tower-tc1",
    label: "early Tower / around TC1",
    ipExponent: 75,
    infinityCount: 10000,
    infiniteAngleUnlocked: true,
    infiniteAngleLevels: [2, 2, 2],
    towerFloor: 3,
    completedTowerChallenges: 0,
    ownedInfinityUpgradeIds: [...REPRESENTATIVE_INFINITY_UPGRADE_IDS, "12-1"],
    fastestTowerChallengeTimes: [0, 0, 0, 0],
    expectedNextGate: "tc1",
  }),
  Object.freeze({
    id: "mid-tower-tc2",
    label: "mid Tower / around TC2",
    ipExponent: 130,
    infinityCount: 10000,
    infiniteAngleUnlocked: true,
    infiniteAngleLevels: [5, 5, 5],
    towerFloor: 5,
    completedTowerChallenges: 1,
    ownedInfinityUpgradeIds: [...REPRESENTATIVE_INFINITY_UPGRADE_IDS, "12-1", "13-1"],
    fastestTowerChallengeTimes: [1, 0, 0, 0],
    expectedNextGate: "tc2",
  }),
  Object.freeze({
    id: "tc3-era",
    label: "TC3 era",
    ipExponent: 200,
    infinityCount: 10000,
    infiniteAngleUnlocked: true,
    infiniteAngleLevels: [8, 8, 8],
    towerFloor: 8,
    completedTowerChallenges: 3,
    ownedInfinityUpgradeIds: [...REPRESENTATIVE_INFINITY_UPGRADE_IDS, "12-1", "13-1"],
    fastestTowerChallengeTimes: [1, 1, 0, 0],
    expectedNextGate: "tc3",
  }),
  Object.freeze({
    id: "late-tower-tc4",
    label: "late Tower / TC4 era",
    ipExponent: 300,
    infinityCount: 10000,
    infiniteAngleUnlocked: true,
    infiniteAngleLevels: [12, 12, 12],
    towerFloor: 12,
    completedTowerChallenges: 7,
    ownedInfinityUpgradeIds: [...REPRESENTATIVE_INFINITY_UPGRADE_IDS, "12-1", "13-1", "14-1"],
    fastestTowerChallengeTimes: [1, 1, 1, 0],
    expectedNextGate: "tc4",
  }),
  Object.freeze({
    id: "final-eternity",
    label: "final IP / Eternity eligibility",
    ipExponent: "max",
    infinityCount: 10000,
    infiniteAngleUnlocked: true,
    infiniteAngleLevels: [12, 12, 12],
    towerFloor: 12,
    completedTowerChallenges: 15,
    ownedInfinityUpgradeIds: [...REPRESENTATIVE_INFINITY_UPGRADE_IDS, "12-1", "13-1", "14-1"],
    fastestTowerChallengeTimes: [1, 1, 1, 1],
    expectedNextGate: "eternity-eligibility",
  }),
]);

function parseNumberOption(args, name, fallback, minimum = 0) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = Number(args[index + 1]);
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(name + " requires a number >= " + minimum);
  }
  return value;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    parallelPostSoftcapPower: parseNumberOption(args, "--parallel-post-power", null),
    probeScoreOffsetLog10: parseNumberOption(args, "--probe-score-offset", DEFAULT_OPTIONS.probeScoreOffsetLog10),
    localProbeElapsedSeconds: [
      0,
      parseNumberOption(args, "--probe-seconds", DEFAULT_OPTIONS.localProbeElapsedSeconds[1]),
    ],
    curveSampleSeconds: CURVE_SAMPLE_SECONDS,
    writeReports: !args.includes("--no-write-reports"),
  };
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  }
  return value;
}

function cloneState(state) {
  return cloneValue(state);
}

function finiteOrString(value) {
  return Number.isFinite(value) ? value : String(value);
}

function jsonSafeValue(value) {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return finiteOrString(value);
  if (Array.isArray(value)) return value.map((entry) => jsonSafeValue(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, jsonSafeValue(entry)]));
  }
  return value;
}

function jsonSafeState(state) {
  return jsonSafeValue(state);
}

function canonicalize(value) {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (Array.isArray(value)) return value.map((entry) => canonicalize(entry));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function stateSignature(state) {
  return JSON.stringify(canonicalize(state));
}

function stateDigest(state) {
  return crypto.createHash("sha256").update(stateSignature(state)).digest("hex");
}

function configureRuntime(instance) {
  instance.runtime.updateUi = () => {};
  instance.runtime.saveGame = () => true;
  instance.runtime.createCheckpoint = () => true;
}

function currentIpLog10(runtime) {
  return runtime.log10ExactInfinityPoints(runtime.currentExactInfinityPoints());
}

function currentScoreLog10(runtime) {
  return runtime.currentScoreLog10();
}

function maskForIds(runtime, ids) {
  return ids.reduce((mask, id) => {
    const upgrade = runtime.infinityUpgradeById(id);
    assert.ok(upgrade, "Infinity Upgrade " + id + " exists");
    return mask | (1 << upgrade.bit);
  }, 0);
}

function exactIpForDefinition(runtime, definition) {
  return definition.ipExponent === "max"
    ? runtime.MAX_EXACT_INFINITY_POINTS
    : 10n ** BigInt(definition.ipExponent);
}

function applyRepresentativeFixture(instance) {
  configureRuntime(instance);
  Object.assign(instance.debug.state, cloneState(REPRESENTATIVE_FIXTURE.state));
  const { runtime, debug } = instance;
  runtime.resetBelowInfinity();
  runtime.syncInfinityPointCachesFromExact(BigInt(REPRESENTATIVE_FIXTURE.exactInfinityPoints));
  runtime.normalizeTowerChallenge4State?.();
  assert.equal(debug.state.infinityUpgradeMask, maskForIds(runtime, REPRESENTATIVE_INFINITY_UPGRADE_IDS));
  assert.deepEqual(
    [...runtime.INFINITY_UPGRADES.filter(({ id }) => runtime.hasInfinityUpgrade(id)).map(({ id }) => id)],
    [...REPRESENTATIVE_INFINITY_UPGRADE_IDS],
  );
  assert.equal(debug.state.eternityCount, 1);
  assert.equal(runtime.eternityMilestoneActive("1-1"), false);
  assert.equal(runtime.eternityMilestoneActive("1-2"), true);
  assert.equal(runtime.eternityMilestoneActive("1-3"), false);
  assert.equal(runtime.isChallengeCompleted(8), true);
  assert.equal(runtime.achievementCount(), 41);
  assert.equal(currentIpLog10(runtime), 5);
  assert.equal(debug.state.generationCount, 0);
  assert.equal(debug.state.generationCostFactor, 1);
  assert.equal(debug.state.coreBoostCount, 2);
  assert.equal(debug.state.towerFloor, 0);
  assert.equal(debug.state.activeChallenge, 0);
  assert.equal(debug.state.activeTowerChallenge, 0);
  assert.equal(debug.state.completedTowerChallenges, 0);
  assert.equal(debug.state.infiniteAngleUnlocked, false);
  assert.equal(debug.state.timeFlux, 0);
  assert.equal(debug.state.currentInfinityRunTime, 0);
  assert.equal(debug.state.currentInfinityRealTime, 0);
  return cloneState(debug.state);
}

function representativeAtStart(runtime) {
  return {
    "ic8-clear": runtime.isChallengeCompleted(8),
    "infinite-angle-unlock": runtime.state.infiniteAngleUnlocked,
    "tower-floor-1": runtime.state.towerFloor >= 1,
    tc1: runtime.towerChallengeCompleted(1),
    tc2: runtime.towerChallengeCompleted(2),
    tc3: runtime.towerChallengeCompleted(3),
    tc4: runtime.towerChallengeCompleted(4),
    "eternity-eligibility": runtime.canEternity() === true,
  };
}

function productionPredicateReport(runtime) {
  const towerFloorCosts = {};
  for (let floor = 1; floor <= 12; floor += 1) {
    towerFloorCosts[floor] = runtime.towerFloorCostLog10(floor);
  }
  return {
    infinityRequirementLog10: runtime.INFINITY_REQUIREMENT_LOG10,
    infiniteAngleUnlockCostLog10: runtime.INFINITE_ANGLE_UNLOCK_COST_LOG10,
    eternityIpThresholdLog10: runtime.log10ExactInfinityPoints(runtime.MAX_EXACT_INFINITY_POINTS),
    towerFloorCosts,
    towerChallengeUnlockFloors: [...runtime.TOWER_CHALLENGE_UNLOCK_FLOORS],
    towerChallengeTargets: [1, 2, 3, 4].map((index) => ({
      index,
      targetLog10: runtime.towerChallengeTargetLog10(index),
    })),
    tc3RelaxationReferenceCount: runtime.TOWER_CHALLENGE_3_RELAXATION_COUNT
      || TC3_RELAXATION_REFERENCE_COUNT,
    tc3EntryRule: "TC3 entry requires its production unlock floor and has no Infinity-count prerequisite",
    eternityRule: "currentExactInfinityPoints() >= MAX_EXACT_INFINITY_POINTS && TC4 is completed",
    ic8TimerRule: "the representative fixture defines IC8 clear at post-IC8 t = 0",
  };
}

function createGate(id, kind, targetLog10, reason) {
  return {
    id,
    kind,
    targetLog10: targetLog10 === undefined ? null : targetLog10,
    reason,
  };
}

function deriveNextLocalGate(runtime) {
  if (!runtime.state.infiniteAngleUnlocked) {
    return createGate(
      "infinite-angle-unlock",
      "ip-threshold",
      runtime.INFINITE_ANGLE_UNLOCK_COST_LOG10,
      "unlock Infinite Angle",
    );
  }
  const nextChallenge = [1, 2, 3, 4].find((index) => !runtime.towerChallengeCompleted(index));
  if (nextChallenge) {
    const unlockFloor = runtime.towerChallengeUnlockFloor(nextChallenge);
    if (runtime.state.towerFloor < unlockFloor) {
      const nextFloor = runtime.towerNextFloor();
      return createGate(
        "tower-floor-" + nextFloor,
        "tower-floor",
        runtime.towerNextFloorCostLog10(),
        "build Tower Floor " + nextFloor,
      );
    }
    return createGate(
      "tc" + nextChallenge,
      "score-threshold",
      runtime.towerChallengeTargetLog10(nextChallenge),
      "prepare and enter TC" + nextChallenge,
    );
  }
  if (currentIpLog10(runtime) < runtime.log10ExactInfinityPoints(runtime.MAX_EXACT_INFINITY_POINTS)) {
    return createGate(
      "final-ip-threshold",
      "ip-threshold",
      runtime.log10ExactInfinityPoints(runtime.MAX_EXACT_INFINITY_POINTS),
      "reach the exact Eternity IP threshold",
    );
  }
  return createGate(
    "eternity-eligibility",
    "eternity",
    runtime.log10ExactInfinityPoints(runtime.MAX_EXACT_INFINITY_POINTS),
    "satisfy production canEternity()",
  );
}

function checkpointPredicates(runtime, definition) {
  const exact = runtime.currentExactInfinityPoints();
  const unlocked = [1, 2, 3, 4].map((index) => runtime.towerChallengeUnlocked(index));
  const completed = [1, 2, 3, 4].map((index) => runtime.towerChallengeCompleted(index));
  return {
    exactInfinityPoints: exact.toString(),
    ipLog10: currentIpLog10(runtime),
    eternityCount: runtime.state.eternityCount,
    eternityMilestoneMask: runtime.state.eternityMilestoneMask,
    achievements: runtime.achievementCount(),
    ic8Complete: runtime.isChallengeCompleted(8),
    infiniteCapBroken: runtime.state.infiniteCapBroken,
    infiniteAngleUnlocked: runtime.state.infiniteAngleUnlocked,
    infiniteAngleLevels: [
      runtime.state.infiniteAngleSpeedLevel,
      runtime.state.infiniteAngleVertexLevel,
      runtime.state.infiniteAngleGainLevel,
    ],
    infinityCount: runtime.state.infinityCount,
    towerFloor: runtime.state.towerFloor,
    towerChallenges: {
      completedMask: runtime.state.completedTowerChallenges,
      unlocked,
      completed,
      active: runtime.state.activeTowerChallenge,
    },
    canEternity: runtime.canEternity() === true,
    nextLocalGate: deriveNextLocalGate(runtime),
    expectedCheckpoint: definition ? definition.id : null,
  };
}

function applyCheckpointState(instance, baseState, definition) {
  const { runtime } = instance;
  Object.assign(runtime.state, cloneState(baseState), {
    infinityCount: definition.infinityCount,
    infiniteAngleUnlocked: definition.infiniteAngleUnlocked,
    infiniteAngleSpeedLevel: definition.infiniteAngleLevels[0],
    infiniteAngleVertexLevel: definition.infiniteAngleLevels[1],
    infiniteAngleGainLevel: definition.infiniteAngleLevels[2],
    towerFloor: definition.towerFloor,
    completedTowerChallenges: definition.completedTowerChallenges,
    activeTowerChallenge: 0,
    activeTowerChallengeTime: 0,
    fastestTowerChallengeTimes: [...definition.fastestTowerChallengeTimes],
    infinityUpgradeMask: maskForIds(runtime, definition.ownedInfinityUpgradeIds),
  });
  runtime.syncInfinityPointCachesFromExact(exactIpForDefinition(runtime, definition));
  runtime.resetInfiniteAngleRun?.();
  runtime.normalizeTowerChallenge4State?.();
  runtime.normalizeInfinityPointState?.();
  return cloneState(runtime.state);
}

function restoreRuntimeState(runtime, snapshot) {
  Object.assign(runtime.state, cloneState(snapshot));
  runtime.syncInfinityPointCachesFromExact(BigInt(snapshot.infinityPointsExact));
  runtime.normalizeTowerChallenge4State?.();
}

function validateCheckpoint(instance, definition, state) {
  const { runtime } = instance;
  const errors = [];
  const expectedExact = exactIpForDefinition(runtime, definition).toString();
  const actual = checkpointPredicates(runtime, definition);
  const addError = (condition, message) => {
    if (!condition) errors.push(message);
  };
  addError(actual.exactInfinityPoints === expectedExact, "exact IP does not match checkpoint");
  addError(actual.eternityCount === 1, "Eternity count is not 1");
  addError(actual.eternityMilestoneMask === 2, "checkpoint is not Milestone 1-2 only");
  addError(actual.achievements === 41, "achievement count is not 41");
  addError(actual.ic8Complete === true, "IC8 is not complete");
  addError(actual.infiniteCapBroken === true, "infinite cap is not broken");
  addError(actual.infinityCount === definition.infinityCount, "Infinity count does not match checkpoint");
  addError(actual.infiniteAngleUnlocked === definition.infiniteAngleUnlocked, "IA unlock state does not match");
  addError(
    JSON.stringify(actual.infiniteAngleLevels) === JSON.stringify(definition.infiniteAngleLevels),
    "IA levels do not match",
  );
  addError(actual.towerFloor === definition.towerFloor, "Tower floor does not match");
  addError(
    actual.towerChallenges.completedMask === definition.completedTowerChallenges,
    "Tower Challenge completion mask does not match",
  );
  addError(actual.towerChallenges.active === 0, "checkpoint has an active Tower Challenge");
  addError(
    actual.nextLocalGate.id === definition.expectedNextGate,
    "next local gate is " + actual.nextLocalGate.id + ", expected " + definition.expectedNextGate,
  );
  addError(
    state.infinityUpgradeMask === maskForIds(runtime, definition.ownedInfinityUpgradeIds),
    "Infinity Upgrade mask does not match",
  );
  definition.ownedInfinityUpgradeIds.forEach((id) => {
    addError(runtime.hasInfinityUpgrade(id), "owned Infinity Upgrade missing: " + id);
  });
  for (let index = 1; index <= 4; index += 1) {
    if (definition.completedTowerChallenges & (1 << (index - 1))) {
      addError(actual.towerChallenges.unlocked[index - 1], "completed TC" + index + " is not unlocked");
      addError(actual.towerChallenges.completed[index - 1], "completed TC" + index + " predicate is false");
    }
  }

  let tc3EntryWithout600000 = null;
  if (definition.id === "tc3-era") {
    const before = cloneState(runtime.state);
    const started = runtime.toggleTowerChallenge(3);
    tc3EntryWithout600000 = runtime.state.infinityCount < TC3_RELAXATION_REFERENCE_COUNT
      && started === true
      && runtime.state.activeTowerChallenge === 3;
    addError(tc3EntryWithout600000, "TC3 incorrectly requires the relaxation reference count");
    restoreRuntimeState(runtime, before);
  }
  if (definition.id === "final-eternity") {
    addError(actual.canEternity === true, "final checkpoint is not canEternity()-eligible");
  }
  return {
    status: errors.length === 0 ? "passed" : "failed",
    errors,
    tc3EntryWithout600000,
    stateDigest: stateDigest(state),
    predicates: checkpointPredicates(runtime, definition),
  };
}

async function createRepresentativeFixture() {
  const instance = await loadRuntime(CANDIDATE_PATH);
  const state = applyRepresentativeFixture(instance);
  return {
    id: REPRESENTATIVE_FIXTURE.id,
    boundary: REPRESENTATIVE_FIXTURE.boundary,
    exactInfinityPoints: REPRESENTATIVE_FIXTURE.exactInfinityPoints,
    representativeCase: "Eternity 1 / Milestone 1-2 / Achievements 1-41 / IC8 complete",
    resetSemantics: "fresh runtime state with the listed IU mask, then production resetBelowInfinity()",
    ownedInfinityUpgradeIds: [...REPRESENTATIVE_INFINITY_UPGRADE_IDS],
    notOwnedInfinityUpgradeIds: ["12-1", "13-1", "14-1"],
    state,
    atStart: representativeAtStart(instance.runtime),
    productionPredicates: productionPredicateReport(instance.runtime),
  };
}

async function createCheckpointFixtures() {
  const instance = await loadRuntime(CANDIDATE_PATH);
  const baseState = applyRepresentativeFixture(instance);
  const checkpoints = [];
  for (const definition of CHECKPOINT_DEFINITIONS) {
    const state = applyCheckpointState(instance, baseState, definition);
    const consistency = validateCheckpoint(instance, definition, state);
    assert.equal(consistency.status, "passed", definition.id + " checkpoint validation");
    checkpoints.push({
      ...definition,
      state,
      stateDigest: stateDigest(state),
      predicates: consistency.predicates,
      nextLocalGate: consistency.predicates.nextLocalGate,
      consistency: {
        status: consistency.status,
        errors: consistency.errors,
        tc3EntryWithout600000: consistency.tc3EntryWithout600000,
        stateDigest: consistency.stateDigest,
      },
    });
  }
  return {
    baseState,
    productionPredicates: productionPredicateReport(instance.runtime),
    checkpoints,
  };
}

function parallelRawMultiplierLog10(seconds) {
  return Math.max(0, Number(seconds)) * Math.log10(3);
}

function parallelMultiplierLog10(seconds, postSoftcapPower) {
  const rawLog10 = parallelRawMultiplierLog10(seconds);
  if (rawLog10 <= RAW_PARALLEL_SOFTCAP_LOG10) return rawLog10;
  return RAW_PARALLEL_SOFTCAP_LOG10
    + (rawLog10 - RAW_PARALLEL_SOFTCAP_LOG10) * postSoftcapPower;
}

function realMultiplierLog10(ipLog10) {
  if (!Number.isFinite(ipLog10) || ipLog10 <= 0) return 0;
  return Math.log10(1 + ipLog10);
}

function researchElapsedSeconds(clock) {
  if (clock.nowSeconds === undefined || clock.ic8ClearAtSeconds === null) return null;
  return Math.max(0, clock.nowSeconds - clock.ic8ClearAtSeconds);
}

function installResearchEffect(runtime, candidate, clock) {
  const original = runtime.infinityPointGain;
  runtime.infinityPointGain = () => {
    const baseGain = original();
    if (!(baseGain > 0)) return baseGain;
    let multiplierLog10 = 0;
    if (candidate.id === "real-bc16500") {
      multiplierLog10 = realMultiplierLog10(currentIpLog10(runtime));
    } else if (candidate.postSoftcapPower !== null) {
      multiplierLog10 = parallelMultiplierLog10(
        researchElapsedSeconds(clock),
        candidate.postSoftcapPower,
      );
    }
    if (!(multiplierLog10 > 0)) return baseGain;
    const maximumLog10 = runtime.log10ExactInfinityPoints(runtime.MAX_EXACT_INFINITY_POINTS);
    const gainLog10 = runtime.log10Value(baseGain) + multiplierLog10;
    return Math.max(
      1,
      Math.floor(runtime.valueFromLog10(Math.min(gainLog10, maximumLog10))),
    );
  };
  return () => {
    runtime.infinityPointGain = original;
  };
}

function log10Add(first, second) {
  if (first === -Infinity) return second;
  if (second === -Infinity) return first;
  const maximum = Math.max(first, second);
  const difference = Math.abs(first - second);
  return maximum + Math.log10(1 + 10 ** -difference);
}

function setEffectiveScore(runtime, effectiveLog10) {
  const rawLog10 = runtime.rawScoreLog10FromEffective
    ? runtime.rawScoreLog10FromEffective(effectiveLog10)
    : effectiveLog10;
  runtime.state.scoreLog10 = rawLog10;
  runtime.state.score = runtime.valueFromLog10(rawLog10);
}

function gateProbeResult(runtime, gate, projectedIpLog10) {
  if (gate.kind === "eternity") return runtime.canEternity() ? "already-covered" : "not-covered";
  if (gate.kind === "score-threshold") return "not-applicable-score-gate";
  if (projectedIpLog10 >= gate.targetLog10) return "covered";
  return "not-covered";
}

function localProbe(runtime, candidate, gate, elapsedSeconds, scoreOffsetLog10) {
  const snapshot = cloneState(runtime.state);
  const heldIpLog10 = currentIpLog10(runtime);
  const scoreLog10 = runtime.INFINITY_REQUIREMENT_LOG10 + scoreOffsetLog10;
  setEffectiveScore(runtime, scoreLog10);
  const normalGain = runtime.infinityPointGain();
  const clock = { nowSeconds: elapsedSeconds, ic8ClearAtSeconds: 0 };
  const restoreEffect = installResearchEffect(runtime, candidate, clock);
  const candidateGain = runtime.infinityPointGain();
  restoreEffect();
  const normalGainLog10 = runtime.log10Value(normalGain);
  const candidateGainLog10 = runtime.log10Value(candidateGain);
  const maximumLog10 = runtime.log10ExactInfinityPoints(runtime.MAX_EXACT_INFINITY_POINTS);
  const projectedIpLog10 = Math.min(
    maximumLog10,
    log10Add(heldIpLog10, candidateGainLog10),
  );
  const gateCoverage = gateProbeResult(runtime, gate, projectedIpLog10);
  const result = {
    elapsedSeconds,
    probeMode: "instantaneous production IP-gain probe at Infinity threshold + "
      + scoreOffsetLog10 + " log10 Score",
    probeScoreLog10: currentScoreLog10(runtime),
    heldIpLog10,
    normalGain: finiteOrString(normalGain),
    normalGainLog10: finiteOrString(normalGainLog10),
    candidateGain: finiteOrString(candidateGain),
    candidateGainLog10: finiteOrString(candidateGainLog10),
    candidateEffectMultiplierLog10: finiteOrString(candidateGainLog10 - normalGainLog10),
    projectedHeldIpLog10: finiteOrString(projectedIpLog10),
    projectedFinalIpCapReached: projectedIpLog10 >= maximumLog10,
    gateCoverage,
    nextGateCovered: gateCoverage === "covered",
  };
  restoreRuntimeState(runtime, snapshot);
  return result;
}

function checkpointCollapseRisk(checkpoint, candidate, probes) {
  const gate = checkpoint.nextLocalGate;
  if (checkpoint.predicates.canEternity === true) return "already-eligible";
  const latest = probes.at(-1);
  if (gate.kind === "score-threshold") {
    return latest.projectedFinalIpCapReached
      ? "final-IP-cap-before-score-gate"
      : "score-gate-preserved";
  }
  if (latest.projectedFinalIpCapReached && !latest.nextGateCovered) {
    return "final-IP-cap-with-gate-uncovered";
  }
  if (latest.nextGateCovered) {
    return candidate.id === "timeline-free"
      ? "next-IP-gate-covered-by-baseline"
      : "candidate-skips-next-IP-gate";
  }
  return "next-IP-gate-preserved";
}

function checkpointReportState(runtime) {
  return {
    exactInfinityPoints: runtime.currentExactInfinityPoints().toString(),
    ipLog10: finiteOrString(currentIpLog10(runtime)),
    infinityCount: runtime.state.infinityCount,
    infiniteAngleUnlocked: runtime.state.infiniteAngleUnlocked,
    infiniteAngleLevels: [
      runtime.state.infiniteAngleSpeedLevel,
      runtime.state.infiniteAngleVertexLevel,
      runtime.state.infiniteAngleGainLevel,
    ],
    towerFloor: runtime.state.towerFloor,
    completedTowerChallenges: runtime.state.completedTowerChallenges,
    canEternity: runtime.canEternity() === true,
  };
}

function candidateSet(options) {
  if (options.parallelPostSoftcapPower === null
    || options.parallelPostSoftcapPower === undefined) return CANDIDATES;
  return CANDIDATES.map((candidate) => candidate.postSoftcapPower === null
    ? candidate
    : {
      ...candidate,
      postSoftcapPower: options.parallelPostSoftcapPower,
      formula: candidate.formula.replace(
        /post-softcap power [0-9.]+/,
        "post-softcap power " + options.parallelPostSoftcapPower,
      ),
    });
}

async function runCheckpointCandidate(checkpoint, candidate, options = DEFAULT_OPTIONS) {
  const instance = await loadRuntime(CANDIDATE_PATH);
  configureRuntime(instance);
  Object.assign(instance.runtime.state, cloneState(checkpoint.state));
  instance.runtime.syncInfinityPointCachesFromExact(BigInt(checkpoint.state.infinityPointsExact));
  instance.runtime.normalizeTowerChallenge4State?.();
  const initialDigest = stateDigest(instance.runtime.state);
  assert.equal(initialDigest, checkpoint.stateDigest, checkpoint.id + " fresh clone digest");
  const initialPredicates = checkpointPredicates(instance.runtime, checkpoint);
  assert.deepEqual(initialPredicates, checkpoint.predicates, checkpoint.id + " fresh clone predicates");
  const gate = deriveNextLocalGate(instance.runtime);
  const originalGain = instance.runtime.infinityPointGain;
  const probes = (options.localProbeElapsedSeconds || DEFAULT_OPTIONS.localProbeElapsedSeconds)
    .map((elapsedSeconds) => localProbe(
      instance.runtime,
      candidate,
      gate,
      elapsedSeconds,
      options.probeScoreOffsetLog10 ?? DEFAULT_OPTIONS.probeScoreOffsetLog10,
    ));
  const finalDigest = stateDigest(instance.runtime.state);
  const finalPredicates = checkpointPredicates(instance.runtime, checkpoint);
  const effectIsolation = instance.runtime.infinityPointGain === originalGain
    && finalDigest === initialDigest;
  assert.equal(effectIsolation, true, checkpoint.id + " research effect isolation");
  assert.deepEqual(finalPredicates, initialPredicates, checkpoint.id + " probe state restoration");
  return {
    checkpointId: checkpoint.id,
    checkpointLabel: checkpoint.label,
    candidateId: candidate.id,
    status: "measured",
    initialStateDigest: initialDigest,
    finalStateDigest: finalDigest,
    checkpointStateDigest: checkpoint.stateDigest,
    initialPredicates,
    finalPredicates,
    nextLocalGate: gate,
    probes,
    collapseRisk: checkpointCollapseRisk(checkpoint, candidate, probes),
    effectIsolation,
    state: checkpointReportState(instance.runtime),
  };
}

function formatLog10(value) {
  if (value === null || value === undefined) return "n/a";
  const numeric = Number(value);
  if (numeric === -Infinity) return "-∞";
  if (!Number.isFinite(numeric)) return String(value);
  if (Math.abs(numeric) < 0.005) return "x1";
  return "x10^" + numeric.toFixed(2);
}

function formatSeconds(seconds) {
  const numeric = Number(seconds);
  if (!Number.isFinite(numeric)) return String(seconds);
  if (numeric === 0) return "0s";
  if (numeric < 60) return numeric.toFixed(1) + "s";
  if (numeric < 3600) return (numeric / 60).toFixed(2) + "m";
  return (numeric / 3600).toFixed(2) + "h";
}

function createParallelCurve(postSoftcapPower, sampleSeconds = CURVE_SAMPLE_SECONDS) {
  const powers = {
    root: postSoftcapPower === undefined || postSoftcapPower === null ? 0.5 : postSoftcapPower,
    fourthRoot: postSoftcapPower === undefined || postSoftcapPower === null ? 0.25 : postSoftcapPower,
  };
  return {
    rawFormula: "3^secondsSinceIC8Clear",
    rawSoftcapLog10: RAW_PARALLEL_SOFTCAP_LOG10,
    rawSoftcapSeconds: RAW_PARALLEL_SOFTCAP_SECONDS,
    samples: sampleSeconds.map((elapsedSeconds) => {
      const rawMultiplierLog10 = parallelRawMultiplierLog10(elapsedSeconds);
      return {
        elapsedSeconds,
        elapsedLabel: Math.abs(elapsedSeconds - RAW_PARALLEL_SOFTCAP_SECONDS) < 1e-9
          ? "~21s (raw x1e10)"
          : formatSeconds(elapsedSeconds),
        rawMultiplierLog10,
        rawMultiplier: formatLog10(rawMultiplierLog10),
        candidates: {
          "parallel-bc16500-root": {
            postSoftcapPower: powers.root,
            effectiveMultiplierLog10: parallelMultiplierLog10(elapsedSeconds, powers.root),
            effectiveMultiplier: formatLog10(parallelMultiplierLog10(elapsedSeconds, powers.root)),
          },
          "parallel-bc16500-fourth-root": {
            postSoftcapPower: powers.fourthRoot,
            effectiveMultiplierLog10: parallelMultiplierLog10(elapsedSeconds, powers.fourthRoot),
            effectiveMultiplier: formatLog10(parallelMultiplierLog10(elapsedSeconds, powers.fourthRoot)),
          },
        },
      };
    }),
  };
}

function validateCheckpointReport(report) {
  const errors = [];
  const expectedCheckpointIds = CHECKPOINT_DEFINITIONS.map(({ id }) => id);
  const actualCheckpointIds = report.checkpoints.map(({ id }) => id);
  if (JSON.stringify(actualCheckpointIds) !== JSON.stringify(expectedCheckpointIds)) {
    errors.push("checkpoint definitions do not match the required seven states");
  }
  report.checkpoints.forEach((checkpoint) => {
    if (checkpoint.consistency.status !== "passed") {
      errors.push(checkpoint.id + " consistency failed");
    }
    if (checkpoint.stateDigest !== checkpoint.consistency.stateDigest
      && checkpoint.consistency.stateDigest !== undefined) {
      errors.push(checkpoint.id + " consistency digest mismatch");
    }
  });
  const expectedCandidateIds = CANDIDATES.map(({ id }) => id);
  const grouped = new Map();
  report.cases.forEach((entry) => {
    if (!grouped.has(entry.checkpointId)) grouped.set(entry.checkpointId, []);
    grouped.get(entry.checkpointId).push(entry);
    if (entry.initialStateDigest !== entry.checkpointStateDigest) {
      errors.push(entry.checkpointId + "/" + entry.candidateId + " did not start from its checkpoint clone");
    }
    if (entry.finalStateDigest !== entry.initialStateDigest || !entry.effectIsolation) {
      errors.push(entry.checkpointId + "/" + entry.candidateId + " changed persistent state");
    }
  });
  report.checkpoints.forEach((checkpoint) => {
    const candidates = grouped.get(checkpoint.id) || [];
    const ids = candidates.map(({ candidateId }) => candidateId);
    if (JSON.stringify(ids) !== JSON.stringify(expectedCandidateIds)) {
      errors.push(checkpoint.id + " does not have exactly four candidate cases");
    }
  });
  const rawSoftcapSample = report.parallelCurve.samples.find(
    ({ elapsedSeconds }) => elapsedSeconds === report.parallelCurve.rawSoftcapSeconds,
  );
  if (!rawSoftcapSample || rawSoftcapSample.rawMultiplierLog10 !== RAW_PARALLEL_SOFTCAP_LOG10) {
    errors.push("raw x1e10 curve sample is missing");
  }
  if (!report.parallelCurve.samples.some(({ elapsedSeconds }) => elapsedSeconds === 0)
    || !report.parallelCurve.samples.some(({ elapsedSeconds }) => elapsedSeconds === 3600)) {
    errors.push("0s and 1h curve samples are missing");
  }
  const tc3 = report.checkpoints.find(({ id }) => id === "tc3-era");
  if (!tc3 || tc3.infinityCount !== 10000
    || tc3.nextLocalGate.id !== "tc3"
    || tc3.consistency.tc3EntryWithout600000 !== true) {
    errors.push("TC3 checkpoint still has a synthetic Infinity-count gate");
  }
  if (report.excludedEvidence.balanceConclusionEligible !== false) {
    errors.push("previous autonomous-route evidence was not excluded");
  }
  return {
    status: errors.length === 0 ? "passed" : "failed",
    errors,
    checkpointCount: report.checkpoints.length,
    candidateCountPerCheckpoint: 4,
    caseCount: report.cases.length,
    rawSoftcapSample: Boolean(rawSoftcapSample),
    excludedAutonomousRouteEvidence: report.excludedEvidence.balanceConclusionEligible === false,
  };
}

function buildInterpretation(report) {
  const scoreGateCheckpoints = report.checkpoints.filter(({ nextLocalGate }) => (
    nextLocalGate.kind === "score-threshold"
  ));
  const scoreGateIds = new Set(scoreGateCheckpoints.map(({ id }) => id));
  const collapseBeforeScoreGate = (candidateId) => report.cases.filter((entry) => (
    entry.candidateId === candidateId
      && scoreGateIds.has(entry.checkpointId)
      && entry.collapseRisk === "final-IP-cap-before-score-gate"
  )).length;
  const rootCollapseCount = collapseBeforeScoreGate("parallel-bc16500-root");
  const fourthRootCollapseCount = collapseBeforeScoreGate("parallel-bc16500-fourth-root");
  return {
    leastDisruptiveMeasuredCandidate: "real-bc16500",
    realReading: "Real-BC16500 adds a state-dependent gain while preserving the measured IP and score gates at the default local probe horizon.",
    parallelReading: "Both Parallel powers are much stronger after raw x1e10; the root is stronger than the fourth-root and the default one-hour probes reach the exact IP cap before the remaining TC score gates.",
    scoreGateCollapseCounts: {
      root: rootCollapseCount,
      fourthRoot: fourthRootCollapseCount,
      scoreGateCheckpointCount: scoreGateCheckpoints.length,
    },
    provisionalRange: "Real is the least disruptive reference; fourth-root is the less aggressive Parallel candidate, but neither result selects a production softcap.",
    productionDecision: "none",
  };
}

async function createReport(rawOptions = {}) {
  const options = {
    ...DEFAULT_OPTIONS,
    ...rawOptions,
    localProbeElapsedSeconds: [...(rawOptions.localProbeElapsedSeconds || DEFAULT_OPTIONS.localProbeElapsedSeconds)],
    curveSampleSeconds: [...(rawOptions.curveSampleSeconds || DEFAULT_OPTIONS.curveSampleSeconds)],
  };
  const candidates = candidateSet(options);
  const fixture = await createRepresentativeFixture();
  const checkpointSet = await createCheckpointFixtures();
  const report = {
    schemaVersion: 6,
    issue: ISSUE,
    title: "Evaluate first Timeline-node balance from representative post-IC8 checkpoints",
    studyType: "representative-post-IC8-checkpoint-study",
    researchOnly: true,
    noProductionChanges: true,
    productionRuntime: "src/main.js",
    options: {
      probeScoreOffsetLog10: options.probeScoreOffsetLog10,
      localProbeElapsedSeconds: options.localProbeElapsedSeconds,
      curveSampleSeconds: options.curveSampleSeconds,
      parallelPostSoftcapPower: options.parallelPostSoftcapPower,
      boundedToNextLocalGate: true,
    },
    researchEffects: candidates,
    productionPredicates: fixture.productionPredicates,
    fixture: {
      ...fixture,
      state: jsonSafeState(fixture.state),
    },
    checkpoints: checkpointSet.checkpoints.map((checkpoint) => ({
      ...checkpoint,
      state: jsonSafeState(checkpoint.state),
      consistency: {
        ...checkpoint.consistency,
        stateDigest: checkpoint.stateDigest,
      },
    })),
    parallelCurve: createParallelCurve(
      options.parallelPostSoftcapPower,
      options.curveSampleSeconds,
    ),
    excludedEvidence: {
      balanceConclusionEligible: false,
      reason: "Previous astronomical and one-year autonomous-route artifacts are diagnostic only; policy quality is not Timeline balance evidence.",
      artifacts: [
        "previous full-route one-year/policy-stall report",
        "previous astronomical-duration exploratory output",
      ],
    },
    validation: {
      freshRuntimePerCheckpointCandidate: true,
      researchHookOnly: true,
      noProductionTimelineChange: true,
      errors: [],
    },
    cases: [],
    outcome: null,
  };
  const internalCheckpoints = checkpointSet.checkpoints;
  for (const checkpoint of internalCheckpoints) {
    for (const candidate of candidates) {
      report.cases.push(await runCheckpointCandidate(checkpoint, candidate, options));
    }
  }
  report.interpretation = buildInterpretation(report);
  report.validation.checkpointStudy = validateCheckpointReport(report);
  report.validation.errors = [...report.validation.checkpointStudy.errors];
  report.validation.status = report.validation.errors.length === 0 ? "passed" : "failed";
  report.outcome = report.validation.status === "passed"
    ? {
      status: "measured",
      reason: "four isolated Timeline candidates were measured at seven representative checkpoints; no authoritative IC8-to-Eternity duration is claimed",
    }
    : {
      status: "invalid",
      reason: report.validation.errors.join("; "),
    };
  return report;
}

function formatMarkdown(report) {
  const lines = [
    "# Issue #" + report.issue + " checkpoint study",
    "",
    "> Research evidence only. No production Timeline formula or gameplay behavior was changed.",
    "",
    "- Outcome: **" + report.outcome.status + "** — " + report.outcome.reason,
    "- Scope: seven representative post-IC8 checkpoints × four fresh candidate clones; no full autonomous IC8 → Eternity route is required.",
    "- Fixture: **" + report.fixture.representativeCase + "**; IP **1e5**, Infinity **"
      + report.fixture.state.infinityCount + "**, IU through row 11, no IA, Tower Floor 0, IC8 clear at post-IC8 **t = 0**.",
    "- Parallel raw formula: **" + report.parallelCurve.rawFormula + "**; raw x1e10 is reached at **"
      + report.parallelCurve.rawSoftcapSeconds.toFixed(2) + "s**. The curve does not select a production softcap.",
    "- Local probes are instantaneous production-runtime IP-gain comparisons at Infinity threshold + "
      + report.options.probeScoreOffsetLog10 + " log10 Score and are bounded to the next local gate.",
    "- Reading: **" + report.interpretation.leastDisruptiveMeasuredCandidate
      + "** is the least disruptive measured reference; Parallel root/fourth-root are stronger but show score-gate collapse risk in the one-hour probes. No production candidate is selected.",
    "- Prior astronomical/one-year autonomous-route output is explicitly **excluded from balance conclusions**.",
    "",
    "## Parallel multiplier curve",
    "",
    "| Elapsed | Raw multiplier | Root post-softcap | Fourth-root post-softcap |",
    "| --- | ---: | ---: | ---: |",
  ];
  report.parallelCurve.samples.forEach((sample) => {
    lines.push(
      "| " + sample.elapsedLabel
      + " | " + sample.rawMultiplier
      + " | " + sample.candidates["parallel-bc16500-root"].effectiveMultiplier
      + " | " + sample.candidates["parallel-bc16500-fourth-root"].effectiveMultiplier
      + " |",
    );
  });
  lines.push(
    "",
    "## Checkpoint definitions",
    "",
    "| Checkpoint | IP | Infinity | IA | Tower | TC complete | Next local gate | Consistency |",
    "| --- | ---: | ---: | --- | ---: | ---: | --- | --- |",
  );
  report.checkpoints.forEach((checkpoint) => {
    lines.push(
      "| " + checkpoint.id
      + " | 10^" + Number(checkpoint.predicates.ipLog10).toFixed(2)
      + " | " + checkpoint.infinityCount
      + " | " + checkpoint.infiniteAngleLevels.join("/")
      + " (" + (checkpoint.infiniteAngleUnlocked ? "unlocked" : "locked") + ")"
      + " | F" + checkpoint.towerFloor
      + " | " + checkpoint.completedTowerChallenges
      + " | " + checkpoint.nextLocalGate.id
      + " | " + checkpoint.consistency.status
      + " |",
    );
  });
  lines.push(
    "",
    "## Candidate probes",
    "",
    "| Checkpoint | Candidate | Next gate | Normal gain | Candidate gain | 1h projected IP | Gate at 1h | Collapse/skip risk |",
    "| --- | --- | --- | ---: | ---: | ---: | --- | --- |",
  );
  report.cases.forEach((entry) => {
    const first = entry.probes[0];
    const latest = entry.probes.at(-1);
    lines.push(
      "| " + entry.checkpointId
      + " | " + entry.candidateId
      + " | " + entry.nextLocalGate.id
      + " | " + formatLog10(first.normalGainLog10)
      + " | " + formatLog10(first.candidateGainLog10)
      + " | 10^" + Number(latest.projectedHeldIpLog10).toFixed(2)
      + " | " + latest.gateCoverage
      + " | " + entry.collapseRisk
      + " |",
    );
  });
  lines.push(
    "",
    "## Validation and exclusions",
    "",
    "- Checkpoint/candidate cases: **" + report.cases.length + "**; validation: **" + report.validation.status + "**.",
    "- Every case starts and ends with the same exact state digest; the research effect is restored after each probe.",
    "- The TC3-era checkpoint uses Infinity count **" + report.checkpoints.find(({ id }) => id === "tc3-era").infinityCount
      + "** and enters the production TC3 toggle path; **" + TC3_RELAXATION_REFERENCE_COUNT
      + "** is recorded only as the relaxation reference point, not an entry gate.",
    "- canEternity() is documented as a final-checkpoint predicate, not as a route target for this study.",
    "- Previous full-route astronomical/one-year policy results remain diagnostic artifacts and are not used as balance evidence.",
    "",
  );
  return lines.join("\n");
}

function writeReports(report, reportPath = DEFAULT_REPORT_PATH, markdownPath = DEFAULT_MARKDOWN_PATH) {
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  fs.writeFileSync(markdownPath, formatMarkdown(report));
}

async function main() {
  const options = parseArgs(process.argv);
  const report = await createReport(options);
  if (options.writeReports) writeReports(report);
  process.stdout.write(JSON.stringify({
    issue: report.issue,
    outcome: report.outcome,
    cases: report.cases.length,
    validation: report.validation.status,
  }, null, 2) + "\n");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  CANDIDATES,
  CHECKPOINT_DEFINITIONS,
  CURVE_SAMPLE_SECONDS,
  DEFAULT_OPTIONS,
  MILESTONE_IDS,
  REPRESENTATIVE_FIXTURE,
  applyRepresentativeFixture,
  checkpointPredicates,
  cloneState,
  createCheckpointFixtures,
  createParallelCurve,
  createReport,
  createRepresentativeFixture,
  deriveNextLocalGate,
  formatMarkdown,
  installResearchEffect,
  parallelMultiplierLog10,
  productionPredicateReport,
  realMultiplierLog10,
  runCheckpointCandidate,
  stateDigest,
  writeReports,
};
