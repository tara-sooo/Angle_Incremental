const fs = require("node:fs");
const path = require("node:path");
const {
  CANDIDATE_A,
  CANDIDATE_GRID,
  RESET_POLICIES,
  TC4_SCORE_MILESTONES,
  candidateAComparability,
  candidateRanking,
  comparePolicyProgress,
  nextSearchRecommendation,
  runCandidate,
  summarizeCandidate,
} = require("./simulate-tc4-balance.js");

const ISSUE = 117;
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
const STAGE_2_OPTIONS = Object.freeze({
  ...STAGE_1_OPTIONS,
  maxSeconds: 43_200,
});
const STAGE_3_OPTIONS = Object.freeze({
  ...STAGE_1_OPTIONS,
  maxSeconds: 86_400,
});
const FOLLOWUP_CANDIDATES = CANDIDATE_GRID.filter(({ id }) => id !== CANDIDATE_A.id);

function formatSeconds(seconds) {
  if (!Number.isFinite(seconds)) return "not reached";
  if (seconds < 3600) return `${Math.round(seconds)}s`;
  return `${(seconds / 3600).toFixed(2)}h`;
}

function formatPeak(value) {
  return Number.isFinite(value) ? `e${value.toFixed(0)}` : "not reached";
}

function formatMilestone(value) {
  return Number.isFinite(value) ? `e${value}` : "—";
}

function stageOptions(overrides, defaults) {
  return {
    ...defaults,
    ...(overrides ?? {}),
    policyIds: [...(overrides?.policyIds ?? defaults.policyIds)],
  };
}

function promotionReasons(summary, baselineFixed60) {
  const reasons = [];
  const truncated = summary.searchComplete === false
    || summary.policyComparisons.some(({ canonical, allLegal }) => canonical.truncated || allLegal.truncated);
  if (truncated || summary.classification === "inconclusive") reasons.push("stage-1-truncated-or-inconclusive");
  if ((summary.bestAdaptive?.highestMilestone ?? -Infinity) >= 1700) reasons.push("best-adaptive-reached-e1700");
  const baselinePeak = baselineFixed60?.peakScoreLog10;
  if (Number.isFinite(baselinePeak)
    && Number.isFinite(summary.bestAdaptive?.peakScoreLog10)
    && summary.bestAdaptive.peakScoreLog10 >= baselinePeak) {
    reasons.push("best-adaptive-matched-or-exceeded-candidate-a-fixed-60");
  }
  return reasons;
}

function attachStage(summary, stage, reasons = []) {
  return {
    ...summary,
    evidenceStage: stage,
    promotionReasons: [...reasons],
  };
}

function selectLeader(summaries) {
  return summaries
    .slice()
    .sort((left, right) => {
      const progress = comparePolicyProgress(left.bestAdaptive, right.bestAdaptive);
      if (progress !== 0) return progress;
      return left.candidateId.localeCompare(right.candidateId);
    })[0] ?? null;
}

function milestoneRows(summary) {
  const comparison = summary.bestAdaptive;
  return TC4_SCORE_MILESTONES.map((milestone) => {
    const key = `e${milestone}`;
    return {
      milestone: key,
      firstReachedAtSeconds: comparison?.firstMilestoneTimes?.[key] ?? null,
      snapshot: comparison?.firstMilestoneSnapshots?.[key] ?? null,
    };
  });
}

function candidateFinalEntry(candidate, stage1, stage2, stage3, reasons) {
  const selected = stage3 ?? stage2 ?? stage1;
  return {
    ...selected,
    candidate,
    candidateId: candidate.id,
    classification: selected.classification,
    evidenceStage: selected.evidenceStage,
    promotionReasons: reasons,
    stage1,
    stage2,
    stage3,
    highestMilestone: selected.bestAdaptive?.highestMilestone ?? null,
    peakScoreLog10: selected.bestAdaptive?.peakScoreLog10 ?? null,
    bestAdaptivePolicy: selected.bestAdaptivePolicy,
    milestoneRows: milestoneRows(selected),
  };
}

