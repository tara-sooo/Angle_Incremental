import { runtime, expose } from "../runtime/shared.js";

let newsTickerIndex = 0;
let newsTickerIterationBound = false;
let lastTopBarSignature = "";

function currentNewsMessages() {
  const language = runtime.TEXT[runtime.state.language] ? runtime.state.language : "ja";
  return runtime.TEXT[language].newsMessages || runtime.TEXT.ja.newsMessages || [];
}

function setNewsTickerMessage() {
  const messages = currentNewsMessages();
  if (messages.length === 0) return;
  newsTickerIndex %= messages.length;
  runtime.elements.newsTickerText.textContent = messages[newsTickerIndex];
}

function advanceNewsTickerMessage() {
  if (runtime.state.topBarMode !== "news") return;
  const messages = currentNewsMessages();
  if (messages.length === 0) return;
  newsTickerIndex = (newsTickerIndex + 1) % messages.length;
  setNewsTickerMessage();
}

function bindNewsTickerIteration() {
  if (newsTickerIterationBound || !runtime.elements.newsTickerText) return;
  newsTickerIterationBound = true;
  runtime.elements.newsTickerText.addEventListener("animationiteration", (event) => {
    if (event.animationName && event.animationName !== "news-scroll") return;
    advanceNewsTickerMessage();
  });
}

function topBarSignature(mode) {
  const language = runtime.state.language;
  const numberFormat = runtime.state.numberFormat;
  if (mode === "news" || mode === "blank" || mode === "hidden") return `${mode}|${language}`;
  if (mode === "resources") {
    return [
      mode,
      language,
      numberFormat,
      runtime.currentScoreLog10(),
      runtime.currentInfinityPointsLog10(),
      runtime.currentInfiniteScoreLog10(),
    ].join("|");
  }
  return [
    mode,
    language,
    numberFormat,
    runtime.state.generationCount,
    runtime.currentTotalScoreLog10(),
    runtime.currentScoreLog10(),
    runtime.currentGenerationScoreLog10(),
    runtime.currentPreviousGenerationScoreLog10(),
    runtime.state.coreBoostCount,
    runtime.state.infinityCount,
    runtime.state.activeChallenge,
    runtime.state.completedChallenges,
    runtime.state.achievementMask,
    runtime.state.achievementMaskHigh,
  ].join("|");
}

function updateTopBar() {
  if (!runtime.elements.newsTicker || !runtime.elements.newsTickerText) return;
  bindNewsTickerIteration();
  const mode = runtime.normalizeChoice(runtime.state.topBarMode, ["news", "resources", "progress", "blank", "hidden"], "news");
  const label = runtime.elements.newsTicker.querySelector(".news-label");
  runtime.state.topBarMode = mode;
  const signature = topBarSignature(mode);
  if (signature === lastTopBarSignature) return;
  lastTopBarSignature = signature;
  if (runtime.elements.shell) runtime.elements.shell.classList.toggle("is-top-bar-hidden", mode === "hidden");
  document.documentElement.classList.toggle("top-bar-hidden", mode === "hidden");
  runtime.elements.newsTicker.hidden = mode === "hidden";
  runtime.elements.newsTicker.classList.toggle("is-static", mode !== "news");
  runtime.elements.newsTicker.classList.toggle("is-blank", mode === "blank");
  if (mode === "hidden") return;
  if (mode === "blank") {
    if (label) label.textContent = "";
    runtime.elements.newsTickerText.textContent = "";
    return;
  }
  if (mode === "resources") {
    if (label) label.textContent = runtime.t("topBarResources");
    const score = runtime.scoreDisplay();
    const ip = runtime.formatUiLogNumber(runtime.currentInfinityPointsLog10());
    const ia = runtime.formatUiLogNumber(runtime.currentInfiniteScoreLog10());
    runtime.elements.newsTickerText.textContent = `Score ${score} / IP ${ip} / IA ${ia}`;
    return;
  }
  if (mode === "progress") {
    if (label) label.textContent = runtime.t("topBarProgress");
    const infinityReady = runtime.canInfinity();
    const infinityState = infinityReady ? "READY" : runtime.state.infinityCount > 0 ? "OPEN" : "LOCKED";
    const generationUnlocked = runtime.currentTotalScoreLog10() >= runtime.log10Value(runtime.GENERATION_UNLOCK_SCORE);
    const generationReady = runtime.canRunGeneration();
    const waitingPrevious = generationUnlocked
      && runtime.state.generationCount > 0
      && runtime.currentGenerationScoreLog10() >= runtime.log10Value(runtime.GENERATION_UNLOCK_SCORE)
      && !generationReady;
    const generationState = generationReady
      ? runtime.t("generationReady")
      : waitingPrevious
        ? runtime.t("generationWaitingPrevious")
        : generationUnlocked
          ? runtime.t("generationUnlocked")
          : runtime.t("generationLocked");
    runtime.elements.newsTickerText.textContent = `GR ${runtime.state.generationCount} ${generationState} / CB ${runtime.state.coreBoostCount} next ${runtime.formatPowerOfTen(runtime.coreBoostRequirementLog10())} / INF ${infinityState} / ACH ${runtime.achievementCount()}/${runtime.ACHIEVEMENT_COUNT}`;
    return;
  }
  if (label) label.textContent = runtime.t("topBarNews");
  setNewsTickerMessage();
}

expose("currentNewsMessages", () => currentNewsMessages);
expose("setNewsTickerMessage", () => setNewsTickerMessage);
expose("advanceNewsTickerMessage", () => advanceNewsTickerMessage);
expose("bindNewsTickerIteration", () => bindNewsTickerIteration);
expose("updateTopBar", () => updateTopBar);
