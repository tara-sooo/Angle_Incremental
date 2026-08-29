# Issue #237 checkpoint study

> Research evidence only. No production Timeline formula or gameplay behavior was changed.

- Outcome: **measured** — four isolated Timeline candidates were measured at seven representative checkpoints; no authoritative IC8-to-Eternity duration is claimed
- Scope: seven representative post-IC8 checkpoints × four fresh candidate clones; no full autonomous IC8 → Eternity route is required.
- Fixture: **Eternity 1 / Milestone 1-2 / Achievements 1-41 / IC8 complete**; IP **1e5**, Infinity **10000**, IU through row 11, no IA, Tower Floor 0, IC8 clear at post-IC8 **t = 0**.
- Parallel raw formula: **3^secondsSinceIC8Clear**; raw x1e10 is reached at **20.96s**. The curve does not select a production softcap.
- Local probes are instantaneous production-runtime IP-gain comparisons at Infinity threshold + 1 log10 Score and are bounded to the next local gate.
- Reading: **real-bc16500** is the least disruptive measured reference; Parallel root/fourth-root are stronger but show score-gate collapse risk in the one-hour probes. No production candidate is selected.
- Prior astronomical/one-year autonomous-route output is explicitly **excluded from balance conclusions**.

## Parallel multiplier curve

| Elapsed | Raw multiplier | Root post-softcap | Fourth-root post-softcap |
| --- | ---: | ---: | ---: |
| 0s | x1 | x1 | x1 |
| 10.0s | x10^4.77 | x10^4.77 | x10^4.77 |
| ~21s (raw x1e10) | x10^10.00 | x10^10.00 | x10^10.00 |
| 30.0s | x10^14.31 | x10^12.16 | x10^11.08 |
| 1.00m | x10^28.63 | x10^19.31 | x10^14.66 |
| 5.00m | x10^143.14 | x10^76.57 | x10^43.28 |
| 10.00m | x10^286.27 | x10^148.14 | x10^79.07 |
| 30.00m | x10^858.82 | x10^434.41 | x10^222.20 |
| 1.00h | x10^1717.64 | x10^863.82 | x10^436.91 |

## Checkpoint definitions

| Checkpoint | IP | Infinity | IA | Tower | TC complete | Next local gate | Consistency |
| --- | ---: | ---: | --- | ---: | ---: | --- | --- |
| post-ic8-pre-ia | 10^5.00 | 10000 | 0/0/0 (locked) | F0 | 0 | infinite-angle-unlock | passed |
| ia-pre-tower | 10^30.00 | 10000 | 0/0/0 (unlocked) | F0 | 0 | tower-floor-1 | passed |
| early-tower-tc1 | 10^75.00 | 10000 | 2/2/2 (unlocked) | F3 | 0 | tc1 | passed |
| mid-tower-tc2 | 10^130.00 | 10000 | 5/5/5 (unlocked) | F5 | 1 | tc2 | passed |
| tc3-era | 10^200.00 | 10000 | 8/8/8 (unlocked) | F8 | 3 | tc3 | passed |
| late-tower-tc4 | 10^300.00 | 10000 | 12/12/12 (unlocked) | F12 | 7 | tc4 | passed |
| final-eternity | 10^308.25 | 10000 | 12/12/12 (unlocked) | F12 | 15 | eternity-eligibility | passed |

## Candidate probes

