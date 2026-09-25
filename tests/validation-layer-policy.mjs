import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const policy = await readFile(new URL("../docs/idd-policy.md", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/regression.yml", import.meta.url), "utf8");
const iddWork = await readFile(new URL("../.github/instructions/idd-work.instructions.md", import.meta.url), "utf8");
const iddPrSubmit = await readFile(new URL("../.github/instructions/idd-pr-submit.instructions.md", import.meta.url), "utf8");
const iddCi = await readFile(new URL("../.github/instructions/idd-ci.instructions.md", import.meta.url), "utf8");

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
assert.equal(packageJson.scripts["test:browser-smoke"], "node tests/browser-smoke.mjs", "browser smoke must have an explicit routine command");
assert.deepEqual(
  packageJson.scripts["test:browser-features"].split(" && "),
  [
    "node tests/browser-feature-regression.mjs",
    "node tests/eternity-ui-browser.mjs",
    "node tests/eternity-release-e2e.mjs",
  ],
  "browser feature coverage must stay in its focused command",
);
assert.deepEqual(
  packageJson.scripts["test:browser"].split(" && "),
  ["npm run test:browser-smoke", "npm run test:browser-features", "npm run test:render-regression"],
  "the aggregate browser command must preserve smoke, feature, and render layers",
);

assert.deepEqual(packageJson.scripts["validate:research"].split(" && "), researchSteps, "research validation must retain the named research checks");
for (const step of researchSteps) {
  assert.equal(routineSteps.includes(step), false, `${step} must not run in routine validation`);
}
assert.equal(routineSteps.includes("npm run test:local-performance-gate"), true, "routine validation must retain the deterministic local classifier");
assert.equal(routineSteps.includes("npm run test:performance:local"), false, "routine validation must not run the wall-clock local comparison");
assert.equal(routineSteps.includes("npm run test:performance"), false, "routine validation must not run strict hosted timing");
assert.equal(packageJson.scripts["test:performance:local"], "node scripts/local-performance-gate.mjs", "the local wall-clock diagnostic must remain explicitly runnable");
assert.deepEqual(fullSteps, ["npm run validate", "npm run test:performance", "npm run test:offline-stress", "npm run validate:research"], "full validation must compose the named layers");
assert.match(policy, /npm run validate:research/);
assert.match(policy, /npm run validate:full/);
assert.match(policy, /test:browser-smoke/);
assert.match(policy, /test:browser-features/);

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

assert.match(iddWork, /## Local performance evidence boundary/);
assert.match(iddWork, /Issue explicitly requires `npm run test:performance`/);
assert.match(iddWork, /`local-performance-pass`[\s\S]*record evidence and continue/);
assert.match(iddWork, /timing-budget-only failure[\s\S]*do not count it as a hosted-CI failure[\s\S]*second-failure hold/);
assert.match(iddWork, /repeated local timing-budget failures[\s\S]*failure count alone never invokes hosted-CI hold semantics/i);
assert.match(iddWork, /`local-performance-regression`[\s\S]*stop for candidate-specific repair/);
assert.match(iddWork, /`local-performance-inconclusive`[\s\S]*continue to PR; hosted CI is required/);
assert.match(iddWork, /malformed\/non-timing report[\s\S]*fail closed/);
assert.match(iddPrSubmit, /pre-push gate remains `npm run validate`/);
assert.match(iddPrSubmit, /the Issue also requires[\s\S]*do\s+not promote that strict timing command into a pre-push hard gate/);
assert.match(iddPrSubmit, /`local-performance-inconclusive`[\s\S]*proceeds to PR[\s\S]*requires\s+hosted CI/);
assert.match(iddCi, /only after a push/);
assert.match(iddCi, /current PR\s+head in hosted CI/);
assert.match(iddCi, /local\s+`npm run test:performance` timing overage[\s\S]*not a hosted-CI failure/);
assert.match(iddCi, /hosted performance job's strict `npm run test:performance` absolute\s+budgets remain required/);
assert.match(iddCi, /local inconclusive result never waives them/);
assert.match(iddCi, /first infrastructure\/flaky failure for the current hosted head[\s\S]*rerun that exact run once/);
assert.match(iddCi, /second failure, timeout, cancellation, or unknown state[\s\S]*hold and report/);
assert.match(policy, /ローカル性能とHosted CIの境界/);
assert.match(policy, /timing-budget-only failure[\s\S]*second-failure hold/);
assert.match(policy, /local-performance-regression[\s\S]*local-performance-inconclusive/);
assert.match(policy, /current-head Hosted CI[\s\S]*strict absolute/);

console.log("Validation layer policy passed");
