import assert from "node:assert/strict";
const ACHIEVEMENT_38_TO_41_MASK = [38, 39, 40, 41]
  .reduce((mask, id) => mask | (1 << (id - 32)), 0);
import { openGamePage, startGameTest } from "./browser-harness.mjs";

const gameTest = await startGameTest();
const { context, page } = await openGamePage(gameTest.browser, gameTest.origin, {
  viewport: { width: 1280, height: 900 },
});
const url = `${gameTest.origin}/`;

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

async function acquireFirstTier(id) {
  await openEternityThroughUi();
  const before = await page.evaluate(() => window.__angleDebug.runtime.firstTierMilestoneEntitlementCount());
  assert.ok(before > 0, `${id} should only be acquired when a first-tier entitlement exists`);
  await page.click(`[data-eternity-choice="${id}"]`);
  const acquired = await page.evaluate((milestoneId) => ({
    active: window.__angleDebug.runtime.eternityMilestoneActive(milestoneId),
    choice: window.__angleDebug.state.eternityMilestoneChoice,
    entitlement: window.__angleDebug.runtime.firstTierMilestoneEntitlementCount(),
  }), id);
  assert.equal(acquired.active, true, `normal Eternity UI should acquire ${id} immediately`);
  assert.equal(acquired.choice, "", "the post-Eternity acquisition flow must not use pending-choice state");
  assert.equal(acquired.entitlement, before - 1, "one acquisition should consume exactly one earned entitlement");
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

async function performQualifiedEternityThroughUi() {
  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.runtime.syncInfinityPointCachesFromExact(debug.runtime.MAX_EXACT_INFINITY_POINTS);
    debug.runtime.updateUi();
  });
  await openEternityThroughUi();
  const ready = await page.evaluate(() => ({
    canEternity: window.__angleDebug.canEternity(),
    legacyForced: window.__angleDebug.maybeForceEternity({ save: false, update: false }),
    buttonDisabled: document.getElementById("eternityPerformButton")?.disabled,
  }));
  assert.equal(ready.canEternity, true, "TC4 completion plus 1.80e308 IP should make Eternity available");
  assert.equal(ready.legacyForced, false, "qualified state must not trigger Eternity through the legacy automatic hook");
  assert.equal(ready.buttonDisabled, false, "the player-facing Eternity button should enable when qualified");
  await page.click("#eternityPerformButton");
}

