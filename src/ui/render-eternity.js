import { runtime, expose } from "../runtime/shared.js";
import "../data/eternity-i18n.js?v=0.12.0";

const FIRST_TIER_IDS = Object.freeze(["1-1", "1-2", "1-3"]);
const MILESTONES = Object.freeze([
  Object.freeze({ id: "1-1", count: 1, nameKey: "eternityMilestone11Name", effectKey: "eternityMilestone11Effect", choice: true }),
  Object.freeze({ id: "1-2", count: 1, nameKey: "eternityMilestone12Name", effectKey: "eternityMilestone12Effect", choice: true }),
  Object.freeze({ id: "1-3", count: 1, nameKey: "eternityMilestone13Name", effectKey: "eternityMilestone13Effect", choice: true }),
  Object.freeze({ id: "2", count: 5, nameKey: "eternityMilestone2Name", effectKey: "eternityMilestone2Effect", choice: false }),
  Object.freeze({ id: "3", count: 8, nameKey: "eternityMilestone3Name", effectKey: "eternityMilestone3Effect", choice: false }),
  Object.freeze({ id: "4", count: 12, nameKey: "eternityMilestone4Name", effectKey: "eternityMilestone4Effect", choice: false }),
  Object.freeze({ id: "5", count: 20, nameKey: "eternityMilestone5Name", effectKey: "eternityMilestone5Effect", choice: false }),
  Object.freeze({ id: "6", count: 27, nameKey: "eternityMilestone6Name", effectKey: "eternityMilestone6Effect", choice: false }),
  Object.freeze({ id: "7", count: 44, nameKey: "eternityMilestone7Name", effectKey: "eternityMilestone7Effect", choice: false }),
]);

let eternityRoot = null;
let eternityTab = null;
let wrappedUpdateUi = false;

function installEternityStyles() {
  if (document.getElementById("eternityUiStyles")) return;
  const link = document.createElement("link");
  link.id = "eternityUiStyles";
  link.rel = "stylesheet";
  link.href = new URL("./eternity-ui.css?v=0.12.0", import.meta.url).href;
  document.head.append(link);
}

function milestoneMarkup(milestone) {
  const choiceButton = milestone.choice
    ? `<button class="eternity-choice-button" type="button" data-eternity-choice="${milestone.id}"></button>`
    : "";
  return `
    <article class="eternity-milestone-card" data-eternity-milestone="${milestone.id}">
      <div class="eternity-milestone-head">
        <strong data-i18n="${milestone.nameKey}"></strong>
        <span class="eternity-milestone-status"></span>
      </div>
      <p class="eternity-milestone-effect" data-i18n="${milestone.effectKey}"></p>
      <div class="eternity-milestone-footer">
        <span class="eternity-milestone-requirement"></span>
        ${choiceButton}
      </div>
    </article>`;
}

