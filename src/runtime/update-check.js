import { runtime, expose } from "./shared.js";

let updateCheckInFlight = false;

function shouldShowUpdateModal() {
  try {
    return localStorage.getItem(runtime.UPDATE_SEEN_KEY) !== runtime.APP_VERSION;
  } catch (error) {
    return false;
  }
}

function closeUpdateModal() {
  if (!runtime.elements.updateModal) return;
  runtime.elements.updateModal.hidden = true;
  try {
    localStorage.setItem(runtime.UPDATE_SEEN_KEY, runtime.APP_VERSION);
  } catch (error) {
    // Non-critical: private browsing or blocked storage should not affect gameplay.
  }
}

function showUpdateModalIfNeeded() {
  if (!runtime.elements.updateModal || !shouldShowUpdateModal()) return;
  runtime.elements.updateModal.hidden = false;
  if (runtime.elements.updateModalClose) runtime.elements.updateModalClose.focus();
}

function storedUpdateReloadTime() {
  try {
    return runtime.sanitizeNumber(localStorage.getItem(runtime.UPDATE_RELOAD_TIME_KEY), 0);
  } catch (error) {
    return 0;
  }
}

function markUpdateDeferred(targetVersion) {
  try {
    localStorage.setItem(runtime.UPDATE_DEFERRED_TARGET_KEY, targetVersion);
  } catch (error) {
    // Non-critical: the visible save status still tells the player what to do.
  }
  runtime.setSaveStatus(runtime.t("updateReloadDeferred"));
}

function reloadForRemoteUpdate(targetVersion) {
  if (runtime.loadRecoveryMode || runtime.saveConflictMode) return;
  const now = Date.now();
  try {
    const previousTarget = localStorage.getItem(runtime.UPDATE_RELOAD_TARGET_KEY);
    const previousTime = storedUpdateReloadTime();
    if (previousTarget === targetVersion) {
      markUpdateDeferred(targetVersion);
      return;
    }
    if (previousTime > 0 && now - previousTime < runtime.UPDATE_RETRY_COOLDOWN_MS) {
      markUpdateDeferred(targetVersion);
      return;
    }
  } catch (error) {
    markUpdateDeferred(targetVersion);
    return;
  }

  if (!runtime.saveGame("manual")
    || (runtime.createCheckpoint && !runtime.createCheckpoint("pre-update", { force: true }))) {
    markUpdateDeferred(targetVersion);
    return;
  }
  try {
    localStorage.setItem(runtime.UPDATE_RELOAD_TARGET_KEY, targetVersion);
    localStorage.setItem(runtime.UPDATE_RELOAD_TIME_KEY, String(now));
    localStorage.removeItem(runtime.UPDATE_DEFERRED_TARGET_KEY);
  } catch (error) {
    markUpdateDeferred(targetVersion);
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set("v", targetVersion);
  window.location.replace(url.toString());
}

async function checkForRemoteUpdate() {
  if (updateCheckInFlight || !window.fetch) return;
  updateCheckInFlight = true;
  try {
    const response = await fetch(`${runtime.VERSION_MANIFEST_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return;
    const manifest = await response.json();
    if (!manifest || typeof manifest.appVersion !== "string") return;
    if (manifest.appVersion && manifest.appVersion !== runtime.APP_VERSION) {
      reloadForRemoteUpdate(manifest.appVersion);
    }
  } catch (error) {
    // Update checks should never interrupt gameplay.
  } finally {
    updateCheckInFlight = false;
  }
}

expose("updateCheckInFlight", () => updateCheckInFlight, (value) => { updateCheckInFlight = value; });
expose("shouldShowUpdateModal", () => shouldShowUpdateModal, (value) => { shouldShowUpdateModal = value; });
expose("closeUpdateModal", () => closeUpdateModal, (value) => { closeUpdateModal = value; });
expose("showUpdateModalIfNeeded", () => showUpdateModalIfNeeded);
expose("storedUpdateReloadTime", () => storedUpdateReloadTime, (value) => { storedUpdateReloadTime = value; });
expose("markUpdateDeferred", () => markUpdateDeferred, (value) => { markUpdateDeferred = value; });
expose("reloadForRemoteUpdate", () => reloadForRemoteUpdate, (value) => { reloadForRemoteUpdate = value; });
expose("checkForRemoteUpdate", () => checkForRemoteUpdate);

export { showUpdateModalIfNeeded, checkForRemoteUpdate };
