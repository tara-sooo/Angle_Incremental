const assert = require("node:assert/strict");
const path = require("node:path");
const { loadRuntime } = require("./runtime-harness-esm.js");

const candidatePath = path.join(__dirname, "..", "src", "main.js");

async function runHeldResourceDisplayModuleRuntimeTest() {
  const instance = await loadRuntime(candidatePath);
  const { runtime, debug } = instance;
  const { state } = debug;
  const justBelowPower = Math.log10(9.999);
  const justAbovePower = Math.log10(1.001);

  for (const numberFormat of ["compact", "scientific", "detailed"]) {
    state.numberFormat = numberFormat;
    assert.equal(
      runtime.formatHeldUiLogNumber(justBelowPower + 49),
      "9.99e49",
      `${numberFormat} held values must truncate below e50`,
    );
    assert.equal(
      runtime.formatHeldUiLogNumber(Math.log10(9.995) + 49),
      "9.99e49",
      `${numberFormat} held values must not round 9.995e49 upward`,
    );
    assert.equal(
      runtime.formatHeldUiLogNumber(50),
      "1.00e50",
      `${numberFormat} exact powers must keep the normalized exponent`,
    );
    assert.equal(
      runtime.formatHeldUiLogNumber(justAbovePower + 50),
      "1.00e50",
      `${numberFormat} values above a power must remain normalized`,
    );
    assert.equal(
      runtime.formatHeldUiLogNumber(Math.log10(9.999)),
      "9.99",
      `${numberFormat} held values below the scientific threshold must also truncate`,
    );
  }

  for (const exponent of [18, 50, 100, 200, 307]) {
    assert.equal(
      runtime.formatHeldUiLogNumber(justBelowPower + exponent),
      `9.99e${exponent}`,
      `held truncation must remain below e${exponent + 1}`,
    );
    assert.equal(
      runtime.formatHeldUiLogNumber(exponent),
      `1.00e${exponent}`,
      `held exact powers must format at e${exponent}`,
    );
  }

  assert.equal(
    runtime.formatUiLogNumber(justBelowPower + 49),
    "1.00e50",
    "ordinary formatting must keep rounding and normalize a mantissa carry",
  );

  runtime.syncInfinityPointCachesFromExact(10n ** 50n - 1n);
  assert.equal(
    runtime.formatHeldUiLogNumber(runtime.currentInfinityPointsLog10(), state.infinityPointsExact),
    "9.99e49",
    "exact IP immediately below the Tower cost must remain visibly below e50",
  );
  assert.equal(runtime.canBuildTower(), false, "Tower must remain unavailable below its exact IP cost");

  runtime.syncInfinityPointCachesFromExact(10n ** 50n);
  assert.equal(
    runtime.formatHeldUiLogNumber(runtime.currentInfinityPointsLog10(), state.infinityPointsExact),
    "1.00e50",
    "exact IP at the Tower cost must display the normalized e50 value",
  );
  assert.equal(runtime.canBuildTower(), true, "Tower must be available at its exact IP cost");

  console.log("Held resource display module runtime tests passed");
}

module.exports = { runHeldResourceDisplayModuleRuntimeTest };
