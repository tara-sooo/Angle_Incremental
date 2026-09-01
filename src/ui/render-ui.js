import { runtime, expose } from "../runtime/shared.js";

// Shared form helpers and the UI update orchestrator.

let renderedRecoveryRevision = -1;
let renderedRecoveryLanguage = "";
let renderedRecoveryNumberFormat = "";
let renderedLoadRecoveryMode = false;
let renderedSaveConflictMode = false;
let renderedSaveConflictCheckpointReady = false;
let selectedTimelineNodeId = "";

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
  if (runtime.elements.topBarModeSelect) {
    runtime.elements.topBarModeSelect.querySelector('[value="news"]').textContent = runtime.t("topBarNewsOption");
    runtime.elements.topBarModeSelect.querySelector('[value="resources"]').textContent = runtime.t("topBarResourcesOption");
    runtime.elements.topBarModeSelect.querySelector('[value="progress"]').textContent = runtime.t("topBarProgressOption");
    runtime.elements.topBarModeSelect.querySelector('[value="blank"]').textContent = runtime.t("topBarBlankOption");
    runtime.elements.topBarModeSelect.querySelector('[value="hidden"]').textContent = runtime.t("topBarHiddenOption");
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

function formatRecoveryTimestamp(timestamp) {
  const numeric = Number(timestamp);
  if (!Number.isFinite(numeric) || numeric <= 0) return runtime.t("recoveryUnknownTime");
  try {
    return new Date(numeric).toLocaleString(runtime.state.language === "en" ? "en-US" : "ja-JP");
  } catch (error) {
    return runtime.t("recoveryUnknownTime");
  }
}

function formatInfiniteAngleLevel(kind) {
  const level = runtime.infiniteAngleEffectiveUpgradeLevel(kind);
  const freeLevel = runtime.infiniteAngleFreeUpgradeLevel(kind);
  return `Lv ${level}${freeLevel > 0 ? ` (+${freeLevel})` : ""}`;
}

function formatNormalUpgradeTotal(level) {
  return level < 1000 ? runtime.formatSmallDecimal(level) : runtime.formatUiNumber(level);
}

function formatNormalUpgradeLevel(rawLevel, effectiveLevel, freeLevel) {
  return freeLevel > 0
    ? `Lv ${formatNormalUpgradeTotal(effectiveLevel)} (+${freeLevel})`
    : formatEffectiveLevel(rawLevel, effectiveLevel);
}

function prestigeActionKind() {
  return runtime.canEternity?.() === true ? "eternity" : "infinity";
}

function canRunPrestigeAction(kind = prestigeActionKind()) {
  if (kind === "eternity") return runtime.canEternity?.() === true;
  return Number(runtime.state.infinityCount) > 0 && runtime.canInfinity?.() === true;
}

function prestigeActionUnlocked(kind) {
  if (kind === "eternity") {
    return Number(runtime.state.eternityCount) > 0 || Number(runtime.state.infinityCount) > 0;
  }
  return Number(runtime.state.infinityCount) > 0;
}

function renderPrestigeCard(card, fields, kind) {
  if (!card || !fields.name || !fields.status || !fields.detailLabel || !fields.detail || !fields.button) return null;
  const unlocked = prestigeActionUnlocked(kind);
  const ready = canRunPrestigeAction(kind);
  card.dataset.action = kind;
  card.dataset.state = ready ? "ready" : unlocked ? "unavailable" : "locked";
  card.classList.toggle("is-ready", ready);
  card.classList.toggle("is-unavailable", unlocked && !ready);
  card.classList.toggle("is-locked", !unlocked);
  card.classList.toggle("is-eternity", kind === "eternity");
  fields.name.textContent = kind === "eternity" ? runtime.t("eternity") : "Infinity";
  fields.status.textContent = ready
    ? runtime.t("prestigeActionReady")
    : unlocked
      ? runtime.t("prestigeActionUnavailable")
      : runtime.t("prestigeActionLocked");
  fields.button.dataset.prestigeAction = kind;
  fields.button.disabled = !ready;

  if (kind === "eternity") {
    const requirement = runtime.t("eternityRequirementCompact")
      .replace("{ip}", runtime.formatUiLogNumber(runtime.ETERNITY_REQUIREMENT_LOG10));
    const currentIp = runtime.formatHeldUiLogNumber(
      runtime.currentInfinityPointsLog10(),
      runtime.state.infinityPointsExact,
    );
    fields.detailLabel.textContent = runtime.t("prestigeActionEternityRequirement");
    fields.detail.textContent = `${requirement} / ${runtime.t("prestigeActionCurrentIp")}: ${currentIp} IP`;
    fields.button.textContent = runtime.t(ready ? "eternityPerform" : "eternityPerformUnavailable");
  } else {
    fields.detailLabel.textContent = runtime.t("infinityGain");
    fields.detail.textContent = ready
      ? `+${runtime.formatUiNumber(runtime.infinityPointGain())} IP`
      : runtime.t("prestigeActionInfinityRequirement")
        .replace("{score}", runtime.formatUiLogNumber(runtime.INFINITY_REQUIREMENT_LOG10));
    fields.button.textContent = "Infinity";
  }
  return { ready, unlocked };
}

function updatePrestigeActionUi() {
  const surface = runtime.elements.prestigeActionSurface;
  const primaryKind = prestigeActionKind();
  const secondaryKind = primaryKind === "eternity" ? "infinity" : "eternity";
  const primary = renderPrestigeCard(
    runtime.elements.prestigePrimaryActionCard,
    {
      name: runtime.elements.prestigeActionName,
      status: runtime.elements.prestigeActionStatus,
      detailLabel: runtime.elements.prestigeActionDetailLabel,
      detail: runtime.elements.prestigeActionDetail,
      button: runtime.elements.prestigeActionButton,
    },
    primaryKind,
  );
  const secondary = renderPrestigeCard(
    runtime.elements.prestigeSecondaryActionCard,
    {
      name: runtime.elements.prestigeSecondaryActionName,
      status: runtime.elements.prestigeSecondaryActionStatus,
      detailLabel: runtime.elements.prestigeSecondaryActionDetailLabel,
      detail: runtime.elements.prestigeSecondaryActionDetail,
      button: runtime.elements.prestigeSecondaryActionButton,
    },
    secondaryKind,
  );
  if (!surface || !primary || !secondary) return;
  surface.dataset.action = primaryKind;
  surface.dataset.state = primary.ready ? "ready" : primary.unlocked ? "unavailable" : "locked";
  surface.classList.toggle("is-ready", primary.ready);
  surface.classList.toggle("is-eternity", primaryKind === "eternity");
  surface.classList.toggle("is-locked", !primary.unlocked);
  surface.dataset.secondaryAction = secondaryKind;
}

function runPrestigeAction(kind = prestigeActionKind()) {
  const actionKind = kind === "eternity" || kind === "infinity" ? kind : prestigeActionKind();
  if (!canRunPrestigeAction(actionKind)) return false;
  if (actionKind === "eternity") return runtime.performEternity?.() === true;
  runtime.runInfinity?.(false);
  return true;
}

function recoveryReasonText(reason) {
  const reasonKeys = {
    periodic: "checkpointReasonPeriodic",
    "save-conflict": "checkpointReasonSaveConflict",
    "pre-import": "checkpointReasonPreImport",
    "pre-update": "checkpointReasonPreUpdate",
    "pre-reset": "checkpointReasonPreReset",
    "pre-infinity-challenge": "checkpointReasonPreInfinityChallenge",
    "pre-break-cap": "checkpointReasonPreBreakCap",
    "pre-infinite-angle": "checkpointReasonPreInfiniteAngle",
    "pre-tower-build": "checkpointReasonPreTowerBuild",
    "pre-tower-challenge": "checkpointReasonPreTowerChallenge",
    "pre-timeline-respec": "checkpointReasonPreTimelineRespec",
    "pre-restore": "checkpointReasonPreRestore",
  };
  return runtime.t(reasonKeys[reason] || "checkpointReasonOther");
}

function countBits(value) {
  let remaining = Math.max(0, Math.floor(Number(value) || 0));
  let count = 0;
  while (remaining > 0) {
    remaining &= remaining - 1;
    count += 1;
  }
  return count;
}

function countAchievementBits(state) {
  let count = 0;
  for (let id = 1; id <= runtime.ACHIEVEMENT_COUNT; id += 1) {
    const mask = id <= 31 ? state.achievementMask : state.achievementMaskHigh;
    const bit = 1 << (id <= 31 ? id - 1 : id - 32);
    if ((((Number(mask) || 0) >>> 0) & bit) !== 0) count += 1;
  }
  return count;
}

function recoveryStateSummary(entry) {
  const state = entry?.state || {};
  const infinityPointsLog10 = runtime.sanitizeLog10(
    state.infinityPointsLog10,
    runtime.log10Value(Math.max(0, Number(state.infinityPoints) || 0)),
  );
  return [
    `${runtime.t("recoveryInfinity")}: ${runtime.formatUiNumber(state.infinityCount || 0)}`,
    `${runtime.t("recoveryIp")}: ${runtime.formatHeldUiLogNumber(infinityPointsLog10, state.infinityPointsExact)}`,
    `${runtime.t("recoveryChallenges")}: ${countBits(state.completedChallenges)}/${runtime.INFINITY_CHALLENGE_COUNT}`,
    `${runtime.t("recoveryAchievements")}: ${countAchievementBits(state)}/${runtime.ACHIEVEMENT_COUNT}`,
    `${runtime.t("recoveryIa")}: ${state.infiniteAngleUnlocked ? runtime.t("recoveryUnlocked") : runtime.t("recoveryLocked")}`,
    `${runtime.t("recoveryTower")}: ${Math.max(0, Math.floor(Number(state.towerFloor) || 0))}`,
  ].join(" · ");
}

function updateSaveRecoveryUi() {
  const elements = runtime.elements;
  if (!elements.preImportBackupStatus || !elements.saveCheckpointList || !runtime.recoveryEntries) return;
  const currentRevision = typeof runtime.recoveryRevision === "number" ? runtime.recoveryRevision : null;
  if (
    currentRevision !== null
    && currentRevision === renderedRecoveryRevision
    && renderedRecoveryLanguage === runtime.state.language
    && renderedRecoveryNumberFormat === runtime.state.numberFormat
    && renderedLoadRecoveryMode === Boolean(runtime.loadRecoveryMode)
    && renderedSaveConflictMode === Boolean(runtime.saveConflictMode)
    && renderedSaveConflictCheckpointReady === Boolean(runtime.saveConflictCheckpointReady)
  ) return;
  const recovery = runtime.recoveryEntries();
  if (
    elements.saveRecoveryDetails
    && (recovery.loadFailure
      || runtime.loadRecoveryMode
      || runtime.saveConflictMode
      || recovery.quarantine
      || recovery.preImport
      || recovery.undo)
  ) {
    elements.saveRecoveryDetails.open = true;
  }
  elements.preImportBackupStatus.textContent = recovery.preImport
    ? `${runtime.t("preImportBackupAvailable")} ${formatRecoveryTimestamp(recovery.preImport.backedUpAt)}`
    : runtime.t("noPreImportBackup");
  if (elements.loadFailureStatus) {
    const failure = recovery.loadFailure;
    if (failure) {
      const stageText = runtime.t(failure.stage === "offline" ? "loadFailureOffline" : "loadFailureApply");
      const detail = failure.errorMessage ? `: ${failure.errorMessage}` : "";
      elements.loadFailureStatus.textContent = `${runtime.t("loadFailureDetected")} ${stageText}${detail}`;
    } else if (runtime.saveConflictMode) {
      elements.loadFailureStatus.textContent = runtime.t(
        runtime.saveConflictCheckpointReady ? "saveConflictDetected" : "saveConflictBackupFailed",
      );
    } else {
      elements.loadFailureStatus.textContent = runtime.loadRecoveryMode
        ? runtime.t("loadRecoveryRequired")
        : "";
    }
  }
  if (elements.quarantineStatus) {
    elements.quarantineStatus.textContent = recovery.quarantine
      ? `${runtime.t("quarantineAvailable")} ${formatRecoveryTimestamp(recovery.quarantine.quarantinedAt)}`
      : "";
  }
  if (elements.retryLoadButton) elements.retryLoadButton.hidden = !runtime.loadRecoveryMode;
  if (elements.restoreQuarantineButton) elements.restoreQuarantineButton.hidden = !recovery.quarantine;
  if (elements.restorePreImportButton) elements.restorePreImportButton.hidden = !recovery.preImport;
  if (elements.restoreUndoButton) elements.restoreUndoButton.hidden = !recovery.undo;
  renderedRecoveryRevision = currentRevision === null ? renderedRecoveryRevision : currentRevision;
  renderedRecoveryLanguage = runtime.state.language;
  renderedRecoveryNumberFormat = runtime.state.numberFormat;
  renderedLoadRecoveryMode = Boolean(runtime.loadRecoveryMode);
  renderedSaveConflictMode = Boolean(runtime.saveConflictMode);
  renderedSaveConflictCheckpointReady = Boolean(runtime.saveConflictCheckpointReady);
  clearElement(elements.saveCheckpointList);
  if (recovery.checkpoints.length === 0) {
    elements.saveCheckpointList.textContent = runtime.t("noCheckpoints");
    return;
  }
  recovery.checkpoints.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "save-checkpoint-row";
    const details = document.createElement("div");
    details.className = "save-checkpoint-details";
    const title = document.createElement("strong");
    title.textContent = recoveryReasonText(entry.reason);
    const timestamp = document.createElement("span");
    timestamp.textContent = formatRecoveryTimestamp(entry.backedUpAt);
    const summary = document.createElement("small");
    summary.textContent = recoveryStateSummary(entry);
    details.append(title, timestamp, summary);
    const restoreButton = document.createElement("button");
    restoreButton.type = "button";
    restoreButton.className = "reset-button";
    restoreButton.dataset.checkpointIndex = String(index);
    restoreButton.textContent = runtime.t("restoreCheckpoint");
    row.append(details, restoreButton);
    elements.saveCheckpointList.append(row);
  });
}

