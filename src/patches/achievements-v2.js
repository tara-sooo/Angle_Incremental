import { runtime } from "../runtime/shared.js";

const ACHIEVEMENTS_V2 = [
  {
    title: { ja: "流石に最初よりは早い", en: "Faster Than the Beginning" },
    condition: { ja: "Infinityに10回到達", en: "Reach Infinity 10 times." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.state.infinityCount >= 10,
  },
  {
    title: { ja: "実は3より弱い", en: "Actually Weaker Than 3" },
    condition: { ja: "IC4をクリア", en: "Complete IC4." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.isChallengeCompleted(4),
  },
  {
    title: { ja: "おとなしく寝た方がいい", en: "You Should Just Sleep" },
    condition: { ja: "IC3をクリア", en: "Complete IC3." },
    reward: { ja: "IP獲得量が×2", en: "Infinity Point gain x2." },
    isUnlocked: () => runtime.isChallengeCompleted(3),
  },
  {
    title: { ja: "大雑把", en: "Roughly" },
    condition: { ja: "e314スコアに到達", en: "Reach 1e314 score." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.currentScoreLog10() >= 314,
  },
  {
    title: { ja: "固めのカップ麺", en: "Firm Cup Noodles" },
    condition: { ja: "最速Infinity時間が2分を切る", en: "Get a fastest Infinity time below 2 minutes." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.state.fastestInfinityTime > 0 && runtime.state.fastestInfinityTime < 120,
  },
  {
    title: { ja: "小学生だったら数えきれないね", en: "Too Many for an Elementary Schooler" },
    condition: { ja: "所持IPが100に到達", en: "Hold 100 IP." },
    reward: { ja: "GRのコスト倍率はさらに×0.98される", en: "The GR cost factor is additionally multiplied by 0.98." },
    isUnlocked: () => runtime.currentInfinityPointsLog10() >= 2,
  },
  {
    title: { ja: "昔はこれが最難関でした", en: "This Used to Be the Hardest" },
    condition: { ja: "IC5をクリア", en: "Complete IC5." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.isChallengeCompleted(5),
  },
  {
    title: { ja: "伝説の一代目", en: "Legendary First Generation" },
    condition: { ja: "GR、CBなしでInfinityに到達", en: "Reach Infinity without Generation or Core Boost." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.state.lastInfinityRuns.some((record) => Boolean(record.noGenerationCoreBoost)),
  },
  {
    title: { ja: "寄り添う心", en: "A Heart That Stays Close" },
    condition: { ja: "IU7-1、7-2を購入", en: "Buy IU 7-1 and 7-2." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.hasInfinityUpgrade("7-1") && runtime.hasInfinityUpgrade("7-2"),
  },
  {
    title: { ja: "SDGsよりは簡単な課題", en: "An Easier Goal Than the SDGs" },
    condition: { ja: "ICを8つクリア", en: "Complete all 8 ICs." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.completedChallengeCount() >= 8,
  },
  {
    title: { ja: "大きな壁でも問題なし", en: "No Problem, Even With a Big Wall" },
    condition: { ja: "Break Infinite Capを実行する", en: "Break the Infinite Cap." },
    reward: { ja: "", en: "" },
    isUnlocked: () => runtime.state.infiniteCapBroken,
  },
];

const ACHIEVEMENT_EXTENSION_START = 14;
ACHIEVEMENTS_V2.forEach((achievement, offset) => {
  const index = ACHIEVEMENT_EXTENSION_START + offset;
  if (!runtime.ACHIEVEMENTS[index]) runtime.ACHIEVEMENTS[index] = achievement;
});

Object.defineProperty(runtime, "ACHIEVEMENT_COUNT", {
  configurable: true,
  enumerable: true,
  get: () => runtime.ACHIEVEMENTS.length,
});

runtime.achievementCount = () => runtime.ACHIEVEMENTS.reduce(
  (count, _, index) => count + (runtime.isAchievementUnlocked(index + 1) ? 1 : 0),
  0,
);
runtime.achievementGainMultiplier = () => Math.pow(1.01, runtime.achievementCount());
runtime.TEXT.ja.achievementRewardText = "達成ごとにスコア獲得量 ×1.01";
runtime.TEXT.en.achievementRewardText = "Each achievement multiplies score gain by 1.01";

runtime.vertexGainIncrease = function achievementVertexGainIncrease() {
  const infinityResetBoost = runtime.hasInfinityUpgrade("1-1")
    ? runtime.applyInfinityUpgradePower(runtime.state.infinityCount + 1)
    : 1;
  let gain = (0.01 + runtime.state.gainLevel * 0.01)
    * runtime.coreBoostGainIncreaseMultiplier()
    * runtime.infiniteAngleBoost()
    * infinityResetBoost;
  if (runtime.state.activeChallenge === 6) return 0.001;
  if (runtime.state.activeChallenge === 4) gain = Math.pow(gain, 0.5);
  if (runtime.isChallengeCompleted(4)) gain = Math.pow(gain, 1.1);
  return gain;
};

runtime.finalScoreGainFromBaseLog10 = function achievementFinalScoreGainFromBaseLog10(baseLog) {
  const angleLog = runtime.angleExpressionFromBaseLog10(baseLog) * runtime.coreBoostGainExponent();
  const boostedLog = angleLog + runtime.generationScoreMultiplierEffectLog10();
  return boostedLog * runtime.finalScoreGainPower()
    - runtime.log10Value(runtime.finalScoreGainDivisor())
    + Math.log10(runtime.achievementGainMultiplier());
};

runtime.finalScoreGainLog10 = function achievementFinalScoreGainLog10(baseGain = runtime.state.currentGain) {
  const baseLog = baseGain === runtime.state.currentGain
    ? runtime.currentGainLog10()
    : runtime.log10Value(Math.max(baseGain, 0));
  return runtime.finalScoreGainFromBaseLog10(baseLog);
};

runtime.finalScoreGain = function achievementFinalScoreGain(baseGain = runtime.state.currentGain) {
  const gainLog = runtime.finalScoreGainLog10(baseGain);
  return gainLog <= 308 ? 10 ** gainLog : Infinity;
};

runtime.sumCoreHitGains = function achievementSumCoreHitGains(firstCoreStep, coreHits, increase) {
  const stride = runtime.state.vertices;
  if (coreHits > runtime.MAX_EXACT_CORE_HITS) {
    let earned = 0;
    const segmentSize = coreHits / runtime.CORE_HIT_APPROX_SEGMENTS;
    for (let segment = 0; segment < runtime.CORE_HIT_APPROX_SEGMENTS; segment += 1) {
      const midHit = (segment + 0.5) * segmentSize;
      const stepAtMid = firstCoreStep + midHit * stride;
      const gainLog = runtime.gainAfterIncreaseLog10(increase, stepAtMid);
      earned += runtime.valueFromLog10(runtime.finalScoreGainFromBaseLog10(gainLog)) * segmentSize;
    }
    return earned;
  }

  let earned = 0;
  for (let hit = 0; hit < coreHits; hit += 1) {
    const gainLog = runtime.gainAfterIncreaseLog10(increase, firstCoreStep + hit * stride);
    earned += runtime.valueFromLog10(runtime.finalScoreGainFromBaseLog10(gainLog));
  }
  return earned;
};

runtime.passVertex = function achievementPassVertex(index) {
  runtime.addCurrentGain(runtime.vertexGainIncrease());
  if (!runtime.isCoreVertex(index)) return false;

  const gainLog = runtime.finalScoreGainLog10();
  const resetByInfinity = runtime.addScore(runtime.valueFromLog10(gainLog), gainLog);
  if (resetByInfinity) return true;
  if (runtime.state.showFloatingText && !runtime.state.lightEffects) {
    runtime.state.floatingTexts.push({
      text: `+${runtime.formatUiLogNumber(gainLog)}`,
      life: 1,
      x: runtime.canvas.width / 2,
      y: runtime.canvas.height * 0.16,
    });
  }
  return false;
};

runtime.processManyVertices = function achievementProcessManyVertices(start, end) {
  const count = end - start + 1;
  if (count <= 0) return false;

  const increase = runtime.vertexGainIncrease();
  const coreBatches = runtime.coreVertexIndices()
    .map((coreIndex) => {
      const coreOffset = ((coreIndex - (start % runtime.state.vertices)) + runtime.state.vertices) % runtime.state.vertices;
      const coreHits = coreOffset >= count ? 0 : Math.floor((count - 1 - coreOffset) / runtime.state.vertices) + 1;
      return { coreHits, firstCoreStep: coreOffset + 1 };
    })
    .filter((batch) => batch.coreHits > 0);
  const coreHits = coreBatches.reduce((total, batch) => total + batch.coreHits, 0);

  if (coreHits > 0) {
    let earned = 0;
    let lastCoreStep = 0;
    coreBatches.forEach((batch) => {
      earned += runtime.sumCoreHitGains(batch.firstCoreStep, batch.coreHits, increase);
      lastCoreStep = Math.max(lastCoreStep, batch.firstCoreStep + (batch.coreHits - 1) * runtime.state.vertices);
    });
    const batchLog = runtime.log10Value(Math.max(coreHits, 1))
      + runtime.finalScoreGainFromBaseLog10(runtime.gainAfterIncreaseLog10(increase, lastCoreStep));
    const earnedLog = Number.isFinite(earned) ? runtime.log10Value(earned) : batchLog;
    const resetByInfinity = runtime.addScore(earned, earnedLog);
    if (resetByInfinity) return true;
    if (runtime.state.showFloatingText && !runtime.state.lightEffects) {
      runtime.state.floatingTexts.push({
        text: `+${runtime.formatUiLogNumber(earnedLog)}`,
        life: 1,
        x: runtime.canvas.width / 2,
        y: runtime.canvas.height * 0.16,
      });
    }
  }

  runtime.addCurrentGain(increase * count);
  return false;
};

const baseGenerationCostFactorEffect = runtime.generationCostFactorEffect;
runtime.generationCostFactorEffect = () => baseGenerationCostFactorEffect()
  * (runtime.isAchievementUnlocked(20) ? 0.98 : 1);

const baseNextGenerationValues = runtime.nextGenerationValues;
runtime.nextGenerationValues = () => {
  const values = baseNextGenerationValues();
  return {
    ...values,
    costFactor: values.costFactor * (runtime.isAchievementUnlocked(20) ? 0.98 : 1),
  };
};

const baseInfinityPointGain = runtime.infinityPointGain;
runtime.infinityPointGain = () => baseInfinityPointGain()
  * (runtime.isAchievementUnlocked(17) ? 2 : 1);

runtime.runInfinity = function achievementRunInfinity(forced = false) {
  if (!runtime.canInfinity()) return;
  if (!forced && runtime.state.infinityCount === 0) return;

  const scoreLogBeforeReset = runtime.currentScoreLog10();
  const completedChallenge = runtime.state.activeChallenge;
  const noGenerationOrCoreBoost = runtime.state.generationCount === 0 && runtime.state.coreBoostCount === 0;
  if (completedChallenge > 0) {
    runtime.state.completedChallenges |= 1 << (completedChallenge - 1);
    runtime.state.activeChallenge = 0;
    runtime.checkAchievements(true);
  }

  const gained = runtime.infinityPointGain();
  runtime.state.infinityCount += runtime.infinityCountGain();
  runtime.addInfinityPoints(gained);
  runtime.recordInfinityRun(scoreLogBeforeReset, gained, completedChallenge);
  if (noGenerationOrCoreBoost && runtime.state.lastInfinityRuns[0]) {
    runtime.state.lastInfinityRuns[0].noGenerationCoreBoost = true;
  }
  runtime.checkAchievements(true);
  runtime.resetBelowInfinity();
  runtime.state.currentInfinityRunTime = 0;
  runtime.updateUi();
  runtime.saveGame("manual");
};

runtime.completeChallengeIfReady = () => {
  if (!runtime.state.autoCompleteChallenges || runtime.state.activeChallenge <= 0 || !runtime.canInfinity()) return false;
  runtime.runInfinity(false);
  return true;
};

if (window.__angleDebug) {
  window.__angleDebug.runInfinity = runtime.runInfinity;
  window.__angleDebug.completeChallengeIfReady = runtime.completeChallengeIfReady;
}

const unlockedOnUpgrade = runtime.checkAchievements(true);
runtime.createAchievementRows();
runtime.updateUi();
if (unlockedOnUpgrade.length > 0) runtime.saveGame("manual");
