const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

function setScoreLog(state, log10) {
  state.scoreLog10 = log10;
  state.score = Number.MAX_VALUE;
}

function setIpLog(state, log10) {
  state.infinityPointsLog10 = log10;
  state.infinityPoints = Number.MAX_VALUE;
  state.infinityPointsExact = "0";
}

function markEternityReady(runtime, state) {
  runtime.syncInfinityPointCachesFromExact(runtime.MAX_EXACT_INFINITY_POINTS);
  state.completedTowerChallenges = 1 << 3;
}

async function testManualTracks() {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const { state } = debug;
  state.eternityCount = 1;
  runtime.updateUi();

  assert.equal(runtime.timelineDiscovered(), true, "the first Eternity should discover Timeline");
  assert.deepEqual(
    [state.scoreTfClaims, state.ipTfClaims, state.eternityTfClaims],
    [0, 0, 0],
    "new Timeline state should start with no claims",
  );
  assert.equal(runtime.timelineScoreRequirementLog10(), 20000, "Score track should start at 1e20000");
  assert.equal(runtime.timelineIpRequirementLog10(), 400, "IP track should start at 1e400");
  assert.equal(runtime.timelineEternityRequirement(), 2n, "Eternity track should start at 2 Eternities");

  setScoreLog(state, 25000);
  runtime.updateUi();
  assert.equal(runtime.canClaimTimelineTf("score"), true, "a met Score threshold should enable one claim");
  assert.equal(runtime.claimTimelineTf("score", { save: false, update: false }), true);
  assert.equal(state.scoreTfClaims, 1, "one Score action should grant exactly one TF");
  assert.equal(state.scoreLog10, 25000, "claiming TF must not consume Score");
  assert.equal(runtime.timelineScoreRequirementLog10(), 30000, "Score requirement should advance independently");
  assert.equal(runtime.claimTimelineTf("score", { save: false, update: false }), false, "one action must not claim all met thresholds");

  setScoreLog(state, 50000);
  assert.equal(runtime.claimScoreTf({ save: false, update: false }), true);
  assert.equal(state.scoreTfClaims, 2, "the second Score threshold should be claimable manually");
  assert.equal(runtime.claimScoreTf({ save: false, update: false }), true);
  assert.equal(state.scoreTfClaims, 3, "each repeated manual claim should advance once");

  setIpLog(state, 450);
  assert.equal(runtime.claimIpTf({ save: false, update: false }), true, "the IP track should use its own log threshold");
  assert.equal(state.ipTfClaims, 1);
  assert.equal(state.infinityPointsLog10, 450, "claiming TF must not consume Infinity Points");

  state.eternityCount = 2;
  assert.equal(runtime.canClaimTimelineTf("eternity"), true);
  assert.equal(runtime.claimEternityTf({ save: false, update: false }), true);
  assert.equal(state.eternityTfClaims, 1);
  assert.equal(runtime.timelineEternityRequirement(), 4n, "Eternity requirement should advance independently");
  assert.equal(runtime.timelineEarnedTf(), 5, "earned TF should derive from the three claim counters");
}

async function testTimelineTreePurchases() {
  const locked = await loadRuntime(candidatePath);
  locked.debug.state.scoreTfClaims = 12;
  assert.equal(locked.runtime.timelineNodeAvailability("Real-BC16500").reason, "timeline-locked");
  assert.equal(locked.runtime.canPurchaseTimelineNode("Real-BC16500"), false, "Timeline nodes must stay locked before discovery");

  const { debug, runtime } = await loadRuntime(candidatePath);
  const { state } = debug;
  state.eternityCount = 1;
  state.scoreTfClaims = 12;
  runtime.updateUi();
  const nodeIds = [
    "Real-BC16500",
    "Parallel-BC16500",
    "Real-BC6000",
    "Parallel-BC6000",
    "Real-AD30",
    "Parallel-AD30",
  ];
  assert.deepEqual(Array.from(runtime.timelineNodes(), (node) => node.id), nodeIds, "all six Timeline nodes should be defined");
  assert.deepEqual(
    Array.from(runtime.timelineNodes(), (node) => [
      node.era,
      node.route,
      node.costTF,
      node.prerequisiteMode || "all",
      Array.from(node.prerequisites),
    ]),
    [
      ["BC16500", "Real", 1, "all", []],
      ["BC16500", "Parallel", 1, "all", []],
      ["BC6000", "Real", 1, "any", ["Real-BC16500", "Parallel-BC16500"]],
      ["BC6000", "Parallel", 1, "any", ["Real-BC16500", "Parallel-BC16500"]],
      ["AD30", "Real", 5, "any", ["Real-BC6000", "Parallel-BC6000"]],
      ["AD30", "Parallel", 5, "any", ["Real-BC6000", "Parallel-BC6000"]],
    ],
    "Timeline nodes should retain the canonical era, route, cost, and OR prerequisite metadata",
  );
  assert.equal(runtime.timelineAvailableTf(), 12);
  assert.equal(runtime.timelineNodeAvailability("Real-BC6000").reason, "missing-prerequisites");
  assert.equal(runtime.timelineNodeAvailability("Real-AD30").reason, "missing-prerequisites");
  assert.equal(runtime.timelineNodeAvailability("Parallel-BC16500").reason, "available");

  const missingPrerequisite = runtime.timelineNodeAvailability({
    id: "future-node",
    era: "BC14000",
    route: "Parallel",
    costTF: 1,
    prerequisites: ["future-prerequisite"],
  });
  assert.equal(missingPrerequisite.reason, "missing-prerequisites", "prerequisite checks should be generic for later nodes");
  assert.equal(
    runtime.timelineNodeHasRouteConflict({ id: "future-parallel", era: "BC14000", route: "Parallel" }),
    false,
    "different eras may independently choose routes",
  );

  for (const firstRoute of ["Real", "Parallel"]) {
    for (const secondRoute of ["Real", "Parallel"]) {
      for (const thirdRoute of ["Real", "Parallel"]) {
        const instance = await loadRuntime(candidatePath);
        const { debug: routeDebug, runtime: routeRuntime } = instance;
        routeDebug.state.eternityCount = 1;
        routeDebug.state.scoreTfClaims = 12;
        const chosenIds = [
          `${firstRoute}-BC16500`,
          `${secondRoute}-BC6000`,
          `${thirdRoute}-AD30`,
        ];
        for (const id of chosenIds) {
          assert.equal(routeRuntime.canPurchaseTimelineNode(id), true, `${id} should be available on route ${chosenIds.join(" → ")}`);
          assert.equal(routeRuntime.purchaseTimelineNode(id, { save: false, update: false }), true);
        }
        for (const oppositeId of [
          `${firstRoute === "Real" ? "Parallel" : "Real"}-BC16500`,
          `${secondRoute === "Real" ? "Parallel" : "Real"}-BC6000`,
          `${thirdRoute === "Real" ? "Parallel" : "Real"}-AD30`,
        ]) {
          assert.equal(routeRuntime.timelineNodeAvailability(oppositeId).reason, "route-conflict", `${oppositeId} should remain exclusive within its era`);
        }
        assert.deepEqual(
          Array.from(routeDebug.state.timelinePurchasedNodes, (entry) => entry.id),
          chosenIds,
          "route choices must remain independent across eras",
        );
        assert.equal(routeRuntime.timelineSpentTf(), 7, "a full route should spend 1 + 1 + 5 TF");
        assert.equal(routeRuntime.timelineAvailableTf(), 5, "remaining TF should derive from canonical node costs");

        const serialized = routeRuntime.serializeSaveData();
        const loaded = await loadRuntime(candidatePath, new Map([[routeRuntime.SAVE_KEY, JSON.stringify(serialized)]]));
        assert.deepEqual(
          JSON.parse(JSON.stringify(loaded.debug.state.timelinePurchasedNodes)),
          chosenIds.map((id) => {
            const node = loaded.runtime.timelineNode(id);
            return { id, era: node.era, route: node.route, costTF: node.costTF };
          }),
          "save/load should retain canonical metadata for any cross-route build",
        );
        assert.equal(loaded.runtime.timelineAvailableTf(), 5);
        assert.equal(loaded.runtime.respecTimeline({ save: false, update: false }), true);
        assert.deepEqual(Array.from(loaded.debug.state.timelinePurchasedNodes), []);
        assert.equal(loaded.runtime.timelineAvailableTf(), 12, "respec should refund all route costs by derivation");
      }
    }
  }
}

