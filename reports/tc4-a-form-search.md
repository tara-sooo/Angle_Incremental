# TC4 A-Effect Functional-Form Study (Issue #134)

> Research output only. Production TC4 formulas and #125 status:needs-decision are unchanged.

- Source HEAD: **3b3fe21586987e34ef093c3452d9bb7335a6997e**
- Policies: **fixed-60, gain-aware-2x, threshold-aware**
- Milestones: **e900, e1700, e2500, e2900, e3300, e4100, e4900, e5300, e5700, e6500, e7300, e7700, e7777**

## Search stages

| Stage | Horizon | States | Routes | Stall bound | Candidates |
| --- | ---: | ---: | ---: | ---: | ---: |
| stage1 | 4.00h | 20 | 10 | 4.00h | 4 |
| stage2 | 12.00h | 20 | 10 | 4.00h | 1 |
| stage3 | 24.00h | 20 | 10 | 4.00h | 2 |
| diagnostic | 24.00h | 20 | 10 | 4.00h | 1 |

## Phase-1 wall diagnosis

- Classification: **coefficient-magnitude-plausible**
- Flat control: **e2397 / e1700**
- Single A=2.00 diagnostic: **e4072 / e3300** (Δ peak 1674.941)
- Flat terminal state: **{"baseGain":3,"infinityScoreVertexGain":1,"freeCoreBoost":0}**, price steps **{"baseGain":3,"infinityScoreVertexGain":2,"freeCoreBoost":1}**
- Next legal prices: **{"baseGain":2500,"infinityScoreVertexGain":2900,"freeCoreBoost":2500}**
- A exponent contribution: **3** (parts 7)
- Late score behavior: **{"terminalScoreLog10":2344.3630547184634,"peakScoreLog10":2344.3630547184634,"peakScoreAtSeconds":86400,"lastProgressAtSeconds":86400,"terminalToPeakDeltaLog10":0,"terminalScoreLog10PerSecond":0.027133831651834067,"peakScoreLog10PerSecond":0.027133831651834067,"noNewPeakForSeconds":0,"horizonSeconds":86400}**
- Shared price-step sequence length: **4**

The A=2.00 run is a single magnitude diagnostic; it is not a coefficient sweep or a production recommendation.

## Candidate results

| Candidate | Formula | Parameters | Stage | Classification | Best policy | Highest milestone | Peak | e2500/e7777 |
| --- | --- | --- | --- | --- | --- | ---: | ---: | --- |
| flat-A1.00-B0.35-C1 | E = parts + A * level | {"A":1,"B":0.35,"C":1} | stage-3 | failed | threshold-aware | e1700 | e2397 | no/no |
| power-A1.00-B0.35-C1 | E = parts + A * level^1.25 | {"A":1,"power":1.25,"B":0.35,"C":1} | stage-1 | inconclusive | threshold-aware | e1700 | e2462 | no/no |
| log-A1.00-B0.35-C1 | E = parts + A * level * (1 + log2(level + 1)) | {"A":1,"logBase":2,"B":0.35,"C":1} | stage-3 | inconclusive | gain-aware-2x | e2900 | e2906 | yes/no |
| multiplicative-A1.00-B0.35-C1 | E = parts * (1 + A * level) | {"A":1,"B":0.35,"C":1} | stage-1 | inconclusive | gain-aware-2x | e— | not reached | no/no |

## Required milestone first-reach times

- **flat-A1.00-B0.35-C1 / threshold-aware**: e900=10s, e1700=140s, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached
- **power-A1.00-B0.35-C1 / threshold-aware**: e900=10s, e1700=80s, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached
- **log-A1.00-B0.35-C1 / gain-aware-2x**: e900=10s, e1700=20s, e2500=680s, e2900=21.71h, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached
- **multiplicative-A1.00-B0.35-C1 / gain-aware-2x**: e900=not reached, e1700=not reached, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached

## Terminal and balance evidence

| Candidate | A contribution | Terminal levels | Next prices | Resets | Post-e2500 progression |
| --- | ---: | --- | --- | ---: | --- |
| flat-A1.00-B0.35-C1 | 3 | {"baseGain":3,"infinityScoreVertexGain":1,"freeCoreBoost":0} | {"baseGain":2500,"infinityScoreVertexGain":2900,"freeCoreBoost":2500} | 0 | not established |
| power-A1.00-B0.35-C1 | 3.9482220388574767 | {"baseGain":3,"infinityScoreVertexGain":1,"freeCoreBoost":0} | {"baseGain":2500,"infinityScoreVertexGain":2900,"freeCoreBoost":2500} | 0 | not established |
| log-A1.00-B0.35-C1 | 5.169925001442312 | {"baseGain":2,"infinityScoreVertexGain":3,"freeCoreBoost":1} | {"baseGain":3300,"infinityScoreVertexGain":4100,"freeCoreBoost":4100} | 3 | e2900 |
| multiplicative-A1.00-B0.35-C1 | — | null | null | — | not established |

## Recommendation

- Status: **search-inconclusive**
- Basis: **log-A1.00-B0.35-C1**
- Reason: **at least one promoted search remains truncated**
- Next step: **review truncation before selecting another bounded verification**

## Remaining uncertainty

- The forms are a bounded hypothesis set, not an exhaustive search of exponent functions or parameters.
- Search truncation, route limits, fixed-step simulation, and reset-policy heuristics remain explicit uncertainty.
- A successful research form still requires a separate maintainer production decision in #125.
