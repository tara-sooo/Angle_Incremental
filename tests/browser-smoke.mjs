import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { expectedAppVersion, openGamePage, root, startGameTest, trackPage } from "./browser-harness.mjs";

const reportPath = path.join(root, "browser-smoke-report.json");
const expectedModulePaths = [
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
  "/src/systems/eternity.js",
  "/src/systems/balance-angle.js",
  "/src/systems/balance-generation.js",
  "/src/systems/balance-core-boost.js",
  "/src/systems/balance-infinity.js",
  "/src/systems/balance-ui.js",
  "/src/systems/infinity-point-normalization.js",
  "/src/ui/events.js",
];

async function runSmoke() {
  const gameTest = await startGameTest();
  const errors = [];
  const httpFailures = [];
  const gamePage = await openGamePage(gameTest.browser, gameTest.origin, {
    viewport: { width: 1280, height: 800 },
    seenVersion: null,
    stubFonts: true,
    freezeAnimationFrame: false,
  });
  const { context, page } = gamePage;
  const moduleRequests = [];
  const localOrigin = gameTest.origin;
  const report = {
    result: "running",
    expectedAssetVersion: expectedAppVersion,
    errors,
    httpFailures,
    moduleRequests: [],
  };

  trackPage(page, "main", errors, httpFailures);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === localOrigin && url.pathname.startsWith("/src/") && url.pathname.endsWith(".js")) {
      moduleRequests.push(url);
    }
  });

  try {
    const updateModal = page.locator("#updateModal");
    assert.equal(await updateModal.isVisible(), true, "the current-version update modal should appear for a fresh browser profile");
    assert.equal(
      await page.locator("#updateModalTitle").textContent(),
      `${expectedAppVersion} アップデート`,
      "the update modal should show the current Japanese version",
    );
    await page.locator("#updateModalClose").click();
    await page.waitForFunction(() => document.querySelector("#updateModal")?.hidden === true);
    assert.equal(await updateModal.isVisible(), false, "closing the update modal should remove it from the rendered page");

    const modalCopy = await page.evaluate(() => ({
      summary: document.querySelector("[data-i18n=updateSummary]")?.textContent?.trim() ?? "",
      resetDock: document.querySelector("[data-i18n=updateResetDock]")?.textContent?.trim() ?? "",
      canvas: document.querySelector("[data-i18n=updateCanvas]")?.textContent?.trim() ?? "",
      note: document.querySelector("[data-i18n=updateModalNote]")?.textContent?.trim() ?? "",
    }));
    assert.match(modalCopy.summary, /Eternity/);
    assert.match(modalCopy.summary, /Timeline/);
    assert.match(modalCopy.resetDock, /BC16500/);
    assert.match(modalCopy.canvas, /Timeline/);
    assert.match(modalCopy.note, /10から11/);
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
    assert.equal(manifestVersion.appVersion, expectedAppVersion, "version.json should match the asset version");
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
    const snapshot = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    assert.equal(snapshot.vertices, 3);
    assert.equal(snapshot.infinity.count, 0);
    assert.equal(typeof snapshot.score, "string");

    await page.locator('[data-tab="statistics"]').click();
    assert.equal(await page.locator('[data-panel="statistics"]').isVisible(), true, "core navigation should render the selected panel");
    await page.locator('[data-tab="settings"]').click();
    assert.equal(await page.locator('[data-panel="settings"]').isVisible(), true, "Settings should render through main navigation");

    const offlineTickInput = page.locator("#offlineTickInput");
    await offlineTickInput.fill("5000");
    await offlineTickInput.press("Tab");
    assert.equal(
      await page.evaluate(() => window.__angleDebug.state.offlineTickCount),
      5000,
      "a Settings value should update through the real input",
    );

    const saveCodeArea = page.locator("#saveCodeArea");
    await page.evaluate(() => {
      const { state } = window.__angleDebug;
      state.generationCount = 7;
      state.previousGenerationScore = 1e12;
      state.previousGenerationScoreLog10 = 12;
      window.__angleDebug.saveGame("manual");
      window.advanceTime(0);
    });
    await page.locator("#exportSaveCodeButton").click();
    await page.waitForFunction(() => document.querySelector("#saveCodeArea")?.value.startsWith("ANGLE_SAVE_V2:"));
    assert.ok((await saveCodeArea.inputValue()).length > 20, "save-code export should populate the textarea");
    await page.evaluate(() => {
      window.__angleDebug.state.generationCount = 99;
    });
    await page.locator("#importSaveCodeButton").click();
    await page.waitForFunction(() => window.__angleDebug.state.generationCount === 7);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.__angleDebug?.ready));
    await page.evaluate(() => window.__angleDebug.ready);
    assert.equal(
      await page.evaluate(() => window.__angleDebug.state.generationCount),
      7,
      "manual save state should survive a browser reload",
    );

    await page.locator('[data-tab="angle"]').click();
    assert.equal(await page.locator('[data-panel="angle"]').isVisible(), true, "the core Angle panel should remain rendered after reload");

    const requestedModulePaths = new Set(moduleRequests.map((url) => url.pathname));
    expectedModulePaths.forEach((modulePath) => {
      assert.ok(requestedModulePaths.has(modulePath), `expected ${modulePath} to be requested`);
    });
    assert.ok(
      moduleRequests.every((url) => url.searchParams.get("v") === expectedAppVersion),
      "every game ESM module must use the current versioned URL",
    );

    const mobileErrors = [];
    const mobileFailures = [];
    const mobilePage = await openGamePage(gameTest.browser, gameTest.origin, {
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      seenVersion: expectedAppVersion,
      stubFonts: true,
      freezeAnimationFrame: false,
    });
    trackPage(mobilePage.page, "mobile", mobileErrors, mobileFailures);
    try {
      assert.equal(await mobilePage.page.locator("#gameCanvas").isVisible(), true, "the mobile Angle canvas should be rendered");
      await mobilePage.page.locator('[data-tab="settings"]').click();
      assert.equal(await mobilePage.page.locator('[data-panel="settings"]').isVisible(), true, "Settings should remain visible on mobile");
      const mobileTabBar = await mobilePage.page.evaluate(() => {
        const strip = document.querySelector(".main-tab-scroll");
        const visibleTabs = Array.from(document.querySelectorAll("[data-tab]")).filter((button) => button.getClientRects().length > 0);
        const rects = visibleTabs.map((button) => button.getBoundingClientRect());
        return {
          stripScrollWidth: strip?.scrollWidth ?? 0,
          stripClientWidth: strip?.clientWidth ?? 0,
          oneRow: rects.length === 0 || Math.max(...rects.map((rect) => rect.top)) - Math.min(...rects.map((rect) => rect.top)) < 1,
          allVisibleInStrip: visibleTabs.every((button) => button.parentElement === strip),
        };
      });
      assert.equal(mobileTabBar.oneRow, true, "mobile navigation should remain on one row");
      assert.equal(mobileTabBar.allVisibleInStrip, true, "mobile navigation should use the shared scrolling strip");
      assert.ok(mobileTabBar.stripScrollWidth >= mobileTabBar.stripClientWidth, "mobile navigation should keep a measurable scroll surface");
      assert.deepEqual(mobileErrors, [], "mobile smoke should produce no browser errors");
      assert.deepEqual(mobileFailures, [], "mobile smoke should produce no HTTP failures");
    } finally {
      await mobilePage.context.close();
    }

    assert.deepEqual(errors, [], "desktop smoke should produce no browser errors");
    assert.deepEqual(httpFailures, [], "desktop smoke should produce no HTTP failures");
    report.result = "passed";
    console.log("browser ESM smoke test passed");
  } catch (error) {
    report.result = "failed";
    report.failure = error instanceof Error ? error.stack || error.message : String(error);
    throw error;
  } finally {
    report.errors = errors;
    report.httpFailures = httpFailures;
    report.moduleRequests = moduleRequests.map((url) => url.toString());
    try {
      await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    } catch (error) {
      console.error("failed to write browser smoke report", error);
    }
    await context.close();
    await gameTest.close();
  }
}

await runSmoke();
