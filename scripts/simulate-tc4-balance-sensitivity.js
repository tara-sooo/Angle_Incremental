const fs = require("node:fs");
const path = require("node:path");
const {
  RESET_POLICIES,
  TC4_SCORE_MILESTONES,
  candidateRanking,
  comparePolicyProgress,
  nextSearchRecommendation,
  runCandidate,
  summarizeCandidate,
} = require("./simulate-tc4-balance.js");

const ISSUE = 119;
const EVALUATED_POLICY_IDS = ["fixed-60", "gain-aware-2x", "threshold-aware"];
const STAGE_1_OPTIONS = Object.freeze({
  maxSeconds: 14_400,
  stepSeconds: 10,
  maxStates: 20,
  maxRoutes: 10,
  stallSeconds: 14_400,
  policyIds: EVALUATED_POLICY_IDS,
  searchComplete: true,
});
const STAGE_2_OPTIONS = Object.freeze({ ...STAGE_1_OPTIONS, maxSeconds: 43_200 });
const STAGE_3_OPTIONS = Object.freeze({ ...STAGE_1_OPTIONS, maxSeconds: 86_400 });
const PROBES = Object.freeze([
  { id: "A0.25-B0.35-C1", a: 0.25, b: 0.35, c: 1, axis: "baseline", reason: "strongest #117 candidate" },
  { id: "A0.30-B0.35-C1", a: 0.30, b: 0.35, c: 1, axis: "A-only", reason: "small A increase" },
  { id: "A0.40-B0.35-C1", a: 0.40, b: 0.35, c: 1, axis: "A-only", reason: "larger A increase" },
  { id: "A0.25-B0.80-C1", a: 0.25, b: 0.80, c: 1, axis: "B-only", reason: "small B increase beyond the resolved region" },
  { id: "A0.25-B1.00-C1", a: 0.25, b: 1.00, c: 1, axis: "B-only", reason: "larger B increase beyond the resolved region" },
  { id: "A0.30-B0.80-C1", a: 0.30, b: 0.80, c: 1, axis: "A+B", reason: "moderate combined increase" },
  { id: "A0.40-B1.00-C1", a: 0.40, b: 1.00, c: 1, axis: "A+B", reason: "larger combined increase" },
  { id: "A0.25-B0.35-C2", a: 0.25, b: 0.35, c: 2, axis: "C-strength", reason: "research-only free-CB strength probe" },
]);
const BASELINE_ID = PROBES[0].id;

function stageOptions(overrides, defaults) {
  return { ...defaults, ...(overrides ?? {}), policyIds: [...(overrides?.policyIds ?? defaults.policyIds)] };
}

function attachStage(summary, stage, reasons = []) {
  return { ...summary, evidenceStage: stage, promotionReasons: [...reasons] };
}

function truncatedSummary(summary) {
  return summary.searchComplete === false
    || summary.classification === "inconclusive"
    || summary.policyComparisons.some(({ canonical, allLegal }) => canonical.truncated || allLegal.truncated);
}

function commonMilestoneDelta(candidate, baseline) {
  const candidateAdaptive = candidate.bestAdaptive;
  const baselineAdaptive = baseline.bestAdaptive;
  if (!candidateAdaptive || !baselineAdaptive) return null;
  const index = Math.min(candidateAdaptive.highestMilestoneIndex, baselineAdaptive.highestMilestoneIndex);
  if (index < 0) return null;
  const milestone = TC4_SCORE_MILESTONES[index];
  const key = `e${milestone}`;
  const candidateTime = candidateAdaptive.firstMilestoneTimes?.[key];
  const baselineTime = baselineAdaptive.firstMilestoneTimes?.[key];
  if (!Number.isFinite(candidateTime) || !Number.isFinite(baselineTime) || baselineTime <= 0) return null;
  return {
    milestone,
    candidateTimeSeconds: candidateTime,
    baselineTimeSeconds: baselineTime,
    deltaSeconds: candidateTime - baselineTime,
    gainRatio: (baselineTime - candidateTime) / baselineTime,
  };
}