async function createFollowupReport(overrides = {}) {
  const stage1Options = stageOptions(overrides.stage1, STAGE_1_OPTIONS);
  const stage2Options = stageOptions(overrides.stage2, STAGE_2_OPTIONS);
  const stage3Options = stageOptions(overrides.stage3, STAGE_3_OPTIONS);
  const baselineOptions = stageOptions(overrides.baseline, stage3Options);

  const baselineRaw = await runCandidate(CANDIDATE_A, baselineOptions);
  const baselineSummary = attachStage(summarizeCandidate(baselineRaw), "baseline");
  const baselineFixed60 = baselineSummary.fixed60;

  const stage1Raw = [];
  for (const candidate of FOLLOWUP_CANDIDATES) {
    stage1Raw.push(await runCandidate(candidate, stage1Options));
  }
  const stage1Summaries = stage1Raw.map((result) => summarizeCandidate(result));
  const reasonsByCandidate = Object.fromEntries(stage1Summaries.map((summary) => [
    summary.candidateId,
    promotionReasons(summary, baselineFixed60),
  ]));
  let promotedIds = stage1Summaries
    .filter((summary) => reasonsByCandidate[summary.candidateId].length > 0)
    .map(({ candidateId }) => candidateId);
  let fallbackPromotion = null;
  if (promotedIds.length === 0) {
    const leader = selectLeader(stage1Summaries);
    if (leader) {
      promotedIds = [leader.candidateId];
      reasonsByCandidate[leader.candidateId] = ["stage-1-ranking-fallback"];
      fallbackPromotion = leader.candidateId;
    }
  }

  const stage2Raw = [];
  for (const candidate of FOLLOWUP_CANDIDATES.filter(({ id }) => promotedIds.includes(id))) {
    stage2Raw.push(await runCandidate(candidate, stage2Options));
  }
  const stage2Summaries = stage2Raw.map((result) => summarizeCandidate(result));
  const stage2Leader = selectLeader(stage2Summaries);
  const finalistId = stage2Leader?.candidateId ?? null;
  const finalist = FOLLOWUP_CANDIDATES.find(({ id }) => id === finalistId) ?? null;
  const stage3Raw = finalist ? [await runCandidate(finalist, stage3Options)] : [];
  const stage3Summaries = stage3Raw.map((result) => summarizeCandidate(result));

  const stage1ById = Object.fromEntries(stage1Summaries.map((summary) => [
    summary.candidateId,
    attachStage(summary, "stage-1", reasonsByCandidate[summary.candidateId]),
  ]));
  const stage2ById = Object.fromEntries(stage2Summaries.map((summary) => [
    summary.candidateId,
    attachStage(summary, "stage-2", reasonsByCandidate[summary.candidateId]),
  ]));
  const stage3ById = Object.fromEntries(stage3Summaries.map((summary) => [
    summary.candidateId,
    attachStage(summary, "stage-3", reasonsByCandidate[summary.candidateId]),
  ]));
  const finalCandidates = FOLLOWUP_CANDIDATES.map((candidate) => candidateFinalEntry(
    candidate,
    stage1ById[candidate.id],
    stage2ById[candidate.id] ?? null,
    stage3ById[candidate.id] ?? null,
    reasonsByCandidate[candidate.id],
  ));
  const finalSummaries = finalCandidates.map(({ candidate, ...summary }) => ({ candidate, ...summary }));
  const ranking = candidateRanking(finalSummaries);
  const classifications = Object.fromEntries(finalCandidates.map(({ candidateId, classification }) => [candidateId, classification]));
  const recommendation = nextSearchRecommendation(finalSummaries);

  return {
    issue: ISSUE,
    title: "Complete TC4 balance evaluation for the eight inconclusive candidates",
    researchOnly: true,
    sourceIssues: [106, 112, 114],
    relationshipToIssue98: "Issue #98 remains status:needs-decision; this report selects no production constants.",
    targetLog10: 7777,
    scoreMilestones: TC4_SCORE_MILESTONES,
    evaluatedResetPolicies: EVALUATED_POLICY_IDS,
    resetPolicies: RESET_POLICIES,
    candidateGrid: FOLLOWUP_CANDIDATES,
    candidateA: {
      summary: baselineSummary,
      options: baselineOptions,
      comparabilityWithIssue112: candidateAComparability(baselineRaw, baselineOptions),
    },
    promotionRule: {
      criteria: [
        "Stage 1 is truncated or inconclusive",
        "best adaptive policy reaches e1700",
        "best adaptive peak matches or exceeds Candidate A fixed-60 peak",
      ],
      fallback: "If no candidate matches, promote the deterministic Stage 1 leader.",
      ranking: "highest milestone, highest peak Score, earliest time to milestone, fewer Infinity resets, then candidate ID",
    },
    stages: {
      stage1: {
        options: stage1Options,
        candidates: stage1Summaries.map((summary) => stage1ById[summary.candidateId]),
      },
      stage2: {
        options: stage2Options,
        promotedCandidateIds: promotedIds,
        fallbackPromotion,
        candidates: stage2Summaries.map((summary) => stage2ById[summary.candidateId]),
      },
      stage3: {
        options: stage3Options,
        finalistId,
        candidate: finalistId ? stage3ById[finalistId] : null,
      },
    },
    candidates: finalCandidates,
    candidateClassifications: classifications,
    ranking,
    bestCandidate: ranking.adaptive[0] ?? null,
    anyReachedE2500: finalCandidates.some(({ highestMilestone }) => highestMilestone >= 2500),
    anyReachedE7777: finalCandidates.some(({ classification }) => classification === "viable"),
    nextSearchRecommendation: recommendation,
    noProductionChanges: true,
  };
}

