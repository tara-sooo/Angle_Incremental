import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { openGamePage, root, trackPage } from "../../browser-harness.mjs";

const SOURCE_IDS = {
  buyAll: "buyAllUpgrade",
  generation: "generationButton",
  coreBoost: "coreBoostButton",
  infinity: "infinityButton",
  eternity: "eternityPerformButton",
};

async function installSpy(page) {
  return page.evaluate((sourceIds) => {
    const calls = {};
    const events = {};
    for (const [id, sourceId] of Object.entries(sourceIds)) {
      const source = document.getElementById(sourceId);
      if (!source) throw new Error(`canonical action source not found: ${sourceId}`);
      calls[id] = [];
      events[id] = [];
      const originalClick = source.click.bind(source);
      source.click = function (...args) {
        window.__quickActionSpy.calls[id].push(performance.now());
        return originalClick(...args);
      };
      source.addEventListener("click", () => {
        window.__quickActionSpy.events[id].push(performance.now());
      }, true);
    }
    window.__quickActionSpy = { calls, events };
    return Object.fromEntries(Object.entries(sourceIds).map(([id, sourceId]) => [
      id,
      document.getElementById(sourceId).disabled,
    ]));
  }, SOURCE_IDS);
}

async function resetSpy(page) {
  await page.evaluate(() => {
    for (const entries of [window.__quickActionSpy.calls, window.__quickActionSpy.events]) {
      for (const values of Object.values(entries)) values.length = 0;
    }
  });
}

async function readSpy(page) {
  return page.evaluate(() => JSON.parse(JSON.stringify(window.__quickActionSpy)));
}

async function prepareQuickAction(page, actionId = "buyAll") {
  await page.evaluate((id) => {
    const sourceIds = {
      buyAll: "buyAllUpgrade",
      generation: "generationButton",
      coreBoost: "coreBoostButton",
      infinity: "infinityButton",
      eternity: "eternityPerformButton",
    };
    const source = document.getElementById(sourceIds[id]);
    const quick = document.querySelector(`[data-quick-action="${id}"]`);
    if (!source || !quick) throw new Error(`missing quick action ${id}`);
    source.disabled = false;
    quick.disabled = false;
    quick.setAttribute("aria-disabled", "false");
    quick.dataset.available = "true";
  }, actionId);
}

async function startSyntheticPointer(page, pointerId = 47, actionId = "buyAll") {
  await page.evaluate(({ id, action }) => {
    const button = document.querySelector(`[data-quick-action="${action}"]`);
    const rect = button.getBoundingClientRect();
    button.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerId: id,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }));
  }, { id: pointerId, action: actionId });
}

async function assertKeyboardCancelled(page, trigger, cleanup = async () => {}) {
  await resetSpy(page);
  await page.keyboard.down("m");
  await page.waitForTimeout(80);
  await trigger();
  await page.waitForTimeout(520);
  const stopped = await readSpy(page);
  assert.equal(stopped.calls.buyAll.length, 1, "blocking/lifecycle event should cancel a hold permanently");
  await cleanup();
  await page.keyboard.up("m");
}

