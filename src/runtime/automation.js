import { runtime, expose } from "./shared.js";

let normalAutobuyElapsed = 0;

function runAutobuyers() {
  if (!runtime.normalAutomationUnlocked?.() || !runtime.state.automationEnabled) return;
  const normalPurchases = runtime.buyAllUpgrades({
    refresh: false,
    save: false,
    allowSpeed: runtime.state.autoBuySpeed,
    allowVertex: runtime.state.autoBuyVertex,
    allowGain: runtime.state.autoBuyGain,
  });
  runtime.recordOfflineEvent("normalUpgradePurchases", normalPurchases);
  if (runtime.state.autoBuyInfinityUpgrades) {
    const infinityPurchases = runtime.buyAllInfinityUpgrades({
      refresh: false,
      save: false,
    });
    runtime.recordOfflineEvent("infinityUpgradePurchases", infinityPurchases);
  }
}

function shouldAutoRunGeneration() {
  if (!runtime.canRunGeneration()) return false;

  const currentScoreLog = runtime.generationScoreMultiplierEffectLog10();
  const currentCostFactor = runtime.generationCostFactorEffect();
  const next = runtime.nextGenerationValues();
  const checks = [];
  const scoreThreshold = Math.max(0, runtime.state.autoGenerationScoreMultiplierThreshold);
  const costThreshold = Math.max(0, runtime.state.autoGenerationCostMultiplierThreshold);
  const secondsThreshold = Math.max(0, runtime.state.autoGenerationMinimumSeconds);

  if (scoreThreshold > 0) {
    checks.push(next.scoreMultiplierLog10 - currentScoreLog >= runtime.log10Value(scoreThreshold));
  }
  if (costThreshold > 0) {
    checks.push(currentCostFactor > 0 && next.costFactor > 0 && currentCostFactor / next.costFactor >= costThreshold);
  }
  if (secondsThreshold > 0) {
    checks.push(runtime.state.currentGenerationRunTime >= secondsThreshold);
  }

  if (checks.length === 0) return true;
  return runtime.state.autoGenerationLegacyOrMode
    ? checks.some(Boolean)
    : checks.every(Boolean);
}

function runEternityMilestoneAutomation({ refresh = false, save = true } = {}) {
  let changed = false;
  const unlocked = (
    runtime.eternityMilestoneActive?.("5") === true
    && runtime.unlockInfiniteAngle?.({ refresh, save: false }) === true
  );
  if (unlocked) {
    changed = true;
    runtime.recordOfflineEvent("automaticUnlocks");
  }
  const capBroken = (
    runtime.eternityMilestoneActive?.("6") === true
    && runtime.breakInfiniteCap?.({ refresh, save: false }) === true
  );
  if (capBroken) {
    changed = true;
    runtime.recordOfflineEvent("automaticCompletions");
  }
  if (changed && save) runtime.saveGame("manual");
  return changed;
}

function runLayerAutomation() {
  const milestoneAutomationRan = runEternityMilestoneAutomation();
  if (!runtime.state.automationEnabled) return milestoneAutomationRan;
  const infinityAutomationUnlocked = runtime.infinityAutomationUnlocked?.() || false;
  const generationCoreAutomationUnlocked = runtime.isAchievementUnlocked(19);
  const milestoneEightAutomationRan = runEternityMilestoneEightAutomation();

  if (
    infinityAutomationUnlocked
    && runtime.state.autoRunInfinity
    && runtime.currentExactIntegerState(runtime.state, "infinityCountExact", "infinityCount") > 0n
    && runtime.canInfinity()
    && (runtime.state.activeTowerChallenge <= 0 || runtime.towerChallengeCanComplete())
    && runtime.infinityPointGainLog10() >= Math.max(
      0,
      runtime.sanitizeLog10(
        runtime.state.autoInfinityPointThresholdLog10,
        runtime.log10Value(Math.max(1, runtime.state.autoInfinityPointThreshold)),
      ),
    )
  ) {
    runtime.runInfinity(false);
    runtime.recordOfflineEvent("infinityExecutions");
    return true;
  }

  if (generationCoreAutomationUnlocked && runtime.state.autoRunCoreBoost && runtime.canCoreBoost()) {
    runtime.runCoreBoost();
    runtime.recordOfflineEvent("coreBoostResets");
    return true;
  }

  if (generationCoreAutomationUnlocked && runtime.state.autoRunGeneration && shouldAutoRunGeneration()) {
    runtime.runGeneration();
    runtime.recordOfflineEvent("generationResets");
    return true;
  }

  return milestoneEightAutomationRan || milestoneAutomationRan;
}

function runEternityMilestoneEightAutomation() {
  if (runtime.eternityMilestoneActive?.("8") !== true || !runtime.state.automationEnabled) return false;
  let changed = false;
  if (runtime.state.autoBuildTower && runtime.buildTower({ refresh: false, save: false })) {
    runtime.recordOfflineEvent("towerBuilds");
    changed = true;
  }
  const purchases = runtime.buyAllInfiniteAngleUpgrades({
    refresh: false,
    save: false,
    allowSpeed: runtime.state.autoBuyInfiniteAngleSpeed,
    allowVertex: runtime.state.autoBuyInfiniteAngleVertex,
    allowGain: runtime.state.autoBuyInfiniteAngleGain,
  });
  runtime.recordOfflineEvent("infiniteAnglePurchases", purchases);
  return changed || purchases > 0;
}

expose("normalAutobuyElapsed", () => normalAutobuyElapsed, (value) => { normalAutobuyElapsed = value; });
expose("runAutobuyers", () => runAutobuyers, (value) => { runAutobuyers = value; });
expose("shouldAutoRunGeneration", () => shouldAutoRunGeneration, (value) => { shouldAutoRunGeneration = value; });
expose("runLayerAutomation", () => runLayerAutomation, (value) => { runLayerAutomation = value; });
expose("runEternityMilestoneAutomation", () => runEternityMilestoneAutomation);
expose("runEternityMilestoneEightAutomation", () => runEternityMilestoneEightAutomation);
