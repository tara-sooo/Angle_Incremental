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
const EXPECTED_ASSET_VERSION = "0.8.3";
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
  "/src/ui/render-time-flux.js",
  "/src/ui/render-ui.js",
  "/src/systems/angle.js",
  "/src/systems/generation.js",
  "/src/systems/core-boost.js",
  "/src/systems/infinity.js",
  "/src/systems/infinite-angle.js",
  "/src/systems/time-flux.js",
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
    && Boolean(window.__angleDebug?.ready)
  ));
  await page.evaluate(() => window.__angleDebug.ready);

  const updateModal = await page.evaluate(() => {
    const modal = document.querySelector("#updateModal");
    return {
      visible: Boolean(modal && !modal.hidden),
      title: document.querySelector("#updateModalTitle")?.textContent?.trim() ?? "",
      summary: modal?.querySelector("[data-i18n=updateSummary]")?.textContent?.trim() ?? "",
    };
  });
  assert.equal(updateModal.visible, true, "the 0.8.3 update modal should appear for a fresh browser profile");
  assert.equal(updateModal.title, "0.8.3 アップデート", "the update modal should show the current Japanese version");
  assert.match(updateModal.summary, /サーバー時刻/);
  const manifestVersion = await page.evaluate(async () => (await fetch("version.json", { cache: "no-store" })).json());
  assert.equal(manifestVersion.appVersion, EXPECTED_ASSET_VERSION, "version.json should match the asset version");
  const serverClockProbe = await page.evaluate(async () => {
    const response = await fetch(`version.json?clock-smoke=${Date.now()}`, { cache: "no-store" });
    return {
      date: response.headers.get("date"),
      available: window.__angleDebug.serverClockAvailable(),
      source: window.__angleDebug.serverClockSource(),
    };
  });
  assert.ok(Date.parse(serverClockProbe.date) > 0, "the static host should expose a parseable HTTP Date header");
  assert.equal(serverClockProbe.available, true, "the browser should accept the static host server clock");
  assert.equal(serverClockProbe.source, "server", "the active clock source should be the server");
  await page.locator("#updateModalClose").click();
  await page.waitForFunction(() => document.querySelector("#updateModal")?.hidden === true);

  const existingSaveFixtures = [
    {
      name: "0.7.0-style-v10",
      state: {
        generationCount: 4,
        previousGenerationScore: 1e12,
        previousGenerationScoreLog10: 12,
        infiniteAngleUnlocked: true,
        infiniteAngleSpeedLevel: 2,
        infiniteAngleVertexLevel: 3,
        infiniteAngleGainLevel: 1,
        towerFloor: 2,
        infinityPointsExact: "100000000000000000000",
        infinityPoints: 1e20,
        infinityPointsLog10: 20,
      },
      expected: {
        generationCount: 4,
        infiniteAngleUnlocked: true,
        towerFloor: 2,
        timeFlux: 0,
        offlineProgressEnabled: true,
        showTimeFluxQuickBar: true,
      },
    },
    {
      name: "0.8.0-v10",
      state: {
        generationCount: 5,
        previousGenerationScore: 1e15,
        previousGenerationScoreLog10: 15,
        infiniteAngleUnlocked: true,
        infiniteAngleSpeedLevel: 4,
        infiniteAngleVertexLevel: 5,
        infiniteAngleGainLevel: 2,
        towerFloor: 3,
        offlineProgressEnabled: true,
        offlineTickCount: 5000,
        timeFlux: 123,
        timeFluxCapacityLevel: 2,
        timeFluxGainLevel: 1,
        timeFluxSpeed: 1,
        showTimeFluxQuickBar: true,
      },
      expected: {
        generationCount: 5,
        infiniteAngleUnlocked: true,
        towerFloor: 3,
        timeFlux: 123,
        offlineProgressEnabled: true,
        showTimeFluxQuickBar: true,
      },
    },
  ];
  for (const fixture of existingSaveFixtures) {
    const existingContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const existingErrors = [];
    await existingContext.addInitScript((saveData) => {
      localStorage.setItem("angle-incremental-save", JSON.stringify(saveData));
      localStorage.setItem("angle-incremental-seen-version", "0.8.1");
    }, {
      version: 10,
      savedAt: Date.now(),
      state: fixture.state,
    });
    const existingPage = await existingContext.newPage();
    existingPage.on("pageerror", (error) => existingErrors.push(error.message));
    existingPage.on("console", (message) => {
      if (message.type() === "error") existingErrors.push(message.text());
    });
    try {
      await existingPage.goto(`${localOrigin}/index.html`, { waitUntil: "networkidle" });
      await existingPage.waitForFunction(() => (
        typeof window.render_game_to_text === "function"
        && Boolean(window.__angleDebug?.state)
      ));
      const loaded = await existingPage.evaluate(() => {
        const { state } = window.__angleDebug;
        return {
          generationCount: state.generationCount,
          infiniteAngleUnlocked: state.infiniteAngleUnlocked,
          towerFloor: state.towerFloor,
          timeFlux: state.timeFlux,
          offlineProgressEnabled: state.offlineProgressEnabled,
          showTimeFluxQuickBar: state.showTimeFluxQuickBar,
        };
      });
      assert.deepEqual(loaded, fixture.expected, `${fixture.name} should load without losing progress or TF settings`);
      assert.deepEqual(existingErrors, [], `${fixture.name} should load without browser errors`);
    } finally {
      await existingContext.close();
    }
  }

  const serverClockContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const serverClockErrors = [];
  const serverClockSavedAt = Date.now();
  await serverClockContext.addInitScript(({ saveData, localOffsetMs, seenVersion }) => {
    const realNow = Date.now.bind(Date);
    Date.now = () => realNow() + localOffsetMs;
    localStorage.setItem("angle-incremental-save", JSON.stringify(saveData));
    localStorage.setItem("angle-incremental-seen-version", seenVersion);
  }, {
    localOffsetMs: 2 * 86400 * 1000,
    seenVersion: EXPECTED_ASSET_VERSION,
    saveData: {
      version: 10,
      savedAt: serverClockSavedAt,
      serverSavedAt: serverClockSavedAt - 3600 * 1000,
      state: { offlineProgressEnabled: false, timeFlux: 0 },
    },
  });
  const serverClockPage = await serverClockContext.newPage();
  serverClockPage.on("pageerror", (error) => serverClockErrors.push(error.message));
  serverClockPage.on("console", (message) => {
    if (message.type() === "error") serverClockErrors.push(message.text());
  });
  try {
    await serverClockPage.goto(`${localOrigin}/index.html`, { waitUntil: "networkidle" });
    await serverClockPage.waitForFunction(() => Boolean(window.__angleDebug?.ready));
    await serverClockPage.evaluate(() => window.__angleDebug.ready);
    const serverClockLoaded = await serverClockPage.evaluate(() => {
      const snapshot = JSON.parse(window.render_game_to_text());
      return {
        timeFlux: window.__angleDebug.state.timeFlux,
        report: snapshot.timeFlux.report,
        persisted: JSON.parse(localStorage.getItem("angle-incremental-save")),
      };
    });
    assert.ok(
      Math.abs(serverClockLoaded.timeFlux - 360) < 2,
      "server-based offline TF should ignore a two-day local clock offset",
    );
    assert.equal(serverClockLoaded.report.clockSource, "server", "server-based offline reports should identify their clock source");
    assert.equal(serverClockLoaded.report.clockAnomaly, false, "a valid server timestamp should not be flagged as anomalous");
    assert.ok(serverClockLoaded.persisted.serverSavedAt > 0, "loading a legacy interval should persist a server timestamp");
    assert.deepEqual(serverClockErrors, [], "server-clock loading should produce no browser errors");
  } finally {
    await serverClockContext.close();
  }

  const snapshot = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  assert.equal(snapshot.vertices, 3);
  assert.equal(snapshot.infinity.count, 0);
  assert.equal(typeof snapshot.score, "string");

  const generationPreview = await page.evaluate(() => {
    const { state } = window.__angleDebug;
    const original = {
      generationCount: state.generationCount,
      previousGenerationScore: state.previousGenerationScore,
      previousGenerationScoreLog10: state.previousGenerationScoreLog10,
      numberFormat: state.numberFormat,
    };
    state.generationCount = 0;
    state.previousGenerationScore = 0;
    state.previousGenerationScoreLog10 = -Infinity;
    window.advanceTime(0);
    const notRun = document.querySelector("#previousGenerationScore")?.textContent?.trim() ?? "";
    state.generationCount = 1;
    state.previousGenerationScore = 1e9;
    state.previousGenerationScoreLog10 = 9;
    state.numberFormat = "scientific";
    window.advanceTime(0);
    const scientific = document.querySelector("#previousGenerationScore")?.textContent?.trim() ?? "";
    state.numberFormat = "compact";
    window.advanceTime(0);
    const compact = document.querySelector("#previousGenerationScore")?.textContent?.trim() ?? "";
    Object.assign(state, original);
    window.advanceTime(0);
    return {
      headerStatusExists: Boolean(document.querySelector("#generationStatus")),
      notRun,
      scientific,
      compact,
    };
  });
  assert.equal(generationPreview.headerStatusExists, false, "the redundant Angle header Generation status should be removed");
  assert.equal(generationPreview.notRun, "未実行", "the previous GR score should identify an unrun Generation");
  assert.equal(generationPreview.scientific, "1.00e9", "the previous GR score should respect scientific formatting");
  assert.equal(generationPreview.compact, "1.00B", "the previous GR score should respect compact formatting");

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
    ["angle", "infinity", "challenges", "timeFlux", "automation", "statistics", "achievements", "help", "settings"],
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
  const timeFluxInitial = await page.evaluate(() => {
    const {
      state,
      switchMainTab,
      setTimeFluxSpeed,
      applySetting,
      advanceOnlineTime,
      processOfflineElapsed,
    } = window.__angleDebug;
    state.totalPlayTime = 0;
    state.totalRealPlayTime = 0;
    state.currentInfinityRunTime = 0;
    state.currentInfinityRealTime = 0;
    state.timeFlux = 10;
    state.timeFluxSpeed = 1;
    state.timeFluxCustomSpeed = 4;
    state.timeFluxGainLevel = 0;
    state.timeFluxCapacityLevel = 0;
    applySetting("showTimeFluxQuickBar", true);
    applySetting("offlineProgressEnabled", true);
    switchMainTab("angle");
    window.advanceTime(0);
    const quickBarInitial = {
      visible: document.querySelector("#timeFluxQuickBar")?.hidden === false,
      amount: document.querySelector("#timeFluxQuickAmount")?.textContent?.trim() ?? "",
      speed: document.querySelector("#timeFluxQuickSpeed")?.textContent?.trim() ?? "",
      customSpeed: document.querySelector("#timeFluxQuickCustomSpeed")?.textContent?.trim() ?? "",
      customButtonType: document.querySelector("#timeFluxQuickCustomSpeedButton")?.tagName ?? "",
      customButtonPressed: document.querySelector("#timeFluxQuickCustomSpeedButton")?.getAttribute("aria-pressed") ?? "",
      customInputPresent: Boolean(document.querySelector("#timeFluxQuickCustomSpeedInput")),
    };
    document.querySelector('#timeFluxQuickBar .time-flux-speed[data-speed="2"]')?.click();
    const quickBarChanged = {
      stateSpeed: state.timeFluxSpeed,
      speed: document.querySelector("#timeFluxQuickSpeed")?.textContent?.trim() ?? "",
    };
    switchMainTab("timeFlux");
    window.advanceTime(0);
    const tabMirrored = document.querySelector("#timeFluxSpeed")?.textContent?.trim() ?? "";
    const customInput = document.querySelector("#timeFluxCustomSpeedInput");
    if (customInput) {
      customInput.value = "10";
      customInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const customDraft = {
      stateSpeed: state.timeFluxSpeed,
      stateCustomSpeed: state.timeFluxCustomSpeed,
      input: customInput?.value ?? "",
      quickBar: document.querySelector("#timeFluxQuickCustomSpeed")?.textContent?.trim() ?? "",
      applyValue: document.querySelector("#timeFluxCustomSpeedApplyValue")?.textContent?.trim() ?? "",
    };
    document.querySelector("#timeFluxCustomSpeedApply")?.click();
    const customConfigured = {
      stateSpeed: state.timeFluxSpeed,
      stateCustomSpeed: state.timeFluxCustomSpeed,
      input: customInput?.value ?? "",
      quickBar: document.querySelector("#timeFluxQuickCustomSpeed")?.textContent?.trim() ?? "",
      applyPressed: document.querySelector("#timeFluxCustomSpeedApply")?.getAttribute("aria-pressed") ?? "",
    };
    document.querySelector('#timeFluxPanel .time-flux-speed[data-speed="3"]')?.click();
    const quickBarMirrored = {
      speed: document.querySelector("#timeFluxQuickSpeed")?.textContent?.trim() ?? "",
      customSpeed: document.querySelector("#timeFluxQuickCustomSpeed")?.textContent?.trim() ?? "",
    };
    document.querySelector("#timeFluxQuickCustomSpeedButton")?.click();
    const quickBarCustomActivated = {
      stateSpeed: state.timeFluxSpeed,
      speed: document.querySelector("#timeFluxQuickSpeed")?.textContent?.trim() ?? "",
      tabSpeed: document.querySelector("#timeFluxSpeed")?.textContent?.trim() ?? "",
      customButtonPressed: document.querySelector("#timeFluxQuickCustomSpeedButton")?.getAttribute("aria-pressed") ?? "",
    };
    applySetting("showTimeFluxQuickBar", false);
    const hiddenQuickBar = document.querySelector("#timeFluxQuickBar")?.hidden === true;
    applySetting("showTimeFluxQuickBar", true);
    applySetting("topBarMode", "hidden");
    const quickBarWithHiddenTopBar = document.querySelector("#timeFluxQuickBar")?.hidden === false;
    applySetting("topBarMode", "news");
    setTimeFluxSpeed(1);
    state.timeFlux = 10;
    switchMainTab("timeFlux");
    window.advanceTime(0);
    const initial = {
      panelActive: Boolean(document.querySelector('[data-panel="timeFlux"]')?.classList.contains("is-active")),
      amount: document.querySelector("#timeFluxAmount")?.textContent?.trim() ?? "",
      gain: document.querySelector("#timeFluxGain")?.textContent?.trim() ?? "",
      speed: document.querySelector("#timeFluxSpeed")?.textContent?.trim() ?? "",
      customSpeed: document.querySelector("#timeFluxCustomSpeedInput")?.value ?? "",
    };
    state.totalPlayTime = 0;
    state.totalRealPlayTime = 0;
    state.currentInfinityRunTime = 0;
    state.currentInfinityRealTime = 0;
    setTimeFluxSpeed(2);
    advanceOnlineTime(1);
    const accelerated = {
      totalPlayTime: state.totalPlayTime,
      totalRealPlayTime: state.totalRealPlayTime,
      currentInfinityRunTime: state.currentInfinityRunTime,
      currentInfinityRealTime: state.currentInfinityRealTime,
      timeFlux: state.timeFlux,
      speed: document.querySelector("#timeFluxSpeed")?.textContent?.trim() ?? "",
    };
    state.timeFlux = 0;
    applySetting("offlineProgressEnabled", false);
    const report = processOfflineElapsed(3600, "test");
    const offline = {
      mode: document.querySelector("#offlineReportMode")?.textContent?.trim() ?? "",
      visible: document.querySelector("#offlineReportPanel")?.hidden === false,
      gained: report?.timeFluxGained ?? 0,
      totalPlayTime: state.totalPlayTime,
      totalRealPlayTime: state.totalRealPlayTime,
    };
    document.querySelector("#offlineReportClose")?.click();
    applySetting("offlineProgressEnabled", true);
    state.timeFlux = 0;
    setTimeFluxSpeed(1);
    switchMainTab("angle");
    window.advanceTime(0);
    return {
      initial,
      accelerated,
      offline,
      quickBarInitial,
      quickBarChanged,
      tabMirrored,
      customDraft,
      customConfigured,
      quickBarMirrored,
      quickBarCustomActivated,
      hiddenQuickBar,
      quickBarWithHiddenTopBar,
    };
  });
  assert.equal(timeFluxInitial.quickBarInitial.visible, true, "the Time Flux quick bar should be visible on other tabs");
  assert.match(timeFluxInitial.quickBarInitial.amount, /10秒 \/ 30分/);
  assert.equal(timeFluxInitial.quickBarInitial.speed, "×1");
  assert.equal(timeFluxInitial.quickBarInitial.customSpeed, "×4");
  assert.equal(timeFluxInitial.quickBarInitial.customButtonType, "BUTTON", "the quick bar custom speed should be a button");
  assert.equal(timeFluxInitial.quickBarInitial.customButtonPressed, "false");
  assert.equal(timeFluxInitial.quickBarInitial.customInputPresent, false, "the quick bar should not contain the custom-speed input");
  assert.equal(timeFluxInitial.quickBarChanged.stateSpeed, 2, "the quick bar should change the shared Time Flux speed");
  assert.equal(timeFluxInitial.quickBarChanged.speed, "×2");
  assert.equal(timeFluxInitial.tabMirrored, "×2", "the Time Flux tab should mirror quick bar speed changes");
  assert.equal(timeFluxInitial.customDraft.stateSpeed, 2, "typing a custom speed should not change the active speed before applying");
  assert.equal(timeFluxInitial.customDraft.stateCustomSpeed, 4, "typing a custom speed should not overwrite the saved custom speed before applying");
  assert.equal(timeFluxInitial.customDraft.input, "10");
  assert.equal(timeFluxInitial.customDraft.quickBar, "×4", "the quick bar should keep showing the saved custom speed while editing a draft");
  assert.equal(timeFluxInitial.customDraft.applyValue, "×10", "the Time Flux tab button should preview the draft value");
  assert.equal(timeFluxInitial.customConfigured.stateSpeed, 10, "the TF tab input should select the custom speed");
  assert.equal(timeFluxInitial.customConfigured.stateCustomSpeed, 10, "the TF tab input should update the remembered custom speed");
  assert.equal(timeFluxInitial.customConfigured.input, "10");
  assert.equal(timeFluxInitial.customConfigured.quickBar, "×10", "the quick bar should display the configured custom speed");
  assert.equal(timeFluxInitial.customConfigured.applyPressed, "true");
  assert.equal(timeFluxInitial.quickBarMirrored.speed, "×3", "the quick bar should mirror Time Flux tab speed changes");
  assert.equal(timeFluxInitial.quickBarMirrored.customSpeed, "×10", "preset changes should not erase the displayed custom speed");
  assert.equal(timeFluxInitial.quickBarCustomActivated.stateSpeed, 10, "the quick bar custom button should apply the saved custom speed");
  assert.equal(timeFluxInitial.quickBarCustomActivated.speed, "×10");
  assert.equal(timeFluxInitial.quickBarCustomActivated.tabSpeed, "×10", "the Time Flux tab should mirror quick-bar custom speed changes");
  assert.equal(timeFluxInitial.quickBarCustomActivated.customButtonPressed, "true");
  assert.equal(timeFluxInitial.hiddenQuickBar, true, "the quick bar visibility setting should hide only the quick bar");
  assert.equal(timeFluxInitial.quickBarWithHiddenTopBar, true, "the quick bar should be independent from top bar visibility");
  assert.equal(timeFluxInitial.initial.panelActive, true, "Time Flux should activate as an independent main tab");
  assert.match(timeFluxInitial.initial.amount, /10秒 \/ 30分/);
  assert.match(timeFluxInitial.initial.gain, /6分0秒\/時/);
  assert.equal(timeFluxInitial.initial.speed, "×1");
  assert.equal(timeFluxInitial.initial.customSpeed, "10");
  assert.ok(
    Math.abs(timeFluxInitial.accelerated.totalPlayTime - 2) < 1e-9,
    `x2 should advance two game seconds per real second (actual ${timeFluxInitial.accelerated.totalPlayTime})`,
  );
  assert.ok(Math.abs(timeFluxInitial.accelerated.totalRealPlayTime - 1) < 1e-9, "x2 should count one real second");
  assert.ok(Math.abs(timeFluxInitial.accelerated.currentInfinityRunTime - 2) < 1e-9, "x2 should advance game Infinity time");
  assert.ok(Math.abs(timeFluxInitial.accelerated.currentInfinityRealTime - 1) < 1e-9, "x2 should advance real Infinity time by one second");
  assert.ok(Math.abs(timeFluxInitial.accelerated.timeFlux - 9) < 1e-9, "x2 should consume one TF per real second");
  assert.equal(timeFluxInitial.accelerated.speed, "×2");
  assert.equal(timeFluxInitial.offline.mode, "TF蓄積");
  assert.equal(timeFluxInitial.offline.visible, true, "offline result should be shown after returning to the game");
  assert.equal(timeFluxInitial.offline.gained, 360, "one hour offline should grant the base TF rate");
  assert.ok(Math.abs(timeFluxInitial.offline.totalPlayTime - 2) < 1e-9, "TF accumulation should not advance game time");
  assert.ok(Math.abs(timeFluxInitial.offline.totalRealPlayTime - 1) < 1e-9, "offline TF accumulation should not add real play time");
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
  const quickBarSetting = await page.evaluate(() => {
    const toggle = document.querySelector("#timeFluxQuickBarToggle");
    const before = toggle?.checked === true;
    toggle?.click();
    const hidden = document.querySelector("#timeFluxQuickBar")?.hidden === true;
    toggle?.click();
    return {
      before,
      hidden,
      restored: document.querySelector("#timeFluxQuickBar")?.hidden === false,
    };
  });
  assert.equal(quickBarSetting.before, true, "the TF quick bar setting should default to enabled");
  assert.equal(quickBarSetting.hidden, true, "the TF quick bar setting should hide the quick bar");
  assert.equal(quickBarSetting.restored, true, "the TF quick bar setting should restore the quick bar");
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
    const quickBar = document.querySelector("#timeFluxQuickBar");
    const panels = document.querySelector(".main-panels");
    return {
      hidden: Boolean(ticker?.hidden),
      quickBarVisible: quickBar?.hidden === false,
      quickBarBottom: quickBar?.getBoundingClientRect().bottom ?? 0,
      panelTop: panels?.getBoundingClientRect().top ?? 0,
    };
  });
  assert.equal(hiddenTopBar.hidden, true, "hidden top bar should hide the bar");
  assert.equal(hiddenTopBar.quickBarVisible, true, "hidden top bar should not hide the independent Time Flux quick bar");
  assert.ok(hiddenTopBar.panelTop >= hiddenTopBar.quickBarBottom - 1, "main panels should remain below the visible Time Flux quick bar");
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
    window.__angleDebug.applySetting("showTimeFluxQuickBar", true);
    window.__angleDebug.applySetting("showFps", true);
    const ticker = document.querySelector("#newsTicker")?.getBoundingClientRect();
    const track = document.querySelector(".news-track")?.getBoundingClientRect();
    const fps = document.querySelector("#fpsCounter")?.getBoundingClientRect();
    window.__angleDebug.applySetting("topBarMode", "hidden");
    const hiddenQuickBarBottom = document.querySelector("#timeFluxQuickBar")?.getBoundingClientRect().bottom ?? 0;
    const hiddenTop = document.querySelector("#fpsCounter")?.getBoundingClientRect().top ?? 999;
    return {
      insideTopBar: Boolean(ticker && fps && fps.top >= ticker.top && fps.bottom <= ticker.bottom),
      clearOfNewsText: Boolean(track && fps && track.right <= fps.left),
      hiddenQuickBarBottom,
      hiddenTop,
    };
  });
  assert.equal(fpsPlacement.insideTopBar, true, "FPS counter should fit inside the visible top bar");
  assert.equal(fpsPlacement.clearOfNewsText, true, "FPS counter should not overlap the news text track");
  assert.ok(fpsPlacement.hiddenTop >= fpsPlacement.hiddenQuickBarBottom - 1, "FPS counter should stay below the visible Time Flux quick bar");
  const achievementToastPlacement = await page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect();
    window.__angleDebug.applySetting("topBarMode", "news");
    window.__angleDebug.applySetting("showTimeFluxQuickBar", true);
    const normalQuickBar = rect("#timeFluxQuickBar");
    const normalToasts = rect("#achievementToasts");
    window.__angleDebug.applySetting("topBarMode", "hidden");
    const hiddenQuickBar = rect("#timeFluxQuickBar");
    const hiddenToasts = rect("#achievementToasts");
    const hiddenFps = rect("#fpsCounter");
    const originalRootFontSize = document.documentElement.style.fontSize;
    document.documentElement.style.fontSize = "32px";
    window.__angleDebug.applySetting("topBarMode", "hidden");
    const largeQuickBar = rect("#timeFluxQuickBar");
    const largeToasts = rect("#achievementToasts");
    const largeFps = rect("#fpsCounter");
    document.documentElement.style.fontSize = originalRootFontSize;
    window.__angleDebug.applySetting("topBarMode", "news");
    return {
      normalQuickBarBottom: normalQuickBar?.bottom ?? 0,
      normalToastTop: normalToasts?.top ?? 0,
      hiddenQuickBarBottom: hiddenQuickBar?.bottom ?? 0,
      hiddenToastTop: hiddenToasts?.top ?? 0,
      hiddenFpsBottom: hiddenFps?.bottom ?? 0,
      largeQuickBarBottom: largeQuickBar?.bottom ?? 0,
      largeToastTop: largeToasts?.top ?? 0,
      largeFpsBottom: largeFps?.bottom ?? 0,
    };
  });
  assert.ok(achievementToastPlacement.normalToastTop >= achievementToastPlacement.normalQuickBarBottom - 1, "achievement toasts should stay below the visible Time Flux quick bar");
  assert.ok(achievementToastPlacement.hiddenToastTop >= achievementToastPlacement.hiddenQuickBarBottom - 1, "hidden top bar achievement toasts should stay below the visible Time Flux quick bar");
  assert.ok(achievementToastPlacement.hiddenToastTop >= achievementToastPlacement.hiddenFpsBottom - 1, "hidden top bar achievement toasts should stay below the FPS counter");
  assert.ok(achievementToastPlacement.largeToastTop >= achievementToastPlacement.largeQuickBarBottom - 1, "large text achievement toasts should stay below the visible Time Flux quick bar");
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
    const ipExactAfterSingle = state.infinityPointsExact;
    const speedLevelAfterSingle = state.infiniteAngleSpeedLevel;
    state.infinityPointsExact = "100000000000000000000000";
    state.infinityPoints = 1e23;
    state.infinityPointsLog10 = 23;
    window.advanceTime(0);
    const buyAllDisabledBefore = Boolean(document.querySelector("#infiniteAngleBuyAllUpgrade")?.disabled);
    const levelsBeforeBuyAll = state.infiniteAngleSpeedLevel + state.infiniteAngleVertexLevel + state.infiniteAngleGainLevel;
    document.querySelector("#infiniteAngleBuyAllUpgrade")?.click();
    const levelsAfterBuyAll = state.infiniteAngleSpeedLevel + state.infiniteAngleVertexLevel + state.infiniteAngleGainLevel;
    return {
      panelActive: Boolean(panel?.classList.contains("is-active")),
      canvasWidth: canvas?.getBoundingClientRect().width ?? 0,
      canvasHeight: canvas?.getBoundingClientRect().height ?? 0,
      canvasPixel: canvas?.getContext("2d")?.getImageData(1, 1, 1, 1).data?.[0] ?? 0,
      scoreText: document.querySelector("#infiniteScorePanel")?.textContent?.trim() ?? "",
      unlockHidden: Boolean(document.querySelector("#infiniteAngleUnlockButton")?.hidden),
      unlockNoteDisplay: getComputedStyle(document.querySelector("#infiniteAngleUnlockNote")).display,
      bought,
      speedLevel: speedLevelAfterSingle,
      expectedSpeedLevel: beforeLevel + 1,
      ipExact: ipExactAfterSingle,
      buyAllDisabledBefore,
      buyAllPurchases: levelsAfterBuyAll - levelsBeforeBuyAll,
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
  assert.equal(infiniteAnglePanel.buyAllDisabledBefore, false, "IA Buy All should enable when any IA upgrade is affordable");
  assert.ok(infiniteAnglePanel.buyAllPurchases > 0, "IA Buy All should purchase multiple affordable upgrades through the UI");
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

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  const mobileErrors = [];
  const mobilePage = await mobileContext.newPage();
  mobilePage.on("pageerror", (error) => mobileErrors.push(error.message));
  mobilePage.on("console", (message) => {
    if (message.type() === "error") mobileErrors.push(message.text());
  });
  try {
    await mobilePage.goto(`${localOrigin}/index.html`, { waitUntil: "networkidle" });
    await mobilePage.waitForFunction(() => (
      typeof window.render_game_to_text === "function"
      && Boolean(window.__angleDebug?.state)
      && Boolean(window.__angleDebug?.ready)
    ));
    await mobilePage.evaluate(() => window.__angleDebug.ready);
    const mobileStartup = await mobilePage.evaluate(() => ({
      updateTitle: document.querySelector("#updateModalTitle")?.textContent?.trim() ?? "",
      tabCount: document.querySelectorAll(".main-tab").length,
      quickBarVisible: document.querySelector("#timeFluxQuickBar")?.hidden === false,
      canvasWidth: document.querySelector("#gameCanvas")?.getBoundingClientRect().width ?? 0,
    }));
    assert.equal(mobileStartup.updateTitle, "0.8.3 アップデート", "mobile startup should use the release version");
    assert.equal(mobileStartup.tabCount, 9, "mobile startup should expose every main tab");
    assert.equal(mobileStartup.quickBarVisible, true, "the Time Flux quick bar should be visible on mobile");
    assert.ok(mobileStartup.canvasWidth > 0, "the mobile Angle canvas should have a rendered width");
    await mobilePage.locator("#updateModalClose").click();

    await mobilePage.locator('[data-tab="timeFlux"]').click();
    const mobileTimeFlux = await mobilePage.evaluate(() => {
      const input = document.querySelector("#timeFluxCustomSpeedInput");
      if (input) {
        input.value = "12";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      window.advanceTime(0);
      const draft = {
        stateSpeed: window.__angleDebug.state.timeFluxSpeed,
        stateCustomSpeed: window.__angleDebug.state.timeFluxCustomSpeed,
        quickSpeed: document.querySelector("#timeFluxQuickCustomSpeed")?.textContent?.trim() ?? "",
      };
      document.querySelector("#timeFluxCustomSpeedApply")?.click();
      return {
        panelActive: document.querySelector('[data-panel="timeFlux"]')?.classList.contains("is-active") ?? false,
        customInputWidth: input?.getBoundingClientRect().width ?? 0,
        customSpeed: input?.value ?? "",
        quickSpeed: document.querySelector("#timeFluxQuickCustomSpeed")?.textContent?.trim() ?? "",
        customButtonType: document.querySelector("#timeFluxCustomSpeedApply")?.tagName ?? "",
        stateSpeed: window.__angleDebug.state.timeFluxSpeed,
        stateCustomSpeed: window.__angleDebug.state.timeFluxCustomSpeed,
        draft,
        quickInputPresent: Boolean(document.querySelector("#timeFluxQuickCustomSpeedInput")),
      };
    });
    assert.equal(mobileTimeFlux.panelActive, true, "the Time Flux tab should activate on mobile");
    assert.equal(mobileTimeFlux.draft.stateSpeed, 1, "mobile custom speed input should not change the active speed before applying");
    assert.equal(mobileTimeFlux.draft.stateCustomSpeed, 4, "mobile custom speed input should not change the saved speed before applying");
    assert.equal(mobileTimeFlux.draft.quickSpeed, "×4", "mobile quick bar should keep the saved speed while editing");
    assert.equal(mobileTimeFlux.customSpeed, "12", "the mobile Time Flux tab should accept custom speed input");
    assert.equal(mobileTimeFlux.quickSpeed, "×12", "the mobile quick bar should mirror custom speed");
    assert.equal(mobileTimeFlux.customButtonType, "BUTTON", "the mobile Time Flux custom speed control should be a button");
    assert.equal(mobileTimeFlux.stateSpeed, 12, "the mobile custom speed button should apply the active speed");
    assert.equal(mobileTimeFlux.stateCustomSpeed, 12, "the mobile custom speed button should save the custom speed");
    assert.equal(mobileTimeFlux.quickInputPresent, false, "the mobile quick bar should remain read-only");
    assert.ok(mobileTimeFlux.customInputWidth > 0, "the mobile custom speed input should remain visible");

    await mobilePage.locator('[data-tab="statistics"]').click();
    const mobileStatistics = await mobilePage.evaluate(() => ({
      panelActive: document.querySelector('[data-panel="statistics"]')?.classList.contains("is-active") ?? false,
      totalRealPlayTimeWidth: document.querySelector("#totalRealPlayTime")?.getBoundingClientRect().width ?? 0,
      currentInfinityRealTimeWidth: document.querySelector("#currentInfinityRealTime")?.getBoundingClientRect().width ?? 0,
    }));
    assert.equal(mobileStatistics.panelActive, true, "the Statistics tab should activate on mobile");
    assert.ok(mobileStatistics.totalRealPlayTimeWidth > 0, "mobile statistics should show total real play time");
    assert.ok(mobileStatistics.currentInfinityRealTimeWidth > 0, "mobile statistics should show current real Infinity time");

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
      const quickBar = rect("#timeFluxQuickBar");
      const toasts = rect("#achievementToasts");
      const fps = rect("#fpsCounter");
      return {
        panelActive: document.querySelector('[data-infinity-panel="angle"]')?.classList.contains("is-active") ?? false,
        canvasWidth: document.querySelector("#infiniteAngleCanvas")?.getBoundingClientRect().width ?? 0,
        quickBarBottom: quickBar?.bottom ?? 0,
        toastTop: toasts?.top ?? 0,
        fpsTop: fps?.top ?? 0,
      };
    });
    assert.equal(mobileInfiniteAngle.panelActive, true, "the mobile IA panel should activate");
    assert.ok(mobileInfiniteAngle.canvasWidth > 0, "the mobile IA canvas should have a rendered width");
    assert.ok(mobileInfiniteAngle.toastTop >= mobileInfiniteAngle.quickBarBottom - 1, "mobile achievement toasts should clear the quick bar");
    assert.ok(mobileInfiniteAngle.fpsTop >= mobileInfiniteAngle.quickBarBottom - 1, "mobile FPS should clear the quick bar");
    assert.deepEqual(mobileErrors, [], "mobile critical paths should produce no browser errors");
    report.mobile = {
      viewport: "390x844",
      startup: mobileStartup,
      timeFlux: mobileTimeFlux,
      statistics: mobileStatistics,
      infiniteAngle: mobileInfiniteAngle,
    };
  } finally {
    await mobileContext.close();
  }

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