function formatMarkdown(report) {
  const lines = [
    "# TC4 Balance Follow-up (Issue #117)",
    "",
    "> Research output only. No production TC4 constants are selected or changed.",
    "",
    `- Target: **1e${report.targetLog10} Score**`,
    `- Candidates evaluated: **${report.candidateGrid.length}** non-baseline values from the existing 3x3 grid`,
    `- Policies: **${report.evaluatedResetPolicies.join(", ")}**`,
    `- Milestones: **${report.scoreMilestones.map((milestone) => `e${milestone}`).join(", ")}**`,
    "",
    "## Search stages",
    "",
    "| Stage | Horizon | States | Routes | Stall bound | Candidates |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const [name, stage] of Object.entries(report.stages)) {
    if (!stage.options) continue;
    const candidateCount = name === "stage1"
      ? stage.candidates.length
      : name === "stage2"
        ? stage.promotedCandidateIds.length
        : stage.finalistId ? 1 : 0;
    lines.push(`| ${name} | ${formatSeconds(stage.options.maxSeconds)} | ${stage.options.maxStates} | ${stage.options.maxRoutes} | ${formatSeconds(stage.options.stallSeconds)} | ${candidateCount} |`);
  }
  lines.push(
    "",
    "## Candidate A baseline",
    "",
    `- Options comparable to Issue #112: **${report.candidateA.comparabilityWithIssue112.optionsMatch ? "yes" : "no"}**`,
    `- Within tolerance: **${report.candidateA.comparabilityWithIssue112.withinTolerance ? "yes" : "no"}**`,
    `- Classification: **${report.candidateA.summary.classification}**`,
    `- Best adaptive policy: **${report.candidateA.summary.bestAdaptivePolicy ?? "not reached"}**`,
    `- Best adaptive peak: **${formatPeak(report.candidateA.summary.bestAdaptive?.peakScoreLog10)}**`,
    "",
    "## Promotion and final results",
    "",
    "| Candidate | Promotion reason | Evidence | Classification | Best policy | Highest milestone | Peak Score |",
    "| --- | --- | --- | --- | --- | ---: | ---: |",
  );
  for (const candidate of report.candidates) {
    lines.push(`| ${candidate.candidateId} | ${candidate.promotionReasons.join(", ") || "not promoted"} | ${candidate.evidenceStage} | ${candidate.classification} | ${candidate.bestAdaptivePolicy ?? "—"} | ${formatMilestone(candidate.highestMilestone)} | ${formatPeak(candidate.peakScoreLog10)} |`);
  }
  lines.push("", `- Deterministic adaptive ranking: **${report.ranking.adaptive.join(" → ")}**`, `- Reached e2500: **${report.anyReachedE2500 ? "yes" : "no"}**`, `- Reached e7777: **${report.anyReachedE7777 ? "yes" : "no"}**`, "", "## Required milestone first-reach times", "");
  for (const candidate of report.candidates) {
    lines.push(`- **${candidate.candidateId} / ${candidate.bestAdaptivePolicy ?? "adaptive unavailable"}**: ${candidate.milestoneRows.map(({ milestone, firstReachedAtSeconds }) => `${milestone}=${formatSeconds(firstReachedAtSeconds)}`).join(", ")}`);
  }
  lines.push("", "## Terminal evidence (best adaptive policy)", "", "| Candidate | End reason | Last purchase | Infinity resets | Last progress | Final levels | Final price steps |", "| --- | --- | --- | --- | ---: | --- | --- |");
  for (const candidate of report.candidates) {
    const allocations = [
      ...(candidate.bestAdaptive?.canonical?.terminalAllocations ?? []),
      ...(candidate.bestAdaptive?.allLegal?.terminalAllocations ?? []),
    ];
    const terminal = allocations.slice().sort((left, right) => (right.peakScoreLog10 ?? -Infinity) - (left.peakScoreLog10 ?? -Infinity))[0];
    const purchase = terminal?.lastPurchase ? `${terminal.lastPurchase.kind}@e${terminal.lastPurchase.priceLog10}` : "none";
    const resets = terminal?.infinityResetTimes?.join(", ") || "none";
    const levels = terminal ? Object.entries(terminal.finalLevels).map(([kind, value]) => `${kind}=${value}`).join(", ") : "—";
    const priceSteps = terminal ? Object.entries(terminal.finalPriceSteps).map(([kind, value]) => `${kind}=${value}`).join(", ") : "—";
    lines.push(`| ${candidate.candidateId} | ${terminal?.reason ?? "—"} | ${purchase} | ${resets} | ${formatSeconds(terminal?.lastProgressAtSeconds)} | ${levels} | ${priceSteps} |`);
  }
  lines.push(
    "",
    "Representative milestone snapshots are retained in the machine-readable report under each candidate's selected evidence summary; route lists are intentionally not duplicated.",
    "",
    "## Maintainer recommendation for #98",
    "",
    `- Recommendation status: **${report.nextSearchRecommendation.status}**`,
    `- Basis: **${report.nextSearchRecommendation.reason ?? report.nextSearchRecommendation.basisCandidate ?? "see candidate evidence"}**`,
    `- Direction: **${report.nextSearchRecommendation.direction ?? "—"}**`,
    `- Gap to e2500: **${report.nextSearchRecommendation.gapToE2500 ?? "—"} log10**`,
    `- Next region: **${report.nextSearchRecommendation.nextRegion ?? "—"}**`,
    "- Keep #98 at `status:needs-decision`; choose production A/B/C semantics or authorize a bounded next research region in a separate maintainer decision.",
    "",
    "## Caveats",
    "",
    "- Stage 1 is identical across all eight candidates; promoted candidates have explicitly stronger evidence.",
    "- Truncated searches remain inconclusive and are never silently classified as failed.",
    "- This report does not modify production formulas or automatically unblock #98.",
  );
  return `${lines.join("\n")}\n`;
}

async function main() {
  const report = await createFollowupReport();
  if (process.argv.includes("--write-reports")) {
    const reportDir = path.join(__dirname, "..", "reports");
    fs.writeFileSync(path.join(reportDir, "tc4-balance-followup.json"), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(reportDir, "tc4-balance-followup.md"), formatMarkdown(report));
    process.stdout.write("Wrote reports/tc4-balance-followup.json and reports/tc4-balance-followup.md\n");
    return;
  }
  process.stdout.write(process.argv.includes("--format=markdown")
    ? formatMarkdown(report)
    : `${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  EVALUATED_POLICY_IDS,
  FOLLOWUP_CANDIDATES,
  STAGE_1_OPTIONS,
  STAGE_2_OPTIONS,
  STAGE_3_OPTIONS,
  createFollowupReport,
  formatMarkdown,
  promotionReasons,
  selectLeader,
};
