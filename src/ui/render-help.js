import { runtime, expose } from "../runtime/shared.js";

const HELP_TOPICS = Object.freeze([
  {
    id: "angle",
    titleKey: "helpTopicAngle",
    bodyKey: "helpBodyAngle",
    visible: () => true,
  },
  {
    id: "generation",
    titleKey: "helpTopicGeneration",
    bodyKey: "helpBodyGeneration",
    visible: () => true,
  },
  {
    id: "core-boost",
    titleKey: "helpTopicCoreBoost",
    bodyKey: "helpBodyCoreBoost",
    visible: () => hasGenerationDiscovery() || hasInfinityDiscovery(),
  },
  {
    id: "infinity",
    titleKey: "helpTopicInfinity",
    bodyKey: "helpBodyInfinity",
    visible: () => hasInfinityDiscovery(),
  },
  {
    id: "infinity-upgrades",
    titleKey: "helpTopicInfinityUpgrades",
    bodyKey: "helpBodyInfinityUpgrades",
    visible: () => hasInfinityDiscovery(),
  },
  {
    id: "infinity-challenges",
    titleKey: "helpTopicInfinityChallenges",
    bodyKey: "helpBodyInfinityChallenges",
    visible: () => hasInfinityChallengeDiscovery(),
  },
  {
    id: "break-cap",
    titleKey: "helpTopicBreakCap",
    bodyKey: "helpBodyBreakCap",
    visible: () => hasInfinityDiscovery(),
  },
  {
    id: "infinite-angle",
    titleKey: "helpTopicInfiniteAngle",
    bodyKey: "helpBodyInfiniteAngle",
    visible: () => hasInfinityDiscovery(),
  },
  {
    id: "tower",
    titleKey: "helpTopicTower",
    bodyKey: "helpBodyTower",
    visible: () => hasInfinityDiscovery() || positiveStateValue("towerFloor"),
  },
  {
    id: "tower-challenges",
    titleKey: "helpTopicTowerChallenges",
    bodyKey: "helpBodyTowerChallenges",
    visible: () => positiveStateValue("eternityCount")
      || Number(runtime.state?.towerFloor) >= 3
      || Number(runtime.state?.completedTowerChallenges) !== 0,
  },
  {
    id: "eternity",
    titleKey: "helpTopicEternity",
    bodyKey: "helpBodyEternity",
    visible: () => positiveStateValue("eternityCount") || hasDiscoveredMainTab("eternity"),
  },
  {
    id: "eternity-milestones",
    titleKey: "helpTopicEternityMilestones",
    bodyKey: "helpBodyEternityMilestones",
    visible: () => positiveStateValue("eternityCount")
      || Number(runtime.state?.eternityMilestoneMask) !== 0,
  },
  {
    id: "timeline",
    titleKey: "helpTopicTimeline",
    bodyKey: "helpBodyTimeline",
    visible: () => runtime.timelineDiscovered?.() === true,
  },
  {
    id: "resets",
    titleKey: "helpTopicResets",
    bodyKey: "helpBodyResets",
    visible: () => true,
  },
  {
    id: "automation",
    titleKey: "helpTopicAutomation",
    bodyKey: "helpBodyAutomation",
    visible: () => positiveStateValue("eternityCount")
      || runtime.normalAutomationUnlocked?.() === true
      || runtime.state?.automationEnabled === true
      || hasDiscoveredMainTab("automation"),
  },
  {
    id: "offline",
    titleKey: "helpTopicOffline",
    bodyKey: "helpBodyOffline",
    visible: () => true,
  },
  {
    id: "notation",
    titleKey: "helpTopicNotation",
    bodyKey: "helpBodyNotation",
    visible: () => true,
  },
]);

let renderedSignature = "";

function positiveStateValue(key) {
  return Number(runtime.state?.[key]) > 0;
}

function hasDiscoveredMainTab(tab) {
  const unlocked = runtime.normalizeUnlockedMainTabs?.(runtime.state?.unlockedMainTabs);
  return Array.isArray(unlocked) && unlocked.includes(tab);
}

