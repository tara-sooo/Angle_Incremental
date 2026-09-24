import assert from "node:assert/strict";
import { openGamePage, startGameTest, trackPage } from "./browser-harness.mjs";
import {
  readScrollOwnership,
  readUiContract,
} from "./browser/features/helpers.mjs";
import { runConfirmationRegression } from "./browser/features/confirmation.mjs";
import { runHelp } from "./browser/features/help.mjs";
import {
  runNavigationSettings,
  runNavigationSettingsDensity,
  runNavigationSurfacePrelude,
} from "./browser/features/navigation-settings.mjs";
import {
  runDesktopPageHeaders,
  runDesktopResponsiveLayout,
  runMobileResponsive,
} from "./browser/features/responsive-layout.mjs";
import {
  runInfiniteAngleSurface,
  runProgressionCore,
  runProgressionGain,
} from "./browser/features/progression-surfaces.mjs";
import { runOfflineRecoverySurface, runSaveCodeRecovery } from "./browser/features/save-recovery.mjs";
import { runOfflineLifecycleRegression } from "./browser/features/offline-lifecycle.mjs";
import { runTimelineCopyRegression } from "./browser/features/timeline.mjs";

const gameTest = await startGameTest();
const errors = [];
const httpFailures = [];
let mainContext;

try {
  const mainPageHandle = await openGamePage(gameTest.browser, gameTest.origin, {
    viewport: { width: 1280, height: 900 },
    stubFonts: true,
    freezeAnimationFrame: false,
  });
  mainContext = mainPageHandle.context;
  const { page } = mainPageHandle;
  trackPage(page, "main", errors, httpFailures);
  await page.evaluate(() => window.__angleDebug.runtime.closeUpdateModal?.());
  await page.evaluate(() => {
    const panel = document.querySelector("#offlineReportPanel");
    if (panel && !panel.hidden) document.querySelector("#offlineReportClose")?.click();
  });

  await runConfirmationRegression(gameTest.browser, gameTest.origin, httpFailures);
  await runTimelineCopyRegression(gameTest.browser, gameTest.origin, httpFailures);
  await runNavigationSettings({ page });
  await runHelp({ page, readScrollOwnership });
  await runNavigationSurfacePrelude({ page });
  await runDesktopResponsiveLayout({
    page,
    readUiContract,
    readScrollOwnership,
  });
  await runProgressionGain({ page });
  await runDesktopPageHeaders({ page });
  await runProgressionCore({ page });
  await runOfflineRecoverySurface({ page });
  await runOfflineLifecycleRegression({
    browser: gameTest.browser,
    origin: gameTest.origin,
    httpFailures,
  });
  await runInfiniteAngleSurface({ page });
  await runSaveCodeRecovery({ page });
  await runNavigationSettingsDensity({ page });
  await runMobileResponsive({
    browser: gameTest.browser,
    origin: gameTest.origin,
    httpFailures,
    readUiContract,
  });

  assert.deepEqual(errors, []);
  assert.deepEqual(httpFailures, [], "browser smoke should not have HTTP failures");
  console.log("browser feature regression test passed");
} finally {
  if (mainContext) await mainContext.close();
  await gameTest.close();
}
