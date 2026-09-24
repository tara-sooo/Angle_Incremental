import { runtime, expose } from "../runtime/shared.js";
import { bindDoubleActivation } from "./node-activation.js?v=0.14.0";

let selectedTimelineNodeId = "";

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

function timelineNodePrerequisiteText(prerequisites, mode) {
  if (mode === "any" && prerequisites.length > 0) {
    const era = runtime.timelineNode?.(prerequisites[0])?.era;
    if (era) return runtime.t("timelineNodeAnyPrerequisite").replace("{era}", era);
  }
  return prerequisites.join(mode === "any" ? " or " : ", ");
}

function timelineNodeStatusText(availability) {
  switch (availability.reason) {
    case "owned":
      return runtime.t("timelineNodePurchased");
    case "timeline-locked":
      return runtime.t("timelineNodeLocked");
    case "missing-prerequisites":
      if (availability.node?.prerequisiteMode === "any") return runtime.t("timelineNodeMissingAnyPrerequisite");
      return runtime.t("timelineNodeMissingPrerequisites").replace(
        "{nodes}",
        timelineNodePrerequisiteText(availability.missingPrerequisites, availability.node?.prerequisiteMode),
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

function timelineNodeCurrentEffectText(node) {
  if (node.id === "Real-BC16500") {
    return runtime.t("timelineRealCurrentEffect")
      .replace("{multiplier}", runtime.formatMultiplierLog(
        runtime.log10Value(runtime.timelineRealInfinityCountGainMultiplier?.() ?? 1),
      ));
  }
  if (node.id === "Parallel-BC16500") {
    const effectiveLog10 = runtime.timelineParallelEffectiveLog10?.() ?? 0;
    return runtime.t("timelineParallelCurrentEffect")
      .replace("{multiplier}", runtime.formatMultiplierLog(effectiveLog10))
      .replace("{time}", runtime.formatLongDuration(runtime.timelineParallelSecondsSinceIc8Clear?.() ?? 0));
  }
  return "";
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
  bindDoubleActivation(card, {
    id: node.id,
    onActivate: (id) => runtime.selectTimelineNode?.(id),
    onDoubleActivate: (id) => runtime.purchaseTimelineNode?.(id),
  });

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

function createTimelineConnector(type, era, nodes = []) {
  const connector = document.createElement("div");
  connector.className = "timeline-connector timeline-era-" + type;
  connector.dataset.timelineConnector = type;
  connector.dataset.timelineEra = era;
  connector.setAttribute("aria-hidden", "true");
  nodes.forEach((node) => {
    const branch = document.createElement("span");
    branch.className = "timeline-connector-branch";
    branch.dataset.timelineConnectorNode = node.id;
    branch.dataset.route = node.route || "";
    connector.append(branch);
  });
  return connector;
}

function updateTimelineConnectorState(nodes) {
  const host = runtime.elements.timelineNodeGrid;
  if (!host) return;
  const purchasedIds = new Set(
    Array.isArray(runtime.state?.timelinePurchasedNodes)
      ? runtime.state.timelinePurchasedNodes.map((entry) => entry?.id).filter(Boolean)
      : [],
  );
  host.querySelectorAll(".timeline-connector-branch").forEach((branch) => {
    branch.classList.toggle("is-owned", purchasedIds.has(branch.dataset.timelineConnectorNode));
  });
  host.querySelectorAll(".timeline-era-bridge").forEach((bridge) => {
    const nextEra = bridge.dataset.toEra;
    bridge.classList.toggle(
      "is-owned",
      nodes.some((node) => node.era === nextEra && purchasedIds.has(node.id)),
    );
  });
}

function renderTimelineNodeTree(nodes) {
  const host = runtime.elements.timelineNodeGrid;
  if (!host) return;
  const signature = nodes.map((node) => `${node.id}:${node.era}:${node.route}`).join("|");
  if (host.dataset.timelineSignature !== signature) {
    runtime.clearElement(host);
    const eras = new Map();
    nodes.forEach((node) => {
      if (!eras.has(node.era)) eras.set(node.era, []);
      eras.get(node.era).push(node);
    });
    const eraEntries = Array.from(eras.entries());
    eraEntries.forEach(([era, eraNodes], index) => {
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
      eraSection.append(
        eraHeading,
        createTimelineConnector("split", era, eraNodes),
        grid,
        createTimelineConnector("merge", era, eraNodes),
      );
      host.append(eraSection);
      if (index < eraEntries.length - 1) {
        const bridge = createTimelineConnector("bridge", era);
        bridge.dataset.fromEra = era;
        bridge.dataset.toEra = eraEntries[index + 1][0];
        host.append(bridge);
      }
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
  if (runtime.elements.timelineNodeDetailCurrentEffect) {
    const currentEffect = runtime.elements.timelineNodeDetailCurrentEffect;
    const owned = availability.reason === "owned";
    currentEffect.hidden = !owned;
    currentEffect.textContent = owned ? timelineNodeCurrentEffectText(node) : "";
  }
  if (runtime.elements.timelineNodeDetailPrerequisites) runtime.elements.timelineNodeDetailPrerequisites.textContent = prerequisites.length > 0
    ? timelineNodePrerequisiteText(prerequisites, node.prerequisiteMode)
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
  updateTimelineConnectorState(nodes);
  updateTimelineNodeDetail(
    selectedNode,
    selectedNode ? runtime.timelineNodeAvailability(selectedNode.id) : null,
  );
}

export function updateTimelineUi() {
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
      requirementText: `${runtime.formatUiLogNumber(runtime.timelineScoreRequirementLog10())} ${runtime.t("timelineScoreTrack")}`,
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

expose("updateTimelineUi", () => updateTimelineUi);
expose("selectTimelineNode", () => selectTimelineNode);
