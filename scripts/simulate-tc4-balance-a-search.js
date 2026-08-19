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

const ISSUE = 127;
const EVALUATED_POLICY_IDS = Object.freeze(["fixed-60", "gain-aware-2x", "threshold-aware"]);
const BASELINE_ID = "A0.40-B0.35-C1";
const REFERENCE = Object.freeze({
  report: "reports/tc4-balance-sensitivity.json",
  peakScoreLog10: 1916.5081076008387,
  highestMilestone: 1700,
});
const FRESHNESS_VERIFICATION = Object.freeze({
  mergedChange: "#128 / PR #130 achievements 38-39; #131 / PR #132 reward correction",
  previousCommit: "f2c0c7f",
  verifiedCommit: "3f21ad887236be5f3e98d911f3ed748b6975881c",
  budget: "stage-3 equivalent: 24h / 20 states / 10 routes / 4h stall",
  observations: Object.freeze([
    Object.freeze({
      candidateId: "A0.40-B0.35-C1",
      previousPeakScoreLog10: 1916.5081076008387,
      currentPeakScoreLog10: 1916.6978221197528,
      peakDeltaLog10: 0.18971451891411562,
      previousHighestMilestone: 1700,
      currentHighestMilestone: 1700,
      previousE1700Seconds: 3350,
      currentE1700Seconds: 3340,
      currentE2500Seconds: null,
    }),
    Object.freeze({
      candidateId: "A1.00-B0.35-C1",
      previousPeakScoreLog10: 2396.5433334486474,
      currentPeakScoreLog10: 2396.779890313369,
      peakDeltaLog10: 0.23655686472147863,
      previousHighestMilestone: 1700,
      currentHighestMilestone: 1700,
      previousE1700Seconds: 140,
      currentE1700Seconds: 140,
      currentE2500Seconds: null,
    }),
  ]),
  conclusion: "The #128 refresh shifts peaks slightly and the #131 reward correction adds no further shift; the A direction, selected neighborhood, e1700 ceiling, and e2500/e7777 conclusion are preserved, with no #125 production decision change.",
});
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
  { id: BASELINE_ID, a: 0.40, b: 0.35, c: 1, axis: "baseline", reason: "strongest #119 A-only result" },
  { id: "A0.50-B0.35-C1", a: 0.50, b: 0.35, c: 1, axis: "A-only", reason: "bounded higher-A probe" },
  { id: "A0.60-B0.35-C1", a: 0.60, b: 0.35, c: 1, axis: "A-only", reason: "bounded higher-A probe" },
  { id: "A0.80-B0.35-C1", a: 0.80, b: 0.35, c: 1, axis: "A-only", reason: "bounded higher-A probe" },
  { id: "A1.00-B0.35-C1", a: 1.00, b: 0.35, c: 1, axis: "A-only", reason: "bounded higher-A probe" },
]);

function stageOptions(overrides, defaults) {
  return {
    ...defaults,
    ...(overrides ?? {}),
    policyIds: [...(overrides?.policyIds ?? defaults.policyIds)],
  };
}

function truncated(summary) {
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
  if (truncated(summary)) return ["stage-1-truncated-evidence"];
  if (!baseline?.bestAdaptive || !summary.bestAdaptive) return [];
  const reasons = [];
  const milestoneDelta = summary.bestAdaptive.highestMilestoneIndex - baseline.bestAdaptive.highestMilestoneIndex;
  const peakDelta = summary.bestAdaptive.peakScoreLog10 - baseline.bestAdaptive.peakScoreLog10;
  const common = commonMilestoneDelta(summary, baseline);
  if (milestoneDelta >= 1) reasons.push("higher-milestone-than-A0.40-baseline");
  if (peakDelta >= 1) reasons.push("peak-plus-1-log10-than-A0.40-baseline");
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
  const routes = [
    ...(summary.bestAdaptive?.canonical?.terminalAllocations ?? []),
    ...(summary.bestAdaptive?.allLegal?.terminalAllocations ?? []),
  ];
  return routes
    .slice()
    .sort((left, right) => (right.peakScoreLog10 ?? -Infinity) - (left.peakScoreLog10 ?? -Infinity))[0]?.lastPurchase ?? null;
}