async function testResetPersistenceAndRespec() {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const { state } = debug;
  state.eternityCount = 12;
  state.scoreTfClaims = 2;
  state.ipTfClaims = 1;
  state.eternityTfClaims = 3;
  state.timelinePurchasedNodes = [
    { id: "Real-BC16500", era: "BC16500", route: "Real", costTF: 1 },
  ];
  state.eternityMilestoneMask = 5;
  state.totalPlayTime = 321;
  markEternityReady(runtime, state);

  assert.equal(runtime.timelineAvailableTf(), 5, "available TF should subtract canonical node costs");
  assert.equal(debug.performEternity({ save: false, update: false }), true, "ordinary Eternity should remain executable");
  assert.equal(state.eternityCount, 13);
  assert.equal(state.timelinePurchasedNodes.length, 1, "ordinary Eternity must preserve the Timeline build");
  assert.equal(state.timelinePurchasedNodes[0].id, "Real-BC16500");
  assert.equal(state.timelinePurchasedNodes[0].costTF, 1);
  assert.deepEqual(
    [state.scoreTfClaims, state.ipTfClaims, state.eternityTfClaims],
    [2, 1, 3],
    "ordinary Eternity must preserve all TF claim counters",
  );
  assert.equal(runtime.timelineAvailableTf(), 5, "ordinary Eternity must preserve unused TF");
  assert.equal(state.eternityMilestoneMask, 5, "resets must preserve permanent Milestones");
  assert.equal(state.totalPlayTime, 321, "resets must preserve permanent statistics");
  state.currentEternityRunTime = 17;
  state.currentEternityRealTime = 19;
  state.fastestEternityTime = 3;
  state.fastestEternityRealTime = 4;
  state.lastEternityRuns = [{ time: 17, realTime: 19, infinityCount: 12 }];

  assert.equal(debug.respecTimeline({ save: false, update: false }), true, "Timeline respec should restart the current run");
  assert.equal(state.eternityCount, 13, "respec must not change Eternity count");
  assert.equal(state.timelinePurchasedNodes.length, 0, "respec should remove every purchased node");
  assert.deepEqual(
    [state.scoreTfClaims, state.ipTfClaims, state.eternityTfClaims],
    [2, 1, 3],
    "respec must preserve claim history",
  );
  assert.equal(runtime.timelineAvailableTf(), 6, "respec should refund all spent TF through derivation");
  assert.equal(state.scoreLog10, -Infinity, "respec should restart the current lower-layer run");
  assert.equal(state.infinityPointsExact, "0", "respec must not refund or preserve current IP");
  assert.equal(state.currentEternityRunTime, 0, "Timeline respec should reset current Eternity game time");
  assert.equal(state.currentEternityRealTime, 0, "Timeline respec should reset current Eternity real time");
  assert.equal(state.fastestEternityTime, 3, "Timeline respec should preserve the fastest Eternity game time");
  assert.equal(state.fastestEternityRealTime, 4, "Timeline respec should preserve the fastest Eternity real time");
  assert.deepEqual(JSON.parse(JSON.stringify(state.lastEternityRuns)), [{ time: 17, realTime: 19, infinityCount: 12 }], "Timeline respec should preserve Eternity history");
  assert.equal(debug.respecTimeline({ save: false, update: false }), true, "repeated respec should remain safe");
  assert.equal(runtime.timelineAvailableTf(), 6, "repeated respec must not duplicate or lose TF");

  state.eternityCount = 108;
  state.timelinePurchasedNodes = [{ id: "milestone-node", costTF: 1 }];
  debug.respecTimeline({ save: false, update: false });
  assert.equal(state.eternityCount, 108, "high-count respec must still preserve Eternity count");
  assert.equal(state.infinityPointsExact, "1000", "respec should apply the current Eternity starting baseline");
  assert.equal(state.completedChallenges, (1 << runtime.INFINITY_CHALLENGE_COUNT) - 1, "respec should apply active Milestone start state");
}

