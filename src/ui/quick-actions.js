import { runtime } from "../runtime/shared.js";

const INITIAL_REPEAT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 200;

const ACTIONS = Object.freeze([
  {
    id: "buyAll",
    key: "m",
    buttonId: "quickActionBuyAll",
    labelKey: "quickActionBuyAllLabel",
    shortLabel: "MAX",
    repeatable: true,
    source: () => runtime.elements.buyAllUpgrade,
  },
  {
    id: "generation",
    key: "g",
    buttonId: "quickActionGeneration",
    labelKey: "quickActionGenerationLabel",
    shortLabel: "GEN",
    repeatable: true,
    source: () => runtime.elements.generationButton,
  },
  {
    id: "coreBoost",
    key: "b",
    buttonId: "quickActionCoreBoost",
    labelKey: "quickActionCoreBoostLabel",
    shortLabel: "CB",
    repeatable: true,
    source: () => runtime.elements.coreBoostButton,
  },
  {
    id: "infinity",
    key: "i",
    buttonId: "quickActionInfinity",
    labelKey: "quickActionInfinityLabel",
    shortLabel: "INF",
    repeatable: true,
    source: () => runtime.elements.infinityButton,
  },
  {
    id: "eternity",
    key: "e",
    buttonId: "quickActionEternity",
    labelKey: "quickActionEternityLabel",
    shortLabel: "ETR",
    repeatable: true,
    source: () => document.getElementById("eternityPerformButton"),
  },
]);

const ACTION_BY_ID = new Map(ACTIONS.map((action) => [action.id, action]));
const ACTION_BY_KEY = new Map(ACTIONS.map((action) => [action.key, action]));
let repeatSession = null;
let clickSuppressionButton = null;
let clickSuppressionTimer = 0;
let bound = false;

function isEditableElement(element) {
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tagName = typeof element.tagName === "string" ? element.tagName.toLowerCase() : "";
  if (["input", "textarea", "select"].includes(tagName)) return true;
  if (typeof element.closest === "function" && element.closest('[contenteditable], [role="textbox"]')) return true;
  return typeof element.getAttribute === "function" && element.getAttribute("role") === "textbox";
}

function isEditableKeyboardTarget(target) {
  return isEditableElement(target) || isEditableElement(document.activeElement);
}

function hasBlockingSurface() {
  return Boolean(
    document.hidden
    || runtime.offlineProcessing
    || runtime.saveConflictMode
    || runtime.loadRecoveryMode
    || runtime.loadInFlight
    || runtime.visibilityResumeInFlight
    || runtime.elements.updateModal && !runtime.elements.updateModal.hidden
    || runtime.elements.confirmationModal?.open
    || runtime.elements.offlineReportPanel && !runtime.elements.offlineReportPanel.hidden
    || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]:not([hidden])'),
  );
}

function getQuickActionButton(action) {
  return document.getElementById(action.buttonId);
}

function updateActionButton(action) {
  const button = getQuickActionButton(action);
  if (!button) return;
  const source = action.source();
  const missing = !source;
  const unavailable = missing || source.disabled === true;
  const currentPointerOwnsAction = repeatSession?.source === "pointer"
    && repeatSession.action.id === action.id;
  button.hidden = missing;
  button.disabled = missing || (unavailable && !currentPointerOwnsAction);
  button.setAttribute("aria-label", runtime.t(action.labelKey));
  button.setAttribute("aria-disabled", String(unavailable));
  button.title = runtime.t(action.labelKey);
  button.dataset.available = String(!unavailable);
  button.classList.toggle("is-unavailable", unavailable);
  button.textContent = action.shortLabel;
}

function refreshQuickActionButtons() {
  ACTIONS.forEach(updateActionButton);
}

function armClickSuppression(button) {
  if (!button) return;
  if (clickSuppressionTimer) window.clearTimeout(clickSuppressionTimer);
  clickSuppressionButton = button;
  clickSuppressionTimer = window.setTimeout(() => {
    clickSuppressionButton = null;
    clickSuppressionTimer = 0;
  }, 0);
}

