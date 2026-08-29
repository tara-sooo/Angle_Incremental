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
    debug.state.infinityUpgradeMask = 0;
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
    title7: document.querySelector('[data-eternity-milestone="7"] [data-i18n="eternityMilestone7Name"]')?.textContent,
    status7: document.querySelector('[data-eternity-milestone="7"] .eternity-milestone-status')?.textContent,
    requirement7: document.querySelector('[data-eternity-milestone="7"] .eternity-milestone-requirement')?.textContent,
    title8: document.querySelector('[data-eternity-milestone="8"] [data-i18n="eternityMilestone8Name"]')?.textContent,
    status8: document.querySelector('[data-eternity-milestone="8"] .eternity-milestone-status')?.textContent,
    requirement8: document.querySelector('[data-eternity-milestone="8"] .eternity-milestone-requirement')?.textContent,
    title9: document.querySelector('[data-eternity-milestone="9"] [data-i18n="eternityMilestone9Name"]')?.textContent,
    status9: document.querySelector('[data-eternity-milestone="9"] .eternity-milestone-status')?.textContent,
    requirement9: document.querySelector('[data-eternity-milestone="9"] .eternity-milestone-requirement')?.textContent,
    autoIaSpeedDisabled: document.getElementById("autoBuyInfiniteAngleSpeedToggle")?.disabled,
    autoIaVertexDisabled: document.getElementById("autoBuyInfiniteAngleVertexToggle")?.disabled,
    autoIaGainDisabled: document.getElementById("autoBuyInfiniteAngleGainToggle")?.disabled,
    autoTowerDisabled: document.getElementById("autoBuildTowerToggle")?.disabled,
    autoInfinityUpgradesDisabled: document.getElementById("autoBuyInfinityUpgradesToggle")?.disabled,
    autoIaSpeedChecked: document.getElementById("autoBuyInfiniteAngleSpeedToggle")?.checked,
    autoTowerChecked: document.getElementById("autoBuildTowerToggle")?.checked,
    autoInfinityUpgradesChecked: document.getElementById("autoBuyInfinityUpgradesToggle")?.checked,
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
  assert.equal(initial.title7, "7 ワンポイントチャレンジ", "Milestone 7 Japanese copy should render");
  assert.equal(initial.status7, "未解放", "Milestone 7 should remain locked before Eternity 44");
  assert.equal(initial.requirement7, "Eternity 44", "Milestone 7 should show its Eternity 44 requirement");
  assert.equal(initial.title8, "8 バベル・オブ・インフィニット", "Milestone 8 Japanese copy should render");
  assert.equal(initial.status8, "未解放", "Milestone 8 should remain locked before Eternity 81");
  assert.equal(initial.requirement8, "Eternity 81", "Milestone 8 should show its Eternity 81 requirement");
  assert.equal(initial.title9, "9 煩悩まみれ", "Milestone 9 Japanese copy should render");
  assert.equal(initial.status9, "未解放", "Milestone 9 should remain locked before Eternity 108");
  assert.equal(initial.requirement9, "Eternity 108", "Milestone 9 should show its Eternity 108 requirement");
  assert.equal(initial.autoIaSpeedDisabled, true, "IA Speed automation should be unavailable before Milestone 8");
  assert.equal(initial.autoIaVertexDisabled, true, "IA Vertex automation should be unavailable before Milestone 8");
  assert.equal(initial.autoIaGainDisabled, true, "IA Gain automation should be unavailable before Milestone 8");
  assert.equal(initial.autoTowerDisabled, true, "Tower automation should be unavailable before Milestone 8");
  assert.equal(initial.autoInfinityUpgradesDisabled, true, "Infinity Upgrade automation should be unavailable before Milestone 5");
  assert.equal(initial.autoIaSpeedChecked, false, "IA Speed automation should default off");
  assert.equal(initial.autoTowerChecked, false, "Tower automation should default off");
  assert.equal(initial.autoInfinityUpgradesChecked, false, "Infinity Upgrade automation should default off");
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
    locked7: document.querySelector('[data-eternity-milestone="7"] .eternity-milestone-status')?.textContent,
    entitlement: document.getElementById("eternityChoiceEntitlement")?.textContent,
  }));
  assert.equal(progressed.owned11, "取得済み", "owned first-tier Milestones should be represented as owned");
  assert.equal(progressed.disabled11, true, "owned first-tier Milestones should no longer be selectable");
  assert.equal(progressed.active2, "有効", "count-based Milestone 2 should show active at Eternity 5");
  assert.equal(progressed.locked3, "未解放", "later count-based Milestones should remain locked below their threshold");
  assert.equal(progressed.locked6, "未解放", "Milestone 6 should remain locked at Eternity 5");
  assert.equal(progressed.locked7, "未解放", "Milestone 7 should remain locked at Eternity 5");
  assert.equal(progressed.entitlement, "現在取得可能: 2", "unused first-tier acquisition rights should accumulate and remain visible");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 20;
    debug.state.eternityMilestoneMask = 0;
    debug.runtime.updateUi();
  });
  const milestoneFiveAutomation = await page.evaluate(() => ({
    toggleDisabled: document.getElementById("autoBuyInfinityUpgradesToggle")?.disabled,
    toggleChecked: document.getElementById("autoBuyInfinityUpgradesToggle")?.checked,
    automationTabHidden: document.querySelector('[data-tab="automation"]')?.hidden,
  }));
  assert.equal(milestoneFiveAutomation.toggleDisabled, false, "Milestone 5 should enable the Infinity Upgrade automation toggle");
  assert.equal(milestoneFiveAutomation.toggleChecked, false, "Milestone 5 should leave the Infinity Upgrade automation toggle off");
  assert.equal(milestoneFiveAutomation.automationTabHidden, true, "Milestone 5 must not change the separate top-level Automation unlock");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityMilestoneMask = 1;
    debug.runtime.updateUi();
  });
  await page.click('[data-tab="automation"]');
  await page.locator("#autoBuyInfinityUpgradesToggle").check();
  assert.equal(
    await page.evaluate(() => window.__angleDebug.state.autoBuyInfinityUpgrades),
    true,
    "the Infinity Upgrade automation toggle should update the persisted setting",
  );
  await page.click('[data-tab="eternity"]');

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
    debug.state.eternityCount = 43;
    debug.runtime.updateUi();
  });
  const milestoneSevenLocked = await page.evaluate(() => ({
    status: document.querySelector('[data-eternity-milestone="7"] .eternity-milestone-status')?.textContent,
    requirement: document.querySelector('[data-eternity-milestone="7"] .eternity-milestone-requirement')?.textContent,
  }));
  assert.equal(milestoneSevenLocked.status, "未解放", "Milestone 7 should remain locked at Eternity 43");
  assert.equal(milestoneSevenLocked.requirement, "Eternity 44", "Milestone 7 should keep its Eternity 44 requirement while locked");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 44;
    debug.runtime.updateUi();
  });
  const milestoneSeven = await page.evaluate(() => ({
    status: document.querySelector('[data-eternity-milestone="7"] .eternity-milestone-status')?.textContent,
    effect: document.querySelector('[data-eternity-milestone="7"] .eternity-milestone-effect')?.textContent,
  }));
  assert.equal(milestoneSeven.status, "有効", "Milestone 7 should become active at Eternity 44");
  assert.match(milestoneSeven.effect || "", /Eternity 44.*Tower Challenge.*解放階.*クリア済み/, "Milestone 7 should explain auto-completion at normal unlock floors");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 80;
    debug.runtime.updateUi();
  });
  const milestoneEightLocked = await page.evaluate(() => ({
    status: document.querySelector('[data-eternity-milestone="8"] .eternity-milestone-status')?.textContent,
    controlsDisabled: [
      document.getElementById("autoBuyInfiniteAngleSpeedToggle")?.disabled,
      document.getElementById("autoBuyInfiniteAngleVertexToggle")?.disabled,
      document.getElementById("autoBuyInfiniteAngleGainToggle")?.disabled,
      document.getElementById("autoBuildTowerToggle")?.disabled,
    ],
  }));
  assert.equal(milestoneEightLocked.status, "未解放", "Milestone 8 should remain locked at Eternity 80");
  assert.deepEqual(milestoneEightLocked.controlsDisabled, [true, true, true, true], "Milestone 8 controls should remain disabled at Eternity 80");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 81;
    debug.runtime.updateUi();
  });
  const milestoneEight = await page.evaluate(() => ({
    status: document.querySelector('[data-eternity-milestone="8"] .eternity-milestone-status')?.textContent,
    effect: document.querySelector('[data-eternity-milestone="8"] .eternity-milestone-effect')?.textContent,
    controlsDisabled: [
      document.getElementById("autoBuyInfiniteAngleSpeedToggle")?.disabled,
      document.getElementById("autoBuyInfiniteAngleVertexToggle")?.disabled,
      document.getElementById("autoBuyInfiniteAngleGainToggle")?.disabled,
      document.getElementById("autoBuildTowerToggle")?.disabled,
    ],
  }));
  assert.equal(milestoneEight.status, "有効", "Milestone 8 should activate at Eternity 81");
  assert.match(milestoneEight.effect || "", /Eternity 81.*IA.*Tower.*自動/, "Milestone 8 should describe IA and Tower automation");
  assert.deepEqual(milestoneEight.controlsDisabled, [false, false, false, false], "Milestone 8 controls should be available at Eternity 81");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 107;
    debug.runtime.updateUi();
  });
  const milestoneNineLocked = await page.evaluate(() => ({
    status: document.querySelector('[data-eternity-milestone="9"] .eternity-milestone-status')?.textContent,
    requirement: document.querySelector('[data-eternity-milestone="9"] .eternity-milestone-requirement')?.textContent,
  }));
  assert.equal(milestoneNineLocked.status, "未解放", "Milestone 9 should remain locked at Eternity 107");
  assert.equal(milestoneNineLocked.requirement, "Eternity 108", "Milestone 9 should keep its Eternity 108 requirement while locked");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 108;
    debug.runtime.updateUi();
  });
  const milestoneNine = await page.evaluate(() => ({
    status: document.querySelector('[data-eternity-milestone="9"] .eternity-milestone-status')?.textContent,
    effect: document.querySelector('[data-eternity-milestone="9"] .eternity-milestone-effect')?.textContent,
  }));
  assert.equal(milestoneNine.status, "有効", "Milestone 9 should activate at Eternity 108");
  assert.match(milestoneNine.effect || "", /Eternity 108.*1000.*IP.*開始/, "Milestone 9 should describe the 1000 IP starting baseline");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 127;
    debug.runtime.updateUi();
  });
  const milestoneTenLocked = await page.evaluate(() => ({
    status: document.querySelector('[data-eternity-milestone="10"] .eternity-milestone-status')?.textContent,
    requirement: document.querySelector('[data-eternity-milestone="10"] .eternity-milestone-requirement')?.textContent,
  }));
  assert.equal(milestoneTenLocked.status, "未解放", "Milestone 10 should remain locked at Eternity 127");
  assert.equal(milestoneTenLocked.requirement, "Eternity 128", "Milestone 10 should require Eternity 128");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 128;
    debug.runtime.updateUi();
  });
  const milestoneTen = await page.evaluate(() => ({
    status: document.querySelector('[data-eternity-milestone="10"] .eternity-milestone-status')?.textContent,
    effect: document.querySelector('[data-eternity-milestone="10"] .eternity-milestone-effect')?.textContent,
  }));
  assert.equal(milestoneTen.status, "有効", "Milestone 10 should activate at Eternity 128");
  assert.match(milestoneTen.effect || "", /Eternity 128.*Infinity Point.*上限.*解除/, "Milestone 10 should describe Break Eternity without changing the requirement");

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
    title7: document.querySelector('[data-i18n="eternityMilestone7Name"]')?.textContent,
    effect7: document.querySelector('[data-i18n="eternityMilestone7Effect"]')?.textContent,
    title8: document.querySelector('[data-i18n="eternityMilestone8Name"]')?.textContent,
    effect8: document.querySelector('[data-i18n="eternityMilestone8Effect"]')?.textContent,
    title9: document.querySelector('[data-i18n="eternityMilestone9Name"]')?.textContent,
    effect9: document.querySelector('[data-i18n="eternityMilestone9Effect"]')?.textContent,
    title10: document.querySelector('[data-i18n="eternityMilestone10Name"]')?.textContent,
    effect10: document.querySelector('[data-i18n="eternityMilestone10Effect"]')?.textContent,
    manual: document.getElementById("eternityForcedNote")?.textContent,
  }));
  assert.equal(english.countLabel, "Eternity count", "Eternity UI should switch to English when the shared language state changes");
  assert.equal(english.title11, "1-1 Spirit of QoL", "Milestone names should have English copy");
  assert.equal(english.title6, "6 Finite Infinity Challenges", "Milestone 6 should have English copy");
  assert.match(english.effect6 || "", /Eternity 27\+.*IC1.*IC8.*completed/, "Milestone 6 English copy should describe the completed IC state");
  assert.equal(english.title7, "7 One-Point Challenges", "Milestone 7 should have English copy");
  assert.match(english.effect7 || "", /Eternity 44\+.*Tower Challenge.*completed.*normal unlock floor/, "Milestone 7 English copy should describe the normal unlock completion state");
  assert.equal(english.title8, "8 Babel of Infinite", "Milestone 8 should have English copy");
  assert.match(english.effect8 || "", /Eternity 81\+.*Infinite Angle.*Tower.*auto/, "Milestone 8 English copy should describe IA and Tower automation");
  assert.equal(english.title9, "9 Worldly Desires", "Milestone 9 should have English copy");
  assert.match(english.effect9 || "", /Eternity 108\+.*1000.*Infinity Points/, "Milestone 9 English copy should describe the 1000 IP starting baseline");
  assert.equal(english.title10, "10 Eternity Is Balance", "Milestone 10 should have English copy");
  assert.match(english.effect10 || "", /Eternity 128\+.*Infinity Point cap.*requirement remains unchanged/, "Milestone 10 English copy should describe the uncapped IP range and unchanged requirement");
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
