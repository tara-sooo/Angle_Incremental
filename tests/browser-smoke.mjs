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
const EXPECTED_ASSET_VERSION = "0.4.0";
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
  "/src/systems/achievements.js",
  "/src/ui/render-canvas.js",
  "/src/ui/render-ui.js",
  "/src/systems/angle.js",
  "/src/systems/generation.js",
  "/src/systems/core-boost.js",
  "/src/systems/infinity.js",
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

  const snapshot = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  assert.equal(snapshot.vertices, 3);
  assert.equal(snapshot.infinity.count, 0);
  assert.equal(typeof snapshot.score, "string");
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
    window.__angleDebug.state.totalPlayTime = 14 * 18;
    window.advanceTime(0);
    return document.querySelector("#newsTickerText")?.textContent?.trim() ?? "";
  });
  assert.equal(addedJapaneseNews, "誰かInfinityに落ち着くよう伝えてください。", "news ticker should include game-local community-style Japanese messages");
  const addedEnglishNews = await page.evaluate(() => {
    window.__angleDebug.applySetting("language", "en");
    window.__angleDebug.state.totalPlayTime = 14 * 18;
    window.advanceTime(0);
    return document.querySelector("#newsTickerText")?.textContent?.trim() ?? "";
  });
  assert.equal(addedEnglishNews, "Someone tell Infinity to calm down.", "news ticker should include game-local community-style English messages");
  const addedProgressionNews = await page.evaluate(() => {
    window.__angleDebug.applySetting("language", "ja");
    window.__angleDebug.state.totalPlayTime = 18 * 18;
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
  const breakCapPlacement = await page.evaluate(() => {
    const breakCap = document.querySelector("#breakCapButton");
    const subtabs = document.querySelector(".infinity-subtabs");
    const challengePanel = document.querySelector('[data-infinity-panel="challenges"]');
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

  const requestedModulePaths = new Set(moduleRequests.map((url) => url.pathname));
  EXPECTED_MODULE_PATHS.forEach((modulePath) => {
    assert.ok(requestedModulePaths.has(modulePath), `expected ${modulePath} to be requested`);
  });
  assert.ok(
    moduleRequests.every((url) => url.searchParams.get("v") === EXPECTED_ASSET_VERSION),
    "every game ESM module must use the current versioned URL",
  );

  await page.locator("#updateModalClose").click();
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
