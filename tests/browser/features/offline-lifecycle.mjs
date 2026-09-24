import assert from "node:assert/strict";
import {
  expectedAppVersion,
  openGamePage,
  stubExternalFonts,
  trackPage,
} from "../../browser-harness.mjs";

export async function runOfflineLifecycleRegression({ browser, origin, httpFailures }) {
  const errors = [];
  const { context, page } = await openGamePage(browser, origin, {
    viewport: { width: 800, height: 600 },
    seenVersion: expectedAppVersion,
    stubFonts: true,
    freezeAnimationFrame: true,
  });
  trackPage(page, "offline-lifecycle", errors, httpFailures);

  let seededSave;
  try {
    await page.evaluate(() => {
      const { runtime } = window.__angleDebug;
      window.__offlineResumeCalls = [];
      window.__originalOfflineProcessor = runtime.processOfflineElapsed;
      runtime.processOfflineElapsed = async (...args) => {
        window.__offlineResumeCalls.push({ elapsedSeconds: args[0], source: args[1] });
        const report = await window.__originalOfflineProcessor(...args);
        if (window.__holdOfflineResume) {
          window.__holdOfflineResume = false;
          await new Promise((resolve) => { window.__releaseOfflineResume = resolve; });
        }
        return report;
      };
    });

    await page.evaluate(() => {
      const { runtime } = window.__angleDebug;
      runtime.setOfflineBaseline(Date.now() - 60_000, 0);
      window.__visibilityBaseline = runtime.offlineBaselineTimestamp;
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(
      (baseline) => window.__angleDebug.runtime.offlineBaselineTimestamp > baseline,
      await page.evaluate(() => window.__visibilityBaseline),
    );
    await page.waitForTimeout(2_200);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: false });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(() => window.__offlineResumeCalls.length === 1, null, { timeout: 15_000, polling: 100 });
    const visibilityResume = await page.evaluate(() => window.__offlineResumeCalls[0]);
    assert.equal(visibilityResume.source, "visibility", "the existing visibility bridge should use the canonical processor");
    assert.ok(visibilityResume.elapsedSeconds > 0, "a normal visibility restore should apply the hidden interval");

    await page.evaluate(() => {
      const { runtime } = window.__angleDebug;
      runtime.setOfflineBaseline(Date.now() - 60_000, 0);
      window.__fallbackBaseline = runtime.offlineBaselineTimestamp;
      window.__holdOfflineResume = true;
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    });
    await page.waitForFunction(
      (baseline) => window.__angleDebug.runtime.offlineBaselineTimestamp > baseline,
      await page.evaluate(() => window.__fallbackBaseline),
    );
    await page.waitForTimeout(2_200);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await page.waitForFunction(
      () => typeof window.__releaseOfflineResume === "function",
      null,
      { timeout: 15_000, polling: 100 },
    );
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    const overlappingSignals = await page.evaluate(() => window.__offlineResumeCalls.map((call) => ({ ...call })));
    assert.equal(overlappingSignals.length, 2, "pageshow plus visibilitychange should start only one fallback resume");
    assert.equal(overlappingSignals[1].source, "visibility", "the fallback should reuse the canonical processor");
    assert.ok(overlappingSignals[1].elapsedSeconds > 0, "pagehide/pageshow should account for the saved interval");
    await page.evaluate(() => {
      window.__releaseOfflineResume();
      window.__releaseOfflineResume = null;
    });
    await page.waitForTimeout(0);

    const beforeDisabledResume = await page.evaluate(() => {
      const { runtime, state } = window.__angleDebug;
      state.offlineProgressEnabled = false;
      runtime.offlineReport = null;
      runtime.setOfflineBaseline(Date.now() - 60_000, 0);
      window.__disabledPlayTime = state.totalPlayTime;
      window.__disabledCalls = window.__offlineResumeCalls.length;
      const staleBaseline = runtime.offlineBaselineTimestamp;
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      return staleBaseline;
    });
    await page.waitForFunction(
      (baseline) => window.__angleDebug.runtime.offlineBaselineTimestamp > baseline,
      beforeDisabledResume,
    );
    const hiddenBaseline = await page.evaluate(() => window.__angleDebug.runtime.offlineBaselineTimestamp);
    await page.waitForTimeout(1_100);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await page.waitForFunction(
      (baseline) => window.__angleDebug.runtime.offlineBaselineTimestamp > baseline,
      hiddenBaseline,
    );
    const disabledResume = await page.evaluate(() => ({
      calls: window.__offlineResumeCalls.length,
      previousCalls: window.__disabledCalls,
      totalPlayTime: window.__angleDebug.state.totalPlayTime,
      previousPlayTime: window.__disabledPlayTime,
      offlineReport: window.__angleDebug.runtime.offlineReport,
      enabled: window.__angleDebug.state.offlineProgressEnabled,
    }));
    assert.equal(disabledResume.calls, disabledResume.previousCalls, "disabled progress should not invoke the processor");
    assert.equal(disabledResume.totalPlayTime, disabledResume.previousPlayTime, "disabled progress should skip the hidden interval");
    assert.equal(disabledResume.offlineReport, null, "disabled progress should not show a report");
    assert.equal(disabledResume.enabled, false, "the disabled setting should remain unchanged");

    seededSave = await page.evaluate(() => {
      const { runtime, state } = window.__angleDebug;
      state.offlineProgressEnabled = true;
      state.totalPlayTime = 12;
      runtime.saveGame("manual");
      const save = JSON.parse(localStorage.getItem(runtime.SAVE_KEY));
      save.savedAt -= 30_000;
      if (save.serverSavedAt > 0) save.serverSavedAt -= 30_000;
      return JSON.stringify(save);
    });
    assert.deepEqual(errors, [], "lifecycle browser test should produce no browser errors");
  } finally {
    await context.close();
  }

  const freshContext = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const freshErrors = [];
  try {
    await stubExternalFonts(freshContext);
    const freshPage = await freshContext.newPage();
    trackPage(freshPage, "offline-lifecycle-load", freshErrors, httpFailures);
    await freshPage.addInitScript(({ appVersion, save }) => {
      window.requestAnimationFrame = () => 0;
      localStorage.setItem("angle-incremental-seen-version", appVersion);
      localStorage.setItem("angle-incremental-save", save);
    }, { appVersion: expectedAppVersion, save: seededSave });
    await freshPage.goto(`${origin}/index.html`, { waitUntil: "networkidle" });
    await freshPage.waitForFunction(() => Boolean(window.__angleDebug?.ready));
    await freshPage.evaluate(() => window.__angleDebug.ready);
    const loaded = await freshPage.evaluate(() => ({
      elapsedSeconds: window.__angleDebug.runtime.offlineReport?.elapsedSeconds ?? 0,
      totalPlayTime: window.__angleDebug.state.totalPlayTime,
    }));
    assert.ok(loaded.elapsedSeconds > 0, "a fresh context should process elapsed time from the persisted timestamp");
    assert.ok(loaded.totalPlayTime > 12, "the persisted load interval should advance normal game time");
    assert.deepEqual(freshErrors, [], "fresh-load lifecycle test should produce no browser errors");
  } finally {
    await freshContext.close();
  }
}