function promotionReasons(summary, baseline) {
  const reasons = [];
  if (truncatedSummary(summary)) return ["stage-1-truncated-evidence"];
  if (!baseline?.bestAdaptive || !summary.bestAdaptive) return reasons;
  const milestoneDelta = summary.bestAdaptive.highestMilestoneIndex - baseline.bestAdaptive.highestMilestoneIndex;
  const peakDelta = summary.bestAdaptive.peakScoreLog10 - baseline.bestAdaptive.peakScoreLog10;
  const common = commonMilestoneDelta(summary, baseline);
  if (milestoneDelta >= 1) reasons.push("higher-milestone-than-strongest-117-baseline");
  if (peakDelta >= 1) reasons.push("peak-plus-1-log10-than-strongest-117-baseline");
  if ((common?.gainRatio ?? -Infinity) >= 0.1) reasons.push("10-percent-faster-common-milestone");
  return reasons;
}

function selectLeader(summaries) {
  return summaries.slice().sort((left, right) => {
    const progress = comparePolicyProgress(left.bestAdaptive, right.bestAdaptive);
    return progress !== 0 ? progress : left.candidateId.localeCompare(right.candidateId);
  })[0] ?? null;
}

function terminalPurchase(summary) {
  const routes = [...(summary.bestAdaptive?.canonical?.terminalAllocations ?? []), ...(summary.bestAdaptive?.allLegal?.terminalAllocations ?? [])];
  return routes.slice().sort((left, right) => (right.peakScoreLog10 ?? -Infinity) - (left.peakScoreLog10 ?? -Infinity))[0]?.lastPurchase ?? null;
}

function sensitivityRow(summary, baseline) {
  const candidate = summary.bestAdaptive;
  const reference = baseline.bestAdaptive;
  const common = commonMilestoneDelta(summary, baseline);
  const resetTimes = candidate?.canonical?.terminalAllocations?.flatMap((route) => route.infinityResetTimes ?? []) ?? [];
  const baselineResetTimes = reference?.canonical?.terminalAllocations?.flatMap((route) => route.infinityResetTimes ?? []) ?? [];
  return {
    candidateId: summary.candidateId,
    axis: summary.candidate.axis,
    evidenceStage: summary.evidenceStage,
    eligibleForRecommendation: summary.evidenceStage !== "stage-1" && !truncatedSummary(summary),
    truncated: truncatedSummary(summary),
    peakDeltaLog10: candidate && reference ? candidate.peakScoreLog10 - reference.peakScoreLog10 : null,
    highestMilestoneDelta: candidate && reference ? candidate.highestMilestoneIndex - reference.highestMilestoneIndex : null,
    highestMilestone: candidate?.highestMilestone ?? null,
    commonMilestone: common?.milestone ?? null,
    commonMilestoneTimeDeltaSeconds: common?.deltaSeconds ?? null,
    commonMilestoneTimeGainRatio: common?.gainRatio ?? null,
    resetCountDelta: candidate && reference ? candidate.infinityResetCount - reference.infinityResetCount : null,
    resetTimes,
    baselineResetTimes,
    terminalPurchase: terminalPurchase(summary),
  };
}

function buildSensitivityEvidence(summaries, baselineId = BASELINE_ID) {
  const baseline = summaries.find(({ candidateId }) => candidateId === baselineId);
  const rows = baseline ? summaries.map((summary) => sensitivityRow(summary, baseline)) : [];
  const groups = [...new Set(rows.map(({ axis }) => axis))]
    .filter((axis) => axis !== "baseline")
    .map((axis) => {
      const allGroupRows = rows.filter((row) => row.axis === axis);
      const groupRows = allGroupRows.filter((row) => row.eligibleForRecommendation);
      const best = groupRows.slice().sort((left, right) => {
        const milestone = (right.highestMilestoneDelta ?? -Infinity) - (left.highestMilestoneDelta ?? -Infinity);
        if (milestone !== 0) return milestone;
        const peak = (right.peakDeltaLog10 ?? -Infinity) - (left.peakDeltaLog10 ?? -Infinity);
        return peak !== 0 ? peak : left.candidateId.localeCompare(right.candidateId);
      })[0] ?? null;
      return {
        axis,
        candidateIds: allGroupRows.map(({ candidateId }) => candidateId),
        eligibleCandidateIds: groupRows.map(({ candidateId }) => candidateId),
        bestCandidateId: best?.candidateId ?? null,
        bestHighestMilestoneDelta: best?.highestMilestoneDelta ?? null,
        bestPeakDeltaLog10: best?.peakDeltaLog10 ?? null,
        bestTimeGainRatio: best?.commonMilestoneTimeGainRatio ?? null,
      };
    });
  return { baselineId, rows, groups };
}