function stopRepeating(expectedSession = repeatSession) {
  const session = expectedSession;
  if (!session || repeatSession !== session) return;
  repeatSession = null;
  if (session.delayTimer) window.clearTimeout(session.delayTimer);
  if (session.repeatTimer) window.clearInterval(session.repeatTimer);
  if (session.source === "pointer") {
    armClickSuppression(session.button);
    try {
      if (session.button?.hasPointerCapture?.(session.pointerId)) {
        session.button.releasePointerCapture(session.pointerId);
      }
    } catch {
      // The browser may already have released capture during cancellation.
    }
  }
  refreshQuickActionButtons();
}

function dispatchCanonicalAction(action) {
  if (hasBlockingSurface()) {
    stopRepeating();
    return false;
  }
  const button = action.source();
  if (!button || typeof button.click !== "function") return false;
  // Native disabled controls ignore click(); this keeps availability and gameplay rules canonical.
  button.click();
  return true;
}

function sessionIsCancelled(session) {
  if (hasBlockingSurface()) return true;
  if (session.source === "keyboard" && runtime.state.gameplayHotkeysEnabled !== true) return true;
  if (session.source === "pointer" && runtime.state.showMobileQuickActions !== true) return true;
  return false;
}

function beginRepeat(action, source, { key = "", button = null, pointerId = null } = {}) {
  stopRepeating();
  if (hasBlockingSurface()) return null;
  if (source === "keyboard" && runtime.state.gameplayHotkeysEnabled !== true) return null;
  if (source === "pointer" && runtime.state.showMobileQuickActions !== true) return null;

  const session = {
    action,
    source,
    key,
    button,
    pointerId,
    delayTimer: 0,
    repeatTimer: 0,
  };
  repeatSession = session;
  dispatchCanonicalAction(action);
  if (repeatSession !== session || !action.repeatable) return session;

  session.delayTimer = window.setTimeout(() => {
    if (repeatSession !== session) return;
    session.delayTimer = 0;
    if (sessionIsCancelled(session)) {
      stopRepeating(session);
      return;
    }
    dispatchCanonicalAction(action);
    if (repeatSession !== session) return;
    session.repeatTimer = window.setInterval(() => {
      if (repeatSession !== session) return;
      if (sessionIsCancelled(session)) {
        stopRepeating(session);
        return;
      }
      dispatchCanonicalAction(action);
    }, REPEAT_INTERVAL_MS);
  }, INITIAL_REPEAT_DELAY_MS);
  return session;
}

function handleKeydown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
    if (repeatSession?.source === "keyboard") stopRepeating();
    return;
  }
  const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
  const action = ACTION_BY_KEY.get(key);
  if (!action) return;
  if (
    event.defaultPrevented
    || event.isComposing
    || event.keyCode === 229
    || key === "process"
    || key === "dead"
    || isEditableKeyboardTarget(event.target)
  ) return;
  if (runtime.state.gameplayHotkeysEnabled !== true || hasBlockingSurface()) {
    if (repeatSession?.source === "keyboard") stopRepeating();
    return;
  }
  event.preventDefault();
  if (repeatSession?.source === "keyboard" && repeatSession.key === key) return;
  if (event.repeat) return;
  beginRepeat(action, "keyboard", { key });
}

function handleKeyup(event) {
  const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
  if (repeatSession?.source === "keyboard" && repeatSession.key === key) stopRepeating();
}

function handleQuickActionClick(event) {
  const button = event.currentTarget;
  if (clickSuppressionButton === button && event.detail > 0) {
    event.preventDefault();
    event.stopPropagation();
    clickSuppressionButton = null;
    if (clickSuppressionTimer) window.clearTimeout(clickSuppressionTimer);
    clickSuppressionTimer = 0;
    return;
  }
  const action = ACTION_BY_ID.get(button.dataset.quickAction);
  if (!action || button.disabled || runtime.state.showMobileQuickActions !== true) return;
  dispatchCanonicalAction(action);
}

function handlePointerDown(event) {
  if (event.isPrimary === false || event.button !== 0) return;
  const button = event.currentTarget;
  const action = ACTION_BY_ID.get(button.dataset.quickAction);
  if (!action || button.disabled) return;
  event.preventDefault();
  event.stopPropagation();
  const session = beginRepeat(action, "pointer", {
    button,
    pointerId: event.pointerId,
  });
  if (!session) return;
  try {
    button.setPointerCapture?.(event.pointerId);
  } catch {
    // Cancellation listeners still work when pointer capture is unavailable.
  }
}