function canSpendLog(amountLog) {
  return runtime.currentScoreLog10() >= amountLog;
}

function canSpend(amount) {
  return canSpendLog(runtime.log10Value(amount));
}

function formatVertexGainIncrease(log10Value) {
  if (typeof log10Value !== "number" || Number.isNaN(log10Value) || log10Value === -Infinity) return "0";
  if (log10Value === Infinity || log10Value === Number.MAX_VALUE) return "∞";
  if (log10Value < 3) return runtime.formatSmallDecimal(runtime.valueFromLog10(log10Value));
  return runtime.formatUiLogNumber(log10Value);
}

function formatTimelineEternityRequirement() {
  const claims = runtime.timelineTrackClaimCount("eternity");
  const requirement = runtime.timelineEternityRequirement();
  return requirement !== null && requirement <= 1000000n
    ? requirement.toString()
    : `2^${claims + 1}`;
}

function localizedTimelineText(value) {
  if (!value || typeof value !== "object") return "";
  return value[runtime.state.language] || value.en || value.ja || "";
}

function timelineNodeDescriptionText(node) {
  return localizedTimelineText(node.description).replace("{softcap}", runtime.formatUiLogNumber(10));
}

function timelineNodeStatusText(availability) {
  switch (availability.reason) {
    case "owned":
      return runtime.t("timelineNodePurchased");
    case "timeline-locked":
      return runtime.t("timelineNodeLocked");
    case "missing-prerequisites":
      return runtime.t("timelineNodeMissingPrerequisites").replace(
        "{nodes}",
        availability.missingPrerequisites.join(", "),
      );
    case "route-conflict":
      return runtime.t("timelineNodeAlternativeLocked");
    case "insufficient-tf":
      return runtime.t("timelineNodeNotEnoughTf").replace(
        "{cost}",
        String(availability.node.costTF),
      );
    default:
      return runtime.t("timelineNodeAvailable");
  }
}

