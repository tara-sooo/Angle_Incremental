export const PERFORMANCE_METRIC_VERSION = 2;
export const BATCH_COUNT = 3;
export const WARMUP_ITERATIONS = 20;
export const TIMED_ITERATIONS = 120;
export const AGGREGATION_STATISTIC = "median-batch-p95";

const metricFields = ["meanMs", "p50Ms", "p95Ms", "maxMs"];

function validateBatch(batch, index) {
  if (!batch || batch.count !== TIMED_ITERATIONS) {
    throw new Error(`performance batch ${index + 1} must contain exactly ${TIMED_ITERATIONS} samples`);
  }
  for (const field of metricFields) {
    if (!Number.isFinite(batch[field]) || batch[field] < 0) {
      throw new Error(`performance batch ${index + 1} has an invalid ${field}`);
    }
  }
  if (batch.p50Ms > batch.p95Ms || batch.p95Ms > batch.maxMs) {
    throw new Error(`performance batch ${index + 1} has inconsistent percentile values`);
  }
}

export function aggregatePerformanceMetric(metric, budgetMs) {
  if (!Number.isFinite(budgetMs) || budgetMs < 0) throw new Error("performance budget must be a non-negative finite number");
  if (!Array.isArray(metric?.batches) || metric.batches.length !== BATCH_COUNT) {
    throw new Error(`performance metric must contain exactly ${BATCH_COUNT} batches`);
  }
  metric.batches.forEach(validateBatch);
  const sortedP95 = metric.batches.map(({ p95Ms }) => p95Ms).sort((left, right) => left - right);
  const aggregateP95Ms = sortedP95[Math.floor(sortedP95.length / 2)];
  const overBudgetBatchCount = metric.batches.filter(({ p95Ms }) => p95Ms > budgetMs).length;
  const passed = aggregateP95Ms <= budgetMs;
  const reason = passed
    ? overBudgetBatchCount === 0
      ? "all independent batch p95 values were within budget"
      : `${overBudgetBatchCount} of ${BATCH_COUNT} batch p95 values exceeded budget; median remained within budget`
    : `${overBudgetBatchCount} of ${BATCH_COUNT} batch p95 values exceeded budget; median exceeded budget`;
  return {
    ...metric,
    metricVersion: PERFORMANCE_METRIC_VERSION,
    batchCount: BATCH_COUNT,
    batches: metric.batches,
    aggregateStatistic: AGGREGATION_STATISTIC,
    p95Ms: aggregateP95Ms,
    aggregateP95Ms,
    budgetMs,
    overBudgetBatchCount,
    passed,
    reason,
  };
}

export function readPerformanceMetricP95(metric, expectedVersion = null) {
  if (expectedVersion !== null && expectedVersion !== undefined && expectedVersion !== PERFORMANCE_METRIC_VERSION) {
    throw new Error(`unsupported performance metric version: ${expectedVersion}`);
  }
  const hasV2Fields = metric?.metricVersion !== undefined
    || Array.isArray(metric?.batches)
    || metric?.batchCount !== undefined
    || metric?.aggregateStatistic !== undefined
    || metric?.aggregateP95Ms !== undefined;
  if (!hasV2Fields) {
    if (expectedVersion === PERFORMANCE_METRIC_VERSION) throw new Error("v2 performance metric is missing batch data");
    if (Number.isFinite(metric?.p95Ms)) return metric.p95Ms;
    throw new Error("performance metric has no finite p95Ms");
  }
  if (metric.metricVersion !== PERFORMANCE_METRIC_VERSION) {
    throw new Error(`unsupported performance metric version: ${metric.metricVersion ?? "missing"}`);
  }
  const normalized = aggregatePerformanceMetric(metric, metric.budgetMs);
  if (metric.batchCount !== normalized.batchCount
    || metric.aggregateStatistic !== normalized.aggregateStatistic
    || metric.p95Ms !== normalized.p95Ms
    || metric.aggregateP95Ms !== normalized.aggregateP95Ms
    || metric.overBudgetBatchCount !== normalized.overBudgetBatchCount
    || metric.passed !== normalized.passed) {
    throw new Error("performance metric aggregate does not match its batches");
  }
  return normalized.p95Ms;
}