function candidateFinalEntry(candidate, stage1, stage2, stage3, reasons) {
  const selected = stage3 ?? stage2 ?? stage1;
  return {
    ...selected,
    candidate,
    candidateId: candidate.id,
    axis: candidate.axis,
    probeReason: candidate.reason,
    classification: selected.classification,
    evidenceStage: selected.evidenceStage,
    promotionReasons: reasons,
    stage1,
    stage2,
    stage3,
  };
}

async function createSensitivityReport(overrides = {}) {
  const stage1Options = stageOptions(overrides.stage1, STAGE_1_OPTIONS);
  const stage2Options = stageOptions(overrides.stage2, STAGE_2_OPTIONS);
  const stage3Options = stageOptions(overrides.stage3, STAGE_3_OPTIONS);
  const stage1Raw = [];
  for (const candidate of PROBES) stage1Raw.push(await runCandidate(candidate, stage1Options));
  const stage1Summaries = stage1Raw.map(summarizeCandidate);
  const baselineStage1 = stage1Summaries.find(({ candidateId }) => candidateId === BASELINE_ID);
  const reasonsByCandidate = Object.fromEntries(stage1Summaries.map((summary) => [
    summary.candidateId,
    summary.candidateId === BASELINE_ID ? ["strongest-117-baseline"] : promotionReasons(summary, baselineStage1),
  ]));
  let promotedIds = stage1Summaries
    .filter(({ candidateId }) => candidateId !== BASELINE_ID)
    .filter((summary) => reasonsByCandidate[summary.candidateId].some((reason) => reason !== "stage-1-truncated-evidence"))
    .map(({ candidateId }) => candidateId);
  let fallbackPromotion = null;
  if (promotedIds.length === 0) {
    const leader = selectLeader(stage1Summaries.filter(({ candidateId }) => candidateId !== BASELINE_ID));
    if (leader) {
      promotedIds = [leader.candidateId];
      reasonsByCandidate[leader.candidateId] = ["stage-1-ranking-fallback"];
      fallbackPromotion = leader.candidateId;
    }
  }
  const stage2Raw = [];
  for (const candidate of PROBES.filter(({ id }) => promotedIds.includes(id))) stage2Raw.push(await runCandidate(candidate, stage2Options));
  const stage2Summaries = stage2Raw.map(summarizeCandidate);
  const finalist = selectLeader(stage2Summaries);
  const stage3Ids = [BASELINE_ID, ...(finalist && finalist.candidateId !== BASELINE_ID ? [finalist.candidateId] : [])];
  const stage3Raw = [];
  for (const candidate of PROBES.filter(({ id }) => stage3Ids.includes(id))) stage3Raw.push(await runCandidate(candidate, stage3Options));
  const stage3Summaries = stage3Raw.map(summarizeCandidate);
  const stage1ById = Object.fromEntries(stage1Summaries.map((summary) => [summary.candidateId, attachStage(summary, "stage-1", reasonsByCandidate[summary.candidateId])]));
  const stage2ById = Object.fromEntries(stage2Summaries.map((summary) => [summary.candidateId, attachStage(summary, "stage-2", reasonsByCandidate[summary.candidateId])]));
  const stage3ById = Object.fromEntries(stage3Summaries.map((summary) => [summary.candidateId, attachStage(summary, "stage-3", reasonsByCandidate[summary.candidateId])]));
  const candidates = PROBES.map((candidate) => candidateFinalEntry(candidate, stage1ById[candidate.id], stage2ById[candidate.id] ?? null, stage3ById[candidate.id] ?? null, reasonsByCandidate[candidate.id]));
  const finalSummaries = candidates.map(({ candidate, ...summary }) => ({ candidate, ...summary }));
  const baseline = finalSummaries.find(({ candidateId }) => candidateId === BASELINE_ID);
  const sensitivity = buildSensitivityEvidence(finalSummaries);
  const ranking = candidateRanking(finalSummaries);
  const recommendation = nextSearchRecommendation(finalSummaries, { allowInconclusive: true, marginalEvidence: sensitivity });
  return {
    issue: ISSUE,
    title: "Probe TC4 balance sensitivity beyond the resolved 3x3 region",
    researchOnly: true,
    sourceIssues: [95, 98, 117],
    relationshipToIssue98: "Issue #98 remains status:needs-decision; this report selects no production constants or semantics.",
    targetLog10: 7777,
    scoreMilestones: TC4_SCORE_MILESTONES,
    evaluatedResetPolicies: EVALUATED_POLICY_IDS,
    resetPolicies: RESET_POLICIES,
    probeDesign: PROBES,
    baseline: {
      candidateId: BASELINE_ID,
      source: "strongest #117 candidate A0.25-B0.35-C1",
      reference: { report: "reports/tc4-balance-followup.json", peakScoreLog10: 1813.5620182364562, highestMilestone: 1700 },
      summary: baseline,
      reproducedAtStage: baseline?.evidenceStage ?? null,
      reproduction: {
        peakDeltaLog10: baseline?.bestAdaptive ? baseline.bestAdaptive.peakScoreLog10 - 1813.5620182364562 : null,
        highestMilestoneMatches: baseline?.bestAdaptive?.highestMilestone === 1700,
      },
    },
    promotionRule: {
      criteria: [
        "Stage 1 truncation is promoted as uncertainty evidence, not a performance win",
        "one additional milestone versus the strongest #117 adaptive baseline",
        "at least +1 log10 peak Score versus the strongest #117 adaptive baseline",
        "at least 10% faster to the highest common milestone",
      ],
      fallback: "If no non-baseline candidate qualifies, promote the deterministic Stage 1 leader.",
      ranking: "highest milestone, highest peak Score, earliest common-milestone time, fewer Infinity resets, then candidate ID",
    },
    stages: {
      stage1: { options: stage1Options, candidates: stage1Summaries.map(({ candidateId }) => stage1ById[candidateId]) },
      stage2: { options: stage2Options, promotedCandidateIds: promotedIds, fallbackPromotion, candidates: stage2Summaries.map(({ candidateId }) => stage2ById[candidateId]) },
      stage3: { options: stage3Options, candidateIds: stage3Ids, candidates: stage3Summaries.map(({ candidateId }) => stage3ById[candidateId]) },
    },
    candidates,
    ranking,
    sensitivity,
    recommendation,
    anyReachedE2500: candidates.some(({ bestAdaptive }) => bestAdaptive?.highestMilestone >= 2500),
    anyReachedE7777: candidates.some(({ classification }) => classification === "viable"),
    uncertainty: [
      "Stage 1 truncation is retained explicitly and is not treated as a failed balance verdict.",
      "The probes identify measured sensitivity only; they do not establish monotonicity or production C semantics.",
    ],
    noProductionChanges: true,
  };
}

