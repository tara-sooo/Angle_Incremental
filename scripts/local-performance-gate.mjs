import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const RUN_COUNT = 3;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const performanceReportName = path.join("output", "performance-smoke.json");
const gateReportPath = path.join(repoRoot, "output", "local-performance-gate.json");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const legacyQualityMarkers = [
  "rebuilt the static cache",
  "geometry change",
  "unknown render quality mode",
  "vertex limit",
  "frame interval",
  "backing scale",
  "automatic quality",
  "hidden canvas",
];

export function budgetViolationKey(violation) {
  return String(violation)
    .replace(/ -?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?ms was not faster than exact -?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?ms$/i, "")
    .replace(/ -?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?ms > -?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?ms$/i, "")
    .replace(/ -?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)? > -?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i, "")
    .trim();
}

function git(args, cwd = repoRoot) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    timeout: 5 * 60 * 1000,
  });
  if (result.error) throw new Error(`${command} ${args.join(" ")} failed: ${result.error.message}`);
  if (result.signal) throw new Error(`${command} ${args.join(" ")} stopped by ${result.signal}`);
  return result.status ?? 1;
}

function isLegacyQualityViolation(value) {
  return legacyQualityMarkers.some((marker) => value.includes(marker));
}

function splitViolations(report) {
  if (!Array.isArray(report.violations)) throw new Error("performance report has no violations array");
  const budgetViolations = Array.isArray(report.budgetViolations)
    ? report.budgetViolations
    : report.violations.filter((violation) => !isLegacyQualityViolation(violation));
  const qualityViolations = Array.isArray(report.qualityViolations)
    ? report.qualityViolations
    : report.violations.filter(isLegacyQualityViolation);
  return { budgetViolations, qualityViolations };
}

function collectFailingScenarioP95(report) {
  const budgets = report.budgets || {};
  const failures = [];
  const simulationResults = report.simulationResults || report.results || [];
  const renderResults = report.renderResults || report.results || [];
  for (const result of simulationResults) {
    for (const scenario of result.scenarios || []) {
      const prefix = `${result.viewport.name}/DPR${result.deviceScaleFactor}`;
      const metrics = [
        [`${prefix}/angle/${scenario.vertices}`, "simulation", scenario.angle?.simulation?.p95Ms, budgets.simulationP95Ms],
        [`${prefix}/infinite-angle/${scenario.vertices}`, "simulation", scenario.infiniteAngle?.simulation?.p95Ms, budgets.simulationP95Ms],
      ];
      for (const [scenarioName, metric, p95Ms, budgetMs] of metrics) {
        if (Number.isFinite(p95Ms) && Number.isFinite(budgetMs) && p95Ms > budgetMs) {
          failures.push({ scenario: scenarioName, metric, p95Ms, budgetMs });
        }
      }
    }
  }
  for (const result of renderResults) {
    for (const scenario of result.scenarios || []) {
      const prefix = `${result.viewport.name}/DPR${result.deviceScaleFactor}`;
      const metrics = [
        [
          `${prefix}/angle/${scenario.vertices}`,
          "frame",
          scenario.angle?.frame?.p95Ms,
          scenario.vertices >= 10000 ? budgets.highLoadFrameP95Ms : budgets.normalFrameP95Ms,
        ],
        [`${prefix}/infinite-angle/${scenario.vertices}`, "frame", scenario.infiniteAngle?.frame?.p95Ms, budgets.highLoadFrameP95Ms],
      ];
      for (const [scenarioName, metric, p95Ms, budgetMs] of metrics) {
        if (Number.isFinite(p95Ms) && Number.isFinite(budgetMs) && p95Ms > budgetMs) {
          failures.push({ scenario: scenarioName, metric, p95Ms, budgetMs });
        }
      }
    }
  }
  return failures;
}

