// State defaults and serialized fields are data, not gameplay behavior. Keeping
// them here makes schema changes reviewable without searching the runtime.

const STATE_DEFAULTS = Object.freeze({
  score: 0,
  scoreLog10: -Infinity,
  totalScore: 0,
  totalScoreLog10: -Infinity,
  generationScore: 0,
  generationScoreLog10: -Infinity,
  vertices: 3,
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
  coreBoostCount: 0,
  infinityCount: 0,
  infinityPoints: 0,
  infinityPointsLog10: -Infinity,
  infiniteScore: 0,
  infiniteScoreLog10: -Infinity,
  infinityUpgradeMask: 0,
  ipGainUpgradeLevel: 0,
  infiniteAngleUpgradeLevel: 0,
  softcapUpgradeLevel: 0,
  activeChallenge: 0,
  completedChallenges: 0,
  infiniteCapBroken: false,
  achievementMask: 0,
  totalPlayTime: 0,
  currentInfinityRunTime: 0,
  fastestInfinityTime: 0,
  lastInfinityRuns: [],
  automationEnabled: false,
  autoBuySpeed: true,
  autoBuyVertex: true,
  autoBuyGain: true,
  autoCompleteChallenges: false,
  ic8VertexDecayElapsed: 0,
  noGenerationCoreBoostReached: false,
  showFloatingText: true,
  lightEffects: false,
  showFps: false,
  language: "ja",
  numberFormat: "compact",
  timeUnit: "auto",
  floatingTexts: [],
  lastEarned: 0,
  lastEarnedLog10: -Infinity,
});

const SAVE_FIELD_DEFINITIONS = Object.freeze([
  "score", "scoreLog10", "totalScore", "totalScoreLog10",
  "generationScore", "generationScoreLog10", "vertices", "speedLevel", "gainLevel",
  "currentGain", "currentGainLog10", "pointProgress", "totalVertexProgress", "lastVertexIndex",
  "generationCount", "previousGenerationScore", "previousGenerationScoreLog10",
  "generationScoreMultiplier", "generationScoreMultiplierLog10", "generationCostFactor",
  "coreBoostCount", "infinityCount", "infinityPoints", "infinityPointsLog10",
  "infiniteScore", "infiniteScoreLog10", "infinityUpgradeMask", "ipGainUpgradeLevel",
  "infiniteAngleUpgradeLevel", "softcapUpgradeLevel", "activeChallenge", "completedChallenges",
  "infiniteCapBroken", "achievementMask", "totalPlayTime", "currentInfinityRunTime",
  "fastestInfinityTime", "lastInfinityRuns", "automationEnabled", "autoBuySpeed",
  "autoBuyVertex", "autoBuyGain", "autoCompleteChallenges", "ic8VertexDecayElapsed",
  "noGenerationCoreBoostReached", "showFloatingText", "lightEffects", "showFps",
  "language", "numberFormat", "timeUnit", "lastEarned", "lastEarnedLog10",
]);

function cloneStateDefault(value) {
  return Array.isArray(value) ? [] : value;
}

function applyStateSchema() {
  Object.entries(STATE_DEFAULTS).forEach(([key, value]) => {
    if (!Object.prototype.hasOwnProperty.call(state, key)) state[key] = cloneStateDefault(value);
  });
  SAVE_FIELDS.splice(0, SAVE_FIELDS.length, ...SAVE_FIELD_DEFINITIONS);
}
