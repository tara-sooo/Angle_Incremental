const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
  CANDIDATES,
  DIAGNOSTIC,
  EVALUATED_POLICY_IDS,
} = require("./simulate-tc4-a-form-search.js");
const {
  TC4_SCORE_MILESTONES,
  runCandidatePolicy,
  summarizeCandidate,
} = require("./simulate-tc4-balance.js");

const ISSUE = 136;
const SOURCE_ISSUE = 134;
const TARGET_LOG10 = 7777;
const CHECKPOINT_SCHEMA_VERSION = 1;
const DEFAULT_CHECKPOINT_PATH = path.join(__dirname, "..", "reports", "tc4-a-form-frontier.checkpoint.json");
const FRONTIER_CANDIDATE_IDS = Object.freeze([
  "flat-A1.00-B0.35-C1",
  "log-A1.00-B0.35-C1",
  "flat-A2.00-diagnostic",
]);
const SEED_OPTIONS = Object.freeze({
  maxSeconds: 86_400,
  stepSeconds: 10,
  maxStates: 20,
  maxRoutes: 10,
  stallSeconds: 14_400,
  targetLog10: TARGET_LOG10,
  policyIds: EVALUATED_POLICY_IDS,
  continuationMaxStates: 80,
});

const candidateById = new Map([
  ...CANDIDATES.map((candidate) => [candidate.id, candidate]),
  [DIAGNOSTIC.id, DIAGNOSTIC],
]);
const FRONTIER_CANDIDATES = Object.freeze(FRONTIER_CANDIDATE_IDS.map((id) => {
  const candidate = candidateById.get(id);
  if (!candidate) throw new Error("Missing frontier candidate: " + id);
  return candidate;
}));

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

function candidateDefinition(candidate) {
  if (candidate.id === DIAGNOSTIC.id) {
    return {
      id: "flat-A2.00",
      sourceCandidateId: candidate.id,
      aForm: "flat-additive",
      formula: "E = parts + 2.00 * level",
      parameters: { A: 2, B: 0.35, C: 1 },
      axis: "magnitude-only-diagnostic",
    };
  }
  return {
    id: candidate.id,
    sourceCandidateId: candidate.id,
    aForm: candidate.aForm,
    formula: candidate.formula,
    parameters: candidate.parameters,
    axis: candidate.axis,
  };
}

function caseKeys(options) {
  return FRONTIER_CANDIDATES.flatMap((candidate) => options.policyIds.map((policyId) => (
    candidate.id + "::" + policyId
  )));
}

function checkpointFingerprint(options, source) {
  return {
    issue: ISSUE,
    sourceIssue: SOURCE_ISSUE,
    sourceCommit: source,
    candidateIds: [...FRONTIER_CANDIDATE_IDS],
    options: {
      maxSeconds: options.maxSeconds,
      stepSeconds: options.stepSeconds,
      maxStates: options.maxStates,
      continuationMaxStates: options.continuationMaxStates,
      maxRoutes: options.maxRoutes,
      stallSeconds: options.stallSeconds,
      targetLog10: options.targetLog10,
      policyIds: [...options.policyIds],
    },
  };
}

function newCheckpoint(fingerprint) {
  return {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    fingerprint,
    completed: {},
  };
}

function readCheckpoint(checkpointPath, fingerprint, options) {
  if (!checkpointPath || !fs.existsSync(checkpointPath)) return newCheckpoint(fingerprint);
  let checkpoint;
  try {
    checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
  } catch (error) {
    throw new Error("Cannot parse frontier checkpoint: " + error.message);
  }
  if (checkpoint.schemaVersion !== CHECKPOINT_SCHEMA_VERSION
    || JSON.stringify(checkpoint.fingerprint) !== JSON.stringify(fingerprint)
    || !checkpoint.completed
    || typeof checkpoint.completed !== "object"
    || Array.isArray(checkpoint.completed)) {
    throw new Error("Frontier checkpoint fingerprint/schema mismatch; remove it or resume with the matching source and options");
  }
  const allowed = new Set(caseKeys(options));
  Object.entries(checkpoint.completed).forEach(([key, entry]) => {
    if (!allowed.has(key)
      || !entry
      || entry.candidateId + "::" + entry.policyId !== key
      || !entry.policy) {
      throw new Error("Frontier checkpoint contains an invalid case: " + key);
    }
  });
  return checkpoint;
}

