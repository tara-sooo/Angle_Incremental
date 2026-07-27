import { runtime, expose } from "../runtime/shared.js";

// Tower progression persists through Infinity. Costs stay in log space because the
// later floors quickly exceed JavaScript's native numeric range.

const TOWER_FLOOR_COST_LOG10 = Object.freeze({
  1: 50,
  2: 60,
  3: 70,
  4: 85,
  5: 100,
  6: 125,
  7: 150,
  8: 175,
  9: 205,
  10: 235,
  11: 265,
  12: 295,
  13: 345,
});

const TOWER_CHALLENGE_UNLOCK_FLOORS = Object.freeze([3, 5, 8, 12]);

function towerFloor() {
  return Math.max(0, Math.floor(runtime.state.towerFloor));
}

function towerFloorCostLog10(floor) {
  const normalizedFloor = Math.max(1, Math.floor(floor));
  if (TOWER_FLOOR_COST_LOG10[normalizedFloor] !== undefined) {
    return TOWER_FLOOR_COST_LOG10[normalizedFloor];
  }
  const post13Steps = normalizedFloor - 13;
  return runtime.clampLog10(345 * Math.pow(runtime.TOWER_POST_13_COST_POWER, post13Steps));
}

function towerNextFloor() {
  return towerFloor() + 1;
}

function towerNextFloorCostLog10() {
  return towerFloorCostLog10(towerNextFloor());
}

function towerScoreExponent() {
  return 1 + towerFloor() * runtime.TOWER_SCORE_EXPONENT_STEP;
}

function towerChallengeUnlockFloor(index) {
  const normalizedIndex = Math.floor(index) - 1;
  return TOWER_CHALLENGE_UNLOCK_FLOORS[normalizedIndex] || Infinity;
}

function towerChallengeUnlocked(index) {
  return towerFloor() >= towerChallengeUnlockFloor(index);
}

function towerChallengeCompleted(index) {
  return false;
}

function towerGateForFloor(floor) {
  const normalizedFloor = Math.max(1, Math.floor(floor));
  const challengeIndex = TOWER_CHALLENGE_UNLOCK_FLOORS.indexOf(normalizedFloor - 1) + 1;
  return challengeIndex > 0 ? challengeIndex : 0;
}

function towerCanBuildNextFloor() {
  const gate = towerGateForFloor(towerNextFloor());
  return gate === 0 || towerChallengeCompleted(gate);
}

function canBuildTower() {
  const costLog10 = towerNextFloorCostLog10();
  const maximumCostLog10 = runtime.log10ExactInfinityPoints(runtime.MAX_EXACT_INFINITY_POINTS);
  return towerCanBuildNextFloor()
    && costLog10 <= maximumCostLog10
    && runtime.canSpendInfinityPoints(costLog10);
}

function buildTower() {
  if (!canBuildTower()) return false;
  if (runtime.createCheckpoint && !runtime.createCheckpoint("pre-tower-build", { force: true })) return false;
  if (!runtime.spendInfinityPoints(towerNextFloorCostLog10())) return false;
  runtime.state.towerFloor = towerNextFloor();
  runtime.updateUi();
  runtime.saveGame("manual");
  return true;
}

expose("TOWER_FLOOR_COST_LOG10", () => TOWER_FLOOR_COST_LOG10);
expose("TOWER_CHALLENGE_UNLOCK_FLOORS", () => TOWER_CHALLENGE_UNLOCK_FLOORS);
expose("towerFloor", () => towerFloor);
expose("towerFloorCostLog10", () => towerFloorCostLog10);
expose("towerNextFloor", () => towerNextFloor);
expose("towerNextFloorCostLog10", () => towerNextFloorCostLog10);
expose("towerScoreExponent", () => towerScoreExponent);
expose("towerChallengeUnlockFloor", () => towerChallengeUnlockFloor);
expose("towerChallengeUnlocked", () => towerChallengeUnlocked);
expose("towerChallengeCompleted", () => towerChallengeCompleted);
expose("towerGateForFloor", () => towerGateForFloor);
expose("towerCanBuildNextFloor", () => towerCanBuildNextFloor);
expose("canBuildTower", () => canBuildTower);
expose("buildTower", () => buildTower);
