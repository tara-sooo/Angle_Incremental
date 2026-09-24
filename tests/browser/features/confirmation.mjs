import assert from "node:assert/strict";
import { openGamePage, trackPage } from "../../browser-harness.mjs";

export async function runConfirmationRegression(browser, origin, httpFailures) {
  const confirmationErrors = [];
  const { context: confirmationContext, page: confirmationPage } = await openGamePage(browser, origin, {
    viewport: { width: 1280, height: 900 },
    stubFonts: true,
    freezeAnimationFrame: false,
  });
  trackPage(confirmationPage, "confirmation", confirmationErrors, httpFailures);
  try {
    await confirmationPage.evaluate(() => {
      window.__nativeConfirmCalls = 0;
      window.confirm = () => {
        window.__nativeConfirmCalls += 1;
        return false;
      };
      window.__angleDebug.runtime.closeUpdateModal?.();
      const { state, switchMainTab, switchEternitySubtab } = window.__angleDebug;
      state.eternityCount = 1;
      state.scoreTfClaims = 1;
      state.timelinePurchasedNodes = [{ id: "Real-BC16500", costTF: 1 }];
      switchMainTab("eternity");
      switchEternitySubtab("timeline");
      window.advanceTime(0);
    });
    const readConfirmation = () => confirmationPage.evaluate(() => ({
      open: document.querySelector("#confirmationModal")?.open ?? false,
      title: document.querySelector("#confirmationModalTitle")?.textContent?.trim() ?? "",
      message: document.querySelector("#confirmationModalMessage")?.textContent?.trim() ?? "",
      activeId: document.activeElement?.id ?? "",
      nativeConfirmCalls: window.__nativeConfirmCalls,
      timelineNodes: window.__angleDebug.state.timelinePurchasedNodes.length,
      generationCount: window.__angleDebug.state.generationCount,
      currentEternityRunTime: window.__angleDebug.state.currentEternityRunTime,
      currentEternityRealTime: window.__angleDebug.state.currentEternityRealTime,
    }));
    const timelineButton = confirmationPage.locator("#timelineRespecButton");
    assert.equal(await timelineButton.isEnabled(), true, "Timeline Respec should be enabled for the confirmation test");
    await timelineButton.click();
    const japaneseTimelineModal = await readConfirmation();
    assert.equal(japaneseTimelineModal.open, true, "Timeline Respec should open the in-page confirmation dialog");
    assert.equal(japaneseTimelineModal.title, "確認", "Japanese confirmation title should be localized");
    assert.match(japaneseTimelineModal.message, /Timeline.*リスペック/, "Japanese Timeline confirmation should be usable");
    assert.equal(japaneseTimelineModal.activeId, "confirmationCancelButton", "confirmation should focus Cancel");
    assert.equal(japaneseTimelineModal.nativeConfirmCalls, 0, "Timeline Respec must not call native confirm");
    await confirmationPage.keyboard.press("Escape");
    const timelineCancelled = await readConfirmation();
    assert.equal(timelineCancelled.open, false, "Escape should cancel the confirmation");
    assert.equal(timelineCancelled.timelineNodes, 1, "cancelled Timeline Respec should leave nodes unchanged");
    assert.equal(timelineCancelled.activeId, "timelineRespecButton", "cancel should restore focus to the trigger");
    await timelineButton.click();
    await confirmationPage.locator("#confirmationConfirmButton").focus();
    await confirmationPage.keyboard.press("Enter");
    const timelineConfirmed = await readConfirmation();
    assert.equal(timelineConfirmed.open, false, "confirmed Timeline Respec should close the dialog");
    assert.equal(timelineConfirmed.timelineNodes, 0, "confirmed Timeline Respec should use the canonical respec action");
    assert.equal(timelineConfirmed.nativeConfirmCalls, 0, "confirmed Timeline Respec must not call native confirm");

    await confirmationPage.evaluate(() => {
      const { switchMainTab } = window.__angleDebug;
      switchMainTab("settings");
      window.advanceTime(0);
    });
    const skipTimelineRespecToggle = confirmationPage.locator("#skipTimelineRespecConfirmationToggle");
    assert.equal(await skipTimelineRespecToggle.isVisible(), true, "Timeline confirmation skip should be exposed in Settings");
    assert.equal(await skipTimelineRespecToggle.isChecked(), false, "Timeline confirmation skip should default off");
    assert.equal(
      (await confirmationPage.locator('label[for="skipTimelineRespecConfirmationToggle"]').textContent())?.trim(),
      "Timelineリスペックの確認をスキップ",
      "Timeline confirmation skip should use the requested Japanese label",
    );
    await skipTimelineRespecToggle.check();
    await confirmationPage.reload({ waitUntil: "networkidle" });
    await confirmationPage.waitForFunction(() => Boolean(window.__angleDebug?.state && window.__angleDebug?.ready));
    await confirmationPage.evaluate(() => window.__angleDebug.ready);
    await confirmationPage.evaluate(() => {
      window.__nativeConfirmCalls = 0;
      window.confirm = () => {
        window.__nativeConfirmCalls += 1;
        return false;
      };
      window.__angleDebug.runtime.closeUpdateModal?.();
      const offlineReport = document.querySelector("#offlineReportPanel");
      if (offlineReport && !offlineReport.hidden) document.querySelector("#offlineReportClose")?.click();
    });
    assert.equal(await skipTimelineRespecToggle.isChecked(), true, "Timeline confirmation skip should survive save/load");
    assert.equal(
      await confirmationPage.evaluate(() => window.__angleDebug.state.skipTimelineRespecConfirmation),
      true,
      "loaded state should keep Timeline confirmation skip enabled",
    );
    await confirmationPage.evaluate(() => {
      const { state, switchMainTab, switchEternitySubtab } = window.__angleDebug;
      state.eternityCount = 1;
      state.scoreTfClaims = 1;
      state.timelinePurchasedNodes = [{ id: "Real-BC16500", costTF: 1 }];
      state.currentEternityRunTime = 12;
      state.currentEternityRealTime = 7;
      switchMainTab("eternity");
      switchEternitySubtab("timeline");
      window.advanceTime(0);
    });
    await timelineButton.click();
    const skippedTimelineRespec = await readConfirmation();
    assert.equal(skippedTimelineRespec.open, false, "enabled Timeline confirmation skip should not open the dialog");
    assert.equal(skippedTimelineRespec.timelineNodes, 0, "enabled Timeline confirmation skip should run respec immediately");
    assert.ok(skippedTimelineRespec.currentEternityRunTime < 0.1, "skipped respec should preserve the canonical Eternity reset");
    assert.ok(skippedTimelineRespec.currentEternityRealTime < 0.1, "skipped respec should preserve the canonical real-time reset");
    assert.equal(skippedTimelineRespec.nativeConfirmCalls, 0, "skipped Timeline respec must not call native confirm");

    await confirmationPage.evaluate(() => {
      const { switchMainTab } = window.__angleDebug;
      switchMainTab("settings");
      window.advanceTime(0);
    });
    await skipTimelineRespecToggle.uncheck();
    await confirmationPage.evaluate(() => {
      const { state, switchMainTab, switchEternitySubtab } = window.__angleDebug;
      state.timelinePurchasedNodes = [{ id: "Real-BC16500", costTF: 1 }];
      state.currentEternityRunTime = 12;
      state.currentEternityRealTime = 7;
      switchMainTab("eternity");
      switchEternitySubtab("timeline");
      window.advanceTime(0);
    });
    await timelineButton.click();
    const restoredTimelineConfirmation = await readConfirmation();
    assert.equal(restoredTimelineConfirmation.open, true, "turning Timeline confirmation skip off should restore the dialog");
    assert.equal(restoredTimelineConfirmation.timelineNodes, 1, "restored confirmation should not respec before confirmation");
    await confirmationPage.locator("#confirmationCancelButton").click();

    await confirmationPage.evaluate(() => {
      const { state, runtime, createCheckpoint, switchMainTab } = window.__angleDebug;
      state.language = "en";
      runtime.appliedLanguage = "";
      state.generationCount = 7;
      if (!createCheckpoint("confirmation-test", { force: true })) throw new Error("failed to create confirmation checkpoint");
      state.generationCount = 9;
      switchMainTab("settings");
      window.advanceTime(0);
      document.querySelector("#saveRecoveryDetails").open = true;
    });
    const checkpointIndex = await confirmationPage.evaluate(() => window.__angleDebug.recoveryEntries().checkpoints
      .findIndex((entry) => entry.reason === "confirmation-test" && entry.state.generationCount === 7));
    assert.notEqual(checkpointIndex, -1, "confirmation checkpoint should be available");
    const checkpointButton = confirmationPage.locator(`#saveCheckpointList button[data-checkpoint-index="${checkpointIndex}"]`);
    await checkpointButton.click();
    const englishCheckpointModal = await readConfirmation();
    assert.deepEqual(
      {
        open: englishCheckpointModal.open,
        title: englishCheckpointModal.title,
        message: englishCheckpointModal.message,
        activeId: englishCheckpointModal.activeId,
        nativeConfirmCalls: englishCheckpointModal.nativeConfirmCalls,
      },
      {
        open: true,
        title: "Confirm",
        message: "Restore this checkpoint? The current state will be kept for undo.",
        activeId: "confirmationCancelButton",
        nativeConfirmCalls: 0,
      },
      "English checkpoint confirmation should expose localized copy and focus",
    );
    await confirmationPage.locator("#confirmationCancelButton").click();
    const checkpointCancelled = await readConfirmation();
    assert.equal(checkpointCancelled.open, false, "checkpoint cancel should close the dialog");
    assert.equal(checkpointCancelled.generationCount, 9, "cancelled checkpoint restore should leave state unchanged");
    await checkpointButton.click();
    await confirmationPage.locator("#confirmationConfirmButton").click();
    const checkpointConfirmed = await readConfirmation();
    assert.equal(checkpointConfirmed.open, false, "confirmed checkpoint restore should close the dialog");
    assert.equal(checkpointConfirmed.generationCount, 7, "confirmed checkpoint restore should use the existing recovery action");
    assert.equal(checkpointConfirmed.nativeConfirmCalls, 0, "checkpoint recovery must not call native confirm");

    await confirmationPage.evaluate(() => {
      const { state, switchMainTab } = window.__angleDebug;
      state.generationCount = 4;
      switchMainTab("settings");
      window.advanceTime(0);
    });
    const resetButton = confirmationPage.locator("#resetSaveButton");
    await resetButton.click();
    const englishResetModal = await readConfirmation();
    assert.equal(englishResetModal.title, "Confirm", "English reset confirmation should localize its title");
    assert.equal(englishResetModal.message, "Reset all saved progress?", "English reset confirmation should preserve its copy");
    assert.equal(englishResetModal.activeId, "confirmationCancelButton", "reset confirmation should focus Cancel");
    await confirmationPage.locator("#confirmationCancelButton").click();
    const resetCancelled = await readConfirmation();
    assert.equal(resetCancelled.generationCount, 4, "cancelled reset should leave state unchanged");
    await resetButton.click();
    await confirmationPage.locator("#confirmationConfirmButton").click();
    const resetConfirmed = await readConfirmation();
    assert.equal(resetConfirmed.generationCount, 0, "confirmed reset should use the canonical reset action");
    assert.equal(resetConfirmed.nativeConfirmCalls, 0, "save reset must not call native confirm");

    await confirmationPage.setViewportSize({ width: 390, height: 844 });
    await resetButton.click();
    const mobileConfirmation = await confirmationPage.evaluate(() => {
      const modal = document.querySelector("#confirmationModal").getBoundingClientRect();
      const buttons = Array.from(document.querySelectorAll(".confirmation-modal-actions button"), (button) => button.getBoundingClientRect());
      const dialog = document.querySelector("#confirmationModal");
      return {
        withinViewport: modal.left >= 0 && modal.right <= innerWidth && modal.top >= 0 && modal.bottom <= innerHeight,
        noHorizontalOverflow: dialog.scrollWidth <= dialog.clientWidth + 1,
        buttonHeights: buttons.map((button) => button.height),
      };
    });
    assert.equal(mobileConfirmation.withinViewport, true, "mobile confirmation should stay within the viewport");
    assert.equal(mobileConfirmation.noHorizontalOverflow, true, "mobile confirmation should avoid horizontal overflow");
    assert.ok(mobileConfirmation.buttonHeights.every((height) => height >= 44), "mobile confirmation buttons should remain touch-safe");
    await confirmationPage.locator("#confirmationCancelButton").click();
  } finally {
    await confirmationContext.close();
  }
  assert.deepEqual(confirmationErrors, [], "confirmation flow should produce no browser errors");
}
