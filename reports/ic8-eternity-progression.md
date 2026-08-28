# Milestone 1-2 post-IC8 progression (Issue #237)

> Research evidence only. No production gameplay, Timeline, or balance formula was changed.

- Outcome: **measured** — all candidates reached production Eternity eligibility from the shared post-IC8 fixture
- Representative case: **Eternity 1 / Milestone 1-2 / Achievements 1-41 / IC8 complete**; fixture initialization is **IC8 clear = t 0**.
- Fixture: IP **1e100**, Infinity **600000**, IA levels **1000/1000/1000**, Tower Floor **4**, Time Flux **0**.
- Step/action interval: **30.00d**; horizon **1000.00y**, stall **20.00y**.
- Effects: **timeline-free**, **real-bc16500**, **parallel-bc16500-root**, **parallel-bc16500-fourth-root**

## Results

| Effect | Status | IC8 → Eternity | Longest stage | Shortening vs baseline | Parallel raw x1e10 | Parallel effective at TC4 / end | Collapse risk |
| --- | --- | ---: | --- | ---: | --- | --- | --- |
| timeline-free | eligible | 192.25y | ic8-clear → ip-1.80e308 (191.75y) | 0.0s | n/a | n/a | not-applicable |
| real-bc16500 | eligible | 195.37y | ic8-clear → ip-1.80e308 (194.88y) | -3.12y | n/a | n/a | not-applicable |
| parallel-bc16500-root | eligible | 181.81y | ip-1.80e308 → eternity-eligibility (181.23y) | 10.44y | 21.0s | x10^1367788316.21 / x10^1367788316.21 | cap-exposed |
| parallel-bc16500-fourth-root | eligible | 181.81y | ip-1.80e308 → eternity-eligibility (181.23y) | 10.44y | 21.0s | x10^683894163.11 / x10^683894163.11 | cap-exposed |

## Milestones from fixture t = 0

| Effect | break-infinite-cap | infinite-angle-unlock | tower-floor-1 | tc1-unlock | tc1-clear | tc2-unlock | tc2-clear | tc3-unlock | tc3-clear | tc4-unlock | tc4-clear | ic8-clear | ip-1.80e308 | eternity-eligibility |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| timeline-free | at-start | at-start | at-start | at-start | 30.00d | 0.0s | 210.00d | 3.95y | 184.68y | 191.84y | 192.25y | at-start | 191.75y | 192.25y |
| real-bc16500 | at-start | at-start | at-start | at-start | 30.00d | 0.0s | 210.00d | 3.95y | 184.68y | 194.96y | 195.37y | at-start | 194.88y | 195.37y |
| parallel-bc16500-root | at-start | at-start | at-start | at-start | 30.00d | 0.0s | 210.00d | 210.00d | 181.40y | 181.40y | 181.81y | at-start | 210.00d | 181.81y |
| parallel-bc16500-fourth-root | at-start | at-start | at-start | at-start | 30.00d | 0.0s | 210.00d | 210.00d | 181.40y | 181.40y | 181.81y | at-start | 210.00d | 181.81y |

- `at-start` means the milestone is already true in the documented fixture.
- Every candidate starts in a fresh runtime cloned from the same fixture; only the research IP-gain effect differs.
- Milestone 1-1 and 1-3 are intentionally not compared by this representative study.
