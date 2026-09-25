# Issue #237 checkpoint study

> Research evidence only. No production Timeline formula or gameplay behavior was changed.
>
> Real-BC16500 rows and conclusions are SUPERSEDED historical IP-gain evidence; the current production effect is Infinity count gain.

- Outcome: **measured** — seven isolated Timeline candidates were measured at seven representative checkpoints; no authoritative IC8-to-Eternity duration is claimed
- Scope: seven representative post-IC8 checkpoints × 7 fresh candidate clones; no full autonomous IC8 → Eternity route is required.
- Fixture: **Eternity 1 / Milestone 1-2 / Achievements 1-41 / IC8 complete**; IP **1e5**, Infinity **10000**, IU through row 11, no IA, Tower Floor 0, IC8 clear at post-IC8 **t = 0**.
- Parallel raw formula: **3^secondsSinceIC8Clear**; raw x1e10 is reached at **20.96s**. The curve does not select a production softcap.
- Local probes are instantaneous production-runtime IP-gain comparisons at Infinity threshold + 1 log10 Score and are bounded to the next local gate.
- Reading: SUPERSEDED: Real-BC16500 IP-gain probes use a historical semantic interpretation and are not current production evidence; the production effect is Infinity count gain. The new 1/32 and 1/64 power candidates suppress the original root/fourth-root controls substantially. The logarithmic curve is stronger than both new powers at the minute samples through 10m, then grows more slowly; at 1h it is below 1/64 and far below 1/32. No production candidate is selected.
- Follow-up range: For a later balance decision, carry 1/64 as the slower power comparison and logarithmic as the stronger minute-scale comparison; keep 1/32 as a stronger-boundary control. This evidence does not select a production softcap.
- Power formula after raw x1e10: **effective = 1e10 × (raw / 1e10)^p**, with **p = 1/32** and **p = 1/64**; logarithmic formula: **effectiveLog = 10 + 10 × log10(1 + (rawLog - 10) / 10)**.
- Prior astronomical/one-year autonomous-route output is explicitly **excluded from balance conclusions**.

## Parallel multiplier curve

| Elapsed | Raw multiplier | parallel-bc16500-root | current | parallel-bc16500-fourth-root | parallel-bc16500-1-32 | parallel-bc16500-1-64 | parallel-bc16500-logarithmic |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 0s | x1 | x1 | x1 | x1 | x1 | x1 |
| 10.0s | x10^4.77 | x10^4.77 | x10^4.77 | x10^4.77 | x10^4.77 | x10^4.77 |
| ~21s (raw x1e10) | x10^10.00 | x10^10.00 | x10^10.00 | x10^10.00 | x10^10.00 | x10^10.00 |
| 30.0s | x10^14.31 | x10^12.16 | x10^11.08 | x10^10.13 | x10^10.07 | x10^11.56 |
| 1.00m | x10^28.63 | x10^19.31 | x10^14.66 | x10^10.58 | x10^10.29 | x10^14.57 |
| 5.00m | x10^143.14 | x10^76.57 | x10^43.28 | x10^14.16 | x10^12.08 | x10^21.56 |
| 10.00m | x10^286.27 | x10^148.14 | x10^79.07 | x10^18.63 | x10^14.32 | x10^24.57 |
| 30.00m | x10^858.82 | x10^434.41 | x10^222.20 | x10^36.53 | x10^23.26 | x10^29.34 |
| 1.00h | x10^1717.64 | x10^863.82 | x10^436.91 | x10^63.36 | x10^36.68 | x10^32.35 |

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

