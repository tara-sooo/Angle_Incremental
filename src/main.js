import { runtime, expose } from "./runtime/shared.js";
import "./ui/dom.js";
import "./core/constants.js";
import "./data/i18n.js";
import "./data/infinity-data.js";
import "./core/state.js";
import "./core/numbers.js";
import { loadGame } from "./core/save.js";
import "./core/save-code.js";
import "./systems/achievements.js";
import "./systems/tower.js";
import { draw, drawInfiniteAngle, resizeCanvas, resizeInfiniteAngleCanvas } from "./ui/render-canvas.js";
import { createChallengeRows, createTowerChallengeRows } from "./ui/render-challenges.js";
import { createInfinityUpgradeRows } from "./ui/render-infinity.js";
import { createAchievementRows } from "./ui/render-achievements.js";
import "./ui/render-ui.js";
import "./systems/angle.js";
import "./systems/generation.js";
import "./systems/core-boost.js";
import "./systems/infinity.js";
import "./systems/infinite-angle.js";
import {
  bindEvents,
  switchMainTab,
  switchEternitySubtab,
  switchInfinitySubtab,
  switchChallengeSubtab,
  switchStatisticsSubtab,
} from "./ui/events.js";
import "./systems/eternity.js";
import "./systems/timeline.js";
import "./core/offline-progress.js";
import { syncServerClock } from "./runtime/clock.js";
import { showUpdateModalIfNeeded, checkForRemoteUpdate } from "./runtime/update-check.js";
import "./runtime/automation.js";
import "./runtime/browser-lifecycle.js";
import { requestNextFrame, frame } from "./runtime/game-loop.js";
import "./runtime/debug-adapter.js";

let japaneseFontReady = false;

async function initializeGame() {
  await syncServerClock();
  bindEvents();
  createChallengeRows();
  createTowerChallengeRows();
  createInfinityUpgradeRows();
  createAchievementRows();
  await loadGame();
  switchMainTab(runtime.activeMainTab);
  switchEternitySubtab(runtime.activeEternitySubtab);
  switchInfinitySubtab(runtime.activeInfinitySubtab);
  switchChallengeSubtab(runtime.activeChallengeSubtab);
  switchStatisticsSubtab(runtime.activeStatisticsSubtab);
  resizeCanvas();
  resizeInfiniteAngleCanvas();
  runtime.updateUi();
  showUpdateModalIfNeeded();
  checkForRemoteUpdate();
  if (document.fonts) {
    document.fonts.ready.then(() => {
      japaneseFontReady = true;
      runtime.updateUi();
      draw();
      drawInfiniteAngle();
    });
  } else {
    japaneseFontReady = true;
  }
  requestNextFrame(frame);
}

expose("japaneseFontReady", () => japaneseFontReady, (value) => { japaneseFontReady = value; });

window.__angleDebug.ready = initializeGame();