function writeCheckpoint(checkpointPath, checkpoint, options) {
  if (!checkpointPath) return;
  const directory = path.dirname(checkpointPath);
  fs.mkdirSync(directory, { recursive: true });
  const complete = caseKeys(options).every((key) => checkpoint.completed[key]);
  const payload = {
    ...checkpoint,
    complete,
    completedCaseKeys: Object.keys(checkpoint.completed).sort(),
  };
  const temporaryPath = checkpointPath + "." + process.pid + ".tmp";
  fs.writeFileSync(temporaryPath, JSON.stringify(payload, null, 2) + "\n");
  fs.renameSync(temporaryPath, checkpointPath);
}

function serializeCaseResult(raw, candidateId, policyId) {
  return {
    candidateId,
    policyId,
    fixture: raw.fixture,
    collision: raw.collision,
    searchComplete: raw.searchComplete,
    searchOptions: raw.searchOptions,
    policy: raw.policies[0],
  };
}

function rawCandidatesFromCheckpoint(checkpoint) {
  return FRONTIER_CANDIDATES.map((candidate) => {
    const entries = checkpoint.fingerprint.options.policyIds.map((policyId) => (
      checkpoint.completed[candidate.id + "::" + policyId]
    ));
    if (entries.some((entry) => !entry)) throw new Error("Frontier checkpoint is incomplete");
    const first = entries[0];
    return {
      candidate,
      fixture: first.fixture,
      collision: first.collision,
      searchComplete: first.searchComplete,
      searchOptions: first.searchOptions,
      canonical: first.policy.canonical,
      allLegal: first.policy.allLegal,
      policies: entries.map((entry) => entry.policy),
    };
  });
}

async function runFrontierCases(inputOptions, execution = {}) {
  const options = {
    ...SEED_OPTIONS,
    ...(inputOptions || {}),
    policyIds: [...(inputOptions?.policyIds || SEED_OPTIONS.policyIds)],
  };
  const source = sourceCommit();
  const fingerprint = checkpointFingerprint(options, source);
  const checkpoint = readCheckpoint(execution.checkpointPath, fingerprint, options);
  const keys = caseKeys(options);
  let newCases = 0;
  for (const candidate of FRONTIER_CANDIDATES) {
    for (const policyId of options.policyIds) {
      const key = candidate.id + "::" + policyId;
      if (checkpoint.completed[key]) continue;
      if (Number.isInteger(execution.maxNewCases) && newCases >= execution.maxNewCases) {
        writeCheckpoint(execution.checkpointPath, checkpoint, options);
        return {
          complete: false,
          checkpoint,
          completedCaseKeys: Object.keys(checkpoint.completed).sort(),
          totalCaseCount: keys.length,
        };
      }
      const raw = await runCandidatePolicy(candidate, policyId, options);
      checkpoint.completed[key] = serializeCaseResult(raw, candidate.id, policyId);
      writeCheckpoint(execution.checkpointPath, checkpoint, options);
      newCases += 1;
      if (execution.onCaseComplete) await execution.onCaseComplete({
        key,
        completedCaseCount: Object.keys(checkpoint.completed).length,
        totalCaseCount: keys.length,
      });
    }
  }
  writeCheckpoint(execution.checkpointPath, checkpoint, options);
  return {
    complete: keys.every((key) => checkpoint.completed[key]),
    checkpoint,
    completedCaseKeys: Object.keys(checkpoint.completed).sort(),
    totalCaseCount: keys.length,
    rawCandidates: rawCandidatesFromCheckpoint(checkpoint),
  };
}

