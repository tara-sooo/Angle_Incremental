import assert from "node:assert/strict";

export async function runNavigationSettings({ page }) {
  const readMainTabPlacement = () => page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector);
      const box = node?.getBoundingClientRect();
      return box ? {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      } : null;
    };
    const shell = document.querySelector(".shell");
    const nav = document.querySelector(".main-tabs");
    const strip = document.querySelector(".main-tab-scroll");
    const active = document.querySelector(".main-tab.is-active");
    const visibleTabs = Array.from(document.querySelectorAll(".main-tab")).filter((tab) => !tab.hidden);
    const navRect = rect(".main-tabs");
    const panelsRect = rect(".main-panels");
    const playfieldRect = rect(".angle-panel .playfield-wrap");
    const resetDockRect = rect(".angle-panel .reset-dock");
    return {
      state: window.__angleDebug.state.mainTabPosition,
      saved: JSON.parse(localStorage.getItem("angle-incremental-save") || "null")?.state?.mainTabPosition,
      serialized: window.__angleDebug.runtime.serializeSaveData().state.mainTabPosition,
      select: document.querySelector("#mainTabPositionSelect")?.value ?? "",
      label: document.querySelector('label[for="mainTabPositionSelect"] [data-i18n="mainTabPosition"]')?.textContent?.trim() ?? "",
      hint: document.querySelector('[data-i18n="mainTabPositionHint"]')?.textContent?.trim() ?? "",
      options: Array.from(document.querySelectorAll("#mainTabPositionSelect option"), (option) => option.value),
      shellRightClass: shell?.classList.contains("main-tabs-right") ?? false,
      navDirection: nav ? getComputedStyle(nav).flexDirection : "",
      stripDirection: strip ? getComputedStyle(strip).flexDirection : "",
      stripOverflow: strip ? [getComputedStyle(strip).overflowY, getComputedStyle(strip).overflowX] : [],
      navRect,
      panelsRect,
      settingsInNav: (() => {
        const settings = rect('[data-tab="settings"]');
        return Boolean(settings && navRect && settings.left >= navRect.left - 1 && settings.right <= navRect.right + 1 && settings.top >= navRect.top - 1 && settings.bottom <= navRect.bottom + 1);
      })(),
      visibleTabsInNav: visibleTabs.every((tab) => {
        const tabRect = tab.getBoundingClientRect();
        return Boolean(navRect && tabRect.left >= navRect.left - 1 && tabRect.right <= navRect.right + 1 && tabRect.top >= navRect.top - 1 && tabRect.bottom <= navRect.bottom + 1);
      }),
      activeBorderLeftWidth: active ? getComputedStyle(active).borderLeftWidth : "",
      activeAriaSelected: active?.getAttribute("aria-selected") ?? "",
      playfieldRect,
      resetDockRect,
      resetDockFollowsPlayfield: Boolean(playfieldRect && resetDockRect && resetDockRect.top >= playfieldRect.bottom - 1),
    };
  });
  const defaultMainTabPlacement = await readMainTabPlacement();
  assert.equal(defaultMainTabPlacement.state, "right", "eligible desktop should default to the right tab rail");
  assert.equal(defaultMainTabPlacement.serialized, "right", "default tab position should be included in serialized saves");
  assert.equal(defaultMainTabPlacement.select, "right", "Tab position should default to Right");
  assert.equal(defaultMainTabPlacement.label, "デスクトップのタブ位置", "Settings should describe the saved preference as a desktop tab position");
  assert.equal(defaultMainTabPlacement.hint, "モバイル・縦画面では下部に固定されます", "Settings should explain the forced mobile and portrait placement");
  assert.deepEqual(defaultMainTabPlacement.options, ["right", "bottom"], "Tab position should expose Right and Bottom");
  assert.equal(defaultMainTabPlacement.shellRightClass, true, "default desktop layout should expose the right-rail shell class");
  assert.equal(defaultMainTabPlacement.stripDirection, "column", "right navigation should stack the compact tabs vertically");
  assert.deepEqual(defaultMainTabPlacement.stripOverflow, ["auto", "hidden"], "right navigation should own vertical scrolling");
  assert.ok(defaultMainTabPlacement.navRect.left >= defaultMainTabPlacement.panelsRect.right - 1, "right navigation should stay outside the main panels");
  assert.equal(defaultMainTabPlacement.settingsInNav, true, "SET should remain reachable in the right rail");
  assert.equal(defaultMainTabPlacement.visibleTabsInNav, true, "visible tabs should remain inside the right rail");
  assert.equal(defaultMainTabPlacement.activeBorderLeftWidth, "2px", "right active indication should use the rail edge");
  assert.equal(defaultMainTabPlacement.activeAriaSelected, "true", "right active indication should retain aria-selected");
  assert.equal(defaultMainTabPlacement.resetDockFollowsPlayfield, true, "right placement should keep ANGLE reset controls below the playfield");

  await page.locator('[data-tab="settings"]').click();
  const mainTabPositionSelect = page.locator("#mainTabPositionSelect");
  await mainTabPositionSelect.selectOption("bottom");
  const selectedBottom = await readMainTabPlacement();
  assert.equal(selectedBottom.state, "bottom", "Settings should select Bottom for the desktop preference");
  assert.equal(selectedBottom.saved, "bottom", "Bottom selection should save immediately");
  assert.equal(selectedBottom.shellRightClass, false, "Bottom selection should remove the right-rail shell class");
  assert.equal(selectedBottom.stripDirection, "row", "Bottom selection should retain the horizontal navigation");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__angleDebug?.state && window.__angleDebug?.ready));
  await page.evaluate(() => window.__angleDebug.ready);
  const reloadedBottom = await readMainTabPlacement();
  assert.equal(reloadedBottom.state, "bottom", "Bottom preference should survive reload");
  assert.equal(reloadedBottom.select, "bottom", "reloaded Settings should show Bottom");

  const legacySaveWithoutPosition = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem("angle-incremental-save") || "null");
    delete save.state.mainTabPosition;
    localStorage.setItem("angle-incremental-save", JSON.stringify(save));
    return JSON.parse(localStorage.getItem("angle-incremental-save") || "null").state.mainTabPosition;
  });
  assert.equal(legacySaveWithoutPosition, undefined, "legacy fixture should omit the new preference");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(window.__angleDebug?.state && window.__angleDebug?.ready));
  await page.evaluate(() => window.__angleDebug.ready);
  const legacyDefault = await readMainTabPlacement();
  assert.equal(legacyDefault.state, "right", "old saves should default the desktop preference to Right");
  assert.equal(legacyDefault.shellRightClass, true, "old saves should restore the eligible desktop right rail");

  await page.evaluate(() => {
    window.__angleDebug.applySetting("mainTabPosition", "right");
    window.__angleDebug.switchMainTab("angle");
    window.advanceTime(0);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileForcedBottom = await readMainTabPlacement();
  assert.equal(mobileForcedBottom.state, "right", "mobile layout should not rewrite the desktop preference");
  assert.equal(mobileForcedBottom.shellRightClass, true, "mobile should retain the saved desktop preference in state");
  assert.equal(mobileForcedBottom.stripDirection, "row", "mobile should force the bottom navigation");
  assert.equal(mobileForcedBottom.hint, "モバイル・縦画面では下部に固定されます", "mobile Settings should explain why the saved desktop preference is not applied");
  assert.ok(mobileForcedBottom.navRect.top >= mobileForcedBottom.panelsRect.bottom - 1, "mobile navigation should stay below the main panels");
  await page.setViewportSize({ width: 768, height: 900 });
  const portraitForcedBottom = await readMainTabPlacement();
  assert.equal(portraitForcedBottom.state, "right", "portrait constrained layout should preserve the desktop preference");
  assert.equal(portraitForcedBottom.stripDirection, "row", "portrait constrained layout should use the bottom navigation");
  await page.setViewportSize({ width: 1280, height: 900 });
  const restoredDesktopRight = await readMainTabPlacement();
  assert.equal(restoredDesktopRight.state, "right", "desktop should restore the saved Right preference after resize");
  assert.equal(restoredDesktopRight.stripDirection, "column", "desktop resize should restore the right rail");
  assert.equal(restoredDesktopRight.settingsInNav, true, "SET should remain reachable after responsive restoration");

  const rightVisibility = await page.evaluate(() => {
    const { state, applySetting, setMainTabVisibility, switchMainTab } = window.__angleDebug;
    state.hiddenTabs = [];
    applySetting("mainTabPosition", "right");
    switchMainTab("angle");
    window.advanceTime(0);
    setMainTabVisibility("help", false);
    const help = document.querySelector('[data-tab="help"]');
    const hidden = {
      hidden: help?.hidden ?? false,
      display: help ? getComputedStyle(help).display : "",
      hiddenTabs: [...state.hiddenTabs],
      position: state.mainTabPosition,
    };
    setMainTabVisibility("help", true);
    return hidden;
  });
  assert.equal(rightVisibility.hidden, true, "right placement should preserve hidden-tab behavior");
  assert.equal(rightVisibility.display, "none", "hidden tabs should leave the right rail");
  assert.deepEqual(rightVisibility.hiddenTabs, ["help"], "right placement should keep hiddenTabs independent");
  assert.equal(rightVisibility.position, "right", "hidden-tab changes should not change tab position");
  await page.evaluate(() => window.__angleDebug.applySetting("mainTabPosition", "bottom"));
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
}
export async function runNavigationSurfacePrelude({ page }) {
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
}
export async function runNavigationSettingsDensity({ page }) {
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
  assert.equal(desktopSettingsDensity.rowCount, 11, "Settings should retain every setting row");

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
}
