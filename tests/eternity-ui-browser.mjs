import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function resolveRequestPath(requestUrl) {
  const parsed = new URL(requestUrl, "http://127.0.0.1");
  const requested = decodeURIComponent(parsed.pathname === "/" ? "/index.html" : parsed.pathname);
  const relative = path.normalize(requested.replace(/^\/+/, ""));
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return path.join(root, relative);
}

const server = createServer(async (request, response) => {
  const filePath = resolveRequestPath(request.url || "/");
  if (!filePath) {
    response.writeHead(403).end();
    return;
  }
  try {
    const metadata = await stat(filePath);
    if (!metadata.isFile()) throw new Error("not a file");
    response.writeHead(200, { "content-type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string") throw new Error("failed to bind Eternity UI test server");

const browser = await chromium.launch({ headless: true, args: ["--use-gl=disabled"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => window.__angleDebug.ready);
  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.runtime.closeUpdateModal?.();
    debug.switchMainTab("infinity");
    debug.switchInfinitySubtab("eternity");
    debug.state.language = "ja";
    debug.state.eternityCount = 0;
    debug.state.eternityMilestoneMask = 0;
    debug.state.eternityMilestoneChoice = "";
    debug.state.completedTowerChallenges = 0;
    debug.runtime.syncInfinityPointCachesFromExact(0n);
    debug.runtime.appliedLanguage = "";
    debug.runtime.updateUi();
  });

  const initial = await page.evaluate(() => ({
    tabActive: document.querySelector('[data-infinity-tab="eternity"]')?.classList.contains("is-active"),
    panelActive: document.querySelector('[data-infinity-panel="eternity"]')?.classList.contains("is-active"),
    count: document.getElementById("eternityCountValue")?.textContent,
    tc4: document.getElementById("eternityTc4Requirement")?.textContent,
    ip: document.getElementById("eternityIpRequirement")?.textContent,
    title11: document.querySelector('[data-eternity-milestone="1-1"] [data-i18n="eternityMilestone11Name"]')?.textContent,
    button11: document.querySelector('[data-eternity-choice="1-1"]')?.textContent,
    panelText: document.querySelector('[data-infinity-panel="eternity"]')?.textContent || "",
  }));
  assert.equal(initial.tabActive, true, "Eternity subtab should be selectable through the normal Infinity UI");
  assert.equal(initial.panelActive, true, "Eternity panel should become active through the normal subtab path");
  assert.equal(initial.count, "0", "Eternity count should be visible");
  assert.equal(initial.tc4, "未達成", "TC4 requirement should show its current state");
  assert.equal(initial.ip, "未達成", "IP requirement should show its current state");
  assert.equal(initial.title11, "1-1 QoLの精神", "Japanese Milestone copy should render");
  assert.equal(initial.button11, "次のEternityで選択", "unowned first-tier Milestones should expose a normal selection control");
  assert.equal(initial.panelText.includes("Eternity Point"), false, "Eternity UI must not introduce an Eternity Point surface");

  await page.click('[data-eternity-choice="1-1"]');
  const selected = await page.evaluate(() => ({
    choice: window.__angleDebug.state.eternityMilestoneChoice,
    status: document.querySelector('[data-eternity-milestone="1-1"] .eternity-milestone-status')?.textContent,
    button: document.querySelector('[data-eternity-choice="1-1"]')?.textContent,
  }));
  assert.equal(selected.choice, "1-1", "the player-facing choice control should route through the authoritative pending-choice state");
  assert.equal(selected.status, "次回取得予定", "the selected first-tier Milestone should be visibly pending");
  assert.equal(selected.button, "選択中", "the selected choice button should show its state");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityMilestoneMask = 1;
    debug.state.eternityMilestoneChoice = "";
    debug.state.eternityCount = 5;
    debug.runtime.updateUi();
  });
  const progressed = await page.evaluate(() => ({
    owned11: document.querySelector('[data-eternity-milestone="1-1"] .eternity-milestone-status')?.textContent,
    disabled11: document.querySelector('[data-eternity-choice="1-1"]')?.disabled,
    active2: document.querySelector('[data-eternity-milestone="2"] .eternity-milestone-status')?.textContent,
    locked3: document.querySelector('[data-eternity-milestone="3"] .eternity-milestone-status')?.textContent,
  }));
  assert.equal(progressed.owned11, "取得済み", "owned first-tier Milestones should be represented as owned");
  assert.equal(progressed.disabled11, true, "owned first-tier Milestones should no longer be selectable");
  assert.equal(progressed.active2, "有効", "count-based Milestone 2 should show active at Eternity 5");
  assert.equal(progressed.locked3, "未解放", "later count-based Milestones should remain locked below their threshold");

  await page.selectOption("#languageSelect", "en");
  const english = await page.evaluate(() => ({
    countLabel: document.querySelector('[data-i18n="eternityCountLabel"]')?.textContent,
    title11: document.querySelector('[data-i18n="eternityMilestone11Name"]')?.textContent,
    forced: document.getElementById("eternityForcedNote")?.textContent,
  }));
  assert.equal(english.countLabel, "Eternity count", "Eternity UI should switch to English through the normal language control");
  assert.equal(english.title11, "1-1 Spirit of QoL", "Milestone names should have English copy");
  assert.match(english.forced || "", /performed automatically/, "English copy should explain forced pre-Break Eternity");

  await page.setViewportSize({ width: 412, height: 915 });
  const mobile = await page.evaluate(() => ({
    visible: document.querySelector('[data-infinity-panel="eternity"]')?.classList.contains("is-active"),
    width: document.querySelector('[data-infinity-panel="eternity"]')?.getBoundingClientRect().width || 0,
    firstButtonWidth: document.querySelector('[data-eternity-choice="1-2"]')?.getBoundingClientRect().width || 0,
  }));
  assert.equal(mobile.visible, true, "Eternity panel should remain usable at a mobile viewport");
  assert.ok(mobile.width > 0 && mobile.firstButtonWidth > 0, "Eternity controls should keep a visible mobile layout");

  console.log("Eternity UI browser test passed");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
