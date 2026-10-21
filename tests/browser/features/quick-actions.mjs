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
  await page.evaluate(({ id, sourceIds }) => {
    const source = document.getElementById(sourceIds[id]);
    const quick = document.querySelector(`[data-quick-action="${id}"]`);
    if (!source || !quick) throw new Error(`missing quick action ${id}`);
    source.disabled = false;
    quick.disabled = false;
    quick.setAttribute("aria-disabled", "false");
    quick.dataset.available = "true";
    quick.classList.remove("is-unavailable");
  }, { id: actionId, sourceIds: SOURCE_IDS });
}

async function setQuickActionAvailability(page, unavailableIds = []) {
  await page.evaluate(({ sourceIds, unavailable }) => {
    for (const [id, sourceId] of Object.entries(sourceIds)) {
      const source = document.getElementById(sourceId);
      const quick = document.querySelector(`[data-quick-action="${id}"]`);
      const disabled = unavailable.includes(id);
      if (!source || !quick) throw new Error(`missing quick action ${id}`);
      source.disabled = disabled;
      quick.disabled = disabled;
      quick.setAttribute("aria-disabled", String(disabled));
      quick.dataset.available = String(!disabled);
      quick.classList.toggle("is-unavailable", disabled);
    }
  }, { sourceIds: SOURCE_IDS, unavailable: unavailableIds });
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
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute("content");
    assert.match(viewportMeta ?? "", /viewport-fit=cover/, "mobile layout should opt into safe-area insets");
    assert.equal(await page.evaluate(() => CSS.supports("padding-top", "max(7px, env(safe-area-inset-top, 0px))")), true);
    const readGeometry = () => page.evaluate(() => {
      const read = (element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      const shell = document.querySelector(".shell");
      const bar = document.getElementById("mobileQuickActions");
      const list = document.getElementById("quickActionList");
      const nav = document.querySelector(".main-tabs");
      const activeTab = nav.querySelector(".main-tab.is-active");
      const panels = document.querySelector(".main-panels");
      const shellStyle = getComputedStyle(shell);
      const barStyle = getComputedStyle(bar);
      const listStyle = getComputedStyle(list);
      const activeTabStyle = activeTab ? getComputedStyle(activeTab) : null;
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight, coarse: matchMedia("(pointer: coarse)").matches },
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        shell: {
          rect: read(shell),
          paddingTop: shellStyle.paddingTop,
          paddingRight: shellStyle.paddingRight,
          paddingBottom: shellStyle.paddingBottom,
          paddingLeft: shellStyle.paddingLeft,
          gridTemplateRows: shellStyle.gridTemplateRows,
          hasQuickActions: shell.classList.contains("has-mobile-quick-actions"),
        },
        bar: {
          rect: read(bar),
          hidden: bar.hidden,
          display: barStyle.display,
          borderTopWidth: barStyle.borderTopWidth,
          backgroundColor: barStyle.backgroundColor,
        },
        list: {
          rect: read(list),
          clientWidth: list.clientWidth,
          scrollWidth: list.scrollWidth,
          scrollLeft: list.scrollLeft,
          overflowX: listStyle.overflowX,
          touchAction: listStyle.touchAction,
        },
        nav: {
          rect: read(nav),
          gridRow: getComputedStyle(nav).gridRowStart,
          activeTab: activeTab ? {
            borderBottomWidth: activeTabStyle.borderBottomWidth,
            borderBottomStyle: activeTabStyle.borderBottomStyle,
          } : null,
        },
        panels: read(panels),
        buttons: Array.from(document.querySelectorAll(".mobile-quick-action"), (button) => {
          const style = getComputedStyle(button);
          return {
            id: button.dataset.quickAction,
            rect: read(button),
            hidden: button.hidden,
            disabled: button.disabled,
            ariaDisabled: button.getAttribute("aria-disabled"),
            selected: button.classList.contains("is-active") || button.hasAttribute("aria-selected"),
            unavailableClass: button.classList.contains("is-unavailable"),
            borderRadius: style.borderRadius,
            borderStyle: style.borderStyle,
            backgroundImage: style.backgroundImage,
            boxShadow: style.boxShadow,
            outlineStyle: style.outlineStyle,
            outlineWidth: style.outlineWidth,
            scrollWidth: button.scrollWidth,
            clientWidth: button.clientWidth,
          };
        }),
      };
    });
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const layout = await readGeometry();
      assert.ok(layout.bar.rect.height > 0, `mobile action row should be visible at ${width}px`);
      assert.ok(layout.bar.rect.bottom <= layout.nav.rect.top + 1, `action row should not overlap bottom tabs at ${width}px`);
      assert.ok(layout.bar.rect.top >= layout.panels.bottom - 1, `action row should follow the main panel at ${width}px`);
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

    const mixedUnavailable = ["generation", "coreBoost", "eternity"];
    const capturePresentation = async (width, height, unavailableIds, screenshotName) => {
      await page.setViewportSize({ width, height });
      await setQuickActionAvailability(page, unavailableIds);
      const layout = await readGeometry();
      assert.equal(layout.bar.hidden, false, `the action bar should be visible at ${width}×${height}`);
      assert.equal(layout.bar.display, "block");
      assert.equal(layout.bar.borderTopWidth, "0px", "quick actions should not remain inside a bordered navigation-like strip");
      assert.equal(layout.bar.backgroundColor, "rgba(0, 0, 0, 0)");
      assert.equal(layout.list.overflowX, "auto");
      assert.equal(layout.list.touchAction, "pan-x");
      assert.equal(layout.buttons.length, 5, "all five canonical actions should remain present");
      assert.deepEqual(layout.buttons.map((button) => button.id), ["buyAll", "generation", "coreBoost", "infinity", "eternity"]);
      assert.equal(layout.buttons[0].borderRadius, "999px", "MAX purchases should use a distinct pill shape");
      assert.equal(layout.buttons[1].borderRadius, "50%", "reset actions should be circular");
      assert.ok(layout.bar.rect.bottom <= layout.nav.rect.top + 1, `action row should not overlap navigation at ${width}×${height}`);
      assert.ok(layout.bar.rect.top >= layout.panels.bottom - 1, `action row should follow gameplay at ${width}×${height}`);
      assert.ok(layout.documentWidth <= width && layout.bodyWidth <= width, `the document should not overflow at ${width}px`);
      assert.ok(Number.parseFloat(layout.shell.paddingTop) >= 7, "the shell should retain top safe-area padding");
      assert.ok(Number.parseFloat(layout.shell.paddingBottom) >= 7, "the shell should retain bottom safe-area padding");
      assert.equal(layout.nav.activeTab.borderBottomWidth, "2px", "navigation should retain its separate active underline");
      for (const button of layout.buttons) {
        const unavailable = unavailableIds.includes(button.id);
        assert.equal(button.hidden, false, `${button.id} should remain visible`);
        assert.ok(button.rect.width >= 44 && button.rect.height >= 44, `${button.id} should remain a 44px+ target`);
        assert.equal(button.disabled, unavailable, `${button.id} should mirror the availability fixture`);
        assert.equal(button.ariaDisabled, String(unavailable), `${button.id} should expose availability accessibly`);
        assert.equal(button.selected, false, `${button.id} must not look or act like a selected navigation tab`);
        assert.ok(button.rect.right > layout.list.rect.left && button.rect.left < layout.list.rect.right, `${button.id} should be at least partly visible or reachable in the scroll tray at ${width}px`);
        if (unavailable) {
          assert.equal(button.borderStyle, "dashed", `${button.id} should have a non-color disabled cue`);
          assert.match(button.backgroundImage, /repeating-linear-gradient/, `${button.id} should use a non-color unavailable pattern`);
          assert.equal(button.unavailableClass, true);
        } else {
          assert.equal(button.borderStyle, "solid", `${button.id} should have a clear enabled outline`);
          assert.notEqual(button.boxShadow, "none", `${button.id} should retain a raised surface`);
          assert.equal(button.unavailableClass, false);
        }
      }
      if (screenshotName) {
        await mkdir(path.join(root, "output"), { recursive: true });
        await page.screenshot({ path: path.join(root, "output", `issue-481-after-${screenshotName}.png`) });
      }
      return layout;
    };

    await capturePresentation(390, 844, [], "390-all-available");
    await capturePresentation(390, 844, mixedUnavailable, "390-mixed");
    const narrowMixed = await capturePresentation(320, 844, mixedUnavailable, "320-mixed");
    await page.evaluate(() => { document.documentElement.style.fontSize = "150%"; });
    const scaledMixed = await capturePresentation(320, 844, mixedUnavailable, "320-text150-mixed");
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), "24px", "text scaling fixture should enlarge root text to 150%");
    for (const button of scaledMixed.buttons) {
      assert.ok(button.scrollWidth <= button.clientWidth + 1, `${button.id} label should fit without clipping under text scaling`);
    }
    assert.ok(narrowMixed.buttons.every((button) => button.rect.height >= 52), "the 320px layout should preserve 52px targets");
    await page.evaluate(() => { document.documentElement.style.fontSize = ""; });

    await setQuickActionAvailability(page, []);
    await page.locator("#quickActionBuyAll").focus();
    await page.keyboard.press("Tab");
    const focusedAction = await page.evaluate(() => {
      const button = document.activeElement;
      const list = document.getElementById("quickActionList");
      const rect = button.getBoundingClientRect();
      const bounds = list.getBoundingClientRect();
      const style = getComputedStyle(button);
      const outline = Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
      return {
        id: button.id,
        focusVisible: button.matches(":focus-visible"),
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        ringWithinList: rect.left - outline >= bounds.left - 1 && rect.right + outline <= bounds.right + 1
          && rect.top - outline >= bounds.top - 1 && rect.bottom + outline <= bounds.bottom + 1,
      };
    });
    assert.equal(focusedAction.id, "quickActionGeneration");
    assert.equal(focusedAction.focusVisible, true, "keyboard focus should use a visible focus ring");
    assert.equal(focusedAction.outlineStyle, "solid");
    assert.equal(focusedAction.outlineWidth, "2px");
    assert.equal(focusedAction.ringWithinList, true, "focus ring should not be clipped by the horizontal scroller");

    const pressedButton = page.locator("#quickActionBuyAll");
    const pressedBox = await pressedButton.boundingBox();
    assert.ok(pressedBox, "MAX should keep a measurable press target");
    await page.mouse.move(pressedBox.x + pressedBox.width / 2, pressedBox.y + pressedBox.height / 2);
    await page.mouse.down();
    const pressedTransform = await pressedButton.evaluate((button) => getComputedStyle(button).transform);
    assert.notEqual(pressedTransform, "none", "a held quick action should have tactile pressed feedback");
    await page.mouse.up();
    await resetSpy(page);

    await page.setViewportSize({ width: 844, height: 390 });
    const landscapeMixed = await capturePresentation(844, 390, mixedUnavailable, "844x390-landscape-mixed");
    assert.equal(landscapeMixed.viewport.coarse, true, "the landscape fixture should be a coarse-pointer touch device");
    assert.equal(landscapeMixed.nav.gridRow, "4", "touch landscape should keep quick actions above navigation");
    await page.evaluate(() => window.__angleDebug.applySetting("showMobileQuickActions", false));
    await page.waitForFunction(() => document.getElementById("mobileQuickActions").hidden);
    const hiddenLandscape = await readGeometry();
    assert.equal(hiddenLandscape.bar.display, "none", "the saved setting must hide the touch-landscape row");
    assert.equal(hiddenLandscape.shell.hasQuickActions, false);
    assert.equal(hiddenLandscape.nav.gridRow, "3", "hidden settings should restore the unshifted landscape navigation row");
    assert.ok(hiddenLandscape.panels.bottom <= hiddenLandscape.nav.rect.top + 1, "hidden landscape controls should not overlap the main panel");
    await page.evaluate(() => window.__angleDebug.applySetting("showMobileQuickActions", true));
    await page.waitForFunction(() => !document.getElementById("mobileQuickActions").hidden);

    const desktopLandscapeHandle = await openGamePage(browser, origin, {
      viewport: { width: 844, height: 390 },
      stubFonts: true,
      freezeAnimationFrame: true,
    });
    trackPage(desktopLandscapeHandle.page, "quick-actions-landscape-desktop", errors, httpFailures);
    try {
      const desktopLandscape = await desktopLandscapeHandle.page.evaluate(() => ({
        coarse: matchMedia("(pointer: coarse)").matches,
        barDisplay: getComputedStyle(document.getElementById("mobileQuickActions")).display,
        navigationRow: getComputedStyle(document.querySelector(".main-tabs")).gridRowStart,
        navigationTop: document.querySelector(".main-tabs").getBoundingClientRect().top,
        panelBottom: document.querySelector(".main-panels").getBoundingClientRect().bottom,
        documentWidth: document.documentElement.scrollWidth,
      }));
      assert.equal(desktopLandscape.coarse, false);
      assert.equal(desktopLandscape.barDisplay, "none", "a mouse desktop at the same size must not gain the mobile action row");
      assert.equal(desktopLandscape.navigationRow, "3", "desktop navigation should stay in its original grid row");
      assert.ok(desktopLandscape.panelBottom <= desktopLandscape.navigationTop + 1, "desktop gameplay should remain above its unchanged navigation row");
      assert.ok(desktopLandscape.documentWidth <= 844);
    } finally {
      await desktopLandscapeHandle.context.close();
    }

    await page.setViewportSize({ width: 280, height: 844 });
    await setQuickActionAvailability(page, mixedUnavailable);
    const scrollStart = await page.evaluate(() => {
      const list = document.getElementById("quickActionList");
      const buttons = [...document.querySelectorAll(".mobile-quick-action")];
      list.scrollLeft = 0;
      const listRect = list.getBoundingClientRect();
      const gutterX = listRect.left + 18;
      const gutterY = buttons[0].getBoundingClientRect().top + buttons[0].getBoundingClientRect().height / 2;
      return {
        scrollLeft: list.scrollLeft,
        scrollWidth: list.scrollWidth,
        clientWidth: list.clientWidth,
        first: buttons[0].getBoundingClientRect().toJSON(),
        last: buttons[4].getBoundingClientRect().toJSON(),
        list: listRect.toJSON(),
        gutter: { x: gutterX, y: gutterY, targetId: document.elementFromPoint(gutterX, gutterY)?.id ?? "" },
      };
    });
    assert.ok(scrollStart.scrollWidth > scrollStart.clientWidth, "the 280px touch tray should expose horizontal overflow");
    assert.ok(scrollStart.first.left >= scrollStart.list.left && scrollStart.first.right <= scrollStart.list.right);
    assert.equal(scrollStart.gutter.targetId, "quickActionList", "the scroll gutter must not hit a gameplay button");
    const scrollEnd = await page.evaluate(() => {
      const list = document.getElementById("quickActionList");
      const last = document.querySelector("[data-quick-action=eternity]");
      list.scrollLeft = list.scrollWidth;
      const listRect = list.getBoundingClientRect();
      const lastRect = last.getBoundingClientRect();
      return { scrollLeft: list.scrollLeft, list: listRect.toJSON(), last: lastRect.toJSON() };
    });
    assert.ok(scrollEnd.scrollLeft > 0, "the horizontal action tray should be able to reach its far end");
    assert.ok(scrollEnd.last.left >= scrollEnd.list.left && scrollEnd.last.right <= scrollEnd.list.right, "the last target should be fully reachable after scrolling");
    await page.evaluate(() => { document.getElementById("quickActionList").scrollLeft = 0; });
    await resetSpy(page);
    const touchSession = await context.newCDPSession(page);
    try {
      await touchSession.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ id: 1, x: scrollStart.gutter.x, y: scrollStart.gutter.y, radiusX: 2, radiusY: 2, force: 1 }],
      });
      await page.waitForTimeout(40);
      await touchSession.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ id: 1, x: scrollStart.gutter.x - 60, y: scrollStart.gutter.y, radiusX: 2, radiusY: 2, force: 1 }],
      });
      await touchSession.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(60);
    } finally {
      await touchSession.detach();
    }
    const touchPan = await page.evaluate(() => ({
      scrollLeft: document.getElementById("quickActionList").scrollLeft,
      calls: Object.values(window.__quickActionSpy.calls).reduce((total, values) => total + values.length, 0),
    }));
    assert.ok(touchPan.scrollLeft > 10, "a real horizontal touch drag should pan the tray");
    assert.equal(touchPan.calls, 0, "a touch drag through the scroll gutter must not activate a quick action");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.getElementById("quickActionList").scrollLeft = 0; });
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
    const reentryButton = page.locator("#quickActionBuyAll");
    const reentryBox = await reentryButton.boundingBox();
    assert.ok(reentryBox, "MAX action should have a hit target for the leave/re-entry regression");
    await page.evaluate(() => {
      const quick = document.getElementById("quickActionBuyAll");
      window.__quickActionGeneratedClicks = [];
      window.__quickActionReentryListener = (event) => {
        window.__quickActionGeneratedClicks.push({ isTrusted: event.isTrusted, detail: event.detail });
      };
      quick.addEventListener("click", window.__quickActionReentryListener, true);
    });
    const reentryX = reentryBox.x + reentryBox.width / 2;
    const reentryY = reentryBox.y + reentryBox.height / 2;
    await page.mouse.move(reentryX, reentryY);
    await page.mouse.down();
    await page.waitForTimeout(60);
    assert.equal((await readSpy(page)).calls.buyAll.length, 1, "pointerdown should make the immediate canonical attempt");
    await page.mouse.move(reentryBox.x + reentryBox.width + 80, reentryY);
    await page.waitForTimeout(80);
    assert.equal((await readSpy(page)).calls.buyAll.length, 1, "moving out should cancel the repeat session after the zero-delay suppression timer expires");
    await page.mouse.move(reentryX, reentryY);
    await page.waitForTimeout(30);
    await page.mouse.up();
    await page.waitForTimeout(100);
    const reentryResult = await page.evaluate(() => {
      const quick = document.getElementById("quickActionBuyAll");
      quick.removeEventListener("click", window.__quickActionReentryListener, true);
      return window.__quickActionGeneratedClicks;
    });
    assert.deepEqual(reentryResult, [{ isTrusted: true, detail: 1 }], "re-entering and releasing should produce one trusted native pointer click");
    assert.equal((await readSpy(page)).calls.buyAll.length, 1, "re-entering and releasing after the suppression timer should not dispatch a second canonical action");

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