function handlePointerMove(event) {
  const session = repeatSession;
  if (session?.source !== "pointer" || session.pointerId !== event.pointerId) return;
  const rect = session.button.getBoundingClientRect();
  if (
    event.clientX < rect.left
    || event.clientX > rect.right
    || event.clientY < rect.top
    || event.clientY > rect.bottom
  ) stopRepeating(session);
}

function handlePointerLeave(event) {
  const session = repeatSession;
  if (session?.source === "pointer" && session.pointerId === event.pointerId) stopRepeating(session);
}

function handlePointerEnd(event) {
  const session = repeatSession;
  if (session?.source === "pointer" && session.pointerId === event.pointerId) stopRepeating(session);
}

function cancelForLifecycleOrModal() {
  if (hasBlockingSurface()) stopRepeating();
}

function cancelAllForLifecycle() {
  stopRepeating();
}

function bindSettingToggle(element, key) {
  element?.addEventListener("change", () => runtime.applySetting?.(key, element.checked));
}

export function bindQuickActions() {
  if (bound) return;
  bound = true;
  bindSettingToggle(runtime.elements.gameplayHotkeysToggle, "gameplayHotkeysEnabled");
  bindSettingToggle(runtime.elements.mobileQuickActionsToggle, "showMobileQuickActions");
  runtime.elements.quickActionButtons.forEach((button) => {
    button.addEventListener("click", handleQuickActionClick);
    button.addEventListener("pointerdown", handlePointerDown);
    button.addEventListener("pointerleave", handlePointerLeave);
    button.addEventListener("lostpointercapture", handlePointerEnd);
  });
  window.addEventListener("keydown", handleKeydown, true);
  window.addEventListener("keyup", handleKeyup, true);
  window.addEventListener("pointermove", handlePointerMove, true);
  window.addEventListener("pointerup", handlePointerEnd, true);
  window.addEventListener("pointercancel", handlePointerEnd, true);
  window.addEventListener("lostpointercapture", handlePointerEnd, true);
  window.addEventListener("blur", cancelAllForLifecycle);
  window.addEventListener("pagehide", cancelAllForLifecycle);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAllForLifecycle();
  });
  document.addEventListener("toggle", cancelForLifecycleOrModal, true);
  document.addEventListener("focusin", (event) => {
    if (isEditableKeyboardTarget(event.target) && repeatSession?.source === "keyboard") stopRepeating();
  });
  document.addEventListener("compositionstart", () => {
    if (repeatSession?.source === "keyboard") stopRepeating();
  });
  if (typeof MutationObserver === "function") {
    const observer = new MutationObserver(cancelForLifecycleOrModal);
    document.querySelectorAll('dialog, [role="dialog"], #saveRecoveryDetails').forEach((surface) => {
      observer.observe(surface, {
        attributes: true,
        attributeFilter: ["hidden", "open", "aria-modal"],
      });
    });
  }
  refreshQuickActionButtons();
}

export function updateQuickActionsUi() {
  const showMobileBar = runtime.state.showMobileQuickActions === true;
  const bar = runtime.elements.mobileQuickActions;
  if (bar) {
    bar.hidden = !showMobileBar;
    bar.setAttribute("aria-label", runtime.t("quickActionsLabel"));
  }
  runtime.elements.shell?.classList.toggle("has-mobile-quick-actions", showMobileBar);
  if (repeatSession && sessionIsCancelled(repeatSession)) stopRepeating(repeatSession);
  refreshQuickActionButtons();
  const hotkeysToggle = runtime.elements.gameplayHotkeysToggle;
  if (hotkeysToggle && document.activeElement !== hotkeysToggle) {
    hotkeysToggle.checked = runtime.state.gameplayHotkeysEnabled === true;
  }
  const mobileToggle = runtime.elements.mobileQuickActionsToggle;
  if (mobileToggle && document.activeElement !== mobileToggle) {
    mobileToggle.checked = showMobileBar;
  }
}