function frontierSearchEvidence(raw) {
  return raw.policies.map(({ policy, canonical, allLegal }) => ({
    policy: policy.id,
    canonical: {
      seed: canonical.seedSummary,
      continuation: canonical.summary,
    },
    allLegal: {
      seed: allLegal.seedSummary,
      continuation: allLegal.summary,
    },
  }));
}

function finalSearchesComplete(candidate) {
  return candidate.frontierSearch.every(({ canonical, allLegal }) => (
    !canonical.continuation.truncated && !allLegal.continuation.truncated
  ));
}

function compareProgress(left, right) {
  const leftMilestone = left && left.bestAdaptive ? left.bestAdaptive.highestMilestoneIndex : -1;
  const rightMilestone = right && right.bestAdaptive ? right.bestAdaptive.highestMilestoneIndex : -1;
  if (leftMilestone !== rightMilestone) return leftMilestone - rightMilestone;
  const leftPeak = left && left.bestAdaptive ? left.bestAdaptive.peakScoreLog10 : -Infinity;
  const rightPeak = right && right.bestAdaptive ? right.bestAdaptive.peakScoreLog10 : -Infinity;
  return leftPeak - rightPeak;
}

function outcome(candidates) {
  if (candidates.some((candidate) => !finalSearchesComplete(candidate))) {
    return {
      status: "still search-inconclusive",
      reason: "the bounded frontier continuation still has a state-cap or route-cap result",
      basis: "continuation remained incomplete at the explicit total state budget of 80",
    };
  }
  const flatA1 = candidates.find(({ candidateId }) => candidateId === FRONTIER_CANDIDATE_IDS[0]);
  const logA1 = candidates.find(({ candidateId }) => candidateId === FRONTIER_CANDIDATE_IDS[1]);
  const flatA2 = candidates.find(({ candidateId }) => candidateId === FRONTIER_CANDIDATE_IDS[2]);
  const logBeatsA2 = compareProgress(logA1, flatA2) > 0;
  const magnitudeBeatsControl = compareProgress(flatA2, flatA1) > 0;
  if (logBeatsA2) {
    return {
      status: "one narrow refinement",
      reason: "log-A progression exceeds the single flat-A2 magnitude diagnostic under the bounded comparison",
      basis: "functional-form effect remains after the magnitude control",
    };
  }
  if (magnitudeBeatsControl) {
    return {
      status: "A-only insufficient",
      reason: "the flat-A2 magnitude diagnostic improves on flat-A1 without a measured log-A advantage",
      basis: "magnitude explains the observed gain within this bounded comparison",
    };
  }
  return {
    status: "production decision supportable",
    reason: "the bounded three-candidate comparison is complete without a material functional-form or magnitude frontier advantage",
    basis: "all required routes completed under the fixed deterministic semantics",
  };
}

function formatSeconds(seconds) {
  if (!Number.isFinite(seconds)) return "not reached";
  if (seconds < 3600) return Math.round(seconds) + "s";
  return (seconds / 3600).toFixed(2) + "h";
}

function formatPeak(value) {
  return Number.isFinite(value) ? "e" + value.toFixed(0) : "not reached";
}

function formatMilestones(candidate) {
  const times = candidate.bestAdaptive ? candidate.bestAdaptive.firstMilestoneTimes : {};
  return TC4_SCORE_MILESTONES.map((milestone) => (
    "e" + milestone + "=" + formatSeconds(times["e" + milestone])
  )).join(", ");
}

function formatFrontier(entry) {
  const purchases = entry.purchaseSequence.map(({ kind, priceLog10 }) => kind + "@e" + priceLog10).join(" → ") || "root";
  return purchases
    + "; levels=" + JSON.stringify(entry.levels)
    + "; steps=" + JSON.stringify(entry.priceSteps)
    + "; peak=" + formatPeak(entry.peakScoreLog10);
}

