# Adaptive ATR multiplier — combined summary

Generated 2026-08-16T06:11:42.228Z

Per-unit detail lives in each slice dir's `adaptive-multiplier-report.md`. This summary is the pre-committed reading of the whole 32-unit corpus (control = per-slice oracle, treatment = single adaptive rule).

| asset | unit | model | ctrl pnl | adap pnl | delta |
| --- | --- | --- | --- | --- | --- |
| ethidr2025 | w0 | deepseekv4 | 7365 | -8951 | -16316 |
| ethidr2025 | w1 | deepseekv4 | 58288 | -19269 | -77557 |
| ethidr2025 | w2 | deepseekv4 | 60263 | 62719 | 2457 |
| ethidr2025 | w3 | deepseekv4 | 123806 | 99629 | -24177 |
| ethidr2026 | w0 | deepseekv4 | 33651 | 30763 | -2888 |
| ethidr2026 | w1 | deepseekv4 | 135190 | 115250 | -19941 |
| ethidr2026 | w2 | deepseekv4 | 18453 | -31489 | -49942 |
| ethidr2026 | w3 | deepseekv4 | 50081 | 47139 | -2941 |
| idr2025 | w0 | gemma4 | 17551 | 8211 | -9340 |
| idr2025 | w0 | nemotronultra | 28992 | 20700 | -8292 |
| idr2025 | w1 | gemma4 | 15176 | -20218 | -35394 |
| idr2025 | w1 | nemotronultra | 42371 | 25518 | -16854 |
| idr2025 | w2 | gemma4 | 41302 | 33347 | -7955 |
| idr2025 | w2 | nemotronultra | 87834 | 78049 | -9785 |
| idr2025 | w3 | gemma4 | 87716 | 92242 | 4525 |
| idr2025 | w3 | nemotronultra | 73186 | 39875 | -33312 |
| idr2026 | w0 | gemma4 | 33398 | 27966 | -5432 |
| idr2026 | w0 | nemotronultra | 21047 | 21828 | 781 |
| idr2026 | w1 | gemma4 | 22565 | 22565 | 0 |
| idr2026 | w1 | nemotronultra | 8718 | -51295 | -60014 |
| idr2026 | w2 | gemma4 | 5642 | -8375 | -14016 |
| idr2026 | w2 | nemotronultra | 2690 | -22808 | -25498 |
| idr2026 | w3 | gemma4 | 23124 | 7652 | -15472 |
| idr2026 | w3 | nemotronultra | 25892 | 11882 | -14010 |
| solidr2025 | w0 | deepseekv4 | 50995 | -4791 | -55786 |
| solidr2025 | w1 | deepseekv4 | 173216 | 81559 | -91656 |
| solidr2025 | w2 | deepseekv4 | 124952 | -25075 | -150028 |
| solidr2025 | w3 | deepseekv4 | 102645 | 130041 | 27396 |
| solidr2026 | w0 | deepseekv4 | 11226 | 17190 | 5963 |
| solidr2026 | w1 | deepseekv4 | 59072 | -36763 | -95835 |
| solidr2026 | w2 | deepseekv4 | 84459 | -38127 | -122586 |
| solidr2026 | w3 | deepseekv4 | 23038 | -9975 | -33013 |

## Paired bootstrap over units

Paired deltas (adaptive − control), 10000 resamples, seed 20260815.

| statistic | value |
| --- | --- |
| units | 32 |
| mean paired delta | -29904 |
| 95% CI | -44338 … -17229 |
| units where adaptive > control | 5/32 |
| sign-test lower bound (≥ 20 required) | not met |

## Verdict

**NOT ADOPTED (decisive null: CI includes zero or is negative; adaptive beats control on 5/32).**

## Caveats

- Control has the oracle advantage (per-slice in-sample best); a CI-includes-zero is therefore a decisive null, a positive is suggestive only.
- 32 units are two regimes of correlated IDR data with tens of closing trades per unit; bootstrap CIs, not point estimates, are the reading.
- Applies to this exact pre-committed rule (window 96, thresholds 0.75/0.25, grid {1,2,3}×{2,3}); no re-running with tweaked parameters.