function readPerformanceReport(cwd) {
  const reportPath = path.join(cwd, performanceReportName);
  if (!existsSync(reportPath)) throw new Error(`missing performance report: ${reportPath}`);
  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch (error) {
    throw new Error(`invalid performance report: ${error.message}`);
  }
  if (!Array.isArray(report.simulationResults || report.results)
    || !Array.isArray(report.renderResults || report.results)) {
    throw new Error(`invalid performance report results: ${reportPath}`);
  }
  const { budgetViolations, qualityViolations } = splitViolations(report);
  return {
    status: report.status,
    budgetViolations,
    qualityViolations,
    violationKeys: budgetViolations.map(budgetViolationKey),
    failingScenarioP95: collectFailingScenarioP95(report),
  };
}

function measure(cwd, role, index) {
  const reportPath = path.join(cwd, performanceReportName);
  rmSync(reportPath, { force: true });
  const exitCode = runCommand(npmCommand, ["run", "test:performance"], cwd);
  const report = readPerformanceReport(cwd);
  if (report.status !== "passed" && report.budgetViolations.length === 0 && report.qualityViolations.length === 0) {
    throw new Error(`${role} performance report failed without a classified violation`);
  }
  return { role, index, exitCode, ...report };
}

function violationKeys(run) {
  return new Set(run.violationKeys || (run.budgetViolations || []).map(budgetViolationKey));
}

export function classifyRuns(candidateRuns, baselineRuns) {
  if (candidateRuns.length !== RUN_COUNT || baselineRuns.length !== RUN_COUNT) {
    throw new Error(`expected ${RUN_COUNT} candidate and baseline runs`);
  }
  const allKeys = new Set(candidateRuns.flatMap((run) => [...violationKeys(run)]));
  const hasCandidateFailure = candidateRuns.some((run) => violationKeys(run).size > 0);
  const baselineIsClean = baselineRuns.every((run) => violationKeys(run).size === 0);
  const candidateOnlyFailures = [...allKeys].filter((key) => (
    candidateRuns.every((run) => violationKeys(run).has(key)) && baselineIsClean
  ));
  const sharedFailures = [...allKeys].filter((key) => (
    candidateRuns.every((run) => violationKeys(run).has(key))
      && baselineRuns.every((run) => violationKeys(run).has(key))
  ));
  const movingFailures = [...allKeys].filter((key) => !candidateOnlyFailures.includes(key) && !sharedFailures.includes(key));

  if (candidateOnlyFailures.length > 0) {
    return {
      classification: "local-performance-regression",
      reason: "the same candidate-only timing failure repeated in all three candidate runs",
      candidateOnlyFailures,
      sharedFailures,
      movingFailures,
      hostedCiRequired: false,
    };
  }
  if (!hasCandidateFailure) {
    return {
      classification: "local-performance-pass",
      reason: "candidate runs had no timing-budget failures",
      candidateOnlyFailures,
      sharedFailures,
      movingFailures,
      hostedCiRequired: false,
    };
  }
  return {
    classification: "local-performance-inconclusive",
    reason: sharedFailures.length > 0
      ? "candidate and trusted base shared the same timing failure"
      : "timing failures were moving or not reproducible on the trusted base",
    candidateOnlyFailures,
    sharedFailures,
    movingFailures,
    hostedCiRequired: true,
  };
}

function environment() {
  return {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    cpu: os.cpus()[0]?.model || null,
  };
}

