# Directional baseline control — combined summary

Generated 2026-08-10T08:09:11.523Z

Per-unit detail lives in each slice dir's `directional-baseline-report.md`.

| asset | slice | model | real pnl | real wr | B pnl | B wr | null median | pnl pct | wr pct | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ethidr2025| w0 | deepseekv4 | 7365 | 0.667 | 13570 | 0.510 | 7888 | 50% | 100% | not distinguishable from noise |
| ethidr2025| w1 | deepseekv4 | 58288 | 0.371 | 4357 | 0.242 | 49468 | 55% | 50% | not distinguishable from noise |
| ethidr2025| w2 | deepseekv4 | 60263 | 0.571 | 87524 | 0.540 | 18596 | 65% | 60% | not distinguishable from noise |
| ethidr2025| w3 | deepseekv4 | 123806 | 0.681 | 75964 | 0.583 | 39015 | 70% | 75% | not distinguishable from noise |
| ethidr2026| w0 | deepseekv4 | 33651 | 0.412 | -12836 | 0.343 | 44043 | 35% | 30% | not distinguishable from noise |
| ethidr2026| w1 | deepseekv4 | 135190 | 0.476 | 100707 | 0.435 | 50769 | 100% | 65% | clears both baselines |
| ethidr2026| w2 | deepseekv4 | 18453 | 0.600 | -22368 | 0.522 | -20740 | 80% | 75% | not distinguishable from noise |
| ethidr2026| w3 | deepseekv4 | 50081 | 0.579 | 52159 | 0.479 | 25790 | 70% | 100% | not distinguishable from noise |
| idr2025| w0 | gemma4 | 17551 | 0.512 | 17521 | 0.510 | 2494 | 90% | 95% | not distinguishable from noise |
| idr2025| w0 | nemotronultra | 28992 | 0.676 | 14641 | 0.607 | 12667 | 100% | 95% | clears both baselines |
| idr2025| w1 | gemma4 | 15176 | 0.364 | 13429 | 0.378 | -1273 | 70% | 70% | not distinguishable from noise |
| idr2025| w1 | nemotronultra | 42371 | 0.769 | 9678 | 0.577 | 21549 | 80% | 100% | not distinguishable from noise |
| idr2025| w2 | gemma4 | 41302 | 0.750 | -8297 | 0.479 | 17363 | 55% | 100% | not distinguishable from noise |
| idr2025| w2 | nemotronultra | 87834 | 0.615 | -550 | 0.413 | 7240 | 100% | 100% | clears both baselines |
| idr2025| w3 | gemma4 | 87716 | 0.512 | 66563 | 0.540 | -22900 | 100% | 65% | beats random, not the free MA rule |
| idr2025| w3 | nemotronultra | 73186 | 0.568 | 66563 | 0.540 | -4019 | 85% | 80% | not distinguishable from noise |
| idr2026| w0 | gemma4 | 33398 | 0.364 | 44330 | 0.326 | 12286 | 95% | 80% | beats random, not the free MA rule |
| idr2026| w0 | nemotronultra | 21047 | 0.667 | 81580 | 0.571 | 1698 | 75% | 100% | not distinguishable from noise |
| idr2026| w1 | gemma4 | 22565 | 0.667 | -26383 | 0.405 | -11325 | 80% | 100% | not distinguishable from noise |
| idr2026| w1 | nemotronultra | 8718 | 0.406 | -1610 | 0.341 | 6217 | 60% | 80% | not distinguishable from noise |
| idr2026| w2 | gemma4 | 5642 | 0.556 | -19095 | 0.462 | -4104 | 70% | 80% | not distinguishable from noise |
| idr2026| w2 | nemotronultra | 2690 | 0.636 | -19095 | 0.462 | 7906 | 40% | 95% | not distinguishable from noise |
| idr2026| w3 | gemma4 | 23124 | 0.318 | 11350 | 0.304 | 10070 | 80% | 55% | not distinguishable from noise |
| idr2026| w3 | nemotronultra | 25892 | 0.345 | 11350 | 0.304 | -4413 | 85% | 70% | not distinguishable from noise |
| solidr2025| w0 | deepseekv4 | 50995 | 0.438 | -31644 | 0.333 | -13872 | 90% | 90% | not distinguishable from noise |
| solidr2025| w1 | deepseekv4 | 173216 | 0.553 | 59124 | 0.511 | 12552 | 100% | 75% | clears both baselines |
| solidr2025| w2 | deepseekv4 | 124952 | 0.667 | 144870 | 0.641 | 71279 | 75% | 60% | not distinguishable from noise |
| solidr2025| w3 | deepseekv4 | 102645 | 0.474 | -9852 | 0.378 | 13681 | 80% | 80% | not distinguishable from noise |
| solidr2026| w0 | deepseekv4 | 11226 | 0.387 | 7157 | 0.395 | -20357 | 70% | 50% | not distinguishable from noise |
| solidr2026| w1 | deepseekv4 | 59072 | 0.390 | 104820 | 0.408 | 80904 | 45% | 25% | not distinguishable from noise |
| solidr2026| w2 | deepseekv4 | 84459 | 0.727 | 16308 | 0.565 | 52671 | 70% | 95% | not distinguishable from noise |
| solidr2026| w3 | deepseekv4 | 23038 | 1.000 | -42606 | 0.500 | -6290 | 75% | 100% | not distinguishable from noise |

