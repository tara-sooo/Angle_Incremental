import { runtime, expose } from "../runtime/shared.js";

let lastChallengeSignature = null;
let lastTowerChallengeSignature = null;

function createChallengeRows() {
  lastChallengeSignature = null;
  runtime.clearElement(runtime.elements.challengeList);
  for (let index = 1; index <= runtime.INFINITY_CHALLENGE_COUNT; index += 1) {
    const row = document.createElement("div");
    row.className = "challenge-row";
    row.dataset.challenge = String(index);

    const info = document.createElement("div");
    info.className = "challenge-info";
    const name = document.createElement("strong");
    name.className = "challenge-name";
    const status = document.createElement("small");
    status.className = "challenge-state";
    const restriction = document.createElement("p");
    restriction.className = "challenge-restriction";
    const reward = document.createElement("p");
    reward.className = "challenge-reward";
    const button = document.createElement("button");
    button.className = "challenge-start-button";
    button.type = "button";
    button.addEventListener("click", () => runtime.toggleInfinityChallenge(index));

    info.append(name, status, restriction, reward);
    row.append(info, button);
    runtime.elements.challengeList.append(row);
  }
}

function updateChallengeRows() {
  const signature = [
    runtime.state.activeChallenge,
    runtime.state.completedChallenges,
    runtime.state.infinityCount,
    runtime.state.infinityUpgradeMask,
    runtime.state.language,
  ].join("|");
  if (signature === lastChallengeSignature) return;
  lastChallengeSignature = signature;
  runtime.elements.challengeList.querySelectorAll(".challenge-row").forEach((row) => {
    const index = Number(row.dataset.challenge);
    const active = runtime.state.activeChallenge === index;
    const completed = runtime.isChallengeCompleted(index);
    const locked = !runtime.infinityChallengesUnlocked();
    const button = row.querySelector("button");

    row.classList.toggle("is-active", active);
    row.classList.toggle("is-completed", completed);
    row.querySelector(".challenge-name").textContent = runtime.challengeName(index);
    row.querySelector(".challenge-state").textContent = runtime.challengeStateText(index);
    row.querySelector(".challenge-restriction").textContent = `${runtime.t("challengeRestrictionLabel")}: ${runtime.challengeRestriction(index)}`;
    row.querySelector(".challenge-reward").textContent = `${runtime.t("challengeRewardLabel")}: ${runtime.challengeReward(index)}`;
    button.textContent = active ? runtime.t("stopChallenge") : runtime.t("startChallenge");
    button.disabled = locked || (runtime.state.activeChallenge > 0 && !active);
  });
}

function createTowerChallengeRows() {
  lastTowerChallengeSignature = null;
  runtime.clearElement(runtime.elements.towerChallengeList);
  for (let index = 1; index <= runtime.TOWER_CHALLENGE_COUNT; index += 1) {
    const row = document.createElement("div");
    row.className = "challenge-row tower-challenge-row";
    row.dataset.towerChallenge = String(index);

    const info = document.createElement("div");
    info.className = "challenge-info";
    const name = document.createElement("strong");
    name.className = "challenge-name";
    const status = document.createElement("small");
    status.className = "challenge-state";
    const target = document.createElement("p");
    target.className = "challenge-target";
    const restriction = document.createElement("p");
    restriction.className = "challenge-restriction";
    const reward = document.createElement("p");
    reward.className = "challenge-reward";
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = true;
    button.addEventListener("click", () => runtime.toggleTowerChallenge(index));

    info.append(name, status, target, restriction, reward);
    row.append(info, button);
    runtime.elements.towerChallengeList.append(row);
  }
}

function towerChallenge4UpgradeEffectText(kind, effectKey) {
  if (kind === "baseGain") {
    return `${runtime.t(effectKey)}: +${runtime.tc4BaseGainPartsBonus().toFixed(2)}`;
  }
  if (kind === "infinityScoreVertexGain") {
    const bonusLog10 = runtime.tc4InfinityScoreVertexGainBonusLog10(runtime.currentInfiniteScoreLog10());
    return `${runtime.t(effectKey)}: ×${runtime.formatUiLogNumber(bonusLog10)}`;
  }
  return `${runtime.t(effectKey)}: +${Math.max(0, runtime.effectiveCoreBoostCount() - runtime.state.coreBoostCount)} ${runtime.t("coreBoost")}`;
}

