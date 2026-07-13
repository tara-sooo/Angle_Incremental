import { runtime, expose } from "../runtime/shared.js";

function balanceCreateInfinityUpgradeRows() {
  runtime.clearElement(runtime.elements.infinityUpgradeTree);
  const tiers = [
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

expose("balanceCreateInfinityUpgradeRows", () => balanceCreateInfinityUpgradeRows);