| Checkpoint | Candidate | Next gate | Normal gain | Candidate gain | 1h projected IP | Gate at 1h | Collapse/skip risk |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| post-ic8-pre-ia | timeline-free | infinite-angle-unlock | x10^5.46 | x10^5.46 | 10^5.59 | not-covered | next-IP-gate-preserved |
| post-ic8-pre-ia | real-bc16500 | infinite-angle-unlock | x10^5.46 | x10^6.24 | 10^6.26 | not-covered | next-IP-gate-preserved |
| post-ic8-pre-ia | parallel-bc16500-root | infinite-angle-unlock | x10^5.46 | x10^5.46 | 10^308.25 | covered | candidate-skips-next-IP-gate |
| post-ic8-pre-ia | parallel-bc16500-fourth-root | infinite-angle-unlock | x10^5.46 | x10^5.46 | 10^308.25 | covered | candidate-skips-next-IP-gate |
| ia-pre-tower | timeline-free | tower-floor-1 | x10^5.46 | x10^5.46 | 10^30.00 | not-covered | next-IP-gate-preserved |
| ia-pre-tower | real-bc16500 | tower-floor-1 | x10^5.46 | x10^6.95 | 10^30.00 | not-covered | next-IP-gate-preserved |
| ia-pre-tower | parallel-bc16500-root | tower-floor-1 | x10^5.46 | x10^5.46 | 10^308.25 | covered | candidate-skips-next-IP-gate |
| ia-pre-tower | parallel-bc16500-fourth-root | tower-floor-1 | x10^5.46 | x10^5.46 | 10^308.25 | covered | candidate-skips-next-IP-gate |
| early-tower-tc1 | timeline-free | tc1 | x10^5.46 | x10^5.46 | 10^75.00 | not-applicable-score-gate | score-gate-preserved |
| early-tower-tc1 | real-bc16500 | tc1 | x10^5.46 | x10^7.34 | 10^75.00 | not-applicable-score-gate | score-gate-preserved |
| early-tower-tc1 | parallel-bc16500-root | tc1 | x10^5.46 | x10^5.46 | 10^308.25 | not-applicable-score-gate | final-IP-cap-before-score-gate |
| early-tower-tc1 | parallel-bc16500-fourth-root | tc1 | x10^5.46 | x10^5.46 | 10^308.25 | not-applicable-score-gate | final-IP-cap-before-score-gate |
| mid-tower-tc2 | timeline-free | tc2 | x10^5.46 | x10^5.46 | 10^130.00 | not-applicable-score-gate | score-gate-preserved |
| mid-tower-tc2 | real-bc16500 | tc2 | x10^5.46 | x10^7.58 | 10^130.00 | not-applicable-score-gate | score-gate-preserved |
| mid-tower-tc2 | parallel-bc16500-root | tc2 | x10^5.46 | x10^5.46 | 10^308.25 | not-applicable-score-gate | final-IP-cap-before-score-gate |
| mid-tower-tc2 | parallel-bc16500-fourth-root | tc2 | x10^5.46 | x10^5.46 | 10^308.25 | not-applicable-score-gate | final-IP-cap-before-score-gate |
| tc3-era | timeline-free | tc3 | x10^5.46 | x10^5.46 | 10^200.00 | not-applicable-score-gate | score-gate-preserved |
| tc3-era | real-bc16500 | tc3 | x10^5.46 | x10^7.76 | 10^200.00 | not-applicable-score-gate | score-gate-preserved |
| tc3-era | parallel-bc16500-root | tc3 | x10^5.46 | x10^5.46 | 10^308.25 | not-applicable-score-gate | final-IP-cap-before-score-gate |
| tc3-era | parallel-bc16500-fourth-root | tc3 | x10^5.46 | x10^5.46 | 10^308.25 | not-applicable-score-gate | final-IP-cap-before-score-gate |
| late-tower-tc4 | timeline-free | tc4 | x10^5.46 | x10^5.46 | 10^300.00 | not-applicable-score-gate | score-gate-preserved |
| late-tower-tc4 | real-bc16500 | tc4 | x10^5.46 | x10^7.94 | 10^300.00 | not-applicable-score-gate | score-gate-preserved |
| late-tower-tc4 | parallel-bc16500-root | tc4 | x10^5.46 | x10^5.46 | 10^308.25 | not-applicable-score-gate | final-IP-cap-before-score-gate |
| late-tower-tc4 | parallel-bc16500-fourth-root | tc4 | x10^5.46 | x10^5.46 | 10^308.25 | not-applicable-score-gate | final-IP-cap-before-score-gate |
| final-eternity | timeline-free | eternity-eligibility | x10^5.46 | x10^5.46 | 10^308.25 | already-covered | already-eligible |
| final-eternity | real-bc16500 | eternity-eligibility | x10^5.46 | x10^7.95 | 10^308.25 | already-covered | already-eligible |
| final-eternity | parallel-bc16500-root | eternity-eligibility | x10^5.46 | x10^5.46 | 10^308.25 | already-covered | already-eligible |
| final-eternity | parallel-bc16500-fourth-root | eternity-eligibility | x10^5.46 | x10^5.46 | 10^308.25 | already-covered | already-eligible |

## Validation and exclusions

- Checkpoint/candidate cases: **28**; validation: **passed**.
- Every case starts and ends with the same exact state digest; the research effect is restored after each probe.
- The TC3-era checkpoint uses Infinity count **10000** and enters the production TC3 toggle path; **600000** is recorded only as the relaxation reference point, not an entry gate.
- canEternity() is documented as a final-checkpoint predicate, not as a route target for this study.
- Previous full-route astronomical/one-year policy results remain diagnostic artifacts and are not used as balance evidence.
