import assert from "node:assert/strict";
import { openGamePage, trackPage } from "../../browser-harness.mjs";

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
  const before = strip?.scrollLeft ?? 0;
  if (strip) strip.scrollLeft = 0;
  const rects = visibleButtons.map((button) => button.getBoundingClientRect());
  const sortedRects = [...rects].sort((a, b) => a.left - b.left);
  const stripRect = strip?.getBoundingClientRect();
  const startLastRect = visibleButtons.at(-1)?.getBoundingClientRect();
  const lastFillsAtStart = Boolean(
    stripRect
    && startLastRect
    && Math.abs(startLastRect.right - stripRect.right) <= 1,
  );
  if (strip) strip.scrollLeft = strip.scrollWidth;
  const endLastRect = visibleButtons.at(-1)?.getBoundingClientRect();
  const lastReachableAtEnd = Boolean(
    stripRect
    && endLastRect
    && endLastRect.right <= stripRect.right + 1,
  );
  if (strip) strip.scrollLeft = before;
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
    visibleTabs: visibleButtons.map((button) => button.dataset.tab),
    tabWidths: rects.map((rect) => rect.width),
    rows: rects.length > 0 ? Math.max(...rects.map((rect) => rect.top)) - Math.min(...rects.map((rect) => rect.top)) : Infinity,
    allVisibleInStrip: visibleButtons.every((button) => button.parentElement === strip),
    settingsInScrollHost: settings?.parentElement === strip,
    hasTabOverlap: sortedRects.some((rect, index) => sortedRects[index + 1] && rect.right > sortedRects[index + 1].left + 0.5),
    hasTabContentOverflow: visibleButtons.some((button) => button.scrollWidth > button.clientWidth + 1),
    lastFillsAtStart,
    lastReachableAtEnd,
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
    const before = strip?.scrollLeft ?? 0;
    if (strip) strip.scrollLeft = 0;
    const rects = buttons.map((button) => button.getBoundingClientRect());
    const sortedRects = [...rects].sort((a, b) => a.left - b.left);
    const stripRect = strip?.getBoundingClientRect();
    const startLastRect = buttons.at(-1)?.getBoundingClientRect();
    const lastFillsAtStart = Boolean(
      stripRect
      && startLastRect
      && Math.abs(startLastRect.right - stripRect.right) <= 1,
    );
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
      lastFillsAtStart,
      lastReachableAtEnd,
    };
  });
});

