const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

async function runLateProgressionPrecisionModuleRuntimeTest() {
  const instance = await loadRuntime(candidatePath);
  const { runtime, debug } = instance;
  const { state } = debug;
  const safeInteger = BigInt(Number.MAX_SAFE_INTEGER);

  runtime.setExactIntegerState(state, "eternityCountExact", "eternityCount", safeInteger - 1n);
  assert.equal(runtime.currentExactEternityCount(), safeInteger - 1n, "the safe-integer boundary should start at the exact value");
  runtime.addEternityGainExact(1n);
  assert.equal(runtime.currentExactEternityCount(), safeInteger, "Eternity should cross MAX_SAFE_INTEGER exactly");
  runtime.addEternityGainExact(1n);
  assert.equal(runtime.currentExactEternityCount(), safeInteger + 1n, "an exact +1 Eternity gain must remain visible above the safe integer boundary");
  assert.ok(Number.isFinite(state.eternityCount), "the legacy Eternity projection must remain finite");

  state.eternityMilestoneMask = 2;
  const milestoneThresholds = [
    ["2", 5n],
    ["3", 8n],
    ["4", 12n],
    ["5", 20n],
    ["6", 27n],
    ["7", 44n],
    ["8", 81n],
    ["9", 108n],
    ["10", 128n],
  ];
  milestoneThresholds.forEach(([id, threshold]) => {
    runtime.setExactIntegerState(state, "eternityCountExact", "eternityCount", threshold);
    assert.equal(runtime.eternityMilestoneActive(id), true, "Eternity Milestone " + id + " should use an exact threshold");
  });

  const hugeEternityCount = 2_000_000_000_000_000_000n;
  runtime.setExactIntegerState(state, "eternityCountExact", "eternityCount", hugeEternityCount);
  const expectedFreeNormalLevels = hugeEternityCount * 10n;
  assert.equal(
    runtime.eternityMilestoneNormalUpgradeBonusExact(),
    expectedFreeNormalLevels,
    "EM1-2 should derive its free normal levels from the exact Eternity count",
  );

  state.eternityTfClaims = 52;
  assert.equal(runtime.timelineDiscovered(), true, "a huge exact Eternity count should discover Timeline");
  assert.equal(runtime.timelineEternityRequirement(), 2n ** 53n, "Timeline Eternity requirements should remain exact");
  assert.equal(runtime.canClaimTimelineTf("eternity"), true, "Timeline should compare huge exact counts without Number rounding");

  runtime.setExactIntegerState(state, "infinityCountExact", "infinityCount", hugeEternityCount);
  runtime.addAggregatedInfinityCount(1n);
  assert.equal(
    runtime.currentExactInfinityCount(),
    hugeEternityCount + 1n,
    "an aggregated Infinity +1 must remain exact above the safe integer boundary",
  );
  assert.ok(Number.isFinite(state.infinityCount), "the legacy Infinity projection must remain finite");

  runtime.setExactIntegerState(state, "speedLevelExact", "speedLevel", 1_000_000_000_000_000_000n);
  runtime.setExactIntegerState(state, "verticesExact", "vertices", 1_000_000_000_000_000_001n);
  const purchasedSpeedBefore = runtime.currentExactNormalUpgradeLevel("speed");
  runtime.addNormalUpgradeLevel("speed");
  assert.equal(
    runtime.currentExactNormalUpgradeLevel("speed"),
    purchasedSpeedBefore + 1n,
    "one normal-upgrade purchase must change the stored level above 1e18",
  );
  assert.ok(Number.isFinite(runtime.effectiveSpeedLevel()), "the effective normal-upgrade level must remain finite");

  runtime.updateUi();
  assert.equal(runtime.elements.infinityCount.textContent, "2.00e18", "large Infinity counts should use compact scientific UI formatting");
  assert.doesNotMatch(
    runtime.elements.speedLevel.textContent,
    /1000000000000000000/,
    "normal-upgrade UI should not dump unsafe full decimal counts",
  );
  const renderText = JSON.parse(instance.context.window.render_game_to_text());
  assert.equal(renderText.infinity.countExact, (hugeEternityCount + 1n).toString(), "render_game_to_text should expose the exact Infinity count");
  assert.equal(renderText.eternity.countExact, hugeEternityCount.toString(), "render_game_to_text should expose the exact Eternity count");
  assert.equal(renderText.upgrades.speedLevelExact, (1_000_000_000_000_000_000n + 1n).toString(), "render_game_to_text should expose the exact purchased level");
  assert.equal(renderText.verticesExact, "1000000000000000001", "render_game_to_text should expose exact purchased vertices");

  const saved = runtime.serializeSaveData();
  const reloaded = await loadRuntime(
    candidatePath,
    new Map([[runtime.SAVE_KEY, JSON.stringify(saved)]]),
  );
  assert.equal(reloaded.debug.state.infinityCountExact, (hugeEternityCount + 1n).toString(), "save/load should preserve a huge Infinity count exactly");
  assert.equal(reloaded.debug.state.eternityCountExact, hugeEternityCount.toString(), "save/load should preserve a huge Eternity count exactly");
  assert.equal(reloaded.debug.state.speedLevelExact, (1_000_000_000_000_000_000n + 1n).toString(), "save/load should preserve a huge purchased level exactly");
  assert.equal(reloaded.debug.state.verticesExact, "1000000000000000001", "save/load should preserve huge purchased vertices exactly");

  const legacy = structuredClone(saved);
  legacy.version = 11;
  delete legacy.state.verticesExact;
  delete legacy.state.ic8VertexUpgradeLevelExact;
  delete legacy.state.speedLevelExact;
  delete legacy.state.gainLevelExact;
  delete legacy.state.infinityCountExact;
  delete legacy.state.eternityCountExact;
  legacy.state.vertices = 13;
  legacy.state.speedLevel = 9;
  legacy.state.gainLevel = 11;
  legacy.state.infinityCount = 42;
  legacy.state.eternityCount = 7;
  const migrated = await loadRuntime(
    candidatePath,
    new Map([[runtime.SAVE_KEY, JSON.stringify(legacy)]]),
  );
  assert.equal(migrated.debug.state.verticesExact, "13", "legacy vertices should migrate to the exact representation");
  assert.equal(migrated.debug.state.speedLevelExact, "9", "legacy Speed levels should migrate to the exact representation");
  assert.equal(migrated.debug.state.infinityCountExact, "42", "legacy Infinity counts should migrate to the exact representation");
  assert.equal(migrated.debug.state.eternityCountExact, "7", "legacy Eternity counts should migrate to the exact representation");

  console.log("Late progression precision module runtime tests passed");
}

module.exports = { runLateProgressionPrecisionModuleRuntimeTest };
