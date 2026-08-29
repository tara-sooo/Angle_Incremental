import { runtime, expose } from "../runtime/shared.js";

const MAX_TIMELINE_COUNT = Number.MAX_SAFE_INTEGER;
const MAX_ETERNITY_REQUIREMENT_EXPONENT = 1024;
const TIMELINE_TRACK_IDS = Object.freeze(["score", "ip", "eternity"]);
const TIMELINE_TRACKS = Object.freeze({
  score: Object.freeze({
    stateKey: "scoreTfClaims",
    requirementLog10: (claims) => 20000 + 10000 * claims,
  }),
  ip: Object.freeze({
    stateKey: "ipTfClaims",
    requirementLog10: (claims) => 400 + 100 * claims,
  }),
  eternity: Object.freeze({
    stateKey: "eternityTfClaims",
  }),
});

function normalizeTimelineClaimCount(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(MAX_TIMELINE_COUNT, Math.floor(parsed));
}

function normalizeTimelineCost(value) {
  return normalizeTimelineClaimCount(value, 0);
}

function normalizeTimelinePurchasedNodes(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.reduce((nodes, entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return nodes;
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    if (!id || seen.has(id)) return nodes;
    seen.add(id);
    nodes.push({ ...entry, id, costTF: normalizeTimelineCost(entry.costTF) });
    return nodes;
  }, []);
}

function normalizeTimelineState() {
  runtime.state.scoreTfClaims = normalizeTimelineClaimCount(runtime.state.scoreTfClaims);
  runtime.state.ipTfClaims = normalizeTimelineClaimCount(runtime.state.ipTfClaims);
  runtime.state.eternityTfClaims = normalizeTimelineClaimCount(runtime.state.eternityTfClaims);
  runtime.state.timelinePurchasedNodes = normalizeTimelinePurchasedNodes(runtime.state.timelinePurchasedNodes);
}

function normalizedEternityCount() {
  return Math.max(0, Math.floor(Number(runtime.state.eternityCount) || 0));
}

function timelineDiscovered() {
  return normalizedEternityCount() > 0
    || runtime.normalizeUnlockedMainTabs?.(runtime.state.unlockedMainTabs)?.includes("timeline") === true;
}

function timelineTrackClaimCount(trackId) {
  normalizeTimelineState();
  const track = TIMELINE_TRACKS[trackId];
  return track ? runtime.state[track.stateKey] : 0;
}

function timelineScoreRequirementLog10() {
  return TIMELINE_TRACKS.score.requirementLog10(timelineTrackClaimCount("score"));
}

function timelineIpRequirementLog10() {
  return TIMELINE_TRACKS.ip.requirementLog10(timelineTrackClaimCount("ip"));
}

function timelineEternityRequirement() {
  const exponent = timelineTrackClaimCount("eternity") + 1;
  return exponent <= MAX_ETERNITY_REQUIREMENT_EXPONENT ? 2n ** BigInt(exponent) : null;
}

function timelineCurrentValue(trackId) {
  if (trackId === "score") return runtime.currentScoreLog10?.() ?? Number(runtime.state.scoreLog10);
  if (trackId === "ip") return runtime.currentInfinityPointsLog10?.() ?? Number(runtime.state.infinityPointsLog10);
  if (trackId === "eternity") return BigInt(normalizedEternityCount());
  return null;
}

function timelineRequirementMet(trackId) {
  if (!timelineDiscovered()) return false;
  if (trackId === "score") return timelineCurrentValue(trackId) >= timelineScoreRequirementLog10();
  if (trackId === "ip") return timelineCurrentValue(trackId) >= timelineIpRequirementLog10();
  if (trackId === "eternity") {
    const requirement = timelineEternityRequirement();
    return requirement !== null && timelineCurrentValue(trackId) >= requirement;
  }
  return false;
}

function timelineEarnedTf() {
  normalizeTimelineState();
  return Math.min(
    MAX_TIMELINE_COUNT,
    runtime.state.scoreTfClaims + runtime.state.ipTfClaims + runtime.state.eternityTfClaims,
  );
}

function timelineSpentTf() {
  normalizeTimelineState();
  return Math.min(
    MAX_TIMELINE_COUNT,
    runtime.state.timelinePurchasedNodes.reduce((total, node) => (
      Math.min(MAX_TIMELINE_COUNT, total + normalizeTimelineCost(node.costTF))
    ), 0),
  );
}

function timelineAvailableTf() {
  return Math.max(0, timelineEarnedTf() - timelineSpentTf());
}

function canClaimTimelineTf(trackId) {
  return Boolean(TIMELINE_TRACKS[trackId]) && timelineRequirementMet(trackId);
}

function claimTimelineTf(trackId, options = {}) {
  if (!canClaimTimelineTf(trackId)) return false;
  const track = TIMELINE_TRACKS[trackId];
  runtime.state[track.stateKey] = Math.min(
    MAX_TIMELINE_COUNT,
    timelineTrackClaimCount(trackId) + 1,
  );
  if (options.update !== false) runtime.updateUi?.();
  if (options.save !== false) runtime.saveGame?.("manual");
  return true;
}

function claimScoreTf(options = {}) {
  return claimTimelineTf("score", options);
}

function claimIpTf(options = {}) {
  return claimTimelineTf("ip", options);
}

function claimEternityTf(options = {}) {
  return claimTimelineTf("eternity", options);
}

function respecTimeline(options = {}) {
  if (!timelineDiscovered() || typeof runtime.resetEternityProgression !== "function") return false;
  if (runtime.createCheckpoint && !runtime.createCheckpoint("pre-timeline-respec", { force: true })) return false;
  runtime.state.timelinePurchasedNodes = [];
  runtime.resetEternityProgression();
  runtime.applyEternityRunStartState?.();
  if (options.update !== false) runtime.updateUi?.();
  if (options.save !== false) runtime.saveGame?.("manual");
  return true;
}

expose("TIMELINE_TRACK_IDS", () => TIMELINE_TRACK_IDS);
expose("normalizeTimelineClaimCount", () => normalizeTimelineClaimCount);
expose("normalizeTimelinePurchasedNodes", () => normalizeTimelinePurchasedNodes);
expose("normalizeTimelineState", () => normalizeTimelineState);
expose("timelineDiscovered", () => timelineDiscovered);
expose("timelineTrackClaimCount", () => timelineTrackClaimCount);
expose("timelineScoreRequirementLog10", () => timelineScoreRequirementLog10);
expose("timelineIpRequirementLog10", () => timelineIpRequirementLog10);
expose("timelineEternityRequirement", () => timelineEternityRequirement);
expose("timelineRequirementMet", () => timelineRequirementMet);
expose("timelineEarnedTf", () => timelineEarnedTf);
expose("timelineSpentTf", () => timelineSpentTf);
expose("timelineAvailableTf", () => timelineAvailableTf);
expose("canClaimTimelineTf", () => canClaimTimelineTf);
expose("claimTimelineTf", () => claimTimelineTf);
expose("claimScoreTf", () => claimScoreTf);
expose("claimIpTf", () => claimIpTf);
expose("claimEternityTf", () => claimEternityTf);
expose("respecTimeline", () => respecTimeline);
