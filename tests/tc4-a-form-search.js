const assert = require("node:assert/strict");
const {
  aExponentForCandidate,
  TC4_A_FORM_IDS,
} = require("../scripts/simulate-tc4-balance.js");
const {
  CANDIDATES,
  DIAGNOSTIC,
  createAFormSearchReport,
  formatMarkdown,
} = require("../scripts/simulate-tc4-a-form-search.js");

const TINY_OPTIONS = Object.freeze({
  maxSeconds: 120,
  stepSeconds: 10,
  maxStates: 20,
  maxRoutes: 10,
  stallSeconds: 120,
  policyIds: ["fixed-60", "gain-aware-2x", "threshold-aware"],
  searchComplete: true,
});

function testAFormEvaluator() {
  const parts = 3;
  const level = 4;
  const candidate = (aForm) => ({ a: 1, aForm });
  assert.equal(aExponentForCandidate(candidate("flat-additive"), level, parts), 7);
  assert.ok(Math.abs(aExponentForCandidate(candidate("power-accumulation"), level, parts) - (3 + 4 ** 1.25)) < 1e-12);
  assert.ok(Math.abs(aExponentForCandidate(candidate("logarithmic-accumulation"), level, parts) - (3 + 4 * (1 + Math.log2(5)))) < 1e-12);
  assert.equal(aExponentForCandidate(candidate("multiplicative"), level, parts), 15);
  assert.deepEqual([...TC4_A_FORM_IDS], [
    "flat-additive",
    "power-accumulation",
    "logarithmic-accumulation",
    "multiplicative",
  ]);
}

async function runTc4AFormSearchTest() {
  testAFormEvaluator();
  const overrides = {
    stage1: TINY_OPTIONS,
    stage2: TINY_OPTIONS,
    stage3: TINY_OPTIONS,
    diagnostic: TINY_OPTIONS,
  };
  const first = await createAFormSearchReport(overrides);
  const second = await createAFormSearchReport(overrides);
  assert.deepEqual(first, second, "A-form study output must be deterministic");
  assert.equal(first.issue, 134);
  assert.equal(first.researchOnly, true);
  assert.equal(first.noProductionChanges, true);
  assert.equal(first.relationshipToIssue125.includes("status:needs-decision"), true);
  assert.deepEqual(first.candidateDesign.map(({ id }) => id), CANDIDATES.map(({ id }) => id));
  assert.equal(first.candidateDesign.every(({ parameters: { B, C } }) => B === 0.35 && C === 1), true);
  assert.equal(first.diagnosticControl.id, DIAGNOSTIC.id);
  assert.equal(first.diagnosticControl.parameters.diagnosticOnly, true);
  assert.equal(first.stages.stage1.candidates.length, CANDIDATES.length);
  assert.equal(first.stages.stage3.candidateIds[0], CANDIDATES[0].id);
  assert.equal(first.stages.diagnostic.candidates.length, 1);
  assert.equal(first.candidates.every(({ terminalEvidence }) => terminalEvidence !== null), true);
  assert.equal(first.candidates.every(({ bestAdaptive }) => Array.isArray(Object.keys(bestAdaptive.firstMilestoneTimes))), true);
  assert.equal(typeof first.diagnosis.classification, "string");
  assert.equal(typeof first.diagnosis.hypotheticalA2PeakDeltaLog10, "number");
  assert.equal(typeof first.recommendation.status, "string");
  assert.match(formatMarkdown(first), /Phase-1 wall diagnosis/);
  assert.match(formatMarkdown(first), /E = parts \+ A \* level/);
  return first;
}

if (require.main === module) {
  runTc4AFormSearchTest()
    .then(() => console.log("TC4 A-form search tests passed"))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
}

module.exports = { runTc4AFormSearchTest };