function formatSeconds(seconds) {
  if (!Number.isFinite(seconds)) return "not reached";
  if (seconds < 3600) return `${Math.round(seconds)}s`;
  return `${(seconds / 3600).toFixed(2)}h`;
}

function formatPeak(value) {
  return Number.isFinite(value) ? `e${value.toFixed(0)}` : "not reached";
}

function formatMarkdown(report) {
  const lines = [
    "# TC4 Balance Sensitivity Probe (Issue #119)",
    "",
    "> Research output only. No production TC4 constants/formulas or #98 decision state are changed.",
    "",
    `- Target: **1e${report.targetLog10} Score**`,
    `- Probes: **${report.probeDesign.length}** (the resolved #117 3x3 is not rerun)`,
    `- Policies: **${report.evaluatedResetPolicies.join(", ")}**`,
    "",
    "## Search stages",
    "",
    "| Stage | Horizon | States | Routes | Stall bound | Candidates |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const [name, stage] of Object.entries(report.stages)) {
    const candidates = stage.candidates?.length ?? stage.candidateIds?.length ?? 0;
    lines.push(`| ${name} | ${formatSeconds(stage.options.maxSeconds)} | ${stage.options.maxStates} | ${stage.options.maxRoutes} | ${formatSeconds(stage.options.stallSeconds)} | ${candidates} |`);
  }
  lines.push(
    "",
    "## Baseline reproduction",
    "",
    `- Reference: **${report.baseline.reference.peakScoreLog10.toFixed(3)} log10 peak / e${report.baseline.reference.highestMilestone} milestone** (${report.baseline.reference.report})`,
    `- Observed: **${formatPeak(report.baseline.summary.bestAdaptive?.peakScoreLog10)} peak / e${report.baseline.summary.bestAdaptive?.highestMilestone ?? "—"} milestone** at **${report.baseline.reproducedAtStage}**`,
    `- Peak delta: **${report.baseline.reproduction.peakDeltaLog10?.toFixed(3) ?? "—"} log10**; milestone match: **${report.baseline.reproduction.highestMilestoneMatches ? "yes" : "no"}**`,
    "",
    "## Probe results",
    "",
    "| Candidate | Axis | Stage | Classification | Best policy | Highest milestone | Peak Score | Promotion |",
    "| --- | --- | --- | --- | --- | ---: | ---: | --- |",
  );
  for (const candidate of report.candidates) lines.push(`| ${candidate.candidateId} | ${candidate.axis} | ${candidate.evidenceStage} | ${candidate.classification} | ${candidate.bestAdaptivePolicy ?? "—"} | ${candidate.bestAdaptive?.highestMilestone ?? "—"} | ${formatPeak(candidate.bestAdaptive?.peakScoreLog10)} | ${candidate.promotionReasons.join(", ") || "not promoted"} |`);
  lines.push("", "## Deltas versus strongest #117 baseline", "", "| Candidate | Axis | Δ peak log10 | Δ milestone | Common milestone | Δ common time | Δ resets | Reset timing | Terminal purchase |", "| --- | --- | ---: | ---: | --- | ---: | ---: | --- | --- |");
  for (const row of report.sensitivity.rows) lines.push(`| ${row.candidateId} | ${row.axis} | ${row.peakDeltaLog10?.toFixed(3) ?? "—"} | ${row.highestMilestoneDelta ?? "—"} | ${row.commonMilestone ?? "—"} | ${row.commonMilestoneTimeDeltaSeconds === null ? "—" : `${row.commonMilestoneTimeDeltaSeconds.toFixed(0)}s`} | ${row.resetCountDelta ?? "—"} | ${row.resetTimes.join(", ") || "none"} / ${row.baselineResetTimes.join(", ") || "none"} | ${row.terminalPurchase ? `${row.terminalPurchase.kind}@e${row.terminalPurchase.priceLog10}` : "none"} |`);
  lines.push("", "## Marginal evidence", "", "| Axis | Observed candidates | Eligible candidates | Best candidate | Δ milestone | Δ peak log10 | Best time gain |", "| --- | --- | --- | ---: | ---: | ---: | ---: |");
  for (const group of report.sensitivity.groups) lines.push(`| ${group.axis} | ${group.candidateIds.join(", ") || "none"} | ${group.eligibleCandidateIds.join(", ") || "none"} | ${group.bestCandidateId ?? "—"} | ${group.bestHighestMilestoneDelta ?? "—"} | ${group.bestPeakDeltaLog10?.toFixed(3) ?? "—"} | ${group.bestTimeGainRatio === null ? "—" : `${(group.bestTimeGainRatio * 100).toFixed(1)}%`} |`);
  lines.push(
    "", "## Recommendation", "",
    `- Status: **${report.recommendation.status}**`,
    `- Direction: **${report.recommendation.direction ?? "—"}**`,
    `- Evidence axis: **${report.recommendation.evidenceAxis ?? "—"}**`,
    `- Basis/reason: **${report.recommendation.reason ?? report.recommendation.basisCandidate ?? "—"}**`,
    `- Reached e2500: **${report.anyReachedE2500 ? "yes" : "no"}**; e7777: **${report.anyReachedE7777 ? "yes" : "no"}**`,
    "- C-strength remains a research parameter; production semantics require the separate #98 maintainer decision.",
    "", "## Remaining uncertainty", "", ...report.uncertainty.map((item) => `- ${item}`),
  );
  return `${lines.join("\n")}\n`;
}

async function main() {
  const report = await createSensitivityReport();
  if (process.argv.includes("--write-reports")) {
    const reportDir = path.join(__dirname, "..", "reports");
    fs.writeFileSync(path.join(reportDir, "tc4-balance-sensitivity.json"), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(reportDir, "tc4-balance-sensitivity.md"), formatMarkdown(report));
    process.stdout.write("Wrote reports/tc4-balance-sensitivity.json and reports/tc4-balance-sensitivity.md\n");
    return;
  }
  process.stdout.write(process.argv.includes("--format=markdown") ? formatMarkdown(report) : `${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  BASELINE_ID,
  EVALUATED_POLICY_IDS,
  PROBES,
  STAGE_1_OPTIONS,
  STAGE_2_OPTIONS,
  STAGE_3_OPTIONS,
  buildSensitivityEvidence,
  createSensitivityReport,
  formatMarkdown,
  promotionReasons,
  selectLeader,
};
