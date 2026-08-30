import assert from "node:assert/strict";
import { openGamePage, startGameTest } from "./browser-harness.mjs";

const gameTest = await startGameTest();
const { context, page } = await openGamePage(gameTest.browser, gameTest.origin, {
  viewport: { width: 1280, height: 900 },
});

try {
  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.runtime.closeUpdateModal?.();
    debug.state.language = "ja";
    debug.state.eternityCount = 0;
    debug.state.eternityMilestoneMask = 0;
    debug.state.eternityMilestoneChoice = "";
    debug.state.infinityUpgradeMask = 0;
    debug.state.towerFloor = 0;
    debug.state.completedTowerChallenges = 0;
    debug.state.hiddenTabs = [];
    debug.state.unlockedMainTabs = [];
    debug.runtime.syncInfinityPointCachesFromExact(0n);
    debug.runtime.appliedLanguage = "";
    debug.runtime.updateUi();
  });

  const lockedNavigation = await page.evaluate(() => ({
    infinityHidden: document.querySelector('[data-tab="infinity"]')?.hidden,
    challengesHidden: document.querySelector('[data-tab="challenges"]')?.hidden,
    automationHidden: document.querySelector('[data-tab="automation"]')?.hidden,
    eternityHidden: document.querySelector('[data-tab="eternity"]')?.hidden,
    timelineMainTabPresent: document.querySelector('[data-tab="timeline"]') !== null,
    timelineSubtabHidden: document.querySelector('[data-eternity-tab="timeline"]')?.hidden,
    timelineSubtabDisabled: document.querySelector('[data-eternity-tab="timeline"]')?.disabled,
    statisticsHidden: document.querySelector('[data-tab="statistics"]')?.hidden,
    achievementsHidden: document.querySelector('[data-tab="achievements"]')?.hidden,
    helpHidden: document.querySelector('[data-tab="help"]')?.hidden,
    settingsHidden: document.querySelector('[data-tab="settings"]')?.hidden,
  }));
  assert.equal(lockedNavigation.infinityHidden, true, "INF should be hidden on a fresh new game");
  assert.equal(lockedNavigation.challengesHidden, true, "CHAL should be hidden on a fresh new game");
  assert.equal(lockedNavigation.automationHidden, true, "AUTO should be hidden on a fresh new game");
  assert.equal(lockedNavigation.eternityHidden, true, "ETR should be hidden before TC4 unlock");
  assert.equal(lockedNavigation.timelineMainTabPresent, false, "Timeline should no longer be a top-level tab");
  assert.equal(lockedNavigation.timelineSubtabHidden, false, "Timeline subtab should not carry a navigation-level lock");
  assert.equal(lockedNavigation.timelineSubtabDisabled, false, "Timeline subtab should stay selectable when the Eternity page is available");
  assert.equal(lockedNavigation.statisticsHidden, false, "STAT should be available on a fresh new game");
  assert.equal(lockedNavigation.achievementsHidden, false, "ACH should be available on a fresh new game");
  assert.equal(lockedNavigation.helpHidden, false, "HELP should be available on a fresh new game");
  assert.equal(lockedNavigation.settingsHidden, false, "SET should be available on a fresh new game");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.towerFloor = 12;
    debug.runtime.updateUi();
  });
  assert.equal(
    await page.evaluate(() => document.querySelector('[data-tab="eternity"]')?.hidden),
    false,
    "normal TC4 unlock should reveal ETR before the first Eternity",
  );

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.hiddenTabs = ["eternity"];
    debug.runtime.updateUi();
  });
  const hiddenEternity = await page.evaluate(() => ({
    hidden: document.querySelector('[data-tab="eternity"]')?.hidden,
    unlocked: window.__angleDebug.mainTabIsUnlocked("eternity"),
  }));
  assert.equal(hiddenEternity.hidden, true, "hiddenTabs should hide a discovered ETR tab");
  assert.equal(hiddenEternity.unlocked, true, "hiddenTabs must not revoke ETR discovery");
  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.hiddenTabs = [];
    debug.runtime.resetEternityProgression();
    debug.runtime.updateUi();
  });
  assert.equal(
    await page.evaluate(() => document.querySelector('[data-tab="eternity"]')?.hidden),
    false,
    "Eternity resets should preserve ETR discovery and clear only current Tower state",
  );
  await page.click('[data-tab="eternity"]');

  const initial = await page.evaluate(() => ({
    tabActive: document.querySelector('[data-tab="eternity"]')?.classList.contains("is-active"),
    panelActive: document.querySelector('[data-panel="eternity"]')?.classList.contains("is-active"),
    subtabCodes: Array.from(document.querySelectorAll(".eternity-subtab span"), (node) => node.textContent),
    milestoneSubpanelActive: document.querySelector('[data-eternity-panel="milestone"]')?.classList.contains("is-active"),
    timelineSubpanelActive: document.querySelector('[data-eternity-panel="timeline"]')?.classList.contains("is-active"),
    timelineSubtabHidden: document.querySelector('[data-eternity-tab="timeline"]')?.hidden,
    timelineSubtabDisabled: document.querySelector('[data-eternity-tab="timeline"]')?.disabled,
    timelineMainPanelPresent: document.querySelector('[data-panel="timeline"]') !== null,
    legacyInfinityTab: document.querySelector('[data-infinity-tab="eternity"]') !== null,
    infinitySubtabCount: document.querySelectorAll(".infinity-subtab").length,
    compactRequirement: document.querySelector('[data-i18n="eternityRequirementCompact"]')?.textContent,
    compactRequirementCount: document.querySelectorAll('[data-i18n="eternityRequirementCompact"]').length,
    currentIp: document.getElementById("eternityCurrentIp")?.textContent,
    legacyCount: document.getElementById("eternityCountValue"),
    legacyTc4: document.getElementById("eternityTc4Requirement"),
    legacyIp: document.getElementById("eternityIpRequirement"),
    legacyReady: document.getElementById("eternityRequirementState"),
    legacyWarning: document.getElementById("eternityForcedNote"),
    title11: document.querySelector('[data-eternity-milestone="1-1"] [data-i18n="eternityMilestone11Name"]')?.textContent,
    title6: document.querySelector('[data-eternity-milestone="6"] [data-i18n="eternityMilestone6Name"]')?.textContent,
    status6: document.querySelector('[data-eternity-milestone="6"] .eternity-milestone-status')?.textContent,
    requirement6: document.querySelector('[data-eternity-milestone="6"] .eternity-milestone-requirement')?.textContent,
    title7: document.querySelector('[data-eternity-milestone="7"] [data-i18n="eternityMilestone7Name"]')?.textContent,
    status7: document.querySelector('[data-eternity-milestone="7"] .eternity-milestone-status')?.textContent,
    requirement7: document.querySelector('[data-eternity-milestone="7"] .eternity-milestone-requirement')?.textContent,
    title8: document.querySelector('[data-eternity-milestone="8"] [data-i18n="eternityMilestone8Name"]')?.textContent,
    status8: document.querySelector('[data-eternity-milestone="8"] .eternity-milestone-status')?.textContent,
    requirement8: document.querySelector('[data-eternity-milestone="8"] .eternity-milestone-requirement')?.textContent,
    title9: document.querySelector('[data-eternity-milestone="9"] [data-i18n="eternityMilestone9Name"]')?.textContent,
    status9: document.querySelector('[data-eternity-milestone="9"] .eternity-milestone-status')?.textContent,
    requirement9: document.querySelector('[data-eternity-milestone="9"] .eternity-milestone-requirement')?.textContent,
    autoIaSpeedDisabled: document.getElementById("autoBuyInfiniteAngleSpeedToggle")?.disabled,
    autoIaVertexDisabled: document.getElementById("autoBuyInfiniteAngleVertexToggle")?.disabled,
    autoIaGainDisabled: document.getElementById("autoBuyInfiniteAngleGainToggle")?.disabled,
    autoTowerDisabled: document.getElementById("autoBuildTowerToggle")?.disabled,
    autoInfinityUpgradesDisabled: document.getElementById("autoBuyInfinityUpgradesToggle")?.disabled,
    autoIaSpeedChecked: document.getElementById("autoBuyInfiniteAngleSpeedToggle")?.checked,
    autoTowerChecked: document.getElementById("autoBuildTowerToggle")?.checked,
    autoInfinityUpgradesChecked: document.getElementById("autoBuyInfinityUpgradesToggle")?.checked,
    button11: document.querySelector('[data-eternity-choice="1-1"]')?.textContent,
    disabled11: document.querySelector('[data-eternity-choice="1-1"]')?.disabled,
    entitlement: document.getElementById("eternityChoiceEntitlement")?.textContent,
    perform: document.getElementById("eternityPerformButton")?.textContent,
    performDisabled: document.getElementById("eternityPerformButton")?.disabled,
    panelText: document.querySelector('[data-panel="eternity"]')?.textContent || "",
  }));
  assert.equal(initial.tabActive, true, "Eternity should be selectable as a top-level main tab");
  assert.equal(initial.panelActive, true, "Eternity top-level panel should become active through main navigation");
  assert.deepEqual(initial.subtabCodes, ["MS", "TL"], "Eternity should expose Milestone and Timeline subtabs");
  assert.equal(initial.milestoneSubpanelActive, true, "Milestone should be the default Eternity subtab");
  assert.equal(initial.timelineSubpanelActive, false, "Timeline should not be active before discovery");
  assert.equal(initial.timelineSubtabHidden, false, "Timeline subtab should stay visible before discovery");
  assert.equal(initial.timelineSubtabDisabled, false, "Timeline subtab should stay enabled before discovery");
  assert.equal(initial.timelineMainPanelPresent, false, "Timeline should be nested instead of a main panel");
  assert.equal(initial.legacyInfinityTab, false, "Infinity must not contain an Eternity subtab");
  assert.equal(initial.infinitySubtabCount, 3, "Infinity navigation should remain Upgrades / Infinite Angle / Tower");
  assert.equal(initial.compactRequirement, "TC4クリア + 1.80e308 IP", "Eternity should show one compact requirement summary");
  assert.equal(initial.compactRequirementCount, 1, "Eternity should not duplicate its compact requirement");
  assert.equal(initial.currentIp, "0 IP", "Eternity should keep current IP visible");
  assert.equal(initial.legacyCount, null, "Eternity should remove the duplicate body count");
  assert.equal(initial.legacyTc4, null, "Eternity should remove the separate TC4 status row");
  assert.equal(initial.legacyIp, null, "Eternity should remove the separate IP status row");
  assert.equal(initial.legacyReady, null, "Eternity should remove the separate readiness row");
  assert.equal(initial.legacyWarning, null, "Eternity should remove the repeated manual-execution warning");
  assert.equal(initial.title11, "1-1 QoLの精神", "Japanese Milestone copy should render");
  assert.equal(initial.title6, "6 有限回の無限チャレンジを0に", "Milestone 6 Japanese copy should render");
  assert.equal(initial.status6, "未解放", "Milestone 6 should remain locked before Eternity 27");
  assert.equal(initial.requirement6, "Eternity 27", "Milestone 6 should show its Eternity 27 requirement");
  assert.equal(initial.title7, "7 ワンポイントチャレンジ", "Milestone 7 Japanese copy should render");
  assert.equal(initial.status7, "未解放", "Milestone 7 should remain locked before Eternity 44");
  assert.equal(initial.requirement7, "Eternity 44", "Milestone 7 should show its Eternity 44 requirement");
  assert.equal(initial.title8, "8 バベル・オブ・インフィニット", "Milestone 8 Japanese copy should render");
  assert.equal(initial.status8, "未解放", "Milestone 8 should remain locked before Eternity 81");
  assert.equal(initial.requirement8, "Eternity 81", "Milestone 8 should show its Eternity 81 requirement");
  assert.equal(initial.title9, "9 煩悩まみれ", "Milestone 9 Japanese copy should render");
  assert.equal(initial.status9, "未解放", "Milestone 9 should remain locked before Eternity 108");
  assert.equal(initial.requirement9, "Eternity 108", "Milestone 9 should show its Eternity 108 requirement");
  assert.equal(initial.autoIaSpeedDisabled, true, "IA Speed automation should be unavailable before Milestone 8");
  assert.equal(initial.autoIaVertexDisabled, true, "IA Vertex automation should be unavailable before Milestone 8");
  assert.equal(initial.autoIaGainDisabled, true, "IA Gain automation should be unavailable before Milestone 8");
  assert.equal(initial.autoTowerDisabled, true, "Tower automation should be unavailable before Milestone 8");
  assert.equal(initial.autoInfinityUpgradesDisabled, true, "Infinity Upgrade automation should be unavailable before Milestone 5");
  assert.equal(initial.autoIaSpeedChecked, false, "IA Speed automation should default off");
  assert.equal(initial.autoTowerChecked, false, "Tower automation should default off");
  assert.equal(initial.autoInfinityUpgradesChecked, false, "Infinity Upgrade automation should default off");
  assert.equal(initial.button11, "未解放", "first-tier Milestones should not be acquirable before the first Eternity");
  assert.equal(initial.disabled11, true, "first-tier acquisition controls should be disabled before an entitlement exists");
  assert.equal(initial.entitlement, "現在取得できるMilestoneはありません。", "the UI should explain the lack of a current acquisition right");
  assert.equal(initial.perform, "Eternity条件未達成", "manual Eternity action should expose its unavailable state");
  assert.equal(initial.performDisabled, true, "manual Eternity action should be disabled before the full requirement is met");
  assert.equal(initial.panelText.includes("Eternity Point"), false, "Eternity UI must not introduce an Eternity Point surface");

  await page.click('[data-eternity-tab="timeline"]');
  const beforeDiscovery = await page.evaluate(() => ({
    active: document.querySelector('[data-eternity-panel="timeline"]')?.classList.contains("is-active"),
    discovered: window.__angleDebug.runtime.timelineDiscovered(),
    scoreClaimDisabled: document.getElementById("timelineScoreClaimButton")?.disabled,
    nodeState: document.querySelector('[data-timeline-node="Real-BC16500"]')?.dataset.state,
    nodePurchaseDisabled: document.getElementById("timelineNodePurchaseButton")?.disabled,
    respecDisabled: document.getElementById("timelineRespecButton")?.disabled,
  }));
  assert.equal(beforeDiscovery.active, true, "Timeline should be browsable before the first Eternity");
  assert.equal(beforeDiscovery.discovered, false, "pre-discovery Timeline browsing must not change progression state");
  assert.equal(beforeDiscovery.scoreClaimDisabled, true, "pre-discovery Timeline claims must remain gated");
  assert.equal(beforeDiscovery.nodeState, "timeline-locked", "pre-discovery Timeline nodes must remain locked");
  assert.equal(beforeDiscovery.nodePurchaseDisabled, true, "pre-discovery Timeline purchases must remain gated");
  assert.equal(beforeDiscovery.respecDisabled, true, "pre-discovery Timeline Respec must remain gated");
  await page.click('[data-eternity-tab="milestone"]');

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 1;
    debug.runtime.updateUi();
  });
  const earned = await page.evaluate(() => ({
    entitlement: document.getElementById("eternityChoiceEntitlement")?.textContent,
    status: document.querySelector('[data-eternity-milestone="1-1"] .eternity-milestone-status')?.textContent,
    button: document.querySelector('[data-eternity-choice="1-1"]')?.textContent,
    disabled: document.querySelector('[data-eternity-choice="1-1"]')?.disabled,
  }));
  assert.equal(earned.entitlement, "現在取得可能: 1", "one successful Eternity should expose one first-tier acquisition");
  assert.equal(earned.status, "取得可能", "unowned first-tier Milestones should show as available when entitlement exists");
  assert.equal(earned.button, "取得", "first-tier control should acquire immediately rather than reserve for the next Eternity");
  assert.equal(earned.disabled, false);

  const timelineNavigation = await page.evaluate(() => ({
    mainTabPresent: document.querySelector('[data-tab="timeline"]') !== null,
    hidden: document.querySelector('[data-eternity-tab="timeline"]')?.hidden,
    disabled: document.querySelector('[data-eternity-tab="timeline"]')?.disabled,
    discovered: window.__angleDebug.runtime.timelineDiscovered(),
    unlocked: window.__angleDebug.mainTabIsUnlocked("timeline"),
  }));
  assert.equal(timelineNavigation.mainTabPresent, false, "Timeline should remain absent from top-level navigation");
  assert.equal(timelineNavigation.hidden, false, "the first Eternity should reveal the Timeline subtab");
  assert.equal(timelineNavigation.disabled, false, "the discovered Timeline subtab should be enabled");
  assert.equal(timelineNavigation.discovered, true, "Timeline discovery should persist independently of its nested navigation");
  assert.equal(timelineNavigation.unlocked, false, "Timeline should not be treated as a top-level main tab");
  await page.click('[data-eternity-tab="timeline"]');
  const timelineInitial = await page.evaluate(() => ({
    active: document.querySelector('[data-eternity-panel="timeline"]')?.classList.contains("is-active"),
    milestoneInactive: !document.querySelector('[data-eternity-panel="milestone"]')?.classList.contains("is-active"),
    eternityPanelActive: document.querySelector('[data-panel="eternity"]')?.classList.contains("is-active"),
    mainPanelPresent: document.querySelector('[data-panel="timeline"]') !== null,
    scoreRequirement: document.getElementById("timelineScoreRequirement")?.textContent,
    ipRequirement: document.getElementById("timelineIpRequirement")?.textContent,
    eternityRequirement: document.getElementById("timelineEternityRequirement")?.textContent,
    scoreDisabled: document.getElementById("timelineScoreClaimButton")?.disabled,
    treeNodeCount: document.querySelectorAll(".timeline-node").length,
    eraCount: document.querySelectorAll(".timeline-era").length,
    eraLabel: document.querySelector(".timeline-era-heading")?.textContent,
    realRoute: document.querySelector('[data-timeline-node="Real-BC16500"] .timeline-node-route')?.textContent,
    parallelRoute: document.querySelector('[data-timeline-node="Parallel-BC16500"] .timeline-node-route')?.textContent,
    selectedNode: document.querySelector('.timeline-node[aria-pressed="true"]')?.dataset.timelineNode,
    detailName: document.getElementById("timelineNodeDetailHeading")?.textContent,
    detailButtonDisabled: document.getElementById("timelineNodePurchaseButton")?.disabled,
    detailPurchaseNode: document.getElementById("timelineNodePurchaseButton")?.dataset.timelineNodePurchase,
    realStatus: document.querySelector('[data-timeline-node="Real-BC16500"] .timeline-node-status')?.textContent,
    detailDescription: document.getElementById("timelineNodeDetailDescription")?.textContent,
    detailCurrentEffect: document.getElementById("timelineNodeDetailCurrentEffect")?.textContent,
    cardDescription: document.querySelector('.timeline-node[data-timeline-node="Real-BC16500"] .timeline-node-description')?.textContent,
    warning: document.querySelector(".timeline-respec p")?.textContent,
  }));
  assert.equal(timelineInitial.active, true, "Timeline should be selectable as an Eternity subpanel");
  assert.equal(timelineInitial.milestoneInactive, true, "Timeline selection should hide the Milestone subpanel");
  assert.equal(timelineInitial.eternityPanelActive, true, "Timeline selection should keep the Eternity main panel active");
  assert.equal(timelineInitial.mainPanelPresent, false, "Timeline should not be addressable as a main panel");
  assert.equal(timelineInitial.scoreRequirement, "1.00e20,000 Score", "Timeline should show the exact initial Score requirement");
  assert.equal(timelineInitial.ipRequirement, "1.00e400 IP", "Timeline should show the exact initial IP requirement");
  assert.equal(timelineInitial.eternityRequirement, "2", "Timeline should show the exact initial Eternity requirement");
  assert.equal(timelineInitial.scoreDisabled, true, "an unmet Timeline track should disable its claim control");
  assert.equal(timelineInitial.treeNodeCount, 2, "Timeline should show both first-era route alternatives");
  assert.equal(timelineInitial.eraCount, 1, "the first era should render as one branching group");
  assert.equal(timelineInitial.eraLabel, "BC16500", "the tree should label the visible era");
  assert.equal(timelineInitial.realRoute, "Real");
  assert.equal(timelineInitial.parallelRoute, "Parallel");
  assert.equal(timelineInitial.selectedNode, "Real-BC16500", "Timeline should focus the first node by default");
  assert.equal(timelineInitial.detailName, "惰性の打製石器", "the focused detail should show the selected node");
  assert.equal(timelineInitial.detailPurchaseNode, "Real-BC16500");
  assert.equal(timelineInitial.detailButtonDisabled, true, "a node without available TF should be disabled");
  assert.match(timelineInitial.realStatus || "", /TF不足/);
  assert.match(timelineInitial.detailDescription || "", /IP獲得量.*log10/);
  assert.match(timelineInitial.detailCurrentEffect || "", /未購入/);
  assert.equal(timelineInitial.cardDescription, undefined, "compact nodes should not expand long descriptions");
  assert.match(timelineInitial.warning || "", /TF.*Eternity/, "Timeline should explain the respec consequences");

  await page.click('[data-timeline-node="Parallel-BC16500"]');
  const selectedParallel = await page.evaluate(() => ({
    selected: document.querySelector('.timeline-node[aria-pressed="true"]')?.dataset.timelineNode,
    detailName: document.getElementById("timelineNodeDetailHeading")?.textContent,
    detailDescription: document.getElementById("timelineNodeDetailDescription")?.textContent,
    purchaseNode: document.getElementById("timelineNodePurchaseButton")?.dataset.timelineNodePurchase,
  }));
  assert.equal(selectedParallel.selected, "Parallel-BC16500", "clicking a node should move the focused detail");
  assert.equal(selectedParallel.detailName, "終わらない氷河期");
  assert.match(selectedParallel.detailDescription || "", /IC8.*毎秒.*1e10/);
  assert.equal(selectedParallel.purchaseNode, "Parallel-BC16500");
  await page.click('[data-timeline-node="Real-BC16500"]');

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.scoreLog10 = 25000;
    debug.state.score = Number.MAX_VALUE;
    debug.runtime.updateUi();
  });
  assert.equal(
    await page.evaluate(() => document.getElementById("timelineScoreClaimButton")?.disabled),
    false,
    "a met Score requirement should enable its claim control",
  );
  await page.click("#timelineScoreClaimButton");
  const timelineClaimed = await page.evaluate(() => ({
    claims: window.__angleDebug.state.scoreTfClaims,
    earned: document.getElementById("timelineEarnedTf")?.textContent,
    next: document.getElementById("timelineScoreRequirement")?.textContent,
    score: window.__angleDebug.state.scoreLog10,
    detailButtonDisabled: document.getElementById("timelineNodePurchaseButton")?.disabled,
    detailPurchaseNode: document.getElementById("timelineNodePurchaseButton")?.dataset.timelineNodePurchase,
    detailDescription: document.getElementById("timelineNodeDetailDescription")?.textContent,
    detailCurrentEffect: document.getElementById("timelineNodeDetailCurrentEffect")?.textContent,
  }));
  assert.equal(timelineClaimed.claims, 1, "Timeline claim controls should grant one TF");
  assert.equal(timelineClaimed.earned, "1 TF", "Timeline should display earned TF");
  assert.equal(timelineClaimed.next, "1.00e30,000 Score", "the Score requirement should advance after one claim");
  assert.equal(timelineClaimed.score, 25000, "claiming TF must not consume Score");
  assert.equal(timelineClaimed.detailButtonDisabled, false, "one available TF should make the selected node purchasable");
  assert.equal(timelineClaimed.detailPurchaseNode, "Real-BC16500");
  assert.match(timelineClaimed.detailDescription || "", /IP獲得量.*log10/);
  assert.match(timelineClaimed.detailCurrentEffect || "", /未購入/);

  await page.click("#timelineNodePurchaseButton");
  const realPurchased = await page.evaluate(() => ({
    purchased: window.__angleDebug.state.timelinePurchasedNodes,
    available: document.getElementById("timelineAvailableTf")?.textContent,
    realStatus: document.querySelector('[data-timeline-node="Real-BC16500"] .timeline-node-status')?.textContent,
    parallelStatus: document.querySelector('[data-timeline-node="Parallel-BC16500"] .timeline-node-status')?.textContent,
    realState: document.querySelector('[data-timeline-node="Real-BC16500"]')?.dataset.state,
    parallelState: document.querySelector('[data-timeline-node="Parallel-BC16500"]')?.dataset.state,
    realCurrentEffect: document.getElementById("timelineNodeDetailCurrentEffect")?.textContent,
    purchaseDisabled: document.getElementById("timelineNodePurchaseButton")?.disabled,
  }));
  assert.equal(realPurchased.purchased.length, 1, "a Timeline purchase should record one node");
  assert.equal(realPurchased.purchased[0].id, "Real-BC16500");
  assert.equal(realPurchased.available, "0 TF", "the purchased node should consume available TF");
  assert.equal(realPurchased.realStatus, "購入済み");
  assert.equal(realPurchased.realState, "owned");
  assert.equal(realPurchased.parallelState, "route-conflict", "the same-era alternative should be disabled");
  assert.equal(realPurchased.purchaseDisabled, true);
  assert.match(realPurchased.realCurrentEffect || "", /現在のIP倍率/);
  assert.match(realPurchased.parallelStatus || "", /同じ時代.*ロック/);

  assert.equal(
    await page.evaluate(() => window.__angleDebug.respecTimeline({ save: false })),
    true,
    "Timeline respec should be able to change the selected route",
  );
  const afterTimelineRespec = await page.evaluate(() => ({
    purchased: window.__angleDebug.state.timelinePurchasedNodes.length,
    available: document.getElementById("timelineAvailableTf")?.textContent,
    realState: document.querySelector('[data-timeline-node="Real-BC16500"]')?.dataset.state,
    parallelState: document.querySelector('[data-timeline-node="Parallel-BC16500"]')?.dataset.state,
    purchaseDisabled: document.getElementById("timelineNodePurchaseButton")?.disabled,
  }));
  assert.equal(afterTimelineRespec.purchased, 0);
  assert.equal(afterTimelineRespec.available, "1 TF", "respec should return the node cost to available TF");
  assert.equal(afterTimelineRespec.realState, "available");
  assert.equal(afterTimelineRespec.parallelState, "available");
  assert.equal(afterTimelineRespec.purchaseDisabled, false);
  await page.click('[data-tab="eternity"]');
  await page.click('[data-eternity-tab="milestone"]');

  await page.click('[data-eternity-choice="1-1"]');
  const acquired = await page.evaluate(() => ({
    mask: window.__angleDebug.state.eternityMilestoneMask,
    choice: window.__angleDebug.state.eternityMilestoneChoice,
    status: document.querySelector('[data-eternity-milestone="1-1"] .eternity-milestone-status')?.textContent,
    button: document.querySelector('[data-eternity-choice="1-1"]')?.textContent,
    entitlement: document.getElementById("eternityChoiceEntitlement")?.textContent,
  }));
  assert.equal(acquired.mask, 1, "the player-facing acquisition control should grant ownership immediately");
  assert.equal(acquired.choice, "", "the legacy pending-choice state should not be used by the new UI");
  assert.equal(acquired.status, "取得済み", "the acquired first-tier Milestone should be visibly owned");
  assert.equal(acquired.button, "取得済み", "owned first-tier Milestones should no longer offer acquisition");
  assert.equal(acquired.entitlement, "現在取得できるMilestoneはありません。", "the single earned entitlement should be consumed");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityMilestoneMask = 1;
    debug.state.eternityCount = 5;
    debug.runtime.updateUi();
  });
  const progressed = await page.evaluate(() => ({
    owned11: document.querySelector('[data-eternity-milestone="1-1"] .eternity-milestone-status')?.textContent,
    disabled11: document.querySelector('[data-eternity-choice="1-1"]')?.disabled,
    active2: document.querySelector('[data-eternity-milestone="2"] .eternity-milestone-status')?.textContent,
    effect2: document.querySelector('[data-eternity-milestone="2"] .eternity-milestone-effect')?.textContent,
    locked3: document.querySelector('[data-eternity-milestone="3"] .eternity-milestone-status')?.textContent,
    locked6: document.querySelector('[data-eternity-milestone="6"] .eternity-milestone-status')?.textContent,
    locked7: document.querySelector('[data-eternity-milestone="7"] .eternity-milestone-status')?.textContent,
    entitlement: document.getElementById("eternityChoiceEntitlement")?.textContent,
  }));
  assert.equal(progressed.owned11, "取得済み", "owned first-tier Milestones should be represented as owned");
  assert.equal(progressed.disabled11, true, "owned first-tier Milestones should no longer be selectable");
  assert.equal(progressed.active2, "有効", "count-based Milestone 2 should show active at Eternity 5");
  assert.equal(progressed.effect2, "IC7をクリア済みの状態で開始する", "Milestone 2 should describe the direct IC7 completion state");
  assert.equal(progressed.locked3, "未解放", "later count-based Milestones should remain locked below their threshold");
  assert.equal(progressed.locked6, "未解放", "Milestone 6 should remain locked at Eternity 5");
  assert.equal(progressed.locked7, "未解放", "Milestone 7 should remain locked at Eternity 5");
  assert.equal(progressed.entitlement, "現在取得可能: 2", "unused first-tier acquisition rights should accumulate and remain visible");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 20;
    debug.state.eternityMilestoneMask = 0;
    debug.runtime.updateUi();
  });
  const milestoneFiveAutomation = await page.evaluate(() => ({
    toggleDisabled: document.getElementById("autoBuyInfinityUpgradesToggle")?.disabled,
    toggleChecked: document.getElementById("autoBuyInfinityUpgradesToggle")?.checked,
    automationTabHidden: document.querySelector('[data-tab="automation"]')?.hidden,
  }));
  assert.equal(milestoneFiveAutomation.toggleDisabled, false, "Milestone 5 should enable the Infinity Upgrade automation toggle");
  assert.equal(milestoneFiveAutomation.toggleChecked, false, "Milestone 5 should leave the Infinity Upgrade automation toggle off");
  assert.equal(milestoneFiveAutomation.automationTabHidden, false, "Milestone 5 should keep the permanently discovered Automation tab visible");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityMilestoneMask = 1;
    debug.runtime.updateUi();
  });
  await page.click('[data-tab="automation"]');
  await page.locator("#autoBuyInfinityUpgradesToggle").check();
  assert.equal(
    await page.evaluate(() => window.__angleDebug.state.autoBuyInfinityUpgrades),
    true,
    "the Infinity Upgrade automation toggle should update the persisted setting",
  );
  await page.click('[data-tab="eternity"]');

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 27;
    debug.runtime.updateUi();
  });
  const milestoneSix = await page.evaluate(() => ({
    status: document.querySelector('[data-eternity-milestone="6"] .eternity-milestone-status')?.textContent,
    effect: document.querySelector('[data-eternity-milestone="6"] .eternity-milestone-effect')?.textContent,
  }));
  assert.equal(milestoneSix.status, "有効", "Milestone 6 should become active at Eternity 27");
  assert.match(milestoneSix.effect || "", /IC1.*IC8.*クリア済み/, "Milestone 6 should explain the all-completed IC state");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 43;
    debug.runtime.updateUi();
  });
  const milestoneSevenLocked = await page.evaluate(() => ({
    status: document.querySelector('[data-eternity-milestone="7"] .eternity-milestone-status')?.textContent,
    requirement: document.querySelector('[data-eternity-milestone="7"] .eternity-milestone-requirement')?.textContent,
  }));
  assert.equal(milestoneSevenLocked.status, "未解放", "Milestone 7 should remain locked at Eternity 43");
  assert.equal(milestoneSevenLocked.requirement, "Eternity 44", "Milestone 7 should keep its Eternity 44 requirement while locked");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 44;
    debug.runtime.updateUi();
  });
  const milestoneSeven = await page.evaluate(() => ({
    status: document.querySelector('[data-eternity-milestone="7"] .eternity-milestone-status')?.textContent,
    effect: document.querySelector('[data-eternity-milestone="7"] .eternity-milestone-effect')?.textContent,
  }));
  assert.equal(milestoneSeven.status, "有効", "Milestone 7 should become active at Eternity 44");
  assert.match(milestoneSeven.effect || "", /Eternity 44.*Tower Challenge.*解放階.*クリア済み/, "Milestone 7 should explain auto-completion at normal unlock floors");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 80;
    debug.runtime.updateUi();
  });
  const milestoneEightLocked = await page.evaluate(() => ({
    status: document.querySelector('[data-eternity-milestone="8"] .eternity-milestone-status')?.textContent,
    controlsDisabled: [
      document.getElementById("autoBuyInfiniteAngleSpeedToggle")?.disabled,
      document.getElementById("autoBuyInfiniteAngleVertexToggle")?.disabled,
      document.getElementById("autoBuyInfiniteAngleGainToggle")?.disabled,
      document.getElementById("autoBuildTowerToggle")?.disabled,
    ],
  }));
  assert.equal(milestoneEightLocked.status, "未解放", "Milestone 8 should remain locked at Eternity 80");
  assert.deepEqual(milestoneEightLocked.controlsDisabled, [true, true, true, true], "Milestone 8 controls should remain disabled at Eternity 80");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 81;
    debug.runtime.updateUi();
  });
  const milestoneEight = await page.evaluate(() => ({
    status: document.querySelector('[data-eternity-milestone="8"] .eternity-milestone-status')?.textContent,
    effect: document.querySelector('[data-eternity-milestone="8"] .eternity-milestone-effect')?.textContent,
    controlsDisabled: [
      document.getElementById("autoBuyInfiniteAngleSpeedToggle")?.disabled,
      document.getElementById("autoBuyInfiniteAngleVertexToggle")?.disabled,
      document.getElementById("autoBuyInfiniteAngleGainToggle")?.disabled,
      document.getElementById("autoBuildTowerToggle")?.disabled,
    ],
  }));
  assert.equal(milestoneEight.status, "有効", "Milestone 8 should activate at Eternity 81");
  assert.match(milestoneEight.effect || "", /Eternity 81.*IA.*Tower.*自動/, "Milestone 8 should describe IA and Tower automation");
  assert.deepEqual(milestoneEight.controlsDisabled, [false, false, false, false], "Milestone 8 controls should be available at Eternity 81");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 107;
    debug.runtime.updateUi();
  });
  const milestoneNineLocked = await page.evaluate(() => ({
    status: document.querySelector('[data-eternity-milestone="9"] .eternity-milestone-status')?.textContent,
    requirement: document.querySelector('[data-eternity-milestone="9"] .eternity-milestone-requirement')?.textContent,
  }));
  assert.equal(milestoneNineLocked.status, "未解放", "Milestone 9 should remain locked at Eternity 107");
  assert.equal(milestoneNineLocked.requirement, "Eternity 108", "Milestone 9 should keep its Eternity 108 requirement while locked");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 108;
    debug.runtime.updateUi();
  });
  const milestoneNine = await page.evaluate(() => ({
    status: document.querySelector('[data-eternity-milestone="9"] .eternity-milestone-status')?.textContent,
    effect: document.querySelector('[data-eternity-milestone="9"] .eternity-milestone-effect')?.textContent,
  }));
  assert.equal(milestoneNine.status, "有効", "Milestone 9 should activate at Eternity 108");
  assert.match(milestoneNine.effect || "", /Eternity 108.*1000.*IP.*開始/, "Milestone 9 should describe the 1000 IP starting baseline");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 127;
    debug.runtime.updateUi();
  });
  const milestoneTenLocked = await page.evaluate(() => ({
    status: document.querySelector('[data-eternity-milestone="10"] .eternity-milestone-status')?.textContent,
    requirement: document.querySelector('[data-eternity-milestone="10"] .eternity-milestone-requirement')?.textContent,
  }));
  assert.equal(milestoneTenLocked.status, "未解放", "Milestone 10 should remain locked at Eternity 127");
  assert.equal(milestoneTenLocked.requirement, "Eternity 128", "Milestone 10 should require Eternity 128");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 128;
    debug.runtime.updateUi();
  });
  const milestoneTen = await page.evaluate(() => ({
    status: document.querySelector('[data-eternity-milestone="10"] .eternity-milestone-status')?.textContent,
    effect: document.querySelector('[data-eternity-milestone="10"] .eternity-milestone-effect')?.textContent,
  }));
  assert.equal(milestoneTen.status, "有効", "Milestone 10 should activate at Eternity 128");
  assert.match(milestoneTen.effect || "", /Eternity 128.*Infinity Point.*上限.*解除/, "Milestone 10 should describe Break Eternity without changing the requirement");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.language = "en";
    debug.runtime.appliedLanguage = "";
    debug.runtime.updateUi();
  });
  const english = await page.evaluate(() => ({
    title11: document.querySelector('[data-i18n="eternityMilestone11Name"]')?.textContent,
    title6: document.querySelector('[data-i18n="eternityMilestone6Name"]')?.textContent,
    effect6: document.querySelector('[data-i18n="eternityMilestone6Effect"]')?.textContent,
    effect2: document.querySelector('[data-i18n="eternityMilestone2Effect"]')?.textContent,
    title7: document.querySelector('[data-i18n="eternityMilestone7Name"]')?.textContent,
    effect7: document.querySelector('[data-i18n="eternityMilestone7Effect"]')?.textContent,
    title8: document.querySelector('[data-i18n="eternityMilestone8Name"]')?.textContent,
    effect8: document.querySelector('[data-i18n="eternityMilestone8Effect"]')?.textContent,
    title9: document.querySelector('[data-i18n="eternityMilestone9Name"]')?.textContent,
    effect9: document.querySelector('[data-i18n="eternityMilestone9Effect"]')?.textContent,
    title10: document.querySelector('[data-i18n="eternityMilestone10Name"]')?.textContent,
    effect10: document.querySelector('[data-i18n="eternityMilestone10Effect"]')?.textContent,
    timelineTitle: document.querySelector('[data-i18n="timeline"]')?.textContent,
    timelineTree: document.querySelector('[data-i18n="timelineTree"]')?.textContent,
    realNodeName: document.querySelector('[data-timeline-node="Real-BC16500"] .timeline-node-name')?.textContent,
    parallelNodeName: document.querySelector('[data-timeline-node="Parallel-BC16500"] .timeline-node-name')?.textContent,
    detailLabel: document.querySelector('[data-i18n="timelineNodeDetail"]')?.textContent,
    detailName: document.getElementById("timelineNodeDetailHeading")?.textContent,
    detailDescription: document.getElementById("timelineNodeDetailDescription")?.textContent,
    detailCurrentEffect: document.getElementById("timelineNodeDetailCurrentEffect")?.textContent,
    timelineWarning: document.querySelector('[data-i18n="timelineRespecWarning"]')?.textContent,
    compactRequirement: document.querySelector('[data-i18n="eternityRequirementCompact"]')?.textContent,
    manual: document.getElementById("eternityForcedNote")?.textContent || "",
  }));
  assert.equal(english.compactRequirement, "TC4 clear + 1.80e308 IP", "Eternity requirement should switch to English");
  assert.equal(english.title11, "1-1 Spirit of QoL", "Milestone names should have English copy");
  assert.equal(english.title6, "6 Finite Infinity Challenges", "Milestone 6 should have English copy");
  assert.equal(english.effect2, "Start each Eternity run with IC7 completed", "Milestone 2 English copy should describe the direct IC7 completion state");
  assert.match(english.effect6 || "", /Eternity 27\+.*IC1.*IC8.*completed/, "Milestone 6 English copy should describe the completed IC state");
  assert.equal(english.title7, "7 One-Point Challenges", "Milestone 7 should have English copy");
  assert.match(english.effect7 || "", /Eternity 44\+.*Tower Challenge.*completed.*normal unlock floor/, "Milestone 7 English copy should describe the normal unlock completion state");
  assert.equal(english.title8, "8 Babel of Infinite", "Milestone 8 should have English copy");
  assert.match(english.effect8 || "", /Eternity 81\+.*Infinite Angle.*Tower.*auto/, "Milestone 8 English copy should describe IA and Tower automation");
  assert.equal(english.title9, "9 Worldly Desires", "Milestone 9 should have English copy");
  assert.match(english.effect9 || "", /Eternity 108\+.*1000.*Infinity Points/, "Milestone 9 English copy should describe the 1000 IP starting baseline");
  assert.equal(english.title10, "10 Eternity Is Balance", "Milestone 10 should have English copy");
  assert.match(english.effect10 || "", /Eternity 128\+.*Infinity Point cap.*requirement remains unchanged/, "Milestone 10 English copy should describe the uncapped IP range and unchanged requirement");
  assert.equal(english.timelineTitle, "Timeline", "Timeline should have English copy");
  assert.equal(english.timelineTree, "Timeline Tree", "Timeline Tree should have English copy");
  assert.equal(english.realNodeName, "Inert Stone Tools", "Real node should have English copy");
  assert.equal(english.parallelNodeName, "Endless Ice Age", "Parallel node should have English copy");
  assert.equal(english.detailLabel, "Selected node");
  assert.equal(english.detailName, "Inert Stone Tools");
  assert.match(english.detailDescription || "", /Infinity Point gain.*log10/);
  assert.match(english.detailCurrentEffect || "", /Inactive/);
  assert.match(english.timelineWarning || "", /respec.*node.*TF.*Eternity run/i, "Timeline respec warning should have English copy");
  assert.equal(english.manual, "", "Eternity should not show the repeated manual-execution warning");

  await page.setViewportSize({ width: 412, height: 915 });
  await page.click('[data-eternity-tab="timeline"]');
  const timelineMobile = await page.evaluate(() => ({
    visible: document.querySelector('[data-eternity-panel="timeline"]')?.classList.contains("is-active"),
    gridWidth: document.querySelector(".timeline-node-grid")?.getBoundingClientRect().width || 0,
    nodeWidth: document.querySelector(".timeline-node")?.getBoundingClientRect().width || 0,
    detailWidth: document.getElementById("timelineNodeDetail")?.getBoundingClientRect().width || 0,
    gridColumns: getComputedStyle(document.querySelector(".timeline-node-grid")).gridTemplateColumns,
    branchRouteOrder: Array.from(document.querySelectorAll(".timeline-node"), (node) => node.dataset.route),
    subtabCodes: Array.from(document.querySelectorAll(".eternity-subtab span"), (node) => node.textContent),
    subtabNavWidth: document.querySelector(".eternity-subtabs")?.scrollWidth || 0,
    subtabClientWidth: document.querySelector(".eternity-subtabs")?.clientWidth || 0,
  }));
  assert.equal(timelineMobile.visible, true, "Timeline should remain usable at a mobile viewport");
  assert.deepEqual(timelineMobile.subtabCodes, ["MS", "TL"], "mobile Eternity subtabs should expose compact codes");
  assert.ok(timelineMobile.subtabNavWidth <= timelineMobile.subtabClientWidth, "mobile Eternity subtabs should fit without horizontal overflow");
  assert.equal(timelineMobile.gridColumns.trim().split(/\s+/).length, 1, "Timeline nodes should stack at a narrow viewport");
  assert.deepEqual(timelineMobile.branchRouteOrder, ["Real", "Parallel"], "Timeline should preserve route order on mobile");
  assert.ok(
    timelineMobile.gridWidth > 0 && timelineMobile.nodeWidth > 0 && timelineMobile.detailWidth > 0,
    "Timeline nodes and focused detail should keep a visible mobile layout",
  );
  await page.click('[data-tab="eternity"]');
  await page.click('[data-eternity-tab="milestone"]');
  const mobile = await page.evaluate(() => ({
    visible: document.querySelector('[data-panel="eternity"]')?.classList.contains("is-active"),
    width: document.querySelector('[data-panel="eternity"]')?.getBoundingClientRect().width || 0,
    firstButtonWidth: document.querySelector('[data-eternity-choice="1-2"]')?.getBoundingClientRect().width || 0,
    performWidth: document.getElementById("eternityPerformButton")?.getBoundingClientRect().width || 0,
  }));
  assert.equal(mobile.visible, true, "Eternity top-level panel should remain usable at a mobile viewport");
  assert.ok(mobile.width > 0 && mobile.firstButtonWidth > 0 && mobile.performWidth > 0, "Eternity controls should keep a visible mobile layout");

  console.log("Eternity UI browser test passed");
} finally {
  await context.close();
  await gameTest.close();
}
