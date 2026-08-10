# Directional baseline control report — ETH/IDR slices

Generated 2026-08-10T08:08:13.330Z

Method: randomization test. For each slice the winning "best stops-on" risk config from the risk-regime sweep is held fixed; only the direction source changes — real LLM decisions vs **Baseline A** (seeded random direction, hold probability matched to the real model per slice, seeds 1–20) vs **Baseline B** (MA20 crossover, no randomness). The real model's PnL/win-rate percentile rank is taken within the 20-seed Baseline A null distribution. Same candles, same timestamps, same fees, same guardrails.

Setup: initialQuote 10,000,000 IDR, feeRate 0.003 per fill, minVolume 0.2, Baseline A fixed confidence 0.9, MA period 20.

Reading: percentile rank > 90 → credible directional signal; middle of the distribution → not distinguishable from noise; below Baseline B → the LLM is not earning its cost over a free rule.

## w0 · deepseekv4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.8, fraction 0.1, stopMult 3, tpMult 3.

Baseline A hold probability: 29% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (deepseekv4) | 7365 | 0.667 | 12 |
| Baseline B (MA20) | 13570 | 0.510 | 104 |
| Baseline A median (20 seeds) | 7888 | 0.513 | 81 |
| Baseline A range | -119932…63838 | 0.257…0.611 | — |

Percentile rank of real LLM within Baseline A null: **pnl 10/20 (50%)**, winRate 20/20 (100%).
Beats Baseline B on both PnL and win-rate: **no**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 42596 | 0.548 | 87 |
| 2 | 34385 | 0.447 | 82 |
| 3 | -101390 | 0.400 | 76 |
| 4 | -77646 | 0.410 | 81 |
| 5 | -9157 | 0.421 | 79 |
| 6 | 63838 | 0.595 | 90 |
| 7 | -3442 | 0.486 | 73 |
| 8 | 30639 | 0.525 | 86 |
| 9 | -119932 | 0.257 | 75 |
| 10 | 20627 | 0.525 | 83 |
| 11 | 11314 | 0.512 | 89 |
| 12 | -13380 | 0.559 | 69 |
| 13 | 56853 | 0.611 | 79 |
| 14 | 40440 | 0.524 | 89 |
| 15 | -41937 | 0.368 | 80 |
| 16 | 6439 | 0.558 | 90 |
| 17 | -39314 | 0.444 | 78 |
| 18 | 48147 | 0.587 | 97 |
| 19 | -58325 | 0.343 | 75 |
| 20 | 9338 | 0.514 | 81 |

## w1 · deepseekv4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.6, fraction 0.1, stopMult 1, tpMult 3.

Baseline A hold probability: 36% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (deepseekv4) | 58288 | 0.371 | 72 |
| Baseline B (MA20) | 4357 | 0.242 | 68 |
| Baseline A median (20 seeds) | 49468 | 0.377 | 71.5 |
| Baseline A range | -22841…153171 | 0.235…0.512 | — |

