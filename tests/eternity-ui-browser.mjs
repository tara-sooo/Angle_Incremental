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
    debug.state.language = "ja";
    debug.state.eternityCount = 0;
    debug.state.eternityMilestoneMask = 0;
    debug.state.eternityMilestoneChoice = "";
    debug.state.completedTowerChallenges = 0;
    debug.runtime.syncInfinityPointCachesFromExact(0n);
    debug.runtime.appliedLanguage = "";
    debug.runtime.updateUi();
  });
  await page.click('[data-tab="eternity"]');

  const initial = await page.evaluate(() => ({
    tabActive: document.querySelector('[data-tab="eternity"]')?.classList.contains("is-active"),
    panelActive: document.querySelector('[data-panel="eternity"]')?.classList.contains("is-active"),
    legacyInfinityTab: document.querySelector('[data-infinity-tab="eternity"]') !== null,
    infinitySubtabCount: document.querySelectorAll(".infinity-subtab").length,
    count: document.getElementById("eternityCountValue")?.textContent,
    tc4: document.getElementById("eternityTc4Requirement")?.textContent,
    ip: document.getElementById("eternityIpRequirement")?.textContent,
    title11: document.querySelector('[data-eternity-milestone="1-1"] [data-i18n="eternityMilestone11Name"]')?.textContent,
    title6: document.querySelector('[data-eternity-milestone="6"] [data-i18n="eternityMilestone6Name"]')?.textContent,
    status6: document.querySelector('[data-eternity-milestone="6"] .eternity-milestone-status')?.textContent,
    requirement6: document.querySelector('[data-eternity-milestone="6"] .eternity-milestone-requirement')?.textContent,
    button11: document.querySelector('[data-eternity-choice="1-1"]')?.textContent,
    disabled11: document.querySelector('[data-eternity-choice="1-1"]')?.disabled,
    entitlement: document.getElementById("eternityChoiceEntitlement")?.textContent,
    perform: document.getElementById("eternityPerformButton")?.textContent,
    performDisabled: document.getElementById("eternityPerformButton")?.disabled,
    panelText: document.querySelector('[data-panel="eternity"]')?.textContent || "",
  }));
  assert.equal(initial.tabActive, true, "Eternity should be selectable as a top-level main tab");
  assert.equal(initial.panelActive, true, "Eternity top-level panel should become active through main navigation");
  assert.equal(initial.legacyInfinityTab, false, "Infinity must not contain an Eternity subtab");
  assert.equal(initial.infinitySubtabCount, 3, "Infinity navigation should remain Upgrades / Infinite Angle / Tower");
  assert.equal(initial.count, "0", "Eternity count should be visible");
  assert.equal(initial.tc4, "未達成", "TC4 requirement should show its current state");
  assert.equal(initial.ip, "未達成", "IP requirement should show its current state");
  assert.equal(initial.title11, "1-1 QoLの精神", "Japanese Milestone copy should render");
  assert.equal(initial.title6, "6 有限回の無限チャレンジを0に", "Milestone 6 Japanese copy should render");
  assert.equal(initial.status6, "未解放", "Milestone 6 should remain locked before Eternity 27");
  assert.equal(initial.requirement6, "Eternity 27", "Milestone 6 should show its Eternity 27 requirement");
  assert.equal(initial.button11, "未解放", "first-tier Milestones should not be acquirable before the first Eternity");
  assert.equal(initial.disabled11, true, "first-tier acquisition controls should be disabled before an entitlement exists");
  assert.equal(initial.entitlement, "現在取得できるMilestoneはありません。", "the UI should explain the lack of a current acquisition right");
  assert.equal(initial.perform, "Eternity条件未達成", "manual Eternity action should expose its unavailable state");
  assert.equal(initial.performDisabled, true, "manual Eternity action should be disabled before the full requirement is met");
  assert.equal(initial.panelText.includes("Eternity Point"), false, "Eternity UI must not introduce an Eternity Point surface");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 1;
    debug.runtime.updateUi();
  });
  const earned = await page.evaluate(() => ({
    entitlement: document.getElementById("eternityChoiceEntitlement")?.textContent,
    status: document.querySelector('[data-eternity-milestone="1-1"] .eternity-milestone-status')?.textContent,
    button: document.querySelector('[data-eternity-choice="1-1"]')?.textContent,
    disabled: document.querySelector('[data-eternity-choice="1-1"]')?.disabled,
  }));
  assert.equal(earned.entitlement, "現在取得可能: 1", "one successful Eternity should expose one first-tier acquisition");
  assert.equal(earned.status, "取得可能", "unowned first-tier Milestones should show as available when entitlement exists");
  assert.equal(earned.button, "取得", "first-tier control should acquire immediately rather than reserve for the next Eternity");
  assert.equal(earned.disabled, false);

  await page.click('[data-eternity-choice="1-1"]');
  const acquired = await page.evaluate(() => ({
    mask: window.__angleDebug.state.eternityMilestoneMask,
    choice: window.__angleDebug.state.eternityMilestoneChoice,
    status: document.querySelector('[data-eternity-milestone="1-1"] .eternity-milestone-status')?.textContent,
    button: document.querySelector('[data-eternity-choice="1-1"]')?.textContent,
    entitlement: document.getElementById("eternityChoiceEntitlement")?.textContent,
  }));
  assert.equal(acquired.mask, 1, "the player-facing acquisition control should grant ownership immediately");
  assert.equal(acquired.choice, "", "the legacy pending-choice state should not be used by the new UI");
  assert.equal(acquired.status, "取得済み", "the acquired first-tier Milestone should be visibly owned");
  assert.equal(acquired.button, "取得済み", "owned first-tier Milestones should no longer offer acquisition");
  assert.equal(acquired.entitlement, "現在取得できるMilestoneはありません。", "the single earned entitlement should be consumed");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityMilestoneMask = 1;
    debug.state.eternityCount = 5;
    debug.runtime.updateUi();
  });
  const progressed = await page.evaluate(() => ({
    owned11: document.querySelector('[data-eternity-milestone="1-1"] .eternity-milestone-status')?.textContent,
    disabled11: document.querySelector('[data-eternity-choice="1-1"]')?.disabled,
    active2: document.querySelector('[data-eternity-milestone="2"] .eternity-milestone-status')?.textContent,
    locked3: document.querySelector('[data-eternity-milestone="3"] .eternity-milestone-status')?.textContent,
    locked6: document.querySelector('[data-eternity-milestone="6"] .eternity-milestone-status')?.textContent,
    entitlement: document.getElementById("eternityChoiceEntitlement")?.textContent,
  }));
  assert.equal(progressed.owned11, "取得済み", "owned first-tier Milestones should be represented as owned");
  assert.equal(progressed.disabled11, true, "owned first-tier Milestones should no longer be selectable");
  assert.equal(progressed.active2, "有効", "count-based Milestone 2 should show active at Eternity 5");
  assert.equal(progressed.locked3, "未解放", "later count-based Milestones should remain locked below their threshold");
  assert.equal(progressed.locked6, "未解放", "Milestone 6 should remain locked at Eternity 5");
  assert.equal(progressed.entitlement, "現在取得可能: 2", "unused first-tier acquisition rights should accumulate and remain visible");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 27;
    debug.runtime.updateUi();
  });
  const milestoneSix = await page.evaluate(() => ({
    status: document.querySelector('[data-eternity-milestone="6"] .eternity-milestone-status')?.textContent,
    effect: document.querySelector('[data-eternity-milestone="6"] .eternity-milestone-effect')?.textContent,
  }));
  assert.equal(milestoneSix.status, "有効", "Milestone 6 should become active at Eternity 27");
  assert.match(milestoneSix.effect || "", /IC1.*IC8.*クリア済み/, "Milestone 6 should explain the all-completed IC state");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.language = "en";
    debug.runtime.appliedLanguage = "";
    debug.runtime.updateUi();
  });
  const english = await page.evaluate(() => ({
    countLabel: document.querySelector('[data-i18n="eternityCountLabel"]')?.textContent,
    title11: document.querySelector('[data-i18n="eternityMilestone11Name"]')?.textContent,
    title6: document.querySelector('[data-i18n="eternityMilestone6Name"]')?.textContent,
    effect6: document.querySelector('[data-i18n="eternityMilestone6Effect"]')?.textContent,
    manual: document.getElementById("eternityForcedNote")?.textContent,
  }));
  assert.equal(english.countLabel, "Eternity count", "Eternity UI should switch to English when the shared language state changes");
  assert.equal(english.title11, "1-1 Spirit of QoL", "Milestone names should have English copy");
  assert.equal(english.title6, "6 Finite Infinity Challenges", "Milestone 6 should have English copy");
  assert.match(english.effect6 || "", /Eternity 27\+.*IC1.*IC8.*completed/, "Milestone 6 English copy should describe the completed IC state");
  assert.match(english.manual || "", /manually/, "English copy should explain that Eternity is player-triggered");
  assert.doesNotMatch(english.manual || "", /performed automatically/, "English copy must not describe forced pre-Break Eternity");

  await page.setViewportSize({ width: 412, height: 915 });
  const mobile = await page.evaluate(() => ({
    visible: document.querySelector('[data-panel="eternity"]')?.classList.contains("is-active"),
    width: document.querySelector('[data-panel="eternity"]')?.getBoundingClientRect().width || 0,
    firstButtonWidth: document.querySelector('[data-eternity-choice="1-2"]')?.getBoundingClientRect().width || 0,
    performWidth: document.getElementById("eternityPerformButton")?.getBoundingClientRect().width || 0,
  }));
  assert.equal(mobile.visible, true, "Eternity top-level panel should remain usable at a mobile viewport");
  assert.ok(mobile.width > 0 && mobile.firstButtonWidth > 0 && mobile.performWidth > 0, "Eternity controls should keep a visible mobile layout");

  console.log("Eternity UI browser test passed");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