function hasGenerationDiscovery() {
  return positiveStateValue("generationCount")
    || positiveStateValue("coreBoostCount")
    || positiveStateValue("infinityCount")
    || positiveStateValue("eternityCount");
}

function hasInfinityDiscovery() {
  return positiveStateValue("infinityCount")
    || positiveStateValue("eternityCount")
    || hasDiscoveredMainTab("infinity");
}

function hasInfinityChallengeDiscovery() {
  return positiveStateValue("eternityCount")
    || runtime.infinityChallengesUnlocked?.() === true
    || positiveStateValue("activeChallenge")
    || Number(runtime.state?.completedChallenges) !== 0
    || Array.isArray(runtime.state?.fastestInfinityChallengeTimes)
      && runtime.state.fastestInfinityChallengeTimes.some((time) => Number(time) > 0);
}

function activeContextTopicId() {
  const activeMainTab = runtime.activeMainTab === "help"
    ? runtime.helpContextMainTab || "angle"
    : runtime.activeMainTab;
  if (activeMainTab === "infinity") {
    if (runtime.activeInfinitySubtab === "angle") return "infinite-angle";
    if (runtime.activeInfinitySubtab === "tower") return "tower";
    return "infinity-upgrades";
  }
  if (activeMainTab === "challenges") {
    return runtime.activeChallengeSubtab === "tc" ? "tower-challenges" : "infinity-challenges";
  }
  if (activeMainTab === "eternity") {
    return runtime.activeEternitySubtab === "timeline" ? "timeline" : "eternity-milestones";
  }
  if (activeMainTab === "automation") return "automation";
  if (activeMainTab === "settings") return "notation";
  if (activeMainTab === "statistics" || activeMainTab === "achievements") return "resets";
  return activeMainTab === "generation" ? "generation" : "angle";
}

function clearElement(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}

function updateHelpUi() {
  const nav = runtime.elements.helpNav;
  const sections = runtime.elements.helpSections;
  if (!nav || !sections) return false;

  const topics = HELP_TOPICS.filter((topic) => topic.visible());
  const topicIds = topics.map((topic) => topic.id);
  const contextCandidate = activeContextTopicId();
  const contextTopic = topics.find((topic) => topic.id === contextCandidate) || topics[0] || null;
  const contextId = contextTopic?.id || "";
  const signature = [
    runtime.state.language,
    topicIds.join(","),
    contextId,
  ].join("|");
  if (signature === renderedSignature) return false;

  const openIds = new Set(
    Array.from(sections.querySelectorAll("details[open]"), (section) => section.dataset.helpTopic),
  );
  clearElement(nav);
  clearElement(sections);
  nav.setAttribute("aria-label", runtime.t("helpTopics"));

  topics.forEach((topic) => {
    const anchor = "help-" + topic.id;
    const section = document.createElement("details");
    section.className = "help-section";
    section.id = anchor;
    section.dataset.helpTopic = topic.id;
    section.open = openIds.has(topic.id) || topic.id === contextId;

    const summary = document.createElement("summary");
    summary.className = "help-section-summary";
    summary.textContent = runtime.t(topic.titleKey);
    section.append(summary);

    const body = document.createElement("p");
    body.className = "help-section-body";
    body.textContent = runtime.t(topic.bodyKey);
    section.append(body);

    const link = document.createElement("a");
    link.className = "help-nav-link";
    link.href = "#" + anchor;
    link.textContent = runtime.t(topic.titleKey);
    link.setAttribute("aria-controls", anchor);
    if (topic.id === contextId) link.setAttribute("aria-current", "location");
    link.addEventListener("click", () => {
      section.open = true;
    });

    nav.append(link);
    sections.append(section);
  });

  if (runtime.elements.helpContext) {
    runtime.elements.helpContext.textContent = contextTopic
      ? runtime.t("helpContext").replace("{topic}", runtime.t(contextTopic.titleKey))
      : "";
  }
  renderedSignature = signature;
  return true;
}

expose("updateHelpUi", () => updateHelpUi, (value) => { updateHelpUi = value; });