async function testDesktop({ browser, origin, errors, httpFailures }) {
  const handle = await openGamePage(browser, origin, {
    viewport: { width: 1280, height: 900 },
    stubFonts: true,
    freezeAnimationFrame: true,
  });
  const { context, page } = handle;
  trackPage(page, "quick-actions-desktop", errors, httpFailures);
  try {
    const disabled = await installSpy(page);
    assert.deepEqual(Object.values(disabled), [true, true, true, true, true], "fresh-save canonical progression controls should be unavailable");
    const mirrored = await page.evaluate(() => [
      ["buyAll", "buyAllUpgrade"],
      ["generation", "generationButton"],
      ["coreBoost", "coreBoostButton"],
      ["infinity", "infinityButton"],
      ["eternity", "eternityPerformButton"],
    ].map(([id, sourceId]) => {
      const quick = document.querySelector(`[data-quick-action="${id}"]`);
      const source = document.getElementById(sourceId);
      return { id, quickDisabled: quick.disabled, ariaDisabled: quick.getAttribute("aria-disabled"), sourceDisabled: source.disabled, hidden: quick.hidden };
    }));
    for (const row of mirrored) {
      assert.equal(row.quickDisabled, row.sourceDisabled, `${row.id} quick action should mirror its canonical disabled state`);
      assert.equal(row.ariaDisabled, String(row.sourceDisabled), `${row.id} should expose availability accessibly`);
      assert.equal(row.hidden, false, `${row.id} action should exist on a fresh save`);
    }

    const beforeState = await page.evaluate(() => {
      const s = window.__angleDebug.state;
      return [s.generationCount, s.coreBoostCount, String(s.infinityCountExact), String(s.eternityCountExact)];
    });
    const keys = ["m", "g", "b", "i", "e"];
    const tabs = ["angle", "settings", "help", "statistics", "challenges"];
    const ids = ["buyAll", "generation", "coreBoost", "infinity", "eternity"];
    for (let index = 0; index < keys.length; index += 1) {
      await page.evaluate((tab) => window.__angleDebug.switchMainTab(tab), tabs[index]);
      await page.keyboard.press(keys[index]);
    }
    const mapped = await readSpy(page);
    for (const id of ids) assert.equal(mapped.calls[id].length, 1, `${id} shortcut should call only its canonical button from any selected tab`);
    const afterState = await page.evaluate(() => {
      const s = window.__angleDebug.state;
      return [s.generationCount, s.coreBoostCount, String(s.infinityCountExact), String(s.eternityCountExact)];
    });
    assert.deepEqual(afterState, beforeState, "disabled canonical actions must remain no-ops for hotkeys");

    await resetSpy(page);
    await page.keyboard.press("Control+g");
    await page.keyboard.press("Alt+i");
    await page.keyboard.press("Shift+m");
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "g", bubbles: true, cancelable: true, isComposing: true, keyCode: 229 }));
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "g", bubbles: true }));
    });
    const inputSuppression = await page.evaluate(async () => {
      const input = document.createElement("input");
      input.id = "quick-action-editable-test";
      document.body.append(input);
      input.focus();
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "g", bubbles: true, cancelable: true }));
      input.dispatchEvent(new KeyboardEvent("keyup", { key: "g", bubbles: true }));
      const value = input.value;
      input.remove();
      return value;
    });
    assert.equal(inputSuppression, "", "synthetic editable keydown should not be typed or trigger a shortcut");
    assert.equal((await readSpy(page)).calls.buyAll.length, 0, "modifiers, IME, and editable targets should suppress hotkeys");

    await resetSpy(page);
    await page.evaluate(() => {
      const doc = document;
      const root = document.documentElement;
      window.__quickFullscreenOriginal = {
        request: root.requestFullscreen,
        exit: doc.exitFullscreen,
        descriptor: Object.getOwnPropertyDescriptor(doc, "fullscreenElement"),
      };
      window.__quickFullscreenCalls = { request: 0, exit: 0 };
      Object.defineProperty(doc, "fullscreenElement", { configurable: true, get: () => null });
      Object.defineProperty(root, "requestFullscreen", {
        configurable: true,
        value: () => { window.__quickFullscreenCalls.request += 1; return Promise.resolve(); },
      });
      doc.exitFullscreen = () => { window.__quickFullscreenCalls.exit += 1; return Promise.resolve(); };
    });
    await page.keyboard.press("f");
    let fullscreen = await page.evaluate(() => ({ ...window.__quickFullscreenCalls }));
    assert.equal(fullscreen.request, 1, "F should keep requesting fullscreen");
    assert.equal((await readSpy(page)).calls.buyAll.length, 0, "F should not dispatch a progression shortcut");
    await page.evaluate(() => {
      Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => document.documentElement });
    });
    await page.keyboard.press("f");
    fullscreen = await page.evaluate(() => ({ ...window.__quickFullscreenCalls }));
    assert.equal(fullscreen.exit, 1, "F should keep exiting fullscreen");
    await page.evaluate(() => {
      const original = window.__quickFullscreenOriginal;
      if (original.descriptor) Object.defineProperty(document, "fullscreenElement", original.descriptor);
      else delete document.fullscreenElement;
      Object.defineProperty(document.documentElement, "requestFullscreen", { configurable: true, value: original.request });
      document.exitFullscreen = original.exit;
    });

    await resetSpy(page);
    await page.keyboard.down("m");
    await page.waitForTimeout(250);
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "m", repeat: true, bubbles: true, cancelable: true })));
    assert.equal((await readSpy(page)).calls.buyAll.length, 1, "repeat keydown events must not bypass the initial repeat delay");
    await page.waitForTimeout(230);
    const firstRepeats = await readSpy(page);
    assert.equal(firstRepeats.calls.buyAll.length, 2, "first held repeat should occur at the 400 ms delay");
    await page.waitForTimeout(210);
    const cadence = await readSpy(page);
    assert.equal(cadence.calls.buyAll.length, 3, "held actions should repeat at the fixed cadence");
    const firstDelay = cadence.calls.buyAll[1] - cadence.calls.buyAll[0];
    const cadenceGap = cadence.calls.buyAll[2] - cadence.calls.buyAll[1];
    assert.ok(firstDelay >= 350 && firstDelay <= 520, `initial repeat delay should be about 400 ms (got ${firstDelay})`);
    assert.ok(cadenceGap >= 150 && cadenceGap <= 300, `repeat cadence should be about 200 ms (got ${cadenceGap})`);
    await page.keyboard.up("m");
    await page.waitForTimeout(260);
    assert.equal((await readSpy(page)).calls.buyAll.length, 3, "keyup should stop repeats immediately");

    await resetSpy(page);
    await page.evaluate(() => { document.getElementById("buyAllUpgrade").disabled = true; });
    await page.keyboard.down("m");
    await page.waitForTimeout(250);
    assert.equal((await readSpy(page)).events.buyAll.length, 0, "a disabled canonical action should be a no-op");
    await page.evaluate(() => { document.getElementById("buyAllUpgrade").disabled = false; });
    await page.waitForTimeout(250);
    assert.equal((await readSpy(page)).events.buyAll.length, 1, "a held shortcut should execute once at the first legal cadence");
    await page.keyboard.up("m");
    await page.waitForTimeout(230);
    assert.equal((await readSpy(page)).events.buyAll.length, 1, "release after the first legal cadence should prevent another attempt");

    await assertKeyboardCancelled(page, async () => {
      await page.evaluate(() => document.getElementById("confirmationModal").showModal());
    }, async () => {
      await page.evaluate(() => document.getElementById("confirmationModal").close());
    });
    await assertKeyboardCancelled(page, async () => {
      await page.evaluate(() => { document.getElementById("updateModal").hidden = false; });
    }, async () => {
      await page.evaluate(() => { document.getElementById("updateModal").hidden = true; });
    });
    await assertKeyboardCancelled(page, async () => {
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    });
    await assertKeyboardCancelled(page, async () => {
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    });
    await assertKeyboardCancelled(page, async () => {
      await page.evaluate(() => window.__angleDebug.applySetting("gameplayHotkeysEnabled", false));
    }, async () => {
      await page.evaluate(() => window.__angleDebug.applySetting("gameplayHotkeysEnabled", true));
    });
    await assertKeyboardCancelled(page, async () => {
      await page.evaluate(() => { window.__angleDebug.runtime.offlineProcessing = true; });
    }, async () => {
      await page.evaluate(() => { window.__angleDebug.runtime.offlineProcessing = false; });
    });
    await assertKeyboardCancelled(page, async () => {
      await page.evaluate(() => {
        window.__quickHiddenDescriptor = Object.getOwnPropertyDescriptor(document, "hidden");
        Object.defineProperty(document, "hidden", { configurable: true, value: true });
        document.dispatchEvent(new Event("visibilitychange"));
      });
    }, async () => {
      await page.evaluate(() => {
        if (window.__quickHiddenDescriptor) Object.defineProperty(document, "hidden", window.__quickHiddenDescriptor);
        else delete document.hidden;
      });
    });

    await page.evaluate(() => {
      window.__angleDebug.switchMainTab("help");
      window.__angleDebug.runtime.updateUi();
    });
    await page.locator('#helpNav [data-help-topic="quick-actions"]').click();
    let help = await page.locator("#helpArticle").innerText();
    assert.match(help, /M \/ MAX/);
    assert.match(help, /Fは従来どおり全画面表示/);
    await page.evaluate(() => {
      window.__angleDebug.applySetting("language", "en");
      window.__angleDebug.switchMainTab("help");
      window.__angleDebug.runtime.updateUi();
    });
    await page.locator('#helpNav [data-help-topic="quick-actions"]').click();
    help = await page.locator("#helpArticle").innerText();
    assert.match(help, /M \/ MAX: Buy All/);
    assert.match(help, /F still controls fullscreen/);

    await page.evaluate(() => window.__angleDebug.switchMainTab("settings"));
    await page.locator("#gameplayHotkeysToggle").uncheck();
    await page.locator("#mobileQuickActionsToggle").uncheck();
    const persistedFalse = await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem("angle-incremental-save") || "null");
      return {
        state: [window.__angleDebug.state.gameplayHotkeysEnabled, window.__angleDebug.state.showMobileQuickActions],
        save: [save?.state?.gameplayHotkeysEnabled, save?.state?.showMobileQuickActions],
        serialized: [window.__angleDebug.runtime.serializeSaveData().state.gameplayHotkeysEnabled, window.__angleDebug.runtime.serializeSaveData().state.showMobileQuickActions],
        hidden: document.getElementById("mobileQuickActions").hidden,
      };
    });
    assert.deepEqual(persistedFalse.state, [false, false]);
    assert.deepEqual(persistedFalse.save, [false, false], "both disabled preferences should be serialized");
    assert.deepEqual(persistedFalse.serialized, [false, false], "save serialization should include both disabled preferences");
    assert.equal(persistedFalse.hidden, true, "hiding the mobile bar setting should hide it immediately");
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.__angleDebug?.state && window.__angleDebug?.ready));
    await page.evaluate(() => window.__angleDebug.ready);
    assert.deepEqual(await page.evaluate(() => [window.__angleDebug.state.gameplayHotkeysEnabled, window.__angleDebug.state.showMobileQuickActions]), [false, false], "false settings should survive reload");
    await installSpy(page);
    await page.keyboard.press("m");
    assert.equal((await readSpy(page)).calls.buyAll.length, 0, "disabled gameplay hotkeys should stay disabled after reload");

    await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem("angle-incremental-save") || "null");
      delete save.state.gameplayHotkeysEnabled;
      delete save.state.showMobileQuickActions;
      localStorage.setItem("angle-incremental-save", JSON.stringify(save));
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.__angleDebug?.state && window.__angleDebug?.ready));
    await page.evaluate(() => window.__angleDebug.ready);
    assert.deepEqual(await page.evaluate(() => [window.__angleDebug.state.gameplayHotkeysEnabled, window.__angleDebug.state.showMobileQuickActions]), [true, true], "legacy saves missing both keys should default them to enabled");
    assert.equal(await page.locator("#mobileQuickActions").evaluate((node) => node.hidden), false, "legacy saves should show the mobile action bar");
  } finally {
    await context.close();
  }
}

