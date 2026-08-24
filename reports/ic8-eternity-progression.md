# IC8-to-Eternity progression (Issue #237)

> Research evidence only. No production gameplay, Timeline, or balance formula was changed.

- Outcome: **setup-stall** — bounded production prelude did not reach a real first Eternity; no IC8 or post-IC8 snapshot was fabricated
- Step: requested **3600s**, action interval **3600s**; every tick calls the production runtime update path.
- Horizons: setup **0.0s**, case **0.0s**, stall **30.00d**; truncation is reported per attempt/case.
- Effects: **timeline-free**, **real-bc16500**, **parallel-bc16500-root**, **parallel-bc16500-fourth-root**

## Prelude

| Policy | Status | Elapsed | Peak score log10 | IC8 clear | Eternity eligibility |
| --- | --- | ---: | ---: | --- | --- |
| greedy | horizon (horizon) | 0.0s | -Infinity | not reached | not reached |
| threshold-aware | horizon (horizon) | 0.0s | -Infinity | not reached | not reached |

No post-Eternity cases were run because the canonical setup did not reach a real first Eternity.

## Required milestones

- break-infinite-cap, infinite-angle-unlock, tower-floor-1, tc1-unlock, tc1-clear, tc2-unlock, tc2-clear, tc3-unlock, tc3-clear, tc4-unlock, tc4-clear, ic8-clear, ip-1.80e308, eternity-eligibility
- IC8 timer starts only on the observed completed-challenges bit transition; setup-stall never claims IC8 completion.
- Greedy and threshold-aware are bounded comparison policies, not a global-optimality claim.
- A post-IC8 state is reported only after a real runtime `performEternity()` checkpoint and a fresh case runtime.
