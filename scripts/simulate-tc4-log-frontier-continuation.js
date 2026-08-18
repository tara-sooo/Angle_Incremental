const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { CANDIDATES } = require("./simulate-tc4-a-form-search.js");
const {
  RESET_POLICIES,
  TARGET_LOG10,
  TC4_SCORE_MILESTONES,
  prepareCandidate,
  replayCompactFrontierNode,
  runSearch,
  summarizeSearch,
} = require("./simulate-tc4-balance.js");

const ISSUE = 139;
const CANDIDATE_ID = "log-A1.00-B0.35-C1";
const SOURCE_REPORT_PATH = path.join(__dirname, "..", "reports", "tc4-a-form-frontier.json");
const DEFAULT_CHECKPOINT_PATH = path.join(__dirname, "..", "reports", "tc4-log-frontier-continuation.checkpoint.json");
const DEFAULT_REPORT_PATH = path.join(__dirname, "..", "reports", "tc4-log-frontier-continuation.json");
const DEFAULT_MARKDOWN_PATH = path.join(__dirname, "..", "reports", "tc4-log-frontier-continuation.md");
const CHECKPOINT_SCHEMA_VERSION = 1;
const REPLAY_MODE = "reconstructed-frontier";
const TC4_PRICE_DEFINITIONS = Object.freeze({
  baseGain: Object.freeze({ baseLog10: 100, stepLog10: 800 }),
  infinityScoreVertexGain: Object.freeze({ baseLog10: 500, stepLog10: 1200 }),
  freeCoreBoost: Object.freeze({ baseLog10: 900, stepLog10: 1600 }),
});
const STAGE_PLAN = Object.freeze({
  "fixed-60": Object.freeze([
    Object.freeze({ id: "route-cap-30", maxStates: 160, maxRoutes: 30, expectedReason: "route-cap" }),
    Object.freeze({ id: "route-cap-60", maxStates: 320, maxRoutes: 60, expectedReason: "route-cap" }),
  ]),
  "gain-aware-2x": Object.freeze([
    Object.freeze({ id: "state-cap-160", maxStates: 160, maxRoutes: 10, expectedReason: "state-cap" }),
    Object.freeze({ id: "route-cap-30", maxStates: 160, maxRoutes: 30, expectedReason: "route-cap" }),
  ]),
  "threshold-aware": Object.freeze([
    Object.freeze({ id: "state-cap-160", maxStates: 160, maxRoutes: 10, expectedReason: "state-cap" }),
    Object.freeze({ id: "route-cap-30", maxStates: 160, maxRoutes: 30, expectedReason: "route-cap" }),
  ]),
});
const POLICY_IDS = Object.freeze(Object.keys(STAGE_PLAN));

function jsonReplacer(key, value) {
  if (typeof value === "number" && !Number.isFinite(value)) return { __number__: String(value) };
  return value;
}

function jsonReviver(key, value) {
  if (value && typeof value === "object" && Object.keys(value).length === 1 && value.__number__) {
    return Number(value.__number__);
  }
  return value;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"), jsonReviver);
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = filePath + "." + process.pid + ".tmp";
  fs.writeFileSync(temporaryPath, JSON.stringify(value, jsonReplacer, 2) + "\n");
  fs.renameSync(temporaryPath, filePath);
}

function writeTextAtomic(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = filePath + "." + process.pid + ".tmp";
  fs.writeFileSync(temporaryPath, text);
  fs.renameSync(temporaryPath, filePath);
}

