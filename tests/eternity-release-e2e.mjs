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
const ACHIEVEMENT_38_TO_41_MASK = [38, 39, 40, 41]
  .reduce((mask, id) => mask | (1 << (id - 32)), 0);

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
if (!address || typeof address === "string") throw new Error("failed to bind Eternity release E2E server");

const browser = await chromium.launch({ headless: true, args: ["--use-gl=disabled"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const url = `http://127.0.0.1:${address.port}/`;

async function waitForGame() {
  await page.evaluate(() => window.__angleDebug.ready);
  await page.evaluate(() => window.__angleDebug.runtime.closeUpdateModal?.());
  const offlineReportClose = page.locator("#offlineReportClose");
  if (await offlineReportClose.isVisible()) await offlineReportClose.click();
}

async function openEternityThroughUi() {
  await page.click('[data-tab="eternity"]');
  assert.equal(
    await page.locator('[data-panel="eternity"]').evaluate((element) => element.classList.contains("is-active")),
    true,
    "Eternity should be reachable through the normal player-facing top-level navigation",
  );
  assert.equal(
    await page.locator('[data-infinity-tab="eternity"]').count(),
    0,
    "Infinity must not expose Eternity as a nested subtab",
  );
}

async function chooseFirstTier(id) {
  await openEternityThroughUi();
  await page.click(`[data-eternity-choice="${id}"]`);
  assert.equal(
    await page.evaluate(() => window.__angleDebug.state.eternityMilestoneChoice),
    id,
    `normal Eternity UI should select ${id} for the next successful Eternity`,
  );
}

async function clearTc4AtTarget() {
  const result = await page.evaluate(() => {
    const debug = window.__angleDebug;
    const { runtime, state } = debug;
    state.towerFloor = 12;
    state.infinityCount = Math.max(1, state.infinityCount);
    if (state.activeTowerChallenge !== 4 && !debug.toggleTowerChallenge(4)) {
      return { error: "failed to enter TC4" };
    }
    state.infinityCount = Math.max(1, state.infinityCount);
    state.score = Number.MAX_VALUE;
    const target = runtime.towerChallengeTargetLog10(4);
    state.scoreLog10 = runtime.rawScoreLog10FromEffective(target - 1);
    const belowEffectiveScore = runtime.currentScoreLog10();
    const belowTarget = runtime.towerChallengeCanComplete(4);
    state.scoreLog10 = runtime.rawScoreLog10FromEffective(target);
    const atEffectiveScore = runtime.currentScoreLog10();
    const atTarget = runtime.towerChallengeCanComplete(4);
    const completed = debug.completeTowerChallengeIfReady();
    return {
      target,
      belowEffectiveScore,
      atEffectiveScore,
      belowTarget,
      atTarget,
      completed,
      active: state.activeTowerChallenge,
      completedMask: state.completedTowerChallenges,
      achievement40: runtime.isAchievementUnlocked(40),
    };
  });
  assert.equal(result.error, undefined, result.error || "TC4 entry should succeed");
  assert.equal(result.target, 7777, "the shipped TC4 target should remain exactly 1e7777 Score");
  assert.ok(result.belowEffectiveScore < 7777, "the controlled below-target fixture should be below 1e7777 effective Score");
  assert.equal(result.belowTarget, false, "TC4 must not complete below 1e7777 Score");
  assert.ok(result.atEffectiveScore >= 7777, "the target fixture should reach at least 1e7777 effective Score");
  assert.equal(result.atTarget, true, "TC4 should become completable at exactly 1e7777 Score");
  assert.equal(result.completed, true, "the authoritative TC4 completion path should clear at the target");
  assert.equal(result.active, 0, "TC4 should leave the active challenge state after completion");
  assert.notEqual(result.completedMask & (1 << 3), 0, "TC4 completion should set the current-run completion bit");
  assert.equal(result.achievement40, true, "TC4 completion should grant Achievement 40 through the normal achievement path");
}

async function forceQualifiedEternity() {
  return page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.runtime.syncInfinityPointCachesFromExact(debug.runtime.MAX_EXACT_INFINITY_POINTS);
    const canEternity = debug.canEternity();
    const performed = debug.maybeForceEternity({ save: false, update: false });
    debug.runtime.updateUi();
    return { canEternity, performed };
  });
}

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await waitForGame();

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.language = "ja";
    debug.runtime.appliedLanguage = "";
    debug.state.eternityCount = 0;
    debug.state.eternityMilestoneMask = 0;
    debug.state.eternityMilestoneChoice = "";
    debug.state.achievementMaskHigh = (1 << (38 - 32)) | (1 << (39 - 32));
    debug.state.timeFlux = 246;
    debug.state.timeFluxCapacityLevel = 2;
    debug.state.timeFluxGainLevel = 3;
    debug.state.timeFluxSpeed = 4;
    debug.state.timeFluxCustomSpeed = 5;
    debug.runtime.syncInfinityPointCachesFromExact(0n);
    debug.runtime.updateUi();
  });

  await openEternityThroughUi();
  const releaseCopy = await page.evaluate(() => ({
    missingKeys: Array.from(document.querySelectorAll('[data-panel="eternity"] [data-i18n]'))
      .filter((element) => !element.textContent.trim()).map((element) => element.dataset.i18n),
    panelText: document.querySelector('[data-panel="eternity"]')?.textContent || "",
    tc4Reward: window.__angleDebug.runtime.towerChallengeReward(4),
  }));
  assert.deepEqual(releaseCopy.missingKeys, [], "Japanese Eternity release UI should not contain missing/placeholder i18n strings");
  assert.equal(releaseCopy.panelText.includes("Eternity Point"), false, "release UI must not introduce an Eternity Point surface");
  assert.match(releaseCopy.tc4Reward, /Eternity周回/, "TC4 reward copy should describe the shipped Eternity requirement rather than a future placeholder");

  await chooseFirstTier("1-1");
  await clearTc4AtTarget();

  const beforeFullRequirement = await page.evaluate(() => {
    const debug = window.__angleDebug;
    return {
      canEternity: debug.canEternity(),
      forced: debug.maybeForceEternity({ save: false, update: false }),
      count: debug.state.eternityCount,
    };
  });
  assert.equal(beforeFullRequirement.canEternity, false, "TC4 completion alone must not satisfy Eternity without 1.80e308 IP");
  assert.equal(beforeFullRequirement.forced, false, "pre-Break Eternity must not fire before the full requirement is met");
  assert.equal(beforeFullRequirement.count, 0, "failed Eternity eligibility must not increment Eternity count");

  const firstEternity = await forceQualifiedEternity();
  assert.equal(firstEternity.canEternity, true, "TC4 completion plus 1.80e308 IP should satisfy Eternity");
  assert.equal(firstEternity.performed, true, "the pre-Break forced Eternity path should execute exactly once when qualified");

  const firstState = await page.evaluate(() => {
    const debug = window.__angleDebug;
    return {
      count: debug.state.eternityCount,
      mask: debug.state.eternityMilestoneMask,
      choice: debug.state.eternityMilestoneChoice,
      completedTc: debug.state.completedTowerChallenges,
      achievement40: debug.runtime.isAchievementUnlocked(40),
      achievement41: debug.runtime.isAchievementUnlocked(41),
      timeFlux: debug.state.timeFlux,
      timeFluxCapacityLevel: debug.state.timeFluxCapacityLevel,
      timeFluxGainLevel: debug.state.timeFluxGainLevel,
      timeFluxSpeed: debug.state.timeFluxSpeed,
      timeFluxCustomSpeed: debug.state.timeFluxCustomSpeed,
    };
  });
  assert.equal(firstState.count, 1, "first Eternity should increment count exactly once");
  assert.equal(firstState.mask, 1, "first Eternity should acquire only the selected 1-1 Milestone");
  assert.equal(firstState.choice, "", "first Eternity should consume the pending first-tier choice");
  assert.equal(firstState.completedTc, 0, "Eternity should reset all current-run TC completion");
  assert.equal(firstState.achievement40, true, "Achievement 40 should persist after TC4 completion is reset");
  assert.equal(firstState.achievement41, true, "the first successful Eternity should grant Achievement 41");
  assert.deepEqual(
    [firstState.timeFlux, firstState.timeFluxCapacityLevel, firstState.timeFluxGainLevel, firstState.timeFluxSpeed, firstState.timeFluxCustomSpeed],
    [246, 2, 3, 4, 5],
    "all global Time Flux gameplay state should persist through Eternity",
  );

  await page.evaluate(() => window.__angleDebug.saveGame("manual"));
  await page.reload({ waitUntil: "networkidle" });
  await waitForGame();
  const reloaded = await page.evaluate(() => {
    const debug = window.__angleDebug;
    return {
      count: debug.state.eternityCount,
      mask: debug.state.eternityMilestoneMask,
      choice: debug.state.eternityMilestoneChoice,
      completedTc: debug.state.completedTowerChallenges,
      achievementMaskHigh: debug.state.achievementMaskHigh,
      timeFlux: debug.state.timeFlux,
    };
  });
  assert.equal(reloaded.count, 1, "normal browser save/load should retain Eternity count");
  assert.equal(reloaded.mask, 1, "normal browser save/load should retain first-tier ownership");
  assert.equal(reloaded.choice, "", "normal browser save/load should not resurrect the consumed first-tier choice");
  assert.equal(reloaded.completedTc, 0, "normal browser save/load should not resurrect pre-Eternity TC completion");
  assert.equal(reloaded.achievementMaskHigh & ACHIEVEMENT_38_TO_41_MASK, ACHIEVEMENT_38_TO_41_MASK, "Achievements 38-41 should all persist through the first Eternity and reload");
  assert.equal(reloaded.timeFlux, 246, "global Time Flux should persist through browser save/load");

  await chooseFirstTier("1-2");
  const rebuilt = await page.evaluate(() => {
    const debug = window.__angleDebug;
    const { runtime, state } = debug;
    state.completedTowerChallenges = 0b111;
    runtime.syncInfinityPointCachesFromExact(runtime.MAX_EXACT_INFINITY_POINTS);
    const floors = [];
    for (let index = 0; index < 12; index += 1) {
      floors.push(debug.buildTower());
    }
    runtime.syncInfinityPointCachesFromExact(0n);
    return {
      floors,
      towerFloor: state.towerFloor,
      prerequisiteMask: state.completedTowerChallenges,
    };
  });
  assert.equal(rebuilt.floors.every(Boolean), true, "post-Eternity run should rebuild the Tower through the normal build action once prerequisite TC fixtures are satisfied");
  assert.equal(rebuilt.towerFloor, 12, "post-Eternity rebuild should reach the TC4 unlock floor");
  assert.equal(rebuilt.prerequisiteMask & 0b111, 0b111, "controlled rebuild fixture should retain re-cleared TC1-TC3 prerequisites");

  await clearTc4AtTarget();
  const secondEternity = await forceQualifiedEternity();
  assert.equal(secondEternity.canEternity, true, "the rebuilt run should qualify for a second Eternity after re-clearing TC4");
  assert.equal(secondEternity.performed, true, "the second qualified run should perform Eternity");
  const secondState = await page.evaluate(() => ({
    count: window.__angleDebug.state.eternityCount,
    mask: window.__angleDebug.state.eternityMilestoneMask,
    completedTc: window.__angleDebug.state.completedTowerChallenges,
    achievementMaskHigh: window.__angleDebug.state.achievementMaskHigh,
    timeFlux: window.__angleDebug.state.timeFlux,
  }));
  assert.equal(secondState.count, 2, "the representative TC4 -> Eternity -> rebuild -> TC4 -> Eternity loop should reach Eternity count 2");
  assert.equal(secondState.mask, 3, "the second Eternity should acquire 1-2 without duplicating 1-1");
  assert.equal(secondState.completedTc, 0, "the second Eternity should reset TC completion again");
  assert.equal(secondState.achievementMaskHigh & ACHIEVEMENT_38_TO_41_MASK, ACHIEVEMENT_38_TO_41_MASK, "Achievements 38-41 should remain persistent across repeated Eternities");
  assert.equal(secondState.timeFlux, 246, "global Time Flux should remain persistent across repeated Eternities");

  await chooseFirstTier("1-3");
  const thresholdState = await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 4;
    debug.state.completedTowerChallenges = 1 << 3;
    debug.runtime.syncInfinityPointCachesFromExact(debug.runtime.MAX_EXACT_INFINITY_POINTS);
    const before = debug.runtime.eternityMilestoneActive("2");
    const performed = debug.maybeForceEternity({ save: false, update: false });
    debug.runtime.updateUi();
    return {
      before,
      performed,
      count: debug.state.eternityCount,
      mask: debug.state.eternityMilestoneMask,
      milestone2: debug.runtime.eternityMilestoneActive("2"),
    };
  });
  assert.equal(thresholdState.before, false, "Milestone 2 should remain inactive at Eternity count 4");
  assert.equal(thresholdState.performed, true, "a controlled qualifying run should advance the threshold fixture through a real Eternity transition");
  assert.equal(thresholdState.count, 5, "the threshold fixture should advance to Eternity count 5 through the real transition");
  assert.equal(thresholdState.mask, 7, "the third first-tier choice should be acquired once on that successful Eternity");
  assert.equal(thresholdState.milestone2, true, "Milestone 2 should activate at Eternity count 5");
  assert.equal(
    await page.locator('[data-eternity-milestone="2"] .eternity-milestone-status').textContent(),
    "有効",
    "player-facing UI should reflect the count-5 Milestone activation",
  );

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.language = "en";
    debug.runtime.appliedLanguage = "";
    debug.runtime.updateUi();
  });
  const english = await page.evaluate(() => ({
    missingKeys: Array.from(document.querySelectorAll('[data-panel="eternity"] [data-i18n]'))
      .filter((element) => !element.textContent.trim()).map((element) => element.dataset.i18n),
    forced: document.getElementById("eternityForcedNote")?.textContent || "",
    panelText: document.querySelector('[data-panel="eternity"]')?.textContent || "",
  }));
  assert.deepEqual(english.missingKeys, [], "English Eternity release UI should not contain missing/placeholder i18n strings");
  assert.match(english.forced, /performed automatically/, "English release copy should explain pre-Break forced Eternity");
  assert.equal(english.panelText.includes("Eternity Point"), false, "English release UI must not introduce an Eternity Point surface");

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.language = "ja";
    debug.runtime.appliedLanguage = "";
    debug.switchMainTab("achievements");
    debug.runtime.updateUi();
  });
  const achievement41Title = await page.locator(".achievement-row").nth(40).locator(".achievement-title").textContent();
  assert.equal(achievement41Title, "Time is generative", "Achievement 41 must remain literal in the Japanese release UI");

  console.log("Eternity release E2E passed");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
