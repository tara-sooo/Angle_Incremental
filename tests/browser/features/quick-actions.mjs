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

// Captured with the pre-#481 next stylesheet at the same coarse-pointer viewports.
const PRE_ISSUE_481_BASELINE_SHA = "5a58c1af4a4ea8ff59160bdb5eb8610393b183bb";
const PRE_ISSUE_481_CANVAS = {
  "320x844": { width: 294, height: 217.5 },
  "390x844": { width: 364, height: 270 },
  "844x390": { width: 506, height: 240 },
  "1023x480": { width: 685, height: 240 },
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
      const panel = document.querySelector(".main-panel.is-active");
      const field = document.querySelector(".angle-panel .playfield-wrap.ui-playfield");
      const canvas = document.getElementById("gameCanvas");
      const generationButton = document.getElementById("generationButton");
      const coreBoostButton = document.getElementById("coreBoostButton");
      const toast = document.querySelector(".achievement-toasts");
      const shellStyle = getComputedStyle(shell);
      const barStyle = getComputedStyle(bar);
      const listStyle = getComputedStyle(list);
      const canvasStyle = getComputedStyle(canvas);
      const activeTabStyle = activeTab ? getComputedStyle(activeTab) : null;
      const toastStyle = getComputedStyle(toast);
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight, scale: window.visualViewport?.scale ?? 1, coarse: matchMedia("(pointer: coarse)").matches },
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
          position: barStyle.position,
          pointerEvents: barStyle.pointerEvents,
          borderTopWidth: barStyle.borderTopWidth,
          backgroundColor: barStyle.backgroundColor,
          boxShadow: barStyle.boxShadow,
        },
        list: {
          rect: read(list),
          clientWidth: list.clientWidth,
          scrollWidth: list.scrollWidth,
          scrollLeft: list.scrollLeft,
          overflowX: listStyle.overflowX,
          pointerEvents: listStyle.pointerEvents,
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
        gameArea: {
          panel: read(panel),
          scrollTop: panel.scrollTop,
          scrollHeight: panel.scrollHeight,
          clientHeight: panel.clientHeight,
          overflowY: getComputedStyle(panel).overflowY,
          playfield: read(field),
          canvas: {
            rect: read(canvas),
            cssWidth: canvasStyle.width,
            cssHeight: canvasStyle.height,
            clientWidth: canvas.clientWidth,
            clientHeight: canvas.clientHeight,
            drawingWidth: canvas.width,
            drawingHeight: canvas.height,
          },
          generationButton: read(generationButton),
          coreBoostButton: read(coreBoostButton),
        },
        fixedToast: {
          visible: toastStyle.display !== "none" && !toast.hidden && read(toast).width > 0 && read(toast).height > 0,
          rect: read(toast),
        },
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
            pointerEvents: style.pointerEvents,
            borderRadius: style.borderRadius,
            borderStyle: style.borderStyle,
            color: style.color,
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
    const gameViewportGeometry = (layout) => ({
      viewport: layout.viewport,
      documentWidth: layout.documentWidth,
      bodyWidth: layout.bodyWidth,
      shell: {
        rect: layout.shell.rect,
        paddingTop: layout.shell.paddingTop,
        paddingRight: layout.shell.paddingRight,
        paddingBottom: layout.shell.paddingBottom,
        paddingLeft: layout.shell.paddingLeft,
        gridTemplateRows: layout.shell.gridTemplateRows,
      },
      nav: layout.nav,
      panels: layout.panels,
      gameArea: {
        panel: layout.gameArea.panel,
        scrollTop: layout.gameArea.scrollTop,
        scrollHeight: layout.gameArea.scrollHeight,
        clientHeight: layout.gameArea.clientHeight,
        overflowY: layout.gameArea.overflowY,
        playfield: layout.gameArea.playfield,
        canvas: layout.gameArea.canvas,
        generationButton: layout.gameArea.generationButton,
        coreBoostButton: layout.gameArea.coreBoostButton,
      },
    });
    const rectanglesOverlap = (first, second) => first.left < second.right && first.right > second.left
      && first.top < second.bottom && first.bottom > second.top;
    const assertOverlayLayout = async (layout, label, baselineKey) => {
      const canvas = layout.gameArea.canvas;
      assert.ok(canvas.rect.width > 0 && canvas.rect.height > 0, `game canvas should be rendered at ${label}`);
      assert.ok(layout.gameArea.overflowY === "auto" || layout.gameArea.overflowY === "scroll", `game controls should remain reachable by scrolling at ${label}`);
      assert.equal(layout.bar.hidden, false, `mobile actions should be visible at ${label}`);
      assert.equal(layout.bar.display, "block", `mobile action overlay should render at ${label}`);
      assert.equal(layout.bar.position, "absolute", `the action wrapper must be outside game layout flow at ${label}`);
      assert.equal(layout.bar.pointerEvents, "none", `the transparent action wrapper must not intercept input at ${label}`);
      assert.equal(layout.bar.borderTopWidth, "0px", `the action wrapper must not add a visual band at ${label}`);
      assert.equal(layout.bar.backgroundColor, "rgba(0, 0, 0, 0)", `the action wrapper must stay transparent at ${label}`);
      assert.equal(layout.bar.boxShadow, "none", `the action wrapper must not add a shadow at ${label}`);
      assert.equal(layout.list.pointerEvents, "none", `only individual action buttons may be hit-testable at ${label}`);
      assert.equal(layout.list.scrollWidth, layout.list.clientWidth, `all actions should fit without a scroll tray at ${label}`);
      assert.equal(layout.buttons.length, 5, "all five mobile actions should be present");
      assert.equal(layout.shell.gridTemplateRows.trim().split(" ").length, 3, `the action overlay must not add a grid row at ${label}`);
      for (const button of layout.buttons) {
        assert.equal(button.rect.width, 52, `${button.id} should remain 52px wide at ${label}`);
        assert.equal(button.rect.height, 52, `${button.id} should remain 52px tall at ${label}`);
        assert.equal(button.pointerEvents, "auto", `${button.id} should be independently hit-testable at ${label}`);
        assert.ok(button.rect.bottom <= layout.nav.rect.top - 5, `${button.id} must not overlap navigation at ${label}`);
        for (const [controlName, control] of [["generation", layout.gameArea.generationButton], ["core boost", layout.gameArea.coreBoostButton]]) {
          if (control.width > 0 && control.height > 0) {
            assert.equal(rectanglesOverlap(button.rect, control), false, `${button.id} must not cover the ${controlName} control at ${label} (action=${JSON.stringify(button.rect)}, control=${JSON.stringify(control)}, panelScrollTop=${layout.gameArea.scrollTop})`);
          }
        }
      }
      const baseline = baselineKey ? PRE_ISSUE_481_CANVAS[baselineKey] : null;
      if (baseline) {
        assert.ok(canvas.rect.width >= baseline.width - 0.5, `canvas width at ${label} must not shrink below pre-#481 ${PRE_ISSUE_481_BASELINE_SHA}`);
        assert.ok(canvas.rect.height >= baseline.height - 0.5, `canvas height at ${label} must not shrink below pre-#481 ${PRE_ISSUE_481_BASELINE_SHA}`);
      }
      assert.ok(layout.documentWidth <= layout.viewport.width, `document should not overflow horizontally at ${label}`);
      assert.ok(layout.bodyWidth <= layout.viewport.width, `body should not overflow horizontally at ${label}`);
      if (layout.fixedToast.visible) {
        assert.equal(layout.buttons.some((button) => rectanglesOverlap(button.rect, layout.fixedToast.rect)), false, `fixed achievement UI should not cover an action button at ${label}`);
      }
    };
    const assertActionToggleInvariant = async (label, baselineKey) => {
      await page.evaluate(() => window.__angleDebug.applySetting("showMobileQuickActions", false));
      await page.waitForFunction(() => document.getElementById("mobileQuickActions").hidden);
      await page.waitForTimeout(100);
      const hidden = await readGeometry();
      assert.equal(hidden.shell.hasQuickActions, false, `the hidden setting should clear the quick-action class at ${label}`);
      await page.evaluate(() => window.__angleDebug.applySetting("showMobileQuickActions", true));
      await page.waitForFunction(() => !document.getElementById("mobileQuickActions").hidden);
      await page.waitForTimeout(100);
      const visible = await readGeometry();
      assert.equal(visible.shell.hasQuickActions, true, `the visible setting should restore the quick-action class at ${label}`);
      assert.deepEqual(gameViewportGeometry(visible), gameViewportGeometry(hidden), `showing mobile actions must not change the game viewport at ${label}`);
      await assertOverlayLayout(visible, label, baselineKey);
      return visible;
    };
    await setQuickActionAvailability(page, []);
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const baselineKey = `${width}x844`;
      const layout = await assertActionToggleInvariant(`${width}×844`, baselineKey);
      assert.equal(layout.documentWidth <= width && layout.bodyWidth <= width, true, `the document should not overflow horizontally at ${width}px`);
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
      const key = `${width}x${height}`;
      const baselineKey = screenshotName?.includes("text150") ? undefined : Object.hasOwn(PRE_ISSUE_481_CANVAS, key) ? key : undefined;
      await assertOverlayLayout(layout, `${width}×${height}`, baselineKey);
      assert.deepEqual(layout.buttons.map((button) => button.id), ["buyAll", "generation", "coreBoost", "infinity", "eternity"]);
      assert.equal(layout.list.overflowX, "visible", "the button-only overlay should not create a scroll tray");
      assert.equal(layout.buttons[0].borderRadius, "14px", "MAX purchase should retain a rounded-square shape");
      assert.equal(layout.buttons[1].borderRadius, "50%", "reset actions should be circular");
      assert.notEqual(layout.buttons[0].color, layout.buttons[1].color, "purchase and reset actions should remain visually distinct without size differences");
      assert.ok(Number.parseFloat(layout.shell.paddingTop) >= 7, "the shell should retain top safe-area padding");
      assert.ok(Number.parseFloat(layout.shell.paddingBottom) >= 7, "the shell should retain bottom safe-area padding");
      assert.equal(layout.nav.activeTab.borderBottomWidth, "2px", "navigation should retain its separate active underline");
      for (const button of layout.buttons) {
        const unavailable = unavailableIds.includes(button.id);
        assert.equal(button.hidden, false, `${button.id} should remain visible`);
        assert.equal(button.rect.left >= layout.list.rect.left && button.rect.right <= layout.list.rect.right, true, `${button.id} should be fully visible without scrolling at ${width}×${height}`);
        assert.equal(button.disabled, unavailable, `${button.id} should mirror the availability fixture`);
        assert.equal(button.ariaDisabled, String(unavailable), `${button.id} should expose availability accessibly`);
        assert.equal(button.selected, false, `${button.id} must not look or act like a selected navigation tab`);
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
        await page.screenshot({ path: path.join(root, "output", `issue-481-after-t38-${screenshotName}.png`) });
      }
      return layout;
    };

    await capturePresentation(390, 844, [], "390-all-available");
    await capturePresentation(390, 844, mixedUnavailable, "390-mixed");
    const narrowMixed = await capturePresentation(320, 844, mixedUnavailable, "320-mixed");
    await page.evaluate(() => { document.documentElement.style.fontSize = "150%"; });
    const scaledMixed = await capturePresentation(320, 844, mixedUnavailable, "320-text150-mixed");
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), "24px", "text scaling fixture should enlarge root text to 150%");
    await assertActionToggleInvariant("320×844 at 150% text scale");
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
    assert.equal(focusedAction.ringWithinList, true, "focus ring should remain visible outside the action buttons");

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
    const landscapeAll = await capturePresentation(844, 390, [], "844x390-landscape-all-available");
    const landscapeMixed = await capturePresentation(844, 390, mixedUnavailable, "844x390-landscape-mixed");
    assert.equal(landscapeAll.buttons.length, 5);
    assert.equal(landscapeMixed.viewport.coarse, true, "the landscape fixture should be a coarse-pointer touch device");
    assert.equal(landscapeMixed.nav.gridRow, "3", "the non-occupying overlay should leave navigation in its original grid row");
    await assertActionToggleInvariant("844×390 touch landscape", "844x390");

    await page.setViewportSize({ width: 1023, height: 480 });
    const wideTouch = await assertActionToggleInvariant("1023×480 wide touch", "1023x480");
    assert.equal(wideTouch.viewport.coarse, true, "the wide touch fixture should use a coarse pointer");

    await page.setViewportSize({ width: 844, height: 390 });
    await page.evaluate((insets) => {
      for (const [side, value] of Object.entries(insets)) {
        document.documentElement.style.setProperty(`--ui-safe-area-inset-${side}`, `${value}px`);
      }
    }, { top: 30, right: 40, bottom: 24, left: 36 });
    const safeLandscape = await assertActionToggleInvariant("844×390 landscape with simulated safe insets");
    assert.deepEqual(
      [safeLandscape.shell.paddingTop, safeLandscape.shell.paddingRight, safeLandscape.shell.paddingBottom, safeLandscape.shell.paddingLeft],
      ["30px", "31px", "24px", "27px"],
      "the shell should honor simulated safe insets without adding an action row",
    );
    assert.ok(safeLandscape.documentWidth <= 844 && safeLandscape.bodyWidth <= 844, "safe-area landscape should not overflow horizontally");

    await page.evaluate(() => { document.documentElement.style.fontSize = "150%"; });
    const scaledLandscape = await assertActionToggleInvariant("844×390 landscape at 150% text scale");
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), "24px");

    const landscapeZoom = await context.newCDPSession(page);
    try {
      await landscapeZoom.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1.25 });
      const zoomedLandscape = await assertActionToggleInvariant("844×390 landscape with safe insets, text scale, and page zoom");
      assert.equal(zoomedLandscape.viewport.scale, 1.25, "short-landscape page-scale zoom should be active");
    } finally {
      await landscapeZoom.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 }).catch(() => {});
      await landscapeZoom.detach();
    }

    await page.evaluate(() => {
      const rootStyle = document.documentElement.style;
      rootStyle.fontSize = "";
      for (const side of ["top", "right", "bottom", "left"]) rootStyle.removeProperty(`--ui-safe-area-inset-${side}`);
      document.querySelector(".main-panel.is-active").scrollTop = 0;
    });
    await assertActionToggleInvariant("restored 844×390 landscape", "844x390");
    await page.evaluate(() => window.__angleDebug.applySetting("showMobileQuickActions", false));
    await page.waitForFunction(() => document.getElementById("mobileQuickActions").hidden);
    const hiddenLandscape = await readGeometry();
    assert.equal(hiddenLandscape.bar.display, "none", "the saved setting must hide the touch-landscape overlay");
    assert.equal(hiddenLandscape.shell.hasQuickActions, false);
    assert.equal(hiddenLandscape.nav.gridRow, "3", "hidden settings should preserve the original navigation grid row");
    assert.equal(hiddenLandscape.shell.gridTemplateRows.trim().split(" ").length, 3, "hiding actions must not change the number of layout rows");
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
    const compactLayout = await assertActionToggleInvariant("280×844 compact touch layout");
    assert.equal(compactLayout.list.scrollWidth, compactLayout.list.clientWidth, "all five actions should fit at 280px without a scrolling tray");
    const compactHitTest = await page.evaluate(() => {
      const first = document.getElementById("quickActionBuyAll");
      const list = document.getElementById("quickActionList");
      const firstRect = first.getBoundingClientRect();
      const button = document.elementFromPoint(firstRect.left + firstRect.width / 2, firstRect.top + firstRect.height / 2);
      return {
        first: firstRect.toJSON(),
        last: document.querySelector("[data-quick-action=eternity]").getBoundingClientRect().toJSON(),
        list: list.getBoundingClientRect().toJSON(),
        buttonTarget: button?.id ?? "",
      };
    });
    assert.ok(compactHitTest.first.left >= compactHitTest.list.left && compactHitTest.last.right <= compactHitTest.list.right, "all targets should be fully visible at 280px");
    assert.equal(compactHitTest.buttonTarget, "quickActionBuyAll", "the action button itself must remain hit-testable");

    await page.setViewportSize({ width: 390, height: 844 });
    await setQuickActionAvailability(page, mixedUnavailable);
    await page.evaluate(() => { document.querySelector(".main-panel.is-active").scrollTop = 0; });
    const transparentScrollPoint = await page.evaluate(() => {
      const barRect = document.getElementById("mobileQuickActions").getBoundingClientRect();
      const x = barRect.left + 8;
      const y = barRect.top + 26;
      const hit = document.elementFromPoint(x, y);
      return { x, y, hitsOverlay: Boolean(hit?.closest("#mobileQuickActions")), hitsButton: Boolean(hit?.closest(".mobile-quick-action")) };
    });
    assert.equal(transparentScrollPoint.hitsOverlay, false, "transparent overlay space should let the underlying game panel receive input");
    assert.equal(transparentScrollPoint.hitsButton, false, "a touch gesture outside the buttons should not start an action");
    await resetSpy(page);
    const touchSession = await context.newCDPSession(page);
    try {
      await touchSession.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ id: 1, x: transparentScrollPoint.x, y: transparentScrollPoint.y, radiusX: 2, radiusY: 2, force: 1 }],
      });
      await page.waitForTimeout(40);
      await touchSession.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ id: 1, x: transparentScrollPoint.x, y: transparentScrollPoint.y - 60, radiusX: 2, radiusY: 2, force: 1 }],
      });
      await page.waitForTimeout(40);
      await touchSession.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(60);
    } finally {
      await touchSession.detach();
    }
    const touchPan = await page.evaluate(() => ({
      scrollTop: document.querySelector(".main-panel.is-active").scrollTop,
      calls: Object.values(window.__quickActionSpy.calls).reduce((total, values) => total + values.length, 0),
    }));
    assert.ok(touchPan.scrollTop > 0, "vertical touch scrolling through transparent overlay space should reach the game panel");
    assert.equal(touchPan.calls, 0, "a touch gesture outside the action buttons must not activate a quick action");
    await page.evaluate(() => { document.querySelector(".main-panel.is-active").scrollTop = 0; });
    await page.waitForTimeout(200);
    await page.evaluate(() => { document.querySelector(".main-panel.is-active").scrollTop = 0; });
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => document.querySelector(".main-panel.is-active").scrollTop), 0, "the gameplay panel should settle before the next viewport assertions");

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