function writeGateReport(report) {
  mkdirSync(path.dirname(gateReportPath), { recursive: true });
  writeFileSync(gateReportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function gateReport({ candidateSha, branch, baseSha, candidateRuns, baselineRuns, decision }) {
  return {
    generatedAt: new Date().toISOString(),
    classification: decision.classification,
    reason: decision.reason,
    candidateSha,
    branch,
    trustedBase: baseSha ? { ref: "origin/next", sha: baseSha } : null,
    environment: environment(),
    runs: { candidate: candidateRuns, baseline: baselineRuns },
    evidence: {
      candidateOnlyFailures: decision.candidateOnlyFailures,
      sharedFailures: decision.sharedFailures,
      movingFailures: decision.movingFailures,
    },
    hostedCiRequired: decision.hostedCiRequired,
    hostedCiNote: "Hosted CI must still pass the absolute npm run test:performance budgets after a local-performance-inconclusive result.",
  };
}

function assertTimingOnly(runs) {
  for (const run of runs) {
    if (run.qualityViolations.length > 0) {
      throw new Error(`${run.role} performance smoke found non-timing failures: ${run.qualityViolations.join("; ")}`);
    }
    if (run.exitCode !== 0 && run.budgetViolations.length === 0) {
      throw new Error(`${run.role} performance smoke failed without timing-budget evidence`);
    }
  }
}

function main() {
  const branch = git(["branch", "--show-current"]);
  const candidateSha = git(["rev-parse", "HEAD"]);
  const candidateRuns = [measure(repoRoot, "candidate", 1)];
  const baselineRuns = [];

  if (candidateRuns[0].qualityViolations.length > 0 || candidateRuns[0].budgetViolations.length === 0) {
    assertTimingOnly(candidateRuns);
    if (candidateRuns[0].exitCode !== 0) throw new Error("candidate performance smoke failed without a comparable timing failure");
    const decision = classifyRuns(
      [candidateRuns[0], candidateRuns[0], candidateRuns[0]],
      [candidateRuns[0], candidateRuns[0], candidateRuns[0]],
    );
    const report = gateReport({ candidateSha, branch, baseSha: null, candidateRuns, baselineRuns, decision });
    writeGateReport(report);
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (!/^(?:issue\/\d+-|next$)/.test(branch)) {
    throw new Error(`trusted local performance comparison requires an issue/* or next branch, got ${branch || "detached HEAD"}`);
  }
  if (runCommand("git", ["fetch", "origin", "next"], repoRoot) !== 0) {
    throw new Error("trusted-base fetch failed");
  }
  const baseSha = git(["rev-parse", "refs/remotes/origin/next^{commit}"]);
  if (git(["rev-parse", "HEAD"]) !== candidateSha) throw new Error("candidate HEAD changed during performance setup");
  const ancestry = spawnSync("git", ["merge-base", "--is-ancestor", baseSha, candidateSha], { cwd: repoRoot });
  if (ancestry.error || ancestry.status !== 0) throw new Error("candidate branch is behind the freshly fetched origin/next; sync before comparing performance");

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "angle-incremental-performance-"));
  const baselineRoot = path.join(tempRoot, "baseline");
  let baselineWorktreeAdded = false;
  try {
    execFileSync("git", ["worktree", "add", "--detach", baselineRoot, baseSha], { cwd: repoRoot, stdio: "inherit" });
    baselineWorktreeAdded = true;
    if (runCommand(npmCommand, ["ci"], baselineRoot) !== 0) throw new Error("trusted-base npm ci failed");
    for (let index = 2; index <= RUN_COUNT; index += 1) {
      baselineRuns.push(measure(baselineRoot, "baseline", index - 1));
      candidateRuns.push(measure(repoRoot, "candidate", index));
    }
    baselineRuns.push(measure(baselineRoot, "baseline", RUN_COUNT));
  } finally {
    if (baselineWorktreeAdded) {
      execFileSync("git", ["worktree", "remove", "--force", baselineRoot], { cwd: repoRoot, stdio: "inherit" });
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }

  assertTimingOnly([...candidateRuns, ...baselineRuns]);
  const decision = classifyRuns(candidateRuns, baselineRuns);
  const report = gateReport({ candidateSha, branch, baseSha, candidateRuns, baselineRuns, decision });
  writeGateReport(report);
  console.log(JSON.stringify(report, null, 2));
  if (decision.classification === "local-performance-regression") process.exitCode = 1;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error);
    process.exitCode = 1;
  }
}
