import { runtime, expose } from "../runtime/shared.js";

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function cryptoApi() {
  return globalThis.crypto && globalThis.crypto.subtle ? globalThis.crypto : null;
}

async function saveCodeKey() {
  const api = cryptoApi();
  if (!api) throw new Error("crypto unavailable");
  const encoder = new TextEncoder();
  const material = await api.subtle.importKey(
    "raw",
    encoder.encode(runtime.SAVE_CODE_SECRET),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return api.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(runtime.SAVE_CODE_SALT),
      iterations: 120000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function exportSaveCode() {
  const api = cryptoApi();
  if (!api) {
    runtime.setSaveStatus(runtime.t("saveCodeCryptoUnavailable"));
    return "";
  }
  const iv = api.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(runtime.serializeSaveData()));
  const encrypted = new Uint8Array(await api.subtle.encrypt({ name: "AES-GCM", iv }, await saveCodeKey(), plaintext));
  const envelope = {
    v: 2,
    i: bytesToBase64Url(iv),
    d: bytesToBase64Url(encrypted),
  };
  const code = `${runtime.SAVE_CODE_PREFIX}${bytesToBase64Url(encoder.encode(JSON.stringify(envelope)))}`;
  if (runtime.elements.saveCodeArea) runtime.elements.saveCodeArea.value = code;
  if (runtime.elements.saveCodeDetails) runtime.elements.saveCodeDetails.open = true;
  runtime.setSaveStatus(runtime.t("saveCodeExported"));
  return code;
}

async function importSaveCode(code) {
  if (runtime.saveConflictMode) {
    runtime.setSaveStatus(runtime.t("saveConflictDetected"));
    return false;
  }
  let backupFailed = false;
  try {
    const trimmed = String(code || "").trim();
    if (!trimmed.startsWith(runtime.SAVE_CODE_PREFIX)) throw new Error("bad prefix");
    const api = cryptoApi();
    if (!api) throw new Error("crypto unavailable");
    const decoder = new TextDecoder();
    const envelope = JSON.parse(decoder.decode(base64UrlToBytes(trimmed.slice(runtime.SAVE_CODE_PREFIX.length))));
    if (!envelope || envelope.v !== 2 || !envelope.i || !envelope.d) throw new Error("bad envelope");
    const decrypted = await api.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlToBytes(envelope.i) },
      await saveCodeKey(),
      base64UrlToBytes(envelope.d),
    );
    const parsed = JSON.parse(decoder.decode(new Uint8Array(decrypted)));
    if (
      !parsed
      || !Number.isInteger(parsed.version)
      || parsed.version <= 0
      || parsed.version > runtime.SAVE_VERSION
      || !parsed.state
      || typeof parsed.state !== "object"
      || Array.isArray(parsed.state)
    ) throw new Error("bad save");
    const currentSave = runtime.serializeSaveData();
    backupFailed = !runtime.backupCurrentSave("pre-import");
    if (backupFailed) return false;
    runtime.applySaveData(parsed.state, parsed.version);
    runtime.maybeForceEternity?.({ save: false, update: false });
    if (!runtime.saveGame("manual", { allowDuringLoadRecovery: true })) {
      runtime.applySaveData(currentSave.state, currentSave.version);
      runtime.setSaveStatus(runtime.t("saveCodeImportFailed"));
      return false;
    }
    if (runtime.finishLoadRecovery) runtime.finishLoadRecovery();
    runtime.updateUi();
    runtime.draw();
    runtime.setSaveStatus(runtime.t("saveCodeImported"));
    return true;
  } catch (error) {
    if (!backupFailed) {
      runtime.setSaveStatus(cryptoApi() ? runtime.t("saveCodeInvalid") : runtime.t("saveCodeCryptoUnavailable"));
    }
    return false;
  }
}

async function importSaveCodeFromUi() {
  const area = runtime.elements.saveCodeArea;
  if (area && !area.value.trim()) {
    if (runtime.elements.saveCodeDetails) runtime.elements.saveCodeDetails.open = true;
    area.focus();
    return;
  }
  const ok = await importSaveCode(area ? area.value : "");
  if (!ok) runtime.updateUi();
}

async function copySaveCodeFromUi() {
  const code = runtime.elements.saveCodeArea ? runtime.elements.saveCodeArea.value.trim() : "";
  if (!code) return;
  try {
    const clipboard = globalThis.navigator && globalThis.navigator.clipboard;
    if (clipboard && clipboard.writeText) await clipboard.writeText(code);
    else if (runtime.elements.saveCodeArea) {
      runtime.elements.saveCodeArea.focus();
      runtime.elements.saveCodeArea.select();
      document.execCommand("copy");
    }
    runtime.setSaveStatus(runtime.t("saveCodeCopied"));
  } catch (error) {
    runtime.setSaveStatus(runtime.t("saveCodeInvalid"));
  }
}

expose("bytesToBase64Url", () => bytesToBase64Url, (value) => { bytesToBase64Url = value; });
expose("base64UrlToBytes", () => base64UrlToBytes, (value) => { base64UrlToBytes = value; });
expose("cryptoApi", () => cryptoApi, (value) => { cryptoApi = value; });
expose("saveCodeKey", () => saveCodeKey, (value) => { saveCodeKey = value; });
expose("exportSaveCode", () => exportSaveCode, (value) => { exportSaveCode = value; });
expose("importSaveCode", () => importSaveCode, (value) => { importSaveCode = value; });
expose("importSaveCodeFromUi", () => importSaveCodeFromUi, (value) => { importSaveCodeFromUi = value; });
expose("copySaveCodeFromUi", () => copySaveCodeFromUi, (value) => { copySaveCodeFromUi = value; });
