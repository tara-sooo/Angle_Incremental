const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

async function runVertexGainDisplayModuleRuntimeTest() {
  const instance = await loadRuntime(candidatePath);
  const { runtime, debug } = instance;
  const { state } = debug;

  state.numberFormat = "compact";
  assert.equal(runtime.formatVertexGainIncrease(-3), "0.001", "compact display must preserve a 0.001 vertex gain");
  assert.equal(runtime.formatVertexGainIncrease(-2), "0.01", "compact display must preserve a 0.01 vertex gain");
  assert.equal(runtime.formatVertexGainIncrease(0), "1", "compact display must preserve a unit vertex gain");
  assert.equal(
    runtime.formatVertexGainIncrease(Math.log10(12.345)),
    "12.345",
    "compact display must preserve three decimal places below the shared-format boundary",
  );
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

  console.log("Vertex gain display module runtime tests passed");
}

module.exports = { runVertexGainDisplayModuleRuntimeTest };
