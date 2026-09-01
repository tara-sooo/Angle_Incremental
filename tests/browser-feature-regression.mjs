import assert from "node:assert/strict";
import { openGamePage, startGameTest, trackPage } from "./browser-harness.mjs";

const gameTest = await startGameTest();
const errors = [];
const httpFailures = [];
let context;
let page;

async function readUiContract(targetPage) {
  return targetPage.evaluate(() => {
    const mainScroll = document.querySelector(".ui-main-nav .ui-scroll-x");
    const mainScrollBefore = mainScroll?.scrollLeft ?? 0;
    const firstMainTab = mainScroll?.querySelector(".main-tab");
    const firstMainTabHiddenBefore = firstMainTab?.hidden ?? false;
    if (firstMainTab) firstMainTab.hidden = true;
    const hiddenDisplay = firstMainTab ? getComputedStyle(firstMainTab).display : "";
    if (firstMainTab) firstMainTab.hidden = firstMainTabHiddenBefore;

    const focusProbe = document.querySelector(".ui-main-nav .main-tab");
    focusProbe?.focus();
    const focusStyle = focusProbe ? getComputedStyle(focusProbe) : null;
    const mainScrollRect = mainScroll?.getBoundingClientRect();
    const lastMainTab = mainScroll?.querySelector(".main-tab:last-of-type");
    if (mainScroll) mainScroll.scrollLeft = mainScroll.scrollWidth;
    const lastMainTabRect = lastMainTab?.getBoundingClientRect();
    const mainReachableAtEnd = Boolean(
      mainScrollRect
      && lastMainTabRect
      && lastMainTabRect.right <= mainScrollRect.right + 1,
    );
    if (mainScroll) mainScroll.scrollLeft = mainScrollBefore;

    const activePage = document.querySelector(".main-panel.is-active");
    const activePrimaryPages = document.querySelectorAll('.main-panel.is-active.ui-page[data-scroll-owner="primary"]');
    const pageOwners = Array.from(document.querySelectorAll('.main-panel.ui-page[data-scroll-owner="primary"]'));
    const helpPage = document.querySelector('.main-panel[data-panel="help"]');
    const horizontalHosts = Array.from(document.querySelectorAll('.ui-scroll-x[data-scroll-owner="horizontal"]'));
    const subtabStrips = Array.from(document.querySelectorAll(".ui-subtab-strip"));
    const treeNodes = Array.from(document.querySelectorAll(".ui-tree-node"));
    const upgradeRows = Array.from(document.querySelectorAll(".upgrade-row"));
    return {
      activePrimaryPageCount: activePrimaryPages.length,
      activePageOverflow: activePage
        ? [getComputedStyle(activePage).overflowY, getComputedStyle(activePage).overflowX]
        : [],
      pageOwnerCount: pageOwners.length,
      mainPanelCount: document.querySelectorAll(".main-panel").length,
      helpPageOverflow: helpPage
        ? [getComputedStyle(helpPage).overflowY, getComputedStyle(helpPage).overflowX]
        : [],
      mainNavRole: document.querySelector(".ui-main-nav")?.matches("nav") ?? false,
      mainScrollRole: Boolean(mainScroll),
      horizontalHostsValid: horizontalHosts.length > 0 && horizontalHosts.every((host) => {
        const style = getComputedStyle(host);
        return style.overflowX === "auto" && style.overflowY === "hidden";
      }),
      subtabRolesValid: subtabStrips.length > 0 && subtabStrips.every((strip) => (
        strip.classList.contains("ui-scroll-x")
        && strip.dataset.scrollOwner === "horizontal"
      )),
      upgradeRowsHaveSharedHook: upgradeRows.length > 0 && upgradeRows.every((row) => row.classList.contains("upgrade-row")),
      treeNodesHaveSharedHook: treeNodes.length > 0 && treeNodes.every((node) => node.classList.contains("ui-tree-node")),
      treeCount: document.querySelectorAll(".ui-tree").length,
      selectedDetailCount: document.querySelectorAll(".ui-selected-detail").length,
      playfieldCount: document.querySelectorAll(".ui-playfield").length,
      hiddenDisplay,
      focusActive: document.activeElement === focusProbe,
      focusOutlineWidth: focusStyle?.outlineWidth ?? "",
      touchTargetMinimums: [...document.querySelectorAll(".ui-main-nav .main-tab, .ui-subtab-strip .subtab, .upgrade-row, .ui-tree-node")]
        .filter((control) => control.getClientRects().length > 0)
        .every((control) => control.getBoundingClientRect().height >= 40),
      mainReachableAtEnd,
      renderTextAvailable: typeof window.render_game_to_text === "function"
        && window.render_game_to_text().length > 0,
      eternityPageRole: Boolean(document.querySelector('.main-panel[data-panel="eternity"].ui-page[data-scroll-owner="primary"]')),
      timelineNoLongerPage: Boolean(document.querySelector('.eternity-subpanel[data-eternity-panel="timeline"]:not(.ui-page):not([data-scroll-owner])')),
    };
  });
}

async function readScrollOwnership(targetPage) {
  return targetPage.evaluate(() => {
    const page = document.querySelector('.main-panel.is-active.ui-page[data-scroll-owner="primary"]');
    const mainPanels = document.querySelector(".main-panels");
    const isVisible = (node) => node.getClientRects().length > 0;
    const before = page?.scrollTop ?? 0;
    const maxScrollTop = page ? Math.max(0, page.scrollHeight - page.clientHeight) : 0;
    const nestedVerticalOwners = page
      ? Array.from(page.querySelectorAll("*"))
        .filter((node) => isVisible(node) && ["auto", "scroll"].includes(getComputedStyle(node).overflowY))
        .map((node) => node.id || String(node.className) || node.tagName)
      : [];
    const finalContent = page?.dataset.panel === "angle"
      ? page.querySelector(".reset-dock")
      : page?.dataset.panel === "help"
        ? page.querySelector("#helpSections > .help-article")
        : page?.lastElementChild;
    if (page) page.scrollTop = maxScrollTop;
    const pageRect = page?.getBoundingClientRect();
    const finalRect = finalContent?.getBoundingClientRect();
    const mainPanelsStyle = mainPanels ? getComputedStyle(mainPanels) : null;
    const sharedSections = page
      ? Array.from(page.querySelectorAll(".ui-section:not(.break-cap-row)")).filter(isVisible)
      : [];
    const result = {
      pageOverflow: page ? [getComputedStyle(page).overflowY, getComputedStyle(page).overflowX] : [],
      pageScrollHeight: page?.scrollHeight ?? 0,
      pageClientHeight: page?.clientHeight ?? 0,
      pageAtEnd: page ? page.scrollTop >= maxScrollTop - 1 : false,
      finalContentReachable: Boolean(
        pageRect
        && finalRect
        && finalRect.top >= pageRect.top - 1
        && finalRect.bottom <= pageRect.bottom + 1,
      ),
      nestedVerticalOwners,
      mainPanelsOverflow: mainPanelsStyle ? [mainPanelsStyle.overflowY, mainPanelsStyle.overflowX] : [],
      visibleSectionsBorderless: sharedSections.length > 0 && sharedSections.every((section) => {
        const style = getComputedStyle(section);
        return [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth]
          .every((width) => width === "0px")
          && style.backgroundImage === "none"
          && style.boxShadow === "none";
      }),
      helpNavRole: document.querySelector("#helpNav")?.matches('.ui-scroll-x[data-scroll-owner="horizontal"]') ?? false,
    };
    if (page) page.scrollTop = before;
    return result;
  });
}

