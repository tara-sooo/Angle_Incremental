# TC4 Balance Candidate A (Issue #106)

> Research output only. No provisional effect is installed in production formulas.

- Target: **1e7777 Score**
- Horizon: **24.00h**
- Runtime step: **10s** (reported times have this resolution)
- Search limits: **20 states / 10 routes**

## Candidate ranking

| Candidate | Canonical best | median/best | worst/best | successful | stalled | truncated |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A 0.20 / B 0.50 / C 1 | not reached | — | — | 0 | 2 | no |
| A 0.15 / B 0.35 / C 1 | not reached | — | — | 0 | 2 | no |
| A 0.15 / B 0.50 / C 1 | not reached | — | — | 0 | 2 | no |
| A 0.15 / B 0.65 / C 1 | not reached | — | — | 0 | 2 | no |
| A 0.20 / B 0.35 / C 1 | not reached | — | — | 0 | 2 | no |
| A 0.20 / B 0.50 / C 1 | not reached | — | — | 0 | 2 | no |
| A 0.20 / B 0.65 / C 1 | not reached | — | — | 0 | 2 | no |
| A 0.25 / B 0.35 / C 1 | not reached | — | — | 0 | 2 | no |
| A 0.25 / B 0.50 / C 1 | not reached | — | — | 0 | 2 | no |
| A 0.25 / B 0.65 / C 1 | not reached | — | — | 0 | 2 | no |

Candidate A initial targets: **fail; sweep evaluated**

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
  "automation": "manual-normal-level-1; Infinity reset after 60s when eligible; Core Boost when eligible; Generation after 60s only when both configured gains improve",
  "approximation": "10-second production-runtime steps; event timing is reported at step resolution"
}
```

## Caveats

- The simulator uses production runtime updates in fixed steps; it is a deterministic balance comparison, not a replacement for frame-by-frame gameplay.
- Stall cutoff: 4.00h without a new peak Score; stalled routes count as failures.
- Any route/search truncation or timeout is retained as a failure signal.
