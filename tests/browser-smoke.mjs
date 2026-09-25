import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expectedAppVersion, openGamePage, root, startGameTest, trackPage } from "./browser-harness.mjs";

const reportPath = path.join(root, "browser-smoke-report.json");
const expectedIconDeclarations = [
  { rel: "icon", type: "image/png", sizes: "32x32", href: "assets/angle-incremental-icon-32.png" },
  { rel: "icon", type: "image/png", sizes: "64x64", href: "assets/angle-incremental-icon-64.png" },
  { rel: "apple-touch-icon", type: "image/png", sizes: "180x180", href: "assets/angle-incremental-icon-180.png" },
];
assert.equal(
  createHash("sha256").update(await readFile(path.join(root, "assets/angle-incremental-icon.png"))).digest("hex"),
  "4a01b88d084fac2ed1f13952d56c52484fb64f6935ff33db4e3206632b754bc5",
  "the maintainer-provided source icon must remain byte-for-byte unchanged",
);
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
  "/src/core/offline-progress.js",
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
  "/src/systems/eternity.js",
  "/src/systems/infinity-point-normalization.js",
  "/src/ui/events.js",
];

async function inspectIconAssets(page) {
  return page.evaluate(async () => {
    const declarations = Array.from(document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')).map((link) => ({
      rel: link.rel,
      type: link.type,
      sizes: link.getAttribute("sizes"),
      href: link.getAttribute("href"),
    }));
    const assets = await Promise.all(declarations.map(async (declaration) => {
      const url = new URL(declaration.href, document.baseURI).href;
      const response = await fetch(url, { cache: "no-store" });
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      return {
        href: declaration.href,
        status: response.status,
        contentType: response.headers.get("content-type"),
        width: image.naturalWidth,
        height: image.naturalHeight,
        cornerAlpha: context.getImageData(0, 0, 1, 1).data[3],
      };
    }));
    return { declarations, assets };
  });
}

function assertIconAssets(result, servingPath) {
  assert.deepEqual(result.declarations, expectedIconDeclarations, servingPath + " should declare the expected project-relative icons");
  assert.equal(result.assets.length, expectedIconDeclarations.length, servingPath + " should load every declared icon");
  result.assets.forEach((asset, index) => {
    const expectedSize = Number(expectedIconDeclarations[index].sizes.split("x")[0]);
    assert.equal(asset.status, 200, servingPath + " should return " + asset.href);
    assert.equal(asset.contentType?.split(";")[0], "image/png", servingPath + " should serve " + asset.href + " as PNG");
    assert.equal(asset.width, expectedSize, asset.href + " should have the declared width");
    assert.equal(asset.height, expectedSize, asset.href + " should have the declared height");
    assert.equal(asset.cornerAlpha, 0, asset.href + " should pad the artwork with transparency");
  });
}

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
  assertIconAssets(await inspectIconAssets(page), "root path");
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
      interaction: document.querySelector("[data-i18n=updateInteraction]")?.textContent?.trim() ?? "",
      note: document.querySelector("[data-i18n=updateModalNote]")?.textContent?.trim() ?? "",
    }));
    assert.match(modalCopy.summary, /オフライン進行/);
    assert.match(modalCopy.summary, /安定性/);
    assert.match(modalCopy.resetDock, /Auto Infinity/);
    assert.match(modalCopy.resetDock, /Core Boost/);
    assert.match(modalCopy.canvas, /Eternity Milestone 5/);
    assert.match(modalCopy.canvas, /TC4/);
    assert.match(modalCopy.interaction, /Infinity Upgrade/);
    assert.match(modalCopy.interaction, /Help/);
    assert.match(modalCopy.note, /セーブ復旧/);
    assert.match(modalCopy.note, /整数値/);
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
      await mobilePage.page.goto(localOrigin + "/Angle_Incremental/", { waitUntil: "networkidle" });
      await mobilePage.page.waitForFunction(() => Boolean(window.__angleDebug?.ready));
      assertIconAssets(await inspectIconAssets(mobilePage.page), "GitHub Pages project path");
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
