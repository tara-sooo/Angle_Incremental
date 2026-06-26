import { runtime, expose } from "../runtime/shared.js";

// Extracted mechanically from the next-runtime baseline.
// Runtime dependencies remain unchanged during the classic-script migration phase.

function applyLanguage() {
  if (runtime.appliedLanguage === runtime.state.language) return;
  runtime.appliedLanguage = runtime.state.language;
  document.documentElement.lang = runtime.state.language;
  runtime.elements.i18nNodes.forEach((node) => {
    const key = node.dataset.i18n;
    if (key) node.textContent = runtime.t(key);
  });
  if (runtime.elements.numberFormatSelect) {
    runtime.elements.numberFormatSelect.querySelector('[value="compact"]').textContent = runtime.t("numberCompact");
    runtime.elements.numberFormatSelect.querySelector('[value="scientific"]').textContent = runtime.t("numberScientific");
    runtime.elements.numberFormatSelect.querySelector('[value="detailed"]').textContent = runtime.t("numberDetailed");
  }
  if (runtime.elements.timeUnitSelect) {
    runtime.elements.timeUnitSelect.querySelector('[value="auto"]').textContent = runtime.t("timeAuto");
    runtime.elements.timeUnitSelect.querySelector('[value="seconds"]').textContent = runtime.t("timeSeconds");
    runtime.elements.timeUnitSelect.querySelector('[value="milliseconds"]').textContent = runtime.t("timeMilliseconds");
  }
}

function syncFormControl(control, value) {
  if (!control || document.activeElement === control) return;
  if (control.type === "checkbox") {
    control.checked = Boolean(value);
  } else {
    control.value = value;
  }
}

