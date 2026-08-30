import { runtime, expose } from "../runtime/shared.js";

let lastInfinityRunListSignature = null;
let lastEternityRunListSignature = null;
let lastChallengeTimeSignature = null;

function formatInfinityRunTime(value) {
  return value === null || value === undefined
    ? runtime.t("unknownTime")
    : runtime.formatLongDuration(value);
}

function infinityRunRecordText(record, index) {
  const challenge = record.challenge > 0 ? ` IC${record.challenge}` : "";
  return `#${index + 1}${challenge} ${runtime.t("gameTimeShort")} ${formatInfinityRunTime(record.time)} / ${runtime.t("realTimeShort")} ${formatInfinityRunTime(record.realTime)} / ${runtime.formatPowerOfTen(record.scoreLog10)} / +${runtime.formatUiNumber(record.ipGain)} IP`;
}

function eternityRunRecordText(record, index) {
  return `#${index + 1} ${runtime.t("gameTimeShort")} ${formatInfinityRunTime(record.time)} / ${runtime.t("realTimeShort")} ${formatInfinityRunTime(record.realTime)} / ${runtime.t("eternityInfinityCountShort")} ${runtime.formatUiNumber(record.infinityCount)}`;
}

function updateAutomationUi() {
  const unlocked = runtime.normalAutomationUnlocked?.() || false;
  const generationCoreUnlocked = runtime.isAchievementUnlocked(19);
  const infinityUnlocked = runtime.infinityAutomationUnlocked?.() || false;
  const infinityUpgradeUnlocked = runtime.infinityUpgradeAutomationUnlocked?.() || false;
  if (!runtime.elements.automationMasterToggle) return;
  runtime.elements.automationLockNote.textContent = unlocked ? runtime.t("infinityUpgradeAvailable") : runtime.t("automationLocked");
  runtime.elements.automationMasterToggle.disabled = !unlocked;
  runtime.elements.autoBuySpeedToggle.disabled = !unlocked;
  runtime.elements.autoBuyVertexToggle.disabled = !unlocked;
  runtime.elements.autoBuyGainToggle.disabled = !unlocked;
  if (runtime.elements.autoBuyInfinityUpgradesToggle) {
    runtime.elements.autoBuyInfinityUpgradesToggle.disabled = !infinityUpgradeUnlocked;
  }
  const milestoneEightUnlocked = runtime.eternityMilestoneActive?.("8") === true;
  [
    runtime.elements.autoBuyInfiniteAngleSpeedToggle,
    runtime.elements.autoBuyInfiniteAngleVertexToggle,
    runtime.elements.autoBuyInfiniteAngleGainToggle,
    runtime.elements.autoBuildTowerToggle,
  ].forEach((element) => {
    if (element) element.disabled = !milestoneEightUnlocked;
  });
  [
    runtime.elements.autoRunGenerationToggle,
    runtime.elements.autoGenerationScoreThresholdInput,
    runtime.elements.autoGenerationCostThresholdInput,
    runtime.elements.autoGenerationMinimumSecondsInput,
    runtime.elements.autoRunCoreBoostToggle,
  ].forEach((element) => {
    if (element) element.disabled = !generationCoreUnlocked;
  });
  [runtime.elements.autoRunInfinityToggle, runtime.elements.autoInfinityPointThresholdInput].forEach((element) => {
    if (element) element.disabled = !infinityUnlocked;
  });
  runtime.syncFormControl(runtime.elements.automationMasterToggle, unlocked && runtime.state.automationEnabled);
  runtime.syncFormControl(runtime.elements.autoBuySpeedToggle, runtime.state.autoBuySpeed);
  runtime.syncFormControl(runtime.elements.autoBuyVertexToggle, runtime.state.autoBuyVertex);
  runtime.syncFormControl(runtime.elements.autoBuyGainToggle, runtime.state.autoBuyGain);
  if (runtime.elements.autoBuyInfinityUpgradesToggle) runtime.syncFormControl(runtime.elements.autoBuyInfinityUpgradesToggle, runtime.state.autoBuyInfinityUpgrades);
  runtime.syncFormControl(runtime.elements.autoBuyInfiniteAngleSpeedToggle, runtime.state.autoBuyInfiniteAngleSpeed);
  runtime.syncFormControl(runtime.elements.autoBuyInfiniteAngleVertexToggle, runtime.state.autoBuyInfiniteAngleVertex);
  runtime.syncFormControl(runtime.elements.autoBuyInfiniteAngleGainToggle, runtime.state.autoBuyInfiniteAngleGain);
  runtime.syncFormControl(runtime.elements.autoBuildTowerToggle, runtime.state.autoBuildTower);
  if (runtime.elements.autoRunGenerationToggle) runtime.syncFormControl(runtime.elements.autoRunGenerationToggle, runtime.state.autoRunGeneration);
  if (runtime.elements.autoGenerationScoreThresholdInput) runtime.syncFormControl(runtime.elements.autoGenerationScoreThresholdInput, runtime.state.autoGenerationScoreMultiplierThreshold);
  if (runtime.elements.autoGenerationCostThresholdInput) runtime.syncFormControl(runtime.elements.autoGenerationCostThresholdInput, runtime.state.autoGenerationCostMultiplierThreshold);
  if (runtime.elements.autoGenerationMinimumSecondsInput) runtime.syncFormControl(runtime.elements.autoGenerationMinimumSecondsInput, runtime.state.autoGenerationMinimumSeconds);
  if (runtime.elements.autoRunCoreBoostToggle) runtime.syncFormControl(runtime.elements.autoRunCoreBoostToggle, runtime.state.autoRunCoreBoost);
  if (runtime.elements.autoRunInfinityToggle) runtime.syncFormControl(runtime.elements.autoRunInfinityToggle, runtime.state.autoRunInfinity);
  if (runtime.elements.autoInfinityPointThresholdInput) {
    runtime.syncFormControl(
      runtime.elements.autoInfinityPointThresholdInput,
      runtime.formatUiLogNumber(runtime.state.autoInfinityPointThresholdLog10),
    );
  }
}

