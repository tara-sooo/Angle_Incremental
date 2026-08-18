const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { CANDIDATES } = require("../scripts/simulate-tc4-a-form-search.js");
const {
  RESET_POLICIES,
  TARGET_LOG10,
  prepareCandidate,
  replayCompactFrontierNode,
  runSearch,
} = require("../scripts/simulate-tc4-balance.js");
const {
  CANDIDATE_ID,
  STAGE_PLAN,
  canExtendCompletedCase,
  readCheckpoint,
  serializeSearchState,
  sourceReportFingerprint,
  writeCheckpoint,
} = require("../scripts/simulate-tc4-log-frontier-continuation.js");

async function main() {
  const source = sourceReportFingerprint();
  const candidate = CANDIDATES.find(({ id }) => id === CANDIDATE_ID);
  const policy = RESET_POLICIES.find(({ id }) => id === "fixed-60");
  assert.equal(source.report.noProductionChanges, true);
  assert.deepEqual(source.report.candidateDefinitions.map(({ sourceCandidateId }) => sourceCandidateId), [
    "flat-A1.00-B0.35-C1",
    "log-A1.00-B0.35-C1",
    "flat-A2.00-diagnostic",
  ]);
  assert.equal(source.report.candidates.length, 3);
  assert.equal(STAGE_PLAN["gain-aware-2x"][1].id, "route-cap-30");
  assert.equal(STAGE_PLAN["threshold-aware"][1].id, "route-cap-30");
  assert.equal(STAGE_PLAN["gain-aware-2x"][0].expectedReason, "route-cap");
  assert.equal(STAGE_PLAN["threshold-aware"][0].expectedReason, "route-cap");
  assert.equal(canExtendCompletedCase({
    stages: [{ summary: { truncated: true, truncationReason: "route-cap" } }],
  }, "gain-aware-2x"), true);

  const context = await prepareCandidate(candidate, {
    maxSeconds: 120,
    stepSeconds: 10,
    maxStates: 1,
    maxRoutes: 3,
    stallSeconds: 60,
    targetLog10: TARGET_LOG10,
    continuationMaxStates: 2,
  });
  const options = { ...context.searchOptions, captureContinuation: true };
  const partial = runSearch(context.runtime, context.rootSnapshot, candidate, options, context.collision, false, policy);
  assert.equal(partial.truncationReason, "state-cap");
  assert.ok(partial.frontier.length > 0);
  const replayed = replayCompactFrontierNode(context, partial.frontier[0], policy, options);
  assert.equal(replayed.purchases.length, partial.frontier[0].purchaseSequence.length);
  assert.throws(() => replayCompactFrontierNode(context, {
    ...partial.frontier[0],
    levels: { ...partial.frontier[0].levels, baseGain: 99 },
  }, policy, options), /frontier replay mismatch/);

  let progress;
  const checkpointed = runSearch(context.runtime, context.rootSnapshot, candidate, {
    ...options,
    maxStates: 1,
    checkpointInterval: 1,
    onProgress: (state) => {
      progress = serializeSearchState(state);
    },
  }, context.collision, false, policy);
  assert.equal(checkpointed.truncationReason, "state-cap");
  assert.ok(progress);
  const resumedOptions = { ...options, maxStates: 2 };
  const resumed = runSearch(
    context.runtime,
    context.rootSnapshot,
    candidate,
    resumedOptions,
    context.collision,
    false,
    policy,
    {
      ...progress,
      pending: progress.pending.map((node) => ({
        ...node,
        candidate,
        policy,
        options: resumedOptions,
        debug: resumedOptions.debug,
      })),
    },
  );
  const resumedAgain = runSearch(
    context.runtime,
    context.rootSnapshot,
    candidate,
    resumedOptions,
    context.collision,
    false,
    policy,
    {
      ...progress,
      pending: progress.pending.map((node) => ({
        ...node,
        candidate,
        policy,
        options: resumedOptions,
        debug: resumedOptions.debug,
      })),
    },
  );
  assert.deepEqual(
    { reason: resumed.truncationReason, frontier: resumed.frontier, routes: resumed.routes },
    { reason: resumedAgain.truncationReason, frontier: resumedAgain.frontier, routes: resumedAgain.routes },
  );

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "tc4-log-frontier-"));
  try {
    const checkpointPath = path.join(directory, "checkpoint.json");
    const fingerprint = { issue: 139, sourceReportSha256: source.sha256 };
    const legacyFingerprint = { ...fingerprint, stagePlan: { "gain-aware-2x": [{ id: "state-cap-160" }] } };
    writeCheckpoint(checkpointPath, { schemaVersion: 1, fingerprint: legacyFingerprint, cases: {} });
    assert.deepEqual(readCheckpoint(checkpointPath, fingerprint).fingerprint, legacyFingerprint);
    assert.equal(fs.existsSync(checkpointPath), true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
  const changedFiles = execFileSync("git", ["diff", "--name-only", "origin/next...HEAD"], { encoding: "utf8" })
    .trim().split("\n").filter(Boolean);
  assert.equal(changedFiles.some((file) => file.startsWith("src/")), false);
  console.log("TC4 retained log-A frontier continuation tests passed");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