function clearElement(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function createChallengeRows() {
  clearElement(runtime.elements.challengeList);
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

function createInfinityUpgradeRows() {
  clearElement(runtime.elements.infinityUpgradeTree);
  const upgradeRows = [["1-1", "1-2"], ["2-1"], ["3-1", "3-2"], ["4-1"]];

  upgradeRows.forEach((rowIds, rowIndex) => {
    const tier = document.createElement("div");
    tier.className = "infinity-upgrade-tier";
    tier.dataset.tier = String(rowIndex + 1);

    rowIds.forEach((id) => {
      const upgrade = runtime.infinityUpgradeById(id);
      if (!upgrade) return;
      const button = document.createElement("button");
      button.className = "infinity-upgrade-node";
      button.type = "button";
      button.dataset.upgrade = upgrade.id;
      button.addEventListener("click", () => selectInfinityUpgrade(upgrade.id));

      const name = document.createElement("strong");
      name.className = "infinity-upgrade-name";

      const status = document.createElement("small");
      status.className = "infinity-upgrade-state";

      button.append(name, status);
      tier.append(button);
    });

    runtime.elements.infinityUpgradeTree.append(tier);
  });
}

function selectInfinityUpgrade(id) {
  if (!runtime.infinityUpgradeById(id)) return;
  runtime.selectedInfinityUpgradeId = id;
  updateInfinityUpgradeRows();
}

function infinityUpgradeStateText(upgrade) {
  if (runtime.hasInfinityUpgrade(upgrade.id)) return runtime.t("infinityUpgradePurchased");
  if (!runtime.infinityUpgradePrerequisitesMet(upgrade)) return runtime.t("infinityUpgradeLocked");
  if (!runtime.canSpendInfinityPoints(runtime.log10Value(upgrade.cost))) return runtime.t("infinityUpgradeNeedIp");
  return runtime.t("infinityUpgradeAvailable");
}

function updateInfinityUpgradeDetail() {
  const upgrade = runtime.infinityUpgradeById(runtime.selectedInfinityUpgradeId) || runtime.INFINITY_UPGRADES[0];
  runtime.selectedInfinityUpgradeId = upgrade.id;
  const purchased = runtime.hasInfinityUpgrade(upgrade.id);
  const prerequisitesMet = runtime.infinityUpgradePrerequisitesMet(upgrade);
  const affordable = runtime.canSpendInfinityPoints(runtime.log10Value(upgrade.cost));
  const canBuy = !purchased && prerequisitesMet && affordable;
  const requiresText = upgrade.requires.length > 0
    ? `${runtime.t("infinityUpgradeRequires")}: ${upgrade.requires.join(", ")}`
    : runtime.t("infinityUpgradeNoRequires");

  runtime.elements.infinityUpgradeDetailName.textContent = runtime.infinityUpgradeName(upgrade.id);
  runtime.elements.infinityUpgradeDetailState.textContent = `${runtime.t("infinityUpgradeSelected")} · ${infinityUpgradeStateText(upgrade)}`;
  runtime.elements.infinityUpgradeDetailEffect.textContent = runtime.infinityUpgradeEffectText(upgrade.id);
  runtime.elements.infinityUpgradeDetailRequires.textContent = requiresText;
  runtime.elements.infinityUpgradeDetailCost.textContent = `${runtime.t("infinityUpgradeCost")} ${runtime.formatUiLogNumber(runtime.log10Value(upgrade.cost))} IP`;
  runtime.elements.infinityUpgradeDetailBuy.textContent = purchased ? runtime.t("infinityUpgradePurchased") : runtime.t("buyInfinityUpgrade");
  runtime.elements.infinityUpgradeDetailBuy.disabled = !canBuy;
}

function updateInfinityUpgradeRows() {
  runtime.elements.infinityUpgradeTree.querySelectorAll(".infinity-upgrade-node").forEach((node) => {
    const upgrade = runtime.infinityUpgradeById(node.dataset.upgrade);
    if (!upgrade) return;
    const purchased = runtime.hasInfinityUpgrade(upgrade.id);
    const prerequisitesMet = runtime.infinityUpgradePrerequisitesMet(upgrade);
    const affordable = runtime.canSpendInfinityPoints(runtime.log10Value(upgrade.cost));
    const available = !purchased && prerequisitesMet && affordable;
    const selected = runtime.selectedInfinityUpgradeId === upgrade.id;

    node.classList.toggle("is-selected", selected);
    node.classList.toggle("is-purchased", purchased);
    node.classList.toggle("is-available", available);
    node.classList.toggle("is-locked", !purchased && !prerequisitesMet);
    node.classList.toggle("is-unaffordable", !purchased && prerequisitesMet && !affordable);
    node.querySelector(".infinity-upgrade-name").textContent = upgrade.id;
    node.querySelector(".infinity-upgrade-state").textContent = infinityUpgradeStateText(upgrade);
  });

  updateInfinityUpgradeDetail();
}

function buySelectedInfinityUpgrade() {
  runtime.buyInfinityUpgrade(runtime.selectedInfinityUpgradeId);
}

function createAchievementRows() {
  clearElement(runtime.elements.achievementList);
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
    row.querySelector(".achievement-reward").textContent = extraReward
      ? `${runtime.t("achievementReward")}: ${extraReward}`
      : runtime.t("achievementRewardText");
    row.querySelector(".achievement-status").textContent = unlocked ? runtime.t("achievementUnlocked") : runtime.t("achievementLocked");
  });
}

function canSpendLog(amountLog) {
  return runtime.currentScoreLog10() >= amountLog;
}

function canSpend(amount) {
  return canSpendLog(runtime.log10Value(amount));
}

function updateAutomationUi() {
  const unlocked = runtime.hasInfinityUpgrade("1-2");
  if (!runtime.elements.automationMasterToggle) return;
  runtime.elements.automationLockNote.textContent = unlocked ? runtime.t("infinityUpgradeAvailable") : runtime.t("automationLocked");
  runtime.elements.automationMasterToggle.disabled = !unlocked;
  runtime.elements.autoBuySpeedToggle.disabled = !unlocked;
  runtime.elements.autoBuyVertexToggle.disabled = !unlocked;
  runtime.elements.autoBuyGainToggle.disabled = !unlocked;
  if (runtime.elements.autoCompleteChallengesToggle) runtime.elements.autoCompleteChallengesToggle.disabled = !runtime.infinityChallengesUnlocked();
  syncFormControl(runtime.elements.automationMasterToggle, unlocked && runtime.state.automationEnabled);
  syncFormControl(runtime.elements.autoBuySpeedToggle, runtime.state.autoBuySpeed);
  syncFormControl(runtime.elements.autoBuyVertexToggle, runtime.state.autoBuyVertex);
  syncFormControl(runtime.elements.autoBuyGainToggle, runtime.state.autoBuyGain);
  if (runtime.elements.autoCompleteChallengesToggle) syncFormControl(runtime.elements.autoCompleteChallengesToggle, runtime.state.autoCompleteChallenges);
}