| Checkpoint | Candidate | Semantic status | Next gate | Normal gain | Candidate gain | 1h projected IP | Gate at 1h | First sampled collapse/skip | Latest risk |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| post-ic8-pre-ia | timeline-free | current | infinite-angle-unlock | x10^5.46 | x10^5.46 | 10^5.59 | not-covered | none | next-IP-gate-preserved |
| post-ic8-pre-ia | real-bc16500 | superseded | infinite-angle-unlock | x10^5.46 | x10^6.24 | 10^6.26 | not-covered | none | next-IP-gate-preserved |
| post-ic8-pre-ia | parallel-bc16500-root | current | infinite-angle-unlock | x10^5.46 | x10^5.46 | 10^308.25 | covered | 1.00m (candidate-skips-next-IP-gate) | candidate-skips-next-IP-gate |
| post-ic8-pre-ia | parallel-bc16500-fourth-root | current | infinite-angle-unlock | x10^5.46 | x10^5.46 | 10^308.25 | covered | 1.00m (candidate-skips-next-IP-gate) | candidate-skips-next-IP-gate |
| post-ic8-pre-ia | parallel-bc16500-1-32 | current | infinite-angle-unlock | x10^5.46 | x10^5.46 | 10^68.82 | covered | 10.00m (candidate-skips-next-IP-gate) | candidate-skips-next-IP-gate |
| post-ic8-pre-ia | parallel-bc16500-1-64 | current | infinite-angle-unlock | x10^5.46 | x10^5.46 | 10^42.14 | covered | 30.00m (candidate-skips-next-IP-gate) | candidate-skips-next-IP-gate |
| post-ic8-pre-ia | parallel-bc16500-logarithmic | current | infinite-angle-unlock | x10^5.46 | x10^5.46 | 10^37.81 | covered | 1.00m (candidate-skips-next-IP-gate) | candidate-skips-next-IP-gate |
| ia-pre-tower | timeline-free | current | tower-floor-1 | x10^5.46 | x10^5.46 | 10^30.00 | not-covered | none | next-IP-gate-preserved |
| ia-pre-tower | real-bc16500 | superseded | tower-floor-1 | x10^5.46 | x10^6.95 | 10^30.00 | not-covered | none | next-IP-gate-preserved |
| ia-pre-tower | parallel-bc16500-root | current | tower-floor-1 | x10^5.46 | x10^5.46 | 10^308.25 | covered | 5.00m (candidate-skips-next-IP-gate) | candidate-skips-next-IP-gate |
| ia-pre-tower | parallel-bc16500-fourth-root | current | tower-floor-1 | x10^5.46 | x10^5.46 | 10^308.25 | covered | 10.00m (candidate-skips-next-IP-gate) | candidate-skips-next-IP-gate |
| ia-pre-tower | parallel-bc16500-1-32 | current | tower-floor-1 | x10^5.46 | x10^5.46 | 10^68.82 | covered | 1.00h (candidate-skips-next-IP-gate) | candidate-skips-next-IP-gate |
| ia-pre-tower | parallel-bc16500-1-64 | current | tower-floor-1 | x10^5.46 | x10^5.46 | 10^42.14 | not-covered | none | next-IP-gate-preserved |
| ia-pre-tower | parallel-bc16500-logarithmic | current | tower-floor-1 | x10^5.46 | x10^5.46 | 10^37.81 | not-covered | none | next-IP-gate-preserved |
| early-tower-tc1 | timeline-free | current | tc1 | x10^5.46 | x10^5.46 | 10^75.00 | not-applicable-score-gate | none | score-gate-preserved |
| early-tower-tc1 | real-bc16500 | superseded | tc1 | x10^5.46 | x10^7.34 | 10^75.00 | not-applicable-score-gate | none | score-gate-preserved |
| early-tower-tc1 | parallel-bc16500-root | current | tc1 | x10^5.46 | x10^5.46 | 10^308.25 | not-applicable-score-gate | 30.00m (final-IP-cap-before-score-gate) | final-IP-cap-before-score-gate |
| early-tower-tc1 | parallel-bc16500-fourth-root | current | tc1 | x10^5.46 | x10^5.46 | 10^308.25 | not-applicable-score-gate | 1.00h (final-IP-cap-before-score-gate) | final-IP-cap-before-score-gate |
| early-tower-tc1 | parallel-bc16500-1-32 | current | tc1 | x10^5.46 | x10^5.46 | 10^75.00 | not-applicable-score-gate | none | score-gate-preserved |
| early-tower-tc1 | parallel-bc16500-1-64 | current | tc1 | x10^5.46 | x10^5.46 | 10^75.00 | not-applicable-score-gate | none | score-gate-preserved |
| early-tower-tc1 | parallel-bc16500-logarithmic | current | tc1 | x10^5.46 | x10^5.46 | 10^75.00 | not-applicable-score-gate | none | score-gate-preserved |
| mid-tower-tc2 | timeline-free | current | tc2 | x10^5.46 | x10^5.46 | 10^130.00 | not-applicable-score-gate | none | score-gate-preserved |
| mid-tower-tc2 | real-bc16500 | superseded | tc2 | x10^5.46 | x10^7.58 | 10^130.00 | not-applicable-score-gate | none | score-gate-preserved |
| mid-tower-tc2 | parallel-bc16500-root | current | tc2 | x10^5.46 | x10^5.46 | 10^308.25 | not-applicable-score-gate | 30.00m (final-IP-cap-before-score-gate) | final-IP-cap-before-score-gate |
| mid-tower-tc2 | parallel-bc16500-fourth-root | current | tc2 | x10^5.46 | x10^5.46 | 10^308.25 | not-applicable-score-gate | 1.00h (final-IP-cap-before-score-gate) | final-IP-cap-before-score-gate |
| mid-tower-tc2 | parallel-bc16500-1-32 | current | tc2 | x10^5.46 | x10^5.46 | 10^130.00 | not-applicable-score-gate | none | score-gate-preserved |
| mid-tower-tc2 | parallel-bc16500-1-64 | current | tc2 | x10^5.46 | x10^5.46 | 10^130.00 | not-applicable-score-gate | none | score-gate-preserved |
| mid-tower-tc2 | parallel-bc16500-logarithmic | current | tc2 | x10^5.46 | x10^5.46 | 10^130.00 | not-applicable-score-gate | none | score-gate-preserved |
| tc3-era | timeline-free | current | tc3 | x10^5.46 | x10^5.46 | 10^200.00 | not-applicable-score-gate | none | score-gate-preserved |
| tc3-era | real-bc16500 | superseded | tc3 | x10^5.46 | x10^7.76 | 10^200.00 | not-applicable-score-gate | none | score-gate-preserved |
| tc3-era | parallel-bc16500-root | current | tc3 | x10^5.46 | x10^5.46 | 10^308.25 | not-applicable-score-gate | 30.00m (final-IP-cap-before-score-gate) | final-IP-cap-before-score-gate |
| tc3-era | parallel-bc16500-fourth-root | current | tc3 | x10^5.46 | x10^5.46 | 10^308.25 | not-applicable-score-gate | 1.00h (final-IP-cap-before-score-gate) | final-IP-cap-before-score-gate |
| tc3-era | parallel-bc16500-1-32 | current | tc3 | x10^5.46 | x10^5.46 | 10^200.00 | not-applicable-score-gate | none | score-gate-preserved |
| tc3-era | parallel-bc16500-1-64 | current | tc3 | x10^5.46 | x10^5.46 | 10^200.00 | not-applicable-score-gate | none | score-gate-preserved |
| tc3-era | parallel-bc16500-logarithmic | current | tc3 | x10^5.46 | x10^5.46 | 10^200.00 | not-applicable-score-gate | none | score-gate-preserved |
| late-tower-tc4 | timeline-free | current | tc4 | x10^5.46 | x10^5.46 | 10^300.00 | not-applicable-score-gate | none | score-gate-preserved |
| late-tower-tc4 | real-bc16500 | superseded | tc4 | x10^5.46 | x10^7.94 | 10^300.00 | not-applicable-score-gate | none | score-gate-preserved |
| late-tower-tc4 | parallel-bc16500-root | current | tc4 | x10^5.46 | x10^5.46 | 10^308.25 | not-applicable-score-gate | 30.00m (final-IP-cap-before-score-gate) | final-IP-cap-before-score-gate |
| late-tower-tc4 | parallel-bc16500-fourth-root | current | tc4 | x10^5.46 | x10^5.46 | 10^308.25 | not-applicable-score-gate | 1.00h (final-IP-cap-before-score-gate) | final-IP-cap-before-score-gate |
| late-tower-tc4 | parallel-bc16500-1-32 | current | tc4 | x10^5.46 | x10^5.46 | 10^300.00 | not-applicable-score-gate | none | score-gate-preserved |
| late-tower-tc4 | parallel-bc16500-1-64 | current | tc4 | x10^5.46 | x10^5.46 | 10^300.00 | not-applicable-score-gate | none | score-gate-preserved |
| late-tower-tc4 | parallel-bc16500-logarithmic | current | tc4 | x10^5.46 | x10^5.46 | 10^300.00 | not-applicable-score-gate | none | score-gate-preserved |
| final-eternity | timeline-free | current | eternity-eligibility | x10^5.46 | x10^5.46 | 10^308.25 | already-covered | none | already-eligible |
| final-eternity | real-bc16500 | superseded | eternity-eligibility | x10^5.46 | x10^7.95 | 10^308.25 | already-covered | none | already-eligible |
| final-eternity | parallel-bc16500-root | current | eternity-eligibility | x10^5.46 | x10^5.46 | 10^308.25 | already-covered | none | already-eligible |
| final-eternity | parallel-bc16500-fourth-root | current | eternity-eligibility | x10^5.46 | x10^5.46 | 10^308.25 | already-covered | none | already-eligible |
| final-eternity | parallel-bc16500-1-32 | current | eternity-eligibility | x10^5.46 | x10^5.46 | 10^308.25 | already-covered | none | already-eligible |
| final-eternity | parallel-bc16500-1-64 | current | eternity-eligibility | x10^5.46 | x10^5.46 | 10^308.25 | already-covered | none | already-eligible |
| final-eternity | parallel-bc16500-logarithmic | current | eternity-eligibility | x10^5.46 | x10^5.46 | 10^308.25 | already-covered | none | already-eligible |

## Validation and exclusions

- Checkpoint/candidate cases: **49**; validation: **passed**.
- Every case starts and ends with the same exact state digest; the research effect is restored after each probe.
- Real-BC16500 cases are retained as superseded historical IP-gain probes and must not be used as current balance evidence.
- The TC3-era checkpoint uses Infinity count **10000** and enters the production TC3 toggle path; **600000** is recorded only as the relaxation reference point, not an entry gate.
- canEternity() is documented as a final-checkpoint predicate, not as a route target for this study.
- Previous full-route astronomical/one-year policy results remain diagnostic artifacts and are not used as balance evidence.
