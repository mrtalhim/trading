# Directional baseline control report — BTC/IDR slices

Generated 2026-08-09T01:14:05.817Z

Method: randomization test. For each slice the winning "best stops-on" risk config from the risk-regime sweep is held fixed; only the direction source changes — real LLM decisions vs **Baseline A** (seeded random direction, hold probability matched to the real model per slice, seeds 1–20) vs **Baseline B** (MA20 crossover, no randomness). The real model's PnL/win-rate percentile rank is taken within the 20-seed Baseline A null distribution. Same candles, same timestamps, same fees, same guardrails.

Setup: initialQuote 10,000,000 IDR, feeRate 0.003 per fill, minVolume 0.02, Baseline A fixed confidence 0.9, MA period 20.

Reading: percentile rank > 90 → credible directional signal; middle of the distribution → not distinguishable from noise; below Baseline B → the LLM is not earning its cost over a free rule.

## w0 · gemma4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.7, fraction 0.1, stopMult 1, tpMult 3.

Baseline A hold probability: 35% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (gemma4) | 33398 | 0.364 | 67 |
| Baseline B (MA20) | 44330 | 0.326 | 94 |
| Baseline A median (20 seeds) | 12286 | 0.324 | 72 |
| Baseline A range | -15177…38512 | 0.143…0.472 | — |

Percentile rank of real LLM within Baseline A null: **pnl 19/20 (95%)**, winRate 16/20 (80%).
Beats Baseline B on both PnL and win-rate: **no**.
**Verdict: beats random, not the free MA rule.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 38512 | 0.472 | 72 |
| 2 | 12904 | 0.333 | 78 |
| 3 | -12791 | 0.242 | 67 |
| 4 | 18387 | 0.289 | 77 |
| 5 | 10150 | 0.333 | 66 |
| 6 | 32760 | 0.415 | 87 |
| 7 | -3883 | 0.314 | 71 |
| 8 | -11346 | 0.143 | 72 |
| 9 | -8001 | 0.250 | 72 |
| 10 | 25645 | 0.382 | 70 |
| 11 | 14830 | 0.351 | 77 |
| 12 | 28282 | 0.333 | 73 |
| 13 | 12431 | 0.314 | 70 |
| 14 | 12140 | 0.341 | 84 |
| 15 | 3106 | 0.212 | 67 |
| 16 | -15177 | 0.216 | 76 |
| 17 | 21720 | 0.333 | 76 |
| 18 | 21161 | 0.371 | 72 |
| 19 | -13180 | 0.219 | 65 |
| 20 | -2597 | 0.258 | 65 |

## w0 · nemotronultra

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.7, fraction 0.1, stopMult 3, tpMult 3.

Baseline A hold probability: 47% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (nemotronultra) | 21047 | 0.667 | 12 |
| Baseline B (MA20) | 81580 | 0.571 | 105 |
| Baseline A median (20 seeds) | 1698 | 0.500 | 69 |
| Baseline A range | -66911…88645 | 0.267…0.667 | — |

Percentile rank of real LLM within Baseline A null: **pnl 15/20 (75%)**, winRate 20/20 (100%).
Beats Baseline B on both PnL and win-rate: **no**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | -38470 | 0.414 | 61 |
| 2 | 29924 | 0.625 | 82 |
| 3 | -18463 | 0.484 | 66 |
| 4 | 1590 | 0.500 | 71 |
| 5 | -33810 | 0.424 | 68 |
| 6 | 1805 | 0.448 | 62 |
| 7 | -6938 | 0.484 | 65 |
| 8 | -66911 | 0.267 | 62 |
| 9 | 5833 | 0.538 | 82 |
| 10 | 44931 | 0.588 | 71 |
| 11 | 36842 | 0.595 | 79 |
| 12 | 2560 | 0.533 | 63 |
| 13 | 88645 | 0.667 | 70 |
| 14 | -22503 | 0.387 | 67 |
| 15 | 5282 | 0.586 | 60 |
| 16 | -14223 | 0.484 | 70 |
| 17 | 14635 | 0.500 | 72 |
| 18 | 262 | 0.564 | 80 |
| 19 | 43649 | 0.649 | 76 |
| 20 | -52770 | 0.346 | 58 |

