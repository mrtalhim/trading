# Directional baseline control report — BTC/IDR slices

Generated 2026-08-10T08:07:15.495Z

Method: randomization test. For each slice the winning "best stops-on" risk config from the risk-regime sweep is held fixed; only the direction source changes — real LLM decisions vs **Baseline A** (seeded random direction, hold probability matched to the real model per slice, seeds 1–20) vs **Baseline B** (MA20 crossover, no randomness). The real model's PnL/win-rate percentile rank is taken within the 20-seed Baseline A null distribution. Same candles, same timestamps, same fees, same guardrails.

Setup: initialQuote 10,000,000 IDR, feeRate 0.003 per fill, minVolume 0.02, Baseline A fixed confidence 0.9, MA period 20.

Reading: percentile rank > 90 → credible directional signal; middle of the distribution → not distinguishable from noise; below Baseline B → the LLM is not earning its cost over a free rule.

## w0 · gemma4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.5, fraction 0.1, stopMult 1, tpMult 2.

Baseline A hold probability: 38% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (gemma4) | 17551 | 0.512 | 82 |
| Baseline B (MA20) | 17521 | 0.510 | 103 |
| Baseline A median (20 seeds) | 2494 | 0.373 | 79.5 |
| Baseline A range | -20005…25811 | 0.286…0.522 | — |