async function testSaveCompatibility() {
  const source = await loadRuntime(candidatePath);
  const { runtime, debug } = source;
  debug.state.eternityCount = 1;
  debug.state.scoreTfClaims = 2;
  debug.state.ipTfClaims = 1;
  debug.state.eternityTfClaims = 4;
  debug.state.timelinePurchasedNodes = [{ id: "node", costTF: 2 }];
  const serialized = runtime.serializeSaveData();
  const loaded = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(serialized)]]));
  assert.deepEqual(
    [loaded.debug.state.scoreTfClaims, loaded.debug.state.ipTfClaims, loaded.debug.state.eternityTfClaims],
    [2, 1, 4],
    "save/load should preserve explicit TF claims",
  );
  assert.equal(loaded.debug.state.timelinePurchasedNodes.length, 1);
  assert.equal(loaded.debug.state.timelinePurchasedNodes[0].id, "node");
  assert.equal(loaded.debug.state.timelinePurchasedNodes[0].costTF, 2);
  assert.equal(loaded.runtime.timelineAvailableTf(), 5);

  const legacy = structuredClone(serialized);
  delete legacy.state.scoreTfClaims;
  delete legacy.state.ipTfClaims;
  delete legacy.state.eternityTfClaims;
  delete legacy.state.timelinePurchasedNodes;
  const migrated = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(legacy)]]));
  assert.deepEqual(
    [migrated.debug.state.scoreTfClaims, migrated.debug.state.ipTfClaims, migrated.debug.state.eternityTfClaims],
    [0, 0, 0],
    "existing post-Eternity saves must not receive retroactive TF claims",
  );
  assert.equal(migrated.debug.state.timelinePurchasedNodes.length, 0);
  assert.equal(migrated.runtime.timelineDiscovered(), true, "existing post-Eternity saves should discover Timeline");
  assert.equal(migrated.debug.mainTabIsUnlocked("eternity"), true, "existing post-Eternity saves should keep Eternity discovered");
  assert.equal(migrated.debug.mainTabIsUnlocked("timeline"), false, "Timeline should no longer be treated as a top-level tab");

  const legacyTimelineOnly = structuredClone(serialized);
  legacyTimelineOnly.state.eternityCount = 0;
  legacyTimelineOnly.state.infinityCount = 0;
  legacyTimelineOnly.state.towerFloor = 0;
  legacyTimelineOnly.state.completedTowerChallenges = 0;
  legacyTimelineOnly.state.unlockedMainTabs = ["timeline"];
  legacyTimelineOnly.state.hiddenTabs = ["timeline"];
  const migratedLegacyTimeline = await loadRuntime(
    candidatePath,
    new Map([[runtime.SAVE_KEY, JSON.stringify(legacyTimelineOnly)]]),
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(migratedLegacyTimeline.debug.state.unlockedMainTabs)),
    ["eternity", "timeline"],
    "legacy Timeline discovery should imply nested Eternity access",
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(migratedLegacyTimeline.debug.state.hiddenTabs)),
    [],
    "legacy Timeline hidden-tab preferences should be discarded",
  );
  assert.equal(migratedLegacyTimeline.runtime.timelineDiscovered(), true);
  assert.equal(migratedLegacyTimeline.debug.mainTabIsUnlocked("eternity"), true);
  assert.equal(migratedLegacyTimeline.debug.mainTabIsUnlocked("timeline"), false);
  assert.deepEqual(
    JSON.parse(JSON.stringify(migratedLegacyTimeline.runtime.serializeSaveData().state.hiddenTabs)),
    [],
    "serialized settings should not resurrect a top-level Timeline preference",
  );
}

async function testRestoredTimelineSaveMigration() {
  const source = await loadRuntime(candidatePath);
  const { runtime } = source;
  const preDeferralSave = runtime.serializeSaveData();
  Object.assign(preDeferralSave.state, {
    eternityCount: 4,
    eternityCountExact: "4",
    scoreTfClaims: 20,
    ipTfClaims: 0,
    eternityTfClaims: 0,
    score: Number.MAX_VALUE,
    scoreLog10: 14000,
    completedChallenges: 1 << (6 - 1),
    infinityCount: 100,
    infinityCountExact: "100",
    timelinePurchasedNodes: [
      { id: "Real-BC16500", era: "invalid", route: "Parallel", costTF: 99 },
      { id: "Real-BC6000", era: "invalid", route: "Parallel", costTF: 99 },
      { id: "Real-AD30", era: "invalid", route: "Parallel", costTF: 99 },
    ],
  });
  const restored = await loadRuntime(
    candidatePath,
    new Map([[runtime.SAVE_KEY, JSON.stringify(preDeferralSave)]]),
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(restored.debug.state.timelinePurchasedNodes)),
    [
      { id: "Real-BC16500", era: "BC16500", route: "Real", costTF: 1 },
      { id: "Real-BC6000", era: "BC6000", route: "Real", costTF: 1 },
      { id: "Real-AD30", era: "AD30", route: "Real", costTF: 5 },
    ],
    "pre-#426 save IDs should return with canonical era, route, and costs",
  );
  assert.equal(restored.runtime.timelineSpentTf(), 7, "restored nodes should spend their canonical 1+1+5 TF");
  assert.equal(restored.runtime.timelineAvailableTf(), 13, "pre-#426 saves should retain claim history and canonical TF accounting");
  assert.equal(restored.runtime.timelineRealBc6000Ic6RewardMultiplierLog10(), 4 * Math.log10(1.2));
  assert.equal(restored.runtime.timelineRealAd30EternityGainMultiplierLog10(), Math.log10(2.4));
  assert.equal(restored.runtime.eternityGain(), 2, "restored Real-AD30 should use the current formula and floor its gain");
  assert.equal(restored.runtime.timelineBulkSimulationAllowed(), true, "restored known nodes should be eligible for audited bulk paths");
  assert.equal(restored.runtime.respecTimeline({ save: false, update: false }), true);
  assert.deepEqual(Array.from(restored.debug.state.timelinePurchasedNodes), []);
  assert.equal(restored.runtime.timelineAvailableTf(), 20, "respec should refund every restored node by derived accounting");

  const postDeferralSave = runtime.serializeSaveData();
  Object.assign(postDeferralSave.state, {
    eternityCount: 4,
    eternityCountExact: "4",
    scoreTfClaims: 20,
    ipTfClaims: 0,
    eternityTfClaims: 0,
    score: Number.MAX_VALUE,
    scoreLog10: 14000,
    completedChallenges: 1 << (6 - 1),
    timelinePurchasedNodes: [
      { id: "Real-BC16500", era: "BC16500", route: "Real", costTF: 1 },
    ],
  });
  const postDeferral = await loadRuntime(
    candidatePath,
    new Map([[runtime.SAVE_KEY, JSON.stringify(postDeferralSave)]]),
  );
  assert.deepEqual(
    Array.from(postDeferral.debug.state.timelinePurchasedNodes, (entry) => entry.id),
    ["Real-BC16500"],
    "post-#426 saves should not invent purchases for the reintroduced eras",
  );
  assert.equal(postDeferral.runtime.timelineSpentTf(), 1);
  assert.equal(postDeferral.runtime.timelineAvailableTf(), 19, "already-refunded #426 saves should not receive a second TF refund");
  assert.equal(postDeferral.runtime.timelineRealBc6000Ic6RewardMultiplierLog10(), 0);
  postDeferral.debug.state.towerFloor = 5;
  assert.equal(postDeferral.runtime.towerScoreExponent(), 1.25, "post-#426 saves should not activate an unpurchased Tower effect");
  assert.equal(postDeferral.runtime.eternityGain(), 1, "post-#426 saves should not activate an unpurchased AD30 effect");
  assert.equal(postDeferral.runtime.timelineBulkSimulationAllowed(), true);
}

