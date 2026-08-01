const assert = require("node:assert/strict");
const path = require("node:path");

async function runVersionConsistencyModuleRuntimeTest() {
  const checker = await import("./version-consistency.mjs");
  const root = path.resolve(__dirname, "..");
  const sources = await checker.loadVersionSources(root);
  assert.deepEqual(
    checker.collectVersionConsistencyIssues(sources),
    [],
    "the repository version references should be consistent",
  );

  const expectedVersion = checker.extractAppVersion(sources.constants);
  const upgradedSources = Object.fromEntries(
    Object.entries(sources).map(([key, source]) => [
      key,
      typeof source === "string" ? source.replaceAll(expectedVersion, "0.10.1") : source,
    ]),
  );
  assert.deepEqual(
    checker.collectVersionConsistencyIssues(upgradedSources),
    [],
    "a consistent 0.10.1 release notation should pass",
  );

  const mismatchedCssSources = {
    ...sources,
    index: sources.index.replace(`styles.css?v=${expectedVersion}`, "styles.css?v=0.10.1"),
  };
  const mismatchedCssIssues = checker.collectVersionConsistencyIssues(mismatchedCssSources);
  assert.ok(
    mismatchedCssIssues.some((entry) => entry.label.includes("CSS cache buster") && entry.actual === "0.10.1"),
    "a mismatched CSS cache buster should identify the target and detected value",
  );

  const missingJavaScriptSources = {
    ...sources,
    index: sources.index.replace(`src/main.js?v=${expectedVersion}`, "src/main.js"),
  };
  const missingJavaScriptIssues = checker.collectVersionConsistencyIssues(missingJavaScriptSources);
  assert.ok(
    missingJavaScriptIssues.some((entry) => entry.label.includes("src/main.js") && entry.actual === "<missing>"),
    "a missing JavaScript cache buster should be reported",
  );

  const missingImportMapJavaScriptSources = {
    ...sources,
    index: sources.index.replace(
      `./src/runtime/shared.js?v=${expectedVersion}`,
      "./src/runtime/shared.js",
    ),
  };
  const missingImportMapJavaScriptIssues = checker.collectVersionConsistencyIssues(missingImportMapJavaScriptSources);
  assert.ok(
    missingImportMapJavaScriptIssues.some(
      (entry) => entry.label.includes("src/runtime/shared.js") && entry.actual === "<missing>",
    ),
    "a missing non-main JavaScript cache buster should be reported",
  );

  const missingJapaneseTitleSources = {
    ...sources,
    i18n: sources.i18n.replace(/updateTitle:\s*["'`][^"'`]*["'`]/, "updateSummary: \"missing title\""),
  };
  const missingJapaneseTitleIssues = checker.collectVersionConsistencyIssues(missingJapaneseTitleSources);
  assert.ok(
    missingJapaneseTitleIssues.some((entry) => entry.label === "src/data/i18n.js Japanese updateTitle" && entry.actual === "<missing>"),
    "a missing Japanese update title should be reported",
  );

  console.log("Version consistency module runtime tests passed");
}

module.exports = { runVersionConsistencyModuleRuntimeTest };