try {
  ({ context, page } = await openGamePage(gameTest.browser, gameTest.origin, {
    viewport: { width: 1280, height: 900 },
    stubFonts: true,
    freezeAnimationFrame: false,
  }));
  trackPage(page, "main", errors, httpFailures);
  await page.evaluate(() => window.__angleDebug.runtime.closeUpdateModal?.());
  await page.evaluate(() => {
    const panel = document.querySelector("#offlineReportPanel");
    if (panel && !panel.hidden) document.querySelector("#offlineReportClose")?.click();
  });
  await page.locator('[data-tab="settings"]').click();
  const helpVisibilityToggle = page.locator('#tabVisibilityList input[data-main-tab-visibility="help"]');
  const settingsVisibilityToggle = page.locator('#tabVisibilityList input[data-main-tab-visibility="settings"]');
  const helpTab = page.locator('[data-tab="help"]');
  const settingsTab = page.locator('[data-tab="settings"]');
  assert.equal(await helpVisibilityToggle.isChecked(), true, "HELP should start enabled in Settings");
  assert.equal(await settingsVisibilityToggle.isDisabled(), true, "SET should not be hideable");
  assert.equal(await settingsTab.isVisible(), true, "SET should remain visible");
  await helpVisibilityToggle.uncheck();
  assert.equal(await helpVisibilityToggle.isChecked(), false, "unchecking HELP should update the real checkbox");
  const hiddenHelp = await page.evaluate(() => {
    const help = document.querySelector('[data-tab="help"]');
    const visibleTabs = Array.from(document.querySelectorAll(".main-tab"))
      .filter((button) => button.getClientRects().length > 0)
      .map((button) => button.dataset.tab);
    const saved = JSON.parse(localStorage.getItem("angle-incremental-save") || "null");
    return {
      hidden: help?.hidden ?? false,
      display: help ? getComputedStyle(help).display : "",
      rectCount: help?.getClientRects().length ?? 0,
      visibleTabs,
      stateHiddenTabs: [...window.__angleDebug.state.hiddenTabs],
      savedHiddenTabs: saved?.state?.hiddenTabs ?? [],
    };
  });
  assert.equal(hiddenHelp.hidden, true, "HELP should receive the hidden attribute");
  assert.equal(hiddenHelp.display, "none", "hidden HELP should be removed by CSS");
  assert.equal(hiddenHelp.rectCount, 0, "hidden HELP should have no rendered client rect");
  assert.equal(await helpTab.isVisible(), false, "hidden HELP should not be visible to Playwright");
  assert.equal(hiddenHelp.visibleTabs.includes("help"), false, "hidden HELP should leave the rendered navigation order");
  assert.deepEqual(hiddenHelp.stateHiddenTabs, ["help"], "hiddenTabs should track the Settings change");
  assert.deepEqual(hiddenHelp.savedHiddenTabs, ["help"], "hiddenTabs should be saved immediately");
  assert.equal(await settingsTab.isVisible(), true, "SET should remain visible after hiding HELP");
  assert.equal(await settingsVisibilityToggle.isDisabled(), true, "SET should remain disabled in the visibility list");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__angleDebug?.state && window.__angleDebug?.ready));
  await page.evaluate(() => window.__angleDebug.ready);
  await page.evaluate(() => {
    const panel = document.querySelector("#offlineReportPanel");
    if (panel && !panel.hidden) document.querySelector("#offlineReportClose")?.click();
  });
  await page.locator('[data-tab="settings"]').click();
  const reloadedHelpVisibilityToggle = page.locator('#tabVisibilityList input[data-main-tab-visibility="help"]');
  assert.equal(await reloadedHelpVisibilityToggle.isChecked(), false, "HELP should remain unchecked after reload");
  assert.equal(await page.locator('[data-tab="help"]').isVisible(), false, "HELP should remain hidden after reload");
  const reloadedHiddenHelp = await page.evaluate(() => {
    const help = document.querySelector('[data-tab="help"]');
    return {
      hidden: help?.hidden ?? false,
      display: help ? getComputedStyle(help).display : "",
      stateHiddenTabs: [...window.__angleDebug.state.hiddenTabs],
    };
  });
  assert.equal(reloadedHiddenHelp.hidden, true, "reload should restore HELP's hidden attribute");
  assert.equal(reloadedHiddenHelp.display, "none", "reload should restore HELP's rendered absence");
  assert.deepEqual(reloadedHiddenHelp.stateHiddenTabs, ["help"], "reload should restore hiddenTabs");
  await reloadedHelpVisibilityToggle.check();
  assert.equal(await reloadedHelpVisibilityToggle.isChecked(), true, "re-checking HELP should update the real checkbox");
  assert.equal(await page.locator('[data-tab="help"]').isVisible(), true, "re-checking HELP should render the tab again");
  const restoredHelp = await page.evaluate(() => {
    const help = document.querySelector('[data-tab="help"]');
    return {
      hidden: help?.hidden ?? true,
      display: help ? getComputedStyle(help).display : "",
      rectCount: help?.getClientRects().length ?? 0,
      stateHiddenTabs: [...window.__angleDebug.state.hiddenTabs],
    };
  });
  assert.equal(restoredHelp.hidden, false, "re-checking HELP should clear its hidden attribute");
  assert.notEqual(restoredHelp.display, "none", "re-checking HELP should restore its display style");
  assert.ok(restoredHelp.rectCount > 0, "re-checking HELP should restore a rendered client rect");
  assert.deepEqual(restoredHelp.stateHiddenTabs, [], "re-checking HELP should clear hiddenTabs");
  assert.equal(await page.locator('[data-tab="settings"]').isVisible(), true, "SET should remain visible after restoring HELP");
  assert.equal(await page.locator('#tabVisibilityList input[data-main-tab-visibility="settings"]').isDisabled(), true, "SET should remain unhideable");

  const helpUi = await page.evaluate(() => {
    const { state, runtime, switchMainTab, switchInfinitySubtab, switchChallengeSubtab } = window.__angleDebug;
    const originalState = structuredClone(state);
    const originalMainTab = runtime.activeMainTab;
    const originalInfinitySubtab = runtime.activeInfinitySubtab;
    const originalHelpContext = runtime.helpContextMainTab;
    const readHelp = () => ({
      topics: Array.from(document.querySelectorAll("#helpNav button[data-help-topic]"), (node) => node.dataset.helpTopic),
      navCount: document.querySelectorAll("#helpNav button[data-help-topic]").length,
      articleCount: document.querySelectorAll("#helpSections > .help-article").length,
      articleTopic: document.querySelector("#helpSections > .help-article")?.dataset.helpTopic ?? "",
      anchorCount: document.querySelectorAll("#helpNav a").length,
      accordionCount: document.querySelectorAll("#helpSections details").length,
      current: document.querySelector("#helpNav button[aria-current]")?.textContent?.trim() ?? "",
      context: document.querySelector("#helpContext")?.textContent?.trim() ?? "",
      text: document.querySelector("#helpSections > .help-article")?.textContent?.trim() ?? "",
    });

    switchMainTab("angle");
    switchMainTab("help");
    window.advanceTime(0);
    const fresh = readHelp();

    Object.assign(state, {
      generationCount: 1,
      coreBoostCount: 1,
      infinityCount: 1,
      infinityUpgradeMask: 1 << 5,
      completedChallenges: 1,
      infiniteCapBroken: true,
      infiniteAngleUnlocked: true,
      towerFloor: 3,
      completedTowerChallenges: 1,
      eternityCount: 1,
      eternityMilestoneMask: 7,
      unlockedMainTabs: ["infinity", "challenges", "automation", "eternity", "timeline"],
      automationEnabled: true,
      activeChallenge: 0,
      activeTowerChallenge: 0,
      language: "ja",
    });
    switchMainTab("infinity");
    switchInfinitySubtab("tower");
    window.advanceTime(0);
    switchMainTab("help");
    window.advanceTime(0);
    const upper = readHelp();

    state.infinityCount = 0;
    state.infinityUpgradeMask = 0;
    state.completedChallenges = 0;
    state.infiniteCapBroken = false;
    state.infiniteAngleUnlocked = false;
    state.towerFloor = 0;
    state.completedTowerChallenges = 0;
    state.eternityCount = 1;
    state.unlockedMainTabs = ["timeline"];
    window.advanceTime(0);
    const afterReset = readHelp();

    state.language = "en";
    window.advanceTime(0);
    const english = readHelp();

    switchMainTab("challenges");
    switchChallengeSubtab("tc");
    window.advanceTime(0);
    switchMainTab("help");
    window.advanceTime(0);
    const englishChallenges = readHelp();

    Object.assign(state, originalState);
    runtime.helpContextMainTab = originalHelpContext;
    switchInfinitySubtab(originalInfinitySubtab);
    switchMainTab(originalMainTab);
    window.advanceTime(0);
    runtime.saveGame("manual");
    return { fresh, upper, afterReset, english, englishChallenges };
  });
  assert.deepEqual(
    helpUi.fresh.topics,
    ["angle", "generation", "resets", "offline", "notation"],
    "fresh Help should show only immediate and always-available topics",
  );
  assert.equal(helpUi.fresh.navCount, helpUi.fresh.topics.length, "fresh Help navigation should list each visible topic once");
  assert.equal(helpUi.fresh.articleCount, 1, "fresh Help should render one focused article");
  assert.equal(helpUi.fresh.anchorCount, 0, "fresh Help should not keep a second anchor navigation model");
  assert.equal(helpUi.fresh.accordionCount, 0, "fresh Help should not keep duplicate accordion content");
  assert.equal(helpUi.fresh.articleTopic, "angle", "Help should open the topic matching the previous main tab");
  assert.equal(helpUi.fresh.current, "The Angle と通常強化", "Help should mark the contextual topic");
  assert.doesNotMatch(helpUi.fresh.text, /Infinity Upgrade|Eternity Milestone|Tower Challenge/, "fresh Help should omit undiscovered spoilers");
  assert.equal(helpUi.upper.topics.length, 17, "upper progression should expose every shipped Help topic");
  assert.equal(helpUi.upper.articleCount, 1, "upper Help should keep one focused article");
  assert.equal(helpUi.upper.anchorCount, 0, "upper Help should keep one navigation model");
  assert.equal(helpUi.upper.accordionCount, 0, "upper Help should keep one content surface");
  assert.equal(helpUi.upper.articleTopic, "tower", "Help should focus the previous Infinity subtab");
  assert.equal(helpUi.upper.current, "Tower", "Help navigation should mark the previous subtab topic");
  assert.equal(helpUi.upper.context, "現在の焦点: Tower", "Help should translate its contextual focus");
  assert.deepEqual(helpUi.afterReset.topics, helpUi.upper.topics, "discovered Help topics should survive a reset");
  assert.match(helpUi.english.current, /Tower/, "Help navigation should switch to English");
  assert.match(helpUi.english.context, /Current focus: Tower/, "Help context should switch language with the guide");
  assert.equal(helpUi.englishChallenges.articleTopic, "tower-challenges", "Help should focus the first-era challenge topic from the challenge subtab");
  assert.match(helpUi.englishChallenges.text, /TC4|1e7777/, "English Help should contain the shipped TC4 guidance when selected");

  await page.locator('[data-tab="help"]').click();
  await page.locator('#helpNav button[data-help-topic="offline"]').click();
  await page.evaluate(() => window.advanceTime(0));
  const clickedHelp = await page.evaluate(() => ({
    articleTopic: document.querySelector("#helpSections > .help-article")?.dataset.helpTopic ?? "",
    current: document.querySelector("#helpNav button[aria-current]")?.dataset.helpTopic ?? "",
    articleCount: document.querySelectorAll("#helpSections > .help-article").length,
    activeElement: document.activeElement?.id ?? "",
    context: document.querySelector("#helpContext")?.textContent?.trim() ?? "",
  }));
  assert.deepEqual(clickedHelp, {
    articleTopic: "offline",
    current: "offline",
    articleCount: 1,
    activeElement: "helpArticle",
    context: "現在の焦点: Offline Progress",
  }, "clicking a Help topic should expose and focus one article");
  const notationButton = page.locator('#helpNav button[data-help-topic="notation"]');
  await notationButton.focus();
  await page.keyboard.press("Enter");
  const keyboardHelp = await page.evaluate(() => ({
    articleTopic: document.querySelector("#helpSections > .help-article")?.dataset.helpTopic ?? "",
    current: document.querySelector("#helpNav button[aria-current]")?.dataset.helpTopic ?? "",
    activeElement: document.activeElement?.id ?? "",
  }));
  assert.deepEqual(keyboardHelp, {
    articleTopic: "notation",
    current: "notation",
    activeElement: "helpArticle",
  }, "Help topic selection should work from keyboard activation");

  await page.evaluate(() => {
    const { state, runtime, switchMainTab, switchInfinitySubtab } = window.__angleDebug;
    window.__helpLayoutOriginal = {
      state: structuredClone(state),
      mainTab: runtime.activeMainTab,
      infinitySubtab: runtime.activeInfinitySubtab,
      helpContext: runtime.helpContextMainTab,
    };
    Object.assign(state, {
      infinityCount: 1,
      infinityUpgradeMask: 0x7fff,
      completedChallenges: 0xff,
      infiniteCapBroken: true,
      infiniteAngleUnlocked: true,
      towerFloor: 12,
      completedTowerChallenges: 0xf,
      eternityCount: 1,
      eternityMilestoneMask: 0x3ff,
      unlockedMainTabs: ["infinity", "challenges", "automation", "eternity", "timeline"],
      automationEnabled: true,
      activeChallenge: 0,
      activeTowerChallenge: 0,
      achievementMask: 0x7fffffff,
      achievementMaskHigh: 0x3ff,
      floatingTexts: [],
      language: "ja",
    });
    switchMainTab("infinity");
    switchInfinitySubtab("tower");
    switchMainTab("help");
    window.advanceTime(0);
  });
  const measureHelpLayout = () => page.evaluate(() => {
    const panel = document.querySelector('[data-panel="help"]');
    const nav = document.querySelector("#helpNav");
    const sections = document.querySelector("#helpSections");
    const bodies = Array.from(document.querySelectorAll("#helpSections .help-section-body"));
    return {
      topicCount: nav?.querySelectorAll("button[data-help-topic]").length ?? 0,
      articleCount: sections?.querySelectorAll(":scope > .help-article").length ?? 0,
      articleTopic: sections?.querySelector(":scope > .help-article")?.dataset.helpTopic ?? "",
      navHeight: nav?.getBoundingClientRect().height ?? 0,
      navClientWidth: nav?.clientWidth ?? 0,
      navScrollWidth: nav?.scrollWidth ?? 0,
      panelOverflow: Boolean(panel && panel.scrollWidth > panel.clientWidth + 1),
      bodyOverflow: bodies.some((body) => body.scrollWidth > body.clientWidth + 1),
      navButtonHeights: Array.from(document.querySelectorAll("#helpNav button[data-help-topic]"), (button) => button.getBoundingClientRect().height),
    };
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  const desktopHelpLayout = await measureHelpLayout();
  const desktopHelpScrollOwnership = await readScrollOwnership(page);
  assert.equal(desktopHelpLayout.topicCount, 17, "desktop Help should render every discovered topic");
  assert.equal(desktopHelpLayout.articleCount, 1, "desktop Help should render one focused article");
  assert.equal(desktopHelpLayout.articleTopic, "tower", "desktop Help should retain the contextual topic");
  assert.equal(desktopHelpLayout.panelOverflow, false, "desktop Help should not overflow horizontally");
  assert.equal(desktopHelpLayout.bodyOverflow, false, "desktop Help text should not overflow its section");
  assert.equal(desktopHelpScrollOwnership.pageOverflow.join("|"), "auto|hidden", "desktop Help should use the page as its vertical owner");
  assert.ok(desktopHelpScrollOwnership.pageScrollHeight >= desktopHelpScrollOwnership.pageClientHeight, "desktop Help should have a page-owned vertical surface");
  assert.equal(desktopHelpScrollOwnership.pageAtEnd, true, "desktop Help should reach its final topic through the page owner");
  assert.equal(desktopHelpScrollOwnership.finalContentReachable, true, "desktop Help final content should remain visible at scroll end");
  assert.deepEqual(desktopHelpScrollOwnership.nestedVerticalOwners, [], "desktop Help should have no nested vertical scroll trap");
  assert.deepEqual(desktopHelpScrollOwnership.mainPanelsOverflow, ["hidden", "hidden"], "desktop main panels should not own page scrolling");
  assert.equal(desktopHelpScrollOwnership.helpNavRole, true, "desktop Help topics should use the shared horizontal role");
  await page.setViewportSize({ width: 1280, height: 420 });
  const compactDesktopHelpScrollOwnership = await readScrollOwnership(page);
  assert.ok(compactDesktopHelpScrollOwnership.pageScrollHeight > compactDesktopHelpScrollOwnership.pageClientHeight, "compact desktop Help should scroll through the page owner");
  assert.equal(compactDesktopHelpScrollOwnership.pageAtEnd, true, "compact desktop Help should reach the article end");
  assert.equal(compactDesktopHelpScrollOwnership.finalContentReachable, true, "compact desktop Help article should remain reachable at scroll end");
  assert.deepEqual(compactDesktopHelpScrollOwnership.nestedVerticalOwners, [], "compact desktop Help should have no nested vertical scroll trap");
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileHelpLayout = await measureHelpLayout();
  const mobileHelpScrollOwnership = await readScrollOwnership(page);
  assert.equal(mobileHelpLayout.topicCount, 17, "mobile Help should render every discovered topic");
  assert.equal(mobileHelpLayout.articleCount, 1, "mobile Help should render one focused article");
  assert.equal(mobileHelpLayout.articleTopic, "tower", "mobile Help should retain the contextual topic");
  assert.ok(mobileHelpLayout.navScrollWidth > mobileHelpLayout.navClientWidth, "mobile Help topics should scroll in one row");
  assert.ok(mobileHelpLayout.navHeight <= 60, "mobile Help topics should keep the navigation compact");
  assert.equal(mobileHelpLayout.panelOverflow, false, "mobile Help should not overflow horizontally");
  assert.equal(mobileHelpLayout.bodyOverflow, false, "mobile Help text should not overflow its section");
  assert.ok(mobileHelpLayout.navButtonHeights.every((height) => height >= 40), "mobile Help topics should remain touch-safe");
  assert.equal(mobileHelpScrollOwnership.pageOverflow.join("|"), "auto|hidden", "mobile Help should use the page as its vertical owner");
  assert.ok(mobileHelpScrollOwnership.pageScrollHeight >= mobileHelpScrollOwnership.pageClientHeight, "mobile Help should have a page-owned vertical surface");
  assert.equal(mobileHelpScrollOwnership.pageAtEnd, true, "mobile Help should reach its final topic through the page owner");
  assert.equal(mobileHelpScrollOwnership.finalContentReachable, true, "mobile Help final content should remain visible at scroll end");
  assert.deepEqual(mobileHelpScrollOwnership.nestedVerticalOwners, [], "mobile Help should have no nested vertical scroll trap");
  assert.deepEqual(mobileHelpScrollOwnership.mainPanelsOverflow, ["hidden", "hidden"], "mobile main panels should not own page scrolling");
  assert.equal(mobileHelpScrollOwnership.helpNavRole, true, "mobile Help topics should use the shared horizontal role");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => {
    const { state, runtime, switchMainTab, switchInfinitySubtab } = window.__angleDebug;
    const original = window.__helpLayoutOriginal;
    Object.assign(state, original.state);
    runtime.helpContextMainTab = original.helpContext;
    switchInfinitySubtab(original.infinitySubtab);
    switchMainTab(original.mainTab);
    delete window.__helpLayoutOriginal;
    window.advanceTime(0);
  });

  const desktopButtonInteraction = await page.evaluate(() => {
    const selectors = ["[data-tab=angle]", "#speedUpgrade"];
    return selectors.map((selector) => {
      const button = document.querySelector(selector);
      const styles = getComputedStyle(button);
      return {
        selector,
        transitionDurations: styles.transitionDuration.split(",").map((value) => value.trim()),
        touchAction: styles.touchAction,
        hoverCapable: window.matchMedia("(hover: hover)").matches,
        finePointer: window.matchMedia("(pointer: fine)").matches,
      };
    });
  });
  assert.ok(
    desktopButtonInteraction.every((button) => button.hoverCapable && button.finePointer),
    "the desktop smoke context should expose a fine hover pointer",
  );
  assert.ok(
    desktopButtonInteraction.every((button) => button.transitionDurations.every((duration) => duration === "0.12s")),
    "desktop buttons should retain their 120ms transitions",
  );
  assert.ok(
    desktopButtonInteraction.every((button) => button.touchAction === "manipulation"),
    "desktop buttons should still use touch-action manipulation",
  );
  const infinityAutomationThreshold = await page.evaluate(() => {
    const { state, applySetting, switchMainTab } = window.__angleDebug;
    switchMainTab("automation");
    const input = document.querySelector("#autoInfinityPointThresholdInput");
    applySetting("numberFormat", "scientific");
    applySetting("autoInfinityPointThreshold", "1e100");
    const scientificValue = input?.value ?? "";
    applySetting("numberFormat", "compact");
    applySetting("autoInfinityPointThreshold", "1e9");
    const compactValue = input?.value ?? "";
    applySetting("autoInfinityPointThreshold", compactValue);
    return {
      inputType: input?.type ?? "",
      inputWidth: input?.getBoundingClientRect().width ?? 0,
      inputHeight: input?.getBoundingClientRect().height ?? 0,
      scientificValue,
      compactValue,
      thresholdLog10: state.autoInfinityPointThresholdLog10,
    };
  });
  assert.equal(infinityAutomationThreshold.inputType, "text", "Infinity automation thresholds should use text input for exponent notation");
  assert.ok(infinityAutomationThreshold.inputWidth >= 110, "Infinity automation threshold input should keep the numeric field width");
  assert.ok(infinityAutomationThreshold.inputHeight >= 34, "Infinity automation threshold input should keep the numeric field height");
  assert.equal(infinityAutomationThreshold.scientificValue, "1.00e100", "scientific Infinity thresholds should display in exponent notation");
  assert.equal(infinityAutomationThreshold.compactValue, "1.00B", "compact Infinity thresholds should display in compact notation");
  assert.equal(infinityAutomationThreshold.thresholdLog10, 9, "compact Infinity threshold input should round-trip through log space");

  const tabStructure = await page.evaluate(() => {
    const mainTabs = Array.from(document.querySelectorAll("[data-tab]"), (button) => button.dataset.tab);
    const infinityTabs = Array.from(document.querySelectorAll(".infinity-subtab"), (button) => button.dataset.infinityTab);
    const challengeTabs = Array.from(document.querySelectorAll(".challenge-subtab"), (button) => button.dataset.challengeTab);
    const statisticsTabs = Array.from(document.querySelectorAll(".statistics-subtab"), (button) => button.dataset.statisticsTab);
    return { mainTabs, infinityTabs, challengeTabs, statisticsTabs };
  });
  assert.deepEqual(
    tabStructure.mainTabs,
    ["angle", "infinity", "eternity", "challenges", "automation", "statistics", "achievements", "help", "settings"],
    "main tabs should omit the dormant Time Flux tab while retaining Eternity",
  );
  assert.deepEqual(tabStructure.infinityTabs, ["upgrades", "angle", "tower"], "Infinity subtabs should be ordered Upgrades, IA, Tower");
  assert.deepEqual(tabStructure.challengeTabs, ["ic", "tc"], "Challenges should expose IC and TC subtabs");
  assert.deepEqual(tabStructure.statisticsTabs, ["overview", "challenges", "eternity"], "Statistics subtabs should be ordered Overview, Challenge Records, Eternity Records");
  await page.evaluate(() => {
    window.__angleDebug.switchMainTab("angle");
    window.advanceTime(0);
  });
  const desktopUiContract = await readUiContract(page);
  const desktopAngleScrollOwnership = await readScrollOwnership(page);
  assert.equal(desktopUiContract.activePrimaryPageCount, 1, "desktop should expose one primary owner for the active page");
  assert.equal(desktopUiContract.pageOwnerCount, desktopUiContract.mainPanelCount, "every main page should declare the primary owner");
  assert.equal(desktopUiContract.activePageOverflow.join("|"), "auto|hidden", "desktop page surfaces should own vertical scrolling");
  assert.equal(desktopUiContract.helpPageOverflow.join("|"), "auto|hidden", "Help should use the shared page scroll contract");
  assert.equal(desktopUiContract.mainNavRole, true, "main navigation should expose the shared role");
  assert.equal(desktopUiContract.mainScrollRole, true, "main navigation should expose a shared horizontal scroll host");
  assert.equal(desktopUiContract.horizontalHostsValid, true, "desktop horizontal hosts should hide vertical overflow");
  assert.equal(desktopUiContract.subtabRolesValid, true, "subtab strips should share the horizontal role");
  assert.equal(desktopUiContract.upgradeRowsHaveSharedHook, true, "purchase rows should retain the shared upgrade-row hook");
  assert.equal(desktopUiContract.treeNodesHaveSharedHook, true, "rendered tree nodes should use the shared node hook");
  assert.ok(desktopUiContract.treeCount >= 1, "desktop should render a shared tree surface");
  assert.ok(desktopUiContract.selectedDetailCount >= 1, "desktop should render a selected-detail surface");
  assert.equal(desktopUiContract.playfieldCount, 2, "ANGLE and IA should expose the shared playfield role");
  assert.equal(desktopUiContract.hiddenDisplay, "none", "hidden shared navigation members should leave layout");
  assert.equal(desktopUiContract.focusActive, true, "shared navigation controls should remain keyboard focusable");
  assert.ok(Number.parseFloat(desktopUiContract.focusOutlineWidth) >= 2, "shared navigation focus should remain visible");
  assert.equal(desktopUiContract.touchTargetMinimums, true, "shared controls should retain touch-sized targets");
  assert.equal(desktopUiContract.mainReachableAtEnd, true, "the main navigation end should remain reachable");
  assert.equal(desktopUiContract.renderTextAvailable, true, "the render_game_to_text debug surface should remain available");
  assert.equal(desktopUiContract.eternityPageRole, true, "runtime Eternity should use the shared page role");
  assert.equal(desktopUiContract.timelineNoLongerPage, true, "reparented Timeline should not retain page ownership");
  assert.deepEqual(desktopAngleScrollOwnership.pageOverflow, ["auto", "hidden"], "desktop ANGLE should use the page as its vertical owner");
  assert.deepEqual(desktopAngleScrollOwnership.nestedVerticalOwners, [], "desktop ANGLE should have no nested vertical scroll trap");
  assert.deepEqual(desktopAngleScrollOwnership.mainPanelsOverflow, ["hidden", "hidden"], "desktop ANGLE main panels should not own page scrolling");
  assert.equal(desktopAngleScrollOwnership.visibleSectionsBorderless, true, "desktop shared sections should avoid redundant frames");
  assert.equal(desktopAngleScrollOwnership.finalContentReachable, true, "desktop ANGLE final actions should remain reachable");
  const angleUpgradeContract = await page.evaluate(() => {
    const { state, runtime, switchMainTab } = window.__angleDebug;
    const originalState = structuredClone(state);
    const originalTab = runtime.activeMainTab;
    const rows = Array.from(document.querySelectorAll("#normalUpgradeList .upgrade-row"));
    const slotOrder = (row) => [...row.children].map((child) => [
      "upgrade-row-name",
      "upgrade-row-detail",
      "upgrade-row-cost",
      "upgrade-row-action",
    ].find((slot) => child.classList.contains(slot)) ?? "");
    const readRows = () => rows.map((row) => {
      const style = getComputedStyle(row);
      return {
        kind: row.dataset.upgradeKind,
        slots: slotOrder(row).join(","),
        action: row.querySelector(".upgrade-row-action")?.textContent?.trim() ?? "",
        disabled: row.disabled,
        height: row.getBoundingClientRect().height,
        overflow: row.scrollWidth > row.clientWidth + 1,
        backgroundImage: style.backgroundImage,
        borderColor: style.borderInlineStartColor,
      };
    });
    Object.assign(state, {
      activeChallenge: 0,
      activeTowerChallenge: 0,
      score: Number.MAX_VALUE,
      scoreLog10: 300,
      language: "ja",
    });
    switchMainTab("angle");
    window.advanceTime(0);
    const purchasable = readRows();
    const buyAll = document.querySelector("#buyAllUpgrade");
    const buyAllRect = buyAll?.getBoundingClientRect();
    const buyAllStyle = buyAll ? getComputedStyle(buyAll) : null;
    const buyAllWide = {
      disabled: Boolean(buyAll?.disabled),
      width: buyAllRect?.width ?? 0,
      parentWidth: buyAll?.parentElement?.getBoundingClientRect().width ?? 0,
      height: buyAllRect?.height ?? 0,
      backgroundImage: buyAllStyle?.backgroundImage ?? "",
    };
    state.score = 0;
    state.scoreLog10 = -Infinity;
    window.advanceTime(0);
    const japaneseUnavailable = readRows();
    const unavailableBuyAllDisabled = Boolean(buyAll?.disabled);
    state.language = "en";
    window.advanceTime(0);
    const englishUnavailable = readRows();
    Object.assign(state, originalState);
    switchMainTab(originalTab);
    window.advanceTime(0);
    return { purchasable, buyAllWide, japaneseUnavailable, unavailableBuyAllDisabled, englishUnavailable };
  });
  assert.deepEqual(angleUpgradeContract.purchasable.map((row) => row.kind), ["speed", "vertex", "gain"], "ANGLE actions should keep their three identities");
  assert.ok(angleUpgradeContract.purchasable.every((row) => row.slots === "upgrade-row-name,upgrade-row-detail,upgrade-row-cost,upgrade-row-action"), "ANGLE rows should expose the canonical four-slot order");
  assert.ok(angleUpgradeContract.purchasable.every((row) => row.action === "購入" && !row.disabled), "affordable ANGLE rows should expose the purchase action");
  assert.ok(angleUpgradeContract.purchasable.every((row) => row.height <= 56 && !row.overflow), "desktop ANGLE rows should stay dense without overflow");
  assert.equal(new Set(angleUpgradeContract.purchasable.map((row) => row.borderColor)).size, 3, "ANGLE actions should retain distinct color identities");
  assert.ok(angleUpgradeContract.purchasable.every((row) => row.backgroundImage === "none"), "ANGLE rows should avoid large gradient fills");
  assert.equal(angleUpgradeContract.buyAllWide.disabled, false, "ANGLE Buy All should enable when a normal action is affordable");
  assert.ok(angleUpgradeContract.buyAllWide.width < angleUpgradeContract.buyAllWide.parentWidth, "ANGLE Buy All should remain a compact section action");
  assert.ok(angleUpgradeContract.buyAllWide.height <= 42, "ANGLE Buy All should remain compact");
  assert.equal(angleUpgradeContract.buyAllWide.backgroundImage, "none", "ANGLE Buy All should avoid a dominant gradient fill");
  assert.ok(angleUpgradeContract.japaneseUnavailable.every((row) => row.disabled && row.action === "購入不可"), "unaffordable Japanese ANGLE rows should expose a non-color unavailable state");
  assert.equal(angleUpgradeContract.unavailableBuyAllDisabled, true, "ANGLE Buy All should disable when no normal action is affordable");
  assert.ok(angleUpgradeContract.englishUnavailable.every((row) => row.action === "Unavailable"), "unaffordable English ANGLE rows should translate their action state");
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileAngleScrollOwnership = await readScrollOwnership(page);
  assert.deepEqual(mobileAngleScrollOwnership.pageOverflow, ["auto", "hidden"], "mobile ANGLE should use the page as its vertical owner");
  assert.deepEqual(mobileAngleScrollOwnership.nestedVerticalOwners, [], "mobile ANGLE should have no nested vertical scroll trap");
  assert.deepEqual(mobileAngleScrollOwnership.mainPanelsOverflow, ["hidden", "hidden"], "mobile ANGLE main panels should not own page scrolling");
  assert.equal(mobileAngleScrollOwnership.visibleSectionsBorderless, true, "mobile shared sections should avoid redundant frames");
  assert.equal(mobileAngleScrollOwnership.finalContentReachable, true, "mobile ANGLE final actions should remain reachable");
  await page.setViewportSize({ width: 1280, height: 900 });
  const compactNavigation = await page.evaluate(() => {
    const mainTabs = Array.from(document.querySelectorAll(".main-tab"));
    const subtabs = Array.from(document.querySelectorAll(".infinity-subtab, .eternity-subtab, .challenge-subtab, .statistics-subtab"));
    const disabledProbe = subtabs.find((button) => !button.disabled);
    if (disabledProbe) disabledProbe.disabled = true;
    const disabledStyle = disabledProbe
      ? (() => {
        const style = getComputedStyle(disabledProbe);
        return { cursor: style.cursor, opacity: style.opacity };
      })()
      : null;
    if (disabledProbe) disabledProbe.disabled = false;
    const hiddenProbe = subtabs.find((button) => !button.hidden);
    if (hiddenProbe) hiddenProbe.hidden = true;
    const hiddenStyle = hiddenProbe
      ? { display: getComputedStyle(hiddenProbe).display, rectCount: hiddenProbe.getClientRects().length }
      : null;
    if (hiddenProbe) hiddenProbe.hidden = false;
    return {
      mainCodes: mainTabs.map((button) => button.querySelector(".tab-code")?.textContent?.trim() ?? ""),
      visibleMainStatuses: mainTabs
        .filter((button) => !button.hidden)
        .map((button) => {
          const status = button.querySelector("small");
          const style = status ? getComputedStyle(status) : null;
          return {
            position: style?.position ?? "",
            width: style?.width ?? "",
            height: style?.height ?? "",
            clip: style?.clip ?? "",
          };
        }),
      infinityBadge: Boolean(document.querySelector("#infinityTabBadge")),
      subtabCount: subtabs.length,
      sharedSubtabs: subtabs.every((button) => button.classList.contains("subtab")),
      subtabStyleFingerprints: subtabs.map((button) => {
        const style = getComputedStyle(button);
        return [
          style.display,
          style.minHeight,
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderLeftWidth,
          style.backgroundImage,
          style.boxShadow,
          style.touchAction,
        ].join("|");
      }),
      disabledCursor: disabledStyle?.cursor ?? "",
      disabledOpacity: disabledStyle?.opacity ?? "1",
      hiddenDisplay: hiddenStyle?.display ?? "",
      hiddenRectCount: hiddenStyle?.rectCount ?? 0,
    };
  });
  assert.deepEqual(compactNavigation.mainCodes, ["ANG", "INF", "ETR", "CHA", "AUT", "STA", "ACH", "HLP", "SET"], "main tabs should use compact codes");
  assert.equal(compactNavigation.infinityBadge, false, "Infinity should not render a readiness badge");
  assert.equal(compactNavigation.visibleMainStatuses.every((status) => status.position === "absolute" && status.width === "1px" && status.height === "1px" && status.clip.startsWith("rect")), true, "main tab secondary copy should remain accessible but not visible");
  assert.equal(compactNavigation.subtabCount, 10, "all four subtab families should remain present");
  assert.equal(compactNavigation.sharedSubtabs, true, "all subtab families should use the shared subtab contract");
  assert.equal(new Set(compactNavigation.subtabStyleFingerprints).size, 1, "all subtab families should share the same lightweight control style");
  assert.equal(compactNavigation.disabledCursor, "not-allowed", "disabled subtabs should expose a disabled cursor");
  assert.ok(Number(compactNavigation.disabledOpacity) < 1, "disabled subtabs should expose reduced emphasis");
  assert.equal(compactNavigation.hiddenDisplay, "none", "hidden subtabs should leave the rendered strip");
  assert.equal(compactNavigation.hiddenRectCount, 0, "hidden subtabs should have no rendered client rect");
  const measureMainTabBar = (targetPage) => targetPage.evaluate(() => {
    const nav = document.querySelector(".main-tabs");
    const strip = document.querySelector(".main-tab-scroll");
    const shell = document.querySelector(".shell");
    const active = nav?.querySelector(".main-tab.is-active");
    const navStyle = nav ? getComputedStyle(nav) : null;
    const activeStyle = active ? getComputedStyle(active) : null;
    const navRect = nav?.getBoundingClientRect();
    const shellRect = shell?.getBoundingClientRect();
    const settings = document.querySelector('[data-tab="settings"]');
    const visibleButtons = Array.from(document.querySelectorAll("[data-tab]")).filter((button) => !button.hidden);
    const rects = visibleButtons.map((button) => button.getBoundingClientRect());
    const sortedRects = [...rects].sort((a, b) => a.left - b.left);
    return {
      navDisplay: nav ? getComputedStyle(nav).display : "",
      navFlexWrap: nav ? getComputedStyle(nav).flexWrap : "",
      stripDisplay: strip ? getComputedStyle(strip).display : "",
      stripFlexWrap: strip ? getComputedStyle(strip).flexWrap : "",
      navHeight: nav?.getBoundingClientRect().height ?? 0,
      navClientHeight: nav?.clientHeight ?? 0,
      navScrollHeight: nav?.scrollHeight ?? 0,
      navWidth: navRect?.width ?? 0,
      shellWidth: shellRect?.width ?? 0,
      navBackgroundImage: navStyle?.backgroundImage ?? "",
      navBorderTopWidth: navStyle?.borderTopWidth ?? "",
      navBorderRightWidth: navStyle?.borderRightWidth ?? "",
      navBorderBottomWidth: navStyle?.borderBottomWidth ?? "",
      navBorderLeftWidth: navStyle?.borderLeftWidth ?? "",
      navBoxShadow: navStyle?.boxShadow ?? "",
      activeBackgroundImage: activeStyle?.backgroundImage ?? "",
      activeBoxShadow: activeStyle?.boxShadow ?? "",
      activeBorderBottomWidth: activeStyle?.borderBottomWidth ?? "",
      activeHeight: active?.getBoundingClientRect().height ?? 0,
      stripClientWidth: strip?.clientWidth ?? 0,
      stripScrollWidth: strip?.scrollWidth ?? 0,
      tabWidths: rects.map((rect) => rect.width),
      rows: rects.length > 0 ? Math.max(...rects.map((rect) => rect.top)) - Math.min(...rects.map((rect) => rect.top)) : Infinity,
      allVisibleInStrip: visibleButtons.every((button) => button.parentElement === strip),
      settingsInScrollHost: settings?.parentElement === strip,
      hasTabOverlap: sortedRects.some((rect, index) => sortedRects[index + 1] && rect.right > sortedRects[index + 1].left + 0.5),
      hasTabContentOverflow: visibleButtons.some((button) => button.scrollWidth > button.clientWidth + 1),
    };
  });
  const measureSubtabRails = (targetPage) => targetPage.evaluate(() => {
    const { switchMainTab } = window.__angleDebug;
    return [
      ["infinity", ".infinity-subtabs"],
      ["eternity", ".eternity-subtabs"],
      ["challenges", ".challenge-subtabs"],
      ["statistics", ".statistics-subtabs"],
    ].map(([panel, selector]) => {
      switchMainTab(panel);
      const strip = document.querySelector(selector);
      const buttons = Array.from(strip?.querySelectorAll(":scope > .subtab") ?? []).filter((button) => !button.hidden);
      const rects = buttons.map((button) => button.getBoundingClientRect());
      const sortedRects = [...rects].sort((a, b) => a.left - b.left);
      const stripRect = strip?.getBoundingClientRect();
      const before = strip?.scrollLeft ?? 0;
      if (strip) strip.scrollLeft = strip.scrollWidth;
      const lastRect = buttons.at(-1)?.getBoundingClientRect();
      const endStripRect = strip?.getBoundingClientRect();
      const lastReachableAtEnd = Boolean(
        endStripRect
        && lastRect
        && lastRect.right <= endStripRect.right + 1,
      );
      if (strip) strip.scrollLeft = before;
      return {
        panel,
        childCount: buttons.length,
        width: stripRect?.width ?? 0,
        clientWidth: strip?.clientWidth ?? 0,
        scrollWidth: strip?.scrollWidth ?? 0,
        childWidths: rects.map((rect) => rect.width),
        rows: rects.length > 0 ? Math.max(...rects.map((rect) => rect.top)) - Math.min(...rects.map((rect) => rect.top)) : Infinity,
        hasOverlap: sortedRects.some((rect, index) => sortedRects[index + 1] && rect.right > sortedRects[index + 1].left + 0.5),
        hasContentOverflow: buttons.some((button) => button.scrollWidth > button.clientWidth + 1),
        lastReachableAtEnd,
      };
    });
  });
  const layoutOriginal = await page.evaluate(() => ({
    infinityCount: window.__angleDebug.state.infinityCount,
    infinityUpgradeMask: window.__angleDebug.state.infinityUpgradeMask,
    eternityCount: window.__angleDebug.state.eternityCount,
    hiddenTabs: [...window.__angleDebug.state.hiddenTabs],
    unlockedMainTabs: [...window.__angleDebug.state.unlockedMainTabs],
    activeMainTab: window.__angleDebug.runtime.activeMainTab,
    language: window.__angleDebug.state.language,
  }));
  await page.evaluate(() => {
    const { state } = window.__angleDebug;
    state.infinityCount = 1;
    state.infinityUpgradeMask = (1 << 1) | (1 << 5);
    state.eternityCount = 1;
    state.hiddenTabs = [];
    window.__angleDebug.switchMainTab("angle");
    window.advanceTime(0);
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  const desktopTabBar = await measureMainTabBar(page);
  const desktopSubtabRails = await measureSubtabRails(page);
  await page.setViewportSize({ width: 821, height: 900 });
  const breakpointWideTabBar = await measureMainTabBar(page);
  const breakpointWideSubtabRails = await measureSubtabRails(page);
  await page.setViewportSize({ width: 820, height: 900 });
  const breakpointCompactTabBar = await measureMainTabBar(page);
  await page.setViewportSize({ width: 768, height: 900 });
  const tabletTabBar = await measureMainTabBar(page);
  await page.evaluate(() => {
    window.__angleDebug.state.language = "ja";
    window.advanceTime(0);
  });
  const compactJapaneseTabBar = await measureMainTabBar(page);
  await page.evaluate(() => {
    window.__angleDebug.state.language = "en";
    window.advanceTime(0);
  });
  const compactEnglishTabBar = await measureMainTabBar(page);
  const endSettings = await page.evaluate(() => {
    const strip = document.querySelector(".main-tab-scroll");
    const settings = document.querySelector('[data-tab="settings"]');
    if (!strip || !settings) return { reachedEnd: false, fullyVisible: false };
    strip.scrollLeft = strip.scrollWidth;
    const stripRect = strip.getBoundingClientRect();
    const settingsRect = settings.getBoundingClientRect();
    return {
      reachedEnd: strip.scrollLeft >= strip.scrollWidth - strip.clientWidth - 1,
      fullyVisible: settingsRect.left >= stripRect.left - 1 && settingsRect.right <= stripRect.right + 1,
      inScrollHost: settings.parentElement === strip,
    };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const compactSubtabRails = await measureSubtabRails(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate((original) => {
    const { state } = window.__angleDebug;
    state.infinityCount = original.infinityCount;
    state.infinityUpgradeMask = original.infinityUpgradeMask;
    state.eternityCount = original.eternityCount;
    state.hiddenTabs = original.hiddenTabs;
    state.unlockedMainTabs = original.unlockedMainTabs;
    state.language = original.language;
    window.__angleDebug.switchMainTab(original.activeMainTab);
    window.advanceTime(0);
  }, layoutOriginal);
  for (const [viewportName, layout] of [
    ["desktop", desktopTabBar],
    ["breakpoint-wide", breakpointWideTabBar],
    ["breakpoint-compact", breakpointCompactTabBar],
    ["tablet", tabletTabBar],
    ["compact-Japanese", compactJapaneseTabBar],
    ["compact-English", compactEnglishTabBar],
  ]) {
    assert.equal(layout.navDisplay, "flex", `${viewportName} navigation should use a compact flex bar`);
    assert.equal(layout.navFlexWrap, "nowrap", `${viewportName} navigation should never wrap`);
    assert.equal(layout.stripDisplay, "flex", `${viewportName} navigation should use a flex strip`);
    assert.equal(layout.stripFlexWrap, "nowrap", `${viewportName} navigation should never wrap`);
    assert.ok(layout.rows < 1, `${viewportName} tabs should share one row`);
    assert.ok(layout.navScrollHeight <= layout.navClientHeight + 1, `${viewportName} navigation should not grow vertically for overflow`);
    assert.equal(layout.allVisibleInStrip, true, `${viewportName} visible tabs should share the scrolling strip`);
    assert.equal(layout.settingsInScrollHost, true, `${viewportName} SET should stay inside the scrolling strip`);
    assert.equal(layout.hasTabOverlap, false, `${viewportName} tabs should not overlap horizontally`);
    assert.equal(layout.hasTabContentOverflow, false, `${viewportName} tabs should retain intrinsic content widths`);
    assert.equal(layout.navBackgroundImage, "none", `${viewportName} navigation should not use a card gradient`);
    assert.equal(layout.navBoxShadow, "none", `${viewportName} navigation should not use a card shadow`);
    assert.equal(layout.navBorderTopWidth, "0px", `${viewportName} navigation should not use a card border`);
    assert.equal(layout.navBorderRightWidth, "0px", `${viewportName} navigation should not use a card border`);
    assert.equal(layout.navBorderBottomWidth, "0px", `${viewportName} navigation should not use a card border`);
    assert.equal(layout.navBorderLeftWidth, "0px", `${viewportName} navigation should not use a card border`);
    assert.equal(layout.activeBackgroundImage, "none", `${viewportName} active tab should not use a gradient fill`);
    assert.equal(layout.activeBoxShadow, "none", `${viewportName} active tab should not use a heavy shadow`);
    assert.equal(layout.activeBorderBottomWidth, "2px", `${viewportName} active tab should retain an underline cue`);
    assert.ok(layout.activeHeight >= 40, `${viewportName} active tab should retain a touch-sized target`);
  }
  for (const [viewportName, layout] of [["desktop", desktopTabBar], ["breakpoint-wide", breakpointWideTabBar]]) {
    assert.ok(layout.navWidth >= layout.shellWidth - 1, `${viewportName} navigation should use the available rail`);
    assert.ok(layout.stripClientWidth >= layout.navWidth - 1, `${viewportName} navigation strip should fill the available rail`);
    assert.ok(Math.max(...layout.tabWidths) - Math.min(...layout.tabWidths) <= 1, `${viewportName} main tabs should distribute evenly`);
  }
  for (const [viewportName, rails] of [["desktop", desktopSubtabRails], ["breakpoint-wide", breakpointWideSubtabRails]]) {
    for (const rail of rails) {
      assert.ok(rail.childCount > 0, `${viewportName} ${rail.panel} subtabs should render`);
      assert.ok(rail.width > 0, `${viewportName} ${rail.panel} subtabs should use the page rail`);
      assert.ok(Math.max(...rail.childWidths) - Math.min(...rail.childWidths) <= 1, `${viewportName} ${rail.panel} subtabs should distribute evenly`);
      assert.equal(rail.rows < 1, true, `${viewportName} ${rail.panel} subtabs should share one row`);
      assert.equal(rail.hasOverlap, false, `${viewportName} ${rail.panel} subtabs should not overlap`);
      assert.equal(rail.hasContentOverflow, false, `${viewportName} ${rail.panel} subtabs should retain intrinsic content widths`);
      assert.ok(rail.scrollWidth <= rail.clientWidth + 1, `${viewportName} ${rail.panel} subtabs should fit when the rail is wide`);
    }
  }
  for (const rail of compactSubtabRails) {
    assert.equal(rail.rows < 1, true, `narrow ${rail.panel} subtabs should share one row`);
    assert.equal(rail.hasOverlap, false, `narrow ${rail.panel} subtabs should not overlap`);
    assert.equal(rail.hasContentOverflow, false, `narrow ${rail.panel} subtabs should retain intrinsic content widths`);
    assert.equal(rail.lastReachableAtEnd, true, `narrow ${rail.panel} subtabs should reach their final control`);
  }
  assert.equal(endSettings.reachedEnd, true, "SET should be reachable at the end of the shared scrolling strip");
  assert.equal(endSettings.fullyVisible, true, "SET should be fully visible at the end of the shared scrolling strip");
  assert.equal(endSettings.inScrollHost, true, "SET should remain in the shared scrolling strip at its end");

  const headerOriginal = await page.evaluate(() => ({
    infinityCount: window.__angleDebug.state.infinityCount,
    infinityUpgradeMask: window.__angleDebug.state.infinityUpgradeMask,
    hiddenTabs: [...window.__angleDebug.state.hiddenTabs],
    activeMainTab: window.__angleDebug.runtime.activeMainTab,
  }));
  await page.evaluate(() => {
    const { state, switchMainTab } = window.__angleDebug;
    state.infinityCount = 1;
    state.infinityUpgradeMask = (1 << 1) | (1 << 5);
    state.hiddenTabs = [];
    switchMainTab("angle");
    window.advanceTime(0);
  });
  const measurePageHeaders = () => page.evaluate(() => {
    const panelNames = ["angle", "infinity", "eternity", "challenges", "automation", "statistics", "achievements", "help", "settings"];
    const { switchMainTab } = window.__angleDebug;
    return panelNames.map((panelName) => {
      switchMainTab(panelName);
      window.advanceTime(0);
      const panel = document.querySelector(`[data-panel="${panelName}"]`);
      const header = panel?.querySelector(".page-heading, .topbar");
      const title = header?.querySelector("h1");
      const status = header?.querySelector(".unlock-note");
      const headerStyle = header ? getComputedStyle(header) : null;
      const headerRect = header?.getBoundingClientRect();
      const statusRect = status?.getBoundingClientRect();
      return {
        panelName,
        height: headerRect?.height ?? 0,
        minHeight: headerStyle?.minHeight ?? "",
        padding: headerStyle ? `${headerStyle.paddingTop} ${headerStyle.paddingRight} ${headerStyle.paddingBottom} ${headerStyle.paddingLeft}` : "",
        titleFontSize: title ? getComputedStyle(title).fontSize : "",
        titleOverflow: Boolean(title && title.scrollWidth > title.clientWidth + 1),
        headerOverflow: Boolean(header && header.scrollWidth > header.clientWidth + 1),
        statusInside: !status || status.hidden || Boolean(statusRect && headerRect && statusRect.top >= headerRect.top - 1 && statusRect.bottom <= headerRect.bottom + 1),
      };
    });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  const desktopPageHeaders = await measurePageHeaders();
  await page.setViewportSize({ width: 768, height: 900 });
  const tabletPageHeaders = await measurePageHeaders();
  await page.setViewportSize({ width: 390, height: 844 });
  const mobilePageHeaders = await measurePageHeaders();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate((original) => {
    const { state, switchMainTab } = window.__angleDebug;
    state.infinityCount = original.infinityCount;
    state.infinityUpgradeMask = original.infinityUpgradeMask;
    state.hiddenTabs = original.hiddenTabs;
    switchMainTab(original.activeMainTab);
    window.advanceTime(0);
  }, headerOriginal);
  for (const [viewportName, headers, maxHeight] of [
    ["desktop", desktopPageHeaders, 86],
    ["tablet", tabletPageHeaders, 56],
    ["mobile", mobilePageHeaders, 56],
  ]) {
    const heights = headers.map((header) => header.height);
    assert.equal(new Set(headers.map((header) => header.minHeight)).size, 1, `${viewportName} top-level headers should share one min-height`);
    assert.equal(new Set(headers.map((header) => header.padding)).size, 1, `${viewportName} top-level headers should share one padding rule`);
    assert.equal(new Set(headers.map((header) => header.titleFontSize)).size, 1, `${viewportName} top-level headers should share one title size`);
    assert.ok(Math.max(...heights) <= maxHeight, `${viewportName} top-level headers should stay compact`);
    assert.ok(Math.max(...heights) - Math.min(...heights) <= 1, `${viewportName} top-level headers should have consistent heights`);
    assert.ok(headers.every((header) => !header.titleOverflow && !header.headerOverflow && header.statusInside), `${viewportName} top-level headers should not clip titles or status badges`);
  }

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
  assert.equal(achievementUi.count, 41, "the desktop Achievements panel should render 41 rows");
  assert.equal(achievementUi.japaneseSummary, "41/41 実績", "the desktop Japanese Achievements summary should show 41 achievements");
  assert.equal(achievementUi.englishSummary, "41/41 Achievements", "the desktop English Achievements summary should show 41 achievements");
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
      "upgrade-row-action",
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
    "upgrade-row-name,upgrade-row-detail,upgrade-row-cost,upgrade-row-action",
    "upgrade-row-name,upgrade-row-detail,upgrade-row-cost,upgrade-row-action",
    "upgrade-row-name,upgrade-row-detail,upgrade-row-cost,upgrade-row-action",
  ], "TC4 rows should use the canonical four-slot order");
  assert.ok(towerChallenge4Ui.before.rowStyles.every((row) => row.backgroundImage === "none"), "TC4 rows should avoid large gradient fills");
  assert.ok(towerChallenge4Ui.before.rowStyles.every((row) => row.gridAreas === '"name detail" "cost action"'), "TC4 rows should keep their four slots readable in the narrow ANGLE rail");
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
  assert.match(towerChallenge4Flow.restriction, /レベル1/);
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
  const timeFluxRemoval = await page.evaluate(async () => {
    const { runtime, state, advanceOnlineTime, processOfflineElapsed } = window.__angleDebug;
    state.totalPlayTime = 0;
    state.totalRealPlayTime = 0;
    state.currentInfinityRunTime = 0;
    state.currentInfinityRealTime = 0;
    state.timeFlux = 123456;
    state.timeFluxSpeed = 60;
    state.offlineProgressEnabled = true;
    window.__angleDebug.advanceOnlineTime(1);
    const ui = {
      quickBar: Boolean(document.querySelector("#timeFluxQuickBar")),
      panel: Boolean(document.querySelector("#timeFluxPanel")),
      tab: Boolean(document.querySelector('[data-tab="timeFlux"]')),
      speedButton: Boolean(document.querySelector(".time-flux-speed")),
      upgrade: Boolean(document.querySelector("#timeFluxGainUpgrade")),
      offlineToggle: Boolean(document.querySelector("#timeFluxOfflineToggle")),
      tickInput: Boolean(document.querySelector("#offlineTickInput")),
    };
    const online = {
      totalPlayTime: state.totalPlayTime,
      totalRealPlayTime: state.totalRealPlayTime,
      currentInfinityRunTime: state.currentInfinityRunTime,
      currentInfinityRealTime: state.currentInfinityRealTime,
      timeFlux: state.timeFlux,
    };
    const layoutRect = (selector) => document.querySelector(selector)?.getBoundingClientRect();
    const layoutBefore = {
      shellHeight: layoutRect("#shell")?.height ?? 0,
      mainTabsHeight: layoutRect(".main-tabs")?.height ?? 0,
      mainPanelsHeight: layoutRect(".main-panels")?.height ?? 0,
    };
    const report = await processOfflineElapsed(1, "test", { clockSource: "server" });
    const changedReport = {
      ...report,
      before: { ...report.before, scoreLog10: 1, scoreUnlocked: true },
      after: { ...report.after, scoreLog10: 2, scoreUnlocked: true },
    };
    runtime.offlineReport = changedReport;
    runtime.updateOfflineReportUi();
    const completedRows = Array.from(
      document.querySelectorAll("#offlineReportChanges .offline-report-change"),
      (row) => ({ key: row.dataset.offlineReportChange, text: row.textContent.trim() }),
    );
    const completedUi = {
      progressHidden: document.querySelector("#offlineReportProgress")?.hidden ?? false,
      resultHidden: document.querySelector("#offlineReportResult")?.hidden ?? true,
      compactGrid: Boolean(document.querySelector(".offline-report-grid")),
      rows: completedRows,
      noChangesHidden: document.querySelector("#offlineReportNoChanges")?.hidden ?? true,
      diagnosticIds: [
        "offlineReportEffective",
        "offlineReportConfiguredTicks",
        "offlineReportRequestedTicks",
        "offlineReportTicks",
        "offlineReportProcessingTime",
        "offlineReportNormalInfinity",
        "offlineReportAggregatedInfinity",
        "offlineReportInfinity",
        "offlineReportIp",
      ].filter((id) => document.getElementById(id)),
    };
    runtime.offlineReport = { ...changedReport, processing: true };
    runtime.updateOfflineReportUi();
    const processingUi = {
      mode: document.querySelector("#offlineReportMode")?.textContent?.trim() ?? "",
      progressHidden: document.querySelector("#offlineReportProgress")?.hidden ?? true,
      resultHidden: document.querySelector("#offlineReportResult")?.hidden ?? false,
      closeHidden: document.querySelector("#offlineReportClose")?.hidden ?? false,
    };
    runtime.offlineReport = {
      ...changedReport,
      processing: false,
      before: { ...changedReport.before },
      after: { ...changedReport.before },
    };
    runtime.updateOfflineReportUi();
    const noChangeUi = {
      rowCount: document.querySelectorAll("#offlineReportChanges .offline-report-change").length,
      fallbackHidden: document.querySelector("#offlineReportNoChanges")?.hidden ?? true,
    };
    runtime.offlineReport = report;
    runtime.updateOfflineReportUi();
    const reportPanel = document.querySelector("#offlineReportPanel");
    const layoutAfter = {
      shellHeight: layoutRect("#shell")?.height ?? 0,
      mainTabsHeight: layoutRect(".main-tabs")?.height ?? 0,
      mainPanelsHeight: layoutRect(".main-panels")?.height ?? 0,
    };
    return {
      ui,
      online,
      report,
      completedUi,
      processingUi,
      noChangeUi,
      reportVisible: document.querySelector("#offlineReportPanel")?.hidden === false,
      reportMode: document.querySelector("#offlineReportMode")?.textContent?.trim() ?? "",
      reportOutsideShell: reportPanel?.closest("#shell") === null,
      reportPosition: reportPanel ? getComputedStyle(reportPanel).position : "",
      layoutBefore,
      layoutAfter,
      totalPlayTime: state.totalPlayTime,
      totalRealPlayTime: state.totalRealPlayTime,
      timeFlux: state.timeFlux,
    };
  });
  assert.equal(timeFluxRemoval.ui.quickBar, false, "the Time Flux quick bar should be removed");
  assert.equal(timeFluxRemoval.ui.panel, false, "the Time Flux panel should be removed");
  assert.equal(timeFluxRemoval.ui.tab, false, "the Time Flux tab should be removed");
  assert.equal(timeFluxRemoval.ui.speedButton, false, "Time Flux speed controls should be removed");
  assert.equal(timeFluxRemoval.ui.upgrade, false, "Time Flux upgrade controls should be removed");
  assert.equal(timeFluxRemoval.ui.offlineToggle, false, "the Time Flux offline toggle should be removed");
  assert.equal(timeFluxRemoval.ui.tickInput, true, "the offline tick setting should remain available");
  assert.ok(Math.abs(timeFluxRemoval.online.totalPlayTime - 1) < 1e-9, "online time should advance at a fixed one-to-one rate");
  assert.ok(Math.abs(timeFluxRemoval.online.totalRealPlayTime - 1) < 1e-9, "online real time should advance normally");
  assert.ok(Math.abs(timeFluxRemoval.online.currentInfinityRunTime - 1) < 1e-9, "Infinity time should advance at a fixed one-to-one rate");
  assert.ok(Math.abs(timeFluxRemoval.online.currentInfinityRealTime - 1) < 1e-9, "real Infinity time should advance normally");
  assert.equal(timeFluxRemoval.online.timeFlux, 123456, "dormant Time Flux should not be consumed online");
  assert.equal(timeFluxRemoval.report.offlineProgressEnabled, true, "enabled offline progress should use the normal processing mode");
  assert.equal(timeFluxRemoval.report.timeFluxGained, undefined, "normal offline reports should not grant dormant Time Flux");
  assert.equal(timeFluxRemoval.reportVisible, true, "normal offline processing should show the report");
  assert.equal(timeFluxRemoval.reportMode, "オフライン進行", "the report should identify normal offline progress");
  assert.equal(timeFluxRemoval.completedUi.progressHidden, true, "completed reports should hide the processing progress bar");
  assert.equal(timeFluxRemoval.completedUi.resultHidden, false, "completed reports should show the result surface");
  assert.equal(timeFluxRemoval.completedUi.compactGrid, false, "completed reports should not use the old card grid");
  assert.ok(timeFluxRemoval.completedUi.rows.length > 0, "completed reports should list a changed player-facing value");
  assert.ok(
    timeFluxRemoval.completedUi.rows.every((row) => row.text.includes("→")),
    "completed report rows should show before-to-after values",
  );
  assert.deepEqual(timeFluxRemoval.completedUi.diagnosticIds, [], "completed reports should omit implementation diagnostics");
  assert.equal(timeFluxRemoval.processingUi.mode, "オフライン進行を計算中", "processing reports should use a concise calculating status");
  assert.equal(timeFluxRemoval.processingUi.progressHidden, false, "processing reports should show progress");
  assert.equal(timeFluxRemoval.processingUi.resultHidden, true, "processing reports should hide the completed result");
  assert.equal(timeFluxRemoval.processingUi.closeHidden, true, "processing reports should not offer an unsafe close action");
  assert.equal(timeFluxRemoval.noChangeUi.rowCount, 0, "no-change reports should not render change rows");
  assert.equal(timeFluxRemoval.noChangeUi.fallbackHidden, false, "no-change reports should show the concise fallback");
  assert.equal(timeFluxRemoval.reportOutsideShell, true, "the offline report should not participate in the shell grid");
  assert.equal(timeFluxRemoval.reportPosition, "fixed", "the offline report should render as an overlay");
  for (const key of ["shellHeight", "mainTabsHeight", "mainPanelsHeight"]) {
    assert.ok(
      Math.abs(timeFluxRemoval.layoutAfter[key] - timeFluxRemoval.layoutBefore[key]) < 0.1,
      `offline report should not change ${key}`,
    );
  }
  await page.setViewportSize({ width: 640, height: 360 });
  const shortMobileOfflineReport = await page.evaluate(() => {
    const panel = document.querySelector("#offlineReportPanel");
    const heading = panel?.querySelector(".panel-heading")?.getBoundingClientRect();
    const rect = panel?.getBoundingClientRect();
    const style = panel ? getComputedStyle(panel) : null;
    return {
      top: rect?.top ?? -Infinity,
      bottom: rect?.bottom ?? Infinity,
      headingTop: heading?.top ?? -Infinity,
      maxHeight: Number.parseFloat(style?.maxHeight ?? "NaN"),
      overflowY: style?.overflowY ?? "",
      viewportHeight: window.innerHeight,
    };
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  assert.ok(shortMobileOfflineReport.top >= 0, "short mobile offline reports should stay within the viewport at the top");
  assert.ok(shortMobileOfflineReport.bottom <= shortMobileOfflineReport.viewportHeight, "short mobile offline reports should stay within the viewport at the bottom");
  assert.ok(shortMobileOfflineReport.headingTop >= 0, "short mobile offline report headings should remain visible");
  assert.ok(shortMobileOfflineReport.maxHeight <= shortMobileOfflineReport.viewportHeight - 84, "short mobile reports should use a viewport-relative max height");
  assert.equal(shortMobileOfflineReport.overflowY, "auto", "short mobile reports should scroll internally");
  await page.setViewportSize({ width: 1280, height: 360 });
  const shortDesktopOfflineReport = await page.evaluate(() => {
    const panel = document.querySelector("#offlineReportPanel");
    const heading = panel?.querySelector(".panel-heading")?.getBoundingClientRect();
    const rect = panel?.getBoundingClientRect();
    const style = panel ? getComputedStyle(panel) : null;
    return {
      top: rect?.top ?? -Infinity,
      bottom: rect?.bottom ?? Infinity,
      headingTop: heading?.top ?? -Infinity,
      maxHeight: Number.parseFloat(style?.maxHeight ?? "NaN"),
      overflowY: style?.overflowY ?? "",
      viewportHeight: window.innerHeight,
    };
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  assert.ok(shortDesktopOfflineReport.top >= 0, "short desktop offline reports should stay within the viewport at the top");
  assert.ok(shortDesktopOfflineReport.bottom <= shortDesktopOfflineReport.viewportHeight, "short desktop offline reports should stay within the viewport at the bottom");
  assert.ok(shortDesktopOfflineReport.headingTop >= 0, "short desktop offline report headings should remain visible");
  assert.ok(shortDesktopOfflineReport.maxHeight <= shortDesktopOfflineReport.viewportHeight - 36, "short desktop reports should use a viewport-relative max height");
  assert.equal(shortDesktopOfflineReport.overflowY, "auto", "short desktop reports should scroll internally");
  assert.ok(Math.abs(timeFluxRemoval.totalPlayTime - 2) < 1e-9, "offline processing should advance normal game time");
  assert.ok(Math.abs(timeFluxRemoval.totalRealPlayTime - 1) < 1e-9, "offline processing should not add real play time");
  assert.equal(timeFluxRemoval.timeFlux, 123456, "offline processing should not change dormant Time Flux");
  const newsTicker = await page.evaluate(() => {
    const ticker = document.querySelector("#newsTicker");
    const item = document.querySelector("#newsTickerText");
    return {
      exists: Boolean(ticker),
      text: item?.textContent?.trim() ?? "",
      animated: Boolean(item && getComputedStyle(item).animationName !== "none"),
      live: ticker?.getAttribute("aria-live") ?? null,
    };
  });
  assert.equal(newsTicker.exists, true, "news ticker must exist above the main tabs");
  assert.equal(newsTicker.live, null, "auto-rotating top bar must not be announced as a live region");
  assert.notEqual(newsTicker.text, "", "news ticker must display a news message");
  assert.equal(newsTicker.animated, true, "news ticker text must use a scrolling animation");
  const newsTiming = await page.evaluate(() => {
    const item = document.querySelector("#newsTickerText");
    const before = item?.textContent?.trim() ?? "";
    window.__angleDebug.state.totalPlayTime = 14 * 18;
    window.advanceTime(0);
    const afterTimeJump = item?.textContent?.trim() ?? "";
    item?.dispatchEvent(new AnimationEvent("animationiteration", { animationName: "news-scroll" }));
    const afterIteration = item?.textContent?.trim() ?? "";
    return { before, afterTimeJump, afterIteration };
  });
  assert.equal(newsTiming.afterTimeJump, newsTiming.before, "news text should not change from total play time alone");
  assert.notEqual(newsTiming.afterIteration, newsTiming.before, "news text should advance after one scroll animation iteration");
  const topBarModes = await page.evaluate(() => {
    const select = document.querySelector("#topBarModeSelect");
    return {
      value: select?.value ?? "",
      options: Array.from(select?.querySelectorAll("option") ?? []).map((option) => option.value),
    };
  });
  assert.equal(topBarModes.value, "news", "top bar mode should default to news");
  assert.deepEqual(topBarModes.options, ["news", "resources", "progress", "blank", "hidden"], "top bar mode select should expose all display modes");
  const offlineTickSetting = await page.evaluate(() => {
    const { switchMainTab } = window.__angleDebug;
    switchMainTab("settings");
    const input = document.querySelector("#offlineTickInput");
    const before = input?.value ?? "";
    if (input) {
      input.value = "5000";
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    window.advanceTime(0);
    const result = {
      before,
      value: input?.value ?? "",
      state: window.__angleDebug.state.offlineTickCount,
      width: input?.getBoundingClientRect().width ?? 0,
      height: input?.getBoundingClientRect().height ?? 0,
    };
    switchMainTab("angle");
    return result;
  });
  assert.equal(offlineTickSetting.before, "1000", "the offline tick setting should have a stable default");
  assert.equal(offlineTickSetting.value, "5000", "the offline tick setting should accept a numeric value");
  assert.equal(offlineTickSetting.state, 5000, "the offline tick setting should update runtime state");
  assert.ok(offlineTickSetting.width > 0 && offlineTickSetting.height > 0, "the offline tick setting should remain visible");
  const offlineProgressSetting = await page.evaluate(() => {
    const { switchMainTab } = window.__angleDebug;
    switchMainTab("settings");
    const toggle = document.querySelector("#offlineProgressToggle");
    const before = {
      checked: toggle?.checked ?? false,
      state: window.__angleDebug.state.offlineProgressEnabled,
    };
    if (toggle) {
      toggle.checked = false;
      toggle.dispatchEvent(new Event("change", { bubbles: true }));
    }
    window.advanceTime(0);
    const disabled = {
      checked: toggle?.checked ?? true,
      state: window.__angleDebug.state.offlineProgressEnabled,
      persisted: JSON.parse(localStorage.getItem("angle-incremental-save") || "{}").state?.offlineProgressEnabled,
    };
    if (toggle) {
      toggle.checked = true;
      toggle.dispatchEvent(new Event("change", { bubbles: true }));
    }
    window.advanceTime(0);
    const enabled = {
      checked: toggle?.checked ?? false,
      state: window.__angleDebug.state.offlineProgressEnabled,
      persisted: JSON.parse(localStorage.getItem("angle-incremental-save") || "{}").state?.offlineProgressEnabled,
    };
    const width = toggle?.getBoundingClientRect().width ?? 0;
    const height = toggle?.getBoundingClientRect().height ?? 0;
    switchMainTab("angle");
    return {
      before,
      disabled,
      enabled,
      width,
      height,
    };
  });
  assert.equal(offlineProgressSetting.before.checked, true, "offline progress should be enabled by default");
  assert.equal(offlineProgressSetting.before.state, true, "the default offline progress state should be enabled");
  assert.equal(offlineProgressSetting.disabled.checked, false, "the offline progress checkbox should turn off");
  assert.equal(offlineProgressSetting.disabled.state, false, "disabling offline progress should update runtime state");
  assert.equal(offlineProgressSetting.disabled.persisted, false, "disabling offline progress should persist the setting");
  assert.equal(offlineProgressSetting.enabled.checked, true, "the offline progress checkbox should turn on");
  assert.equal(offlineProgressSetting.enabled.state, true, "enabling offline progress should update runtime state");
  assert.equal(offlineProgressSetting.enabled.persisted, true, "enabling offline progress should persist the setting");
  assert.ok(offlineProgressSetting.width > 0 && offlineProgressSetting.height > 0, "the offline progress setting should remain usable");
  const addedJapaneseNews = await page.evaluate(() => {
    const item = document.querySelector("#newsTickerText");
    window.__angleDebug.applySetting("language", "ja");
    window.__angleDebug.applySetting("topBarMode", "news");
    for (let index = 0; index < 13; index += 1) {
      item?.dispatchEvent(new AnimationEvent("animationiteration", { animationName: "news-scroll" }));
    }
    window.advanceTime(0);
    return document.querySelector("#newsTickerText")?.textContent?.trim() ?? "";
  });
  assert.equal(addedJapaneseNews, "誰かInfinityに落ち着くよう伝えてください。", "news ticker should include game-local community-style Japanese messages");
  const addedEnglishNews = await page.evaluate(() => {
    window.__angleDebug.applySetting("language", "en");
    window.advanceTime(0);
    return document.querySelector("#newsTickerText")?.textContent?.trim() ?? "";
  });
  assert.equal(addedEnglishNews, "Someone tell Infinity to calm down.", "news ticker should include game-local community-style English messages");
  const addedProgressionNews = await page.evaluate(() => {
    const item = document.querySelector("#newsTickerText");
    window.__angleDebug.applySetting("language", "ja");
    for (let index = 0; index < 4; index += 1) {
      item?.dispatchEvent(new AnimationEvent("animationiteration", { animationName: "news-scroll" }));
    }
    window.advanceTime(0);
    return document.querySelector("#newsTickerText")?.textContent?.trim() ?? "";
  });
  assert.equal(addedProgressionNews, "Infinite Capの壁には、もう少し分かりやすいドアが必要です。", "news ticker should include game-specific UI/progression jokes");
  const resourceTopBar = await page.evaluate(() => {
    window.__angleDebug.applySetting("topBarMode", "resources");
    const item = document.querySelector("#newsTickerText");
    return {
      label: document.querySelector(".news-label")?.textContent?.trim() ?? "",
      text: item?.textContent?.trim() ?? "",
      animated: Boolean(item && getComputedStyle(item).animationName !== "none"),
      hidden: Boolean(document.querySelector("#newsTicker")?.hidden),
    };
  });
  assert.equal(resourceTopBar.label, "資源量", "resources top bar should use the localized resource label");
  assert.match(resourceTopBar.text, /Score .* IP .* IA/, "resources top bar should summarize score, IP, and IA");
  assert.equal(resourceTopBar.animated, false, "resources top bar should be static");
  assert.equal(resourceTopBar.hidden, false, "resources top bar should remain visible");
  const nonNewsIteration = await page.evaluate(() => {
    const item = document.querySelector("#newsTickerText");
    const before = item?.textContent?.trim() ?? "";
    item?.dispatchEvent(new AnimationEvent("animationiteration", { animationName: "news-scroll" }));
    return item?.textContent?.trim() ?? "";
  });
  assert.equal(nonNewsIteration, resourceTopBar.text, "animation iterations should not advance text outside news mode");
  const progressTopBar = await page.evaluate(() => {
    window.__angleDebug.applySetting("topBarMode", "progress");
    return {
      label: document.querySelector(".news-label")?.textContent?.trim() ?? "",
      text: document.querySelector("#newsTickerText")?.textContent?.trim() ?? "",
    };
  });
  assert.equal(progressTopBar.label, "進捗状況", "progress top bar should use the localized progress label");
  assert.match(progressTopBar.text, /GR .* CB .* INF .* ACH/, "progress top bar should summarize GR, CB, Infinity, and achievements");
  const blankTopBar = await page.evaluate(() => {
    window.__angleDebug.applySetting("topBarMode", "blank");
    const ticker = document.querySelector("#newsTicker");
    return {
      label: document.querySelector(".news-label")?.textContent?.trim() ?? "",
      text: document.querySelector("#newsTickerText")?.textContent?.trim() ?? "",
      hidden: Boolean(ticker?.hidden),
      height: ticker?.getBoundingClientRect().height ?? 0,
    };
  });
  assert.equal(blankTopBar.label, "", "blank top bar should clear the label");
  assert.equal(blankTopBar.text, "", "blank top bar should clear the text");
  assert.equal(blankTopBar.hidden, false, "blank top bar should preserve the bar");
  assert.ok(blankTopBar.height > 0, "blank top bar should keep its layout height");
  const hiddenTopBar = await page.evaluate(() => {
    window.__angleDebug.applySetting("topBarMode", "hidden");
    const ticker = document.querySelector("#newsTicker");
    const panels = document.querySelector(".main-panels");
    return {
      hidden: Boolean(ticker?.hidden),
      panelTop: panels?.getBoundingClientRect().top ?? 0,
    };
  });
  assert.equal(hiddenTopBar.hidden, true, "hidden top bar should hide the bar");
  assert.ok(hiddenTopBar.panelTop >= 0, "main panels should remain laid out when the top bar is hidden");
  const restoredNewsTopBar = await page.evaluate(() => {
    window.__angleDebug.applySetting("topBarMode", "news");
    const item = document.querySelector("#newsTickerText");
    return {
      text: item?.textContent?.trim() ?? "",
      animated: Boolean(item && getComputedStyle(item).animationName !== "none"),
    };
  });
  assert.notEqual(restoredNewsTopBar.text, "", "news mode should restore news text");
  assert.equal(restoredNewsTopBar.animated, true, "news mode should restore scrolling animation");
  const fpsPlacement = await page.evaluate(() => {
    window.__angleDebug.applySetting("topBarMode", "news");
    window.__angleDebug.applySetting("showFps", true);
    const ticker = document.querySelector("#newsTicker")?.getBoundingClientRect();
    const track = document.querySelector(".news-track")?.getBoundingClientRect();
    const fps = document.querySelector("#fpsCounter")?.getBoundingClientRect();
    window.__angleDebug.applySetting("topBarMode", "hidden");
    const hiddenTop = document.querySelector("#fpsCounter")?.getBoundingClientRect().top ?? 999;
    return {
      insideTopBar: Boolean(ticker && fps && fps.top >= ticker.top && fps.bottom <= ticker.bottom),
      clearOfNewsText: Boolean(track && fps && track.right <= fps.left),
      hiddenTop,
    };
  });
  assert.equal(fpsPlacement.insideTopBar, true, "FPS counter should fit inside the visible top bar");
  assert.equal(fpsPlacement.clearOfNewsText, true, "FPS counter should not overlap the news text track");
  assert.ok(fpsPlacement.hiddenTop >= 0, "FPS counter should remain positioned when the top bar is hidden");
  const achievementToastPlacement = await page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect();
    window.__angleDebug.applySetting("topBarMode", "news");
    const normalToasts = rect("#achievementToasts");
    window.__angleDebug.applySetting("topBarMode", "hidden");
    const hiddenToasts = rect("#achievementToasts");
    const hiddenFps = rect("#fpsCounter");
    const originalRootFontSize = document.documentElement.style.fontSize;
    document.documentElement.style.fontSize = "32px";
    window.__angleDebug.applySetting("topBarMode", "hidden");
    const largeToasts = rect("#achievementToasts");
    const largeFps = rect("#fpsCounter");
    document.documentElement.style.fontSize = originalRootFontSize;
    window.__angleDebug.applySetting("topBarMode", "news");
    return {
      normalToastTop: normalToasts?.top ?? 0,
      hiddenToastTop: hiddenToasts?.top ?? 0,
      hiddenFpsBottom: hiddenFps?.bottom ?? 0,
      largeToastTop: largeToasts?.top ?? 0,
      largeFpsBottom: largeFps?.bottom ?? 0,
    };
  });
  assert.ok(achievementToastPlacement.normalToastTop >= 0, "achievement toasts should remain positioned in normal mode");
  assert.ok(achievementToastPlacement.hiddenToastTop >= achievementToastPlacement.hiddenFpsBottom - 1, "hidden top bar achievement toasts should stay below the FPS counter");
  assert.ok(achievementToastPlacement.largeToastTop >= 0, "large-text achievement toasts should remain positioned");
  assert.ok(achievementToastPlacement.largeToastTop >= achievementToastPlacement.largeFpsBottom - 1, "large text achievement toasts should stay below the FPS counter");
  const breakCapPlacement = await page.evaluate(() => {
    const breakCap = document.querySelector("#breakCapButton");
    const subtabs = document.querySelector(".infinity-subtabs");
    const challengePanel = document.querySelector('[data-panel="challenges"]');
    return {
      exists: Boolean(breakCap),
      beforeSubtabs: Boolean(breakCap && subtabs && (breakCap.compareDocumentPosition(subtabs) & Node.DOCUMENT_POSITION_FOLLOWING)),
      inChallengePanel: Boolean(breakCap && challengePanel?.contains(breakCap)),
      conditionText: document.querySelector("#breakCapRequirement")?.textContent ?? "",
    };
  });
  assert.equal(breakCapPlacement.exists, true, "Break Infinite Cap control must exist");
  assert.equal(breakCapPlacement.beforeSubtabs, true, "Break Infinite Cap control must sit above the Infinity subtabs");
  assert.equal(breakCapPlacement.inChallengePanel, false, "Break Infinite Cap control must not be inside the IC panel");
  assert.match(breakCapPlacement.conditionText, /1e350|1.00e350/, "Break Infinite Cap requirement should be visible");

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
      "upgrade-row-action",
    ].find((slot) => child.classList.contains(slot)) ?? "").join(","));
    const rowStyles = compactRows.map((row) => {
      const style = getComputedStyle(row);
      return {
        action: row.querySelector(".upgrade-row-action")?.textContent?.trim() ?? "",
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
    "upgrade-row-name,upgrade-row-detail,upgrade-row-cost,upgrade-row-action",
    "upgrade-row-name,upgrade-row-detail,upgrade-row-cost,upgrade-row-action",
    "upgrade-row-name,upgrade-row-detail,upgrade-row-cost,upgrade-row-action",
  ], "IA rows should use the canonical four-slot order");
  assert.deepEqual(infiniteAnglePanel.rowStyles.map((row) => row.action), ["購入", "購入不可", "購入不可"], "IA should expose translated purchase states");
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

  await page.evaluate(() => {
    window.__angleFullscreenRequests = 0;
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: () => {
        window.__angleFullscreenRequests += 1;
        return Promise.resolve();
      },
    });
  });
  await page.locator('[data-tab="settings"]').click();
  assert.equal(await page.locator("#saveCodeArea").isVisible(), false, "save-code input should be collapsed by default");
  assert.equal(await page.locator("#exportSaveCodeButton").isVisible(), true, "Export should stay prominent");
  assert.equal(await page.locator("#importSaveCodeButton").isVisible(), true, "Import should stay prominent");
  assert.equal(await page.locator("#resetSaveButton").isVisible(), true, "reset should remain separately available");
  assert.deepEqual(
    await page.evaluate(() => ({
      codeOpen: document.querySelector("#saveCodeDetails")?.open ?? true,
      recoveryOpen: document.querySelector("#saveRecoveryDetails")?.open ?? true,
    })),
    { codeOpen: false, recoveryOpen: false },
    "save details and recovery should start collapsed",
  );
  const saveLabels = await page.evaluate(() => {
    const { state } = window.__angleDebug;
    const originalLanguage = state.language;
    const read = () => ({
      summary: document.querySelector("#saveCodeDetails > summary")?.textContent?.trim() ?? "",
      exportText: document.querySelector("#exportSaveCodeButton")?.textContent?.trim() ?? "",
      importText: document.querySelector("#importSaveCodeButton")?.textContent?.trim() ?? "",
    });
    state.language = "ja";
    window.advanceTime(0);
    const ja = read();
    state.language = "en";
    window.advanceTime(0);
    const en = read();
    state.language = originalLanguage;
    window.advanceTime(0);
    return { ja, en };
  });
  assert.deepEqual(saveLabels.ja, { summary: "セーブコード", exportText: "書き出し", importText: "読み込み" }, "Japanese save labels should remain clear");
  assert.deepEqual(saveLabels.en, { summary: "Save code", exportText: "Export", importText: "Import" }, "English save labels should remain clear");
  await page.locator("#importSaveCodeButton").click();
  assert.deepEqual(
    await page.evaluate(() => ({
      codeOpen: document.querySelector("#saveCodeDetails")?.open ?? false,
      activeId: document.activeElement?.id ?? null,
    })),
    { codeOpen: true, activeId: "saveCodeArea" },
    "Import should reveal and focus the editable save-code input",
  );
  const saveCodeArea = page.locator("#saveCodeArea");
  await saveCodeArea.focus();
  const focusBeforeInput = await page.evaluate(() => ({
    activeId: document.activeElement?.id ?? null,
    activeTagName: document.activeElement?.tagName ?? null,
    settingsActive: document.querySelector('.main-panel[data-panel="settings"]')?.classList.contains("is-active") ?? false,
  }));
  assert.equal(focusBeforeInput.activeId, "saveCodeArea", "save-code area must hold focus before typing");
  assert.equal(focusBeforeInput.settingsActive, true, "settings panel must be active before save-code typing");
  await saveCodeArea.press("f");
  const fullscreenRequestsAfterInput = await page.evaluate(() => window.__angleFullscreenRequests);
  assert.equal(
    fullscreenRequestsAfterInput,
    0,
    "typing f in the save-code area must not toggle fullscreen",
  );

  await page.evaluate(() => {
    const { state } = window.__angleDebug;
    state.generationCount = 7;
    state.previousGenerationScore = 1e12;
    state.previousGenerationScoreLog10 = 12;
    window.advanceTime(0);
  });
  await page.locator("#exportSaveCodeButton").click();
  await page.waitForFunction(() => document.querySelector("#saveCodeArea")?.value.startsWith("ANGLE_SAVE_V2:"));
  assert.equal(
    await page.evaluate(() => document.querySelector("#saveCodeDetails")?.open ?? false),
    true,
    "Export should reveal the generated save code",
  );
  assert.equal(await saveCodeArea.isVisible(), true, "exported save code should be visible for review");
  const exportedSaveCodeLength = await saveCodeArea.inputValue().then((value) => value.length);
  await page.evaluate(() => {
    window.__angleDebug.state.generationCount = 99;
  });
  await page.locator("#importSaveCodeButton").click();
  await page.waitForFunction(() => window.__angleDebug.state.generationCount === 7);
  assert.equal(
    await page.evaluate(() => document.querySelector("#saveRecoveryDetails")?.open ?? false),
    true,
    "a successful import should reveal pre-import recovery",
  );
  assert.equal(await page.locator("#restorePreImportButton").isVisible(), true, "pre-import recovery should be actionable");
  assert.ok(exportedSaveCodeLength > 20, "save-code export should populate the textarea");
  assert.equal(
    await page.evaluate(() => window.__angleDebug.state.previousGenerationScoreLog10),
    12,
    "save-code import should restore the exported state",
  );

  await page.locator('[data-tab="automation"]').click();
  const challengeAutomation = await page.evaluate(() => {
    window.__angleDebug.state.infinityCount = Math.max(1, window.__angleDebug.state.infinityCount);
    window.__angleDebug.state.infinityUpgradeMask |= (1 << 5) | (1 << 12);
    window.__angleDebug.state.activeChallenge = 1;
    window.__angleDebug.state.score = Number.MAX_VALUE;
    window.__angleDebug.state.scoreLog10 = 309;
    window.__angleDebug.state.automationEnabled = false;
    window.__angleDebug.state.autoRunInfinity = false;
    window.advanceTime(0);
    const withoutAutomation = window.__angleDebug.state.activeChallenge;
    window.__angleDebug.state.automationEnabled = true;
    window.__angleDebug.state.autoRunInfinity = true;
    window.__angleDebug.state.autoInfinityPointThresholdLog10 = 0;
    window.advanceTime(0);
    return {
      autoCompleteToggle: Boolean(document.querySelector("#autoCompleteChallengesToggle")),
      autoInfinityToggle: Boolean(document.querySelector("#autoRunInfinityToggle")),
      withoutAutomation,
      withAutoInfinity: window.__angleDebug.state.activeChallenge,
    };
  });
  assert.equal(
    challengeAutomation.autoCompleteToggle,
    false,
    "the dedicated IC auto-complete control should be removed",
  );
  assert.equal(
    challengeAutomation.autoInfinityToggle,
    true,
    "the normal Auto Infinity control should remain available",
  );
  assert.equal(
    challengeAutomation.withoutAutomation,
    1,
    "an IC goal should remain active when Auto Infinity is disabled",
  );
  assert.equal(
    challengeAutomation.withAutoInfinity,
    0,
    "normal Auto Infinity should complete the active IC",
  );

  const desktopAutomationDensity = await page.evaluate(() => ({
    cardCount: document.querySelectorAll('[data-panel="automation"] .settings-card').length,
    denseSectionCount: document.querySelectorAll('[data-panel="automation"] .dense-section').length,
    rowCount: document.querySelectorAll('[data-panel="automation"] .setting-row').length,
    dividerCount: document.querySelectorAll('[data-panel="automation"] .dense-divider').length,
    headingCount: document.querySelectorAll('[data-panel="automation"] .dense-section-heading').length,
    minimumRowHeight: Math.min(...Array.from(document.querySelectorAll('[data-panel="automation"] .setting-row'), (row) => row.getBoundingClientRect().height)),
  }));
  assert.equal(desktopAutomationDensity.cardCount, 0, "Automation should not wrap simple controls in cards");
  assert.equal(desktopAutomationDensity.denseSectionCount, 1, "Automation should use one shared dense section");
  assert.equal(desktopAutomationDensity.rowCount, 16, "Automation should retain every control row");
  assert.equal(desktopAutomationDensity.dividerCount, 2, "Automation should group controls with dividers");
  assert.equal(desktopAutomationDensity.headingCount, 3, "Automation should expose grouped section headings");
  assert.ok(desktopAutomationDensity.minimumRowHeight >= 44, "Automation rows should retain touch-safe height");

  await page.locator('[data-tab="settings"]').click();
  const desktopSettingsDensity = await page.evaluate(() => ({
    cardCount: document.querySelectorAll('[data-panel="settings"] .settings-card').length,
    denseSectionCount: document.querySelectorAll('[data-panel="settings"] .dense-section').length,
    headingCount: document.querySelectorAll('[data-panel="settings"] .dense-section-heading').length,
    dividerCount: document.querySelectorAll('[data-panel="settings"] .dense-divider').length,
    rowCount: document.querySelectorAll('[data-panel="settings"] .settings-options .setting-row').length,
  }));
  assert.equal(desktopSettingsDensity.cardCount, 0, "ordinary Settings controls should not use cards");
  assert.equal(desktopSettingsDensity.denseSectionCount, 2, "Settings should use section surfaces for options and tabs");
  assert.equal(desktopSettingsDensity.headingCount, 4, "Settings should expose display, progress, interface, and tab headings");
  assert.equal(desktopSettingsDensity.dividerCount, 2, "Settings should separate option groups with dividers");
  assert.equal(desktopSettingsDensity.rowCount, 9, "Settings should retain every setting row");

  await page.locator('[data-tab="statistics"]').click();
  const desktopStatisticsDensity = await page.evaluate(() => ({
    cardCount: document.querySelectorAll('[data-panel="statistics"] .settings-card').length,
    statRows: document.querySelectorAll('[data-statistics-panel="overview"] .dense-row').length,
    historySections: document.querySelectorAll('[data-panel="statistics"] .run-history.dense-section').length,
  }));
  assert.equal(desktopStatisticsDensity.cardCount, 0, "ordinary Statistics values should not use cards");
  assert.equal(desktopStatisticsDensity.statRows, 6, "Statistics should retain all overview values as dense rows");
  assert.equal(desktopStatisticsDensity.historySections, 2, "Statistics history should remain grouped sections");

  await page.locator('[data-tab="challenges"]').click();
  const firstChallengeRestriction = await page.locator("#challengeList .challenge-restriction").first().textContent();
  assert.match(firstChallengeRestriction ?? "", /基礎獲得式/, "the IC formula restriction should be visible");

  const angleTab = page.locator('[data-tab="angle"]');
  await angleTab.click();
  await angleTab.focus();
  const focusBeforeButton = await page.evaluate(() => ({
    activeTab: document.activeElement?.dataset?.tab ?? null,
    angleActive: document.querySelector('.main-panel[data-panel="angle"]')?.classList.contains("is-active") ?? false,
  }));
  assert.equal(focusBeforeButton.activeTab, "angle", "angle tab must hold focus before shortcut testing");
  assert.equal(focusBeforeButton.angleActive, true, "angle panel must be active before normal shortcut testing");
  await page.keyboard.press("f");
  const fullscreenRequestsAfterButton = await page.evaluate(() => window.__angleFullscreenRequests);
  assert.equal(
    fullscreenRequestsAfterButton,
    1,
    "plain f outside an editable element must still toggle fullscreen",
  );

  const mobileErrors = [];
  const mobilePageHandle = await openGamePage(gameTest.browser, gameTest.origin, {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    stubFonts: true,
    freezeAnimationFrame: false,
  });
  const { context: mobileContext, page: mobilePage } = mobilePageHandle;
  trackPage(mobilePage, "mobile", mobileErrors, httpFailures);
  try {
    const mobileButtonInteraction = await mobilePage.evaluate(() => {
      document.querySelector("#infiniteAngleUnlockButton").disabled = false;
      const selectors = ["[data-tab=angle]", "#speedUpgrade", "#infiniteAngleUnlockButton"];
      const rules = [];
      const collectRules = (cssRules) => {
        Array.from(cssRules).forEach((rule) => {
          if (rule.cssRules && rule.cssRules.length > 0) collectRules(rule.cssRules);
          else rules.push(rule);
        });
      };
      Array.from(document.styleSheets).forEach((styleSheet) => {
        try {
          collectRules(styleSheet.cssRules);
        } catch (error) {
          // Cross-origin stylesheets are not part of this local smoke test.
        }
      });
      const pressedRule = rules.find((rule) => rule.selectorText === "button:active:not(:disabled)");
      return {
        hoverNone: window.matchMedia("(hover: none)").matches,
        coarsePointer: window.matchMedia("(pointer: coarse)").matches,
        pressedFeedback: {
          transform: pressedRule?.style.transform ?? "",
          filter: pressedRule?.style.filter ?? "",
        },
        buttons: selectors.map((selector) => {
          const button = document.querySelector(selector);
          const styles = getComputedStyle(button);
          return {
            selector,
            disabled: Boolean(button?.disabled),
            transitionDurations: styles.transitionDuration.split(",").map((value) => value.trim()),
            touchAction: styles.touchAction,
            tapHighlightColor: styles.webkitTapHighlightColor,
          };
        }),
      };
    });
    assert.ok(
      mobileButtonInteraction.hoverNone || mobileButtonInteraction.coarsePointer,
      "the mobile smoke context should expose a touch-oriented pointer",
    );
    assert.ok(
      mobileButtonInteraction.buttons.every((button) => button.transitionDurations.every((duration) => duration === "0s")),
      "touch buttons should apply their state without a transition delay",
    );
    assert.ok(
      mobileButtonInteraction.buttons.every((button) => button.touchAction === "manipulation"),
      "touch buttons should use touch-action manipulation",
    );
    assert.ok(
      mobileButtonInteraction.buttons.every((button) => button.tapHighlightColor === "rgba(0, 0, 0, 0)"),
      "touch buttons should suppress the browser tap highlight",
    );
    assert.deepEqual(
      mobileButtonInteraction.pressedFeedback,
      { transform: "translateY(1px)", filter: "brightness(0.92)" },
      "touch buttons should retain visible pressed feedback after tap highlight suppression",
    );
    assert.equal(
      mobileButtonInteraction.buttons.find((button) => button.selector === "#infiniteAngleUnlockButton")?.disabled,
      false,
      "the Infinite Angle unlock button should be covered in its enabled touch state",
    );
    const mobileStartup = await mobilePage.evaluate(() => ({
      tabCount: document.querySelectorAll("[data-tab]").length,
      timeFluxTab: Boolean(document.querySelector('[data-tab="timeFlux"]')),
      timeFluxPanel: Boolean(document.querySelector("#timeFluxPanel")),
      timeFluxQuickBar: Boolean(document.querySelector("#timeFluxQuickBar")),
      canvasWidth: document.querySelector("#gameCanvas")?.getBoundingClientRect().width ?? 0,
    }));
    assert.equal(mobileStartup.tabCount, 9, "mobile startup should expose the active main tabs");
    assert.equal(mobileStartup.timeFluxTab, false, "mobile startup should omit the dormant Time Flux tab");
    assert.equal(mobileStartup.timeFluxPanel, false, "mobile startup should omit the dormant Time Flux panel");
    assert.equal(mobileStartup.timeFluxQuickBar, false, "mobile startup should omit the dormant Time Flux quick bar");
    assert.ok(mobileStartup.canvasWidth > 0, "the mobile Angle canvas should have a rendered width");
    const mobileAngleSurface = await mobilePage.evaluate(() => {
      const { state, switchMainTab } = window.__angleDebug;
      state.language = "ja";
      state.activeTowerChallenge = 0;
      switchMainTab("angle");
      window.advanceTime(0);
      const panel = document.querySelector(".angle-panel");
      const canvas = document.querySelector("#gameCanvas").getBoundingClientRect();
      const dock = document.querySelector(".reset-dock").getBoundingClientRect();
      const rows = Array.from(document.querySelectorAll(".normal-upgrades .upgrade-row"));
      return {
        normalHidden: document.querySelector("#normalUpgradeList")?.hidden ?? true,
        tc4Hidden: document.querySelector("#tc4UpgradeList")?.hidden ?? false,
        rowHeights: rows.map((row) => row.getBoundingClientRect().height),
        rowWidths: rows.map((row) => row.getBoundingClientRect().width),
        panelOverflow: Boolean(panel && panel.scrollWidth > panel.clientWidth + 1),
        rowOverflow: rows.some((row) => row.scrollWidth > row.clientWidth + 1),
        resetPosition: getComputedStyle(document.querySelector(".reset-dock")).position,
        resetOverlapsCanvas: dock.top < canvas.bottom - 1,
        renderTextLength: window.render_game_to_text().length,
      };
    });
    assert.equal(mobileAngleSurface.normalHidden, false, "mobile ANGLE should show ordinary controls outside TC4");
    assert.equal(mobileAngleSurface.tc4Hidden, true, "mobile ANGLE should hide TC4 controls when inactive");
    assert.ok(mobileAngleSurface.rowHeights.every((height) => height >= 42), "mobile ANGLE rows should remain touch-safe");
    assert.ok(mobileAngleSurface.rowWidths.every((width) => width > 300), "mobile ANGLE rows should use the available width");
    assert.equal(mobileAngleSurface.panelOverflow, false, "mobile ANGLE should not overflow horizontally");
    assert.equal(mobileAngleSurface.rowOverflow, false, "mobile ANGLE rows should not overflow");
    assert.equal(mobileAngleSurface.resetPosition, "static", "mobile ANGLE reset summaries should remain in normal flow");
    assert.equal(mobileAngleSurface.resetOverlapsCanvas, false, "mobile reset summaries should not cover the ANGLE canvas");
    assert.ok(mobileAngleSurface.renderTextLength > 0, "mobile ANGLE should retain the render_game_to_text debug surface");
    const mobileTc4Surface = await mobilePage.evaluate(() => {
      const { state } = window.__angleDebug;
      const original = structuredClone(state);
      Object.assign(state, {
        towerFloor: 12,
        activeChallenge: 0,
        activeTowerChallenge: 4,
        score: Number.MAX_VALUE,
        scoreLog10: 300,
        infiniteScore: Number.MAX_VALUE,
        infiniteScoreLog10: 300,
        language: "en",
      });
      window.advanceTime(0);
      const panel = document.querySelector(".angle-panel");
      const rows = Array.from(document.querySelectorAll("#tc4UpgradeList button[data-tc4-upgrade]"));
      const result = {
        normalHidden: document.querySelector("#normalUpgradeList")?.hidden ?? false,
        tc4Hidden: document.querySelector("#tc4UpgradeList")?.hidden ?? true,
        rowHeights: rows.map((row) => row.getBoundingClientRect().height),
        rowOverflow: rows.some((row) => row.scrollWidth > row.clientWidth + 1),
        panelOverflow: Boolean(panel && panel.scrollWidth > panel.clientWidth + 1),
        forbidden: rows.some((row) => /parts|log10|effective CB/i.test(row.textContent)),
      };
      Object.assign(state, original);
      window.advanceTime(0);
      return result;
    });
    assert.equal(mobileTc4Surface.normalHidden, true, "mobile TC4 should hide ordinary controls");
    assert.equal(mobileTc4Surface.tc4Hidden, false, "mobile TC4 should show the ANGLE-specific rows");
    assert.ok(mobileTc4Surface.rowHeights.every((height) => height >= 42), "mobile TC4 rows should remain touch-safe");
    assert.equal(mobileTc4Surface.rowOverflow, false, "mobile TC4 rows should not overflow");
    assert.equal(mobileTc4Surface.panelOverflow, false, "mobile TC4 should not overflow horizontally");
    assert.equal(mobileTc4Surface.forbidden, false, "mobile TC4 should use player-facing effect wording");

    const mobileLayoutOriginal = await mobilePage.evaluate(() => ({
      infinityCount: window.__angleDebug.state.infinityCount,
      infinityUpgradeMask: window.__angleDebug.state.infinityUpgradeMask,
      eternityCount: window.__angleDebug.state.eternityCount,
      hiddenTabs: [...window.__angleDebug.state.hiddenTabs],
      activeMainTab: window.__angleDebug.runtime.activeMainTab,
    }));
    await mobilePage.evaluate(() => {
      const { state } = window.__angleDebug;
      state.infinityCount = 1;
      state.infinityUpgradeMask = (1 << 1) | (1 << 5);
      state.eternityCount = 1;
      state.hiddenTabs = [];
      window.__angleDebug.switchMainTab("angle");
      window.advanceTime(0);
    });
    const mobileTabBar = await measureMainTabBar(mobilePage);
    const mobileUiContract = await readUiContract(mobilePage);
    assert.equal(mobileUiContract.activePrimaryPageCount, 1, "mobile should expose one primary owner for the active page");
    assert.equal(mobileUiContract.activePageOverflow.join("|"), "auto|hidden", "mobile page surfaces should own vertical scrolling");
    assert.equal(mobileUiContract.horizontalHostsValid, true, "mobile horizontal hosts should hide vertical overflow");
    assert.equal(mobileUiContract.subtabRolesValid, true, "mobile subtab strips should share the horizontal role");
    assert.equal(mobileUiContract.touchTargetMinimums, true, "mobile shared controls should retain touch-sized targets");
    assert.equal(mobileUiContract.mainReachableAtEnd, true, "mobile navigation end should remain reachable");
    assert.equal(mobileUiContract.renderTextAvailable, true, "mobile render_game_to_text should remain available");
    assert.equal(mobileUiContract.eternityPageRole, true, "mobile runtime Eternity should use the shared page role");
    assert.equal(mobileUiContract.timelineNoLongerPage, true, "mobile reparented Timeline should not retain page ownership");
    assert.equal(mobileTabBar.navDisplay, "flex", "mobile navigation should use a compact flex bar");
    assert.equal(mobileTabBar.navFlexWrap, "nowrap", "mobile navigation should never wrap");
    assert.equal(mobileTabBar.stripFlexWrap, "nowrap", "mobile navigation should never wrap");
    assert.ok(mobileTabBar.rows < 1, "mobile tabs should share one row");
    assert.ok(mobileTabBar.navScrollHeight <= mobileTabBar.navClientHeight + 1, "mobile navigation should remain one row when it overflows");
    assert.ok(mobileTabBar.stripScrollWidth > mobileTabBar.stripClientWidth, "mobile tabs should scroll horizontally when needed");
    assert.equal(mobileTabBar.allVisibleInStrip, true, "mobile visible tabs should share the scrolling strip");
    assert.equal(mobileTabBar.settingsInScrollHost, true, "mobile SET should stay inside the scrolling strip");
    assert.equal(mobileTabBar.hasTabOverlap, false, "mobile tabs should not overlap horizontally");
    assert.equal(mobileTabBar.hasTabContentOverflow, false, "mobile tabs should retain intrinsic content widths");
    const mobileSubtabContract = await mobilePage.evaluate(() => {
      const subtabs = Array.from(document.querySelectorAll(".infinity-subtab, .eternity-subtab, .challenge-subtab, .statistics-subtab"));
      const strips = Array.from(document.querySelectorAll(".infinity-subtabs, .eternity-subtabs, .challenge-subtabs, .statistics-subtabs"));
      return {
        shared: subtabs.every((button) => button.classList.contains("subtab")),
        minHeights: subtabs.map((button) => Number.parseFloat(getComputedStyle(button).minHeight)),
        longLabelsHidden: subtabs.map((button) => getComputedStyle(button.querySelector("strong")).position === "absolute"),
        stripStyles: strips.map((strip) => {
          const style = getComputedStyle(strip);
          return [style.display, style.overflowX, style.backgroundImage, style.boxShadow].join("|");
        }),
      };
    });
    assert.equal(mobileSubtabContract.shared, true, "mobile subtabs should keep the shared control contract");
    assert.ok(mobileSubtabContract.minHeights.every((height) => height >= 40), "mobile subtabs should retain touch-sized targets");
    assert.equal(mobileSubtabContract.longLabelsHidden.every(Boolean), true, "mobile subtabs should show short codes while retaining hidden long labels");
    assert.equal(new Set(mobileSubtabContract.stripStyles).size, 1, "mobile subtab strips should share the same lightweight surface");
    const mobileEndSettings = await mobilePage.evaluate(() => {
      const strip = document.querySelector(".main-tab-scroll");
      const settings = document.querySelector('[data-tab="settings"]');
      if (!strip || !settings) return { fullyVisible: false, inScrollHost: false };
      strip.scrollLeft = strip.scrollWidth;
      const stripRect = strip.getBoundingClientRect();
      const settingsRect = settings.getBoundingClientRect();
      return {
        fullyVisible: settingsRect.left >= stripRect.left - 1 && settingsRect.right <= stripRect.right + 1,
        inScrollHost: settings.parentElement === strip,
      };
    });
    assert.equal(mobileEndSettings.fullyVisible, true, "mobile SET should be fully visible after scrolling to the row end");
    assert.equal(mobileEndSettings.inScrollHost, true, "mobile SET should remain in the shared scrolling strip at its end");
    await mobilePage.evaluate((original) => {
      const { state } = window.__angleDebug;
      state.infinityCount = original.infinityCount;
      state.infinityUpgradeMask = original.infinityUpgradeMask;
      state.eternityCount = original.eternityCount;
      state.hiddenTabs = original.hiddenTabs;
      window.__angleDebug.switchMainTab(original.activeMainTab);
      window.advanceTime(0);
    }, mobileLayoutOriginal);

    await mobilePage.locator('[data-tab="settings"]').click();
    const mobileOfflineSetting = await mobilePage.evaluate(() => ({
      panelActive: document.querySelector('[data-panel="settings"]')?.classList.contains("is-active") ?? false,
      progressToggleWidth: document.querySelector("#offlineProgressToggle")?.getBoundingClientRect().width ?? 0,
      progressToggleHeight: document.querySelector("#offlineProgressToggle")?.getBoundingClientRect().height ?? 0,
      tickInputWidth: document.querySelector("#offlineTickInput")?.getBoundingClientRect().width ?? 0,
      tickInputHeight: document.querySelector("#offlineTickInput")?.getBoundingClientRect().height ?? 0,
    }));
    assert.equal(mobileOfflineSetting.panelActive, true, "the Settings tab should activate on mobile");
    assert.ok(mobileOfflineSetting.progressToggleWidth > 0, "the mobile offline progress setting should remain visible");
    assert.ok(mobileOfflineSetting.progressToggleHeight > 0, "the mobile offline progress setting should remain usable");
    assert.ok(mobileOfflineSetting.tickInputWidth > 0, "the mobile offline tick setting should remain visible");
    assert.ok(mobileOfflineSetting.tickInputHeight > 0, "the mobile offline tick setting should remain usable");

    await mobilePage.locator('[data-tab="achievements"]').click();
    const mobileAchievements = await mobilePage.evaluate(() => {
      const { state } = window.__angleDebug;
      state.achievementMask = 0x7fffffff;
      state.achievementMaskHigh = 0b1111111111;
      state.language = "ja";
      window.advanceTime(0);
      const rows = document.querySelectorAll(".achievement-row");
      const lastRow = rows[rows.length - 1];
      return {
        panelActive: document.querySelector('[data-panel="achievements"]')?.classList.contains("is-active") ?? false,
        count: rows.length,
        lastTitle: lastRow?.querySelector(".achievement-title")?.textContent?.trim() ?? "",
        listWidth: document.querySelector("#achievementList")?.getBoundingClientRect().width ?? 0,
      };
    });
    assert.equal(mobileAchievements.panelActive, true, "the Achievements panel should activate on mobile");
    assert.equal(mobileAchievements.count, 41, "the mobile Achievements panel should render 41 rows");
    assert.equal(mobileAchievements.lastTitle, "Time is generative", "the mobile Achievements panel should keep the final row visible");
    assert.ok(mobileAchievements.listWidth > 0, "the mobile achievement list should have a visible layout");

    const mobileVertexGainDisplay = await mobilePage.evaluate(() => {
      const { state, switchMainTab } = window.__angleDebug;
      switchMainTab("angle");
      const original = {
        achievementMask: state.achievementMask,
        achievementMaskHigh: state.achievementMaskHigh,
        coreBoostCount: state.coreBoostCount,
        gainLevel: state.gainLevel,
        ic8VertexUpgradeLevel: state.ic8VertexUpgradeLevel,
        infiniteScore: state.infiniteScore,
        infiniteScoreLog10: state.infiniteScoreLog10,
        infinityUpgradeMask: state.infinityUpgradeMask,
        numberFormat: state.numberFormat,
      };
      state.achievementMask = 0;
      state.achievementMaskHigh = 0;
      state.coreBoostCount = 0;
      state.gainLevel = 99999999;
      state.ic8VertexUpgradeLevel = 0;
      state.infiniteAngleUnlocked = false;
      state.infiniteScore = 0;
      state.infiniteScoreLog10 = -Infinity;
      state.infinityUpgradeMask = 0;
      state.numberFormat = "compact";
      window.advanceTime(0);
      const value = document.querySelector("#vertexGainValue");
      const metric = value?.closest(".metric");
      const metricRect = metric?.getBoundingClientRect();
      const result = {
        text: value?.textContent?.trim() ?? "",
        metricWidth: metricRect?.width ?? 0,
        metricClientWidth: metric?.clientWidth ?? 0,
        metricScrollWidth: metric?.scrollWidth ?? 0,
      };
      Object.assign(state, original);
      window.advanceTime(0);
      return result;
    });
    assert.equal(mobileVertexGainDisplay.text, "+1.00M", "mobile compact vertex gain display should use suffix notation at 1e6");
    assert.ok(mobileVertexGainDisplay.metricWidth > 0, "the mobile vertex gain metric should have a rendered width");
    assert.ok(
      mobileVertexGainDisplay.metricScrollWidth <= mobileVertexGainDisplay.metricClientWidth + 1,
      "the mobile vertex gain display should not overflow its metric",
    );

    await mobilePage.locator('[data-tab="statistics"]').click();
    const mobileStatistics = await mobilePage.evaluate(() => ({
      panelActive: document.querySelector('[data-panel="statistics"]')?.classList.contains("is-active") ?? false,
      totalRealPlayTimeWidth: document.querySelector("#totalRealPlayTime")?.getBoundingClientRect().width ?? 0,
      currentInfinityRealTimeWidth: document.querySelector("#currentInfinityRealTime")?.getBoundingClientRect().width ?? 0,
    }));
    assert.equal(mobileStatistics.panelActive, true, "the Statistics tab should activate on mobile");
    assert.ok(mobileStatistics.totalRealPlayTimeWidth > 0, "mobile statistics should show total real play time");
    assert.ok(mobileStatistics.currentInfinityRealTimeWidth > 0, "mobile statistics should show current real Infinity time");
    await mobilePage.locator('[data-statistics-tab="eternity"]').click();
    const mobileEternityStatistics = await mobilePage.evaluate(() => ({
      panelActive: document.querySelector('[data-statistics-panel="eternity"]')?.classList.contains("is-active") ?? false,
      currentTimeWidth: document.querySelector("#currentEternityRunTime")?.getBoundingClientRect().width ?? 0,
      historyWidth: document.querySelector("#lastEternityRuns")?.getBoundingClientRect().width ?? 0,
    }));
    assert.equal(mobileEternityStatistics.panelActive, true, "mobile Statistics should activate the ETR subtab");
    assert.ok(mobileEternityStatistics.currentTimeWidth > 0, "mobile ETR statistics should show current game time");
    assert.ok(mobileEternityStatistics.historyWidth > 0, "mobile ETR statistics should show run history");

    const mobileStatisticsDensity = await mobilePage.evaluate(() => ({
      cardCount: document.querySelectorAll('[data-panel="statistics"] .settings-card').length,
      statRows: document.querySelectorAll('[data-statistics-panel="eternity"] .dense-row').length,
      rowHeights: Array.from(document.querySelectorAll('[data-statistics-panel="eternity"] .dense-row'), (row) => row.getBoundingClientRect().height),
      rowOverflow: Array.from(document.querySelectorAll('[data-statistics-panel="eternity"] .dense-row')).some((row) => row.scrollWidth > row.clientWidth + 1),
    }));
    assert.equal(mobileStatisticsDensity.cardCount, 0, "mobile Statistics should avoid per-value cards");
    assert.equal(mobileStatisticsDensity.statRows, 4, "mobile Eternity Statistics should keep four dense value rows");
    assert.ok(mobileStatisticsDensity.rowHeights.every((height) => height >= 44), "mobile Statistics rows should remain touch-safe");
    assert.equal(mobileStatisticsDensity.rowOverflow, false, "mobile Statistics rows should keep labels and values readable");

    await mobilePage.locator('[data-tab="automation"]').click();
    const mobileAutomationDensity = await mobilePage.evaluate(() => ({
      panelActive: document.querySelector('[data-panel="automation"]')?.classList.contains("is-active") ?? false,
      cardCount: document.querySelectorAll('[data-panel="automation"] .settings-card').length,
      rowCount: document.querySelectorAll('[data-panel="automation"] .setting-row').length,
      rowHeights: Array.from(document.querySelectorAll('[data-panel="automation"] .setting-row'), (row) => row.getBoundingClientRect().height),
      rowOverflow: Array.from(document.querySelectorAll('[data-panel="automation"] .setting-row')).some((row) => row.scrollWidth > row.clientWidth + 1),
    }));
    assert.equal(mobileAutomationDensity.panelActive, true, "the mobile Automation tab should activate");
    assert.equal(mobileAutomationDensity.cardCount, 0, "mobile Automation should avoid a large settings card");
    assert.equal(mobileAutomationDensity.rowCount, 16, "mobile Automation should keep every control row");
    assert.ok(mobileAutomationDensity.rowHeights.every((height) => height >= 44), "mobile Automation rows should remain touch-safe");
    assert.equal(mobileAutomationDensity.rowOverflow, false, "mobile Automation rows should keep controls within the viewport");

    await mobilePage.locator('[data-tab="settings"]').click();
    const mobileSettingsDensity = await mobilePage.evaluate(() => ({
      panelActive: document.querySelector('[data-panel="settings"]')?.classList.contains("is-active") ?? false,
      cardCount: document.querySelectorAll('[data-panel="settings"] .settings-card').length,
      optionSectionWidth: document.querySelector('[data-panel="settings"] .settings-options')?.getBoundingClientRect().width ?? 0,
      rowHeights: Array.from(document.querySelectorAll('[data-panel="settings"] .settings-options .setting-row'), (row) => row.getBoundingClientRect().height),
      rowOverflow: Array.from(document.querySelectorAll('[data-panel="settings"] .settings-options .setting-row')).some((row) => row.scrollWidth > row.clientWidth + 1),
      saveCodeOpen: document.querySelector("#saveCodeDetails")?.open ?? true,
      saveRecoveryOpen: document.querySelector("#saveRecoveryDetails")?.open ?? true,
      saveActionsOverflow: ["#exportSaveCodeButton", "#importSaveCodeButton", "#resetSaveButton"].some((selector) => {
        const button = document.querySelector(selector);
        return Boolean(button && button.scrollWidth > button.clientWidth + 1);
      }),
    }));
    assert.equal(mobileSettingsDensity.panelActive, true, "the mobile Settings tab should activate");
    assert.equal(mobileSettingsDensity.cardCount, 0, "mobile Settings options should avoid per-section cards");
    assert.ok(mobileSettingsDensity.optionSectionWidth > 0, "mobile Settings should keep its option section visible");
    assert.ok(mobileSettingsDensity.rowHeights.every((height) => height >= 44), "mobile Settings rows should remain touch-safe");
    assert.equal(mobileSettingsDensity.rowOverflow, false, "mobile Settings rows should keep controls within the viewport");
    assert.equal(mobileSettingsDensity.saveCodeOpen, false, "mobile save-code input should remain collapsed by default");
    assert.equal(mobileSettingsDensity.saveRecoveryOpen, false, "mobile recovery should remain collapsed by default");
    assert.equal(mobileSettingsDensity.saveActionsOverflow, false, "mobile save actions should remain readable");

    const mobileUpgradeCenters = await mobilePage.evaluate(() => {
      const { switchMainTab, switchInfinitySubtab } = window.__angleDebug;
      switchMainTab("infinity");
      switchInfinitySubtab("upgrades");
      window.advanceTime(0);
      const centerDelta = (tierSelector) => {
        const tier = document.querySelector(tierSelector)?.getBoundingClientRect();
        const node = document.querySelector(`${tierSelector} .infinity-upgrade-node`)?.getBoundingClientRect();
        if (!tier || !node) return null;
        return Math.abs((tier.left + tier.width / 2) - (node.left + node.width / 2));
      };
      return {
        tier12: centerDelta('[data-infinity-panel="upgrades"] [data-tier="12"]'),
        tier13: centerDelta('[data-infinity-panel="upgrades"] [data-tier="13"]'),
        tier14: centerDelta('[data-infinity-panel="upgrades"] [data-tier="14"]'),
        nodeContract: Array.from(document.querySelectorAll('[data-infinity-panel="upgrades"] .infinity-upgrade-node')).every((node) => (
          Boolean(node.querySelector(".infinity-upgrade-name")?.textContent?.trim())
          && Boolean(node.querySelector(".infinity-upgrade-cost")?.textContent?.trim())
          && Boolean(node.querySelector(".infinity-upgrade-state")?.textContent?.trim())
        )),
        nodeHeights: Array.from(document.querySelectorAll('[data-infinity-panel="upgrades"] .infinity-upgrade-node'), (node) => node.getBoundingClientRect().height),
        treeOverflow: document.querySelector('[data-infinity-panel="upgrades"] .infinity-upgrade-tree')?.scrollWidth > document.querySelector('[data-infinity-panel="upgrades"] .infinity-upgrade-tree')?.clientWidth,
        tierOneColumns: getComputedStyle(document.querySelector('[data-infinity-panel="upgrades"] [data-tier="1"]')).gridTemplateColumns.trim().split(/\s+/).length,
      };
    });
    assert.ok(mobileUpgradeCenters.tier12 !== null && mobileUpgradeCenters.tier12 < 1, "mobile IU 12-1 should be centered");
    assert.ok(mobileUpgradeCenters.tier13 !== null && mobileUpgradeCenters.tier13 < 1, "mobile IU 13-1 should be centered");
    assert.ok(mobileUpgradeCenters.tier14 !== null && mobileUpgradeCenters.tier14 < 1, "mobile IU 14-1 should be centered");
    assert.equal(mobileUpgradeCenters.nodeContract, true, "mobile IU nodes should keep name, cost, and state in the node");
    assert.ok(mobileUpgradeCenters.nodeHeights.every((height) => height <= 50), "mobile IU nodes should stay compact");
    assert.equal(mobileUpgradeCenters.treeOverflow, false, "mobile IU tree should fit the viewport");
    assert.equal(mobileUpgradeCenters.tierOneColumns, 2, "mobile IU should preserve the first branching tier");

    const mobileInfiniteAngle = await mobilePage.evaluate(() => {
      const { state, unlockInfiniteAngle, switchMainTab, switchInfinitySubtab, applySetting } = window.__angleDebug;
      state.infinityPointsExact = "100000000000000000000";
      state.infinityPoints = 1e20;
      state.infinityPointsLog10 = 20;
      state.infiniteAngleUnlocked = false;
      unlockInfiniteAngle();
      switchMainTab("infinity");
      switchInfinitySubtab("angle");
      applySetting("topBarMode", "hidden");
      applySetting("showFps", true);
      window.advanceTime(0);
      const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect();
      const toasts = rect("#achievementToasts");
      const fps = rect("#fpsCounter");
      return {
        panelActive: document.querySelector('[data-infinity-panel="angle"]')?.classList.contains("is-active") ?? false,
        canvasWidth: document.querySelector("#infiniteAngleCanvas")?.getBoundingClientRect().width ?? 0,
        toastTop: toasts?.top ?? 0,
        fpsTop: fps?.top ?? 0,
      };
    });
    assert.equal(mobileInfiniteAngle.panelActive, true, "the mobile IA panel should activate");
    assert.ok(mobileInfiniteAngle.canvasWidth > 0, "the mobile IA canvas should have a rendered width");
    assert.ok(mobileInfiniteAngle.toastTop >= 0, "mobile achievement toasts should remain positioned");
    assert.ok(mobileInfiniteAngle.fpsTop >= 0, "mobile FPS should remain positioned");
    assert.deepEqual(mobileErrors, [], "mobile critical paths should produce no browser errors");
  } finally {
    await mobileContext.close();
  }

  assert.deepEqual(errors, []);
  assert.deepEqual(httpFailures, [], "browser smoke should not have HTTP failures");
  console.log("browser feature regression test passed");
} finally {
  if (context) await context.close();
  await gameTest.close();
}
