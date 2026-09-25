import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { expectedAppVersion, stubExternalFonts, trackPage } from "../../browser-harness.mjs";

export async function runOfflineRecoverySurface({ page }) {
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
}
export async function runSaveRecoveryBoot({ page, browser, origin }) {
  const backupStore = await page.evaluate(() => {
    const { runtime, state, createCheckpoint } = window.__angleDebug;
    state.generationCount = 42;
    if (!runtime.saveGame("manual")) throw new Error("failed to seed the main save");
    if (!createCheckpoint("periodic", { force: true })) throw new Error("failed to seed the recovery backup");
    const backups = JSON.parse(localStorage.getItem("angle-incremental-save-backups"));
    if (backups?.periodic?.[0]?.save?.state?.generationCount !== 42) {
      throw new Error("the recovery backup does not contain the seeded save");
    }
    return { periodic: [backups.periodic[0]], preUpdate: null, reserve: null };
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  const httpFailures = [];
  try {
    await stubExternalFonts(context);
    const recoveryPage = await context.newPage();
    trackPage(recoveryPage, "save-recovery", errors, httpFailures);
    await recoveryPage.addInitScript(({ appVersion, backups }) => {
      window.__iddRafRequests = 0;
      window.requestAnimationFrame = () => {
        window.__iddRafRequests += 1;
        return window.__iddRafRequests;
      };
      localStorage.setItem("angle-incremental-seen-version", appVersion);
      localStorage.removeItem("angle-incremental-save");
      localStorage.setItem("angle-incremental-save-backups", JSON.stringify(backups));
    }, { appVersion: expectedAppVersion, backups: backupStore });
    await recoveryPage.goto(`${origin}/index.html`, { waitUntil: "networkidle" });
    await recoveryPage.waitForFunction(() => Boolean(window.__angleDebug?.state && window.__angleDebug?.ready));
    await recoveryPage.evaluate(() => window.__angleDebug.ready);

    const recoveryState = await recoveryPage.evaluate(() => ({
      resolution: window.__angleDebug.bootResolution(),
      recoveryMode: window.__angleDebug.runtime.loadRecoveryMode,
      settingsActive: document.querySelector('[data-panel="settings"]')?.classList.contains("is-active") ?? false,
      detailsOpen: document.querySelector("#saveRecoveryDetails")?.open ?? false,
      statusVisible: Boolean(document.querySelector("#loadFailureStatus")?.getClientRects().length),
      backupCount: document.querySelectorAll("#saveCheckpointList .save-checkpoint-row").length,
      startNewVisible: !document.querySelector("#startNewSaveButton")?.hidden,
      mainRaw: localStorage.getItem("angle-incremental-save"),
      generationCount: window.__angleDebug.state.generationCount,
      frameRequests: window.__iddRafRequests,
    }));
    assert.equal(recoveryState.resolution, "RECOVERY", "a missing main save with a backup must enter recovery");
    assert.equal(recoveryState.recoveryMode, true, "boot recovery must stay guarded");
    assert.equal(recoveryState.settingsActive, true, "recovery boot should open the Settings surface automatically");
    assert.equal(recoveryState.detailsOpen, true, "recovery details should open automatically");
    assert.equal(recoveryState.statusVisible, true, "the recovery explanation should be visible");
    assert.equal(recoveryState.backupCount, 1, "the unified backup should be listed");
    assert.equal(recoveryState.startNewVisible, true, "recovery should offer an explicit new-save action");
    assert.equal(recoveryState.mainRaw, null, "recovery boot must not establish a new main save");
    assert.equal(recoveryState.generationCount, 0, "recovery boot must not load backup progress implicitly");
    assert.equal(recoveryState.frameRequests, 0, "gameplay must not start before recovery is resolved");
    await mkdir("output/playwright", { recursive: true });
    await recoveryPage.screenshot({ path: "output/playwright/issue-459-recovery-desktop.png" });

    await recoveryPage.setViewportSize({ width: 390, height: 844 });
    await recoveryPage.locator("#saveRecoveryDetails").scrollIntoViewIfNeeded();
    const mobileSurface = await recoveryPage.evaluate(() => {
      const details = document.querySelector("#saveRecoveryDetails")?.getBoundingClientRect();
      const restore = document.querySelector("#saveCheckpointList [data-backup-slot]")?.getBoundingClientRect();
      return {
        detailsVisible: Boolean(details && details.top >= 0 && details.bottom <= innerHeight),
        restoreVisible: Boolean(restore && restore.width > 0 && restore.left >= 0 && restore.right <= innerWidth),
        restoreHeight: restore?.height ?? 0,
      };
    });
    assert.equal(mobileSurface.detailsVisible, true, "mobile recovery details should fit the viewport after reveal");
    assert.equal(mobileSurface.restoreVisible, true, "the mobile restore control should remain within the viewport");
    assert.ok(mobileSurface.restoreHeight >= 40, "the mobile restore control should remain touch-friendly");
    await recoveryPage.screenshot({ path: "output/playwright/issue-459-recovery-mobile.png" });

    await recoveryPage.locator('#saveCheckpointList [data-backup-slot="periodic"][data-backup-index="0"]').click();
    await recoveryPage.waitForFunction(() => document.querySelector("#confirmationModal")?.open === true);
    await recoveryPage.locator("#confirmationConfirmButton").click();
    await recoveryPage.waitForFunction(() => (
      window.__angleDebug.bootResolution() === "NORMAL"
      && window.__angleDebug.state.generationCount === 42
      && !window.__angleDebug.runtime.loadRecoveryMode
    ));
    const restoredState = await recoveryPage.evaluate(() => ({
      main: JSON.parse(localStorage.getItem("angle-incremental-save")),
      frameRequests: window.__iddRafRequests,
    }));
    assert.equal(restoredState.main.state.generationCount, 42, "explicit restore should write and load the selected backup");
    assert.ok(restoredState.frameRequests > 0, "resolving recovery should start the game loop");

    await recoveryPage.waitForFunction(() => !window.__angleDebug.runtime.loadInFlight);
    const offlineReportClose = recoveryPage.locator("#offlineReportClose");
    if (await offlineReportClose.isVisible()) await offlineReportClose.click();
    await recoveryPage.evaluate(() => {
      const { runtime } = window.__angleDebug;
      document.querySelector("#saveRecoveryDetails").open = false;
      runtime.switchMainTab("angle");
      const updated = JSON.parse(localStorage.getItem(runtime.SAVE_KEY));
      updated.state.generationCount = 84;
      updated.savedAt = Date.now();
      localStorage.setItem(runtime.SAVE_KEY, JSON.stringify(updated));
      runtime.handleStorageChange({ key: runtime.SAVE_KEY });
    });
    const conflictState = await recoveryPage.evaluate(() => ({
      conflicted: window.__angleDebug.runtime.saveConflictMode,
      settingsActive: document.querySelector('[data-panel="settings"]')?.classList.contains("is-active") ?? false,
      detailsOpen: document.querySelector("#saveRecoveryDetails")?.open ?? false,
      reloadVisible: !document.querySelector("#reloadLatestSaveButton")?.hidden,
      exportEnabled: !document.querySelector("#exportSaveCodeButton")?.disabled,
      currentGenerationCount: window.__angleDebug.state.generationCount,
      latestGenerationCount: JSON.parse(localStorage.getItem("angle-incremental-save")).state.generationCount,
    }));
    assert.equal(conflictState.conflicted, true, "a changed main save should lock the current tab");
    assert.equal(conflictState.settingsActive, true, "conflict detection should reveal its resolution controls");
    assert.equal(conflictState.detailsOpen, true, "conflict details should open automatically");
    assert.equal(conflictState.reloadVisible, true, "conflict should offer explicit reload-latest");
    assert.equal(conflictState.exportEnabled, true, "conflict should leave current-state export available");
    assert.equal(conflictState.currentGenerationCount, 42, "conflict detection must not auto-load the other tab");
    assert.equal(conflictState.latestGenerationCount, 84);
    await recoveryPage.locator("#exportSaveCodeButton").click();
    await recoveryPage.waitForFunction(
      () => document.querySelector("#saveCodeArea")?.value.startsWith("ANGLE_SAVE_V2:"),
      null,
      { timeout: 5000, polling: 100 },
    );
    await recoveryPage.locator("#reloadLatestSaveButton").click();
    await recoveryPage.waitForFunction(() => (
      !window.__angleDebug.runtime.saveConflictMode
      && window.__angleDebug.state.generationCount === 84
    ), null, { timeout: 5000, polling: 100 });
    assert.equal(JSON.parse(await recoveryPage.evaluate(() => localStorage.getItem("angle-incremental-save"))).state.generationCount, 84,
      "explicit reload-latest should load the updated save");
    assert.deepEqual(errors, []);
    assert.deepEqual(httpFailures, []);
  } finally {
    await context.close();
  }
}

export async function runSaveCodeRecovery({ page }) {
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
    const { runtime, state } = window.__angleDebug;
    if (!runtime.saveGame("manual")) throw new Error("failed to seed the current save before import");
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
  await page.waitForFunction(() => !window.__angleDebug.runtime.loadInFlight);
  const offlineReportClose = page.locator("#offlineReportClose");
  if (await offlineReportClose.isVisible()) await offlineReportClose.click();
  const importedRecovery = await page.evaluate(() => {
    const reserve = window.__angleDebug.recoveryEntries().backups.find((entry) => entry.slot === "reserve");
    return {
      reserveReason: reserve?.reason ?? null,
      detailsOpen: document.querySelector("#saveRecoveryDetails")?.open ?? true,
    };
  });
  assert.equal(importedRecovery.reserveReason, "pre-import", "import should retain the current valid save in reserve");
  assert.equal(importedRecovery.detailsOpen, false, "healthy play should keep recovery behind progressive disclosure");
  await page.locator("#saveRecoveryDetails > summary").click();
  assert.equal(
    await page.locator('#saveCheckpointList button[data-backup-slot="reserve"]').isVisible(),
    true,
    "the unified reserve backup should remain actionable",
  );
  assert.ok(exportedSaveCodeLength > 20, "save-code export should populate the textarea");
  assert.equal(
    await page.evaluate(() => window.__angleDebug.state.previousGenerationScoreLog10),
    12,
    "save-code import should restore the exported state",
  );
}
