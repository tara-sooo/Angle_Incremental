import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { classifyValidationProfile } from "../scripts/idd-validation-profile.mjs";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const policy = await readFile(new URL("../docs/idd-policy.md", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/regression.yml", import.meta.url), "utf8");
const iddWork = await readFile(new URL("../.github/instructions/idd-work.instructions.md", import.meta.url), "utf8");
const iddCore = await readFile(new URL("../.github/instructions/idd-overview-core.instructions.md", import.meta.url), "utf8");
const iddDiscover = await readFile(new URL("../.github/instructions/idd-discover.instructions.md", import.meta.url), "utf8");
const iddSuitability = await readFile(new URL("../.github/instructions/idd-suitability.instructions.md", import.meta.url), "utf8");
const iddExperience = await readFile(new URL("../.github/instructions/idd-experience.instructions.md", import.meta.url), "utf8");
const iddClaim = await readFile(new URL("../.github/instructions/idd-claim.instructions.md", import.meta.url), "utf8");
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
const profileJob = jobBlock("validation-profile");
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
assert.match(regressionJob, /needs: validation-profile/);
assert.match(performanceJob, /needs: validation-profile/);
assert.match(offlineStressJob, /needs: validation-profile/);
assert.match(profileJob, /checks: read[\s\S]*contents: read[\s\S]*pull-requests: read/);
assert.match(profileJob, /pulls\.listFiles/);
assert.match(profileJob, /checks\.listForRef/);
assert.match(profileJob, /updatedAt === Date\.parse\(previous\.updated_at\)[\s\S]*return false/);
assert.match(profileJob, /merge-tree[\s\S]*--write-tree/);
assert.match(profileJob, /refs\/heads\/main/);
assert.match(regressionJob, /Run docs-policy or integration-only checks/);
assert.match(regressionJob, /regression_profile != 'docs-policy'[\s\S]*regression_profile != 'integration-only'/);
assert.match(performanceJob, /Performance not applicable[\s\S]*performance_required == 'false'/);
assert.match(offlineStressJob, /Offline stress not applicable[\s\S]*offline_stress_required == 'false'/);
assert.match(regressionJob, /if: \$\{\{ always\(\) \}\}/);
assert.match(performanceJob, /if: \$\{\{ always\(\) \}\}/);
assert.match(offlineStressJob, /if: \$\{\{ always\(\) \}\}/);
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
assert.match(iddPrSubmit, /Select and run the deterministic local validation profile/);
assert.match(iddPrSubmit, /Install dependencies only when the selected/);
assert.match(iddPrSubmit, /For the `performance` profile[\s\S]*local timing-only overage is evidence, not a hosted-CI failure/);
assert.match(iddPrSubmit, /`local-performance-inconclusive`[\s\S]*proceeds to PR[\s\S]*hosted performance gate remains required whenever that profile applies/);
assert.match(iddCi, /only after a push/);
assert.match(iddCi, /current PR\s+head in hosted CI/);
assert.match(iddCi, /local\s+`npm run test:performance` timing overage[\s\S]*not a hosted-CI failure/);
assert.match(iddCi, /When the current-head validation profile requires performance evidence,[\s\S]*hosted performance job's strict `npm run test:performance` absolute budgets[\s\S]*remain mandatory/);
assert.match(iddCi, /local inconclusive result never waives them/);
assert.match(iddCi, /first infrastructure\/flaky failure for the current hosted head[\s\S]*rerun that exact run once/);
assert.match(iddCi, /second failure, timeout, cancellation, or unknown state[\s\S]*hold and report/);
assert.match(policy, /ローカル性能とHosted CIの境界/);
assert.match(policy, /timing-budget-only failure[\s\S]*second-failure hold/);
assert.match(policy, /local-performance-regression[\s\S]*local-performance-inconclusive/);
assert.match(policy, /current-head Hosted CI[\s\S]*strict absolute/);

const baseSha = "a".repeat(40);
const mainSha = "b".repeat(40);
const cleanBackmerge = {
  baseRef: "next",
  baseSha,
  parents: [baseSha, mainSha],
  secondParentOnMain: true,
  mergeTreeMatches: true,
  sourceChecks: { base: true, main: true }
};
const classify = (overrides = {}) => classifyValidationProfile({
  eventName: "pull_request",
  baseRef: "next",
  paths: ["src/core/constants.js"],
  labels: [],
  ...overrides
});

assert.deepEqual(classify({
  paths: ["docs/idd-policy.md", "scripts/idd-validation-profile.mjs", "tests/validation-layer-policy.mjs"]
}), {
  regressionProfile: "docs-policy",
  performanceRequired: false,
  offlineStressRequired: false,
  reason: "Only IDD policy, instructions, classifier, and focused policy tests changed."
});
assert.deepEqual(classify({ paths: ["src/ui/render-help.js"] }), {
  regressionProfile: "routine",
  performanceRequired: false,
  offlineStressRequired: false,
  reason: "Known production or regression-test paths; run the regression floor and applicable specialist gates."
});
assert.equal(classify({ paths: ["scripts/idd-issue-association.mjs"] }).regressionProfile, "full",
  "write-adjacent IDD helpers must not enter the docs-only profile");
assert.equal(classify({ paths: ["tests/idd-issue-association-module-runtime.js"] }).regressionProfile, "routine",
  "IDD runtime tests keep the regression floor");
assert.equal(classify().performanceRequired, true, "core runtime changes retain hosted performance evidence");
const offline = classify({ paths: ["src/core/offline-progress.js"] });
assert.equal(offline.performanceRequired, true);
assert.equal(offline.offlineStressRequired, true, "offline scheduling changes retain offline stress evidence");
const mergeOnly = classify({ paths: ["src/core/constants.js", "src/ui/render-ui.js"], integrationProof: cleanBackmerge });
assert.equal(mergeOnly.regressionProfile, "integration-only", "verified source-head evidence may cover imported production paths");
assert.equal(mergeOnly.performanceRequired, false);
assert.equal(mergeOnly.offlineStressRequired, false);
assert.notEqual(classify({ integrationProof: { ...cleanBackmerge, mergeTreeMatches: false } }).regressionProfile, "integration-only");
assert.notEqual(classify({ integrationProof: { ...cleanBackmerge, sourceChecks: { base: true, main: false } } }).regressionProfile, "integration-only");
assert.notEqual(classify({ integrationProof: { ...cleanBackmerge, parents: [mainSha] } }).regressionProfile, "integration-only");
assert.notEqual(classify({ integrationProof: { ...cleanBackmerge, secondParentOnMain: false } }).regressionProfile, "integration-only");
assert.equal(classify({ paths: ["docs/gameplay.md"] }).regressionProfile, "full", "unclassified docs fail closed");
assert.equal(classify({ paths: ["src/ui/render-ui.js"], baseRef: "release/1.0" }).regressionProfile, "full");
assert.equal(classify({ paths: ["src/ui/render-ui.js"], labels: ["idd-validation:full"] }).offlineStressRequired, true);
assert.equal(classify({ paths: ["docs/idd-policy.md"], labels: ["idd-validation:offline-stress"] }).offlineStressRequired, true);
assert.equal(classify({ paths: ["src/ui/render-ui.js"], labels: ["idd-validation:unknown"] }).regressionProfile, "full");
assert.equal(classify({ eventName: "push", paths: ["src/ui/render-ui.js"] }).regressionProfile, "full");
assert.equal(classify({ paths: [] }).regressionProfile, "full");

assert.match(iddWork, /\*\*Simple:[\s\S]*\*\*Standard:[\s\S]*\*\*Complex:/);
assert.match(iddWork, /Do not install dependencies by default[\s\S]*npm ci` only when/);
assert.match(iddWork, /save\/progression architecture[\s\S]*refined final/);
assert.match(iddDiscover, /check only the pre-claim ownership[\s\S]*safety boundary/);
assert.match(iddDiscover, /no trusted, non-stale claim is active/);
assert.match(iddDiscover, /no conflicting open PR/);
assert.match(iddDiscover, /target-namespace branch, or worktree\s+collision/);
assert.match(iddDiscover, /Do not run broad[\s\S]*before A5/);
assert.match(iddSuitability, /after verified A5 claim/);
assert.match(iddSuitability, /release\s+the exact active\s+claim[\s\S]*stop before implementation/);
assert.doesNotMatch(iddSuitability, /do not claim[\s\S]*release the exact active claim/i);
assert.match(iddClaim, /full\s+non-ownership suitability gate after verified claim and worktree ownership/);
assert.match(iddCore, /explicit Issue supplied \| `idd-discover` → `idd-claim`/);
assert.match(iddCore, /suitability\/context not checked[\s\S]*`idd-suitability`/);
assert.match(iddExperience, /After verified claim\/worktree ownership/);
assert.match(iddExperience, /ephemeral and advisory[\s\S]*broaden the lookup/);
assert.match(iddPrSubmit, /Select and run the deterministic local validation profile/);
assert.match(policy, /classifier失敗・未知入力は全gateを実行する重いprofile/);

console.log("Validation layer policy passed");