export async function runDesktopResponsiveLayout({ page, readUiContract, readScrollOwnership }) {
  const desktopUiContract = await readUiContract(page);
  const desktopAngleScrollOwnership = await readScrollOwnership(page);
  assert.equal(desktopUiContract.activePrimaryPageCount, 1, "desktop should expose one primary owner for the active page");
  assert.equal(desktopUiContract.pageOwnerCount, desktopUiContract.mainPanelCount, "every main page should declare the primary owner");
  assert.equal(desktopUiContract.activePageOverflow.join("|"), "auto|hidden", "desktop page surfaces should own vertical scrolling");
  assert.equal(desktopUiContract.helpPageOverflow.join("|"), "auto|hidden", "Help should use the shared page scroll contract");
  assert.equal(desktopUiContract.mainNavRole, true, "main navigation should expose the shared role");
  assert.equal(desktopUiContract.mainTabListRole, true, "main navigation should expose the tablist role");
  assert.equal(desktopUiContract.mainTabRolesValid, true, "main navigation members should expose tab roles");
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
  assert.equal(desktopUiContract.globalPrestigeSurface, false, "the dual global prestige surface should be removed");
  assert.equal(desktopUiContract.infinityActionLocal, true, "Infinity should keep its action inside the Infinity page");
  assert.equal(desktopUiContract.eternityActionLocal, true, "Eternity should keep its action inside the Eternity page");
  assert.equal(desktopUiContract.angleLayoutCount, 1, "ANGLE should expose one stable layout");
  assert.equal(desktopUiContract.upgradeRailCount, 1, "ANGLE should keep one upgrade rail");
  assert.equal(desktopUiContract.stagePanelCount, 1, "ANGLE should keep one stage panel");
  assert.equal(desktopUiContract.angleStableOrder, true, "ANGLE should place the upgrade rail before the stage panel");
  assert.deepEqual(desktopAngleScrollOwnership.pageOverflow, ["auto", "hidden"], "desktop ANGLE should use the page as its vertical owner");
  assert.deepEqual(desktopAngleScrollOwnership.nestedVerticalOwners, [], "desktop ANGLE should have no nested vertical scroll trap");
  assert.deepEqual(desktopAngleScrollOwnership.mainPanelsOverflow, ["hidden", "hidden"], "desktop ANGLE main panels should not own page scrolling");
  assert.equal(desktopAngleScrollOwnership.visibleSectionsBorderless, true, "desktop shared sections should avoid redundant frames");
  assert.equal(desktopAngleScrollOwnership.finalContentReachable, true, "desktop ANGLE final actions should remain reachable");
  await page.setViewportSize({ width: 1280, height: 1200 });
  const tallAngleComposition = await page.evaluate(() => {
    const playfield = document.querySelector(".angle-panel .playfield-wrap")?.getBoundingClientRect();
    const reset = document.querySelector(".stage-panel .reset-dock")?.getBoundingClientRect();
    return {
      gap: playfield && reset ? reset.top - playfield.bottom : Infinity,
      playfieldHeight: playfield?.height ?? 0,
    };
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  assert.ok(Math.abs(tallAngleComposition.gap) <= 1, "tall ANGLE reset controls should stay attached to the playfield");
  assert.ok(tallAngleComposition.playfieldHeight <= 521, "tall ANGLE viewports should not stretch the canvas past its cap");
  const angleUpgradeContract = await page.evaluate(() => {
    const { state, runtime, switchMainTab } = window.__angleDebug;
    const originalState = structuredClone(state);
    const originalTab = runtime.activeMainTab;
    const rows = Array.from(document.querySelectorAll("#normalUpgradeList .upgrade-row"));
    const slotOrder = (row) => [...row.children].map((child) => [
      "upgrade-row-name",
      "upgrade-row-detail",
      "upgrade-row-cost",
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
  assert.ok(angleUpgradeContract.purchasable.every((row) => row.slots === "upgrade-row-name,upgrade-row-detail,upgrade-row-cost"), "ANGLE rows should expose the compact three-slot order");
  assert.ok(angleUpgradeContract.purchasable.every((row) => row.action === "" && !row.disabled), "affordable ANGLE rows should expose state through the control itself");
  assert.ok(angleUpgradeContract.purchasable.every((row) => row.height <= 56 && !row.overflow), "desktop ANGLE rows should stay dense without overflow");
  assert.equal(new Set(angleUpgradeContract.purchasable.map((row) => row.borderColor)).size, 3, "ANGLE actions should retain distinct color identities");
  assert.ok(angleUpgradeContract.purchasable.every((row) => row.backgroundImage === "none"), "ANGLE rows should avoid large gradient fills");
  assert.equal(angleUpgradeContract.buyAllWide.disabled, false, "ANGLE Buy All should enable when a normal action is affordable");
  assert.ok(angleUpgradeContract.buyAllWide.width < angleUpgradeContract.buyAllWide.parentWidth, "ANGLE Buy All should remain a compact section action");
  assert.ok(angleUpgradeContract.buyAllWide.height <= 42, "ANGLE Buy All should remain compact");
  assert.equal(angleUpgradeContract.buyAllWide.backgroundImage, "none", "ANGLE Buy All should avoid a dominant gradient fill");
  assert.ok(angleUpgradeContract.japaneseUnavailable.every((row) => row.disabled && row.action === ""), "unaffordable Japanese ANGLE rows should expose state through the disabled control");
  assert.equal(angleUpgradeContract.unavailableBuyAllDisabled, true, "ANGLE Buy All should disable when no normal action is affordable");
  assert.ok(angleUpgradeContract.englishUnavailable.every((row) => row.action === ""), "unaffordable English ANGLE rows should not render repeated action copy");
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
}
export async function runDesktopPageHeaders({ page }) {
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
}
export async function runMobileResponsive({ browser, origin, httpFailures, readUiContract }) {
  const mobileErrors = [];
  const mobilePageHandle = await openGamePage(browser, origin, {
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
    const issue321FitViewports = [
      { width: 360, height: 844 },
      { width: 390, height: 844 },
      { width: 412, height: 915 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
    ];
    const issue321FitNavigation = [];
    for (const viewport of issue321FitViewports) {
      await mobilePage.setViewportSize(viewport);
      issue321FitNavigation.push({ viewport, layout: await measureMainTabBar(mobilePage) });
    }
    await mobilePage.setViewportSize({ width: 390, height: 844 });
    for (const { viewport, layout } of issue321FitNavigation) {
      assert.ok(layout.stripScrollWidth <= layout.stripClientWidth + 1, `${viewport.width}px fit navigation should not reserve unused horizontal space`);
      assert.equal(layout.lastFillsAtStart, true, `${viewport.width}px fit navigation should fill through the last visible tab`);
      assert.equal(layout.hasTabContentOverflow, false, `${viewport.width}px fit navigation should retain intrinsic tab content`);
    }
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
    await mobilePage.setViewportSize({ width: 320, height: 844 });
    const mobileLapSpeedSoftcap = await mobilePage.evaluate(() => {
      const { runtime, state, switchMainTab } = window.__angleDebug;
      const original = structuredClone(state);
      const originalTab = runtime.activeMainTab;
      const readLayout = (speedLevel, language) => {
        Object.assign(state, {
          generationCount: 0,
          coreBoostCount: 0,
          towerFloor: 0,
          activeChallenge: 0,
          activeTowerChallenge: 0,
          completedChallenges: 0,
          infinityUpgradeMask: 0,
          eternityCount: 0,
          eternityMilestoneMask: 0,
          speedLevel,
          language,
          numberFormat: "compact",
        });
        runtime.appliedLanguage = "";
        switchMainTab("angle");
        window.advanceTime(0);
        const value = document.querySelector("#lapSpeedValue");
        const metric = value?.closest(".metric");
        const stage = document.querySelector(".stage-panel");
        const header = stage?.querySelector(".topbar");
        return {
          text: value?.textContent ?? "",
          title: value?.getAttribute("title") ?? null,
          metricHeight: metric?.getBoundingClientRect().height ?? 0,
          metricClientHeight: metric?.clientHeight ?? 0,
          metricScrollHeight: metric?.scrollHeight ?? 0,
          metricClientWidth: metric?.clientWidth ?? 0,
          metricScrollWidth: metric?.scrollWidth ?? 0,
          stageTop: stage?.getBoundingClientRect().top ?? 0,
          headerTop: header?.getBoundingClientRect().top ?? 0,
          rawLapSpeedLog10: runtime.rawLapSpeedLog10(),
          effectiveLapSpeedLog10: runtime.effectiveLapSpeedLog10(),
          softcapStart: runtime.lapSpeedSoftcapStart(),
          softcapPower: runtime.lapSpeedSoftcapPower(),
          softcapped: runtime.isLapSpeedSoftcapped(),
        };
      };
      const result = {
        inactive: readLayout(0, "ja"),
        activeShort: readLayout(20, "ja"),
        activeLong: readLayout(250, "ja"),
        activeShortAgain: readLayout(20, "ja"),
        activeLongAgain: readLayout(250, "ja"),
        activeLongEnglish: readLayout(250, "en"),
      };
      Object.assign(state, original);
      runtime.appliedLanguage = "";
      switchMainTab(originalTab);
      window.advanceTime(0);
      return result;
    });
    await mobilePage.setViewportSize({ width: 390, height: 844 });
    assert.equal(mobileLapSpeedSoftcap.inactive.softcapped, false, "lap speed below the softcap should be inactive");
    assert.doesNotMatch(mobileLapSpeedSoftcap.inactive.text, / SC$/, "inactive lap speed should not show SC");
    const activeLapSpeedLayouts = [
      mobileLapSpeedSoftcap.activeShort,
      mobileLapSpeedSoftcap.activeLong,
      mobileLapSpeedSoftcap.activeShortAgain,
      mobileLapSpeedSoftcap.activeLongAgain,
    ];
    for (const layout of [...activeLapSpeedLayouts, mobileLapSpeedSoftcap.activeLongEnglish]) {
      assert.match(layout.text, / SC$/, "softcapped lap speed should end with SC");
      assert.doesNotMatch(layout.text, /軟上限中|softcapped/, "old softcap wording should be absent");
      assert.equal(layout.title, null, "lap speed should not add a tooltip title");
      assert.ok(layout.metricScrollHeight <= layout.metricClientHeight + 1, "lap speed metric should not wrap vertically");
      assert.ok(layout.metricScrollWidth <= layout.metricClientWidth + 1, "lap speed metric should not overflow horizontally");
      assert.equal(layout.softcapped, true, "softcapped lap speed should retain its state");
      assert.equal(layout.softcapStart, 35, "lap speed softcap start should remain unchanged");
      assert.equal(layout.softcapPower, 0.22, "lap speed softcap power should remain unchanged");
    }
    const metricHeights = activeLapSpeedLayouts.map((layout) => layout.metricHeight);
    assert.ok(Math.max(...metricHeights) - Math.min(...metricHeights) <= 1, "lap speed value changes should keep metric height stable");
    const stageTops = activeLapSpeedLayouts.map((layout) => layout.stageTop);
    assert.ok(Math.max(...stageTops) - Math.min(...stageTops) <= 1, "lap speed value changes should keep ANGLE stage position stable");
    const headerTops = activeLapSpeedLayouts.map((layout) => layout.headerTop);
    assert.ok(Math.max(...headerTops) - Math.min(...headerTops) <= 1, "lap speed value changes should keep ANGLE header position stable");
    for (const [layout, speedLevel] of [
      [mobileLapSpeedSoftcap.activeShort, 20],
      [mobileLapSpeedSoftcap.activeLong, 250],
    ]) {
      const expectedRaw = speedLevel * Math.log10(1.22);
      const expectedEffective = Math.log10(35) + (expectedRaw - Math.log10(35)) * 0.22;
      assert.ok(Math.abs(layout.rawLapSpeedLog10 - expectedRaw) < 1e-12, "lap speed raw log should remain unchanged");
      assert.ok(Math.abs(layout.effectiveLapSpeedLog10 - expectedEffective) < 1e-12, "lap speed effective log should remain unchanged");
    }
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
    const issue321RuntimeNavigation = [];
    for (const viewport of issue321FitViewports) {
      await mobilePage.setViewportSize(viewport);
      issue321RuntimeNavigation.push({
        viewport,
        main: await measureMainTabBar(mobilePage),
        subtabs: await measureSubtabRails(mobilePage),
      });
    }
    await mobilePage.setViewportSize({ width: 390, height: 844 });
    let runtimeNavigationOverflow = false;
    for (const { viewport, main, subtabs } of issue321RuntimeNavigation) {
      assert.equal(main.visibleTabs.includes("eternity"), true, `${viewport.width}px runtime navigation should retain the Eternity tab`);
      assert.equal(main.hasTabContentOverflow, false, `${viewport.width}px runtime tabs should retain intrinsic content`);
      if (main.stripScrollWidth > main.stripClientWidth + 1) {
        runtimeNavigationOverflow = true;
        assert.equal(main.lastReachableAtEnd, true, `${viewport.width}px overflowing runtime tabs should reach their end`);
      } else {
        assert.equal(main.lastFillsAtStart, true, `${viewport.width}px fitting runtime tabs should fill the strip`);
      }
      for (const rail of subtabs) {
        assert.equal(rail.hasContentOverflow, false, `${viewport.width}px ${rail.panel} subtabs should retain intrinsic content`);
        if (rail.scrollWidth > rail.clientWidth + 1) {
          assert.equal(rail.lastReachableAtEnd, true, `${viewport.width}px overflowing ${rail.panel} subtabs should reach their end`);
        } else {
          assert.equal(rail.lastFillsAtStart, true, `${viewport.width}px fitting ${rail.panel} subtabs should fill the strip`);
        }
      }
    }
    assert.equal(runtimeNavigationOverflow, true, "runtime Eternity navigation should retain horizontal scrolling when the visible set overflows");
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
    assert.equal(mobileAchievements.count, 44, "the mobile Achievements panel should render 44 rows");
    assert.equal(mobileAchievements.lastTitle, "1+多元のそれぞれの宇宙", "the mobile Achievements panel should keep the final row visible");
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
}
