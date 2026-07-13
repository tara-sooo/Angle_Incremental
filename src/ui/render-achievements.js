import { runtime, expose } from "../runtime/shared.js";

let lastAchievementSignature = null;

function createAchievementRows() {
  lastAchievementSignature = null;
  runtime.clearElement(runtime.elements.achievementList);
  runtime.ACHIEVEMENTS.forEach((achievement, index) => {
    const row = document.createElement("article");
    row.className = "achievement-row";
    row.dataset.achievement = String(index + 1);
    const number = document.createElement("strong");
    number.className = "achievement-number";
    const body = document.createElement("div");
    body.className = "achievement-body";
    const title = document.createElement("h2");
    title.className = "achievement-title";
    const condition = document.createElement("p");
    condition.className = "achievement-condition";
    const reward = document.createElement("p");
    reward.className = "achievement-reward";
    const status = document.createElement("span");
    status.className = "achievement-status";
    body.append(title, condition, reward);
    row.append(number, body, status);
    runtime.elements.achievementList.append(row);
  });
}

function updateAchievementRows() {
  const signature = `${runtime.state.achievementMask}|${runtime.state.language}`;
  if (signature === lastAchievementSignature) return;
  lastAchievementSignature = signature;
  const language = runtime.TEXT[runtime.state.language] ? runtime.state.language : "ja";
  runtime.elements.achievementList.querySelectorAll(".achievement-row").forEach((row) => {
    const id = Number(row.dataset.achievement);
    const achievement = runtime.ACHIEVEMENTS[id - 1];
    const unlocked = runtime.isAchievementUnlocked(id);
    const extraReward = achievement.reward[language];
    row.classList.toggle("is-unlocked", unlocked);
    row.querySelector(".achievement-number").textContent = String(id);
    row.querySelector(".achievement-title").textContent = achievement.title[language];
    row.querySelector(".achievement-condition").textContent = achievement.condition[language];
    const reward = row.querySelector(".achievement-reward");
    reward.hidden = !extraReward;
    reward.textContent = extraReward ? `${runtime.t("achievementReward")}: ${extraReward}` : "";
    row.querySelector(".achievement-status").textContent = unlocked ? runtime.t("achievementUnlocked") : runtime.t("achievementLocked");
  });
}

expose("createAchievementRows", () => createAchievementRows);
expose("updateAchievementRows", () => updateAchievementRows);
