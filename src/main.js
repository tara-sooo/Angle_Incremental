import { runtime, expose } from "./runtime/shared.js";
import "./ui/dom.js";
import "./core/constants.js";
import "./data/i18n.js";
import "./data/infinity-data.js";
import "./core/state.js";
import "./core/numbers.js";
import "./core/save.js";
import "./core/save-code.js";
import "./systems/achievements.js";
import "./systems/tower.js";
import "./ui/render-canvas.js";
import "./ui/render-topbar.js";
import "./ui/render-challenges.js";
import "./ui/render-infinity.js";
import "./ui/render-achievements.js";
import "./ui/render-automation.js";
import "./ui/render-offline-report.js";
import "./ui/render-help.js";
import "./ui/render-eternity.js";
import "./ui/render-ui.js";
import "./systems/angle.js";
import "./systems/generation.js";
import "./systems/core-boost.js";
import "./systems/infinity.js";
import "./systems/infinite-angle.js";
import "./ui/events.js";
import "./systems/eternity.js";
import "./systems/timeline.js";
import "./core/offline-progress.js";
import "./runtime/clock.js";
import "./runtime/update-check.js";
import "./runtime/automation.js";
import "./runtime/browser-lifecycle.js";
import "./runtime/game-loop.js";
import "./runtime/debug-adapter.js";

let japaneseFontReady = false;

async function initializeGame() {
  await runtime.syncServerClock();
  runtime.bindEvents();
  runtime.createChallengeRows();
  runtime.createTowerChallengeRows();
  runtime.createInfinityUpgradeRows();
  runtime.createAchievementRows();
  await runtime.loadGame();
  runtime.switchMainTab(runtime.activeMainTab);
  runtime.switchEternitySubtab(runtime.activeEternitySubtab);
  runtime.switchInfinitySubtab(runtime.activeInfinitySubtab);
  runtime.switchChallengeSubtab(runtime.activeChallengeSubtab);
  runtime.switchStatisticsSubtab(runtime.activeStatisticsSubtab);
  runtime.resizeCanvas();
  runtime.resizeInfiniteAngleCanvas();
  runtime.updateUi();
  runtime.showUpdateModalIfNeeded();
  runtime.checkForRemoteUpdate();
  if (document.fonts) {
    document.fonts.ready.then(() => {
      japaneseFontReady = true;
      runtime.updateUi();
      runtime.draw();
      runtime.drawInfiniteAngle();
    });
  } else {
    japaneseFontReady = true;
  }
  runtime.requestNextFrame(runtime.frame);
}

expose("japaneseFontReady", () => japaneseFontReady, (value) => { japaneseFontReady = value; });

window.__angleDebug.ready = initializeGame();
