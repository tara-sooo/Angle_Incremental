import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const policy = await readFile(new URL("../docs/idd-policy.md", import.meta.url), "utf8");

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
assert.deepEqual(fullSteps, ["npm run validate", "npm run test:performance", "npm run test:offline-stress", "npm run validate:research"], "full validation must compose the named layers");
assert.match(policy, /npm run validate:research/);
assert.match(policy, /npm run validate:full/);

console.log("Validation layer policy passed");
