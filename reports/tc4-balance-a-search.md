# TC4 A-Focused Balance Search (Issue #127)

> Research output only. Production TC4 formulas and #125 status:needs-decision are unchanged.

- Target: **1e7777 Score**
- Candidates: **A0.40-B0.35-C1, A0.50-B0.35-C1, A0.60-B0.35-C1, A0.80-B0.35-C1, A1.00-B0.35-C1**
- Policies: **fixed-60, gain-aware-2x, threshold-aware**

## Search stages

| Stage | Horizon | States | Routes | Stall bound | Candidates |
| --- | ---: | ---: | ---: | ---: | ---: |
| stage1 | 4.00h | 20 | 10 | 4.00h | 5 |
| stage2 | 12.00h | 20 | 10 | 4.00h | 4 |
| stage3 | 24.00h | 20 | 10 | 4.00h | 2 |

## Baseline reproduction

- Reference: **1916.508 log10 peak / e1700 milestone** (reports/tc4-balance-sensitivity.json)
- Observed: **e1917 peak / e1700 milestone** at **stage-3**
- Peak delta: **0.000 log10**; milestone match: **yes**

## Freshness after #128 / PR #130

The report was refreshed against `next` at **3f21ad8** after achievements 38–39 and the #131 reward correction merged. A Stage 3-equivalent representative check (24h / 20 states / 10 routes / 4h stall) found small peak shifts from the pre-#128 report, with no additional shift from #131 and no decision shift:

| Candidate | Previous peak | Current peak | Δ peak | Highest milestone | e1700 time | e2500 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| A0.40-B0.35-C1 | 1916.508 | 1916.698 | +0.190 | 1700 → 1700 | 3350s → 3340s | not reached |
| A1.00-B0.35-C1 | 2396.543 | 2396.780 | +0.237 | 1700 → 1700 | 140s → 140s | not reached |

The A direction, selected neighborhood, e1700 ceiling, and e2500/e7777 conclusion are unchanged; #131 adds no further shift, and #125 remains a maintainer decision gate.

## Candidate results

| Candidate | Stage | Classification | Best policy | Highest milestone | Peak | Promotion |
| --- | --- | --- | --- | ---: | ---: | --- |
| A0.40-B0.35-C1 | stage-3 | failed | threshold-aware | 1700 | e1917 | A0.40-reference-baseline |
| A0.50-B0.35-C1 | stage-2 | failed | threshold-aware | 1700 | e1955 | peak-plus-1-log10-than-A0.40-baseline, 10-percent-faster-common-milestone |
| A0.60-B0.35-C1 | stage-2 | failed | threshold-aware | 1700 | e2023 | peak-plus-1-log10-than-A0.40-baseline, 10-percent-faster-common-milestone |
| A0.80-B0.35-C1 | stage-2 | failed | threshold-aware | 1700 | e2225 | peak-plus-1-log10-than-A0.40-baseline, 10-percent-faster-common-milestone |
| A1.00-B0.35-C1 | stage-3 | failed | threshold-aware | 1700 | e2397 | peak-plus-1-log10-than-A0.40-baseline, 10-percent-faster-common-milestone |

## Deltas versus A0.40 baseline

| Candidate | A | Δ peak log10 | Δ milestone | Common milestone | Δ common time | Δ resets | Reset timing | Terminal purchase |
| --- | ---: | ---: | ---: | --- | ---: | ---: | --- | --- |
| A0.40-B0.35-C1 | 0.40 | 0.000 | 0 | 1700 | 0s | 0 | 34210 / 34210 | baseGain@e1700 |
| A0.50-B0.35-C1 | 0.50 | 38.860 | 0 | 1700 | -2230s | 0 | 18840 / 34210 | baseGain@e1700 |
| A0.60-B0.35-C1 | 0.60 | 106.469 | 0 | 1700 | -2970s | 0 | 10550 / 34210 | baseGain@e1700 |
| A0.80-B0.35-C1 | 0.80 | 308.904 | 0 | 1700 | -3210s | -1 | none / 34210 | baseGain@e1700 |
| A1.00-B0.35-C1 | 1.00 | 480.035 | 0 | 1700 | -3210s | -1 | none / 34210 | baseGain@e1700 |

## Observed marginal A response

| From A | To A | ΔA | Δ peak log10 | Δ milestone | Time gain ratio | Candidates |
| ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 0.50 | 0.60 | 0.10 | 67.609 | 0 | 88.7% | A0.50-B0.35-C1 → A0.60-B0.35-C1 |
| 0.60 | 0.80 | 0.20 | 202.435 | 0 | 95.8% | A0.60-B0.35-C1 → A0.80-B0.35-C1 |
| 0.80 | 1.00 | 0.20 | 171.131 | 0 | 95.8% | A0.80-B0.35-C1 → A1.00-B0.35-C1 |

## Recommendation

- Status: **a-only-scaling-insufficient**
- Reason: **the highest bounded A probe remains below e2500**
- Basis candidate: **A1.00-B0.35-C1**
- Reached e2500: **no**; e7777: **no**
- Next step: **study the A functional form before increasing the flat coefficient further**

## Remaining uncertainty

- The A response is observed only at the tested values from 0.40 through 1.00; it does not establish monotonicity or justify extrapolation.
- Search truncation, route limits, and simulator policy differences remain explicit uncertainty rather than production evidence.