function formatMarkdown(report) {
  const lines = [
    "# TC4 log-A Frontier Verification (Issue #" + report.issue + ")",
    "",
    "> Research output only. No production TC4 formula, pricing, B/C parameter, lifecycle, or #125 decision was changed.",
    "",
    "- Source issue: #" + report.sourceIssue,
    "- Source HEAD: " + (report.sourceCommit || "unknown"),
    "- Deterministic options: " + report.options.maxSeconds + "s horizon / " + report.options.stepSeconds + "s step / " + report.options.stallSeconds + "s stall",
    "- Frontier budget: seed " + report.options.seedMaxStates + " states → total " + report.options.continuationMaxStates + " states; " + report.options.maxRoutes + " routes",
    "- Policies: " + report.options.policyIds.join(", "),
    "- Milestones: " + TC4_SCORE_MILESTONES.map((milestone) => "e" + milestone).join(", "),
    "",
    "## Candidate formulas",
    "",
    "| Candidate | Formula | Parameters | Axis |",
    "| --- | --- | --- | --- |",
  ];
  report.candidateDefinitions.forEach((candidate) => lines.push(
    "| " + candidate.id + " | " + candidate.formula + " | " + JSON.stringify(candidate.parameters) + " | " + candidate.axis + " |",
  ));
  lines.push(
    "",
    "## Result summary",
    "",
    "| Candidate | Best policy | Highest milestone | Peak | All final searches complete |",
    "| --- | --- | ---: | ---: | --- |",
  );
  report.candidates.forEach((candidate) => lines.push(
    "| " + candidate.candidateId
      + " | " + (candidate.bestAdaptivePolicy || "—")
      + " | e" + (candidate.bestAdaptive ? candidate.bestAdaptive.highestMilestone : "—")
      + " | " + formatPeak(candidate.bestAdaptive && candidate.bestAdaptive.peakScoreLog10)
      + " | " + (finalSearchesComplete(candidate) ? "yes" : "no") + " |",
  ));
  lines.push("", "## Required milestone first-reach times", "");
  report.candidates.forEach((candidate) => lines.push(
    "- **" + candidate.candidateId + " / " + (candidate.bestAdaptivePolicy || "—") + "**: " + formatMilestones(candidate),
  ));
  lines.push(
    "",
    "## Frontier and truncation evidence",
    "",
    "| Candidate | Policy | Canonical seed | Canonical continuation | All-legal seed | All-legal continuation |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  report.candidates.forEach((candidate) => candidate.frontierSearch.forEach((policy) => {
    const cell = (search) => search.exploredStates + " states, " + search.routeCount + " routes, " + search.truncationReason + ", frontier " + search.frontierCount;
    lines.push(
      "| " + candidate.candidateId + " | " + policy.policy
        + " | " + cell(policy.canonical.seed)
        + " | " + cell(policy.canonical.continuation)
        + " | " + cell(policy.allLegal.seed)
        + " | " + cell(policy.allLegal.continuation) + " |",
    );
    ["canonical", "allLegal"].forEach((mode) => {
      const seed = policy[mode].seed;
      if (seed.frontier.length > 0) {
        lines.push(
          "  - " + candidate.candidateId + " / " + policy.policy + " / " + mode
            + " seed frontier: " + seed.frontier.map(formatFrontier).join(" || "),
        );
      }
    });
  }));
  lines.push(
    "",
    "## Terminal route evidence",
    "",
    "Terminal allocations, levels, price steps, reset timings, and post-frontier progress are retained in the JSON report under each final search's terminalAllocations.",
    "",
  );
  report.candidates.forEach((candidate) => candidate.frontierSearch.forEach((policy) => {
    ["canonical", "allLegal"].forEach((mode) => {
      policy[mode].continuation.terminalAllocations.forEach((terminal) => lines.push(
        "- **" + candidate.candidateId + " / " + policy.policy + " / " + mode + "**: "
          + terminal.status + " (" + terminal.reason + ") at " + formatSeconds(terminal.elapsedSeconds)
          + "; levels " + JSON.stringify(terminal.finalLevels)
          + "; prices " + JSON.stringify(terminal.finalPriceSteps)
          + "; resets " + JSON.stringify(terminal.infinityResetTimes),
      ));
    });
  }));
  lines.push(
    "",
    "## Outcome",
    "",
    "- Status: **" + report.outcome.status + "**",
    "- Reason: **" + report.outcome.reason + "**",
    "- Basis: **" + report.outcome.basis + "**",
    "- #125 remains status:needs-decision; this evidence does not select production TC4 constants.",
  );
  return lines.join("\n") + "\n";
}

