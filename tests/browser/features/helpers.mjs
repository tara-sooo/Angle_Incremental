export async function readUiContract(targetPage) {
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
      mainTabListRole: document.querySelector(".ui-main-nav")?.getAttribute("role") === "tablist",
      mainTabRolesValid: Array.from(document.querySelectorAll(".ui-main-nav [data-tab]"))
        .every((tab) => tab.getAttribute("role") === "tab"),
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
      globalPrestigeSurface: Boolean(document.querySelector("#prestigeActionSurface")),
      infinityActionLocal: Boolean(document.querySelector('[data-panel="infinity"] #infinityButton')),
      eternityActionLocal: Boolean(document.querySelector('[data-panel="eternity"] #eternityPerformButton')),
      angleLayoutCount: document.querySelectorAll(".angle-layout").length,
      upgradeRailCount: document.querySelectorAll(".angle-layout > .upgrade-rail").length,
      stagePanelCount: document.querySelectorAll(".angle-layout > .stage-panel").length,
      angleStableOrder: (() => {
        const layout = document.querySelector(".angle-layout");
        const rail = layout?.querySelector(":scope > .upgrade-rail");
        const stage = layout?.querySelector(":scope > .stage-panel");
        return Boolean(layout && rail && stage && layout.firstElementChild === rail && layout.lastElementChild === stage);
      })(),
    };
  });
}

export async function readScrollOwnership(targetPage) {
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