function installEternityUi() {
  if (
    typeof document === "undefined"
    || typeof document.querySelector !== "function"
    || typeof document.querySelectorAll !== "function"
  ) return null;
  if (eternityRoot?.isConnected && eternityTab?.isConnected) return eternityRoot;

  const mainTabs = document.querySelector(".main-tabs");
  const mainPanels = document.querySelector(".main-panels");
  if (!mainTabs || !mainPanels) return null;

  installEternityStyles();

  document.querySelector(".infinity-subtabs")?.classList.remove("has-eternity");
  document.querySelector('[data-infinity-tab="eternity"]')?.remove();
  document.querySelector('[data-infinity-panel="eternity"]')?.remove();

  eternityTab = mainTabs.querySelector('[data-tab="eternity"]');
  if (!eternityTab) {
    eternityTab = document.createElement("button");
    eternityTab.className = "eternity-main-tab";
    eternityTab.type = "button";
    eternityTab.dataset.tab = "eternity";
    eternityTab.setAttribute("aria-selected", "false");
    eternityTab.innerHTML = '<span class="tab-icon">E</span><span class="tab-code">ETR</span><small data-i18n="eternityTab">Eternity</small>';
    const infinityTab = mainTabs.querySelector('[data-tab="infinity"]');
    if (infinityTab) infinityTab.after(eternityTab);
    else mainTabs.append(eternityTab);
  }

  eternityRoot = mainPanels.querySelector('[data-panel="eternity"]');
  if (!eternityRoot) {
    eternityRoot = document.createElement("section");
    eternityRoot.className = "main-panel eternity-page";
    eternityRoot.dataset.panel = "eternity";
    eternityRoot.setAttribute("aria-label", "Eternity");
    eternityRoot.innerHTML = `
      <header class="page-heading">
        <div>
          <p class="eyebrow">Eternity</p>
          <h1 data-i18n="eternity">Eternity</h1>
        </div>
      </header>
      <section class="eternity-surface">
        <div class="panel-heading">
          <span data-i18n="eternity">Eternity</span>
          <strong id="eternityHeadingCount">Eternity 0</strong>
        </div>
        <div class="eternity-panel">
          <section class="eternity-overview" aria-label="Eternity status">
            <div>
              <span data-i18n="eternityCountLabel"></span>
              <strong id="eternityCountValue">0</strong>
            </div>
            <div>
              <span data-i18n="eternityRequirementTc4"></span>
              <strong id="eternityTc4Requirement" class="eternity-requirement-status"></strong>
            </div>
            <div>
              <span data-i18n="eternityRequirementIp"></span>
              <strong id="eternityIpRequirement" class="eternity-requirement-status"></strong>
            </div>
            <div>
              <span data-i18n="eternityCurrentIp"></span>
              <strong id="eternityCurrentIp">0 IP</strong>
            </div>
            <div>
              <span data-i18n="eternityRequirement"></span>
              <strong id="eternityRequirementState"></strong>
            </div>
          </section>
          <div class="eternity-action-row">
            <p id="eternityForcedNote" class="eternity-forced-note" data-i18n="eternityForcedNotice"></p>
            <button id="eternityPerformButton" class="eternity-perform-button" type="button" data-eternity-action="perform"></button>
          </div>
          <section class="eternity-choice-panel" aria-label="First-tier Eternity Milestone choice">
            <h2 data-i18n="eternityFirstTierChoice"></h2>
            <p class="eternity-choice-hint" data-i18n="eternityFirstTierHint"></p>
            <p id="eternityChoiceEntitlement" class="eternity-choice-entitlement"></p>
            <p id="eternityChoiceAllOwned" class="eternity-choice-all-owned" data-i18n="eternityChoiceAllOwned" hidden></p>
          </section>
          <h2 class="eternity-milestones-heading" data-i18n="eternityMilestones"></h2>
          <section class="eternity-milestone-grid" aria-label="Eternity Milestones">
            ${MILESTONES.map(milestoneMarkup).join("")}
          </section>
        </div>
      </section>`;
    mainPanels.append(eternityRoot);
  }

  const existingMainTabs = Array.from(document.querySelectorAll(".main-tab"));
  if (!existingMainTabs.includes(eternityTab)) {
    const infinityIndex = existingMainTabs.findIndex((button) => button.dataset.tab === "infinity");
    existingMainTabs.splice(infinityIndex >= 0 ? infinityIndex + 1 : existingMainTabs.length, 0, eternityTab);
  }
  runtime.elements.mainTabs = existingMainTabs;
  runtime.elements.mainPanels = Array.from(document.querySelectorAll(".main-panel"));
  runtime.elements.infinitySubtabs = Array.from(document.querySelectorAll(".infinity-subtab"));
  runtime.elements.infinitySubpanels = Array.from(document.querySelectorAll(".infinity-subpanel"));
  runtime.elements.i18nNodes = Array.from(document.querySelectorAll("[data-i18n]"));

  if (!eternityRoot.dataset.choiceBound) {
    eternityRoot.dataset.choiceBound = "true";
    eternityRoot.addEventListener("click", (event) => {
      const performButton = event.target?.closest?.("[data-eternity-action=\"perform\"]");
      if (performButton && !performButton.disabled) {
        runtime.performEternity?.();
        return;
      }

      const button = event.target?.closest?.("[data-eternity-choice]");
      if (!button || button.disabled) return;
      const id = button.dataset.eternityChoice;
      if (!runtime.selectEternityMilestone?.(id)) return;
      runtime.saveGame?.("manual");
      runtime.updateUi?.();
    });
  }
  return eternityRoot;
}

function setRequirementState(element, met) {
  if (!element) return;
  element.textContent = runtime.t(met ? "eternityRequirementMet" : "eternityRequirementMissing");
  element.classList.toggle("is-met", met);
  element.classList.toggle("is-missing", !met);
}