Percentile rank of real LLM within Baseline A null: **pnl 11/20 (55%)**, winRate 10/20 (50%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 78123 | 0.432 | 74 |
| 2 | 27270 | 0.294 | 70 |
| 3 | 43264 | 0.353 | 70 |
| 4 | 72026 | 0.371 | 71 |
| 5 | 4955 | 0.361 | 73 |
| 6 | 59593 | 0.385 | 79 |
| 7 | 58891 | 0.405 | 75 |
| 8 | -18388 | 0.250 | 64 |
| 9 | 25328 | 0.273 | 66 |
| 10 | 153171 | 0.512 | 89 |
| 11 | 84846 | 0.432 | 77 |
| 12 | 21830 | 0.344 | 65 |
| 13 | 127750 | 0.486 | 74 |
| 14 | 95629 | 0.389 | 75 |
| 15 | 8663 | 0.303 | 67 |
| 16 | 49446 | 0.382 | 70 |
| 17 | 30992 | 0.314 | 72 |
| 18 | -22841 | 0.235 | 68 |
| 19 | 113622 | 0.459 | 75 |
| 20 | 49490 | 0.400 | 71 |

## w2 · deepseekv4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.7, fraction 0.1, stopMult 3, tpMult 3.

Baseline A hold probability: 32% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (deepseekv4) | 60263 | 0.571 | 43 |
| Baseline B (MA20) | 87524 | 0.540 | 107 |
| Baseline A median (20 seeds) | 18596 | 0.524 | 85.5 |
| Baseline A range | -198513…282762 | 0.233…0.720 | — |

Percentile rank of real LLM within Baseline A null: **pnl 13/20 (65%)**, winRate 12/20 (60%).
Beats Baseline B on both PnL and win-rate: **no**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 118648 | 0.619 | 85 |
| 2 | 205026 | 0.659 | 91 |
| 3 | 6781 | 0.459 | 80 |
| 4 | 282762 | 0.700 | 106 |
| 5 | -12980 | 0.500 | 78 |
| 6 | -37048 | 0.432 | 78 |
| 7 | -23692 | 0.556 | 79 |
| 8 | -83961 | 0.415 | 86 |
| 9 | 164869 | 0.667 | 95 |
| 10 | -106134 | 0.436 | 83 |
| 11 | 5880 | 0.535 | 92 |
| 12 | 41502 | 0.500 | 69 |
| 13 | 111609 | 0.585 | 86 |
| 14 | 110268 | 0.512 | 90 |
| 15 | 30410 | 0.579 | 80 |
| 16 | -35351 | 0.452 | 88 |
| 17 | -43840 | 0.459 | 81 |
| 18 | 198913 | 0.720 | 102 |
| 19 | 30826 | 0.595 | 89 |
| 20 | -198513 | 0.233 | 64 |

## w3 · deepseekv4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.6, fraction 0.1, stopMult 3, tpMult 2.

Baseline A hold probability: 31% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (deepseekv4) | 123806 | 0.681 | 97 |
| Baseline B (MA20) | 75964 | 0.583 | 104 |
| Baseline A median (20 seeds) | 39015 | 0.628 | 92.5 |
| Baseline A range | -157993…242779 | 0.439…0.756 | — |

Percentile rank of real LLM within Baseline A null: **pnl 14/20 (70%)**, winRate 15/20 (75%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | -157993 | 0.452 | 84 |
| 2 | -66964 | 0.537 | 86 |
| 3 | 126438 | 0.667 | 95 |
| 4 | 5315 | 0.596 | 97 |
| 5 | 6626 | 0.628 | 88 |
| 6 | 92255 | 0.630 | 96 |
| 7 | -52654 | 0.526 | 82 |
| 8 | -9676 | 0.628 | 90 |
| 9 | -83284 | 0.500 | 93 |
| 10 | 59184 | 0.659 | 91 |
| 11 | -113732 | 0.568 | 94 |
| 12 | 152660 | 0.756 | 97 |
| 13 | 25089 | 0.538 | 84 |
| 14 | 81075 | 0.610 | 88 |
| 15 | 52942 | 0.644 | 96 |
| 16 | 242779 | 0.725 | 105 |
| 17 | 187824 | 0.745 | 100 |
| 18 | -144431 | 0.439 | 82 |
| 19 | 129692 | 0.727 | 97 |
| 20 | 147330 | 0.705 | 92 |

## Summary

| slice | model | real pnl | real wr | B pnl | B wr | null median | pnl pct | wr pct | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| w0 | deepseekv4 | 7365 | 0.667 | 13570 | 0.510 | 7888 | 50% | 100% | not distinguishable from noise |
| w1 | deepseekv4 | 58288 | 0.371 | 4357 | 0.242 | 49468 | 55% | 50% | not distinguishable from noise |
| w2 | deepseekv4 | 60263 | 0.571 | 87524 | 0.540 | 18596 | 65% | 60% | not distinguishable from noise |
| w3 | deepseekv4 | 123806 | 0.681 | 75964 | 0.583 | 39015 | 70% | 75% | not distinguishable from noise |

Cross-slice aggregate: 4 units; 0/4 in the random tail on PnL; 0/4 clear both baselines (PnL and win-rate); 2/4 beat Baseline B on both metrics.

## Caveats

- **Config-selection bias favors the LLM.** The winning stops-on config was chosen to maximize the real model's PnL on this slice; the baselines run a config not tuned for them. A failure to clear the tail is therefore decisive; a positive result is suggestive only.
- **Small trade counts and one regime.** Stops-on configs trade tens of trades per slice over ~26-day windows; the 20-seed null is coarse (90th percentile ≈ rank 18/20). Four months of correlated IDR data is one market regime, not a robustness guarantee across bull/chop/drawdown.
- **Fee sensitivity.** At 0.6% round trip, configs that trade more often are the most fee-exposed (Baseline B trades at every non-warmup decision).
