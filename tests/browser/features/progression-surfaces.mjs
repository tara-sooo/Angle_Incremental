import assert from "node:assert/strict";

export async function runProgressionGain({ page }) {
  const infinityGainSurface = await page.evaluate(() => {
    const { state, runtime } = window.__angleDebug;
    const originalState = structuredClone(state);
    const originalTab = runtime.activeMainTab;
    const originalGain = runtime.infinityPointGain;
    const originalGainLog10 = runtime.infinityPointGainLog10;
    const gains = [400, 1000].map((log10) => {
      state.infinityCount = 1;
      runtime.infinityPointGain = () => Number.MAX_VALUE;
      runtime.infinityPointGainLog10 = () => log10;
      runtime.updateUi();
      const debug = JSON.parse(window.render_game_to_text()).infinity;
      return {
        summary: document.querySelector("#infinityPointGain")?.textContent?.trim() ?? "",
        pointGain: debug.pointGain,
        pointGainLog10: debug.pointGainLog10,
      };
    });
    state.lastInfinityRuns = [{ time: 1, realTime: 1, scoreLog10: 400, ipGain: Number.MAX_VALUE, ipGainLog10: 1000, challenge: 0 }];
    window.__angleDebug.switchMainTab("statistics");
    runtime.updateUi();
    const history = document.querySelector("#lastInfinityRuns")?.textContent?.trim() ?? "";
    const copy = {};
    for (const language of ["ja", "en"]) {
      state.language = language;
      runtime.updateUi();
      copy[language] = {
        gainLabel: document.querySelector('[data-i18n="infinityGain"]')?.textContent?.trim() ?? "",
        angleBuyAll: document.querySelector("#buyAllUpgrade")?.textContent?.trim() ?? "",
        iaBuyAll: document.querySelector("#infiniteAngleBuyAllUpgrade")?.textContent?.trim() ?? "",
        angleHelper: Boolean(document.querySelector("#buyAllUpgrade small")),
      };
    }
    runtime.infinityPointGain = originalGain;
    runtime.infinityPointGainLog10 = originalGainLog10;
    Object.assign(state, originalState);
    window.__angleDebug.switchMainTab(originalTab);
    runtime.updateUi();
    return { gains, history, copy };
  });
  assert.deepEqual(
    infinityGainSurface.gains.map((gain) => gain.summary),
    ["+1.00e400 IP", "+1.00e1,000 IP"],
    "Infinity summary should display e400/e1000 gains from log space",
  );
  assert.deepEqual(
    infinityGainSurface.gains.map((gain) => gain.pointGain),
    ["1.00e400", "1.00e1,000"],
    "render_game_to_text should expose non-capped overflowing gains",
  );
  assert.deepEqual(
    infinityGainSurface.gains.map((gain) => gain.pointGainLog10),
    [400, 1000],
    "render_game_to_text should expose raw Infinity gain logs",
  );
  assert.match(infinityGainSurface.history, /1\.00e1,000 IP/, "Statistics history should display the overflowing gain log");
  assert.deepEqual(infinityGainSurface.copy.ja, {
    gainLabel: "Infinity Point獲得",
    angleBuyAll: "全購入",
    iaBuyAll: "全購入",
    angleHelper: false,
  }, "Japanese Infinity Point and Buy All copy should be concise");
  assert.deepEqual(infinityGainSurface.copy.en, {
    gainLabel: "Infinity Point gain",
    angleBuyAll: "Buy All",
    iaBuyAll: "Buy All",
    angleHelper: false,
  }, "English Infinity Point and Buy All copy should be concise");
}
export async function runProgressionCore({ page }) {
  const achievementUi = await page.evaluate(() => {
    const { state, switchMainTab } = window.__angleDebug;
    switchMainTab("achievements");
    state.achievementMask = 0x7fffffff;
    state.achievementMaskHigh = 0b1111111111;
    state.language = "ja";
    window.advanceTime(0);
    const rows = Array.from(document.querySelectorAll(".achievement-row"));
    const japanese = rows.slice(31).map((row) => ({
      title: row.querySelector(".achievement-title")?.textContent?.trim() ?? "",
      condition: row.querySelector(".achievement-condition")?.textContent?.trim() ?? "",
      rewardHidden: row.querySelector(".achievement-reward")?.hidden ?? false,
    }));
    const japaneseSummary = document.querySelector("#achievementSummary")?.textContent?.trim() ?? "";
    state.language = "en";
    window.advanceTime(0);
    const english = rows.slice(31).map((row) => ({
      title: row.querySelector(".achievement-title")?.textContent?.trim() ?? "",
      condition: row.querySelector(".achievement-condition")?.textContent?.trim() ?? "",
    }));
    const englishSummary = document.querySelector("#achievementSummary")?.textContent?.trim() ?? "";
    state.language = "ja";
    window.advanceTime(0);
    return {
      panelActive: document.querySelector('[data-panel="achievements"]')?.classList.contains("is-active") ?? false,
      count: rows.length,
      japaneseSummary,
      englishSummary,
      japanese,
      english,
      listWidth: document.querySelector("#achievementList")?.getBoundingClientRect().width ?? 0,
    };
  });
  assert.equal(achievementUi.panelActive, true, "the Achievements panel should activate on desktop");
  assert.equal(achievementUi.count, 44, "the desktop Achievements panel should render 44 rows");
  assert.equal(achievementUi.japaneseSummary, "41/44 実績", "the desktop Japanese Achievements summary should show 41 of 44 achievements");
  assert.equal(achievementUi.englishSummary, "41/44 Achievements", "the desktop English Achievements summary should show 41 of 44 achievements");
  assert.deepEqual(achievementUi.japanese, [
    { title: "不吉だという前提は置いておいて", condition: "所持IPがe44に到達", rewardHidden: true },
    { title: "バベルも土台から", condition: "Towerを建設", rewardHidden: true },
    { title: "あれをチャレンジだと呼ぶべきではない", condition: "TC1をクリア", rewardHidden: true },
    { title: "道しるべを残す", condition: "スコアがe2450を超える", rewardHidden: true },
    { title: "ちょっぴり豪邸", condition: "Towerの階層が3に到達", rewardHidden: true },
    { title: "物騒な名前", condition: "TC2をクリア", rewardHidden: true },
    { title: "無限万長者", condition: "Infinity数が1.5e6を超える", rewardHidden: false },
    { title: "とうに越した先に", condition: "TC3をクリア", rewardHidden: true },
    { title: "挑戦権、そして時空の片道切符", condition: "TC4をクリア", rewardHidden: true },
    { title: "Time is generative", condition: "初回Eternityを実行", rewardHidden: true },
    { title: "初回はこれがおすすめ", condition: "Eternity Milestone 1-2を取得", rewardHidden: true },
    { title: "現実主義", condition: "Timeline-Realを購入", rewardHidden: true },
    { title: "1+多元のそれぞれの宇宙", condition: "Timeline-Parallelを購入", rewardHidden: true },
  ], "the desktop Japanese achievement definitions should be exact");
  assert.deepEqual(achievementUi.english, [
    { title: "Assuming It Is Unlucky", condition: "Hold at least 1e44 IP." },
    { title: "Babel Starts from the Foundation", condition: "Build the Tower." },
    { title: "We Should Not Call That a Challenge", condition: "Complete TC1." },
    { title: "Leave a Signpost", condition: "Reach more than 1e2450 score." },
    { title: "A Slightly Luxurious Mansion", condition: "Reach Tower Floor 3." },
    { title: "A Violent-Sounding Name", condition: "Complete TC2." },
    { title: "Infinity Millionaire", condition: "Have more than 1.5e6 Infinity." },
    { title: "Far Beyond", condition: "Complete TC3." },
    { title: "The Right to Challenge, and a One-Way Ticket Through Spacetime", condition: "Complete TC4." },
    { title: "Time is generative", condition: "Perform Eternity for the first time." },
    { title: "Recommended for Your First Eternity", condition: "Obtain Eternity Milestone 1-2." },
    { title: "Realist", condition: "Purchase Timeline-Real." },
    { title: "The Respective Universes of 1+Many", condition: "Purchase Timeline-Parallel." },
  ], "the desktop English achievement definitions should be exact");
  assert.ok(achievementUi.listWidth > 0, "the desktop achievement list should have a visible layout");
  const desktopUiChanges = await page.evaluate(() => {
    const { state, runtime, switchMainTab, switchInfinitySubtab, switchStatisticsSubtab } = window.__angleDebug;
    switchMainTab("infinity");
    switchInfinitySubtab("upgrades");
    state.fastestInfinityChallengeTimes = [12.5, 0, 0, 0, 0, 0, 0, 0];
    state.fastestTowerChallengeTimes = [27, 0, 0, 14];
    window.advanceTime(0);
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect();
    const centerDelta = (tierSelector) => {
      const tier = rect(tierSelector);
      const node = rect(`${tierSelector} .infinity-upgrade-node`);
      if (!tier || !node) return null;
      return Math.abs((tier.left + tier.width / 2) - (node.left + node.width / 2));
    };
    const tier12CenterDelta = centerDelta('[data-infinity-panel="upgrades"] [data-tier="12"]');
    const tier13CenterDelta = centerDelta('[data-infinity-panel="upgrades"] [data-tier="13"]');
    const tier14CenterDelta = centerDelta('[data-infinity-panel="upgrades"] [data-tier="14"]');
    const infinityUpgradeNodes = Array.from(document.querySelectorAll('[data-infinity-panel="upgrades"] .infinity-upgrade-node'));
    document.querySelector('[data-infinity-panel="upgrades"] [data-upgrade="14-1"]')?.click();
    window.advanceTime(0);
    switchMainTab("statistics");
    const originalEternityStats = {
      currentEternityRunTime: state.currentEternityRunTime,
      currentEternityRealTime: state.currentEternityRealTime,
      fastestEternityTime: state.fastestEternityTime,
      fastestEternityRealTime: state.fastestEternityRealTime,
      lastEternityRuns: state.lastEternityRuns,
    };
    state.currentEternityRunTime = 12;
    state.currentEternityRealTime = 9;
    state.fastestEternityTime = 8;
    state.fastestEternityRealTime = 7;
    state.lastEternityRuns = [{ time: 12, realTime: 9, infinityCount: 3 }];
    switchStatisticsSubtab("eternity");
    runtime.updateUi();
    const eternityPanelActive = document.querySelector('[data-statistics-panel="eternity"]')?.classList.contains("is-active") ?? false;
    const eternityFirst = document.querySelector("#lastEternityRuns li")?.textContent?.trim() ?? "";
    const eternityLabels = {
      current: document.querySelector('[data-i18n="currentEternityRun"]')?.textContent?.trim() ?? "",
      fastest: document.querySelector('[data-i18n="fastestEternity"]')?.textContent?.trim() ?? "",
    };
    Object.assign(state, originalEternityStats);
    runtime.updateUi();
    switchStatisticsSubtab("challenges");
    window.advanceTime(0);
    return {
      statisticsPanelActive: document.querySelector('[data-statistics-panel="challenges"]')?.classList.contains("is-active") ?? false,
      overviewPanelActive: document.querySelector('[data-statistics-panel="overview"]')?.classList.contains("is-active") ?? false,
      infinityRows: document.querySelectorAll("#fastestInfinityChallengeTimes li").length,
      towerRows: document.querySelectorAll("#fastestTowerChallengeTimes li").length,
      infinityFirst: document.querySelector("#fastestInfinityChallengeTimes li")?.textContent?.trim() ?? "",
      towerFirst: document.querySelector("#fastestTowerChallengeTimes li")?.textContent?.trim() ?? "",
      towerFourth: document.querySelector("#fastestTowerChallengeTimes li:nth-child(4)")?.textContent?.trim() ?? "",
      eternityPanelActive,
      eternityFirst,
      eternityLabels,
      tier12CenterDelta,
      tier13CenterDelta,
      tier14CenterDelta,
      tier14Name: document.querySelector("#infinityUpgradeDetailName")?.textContent?.trim() ?? "",
      tier14Effect: document.querySelector("#infinityUpgradeDetailEffect")?.textContent?.trim() ?? "",
      tier14Requires: document.querySelector("#infinityUpgradeDetailRequires")?.textContent?.trim() ?? "",
      tier14Cost: document.querySelector("#infinityUpgradeDetailCost")?.textContent?.trim() ?? "",
      infinityUpgradeNodeCount: infinityUpgradeNodes.length,
      infinityUpgradeNodeContract: infinityUpgradeNodes.every((node) => (
        Boolean(node.querySelector(".infinity-upgrade-name")?.textContent?.trim())
        && Boolean(node.querySelector(".infinity-upgrade-cost")?.textContent?.trim())
        && Boolean(node.querySelector(".infinity-upgrade-state")?.textContent?.trim())
        && !node.querySelector(".infinity-upgrade-effect")
      )),
      infinityUpgradeNodeHeights: infinityUpgradeNodes.map((node) => node.getBoundingClientRect().height),
    };
  });
  assert.equal(desktopUiChanges.statisticsPanelActive, true, "Statistics challenge records subtab should activate");
  assert.equal(desktopUiChanges.overviewPanelActive, false, "Statistics overview should deactivate when records are selected");
  assert.equal(desktopUiChanges.infinityRows, 8, "all Infinity Challenges should have statistics rows");
  assert.equal(desktopUiChanges.towerRows, 4, "all Tower Challenges should have statistics rows");
  assert.match(desktopUiChanges.infinityFirst, /IC1.*12秒/);
  assert.match(desktopUiChanges.towerFirst, /TC1.*27秒/);
  assert.match(desktopUiChanges.towerFourth, /^TC4 既存品の代替:/, "Japanese Statistics should use the canonical TC4 title");
  assert.equal(desktopUiChanges.eternityPanelActive, true, "Statistics Eternity Records subtab should activate");
  assert.match(desktopUiChanges.eternityLabels.current, /現在のEternity周回/);
  assert.match(desktopUiChanges.eternityLabels.fastest, /最速Eternity/);
  assert.match(desktopUiChanges.eternityFirst, /ゲーム時間.*12秒.*実時間.*9秒.*Infinity回数.*3/);
  const englishEternityStatistics = await page.evaluate(() => {
    const { state, runtime, switchMainTab, switchStatisticsSubtab } = window.__angleDebug;
    const originalLanguage = state.language;
    state.language = "en";
    switchMainTab("statistics");
    switchStatisticsSubtab("eternity");
    runtime.updateUi();
    const result = {
      tab: document.querySelector('[data-i18n="statisticsEternityRecords"]')?.textContent?.trim() ?? "",
      current: document.querySelector('[data-i18n="currentEternityRun"]')?.textContent?.trim() ?? "",
      history: document.querySelector('[data-i18n="lastEternityRunsLabel"]')?.textContent?.trim() ?? "",
    };
    switchStatisticsSubtab("challenges");
    runtime.updateUi();
    result.towerFourth = document.querySelector("#fastestTowerChallengeTimes li:nth-child(4)")?.textContent?.trim() ?? "";
    state.language = originalLanguage;
    runtime.updateUi();
    return result;
  });
  assert.equal(englishEternityStatistics.tab, "Eternity Records", "the ETR Statistics tab should translate to English");
  assert.equal(englishEternityStatistics.current, "Current Eternity run (game time)", "the ETR game-time label should translate to English");
  assert.equal(englishEternityStatistics.history, "Last 10 Eternity runs", "the ETR history label should translate to English");
  assert.match(englishEternityStatistics.towerFourth, /^TC4 Substitute for Existing Products:/, "English Statistics should use the canonical TC4 title");
  assert.ok(desktopUiChanges.tier12CenterDelta !== null && desktopUiChanges.tier12CenterDelta < 1, "IU 12-1 should be centered");
  assert.ok(desktopUiChanges.tier13CenterDelta !== null && desktopUiChanges.tier13CenterDelta < 1, "IU 13-1 should be centered");
  assert.ok(desktopUiChanges.tier14CenterDelta !== null && desktopUiChanges.tier14CenterDelta < 1, "IU 14-1 should be centered");
  assert.equal(desktopUiChanges.tier14Name, "14-1 ペナルティは遅れてやってくる", "IU 14-1 should render its Japanese name");
  assert.equal(desktopUiChanges.tier14Effect, "IU11-2のハードキャップを×3遅らせる", "IU 14-1 should render its Japanese effect");
  assert.match(desktopUiChanges.tier14Requires, /13-1/, "IU 14-1 should render its prerequisite");
  assert.match(desktopUiChanges.tier14Cost, /e80/, "IU 14-1 should render its 1e80 cost");
  assert.equal(desktopUiChanges.infinityUpgradeNodeCount, 21, "desktop IU should render every upgrade node");
  assert.equal(desktopUiChanges.infinityUpgradeNodeContract, true, "desktop IU nodes should keep name, cost, and state in the node");
  assert.ok(desktopUiChanges.infinityUpgradeNodeHeights.every((height) => height <= 50), "desktop IU nodes should stay compact");
  const infinityUpgradeInteraction = await page.evaluate(async () => {
    const { state, runtime, switchMainTab, switchInfinitySubtab } = window.__angleDebug;
    const original = {
      autoBuyInfinityUpgrades: state.autoBuyInfinityUpgrades,
      automationEnabled: state.automationEnabled,
      eternityCount: state.eternityCount,
      infinityCount: state.infinityCount,
      infinityPoints: state.infinityPoints,
      infinityPointsExact: state.infinityPointsExact,
      infinityPointsLog10: state.infinityPointsLog10,
      infinityUpgradeMask: state.infinityUpgradeMask,
      selectedInfinityUpgradeId: runtime.selectedInfinityUpgradeId,
    };
    const nodeFor = (id) => document.querySelector(
      '[data-infinity-panel="upgrades"] [data-upgrade="' + id + '"]',
    );
    const setIp = (value) => runtime.syncInfinityPointCachesFromExact(BigInt(value));
    const pointerActivate = (id, pointerType = "mouse") => {
      const node = nodeFor(id);
      if (!node) return;
      node.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true,
        pointerType,
        button: 0,
      }));
      node.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
      window.advanceTime(0);
    };
    const doubleActivate = (id, pointerType = "mouse") => {
      pointerActivate(id, pointerType);
      pointerActivate(id, pointerType);
    };

    state.autoBuyInfinityUpgrades = false;
    state.automationEnabled = false;
    state.eternityCount = 0;
    state.infinityCount = 1;
    state.infinityUpgradeMask = 0;
    switchMainTab("infinity");
    switchInfinitySubtab("upgrades");
    setIp(1);
    runtime.selectedInfinityUpgradeId = "1-2";
    runtime.updateUi();
    nodeFor("1-1")?.click();
    const singleClick = {
      selected: runtime.selectedInfinityUpgradeId,
      mask: state.infinityUpgradeMask,
    };

    await new Promise((resolve) => setTimeout(resolve, 500));
    runtime.selectedInfinityUpgradeId = "1-2";
    setIp(1);
    runtime.updateUi();
    pointerActivate("1-1", "mouse");
    nodeFor("1-1")?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const nativeDblclickIgnored = {
      selected: runtime.selectedInfinityUpgradeId,
      mask: state.infinityUpgradeMask,
      points: state.infinityPointsExact,
    };
    pointerActivate("1-1", "mouse");
    const directPurchase = {
      selected: runtime.selectedInfinityUpgradeId,
      mask: state.infinityUpgradeMask,
      points: state.infinityPointsExact,
    };

    state.infinityUpgradeMask = 0;
    setIp(1);
    runtime.selectedInfinityUpgradeId = "1-1";
    runtime.updateUi();
    doubleActivate("1-2", "touch");
    const touchDirectPurchase = {
      selected: runtime.selectedInfinityUpgradeId,
      mask: state.infinityUpgradeMask,
      points: state.infinityPointsExact,
    };

    state.infinityUpgradeMask = 0;
    setIp(2);
    runtime.selectedInfinityUpgradeId = "1-1";
    runtime.updateUi();
    pointerActivate("1-1", "touch");
    pointerActivate("1-2", "touch");
    const crossNode = {
      selected: runtime.selectedInfinityUpgradeId,
      mask: state.infinityUpgradeMask,
      points: state.infinityPointsExact,
    };

    state.infinityUpgradeMask = 1;
    setIp(1);
    runtime.selectedInfinityUpgradeId = "2-1";
    runtime.updateUi();
    doubleActivate("2-1");
    const prerequisiteBlocked = state.infinityUpgradeMask;

    state.infinityUpgradeMask = 1;
    setIp(0);
    runtime.selectedInfinityUpgradeId = "1-1";
    runtime.updateUi();
    doubleActivate("1-2");
    const unaffordable = state.infinityUpgradeMask;

    state.infinityUpgradeMask = 1;
    setIp(1);
    runtime.selectedInfinityUpgradeId = "1-2";
    runtime.updateUi();
    doubleActivate("1-1");
    const purchasedNoop = {
      mask: state.infinityUpgradeMask,
      points: state.infinityPointsExact,
    };

    state.infinityUpgradeMask = 1;
    setIp(1);
    runtime.selectedInfinityUpgradeId = "1-1";
    runtime.updateUi();
    nodeFor("1-2")?.click();
    window.advanceTime(0);
    runtime.elements.infinityUpgradeDetailBuy.click();
    window.advanceTime(0);
    const detailPanelPurchase = {
      selected: runtime.selectedInfinityUpgradeId,
      mask: state.infinityUpgradeMask,
      points: state.infinityPointsExact,
    };

    state.infinityUpgradeMask = 0;
    setIp(2);
    state.eternityCount = 20;
    runtime.updateUi();
    const autobuyCount = runtime.buyAllInfinityUpgrades({ refresh: false, save: false });
    const autobuy = {
      count: autobuyCount,
      mask: state.infinityUpgradeMask,
      points: state.infinityPointsExact,
    };

    Object.assign(state, original);
    runtime.selectedInfinityUpgradeId = original.selectedInfinityUpgradeId;
    runtime.updateUi();
    return {
      singleClick,
      directPurchase,
      nativeDblclickIgnored,
      touchDirectPurchase,
      crossNode,
      prerequisiteBlocked,
      unaffordable,
      purchasedNoop,
      detailPanelPurchase,
      autobuy,
    };
  });
  assert.deepEqual(
    infinityUpgradeInteraction.singleClick,
    { selected: "1-1", mask: 0 },
    "single-clicking an IU should only select it",
  );
  assert.deepEqual(
    infinityUpgradeInteraction.directPurchase,
    { selected: "1-1", mask: 1, points: "0" },
    "mouse double activation should select and purchase the exact clicked IU",
  );
  assert.deepEqual(
    infinityUpgradeInteraction.nativeDblclickIgnored,
    { selected: "1-1", mask: 0, points: "1" },
    "native dblclick must not purchase in addition to the pointer activation path",
  );
  assert.deepEqual(
    infinityUpgradeInteraction.touchDirectPurchase,
    { selected: "1-2", mask: 2, points: "0" },
    "touch double activation should purchase the exact tapped IU",
  );
  assert.deepEqual(
    infinityUpgradeInteraction.crossNode,
    { selected: "1-2", mask: 0, points: "2" },
    "rapid activations on different IUs must not form a double activation",
  );
  assert.equal(infinityUpgradeInteraction.prerequisiteBlocked, 1, "double activation should keep prerequisite-blocked IUs unpurchased");
  assert.equal(infinityUpgradeInteraction.unaffordable, 1, "double activation should keep unaffordable IUs unpurchased");
  assert.deepEqual(
    infinityUpgradeInteraction.purchasedNoop,
    { mask: 1, points: "1" },
    "double activation on a purchased IU should have no effect",
  );
  assert.deepEqual(
    infinityUpgradeInteraction.detailPanelPurchase,
    { selected: "1-2", mask: 3, points: "0" },
    "the detail-panel IU purchase button should remain functional",
  );
  assert.deepEqual(
    infinityUpgradeInteraction.autobuy,
    { count: 2, mask: 3, points: "0" },
    "Infinity Upgrade autobuy should remain unchanged",
  );
  const towerInitial = await page.evaluate(() => {
    const { state, switchMainTab, switchInfinitySubtab, switchChallengeSubtab } = window.__angleDebug;
    state.towerFloor = 0;
    state.infinityPointsExact = "0";
    state.infinityPoints = 0;
    state.infinityPointsLog10 = -Infinity;
    switchMainTab("infinity");
    switchInfinitySubtab("tower");
    window.advanceTime(0);
    const towerPanel = document.querySelector('[data-infinity-panel="tower"]');
    const towerState = {
      panelActive: Boolean(towerPanel?.classList.contains("is-active")),
      floor: document.querySelector("#towerFloorValue")?.textContent?.trim() ?? "",
      cost: document.querySelector("#towerNextCost")?.textContent?.trim() ?? "",
      scoreExponent: document.querySelector("#towerScoreExponentValue")?.textContent?.trim() ?? "",
      coreBoostRawGrowthRow: Boolean(document.querySelector("#coreBoostRequirementGrowthPowerRaw")),
      towerChallenge1BaseRow: Boolean(document.querySelector("#towerChallenge1ScorePowerBase")),
      towerChallenge1BonusRow: Boolean(document.querySelector("#towerChallenge1ScorePowerBonus")),
      towerChallenge1TotalRow: Boolean(document.querySelector("#towerChallenge1ScorePowerTotal")),
      towerChallenge1ScorePower: document.querySelector("#towerChallenge1ScorePower")?.textContent?.trim() ?? "",
      commonInfiniteScore: Boolean(document.querySelector(".infinity-summary #infiniteScore")),
      commonInfiniteAngleBoost: Boolean(document.querySelector(".infinity-summary #infiniteAngleBoost")),
      dedicatedInfiniteScore: Boolean(document.querySelector('[data-infinity-panel="angle"] #infiniteScorePanel')),
      dedicatedInfiniteAngleBoost: Boolean(document.querySelector('[data-infinity-panel="angle"] #infiniteAngleBoostPanel')),
      infinityUnlockNote: document.querySelector("#infinityUnlockNote")?.textContent?.trim() ?? "",
      buildDisabled: Boolean(document.querySelector("#towerBuildButton")?.disabled),
    };
    switchMainTab("challenges");
    switchChallengeSubtab("tc");
    return {
      towerState,
      challengePanelActive: Boolean(document.querySelector('[data-challenge-panel="tc"]')?.classList.contains("is-active")),
      towerChallengeRows: document.querySelectorAll("#towerChallengeList .tower-challenge-row").length,
      towerChallengeStatus: document.querySelector("#towerChallengeStatus")?.textContent?.trim() ?? "",
      towerChallengeReleaseStatus: Boolean(document.querySelector('[data-i18n="towerChallengeReleaseStatus"]')),
      challengeReleaseNote: Boolean(document.querySelector('[data-i18n="challengeReleaseNote"]')),
      towerChallengeButton: document.querySelector("#towerChallengeList .tower-challenge-row button")?.textContent?.trim() ?? "",
      towerChallengeButtonDisabled: Boolean(document.querySelector("#towerChallengeList .tower-challenge-row button")?.disabled),
      towerChallengeRestriction: document.querySelector("#towerChallengeList .tower-challenge-row .challenge-restriction")?.textContent?.trim() ?? "",
      towerChallengeTarget: document.querySelector("#towerChallengeList .tower-challenge-row .challenge-target")?.textContent?.trim() ?? "",
      towerChallenge2Target: document.querySelector('#towerChallengeList [data-tower-challenge="2"] .challenge-target')?.textContent?.trim() ?? "",
      towerChallenge3Name: document.querySelector('#towerChallengeList [data-tower-challenge="3"] .challenge-name')?.textContent?.trim() ?? "",
      towerChallenge4Name: document.querySelector('#towerChallengeList [data-tower-challenge="4"] .challenge-name')?.textContent?.trim() ?? "",
      towerChallenge3Target: document.querySelector('#towerChallengeList [data-tower-challenge="3"] .challenge-target')?.textContent?.trim() ?? "",
      towerChallenge3Restriction: document.querySelector('#towerChallengeList [data-tower-challenge="3"] .challenge-restriction')?.textContent?.trim() ?? "",
      towerChallenge4Target: document.querySelector('#towerChallengeList [data-tower-challenge="4"] .challenge-target')?.textContent?.trim() ?? "",
      towerChallenge4UpgradeControls: document.querySelectorAll('#towerChallengeList [data-tower-challenge="4"] [data-tc4-upgrade]').length,
    };
  });
  assert.equal(towerInitial.towerState.panelActive, true, "Infinity > Tower should activate the Tower panel");
  assert.equal(towerInitial.towerState.floor, "0", "Tower should start at Floor 0");
  assert.match(towerInitial.towerState.cost, /1\.00e50/, "Floor 1 should display an e50 IP cost");
  assert.equal(towerInitial.towerState.buildDisabled, true, "Tower construction should be disabled without IP");
  assert.equal(towerInitial.challengePanelActive, true, "Challenges > TC should activate the TC panel");
  assert.equal(towerInitial.towerChallengeRows, 4, "TC1-TC4 rows should be visible");
  assert.equal(towerInitial.towerChallengeStatus, "0/4 完了", "TC should show its completion summary");
  assert.equal(towerInitial.towerChallengeReleaseStatus, false, "Tower Challenge should not show implementation-status copy");
  assert.equal(towerInitial.challengeReleaseNote, false, "Challenges should not show the non-actionable IC/TC note");
  assert.equal(towerInitial.towerState.coreBoostRawGrowthRow, false, "Core Boost should not show the raw growth row");
  assert.equal(towerInitial.towerState.towerChallenge1BaseRow, false, "Tower should not show the TC1 base decomposition");
  assert.equal(towerInitial.towerState.towerChallenge1BonusRow, false, "Tower should not show the TC1 bonus decomposition");
  assert.equal(towerInitial.towerState.towerChallenge1TotalRow, false, "Tower should not show the TC1 total decomposition");
  assert.equal(towerInitial.towerState.towerChallenge1ScorePower, "^0.300", "Tower should retain the final Infinity Score exponent");
  assert.equal(towerInitial.towerState.commonInfiniteScore, false, "Infinity summary should not duplicate Infinite Score");
  assert.equal(towerInitial.towerState.commonInfiniteAngleBoost, false, "Infinity summary should not duplicate the IA multiplier");
  assert.equal(towerInitial.towerState.dedicatedInfiniteScore, true, "IA should retain its Infinite Score metric");
  assert.equal(towerInitial.towerState.dedicatedInfiniteAngleBoost, true, "IA should retain its multiplier metric");
  assert.match(towerInitial.towerState.infinityUnlockNote, /1\.80e308/);
  assert.equal(towerInitial.towerChallengeButton, "開始", "implemented TC rows should expose the shared start button");
  assert.equal(towerInitial.towerChallengeButtonDisabled, true, "locked TC rows should disable their start button");
  assert.match(towerInitial.towerChallengeRestriction, /通常強化/);
  assert.match(towerInitial.towerChallengeTarget, /1\.00e1,000/);
  assert.match(towerInitial.towerChallenge2Target, /1\.00e3,000/);
  assert.match(towerInitial.towerChallenge3Name, /TC3/);
  assert.equal(towerInitial.towerChallenge4Name, "TC4 既存品の代替", "the Japanese Challenges screen should use the canonical TC4 title");
  assert.match(towerInitial.towerChallenge3Target, /1\.00e5,000/);
  assert.match(towerInitial.towerChallenge3Restriction, /\^0\.001/);
  assert.match(towerInitial.towerChallenge3Restriction, /\^0\.100/);
  assert.match(towerInitial.towerChallenge4Target, /1\.00e7,777/);
  assert.equal(towerInitial.towerChallenge4UpgradeControls, 0, "TC4 upgrades should not appear in the Challenge list");
  assert.equal(towerInitial.towerState.scoreExponent, "^1.00");
  const towerChallenge4Ui = await page.evaluate(() => {
    const { state, toggleTowerChallenge, switchMainTab } = window.__angleDebug;
    const original = structuredClone(state);
    const originalTab = window.__angleDebug.runtime.activeMainTab;
    Object.assign(state, {
      towerFloor: 12,
      activeChallenge: 0,
      activeTowerChallenge: 0,
      completedTowerChallenges: 0,
      score: 0,
      scoreLog10: -Infinity,
      infiniteScore: 0,
      infiniteScoreLog10: -Infinity,
      tc4BaseGainLevel: 0,
      tc4BaseGainPriceStep: 0,
      tc4InfinityScoreVertexGainLevel: 0,
      tc4InfinityScoreVertexGainPriceStep: 0,
      tc4FreeCoreBoostLevel: 0,
      tc4FreeCoreBoostPriceStep: 0,
      language: "ja",
    });
    const started = toggleTowerChallenge(4);
    state.score = Number.MAX_VALUE;
    state.scoreLog10 = 300;
    state.infiniteScore = Number.MAX_VALUE;
    state.infiniteScoreLog10 = 300;
    switchMainTab("angle");
    window.advanceTime(0);
    const list = document.querySelector("#tc4UpgradeList");
    const buttons = Array.from(list?.querySelectorAll("button[data-tc4-upgrade]") ?? []);
    const rowSlots = buttons.map((button) => [...button.children].map((child) => [
      "upgrade-row-name",
      "upgrade-row-detail",
      "upgrade-row-cost",
    ].find((slot) => child.classList.contains(slot)) ?? "").join(","));
    const rowStyles = buttons.map((button) => {
      const style = getComputedStyle(button);
      return {
        backgroundImage: style.backgroundImage,
        borderColor: style.borderInlineStartColor,
        gridAreas: style.gridTemplateAreas,
      };
    });
    const readTexts = () => buttons.map((button) => button.textContent.trim());
    const japaneseTexts = readTexts();
    const before = {
      started,
      challengeControls: document.querySelectorAll('#towerChallengeList [data-tower-challenge="4"] [data-tc4-upgrade]').length,
      normalHidden: document.querySelector("#normalUpgradeList")?.hidden ?? false,
      tc4Hidden: list?.hidden ?? true,
      buttonCount: buttons.length,
      rowHeights: buttons.map((button) => button.getBoundingClientRect().height),
      rowOverflow: buttons.some((button) => button.scrollWidth > button.clientWidth + 1),
      rowSlots,
      rowStyles,
      japaneseTexts,
      japaneseForbidden: japaneseTexts.some((text) => /parts|log10|effective CB/i.test(text)),
    };
    state.language = "en";
    window.advanceTime(0);
    const englishTexts = readTexts();
    const englishForbidden = englishTexts.some((text) => /parts|log10|effective CB/i.test(text));
    state.language = "ja";
    window.advanceTime(0);
    buttons[0]?.click();
    window.advanceTime(0);
    const purchased = {
      baseGainLevel: state.tc4BaseGainLevel,
      baseGainPriceStep: state.tc4BaseGainPriceStep,
    };
    const stopped = toggleTowerChallenge(4);
    const restored = {
      normalHidden: document.querySelector("#normalUpgradeList")?.hidden ?? true,
      tc4Hidden: list?.hidden ?? false,
      levels: [state.tc4BaseGainLevel, state.tc4InfinityScoreVertexGainLevel, state.tc4FreeCoreBoostLevel],
    };
    Object.assign(state, original);
    switchMainTab(originalTab);
    window.advanceTime(0);
    window.__angleDebug.runtime.saveGame("manual");
    return { before, englishTexts, englishForbidden, purchased, stopped, restored };
  });
  assert.equal(towerChallenge4Ui.before.started, true, "TC4 should start from its unlocked challenge state");
  assert.equal(towerChallenge4Ui.before.challengeControls, 0, "TC4 controls should stay off the Challenge row");
  assert.equal(towerChallenge4Ui.before.normalHidden, true, "TC4 should hide ordinary ANGLE controls");
  assert.equal(towerChallenge4Ui.before.tc4Hidden, false, "TC4 should show its ANGLE controls");
  assert.equal(towerChallenge4Ui.before.buttonCount, 3, "TC4 should expose three ANGLE purchase rows");
  assert.ok(towerChallenge4Ui.before.rowHeights.every((height) => height >= 42), "TC4 rows should remain touch-safe on desktop");
  assert.equal(towerChallenge4Ui.before.rowOverflow, false, "TC4 rows should not overflow on desktop");
  assert.deepEqual(towerChallenge4Ui.before.rowSlots, [
    "upgrade-row-name,upgrade-row-detail,upgrade-row-cost",
    "upgrade-row-name,upgrade-row-detail,upgrade-row-cost",
    "upgrade-row-name,upgrade-row-detail,upgrade-row-cost",
  ], "TC4 rows should use the compact three-slot order");
  assert.ok(towerChallenge4Ui.before.rowStyles.every((row) => row.backgroundImage === "none"), "TC4 rows should avoid large gradient fills");
  assert.ok(towerChallenge4Ui.before.rowStyles.every((row) => row.gridAreas === "none"), "TC4 rows should use the compact shared row layout");
  assert.equal(new Set(towerChallenge4Ui.before.rowStyles.map((row) => row.borderColor)).size, 1, "TC4 rows should share one gold identity accent");
  assert.equal(towerChallenge4Ui.before.japaneseForbidden, false, "Japanese TC4 effects should use player-facing wording");
  assert.equal(towerChallenge4Ui.englishForbidden, false, "English TC4 effects should use player-facing wording");
  assert.match(towerChallenge4Ui.englishTexts[0], /Core Gain/);
  assert.match(towerChallenge4Ui.englishTexts[1], /Vertex gain from Infinity Score/);
  assert.equal(towerChallenge4Ui.purchased.baseGainLevel, 1, "the ANGLE TC4 row should call the existing purchase behavior");
  assert.equal(towerChallenge4Ui.purchased.baseGainPriceStep, 1, "TC4 purchase pricing should retain its shared step");
  assert.equal(towerChallenge4Ui.stopped, true, "TC4 should stop through its existing challenge action");
  assert.equal(towerChallenge4Ui.restored.normalHidden, false, "stopping TC4 should restore ordinary ANGLE controls");
  assert.equal(towerChallenge4Ui.restored.tc4Hidden, true, "stopping TC4 should hide the TC4 ANGLE controls");
  assert.deepEqual(towerChallenge4Ui.restored.levels, [0, 0, 0], "stopping TC4 should reset its exclusive upgrades");
  const towerChallenge3Flow = await page.evaluate(() => {
    const { state } = window.__angleDebug;
    const original = {
      towerFloor: state.towerFloor,
      infinityCount: state.infinityCount,
      completedTowerChallenges: state.completedTowerChallenges,
      activeTowerChallenge: state.activeTowerChallenge,
    };
    state.towerFloor = 8;
    state.infinityCount = 600000;
    state.completedTowerChallenges = 0;
    state.activeTowerChallenge = 0;
    window.advanceTime(0);
    const row = document.querySelector('#towerChallengeList [data-tower-challenge="3"]');
    const result = {
      button: row?.querySelector("button")?.textContent?.trim() ?? "",
      disabled: Boolean(row?.querySelector("button")?.disabled),
      restriction: row?.querySelector(".challenge-restriction")?.textContent?.trim() ?? "",
    };
    Object.assign(state, original);
    window.advanceTime(0);
    return result;
  });
  assert.equal(towerChallenge3Flow.button, "開始", "TC3 should expose the shared start button at Floor 8");
  assert.equal(towerChallenge3Flow.disabled, false, "TC3 should be available at Floor 8");
  assert.match(towerChallenge3Flow.restriction, /\^0\.800/);
  assert.match(towerChallenge3Flow.restriction, /\^0\.500/);
  const towerChallenge4Flow = await page.evaluate(() => {
    const { state } = window.__angleDebug;
    const original = {
      towerFloor: state.towerFloor,
      activeTowerChallenge: state.activeTowerChallenge,
      completedTowerChallenges: state.completedTowerChallenges,
    };
    state.towerFloor = 12;
    state.activeTowerChallenge = 4;
    state.completedTowerChallenges = 0;
    window.advanceTime(0);
    const row = document.querySelector('#towerChallengeList [data-tower-challenge="4"]');
    const result = {
      status: row?.querySelector(".challenge-state")?.textContent?.trim() ?? "",
      button: row?.querySelector("button")?.textContent?.trim() ?? "",
      disabled: Boolean(row?.querySelector("button")?.disabled),
      summary: document.querySelector("#towerChallengeStatus")?.textContent?.trim() ?? "",
      restriction: row?.querySelector(".challenge-restriction")?.textContent?.trim() ?? "",
    };
    Object.assign(state, original);
    window.advanceTime(0);
    return result;
  });
  assert.equal(towerChallenge4Flow.status, "挑戦中", "TC4 should show its active status");
  assert.equal(towerChallenge4Flow.button, "中止", "an active TC4 should expose the shared stop button");
  assert.equal(towerChallenge4Flow.summary, "TC4 既存品の代替 挑戦中", "the active TC should appear in the group summary");
  assert.equal(towerChallenge4Flow.disabled, false, "an active TC4 should be stoppable");
  assert.match(towerChallenge4Flow.restriction, /購入できず/);
  const towerChallengeFlow = await page.evaluate(() => {
    const { state, toggleTowerChallenge, completeTowerChallengeIfReady } = window.__angleDebug;
    state.towerFloor = 3;
    state.infinityCount = 5;
    state.completedTowerChallenges = 0;
    state.activeTowerChallenge = 0;
    window.advanceTime(0);
    const startButton = document.querySelector("#towerChallengeList .tower-challenge-row button");
    startButton?.click();
    const active = {
      active: state.activeTowerChallenge,
      button: startButton?.textContent?.trim() ?? "",
      disabled: Boolean(startButton?.disabled),
    };
    state.scoreLog10 = 1000;
    state.score = Number.MAX_VALUE;
    const completed = completeTowerChallengeIfReady();
    const result = {
      completed,
      activeAfter: state.activeTowerChallenge,
      completedMask: state.completedTowerChallenges,
    };
    window.advanceTime(0);
    const replayButton = document.querySelector("#towerChallengeList .tower-challenge-row button");
    const replayStarted = replayButton?.textContent?.trim() ?? "";
    const completionSummary = document.querySelector("#towerChallengeStatus")?.textContent?.trim() ?? "";
    replayButton?.click();
    const replay = {
      active: state.activeTowerChallenge,
      button: replayButton?.textContent?.trim() ?? "",
      disabled: Boolean(replayButton?.disabled),
    };
    state.scoreLog10 = 1000;
    state.score = Number.MAX_VALUE;
    const replayCompleted = completeTowerChallengeIfReady();
    state.towerFloor = 0;
    state.infinityCount = 0;
    state.score = 0;
    state.scoreLog10 = -Infinity;
    state.completedTowerChallenges = 0;
    window.advanceTime(0);
    return { active, result, replayStarted, completionSummary, replay, replayCompleted };
  });
  assert.equal(towerChallengeFlow.active.active, 1, "TC1 should become active from its UI button");
  assert.equal(towerChallengeFlow.active.button, "中止", "an active TC should expose the shared stop button");
  assert.equal(towerChallengeFlow.result.completed, true, "TC1 should complete at its displayed target");
  assert.equal(towerChallengeFlow.result.completedMask, 1, "TC1 completion should set its reward flag");
  assert.equal(towerChallengeFlow.replayStarted, "開始", "a cleared TC should expose the normal start action");
  assert.equal(towerChallengeFlow.completionSummary, "1/4 完了", "TC should show the completed count after a clear");
  assert.equal(towerChallengeFlow.replay.active, 1, "a cleared TC should become active when replayed");
  assert.equal(towerChallengeFlow.replay.button, "中止", "a replaying TC should expose the shared stop button");
  assert.equal(towerChallengeFlow.replay.disabled, false, "a replaying TC stop button should be enabled");
  assert.equal(towerChallengeFlow.replayCompleted, true, "a replaying TC should complete at its displayed target");
  const towerRewardDisplay = await page.evaluate(() => {
    const { state } = window.__angleDebug;
    const original = {
      activeChallenge: state.activeChallenge,
      completedTowerChallenges: state.completedTowerChallenges,
      language: state.language,
      towerFloor: state.towerFloor,
      speedLevel: state.speedLevel,
      gainLevel: state.gainLevel,
      infinityUpgradeMask: state.infinityUpgradeMask,
      numberFormat: state.numberFormat,
    };
    state.completedTowerChallenges = 3;
    state.towerFloor = 5;
    window.advanceTime(0);
    const tc1 = {
      base: document.querySelector("#towerChallenge1ScorePowerBase")?.textContent?.trim() ?? "",
      bonus: document.querySelector("#towerChallenge1ScorePowerBonus")?.textContent?.trim() ?? "",
      total: document.querySelector("#towerChallenge1ScorePowerTotal")?.textContent?.trim() ?? "",
      final: document.querySelector("#towerChallenge1ScorePower")?.textContent?.trim() ?? "",
    };
    state.towerFloor = 22;
    window.advanceTime(0);
    const tc2 = {
      raw: document.querySelector("#coreBoostRequirementGrowthPowerRaw")?.textContent?.trim() ?? "",
      effective: document.querySelector("#coreBoostRequirementGrowthPower")?.textContent?.trim() ?? "",
    };
    state.completedTowerChallenges = 4;
    state.towerFloor = 13;
    state.speedLevel = 100;
    state.gainLevel = 100;
    state.infinityUpgradeMask = 0;
    state.numberFormat = "detailed";
    state.language = "en";
    window.advanceTime(0);
    const infinityStart = document.querySelector('#challengeList [data-challenge="1"] button')?.textContent?.trim() ?? "";
    state.activeChallenge = 1;
    window.advanceTime(0);
    const infinityStop = document.querySelector('#challengeList [data-challenge="1"] button')?.textContent?.trim() ?? "";
    state.activeChallenge = original.activeChallenge;
    window.advanceTime(0);
    state.completedTowerChallenges = 0b1111;
    window.advanceTime(0);
    const towerSummary = document.querySelector("#towerChallengeStatus")?.textContent?.trim() ?? "";
    state.completedTowerChallenges = 4;
    window.advanceTime(0);
    const effectiveUpgradeLevels = {
      speed: document.querySelector("#speedLevel")?.textContent?.trim() ?? "",
      gain: document.querySelector("#gainLevel")?.textContent?.trim() ?? "",
    };
    const englishLabels = {
      infinityStart,
      infinityStop,
      towerSummary,
      towerButton: document.querySelector('#towerChallengeList [data-tower-challenge="1"] button')?.textContent?.trim() ?? "",
      tc1Final: document.querySelector('[data-i18n="towerChallenge1ScorePower"]')?.textContent?.trim() ?? "",
      tc2Effective: document.querySelector('[data-i18n="coreBoostGrowthPower"]')?.textContent?.trim() ?? "",
      tc2Reward: document.querySelector('#towerChallengeList [data-tower-challenge="2"] .challenge-reward')?.textContent?.trim() ?? "",
      tc3Name: document.querySelector('#towerChallengeList [data-tower-challenge="3"] .challenge-name')?.textContent?.trim() ?? "",
      tc4Name: document.querySelector('#towerChallengeList [data-tower-challenge="4"] .challenge-name')?.textContent?.trim() ?? "",
      tc3Restriction: document.querySelector('#towerChallengeList [data-tower-challenge="3"] .challenge-restriction')?.textContent?.trim() ?? "",
      routineText: Array.from(
        document.querySelectorAll('.main-panel:not([data-panel="help"]):not([data-panel="eternity"])'),
        (panel) => panel.textContent,
      ).join(" "),
      lapSpeed: document.querySelector("#lapSpeedValue")?.textContent?.trim() ?? "",
    };
    Object.assign(state, original);
    window.advanceTime(0);
    return { tc1, tc2, effectiveUpgradeLevels, englishLabels };
  });
  assert.equal(towerRewardDisplay.tc1.base, "", "TC1 base exponent should be removed from the Tower panel");
  assert.equal(towerRewardDisplay.tc1.bonus, "", "TC1 bonus exponent should be removed from the Tower panel");
  assert.equal(towerRewardDisplay.tc1.total, "", "TC1 total decomposition should be removed from the Tower panel");
  assert.equal(towerRewardDisplay.tc1.final, "^0.454", "Tower should retain the final Infinity Score exponent");
  assert.equal(towerRewardDisplay.tc2.raw, "", "raw Core Boost growth should be removed from the Angle panel");
  assert.equal(towerRewardDisplay.tc2.effective, "^1.499", "TC2 should expose the soft-capped requirement growth power");
  assert.match(towerRewardDisplay.effectiveUpgradeLevels.speed, /Level 100 .*Effective 127\.628/, "TC3 should expose effective Speed levels");
  assert.match(towerRewardDisplay.effectiveUpgradeLevels.gain, /Level 100 .*Effective 127\.628/, "TC3 should expose effective Gain levels");
  assert.equal(towerRewardDisplay.englishLabels.tc2Effective, "CB requirement growth", "the final Core Boost growth label should be translated to English");
  assert.equal(towerRewardDisplay.englishLabels.tc1Final, "Infinity Score exponent", "the final Tower exponent label should be translated to English");
  assert.equal(towerRewardDisplay.englishLabels.towerSummary, "4/4 complete", "the English TC summary should show completed progress");
  assert.equal(towerRewardDisplay.englishLabels.towerButton, "Start", "the English TC action should use the shared start label");
  assert.equal(towerRewardDisplay.englishLabels.infinityStart, "Start", "the English IC action should use the shared start label");
  assert.equal(towerRewardDisplay.englishLabels.infinityStop, "Stop", "the English IC action should use the shared stop label");
  assert.doesNotMatch(towerRewardDisplay.englishLabels.tc2Reward, /raw power|log10|parts|effective CB/i, "TC2 reward copy should use player-facing wording");
  assert.doesNotMatch(towerRewardDisplay.englishLabels.routineText, /log10|parts|effective CB/i, "routine gameplay UI should avoid implementation terminology");
  assert.doesNotMatch(towerRewardDisplay.englishLabels.lapSpeed, /raw/i, "lap speed should show only its governing value");
  assert.match(towerRewardDisplay.englishLabels.tc3Name, /Age When Infinity Was a Concept/, "TC3 name should be translated to English");
  assert.equal(towerRewardDisplay.englishLabels.tc4Name, "TC4 Substitute for Existing Products", "the English Challenges screen should use the canonical TC4 title");
  assert.match(towerRewardDisplay.englishLabels.tc3Restriction, /Score gain starts/, "TC3 restriction should be translated to English");

  const eternityNormalUpgradeDisplay = await page.evaluate(() => {
    const { state } = window.__angleDebug;
    const original = {
      activeChallenge: state.activeChallenge,
      activeTowerChallenge: state.activeTowerChallenge,
      completedTowerChallenges: state.completedTowerChallenges,
      eternityCount: state.eternityCount,
      eternityMilestoneMask: state.eternityMilestoneMask,
      gainLevel: state.gainLevel,
      infinityPoints: state.infinityPoints,
      infinityPointsExact: state.infinityPointsExact,
      infinityPointsLog10: state.infinityPointsLog10,
      infinityUpgradeMask: state.infinityUpgradeMask,
      language: state.language,
      numberFormat: state.numberFormat,
      speedLevel: state.speedLevel,
      towerFloor: state.towerFloor,
      vertices: state.vertices,
    };
    const readLabels = () => ({
      speed: document.querySelector("#speedLevel")?.textContent?.trim() ?? "",
      vertex: document.querySelector("#vertexCount")?.textContent?.trim() ?? "",
      gain: document.querySelector("#gainLevel")?.textContent?.trim() ?? "",
    });
    const readCosts = () => [
      document.querySelector("#speedCost")?.textContent?.trim() ?? "",
      document.querySelector("#vertexCost")?.textContent?.trim() ?? "",
      document.querySelector("#gainCost")?.textContent?.trim() ?? "",
    ];
    Object.assign(state, {
      activeChallenge: 0,
      activeTowerChallenge: 0,
      completedTowerChallenges: 0,
      eternityCount: 3,
      eternityMilestoneMask: 0,
      gainLevel: 4,
      infinityPoints: 0,
      infinityPointsExact: "0",
      infinityPointsLog10: -Infinity,
      infinityUpgradeMask: 0,
      language: "en",
      numberFormat: "detailed",
      speedLevel: 4,
      towerFloor: 0,
      vertices: 7,
    });
    window.advanceTime(0);
    const inactive = { labels: readLabels(), costs: readCosts() };
    state.eternityMilestoneMask = 2;
    window.advanceTime(0);
    const active = { labels: readLabels(), costs: readCosts() };
    Object.assign(state, {
      completedTowerChallenges: 4,
      infinityPoints: 4000,
      infinityPointsExact: "4000",
      infinityPointsLog10: Math.log10(4000),
      infinityUpgradeMask: 1 << 16,
      towerFloor: 13,
    });
    window.advanceTime(0);
    const stacked = { labels: readLabels(), costs: readCosts() };
    Object.assign(state, original);
    window.advanceTime(0);
    return { inactive, active, stacked };
  });
  assert.deepEqual(eternityNormalUpgradeDisplay.inactive.labels, {
    speed: "Level 4",
    vertex: "7 vertices",
    gain: "Level 4",
  }, "Milestone 1-2 inactive UI should retain the existing normal-upgrade labels");
  assert.deepEqual(eternityNormalUpgradeDisplay.active.labels, {
    speed: "Lv 34 (+30)",
    vertex: "37 vertices (+30)",
    gain: "Lv 34 (+30)",
  }, "Milestone 1-2 UI should expose its free level on all normal upgrades");
  assert.deepEqual(eternityNormalUpgradeDisplay.stacked.labels, {
    speed: "Lv 37.105 (+30)",
    vertex: "40 vertices (+30)",
    gain: "Lv 37.105 (+30)",
  }, "normal-upgrade UI should show the effective total while isolating the Milestone 1-2 bonus");
  assert.deepEqual(eternityNormalUpgradeDisplay.active.costs, eternityNormalUpgradeDisplay.inactive.costs, "Milestone 1-2 display should not change normal-upgrade costs");
  assert.deepEqual(eternityNormalUpgradeDisplay.stacked.costs, eternityNormalUpgradeDisplay.inactive.costs, "TC3 and IU stacking should not change normal-upgrade costs");
}
export async function runInfiniteAngleSurface({ page }) {
  const infiniteAngleUnlock = await page.evaluate(() => {
    const { state, unlockInfiniteAngle, switchMainTab, switchInfinitySubtab } = window.__angleDebug;
    state.infinityPointsExact = "100000000000000000000";
    state.infinityPoints = 1e20;
    state.infinityPointsLog10 = 20;
    state.infiniteAngleUnlocked = false;
    state.infiniteScore = 0;
    state.infiniteScoreLog10 = -Infinity;
    const unlocked = unlockInfiniteAngle();
    switchMainTab("angle");
    switchInfinitySubtab("upgrades");
    const before = state.infiniteScoreLog10;
    window.advanceTime(6000);
    return {
      unlocked,
      unlockedState: state.infiniteAngleUnlocked,
      ipExact: state.infinityPointsExact,
      scoreBefore: before,
      scoreAfter: state.infiniteScoreLog10,
      angleScore: state.scoreLog10,
    };
  });
  assert.equal(infiniteAngleUnlock.unlocked, true, "IA should unlock through the runtime hook");
  assert.equal(infiniteAngleUnlock.unlockedState, true, "IA should remain unlocked after purchase");
  assert.equal(infiniteAngleUnlock.ipExact, "0", "IA unlock should spend 1e20 IP exactly");
  assert.ok(infiniteAngleUnlock.scoreAfter > infiniteAngleUnlock.scoreBefore, "IA should progress while its subtab is hidden");

  const infiniteAnglePanel = await page.evaluate(() => {
    const { state, switchMainTab, switchInfinitySubtab, buyInfiniteAngleUpgrade } = window.__angleDebug;
    const originalMilestoneMask = state.eternityMilestoneMask;
    const originalLevels = [state.infiniteAngleSpeedLevel, state.infiniteAngleVertexLevel, state.infiniteAngleGainLevel];
    state.eternityMilestoneMask = 4;
    state.infiniteAngleSpeedLevel = 0;
    state.infiniteAngleVertexLevel = 0;
    state.infiniteAngleGainLevel = 0;
    state.infinityPointsExact = "100000000000000000100";
    state.infinityPoints = 1e20;
    state.infinityPointsLog10 = 20;
    switchMainTab("infinity");
    switchInfinitySubtab("angle");
    window.advanceTime(0);
    const canvas = document.querySelector("#infiniteAngleCanvas");
    const panel = document.querySelector('[data-infinity-panel="angle"]');
    const infiniteAngleLayout = document.querySelector(".infinite-angle-panel");
    const metricColumn = document.querySelector(".infinite-angle-metrics");
    const compactRows = Array.from(document.querySelectorAll(".infinite-angle-upgrades .upgrade-row"));
    const rowSlots = compactRows.map((row) => [...row.children].map((child) => [
      "upgrade-row-name",
      "upgrade-row-detail",
      "upgrade-row-cost",
    ].find((slot) => child.classList.contains(slot)) ?? "").join(","));
    const rowStyles = compactRows.map((row) => {
      const style = getComputedStyle(row);
      return {
        disabled: row.disabled,
        backgroundImage: style.backgroundImage,
        borderColor: style.borderInlineStartColor,
      };
    });
    const buyAllButton = document.querySelector("#infiniteAngleBuyAllUpgrade");
    const buyAllRect = buyAllButton?.getBoundingClientRect();
    const buyAllStyle = buyAllButton ? getComputedStyle(buyAllButton) : null;
    const beforeLevel = state.infiniteAngleSpeedLevel;
    const upgradeCosts = [
      document.querySelector("#infiniteAngleSpeedCost")?.textContent?.trim() ?? "",
      document.querySelector("#infiniteAngleVertexCost")?.textContent?.trim() ?? "",
      document.querySelector("#infiniteAngleGainCost")?.textContent?.trim() ?? "",
    ];
    const levelLabelsBeforePaidPurchase = [
      document.querySelector("#infiniteAngleSpeedLevel")?.textContent?.trim() ?? "",
      document.querySelector("#infiniteAngleVertexLevel")?.textContent?.trim() ?? "",
      document.querySelector("#infiniteAngleGainLevel")?.textContent?.trim() ?? "",
    ];
    const bought = buyInfiniteAngleUpgrade("speed");
    window.advanceTime(0);
    const ipExactAfterSingle = state.infinityPointsExact;
    const speedLevelAfterSingle = state.infiniteAngleSpeedLevel;
    const levelLabelsAfterPaidPurchase = [
      document.querySelector("#infiniteAngleSpeedLevel")?.textContent?.trim() ?? "",
      document.querySelector("#infiniteAngleVertexLevel")?.textContent?.trim() ?? "",
      document.querySelector("#infiniteAngleGainLevel")?.textContent?.trim() ?? "",
    ];
    state.infinityPointsExact = "100000000000000000000000";
    state.infinityPoints = 1e23;
    state.infinityPointsLog10 = 23;
    window.advanceTime(0);
    const buyAllDisabledBefore = Boolean(document.querySelector("#infiniteAngleBuyAllUpgrade")?.disabled);
    const levelsBeforeBuyAll = state.infiniteAngleSpeedLevel + state.infiniteAngleVertexLevel + state.infiniteAngleGainLevel;
    document.querySelector("#infiniteAngleBuyAllUpgrade")?.click();
    const levelsAfterBuyAll = state.infiniteAngleSpeedLevel + state.infiniteAngleVertexLevel + state.infiniteAngleGainLevel;
    state.eternityMilestoneMask = originalMilestoneMask;
    [state.infiniteAngleSpeedLevel, state.infiniteAngleVertexLevel, state.infiniteAngleGainLevel] = originalLevels;
    window.advanceTime(0);
    return {
      panelActive: Boolean(panel?.classList.contains("is-active")),
      canvasWidth: canvas?.getBoundingClientRect().width ?? 0,
      canvasHeight: canvas?.getBoundingClientRect().height ?? 0,
      metricWidth: metricColumn?.getBoundingClientRect().width ?? 0,
      compactRowCount: compactRows.length,
      compactRowHeights: compactRows.map((row) => row.getBoundingClientRect().height),
      compactRowOverflow: compactRows.some((row) => row.scrollWidth > row.clientWidth + 1),
      rowSlots,
      rowStyles,
      buyAllWidth: buyAllRect?.width ?? 0,
      buyAllParentWidth: buyAllButton?.parentElement?.getBoundingClientRect().width ?? 0,
      buyAllHeight: buyAllRect?.height ?? 0,
      buyAllBackgroundImage: buyAllStyle?.backgroundImage ?? "",
      panelOverflow: Boolean(infiniteAngleLayout && infiniteAngleLayout.scrollWidth > infiniteAngleLayout.clientWidth + 1),
      canvasPixel: canvas?.getContext("2d")?.getImageData(1, 1, 1, 1).data?.[0] ?? 0,
      scoreText: document.querySelector("#infiniteScorePanel")?.textContent?.trim() ?? "",
      renderTextLength: window.render_game_to_text().length,
      unlockHidden: Boolean(document.querySelector("#infiniteAngleUnlockButton")?.hidden),
      unlockNoteDisplay: getComputedStyle(document.querySelector("#infiniteAngleUnlockNote")).display,
      bought,
      speedLevel: speedLevelAfterSingle,
      expectedSpeedLevel: beforeLevel + 1,
      levelLabelsBeforePaidPurchase,
      levelLabelsAfterPaidPurchase,
      ipExact: ipExactAfterSingle,
      buyAllDisabledBefore,
      buyAllPurchases: levelsAfterBuyAll - levelsBeforeBuyAll,
      upgradeWidths: Array.from(document.querySelectorAll(".infinite-angle-upgrades .upgrade-button"), (button) => button.getBoundingClientRect().width),
      upgradeCosts,
    };
  });
  assert.equal(infiniteAnglePanel.panelActive, true, "Infinity > IA should activate the IA panel");
  assert.ok(infiniteAnglePanel.canvasWidth > 0 && infiniteAnglePanel.canvasHeight > 0, "IA canvas should have a rendered size");
  assert.ok(infiniteAnglePanel.metricWidth >= 200, "IA metrics should retain a readable minimum column");
  assert.equal(infiniteAnglePanel.compactRowCount, 3, "IA should expose three shared purchase rows");
  assert.ok(infiniteAnglePanel.compactRowHeights.every((height) => height >= 42), "IA purchase rows should remain touch-safe");
  assert.equal(infiniteAnglePanel.compactRowOverflow, false, "IA purchase rows should not overflow");
  assert.deepEqual(infiniteAnglePanel.rowSlots, [
    "upgrade-row-name,upgrade-row-detail,upgrade-row-cost",
    "upgrade-row-name,upgrade-row-detail,upgrade-row-cost",
    "upgrade-row-name,upgrade-row-detail,upgrade-row-cost",
  ], "IA rows should use the compact three-slot order");
  assert.deepEqual(infiniteAnglePanel.rowStyles.map((row) => row.disabled), [false, true, true], "IA row affordance should follow the existing affordability predicate");
  assert.equal(new Set(infiniteAnglePanel.rowStyles.map((row) => row.borderColor)).size, 3, "IA actions should retain distinct color identities");
  assert.ok(infiniteAnglePanel.rowStyles.every((row) => row.backgroundImage === "none"), "IA rows should avoid large gradient fills");
  assert.ok(infiniteAnglePanel.buyAllWidth < infiniteAnglePanel.buyAllParentWidth, "IA Buy All should remain a compact section action");
  assert.ok(infiniteAnglePanel.buyAllHeight <= 42, "IA Buy All should remain compact");
  assert.equal(infiniteAnglePanel.buyAllBackgroundImage, "none", "IA Buy All should avoid a dominant gradient fill");
  assert.equal(infiniteAnglePanel.panelOverflow, false, "IA should not overflow its panel");
  assert.notEqual(infiniteAnglePanel.canvasPixel, 0, "IA canvas should render nonblank pixels");
  assert.notEqual(infiniteAnglePanel.scoreText, "", "IA panel should display Infinity Score");
  assert.ok(infiniteAnglePanel.renderTextLength > 0, "IA should retain the render_game_to_text debug surface");
  assert.equal(infiniteAnglePanel.unlockHidden, true, "IA unlock control should hide after unlocking");
  assert.equal(infiniteAnglePanel.unlockNoteDisplay, "none", "IA unlock note should hide after unlocking");
  assert.ok(infiniteAnglePanel.upgradeWidths.every((width) => width > 0), "IA upgrade controls should remain visible");
  assert.equal(infiniteAnglePanel.bought, true, "IA speed upgrade should be purchasable with IP");
  assert.equal(infiniteAnglePanel.speedLevel, infiniteAnglePanel.expectedSpeedLevel, "IA speed upgrade should increase its own level");
  assert.deepEqual(infiniteAnglePanel.levelLabelsBeforePaidPurchase, ["Lv 5 (+5)", "Lv 5 (+5)", "Lv 5 (+5)"], "IA UI should show free levels before paid purchases");
  assert.deepEqual(infiniteAnglePanel.levelLabelsAfterPaidPurchase, ["Lv 6 (+5)", "Lv 5 (+5)", "Lv 5 (+5)"], "IA UI should add purchased levels without losing the free contribution");
  assert.equal(infiniteAnglePanel.ipExact, "100", "IA speed upgrade should spend 1e20 IP");
  assert.equal(infiniteAnglePanel.buyAllDisabledBefore, false, "IA Buy All should enable when any IA upgrade is affordable");
  assert.ok(infiniteAnglePanel.buyAllPurchases > 0, "IA Buy All should purchase multiple affordable upgrades through the UI");
  assert.match(infiniteAnglePanel.upgradeCosts[0], /1\.00e20/, "IA speed cost should match the unlock scale");
  assert.match(infiniteAnglePanel.upgradeCosts[1], /2\.40e20/, "IA vertex cost should preserve the TA price ratio");
  assert.match(infiniteAnglePanel.upgradeCosts[2], /3\.60e20/, "IA gain cost should preserve the TA price ratio");

  const infiniteAngleDrawMode = await page.evaluate(() => {
    const { switchMainTab, switchInfinitySubtab } = window.__angleDebug;
    const context = document.querySelector("#infiniteAngleCanvas")?.getContext("2d");
    let fillCalls = 0;
    let drawImageCalls = 0;
    const originalFillRect = context?.fillRect;
    const originalDrawImage = context?.drawImage;
    if (context && originalFillRect) {
      context.fillRect = (...args) => {
        fillCalls += 1;
        return originalFillRect.apply(context, args);
      };
    }
    if (context && originalDrawImage) {
      context.drawImage = (...args) => {
        drawImageCalls += 1;
        return originalDrawImage.apply(context, args);
      };
    }
    switchMainTab("angle");
    switchInfinitySubtab("upgrades");
    window.advanceTime(1000);
    const hiddenFillCalls = fillCalls;
    const hiddenDrawImageCalls = drawImageCalls;
    switchMainTab("infinity");
    switchInfinitySubtab("angle");
    window.advanceTime(0);
    return {
      hiddenFillCalls,
      hiddenDrawImageCalls,
      visibleFillCalls: fillCalls - hiddenFillCalls,
      visibleDrawImageCalls: drawImageCalls - hiddenDrawImageCalls,
    };
  });
  assert.equal(infiniteAngleDrawMode.hiddenFillCalls, 0, "hidden IA should not draw its canvas");
  assert.equal(infiniteAngleDrawMode.hiddenDrawImageCalls, 0, "hidden IA should not copy its cached canvas");
  assert.ok(
    infiniteAngleDrawMode.visibleFillCalls > 0 || infiniteAngleDrawMode.visibleDrawImageCalls > 0,
    "visible IA should draw its canvas",
  );
}