function infinityRunRecordText(record, index) {
  const challenge = record.challenge > 0 ? ` IC${record.challenge}` : "";
  return `#${index + 1}${challenge} ${runtime.formatLongDuration(record.time)} / ${runtime.formatPowerOfTen(record.scoreLog10)} / +${runtime.formatUiNumber(record.ipGain)} IP`;
}

function updateStatisticsUi() {
  if (!runtime.elements.totalPlayTime) return;
  runtime.elements.totalPlayTime.textContent = runtime.formatLongDuration(runtime.state.totalPlayTime);
  runtime.elements.currentInfinityRunTime.textContent = runtime.formatLongDuration(runtime.state.currentInfinityRunTime);
  runtime.elements.fastestInfinityTime.textContent = runtime.state.fastestInfinityTime > 0 ? runtime.formatLongDuration(runtime.state.fastestInfinityTime) : runtime.t("noInfinityRuns");
  runtime.elements.lastInfinityRuns.innerHTML = "";
  if (runtime.state.lastInfinityRuns.length === 0) {
    const row = document.createElement("li");
    row.textContent = runtime.t("noInfinityRuns");
    runtime.elements.lastInfinityRuns.append(row);
    return;
  }
  runtime.state.lastInfinityRuns.forEach((record, index) => {
    const row = document.createElement("li");
    row.textContent = infinityRunRecordText(record, index);
    runtime.elements.lastInfinityRuns.append(row);
  });
}