function timelineNodeCurrentEffectText(node, availability) {
  if (availability.reason !== "owned") return runtime.t("timelineNodeInactive");
  if (node.id === "Real-BC16500") {
    return runtime.t("timelineRealCurrentEffect")
      .replace("{multiplier}", formatMultiplierLog(runtime.timelineIpGainMultiplierLog10?.() ?? 0));
  }
  if (node.id === "Parallel-BC16500") {
    const effectiveLog10 = runtime.timelineParallelEffectiveLog10?.() ?? 0;
    return runtime.t("timelineParallelCurrentEffect")
      .replace("{multiplier}", formatMultiplierLog(effectiveLog10))
      .replace("{time}", runtime.formatLongDuration(runtime.timelineParallelSecondsSinceIc8Clear?.() ?? 0));
  }
  return runtime.t("timelineNodeInactive");
}

function timelineNodeRouteClass(route) {
  return route === "Parallel" ? "timeline-node-route-parallel" : "timeline-node-route-real";
}

function createTimelineNodeCard(node) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "timeline-node ui-tree-node";
  card.dataset.timelineNode = node.id;
  card.dataset.route = node.route || "";
  card.setAttribute("aria-controls", "timelineNodeDetail");

  const heading = document.createElement("span");
  heading.className = "timeline-node-heading";
  const identity = document.createElement("span");
  identity.className = "timeline-node-identity";
  const era = document.createElement("span");
  era.className = "timeline-node-era";
  const name = document.createElement("strong");
  name.className = "timeline-node-name";
  const route = document.createElement("span");
  route.className = `timeline-node-route ${timelineNodeRouteClass(node.route)}`;
  identity.append(era, name);
  heading.append(identity, route);

  const meta = document.createElement("span");
  meta.className = "timeline-node-compact-meta";
  const cost = document.createElement("span");
  cost.className = "timeline-node-cost";
  const status = document.createElement("span");
  status.className = "timeline-node-status";
  meta.append(cost, status);
  card.append(heading, meta);
  return card;
}