async function testRestoredTimelineFormulaAndExactGain() {
  const { debug, runtime } = await loadRuntime(candidatePath);
  const { state } = debug;
  state.timelinePurchasedNodes = [{ id: "Real-BC6000" }];
  state.completedChallenges = 1 << (6 - 1);
  for (const eternities of [1n, 2n]) {
    runtime.setExactIntegerState(state, "eternityCountExact", "eternityCount", eternities);
    const rawLog10 = Number(eternities) * Math.log10(1.2);
    assert.equal(runtime.timelineRealBc6000RewardRawLog10(), rawLog10);
    assert.equal(runtime.timelineRealBc6000Ic6RewardMultiplierLog10(), rawLog10, "below ×1e10, the added factor must remain ×1.2^E without baseline subtraction");
    assertClose(
      runtime.infinityCountGainLog10(),
      Math.log10(2) + rawLog10,
      1e-12,
      "Real-BC6000 should multiply the existing IC6 ×2 by the additional ×1.2^E",
    );
    assert.equal(runtime.infinityCountGain(), Math.floor(2 * 1.2 ** Number(eternities)));
  }
  for (const rawLog10 of [9.999999, 10, 10.000001]) {
    const expected = rawLog10 <= 10
      ? rawLog10
      : 10 + 2 * Math.log10(1 + (rawLog10 - 10) / 2);
    assertClose(runtime.timelineRealBc6000SoftcapLog10(rawLog10), expected, 1e-12, `IC6 softcap boundary at raw log10 ${rawLog10}`);
  }
  runtime.setExactIntegerState(state, "eternityCountExact", "eternityCount", 126n);
  assert.ok(runtime.timelineRealBc6000Ic6RewardMultiplierLog10() < 10, "E=126 should remain below the ×1e10 softcap");
  runtime.setExactIntegerState(state, "eternityCountExact", "eternityCount", 127n);
  const cappedIc6Log10 = 10 + 2 * Math.log10(
    1 + (127 * Math.log10(1.2) - 10) / 2,
  );
  assertClose(runtime.timelineRealBc6000Ic6RewardMultiplierLog10(), cappedIc6Log10, 1e-12, "E=127 should enter the threshold-10 strength-2 softcap");
  state.completedChallenges = 0;
  assert.equal(runtime.timelineRealBc6000Ic6RewardMultiplierLog10(), 0, "the BC6000 Real factor should stay inactive before IC6 is completed");

  state.timelinePurchasedNodes = [{ id: "Real-AD30" }];
  runtime.setExactIntegerState(state, "eternityCountExact", "eternityCount", 7n);
  for (const [scoreLog10, expectedMultiplier] of [
    [9000, 1.9],
    [14000, 2.4],
    [19000, 2.9],
    [24000, 3.4],
    [29000, 3.9],
  ]) {
    setScoreLog(state, scoreLog10);
    assertClose(
      runtime.timelineRealAd30EternityGainMultiplierLog10(),
      Math.log10(expectedMultiplier),
      1e-12,
      `Real AD30 #474 anchor at Score e${scoreLog10}`,
    );
    assert.equal(runtime.eternityGainExact(), BigInt(Math.floor(expectedMultiplier)), "Eternity gain should floor the existing gain times the exact new multiplier");
    assert.equal(runtime.eternityGainLog10(), Math.log10(Math.floor(expectedMultiplier)), "the pending gain log should represent the normalized integer, not the raw fractional multiplier");
  }
  for (const [scoreLog10, expectedGain] of [
    [9999.999, 1n],
    [10000, 2n],
    [10000.001, 2n],
  ]) {
    setScoreLog(state, scoreLog10);
    assert.equal(runtime.eternityGainExact(), expectedGain, `Real AD30 integer boundary at Score e${scoreLog10}`);
  }
  state.score = 0;
  state.scoreLog10 = -Infinity;
  assert.equal(runtime.timelineRealAd30EternityGainMultiplierLog10(), 0, "nonpositive Score should produce the neutral ×1 multiplier");
  assert.equal(runtime.eternityGainExact(), 1n);
  setScoreLog(state, 1e308);
  assert.ok(Number.isFinite(runtime.timelineRealAd30EternityGainMultiplierLog10()), "huge Score logs should stay finite");
  assert.ok(runtime.eternityGainExact() > 0n, "huge Score should preserve an exact positive gain");

  state.timelinePurchasedNodes = [{ id: "Parallel-AD30" }];
  runtime.setExactIntegerState(state, "eternityCountExact", "eternityCount", 7n);
  for (const [exponent, expectedMultiplier] of [
    [3, 2.5],
    [6, 4],
    [9, 5.5],
    [12, 7],
    [15, 8.5],
    [100, 51],
  ]) {
    runtime.setExactIntegerState(state, "infinityCountExact", "infinityCount", 10n ** BigInt(exponent));
    assertClose(
      10 ** runtime.timelineParallelAd30EternityGainMultiplierLog10(),
      expectedMultiplier,
      1e-10,
      `Parallel AD30 #474 anchor at Infinity count e${exponent}`,
    );
    assert.equal(runtime.eternityGainExact(), BigInt(Math.floor(expectedMultiplier)), "Parallel gain should use the uncapped logarithmic multiplier");
  }
  for (const [infinityCount, expectedGain] of [
    [10n ** 10n - 1n, 5n],
    [10n ** 10n, 6n],
    [10n ** 10n + 1n, 6n],
  ]) {
    runtime.setExactIntegerState(state, "infinityCountExact", "infinityCount", infinityCount);
    assert.equal(runtime.eternityGainExact(), expectedGain, `Parallel AD30 integer boundary at Infinity count ${infinityCount}`);
  }
  runtime.setExactIntegerState(state, "infinityCountExact", "infinityCount", 0n);
  assert.equal(runtime.timelineParallelAd30EternityGainMultiplierLog10(), 0, "zero Infinity count should use the neutral ×1 multiplier");
  runtime.setExactIntegerState(state, "infinityCountExact", "infinityCount", runtime.MAX_EXACT_INTEGER);
  assert.ok(Number.isFinite(runtime.timelineParallelAd30EternityGainMultiplierLog10()), "maximum exact Infinity count should stay finite without a legacy softcap");
  assert.ok(runtime.eternityGainExact() > 0n, "maximum exact Infinity count should retain a positive Eternity gain");

  const overflowOverrides = new Map([
    ["timelineRealAd30EternityGainMultiplier", () => Number.MAX_VALUE],
    ["timelineRealAd30EternityGainMultiplierLog10", () => Math.log10(Number.MAX_VALUE)],
    ["timelineParallelAd30EternityGainMultiplier", () => 2],
    ["timelineParallelAd30EternityGainMultiplierLog10", () => Math.log10(2)],
  ]);
  const originalDescriptors = new Map(
    Array.from(overflowOverrides.keys(), (name) => [name, Object.getOwnPropertyDescriptor(runtime, name)]),
  );
  try {
    for (const [name, value] of overflowOverrides) {
      Object.defineProperty(runtime, name, { configurable: true, enumerable: true, value });
    }
    runtime.setExactIntegerState(state, "eternityCountExact", "eternityCount", 0n);
    assert.equal(
      runtime.eternityGainExact(),
      runtime.MAX_EXACT_INTEGER,
      "overflowing direct multiplier products should use the exact log-space cap fallback",
    );
  } finally {
    for (const [name, descriptor] of originalDescriptors) {
      Object.defineProperty(runtime, name, descriptor);
    }
  }

  state.timelinePurchasedNodes = [{ id: "Real-AD30" }];
  runtime.setExactIntegerState(state, "eternityCountExact", "eternityCount", 7n);
  setScoreLog(state, 14000);
  markEternityReady(runtime, state);
  const before = runtime.currentExactIntegerState(state, "eternityCountExact", "eternityCount");
  const plannedGain = runtime.eternityGainExact();
  assert.equal(plannedGain, 2n);
  assert.equal(debug.performEternity({ save: false, update: false }), true);
  const after = runtime.currentExactIntegerState(state, "eternityCountExact", "eternityCount");
  assert.equal(after - before, plannedGain, "performEternity should add exactly the canonical planned gain");

  runtime.setExactIntegerState(state, "eternityCountExact", "eternityCount", runtime.MAX_EXACT_INTEGER - 1n);
  const nearLimitBefore = runtime.currentExactIntegerState(state, "eternityCountExact", "eternityCount");
  const nearLimitGain = runtime.eternityGainExact();
  assert.equal(nearLimitGain, 1n, "pending gain should be capped to the current exact-counter headroom");
  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true);
  const nearLimitAfter = runtime.currentExactIntegerState(state, "eternityCountExact", "eternityCount");
  assert.equal(nearLimitAfter - nearLimitBefore, nearLimitGain, "performEternity should add exactly the available counter headroom");

  const atLimitBefore = runtime.currentExactIntegerState(state, "eternityCountExact", "eternityCount");
  assert.equal(runtime.eternityGainExact(), 0n, "the canonical pending gain should be zero when the exact counter is saturated");
  assert.equal(runtime.eternityGainLog10(), -Infinity, "the displayed pending gain should match a saturated zero increment");
  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true);
  const atLimitAfter = runtime.currentExactIntegerState(state, "eternityCountExact", "eternityCount");
  assert.equal(atLimitAfter - atLimitBefore, 0n, "a saturated counter cannot receive an unreportable gain");
}

