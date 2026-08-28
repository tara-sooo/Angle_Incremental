# Milestone 1-2 post-IC8 progression (Issue #237)

> Research evidence only. No production gameplay, Timeline, or balance formula was changed.

- Outcome: **measured** — all candidates reached production Eternity eligibility from the shared post-IC8 fixture
- Representative case: **Eternity 1 / Milestone 1-2 / Achievements 1-41 / IC8 complete**; fixture initialization is **IC8 clear = t 0**.
- Fixture: IP **1e5**, Infinity **10000**, IA levels **0/0/0**, Tower Floor **0**, Time Flux **0**.
- Cadence: **1.0s** production seed; immediate actions are exhausted at a fixed point before and after each advance; no calendar-scale action interval is used.
- Horizon/stall guard: **3.17e+300y** / **3.17e+300y**; action search iterations **6** after the initial bracket.
- Convergence: **passed** (max relative difference 0).
- Effects: **timeline-free**, **real-bc16500**, **parallel-bc16500-root**, **parallel-bc16500-fourth-root**

## Results

| Effect | Status | IC8 → Eternity | Longest stage | Shortening vs baseline | Parallel raw x1e10 | Parallel effective at TC4 / end | Collapse risk |
| --- | --- | ---: | --- | ---: | --- | --- | --- |
| timeline-free | eligible | 5.97e+296y | tc3-unlock → tc3-clear (5.97e+296y) | 0.0s | n/a | n/a | not-applicable |
| real-bc16500 | eligible | 5.97e+296y | tc3-unlock → tc3-clear (5.97e+296y) | 3.66e+202y | n/a | n/a | not-applicable |
| parallel-bc16500-root | eligible | 5.97e+296y | tc3-unlock → tc3-clear (5.97e+296y) | 9.53e+202y | 21.0s | x10^4.4886830830898685e+303 / x10^4.4886830830898685e+303 | cap-exposed |
| parallel-bc16500-fourth-root | eligible | 5.97e+296y | tc3-unlock → tc3-clear (5.97e+296y) | 9.53e+202y | 21.0s | x10^2.2443415415449343e+303 / x10^2.2443415415449343e+303 | cap-exposed |

## Stage durations from fixture t = 0

