(() => {
  const IU5_7_VERSION = "0.1.0-iu5-7";
  const IU6_2_COST_FACTOR_FLOOR = 0.70;
  const IU7_2_SOFTCAP_START = 50;

  INFINITY_UPGRADES.push(
    {
      id: "5-1",
      bit: 6,
      cost: 10,
      requires: ["4-1"],
      name: { ja: "5-1 スタートダッシュ", en: "5-1 Starting Dash" },
      effect: { ja: "ラップスピードが×3される", en: "Multiplies lap speed by 3." },
    },
    {
      id: "5-2",
      bit: 7,
      cost: 10,
      requires: ["4-1"],
      name: { ja: "5-2 親が地主", en: "5-2 Landlord Parents" },
      effect: {
        ja: "GR、CB、Infinity、IC開始・中止のリセット後、スコア100で開始する",
        en: "Start reset runs from 100 score after GR, CB, Infinity, or starting/stopping an IC.",
      },
    },
    {
      id: "6-1",
      bit: 8,
      cost: 50,
      requires: ["5-1", "5-2"],
      name: { ja: "6-1 ほんのりした甘味", en: "6-1 A Hint of Sweetness" },
      effect: { ja: "GRスコア倍率がさらに^1.2される", en: "Raises the GR score multiplier to a further power of 1.2." },
    },
    {
      id: "6-2",
      bit: 9,
      cost: 50,
      requires: ["5-1", "5-2"],
      name: { ja: "6-2 澄んだ視界", en: "6-2 Clear View" },
      effect: { ja: "GRコスト倍率の下限が×0.70になる", en: "Lowers the GR cost-factor floor to x0.70." },
    },
    {
      id: "7-1",
      bit: 10,
      cost: 150,
      requires: ["6-1", "6-2"],
      name: { ja: "7-1 権力の集中", en: "7-1 Concentration of Power" },
      effect: { ja: "CB由来の頂点獲得量増加分が2倍になる", en: "Doubles the Core Boost contribution to gain per vertex." },
    },
    {
      id: "7-2",
      bit: 11,
      cost: 150,
      requires: ["6-1", "6-2"],
      name: { ja: "7-2 庶民の幸せ", en: "7-2 Common Happiness" },
      effect: { ja: "Infinity回数に応じて通常強化コストが指数的に下がる", en: "Lowers normal-upgrade costs exponentially with Infinity count." },
    },
  );

  const baseApplySaveData = applySaveData;
  const baseRawLapSpeedLog10 = rawLapSpeedLog10;
  const baseCoreBoostGainIncreaseMultiplier = coreBoostGainIncreaseMultiplier;
  const baseGenerationScorePower = generationScorePower;
  const baseCostLog10 = costLog10;
  const baseRunGeneration = runGeneration;
  const baseRunCoreBoost = runCoreBoost;
  const baseRunInfinity = runInfinity;
  const baseToggleInfinityChallenge = toggleInfinityChallenge;

  function iu7_2CostExponent() {
    const infinityCount = Math.max(0, state.infinityCount);
    if (infinityCount <= IU7_2_SOFTCAP_START) return 1 - infinityCount * 0.002;
    return 0.8 + 0.1 * Math.exp(-0.005 * (infinityCount - IU7_2_SOFTCAP_START));
  }

  function applyResetStartingScore() {
    if (!hasInfinityUpgrade("5-2")) return;
    state.score = 100;
    state.scoreLog10 = 2;
  }

  applySaveData = function applySaveDataWithIu6_2(data, saveVersion) {
    baseApplySaveData(data, saveVersion);
    if (!hasInfinityUpgrade("6-2")) return;
    state.generationCostFactor = Math.max(
      IU6_2_COST_FACTOR_FLOOR,
      Math.min(1, sanitizeNumber(data && data.generationCostFactor, 1, IU6_2_COST_FACTOR_FLOOR)),
    );
  };

  rawLapSpeedLog10 = function rawLapSpeedLog10WithIu5_1() {
    const challengePower = state.activeChallenge === 3 ? 0.8 : 1;
    const iu5_1Log = hasInfinityUpgrade("5-1") ? log10Value(3) * challengePower : 0;
    return clampLog10(baseRawLapSpeedLog10() + iu5_1Log);
  };

  coreBoostGainIncreaseMultiplier = function coreBoostGainIncreaseMultiplierWithIu7_1() {
    if (!hasInfinityUpgrade("7-1")) return baseCoreBoostGainIncreaseMultiplier();
    return 1 + state.coreBoostCount;
  };

  generationScorePower = function generationScorePowerWithIu6_1() {
    const basePower = baseGenerationScorePower();
    return hasInfinityUpgrade("6-1") ? basePower * 1.2 : basePower;
  };

  costLog10 = function costLog10WithIu7_2(kind, base, level, growth) {
    const finalCostLog = baseCostLog10(kind, base, level, growth);
    return hasInfinityUpgrade("7-2") ? finalCostLog * iu7_2CostExponent() : finalCostLog;
  };

  runGeneration = function runGenerationWithIu6_2() {
    if (!canRunGeneration()) return;
    const previousCostFactor = state.generationCostFactor;
    const reward = generationRewardForLog(currentGenerationScoreLog10());
    baseRunGeneration();
    if (hasInfinityUpgrade("6-2")) {
      state.generationCostFactor = Math.max(
        IU6_2_COST_FACTOR_FLOOR,
        previousCostFactor * (1 - reward.costReduction),
      );
    }
    applyResetStartingScore();
    updateUi();
    saveGame("manual");
  };

  runCoreBoost = function runCoreBoostWithStartingScore() {
    if (!canCoreBoost()) return;
    baseRunCoreBoost();
    applyResetStartingScore();
    updateUi();
    saveGame("manual");
  };

  runInfinity = function runInfinityWithStartingScore(forced = false) {
    if (!canInfinity() || (!forced && state.infinityCount === 0)) return;
    baseRunInfinity(forced);
    applyResetStartingScore();
    updateUi();
    saveGame("manual");
  };

  toggleInfinityChallenge = function toggleInfinityChallengeWithStartingScore(index = nextChallengeIndex()) {
    if (!infinityChallengesUnlocked()) return;
    const willReset = state.activeChallenge === 0 || state.activeChallenge === index;
    baseToggleInfinityChallenge(index);
    if (!willReset) return;
    applyResetStartingScore();
    updateUi();
    saveGame("manual");
  };

  elements.generationButton.removeEventListener("click", baseRunGeneration);
  elements.generationButton.addEventListener("click", runGeneration);
  elements.coreBoostButton.removeEventListener("click", baseRunCoreBoost);
  elements.coreBoostButton.addEventListener("click", runCoreBoost);

  loadGame();
  createInfinityUpgradeRows();
  updateUi();
  draw();

  Object.assign(window.__angleDebug, {
    iu5_7Version: IU5_7_VERSION,
    iu7_2CostExponent,
    applyResetStartingScore,
    rawLapSpeedLog10,
    coreBoostGainIncreaseMultiplier,
    generationScorePower,
    costLog10,
    runGeneration,
    runCoreBoost,
    runInfinity,
    toggleInfinityChallenge,
  });
})();