function updateUi() {
  const currentCostLogs = runtime.costLogs();
  const unlockedAchievementsNow = runtime.checkAchievements(true);
  if (unlockedAchievementsNow.length > 0) runtime.saveGame("manual");
  document.documentElement.classList.toggle("light-effects", runtime.state.lightEffects);
  applyLanguage();
  runtime.elements.scoreValue.textContent = runtime.scoreDisplay();
  runtime.elements.gainValue.textContent = runtime.formatUiLogNumber(runtime.finalScoreGainLog10());
  runtime.elements.vertexGainValue.textContent = `+${runtime.formatSmallDecimal(runtime.vertexGainIncrease())}`;
  runtime.elements.lapValue.textContent = runtime.formatDuration(runtime.lapDuration());
  runtime.elements.lapSpeedValue.textContent = runtime.isLapSpeedSoftcapped()
    ? `${formatMultiplierLog(runtime.effectiveLapSpeedLog10())} ${runtime.t("lapSpeedSoftcapped")} / raw ${formatMultiplierLog(runtime.rawLapSpeedLog10())}`
    : formatMultiplierLog(runtime.effectiveLapSpeedLog10());
  runtime.elements.speedLevel.textContent = `${runtime.t("level")} ${runtime.state.speedLevel}`;
  runtime.elements.vertexCount.textContent = `${runtime.state.vertices} ${runtime.t("vertices")}`;
  runtime.elements.gainLevel.textContent = `${runtime.t("level")} ${runtime.state.gainLevel}`;
  runtime.elements.speedCost.textContent = `${runtime.t("cost")} ${runtime.formatUiLogNumber(currentCostLogs.speed)}`;
  runtime.elements.vertexCost.textContent = `${runtime.t("cost")} ${runtime.formatUiLogNumber(currentCostLogs.vertex)}`;
  runtime.elements.gainCost.textContent = `${runtime.t("cost")} ${runtime.formatUiLogNumber(currentCostLogs.gain)}`;
  runtime.elements.speedUpgrade.disabled = !runtime.canBuyNormalUpgrade("speed");
  runtime.elements.vertexUpgrade.disabled = !runtime.canBuyNormalUpgrade("vertex");
  runtime.elements.gainUpgrade.disabled = !runtime.canBuyNormalUpgrade("gain");
  runtime.elements.buyAllUpgrade.disabled = !runtime.canBuyNormalUpgrade("speed") && !runtime.canBuyNormalUpgrade("vertex") && !runtime.canBuyNormalUpgrade("gain");

  const unlocked = runtime.currentTotalScoreLog10() >= runtime.log10Value(runtime.GENERATION_UNLOCK_SCORE);
  const ready = runtime.canRunGeneration();
  const waitingPrevious = unlocked
    && runtime.state.generationCount > 0
    && runtime.currentGenerationScoreLog10() >= runtime.log10Value(runtime.GENERATION_UNLOCK_SCORE)
    && !ready;
  runtime.elements.generationStatus.textContent = ready
    ? runtime.t("generationReady")
    : waitingPrevious
      ? runtime.t("generationWaitingPrevious")
      : unlocked
      ? runtime.t("generationUnlocked")
      : runtime.t("generationLocked");
  runtime.elements.generationButton.disabled = !ready;
  runtime.elements.generationCount.textContent = String(runtime.state.generationCount);
  const nextGeneration = runtime.nextGenerationValues();
  runtime.elements.generationMultiplier.textContent = formatMultiplierLogPreview(runtime.generationScoreMultiplierEffectLog10(), nextGeneration.scoreMultiplierLog10);
  runtime.elements.generationCostFactor.textContent = formatMultiplierPreview(runtime.generationCostFactorEffect(), nextGeneration.costFactor);

  runtime.elements.coreBoostCount.textContent = String(runtime.state.coreBoostCount);
  runtime.elements.coreBoostRequirement.textContent = runtime.formatPowerOfTen(runtime.coreBoostRequirementLog10());
  const nextCoreBoost = runtime.nextCoreBoostValues();
  runtime.elements.coreBoostGainBoost.textContent = formatMultiplierPreview(runtime.coreBoostGainIncreaseMultiplier(), nextCoreBoost.gainMultiplier);
  runtime.elements.coreBoostExponent.textContent = formatExponentPreview(runtime.coreBoostGainExponent(), nextCoreBoost.gainExponent);
  runtime.elements.coreBoostButton.disabled = !runtime.canCoreBoost();

  runtime.elements.infinityCount.textContent = String(runtime.state.infinityCount);
  const infinityReady = runtime.canInfinity();
  const infinityUnlocked = runtime.state.infinityCount > 0;
  runtime.elements.infinityTabState.textContent = infinityReady ? "READY" : infinityUnlocked ? "OPEN" : "LOCKED";
  runtime.elements.infinityTabBadge.classList.toggle("is-visible", infinityReady);
  runtime.elements.infinityUnlockNote.hidden = infinityUnlocked;
  runtime.elements.infinityPoints.textContent = runtime.formatUiLogNumber(runtime.currentInfinityPointsLog10());
  runtime.elements.infiniteScore.textContent = runtime.formatUiLogNumber(runtime.currentInfiniteScoreLog10());
  runtime.elements.infiniteScorePanel.textContent = runtime.formatUiLogNumber(runtime.currentInfiniteScoreLog10());
  runtime.elements.infiniteAngleBoost.textContent = `×${runtime.infiniteAngleBoost().toFixed(2)}`;
  runtime.elements.infiniteAngleBoostPanel.textContent = `×${runtime.infiniteAngleBoost().toFixed(2)}`;
  runtime.elements.infinityPointGain.textContent = `+${runtime.formatUiNumber(runtime.infinityPointGain())} IP`;
  runtime.elements.infinityButton.disabled = runtime.state.infinityCount === 0 || !runtime.canInfinity();
  updateInfinityUpgradeRows();
  runtime.elements.convertIpButton.disabled = !runtime.canSpendInfinityPoints(runtime.infiniteAngleConversionCostLog10());
  runtime.elements.convertIpGain.textContent = `${runtime.formatUiLogNumber(runtime.infiniteAngleConversionCostLog10())} IP -> +${runtime.formatUiLogNumber(runtime.infiniteScoreGainPerIpLog10())}`;
  const completed = runtime.completedChallengeCount();
  runtime.elements.challengeStatus.textContent = runtime.state.activeChallenge > 0
    ? `${runtime.challengeName(runtime.state.activeChallenge)} ${runtime.t("challengeRunning")}`
    : !runtime.infinityChallengesUnlocked()
      ? runtime.t("locked")
      : `${completed}/${runtime.INFINITY_CHALLENGE_COUNT} ${runtime.t("completed")}`;
  updateChallengeRows();
  runtime.elements.breakCapButton.disabled = !runtime.canBreakInfiniteCap();
  runtime.elements.breakCapButton.textContent = runtime.state.infiniteCapBroken ? "Cap Broken" : "Break Infinite Cap";

  updateAutomationUi();
  updateStatisticsUi();

  const unlockedAchievements = runtime.achievementCount();
  runtime.elements.achievementTabState.textContent = `${unlockedAchievements}/${runtime.ACHIEVEMENT_COUNT}`;
  runtime.elements.achievementSummary.textContent = `${unlockedAchievements}/${runtime.ACHIEVEMENT_COUNT} ${runtime.t("tabAchievements")}`;
  runtime.elements.achievementBoost.textContent = `×${runtime.achievementGainMultiplier().toFixed(3)}`;
  updateAchievementRows();

  syncFormControl(runtime.elements.floatingTextToggle, runtime.state.showFloatingText);
  syncFormControl(runtime.elements.lightEffectsToggle, runtime.state.lightEffects);
  syncFormControl(runtime.elements.fpsToggle, runtime.state.showFps);
  syncFormControl(runtime.elements.languageSelect, runtime.state.language);
  syncFormControl(runtime.elements.numberFormatSelect, runtime.state.numberFormat);
  syncFormControl(runtime.elements.timeUnitSelect, runtime.state.timeUnit);
  runtime.elements.fpsCounter.hidden = !runtime.state.showFps;
  if (runtime.state.showFps) runtime.elements.fpsCounter.textContent = `FPS ${Math.round(runtime.smoothedFps)}`;
}