async function createFrontierVerificationReport(overrides = {}, execution = {}) {
  const options = {
    ...SEED_OPTIONS,
    ...(overrides || {}),
    policyIds: [...(overrides.policyIds || SEED_OPTIONS.policyIds)],
  };
  const run = await runFrontierCases(options, execution);
  if (!run.complete) throw new Error("Frontier verification is incomplete; resume from the checkpoint before writing the final report");
  const rawCandidates = run.rawCandidates;
  const candidates = rawCandidates.map((raw) => ({
    ...summarizeCandidate(raw),
    frontierSearch: frontierSearchEvidence(raw),
  }));
  return {
    issue: ISSUE,
    title: "Verify the TC4 log-A route frontier and distinguish magnitude from functional-form improvement",
    researchOnly: true,
    noProductionChanges: true,
    sourceIssue: SOURCE_ISSUE,
    sourceCommit: sourceCommit(),
    relationshipToIssue125: "Issue #125 remains status:needs-decision; this report is research input only.",
    targetLog10: TARGET_LOG10,
    options: {
      maxSeconds: options.maxSeconds,
      stepSeconds: options.stepSeconds,
      stallSeconds: options.stallSeconds,
      maxRoutes: options.maxRoutes,
      seedMaxStates: options.maxStates,
      continuationMaxStates: options.continuationMaxStates,
      policyIds: options.policyIds,
    },
    candidateDefinitions: FRONTIER_CANDIDATES.map(candidateDefinition),
    candidates,
    execution: {
      caseCount: run.totalCaseCount,
      completedCaseCount: run.completedCaseKeys.length,
      resumable: true,
    },
    outcome: outcome(candidates),
  };
}

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function main() {
  const checkpointPath = process.argv.includes("--no-checkpoint")
    ? null
    : argumentValue("--checkpoint", DEFAULT_CHECKPOINT_PATH);
  const report = await createFrontierVerificationReport({}, {
    checkpointPath,
    onCaseComplete: ({ key, completedCaseCount, totalCaseCount }) => {
      process.stderr.write("[frontier] completed " + key + " (" + completedCaseCount + "/" + totalCaseCount + ")\n");
    },
  });
  if (process.argv.includes("--write-reports")) {
    const reportDir = path.join(__dirname, "..", "reports");
    fs.writeFileSync(path.join(reportDir, "tc4-a-form-frontier.json"), JSON.stringify(report, null, 2) + "\n");
    fs.writeFileSync(path.join(reportDir, "tc4-a-form-frontier.md"), formatMarkdown(report));
    process.stdout.write("Wrote reports/tc4-a-form-frontier.json and reports/tc4-a-form-frontier.md\n");
    return;
  }
  process.stdout.write(process.argv.includes("--markdown") ? formatMarkdown(report) : JSON.stringify(report, null, 2) + "\n");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  FRONTIER_CANDIDATE_IDS,
  FRONTIER_CANDIDATES,
  SEED_OPTIONS,
  createFrontierVerificationReport,
  finalSearchesComplete,
  formatMarkdown,
  runFrontierCases,
  outcome,
};