function sourceReportFingerprint(filePath = SOURCE_REPORT_PATH) {
  const bytes = fs.readFileSync(filePath);
  return {
    report: JSON.parse(bytes.toString("utf8")),
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
}

function candidateDefinition(report) {
  const candidate = report.candidateDefinitions.find(({ sourceCandidateId }) => sourceCandidateId === CANDIDATE_ID);
  assert.deepEqual(candidate?.parameters, { A: 1, logBase: 2, B: 0.35, C: 1 });
  assert.equal(candidate?.aForm, "logarithmic-accumulation");
  return candidate;
}

function sourcePolicy(report, policyId) {
  const candidate = report.candidates.find(({ candidateId }) => candidateId === CANDIDATE_ID);
  assert.ok(candidate, "missing source candidate " + CANDIDATE_ID);
  const frontier = candidate.frontierSearch.find(({ policy }) => policy === policyId);
  assert.ok(frontier, "missing source policy " + policyId);
  assert.equal(frontier.allLegal.continuation.frontierCount > 0, true);
  return frontier;
}

function searchOptions(report, overrides = {}) {
  return {
    maxSeconds: report.options.maxSeconds,
    stepSeconds: report.options.stepSeconds,
    maxRoutes: report.options.maxRoutes,
    stallSeconds: report.options.stallSeconds,
    targetLog10: report.targetLog10 ?? TARGET_LOG10,
    captureContinuation: true,
    ...overrides,
  };
}

function serializeNode(node) {
  const { debug, options, ...serializable } = node;
  return serializable;
}

function serializeSearchState(state) {
  return {
    pending: (state.pending ?? []).map(serializeNode),
    seen: [...(state.seen ?? [])],
    routes: state.routes ?? [],
    exploredStates: state.exploredStates ?? 0,
  };
}

function hydrateSearchState(state, candidate, policy, options) {
  return {
    pending: (state?.pending ?? []).map((node) => ({
      ...node,
      candidate,
      policy,
      options,
      debug: options.debug,
    })),
    seen: state?.seen ?? [],
    routes: state?.routes ?? [],
    exploredStates: state?.exploredStates ?? 0,
  };
}

function checkpointFingerprint(report, sha256) {
  return {
    issue: ISSUE,
    mode: REPLAY_MODE,
    sourceReportSha256: sha256,
    sourceReportCommit: report.sourceCommit,
    candidateId: CANDIDATE_ID,
    policyIds: POLICY_IDS,
    sourceOptions: report.options,
  };
}

function newCheckpoint(fingerprint) {
  return {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    fingerprint,
    cases: {},
  };
}

function readCheckpoint(filePath, fingerprint) {
  if (!filePath || !fs.existsSync(filePath)) return newCheckpoint(fingerprint);
  const checkpoint = readJson(filePath);
  assert.equal(checkpoint.schemaVersion, CHECKPOINT_SCHEMA_VERSION, "continuation checkpoint schema mismatch");
  const { stagePlan: ignoredStagePlan, ...checkpointFingerprintWithoutStagePlan } = checkpoint.fingerprint;
  const { stagePlan: currentStagePlan, ...fingerprintWithoutStagePlan } = fingerprint;
  assert.deepEqual(checkpointFingerprintWithoutStagePlan, fingerprintWithoutStagePlan, "continuation checkpoint fingerprint mismatch");
  assert.ok(checkpoint.cases && typeof checkpoint.cases === "object" && !Array.isArray(checkpoint.cases));
  return checkpoint;
}

function canExtendCompletedCase(caseState, policyId) {
  const nextStage = STAGE_PLAN[policyId]?.[caseState.stages?.length];
  const lastSummary = caseState.stages?.at(-1)?.summary;
  return Boolean(nextStage && lastSummary?.truncated && lastSummary.truncationReason === nextStage.expectedReason);
}

function writeCheckpoint(filePath, checkpoint) {
  if (filePath) writeJsonAtomic(filePath, checkpoint);
}

function milestoneEvidence(routes) {
  const firstReach = Object.fromEntries(TC4_SCORE_MILESTONES.map((milestone) => {
    const times = routes
      .map((route) => route.milestoneTimes?.["e" + milestone])
      .filter((time) => Number.isFinite(time));
    return ["e" + milestone, times.length ? Math.min(...times) : null];
  }));
  const highest = TC4_SCORE_MILESTONES.filter((milestone) => firstReach["e" + milestone] !== null).at(-1) ?? null;
  return { firstReach, highestMilestone: highest };
}

function routeEvidence(routes) {
  const best = routes.reduce((current, route) => (
    route.peakScoreLog10 > (current?.peakScoreLog10 ?? -Infinity) ? route : current
  ), null);
  const bestSuccessful = routes
    .filter((route) => route.status === "success")
    .reduce((current, route) => route.peakScoreLog10 > (current?.peakScoreLog10 ?? -Infinity) ? route : current, null);
  const nextLegalPrices = best?.finalPriceSteps
    ? Object.fromEntries(Object.entries(TC4_PRICE_DEFINITIONS).map(([kind, definition]) => [
      kind,
      definition.baseLog10 + definition.stepLog10 * best.finalPriceSteps[kind],
    ]))
    : null;
  return {
    bestLegalRoute: best,
    bestSuccessfulRoute: bestSuccessful,
    nextLegalPrices,
  };
}

function caseKey(policyId) {
  return CANDIDATE_ID + "::" + policyId;
}

function initialCaseState(policyId, source, nodes) {
  return {
    candidateId: CANDIDATE_ID,
    policyId,
    status: "running",
    stageIndex: 0,
    replay: {
      mode: REPLAY_MODE,
      sourceFrontierCount: source.allLegal.continuation.frontierCount,
      replayedEntryCount: nodes.length,
      historicalSeenAndRoutesAvailable: false,
    },
    resume: serializeSearchState({ pending: nodes, seen: [], routes: [], exploredStates: 0 }),
    stages: [],
  };
}

async function reconstructCase(report, policyId) {
  const candidate = CANDIDATES.find(({ id }) => id === CANDIDATE_ID);
  assert.ok(candidate, "missing simulator candidate " + CANDIDATE_ID);
  const policy = RESET_POLICIES.find(({ id }) => id === policyId);
  assert.ok(policy, "missing reset policy " + policyId);
  const source = sourcePolicy(report, policyId);
  const context = await prepareCandidate(candidate, searchOptions(report, { maxStates: 1, maxRoutes: 1 }));
  const nodes = source.allLegal.continuation.frontier.map((compact) => (
    replayCompactFrontierNode(context, compact, policy, context.searchOptions)
  ));
  return { candidate, policy, context, source, state: initialCaseState(policyId, source, nodes) };
}

function caseReport(caseState) {
  const routes = caseState.stages.flatMap(({ routes: stageRoutes }) => stageRoutes ?? []);
  const best = routeEvidence(routes);
  return {
    candidateId: caseState.candidateId,
    policyId: caseState.policyId,
    replay: caseState.replay,
    stages: caseState.stages.map(({ state, nextResume, ...stage }) => stage),
    finalStatus: caseState.status,
    finalLimiter: caseState.stages.at(-1)?.summary?.truncationReason ?? null,
    finalMilestones: routes.length ? milestoneEvidence(routes) : null,
    bestLegalRoute: best.bestLegalRoute,
    bestSuccessfulRoute: best.bestSuccessfulRoute,
    nextLegalPrices: best.nextLegalPrices,
  };
}

async function runContinuation(overrides = {}, execution = {}) {
  const sourcePath = overrides.sourceReportPath ?? SOURCE_REPORT_PATH;
  const { report, sha256 } = sourceReportFingerprint(sourcePath);
  candidateDefinition(report);
  const fingerprint = checkpointFingerprint(report, sha256);
  const checkpointPath = overrides.checkpointPath ?? DEFAULT_CHECKPOINT_PATH;
  const checkpoint = readCheckpoint(checkpointPath, fingerprint);
  const maxCases = execution.maxCases ?? Infinity;
  let processedCases = 0;

  for (const policyId of POLICY_IDS) {
    if (processedCases >= maxCases) break;
    const key = caseKey(policyId);
    let caseState = checkpoint.cases[key];
    if (caseState?.status === "complete" && !canExtendCompletedCase(caseState, policyId)) continue;
    const reconstructed = await reconstructCase(report, policyId);
    const { candidate, policy, context } = reconstructed;
    caseState ??= reconstructed.state;
    if (caseState.status === "complete") caseState.status = "running";
    checkpoint.cases[key] = caseState;
    checkpoint.fingerprint = fingerprint;
    writeCheckpoint(checkpointPath, checkpoint);

    let resume = caseState.resume;
    for (let index = caseState.stageIndex; index < STAGE_PLAN[policyId].length; index += 1) {
      const stage = STAGE_PLAN[policyId][index];
      if (caseState.stages[index]?.status === "complete") {
        resume = caseState.stages[index].nextResume;
        continue;
      }
      const stageOptions = searchOptions(report, {
        maxStates: stage.maxStates,
        maxRoutes: stage.maxRoutes,
        checkpointInterval: execution.checkpointInterval ?? 10,
        debug: context.searchOptions.debug,
      });
      const saveProgress = (state) => {
        caseState.status = "running";
        caseState.stageIndex = index;
        caseState.resume = serializeSearchState(state);
        writeCheckpoint(checkpointPath, checkpoint);
      };
      stageOptions.onProgress = saveProgress;
      saveProgress(hydrateSearchState(resume, candidate, policy, stageOptions));
      const search = runSearch(
        context.runtime,
        context.rootSnapshot,
        candidate,
        stageOptions,
        context.collision,
        false,
        policy,
        hydrateSearchState(resume, candidate, policy, stageOptions),
      );
      const summary = summarizeSearch(search);
      caseState.stages[index] = {
        id: stage.id,
        limiter: stage.expectedReason,
        options: { maxStates: stage.maxStates, maxRoutes: stage.maxRoutes },
        summary,
        routes: search.routes,
        status: "complete",
        nextResume: search.continuation ? serializeSearchState(search.continuation) : null,
      };
      caseState.stageIndex = index + 1;
      caseState.resume = caseState.stages[index].nextResume;
      writeCheckpoint(checkpointPath, checkpoint);
      const canExtend = search.truncated
        && search.truncationReason === stage.expectedReason
        && index + 1 < STAGE_PLAN[policyId].length;
      if (!canExtend) {
        caseState.status = "complete";
        writeCheckpoint(checkpointPath, checkpoint);
        break;
      }
      resume = caseState.resume;
    }
    processedCases += 1;
  }

  const complete = POLICY_IDS.every((policyId) => checkpoint.cases[caseKey(policyId)]?.status === "complete");
  if (complete && execution.reportPath !== null) {
    const allTruncated = POLICY_IDS.some((policyId) => checkpoint.cases[caseKey(policyId)].stages.at(-1)?.summary?.truncated);
    const output = {
      issue: ISSUE,
      title: "Extend the retained TC4 log-A frontier through e7777 reachability",
      researchOnly: true,
      noProductionChanges: true,
      mode: REPLAY_MODE,
      sourceReport: {
        path: path.relative(path.join(__dirname, ".."), sourcePath),
        sha256,
        sourceCommit: report.sourceCommit,
      },
      candidate: candidateDefinition(report),
      fixedParameters: { A: 1, B: 0.35, C: 1 },
      options: report.options,
      stagePlan: STAGE_PLAN,
      cases: POLICY_IDS.map((policyId) => caseReport(checkpoint.cases[caseKey(policyId)])),
      progressionAssessment: {
        e7777Reached: POLICY_IDS.some((policyId) => checkpoint.cases[caseKey(policyId)].stages
          .flatMap(({ routes }) => routes ?? [])
          .some((route) => route.status === "success" && route.milestoneTimes?.e7777 !== undefined)),
        searchCapacityStillOpen: POLICY_IDS.some((policyId) => checkpoint.cases[caseKey(policyId)].stages
          .at(-1)?.summary?.truncated),
        interpretation: "e7777 is reached by reconstructed legal routes, but adaptive cases terminate at route-cap; this does not establish a complete retained-frontier conclusion.",
      },
      outcome: allTruncated
        ? {
          status: "still search-inconclusive",
          reason: "the reconstructed retained frontier still reached an explicit bounded search limiter",
          basis: "historical full pending/seen/routes checkpoint was unavailable; continuation evidence is bounded from the validated reconstruction boundary",
        }
        : {
          status: "production decision supportable",
          reason: "all reconstructed retained policy frontiers completed without a search limiter",
          basis: "deterministic focused continuation under fixed A/B/C",
        },
    };
    writeJsonAtomic(execution.reportPath ?? DEFAULT_REPORT_PATH, output);
    if (execution.markdownPath !== null) writeTextAtomic(execution.markdownPath ?? DEFAULT_MARKDOWN_PATH, formatMarkdown(output));
    return { complete: true, report: output, checkpoint };
  }
  return { complete, checkpoint };
}

function formatMarkdown(report) {
  const lines = [
    "# TC4 log-A retained-frontier continuation (Issue #" + report.issue + ")",
    "",
    "> Research evidence only. No production TC4 formula, pricing, lifecycle, or #125 decision was changed.",
    "",
    "- Mode: **" + report.mode + "**; the historical full pending/seen/routes checkpoint was unavailable.",
    "- Source report: **" + report.sourceReport.path + "** (" + report.sourceReport.sha256 + ")",
    "- Source report commit: **" + report.sourceReport.sourceCommit + "**",
    "- Candidate: **" + report.candidate.id + "**; fixed parameters **A=1, B=0.35, C=1**",
    "- Stage plan: " + Object.entries(report.stagePlan).map(([policy, stages]) => policy + "=" + stages.map(({ id }) => id).join(" → ")).join("; "),
    "",
    "## Policy results",
    "",
    "| Policy | Replay entries | Stages | Final limiter | Highest milestone |",
    "| --- | ---: | --- | --- | ---: |",
  ];
  report.cases.forEach((entry) => lines.push(
    "| " + entry.policyId + " | " + entry.replay.replayedEntryCount + " | "
      + entry.stages.map(({ id, summary }) => id + ": " + summary.exploredStates + " states/" + summary.routeCount + " routes/" + summary.truncationReason).join("; ")
      + " | " + (entry.finalLimiter ?? "—") + " | e" + (entry.finalMilestones?.highestMilestone ?? "—") + " |",
  ));
  lines.push("", "## Required milestone first-reach", "");
  report.cases.forEach((entry) => {
    const first = entry.finalMilestones?.firstReach ?? {};
    lines.push("- **" + entry.policyId + "**: " + TC4_SCORE_MILESTONES.map((milestone) => "e" + milestone + "=" + (first["e" + milestone] ?? "not reached")).join(", "));
  });
  lines.push("", "## Best legal route evidence", "");
  report.cases.forEach((entry) => {
    const route = entry.bestLegalRoute;
    lines.push("- **" + entry.policyId + "**: " + (route ? route.status + " / " + route.reason + " / peak e" + route.peakScoreLog10.toFixed(0) + "; levels=" + JSON.stringify(route.finalLevels) + "; priceSteps=" + JSON.stringify(route.finalPriceSteps) + "; resets=" + JSON.stringify(route.infinityResetTimes) + "; next prices=" + JSON.stringify(entry.nextLegalPrices) : "no terminal route"));
  });
  lines.push("", "## Outcome", "", "- Status: **" + report.outcome.status + "**", "- Reason: **" + report.outcome.reason + "**", "- Basis: **" + report.outcome.basis + "**", "- Interpretation: " + report.progressionAssessment.interpretation, "- #125 remains status:needs-decision.");
  return lines.join("\n") + "\n";
}

if (require.main === module) {
  runContinuation({
    checkpointPath: process.argv.includes("--no-checkpoint") ? null : undefined,
    reportPath: process.argv.includes("--write-reports") ? undefined : null,
    markdownPath: process.argv.includes("--write-reports") ? undefined : null,
  }).then((result) => {
    process.stdout.write(JSON.stringify({ complete: result.complete }, null, 2) + "\n");
  }).catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  CANDIDATE_ID,
  DEFAULT_CHECKPOINT_PATH,
  POLICY_IDS,
  STAGE_PLAN,
  formatMarkdown,
  hydrateSearchState,
  readCheckpoint,
  readJson,
  runContinuation,
  serializeSearchState,
  sourceReportFingerprint,
  writeCheckpoint,
  writeJsonAtomic,
};