// Mechanically appended from src/main.js during the parity-preserving migration.

function setSaveStatus(text) {
  runtime.elements.saveStatus.textContent = text;
}

function gainExpressionConfig() {
  const parts = gainExpressionParts();
  if (parts <= 1) return { parts, divisor: 1, rewardRemovesDivisor: false };
  if (runtime.state.activeChallenge === 1) return { parts, divisor: parts * 10, rewardRemovesDivisor: false };
  if (runtime.isChallengeCompleted(1)) return { parts, divisor: 1, rewardRemovesDivisor: true };
  return { parts, divisor: parts, rewardRemovesDivisor: false };
}

function formatGainExpression(valueLog10) {
  const config = gainExpressionConfig();
  if (config.parts <= 1) return runtime.formatUiLogNumber(valueLog10);
  const base = runtime.formatUiLogNumber(valueLog10);
  if (config.divisor <= 1) return `(${base})^${config.parts}`;
  return `(${base} / ${config.divisor})^${config.parts}`;
}

function gainExpressionParts() {
  return Math.min(Math.floor(Math.sqrt(runtime.state.vertices)), 10);
}

function hasMultiplicativeGainExpression() {
  return gainExpressionParts() > 1;
}

function formatGainExpressionSummary() {
  return formatGainExpression(runtime.currentGainLog10());
}

function challengeText(index, key) {
  const challenge = runtime.INFINITY_CHALLENGES[index - 1];
  const language = runtime.TEXT[runtime.state.language] ? runtime.state.language : "ja";
  return challenge ? challenge[key][language] : runtime.t("challengeNone");
}

function formatMultiplierPreview(current, next) {
  const currentText = `×${current.toFixed(2)}`;
  const nextText = `×${next.toFixed(2)}`;
  return currentText === nextText ? currentText : `${currentText} → ${nextText}`;
}

function formatMultiplierLog(log) {
  return `×${runtime.formatUiLogNumber(log)}`;
}

function formatMultiplierLogPreview(currentLog, nextLog) {
  const currentText = formatMultiplierLog(currentLog);
  const nextText = formatMultiplierLog(nextLog);
  return currentText === nextText ? currentText : `${currentText} → ${nextText}`;
}

function formatExponentPreview(current, next) {
  const currentText = `^${current.toFixed(2)}`;
  const nextText = `^${next.toFixed(2)}`;
  return currentText === nextText ? currentText : `${currentText} → ${nextText}`;
}

