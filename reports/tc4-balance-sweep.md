# TC4 Balance Sweep (Issue #114)

> Research output only. No provisional effect is installed in production formulas.

- Candidate baseline: **Issue #106** fixed-60 simulator
- Adaptive strategy source: **Issue #112**
- Target: **1e7777 Score**
- Horizon: **24.00h**
- Runtime step: **10s** (reported times have this resolution)
- Primary search limits (Candidate A): **24.00h / 20 states / 10 routes**
- Secondary candidate limits: **1.00h / 1 states / 1 routes**; incomplete searches remain **inconclusive**
- Evaluated policies: **fixed-60, gain-aware-2x, threshold-aware** (other definitions retained for reproducibility)
- Milestones: **e900, e1700, e2500, e2900, e3300, e4100, e4900, e5300, e5700, e6500, e7300, e7700, e7777**

## Candidate ranking

| Adaptive rank | Candidate | Classification | Best policy | Highest milestone | Peak Score | Time to milestone | Fixed-60 peak | Rank changed |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| 1 | A0.20-B0.50-C1 | failed | threshold-aware | e1700 | e1779 | 9.47h | e1337 | no |
| 2 | A0.15-B0.35-C1 | inconclusive | gain-aware-2x | — | not reached | not reached | not reached | no |
| 3 | A0.15-B0.50-C1 | inconclusive | gain-aware-2x | — | not reached | not reached | not reached | no |
| 4 | A0.15-B0.65-C1 | inconclusive | gain-aware-2x | — | not reached | not reached | not reached | no |
| 5 | A0.20-B0.35-C1 | inconclusive | gain-aware-2x | — | not reached | not reached | not reached | no |
| 6 | A0.20-B0.65-C1 | inconclusive | gain-aware-2x | — | not reached | not reached | not reached | no |
| 7 | A0.25-B0.35-C1 | inconclusive | gain-aware-2x | — | not reached | not reached | not reached | no |
| 8 | A0.25-B0.50-C1 | inconclusive | gain-aware-2x | — | not reached | not reached | not reached | no |
| 9 | A0.25-B0.65-C1 | inconclusive | gain-aware-2x | — | not reached | not reached | not reached | no |

Adaptive order differs from fixed-60: **no**
- Fixed-60 order: **A0.20-B0.50-C1 → A0.15-B0.35-C1 → A0.15-B0.50-C1 → A0.15-B0.65-C1 → A0.20-B0.35-C1 → A0.20-B0.65-C1 → A0.25-B0.35-C1 → A0.25-B0.50-C1 → A0.25-B0.65-C1**
- Candidate A classification: **failed**
- Candidate A best adaptive policy: **threshold-aware**
- Candidate A peak delta vs fixed-60: **442.500 log10**
- Candidate A e900 purchase kinds at best adaptive peak: **baseGain, freeCoreBoost**

## Candidate/policy results

| Candidate | Policy | Canonical best | All-legal best | Highest milestone | Peak Score | e900/e1700/e2500 | resets | truncated |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | --- |
| A0.15-B0.35-C1 | fixed-60 | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.15-B0.35-C1 | gain-aware-2x | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.15-B0.35-C1 | threshold-aware | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.15-B0.50-C1 | fixed-60 | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.15-B0.50-C1 | gain-aware-2x | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.15-B0.50-C1 | threshold-aware | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.15-B0.65-C1 | fixed-60 | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.15-B0.65-C1 | gain-aware-2x | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.15-B0.65-C1 | threshold-aware | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.20-B0.35-C1 | fixed-60 | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.20-B0.35-C1 | gain-aware-2x | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.20-B0.35-C1 | threshold-aware | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.20-B0.50-C1 | fixed-60 | not reached | not reached | e900 | e1337 | yes/no/no | 242 | no |
| A0.20-B0.50-C1 | gain-aware-2x | not reached | not reached | e1700 | e1779 | yes/yes/no | 3 | no |
| A0.20-B0.50-C1 | threshold-aware | not reached | not reached | e1700 | e1779 | yes/yes/no | 1 | no |
| A0.20-B0.65-C1 | fixed-60 | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.20-B0.65-C1 | gain-aware-2x | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.20-B0.65-C1 | threshold-aware | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.25-B0.35-C1 | fixed-60 | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.25-B0.35-C1 | gain-aware-2x | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.25-B0.35-C1 | threshold-aware | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.25-B0.50-C1 | fixed-60 | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.25-B0.50-C1 | gain-aware-2x | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.25-B0.50-C1 | threshold-aware | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.25-B0.65-C1 | fixed-60 | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.25-B0.65-C1 | gain-aware-2x | not reached | not reached | — | not reached | no/no/no | 0 | yes |
| A0.25-B0.65-C1 | threshold-aware | not reached | not reached | — | not reached | no/no/no | 0 | yes |

## Required milestone first-reach times