function infinityRunListSignature() {
  const records = runtime.state.lastInfinityRuns;
  return [
    runtime.state.language,
    runtime.state.numberFormat,
    runtime.state.timeUnit,
    records.map((record) => `${record.time}:${record.realTime}:${record.scoreLog10}:${record.ipGain}:${record.challenge}`).join(";"),
  ].join("|");
}

function eternityRunListSignature() {
  const records = runtime.state.lastEternityRuns;
  return [
    runtime.state.language,
    runtime.state.numberFormat,
    runtime.state.timeUnit,
    records.map((record) => `${record.time}:${record.realTime}:${record.infinityCount}`).join(";"),
  ].join("|");
}

function challengeTimeSignature() {
  return [
    runtime.state.language,
    runtime.state.timeUnit,
    (runtime.state.fastestInfinityChallengeTimes || []).join(","),
    (runtime.state.fastestTowerChallengeTimes || []).join(","),
  ].join("|");
}

function updateChallengeTimeList(container, count, nameForIndex, times) {
  if (!container) return;
  container.innerHTML = "";
  for (let index = 1; index <= count; index += 1) {
    const row = document.createElement("li");
    const time = times[index - 1] || 0;
    row.textContent = `${nameForIndex(index)}: ${time > 0 ? runtime.formatLongDuration(time) : runtime.t("noInfinityRuns")}`;
    container.append(row);
  }
}

function updateChallengeTimeLists() {
  const signature = challengeTimeSignature();
  if (signature === lastChallengeTimeSignature) return;
  lastChallengeTimeSignature = signature;
  updateChallengeTimeList(
    runtime.elements.fastestInfinityChallengeTimes,
    runtime.INFINITY_CHALLENGE_COUNT,
    runtime.challengeName,
    runtime.state.fastestInfinityChallengeTimes || [],
  );
  updateChallengeTimeList(
    runtime.elements.fastestTowerChallengeTimes,
    runtime.TOWER_CHALLENGE_COUNT,
    runtime.towerChallengeName,
    runtime.state.fastestTowerChallengeTimes || [],
  );
}

function updateStatisticsUi() {
  if (!runtime.elements.totalPlayTime) return;
  runtime.elements.totalPlayTime.textContent = runtime.formatLongDuration(runtime.state.totalPlayTime);
  runtime.elements.totalRealPlayTime.textContent = runtime.formatLongDuration(runtime.state.totalRealPlayTime);
  runtime.elements.currentInfinityRunTime.textContent = runtime.formatLongDuration(runtime.state.currentInfinityRunTime);
  runtime.elements.currentInfinityRealTime.textContent = runtime.formatLongDuration(runtime.state.currentInfinityRealTime);
  runtime.elements.fastestInfinityTime.textContent = runtime.state.fastestInfinityTime > 0 ? runtime.formatLongDuration(runtime.state.fastestInfinityTime) : runtime.t("noInfinityRuns");
  runtime.elements.fastestInfinityRealTime.textContent = runtime.state.fastestInfinityRealTime > 0
    ? runtime.formatLongDuration(runtime.state.fastestInfinityRealTime)
    : runtime.t("noInfinityRuns");
  runtime.elements.currentEternityRunTime.textContent = runtime.formatLongDuration(runtime.state.currentEternityRunTime);
  runtime.elements.currentEternityRealTime.textContent = runtime.formatLongDuration(runtime.state.currentEternityRealTime);
  runtime.elements.fastestEternityTime.textContent = runtime.state.fastestEternityTime > 0
    ? runtime.formatLongDuration(runtime.state.fastestEternityTime)
    : runtime.t("noEternityRuns");
  runtime.elements.fastestEternityRealTime.textContent = runtime.state.fastestEternityRealTime > 0
    ? runtime.formatLongDuration(runtime.state.fastestEternityRealTime)
    : runtime.t("noEternityRuns");
  updateChallengeTimeLists();
  const eternitySignature = eternityRunListSignature();
  if (eternitySignature !== lastEternityRunListSignature) {
    lastEternityRunListSignature = eternitySignature;
    runtime.elements.lastEternityRuns.innerHTML = "";
    if (runtime.state.lastEternityRuns.length === 0) {
      const row = document.createElement("li");
      row.textContent = runtime.t("noEternityRuns");
      runtime.elements.lastEternityRuns.append(row);
    } else {
      runtime.state.lastEternityRuns.forEach((record, index) => {
        const row = document.createElement("li");
        row.textContent = eternityRunRecordText(record, index);
        runtime.elements.lastEternityRuns.append(row);
      });
    }
  }
  const signature = infinityRunListSignature();
  if (signature === lastInfinityRunListSignature) return;
  lastInfinityRunListSignature = signature;
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

expose("updateAutomationUi", () => updateAutomationUi);
expose("infinityRunRecordText", () => infinityRunRecordText);
expose("eternityRunRecordText", () => eternityRunRecordText);
expose("updateStatisticsUi", () => updateStatisticsUi);