function balanceCreateInfinityUpgradeRows() {
  clearElement(runtime.elements.infinityUpgradeTree);
  const tiers = [
    ["1-1", "1-2"],
    ["2-1"],
    ["3-1", "3-2"],
    ["4-1"],
    ["5-1", "5-2"],
    ["6-1", "6-2"],
    ["7-1", "7-2"],
  ];
  tiers.forEach((rowIds, rowIndex) => {
    const tier = document.createElement("div");
    tier.className = "infinity-upgrade-tier";
    tier.dataset.tier = String(rowIndex + 1);
    rowIds.forEach((id) => {
      const upgrade = runtime.infinityUpgradeById(id);
      if (!upgrade) return;
      const button = document.createElement("button");
      button.className = "infinity-upgrade-node";
      button.type = "button";
      button.dataset.upgrade = upgrade.id;
      button.addEventListener("click", () => selectInfinityUpgrade(upgrade.id));
      const name = document.createElement("strong");
      name.className = "infinity-upgrade-name";
      const status = document.createElement("small");
      status.className = "infinity-upgrade-state";
      button.append(name, status);
      tier.append(button);
    });
    runtime.elements.infinityUpgradeTree.append(tier);
  });
}
expose("applyLanguage", () => applyLanguage, (value) => { applyLanguage = value; });
expose("syncFormControl", () => syncFormControl, (value) => { syncFormControl = value; });
expose("clearElement", () => clearElement, (value) => { clearElement = value; });
expose("createChallengeRows", () => createChallengeRows, (value) => { createChallengeRows = value; });
expose("updateChallengeRows", () => updateChallengeRows, (value) => { updateChallengeRows = value; });
expose("createInfinityUpgradeRows", () => createInfinityUpgradeRows, (value) => { createInfinityUpgradeRows = value; });
expose("selectInfinityUpgrade", () => selectInfinityUpgrade, (value) => { selectInfinityUpgrade = value; });
expose("infinityUpgradeStateText", () => infinityUpgradeStateText, (value) => { infinityUpgradeStateText = value; });
expose("updateInfinityUpgradeDetail", () => updateInfinityUpgradeDetail, (value) => { updateInfinityUpgradeDetail = value; });
expose("updateInfinityUpgradeRows", () => updateInfinityUpgradeRows, (value) => { updateInfinityUpgradeRows = value; });
expose("buySelectedInfinityUpgrade", () => buySelectedInfinityUpgrade, (value) => { buySelectedInfinityUpgrade = value; });
expose("createAchievementRows", () => createAchievementRows, (value) => { createAchievementRows = value; });
expose("updateAchievementRows", () => updateAchievementRows, (value) => { updateAchievementRows = value; });
expose("canSpendLog", () => canSpendLog, (value) => { canSpendLog = value; });
expose("canSpend", () => canSpend, (value) => { canSpend = value; });
expose("updateAutomationUi", () => updateAutomationUi, (value) => { updateAutomationUi = value; });
expose("infinityRunRecordText", () => infinityRunRecordText, (value) => { infinityRunRecordText = value; });
expose("updateStatisticsUi", () => updateStatisticsUi, (value) => { updateStatisticsUi = value; });
expose("updateUi", () => updateUi, (value) => { updateUi = value; });
expose("setSaveStatus", () => setSaveStatus, (value) => { setSaveStatus = value; });
expose("gainExpressionConfig", () => gainExpressionConfig, (value) => { gainExpressionConfig = value; });
expose("formatGainExpression", () => formatGainExpression, (value) => { formatGainExpression = value; });
expose("gainExpressionParts", () => gainExpressionParts, (value) => { gainExpressionParts = value; });
expose("hasMultiplicativeGainExpression", () => hasMultiplicativeGainExpression, (value) => { hasMultiplicativeGainExpression = value; });
expose("formatGainExpressionSummary", () => formatGainExpressionSummary, (value) => { formatGainExpressionSummary = value; });
expose("challengeText", () => challengeText, (value) => { challengeText = value; });
expose("formatMultiplierPreview", () => formatMultiplierPreview, (value) => { formatMultiplierPreview = value; });
expose("formatMultiplierLog", () => formatMultiplierLog, (value) => { formatMultiplierLog = value; });
expose("formatMultiplierLogPreview", () => formatMultiplierLogPreview, (value) => { formatMultiplierLogPreview = value; });
expose("formatExponentPreview", () => formatExponentPreview, (value) => { formatExponentPreview = value; });
expose("balanceCreateInfinityUpgradeRows", () => balanceCreateInfinityUpgradeRows, (value) => { balanceCreateInfinityUpgradeRows = value; });

