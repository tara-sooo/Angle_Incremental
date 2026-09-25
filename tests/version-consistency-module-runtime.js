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
  const alternateVersion = expectedVersion === "0.10.1" ? "0.10.2" : "0.10.1";
  const upgradedSources = Object.fromEntries(
    Object.entries(sources).map(([key, source]) => [
      key,
      typeof source === "string" ? source.replaceAll(expectedVersion, alternateVersion) : source,
    ]),
  );
  assert.deepEqual(
    checker.collectVersionConsistencyIssues(upgradedSources),
    [],
    `a consistent ${alternateVersion} release notation should pass`,
  );

  const mismatchedCssSources = {
    ...sources,
    index: sources.index.replace(`styles.css?v=${expectedVersion}`, `styles.css?v=${alternateVersion}`),
  };
  const mismatchedCssIssues = checker.collectVersionConsistencyIssues(mismatchedCssSources);
  assert.ok(
    mismatchedCssIssues.some((entry) => entry.label.includes("CSS cache buster") && entry.actual === alternateVersion),
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

  for (const invalidQuery of ["?v=", "?cache=1"]) {
    const invalidImportMapJavaScriptSources = {
      ...sources,
      index: sources.index.replace(
        `./src/runtime/shared.js?v=${expectedVersion}`,
        `./src/runtime/shared.js${invalidQuery}`,
      ),
    };
    const invalidImportMapJavaScriptIssues = checker.collectVersionConsistencyIssues(invalidImportMapJavaScriptSources);
    assert.ok(
      invalidImportMapJavaScriptIssues.some(
        (entry) => entry.label.includes("src/runtime/shared.js") && entry.actual === "<missing>",
      ),
      `an invalid non-main JavaScript cache buster should be reported: ${invalidQuery}`,
    );
  }

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