function assertClose(actual, expected, tolerance, message) {
  if (actual === expected) return;
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
}

const TIMELINE_BULK_NODE_IDS = [
  "Real-BC16500",
  "Parallel-BC16500",
  "Real-BC6000",
  "Parallel-BC6000",
  "Real-AD30",
  "Parallel-AD30",
];

const TIMELINE_ROUTE_COMBINATIONS = [
  ["Real-BC16500", "Real-BC6000", "Real-AD30"],
  ["Real-BC16500", "Real-BC6000", "Parallel-AD30"],
  ["Real-BC16500", "Parallel-BC6000", "Real-AD30"],
  ["Real-BC16500", "Parallel-BC6000", "Parallel-AD30"],
  ["Parallel-BC16500", "Real-BC6000", "Real-AD30"],
  ["Parallel-BC16500", "Real-BC6000", "Parallel-AD30"],
  ["Parallel-BC16500", "Parallel-BC6000", "Real-AD30"],
  ["Parallel-BC16500", "Parallel-BC6000", "Parallel-AD30"],
];

function configureQuietTimelineState(instance, nodes) {
  const { state } = instance.debug;
  const { runtime } = instance;
  Object.assign(state, {
    activeChallenge: 0,
    activeTowerChallenge: 0,
    automationEnabled: false,
    autoRunInfinity: false,
    autoRunGeneration: false,
    autoRunCoreBoost: false,
    completedChallenges: (1 << (6 - 1)) | (1 << (8 - 1)),
    timelinePurchasedNodes: nodes.map((id) => ({ id })),
    timelineParallelSecondsSinceIc8Clear: 5,
    offlineProgressEnabled: true,
    offlineTickCount: 120,
    vertices: 3,
    speedLevel: 30,
    gainLevel: 0,
    currentGain: 1,
    currentGainLog10: 0,
    pointProgress: 0,
    totalVertexProgress: 0,
    score: Number.MAX_VALUE,
    scoreLog10: 15000,
    totalScore: Number.MAX_VALUE,
    totalScoreLog10: 15000,
    generationScore: Number.MAX_VALUE,
    generationScoreLog10: 15000,
    infiniteCapBroken: true,
    towerFloor: 10,
    currentInfinityRunTime: 0,
    currentEternityRunTime: 0,
    currentGenerationRunTime: 0,
    totalPlayTime: 0,
  });
  runtime.setExactIntegerState(state, "infinityCountExact", "infinityCount", 100n);
  runtime.setExactIntegerState(state, "eternityCountExact", "eternityCount", 8n);
  runtime.syncInfinityPointCachesFromExact(10n ** 6n);
  runtime.updateUi = () => {};
  runtime.saveGame = () => true;
  runtime.createCheckpoint = () => true;
}

