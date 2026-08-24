# IC8-to-Eternity progression (Issue #217)

> Research evidence only. No production gameplay, Timeline, or balance formula was changed.

- Outcome: **setup-stall** — bounded production prelude did not reach a real first Eternity; no IC8 snapshot was fabricated
- Step: requested **0.03333333333333333s**, action interval **0.1s**; all runtime updates are bounded by the production simulation step.
- Effects: **timeline-free**, **real-bc16500**, **parallel-bc16500-root**, **parallel-bc16500-fourth-root**

## Prelude

| Policy | Status | Elapsed | Peak score log10 | IC8 clear | Eternity eligibility |
| --- | --- | ---: | ---: | --- | --- |
| greedy | stall-no-new-progress | 2.20m | 1.1439511164239626 | not reached | not reached |
| threshold-aware | stall-no-new-progress | 2.20m | 1.1439511164239626 | not reached | not reached |

No post-Eternity cases were run because the canonical setup did not reach a real first Eternity.

## Required milestones

- break-infinite-cap, infinite-angle-unlock, tower-floor-1, tc1-unlock, tc1-clear, tc2-unlock, tc2-clear, tc3-unlock, tc3-clear, tc4-unlock, tc4-clear, ic8-clear, ip-1.80e308, eternity-eligibility
- IC8 timer starts only on the observed completed-challenges bit transition; setup-stall never claims IC8 completion.
- Greedy and threshold-aware are bounded comparison policies, not a global-optimality claim.
