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
    const restriction = document.createElement("p");
    restriction.className = "challenge-restriction";
    const reward = document.createElement("p");
    reward.className = "challenge-reward";
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = true;

    info.append(name, status, restriction, reward);
    row.append(info, button);
    runtime.elements.towerChallengeList.append(row);
  }
}

function updateTowerChallengeRows() {
  const signature = [runtime.state.towerFloor, runtime.state.language].join("|");
  if (signature === lastTowerChallengeSignature) return;
  lastTowerChallengeSignature = signature;
  runtime.elements.towerChallengeList.querySelectorAll(".tower-challenge-row").forEach((row) => {
    const index = Number(row.dataset.towerChallenge);
    const unlockFloor = runtime.towerChallengeUnlockFloor(index);
    const unlocked = runtime.towerChallengeUnlocked(index);
    const completed = runtime.towerChallengeCompleted(index);
    row.classList.toggle("is-completed", completed);
    row.classList.toggle("is-active", false);
    row.querySelector(".challenge-name").textContent = `TC${index}`;
    row.querySelector(".challenge-state").textContent = unlocked
      ? runtime.t("towerChallengeUnlocked").replace("{floor}", String(unlockFloor))
      : runtime.t("towerChallengeLocked").replace("{floor}", String(unlockFloor));
    row.querySelector(".challenge-restriction").textContent = `${runtime.t("challengeRestrictionLabel")}: ${runtime.t("towerChallengeRestriction")}`;
    row.querySelector(".challenge-reward").textContent = `${runtime.t("challengeRewardLabel")}: ${runtime.t("towerChallengeReward")}`;
    row.querySelector("button").textContent = runtime.t("towerChallengeComingSoon");
  });
}

expose("createChallengeRows", () => createChallengeRows);
expose("updateChallengeRows", () => updateChallengeRows);
expose("createTowerChallengeRows", () => createTowerChallengeRows);
expose("updateTowerChallengeRows", () => updateTowerChallengeRows);