| Effect | From | To | Duration |
| --- | --- | --- | ---: |
| timeline-free | ic8-clear | infinite-angle-unlock | 6.78e+66y |
| timeline-free | infinite-angle-unlock | tower-floor-1 | 1.99e+25y |
| timeline-free | tower-floor-1 | tc1-unlock | 0.0s |
| timeline-free | tc1-unlock | tc1-clear | 23568932.72y |
| timeline-free | tc1-clear | tc2-unlock | 4207242792450583552.00y |
| timeline-free | tc2-unlock | tc2-clear | 5765192465465516.00y |
| timeline-free | tc2-clear | tc3-unlock | 35681487459753.17y |
| timeline-free | tc3-unlock | tc3-clear | 5.97e+296y |
| timeline-free | tc3-clear | tc4-unlock | 0.0s |
| timeline-free | tc4-unlock | ip-1.80e308 | 0.0s |
| timeline-free | ip-1.80e308 | tc4-clear | 14602154153.83y |
| timeline-free | tc4-clear | eternity-eligibility | 14602154149.92y |
| real-bc16500 | ic8-clear | infinite-angle-unlock | 6.78e+66y |
| real-bc16500 | infinite-angle-unlock | tower-floor-1 | 1.51e+25y |
| real-bc16500 | tower-floor-1 | tc1-unlock | 0.0s |
| real-bc16500 | tc1-unlock | tc1-clear | 23568932.71y |
| real-bc16500 | tc1-clear | tc2-unlock | 4063487343961390080.00y |
| real-bc16500 | tc2-unlock | tc2-clear | 5765192465465516.00y |
| real-bc16500 | tc2-clear | tc3-unlock | 524962970395.20y |
| real-bc16500 | tc3-unlock | tc3-clear | 5.97e+296y |
| real-bc16500 | tc3-clear | tc4-unlock | 0.0s |
| real-bc16500 | tc4-unlock | ip-1.80e308 | 0.0s |
| real-bc16500 | ip-1.80e308 | tc4-clear | 14602154153.83y |
| real-bc16500 | tc4-clear | eternity-eligibility | 14602154149.92y |
| parallel-bc16500-root | ic8-clear | infinite-angle-unlock | 6.78e+66y |
| parallel-bc16500-root | infinite-angle-unlock | tower-floor-1 | 0.0s |
| parallel-bc16500-root | tower-floor-1 | tc1-unlock | 0.0s |
| parallel-bc16500-root | tc1-unlock | ip-1.80e308 | 0.0s |
| parallel-bc16500-root | ip-1.80e308 | tc1-clear | 11017430.06y |
| parallel-bc16500-root | tc1-clear | tc2-unlock | 0.0s |
| parallel-bc16500-root | tc2-unlock | tc2-clear | 8307.74y |
| parallel-bc16500-root | tc2-clear | tc3-unlock | 0.0s |
| parallel-bc16500-root | tc3-unlock | tc3-clear | 5.97e+296y |
| parallel-bc16500-root | tc3-clear | tc4-unlock | 0.0s |
| parallel-bc16500-root | tc4-unlock | tc4-clear | 14602154153.81y |
| parallel-bc16500-root | tc4-clear | eternity-eligibility | 0.0s |
| parallel-bc16500-fourth-root | ic8-clear | infinite-angle-unlock | 6.78e+66y |
| parallel-bc16500-fourth-root | infinite-angle-unlock | tower-floor-1 | 0.0s |
| parallel-bc16500-fourth-root | tower-floor-1 | tc1-unlock | 0.0s |
| parallel-bc16500-fourth-root | tc1-unlock | ip-1.80e308 | 0.0s |
| parallel-bc16500-fourth-root | ip-1.80e308 | tc1-clear | 11017430.06y |
| parallel-bc16500-fourth-root | tc1-clear | tc2-unlock | 0.0s |
| parallel-bc16500-fourth-root | tc2-unlock | tc2-clear | 8307.74y |
| parallel-bc16500-fourth-root | tc2-clear | tc3-unlock | 0.0s |
| parallel-bc16500-fourth-root | tc3-unlock | tc3-clear | 5.97e+296y |
| parallel-bc16500-fourth-root | tc3-clear | tc4-unlock | 0.0s |
| parallel-bc16500-fourth-root | tc4-unlock | tc4-clear | 14602154153.81y |
| parallel-bc16500-fourth-root | tc4-clear | eternity-eligibility | 0.0s |

## Milestones from fixture t = 0

| Effect | break-infinite-cap | infinite-angle-unlock | tower-floor-1 | tc1-unlock | tc1-clear | tc2-unlock | tc2-clear | tc3-unlock | tc3-clear | tc4-unlock | tc4-clear | ic8-clear | ip-1.80e308 | eternity-eligibility |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| timeline-free | at-start | 6.78e+66y | 6.78e+66y | 6.78e+66y | 6.78e+66y | 6.78e+66y | 6.78e+66y | 6.78e+66y | 5.97e+296y | 5.97e+296y | 5.97e+296y | at-start | 5.97e+296y | 5.97e+296y |
| real-bc16500 | at-start | 6.78e+66y | 6.78e+66y | 6.78e+66y | 6.78e+66y | 6.78e+66y | 6.78e+66y | 6.78e+66y | 5.97e+296y | 5.97e+296y | 5.97e+296y | at-start | 5.97e+296y | 5.97e+296y |
| parallel-bc16500-root | at-start | 6.78e+66y | 6.78e+66y | 6.78e+66y | 6.78e+66y | 6.78e+66y | 6.78e+66y | 6.78e+66y | 5.97e+296y | 5.97e+296y | 5.97e+296y | at-start | 6.78e+66y | 5.97e+296y |
| parallel-bc16500-fourth-root | at-start | 6.78e+66y | 6.78e+66y | 6.78e+66y | 6.78e+66y | 6.78e+66y | 6.78e+66y | 6.78e+66y | 5.97e+296y | 5.97e+296y | 5.97e+296y | at-start | 6.78e+66y | 5.97e+296y |

- `at-start` means the milestone is already true in the documented fixture.
- Every candidate starts in a fresh runtime cloned from the same fixture; only the research IP-gain effect differs.
- Parallel endpoint equality is attributed to the TC3 bottleneck when TC3 remains the longest stage; it is not treated as evidence that the candidates are equivalent.
- Milestone 1-1 and 1-3 are intentionally not compared by this representative study.
