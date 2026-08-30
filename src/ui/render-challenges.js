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
    if (index === 4) {
      const upgradeList = document.createElement("div");
      upgradeList.className = "tc4-upgrade-list";
      [
        ["baseGain", "towerChallenge4UpgradeBaseGain", "towerChallenge4UpgradeBaseGainEffect"],
        ["infinityScoreVertexGain", "towerChallenge4UpgradeInfinityScoreVertexGain", "towerChallenge4UpgradeInfinityScoreVertexGainEffect"],
        ["freeCoreBoost", "towerChallenge4UpgradeFreeCoreBoost", "towerChallenge4UpgradeFreeCoreBoostEffect"],
      ].forEach(([kind, labelKey, effectKey]) => {
        const card = document.createElement("div");
        card.className = "tc4-upgrade-card";
        card.dataset.tc4Upgrade = kind;
        const label = document.createElement("strong");
        label.className = "tc4-upgrade-label";
        const effect = document.createElement("small");
        effect.className = "tc4-upgrade-effect";
        const buy = document.createElement("button");
        buy.className = "tc4-upgrade-button";
        buy.type = "button";
        buy.addEventListener("click", () => runtime.buyTowerChallenge4Upgrade(kind));
        card.append(label, effect, buy);
        card.dataset.labelKey = labelKey;
        card.dataset.effectKey = effectKey;
        upgradeList.append(card);
      });
      row.append(upgradeList);
    }
    runtime.elements.towerChallengeList.append(row);
  }
}

function towerChallenge4UpgradeEffectText(kind, effectKey, level) {
  if (kind === "baseGain") {
    return `${runtime.t(effectKey)}: +${runtime.tc4BaseGainPartsBonus().toFixed(2)} parts`;
  }
  if (kind === "infinityScoreVertexGain") {
    return `${runtime.t(effectKey)}: +${(runtime.TC4_INFINITY_SCORE_VERTEX_GAIN_COEFFICIENT * level).toFixed(2)} × Infinity Score log10`;
  }
  return `${runtime.t(effectKey)}: +${runtime.effectiveCoreBoostCount() - runtime.state.coreBoostCount} effective CB`;
}

function updateTowerChallengeRows() {
  const signature = [
    runtime.state.towerFloor,
    runtime.state.activeTowerChallenge,
    runtime.state.completedTowerChallenges,
    runtime.state.infinityCount,
    runtime.state.language,
    runtime.state.numberFormat,
    runtime.currentScoreLog10(),
    ...Object.keys(runtime.TC4_UPGRADE_DEFINITIONS).map((kind) => [
      runtime.towerChallenge4UpgradeLevel(kind),
      runtime.towerChallenge4UpgradePriceStep(kind),
    ]).flat(),
  ].join("|");
  if (signature === lastTowerChallengeSignature) return;
  lastTowerChallengeSignature = signature;
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
        ? runtime.t("towerChallengeRunning")
        : completed
          ? runtime.t("towerChallengeCompleted")
          : unlocked
            ? runtime.t("towerChallengeAvailable")
            : runtime.t("towerChallengeLocked").replace("{floor}", String(unlockFloor));
    row.querySelector(".challenge-target").textContent = Number.isFinite(targetLog10)
      ? `${runtime.t("towerChallengeTarget")}: ${runtime.formatPowerOfTen(targetLog10)} Score`
      : runtime.t("towerChallengeComingSoon");
    row.querySelector(".challenge-restriction").textContent = `${runtime.t("challengeRestrictionLabel")}: ${runtime.towerChallengeRestriction(index)}`;
    row.querySelector(".challenge-reward").textContent = `${runtime.t("challengeRewardLabel")}: ${runtime.towerChallengeReward(index)}${runtime.towerChallengeRewardUnlocked(index) ? ` (${runtime.t("towerChallengeRewardUnlocked")})` : ""}`;
    button.textContent = active
      ? runtime.t("towerChallengeStop")
      : completed
        ? runtime.t("towerChallengeReplay")
        : runtime.t("towerChallengeStart");
    button.disabled = !implemented || !unlocked || (runtime.state.activeTowerChallenge > 0 && !active);

    if (index === 4) {
      row.querySelectorAll(".tc4-upgrade-card").forEach((card) => {
        const kind = card.dataset.tc4Upgrade;
        const level = runtime.towerChallenge4UpgradeLevel(kind);
        const effectKey = card.dataset.effectKey;
        card.querySelector(".tc4-upgrade-label").textContent = runtime.t(card.dataset.labelKey);
        card.querySelector(".tc4-upgrade-effect").textContent = `${towerChallenge4UpgradeEffectText(kind, effectKey, level)} · ${runtime.t("level")} ${level} · ${runtime.t("towerChallenge4UpgradePrice")}: ${runtime.formatPowerOfTen(runtime.towerChallenge4UpgradePriceLog10(kind))}`;
        const buy = card.querySelector(".tc4-upgrade-button");
        buy.textContent = runtime.canBuyTowerChallenge4Upgrade(kind)
          ? runtime.t("towerChallenge4UpgradeBuy")
          : runtime.t("towerChallenge4UpgradeUnavailable");
        buy.disabled = !active || !runtime.canBuyTowerChallenge4Upgrade(kind);
      });
    }
  });
}

expose("createChallengeRows", () => createChallengeRows);
expose("updateChallengeRows", () => updateChallengeRows);
expose("createTowerChallengeRows", () => createTowerChallengeRows);
expose("updateTowerChallengeRows", () => updateTowerChallengeRows);
