import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = path.join(root, "browser-smoke-report.json");
const EXPECTED_ASSET_VERSION = JSON.parse(await readFile(path.join(root, "version.json"), "utf8")).appVersion;
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};
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
  "/src/ui/render-offline-report.js",
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
    && Boolean(window.__angleDebug?.ready)
  ));
  await page.evaluate(() => window.__angleDebug.ready);

  const updateModal = await page.evaluate(() => {
    const modal = document.querySelector("#updateModal");
    return {
      visible: Boolean(modal && !modal.hidden),
      title: document.querySelector("#updateModalTitle")?.textContent?.trim() ?? "",
      summary: modal?.querySelector("[data-i18n=updateSummary]")?.textContent?.trim() ?? "",
      canvas: modal?.querySelector("[data-i18n=updateCanvas]")?.textContent?.trim() ?? "",
    };
  });
  assert.equal(updateModal.visible, true, "the current-version update modal should appear for a fresh browser profile");
  assert.equal(updateModal.title, `${EXPECTED_ASSET_VERSION} アップデート`, "the update modal should show the current Japanese version");
  assert.match(updateModal.summary, /タッチ端末/);
  assert.match(updateModal.summary, /オフライン進行/);
  assert.match(updateModal.canvas, /押下表示/);
  assert.match(updateModal.canvas, /オフライン進行/);
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
  await serverClockContext.addInitScript(({ saveData, checkpoints, localOffsetMs, seenVersion }) => {
    const realNow = Date.now.bind(Date);
    Date.now = () => realNow() + localOffsetMs;
    localStorage.setItem("angle-incremental-save", JSON.stringify(saveData));
    localStorage.setItem("angle-incremental-save-checkpoints", JSON.stringify(checkpoints));
    localStorage.setItem("angle-incremental-seen-version", seenVersion);
  }, {
    localOffsetMs: 2 * 86400 * 1000,
    seenVersion: EXPECTED_ASSET_VERSION,
    saveData: {
      version: 10,
      savedAt: serverClockSavedAt,
      serverSavedAt: serverClockSavedAt - 8 * 86400 * 1000,
      state: { offlineProgressEnabled: true, timeFlux: 0, timeFluxCapacityLevel: 30 },
    },
    checkpoints: [{
      appVersion: EXPECTED_ASSET_VERSION,
      saveVersion: 10,
      savedAt: serverClockSavedAt + 3 * 86400 * 1000,
      serverSavedAt: serverClockSavedAt,
      backedUpAt: serverClockSavedAt + 3 * 86400 * 1000,
      reason: "periodic",
      state: { offlineProgressEnabled: true, timeFlux: 0 },
    }],
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
        totalPlayTime: window.__angleDebug.state.totalPlayTime,
        timeFlux: window.__angleDebug.state.timeFlux,
        report: snapshot.timeFlux.report,
        persisted: JSON.parse(localStorage.getItem("angle-incremental-save")),
      };
    });
    assert.ok(
      serverClockLoaded.totalPlayTime > 7 * 86400,
      "server-based offline progress should process more than seven days despite a local clock offset",
    );
    assert.equal(serverClockLoaded.timeFlux, 0, "server-based offline progress should not grant dormant Time Flux");
    assert.ok(serverClockLoaded.report.elapsedSeconds > 7 * 86400, "the server-clock report should include more than seven days");
    assert.equal(serverClockLoaded.report.capped, false, "trusted server-clock offline rewards should not be capped");
    assert.equal(serverClockLoaded.report.clockSource, "server", "server-based offline reports should identify their clock source");
    assert.equal(serverClockLoaded.report.clockAnomaly, false, "a valid server timestamp should not be flagged as anomalous");
    assert.ok(serverClockLoaded.persisted.serverSavedAt > 0, "loading a legacy interval should persist a server timestamp");
    const serverCheckpointResult = await serverClockPage.evaluate(() => {
      const before = window.__angleDebug.recoveryEntries().checkpoints.filter((entry) => entry.reason === "periodic").length;
      window.__angleDebug.saveGame("auto");
      const after = window.__angleDebug.recoveryEntries().checkpoints.filter((entry) => entry.reason === "periodic").length;
      return { before, after };
    });
    assert.ok(serverCheckpointResult.before >= 1, "server-clock loading should retain a periodic checkpoint");
    assert.equal(
      serverCheckpointResult.after,
      serverCheckpointResult.before,
      "a local clock rollback should not rotate checkpoints when the server clock is valid",
    );
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

  const vertexGainDisplay = await page.evaluate(() => {
    const { state } = window.__angleDebug;
    const original = {
      activeChallenge: state.activeChallenge,
      achievementMask: state.achievementMask,
      coreBoostCount: state.coreBoostCount,
      gainLevel: state.gainLevel,
      ic8VertexUpgradeLevel: state.ic8VertexUpgradeLevel,
      infiniteAngleUnlocked: state.infiniteAngleUnlocked,
      infinityScore: state.infiniteScore,
      infinityScoreLog10: state.infiniteScoreLog10,
      infinityUpgradeMask: state.infinityUpgradeMask,
      numberFormat: state.numberFormat,
    };
    state.achievementMask = 0;
    state.coreBoostCount = 0;
    state.ic8VertexUpgradeLevel = 0;
    state.infiniteAngleUnlocked = false;
    state.infiniteScore = 0;
    state.infiniteScoreLog10 = -Infinity;
    state.infinityUpgradeMask = 0;
    state.numberFormat = "compact";
    state.activeChallenge = 6;
    window.advanceTime(0);
    const small = document.querySelector("#vertexGainValue")?.textContent?.trim() ?? "";
    state.activeChallenge = 0;
    state.gainLevel = 99999;
    window.advanceTime(0);
    const compactBoundary = document.querySelector("#vertexGainValue")?.textContent?.trim() ?? "";
    state.numberFormat = "scientific";
    window.advanceTime(0);
    const scientificBoundary = document.querySelector("#vertexGainValue")?.textContent?.trim() ?? "";
    state.gainLevel = 99999999;
    state.numberFormat = "compact";
    window.advanceTime(0);
    const compactMillion = document.querySelector("#vertexGainValue")?.textContent?.trim() ?? "";
    state.numberFormat = "scientific";
    window.advanceTime(0);
    const scientificMillion = document.querySelector("#vertexGainValue")?.textContent?.trim() ?? "";
    const value = document.querySelector("#vertexGainValue");
    const metric = value?.closest(".metric");
    const metricRect = metric?.getBoundingClientRect();
    const layout = {
      metricWidth: metricRect?.width ?? 0,
      metricClientWidth: metric?.clientWidth ?? 0,
      metricScrollWidth: metric?.scrollWidth ?? 0,
    };
    Object.assign(state, original);
    window.advanceTime(0);
    return { small, compactBoundary, scientificBoundary, compactMillion, scientificMillion, layout };
  });
  assert.equal(vertexGainDisplay.small, "+0.001", "the vertex gain display should preserve IC6 precision");
  assert.equal(vertexGainDisplay.compactBoundary, "+1,000", "compact vertex gain display should use the shared formatter at 1000");
  assert.equal(vertexGainDisplay.scientificBoundary, "+1.00e3", "scientific vertex gain display should use exponent notation at 1000");
  assert.equal(vertexGainDisplay.compactMillion, "+1.00M", "compact vertex gain display should use suffix notation at 1e6");
  assert.equal(vertexGainDisplay.scientificMillion, "+1.00e6", "scientific vertex gain display should use exponent notation at 1e6");
  assert.ok(vertexGainDisplay.layout.metricWidth > 0, "the desktop vertex gain metric should have a rendered width");
  assert.ok(
    vertexGainDisplay.layout.metricScrollWidth <= vertexGainDisplay.layout.metricClientWidth + 1,
    "the desktop vertex gain display should not overflow its metric",
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
    const mainTabs = Array.from(document.querySelectorAll(".main-tab"), (button) => button.dataset.tab);
    const infinityTabs = Array.from(document.querySelectorAll(".infinity-subtab"), (button) => button.dataset.infinityTab);
    const challengeTabs = Array.from(document.querySelectorAll(".challenge-subtab"), (button) => button.dataset.challengeTab);
    const statisticsTabs = Array.from(document.querySelectorAll(".statistics-subtab"), (button) => button.dataset.statisticsTab);
    return { mainTabs, infinityTabs, challengeTabs, statisticsTabs };
  });
  assert.deepEqual(
    tabStructure.mainTabs,
    ["angle", "infinity", "challenges", "automation", "statistics", "achievements", "help", "settings"],
    "main tabs should omit the dormant Time Flux tab",
  );
  assert.deepEqual(tabStructure.infinityTabs, ["upgrades", "angle", "tower"], "Infinity subtabs should be ordered Upgrades, IA, Tower");
  assert.deepEqual(tabStructure.challengeTabs, ["ic", "tc"], "Challenges should expose IC and TC subtabs");
  assert.deepEqual(tabStructure.statisticsTabs, ["overview", "challenges"], "Statistics subtabs should be ordered Overview, Challenge Records");
  const achievementUi = await page.evaluate(() => {
    const { state, switchMainTab } = window.__angleDebug;
    switchMainTab("achievements");
    state.achievementMask = 0x7fffffff;
    state.achievementMaskHigh = 0b111111;
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
  assert.equal(achievementUi.count, 37, "the desktop Achievements panel should render 37 rows");
  assert.equal(achievementUi.japaneseSummary, "37/37 実績", "the desktop Japanese Achievements summary should show 37 achievements");
  assert.equal(achievementUi.englishSummary, "37/37 Achievements", "the desktop English Achievements summary should show 37 achievements");
  assert.deepEqual(achievementUi.japanese, [
    { title: "不吉だという前提は置いておいて", condition: "所持IPがe44に到達", rewardHidden: true },
    { title: "バベルも土台から", condition: "Towerを建設", rewardHidden: true },
    { title: "あれをチャレンジだと呼ぶべきではない", condition: "TC1をクリア", rewardHidden: true },
    { title: "道しるべを残す", condition: "スコアがe2450を超える", rewardHidden: true },
    { title: "ちょっぴり豪邸", condition: "Towerの階層が3に到達", rewardHidden: true },
    { title: "物騒な名前", condition: "TC2をクリア", rewardHidden: true },
  ], "the desktop Japanese achievement definitions should be exact");
  assert.deepEqual(achievementUi.english, [
    { title: "Assuming It Is Unlucky", condition: "Hold at least 1e44 IP." },
    { title: "Babel Starts from the Foundation", condition: "Build the Tower." },
    { title: "We Should Not Call That a Challenge", condition: "Complete TC1." },
    { title: "Leave a Signpost", condition: "Reach more than 1e2450 score." },
    { title: "A Slightly Luxurious Mansion", condition: "Reach Tower Floor 3." },
    { title: "A Violent-Sounding Name", condition: "Complete TC2." },
  ], "the desktop English achievement definitions should be exact");
  assert.ok(achievementUi.listWidth > 0, "the desktop achievement list should have a visible layout");
  const desktopUiChanges = await page.evaluate(() => {
    const { state, switchMainTab, switchInfinitySubtab, switchStatisticsSubtab } = window.__angleDebug;
    switchMainTab("infinity");
    switchInfinitySubtab("upgrades");
    state.fastestInfinityChallengeTimes = [12.5, 0, 0, 0, 0, 0, 0, 0];
    state.fastestTowerChallengeTimes = [27, 0, 0, 0];
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
    document.querySelector('[data-infinity-panel="upgrades"] [data-upgrade="14-1"]')?.click();
    window.advanceTime(0);
    switchMainTab("statistics");
    switchStatisticsSubtab("challenges");
    window.advanceTime(0);
    return {
      statisticsPanelActive: document.querySelector('[data-statistics-panel="challenges"]')?.classList.contains("is-active") ?? false,
      overviewPanelActive: document.querySelector('[data-statistics-panel="overview"]')?.classList.contains("is-active") ?? false,
      infinityRows: document.querySelectorAll("#fastestInfinityChallengeTimes li").length,
      towerRows: document.querySelectorAll("#fastestTowerChallengeTimes li").length,
      infinityFirst: document.querySelector("#fastestInfinityChallengeTimes li")?.textContent?.trim() ?? "",
      towerFirst: document.querySelector("#fastestTowerChallengeTimes li")?.textContent?.trim() ?? "",
      tier12CenterDelta,
      tier13CenterDelta,
      tier14CenterDelta,
      tier14Name: document.querySelector("#infinityUpgradeDetailName")?.textContent?.trim() ?? "",
      tier14Effect: document.querySelector("#infinityUpgradeDetailEffect")?.textContent?.trim() ?? "",
      tier14Requires: document.querySelector("#infinityUpgradeDetailRequires")?.textContent?.trim() ?? "",
      tier14Cost: document.querySelector("#infinityUpgradeDetailCost")?.textContent?.trim() ?? "",
    };
  });
  assert.equal(desktopUiChanges.statisticsPanelActive, true, "Statistics challenge records subtab should activate");
  assert.equal(desktopUiChanges.overviewPanelActive, false, "Statistics overview should deactivate when records are selected");
  assert.equal(desktopUiChanges.infinityRows, 8, "all Infinity Challenges should have statistics rows");
  assert.equal(desktopUiChanges.towerRows, 4, "all Tower Challenges should have statistics rows");
  assert.match(desktopUiChanges.infinityFirst, /IC1.*12秒/);
  assert.match(desktopUiChanges.towerFirst, /TC1.*27秒/);
  assert.ok(desktopUiChanges.tier12CenterDelta !== null && desktopUiChanges.tier12CenterDelta < 1, "IU 12-1 should be centered");
  assert.ok(desktopUiChanges.tier13CenterDelta !== null && desktopUiChanges.tier13CenterDelta < 1, "IU 13-1 should be centered");
  assert.ok(desktopUiChanges.tier14CenterDelta !== null && desktopUiChanges.tier14CenterDelta < 1, "IU 14-1 should be centered");
  assert.equal(desktopUiChanges.tier14Name, "14-1 ペナルティは遅れてやってくる", "IU 14-1 should render its Japanese name");
  assert.equal(desktopUiChanges.tier14Effect, "IU11-2のハードキャップを×3遅らせる", "IU 14-1 should render its Japanese effect");
  assert.match(desktopUiChanges.tier14Requires, /13-1/, "IU 14-1 should render its prerequisite");
  assert.match(desktopUiChanges.tier14Cost, /e80/, "IU 14-1 should render its 1e80 cost");
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
      tc1Base: document.querySelector("#towerChallenge1ScorePowerBase")?.textContent?.trim() ?? "",
      tc1Bonus: document.querySelector("#towerChallenge1ScorePowerBonus")?.textContent?.trim() ?? "",
      tc1Total: document.querySelector("#towerChallenge1ScorePowerTotal")?.textContent?.trim() ?? "",
      buildDisabled: Boolean(document.querySelector("#towerBuildButton")?.disabled),
    };
    switchMainTab("challenges");
    switchChallengeSubtab("tc");
    return {
      towerState,
      challengePanelActive: Boolean(document.querySelector('[data-challenge-panel="tc"]')?.classList.contains("is-active")),
      towerChallengeRows: document.querySelectorAll("#towerChallengeList .tower-challenge-row").length,
      towerChallengeButton: document.querySelector("#towerChallengeList .tower-challenge-row button")?.textContent?.trim() ?? "",
      towerChallengeButtonDisabled: Boolean(document.querySelector("#towerChallengeList .tower-challenge-row button")?.disabled),
      towerChallengeRestriction: document.querySelector("#towerChallengeList .tower-challenge-row .challenge-restriction")?.textContent?.trim() ?? "",
      towerChallengeTarget: document.querySelector("#towerChallengeList .tower-challenge-row .challenge-target")?.textContent?.trim() ?? "",
      towerChallenge2Target: document.querySelector('#towerChallengeList [data-tower-challenge="2"] .challenge-target')?.textContent?.trim() ?? "",
    };
  });
  assert.equal(towerInitial.towerState.panelActive, true, "Infinity > Tower should activate the Tower panel");
  assert.equal(towerInitial.towerState.floor, "0", "Tower should start at Floor 0");
  assert.match(towerInitial.towerState.cost, /1\.00e50/, "Floor 1 should display an e50 IP cost");
  assert.equal(towerInitial.towerState.buildDisabled, true, "Tower construction should be disabled without IP");
  assert.equal(towerInitial.challengePanelActive, true, "Challenges > TC should activate the TC panel");
  assert.equal(towerInitial.towerChallengeRows, 4, "TC1-TC4 rows should be visible");
  assert.equal(towerInitial.towerChallengeButton, "挑戦開始", "implemented TC rows should expose a start button");
  assert.equal(towerInitial.towerChallengeButtonDisabled, true, "locked TC rows should disable their start button");
  assert.match(towerInitial.towerChallengeRestriction, /通常強化/);
  assert.match(towerInitial.towerChallengeTarget, /1\.00e308/);
  assert.match(towerInitial.towerChallenge2Target, /1\.00e1,555/);
  assert.equal(towerInitial.towerState.scoreExponent, "^1.00");
  assert.equal(towerInitial.towerState.tc1Base, "^0.300");
  assert.equal(towerInitial.towerState.tc1Bonus, "+^0.000");
  assert.equal(towerInitial.towerState.tc1Total, "^0.300");
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
    state.scoreLog10 = 308;
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
    replayButton?.click();
    const replay = {
      active: state.activeTowerChallenge,
      button: replayButton?.textContent?.trim() ?? "",
      disabled: Boolean(replayButton?.disabled),
    };
    state.scoreLog10 = 308;
    state.score = Number.MAX_VALUE;
    const replayCompleted = completeTowerChallengeIfReady();
    state.towerFloor = 0;
    state.infinityCount = 0;
    state.score = 0;
    state.scoreLog10 = -Infinity;
    state.completedTowerChallenges = 0;
    window.advanceTime(0);
    return { active, result, replayStarted, replay, replayCompleted };
  });
  assert.equal(towerChallengeFlow.active.active, 1, "TC1 should become active from its UI button");
  assert.equal(towerChallengeFlow.active.button, "挑戦中止", "an active TC should expose a stop button");
  assert.equal(towerChallengeFlow.result.completed, true, "TC1 should complete at its displayed target");
  assert.equal(towerChallengeFlow.result.completedMask, 1, "TC1 completion should set its reward flag");
  assert.equal(towerChallengeFlow.replayStarted, "再挑戦", "a cleared TC should expose a replay button");
  assert.equal(towerChallengeFlow.replay.active, 1, "a cleared TC should become active when replayed");
  assert.equal(towerChallengeFlow.replay.button, "挑戦中止", "a replaying TC should expose a stop button");
  assert.equal(towerChallengeFlow.replay.disabled, false, "a replaying TC stop button should be enabled");
  assert.equal(towerChallengeFlow.replayCompleted, true, "a replaying TC should complete at its displayed target");
  const towerRewardDisplay = await page.evaluate(() => {
    const { state } = window.__angleDebug;
    const original = {
      completedTowerChallenges: state.completedTowerChallenges,
      language: state.language,
      towerFloor: state.towerFloor,
    };
    state.completedTowerChallenges = 3;
    state.towerFloor = 5;
    window.advanceTime(0);
    const tc1 = {
      base: document.querySelector("#towerChallenge1ScorePowerBase")?.textContent?.trim() ?? "",
      bonus: document.querySelector("#towerChallenge1ScorePowerBonus")?.textContent?.trim() ?? "",
      total: document.querySelector("#towerChallenge1ScorePowerTotal")?.textContent?.trim() ?? "",
    };
    state.towerFloor = 22;
    window.advanceTime(0);
    const tc2 = {
      raw: document.querySelector("#coreBoostRequirementGrowthPowerRaw")?.textContent?.trim() ?? "",
      effective: document.querySelector("#coreBoostRequirementGrowthPower")?.textContent?.trim() ?? "",
    };
    state.language = "en";
    window.advanceTime(0);
    const englishLabels = {
      tc1Base: document.querySelector('[data-i18n="towerChallenge1ScorePowerBase"]')?.textContent?.trim() ?? "",
      tc2Effective: document.querySelector('[data-i18n="coreBoostGrowthPower"]')?.textContent?.trim() ?? "",
    };
    Object.assign(state, original);
    window.advanceTime(0);
    return { tc1, tc2, englishLabels };
  });
  assert.equal(towerRewardDisplay.tc1.base, "^0.300", "TC1 should expose its base exponent in the Tower panel");
  assert.equal(towerRewardDisplay.tc1.bonus, "+^0.154", "TC1 should expose its floor-scaled bonus in the Tower panel");
  assert.equal(towerRewardDisplay.tc1.total, "^0.454", "TC1 should expose the combined exponent in the Tower panel");
  assert.equal(towerRewardDisplay.tc2.raw, "^1.490", "TC2 should expose the raw requirement growth power");
  assert.equal(towerRewardDisplay.tc2.effective, "^1.499", "TC2 should expose the soft-capped requirement growth power");
  assert.equal(towerRewardDisplay.englishLabels.tc1Base, "TC1 base exponent", "TC1 exponent labels should be translated to English");
  assert.equal(towerRewardDisplay.englishLabels.tc2Effective, "CB requirement growth (effective)", "TC2 exponent labels should be translated to English");
  const timeFluxRemoval = await page.evaluate(() => {
    const { state, advanceOnlineTime, processOfflineElapsed } = window.__angleDebug;
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
    const report = processOfflineElapsed(1, "test", { clockSource: "server" });
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

  await page.evaluate(() => {
    const { state } = window.__angleDebug;
    state.generationCount = 7;
    state.previousGenerationScore = 1e12;
    state.previousGenerationScoreLog10 = 12;
    window.advanceTime(0);
  });
  await page.locator("#exportSaveCodeButton").click();
  await page.waitForFunction(() => document.querySelector("#saveCodeArea")?.value.startsWith("ANGLE_SAVE_V2:"));
  const exportedSaveCodeLength = await saveCodeArea.inputValue().then((value) => value.length);
  await page.evaluate(() => {
    window.__angleDebug.state.generationCount = 99;
  });
  await page.locator("#importSaveCodeButton").click();
  await page.waitForFunction(() => window.__angleDebug.state.generationCount === 7);
  assert.ok(exportedSaveCodeLength > 20, "save-code export should populate the textarea");
  assert.equal(
    await page.evaluate(() => window.__angleDebug.state.previousGenerationScoreLog10),
    12,
    "save-code import should restore the exported state",
  );

  await page.locator('[data-tab="automation"]').click();
  await page.evaluate(() => {
    window.__angleDebug.state.infinityCount = Math.max(1, window.__angleDebug.state.infinityCount);
    window.__angleDebug.state.infinityUpgradeMask |= 1 << 5;
    window.advanceTime(0);
  });
  const autoCompleteToggle = page.locator("#autoCompleteChallengesToggle");
  await autoCompleteToggle.check();
  assert.equal(
    await page.evaluate(() => window.__angleDebug.state.autoCompleteChallenges),
    true,
    "the IC auto-complete setting should persist through its UI toggle",
  );

  await page.locator('[data-tab="challenges"]').click();
  const firstChallengeRestriction = await page.locator("#challengeList .challenge-restriction").first().textContent();
  assert.match(firstChallengeRestriction ?? "", /基礎獲得式/, "the IC formula restriction should be visible");

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
      updateTitle: document.querySelector("#updateModalTitle")?.textContent?.trim() ?? "",
      tabCount: document.querySelectorAll(".main-tab").length,
      timeFluxTab: Boolean(document.querySelector('[data-tab="timeFlux"]')),
      timeFluxPanel: Boolean(document.querySelector("#timeFluxPanel")),
      timeFluxQuickBar: Boolean(document.querySelector("#timeFluxQuickBar")),
      canvasWidth: document.querySelector("#gameCanvas")?.getBoundingClientRect().width ?? 0,
    }));
    assert.equal(mobileStartup.updateTitle, `${EXPECTED_ASSET_VERSION} アップデート`, "mobile startup should use the release version");
    assert.equal(mobileStartup.tabCount, 8, "mobile startup should expose the active main tabs");
    assert.equal(mobileStartup.timeFluxTab, false, "mobile startup should omit the dormant Time Flux tab");
    assert.equal(mobileStartup.timeFluxPanel, false, "mobile startup should omit the dormant Time Flux panel");
    assert.equal(mobileStartup.timeFluxQuickBar, false, "mobile startup should omit the dormant Time Flux quick bar");
    assert.ok(mobileStartup.canvasWidth > 0, "the mobile Angle canvas should have a rendered width");
    await mobilePage.locator("#updateModalClose").click();

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
      state.achievementMaskHigh = 0b111111;
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
    assert.equal(mobileAchievements.count, 37, "the mobile Achievements panel should render 37 rows");
    assert.equal(mobileAchievements.lastTitle, "物騒な名前", "the mobile Achievements panel should keep the final row visible");
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
        infiniteAngleUnlocked: state.infiniteAngleUnlocked,
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
      };
    });
    assert.ok(mobileUpgradeCenters.tier12 !== null && mobileUpgradeCenters.tier12 < 1, "mobile IU 12-1 should be centered");
    assert.ok(mobileUpgradeCenters.tier13 !== null && mobileUpgradeCenters.tier13 < 1, "mobile IU 13-1 should be centered");
    assert.ok(mobileUpgradeCenters.tier14 !== null && mobileUpgradeCenters.tier14 < 1, "mobile IU 14-1 should be centered");

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
    report.mobile = {
      viewport: "390x844",
      startup: mobileStartup,
      offlineSetting: mobileOfflineSetting,
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
