import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = path.join(root, "browser-smoke-report.json");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};
const EXPECTED_ASSET_VERSION = "0.7.0";
const EXPECTED_MODULE_PATHS = [
  "/src/main.js",
  "/src/runtime/shared.js",
  "/src/ui/dom.js",
  "/src/core/constants.js",
  "/src/data/i18n.js",
  "/src/data/infinity-data.js",
  "/src/core/state.js",
  "/src/core/numbers.js",
  "/src/core/save.js",
  "/src/core/save-code.js",
  "/src/systems/achievements.js",
  "/src/systems/tower.js",
  "/src/ui/render-canvas.js",
  "/src/ui/render-topbar.js",
  "/src/ui/render-challenges.js",
  "/src/ui/render-infinity.js",
  "/src/ui/render-achievements.js",
  "/src/ui/render-automation.js",
  "/src/ui/render-ui.js",
  "/src/systems/angle.js",
  "/src/systems/generation.js",
  "/src/systems/core-boost.js",
  "/src/systems/infinity.js",
  "/src/systems/infinite-angle.js",
  "/src/systems/balance.js",
  "/src/systems/balance-angle.js",
  "/src/systems/balance-generation.js",
  "/src/systems/balance-core-boost.js",
  "/src/systems/balance-infinity.js",
  "/src/systems/balance-ui.js",
  "/src/systems/infinity-point-normalization.js",
  "/src/ui/events.js",
];

function resolveRequestPath(requestUrl) {
  const parsed = new URL(requestUrl, "http://127.0.0.1");
  const requested = decodeURIComponent(parsed.pathname === "/" ? "/index.html" : parsed.pathname);
  const relative = path.normalize(requested.replace(/^\/+/, ""));
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return path.join(root, relative);
}