function renderTimelineNodeTree(nodes) {
  const host = runtime.elements.timelineNodeGrid;
  if (!host) return;
  const signature = nodes.map((node) => `${node.id}:${node.era}:${node.route}`).join("|");
  if (host.dataset.timelineSignature !== signature) {
    clearElement(host);
    const eras = new Map();
    nodes.forEach((node) => {
      if (!eras.has(node.era)) eras.set(node.era, []);
      eras.get(node.era).push(node);
    });
    eras.forEach((eraNodes, era) => {
      const eraSection = document.createElement("section");
      eraSection.className = "timeline-era";
      eraSection.dataset.timelineEra = era;
      const eraHeading = document.createElement("h3");
      eraHeading.className = "timeline-era-heading";
      eraHeading.textContent = era;
      const grid = document.createElement("div");
      grid.className = "timeline-node-grid";
      eraNodes
        .slice()
        .sort((left, right) => (left.route === "Parallel" ? 1 : 0) - (right.route === "Parallel" ? 1 : 0))
        .forEach((node) => grid.append(createTimelineNodeCard(node)));
      eraSection.append(eraHeading, grid);
      host.append(eraSection);
    });
    host.dataset.timelineSignature = signature;
  }
  runtime.elements.timelineNodeCards = Array.from(host.querySelectorAll(".timeline-node"));
}

function updateTimelineNodeCard(card, node, availability) {
  const name = card.querySelector(".timeline-node-name");
  const era = card.querySelector(".timeline-node-era");
  const route = card.querySelector(".timeline-node-route");
  const cost = card.querySelector(".timeline-node-cost");
  const status = card.querySelector(".timeline-node-status");
  const selected = node.id === selectedTimelineNodeId;
  const costText = `${runtime.t("timelineNodeCost")}: ${runtime.formatUiNumber(node.costTF)} TF`;
  const statusText = timelineNodeStatusText(availability);
  if (name) name.textContent = localizedTimelineText(node.name);
  if (era) era.textContent = node.era;
  if (route) {
    route.textContent = node.route;
    route.classList.toggle("timeline-node-route-real", node.route === "Real");
    route.classList.toggle("timeline-node-route-parallel", node.route === "Parallel");
  }
  if (cost) cost.textContent = costText;
  if (status) status.textContent = statusText;
  card.dataset.state = availability.reason;
  card.dataset.route = node.route || "";
  card.classList.toggle("is-available", availability.canPurchase);
  card.classList.toggle("is-owned", availability.reason === "owned");
  card.classList.toggle("is-locked", !availability.canPurchase && availability.reason !== "owned");
  card.classList.toggle("is-conflict", availability.reason === "route-conflict");
  card.classList.toggle("is-selected", selected);
  card.setAttribute("aria-pressed", String(selected));
  card.setAttribute("aria-label", `${localizedTimelineText(node.name)}, ${node.era}, ${node.route}, ${costText}, ${statusText}`);
}

function updateTimelineNodeDetail(node, availability) {
  const detail = runtime.elements.timelineNodeDetail;
  if (!detail) return;
  if (!node) {
    detail.hidden = true;
    return;
  }
  detail.hidden = false;
  detail.dataset.timelineNode = node.id;
  detail.dataset.state = availability.reason;
  detail.classList.toggle("is-available", availability.canPurchase);
  detail.classList.toggle("is-owned", availability.reason === "owned");
  detail.classList.toggle("is-locked", !availability.canPurchase && availability.reason !== "owned");
  detail.classList.toggle("is-conflict", availability.reason === "route-conflict");
  const prerequisites = Array.isArray(node.prerequisites) ? node.prerequisites : [];
  if (runtime.elements.timelineNodeDetailHeading) runtime.elements.timelineNodeDetailHeading.textContent = localizedTimelineText(node.name);
  if (runtime.elements.timelineNodeDetailDescription) runtime.elements.timelineNodeDetailDescription.textContent = timelineNodeDescriptionText(node);
  if (runtime.elements.timelineNodeDetailCurrentEffect) runtime.elements.timelineNodeDetailCurrentEffect.textContent = timelineNodeCurrentEffectText(node, availability);
  if (runtime.elements.timelineNodeDetailPrerequisites) runtime.elements.timelineNodeDetailPrerequisites.textContent = prerequisites.length > 0
    ? prerequisites.join(", ")
    : runtime.t("timelineNoPrerequisites");
  if (runtime.elements.timelineNodePurchaseButton) {
    runtime.elements.timelineNodePurchaseButton.dataset.timelineNodePurchase = node.id;
    runtime.elements.timelineNodePurchaseButton.hidden = !availability.canPurchase;
    runtime.elements.timelineNodePurchaseButton.disabled = !availability.canPurchase;
    runtime.elements.timelineNodePurchaseButton.textContent = runtime.t("timelinePurchase");
  }
}

