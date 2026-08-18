# TC4 log-A retained-frontier continuation (Issue #139)

> Research evidence only. No production TC4 formula, pricing, lifecycle, or #125 decision was changed.

- Mode: **reconstructed-frontier**; the historical full pending/seen/routes checkpoint was unavailable.
- Source report: **reports/tc4-a-form-frontier.json** (a4760fc46568bcea59b92d952bf74759f40a5ad3775ee8e7ff0430a6d727ba93)
- Source report commit: **9a38e3a0a9db7c5de9944b1630f9098f1dea7847**
- Candidate: **log-A1.00-B0.35-C1**; fixed parameters **A=1, B=0.35, C=1**
- Stage plan: fixed-60=route-cap-30 → route-cap-60; gain-aware-2x=state-cap-160 → route-cap-30; threshold-aware=state-cap-160 → route-cap-30

## Policy results

| Policy | Replay entries | Stages | Final limiter | Highest milestone |
| --- | ---: | --- | --- | ---: |
| fixed-60 | 6 | route-cap-30: 12 states/7 routes/complete | complete | e7777 |
| gain-aware-2x | 25 | state-cap-160: 62 states/10 routes/route-cap; route-cap-30: 98 states/30 routes/route-cap | route-cap | e7777 |
| threshold-aware | 25 | state-cap-160: 68 states/10 routes/route-cap; route-cap-30: 100 states/30 routes/route-cap | route-cap | e7777 |

## Required milestone first-reach

- **fixed-60**: e900=10, e1700=20, e2500=30, e2900=40, e3300=60, e4100=70, e4900=80, e5300=90, e5700=90, e6500=100, e7300=110, e7700=120, e7777=120
- **gain-aware-2x**: e900=10, e1700=20, e2500=40, e2900=50, e3300=90, e4100=110, e4900=120, e5300=130, e5700=130, e6500=140, e7300=150, e7700=150, e7777=150
- **threshold-aware**: e900=10, e1700=20, e2500=40, e2900=50, e3300=70, e4100=80, e4900=90, e5300=100, e5700=100, e6500=110, e7300=120, e7700=130, e7777=130

## Best legal route evidence

- **fixed-60**: success / target reached / peak e8599; levels={"baseGain":10,"infinityScoreVertexGain":3,"freeCoreBoost":1}; priceSteps={"baseGain":10,"infinityScoreVertexGain":6,"freeCoreBoost":5}; resets=[]; next prices={"baseGain":8100,"infinityScoreVertexGain":7700,"freeCoreBoost":8900}
- **gain-aware-2x**: success / target reached / peak e8750; levels={"baseGain":8,"infinityScoreVertexGain":4,"freeCoreBoost":1}; priceSteps={"baseGain":10,"infinityScoreVertexGain":6,"freeCoreBoost":5}; resets=[60,210]; next prices={"baseGain":8100,"infinityScoreVertexGain":7700,"freeCoreBoost":8900}
- **threshold-aware**: success / target reached / peak e8766; levels={"baseGain":8,"infinityScoreVertexGain":4,"freeCoreBoost":1}; priceSteps={"baseGain":10,"infinityScoreVertexGain":6,"freeCoreBoost":5}; resets=[]; next prices={"baseGain":8100,"infinityScoreVertexGain":7700,"freeCoreBoost":8900}

## Outcome

- Status: **still search-inconclusive**
- Reason: **the reconstructed retained frontier still reached an explicit bounded search limiter**
- Basis: **historical full pending/seen/routes checkpoint was unavailable; continuation evidence is bounded from the validated reconstruction boundary**
- Interpretation: e7777 is reached by reconstructed legal routes, but adaptive cases terminate at route-cap; this does not establish a complete retained-frontier conclusion.
- #125 remains status:needs-decision.
