const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

function testHeldResourceFormatting({ runtime, debug }) {
  const { state } = debug;
  const justBelowPower = Math.log10(9.999);
  const justAbovePower = Math.log10(1.001);

  for (const numberFormat of ["compact", "scientific", "detailed"]) {
    state.numberFormat = numberFormat;
    assert.equal(runtime.formatHeldUiLogNumber(justBelowPower + 49), "9.99e49", `${numberFormat} held values must truncate below e50`);
    assert.equal(runtime.formatHeldUiLogNumber(Math.log10(9.995) + 49), "9.99e49", `${numberFormat} held values must not round 9.995e49 upward`);
    assert.equal(runtime.formatHeldUiLogNumber(50), "1.00e50", `${numberFormat} exact powers must keep the normalized exponent`);
    assert.equal(runtime.formatHeldUiLogNumber(justAbovePower + 50), "1.00e50", `${numberFormat} values above a power must remain normalized`);
    assert.equal(runtime.formatHeldUiLogNumber(Math.log10(9.999)), "9.99", `${numberFormat} held values below the scientific threshold must also truncate`);
  }

  for (const exponent of [18, 50, 100, 200, 307]) {
    assert.equal(runtime.formatHeldUiLogNumber(justBelowPower + exponent), `9.99e${exponent}`, `held truncation must remain below e${exponent + 1}`);
    assert.equal(runtime.formatHeldUiLogNumber(exponent), `1.00e${exponent}`, `held exact powers must format at e${exponent}`);
  }

  assert.equal(runtime.formatUiLogNumber(justBelowPower + 49), "1.00e50", "ordinary formatting must keep rounding and normalize a mantissa carry");
  runtime.syncInfinityPointCachesFromExact(10n ** 50n - 1n);
  assert.equal(runtime.formatHeldUiLogNumber(runtime.currentInfinityPointsLog10(), state.infinityPointsExact), "9.99e49", "exact IP immediately below the Tower cost must remain visibly below e50");
  assert.equal(runtime.canBuildTower(), false, "Tower must remain unavailable below its exact IP cost");
  runtime.syncInfinityPointCachesFromExact(10n ** 50n);
  assert.equal(runtime.formatHeldUiLogNumber(runtime.currentInfinityPointsLog10(), state.infinityPointsExact), "1.00e50", "exact IP at the Tower cost must display the normalized e50 value");
  assert.equal(runtime.canBuildTower(), true, "Tower must be available at its exact IP cost");
}

function testVertexGainFormatting({ runtime, debug }) {
  const { state } = debug;
  state.numberFormat = "compact";
  assert.equal(runtime.formatVertexGainIncrease(-3), "0.001", "compact display must preserve a 0.001 vertex gain");
  assert.equal(runtime.formatVertexGainIncrease(-2), "0.01", "compact display must preserve a 0.01 vertex gain");
  assert.equal(runtime.formatVertexGainIncrease(0), "1", "compact display must preserve a unit vertex gain");
  assert.equal(runtime.formatVertexGainIncrease(Math.log10(12.345)), "12.345", "compact display must preserve three decimal places below the shared-format boundary");
  assert.equal(runtime.formatVertexGainIncrease(Math.log10(999)), "999", "999 must remain below the shared-format boundary");
  assert.equal(runtime.formatVertexGainIncrease(3), "1,000", "1000 must use the shared compact formatter");
  assert.equal(runtime.formatVertexGainIncrease(6), "1.00M", "compact display must use suffixes at 1e6");
  assert.equal(runtime.formatVertexGainIncrease(12), "1.00T", "compact display must use suffixes at 1e12");
  assert.equal(runtime.formatVertexGainIncrease(18), "1.00e18", "compact display must use exponent notation at 1e18");
  assert.equal(runtime.formatVertexGainIncrease(309), "1.00e309", "compact display must preserve finite log values beyond native numbers");

  state.numberFormat = "scientific";
  assert.equal(runtime.formatVertexGainIncrease(3), "1.00e3", "scientific display must format 1000 as an exponent");
  assert.equal(runtime.formatVertexGainIncrease(6), "1.00e6", "scientific display must format 1e6 as an exponent");
  assert.equal(runtime.formatVertexGainIncrease(12), "1.00e12", "scientific display must format 1e12 as an exponent");

  state.numberFormat = "detailed";
  assert.equal(runtime.formatVertexGainIncrease(3), "1,000", "detailed display must preserve the shared 1000 formatting");
  assert.equal(runtime.formatVertexGainIncrease(6), "1.00M", "detailed display must preserve the shared suffix formatting");
  assert.equal(runtime.formatVertexGainIncrease(18), "1.00e18", "detailed display must preserve the shared exponent formatting");

  assert.equal(runtime.formatVertexGainIncrease(Number.NaN), "0", "NaN vertex gains must render safely");
  assert.equal(runtime.formatVertexGainIncrease(undefined), "0", "undefined vertex gains must render safely");
  assert.equal(runtime.formatVertexGainIncrease(-Infinity), "0", "negative infinity vertex gains must render safely");
  assert.equal(runtime.formatVertexGainIncrease(Infinity), "∞", "positive infinity vertex gains must render as a stable symbol");
  assert.equal(runtime.formatVertexGainIncrease(1e309), "∞", "overflowed native values must render as a stable symbol");
  assert.equal(runtime.formatVertexGainIncrease(Number.MAX_VALUE), "∞", "the numeric stability ceiling must render as a stable symbol");

  state.numberFormat = "compact";
  state.activeChallenge = 6;
  runtime.updateUi();
  assert.equal(runtime.elements.vertexGainValue.textContent, "+0.001", "IC6 must keep the fixed 0.001 display precision");
  state.activeChallenge = 0;
  state.gainLevel = 99999;
  runtime.updateUi();
  assert.equal(runtime.elements.vertexGainValue.textContent, "+1,000", "the UI must add the plus sign to shared compact formatting");
  state.numberFormat = "scientific";
  runtime.updateUi();
  assert.equal(runtime.elements.vertexGainValue.textContent, "+1.00e3", "the UI must follow scientific formatting at the boundary");
  state.gainLevel = 99999999;
  runtime.updateUi();
  assert.equal(runtime.elements.vertexGainValue.textContent, "+1.00e6", "the UI must format large gain values without native 1e+ notation");
}

async function runDisplayFormattingModuleRuntimeTest() {
  const instance = await loadRuntime(candidatePath);
  testVertexGainFormatting(instance);
  testHeldResourceFormatting(instance);
  console.log("Display formatting module runtime tests passed");
}

module.exports = { runDisplayFormattingModuleRuntimeTest };