function updateMilestoneCard(milestone, availableChoices) {
  const card = eternityRoot?.querySelector(`[data-eternity-milestone="${milestone.id}"]`);
  if (!card) return;
  const active = runtime.eternityMilestoneActive?.(milestone.id) === true;
  const available = milestone.choice && !active && availableChoices.has(milestone.id);
  const status = card.querySelector(".eternity-milestone-status");
  const requirement = card.querySelector(".eternity-milestone-requirement");
  const button = card.querySelector("[data-eternity-choice]");

  card.classList.toggle("is-owned", milestone.choice && active);
  card.classList.toggle("is-active", !milestone.choice && active);
  card.classList.toggle("is-available", available);
  status?.classList.toggle("is-owned", milestone.choice && active);
  status?.classList.toggle("is-active", !milestone.choice && active);
  status?.classList.toggle("is-available", available);
  status?.classList.toggle("is-locked", milestone.choice ? !active && !available : !active);

  if (status) {
    status.textContent = milestone.choice
      ? runtime.t(active
        ? "eternityMilestoneOwned"
        : available
          ? "eternityMilestoneAvailable"
          : "eternityMilestoneLocked")
      : runtime.t(active ? "eternityMilestoneActive" : "eternityMilestoneLocked");
  }
  if (requirement) {
    requirement.textContent = runtime.t("eternityCountRequirement").replace("{count}", String(milestone.count));
  }
  if (button) {
    button.disabled = active || !available;
    button.textContent = active
      ? runtime.t("eternityMilestoneOwned")
      : available
        ? runtime.t("eternityChoiceSelect")
        : runtime.t("eternityMilestoneLocked");
  }
}

function updateEternityUi() {
  if (!installEternityUi()) return;
  const count = Math.max(0, Math.floor(Number(runtime.state.eternityCount) || 0));
  const tc4Met = runtime.towerChallenge4CompletedForEternity?.() === true;
  const ipMet = runtime.eternityIpThresholdMet?.() === true;
  const ready = runtime.canEternity?.() === true;
  const entitlementCount = Math.max(0, Math.floor(Number(runtime.firstTierMilestoneEntitlementCount?.()) || 0));
  const availableChoices = new Set(runtime.availableEternityMilestoneChoices?.() || []);

  const headingCount = eternityRoot.querySelector("#eternityHeadingCount");
  const countValue = eternityRoot.querySelector("#eternityCountValue");
  const currentIp = eternityRoot.querySelector("#eternityCurrentIp");
  const requirementState = eternityRoot.querySelector("#eternityRequirementState");
  const forcedNote = eternityRoot.querySelector("#eternityForcedNote");
  const performButton = eternityRoot.querySelector("#eternityPerformButton");
  const entitlement = eternityRoot.querySelector("#eternityChoiceEntitlement");
  const allOwned = eternityRoot.querySelector("#eternityChoiceAllOwned");

  if (headingCount) headingCount.textContent = `Eternity ${runtime.formatUiNumber(count)}`;
  if (countValue) countValue.textContent = runtime.formatUiNumber(count);
  setRequirementState(eternityRoot.querySelector("#eternityTc4Requirement"), tc4Met);
  setRequirementState(eternityRoot.querySelector("#eternityIpRequirement"), ipMet);
  if (currentIp) currentIp.textContent = `${runtime.formatUiLogNumber(runtime.currentInfinityPointsLog10())} IP`;
  if (requirementState) {
    requirementState.textContent = runtime.t(ready ? "eternityRequirementReady" : "eternityRequirementWaiting");
    requirementState.classList.toggle("is-met", ready);
    requirementState.classList.toggle("is-missing", !ready);
  }
  forcedNote?.classList.toggle("is-ready", ready);
  if (performButton) {
    performButton.disabled = !ready;
    performButton.textContent = runtime.t(ready ? "eternityPerform" : "eternityPerformUnavailable");
  }
  if (entitlement) {
    entitlement.textContent = entitlementCount > 0
      ? runtime.t("eternityFirstTierEntitlementAvailable").replace("{count}", String(entitlementCount))
      : runtime.t("eternityFirstTierEntitlementNone");
    entitlement.classList.toggle("is-available", entitlementCount > 0);
  }

  MILESTONES.forEach((milestone) => updateMilestoneCard(milestone, availableChoices));
  if (allOwned) {
    allOwned.hidden = !FIRST_TIER_IDS.every((id) => runtime.eternityMilestoneActive?.(id) === true);
  }
}

function wrapUpdateUi() {
  if (wrappedUpdateUi || typeof runtime.updateUi !== "function") return;
  const baseUpdateUi = runtime.updateUi;
  runtime.updateUi = (...args) => {
    const result = baseUpdateUi(...args);
    updateEternityUi();
    return result;
  };
  wrappedUpdateUi = true;
}

installEternityUi();
wrapUpdateUi();

expose("installEternityUi", () => installEternityUi);
expose("updateEternityUi", () => updateEternityUi);
