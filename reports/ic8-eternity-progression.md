# Milestone 1-2 post-IC8 progression (Issue #237)

> Research evidence only. No production gameplay, Timeline, or balance formula was changed.

- Outcome: **invalid** — parallel-bc16500-root: major milestone is horizon-bound (tc1-clear); parallel-bc16500-fourth-root: major milestone is horizon-bound (tc1-clear)
- Representative case: **Eternity 1 / Milestone 1-2 / Achievements 1-41 / IC8 complete**; fixture initialization is **IC8 clear = t 0**.
- Fixture: IP **1e5**, Infinity **10000**, IA levels **0/0/0**, Tower Floor **0**, Time Flux **0**.
- Cadence: **1.0s** production seed; immediate actions are exhausted at a fixed point before and after each advance; no calendar-scale action interval is used.
- Objective policy: **ip-threshold → tower-build → tower-challenge → infinity-count → eternity**; TC3 is blocked until exactly **600000** normal Infinity count.
- Horizon/stall guard: **1.00y** / **14.00d**; action search iterations **6** after the initial bracket.
- Convergence: **passed** (max relative difference 0); sanity guards: **failed**.
- Effects: **timeline-free**, **real-bc16500**, **parallel-bc16500-root**, **parallel-bc16500-fourth-root**

## Results

| Effect | Status | IC8 → Eternity | Longest stage | Shortening vs baseline | Parallel raw x1e10 | Parallel effective at TC4 / end | Collapse risk |
| --- | --- | ---: | --- | ---: | --- | --- | --- |
| timeline-free | policy-stall (horizon) | not reached | not reached | not reached | n/a | n/a | unmeasured-horizon |
| real-bc16500 | policy-stall (horizon) | not reached | not reached | not reached | n/a | n/a | unmeasured-horizon |
| parallel-bc16500-root | policy-stall (horizon) | not reached | tc1-unlock → tc1-clear (365.00d) | not reached | 21.0s | x1 / x1 | unmeasured-horizon |
| parallel-bc16500-fourth-root | policy-stall (horizon) | not reached | tc1-unlock → tc1-clear (364.99d) | not reached | 21.0s | x1 / x1 | unmeasured-horizon |

## Final policy diagnostics

| Effect | Status | Objective | Target | Elapsed | IP / gain | Infinity | GR / multiplier | CB | Tower / TC |
| --- | --- | --- | ---: | ---: | --- | ---: | --- | ---: | --- |
| timeline-free | policy-stall | ip-threshold (buy Infinity Upgrade 12-1) | 6.823474229170301 | 1.00y | 6.201172817493079 / 6.167470344893975 | 10012 | 37 / 20.524017950813867 | 5 | F0 / - (0) |
| real-bc16500 | policy-stall | ip-threshold (unlock Infinite Angle) | 20 | 1.00y | 7.820469929478036 / -Infinity | 10036 | 21 / 20.668409911051878 | 5 | F0 / - (0) |
| parallel-bc16500-root | policy-stall | ip-threshold (buy Infinity Upgrade 14-1) | 80 | 1.00y | 69.99102546339886 / -Infinity | 10812 | 0 / 0 | 2 | F3 / - (1) |
| parallel-bc16500-fourth-root | policy-stall | ip-threshold (buy Infinity Upgrade 14-1) | 80 | 1.00y | 69.26104122931626 / -Infinity | 11584 | 0 / 0 | 2 | F3 / - (1) |

## Stage durations from fixture t = 0

| Effect | From | To | Duration |
| --- | --- | --- | ---: |
| parallel-bc16500-root | ic8-clear | infinite-angle-unlock | 53.0s |
| parallel-bc16500-root | infinite-angle-unlock | tower-floor-1 | 1.95m |
| parallel-bc16500-root | tower-floor-1 | tc1-unlock | 1.38m |
| parallel-bc16500-root | tc1-unlock | tc1-clear | 365.00d |
| parallel-bc16500-fourth-root | ic8-clear | infinite-angle-unlock | 1.18m |
| parallel-bc16500-fourth-root | infinite-angle-unlock | tower-floor-1 | 4.05m |
| parallel-bc16500-fourth-root | tower-floor-1 | tc1-unlock | 2.77m |
| parallel-bc16500-fourth-root | tc1-unlock | tc1-clear | 364.99d |

## Milestones from fixture t = 0

| Effect | break-infinite-cap | infinite-angle-unlock | tower-floor-1 | tc1-unlock | tc1-clear | tc2-unlock | tc2-clear | infinity-count-600000 | tc3-unlock | tc3-clear | tc4-unlock | tc4-clear | ic8-clear | ip-1.80e308 | eternity-eligibility |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| timeline-free | at-start | not reached | not reached | not reached | not reached | not reached | not reached | not reached | not reached | not reached | not reached | not reached | at-start | not reached | not reached |
| real-bc16500 | at-start | not reached | not reached | not reached | not reached | not reached | not reached | not reached | not reached | not reached | not reached | not reached | at-start | not reached | not reached |
| parallel-bc16500-root | at-start | 53.0s | 2.83m | 4.22m | 1.00y | not reached | not reached | not reached | not reached | not reached | not reached | not reached | at-start | not reached | not reached |
| parallel-bc16500-fourth-root | at-start | 1.18m | 5.23m | 8.00m | 1.00y | not reached | not reached | not reached | not reached | not reached | not reached | not reached | at-start | not reached | not reached |

- `at-start` means the milestone is already true in the documented fixture.
- Every candidate starts in a fresh runtime cloned from the same fixture; only the research IP-gain effect differs.
- An unfinished run is reported as `policy-stall` with its current objective and state; no astronomical extrapolation is used.
- Milestone 1-1 and 1-3 are intentionally not compared by this representative study.