function selectTimelineNode(nodeId) {
  const node = runtime.timelineNode?.(nodeId);
  if (!node) return false;
  selectedTimelineNodeId = node.id;
  updateTimelineTreeUi();
  return true;
}

function updateTimelineTreeUi() {
  if (typeof runtime.timelineNodeAvailability !== "function" || typeof runtime.timelineNodes !== "function") return;
  const nodes = runtime.timelineNodes();
  renderTimelineNodeTree(nodes);
  if (!nodes.some((node) => node.id === selectedTimelineNodeId)) selectedTimelineNodeId = nodes[0]?.id || "";
  const selectedNode = runtime.timelineNode?.(selectedTimelineNodeId);
  runtime.elements.timelineNodeCards.forEach((card) => {
    const node = runtime.timelineNode?.(card.dataset.timelineNode);
    if (node) updateTimelineNodeCard(card, node, runtime.timelineNodeAvailability(node.id));
  });
  updateTimelineNodeDetail(
    selectedNode,
    selectedNode ? runtime.timelineNodeAvailability(selectedNode.id) : null,
  );
}

function updateTimelineUi() {
  if (!runtime.elements.timelineEarnedTf || typeof runtime.timelineEarnedTf !== "function") return;
  runtime.normalizeTimelineState?.();
  const earned = runtime.timelineEarnedTf();
  const available = runtime.timelineAvailableTf();
  const spent = runtime.timelineSpentTf();
  runtime.elements.timelineEarnedTf.textContent = `${runtime.formatUiNumber(earned)} TF`;
  runtime.elements.timelineAvailableTf.textContent = `${runtime.formatUiNumber(available)} TF`;
  runtime.elements.timelineSpentTf.textContent = `${runtime.formatUiNumber(spent)} TF`;

  const tracks = [
    {
      id: "score",
      claims: runtime.elements.timelineScoreClaims,
      requirement: runtime.elements.timelineScoreRequirement,
      button: runtime.elements.timelineScoreClaimButton,
      requirementText: `${runtime.formatUiLogNumber(runtime.timelineScoreRequirementLog10())} Score`,
    },
    {
      id: "ip",
      claims: runtime.elements.timelineIpClaims,
      requirement: runtime.elements.timelineIpRequirement,
      button: runtime.elements.timelineIpClaimButton,
      requirementText: `${runtime.formatUiLogNumber(runtime.timelineIpRequirementLog10())} IP`,
    },
    {
      id: "eternity",
      claims: runtime.elements.timelineEternityClaims,
      requirement: runtime.elements.timelineEternityRequirement,
      button: runtime.elements.timelineEternityClaimButton,
      requirementText: formatTimelineEternityRequirement(),
    },
  ];
  tracks.forEach((track) => {
    if (track.claims) track.claims.textContent = runtime.formatUiNumber(runtime.timelineTrackClaimCount(track.id));
    if (track.requirement) track.requirement.textContent = track.requirementText;
    if (track.button) {
      track.button.disabled = !runtime.canClaimTimelineTf(track.id);
      track.button.textContent = runtime.t("timelineClaim");
    }
  });

  if (runtime.elements.timelineRespecButton) {
    runtime.elements.timelineRespecButton.disabled = runtime.timelineDiscovered?.() !== true;
  }
  updateTimelineTreeUi();
}

