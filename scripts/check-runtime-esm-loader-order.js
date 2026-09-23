const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mainSource = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");
const i18nSource = fs.readFileSync(path.join(root, "src", "data", "i18n.js"), "utf8");
const eternityI18nSource = fs.readFileSync(path.join(root, "src", "data", "eternity-i18n.js"), "utf8");
const eventsSource = fs.readFileSync(path.join(root, "src", "ui", "events.js"), "utf8");
const renderEternitySource = fs.readFileSync(path.join(root, "src", "ui", "render-eternity.js"), "utf8");
const exactIntegerSource = fs.readFileSync(path.join(root, "src", "ui", "format-exact-integer.js"), "utf8");
const renderRecoverySource = fs.readFileSync(path.join(root, "src", "ui", "render-save-recovery.js"), "utf8");
const renderTimelineSource = fs.readFileSync(path.join(root, "src", "ui", "render-timeline.js"), "utf8");
const renderUiSource = fs.readFileSync(path.join(root, "src", "ui", "render-ui.js"), "utf8");
const imports = [...mainSource.matchAll(/^import "\.\/([^\"]+)";$/gm)]
  .map((entry) => `src/${entry[1]}`);
const expectedOrder = [
  "src/ui/dom.js",
  "src/core/constants.js",
  "src/data/i18n.js",
  "src/data/infinity-data.js",
  "src/core/state.js",
  "src/core/numbers.js",
  "src/core/save.js",
  "src/core/save-code.js",
  "src/systems/achievements.js",
  "src/systems/tower.js",
  "src/ui/render-canvas.js",
  "src/ui/render-topbar.js",
  "src/ui/render-challenges.js",
  "src/ui/render-infinity.js",
  "src/ui/render-achievements.js",
  "src/ui/render-automation.js",
  "src/ui/render-offline-report.js",
  "src/ui/render-help.js",
  "src/ui/render-eternity.js",
  "src/ui/render-ui.js",
  "src/systems/angle.js",
  "src/systems/generation.js",
  "src/systems/core-boost.js",
  "src/systems/infinity.js",
  "src/systems/infinite-angle.js",
  "src/ui/events.js",
  "src/systems/eternity.js",
  "src/systems/timeline.js",
];

assert.deepStrictEqual(
  imports,
  expectedOrder,
  "ESM side-effect imports must match the canonical runtime order",
);
assert.match(mainSource, /^import \{ runtime, expose \} from "\.\/runtime\/shared\.js";/m);
assert.match(mainSource, /^import "\.\/ui\/render-eternity\.js";$/m);
assert.match(i18nSource, /^import \{ ETERNITY_TEXT \} from "\.\/eternity-i18n\.js";$/m);
assert.match(eternityI18nSource, /^export const ETERNITY_TEXT = \{/m);
assert.doesNotMatch(eternityI18nSource, /runtime|Object\.assign/);
assert.doesNotMatch(eventsSource, /render-eternity/);
assert.match(renderUiSource, /^import \{ updateEternityUi \} from "\.\/render-eternity\.js";$/m);
assert.match(renderUiSource, /^import \{ formatExactInteger \} from "\.\/format-exact-integer\.js";$/m);
assert.match(renderUiSource, /^import \{ updateSaveRecoveryUi \} from "\.\/render-save-recovery\.js";$/m);
assert.match(renderUiSource, /^import \{ updateTimelineUi \} from "\.\/render-timeline\.js";$/m);
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
assert.doesNotMatch(renderEternitySource, /wrapUpdateUi|runtime\.updateUi\s*=/);

const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(indexSource, /<script type="module" src="src\/main\.js[^\"]*"><\/script>/);
assert.match(indexSource, /"\.\/src\/data\/eternity-i18n\.js": "\.\/src\/data\/eternity-i18n\.js\?v=0\.13\.2"/);
assert.match(indexSource, /"\.\/src\/ui\/render-eternity\.js": "\.\/src\/ui\/render-eternity\.js\?v=0\.13\.2"/);
assert.match(indexSource, /"\.\/src\/ui\/format-exact-integer\.js": "\.\/src\/ui\/format-exact-integer\.js\?v=0\.13\.2"/);
assert.match(indexSource, /"\.\/src\/ui\/render-save-recovery\.js": "\.\/src\/ui\/render-save-recovery\.js\?v=0\.13\.2"/);
assert.match(indexSource, /"\.\/src\/ui\/render-timeline\.js": "\.\/src\/ui\/render-timeline\.js\?v=0\.13\.2"/);
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