async function testMobile({ browser, origin, errors, httpFailures }) {
  const handle = await openGamePage(browser, origin, {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    stubFonts: true,
    freezeAnimationFrame: true,
  });
  const { context, page } = handle;
  trackPage(page, "quick-actions-mobile", errors, httpFailures);
  try {
    await installSpy(page);
    const readGeometry = () => page.evaluate(() => {
      const read = (element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      const bar = document.getElementById("mobileQuickActions");
      const nav = document.querySelector(".main-tabs");
      const panels = document.querySelector(".main-panels");
      return {
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        bar: read(bar),
        nav: read(nav),
        panels: read(panels),
        buttons: Array.from(document.querySelectorAll(".mobile-quick-action"), (button) => ({
          rect: read(button), hidden: button.hidden, disabled: button.disabled,
        })),
      };
    });
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const layout = await readGeometry();
      assert.ok(layout.bar.height > 0, `mobile action row should be visible at ${width}px`);
      assert.ok(layout.bar.bottom <= layout.nav.top + 1, `action row should not overlap bottom tabs at ${width}px`);
      assert.ok(layout.bar.top >= layout.panels.bottom - 1, `action row should follow the main panel at ${width}px`);
      assert.ok(layout.documentWidth <= width, `document should not overflow horizontally at ${width}px`);
      assert.ok(layout.bodyWidth <= width, `body should not overflow horizontally at ${width}px`);
      assert.equal(layout.buttons.length, 5, "all five mobile actions should be present");
      for (const button of layout.buttons) {
        assert.equal(button.hidden, false, "all unlocked quick actions should be visible");
        assert.ok(button.rect.width >= 44 && button.rect.height >= 44, "quick-action touch targets should be at least 44×44 px");
      }
      await mkdir(path.join(root, "output"), { recursive: true });
      await page.screenshot({ path: path.join(root, "output", `issue-473-quick-actions-${width}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const availability = await page.evaluate(() => [
      ["buyAll", "buyAllUpgrade"],
      ["generation", "generationButton"],
      ["coreBoost", "coreBoostButton"],
      ["infinity", "infinityButton"],
      ["eternity", "eternityPerformButton"],
    ].map(([id, sourceId]) => {
      const quick = document.querySelector(`[data-quick-action="${id}"]`);
      const source = document.getElementById(sourceId);
      return { id, quickDisabled: quick.disabled, sourceDisabled: source.disabled, ariaDisabled: quick.getAttribute("aria-disabled") };
    }));
    for (const row of availability) {
      assert.equal(row.quickDisabled, row.sourceDisabled, `${row.id} bar control should mirror canonical availability`);
      assert.equal(row.ariaDisabled, String(row.sourceDisabled));
    }

    await resetSpy(page);
    await prepareQuickAction(page);
    await page.locator("#quickActionBuyAll").focus();
    await page.keyboard.press("Space");
    assert.equal((await readSpy(page)).calls.buyAll.length, 1, "keyboard/assistive click should activate the canonical button once");

    await resetSpy(page);
    await prepareQuickAction(page);
    await page.locator("#quickActionBuyAll").click();
    await page.waitForTimeout(460);
    assert.equal((await readSpy(page)).calls.buyAll.length, 1, "a short tap should make exactly one attempt, with no generated-click duplicate");

    await resetSpy(page);
    await prepareQuickAction(page);
    await startSyntheticPointer(page, 62);
    await page.evaluate(() => {
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 62, pointerType: "touch", button: 0 }));
      const quick = document.getElementById("quickActionBuyAll");
      quick.disabled = false;
      quick.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, detail: 0 }));
    });
    assert.equal((await readSpy(page)).calls.buyAll.length, 2, "an assistive click should not be swallowed by pointer duplicate suppression");

    await resetSpy(page);
    await prepareQuickAction(page);
    const button = page.locator("#quickActionBuyAll");
    const box = await button.boundingBox();
    assert.ok(box, "MAX action should have a hit target");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(720);
    const held = await readSpy(page);
    assert.ok(held.calls.buyAll.length >= 3, "holding MAX should repeat after the initial delay and cadence");
    await page.mouse.up();
    await page.waitForTimeout(250);
    assert.equal((await readSpy(page)).calls.buyAll.length, held.calls.buyAll.length, "release should stop repeats without an extra click");

    await resetSpy(page);
    await prepareQuickAction(page);
    await startSyntheticPointer(page, 60);
    await page.waitForTimeout(720);
    const touchHeld = await readSpy(page);
    assert.ok(touchHeld.calls.buyAll.length >= 3, "holding the mobile MAX touch pointer should repeat at the expected cadence");
    await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 60, pointerType: "touch", button: 0 })));
    await page.waitForTimeout(250);
    assert.equal((await readSpy(page)).calls.buyAll.length, touchHeld.calls.buyAll.length, "releasing a touch hold should stop repeats");

    const pointerCancellations = [
      ["pointerup cancellation", async () => page.evaluate(() => {
        window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 47, pointerType: "touch", button: 0 }));
      })],
      ["pointercancel", async () => page.evaluate(() => {
        window.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 48, pointerType: "touch", button: 0 }));
      })],
      ["lost pointer capture", async () => page.evaluate(() => {
        document.getElementById("quickActionBuyAll").dispatchEvent(new PointerEvent("lostpointercapture", { bubbles: true, pointerId: 49, pointerType: "touch" }));
      })],
      ["pointer leave", async () => page.evaluate(() => {
        document.getElementById("quickActionBuyAll").dispatchEvent(new PointerEvent("pointerleave", { bubbles: false, pointerId: 50, pointerType: "touch" }));
      })],
      ["outside pointer movement", async () => page.evaluate(() => {
        window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 51, pointerType: "touch", clientX: 0, clientY: 0 }));
      })],
    ];
    for (const [label, cancel] of pointerCancellations) {
      await resetSpy(page);
      await prepareQuickAction(page);
      const pointerId = label === "pointerup cancellation" ? 47
        : label === "pointercancel" ? 48
          : label === "lost pointer capture" ? 49
            : label === "pointer leave" ? 50 : 51;
      await startSyntheticPointer(page, pointerId);
      await page.waitForTimeout(70);
      await cancel();
      await page.waitForTimeout(500);
      assert.equal((await readSpy(page)).calls.buyAll.length, 1, `${label} should stop a hold before the next repeat`);
    }

    await resetSpy(page);
    await prepareQuickAction(page);
    await startSyntheticPointer(page, 52);
    await page.waitForTimeout(60);
    await page.evaluate(() => window.__angleDebug.applySetting("showMobileQuickActions", false));
    await page.waitForTimeout(500);
    assert.equal((await readSpy(page)).calls.buyAll.length, 1, "disabling the mobile bar should cancel the active hold permanently");
  } finally {
    await context.close();
  }
}

export async function runQuickActions({ browser, origin, errors, httpFailures }) {
  await testDesktop({ browser, origin, errors, httpFailures });
  await testMobile({ browser, origin, errors, httpFailures });
}