async function runQuietTimelineResume(nodes, guarded) {
  const instance = await loadRuntime(candidatePath);
  configureQuietTimelineState(instance, nodes);
  const { debug, runtime } = instance;
  let report;
  if (guarded) {
    runtime.beginOfflineWorkBudget(120);
    runtime.offlineProcessing = true;
    try {
      for (let tick = 0; tick < 120; tick += 1) debug.update(runtime.MAX_SIMULATION_STEP_SECONDS, true);
    } finally {
      runtime.offlineProcessing = false;
    }
    report = { requestedTicks: 120, processedTicks: 120, simulationIterations: 120, bulkIterations: 0 };
  } else {
    report = await debug.processOfflineElapsed(
      120 * runtime.MAX_SIMULATION_STEP_SECONDS,
      "timeline-bulk",
      { clockSource: "server" },
    );
  }
  return {
    report,
    values: {
      scoreLog10: runtime.currentScoreLog10(),
      totalScoreLog10: runtime.currentTotalScoreLog10(),
      generationScoreLog10: runtime.currentGenerationScoreLog10(),
      currentGainLog10: runtime.currentGainLog10(),
      infinityPointsLog10: runtime.currentInfinityPointsLog10(),
      infiniteScoreLog10: runtime.currentInfiniteScoreLog10(),
      infinityCountExact: runtime.currentExactIntegerState(
        debug.state,
        "infinityCountExact",
        "infinityCount",
      ).toString(),
      timelineSeconds: debug.state.timelineParallelSecondsSinceIc8Clear,
      parallelTimerEffectLog10: runtime.timelineParallelEffectiveLog10(),
      realCountEffectLog10: runtime.timelineRealInfinityCountGainMultiplierLog10(),
      towerScoreExponent: runtime.towerScoreExponent(),
      infinityCountGainExact: runtime.infinityCountGainExact().toString(),
      eternityGainExact: runtime.eternityGainExact().toString(),
    },
  };
}

async function testTimelineBulkSimulation() {
  const policy = await loadRuntime(candidatePath);
  const { state } = policy.debug;
  const { runtime } = policy;
  for (const id of TIMELINE_BULK_NODE_IDS) {
    state.timelinePurchasedNodes = [{ id }];
    assert.equal(runtime.timelineBulkSimulationAllowed(), true, `${id} should be audited as bulk-safe`);
  }
  state.timelinePurchasedNodes = [{ id: "future-node" }];
  assert.equal(runtime.timelineBulkSimulationAllowed(), false, "unknown Timeline effects should remain on the guarded path");

  for (const nodes of TIMELINE_ROUTE_COMBINATIONS) {
    const bulk = await runQuietTimelineResume(nodes, false);
    const guarded = await runQuietTimelineResume(nodes, true);
    assert.equal(bulk.report.requestedTicks, 120, "bulk comparison should request all configured ticks");
    assert.equal(bulk.report.processedTicks, 120, "bulk comparison should process all configured ticks");
    assert.ok(bulk.report.simulationIterations < bulk.report.requestedTicks, "quiet Timeline should use fewer full updates");
    assert.ok(bulk.report.bulkIterations > 0, "quiet Timeline should use bulk updates");
    assert.equal(guarded.report.simulationIterations, 120, "guarded Timeline should retain one update per tick");
    assert.equal(guarded.report.bulkIterations, 0, "guarded Timeline should not report bulk updates");
    for (const [key, tolerance] of [
      ["scoreLog10", 1e-9],
      ["totalScoreLog10", 1e-9],
      ["generationScoreLog10", 1e-9],
      ["currentGainLog10", 1e-12],
      ["infinityPointsLog10", 1e-12],
      ["infiniteScoreLog10", 1e-12],
      ["timelineSeconds", 1e-9],
      ["parallelTimerEffectLog10", 1e-12],
      ["realCountEffectLog10", 1e-12],
      ["towerScoreExponent", 1e-12],
    ]) {
      assertClose(bulk.values[key], guarded.values[key], tolerance, `${key} should match guarded Timeline processing`);
    }
    assert.equal(bulk.values.infinityCountGainExact, guarded.values.infinityCountGainExact, "Infinity gain should match at the next boundary");
    assert.equal(bulk.values.infinityCountExact, guarded.values.infinityCountExact, "Infinity count should match before the next boundary");
    assert.equal(bulk.values.eternityGainExact, guarded.values.eternityGainExact, "Eternity gain should match without performing Eternity");
  }

  const eventful = await loadRuntime(candidatePath);
  configureQuietTimelineState(eventful, ["Parallel-BC16500"]);
  eventful.debug.state.activeChallenge = 1;
  const eventfulReport = await eventful.debug.processOfflineElapsed(
    120 * eventful.runtime.MAX_SIMULATION_STEP_SECONDS,
    "timeline-eventful",
    { clockSource: "server" },
  );
  assert.equal(eventfulReport.simulationIterations, 120, "active challenges should retain the guarded Timeline path");
  assert.equal(eventfulReport.bulkIterations, 0, "active challenges must not be bulked");
}

