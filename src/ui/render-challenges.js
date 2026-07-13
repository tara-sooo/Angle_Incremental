import { runtime, expose } from "../runtime/shared.js";

function createChallengeRows() {
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

expose("createChallengeRows", () => createChallengeRows);
expose("updateChallengeRows", () => updateChallengeRows);
