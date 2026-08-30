import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const policy = await readFile(new URL("../docs/idd-policy.md", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/regression.yml", import.meta.url), "utf8");

const researchScripts = [
  "test:tc4-balance",
  "test:tc4-balance-followup",
  "test:tc4-balance-sensitivity",
  "test:tc4-balance-a-search",
  "test:tc4-a-form-search",
  "test:tc4-a-form-frontier",
  "test:tc4-log-frontier-continuation",
  "test:ic8-eternity-progression"
];
const researchSteps = researchScripts.map((name) => `npm run ${name}`);
const routineSteps = packageJson.scripts.validate.split(" && ");
const fullSteps = packageJson.scripts["validate:full"].split(" && ");

assert.deepEqual(packageJson.scripts["validate:research"].split(" && "), researchSteps, "research validation must retain the named research checks");
for (const step of researchSteps) {
  assert.equal(routineSteps.includes(step), false, `${step} must not run in routine validation`);
}
assert.equal(routineSteps.includes("npm run test:local-performance-gate"), true, "routine validation must retain the deterministic local classifier");
assert.equal(routineSteps.includes("npm run test:performance:local"), false, "routine validation must not run the wall-clock local comparison");
assert.equal(packageJson.scripts["test:performance:local"], "node scripts/local-performance-gate.mjs", "the local wall-clock diagnostic must remain explicitly runnable");
assert.deepEqual(fullSteps, ["npm run validate", "npm run test:performance", "npm run test:offline-stress", "npm run validate:research"], "full validation must compose the named layers");
assert.match(policy, /npm run validate:research/);
assert.match(policy, /npm run validate:full/);

const jobBlock = (name) => {
  const match = workflow.match(new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-z0-9-]+:\\n|$)`));
  assert.ok(match, `workflow must define the ${name} job`);
  return match[1];
};
const regressionJob = jobBlock("regression");
const performanceJob = jobBlock("performance");
const offlineStressJob = jobBlock("offline-stress");
const directRunCount = (job, command) => (job.match(new RegExp(`^\\s+run: ${command}$`, "gm")) || []).length;

assert.equal(directRunCount(regressionJob, "npm run test:local-performance-gate"), 1, "regression job must own the deterministic local classifier");
assert.equal(directRunCount(regressionJob, "npm run test:performance"), 0, "regression job must not own hosted performance timing");
assert.equal(directRunCount(regressionJob, "npm run test:offline-stress"), 0, "regression job must not own offline stress");
assert.equal(directRunCount(performanceJob, "npm run test:performance"), 1, "performance job must own hosted performance timing");
assert.equal(directRunCount(performanceJob, "npm run test:offline-stress"), 0, "performance job must not own offline stress");
assert.equal(directRunCount(offlineStressJob, "npm run test:offline-stress"), 1, "offline-stress job must own offline stress");
assert.equal(directRunCount(offlineStressJob, "npm run test:performance"), 0, "offline-stress job must not own hosted performance timing");
assert.match(performanceJob, /npx playwright install chromium/);
assert.match(offlineStressJob, /npx playwright install chromium/);
assert.doesNotMatch(workflow, /^\s+needs:/m, "hosted jobs must remain independently runnable");
assert.doesNotMatch(workflow, /continue-on-error:\s*true/, "hosted gates must not become advisory");
assert.match(regressionJob, /name: regression-diagnostics/);
assert.match(regressionJob, /browser-smoke-report\.json/);
assert.match(regressionJob, /output\/render-regression\.json/);
assert.match(performanceJob, /name: performance-diagnostics/);
assert.match(performanceJob, /output\/performance-smoke\.json/);
assert.match(offlineStressJob, /name: offline-stress-diagnostics/);
assert.match(offlineStressJob, /output\/offline-stress\.json/);

console.log("Validation layer policy passed");