function updateTowerChallenge4UpgradeRows() {
  const tc4UpgradeList = runtime.elements.tc4UpgradeList;
  if (!tc4UpgradeList || tc4UpgradeList.hidden) return;

  tc4UpgradeList.querySelectorAll("[data-tc4-upgrade]").forEach((button) => {
    const kind = button.dataset.tc4Upgrade;
    const level = runtime.towerChallenge4UpgradeLevel(kind);
    const label = runtime.t(button.dataset.labelKey);
    const price = runtime.formatUiLogNumber(runtime.towerChallenge4UpgradePriceLog10(kind));
    button.querySelector(".tc4-upgrade-label").textContent = label;
    button.querySelector(".tc4-upgrade-effect").textContent = towerChallenge4UpgradeEffectText(kind, button.dataset.effectKey);
    button.querySelector(".tc4-upgrade-level").textContent = `${runtime.t("level")} ${level}`;
    button.querySelector(".tc4-upgrade-cost").textContent = `${runtime.t("towerChallenge4UpgradePrice")}: ${price}`;
    const canBuy = runtime.canBuyTowerChallenge4Upgrade(kind);
    const action = canBuy
      ? runtime.t("upgradeActionBuy")
      : runtime.t("upgradeActionUnavailable");
    button.disabled = !canBuy;
    button.setAttribute("aria-label", `${label} — ${button.querySelector(".tc4-upgrade-effect").textContent} — ${button.querySelector(".tc4-upgrade-cost").textContent} — ${action}`);
  });
}

function updateTowerChallengeRows() {
  const activeTc4 = runtime.state.activeTowerChallenge === 4;
  const normalUpgradeList = runtime.elements.normalUpgradeList;
  const tc4UpgradeList = runtime.elements.tc4UpgradeList;
  if (normalUpgradeList) normalUpgradeList.hidden = activeTc4;
  if (tc4UpgradeList) tc4UpgradeList.hidden = !activeTc4;
  let completedCount = 0;
  for (let index = 1; index <= runtime.TOWER_CHALLENGE_COUNT; index += 1) {
    if (runtime.towerChallengeCompleted(index)) completedCount += 1;
  }
  if (runtime.elements.towerChallengeStatus) {
    runtime.elements.towerChallengeStatus.textContent = runtime.state.activeTowerChallenge > 0
      ? `${runtime.towerChallengeName(runtime.state.activeTowerChallenge)} ${runtime.t("challengeRunning")}`
      : `${completedCount}/${runtime.TOWER_CHALLENGE_COUNT} ${runtime.t("completed")}`;
  }
  const signature = [
    runtime.state.towerFloor,
    runtime.state.activeTowerChallenge,
    runtime.state.completedTowerChallenges,
    runtime.state.infinityCount,
    runtime.state.language,
    runtime.state.numberFormat,
    runtime.currentScoreLog10(),
    runtime.currentInfiniteScoreLog10(),
    ...Object.keys(runtime.TC4_UPGRADE_DEFINITIONS).map((kind) => [
      runtime.towerChallenge4UpgradeLevel(kind),
      runtime.towerChallenge4UpgradePriceStep(kind),
    ]).flat(),
  ].join("|");
  if (signature === lastTowerChallengeSignature) return;
  lastTowerChallengeSignature = signature;
  updateTowerChallenge4UpgradeRows();
  runtime.elements.towerChallengeList.querySelectorAll(".tower-challenge-row").forEach((row) => {
    const index = Number(row.dataset.towerChallenge);
    const unlockFloor = runtime.towerChallengeUnlockFloor(index);
    const implemented = runtime.towerChallengeImplemented(index);
    const unlocked = runtime.towerChallengeUnlocked(index);
    const completed = runtime.towerChallengeCompleted(index);
    const active = runtime.state.activeTowerChallenge === index;
    const targetLog10 = runtime.towerChallengeTargetLog10(index);
    const button = row.querySelector("button");
    row.classList.toggle("is-completed", completed);
    row.classList.toggle("is-active", active);
    row.querySelector(".challenge-name").textContent = runtime.towerChallengeName(index) || `TC${index}`;
    row.querySelector(".challenge-state").textContent = !implemented
      ? runtime.t("towerChallengeComingSoon")
      : active
        ? runtime.t("challengeRunning")
        : completed
          ? runtime.t("challengeCompleted")
          : unlocked
            ? runtime.t("towerChallengeAvailable")
            : runtime.t("towerChallengeLocked").replace("{floor}", String(unlockFloor));
    row.querySelector(".challenge-target").textContent = Number.isFinite(targetLog10)
      ? `${runtime.t("towerChallengeTarget")}: ${runtime.formatUiLogNumber(targetLog10)} Score`
      : runtime.t("towerChallengeComingSoon");
    row.querySelector(".challenge-restriction").textContent = `${runtime.t("challengeRestrictionLabel")}: ${runtime.towerChallengeRestriction(index)}`;
    row.querySelector(".challenge-reward").textContent = `${runtime.t("challengeRewardLabel")}: ${runtime.towerChallengeReward(index)}${runtime.towerChallengeRewardUnlocked(index) ? ` (${runtime.t("towerChallengeRewardUnlocked")})` : ""}`;
    button.textContent = active ? runtime.t("stopChallenge") : runtime.t("startChallenge");
    button.disabled = !implemented || !unlocked || (runtime.state.activeTowerChallenge > 0 && !active);

  });
}

expose("createChallengeRows", () => createChallengeRows);
expose("updateChallengeRows", () => updateChallengeRows);
expose("createTowerChallengeRows", () => createTowerChallengeRows);
expose("updateTowerChallengeRows", () => updateTowerChallengeRows);