Percentile rank of real LLM within Baseline A null: **pnl 18/20 (90%)**, winRate 19/20 (95%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | -20005 | 0.289 | 77 |
| 2 | 16862 | 0.455 | 88 |
| 3 | -11886 | 0.308 | 79 |
| 4 | 2976 | 0.357 | 85 |
| 5 | 17668 | 0.500 | 84 |
| 6 | -1499 | 0.405 | 76 |
| 7 | 9708 | 0.378 | 75 |
| 8 | -13848 | 0.324 | 75 |
| 9 | 7583 | 0.388 | 98 |
| 10 | 7786 | 0.459 | 76 |
| 11 | -2665 | 0.286 | 85 |
| 12 | 6229 | 0.395 | 86 |
| 13 | 11115 | 0.361 | 72 |
| 14 | 25811 | 0.522 | 93 |
| 15 | -1200 | 0.368 | 76 |
| 16 | 2011 | 0.366 | 82 |
| 17 | 9831 | 0.395 | 87 |
| 18 | -8234 | 0.324 | 75 |
| 19 | 1318 | 0.316 | 76 |
| 20 | -102 | 0.410 | 80 |

## w0 · nemotronultra

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.5, fraction 0.1, stopMult 2, tpMult 2.

Baseline A hold probability: 47% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (nemotronultra) | 28992 | 0.676 | 77 |
| Baseline B (MA20) | 14641 | 0.607 | 114 |
| Baseline A median (20 seeds) | 12667 | 0.523 | 72 |
| Baseline A range | -17241…28653 | 0.375…0.686 | — |

Percentile rank of real LLM within Baseline A null: **pnl 20/20 (100%)**, winRate 19/20 (95%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: clears both baselines.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 21660 | 0.686 | 72 |
| 2 | 18290 | 0.610 | 82 |
| 3 | -7118 | 0.469 | 67 |
| 4 | 27747 | 0.628 | 87 |
| 5 | 20811 | 0.575 | 82 |
| 6 | 28653 | 0.649 | 76 |
| 7 | 9143 | 0.514 | 70 |
| 8 | -17241 | 0.375 | 66 |
| 9 | 3690 | 0.537 | 82 |
| 10 | 13388 | 0.500 | 70 |
| 11 | -15454 | 0.406 | 65 |
| 12 | 12943 | 0.531 | 65 |
| 13 | 25529 | 0.545 | 68 |
| 14 | -7035 | 0.444 | 73 |
| 15 | 18162 | 0.579 | 76 |
| 16 | 13406 | 0.514 | 71 |
| 17 | -4063 | 0.457 | 72 |
| 18 | 11040 | 0.500 | 76 |
| 19 | 12391 | 0.556 | 72 |
| 20 | -11324 | 0.455 | 66 |

## w1 · gemma4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.7, fraction 0.1, stopMult 1, tpMult 3.

Baseline A hold probability: 33% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (gemma4) | 15176 | 0.364 | 67 |
| Baseline B (MA20) | 13429 | 0.378 | 92 |
| Baseline A median (20 seeds) | -1273 | 0.313 | 75.5 |
| Baseline A range | -32548…57922 | 0.200…0.455 | — |

Percentile rank of real LLM within Baseline A null: **pnl 14/20 (70%)**, winRate 14/20 (70%).
Beats Baseline B on both PnL and win-rate: **no**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 57922 | 0.455 | 90 |
| 2 | -6825 | 0.286 | 71 |
| 3 | 30316 | 0.432 | 93 |
| 4 | 395 | 0.308 | 79 |
| 5 | -7903 | 0.316 | 76 |
| 6 | 30705 | 0.385 | 81 |
| 7 | 3296 | 0.297 | 76 |
| 8 | -24263 | 0.235 | 69 |
| 9 | -30894 | 0.200 | 70 |
| 10 | -4427 | 0.306 | 73 |
| 11 | -5709 | 0.310 | 85 |
| 12 | -32548 | 0.200 | 60 |
| 13 | 7378 | 0.382 | 68 |
| 14 | 39760 | 0.425 | 85 |
| 15 | -6307 | 0.242 | 67 |
| 16 | -4765 | 0.333 | 75 |
| 17 | 32803 | 0.342 | 77 |
| 18 | -2941 | 0.282 | 80 |
| 19 | 22130 | 0.405 | 74 |
| 20 | 8286 | 0.344 | 67 |

## w1 · nemotronultra

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.7, fraction 0.1, stopMult 3, tpMult 2.

Baseline A hold probability: 50% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (nemotronultra) | 42371 | 0.769 | 26 |
| Baseline B (MA20) | 9678 | 0.577 | 109 |
| Baseline A median (20 seeds) | 21549 | 0.616 | 69.5 |
| Baseline A range | -47661…64229 | 0.407…0.714 | — |

Percentile rank of real LLM within Baseline A null: **pnl 16/20 (80%)**, winRate 20/20 (100%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 32684 | 0.586 | 58 |
| 2 | 6298 | 0.690 | 89 |
| 3 | 64229 | 0.714 | 74 |
| 4 | 54025 | 0.667 | 75 |
| 5 | 124 | 0.611 | 73 |
| 6 | -12675 | 0.536 | 59 |
| 7 | 43580 | 0.667 | 74 |
| 8 | 661 | 0.548 | 64 |
| 9 | 24129 | 0.545 | 70 |
| 10 | 12092 | 0.594 | 65 |
| 11 | 27950 | 0.676 | 73 |
| 12 | 23099 | 0.700 | 62 |
| 13 | -47661 | 0.407 | 54 |
| 14 | 27195 | 0.622 | 75 |
| 15 | 26981 | 0.667 | 62 |
| 16 | 9737 | 0.500 | 68 |
| 17 | 46184 | 0.703 | 78 |
| 18 | 20000 | 0.579 | 77 |
| 19 | 6730 | 0.667 | 61 |
| 20 | -16774 | 0.545 | 69 |

## w2 · gemma4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.8, fraction 0.1, stopMult 3, tpMult 3.

Baseline A hold probability: 34% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (gemma4) | 41302 | 0.750 | 17 |
| Baseline B (MA20) | -8297 | 0.479 | 101 |
| Baseline A median (20 seeds) | 17363 | 0.511 | 82.5 |
| Baseline A range | -72130…82158 | 0.316…0.636 | — |

Percentile rank of real LLM within Baseline A null: **pnl 11/20 (55%)**, winRate 20/20 (100%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 62531 | 0.486 | 77 |
| 2 | 50959 | 0.548 | 88 |
| 3 | 5131 | 0.500 | 75 |
| 4 | 69964 | 0.609 | 96 |
| 5 | -5485 | 0.500 | 78 |
| 6 | -11179 | 0.500 | 78 |
| 7 | -41441 | 0.457 | 79 |
| 8 | -12290 | 0.463 | 86 |
| 9 | 80599 | 0.636 | 92 |
| 10 | -28374 | 0.474 | 80 |
| 11 | -2814 | 0.581 | 91 |
| 12 | 50817 | 0.559 | 73 |
| 13 | 82158 | 0.625 | 84 |
| 14 | 81544 | 0.522 | 97 |
| 15 | 14097 | 0.500 | 80 |
| 16 | 75421 | 0.558 | 92 |
| 17 | -72130 | 0.316 | 81 |
| 18 | 20628 | 0.625 | 88 |
| 19 | -55327 | 0.472 | 76 |
| 20 | 79038 | 0.564 | 84 |

## w2 · nemotronultra

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.5, fraction 0.1, stopMult 2, tpMult 3.

Baseline A hold probability: 47% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (nemotronultra) | 87834 | 0.615 | 81 |
| Baseline B (MA20) | -550 | 0.413 | 95 |
| Baseline A median (20 seeds) | 7240 | 0.433 | 68.5 |
| Baseline A range | -49299…64881 | 0.267…0.514 | — |

Percentile rank of real LLM within Baseline A null: **pnl 20/20 (100%)**, winRate 20/20 (100%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: clears both baselines.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 16079 | 0.500 | 60 |
| 2 | 6220 | 0.429 | 71 |
| 3 | -49299 | 0.267 | 62 |
| 4 | 526 | 0.457 | 73 |
| 5 | 37569 | 0.500 | 78 |
| 6 | 6481 | 0.379 | 61 |
| 7 | -30702 | 0.345 | 60 |
| 8 | -9614 | 0.382 | 70 |
| 9 | 52984 | 0.512 | 86 |
| 10 | -46212 | 0.367 | 65 |
| 11 | 42160 | 0.444 | 76 |
| 12 | 3232 | 0.385 | 54 |
| 13 | 22879 | 0.424 | 67 |
| 14 | 57837 | 0.513 | 82 |
| 15 | 25512 | 0.448 | 61 |
| 16 | 42050 | 0.438 | 67 |
| 17 | -3296 | 0.412 | 73 |
| 18 | -18348 | 0.375 | 67 |
| 19 | 7999 | 0.514 | 73 |
| 20 | 64881 | 0.500 | 71 |

## w3 · gemma4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.5, fraction 0.1, stopMult 3, tpMult 3.

Baseline A hold probability: 24% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (gemma4) | 87716 | 0.512 | 91 |
| Baseline B (MA20) | 66563 | 0.540 | 108 |
| Baseline A median (20 seeds) | -22900 | 0.488 | 86.5 |
| Baseline A range | -86611…55227 | 0.313…0.587 | — |

Percentile rank of real LLM within Baseline A null: **pnl 20/20 (100%)**, winRate 13/20 (65%).
Beats Baseline B on both PnL and win-rate: **no**.
**Verdict: beats random, not the free MA rule.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 34706 | 0.535 | 91 |
| 2 | 35633 | 0.568 | 93 |
| 3 | -73809 | 0.412 | 75 |
| 4 | -19825 | 0.486 | 79 |
| 5 | -9708 | 0.447 | 82 |
| 6 | 55227 | 0.587 | 100 |
| 7 | -34062 | 0.462 | 85 |
| 8 | 15471 | 0.537 | 87 |
| 9 | -25974 | 0.524 | 88 |
| 10 | 42464 | 0.488 | 86 |
| 11 | -55825 | 0.410 | 85 |
| 12 | -30443 | 0.488 | 88 |
| 13 | -86611 | 0.313 | 70 |
| 14 | 27859 | 0.524 | 91 |
| 15 | -79173 | 0.500 | 92 |
| 16 | -62656 | 0.459 | 85 |
| 17 | -15370 | 0.514 | 82 |
| 18 | -49447 | 0.432 | 89 |
| 19 | -57836 | 0.436 | 83 |
| 20 | 6991 | 0.512 | 93 |

## w3 · nemotronultra

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.5, fraction 0.1, stopMult 3, tpMult 3.

Baseline A hold probability: 46% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (nemotronultra) | 73186 | 0.568 | 79 |
| Baseline B (MA20) | 66563 | 0.540 | 108 |
| Baseline A median (20 seeds) | -4019 | 0.500 | 74.5 |
| Baseline A range | -160221…118496 | 0.314…0.722 | — |

Percentile rank of real LLM within Baseline A null: **pnl 17/20 (85%)**, winRate 16/20 (80%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | -28390 | 0.433 | 60 |
| 2 | -18867 | 0.486 | 74 |
| 3 | -53619 | 0.444 | 77 |
| 4 | 83547 | 0.605 | 91 |
| 5 | -10039 | 0.472 | 78 |
| 6 | 118496 | 0.686 | 77 |
| 7 | -27079 | 0.500 | 66 |
| 8 | -12451 | 0.500 | 77 |
| 9 | -160221 | 0.314 | 74 |
| 10 | 35973 | 0.485 | 70 |
| 11 | 40152 | 0.528 | 75 |
| 12 | 26944 | 0.533 | 64 |
| 13 | -2317 | 0.485 | 69 |
| 14 | -3957 | 0.500 | 79 |
| 15 | 84655 | 0.722 | 75 |
| 16 | 24959 | 0.556 | 76 |
| 17 | 23714 | 0.571 | 74 |
| 18 | -4081 | 0.564 | 84 |
| 19 | -55301 | 0.357 | 61 |
| 20 | -95187 | 0.357 | 62 |

## Summary

| slice | model | real pnl | real wr | B pnl | B wr | null median | pnl pct | wr pct | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| w0 | gemma4 | 17551 | 0.512 | 17521 | 0.510 | 2494 | 90% | 95% | not distinguishable from noise |
| w0 | nemotronultra | 28992 | 0.676 | 14641 | 0.607 | 12667 | 100% | 95% | clears both baselines |
| w1 | gemma4 | 15176 | 0.364 | 13429 | 0.378 | -1273 | 70% | 70% | not distinguishable from noise |
| w1 | nemotronultra | 42371 | 0.769 | 9678 | 0.577 | 21549 | 80% | 100% | not distinguishable from noise |
| w2 | gemma4 | 41302 | 0.750 | -8297 | 0.479 | 17363 | 55% | 100% | not distinguishable from noise |
| w2 | nemotronultra | 87834 | 0.615 | -550 | 0.413 | 7240 | 100% | 100% | clears both baselines |
| w3 | gemma4 | 87716 | 0.512 | 66563 | 0.540 | -22900 | 100% | 65% | beats random, not the free MA rule |
| w3 | nemotronultra | 73186 | 0.568 | 66563 | 0.540 | -4019 | 85% | 80% | not distinguishable from noise |

Cross-slice aggregate: 8 units; 3/8 in the random tail on PnL; 2/8 clear both baselines (PnL and win-rate); 6/8 beat Baseline B on both metrics.

## Caveats

- **Config-selection bias favors the LLM.** The winning stops-on config was chosen to maximize the real model's PnL on this slice; the baselines run a config not tuned for them. A failure to clear the tail is therefore decisive; a positive result is suggestive only.
- **Small trade counts and one regime.** Stops-on configs trade tens of trades per slice over ~26-day windows; the 20-seed null is coarse (90th percentile ≈ rank 18/20). Four months of correlated IDR data is one market regime, not a robustness guarantee across bull/chop/drawdown.
- **Fee sensitivity.** At 0.6% round trip, configs that trade more often are the most fee-exposed (Baseline B trades at every non-warmup decision).
