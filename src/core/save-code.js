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

const SAVE_BACKUP_FILE_FORMAT = "angle-incremental-save-backup";
const SAVE_BACKUP_FILE_VERSION = 1;

function createSaveBackupFile() {
  const save = runtime.serializeSaveData();
  const timestamp = new Date(save.savedAt).toISOString();
  return {
    filename: `angle-incremental-save-${timestamp.slice(0, 10)}-${timestamp.slice(11, 19).replace(/:/g, "")}.json`,
    contents: JSON.stringify({
      format: SAVE_BACKUP_FILE_FORMAT,
      formatVersion: SAVE_BACKUP_FILE_VERSION,
      save,
    }, null, 2),
  };
}

function parseSaveBackupFile(contents) {
  const file = JSON.parse(String(contents));
  if (!file || file.format !== SAVE_BACKUP_FILE_FORMAT || file.formatVersion !== SAVE_BACKUP_FILE_VERSION) {
    throw new Error("unsupported backup file");
  }
  const save = runtime.normalizeStoredSave(file.save);
  if (!save) throw new Error("invalid save");
  return save;
}

function downloadSaveBackupFile(contents, filename) {
  const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function exportSaveBackupFile() {
  if (runtime.loadRecoveryMode && !runtime.saveConflictMode) {
    runtime.setSaveStatus(runtime.t("loadRecoveryRequired"));
    return false;
  }
  try {
    const backup = createSaveBackupFile();
    const navigatorApi = globalThis.navigator;
    if (typeof File === "function"
      && typeof navigatorApi?.share === "function"
      && typeof navigatorApi.canShare === "function") {
      const file = new File([backup.contents], backup.filename, { type: "application/json" });
      let canShareFile = false;
      try {
        canShareFile = navigatorApi.canShare({ files: [file] });
      } catch (error) {
        canShareFile = false;
      }
      if (canShareFile) {
        try {
          await navigatorApi.share({ files: [file], title: runtime.t("saveBackupShareTitle") });
          runtime.setSaveStatus(runtime.t("saveBackupExported"));
          return true;
        } catch (error) {
          if (error?.name === "AbortError") return false;
        }
      }
    }
    downloadSaveBackupFile(backup.contents, backup.filename);
    runtime.setSaveStatus(runtime.t("saveBackupExported"));
    return true;
  } catch (error) {
    runtime.setSaveStatus(runtime.t("saveBackupExportFailed"));
    return false;
  }
}

async function importSaveBackupFile(contents) {
  if (runtime.saveConflictMode) {
    runtime.setSaveStatus(runtime.t("saveConflictDetected"));
    return false;
  }
  let save;
  try {
    save = parseSaveBackupFile(contents);
  } catch (error) {
    runtime.setSaveStatus(runtime.t("saveBackupInvalid"));
    return false;
  }
  if (!await runtime.replaceSave(save, "pre-restore")) return false;
  runtime.setSaveStatus(runtime.t("saveBackupImported"));
  return true;
}

async function importSaveBackupFileFromUi() {
  const input = runtime.elements.saveBackupFileInput;
  const file = input?.files?.[0];
  if (!file) return false;
  try {
    return await importSaveBackupFile(await file.text());
  } catch (error) {
    runtime.setSaveStatus(runtime.t("saveBackupInvalid"));
    return false;
  } finally {
    input.value = "";
  }
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
    const parsed = runtime.normalizeStoredSave(JSON.parse(decoder.decode(new Uint8Array(decrypted))));
    if (!parsed || !await runtime.replaceSave(parsed, "pre-import")) return false;
    runtime.setSaveStatus(runtime.t("saveCodeImported"));
    return true;
  } catch (error) {
    runtime.setSaveStatus(cryptoApi() ? runtime.t("saveCodeInvalid") : runtime.t("saveCodeCryptoUnavailable"));
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
expose("createSaveBackupFile", () => createSaveBackupFile);
expose("parseSaveBackupFile", () => parseSaveBackupFile);
expose("exportSaveBackupFile", () => exportSaveBackupFile);
expose("importSaveBackupFile", () => importSaveBackupFile);
expose("importSaveBackupFileFromUi", () => importSaveBackupFileFromUi);
expose("exportSaveCode", () => exportSaveCode, (value) => { exportSaveCode = value; });
expose("importSaveCode", () => importSaveCode, (value) => { importSaveCode = value; });
expose("importSaveCodeFromUi", () => importSaveCodeFromUi, (value) => { importSaveCodeFromUi = value; });
expose("copySaveCodeFromUi", () => copySaveCodeFromUi, (value) => { copySaveCodeFromUi = value; });