async function testWideTouchSafeArea({ browser, origin, errors, httpFailures }) {
  const handle = await openGamePage(browser, origin, {
    viewport: { width: 1024, height: 1366 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    stubFonts: true,
    freezeAnimationFrame: true,
  });
  const { context, page } = handle;
  trackPage(page, "quick-actions-wide-touch", errors, httpFailures);
  const readGeometry = () => page.evaluate(() => {
    const readRect = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const readStyle = (selector) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element) : null;
    };
    const shell = document.querySelector(".shell");
    const shellStyle = getComputedStyle(shell);
    const tabs = document.querySelector(".main-tabs");
    const tabsStyle = getComputedStyle(tabs);
    const fps = readStyle(".fps-counter");
    const toasts = readStyle(".achievement-toasts");
    const offline = readStyle(".offline-report");
    const update = readStyle(".update-modal");
    const confirmation = readStyle(".confirmation-modal");
    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scale: window.visualViewport?.scale ?? 1,
        coarse: matchMedia("(pointer: coarse)").matches,
        wideTouch: matchMedia("(min-width: 821px) and (pointer: coarse)").matches,
      },
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      actionDisplay: getComputedStyle(document.getElementById("mobileQuickActions")).display,
      shell: {
        rect: readRect(shell),
        paddingTop: shellStyle.paddingTop,
        paddingRight: shellStyle.paddingRight,
        paddingBottom: shellStyle.paddingBottom,
        paddingLeft: shellStyle.paddingLeft,
      },
      tabs: {
        gridColumnStart: tabsStyle.gridColumnStart,
        gridRowStart: tabsStyle.gridRowStart,
      },
      fps: fps ? { rect: readRect(document.querySelector(".fps-counter")), top: fps.top, right: fps.right } : null,
      toasts: toasts ? { rect: readRect(document.querySelector(".achievement-toasts")), top: toasts.top, right: toasts.right } : null,
      offline: offline ? {
        rect: readRect(document.querySelector(".offline-report")),
        left: offline.left,
        right: offline.right,
        bottom: offline.bottom,
        width: offline.width,
        maxHeight: offline.maxHeight,
      } : null,
      updatePadding: update ? {
        top: update.paddingTop,
        right: update.paddingRight,
        bottom: update.paddingBottom,
        left: update.paddingLeft,
      } : null,
      confirmation: confirmation ? {
        width: confirmation.width,
        maxWidth: confirmation.maxWidth,
        maxHeight: confirmation.maxHeight,
      } : null,
    };
  });

  try {
    await page.evaluate(() => window.__angleDebug.runtime.closeUpdateModal?.());
    const viewportMeta = await page.locator('meta[name="viewport"]').getAttribute("content");
    assert.match(viewportMeta ?? "", /viewport-fit=cover/, "wide touch viewports must retain the safe-area viewport mode");
    const baseline = await readGeometry();
    assert.equal(baseline.viewport.coarse, true, "wide-touch context should expose a coarse pointer");
    assert.equal(baseline.viewport.wideTouch, true, "safe-area rules should match 821px+ touch viewports");
    assert.deepEqual(
      [baseline.shell.paddingTop, baseline.shell.paddingRight, baseline.shell.paddingBottom, baseline.shell.paddingLeft],
      ["9px", "0px", "9px", "0px"],
      "zero-inset touch tablets should retain the existing 9px outer gutters",
    );
    assert.equal(baseline.tabs.gridColumnStart, "1", "portrait navigation should remain on its existing column");
    assert.equal(baseline.actionDisplay, "none", "wide portrait touch should not reveal the mobile quick-action row");
    assert.ok(baseline.documentWidth <= 1024 && baseline.bodyWidth <= 1024, "wide portrait touch should not overflow horizontally");

    // Chromium has no physical notch; inject the CSS aliases to exercise nonzero inset layout math.
    const insets = { top: 32, right: 40, bottom: 24, left: 36 };
    await page.evaluate((values) => {
      const rootStyle = document.documentElement.style;
      for (const [side, value] of Object.entries(values)) rootStyle.setProperty(`--ui-safe-area-inset-${side}`, `${value}px`);
      for (const selector of [".fps-counter", ".offline-report"]) {
        const element = document.querySelector(selector);
        if (element) element.hidden = false;
      }
    }, insets);
    const safe = await readGeometry();
    assert.deepEqual(
      [safe.shell.paddingTop, safe.shell.paddingRight, safe.shell.paddingBottom, safe.shell.paddingLeft],
      ["32px", "31px", "24px", "27px"],
      "simulated nonzero insets should protect the shell while retaining its 9px exterior gutter",
    );
    const shellContent = {
      left: safe.shell.rect.left + Number.parseFloat(safe.shell.paddingLeft),
      right: safe.shell.rect.right - Number.parseFloat(safe.shell.paddingRight),
      top: safe.shell.rect.top + Number.parseFloat(safe.shell.paddingTop),
      bottom: safe.shell.rect.bottom - Number.parseFloat(safe.shell.paddingBottom),
    };
    assert.ok(shellContent.left >= insets.left - 1 && shellContent.right <= safe.viewport.width - insets.right + 1, "shell content should stay inside simulated side insets");
    assert.ok(shellContent.top >= insets.top - 1 && shellContent.bottom <= safe.viewport.height - insets.bottom + 1, "shell content should stay inside simulated top/bottom insets");
    assert.ok(safe.fps && Number.parseFloat(safe.fps.top) >= insets.top + 4, "fixed FPS control should clear the simulated top inset");
    assert.ok(safe.fps.rect.right <= safe.viewport.width - insets.right - 4 + 1, "fixed FPS control should clear the simulated right inset");
    assert.ok(safe.toasts && Number.parseFloat(safe.toasts.top) >= insets.top + 4, "achievement toasts should clear the simulated top inset");
    assert.ok(safe.toasts.rect.right <= safe.viewport.width - insets.right - 4 + 1, "achievement toasts should clear the simulated right inset");
    assert.ok(safe.offline && safe.offline.rect.left >= insets.left - 1, "offline report should clear the simulated left inset");
    assert.ok(safe.offline.rect.right <= safe.viewport.width - insets.right + 1, "offline report should clear the simulated right inset");
    assert.ok(safe.offline.rect.top >= insets.top + 17 && safe.offline.rect.bottom <= safe.viewport.height - insets.bottom - 17, "offline report should stay inside the simulated vertical safe area");
    assert.deepEqual(safe.updatePadding, { top: "50px", right: "58px", bottom: "42px", left: "54px" }, "update modal content padding should preserve the simulated safe area");
    assert.equal(safe.confirmation.maxHeight, `${safe.viewport.height - insets.top - insets.bottom - 24}px`, "confirmation dialogs should cap height to the simulated safe viewport");

    await page.setViewportSize({ width: 900, height: 1200 });
    const narrowerTouch = await readGeometry();
    assert.equal(narrowerTouch.viewport.wideTouch, true, "coarse portrait viewports above the mobile breakpoint should keep safe-area protection");
    assert.ok(narrowerTouch.documentWidth <= 900 && narrowerTouch.bodyWidth <= 900, "narrower touch portrait should remain horizontally contained");
    assert.equal(narrowerTouch.shell.paddingLeft, "27px");

    await page.setViewportSize({ width: 1366, height: 1024 });
    const landscape = await readGeometry();
    assert.equal(landscape.tabs.gridColumnStart, "2", "landscape should retain the existing right-side navigation layout");
    assert.equal(landscape.actionDisplay, "none", "wide landscape touch should not reveal the short-landscape action row");
    assert.equal(landscape.shell.paddingRight, "31px");
    assert.ok(landscape.documentWidth <= 1366 && landscape.bodyWidth <= 1366, "wide landscape touch should remain horizontally contained");

    const cdp = await context.newCDPSession(page);
    try {
      await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1.25 });
      const zoomed = await readGeometry();
      assert.equal(zoomed.viewport.scale, 1.25, "page-scale zoom should be active for the zoom regression");
      assert.equal(zoomed.shell.paddingTop, "32px", "page-scale zoom should retain the top safe-area CSS padding");
      assert.equal(zoomed.shell.paddingRight, "31px", "page-scale zoom should retain the side safe-area CSS padding");
      assert.ok(zoomed.documentWidth <= zoomed.viewport.width, "page-scale zoom should not introduce document overflow");
    } finally {
      await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 }).catch(() => {});
      await cdp.detach();
    }
  } finally {
    await context.close();
  }

  const desktopHandle = await openGamePage(browser, origin, {
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    stubFonts: true,
    freezeAnimationFrame: true,
  });
  trackPage(desktopHandle.page, "quick-actions-wide-desktop", errors, httpFailures);
  try {
    const desktop = await desktopHandle.page.evaluate(() => {
      const shellStyle = getComputedStyle(document.querySelector(".shell"));
      const tabsStyle = getComputedStyle(document.querySelector(".main-tabs"));
      return {
        coarse: matchMedia("(pointer: coarse)").matches,
        wideTouch: matchMedia("(min-width: 821px) and (pointer: coarse)").matches,
        width: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        actionDisplay: getComputedStyle(document.getElementById("mobileQuickActions")).display,
        shellPadding: [shellStyle.paddingTop, shellStyle.paddingRight, shellStyle.paddingBottom, shellStyle.paddingLeft],
        tabsColumn: tabsStyle.gridColumnStart,
      };
    });
    assert.equal(desktop.coarse, false, "desktop context should retain a fine pointer");
    assert.equal(desktop.wideTouch, false, "safe-area override must not match ordinary desktop pointers");
    assert.deepEqual(desktop.shellPadding, ["9px", "0px", "9px", "0px"], "ordinary desktop shell gutters should remain unchanged");
    assert.equal(desktop.tabsColumn, "2", "ordinary desktop landscape navigation should retain its existing column");
    assert.equal(desktop.actionDisplay, "none", "ordinary desktop should keep quick actions hidden");
    assert.ok(desktop.documentWidth <= desktop.width && desktop.bodyWidth <= desktop.width, "ordinary desktop should remain horizontally contained");
  } finally {
    await desktopHandle.context.close();
  }
}

export async function runQuickActions({ browser, origin, errors, httpFailures }) {
  await testDesktop({ browser, origin, errors, httpFailures });
  await testMobile({ browser, origin, errors, httpFailures });
  await testWideTouchSafeArea({ browser, origin, errors, httpFailures });
}