async function testTimelineEffectsAndTimer() {
  const source = await loadRuntime(candidatePath);
  const { debug, runtime } = source;
  const { state } = debug;
  runtime.updateUi = () => {};
  runtime.saveGame = () => true;
  runtime.createCheckpoint = () => true;
  state.eternityCount = 1;
  state.infinityCount = 1;
  state.scoreLog10 = 310;
  state.score = Number.MAX_VALUE;
  state.timelinePurchasedNodes = [];
  runtime.syncInfinityPointCachesFromExact(100n);

  assert.equal(runtime.timelineIpGainMultiplierLog10(), 0, "unowned Timeline nodes must not affect IP gain");
  assert.equal(runtime.infinityPointGain(), 3, "the unmodified balance IP gain should remain canonical");

  state.timelinePurchasedNodes = [{ id: "Real-BC16500", era: "BC16500", route: "Real", costTF: 1 }];
  assert.equal(runtime.timelineIpGainMultiplierLog10(), 0, "Real must not multiply IP gain");
  assert.equal(runtime.timelineRealInfinityCountGainMultiplier(), 3, "Real should use 1 + log10(current IP) for count gain");
  assert.equal(runtime.infinityPointGain(), 3, "Real must preserve the canonical IP gain");
  assert.equal(runtime.infinityCountGain(), 3, "Real should multiply the canonical Infinity count gain");

  for (const [ip, expectedMultiplier] of [
    [0n, 1],
    [1n, 1],
    [10n, 2],
    [100n, 3],
    [100000n, 6],
    [10n ** 100n, 101],
  ]) {
    runtime.syncInfinityPointCachesFromExact(ip);
    assert.equal(runtime.timelineRealInfinityCountGainMultiplier(), expectedMultiplier, `Real multiplier at ${ip} IP`);
    assert.equal(runtime.infinityCountGain(), expectedMultiplier, `Real count gain at ${ip} IP`);
    assert.equal(runtime.infinityPointGain(), 3, `Real IP gain at ${ip} IP`);
  }
  setIpLog(state, 100);
  assert.equal(runtime.timelineRealInfinityCountGainMultiplier(), 101, "Real should use the log-backed current IP cache");
  runtime.syncInfinityPointCachesFromExact(100n);
  state.completedChallenges = 1 << (6 - 1);
  state.achievementMaskHigh = 1 << (38 - 32);
  assert.equal(runtime.infinityCountGain(), 12, "Real should compose once with IC6 and Achievement 38");
  state.completedChallenges = 0;
  state.achievementMaskHigh = 0;

  state.timelinePurchasedNodes = [{ id: "Real-BC16500", era: "BC16500", route: "Real", costTF: 1 }];
  state.towerFloor = 0;
  state.eternityCount = 1;
  state.completedChallenges = 0;
  state.scoreLog10 = 310;
  state.score = Number.MAX_VALUE;
  runtime.syncInfinityPointCachesFromExact(10n);
  state.infinityCount = 1;
  debug.runInfinity(false);
  assert.equal(state.infinityCount, 3, "manual Infinity should use the Real count gain once");
  assert.equal(runtime.currentExactInfinityPoints(), 13n, "manual Infinity should preserve the Real IP gain separation");

  state.timelinePurchasedNodes = [{ id: "Parallel-BC16500", era: "BC16500", route: "Parallel", costTF: 1 }];
  runtime.syncInfinityPointCachesFromExact(100n);
  state.scoreLog10 = 310;
  state.score = Number.MAX_VALUE;
  assert.equal(runtime.timelineRealInfinityCountGainMultiplier(), 1, "Parallel must not expose the Real count multiplier");
  assert.equal(runtime.infinityCountGain(), 1, "Parallel must not multiply Infinity count gain");
  assert.equal(runtime.infinityPointGain(), 3, "Parallel without IC8 must not change IP gain");
  assertClose(
    runtime.timelineParallelEffectiveLog10(0),
    0,
    1e-12,
    "Parallel should be inactive before the IC8 boundary advances",
  );
  const softcapSeconds = 10 / Math.log10(3);
  assertClose(
    runtime.timelineParallelRawLog10(softcapSeconds),
    10,
    1e-12,
    "Parallel softcap should begin at raw log10 10",
  );
  assertClose(
    runtime.timelineParallelEffectiveLog10(softcapSeconds),
    10,
    1e-12,
    "Parallel logarithmic softcap should be continuous",
  );
  assertClose(runtime.timelineParallelEffectiveLog10(60), 10 + 10 * Math.log10(1 + (60 * Math.log10(3) - 10) / 10), 1e-12, "Parallel minute curve");
  assertClose(runtime.timelineParallelEffectiveLog10(3600), 32.3493, 0.001, "Parallel hour anchor");
  assertClose(runtime.timelineParallelEffectiveLog10(86400), 46.1514, 0.001, "Parallel day anchor");
  assertClose(runtime.timelineParallelEffectiveLog10(604800), 54.6024, 0.001, "Parallel week anchor");

  state.completedChallenges = 1 << 7;
  state.timelineParallelSecondsSinceIc8Clear = 0;
  state.scoreLog10 = -Infinity;
  state.score = 0;
  debug.update(2);
  assert.equal(state.timelineParallelSecondsSinceIc8Clear, 2, "the normal update path should advance the post-IC8 timer once");

  state.timelineParallelSecondsSinceIc8Clear = 12;
  state.activeChallenge = 8;
  state.activeChallengeTime = 4;
  state.completedChallenges = 0;
  state.scoreLog10 = 310;
  state.score = Number.MAX_VALUE;
  debug.runInfinity(false);
  assert.equal(state.timelineParallelSecondsSinceIc8Clear, 0, "a genuine IC8 completion should reset the timer boundary");

  state.completedChallenges = 1 << 7;
  state.timelineParallelSecondsSinceIc8Clear = 42;
  state.activeChallenge = 0;
  state.scoreLog10 = 310;
  state.score = Number.MAX_VALUE;
  debug.runInfinity(false);
  assert.equal(state.timelineParallelSecondsSinceIc8Clear, 42, "ordinary Infinity must preserve the run-local timer");

  state.timelinePurchasedNodes = [{ id: "Real-BC16500", era: "BC16500", route: "Real", costTF: 1 }];
  state.eternityCount = 127;
  state.infinityCount = 1;
  state.scoreLog10 = 310;
  state.score = Number.MAX_VALUE;
  runtime.syncInfinityPointCachesFromExact(runtime.MAX_EXACT_INFINITY_POINTS - 1n);
  debug.runInfinity(false);
  assert.equal(runtime.currentExactInfinityPoints(), runtime.MAX_EXACT_INFINITY_POINTS, "Timeline gain must respect the pre-Break IP cap");

  state.eternityCount = 128;
  state.infinityCount = 1;
  state.scoreLog10 = 310;
  state.score = Number.MAX_VALUE;
  runtime.syncInfinityPointCachesFromExact(runtime.MAX_EXACT_INFINITY_POINTS);
  debug.runInfinity(false);
  assert.ok(runtime.currentExactInfinityPoints() > runtime.MAX_EXACT_INFINITY_POINTS, "Timeline gain must remain exact above the Break Eternity cap");

  state.timelineParallelSecondsSinceIc8Clear = 5;
  state.completedChallenges = 1 << 7;
  state.offlineTickCount = 1;
  state.scoreLog10 = -Infinity;
  state.score = 0;
  const offlineReport = await debug.processOfflineElapsed(60, "timeline-test", { clockSource: "server" });
  assert.equal(offlineReport.simulatedSeconds, 60, "offline processing should simulate the trusted interval");
  assertClose(state.timelineParallelSecondsSinceIc8Clear, 65, 1e-9, "offline elapsed time should advance the timer exactly once");

  const serialized = runtime.serializeSaveData();
  assertClose(serialized.state.timelineParallelSecondsSinceIc8Clear, 65, 1e-9, "the timer should be serialized");
  serialized.savedAt = Date.now();
  serialized.state.offlineProgressEnabled = false;
  const loaded = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(serialized)]]));
  assertClose(loaded.debug.state.timelineParallelSecondsSinceIc8Clear, 65, 1e-9, "the timer should survive save/load");

  state.timelinePurchasedNodes = [{ id: "Real-BC16500", era: "BC16500", route: "Real", costTF: 1 }];
  runtime.syncInfinityPointCachesFromExact(10n);
  const realSerialized = runtime.serializeSaveData();
  const loadedReal = await loadRuntime(candidatePath, new Map([[runtime.SAVE_KEY, JSON.stringify(realSerialized)]]));
  assert.equal(loadedReal.debug.state.timelinePurchasedNodes[0].id, "Real-BC16500", "save/load should preserve Real ownership");
  assert.equal(loadedReal.runtime.timelineRealInfinityCountGainMultiplier(), 2, "save/load should preserve the active Real count effect");

}

