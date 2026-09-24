const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainSource = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");
const i18nSource = fs.readFileSync(path.join(root, "src", "data", "i18n.js"), "utf8");
const eternityI18nSource = fs.readFileSync(path.join(root, "src", "data", "eternity-i18n.js"), "utf8");
const eventsSource = fs.readFileSync(path.join(root, "src", "ui", "events.js"), "utf8");
const offlineProgressSource = fs.readFileSync(path.join(root, "src", "core", "offline-progress.js"), "utf8");
const saveSource = fs.readFileSync(path.join(root, "src", "core", "save.js"), "utf8");
const timeFluxSource = fs.readFileSync(path.join(root, "src", "systems", "time-flux.js"), "utf8");
const renderEternitySource = fs.readFileSync(path.join(root, "src", "ui", "render-eternity.js"), "utf8");
const exactIntegerSource = fs.readFileSync(path.join(root, "src", "ui", "format-exact-integer.js"), "utf8");
const renderRecoverySource = fs.readFileSync(path.join(root, "src", "ui", "render-save-recovery.js"), "utf8");
const renderTimelineSource = fs.readFileSync(path.join(root, "src", "ui", "render-timeline.js"), "utf8");
const renderUiSource = fs.readFileSync(path.join(root, "src", "ui", "render-ui.js"), "utf8");
const angleSource = fs.readFileSync(path.join(root, "src", "systems", "angle.js"), "utf8");
const achievementsSource = fs.readFileSync(path.join(root, "src", "systems", "achievements.js"), "utf8");
const runtimeOwnerNames = ["clock.js", "update-check.js", "automation.js", "browser-lifecycle.js", "game-loop.js", "debug-adapter.js"];
const runtimeOwnerSources = Object.fromEntries(runtimeOwnerNames.map((name) => [
  name,
  fs.readFileSync(path.join(root, "src", "runtime", name), "utf8"),
]));
const imports = [...mainSource.matchAll(/^import "\.\/([^\"]+)";$/gm)]
  .map((entry) => `src/${entry[1]}`);
const expectedLegacySideEffectImports = [
  "src/ui/dom.js",
  "src/core/constants.js",
  "src/data/i18n.js",
  "src/data/infinity-data.js",
  "src/core/state.js",
  "src/core/numbers.js",
  "src/core/save-code.js",
  "src/systems/achievements.js",
  "src/systems/tower.js",
  "src/ui/render-ui.js",
  "src/systems/angle.js",
  "src/systems/generation.js",
  "src/systems/core-boost.js",
  "src/systems/infinity.js",
  "src/systems/infinite-angle.js",
  "src/systems/eternity.js",
  "src/systems/timeline.js",
  "src/core/offline-progress.js",
  "src/runtime/automation.js",
  "src/runtime/browser-lifecycle.js",
  "src/runtime/debug-adapter.js",
];

