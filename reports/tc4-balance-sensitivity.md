# TC4 Balance Sensitivity Probe (Issue #119)

> Research output only. No production TC4 constants/formulas or #98 decision state are changed.

- Target: **1e7777 Score**
- Probes: **8** (the resolved #117 3x3 is not rerun)
- Policies: **fixed-60, gain-aware-2x, threshold-aware**

## Search stages

| Stage | Horizon | States | Routes | Stall bound | Candidates |
| --- | ---: | ---: | ---: | ---: | ---: |
| stage1 | 4.00h | 20 | 10 | 4.00h | 8 |
| stage2 | 12.00h | 20 | 10 | 4.00h | 5 |
| stage3 | 24.00h | 20 | 10 | 4.00h | 2 |

## Baseline reproduction

- Reference: **1813.562 log10 peak / e1700 milestone** (reports/tc4-balance-followup.json)
- Observed: **e1814 peak / e1700 milestone** at **stage-3**
- Peak delta: **0.000 log10**; milestone match: **yes**

## Probe results

| Candidate | Axis | Stage | Classification | Best policy | Highest milestone | Peak Score | Promotion |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| A0.25-B0.35-C1 | baseline | stage-3 | failed | threshold-aware | 1700 | e1814 | strongest-117-baseline |
| A0.30-B0.35-C1 | A-only | stage-2 | failed | threshold-aware | 1700 | e1820 | higher-milestone-than-strongest-117-baseline, peak-plus-1-log10-than-strongest-117-baseline |
| A0.40-B0.35-C1 | A-only | stage-3 | failed | threshold-aware | 1700 | e1917 | higher-milestone-than-strongest-117-baseline, peak-plus-1-log10-than-strongest-117-baseline |
| A0.25-B0.80-C1 | B-only | stage-1 | failed | threshold-aware | 900 | e1690 | not promoted |
| A0.25-B1.00-C1 | B-only | stage-1 | failed | threshold-aware | 900 | e1690 | not promoted |
| A0.30-B0.80-C1 | A+B | stage-2 | failed | threshold-aware | 1700 | e1820 | higher-milestone-than-strongest-117-baseline, peak-plus-1-log10-than-strongest-117-baseline |
| A0.40-B1.00-C1 | A+B | stage-2 | failed | threshold-aware | 1700 | e1888 | higher-milestone-than-strongest-117-baseline, peak-plus-1-log10-than-strongest-117-baseline |
| A0.25-B0.35-C2 | C-strength | stage-2 | failed | threshold-aware | 1700 | e1828 | higher-milestone-than-strongest-117-baseline, peak-plus-1-log10-than-strongest-117-baseline |

## Deltas versus strongest #117 baseline

| Candidate | Axis | Δ peak log10 | Δ milestone | Common milestone | Δ common time | Δ resets | Reset timing | Terminal purchase |
| --- | --- | ---: | ---: | --- | ---: | ---: | --- | --- |
| A0.25-B0.35-C1 | baseline | 0.000 | 0 | 1700 | 0s | 0 | 53010, 86400 / 53010, 86400 | baseGain@e1700 |
| A0.30-B0.35-C1 | A-only | 6.599 | 0 | 1700 | -8290s | 0 | 29300 / 53010, 86400 | baseGain@e1700 |
| A0.40-B0.35-C1 | A-only | 102.946 | 0 | 1700 | -15360s | 0 | 34210 / 53010, 86400 | baseGain@e1700 |
| A0.25-B0.80-C1 | B-only | -123.473 | -1 | 900 | 0s | -1 | none / 53010, 86400 | baseGain@e900 |
| A0.25-B1.00-C1 | B-only | -123.473 | -1 | 900 | 0s | -1 | none / 53010, 86400 | baseGain@e900 |
| A0.30-B0.80-C1 | A+B | 6.599 | 0 | 1700 | -8290s | 0 | 29300 / 53010, 86400 | baseGain@e1700 |
| A0.40-B1.00-C1 | A+B | 74.201 | 0 | 1700 | -15360s | 0 | 34210 / 53010, 86400 | baseGain@e1700 |
| A0.25-B0.35-C2 | C-strength | 14.294 | 0 | 1700 | -12010s | 0 | 30300 / 53010, 86400 | baseGain@e1700 |

## Marginal evidence

| Axis | Observed candidates | Eligible candidates | Best candidate | Δ milestone | Δ peak log10 | Best time gain |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| A-only | A0.30-B0.35-C1, A0.40-B0.35-C1 | A0.30-B0.35-C1, A0.40-B0.35-C1 | A0.40-B0.35-C1 | 0 | 102.946 | 82.1% |
| B-only | A0.25-B0.80-C1, A0.25-B1.00-C1 | none | — | — | — | — |
| A+B | A0.30-B0.80-C1, A0.40-B1.00-C1 | A0.30-B0.80-C1, A0.40-B1.00-C1 | A0.40-B1.00-C1 | 0 | 74.201 | 82.1% |
| C-strength | A0.25-B0.35-C2 | A0.25-B0.35-C2 | A0.25-B0.35-C2 | 0 | 14.294 | 64.2% |

## Recommendation

- Status: **bounded-recommendation**
- Direction: **increase A**
- Evidence axis: **A-only**
- Basis/reason: **A0.40-B0.35-C1**
- Reached e2500: **no**; e7777: **no**
- C-strength remains a research parameter; production semantics require the separate #98 maintainer decision.

## Remaining uncertainty

- Stage 1 truncation is retained explicitly and is not treated as a failed balance verdict.
- The probes identify measured sensitivity only; they do not establish monotonicity or production C semantics.