async function testTimelineResetSemantics() {
  const source = await loadRuntime(candidatePath);
  const { debug, runtime } = source;
  const { state } = debug;
  runtime.updateUi = () => {};
  runtime.saveGame = () => true;
  runtime.createCheckpoint = () => true;
  state.eternityCount = 1;
  state.timelinePurchasedNodes = [{ id: "Parallel-BC16500", era: "BC16500", route: "Parallel", costTF: 1 }];
  state.timelineParallelSecondsSinceIc8Clear = 99;
  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true, "ordinary Eternity should reset the run timer");
  assert.equal(state.timelineParallelSecondsSinceIc8Clear, 0);
  assert.equal(state.timelinePurchasedNodes[0].id, "Parallel-BC16500", "ordinary Eternity should preserve the selected node");

  state.eternityCount = 26;
  state.timelineParallelSecondsSinceIc8Clear = 99;
  const challengeTimes = state.fastestInfinityChallengeTimes.map((value) => value);
  markEternityReady(runtime, state);
  assert.equal(debug.performEternity({ save: false, update: false }), true, "Milestone 6 boundary Eternity should execute");
  assert.equal(state.eternityCount, 27);
  assert.equal(state.timelineParallelSecondsSinceIc8Clear, 0, "Milestone 6 should start its new run at timer zero");
  assert.equal(state.completedChallenges, (1 << runtime.INFINITY_CHALLENGE_COUNT) - 1);
  assert.equal(state.fastestInfinityChallengeTimes.every((value, index) => value === challengeTimes[index]), true, "Milestone 6 must not replay IC8 completion");
  debug.update(1);
  assert.equal(state.timelineParallelSecondsSinceIc8Clear, 1, "Milestone 6 should advance from its completed starting state");

  state.timelineParallelSecondsSinceIc8Clear = 20;
  assert.equal(debug.respecTimeline({ save: false, update: false }), true, "Timeline respec should restart the current run");
  assert.equal(state.timelineParallelSecondsSinceIc8Clear, 0, "Timeline respec should discard the old timer");
  assert.equal(state.timelinePurchasedNodes.length, 0, "Timeline respec should remove the selected node");
}

async function runTimelineModuleRuntimeTest() {
  await testManualTracks();
  await testTimelineTreePurchases();
  await testResetPersistenceAndRespec();
  await testSaveCompatibility();
  await testRestoredTimelineSaveMigration();
  await testRestoredTimelineFormulaAndExactGain();
  await testTimelineEffectsAndTimer();
  await testTimelineBulkSimulation();
  await testTimelineResetSemantics();
  console.log("Timeline module runtime tests passed");
}

module.exports = { runTimelineModuleRuntimeTest };