assert.deepStrictEqual(
  imports,
  expectedLegacySideEffectImports,
  "remaining legacy side-effect imports must stay in their required entrypoint order",
);
assert.match(mainSource, /^import \{ runtime, expose \} from "\.\/runtime\/shared\.js";/m);
function assertNamedImports(source, modulePath, names) {
  const statements = source.match(/^import\s*\{[^}]*\}\s*from\s*"[^"]+";$/gm) || [];
  const statement = statements.find((candidate) => candidate.endsWith('from "' + modulePath + '";'));
  assert.ok(statement, "missing named import from " + modulePath);
  const importedNames = statement.match(/\{([\s\S]*?)\}/)[1].split(/[,\s]+/).filter(Boolean);
  for (const name of names) {
    assert.ok(importedNames.includes(name), name + " must be imported from " + modulePath);
  }
}
assertNamedImports(mainSource, "./core/save.js", ["loadGame"]);
assertNamedImports(mainSource, "./ui/render-canvas.js", ["draw", "drawInfiniteAngle", "resizeCanvas", "resizeInfiniteAngleCanvas"]);
assertNamedImports(mainSource, "./ui/render-challenges.js", ["createChallengeRows", "createTowerChallengeRows"]);
assertNamedImports(mainSource, "./ui/render-infinity.js", ["createInfinityUpgradeRows"]);
assertNamedImports(mainSource, "./ui/render-achievements.js", ["createAchievementRows"]);
assertNamedImports(mainSource, "./ui/events.js", ["bindEvents", "switchMainTab", "switchEternitySubtab", "switchInfinitySubtab", "switchChallengeSubtab", "switchStatisticsSubtab"]);
assertNamedImports(mainSource, "./runtime/clock.js", ["syncServerClock"]);
assertNamedImports(mainSource, "./runtime/update-check.js", ["showUpdateModalIfNeeded", "checkForRemoteUpdate"]);
assertNamedImports(mainSource, "./runtime/game-loop.js", ["requestNextFrame", "frame"]);
assert.doesNotMatch(mainSource, /runtime\.(?:syncServerClock|bindEvents|createChallengeRows|createTowerChallengeRows|createInfinityUpgradeRows|createAchievementRows|loadGame|switchMainTab|switchEternitySubtab|switchInfinitySubtab|switchChallengeSubtab|switchStatisticsSubtab|resizeCanvas|resizeInfiniteAngleCanvas|showUpdateModalIfNeeded|checkForRemoteUpdate|draw|drawInfiniteAngle|requestNextFrame|frame)\b/);
assertNamedImports(eventsSource, "../core/save.js", ["clampOfflineTickCount"]);
assertNamedImports(offlineProgressSource, "./save.js", ["clampOfflineTickCount"]);
assert.doesNotMatch(saveSource, /runtime\.clampOfflineTickCount/);
assert.doesNotMatch(offlineProgressSource, /runtime\.clampOfflineTickCount/);
assert.doesNotMatch(eventsSource, /runtime\.clampOfflineTickCount/);
assert.doesNotMatch(timeFluxSource, /clampOfflineTickCount/);
assert.match(offlineProgressSource, /^function processOfflineElapsed\(/m);
assert.match(offlineProgressSource, /^async function processOfflineElapsedInternal\(/m);
assert.match(offlineProgressSource, /expose\("processOfflineElapsed"/);
assert.doesNotMatch(mainSource, /^(?:async )?function processOfflineElapsed\(/m);
assert.doesNotMatch(mainSource, /^let offline(?:Processing|Report)\b/m);
assert.doesNotMatch(mainSource, /^function (?:offlineSnapshot|offlineCoreHitPlan|runOfflineEventBoundaryEngine)\(/m);
assert.doesNotMatch(mainSource, /^(?:async )?function (?:monotonicClockNow|syncServerClock|checkForRemoteUpdate|runLayerAutomation|handleVisibilityChange|frame|renderGameToText)\(/m);
assert.match(runtimeOwnerSources["clock.js"], /^async function syncServerClock\(/m);
assert.match(runtimeOwnerSources["update-check.js"], /^async function checkForRemoteUpdate\(/m);
assert.match(runtimeOwnerSources["automation.js"], /^function runLayerAutomation\(/m);
assert.match(runtimeOwnerSources["browser-lifecycle.js"], /^async function handleVisibilityChange\(/m);
assert.match(runtimeOwnerSources["game-loop.js"], /^function frame\(/m);
assert.match(runtimeOwnerSources["debug-adapter.js"], /^function renderGameToText\(/m);
for (const source of Object.values(runtimeOwnerSources)) {
  assert.doesNotMatch(source, /^import .*\.\/(?:clock|update-check|automation|browser-lifecycle|game-loop|debug-adapter)\.js/m);
}
assert.match(i18nSource, /^import \{ ETERNITY_TEXT \} from "\.\/eternity-i18n\.js";$/m);
assert.match(eternityI18nSource, /^export const ETERNITY_TEXT = \{/m);
assert.doesNotMatch(eternityI18nSource, /runtime|Object\.assign/);
assert.doesNotMatch(eventsSource, /render-eternity/);
assert.match(renderUiSource, /^import \{ updateEternityUi \} from "\.\/render-eternity\.js";$/m);
assert.match(renderUiSource, /^import \{ formatExactInteger \} from "\.\/format-exact-integer\.js";$/m);
assert.match(renderUiSource, /^import \{ updateSaveRecoveryUi \} from "\.\/render-save-recovery\.js";$/m);
assert.match(renderUiSource, /^import \{ updateTimelineUi \} from "\.\/render-timeline\.js";$/m);
assertNamedImports(renderUiSource, "./render-topbar.js", ["updateTopBar"]);
assertNamedImports(renderUiSource, "./render-challenges.js", ["updateChallengeRows", "updateTowerChallengeRows"]);
assertNamedImports(renderUiSource, "./render-infinity.js", ["updateInfinityUpgradeRows"]);
assertNamedImports(renderUiSource, "./render-achievements.js", ["updateAchievementRows"]);
assertNamedImports(renderUiSource, "./render-automation.js", ["updateAutomationUi", "updateStatisticsUi"]);
assertNamedImports(renderUiSource, "./render-offline-report.js", ["updateOfflineReportUi"]);
assertNamedImports(renderUiSource, "./render-help.js", ["updateHelpUi"]);
assert.doesNotMatch(renderUiSource, /runtime\.(?:updateTopBar|updateChallengeRows|updateTowerChallengeRows|updateInfinityUpgradeRows|updateAchievementRows|updateAutomationUi|updateStatisticsUi|updateOfflineReportUi|updateHelpUi)\b/);
assert.match(renderUiSource, /updateEternityUi\(\);/);
assert.match(renderUiSource, /updateTimelineUi\(\);[\s\S]*updateSaveRecoveryUi\(\);/);
assert.doesNotMatch(
  renderUiSource,
  /function (?:updateSaveRecoveryUi|updateTimelineUi|renderTimeline|createTimeline|updateTimeline|selectTimelineNode|formatTimeline|localizedTimelineText|timelineNode|formatRecoveryTimestamp|recoveryReasonText|countBits|countAchievementBits|recoveryStateSummary)|selectedTimelineNodeId|renderedRecoveryRevision/,
);
assert.match(exactIntegerSource, /^export function formatExactInteger\(/m);
assert.match(renderRecoverySource, /^export function updateSaveRecoveryUi\(/m);
assert.match(renderRecoverySource, /renderedRecoveryRevision/);
assert.match(renderRecoverySource, /expose\("updateSaveRecoveryUi"/);
assert.match(renderTimelineSource, /^export function updateTimelineUi\(/m);
assert.match(renderTimelineSource, /selectedTimelineNodeId/);
assert.match(renderTimelineSource, /expose\("updateTimelineUi"/);
assert.match(renderTimelineSource, /expose\("selectTimelineNode"/);
assert.match(offlineProgressSource, /runtime\.updateUi = batchedUpdateUi;/);
assert.match(offlineProgressSource, /runtime\.saveGame = batchedSaveGame;/);
assert.doesNotMatch(angleSource, /runtime\.currentScoreLog10\s*=/);
assert.match(angleSource, /achievement\.isUnlocked\(projectedScoreLog\)/);
assert.match(achievementsSource, /isUnlocked: \(scoreLog10 = runtime\.currentScoreLog10\(\)\) => scoreLog10 > 30/);
assert.match(achievementsSource, /isUnlocked: \(scoreLog10 = runtime\.currentScoreLog10\(\)\) => scoreLog10 >= 314/);
assert.match(achievementsSource, /isUnlocked: \(scoreLog10 = runtime\.currentScoreLog10\(\)\) => scoreLog10 > 628/);
assert.match(achievementsSource, /isUnlocked: \(scoreLog10 = runtime\.currentScoreLog10\(\)\) => scoreLog10 > 2450/);
assert.doesNotMatch(renderEternitySource, /wrapUpdateUi|runtime\.updateUi\s*=/);

const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(indexSource, /<script type="module" src="src\/main\.js[^\"]*"><\/script>/);
assert.match(indexSource, /"\.\/src\/data\/eternity-i18n\.js": "\.\/src\/data\/eternity-i18n\.js\?v=0\.14\.0"/);
assert.match(indexSource, /"\.\/src\/core\/offline-progress\.js": "\.\/src\/core\/offline-progress\.js\?v=0\.14\.0"/);
assert.match(indexSource, /"\.\/src\/ui\/render-eternity\.js": "\.\/src\/ui\/render-eternity\.js\?v=0\.14\.0"/);
assert.match(indexSource, /"\.\/src\/ui\/format-exact-integer\.js": "\.\/src\/ui\/format-exact-integer\.js\?v=0\.14\.0"/);
assert.match(indexSource, /"\.\/src\/ui\/render-save-recovery\.js": "\.\/src\/ui\/render-save-recovery\.js\?v=0\.14\.0"/);
assert.match(indexSource, /"\.\/src\/ui\/render-timeline\.js": "\.\/src\/ui\/render-timeline\.js\?v=0\.14\.0"/);
for (const name of runtimeOwnerNames) {
  const entry = '"./src/runtime/' + name + '": "./src/runtime/' + name + '?v=0.14.0"';
  assert.ok(indexSource.includes(entry), name + " must use the canonical app cache version");
}
assert.equal(fs.existsSync(path.join(root, "game.js")), false, "the removed classic entrypoint must stay absent");

for (const moduleName of [
  "balance.js",
  "balance-angle.js",
  "balance-generation.js",
  "balance-core-boost.js",
  "balance-infinity.js",
  "balance-ui.js",
]) {
  assert.equal(
    fs.existsSync(path.join(root, "src", "systems", moduleName)),
    false,
    moduleName + " must stay removed after active balance canonicalization",
  );
}

console.log("ESM entrypoint and import order are canonical");