try {
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
    entitlement: window.__angleDebug.runtime.firstTierMilestoneEntitlementCount(),
  }));
  assert.deepEqual(releaseCopy.missingKeys, [], "Japanese Eternity release UI should not contain missing/placeholder i18n strings");
  assert.equal(releaseCopy.panelText.includes("Eternity Point"), false, "release UI must not introduce an Eternity Point surface");
  assert.match(releaseCopy.tc4Reward, /Eternity周回/, "TC4 reward copy should describe the shipped Eternity requirement rather than a future placeholder");
  assert.equal(releaseCopy.entitlement, 0, "no first-tier acquisition should exist before the first Eternity");

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
  assert.equal(beforeFullRequirement.forced, false, "Eternity must not fire before the full requirement is met");
  assert.equal(beforeFullRequirement.count, 0, "failed Eternity eligibility must not increment Eternity count");

  await performQualifiedEternityThroughUi();

  const firstState = await page.evaluate(() => {
    const debug = window.__angleDebug;
    return {
      count: debug.state.eternityCount,
      mask: debug.state.eternityMilestoneMask,
      choice: debug.state.eternityMilestoneChoice,
      entitlement: debug.runtime.firstTierMilestoneEntitlementCount(),
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
  assert.equal(firstState.count, 1, "first manual Eternity should increment count exactly once");
  assert.equal(firstState.mask, 0, "Eternity should not auto-acquire a first-tier Milestone");
  assert.equal(firstState.choice, "", "Eternity should not create a pending first-tier choice");
  assert.equal(firstState.entitlement, 1, "first Eternity should grant one persistent first-tier acquisition");
  assert.equal(firstState.completedTc, 0, "Eternity should reset all current-run TC completion");
  assert.equal(firstState.achievement40, true, "Achievement 40 should persist after TC4 completion is reset");
  assert.equal(firstState.achievement41, true, "the first successful manual Eternity should grant Achievement 41");
  assert.deepEqual(
    [firstState.timeFlux, firstState.timeFluxCapacityLevel, firstState.timeFluxGainLevel, firstState.timeFluxSpeed, firstState.timeFluxCustomSpeed],
    [246, 2, 3, 4, 5],
    "all global Time Flux gameplay state should persist through Eternity",
  );

  await acquireFirstTier("1-1");
  const firstAcquired = await page.evaluate(() => ({
    mask: window.__angleDebug.state.eternityMilestoneMask,
    entitlement: window.__angleDebug.runtime.firstTierMilestoneEntitlementCount(),
  }));
  assert.equal(firstAcquired.mask, 1, "1-1 should be acquired after the first Eternity");
  assert.equal(firstAcquired.entitlement, 0, "the first acquisition should consume the first entitlement");

  await page.evaluate(() => window.__angleDebug.saveGame("manual"));
  await page.reload({ waitUntil: "networkidle" });
  await waitForGame();
  const reloaded = await page.evaluate(() => {
    const debug = window.__angleDebug;
    return {
      count: debug.state.eternityCount,
      mask: debug.state.eternityMilestoneMask,
      choice: debug.state.eternityMilestoneChoice,
      entitlement: debug.runtime.firstTierMilestoneEntitlementCount(),
      completedTc: debug.state.completedTowerChallenges,
      achievementMaskHigh: debug.state.achievementMaskHigh,
      timeFlux: debug.state.timeFlux,
    };
  });
  assert.equal(reloaded.count, 1, "normal browser save/load should retain Eternity count");
  assert.equal(reloaded.mask, 1, "normal browser save/load should retain first-tier ownership");
  assert.equal(reloaded.choice, "", "normal browser save/load should not create pending first-tier choice state");
  assert.equal(reloaded.entitlement, 0, "derived entitlement should remain consumed after save/load");
  assert.equal(reloaded.completedTc, 0, "normal browser save/load should not resurrect pre-Eternity TC completion");
  assert.equal(reloaded.achievementMaskHigh & ACHIEVEMENT_38_TO_41_MASK, ACHIEVEMENT_38_TO_41_MASK, "Achievements 38-41 should all persist through the first Eternity and reload");
  assert.equal(reloaded.timeFlux, 246, "global Time Flux should persist through browser save/load");

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
  await performQualifiedEternityThroughUi();
  const secondBeforeAcquire = await page.evaluate(() => ({
    count: window.__angleDebug.state.eternityCount,
    mask: window.__angleDebug.state.eternityMilestoneMask,
    entitlement: window.__angleDebug.runtime.firstTierMilestoneEntitlementCount(),
    completedTc: window.__angleDebug.state.completedTowerChallenges,
    achievementMaskHigh: window.__angleDebug.state.achievementMaskHigh,
    timeFlux: window.__angleDebug.state.timeFlux,
  }));
  assert.equal(secondBeforeAcquire.count, 2, "the representative TC4 -> Eternity -> rebuild -> TC4 -> Eternity loop should reach Eternity count 2");
  assert.equal(secondBeforeAcquire.mask, 1, "the second Eternity should not auto-acquire another first-tier Milestone");
  assert.equal(secondBeforeAcquire.entitlement, 1, "the second Eternity should grant another first-tier acquisition");
  assert.equal(secondBeforeAcquire.completedTc, 0, "the second Eternity should reset TC completion again");
  assert.equal(secondBeforeAcquire.achievementMaskHigh & ACHIEVEMENT_38_TO_41_MASK, ACHIEVEMENT_38_TO_41_MASK, "Achievements 38-41 should remain persistent across repeated Eternities");
  assert.equal(secondBeforeAcquire.timeFlux, 246, "global Time Flux should remain persistent across repeated Eternities");

  await acquireFirstTier("1-2");
  assert.equal(
    await page.evaluate(() => window.__angleDebug.state.eternityMilestoneMask),
    3,
    "the second earned acquisition should add 1-2 without duplicating 1-1",
  );

  await page.evaluate(() => {
    const debug = window.__angleDebug;
    debug.state.eternityCount = 4;
    debug.state.eternityMilestoneMask = 3;
    debug.state.completedTowerChallenges = 1 << 3;
    debug.runtime.syncInfinityPointCachesFromExact(debug.runtime.MAX_EXACT_INFINITY_POINTS);
    debug.runtime.updateUi();
  });
  const thresholdBefore = await page.evaluate(() => ({
    milestone2: window.__angleDebug.runtime.eternityMilestoneActive("2"),
    canEternity: window.__angleDebug.canEternity(),
    forced: window.__angleDebug.maybeForceEternity({ save: false, update: false }),
  }));
  assert.equal(thresholdBefore.milestone2, false, "Milestone 2 should remain inactive at Eternity count 4");
  assert.equal(thresholdBefore.canEternity, true, "the controlled threshold fixture should qualify for manual Eternity");
  assert.equal(thresholdBefore.forced, false, "the threshold fixture must remain stable until the player acts");

  await openEternityThroughUi();
  await page.click("#eternityPerformButton");
  const thresholdState = await page.evaluate(() => ({
    completedIc7: (window.__angleDebug.state.completedChallenges & (1 << 6)) !== 0,
    count: window.__angleDebug.state.eternityCount,
    mask: window.__angleDebug.state.eternityMilestoneMask,
    entitlement: window.__angleDebug.runtime.firstTierMilestoneEntitlementCount(),
    milestone2: window.__angleDebug.runtime.eternityMilestoneActive("2"),
  }));
  assert.equal(thresholdState.count, 5, "the threshold fixture should advance to Eternity count 5 through the manual transition");
  assert.equal(thresholdState.completedIc7, true, "the fifth Eternity should start with IC7 completed");
  assert.equal(thresholdState.mask, 3, "the threshold Eternity should not auto-acquire the remaining first-tier Milestone");
  assert.equal(thresholdState.entitlement, 1, "the unused third first-tier acquisition should remain available");
  assert.equal(thresholdState.milestone2, true, "Milestone 2 should activate at Eternity count 5");
  assert.equal(
    await page.locator('[data-eternity-milestone="2"] .eternity-milestone-status').textContent(),
    "有効",
    "player-facing UI should reflect the count-5 Milestone activation",
  );

  await acquireFirstTier("1-3");
  assert.equal(
    await page.evaluate(() => window.__angleDebug.state.eternityMilestoneMask),
    7,
    "the remaining first-tier Milestone should be acquired after the successful Eternity",
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
    compactRequirement: document.querySelector('[data-i18n="eternityRequirementCompact"]')?.textContent || "",
    manual: document.getElementById("eternityForcedNote")?.textContent || "",
    panelText: document.querySelector('[data-panel="eternity"]')?.textContent || "",
  }));
  assert.deepEqual(english.missingKeys, [], "English Eternity release UI should not contain missing/placeholder i18n strings");
  assert.equal(english.compactRequirement, "TC4 clear + 1.80e308 IP", "English release UI should keep one compact Eternity requirement");
  assert.equal(english.manual, "", "English release UI should remove the repeated manual-execution warning");
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
  await context.close();
  await gameTest.close();
}
