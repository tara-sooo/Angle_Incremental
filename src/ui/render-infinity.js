import { runtime, expose } from "../runtime/shared.js";

let lastInfinityUpgradeSignature = null;

function createInfinityUpgradeRows() {
  lastInfinityUpgradeSignature = null;
  runtime.clearElement(runtime.elements.infinityUpgradeTree);
  const upgradeRows = [
    ["1-1", "1-2"],
    ["2-1"],
    ["3-1", "3-2"],
    ["4-1"],
    ["5-1", "5-2"],
    ["6-1", "6-2"],
    ["7-1", "7-2"],
    ["8-1"],
    ["9-1"],
    ["10-1", "10-2"],
    ["11-1", "11-2"],
    ["12-1"],
    ["13-1"],
  ];

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
      button.addEventListener("click", () => runtime.selectInfinityUpgrade(upgrade.id));
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
  const signature = [
    runtime.state.infinityUpgradeMask,
    runtime.state.infinityPointsExact,
    runtime.state.infinityPointsLog10,
    runtime.state.infinityCount,
    runtime.state.language,
    runtime.state.numberFormat,
    runtime.selectedInfinityUpgradeId,
  ].join("|");
  if (signature === lastInfinityUpgradeSignature) return;
  lastInfinityUpgradeSignature = signature;
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

expose("createInfinityUpgradeRows", () => createInfinityUpgradeRows, (value) => { createInfinityUpgradeRows = value; });
expose("selectInfinityUpgrade", () => selectInfinityUpgrade);
expose("infinityUpgradeStateText", () => infinityUpgradeStateText);
expose("updateInfinityUpgradeDetail", () => updateInfinityUpgradeDetail);
expose("updateInfinityUpgradeRows", () => updateInfinityUpgradeRows);
expose("buySelectedInfinityUpgrade", () => buySelectedInfinityUpgrade);