## w1 · gemma4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.8, fraction 0.1, stopMult 2, tpMult 3.

Baseline A hold probability: 29% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (gemma4) | 22565 | 0.667 | 12 |
| Baseline B (MA20) | -26383 | 0.405 | 88 |
| Baseline A median (20 seeds) | -11325 | 0.396 | 73 |
| Baseline A range | -69481…73601 | 0.257…0.558 | — |

Percentile rank of real LLM within Baseline A null: **pnl 16/20 (80%)**, winRate 20/20 (100%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 11513 | 0.382 | 71 |
| 2 | -69481 | 0.258 | 62 |
| 3 | -25090 | 0.412 | 70 |
| 4 | -8465 | 0.405 | 76 |
| 5 | -10920 | 0.371 | 72 |
| 6 | -42642 | 0.281 | 67 |
| 7 | 85 | 0.429 | 73 |
| 8 | -56451 | 0.257 | 71 |
| 9 | 34685 | 0.486 | 79 |
| 10 | -11730 | 0.417 | 74 |
| 11 | -27138 | 0.432 | 78 |
| 12 | 32613 | 0.429 | 74 |
| 13 | -67088 | 0.258 | 64 |
| 14 | 18915 | 0.424 | 74 |
| 15 | -42867 | 0.344 | 70 |
| 16 | -14534 | 0.361 | 76 |
| 17 | -43892 | 0.353 | 73 |
| 18 | 73601 | 0.558 | 90 |
| 19 | -8318 | 0.387 | 65 |
| 20 | 28307 | 0.486 | 80 |

## w1 · nemotronultra

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.5, fraction 0.1, stopMult 1, tpMult 2.

Baseline A hold probability: 55% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (nemotronultra) | 8718 | 0.406 | 64 |
| Baseline B (MA20) | -1610 | 0.341 | 83 |
| Baseline A median (20 seeds) | 6217 | 0.347 | 51.5 |
| Baseline A range | -39770…22645 | 0.240…0.444 | — |

Percentile rank of real LLM within Baseline A null: **pnl 12/20 (60%)**, winRate 16/20 (80%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | -17330 | 0.280 | 50 |
| 2 | -16875 | 0.269 | 52 |
| 3 | -39770 | 0.240 | 51 |
| 4 | 8950 | 0.419 | 62 |
| 5 | 15504 | 0.344 | 65 |
| 6 | 19689 | 0.375 | 50 |
| 7 | 4543 | 0.360 | 50 |
| 8 | 22645 | 0.407 | 55 |
| 9 | -14567 | 0.276 | 59 |
| 10 | 9508 | 0.375 | 48 |
| 11 | -896 | 0.280 | 50 |
| 12 | 6775 | 0.417 | 48 |
| 13 | -28855 | 0.320 | 50 |
| 14 | 15006 | 0.379 | 58 |
| 15 | 1453 | 0.333 | 48 |
| 16 | 19324 | 0.444 | 55 |
| 17 | 5659 | 0.269 | 54 |
| 18 | 7453 | 0.400 | 60 |
| 19 | -11151 | 0.348 | 46 |
| 20 | 11131 | 0.346 | 53 |

## w2 · gemma4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.7, fraction 0.1, stopMult 2, tpMult 2.

Baseline A hold probability: 38% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (gemma4) | 5642 | 0.556 | 56 |
| Baseline B (MA20) | -19095 | 0.462 | 87 |
| Baseline A median (20 seeds) | -4104 | 0.500 | 72.5 |
| Baseline A range | -43887…36676 | 0.353…0.641 | — |

Percentile rank of real LLM within Baseline A null: **pnl 14/20 (70%)**, winRate 16/20 (80%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 7958 | 0.529 | 68 |
| 2 | -5843 | 0.472 | 77 |
| 3 | 36369 | 0.641 | 83 |
| 4 | -43887 | 0.429 | 72 |
| 5 | 10164 | 0.600 | 70 |
| 6 | 36676 | 0.583 | 74 |
| 7 | -14073 | 0.467 | 63 |
| 8 | -5932 | 0.513 | 80 |
| 9 | -2686 | 0.457 | 72 |
| 10 | 341 | 0.500 | 75 |
| 11 | -14915 | 0.472 | 76 |
| 12 | -25244 | 0.448 | 62 |
| 13 | -27140 | 0.419 | 63 |
| 14 | 2060 | 0.528 | 75 |
| 15 | 17940 | 0.588 | 71 |
| 16 | 11084 | 0.500 | 83 |
| 17 | -38001 | 0.353 | 73 |
| 18 | -40248 | 0.412 | 70 |
| 19 | -3026 | 0.553 | 79 |
| 20 | -5182 | 0.500 | 70 |

## w2 · nemotronultra

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.7, fraction 0.1, stopMult 2, tpMult 2.

Baseline A hold probability: 61% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (nemotronultra) | 2690 | 0.636 | 22 |
| Baseline B (MA20) | -19095 | 0.462 | 87 |
| Baseline A median (20 seeds) | 7906 | 0.551 | 51 |
| Baseline A range | -34251…63236 | 0.360…0.680 | — |

Percentile rank of real LLM within Baseline A null: **pnl 8/20 (40%)**, winRate 19/20 (95%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 9220 | 0.545 | 44 |
| 2 | -34251 | 0.360 | 51 |
| 3 | 10918 | 0.536 | 57 |
| 4 | -5148 | 0.517 | 59 |
| 5 | 17287 | 0.577 | 54 |
| 6 | 22245 | 0.591 | 44 |
| 7 | 63236 | 0.680 | 52 |
| 8 | -2197 | 0.500 | 48 |
| 9 | 21799 | 0.581 | 66 |
| 10 | 12169 | 0.571 | 43 |
| 11 | 37641 | 0.615 | 53 |
| 12 | 30239 | 0.560 | 51 |
| 13 | -6346 | 0.462 | 53 |
| 14 | -22329 | 0.381 | 43 |
| 15 | 4704 | 0.560 | 51 |
| 16 | 2306 | 0.500 | 49 |
| 17 | -23874 | 0.462 | 54 |
| 18 | 6592 | 0.556 | 55 |
| 19 | 18027 | 0.571 | 43 |
| 20 | 1565 | 0.524 | 43 |

## w3 · gemma4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.5, fraction 0.1, stopMult 1, tpMult 3.

Baseline A hold probability: 30% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (gemma4) | 23124 | 0.318 | 88 |
| Baseline B (MA20) | 11350 | 0.304 | 92 |
| Baseline A median (20 seeds) | 10070 | 0.310 | 72 |
| Baseline A range | -31364…43075 | 0.200…0.429 | — |

Percentile rank of real LLM within Baseline A null: **pnl 16/20 (80%)**, winRate 11/20 (55%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 39510 | 0.389 | 72 |
| 2 | 8169 | 0.314 | 72 |
| 3 | 9938 | 0.371 | 72 |
| 4 | -18136 | 0.226 | 63 |
| 5 | 11820 | 0.242 | 68 |
| 6 | 19768 | 0.368 | 78 |
| 7 | 22102 | 0.361 | 72 |
| 8 | 10203 | 0.282 | 78 |
| 9 | 2893 | 0.306 | 73 |
| 10 | -12222 | 0.229 | 71 |
| 11 | 31331 | 0.419 | 88 |
| 12 | 25223 | 0.342 | 76 |
| 13 | -31364 | 0.200 | 71 |
| 14 | 43075 | 0.429 | 85 |
| 15 | 7476 | 0.278 | 72 |
| 16 | 10640 | 0.270 | 75 |
| 17 | 3505 | 0.324 | 69 |
| 18 | -15349 | 0.212 | 66 |
| 19 | -2354 | 0.265 | 69 |
| 20 | 18100 | 0.333 | 74 |

## w3 · nemotronultra

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.6, fraction 0.1, stopMult 1, tpMult 3.

Baseline A hold probability: 53% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (nemotronultra) | 25892 | 0.345 | 58 |
| Baseline B (MA20) | 11350 | 0.304 | 92 |
| Baseline A median (20 seeds) | -4413 | 0.277 | 52.5 |
| Baseline A range | -23277…33720 | 0.105…0.500 | — |

Percentile rank of real LLM within Baseline A null: **pnl 17/20 (85%)**, winRate 14/20 (70%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 23541 | 0.478 | 48 |
| 2 | 25416 | 0.394 | 67 |
| 3 | 24976 | 0.364 | 67 |
| 4 | -13735 | 0.300 | 60 |
| 5 | -10402 | 0.208 | 50 |
| 6 | 6760 | 0.308 | 52 |
| 7 | -21188 | 0.174 | 46 |
| 8 | -2794 | 0.240 | 50 |
| 9 | -8815 | 0.226 | 62 |
| 10 | -22039 | 0.105 | 38 |
| 11 | 3883 | 0.286 | 56 |
| 12 | -11820 | 0.143 | 42 |
| 13 | -14664 | 0.217 | 47 |
| 14 | 9383 | 0.333 | 55 |
| 15 | -23277 | 0.190 | 43 |
| 16 | 31674 | 0.500 | 65 |
| 17 | -6032 | 0.269 | 54 |
| 18 | -22606 | 0.154 | 53 |
| 19 | 33720 | 0.400 | 50 |
| 20 | 33579 | 0.444 | 56 |

## Summary

| slice | model | real pnl | real wr | B pnl | B wr | null median | pnl pct | wr pct | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| w0 | gemma4 | 33398 | 0.364 | 44330 | 0.326 | 12286 | 95% | 80% | beats random, not the free MA rule |
| w0 | nemotronultra | 21047 | 0.667 | 81580 | 0.571 | 1698 | 75% | 100% | not distinguishable from noise |
| w1 | gemma4 | 22565 | 0.667 | -26383 | 0.405 | -11325 | 80% | 100% | not distinguishable from noise |
| w1 | nemotronultra | 8718 | 0.406 | -1610 | 0.341 | 6217 | 60% | 80% | not distinguishable from noise |
| w2 | gemma4 | 5642 | 0.556 | -19095 | 0.462 | -4104 | 70% | 80% | not distinguishable from noise |
| w2 | nemotronultra | 2690 | 0.636 | -19095 | 0.462 | 7906 | 40% | 95% | not distinguishable from noise |
| w3 | gemma4 | 23124 | 0.318 | 11350 | 0.304 | 10070 | 80% | 55% | not distinguishable from noise |
| w3 | nemotronultra | 25892 | 0.345 | 11350 | 0.304 | -4413 | 85% | 70% | not distinguishable from noise |

Cross-slice aggregate: 8 units; 1/8 in the random tail on PnL; 0/8 clear both baselines (PnL and win-rate); 6/8 beat Baseline B on both metrics.

## Caveats

- **Config-selection bias favors the LLM.** The winning stops-on config was chosen to maximize the real model's PnL on this slice; the baselines run a config not tuned for them. A failure to clear the tail is therefore decisive; a positive result is suggestive only.
- **Small trade counts and one regime.** Stops-on configs trade tens of trades per slice over ~26-day windows; the 20-seed null is coarse (90th percentile ≈ rank 18/20). Four months of correlated IDR data is one market regime, not a robustness guarantee across bull/chop/drawdown.
- **Fee sensitivity.** At 0.6% round trip, configs that trade more often are the most fee-exposed (Baseline B trades at every non-warmup decision).
