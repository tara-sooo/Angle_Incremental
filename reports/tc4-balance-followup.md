# TC4 Balance Follow-up (Issue #117)

> Research output only. No production TC4 constants are selected or changed.

- Target: **1e7777 Score**
- Candidates evaluated: **8** non-baseline values from the existing 3x3 grid
- Policies: **fixed-60, gain-aware-2x, threshold-aware**
- Milestones: **e900, e1700, e2500, e2900, e3300, e4100, e4900, e5300, e5700, e6500, e7300, e7700, e7777**

## Search stages

| Stage | Horizon | States | Routes | Stall bound | Candidates |
| --- | ---: | ---: | ---: | ---: | --- |
| stage1 | 4.00h | 20 | 10 | 4.00h | 8 |
| stage2 | 12.00h | 20 | 10 | 4.00h | 8 |
| stage3 | 24.00h | 20 | 10 | 4.00h | 1 |

## Candidate A baseline

- Options comparable to Issue #112: **yes**
- Within tolerance: **yes**
- Classification: **failed**
- Best adaptive policy: **threshold-aware**
- Best adaptive peak: **e1779**

## Promotion and final results

| Candidate | Promotion reason | Evidence | Classification | Best policy | Highest milestone | Peak Score |
| --- | --- | --- | --- | --- | ---: | ---: |
| A0.15-B0.35-C1 | best-adaptive-matched-or-exceeded-candidate-a-fixed-60 | stage-2 | failed | threshold-aware | e900 | e1686 |
| A0.15-B0.50-C1 | best-adaptive-matched-or-exceeded-candidate-a-fixed-60 | stage-2 | failed | threshold-aware | e900 | e1686 |
| A0.15-B0.65-C1 | best-adaptive-matched-or-exceeded-candidate-a-fixed-60 | stage-2 | failed | threshold-aware | e900 | e1686 |
| A0.20-B0.35-C1 | best-adaptive-matched-or-exceeded-candidate-a-fixed-60 | stage-2 | failed | threshold-aware | e1700 | e1753 |
| A0.20-B0.65-C1 | best-adaptive-matched-or-exceeded-candidate-a-fixed-60 | stage-2 | failed | threshold-aware | e1700 | e1753 |
| A0.25-B0.35-C1 | best-adaptive-matched-or-exceeded-candidate-a-fixed-60 | stage-3 | failed | threshold-aware | e1700 | e1814 |
| A0.25-B0.50-C1 | best-adaptive-matched-or-exceeded-candidate-a-fixed-60 | stage-2 | failed | threshold-aware | e1700 | e1786 |
| A0.25-B0.65-C1 | best-adaptive-matched-or-exceeded-candidate-a-fixed-60 | stage-2 | failed | threshold-aware | e1700 | e1786 |

- Deterministic adaptive ranking: **A0.25-B0.35-C1 → A0.25-B0.50-C1 → A0.25-B0.65-C1 → A0.20-B0.35-C1 → A0.20-B0.65-C1 → A0.15-B0.35-C1 → A0.15-B0.50-C1 → A0.15-B0.65-C1**
- Reached e2500: **no**
- Reached e7777: **no**

## Required milestone first-reach times

- **A0.15-B0.35-C1 / threshold-aware**: e900=10s, e1700=not reached, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached
- **A0.15-B0.50-C1 / threshold-aware**: e900=10s, e1700=not reached, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached
- **A0.15-B0.65-C1 / threshold-aware**: e900=10s, e1700=not reached, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached
- **A0.20-B0.35-C1 / threshold-aware**: e900=10s, e1700=9.47h, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached
- **A0.20-B0.65-C1 / threshold-aware**: e900=10s, e1700=9.47h, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached
- **A0.25-B0.35-C1 / threshold-aware**: e900=10s, e1700=5.20h, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached
- **A0.25-B0.50-C1 / threshold-aware**: e900=10s, e1700=5.20h, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached
- **A0.25-B0.65-C1 / threshold-aware**: e900=10s, e1700=5.20h, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached

## Terminal evidence (best adaptive policy)

| Candidate | End reason | Last purchase | Infinity resets | Last progress | Final levels | Final price steps |
| --- | --- | --- | --- | ---: | --- | --- |
| A0.15-B0.35-C1 | horizon reached | baseGain@e900 | none | 12.00h | baseGain=2, infinityScoreVertexGain=1, freeCoreBoost=1 | baseGain=2, infinityScoreVertexGain=1, freeCoreBoost=1 |
| A0.15-B0.50-C1 | horizon reached | baseGain@e900 | none | 12.00h | baseGain=2, infinityScoreVertexGain=1, freeCoreBoost=1 | baseGain=2, infinityScoreVertexGain=1, freeCoreBoost=1 |
| A0.15-B0.65-C1 | horizon reached | baseGain@e900 | none | 12.00h | baseGain=2, infinityScoreVertexGain=1, freeCoreBoost=1 | baseGain=2, infinityScoreVertexGain=1, freeCoreBoost=1 |
| A0.20-B0.35-C1 | horizon reached | baseGain@e1700 | none | 12.00h | baseGain=3, infinityScoreVertexGain=1, freeCoreBoost=1 | baseGain=3, infinityScoreVertexGain=2, freeCoreBoost=1 |
| A0.20-B0.65-C1 | horizon reached | baseGain@e1700 | none | 12.00h | baseGain=3, infinityScoreVertexGain=1, freeCoreBoost=1 | baseGain=3, infinityScoreVertexGain=2, freeCoreBoost=1 |
| A0.25-B0.35-C1 | horizon reached | baseGain@e1700 | none | 24.00h | baseGain=3, infinityScoreVertexGain=1, freeCoreBoost=1 | baseGain=3, infinityScoreVertexGain=2, freeCoreBoost=1 |
| A0.25-B0.50-C1 | horizon reached | baseGain@e1700 | none | 12.00h | baseGain=3, infinityScoreVertexGain=1, freeCoreBoost=1 | baseGain=3, infinityScoreVertexGain=2, freeCoreBoost=1 |
| A0.25-B0.65-C1 | horizon reached | baseGain@e1700 | none | 12.00h | baseGain=3, infinityScoreVertexGain=1, freeCoreBoost=1 | baseGain=3, infinityScoreVertexGain=2, freeCoreBoost=1 |

Representative milestone snapshots are retained in the machine-readable report under each candidate's selected evidence summary; route lists are intentionally not duplicated.

## Maintainer recommendation for #98

- Recommendation status: **bounded-recommendation**
- Basis: **A0.25-B0.35-C1**
- Direction: **increase B**
- Gap to e2500: **686.4379817635438 log10**
- Next region: **one bounded neighboring region only; maintainer decision required before another sweep**
- Keep #98 at `status:needs-decision`; choose production A/B/C semantics or authorize a bounded next research region in a separate maintainer decision.

## Caveats

- Stage 1 is identical across all eight candidates; promoted candidates have explicitly stronger evidence.
- Truncated searches remain inconclusive and are never silently classified as failed.
- This report does not modify production formulas or automatically unblock #98.