function attachStage(summary, stage, reasons = []) {
  return { ...summary, evidenceStage: stage, promotionReasons: [...reasons] };
}

function sensitivityRow(summary, baseline) {
  const candidate = summary.bestAdaptive;
  const reference = baseline.bestAdaptive;
  const common = commonMilestoneDelta(summary, baseline);
  const resetTimes = candidate?.canonical?.terminalAllocations?.flatMap((route) => route.infinityResetTimes ?? []) ?? [];
  const baselineResetTimes = reference?.canonical?.terminalAllocations?.flatMap((route) => route.infinityResetTimes ?? []) ?? [];
  return {
    candidateId: summary.candidateId,
    a: summary.candidate.a,
    axis: summary.candidate.axis,
    evidenceStage: summary.evidenceStage,
    eligibleForRecommendation: summary.evidenceStage !== "stage-1" && !truncated(summary),
    truncated: truncated(summary),
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

function buildSensitivityEvidence(summaries) {
  const baseline = summaries.find(({ candidateId }) => candidateId === BASELINE_ID);
  const rows = baseline ? summaries.map((summary) => sensitivityRow(summary, baseline)) : [];
  const observed = rows.filter(({ axis }) => axis === "A-only").sort((left, right) => left.a - right.a);
  const eligible = observed.filter(({ eligibleForRecommendation }) => eligibleForRecommendation);
  const best = eligible.slice().sort((left, right) => {
    const milestone = (right.highestMilestoneDelta ?? -Infinity) - (left.highestMilestoneDelta ?? -Infinity);
    if (milestone !== 0) return milestone;
    const peak = (right.peakDeltaLog10 ?? -Infinity) - (left.peakDeltaLog10 ?? -Infinity);
    return peak !== 0 ? peak : left.candidateId.localeCompare(right.candidateId);
  })[0] ?? null;
  const marginal = [];
  for (let index = 1; index < observed.length; index += 1) {
    const previous = observed[index - 1];
    const current = observed[index];
    marginal.push({
      fromA: previous.a,
      toA: current.a,
      deltaA: current.a - previous.a,
      deltaPeakLog10: current.peakDeltaLog10 === null || previous.peakDeltaLog10 === null
        ? null
        : current.peakDeltaLog10 - previous.peakDeltaLog10,
      deltaMilestone: current.highestMilestoneDelta === null || previous.highestMilestoneDelta === null
        ? null
        : current.highestMilestoneDelta - previous.highestMilestoneDelta,
      commonMilestoneTimeGainRatio: current.commonMilestoneTimeGainRatio,
      candidates: [previous.candidateId, current.candidateId],
    });
  }
  return {
    baselineId: BASELINE_ID,
    rows,
    groups: [{
      axis: "A-only",
      candidateIds: observed.map(({ candidateId }) => candidateId),
      eligibleCandidateIds: eligible.map(({ candidateId }) => candidateId),
      bestCandidateId: best?.candidateId ?? null,
      bestHighestMilestoneDelta: best?.highestMilestoneDelta ?? null,
      bestPeakDeltaLog10: best?.peakDeltaLog10 ?? null,
      bestTimeGainRatio: best?.commonMilestoneTimeGainRatio ?? null,
    }],
    marginal,
  };
}

function decisionRecommendation(recommendation, candidates, sensitivity) {
  const best = candidates
    .slice()
    .sort((left, right) => comparePolicyProgress(left.bestAdaptive, right.bestAdaptive))[0];
  const reachedE2500 = candidates.some(({ bestAdaptive }) => bestAdaptive?.highestMilestone >= 2500);
  const reachedE7777 = candidates.some(({ bestAdaptive }) => bestAdaptive?.highestMilestone >= 7777);
  if (reachedE7777) return { status: "a-value-sufficiently-decisive", reason: "a tested A value reached e7777", basisCandidate: best.candidateId };
  if (best?.candidate.a >= 1 && !reachedE2500) {
    return {
      status: "a-only-scaling-insufficient",
      reason: "the highest bounded A probe remains below e2500",
      basisCandidate: best.candidateId,
      observedA: sensitivity.marginal,
      nextStep: "study the A functional form before increasing the flat coefficient further",
    };
  }
  if (recommendation.status === "bounded-recommendation") {
    return {
      status: "a-refinement-justified",
      reason: "higher-A probes show a materially productive bounded response",
      basisCandidate: recommendation.basisCandidate,
      nextStep: "one narrow A refinement requires a separate maintainer decision",
    };
  }
  return {
    status: "search-inconclusive",
    reason: recommendation.reason ?? "bounded results do not select a defensible next A step",
    basisCandidate: best?.candidateId ?? null,
    nextStep: "repeat only the smallest verification needed after reviewing truncation or route uncertainty",
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
    "# TC4 A-Focused Balance Search (Issue #127)",
    "",
    "> Research output only. Production TC4 formulas and #125 status:needs-decision are unchanged.",
    "",
    `- Target: **1e${report.targetLog10} Score**`,
    `- Candidates: **${report.probeDesign.map(({ id }) => id).join(", ")}**`,
    `- Policies: **${report.evaluatedResetPolicies.join(", ")}**`,
    "",
    "## Search stages",
    "",
    "| Stage | Horizon | States | Routes | Stall bound | Candidates |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const [name, stage] of Object.entries(report.stages)) {
    const count = stage.candidates?.length ?? stage.candidateIds?.length ?? 0;
    lines.push(`| ${name} | ${formatSeconds(stage.options.maxSeconds)} | ${stage.options.maxStates} | ${stage.options.maxRoutes} | ${formatSeconds(stage.options.stallSeconds)} | ${count} |`);
  }
  lines.push(
    "",
    "## Baseline reproduction",
    "",
    `- Reference: **${report.baseline.reference.peakScoreLog10.toFixed(3)} log10 peak / e${report.baseline.reference.highestMilestone} milestone** (${report.baseline.reference.report})`,
    `- Observed: **${formatPeak(report.baseline.summary.bestAdaptive?.peakScoreLog10)} peak / e${report.baseline.summary.bestAdaptive?.highestMilestone ?? "—"} milestone** at **${report.baseline.reproducedAtStage}**`,
    `- Peak delta: **${report.baseline.reproduction.peakDeltaLog10?.toFixed(3) ?? "—"} log10**; milestone match: **${report.baseline.reproduction.highestMilestoneMatches ? "yes" : "no"}**`,
    "",
    "## Freshness after #128 / PR #130",
    "",
    `The report was refreshed against \`next\` at **${report.freshnessVerification.verifiedCommit.slice(0, 7)}** after achievements 38–39 and the #131 reward correction merged. A Stage 3-equivalent representative check (24h / 20 states / 10 routes / 4h stall) found small peak shifts from the pre-#128 report, with no additional shift from #131 and no decision shift:`,
    "",
    "| Candidate | Previous peak | Current peak | Δ peak | Highest milestone | e1700 time | e2500 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ...report.freshnessVerification.observations.map((observation) => `| ${observation.candidateId} | ${observation.previousPeakScoreLog10.toFixed(3)} | ${observation.currentPeakScoreLog10.toFixed(3)} | +${observation.peakDeltaLog10.toFixed(3)} | ${observation.previousHighestMilestone} → ${observation.currentHighestMilestone} | ${observation.previousE1700Seconds}s → ${observation.currentE1700Seconds}s | ${observation.currentE2500Seconds === null ? "not reached" : `${observation.currentE2500Seconds}s`} |`),
    "",
    "The A direction, selected neighborhood, e1700 ceiling, and e2500/e7777 conclusion are unchanged; #131 adds no further shift, and #125 remains a maintainer decision gate.",
    "",
    "## Candidate results",
    "",
    "| Candidate | Stage | Classification | Best policy | Highest milestone | Peak | Promotion |",
    "| --- | --- | --- | --- | ---: | ---: | --- |",
  );
  for (const candidate of report.candidates) {
    lines.push(`| ${candidate.candidateId} | ${candidate.evidenceStage} | ${candidate.classification} | ${candidate.bestAdaptivePolicy ?? "—"} | ${candidate.bestAdaptive?.highestMilestone ?? "—"} | ${formatPeak(candidate.bestAdaptive?.peakScoreLog10)} | ${candidate.promotionReasons.join(", ") || "not promoted"} |`);
  }
  lines.push(
    "",
    "## Deltas versus A0.40 baseline",
    "",
    "| Candidate | A | Δ peak log10 | Δ milestone | Common milestone | Δ common time | Δ resets | Reset timing | Terminal purchase |",
    "| --- | ---: | ---: | ---: | --- | ---: | ---: | --- | --- |",
  );
  for (const row of report.sensitivity.rows) {
    lines.push(`| ${row.candidateId} | ${row.a.toFixed(2)} | ${row.peakDeltaLog10?.toFixed(3) ?? "—"} | ${row.highestMilestoneDelta ?? "—"} | ${row.commonMilestone ?? "—"} | ${row.commonMilestoneTimeDeltaSeconds === null ? "—" : `${row.commonMilestoneTimeDeltaSeconds.toFixed(0)}s`} | ${row.resetCountDelta ?? "—"} | ${row.resetTimes.join(", ") || "none"} / ${row.baselineResetTimes.join(", ") || "none"} | ${row.terminalPurchase ? `${row.terminalPurchase.kind}@e${row.terminalPurchase.priceLog10}` : "none"} |`);
  }
  lines.push("", "## Observed marginal A response", "", "| From A | To A | ΔA | Δ peak log10 | Δ milestone | Time gain ratio | Candidates |", "| ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...report.sensitivity.marginal.map((row) => `| ${row.fromA.toFixed(2)} | ${row.toA.toFixed(2)} | ${row.deltaA.toFixed(2)} | ${row.deltaPeakLog10?.toFixed(3) ?? "—"} | ${row.deltaMilestone ?? "—"} | ${row.commonMilestoneTimeGainRatio === null ? "—" : `${(row.commonMilestoneTimeGainRatio * 100).toFixed(1)}%`} | ${row.candidates.join(" → ")} |`),
    "",
    "## Recommendation",
    "",
    `- Status: **${report.recommendation.status}**`,
    `- Reason: **${report.recommendation.reason}**`,
    `- Basis candidate: **${report.recommendation.basisCandidate ?? "—"}**`,
    `- Reached e2500: **${report.anyReachedE2500 ? "yes" : "no"}**; e7777: **${report.anyReachedE7777 ? "yes" : "no"}**`,
    `- Next step: **${report.recommendation.nextStep ?? "—"}**`,
    "",
    "## Remaining uncertainty",
    "",
    ...report.uncertainty.map((item) => `- ${item}`),
  );
  return `${lines.join("\n")}\n`;
}

async function createASearchReport(overrides = {}) {
  const stage1Options = stageOptions(overrides.stage1, STAGE_1_OPTIONS);
  const stage2Options = stageOptions(overrides.stage2, STAGE_2_OPTIONS);
  const stage3Options = stageOptions(overrides.stage3, STAGE_3_OPTIONS);
  const stage1Raw = [];
  for (const candidate of PROBES) stage1Raw.push(await runCandidate(candidate, stage1Options));
  const stage1Summaries = stage1Raw.map(summarizeCandidate);
  const baselineStage1 = stage1Summaries.find(({ candidateId }) => candidateId === BASELINE_ID);
  const reasonsByCandidate = Object.fromEntries(stage1Summaries.map((summary) => [
    summary.candidateId,
    summary.candidateId === BASELINE_ID ? ["A0.40-reference-baseline"] : promotionReasons(summary, baselineStage1),
  ]));
  let promotedIds = stage1Summaries
    .filter(({ candidateId }) => candidateId !== BASELINE_ID)
    .filter((summary) => reasonsByCandidate[summary.candidateId].length > 0
      && !reasonsByCandidate[summary.candidateId].includes("stage-1-truncated-evidence"))
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
  const candidates = PROBES.map((candidate) => ({
    ...((stage3ById[candidate.id] ?? stage2ById[candidate.id] ?? stage1ById[candidate.id]) ?? {}),
    candidate,
    candidateId: candidate.id,
    axis: candidate.axis,
    probeReason: candidate.reason,
    stage1: stage1ById[candidate.id],
    stage2: stage2ById[candidate.id] ?? null,
    stage3: stage3ById[candidate.id] ?? null,
  }));
  const baseline = candidates.find(({ candidateId }) => candidateId === BASELINE_ID);
  const sensitivity = buildSensitivityEvidence(candidates);
  const measuredRecommendation = nextSearchRecommendation(candidates, { allowInconclusive: true, marginalEvidence: sensitivity });
  const recommendation = decisionRecommendation(measuredRecommendation, candidates, sensitivity);
  const ranking = candidateRanking(candidates);
  return {
    issue: ISSUE,
    title: "Search the A-focused TC4 balance region beyond A=0.40",
    researchOnly: true,
    sourceIssues: [119, 125],
    relationshipToIssue125: "Issue #125 remains status:needs-decision; this report makes no production decision.",
    targetLog10: 7777,
    scoreMilestones: TC4_SCORE_MILESTONES,
    evaluatedResetPolicies: EVALUATED_POLICY_IDS,
    resetPolicies: RESET_POLICIES,
    probeDesign: PROBES,
    baseline: {
      candidateId: BASELINE_ID,
      source: "strongest #119 A-only result",
      reference: REFERENCE,
      summary: baseline,
      reproducedAtStage: baseline?.evidenceStage ?? null,
      reproduction: {
        peakDeltaLog10: baseline?.bestAdaptive ? baseline.bestAdaptive.peakScoreLog10 - REFERENCE.peakScoreLog10 : null,
        highestMilestoneMatches: baseline?.bestAdaptive?.highestMilestone === REFERENCE.highestMilestone,
      },
    },
    promotionRule: {
      criteria: [
        "Stage 1 truncation is retained as uncertainty, not a performance win",
        "one additional milestone versus the A0.40 baseline",
        "at least +1 log10 peak Score versus the A0.40 baseline",
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
    measuredRecommendation,
    recommendation,
    freshnessVerification: FRESHNESS_VERIFICATION,
    anyReachedE2500: candidates.some(({ bestAdaptive }) => bestAdaptive?.highestMilestone >= 2500),
    anyReachedE7777: candidates.some(({ bestAdaptive }) => bestAdaptive?.highestMilestone >= 7777),
    uncertainty: [
      "The A response is observed only at the tested values from 0.40 through 1.00; it does not establish monotonicity or justify extrapolation.",
      "Search truncation, route limits, and simulator policy differences remain explicit uncertainty rather than production evidence.",
    ],
    noProductionChanges: true,
  };
}

async function main() {
  const report = await createASearchReport();
  if (process.argv.includes("--write-reports")) {
    const reportDir = path.join(__dirname, "..", "reports");
    fs.writeFileSync(path.join(reportDir, "tc4-balance-a-search.json"), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(reportDir, "tc4-balance-a-search.md"), formatMarkdown(report));
    process.stdout.write("Wrote reports/tc4-balance-a-search.json and reports/tc4-balance-a-search.md\n");
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
  FRESHNESS_VERIFICATION,
  PROBES,
  STAGE_1_OPTIONS,
  STAGE_2_OPTIONS,
  STAGE_3_OPTIONS,
  buildSensitivityEvidence,
  createASearchReport,
  formatMarkdown,
  promotionReasons,
  selectLeader,
};