function updateUi() {
  if (runtime.offlineProcessing) return;
  const currentCostLogs = runtime.costLogs();
  const unlockedAchievementsNow = runtime.checkAchievements(true);
  const discoveredMainTabs = runtime.discoverMainTabs?.() === true;
  if (unlockedAchievementsNow.length > 0 || discoveredMainTabs) runtime.saveGame("manual");
  document.documentElement.classList.toggle("light-effects", runtime.state.lightEffects);
  applyLanguage();
  runtime.updateHelpUi?.();
  runtime.updateMainTabVisibility?.();
  runtime.updateTopBar();
  runtime.elements.scoreValue.textContent = runtime.scoreDisplay();
  runtime.elements.gainValue.textContent = runtime.formatUiLogNumber(runtime.finalScoreGainLog10());
  const vertexGainIncreaseLog10 = runtime.vertexGainIncreaseLog10();
  runtime.elements.vertexGainValue.textContent = `+${formatVertexGainIncrease(vertexGainIncreaseLog10)}`;
  runtime.elements.lapValue.textContent = runtime.formatDuration(runtime.lapDuration());
  runtime.elements.lapSpeedValue.textContent = formatMultiplierLog(runtime.effectiveLapSpeedLog10());
  if (runtime.isLapSpeedSoftcapped()) runtime.elements.lapSpeedValue.textContent += " " + runtime.t("lapSpeedSoftcapped");
  const freeNormalUpgradeLevel = runtime.eternityMilestoneNormalUpgradeBonusLevel?.() || 0;
  const effectiveSpeedLevel = runtime.effectiveSpeedLevel();
  const effectiveVertexCount = runtime.effectiveVertexCount();
  const effectiveGainLevel = runtime.effectiveGainLevel();
  runtime.elements.speedLevel.textContent = formatNormalUpgradeLevel(
    runtime.state.speedLevel,
    effectiveSpeedLevel,
    freeNormalUpgradeLevel,
  );
  runtime.elements.vertexCount.textContent = freeNormalUpgradeLevel > 0
    ? `${formatNormalUpgradeTotal(effectiveVertexCount)} ${runtime.t("vertices")} (+${freeNormalUpgradeLevel})`
    : effectiveVertexCount === runtime.state.vertices
      ? `${runtime.state.vertices} ${runtime.t("vertices")}`
      : `${effectiveVertexCount} ${runtime.t("vertices")} (${runtime.state.vertices} + ${effectiveVertexCount - runtime.state.vertices})`;
  runtime.elements.gainLevel.textContent = formatNormalUpgradeLevel(
    runtime.state.gainLevel,
    effectiveGainLevel,
    freeNormalUpgradeLevel,
  );
  runtime.elements.speedCost.textContent = `${runtime.t("cost")} ${runtime.formatUiLogNumber(currentCostLogs.speed)}`;
  runtime.elements.vertexCost.textContent = `${runtime.t("cost")} ${runtime.formatUiLogNumber(currentCostLogs.vertex)}`;
  runtime.elements.gainCost.textContent = `${runtime.t("cost")} ${runtime.formatUiLogNumber(currentCostLogs.gain)}`;
  const canBuyNormal = {
    speed: runtime.canBuyNormalUpgrade("speed"),
    vertex: runtime.canBuyNormalUpgrade("vertex"),
    gain: runtime.canBuyNormalUpgrade("gain"),
  };
  runtime.elements.speedUpgrade.disabled = !canBuyNormal.speed;
  runtime.elements.vertexUpgrade.disabled = !canBuyNormal.vertex;
  runtime.elements.gainUpgrade.disabled = !canBuyNormal.gain;
  runtime.elements.buyAllUpgrade.disabled = !canBuyNormal.speed && !canBuyNormal.vertex && !canBuyNormal.gain;

  const ready = runtime.canRunGeneration();
  runtime.elements.generationButton.disabled = !ready;
  runtime.elements.generationCount.textContent = String(runtime.state.generationCount);
  const previousGenerationScoreLog10 = runtime.currentPreviousGenerationScoreLog10();
  runtime.elements.previousGenerationScore.textContent = Number.isFinite(previousGenerationScoreLog10)
    ? runtime.formatUiLogNumber(previousGenerationScoreLog10)
    : runtime.t("generationNotRun");
  const nextGeneration = runtime.nextGenerationValues();
  runtime.elements.generationMultiplier.textContent = formatMultiplierLogPreview(runtime.generationScoreMultiplierEffectLog10(), nextGeneration.scoreMultiplierLog10);
  runtime.elements.generationCostFactor.textContent = formatMultiplierPreview(runtime.generationCostFactorEffect(), nextGeneration.costFactor);

  runtime.elements.coreBoostCount.textContent = String(runtime.state.coreBoostCount);
  runtime.elements.coreBoostRequirement.textContent = runtime.formatUiLogNumber(runtime.coreBoostRequirementLog10());
  runtime.elements.coreBoostRequirementGrowthPower.textContent = `^${runtime.coreBoostRequirementGrowthPower().toFixed(3)}`;
  const nextCoreBoost = runtime.nextCoreBoostValues();
  runtime.elements.coreBoostGainBoost.textContent = formatMultiplierPreview(runtime.coreBoostGainIncreaseMultiplier(), nextCoreBoost.gainMultiplier);
  runtime.elements.coreBoostExponent.textContent = formatExponentPreview(runtime.coreBoostGainExponent(), nextCoreBoost.gainExponent);
  runtime.elements.coreBoostButton.disabled = !runtime.canCoreBoost();

  runtime.elements.infinityCount.textContent = runtime.formatUiNumber(runtime.state.infinityCount);
  const infinityReady = runtime.canInfinity();
  const infinityUnlocked = runtime.state.infinityCount > 0;
  runtime.elements.infinityTabState.textContent = infinityReady ? "READY" : infinityUnlocked ? "OPEN" : "LOCKED";
  runtime.elements.infinityUnlockNote.hidden = infinityUnlocked;
  runtime.elements.infinityUnlockNote.textContent = runtime.t("infinityUnlockNote")
    .replace("{score}", runtime.formatUiLogNumber(runtime.INFINITY_REQUIREMENT_LOG10));
  runtime.elements.infinityPoints.textContent = runtime.formatHeldUiLogNumber(
    runtime.currentInfinityPointsLog10(),
    runtime.state.infinityPointsExact,
  );
  runtime.elements.infiniteScorePanel.textContent = runtime.formatHeldUiLogNumber(runtime.currentInfiniteScoreLog10());
  const infiniteAngleBoostLog10 = runtime.infiniteAngleBoostLog10();
  runtime.elements.infiniteAngleBoostPanel.textContent = formatMultiplierLog(infiniteAngleBoostLog10);
  runtime.elements.infinityPointGain.textContent = `+${runtime.formatUiNumber(runtime.infinityPointGain())} IP`;
  updatePrestigeActionUi();
  runtime.updateInfinityUpgradeRows();
  const infiniteAngleUnlocked = runtime.state.infiniteAngleUnlocked;
  const infiniteAngleUnlockCostLog10 = runtime.infiniteAngleUnlockCostLog10();
  const infiniteAngleUpgradeCosts = {
    speed: runtime.infiniteAngleUpgradeCostLog10("speed"),
    vertex: runtime.infiniteAngleUpgradeCostLog10("vertex"),
    gain: runtime.infiniteAngleUpgradeCostLog10("gain"),
  };
  runtime.elements.infiniteAngleUnlockNote.hidden = infiniteAngleUnlocked;
  runtime.elements.infiniteAngleUnlockButton.hidden = infiniteAngleUnlocked;
  runtime.elements.infiniteAngleUnlockButton.disabled = !runtime.canUnlockInfiniteAngle();
  runtime.elements.infiniteAngleBuyAllUpgrade.disabled = !runtime.canBuyInfiniteAngleUpgrade("speed")
    && !runtime.canBuyInfiniteAngleUpgrade("vertex")
    && !runtime.canBuyInfiniteAngleUpgrade("gain");
  runtime.elements.infiniteAngleUnlockCost.textContent = `${runtime.t("infinityUpgradeCost")} ${runtime.formatUiLogNumber(infiniteAngleUnlockCostLog10)} IP`;
  runtime.elements.infiniteAngleVertexCount.textContent = `${runtime.infiniteAngleVertexCount()} ${runtime.t("infiniteAngleVertices")}`;
  runtime.elements.infiniteAngleCurrentGain.textContent = runtime.formatUiLogNumber(runtime.infiniteAngleCurrentGainLog10());
  runtime.elements.infiniteAngleLap.textContent = runtime.formatDuration(runtime.infiniteAngleLapDuration());
  runtime.elements.infiniteAngleSpeedLevel.textContent = formatInfiniteAngleLevel("speed");
  runtime.elements.infiniteAngleVertexLevel.textContent = formatInfiniteAngleLevel("vertex");
  runtime.elements.infiniteAngleGainLevel.textContent = formatInfiniteAngleLevel("gain");
  runtime.elements.infiniteAngleSpeedCost.textContent = `${runtime.t("infinityUpgradeCost")} ${runtime.formatUiLogNumber(infiniteAngleUpgradeCosts.speed)} IP`;
  runtime.elements.infiniteAngleVertexCost.textContent = `${runtime.t("infinityUpgradeCost")} ${runtime.formatUiLogNumber(infiniteAngleUpgradeCosts.vertex)} IP`;
  runtime.elements.infiniteAngleGainCost.textContent = `${runtime.t("infinityUpgradeCost")} ${runtime.formatUiLogNumber(infiniteAngleUpgradeCosts.gain)} IP`;
  const canBuyInfiniteAngle = {
    speed: runtime.canBuyInfiniteAngleUpgrade("speed"),
    vertex: runtime.canBuyInfiniteAngleUpgrade("vertex"),
    gain: runtime.canBuyInfiniteAngleUpgrade("gain"),
  };
  runtime.elements.infiniteAngleSpeedUpgrade.disabled = !canBuyInfiniteAngle.speed;
  runtime.elements.infiniteAngleVertexUpgrade.disabled = !canBuyInfiniteAngle.vertex;
  runtime.elements.infiniteAngleGainUpgrade.disabled = !canBuyInfiniteAngle.gain;
  const completed = runtime.completedChallengeCount();
  runtime.elements.challengeStatus.textContent = runtime.state.activeChallenge > 0
    ? `${runtime.challengeName(runtime.state.activeChallenge)} ${runtime.t("challengeRunning")}`
    : !runtime.infinityChallengesUnlocked()
      ? runtime.t("locked")
      : `${completed}/${runtime.INFINITY_CHALLENGE_COUNT} ${runtime.t("completed")}`;
  runtime.elements.challengeTabState.textContent = `IC ${completed}/${runtime.INFINITY_CHALLENGE_COUNT}`;
  runtime.updateChallengeRows();
  runtime.updateTowerChallengeRows();
  const currentTowerFloor = runtime.towerFloor();
  const nextTowerFloor = runtime.towerNextFloor();
  const nextTowerCostLog10 = runtime.towerNextFloorCostLog10();
  const towerGate = runtime.towerGateForFloor(nextTowerFloor);
  const towerGateReady = runtime.towerCanBuildNextFloor();
  const maximumInfinityPointLog10 = runtime.log10ExactInfinityPoints(runtime.MAX_EXACT_INFINITY_POINTS);
  const towerCostAffordable = (!runtime.infinityPointCapActive() || nextTowerCostLog10 <= maximumInfinityPointLog10)
    && runtime.canSpendInfinityPoints(nextTowerCostLog10);
  runtime.elements.towerFloorHeading.textContent = `Floor ${currentTowerFloor}`;
  runtime.elements.towerFloorValue.textContent = String(currentTowerFloor);
  runtime.elements.towerScoreExponentValue.textContent = `^${runtime.towerScoreExponent().toFixed(2)}`;
  runtime.elements.towerChallenge1ScorePower.textContent = `^${runtime.infiniteAngleScorePower().toFixed(3)}`;
  runtime.elements.towerNextCost.textContent = `${runtime.formatUiLogNumber(nextTowerCostLog10)} IP`;
  runtime.elements.towerGateStatus.textContent = !towerGateReady
    ? runtime.t("towerNeedChallenge").replace("{index}", String(towerGate))
    : !towerCostAffordable
      ? runtime.t("towerNeedIp")
      : runtime.t("towerBuildReady");
  runtime.elements.towerBuildButton.disabled = !runtime.canBuildTower();
  const breakCapRequirement = runtime.formatUiLogNumber(runtime.BREAK_CAP_REQUIREMENT_LOG10);
  runtime.elements.breakCapRequirement.textContent = runtime.state.infiniteCapBroken
    ? runtime.t("breakCapBroken")
    : runtime.t("breakCapRequirement").replace("{score}", breakCapRequirement);
  runtime.elements.breakCapButton.disabled = !runtime.canBreakInfiniteCap();
  runtime.elements.breakCapButton.textContent = runtime.state.infiniteCapBroken ? "Cap Broken" : "Break Infinite Cap";

  runtime.updateAutomationUi();
  runtime.updateStatisticsUi();
  runtime.updateOfflineReportUi();
  updateTimelineUi();

  const unlockedAchievements = runtime.achievementCount();
  runtime.elements.achievementTabState.textContent = `${unlockedAchievements}/${runtime.ACHIEVEMENT_COUNT}`;
  runtime.elements.achievementSummary.textContent = `${unlockedAchievements}/${runtime.ACHIEVEMENT_COUNT} ${runtime.t("tabAchievements")}`;
  runtime.elements.achievementBoost.textContent = `×${runtime.achievementGainMultiplier().toFixed(3)}`;
  runtime.updateAchievementRows();

  syncFormControl(runtime.elements.floatingTextToggle, runtime.state.showFloatingText);
  syncFormControl(runtime.elements.lightEffectsToggle, runtime.state.lightEffects);
  syncFormControl(runtime.elements.fpsToggle, runtime.state.showFps);
  syncFormControl(runtime.elements.languageSelect, runtime.state.language);
  syncFormControl(runtime.elements.numberFormatSelect, runtime.state.numberFormat);
  syncFormControl(runtime.elements.timeUnitSelect, runtime.state.timeUnit);
  syncFormControl(runtime.elements.topBarModeSelect, runtime.state.topBarMode);
  syncFormControl(runtime.elements.offlineProgressToggle, runtime.state.offlineProgressEnabled);
  syncFormControl(runtime.elements.offlineTickInput, runtime.state.offlineTickCount);
  document.documentElement.classList.toggle("show-fps", runtime.state.showFps);
  runtime.elements.fpsCounter.hidden = !runtime.state.showFps;
  if (runtime.state.showFps) runtime.elements.fpsCounter.textContent = `FPS ${Math.round(runtime.smoothedFps)}`;
  const rootStyle = document.documentElement?.style;
  if (typeof rootStyle?.setProperty === "function") {
    const fpsHeight = runtime.elements.fpsCounter.hidden
      ? 0
      : Math.ceil(runtime.elements.fpsCounter.getBoundingClientRect().height);
    rootStyle.setProperty("--fps-counter-height", `${fpsHeight}px`);
  }
  updateSaveRecoveryUi();
}

