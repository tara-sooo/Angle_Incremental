const POLICY_PATHS = [
  /^\.github\/idd\/[a-z0-9._/-]+$/i,
  /^\.github\/instructions\/(?:lite\/)?idd-[a-z0-9-]+\.instructions\.md$/i,
  /^\.github\/workflows\/regression\.yml$/i,
  /^docs\/idd(?:-[^/]+\.md|\/)/i,
  /^docs\/idd-experience\//i,
  /^profiles\/no-advisory\//i,
  /^scripts\/idd-validation-profile\.mjs$/i,
  /^tests\/idd-(?:experience-policy|no-advisory-policy)\.mjs$/i,
  /^tests\/validation-layer-policy\.mjs$/i
];

const ROUTINE_PATHS = [
  /^src\//i,
  /^(?:index\.html|styles\.css)$/i,
  /^tests\/browser\//i,
  /^tests\/(?:browser-harness|browser-smoke|browser-feature-regression|render-regression|performance-smoke|offline-stress|.*module-runtime)\.(?:mjs|js)$/i,
  /^regression-tests-esm\.js$/i
];

const PERFORMANCE_PATHS = [
  /^src\/(?:core|runtime|systems)\//i,
  /^tests\/performance-smoke\.mjs$/i,
  /^scripts\/(?:local-performance-gate|performance-metrics)\.mjs$/i
];

const OFFLINE_PATHS = [
  /^src\/[^/]*offline[^/]*\//i,
  /^src\/.*offline.*\.(?:js|mjs)$/i,
  /^tests\/offline-stress\.mjs$/i
];

const HIGH_RISK_LABELS = new Set([
  "idd-validation:full",
  "idd-validation:performance",
  "idd-validation:offline-stress"
]);

const shaPattern = /^[0-9a-f]{40}$/i;

function fullProfile(reason) {
  return {
    regressionProfile: "full",
    performanceRequired: true,
    offlineStressRequired: true,
    reason
  };
}

function isCleanIntegrationProof(proof, baseRef) {
  return Boolean(
    baseRef === "next" &&
    proof &&
    proof.baseRef === "next" &&
    shaPattern.test(proof.baseSha || "") &&
    Array.isArray(proof.parents) &&
    proof.parents.length === 2 &&
    proof.parents[0] === proof.baseSha &&
    shaPattern.test(proof.parents[1] || "") &&
    proof.secondParentOnMain === true &&
    proof.mergeTreeMatches === true &&
    proof.sourceChecks?.base === true &&
    proof.sourceChecks?.main === true
  );
}

export function classifyValidationProfile(input) {
  if (!input || input.eventName !== "pull_request") {
    return fullProfile("Non-PR or unknown event; retain the full validation floor.");
  }

  const { baseRef, paths, labels = [], integrationProof } = input;
  if (!["main", "next"].includes(baseRef)) {
    return fullProfile("Unknown PR base; retain the full validation floor.");
  }
  if (!Array.isArray(paths) || paths.length === 0 || paths.some((path) =>
    typeof path !== "string" || !path || path.startsWith("/") || path.includes("..")
  ) || !Array.isArray(labels) || labels.some((label) => typeof label !== "string")) {
    return fullProfile("Missing or malformed classification input; fail closed.");
  }

  const normalizedPaths = [...new Set(paths)].sort();
  const normalizedLabels = new Set(labels.map((label) => label.toLowerCase()));
  if ([...normalizedLabels].some((label) =>
    label.startsWith("idd-validation:") && !HIGH_RISK_LABELS.has(label)
  )) {
    return fullProfile("Unknown repository validation marker; fail closed.");
  }
  if (normalizedLabels.has("idd-validation:full")) {
    return fullProfile("Explicit high-risk validation marker.");
  }

  const markedPerformance = normalizedLabels.has("idd-validation:performance");
  const markedOfflineStress = normalizedLabels.has("idd-validation:offline-stress");
  if (isCleanIntegrationProof(integrationProof, baseRef) &&
      !markedPerformance && !markedOfflineStress) {
    return {
      regressionProfile: "integration-only",
      performanceRequired: false,
      offlineStressRequired: false,
      reason: "Verified clean main-to-next merge with trusted source-head checks."
    };
  }

  const performanceRequired = markedPerformance ||
    normalizedPaths.some((path) => PERFORMANCE_PATHS.some((pattern) => pattern.test(path)));
  const offlineStressRequired = markedOfflineStress ||
    normalizedPaths.some((path) => OFFLINE_PATHS.some((pattern) => pattern.test(path)));

  if (normalizedPaths.every((path) => POLICY_PATHS.some((pattern) => pattern.test(path)))) {
    return {
      regressionProfile: "docs-policy",
      performanceRequired,
      offlineStressRequired,
      reason: "Only IDD policy, instructions, classifier, and focused policy tests changed."
    };
  }

  if (normalizedPaths.every((path) => ROUTINE_PATHS.some((pattern) => pattern.test(path)))) {
    return {
      regressionProfile: "routine",
      performanceRequired,
      offlineStressRequired,
      reason: "Known production or regression-test paths; run the regression floor and applicable specialist gates."
    };
  }

  return fullProfile("Unclassified path or insufficient merge proof; retain the full validation floor.");
}

export { isCleanIntegrationProof };
