const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
  RESET_POLICIES,
  TC4_A_FORM_IDS,
  TC4_SCORE_MILESTONES,
  aExponentForCandidate,
  comparePolicyProgress,
  runCandidate,
  summarizeCandidate,
} = require("./simulate-tc4-balance.js");

const ISSUE = 134;
const EVALUATED_POLICY_IDS = Object.freeze(["fixed-60", "gain-aware-2x", "threshold-aware"]);
const TARGET_LOG10 = 7777;
const CONTROL_ID = "flat-A1.00-B0.35-C1";
const DIAGNOSTIC_ID = "flat-A2.00-diagnostic";
const PRICE_DEFINITIONS = Object.freeze({
  baseGain: Object.freeze({ baseLog10: 100, stepLog10: 800 }),
  infinityScoreVertexGain: Object.freeze({ baseLog10: 500, stepLog10: 1200 }),
  freeCoreBoost: Object.freeze({ baseLog10: 900, stepLog10: 1600 }),
});
const CANDIDATES = Object.freeze([
  Object.freeze({
    id: CONTROL_ID,
    a: 1,
    b: 0.35,
    c: 1,
    aForm: "flat-additive",
    formula: "E = parts + A * level",
    parameters: Object.freeze({ A: 1, B: 0.35, C: 1 }),
    axis: "flat-control",
  }),
  Object.freeze({
    id: "power-A1.00-B0.35-C1",
    a: 1,
    b: 0.35,
    c: 1,
    aForm: "power-accumulation",
    formula: "E = parts + A * level^1.25",
    parameters: Object.freeze({ A: 1, power: 1.25, B: 0.35, C: 1 }),
    axis: "power-accumulation",
  }),
  Object.freeze({
    id: "log-A1.00-B0.35-C1",
    a: 1,
    b: 0.35,
    c: 1,
    aForm: "logarithmic-accumulation",
    formula: "E = parts + A * level * (1 + log2(level + 1))",
    parameters: Object.freeze({ A: 1, logBase: 2, B: 0.35, C: 1 }),
    axis: "logarithmic-accumulation",
  }),
  Object.freeze({
    id: "multiplicative-A1.00-B0.35-C1",
    a: 1,
    b: 0.35,
    c: 1,
    aForm: "multiplicative",
    formula: "E = parts * (1 + A * level)",
    parameters: Object.freeze({ A: 1, B: 0.35, C: 1 }),
    axis: "multiplicative",
  }),
]);
const DIAGNOSTIC = Object.freeze({
  id: DIAGNOSTIC_ID,
  a: 2,
  b: 0.35,
  c: 1,
  aForm: "flat-additive",
  formula: "E = parts + A * level (single A=2.00 magnitude diagnostic)",
  parameters: Object.freeze({ A: 2, B: 0.35, C: 1, diagnosticOnly: true }),
  axis: "magnitude-diagnostic",
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

function sourceCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: path.join(__dirname, ".."),
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

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

function commonMilestone(candidate, baseline) {
  const candidateData = candidate.bestAdaptive;
  const baselineData = baseline.bestAdaptive;
  if (!candidateData || !baselineData) return null;
  const index = Math.min(candidateData.highestMilestoneIndex, baselineData.highestMilestoneIndex);
  if (index < 0) return null;
  const milestone = TC4_SCORE_MILESTONES[index];
  const key = `e${milestone}`;
  const candidateTime = candidateData.firstMilestoneTimes?.[key];
  const baselineTime = baselineData.firstMilestoneTimes?.[key];
  if (!Number.isFinite(candidateTime) || !Number.isFinite(baselineTime) || baselineTime <= 0) return null;
  return {
    milestone,
    candidateTime,
    baselineTime,
    timeGainRatio: (baselineTime - candidateTime) / baselineTime,
  };
}

function promotionReasons(summary, baseline) {
  if (truncated(summary)) return ["stage-1-truncated-evidence"];
  if (!baseline?.bestAdaptive || !summary.bestAdaptive) return [];
  const reasons = [];
  if (summary.bestAdaptive.highestMilestoneIndex > baseline.bestAdaptive.highestMilestoneIndex) {
    reasons.push("higher-milestone-than-flat-control");
  }
  if (summary.bestAdaptive.peakScoreLog10 - baseline.bestAdaptive.peakScoreLog10 >= 1) {
    reasons.push("peak-plus-1-log10-than-flat-control");
  }
  if ((commonMilestone(summary, baseline)?.timeGainRatio ?? -Infinity) >= 0.1) {
    reasons.push("10-percent-faster-common-milestone");
  }
  return reasons;
}

function selectLeader(summaries) {
  return summaries.slice().sort((left, right) => {
    const progress = comparePolicyProgress(left.bestAdaptive, right.bestAdaptive);
    return progress !== 0 ? progress : left.candidateId.localeCompare(right.candidateId);
  })[0] ?? null;
}

function bestRoute(raw, summary) {
  const policyId = summary.bestAdaptivePolicy;
  const policy = raw?.policies?.find(({ policy }) => policy.id === policyId) ?? raw?.policies?.[0];
  return policy?.canonical?.routes?.reduce((best, route) => (
    route.peakScoreLog10 > (best?.peakScoreLog10 ?? -Infinity) ? route : best
  ), null) ?? null;
}

function nextLegalPrices(route) {
  return Object.fromEntries(Object.entries(PRICE_DEFINITIONS).map(([kind, definition]) => [
    kind,
    definition.baseLog10 + definition.stepLog10 * (route?.finalPriceSteps?.[kind] ?? 0),
  ]));
}

function scoreGrowthNearTerminal(route) {
  if (!route) return null;
  const elapsed = route.elapsedSeconds;
  const peak = route.peakScoreLog10;
  const final = route.finalScoreLog10;
  const lastProgress = route.lastProgressAtSeconds;
  return {
    terminalScoreLog10: final,
    peakScoreLog10: peak,
    peakScoreAtSeconds: route.peakScoreAtSeconds,
    lastProgressAtSeconds: lastProgress,
    terminalToPeakDeltaLog10: Number.isFinite(peak) && Number.isFinite(final) ? peak - final : null,
    terminalScoreLog10PerSecond: Number.isFinite(final) && elapsed > 0 ? final / elapsed : null,
    peakScoreLog10PerSecond: Number.isFinite(peak) && route.peakScoreAtSeconds > 0 ? peak / route.peakScoreAtSeconds : null,
    noNewPeakForSeconds: Number.isFinite(lastProgress) ? Math.max(0, elapsed - lastProgress) : null,
    horizonSeconds: elapsed,
  };
}

function terminalEvidence(raw, summary) {
  const route = bestRoute(raw, summary);
  if (!route) return null;
  const reached = summary.bestAdaptive?.firstMilestoneTimes ?? {};
  return {
    policy: summary.bestAdaptivePolicy,
    status: route.status,
    reason: route.reason,
    elapsedSeconds: route.elapsedSeconds,
    finalLevels: route.finalLevels,
    finalPriceSteps: route.finalPriceSteps,
    nextLegalPrices: nextLegalPrices(route),
    baseGainExponent: route.baseGainExponent,
    gainExpressionParts: route.gainExpressionParts,
    aExponentContribution: route.aExponentContribution,
    scoreGrowthNearTerminal: scoreGrowthNearTerminal(route),
    infinityResetCount: route.infinityResetCount,
    infinityResetTimes: route.infinityResetTimes,
    purchaseSequence: route.purchaseSequence,
    sharedPriceStepSequence: route.purchaseSequence.map(({ kind, priceLog10, priceSteps }) => ({ kind, priceLog10, priceSteps })),
    reachedMilestones: Object.fromEntries(TC4_SCORE_MILESTONES.map((milestone) => [`e${milestone}`, reached[`e${milestone}`] ?? null])),
    highestMilestone: summary.bestAdaptive?.highestMilestone ?? null,
    peakScoreLog10: summary.bestAdaptive?.peakScoreLog10 ?? null,
  };
}

function diagnoseWall(controlRaw, controlSummary, diagnosticRaw, diagnosticSummary) {
  const control = terminalEvidence(controlRaw, controlSummary);
  const magnitude = terminalEvidence(diagnosticRaw, diagnosticSummary);
  const controlPeak = control?.peakScoreLog10 ?? -Infinity;
  const magnitudePeak = magnitude?.peakScoreLog10 ?? -Infinity;
  const peakDelta = Number.isFinite(controlPeak) && Number.isFinite(magnitudePeak)
    ? magnitudePeak - controlPeak
    : null;
  const controlMilestone = control?.highestMilestone ?? -Infinity;
  const magnitudeMilestone = magnitude?.highestMilestone ?? -Infinity;
  let classification = "inconclusive";
  if (magnitude && magnitudeMilestone >= 2500) classification = "coefficient-magnitude-plausible";
  else if (magnitude && magnitudeMilestone <= controlMilestone && (peakDelta ?? 0) < 1) classification = "shape-failure-observed";
  else if (magnitude) classification = "magnitude-helps-but-shape-remains-limiting";
  return {
    classification,
    control,
    hypotheticalA2: magnitude,
    hypotheticalA2PeakDeltaLog10: peakDelta,
    hypotheticalA2MilestoneDelta: Number.isFinite(controlMilestone) && Number.isFinite(magnitudeMilestone)
      ? magnitudeMilestone - controlMilestone
      : null,
    interpretation: "The A=2.00 run is a single magnitude diagnostic; it is not a coefficient sweep or a production recommendation.",
  };
}

function candidateResult(candidate, raw, stage1, stage2, stage3, reasons) {
  const summary = summarizeCandidate(raw);
  return {
    ...summary,
    form: {
      id: candidate.aForm,
      formula: candidate.formula,
      parameters: candidate.parameters,
    },
    axis: candidate.axis,
    evidenceStage: stage3 ? "stage-3" : stage2 ? "stage-2" : "stage-1",
    promotionReasons: reasons,
    stage1: stage1 ? summarizeCandidate(stage1) : null,
    stage2: stage2 ? summarizeCandidate(stage2) : null,
    stage3: stage3 ? summarizeCandidate(stage3) : null,
    terminalEvidence: terminalEvidence(raw, summary),
  };
}

function recommendation(candidates, diagnosis) {
  const best = candidates.slice().sort((left, right) => comparePolicyProgress(left.bestAdaptive, right.bestAdaptive))[0] ?? null;
  const reachesTarget = candidates.some(({ bestAdaptive }) => bestAdaptive?.highestMilestone >= TARGET_LOG10);
  const reachesE2500 = candidates.some(({ bestAdaptive }) => bestAdaptive?.highestMilestone >= 2500);
  const incomplete = candidates.some(truncated);
  if (reachesTarget) {
    return { status: "functional-form-reaches-target", basisCandidate: best?.candidateId ?? null, reason: "a tested A form reached e7777", nextStep: "maintainer decision required before any production formula change" };
  }
  if (incomplete) {
    return { status: "search-inconclusive", basisCandidate: best?.candidateId ?? null, reason: "at least one promoted search remains truncated", nextStep: "review truncation before selecting another bounded verification" };
  }
  if (reachesE2500) {
    return { status: "functional-form-supported-narrow-refinement", basisCandidate: best?.candidateId ?? null, reason: "a tested A form crossed e2500 but later progression needs one bounded refinement", nextStep: "maintainer decision on one narrow parameter refinement" };
  }
  return {
    status: diagnosis.classification === "shape-failure-observed" ? "a-alone-remains-structurally-insufficient" : "functional-form-search-below-e2500",
    basisCandidate: best?.candidateId ?? null,
    reason: reachesE2500 ? "a form crossed e2500" : "all tested forms remain below e2500",
    nextStep: "maintainer decision on the smallest next design question; do not silently change production TC4",
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

function formatMilestones(summary) {
  return TC4_SCORE_MILESTONES.map((milestone) => {
    const value = summary.bestAdaptive?.firstMilestoneTimes?.[`e${milestone}`];
    return `e${milestone}=${formatSeconds(value)}`;
  }).join(", ");
}

function formatMarkdown(report) {
  const lines = [
    "# TC4 A-Effect Functional-Form Study (Issue #134)",
    "",
    "> Research output only. Production TC4 formulas and #125 status:needs-decision are unchanged.",
    "",
    `- Source HEAD: **${report.sourceCommit ?? "unknown"}**`,
    `- Policies: **${report.evaluatedResetPolicies.join(", ")}**`,
    `- Milestones: **${TC4_SCORE_MILESTONES.map((milestone) => `e${milestone}`).join(", ")}**`,
    "",
    "## Search stages",
    "",
    "| Stage | Horizon | States | Routes | Stall bound | Candidates |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const [name, stage] of Object.entries(report.stages)) {
    const count = stage.candidates?.length ?? stage.candidateIds?.length ?? stage.promotedCandidateIds?.length ?? 0;
    lines.push(`| ${name} | ${formatSeconds(stage.options.maxSeconds)} | ${stage.options.maxStates} | ${stage.options.maxRoutes} | ${formatSeconds(stage.options.stallSeconds)} | ${count} |`);
  }
  lines.push(
    "",
    "## Phase-1 wall diagnosis",
    "",
    `- Classification: **${report.diagnosis.classification}**`,
    `- Flat control: **${formatPeak(report.diagnosis.control?.peakScoreLog10)} / e${report.diagnosis.control?.highestMilestone ?? "—"}**`,
    `- Single A=2.00 diagnostic: **${formatPeak(report.diagnosis.hypotheticalA2?.peakScoreLog10)} / e${report.diagnosis.hypotheticalA2?.highestMilestone ?? "—"}** (Δ peak ${report.diagnosis.hypotheticalA2PeakDeltaLog10?.toFixed(3) ?? "—"})`,
    `- Flat terminal state: **${JSON.stringify(report.diagnosis.control?.finalLevels ?? null)}**, price steps **${JSON.stringify(report.diagnosis.control?.finalPriceSteps ?? null)}**`,
    `- Next legal prices: **${JSON.stringify(report.diagnosis.control?.nextLegalPrices ?? null)}**`,
    `- A exponent contribution: **${report.diagnosis.control?.aExponentContribution ?? "—"}** (parts ${report.diagnosis.control?.gainExpressionParts ?? "—"})`,
    `- Late score behavior: **${JSON.stringify(report.diagnosis.control?.scoreGrowthNearTerminal ?? null)}**`,
    `- Shared price-step sequence length: **${report.diagnosis.control?.sharedPriceStepSequence?.length ?? 0}**`,
    "",
    report.diagnosis.interpretation,
    "",
    "## Candidate results",
    "",
    "| Candidate | Formula | Parameters | Stage | Classification | Best policy | Highest milestone | Peak | e2500/e7777 |",
    "| --- | --- | --- | --- | --- | --- | ---: | ---: | --- |",
  );
  for (const candidate of report.candidates) {
    const e2500 = Number.isFinite(candidate.bestAdaptive?.firstMilestoneTimes?.e2500);
    const e7777 = Number.isFinite(candidate.bestAdaptive?.firstMilestoneTimes?.e7777);
    lines.push(`| ${candidate.candidateId} | ${candidate.form.formula} | ${JSON.stringify(candidate.form.parameters)} | ${candidate.evidenceStage} | ${candidate.classification} | ${candidate.bestAdaptivePolicy ?? "—"} | e${candidate.bestAdaptive?.highestMilestone ?? "—"} | ${formatPeak(candidate.bestAdaptive?.peakScoreLog10)} | ${e2500 ? "yes" : "no"}/${e7777 ? "yes" : "no"} |`);
  }
  lines.push("", "## Required milestone first-reach times", "");
  for (const candidate of report.candidates) lines.push(`- **${candidate.candidateId} / ${candidate.bestAdaptivePolicy ?? "—"}**: ${formatMilestones(candidate)}`);
  lines.push(
    "",
    "## Terminal and balance evidence",
    "",
    "| Candidate | A contribution | Terminal levels | Next prices | Resets | Post-e2500 progression |",
    "| --- | ---: | --- | --- | ---: | --- |",
  );
  for (const candidate of report.candidates) {
    const terminal = candidate.terminalEvidence;
    const later = TC4_SCORE_MILESTONES.filter((milestone) => milestone > 2500 && Number.isFinite(candidate.bestAdaptive?.firstMilestoneTimes?.[`e${milestone}`]));
    lines.push(`| ${candidate.candidateId} | ${terminal?.aExponentContribution ?? "—"} | ${JSON.stringify(terminal?.finalLevels ?? null)} | ${JSON.stringify(terminal?.nextLegalPrices ?? null)} | ${terminal?.infinityResetCount ?? "—"} | ${later.length > 0 ? later.map((milestone) => `e${milestone}`).join(", ") : "not established"} |`);
  }
  lines.push(
    "",
    "## Recommendation",
    "",
    `- Status: **${report.recommendation.status}**`,
    `- Basis: **${report.recommendation.basisCandidate ?? "—"}**`,
    `- Reason: **${report.recommendation.reason}**`,
    `- Next step: **${report.recommendation.nextStep}**`,
    "",
    "## Remaining uncertainty",
    "",
    ...report.uncertainty.map((item) => `- ${item}`),
  );
  return `${lines.join("\n")}\n`;
}

async function createAFormSearchReport(overrides = {}) {
  const stage1Options = stageOptions(overrides.stage1, STAGE_1_OPTIONS);
  const stage2Options = stageOptions(overrides.stage2, STAGE_2_OPTIONS);
  const stage3Options = stageOptions(overrides.stage3, STAGE_3_OPTIONS);
  const diagnosticOptions = stageOptions(overrides.diagnostic, STAGE_3_OPTIONS);
  const stage1Raw = [];
  for (const candidate of CANDIDATES) stage1Raw.push(await runCandidate(candidate, stage1Options));
  const stage1Summaries = stage1Raw.map(summarizeCandidate);
  const baselineStage1 = stage1Summaries.find(({ candidateId }) => candidateId === CONTROL_ID);
  const reasonsById = Object.fromEntries(stage1Summaries.map((summary) => [summary.candidateId, promotionReasons(summary, baselineStage1)]));
  let promotedIds = stage1Summaries
    .filter(({ candidateId }) => candidateId !== CONTROL_ID)
    .filter((summary) => reasonsById[summary.candidateId].length > 0 && !reasonsById[summary.candidateId].includes("stage-1-truncated-evidence"))
    .map(({ candidateId }) => candidateId);
  let fallbackPromotion = null;
  if (promotedIds.length === 0) {
    const leader = selectLeader(stage1Summaries.filter(({ candidateId }) => candidateId !== CONTROL_ID));
    if (leader) {
      promotedIds = [leader.candidateId];
      reasonsById[leader.candidateId] = ["stage-1-ranking-fallback"];
      fallbackPromotion = leader.candidateId;
    }
  }
  const stage2Raw = [];
  for (const candidate of CANDIDATES.filter(({ id }) => promotedIds.includes(id))) stage2Raw.push(await runCandidate(candidate, stage2Options));
  const stage2Summaries = stage2Raw.map(summarizeCandidate);
  const finalist = selectLeader(stage2Summaries);
  const stage3Ids = [CONTROL_ID, ...(finalist && finalist.candidateId !== CONTROL_ID ? [finalist.candidateId] : [])];
  const stage3Raw = [];
  for (const candidate of CANDIDATES.filter(({ id }) => stage3Ids.includes(id))) stage3Raw.push(await runCandidate(candidate, stage3Options));
  const diagnosticRaw = await runCandidate(DIAGNOSTIC, diagnosticOptions);
  const stage1ById = Object.fromEntries(stage1Raw.map((raw) => [raw.candidate.id, raw]));
  const stage2ById = Object.fromEntries(stage2Raw.map((raw) => [raw.candidate.id, raw]));
  const stage3ById = Object.fromEntries(stage3Raw.map((raw) => [raw.candidate.id, raw]));
  const candidates = CANDIDATES.map((candidate) => {
    const raw = stage3ById[candidate.id] ?? stage2ById[candidate.id] ?? stage1ById[candidate.id];
    return candidateResult(candidate, raw, stage1ById[candidate.id], stage2ById[candidate.id], stage3ById[candidate.id], reasonsById[candidate.id] ?? []);
  });
  const control = candidates.find(({ candidateId }) => candidateId === CONTROL_ID);
  const diagnosticSummary = summarizeCandidate(diagnosticRaw);
  const diagnosis = diagnoseWall(stage3ById[CONTROL_ID], control, diagnosticRaw, diagnosticSummary);
  const best = selectLeader(candidates);
  const recommendationData = recommendation(candidates, diagnosis);
  return {
    issue: ISSUE,
    title: "Study a TC4 A-effect functional form that can break the e1700 progression wall",
    researchOnly: true,
    noProductionChanges: true,
    sourceCommit: sourceCommit(),
    relationshipToIssue125: "Issue #125 remains status:needs-decision; this report is research input only.",
    targetLog10: TARGET_LOG10,
    evaluatedResetPolicies: EVALUATED_POLICY_IDS,
    resetPolicies: RESET_POLICIES,
    scoreMilestones: TC4_SCORE_MILESTONES,
    candidateDesign: CANDIDATES.map(({ id, aForm, formula, parameters, axis }) => ({ id, aForm, formula, parameters, axis })),
    diagnosticControl: { id: DIAGNOSTIC.id, formula: DIAGNOSTIC.formula, parameters: DIAGNOSTIC.parameters },
    stages: {
      stage1: { options: stage1Options, candidates: stage1Summaries },
      stage2: { options: stage2Options, promotedCandidateIds: promotedIds, fallbackPromotion, candidates: stage2Summaries },
      stage3: { options: stage3Options, candidateIds: stage3Ids, candidates: stage3Raw.map(summarizeCandidate) },
      diagnostic: { options: diagnosticOptions, candidates: [diagnosticSummary] },
    },
    candidates,
    diagnosis,
    bestCandidateId: best?.candidateId ?? null,
    anyReachedE2500: candidates.some(({ bestAdaptive }) => bestAdaptive?.highestMilestone >= 2500),
    anyReachedE7777: candidates.some(({ bestAdaptive }) => bestAdaptive?.highestMilestone >= TARGET_LOG10),
    recommendation: recommendationData,
    uncertainty: [
      "The forms are a bounded hypothesis set, not an exhaustive search of exponent functions or parameters.",
      "Search truncation, route limits, fixed-step simulation, and reset-policy heuristics remain explicit uncertainty.",
      "A successful research form still requires a separate maintainer production decision in #125.",
    ],
  };
}

async function main() {
  const report = await createAFormSearchReport();
  if (process.argv.includes("--write-reports")) {
    const reportDir = path.join(__dirname, "..", "reports");
    fs.writeFileSync(path.join(reportDir, "tc4-a-form-search.json"), `${JSON.stringify(report, null, 2)}\n`);
    fs.writeFileSync(path.join(reportDir, "tc4-a-form-search.md"), formatMarkdown(report));
    process.stdout.write("Wrote reports/tc4-a-form-search.json and reports/tc4-a-form-search.md\n");
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
  CANDIDATES,
  DIAGNOSTIC,
  EVALUATED_POLICY_IDS,
  STAGE_1_OPTIONS,
  STAGE_2_OPTIONS,
  STAGE_3_OPTIONS,
  createAFormSearchReport,
  diagnoseWall,
  formatMarkdown,
};