function setSaveStatus(text) {
  runtime.elements.saveStatus.textContent = text;
}

function gainExpressionConfig() {
  const parts = gainExpressionParts();
  const effectiveParts = runtime.tc4EffectiveGainExpressionParts(parts);
  if (parts <= 1) return { parts, effectiveParts, divisor: 1, rewardRemovesDivisor: false };
  if (runtime.state.activeChallenge === 1) return { parts, effectiveParts, divisor: parts * 10, rewardRemovesDivisor: false };
  if (runtime.isChallengeCompleted(1)) return { parts, effectiveParts, divisor: 1, rewardRemovesDivisor: true };
  return { parts, effectiveParts, divisor: parts, rewardRemovesDivisor: false };
}

function formatGainExpression(valueLog10) {
  const config = gainExpressionConfig();
  if (config.effectiveParts <= 1) return runtime.formatUiLogNumber(valueLog10);
  const base = runtime.formatUiLogNumber(valueLog10);
  const exponent = Number.isInteger(config.effectiveParts)
    ? String(config.effectiveParts)
    : config.effectiveParts.toFixed(2);
  if (config.divisor <= 1) return `(${base})^${exponent}`;
  return `(${base} / ${config.divisor})^${exponent}`;
}

function formatEffectiveLevel(rawLevel, effectiveLevel) {
  const label = `${runtime.t("level")} ${rawLevel}`;
  return effectiveLevel === rawLevel
    ? label
    : `${label} → ${runtime.t("effectiveLevel")} ${effectiveLevel < 1000
      ? runtime.formatSmallDecimal(effectiveLevel)
      : runtime.formatUiNumber(effectiveLevel)}`;
}

function gainExpressionParts() {
  return Math.min(Math.floor(Math.sqrt(runtime.effectiveVertexCount())), 10);
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

expose("applyLanguage", () => applyLanguage, (value) => { applyLanguage = value; });
expose("syncFormControl", () => syncFormControl, (value) => { syncFormControl = value; });
expose("clearElement", () => clearElement, (value) => { clearElement = value; });
expose("updateSaveRecoveryUi", () => updateSaveRecoveryUi, (value) => { updateSaveRecoveryUi = value; });
expose("canSpendLog", () => canSpendLog, (value) => { canSpendLog = value; });
expose("canSpend", () => canSpend, (value) => { canSpend = value; });
expose("formatVertexGainIncrease", () => formatVertexGainIncrease, (value) => { formatVertexGainIncrease = value; });
expose("updateTimelineUi", () => updateTimelineUi);
expose("selectTimelineNode", () => selectTimelineNode);
expose("prestigeActionKind", () => prestigeActionKind);
expose("canRunPrestigeAction", () => canRunPrestigeAction);
expose("updatePrestigeActionUi", () => updatePrestigeActionUi);
expose("runPrestigeAction", () => runPrestigeAction);
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