- Ordered milestones: **e900, e1700, e2500, e2900, e3300, e4100, e4900, e5300, e5700, e6500, e7300, e7700, e7777**
- **A0.15-B0.35-C1 / gain-aware-2x**: e900=not reached, e1700=not reached, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached
- **A0.15-B0.50-C1 / gain-aware-2x**: e900=not reached, e1700=not reached, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached
- **A0.15-B0.65-C1 / gain-aware-2x**: e900=not reached, e1700=not reached, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached
- **A0.20-B0.35-C1 / gain-aware-2x**: e900=not reached, e1700=not reached, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached
- **A0.20-B0.50-C1 / threshold-aware**: e900=10s, e1700=9.47h, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached
- **A0.20-B0.65-C1 / gain-aware-2x**: e900=not reached, e1700=not reached, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached
- **A0.25-B0.35-C1 / gain-aware-2x**: e900=not reached, e1700=not reached, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached
- **A0.25-B0.50-C1 / gain-aware-2x**: e900=not reached, e1700=not reached, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached
- **A0.25-B0.65-C1 / gain-aware-2x**: e900=not reached, e1700=not reached, e2500=not reached, e2900=not reached, e3300=not reached, e4100=not reached, e4900=not reached, e5300=not reached, e5700=not reached, e6500=not reached, e7300=not reached, e7700=not reached, e7777=not reached

## Candidate A comparability with Issue #112

- Options match: **yes**
- Tolerance: **0.001 log10**
- Within tolerance: **yes**
- gain-aware-2x: expected e1779, observed e1779, delta 0.000; milestone match yes
- threshold-aware: expected e1779, observed e1779, delta 0.000; milestone match yes

## Next bounded search recommendation

- Status: **inconclusive**
- Direction: **at least one candidate search was truncated**
- Basis: **—**
- Highest milestone: **—**
- Peak Score: **not reached**
- Gap to e2500: **— log10**
- Next region: **—**
## Canonical collision validation

- Production match: **yes**
- Documented e100…e7700 range present: **yes**
- Sequence: baseGain@e100 → infinityScoreVertexGain@e500 → baseGain@e900 → baseGain@e1700 → baseGain@e2500 → infinityScoreVertexGain@e2900 → baseGain@e3300 → baseGain@e4100 → baseGain@e4900 → infinityScoreVertexGain@e5300 → baseGain@e5700 → baseGain@e6500 → baseGain@e7300 → infinityScoreVertexGain@e7700


## Family usefulness

| Family | Reachable | Measurable effect |
| --- | --- | --- |
| baseGain | yes | yes |
| infinityScoreVertexGain | yes | yes |
| freeCoreBoost | yes | yes |
## Core Boost audit

| Source | Use | Classification |
| --- | --- | --- |
| `src/patches/numeric-stability.js` | coreBoostRequirementWithoutEarlyCap | requirement/reset/history |
| `src/main.js` | render_game_to_text state.count | requirement/reset/history |
| `src/systems/infinity.js` | resetBelowInfinity | requirement/reset/history |
| `src/systems/infinity.js` | applyStartingCoreBoosts | requirement/reset/history |
| `src/systems/balance-core-boost.js` | canonicalCoreBoostGainIncreaseBaseForCount | benefit |
| `src/systems/angle.js` | lapSpeedSoftcapStart | benefit |
| `src/systems/angle.js` | lapSpeedSoftcapPower | benefit |
| `src/systems/angle.js` | earlyLayerCostScalingFactor | benefit |
| `src/systems/angle.js` | stagedUpgradeCostScalingLog10 | benefit |
| `src/systems/achievements.js` | achievement 4 and 8 unlock conditions | requirement/reset/history |
| `src/systems/core-boost.js` | coreBoostRequirementLog10 | requirement/reset/history |
| `src/systems/core-boost.js` | coreBoostGainIncreaseMultiplier | benefit |
| `src/systems/core-boost.js` | coreBoostGainExponent | benefit |
| `src/systems/core-boost.js` | nextCoreBoostValues | benefit |
| `src/systems/core-boost.js` | runCoreBoost increment and reset marker | requirement/reset/history |
| `src/core/state.js` | serialized state field | requirement/reset/history |
| `src/core/save.js` | save/load and invalid-save validation | requirement/reset/history |
| `src/ui/render-topbar.js` | progress display | requirement/reset/history |
| `src/ui/render-ui.js` | core boost counter display | requirement/reset/history |
| `src/ui/dom.js` | core boost counter element | requirement/reset/history |

## Baseline

```json
{
  "towerFloor": 12,
  "completedTowerChallenges": 7,
  "activeTowerChallenge": 4,
  "completedInfinityChallenges": 255,
  "infinityUpgradeMask": 2097151,
  "infinityUpgradeCount": 21,
  "infiniteCapBroken": true,
  "infinityCount": 600000,
  "achievementMask": 2147483647,
  "infiniteAngleUnlocked": true,
  "iaPurchaseCount": 3,
  "iaLevels": {
    "speed": 1,
    "vertex": 1,
    "gain": 1
  },
  "startingInfinityPointsLog10": 24.999969598322195,
  "automation": "manual-normal-level-1; compare fixed 60/120/300/600/1800s, gain-aware-2x, and threshold-aware Infinity resets; Core Boost and qualified Generation after each reset",
  "approximation": "10-second production-runtime steps; event timing is reported at step resolution"
}
```

## Caveats

- The simulator uses production runtime updates in fixed steps; it is a deterministic balance comparison, not a replacement for frame-by-frame gameplay.
- Stall cutoff: 4.00h without a new peak Score; stalled routes count as failures.
- Any route/search truncation remains explicit and produces inconclusive candidate classification.
- Gain-aware-2x and threshold-aware policies are bounded heuristics; they are comparison candidates, not production automation settings.
- This report is evidence for maintainer review; it does not select production TC4 constants.
