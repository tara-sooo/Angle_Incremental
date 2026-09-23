import { runtime, expose } from "./shared.js";

let serverClockAnchor = null;
let serverClockSyncInFlight = null;
let serverClockSource = "local-fallback";
let serverClockAnomaly = false;
let localClockAnomaly = false;
let localClockAnchor = null;

function monotonicClockNow() {
  const performanceApi = window.performance;
  return performanceApi && typeof performanceApi.now === "function" ? performanceApi.now() : Date.now();
}

function localClockNow() {
  return Date.now();
}

function finitePositiveNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function localClockAnomalyDetected() {
  if (!localClockAnchor) {
    localClockAnchor = { localMs: localClockNow(), monotonicMs: monotonicClockNow() };
    return false;
  }
  const currentLocalMs = localClockNow();
  const currentMonotonicMs = monotonicClockNow();
  const expectedLocalMs = localClockAnchor.localMs + Math.max(0, currentMonotonicMs - localClockAnchor.monotonicMs);
  if (Math.abs(currentLocalMs - expectedLocalMs) > runtime.SERVER_CLOCK_BACKWARD_TOLERANCE_SECONDS * 1000) {
    localClockAnomaly = true;
  }
  return localClockAnomaly;
}

function rebaseLocalClock() {
  localClockAnchor = { localMs: localClockNow(), monotonicMs: monotonicClockNow() };
  localClockAnomaly = false;
}

function estimatedServerNowMs() {
  if (!serverClockAnchor) return 0;
  return serverClockAnchor.serverMs + Math.max(0, monotonicClockNow() - serverClockAnchor.monotonicMs);
}

function serverClockAvailable() {
  return serverClockSource === "server" && Boolean(serverClockAnchor) && !serverClockAnomaly;
}

function trustedClockNowMs() {
  return serverClockAvailable() ? estimatedServerNowMs() : localClockNow();
}

async function syncServerClock() {
  if (serverClockSyncInFlight) return serverClockSyncInFlight;
  serverClockSyncInFlight = (async () => {
    if (!window.fetch) {
      serverClockSource = "local-fallback";
      return { available: false, anomaly: false, source: serverClockSource };
    }

    const startedAt = monotonicClockNow();
    const abortController = typeof window.AbortController === "function" ? new window.AbortController() : null;
    const timeoutId = abortController && typeof window.setTimeout === "function"
      ? window.setTimeout(() => abortController.abort(), runtime.SERVER_CLOCK_SYNC_TIMEOUT_MS)
      : null;
    try {
      const response = await window.fetch(`${runtime.VERSION_MANIFEST_URL}?clock=${Math.floor(localClockNow())}`, {
        cache: "no-store",
        ...(abortController ? { signal: abortController.signal } : {}),
      });
      const finishedAt = monotonicClockNow();
      if (!response.ok) throw new Error("server clock response failed");
      // The response header is an external value; accept it only after strict date parsing.
      const serverDateMs = Date.parse(response.headers?.get("date") || "");
      if (!Number.isFinite(serverDateMs)) throw new Error("server clock header missing");

      const estimatedAtResponse = serverDateMs + Math.max(0, finishedAt - startedAt) / 2;
      const previousEstimate = estimatedServerNowMs();
      if (
        serverClockAnchor
        && estimatedAtResponse < previousEstimate - runtime.SERVER_CLOCK_BACKWARD_TOLERANCE_SECONDS * 1000
      ) {
        serverClockAnomaly = true;
        serverClockSource = "server";
        return { available: false, anomaly: true, source: serverClockSource };
      }

      serverClockAnchor = { serverMs: estimatedAtResponse, monotonicMs: finishedAt };
      serverClockSource = "server";
      serverClockAnomaly = false;
      return { available: true, anomaly: false, source: serverClockSource };
    } catch (error) {
      if (!serverClockAnomaly) serverClockSource = "local-fallback";
      return { available: false, anomaly: serverClockAnomaly, source: serverClockSource };
    } finally {
      if (timeoutId !== null && typeof window.clearTimeout === "function") window.clearTimeout(timeoutId);
    }
  })();

  try {
    return await serverClockSyncInFlight;
  } finally {
    serverClockSyncInFlight = null;
  }
}

function offlineElapsedFromSave(savedAt, serverSavedAt) {
  const localSavedAt = finitePositiveNumber(savedAt);
  const recordedServerAt = finitePositiveNumber(serverSavedAt);
  const currentLocalAt = localClockNow();
  const localAnomalyDetected = localClockAnomalyDetected()
    || (localSavedAt > 0 && currentLocalAt < localSavedAt - runtime.SERVER_CLOCK_BACKWARD_TOLERANCE_SECONDS * 1000);

  if (serverClockAnomaly || (localAnomalyDetected && !serverClockAvailable())) {
    return {
      elapsedSeconds: 0,
      clockSource: serverClockAnomaly ? "server" : serverClockSource,
      clockAnomaly: true,
      legacyTimestampUsed: false,
    };
  }

  if (serverClockAvailable() && recordedServerAt > 0) {
    const currentServerAt = estimatedServerNowMs();
    const elapsedMilliseconds = currentServerAt - recordedServerAt;
    if (!Number.isFinite(currentServerAt)
      || !Number.isFinite(elapsedMilliseconds)
      || elapsedMilliseconds < -runtime.SERVER_CLOCK_BACKWARD_TOLERANCE_SECONDS * 1000) {
      return {
        elapsedSeconds: 0,
        clockSource: "server",
        clockAnomaly: true,
        legacyTimestampUsed: false,
      };
    }
    return {
      elapsedSeconds: Math.max(0, elapsedMilliseconds / 1000),
      clockSource: "server",
      clockAnomaly: false,
      legacyTimestampUsed: false,
    };
  }

  if (localSavedAt <= 0) {
    return {
      elapsedSeconds: 0,
      clockSource: serverClockAvailable() ? "server" : "local-fallback",
      clockAnomaly: false,
      legacyTimestampUsed: false,
    };
  }

  const elapsedMilliseconds = currentLocalAt - localSavedAt;
  if (!Number.isFinite(currentLocalAt) || !Number.isFinite(elapsedMilliseconds)) {
    return {
      elapsedSeconds: 0,
      clockSource: serverClockAvailable() ? "legacy-local" : "local-fallback",
      clockAnomaly: true,
      legacyTimestampUsed: serverClockAvailable(),
    };
  }

  return {
    elapsedSeconds: Math.max(0, elapsedMilliseconds / 1000),
    clockSource: serverClockAvailable() ? "legacy-local" : "local-fallback",
    clockAnomaly: false,
    legacyTimestampUsed: serverClockAvailable(),
  };
}

expose("serverClockSource", () => serverClockSource);
expose("serverClockAnomaly", () => serverClockAnomaly);
expose("serverClockAvailable", () => serverClockAvailable);
expose("serverClockNowMs", () => trustedClockNowMs);
expose("localClockNowMs", () => localClockNow);
expose("monotonicClockNowMs", () => monotonicClockNow);
expose("syncServerClock", () => syncServerClock);
expose("offlineElapsedFromSave", () => offlineElapsedFromSave);
expose("rebaseLocalClock", () => rebaseLocalClock);
