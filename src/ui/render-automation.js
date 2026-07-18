import { runtime, expose } from "../runtime/shared.js";

let lastInfinityRunListSignature = null;

function infinityRunRecordText(record, index) {
  const challenge = record.challenge > 0 ? ` IC${record.challenge}` : "";
  return `#${index + 1}${challenge} ${runtime.formatLongDuration(record.time)} / ${runtime.formatPowerOfTen(record.scoreLog10)} / +${runtime.formatUiNumber(record.ipGain)} IP`;
}

function updateAutomationUi() {
  const unlocked = runtime.hasInfinityUpgrade("1-2");
  const generationCoreUnlocked = runtime.isAchievementUnlocked(19);
  const infinityUnlocked = runtime.hasInfinityUpgrade("8-1");
  if (!runtime.elements.automationMasterToggle) return;
  runtime.elements.automationLockNote.textContent = unlocked ? runtime.t("infinityUpgradeAvailable") : runtime.t("automationLocked");
  runtime.elements.automationMasterToggle.disabled = !unlocked;
  runtime.elements.autoBuySpeedToggle.disabled = !unlocked;
  runtime.elements.autoBuyVertexToggle.disabled = !unlocked;
  runtime.elements.autoBuyGainToggle.disabled = !unlocked;
  if (runtime.elements.autoCompleteChallengesToggle) runtime.elements.autoCompleteChallengesToggle.disabled = !runtime.infinityChallengesUnlocked();
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
  if (runtime.elements.autoCompleteChallengesToggle) runtime.syncFormControl(runtime.elements.autoCompleteChallengesToggle, runtime.state.autoCompleteChallenges);
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
    records.map((record) => `${record.time}:${record.scoreLog10}:${record.ipGain}:${record.challenge}`).join(";"),
  ].join("|");
}

function updateStatisticsUi() {
  if (!runtime.elements.totalPlayTime) return;
  runtime.elements.totalPlayTime.textContent = runtime.formatLongDuration(runtime.state.totalPlayTime);
  runtime.elements.currentInfinityRunTime.textContent = runtime.formatLongDuration(runtime.state.currentInfinityRunTime);
  runtime.elements.fastestInfinityTime.textContent = runtime.state.fastestInfinityTime > 0 ? runtime.formatLongDuration(runtime.state.fastestInfinityTime) : runtime.t("noInfinityRuns");
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
expose("updateStatisticsUi", () => updateStatisticsUi);
