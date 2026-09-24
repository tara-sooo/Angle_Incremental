import assert from "node:assert/strict";

export async function runHelp({ page, readScrollOwnership }) {
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
      paragraphs: Array.from(document.querySelectorAll("#helpSections > .help-article > .help-section-body"), (node) => node.textContent?.trim() ?? ""),
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
  assert.ok(helpUi.fresh.paragraphs.length >= 2, "fresh Help should render readable paragraphs");
  assert.doesNotMatch(helpUi.fresh.text, /Infinity Upgrade|Eternity Milestone|Tower Challenge/, "fresh Help should omit undiscovered spoilers");
  assert.equal(helpUi.upper.topics.length, 17, "upper progression should expose every shipped Help topic");
  assert.equal(helpUi.upper.articleCount, 1, "upper Help should keep one focused article");
  assert.equal(helpUi.upper.anchorCount, 0, "upper Help should keep one navigation model");
  assert.equal(helpUi.upper.accordionCount, 0, "upper Help should keep one content surface");
  assert.equal(helpUi.upper.articleTopic, "tower", "Help should focus the previous Infinity subtab");
  assert.equal(helpUi.upper.current, "Tower", "Help navigation should mark the previous subtab topic");
  assert.ok(helpUi.upper.paragraphs.length >= 1, "unlocked Help should render body content");
  assert.equal(helpUi.upper.context, "", "Help should omit the redundant contextual focus meta");
  assert.deepEqual(helpUi.afterReset.topics, helpUi.upper.topics, "discovered Help topics should survive a reset");
  assert.match(helpUi.english.current, /Tower/, "Help navigation should switch to English");
  assert.equal(helpUi.english.context, "", "Help should omit the redundant contextual focus meta in English");
  assert.equal(helpUi.englishChallenges.articleTopic, "tower-challenges", "Help should focus the first-era challenge topic from the challenge subtab");
  assert.ok(helpUi.englishChallenges.paragraphs.length >= 1, "English Help should keep challenge guidance readable");
  assert.match(helpUi.englishChallenges.text, /restriction|goal|reward/i, "English Help should explain challenge rules and rewards");

  await page.locator('[data-tab="help"]').click();
  await page.locator('#helpNav button[data-help-topic="offline"]').click();
  await page.evaluate(() => window.advanceTime(0));
  const clickedHelp = await page.evaluate(() => ({
    articleTopic: document.querySelector("#helpSections > .help-article")?.dataset.helpTopic ?? "",
    current: document.querySelector("#helpNav button[aria-current]")?.dataset.helpTopic ?? "",
    articleCount: document.querySelectorAll("#helpSections > .help-article").length,
    paragraphCount: document.querySelectorAll("#helpSections > .help-article > .help-section-body").length,
    activeElement: document.activeElement?.id ?? "",
    context: document.querySelector("#helpContext")?.textContent?.trim() ?? "",
  }));
  assert.deepEqual(clickedHelp, {
    articleTopic: "offline",
    current: "offline",
    articleCount: 1,
    paragraphCount: 1,
    activeElement: "helpArticle",
    context: "",
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
      paragraphCount: bodies.length,
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
  assert.ok(desktopHelpLayout.paragraphCount >= 1, "desktop Help should render body content");
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
  assert.ok(compactDesktopHelpScrollOwnership.pageScrollHeight >= compactDesktopHelpScrollOwnership.pageClientHeight, "compact desktop Help should remain within the page scroll owner");
  assert.equal(compactDesktopHelpScrollOwnership.pageAtEnd, true, "compact desktop Help should reach the article end");
  assert.equal(compactDesktopHelpScrollOwnership.finalContentReachable, true, "compact desktop Help article should remain reachable at scroll end");
  assert.deepEqual(compactDesktopHelpScrollOwnership.nestedVerticalOwners, [], "compact desktop Help should have no nested vertical scroll trap");
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileHelpLayout = await measureHelpLayout();
  const mobileHelpScrollOwnership = await readScrollOwnership(page);
  assert.equal(mobileHelpLayout.topicCount, 17, "mobile Help should render every discovered topic");
  assert.equal(mobileHelpLayout.articleCount, 1, "mobile Help should render one focused article");
  assert.ok(mobileHelpLayout.paragraphCount >= 1, "mobile Help should render body content");
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
}