const server = createServer(async (request, response) => {
  const filePath = resolveRequestPath(request.url || "/");
  if (!filePath) {
    response.writeHead(403).end();
    return;
  }
  try {
    const metadata = await stat(filePath);
    if (!metadata.isFile()) throw new Error("not a file");
    const extension = path.extname(filePath);
    response.writeHead(200, { "content-type": contentTypes[extension] || "application/octet-stream" });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("failed to bind smoke-test server");

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=disabled"],
});
const errors = [];
const moduleRequests = [];
const report = {
  result: "running",
  expectedAssetVersion: EXPECTED_ASSET_VERSION,
  errors,
  moduleRequests: [],
};
try {
  const page = await browser.newPage();
  const localOrigin = `http://127.0.0.1:${address.port}`;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === localOrigin && url.pathname.startsWith("/src/") && url.pathname.endsWith(".js")) {
      moduleRequests.push(url);
    }
  });

  await page.goto(`${localOrigin}/index.html`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => (
    typeof window.render_game_to_text === "function"
    && Boolean(window.__angleDebug?.state)
  ));

  const updateModal = await page.evaluate(() => {
    const modal = document.querySelector("#updateModal");
    return {
      visible: Boolean(modal && !modal.hidden),
      title: document.querySelector("#updateModalTitle")?.textContent?.trim() ?? "",
      summary: modal?.querySelector("[data-i18n=updateSummary]")?.textContent?.trim() ?? "",
    };
  });
  assert.equal(updateModal.visible, true, "the 0.7.0 update modal should appear for a fresh browser profile");
  assert.equal(updateModal.title, "0.7.0 アップデート", "the update modal should show the current Japanese version");
  assert.match(updateModal.summary, /Infinity Angle/);
  const manifestVersion = await page.evaluate(async () => (await fetch("version.json", { cache: "no-store" })).json());
  assert.equal(manifestVersion.appVersion, EXPECTED_ASSET_VERSION, "version.json should match the asset version");
  await page.locator("#updateModalClose").click();
  await page.waitForFunction(() => document.querySelector("#updateModal")?.hidden === true);

  const snapshot = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  assert.equal(snapshot.vertices, 3);
  assert.equal(snapshot.infinity.count, 0);
  assert.equal(typeof snapshot.score, "string");

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
    const mainTabs = Array.from(document.querySelectorAll(".main-tab"), (button) => button.dataset.tab);
    const infinityTabs = Array.from(document.querySelectorAll(".infinity-subtab"), (button) => button.dataset.infinityTab);
    const challengeTabs = Array.from(document.querySelectorAll(".challenge-subtab"), (button) => button.dataset.challengeTab);
    return { mainTabs, infinityTabs, challengeTabs };
  });
  assert.deepEqual(
    tabStructure.mainTabs,
    ["angle", "infinity", "challenges", "automation", "statistics", "achievements", "help", "settings"],
    "main tabs should place Challenges after Infinity",
  );
  assert.deepEqual(tabStructure.infinityTabs, ["upgrades", "angle", "tower"], "Infinity subtabs should be ordered Upgrades, IA, Tower");
  assert.deepEqual(tabStructure.challengeTabs, ["ic", "tc"], "Challenges should expose IC and TC subtabs");
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
      buildDisabled: Boolean(document.querySelector("#towerBuildButton")?.disabled),
    };
    switchMainTab("challenges");
    switchChallengeSubtab("tc");
    return {
      towerState,
      challengePanelActive: Boolean(document.querySelector('[data-challenge-panel="tc"]')?.classList.contains("is-active")),
      towerChallengeRows: document.querySelectorAll("#towerChallengeList .tower-challenge-row").length,
      towerChallengeButton: document.querySelector("#towerChallengeList .tower-challenge-row button")?.textContent?.trim() ?? "",
      towerChallengeRestriction: document.querySelector("#towerChallengeList .tower-challenge-row .challenge-restriction")?.textContent?.trim() ?? "",
    };
  });
  assert.equal(towerInitial.towerState.panelActive, true, "Infinity > Tower should activate the Tower panel");
  assert.equal(towerInitial.towerState.floor, "0", "Tower should start at Floor 0");
  assert.match(towerInitial.towerState.cost, /1\.00e50/, "Floor 1 should display an e50 IP cost");
  assert.equal(towerInitial.towerState.buildDisabled, true, "Tower construction should be disabled without IP");
  assert.equal(towerInitial.challengePanelActive, true, "Challenges > TC should activate the TC panel");
  assert.equal(towerInitial.towerChallengeRows, 4, "TC placeholder rows should be visible");
  assert.match(towerInitial.towerChallengeButton, /今後のリリース/);
  assert.match(towerInitial.towerChallengeRestriction, /今後のリリース/);
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
  assert.ok(hiddenTopBar.panelTop < 20, "hidden top bar should let the main panels move upward");
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
  assert.ok(fpsPlacement.hiddenTop < 30, "FPS counter should return to the top when the top bar is hidden");
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
    state.infinityPointsExact = "100000000000000000100";
    state.infinityPoints = 1e20;
    state.infinityPointsLog10 = 20;
    switchMainTab("infinity");
    switchInfinitySubtab("angle");
    window.advanceTime(0);
    const canvas = document.querySelector("#infiniteAngleCanvas");
    const panel = document.querySelector('[data-infinity-panel="angle"]');
    const beforeLevel = state.infiniteAngleSpeedLevel;
    const upgradeCosts = [
      document.querySelector("#infiniteAngleSpeedCost")?.textContent?.trim() ?? "",
      document.querySelector("#infiniteAngleVertexCost")?.textContent?.trim() ?? "",
      document.querySelector("#infiniteAngleGainCost")?.textContent?.trim() ?? "",
    ];
    const bought = buyInfiniteAngleUpgrade("speed");
    window.advanceTime(0);
    return {
      panelActive: Boolean(panel?.classList.contains("is-active")),
      canvasWidth: canvas?.getBoundingClientRect().width ?? 0,
      canvasHeight: canvas?.getBoundingClientRect().height ?? 0,
      canvasPixel: canvas?.getContext("2d")?.getImageData(1, 1, 1, 1).data?.[0] ?? 0,
      scoreText: document.querySelector("#infiniteScorePanel")?.textContent?.trim() ?? "",
      unlockHidden: Boolean(document.querySelector("#infiniteAngleUnlockButton")?.hidden),
      unlockNoteDisplay: getComputedStyle(document.querySelector("#infiniteAngleUnlockNote")).display,
      bought,
      speedLevel: state.infiniteAngleSpeedLevel,
      expectedSpeedLevel: beforeLevel + 1,
      ipExact: state.infinityPointsExact,
      upgradeWidths: Array.from(document.querySelectorAll(".infinite-angle-upgrades .upgrade-button"), (button) => button.getBoundingClientRect().width),
      upgradeCosts,
    };
  });
  assert.equal(infiniteAnglePanel.panelActive, true, "Infinity > IA should activate the IA panel");
  assert.ok(infiniteAnglePanel.canvasWidth > 0 && infiniteAnglePanel.canvasHeight > 0, "IA canvas should have a rendered size");
  assert.notEqual(infiniteAnglePanel.canvasPixel, 0, "IA canvas should render nonblank pixels");
  assert.notEqual(infiniteAnglePanel.scoreText, "", "IA panel should display Infinity Score");
  assert.equal(infiniteAnglePanel.unlockHidden, true, "IA unlock control should hide after unlocking");
  assert.equal(infiniteAnglePanel.unlockNoteDisplay, "none", "IA unlock note should hide after unlocking");
  assert.ok(infiniteAnglePanel.upgradeWidths.every((width) => width > 0), "IA upgrade controls should remain visible");
  assert.equal(infiniteAnglePanel.bought, true, "IA speed upgrade should be purchasable with IP");
  assert.equal(infiniteAnglePanel.speedLevel, infiniteAnglePanel.expectedSpeedLevel, "IA speed upgrade should increase its own level");
  assert.equal(infiniteAnglePanel.ipExact, "100", "IA speed upgrade should spend 1e20 IP");
  assert.match(infiniteAnglePanel.upgradeCosts[0], /1\.00e20/, "IA speed cost should match the unlock scale");
  assert.match(infiniteAnglePanel.upgradeCosts[1], /2\.40e20/, "IA vertex cost should preserve the TA price ratio");
  assert.match(infiniteAnglePanel.upgradeCosts[2], /3\.60e20/, "IA gain cost should preserve the TA price ratio");

  const infiniteAngleDrawMode = await page.evaluate(() => {
    const { switchMainTab, switchInfinitySubtab } = window.__angleDebug;
    const context = document.querySelector("#infiniteAngleCanvas")?.getContext("2d");
    let fillCalls = 0;
    const originalFillRect = context?.fillRect;
    if (context && originalFillRect) {
      context.fillRect = (...args) => {
        fillCalls += 1;
        return originalFillRect.apply(context, args);
      };
    }
    switchMainTab("angle");
    switchInfinitySubtab("upgrades");
    window.advanceTime(1000);
    const hiddenFillCalls = fillCalls;
    switchMainTab("infinity");
    switchInfinitySubtab("angle");
    window.advanceTime(0);
    return { hiddenFillCalls, visibleFillCalls: fillCalls - hiddenFillCalls };
  });
  assert.equal(infiniteAngleDrawMode.hiddenFillCalls, 0, "hidden IA should not draw its canvas");
  assert.ok(infiniteAngleDrawMode.visibleFillCalls > 0, "visible IA should draw its canvas");

  const requestedModulePaths = new Set(moduleRequests.map((url) => url.pathname));
  EXPECTED_MODULE_PATHS.forEach((modulePath) => {
    assert.ok(requestedModulePaths.has(modulePath), `expected ${modulePath} to be requested`);
  });
  assert.ok(
    moduleRequests.every((url) => url.searchParams.get("v") === EXPECTED_ASSET_VERSION),
    "every game ESM module must use the current versioned URL",
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
  const saveCodeArea = page.locator("#saveCodeArea");
  await saveCodeArea.focus();
  report.focusBeforeInput = await page.evaluate(() => ({
    activeId: document.activeElement?.id ?? null,
    activeTagName: document.activeElement?.tagName ?? null,
    settingsActive: document.querySelector('.main-panel[data-panel="settings"]')?.classList.contains("is-active") ?? false,
  }));
  assert.equal(report.focusBeforeInput.activeId, "saveCodeArea", "save-code area must hold focus before typing");
  assert.equal(report.focusBeforeInput.settingsActive, true, "settings panel must be active before save-code typing");
  await saveCodeArea.press("f");
  report.fullscreenRequestsAfterInput = await page.evaluate(() => window.__angleFullscreenRequests);
  assert.equal(
    report.fullscreenRequestsAfterInput,
    0,
    "typing f in the save-code area must not toggle fullscreen",
  );

  const angleTab = page.locator('[data-tab="angle"]');
  await angleTab.click();
  await angleTab.focus();
  report.focusBeforeButton = await page.evaluate(() => ({
    activeTab: document.activeElement?.dataset?.tab ?? null,
    angleActive: document.querySelector('.main-panel[data-panel="angle"]')?.classList.contains("is-active") ?? false,
  }));
  assert.equal(report.focusBeforeButton.activeTab, "angle", "angle tab must hold focus before shortcut testing");
  assert.equal(report.focusBeforeButton.angleActive, true, "angle panel must be active before normal shortcut testing");
  await page.keyboard.press("f");
  report.fullscreenRequestsAfterButton = await page.evaluate(() => window.__angleFullscreenRequests);
  assert.equal(
    report.fullscreenRequestsAfterButton,
    1,
    "plain f outside an editable element must still toggle fullscreen",
  );

  assert.deepEqual(errors, []);
  report.result = "passed";
  console.log("browser ESM smoke test passed");
} catch (error) {
  report.result = "failed";
  report.failure = error instanceof Error ? error.stack || error.message : String(error);
  throw error;
} finally {
  report.moduleRequests = moduleRequests.map((url) => url.toString());
  try {
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    console.error("failed to write browser smoke report", error);
  }
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
