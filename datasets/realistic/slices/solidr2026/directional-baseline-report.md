# Directional baseline control report — SOL/IDR slices

Generated 2026-08-09T00:23:41.356Z

Method: randomization test. For each slice the winning "best stops-on" risk config from the risk-regime sweep is held fixed; only the direction source changes — real LLM decisions vs **Baseline A** (seeded random direction, hold probability matched to the real model per slice, seeds 1–20) vs **Baseline B** (MA20 crossover, no randomness). The real model's PnL/win-rate percentile rank is taken within the 20-seed Baseline A null distribution. Same candles, same timestamps, same fees, same guardrails.

Setup: initialQuote 10,000,000 IDR, feeRate 0.003 per fill, minVolume 5, Baseline A fixed confidence 0.9, MA period 20.

Reading: percentile rank > 90 → credible directional signal; middle of the distribution → not distinguishable from noise; below Baseline B → the LLM is not earning its cost over a free rule.

## w0 · deepseekv4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.5, fraction 0.1, stopMult 2, tpMult 3.

Baseline A hold probability: 31% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (deepseekv4) | 11226 | 0.387 | 68 |
| Baseline B (MA20) | 7157 | 0.395 | 93 |
| Baseline A median (20 seeds) | -20357 | 0.390 | 70.5 |
| Baseline A range | -54944…150772 | 0.269…0.625 | — |

Percentile rank of real LLM within Baseline A null: **pnl 14/20 (70%)**, winRate 10/20 (50%).
Beats Baseline B on both PnL and win-rate: **no**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 150772 | 0.625 | 66 |
| 2 | -16949 | 0.421 | 83 |
| 3 | 9339 | 0.333 | 68 |
| 4 | 22973 | 0.526 | 80 |
| 5 | -22668 | 0.361 | 73 |
| 6 | -34355 | 0.343 | 76 |
| 7 | -28133 | 0.367 | 65 |
| 8 | -21694 | 0.379 | 69 |
| 9 | -48227 | 0.344 | 69 |
| 10 | 68352 | 0.469 | 71 |
| 11 | -54944 | 0.371 | 77 |
| 12 | -54234 | 0.269 | 61 |
| 13 | 77023 | 0.576 | 75 |
| 14 | -19019 | 0.343 | 75 |
| 15 | 12058 | 0.438 | 70 |
| 16 | 44889 | 0.556 | 78 |
| 17 | -26782 | 0.424 | 74 |
| 18 | -40787 | 0.333 | 68 |
| 19 | -14522 | 0.448 | 64 |
| 20 | -24879 | 0.400 | 66 |

## w1 · deepseekv4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.6, fraction 0.1, stopMult 2, tpMult 3.

Baseline A hold probability: 17% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (deepseekv4) | 59072 | 0.390 | 86 |
| Baseline B (MA20) | 104820 | 0.408 | 102 |
| Baseline A median (20 seeds) | 80904 | 0.457 | 84.5 |
| Baseline A range | -64876…271661 | 0.343…0.578 | — |

Percentile rank of real LLM within Baseline A null: **pnl 9/20 (45%)**, winRate 5/20 (25%).
Beats Baseline B on both PnL and win-rate: **no**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 85456 | 0.474 | 79 |
| 2 | -18628 | 0.359 | 80 |
| 3 | 179007 | 0.578 | 95 |
| 4 | 137288 | 0.463 | 87 |
| 5 | -40932 | 0.361 | 76 |
| 6 | 76351 | 0.425 | 84 |
| 7 | -14457 | 0.343 | 73 |
| 8 | 39160 | 0.385 | 79 |
| 9 | 120153 | 0.533 | 93 |
| 10 | 271661 | 0.575 | 87 |
| 11 | 110146 | 0.476 | 87 |
| 12 | 140594 | 0.522 | 94 |
| 13 | -64876 | 0.343 | 76 |
| 14 | 101921 | 0.477 | 93 |
| 15 | 42480 | 0.439 | 86 |
| 16 | 93276 | 0.488 | 84 |
| 17 | 180719 | 0.463 | 85 |
| 18 | 25764 | 0.429 | 86 |
| 19 | 31883 | 0.450 | 82 |
| 20 | 33860 | 0.405 | 79 |

## w2 · deepseekv4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.7, fraction 0.1, stopMult 3, tpMult 2.

Baseline A hold probability: 20% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (deepseekv4) | 84459 | 0.727 | 47 |
| Baseline B (MA20) | 16308 | 0.565 | 103 |
| Baseline A median (20 seeds) | 52671 | 0.631 | 94 |
| Baseline A range | -96399…212470 | 0.488…0.750 | — |

Percentile rank of real LLM within Baseline A null: **pnl 14/20 (70%)**, winRate 19/20 (95%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 55093 | 0.568 | 94 |
| 2 | -80440 | 0.500 | 90 |
| 3 | 77711 | 0.565 | 95 |
| 4 | -19175 | 0.535 | 91 |
| 5 | -28288 | 0.500 | 90 |
| 6 | 192524 | 0.688 | 104 |
| 7 | 133410 | 0.675 | 90 |
| 8 | 87596 | 0.721 | 94 |
| 9 | -4636 | 0.550 | 87 |
| 10 | -96399 | 0.488 | 89 |
| 11 | 4774 | 0.619 | 91 |
| 12 | 48048 | 0.644 | 95 |
| 13 | -2289 | 0.643 | 89 |
| 14 | 148349 | 0.702 | 101 |
| 15 | -31459 | 0.535 | 92 |
| 16 | 50249 | 0.574 | 97 |
| 17 | 75505 | 0.673 | 105 |
| 18 | 80158 | 0.647 | 106 |
| 19 | 114284 | 0.644 | 95 |
| 20 | 212470 | 0.750 | 111 |

## w3 · deepseekv4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.8, fraction 0.1, stopMult 3, tpMult 2.

Baseline A hold probability: 27% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (deepseekv4) | 23038 | 1.000 | 8 |
| Baseline B (MA20) | -42606 | 0.500 | 102 |
| Baseline A median (20 seeds) | -6290 | 0.582 | 88 |
| Baseline A range | -84938…87450 | 0.378…0.690 | — |

Percentile rank of real LLM within Baseline A null: **pnl 15/20 (75%)**, winRate 20/20 (100%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | -33924 | 0.526 | 76 |
| 2 | 15101 | 0.600 | 94 |
| 3 | 5055 | 0.591 | 94 |
| 4 | -70067 | 0.475 | 83 |
| 5 | -7068 | 0.579 | 78 |
| 6 | -34983 | 0.585 | 86 |
| 7 | 46777 | 0.651 | 89 |
| 8 | -10377 | 0.543 | 94 |
| 9 | -5511 | 0.561 | 85 |
| 10 | -4900 | 0.556 | 93 |
| 11 | -47517 | 0.500 | 95 |
| 12 | 41249 | 0.659 | 86 |
| 13 | -84938 | 0.378 | 77 |
| 14 | -56095 | 0.488 | 88 |
| 15 | -19650 | 0.585 | 88 |
| 16 | -34707 | 0.561 | 86 |
| 17 | 87450 | 0.659 | 92 |
| 18 | 61771 | 0.682 | 93 |
| 19 | 8158 | 0.625 | 82 |
| 20 | 36094 | 0.690 | 89 |

## Summary

| slice | model | real pnl | real wr | B pnl | B wr | null median | pnl pct | wr pct | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| w0 | deepseekv4 | 11226 | 0.387 | 7157 | 0.395 | -20357 | 70% | 50% | not distinguishable from noise |
| w1 | deepseekv4 | 59072 | 0.390 | 104820 | 0.408 | 80904 | 45% | 25% | not distinguishable from noise |
| w2 | deepseekv4 | 84459 | 0.727 | 16308 | 0.565 | 52671 | 70% | 95% | not distinguishable from noise |
| w3 | deepseekv4 | 23038 | 1.000 | -42606 | 0.500 | -6290 | 75% | 100% | not distinguishable from noise |

Cross-slice aggregate: 4 units; 0/4 in the random tail on PnL; 0/4 clear both baselines (PnL and win-rate); 2/4 beat Baseline B on both metrics.

## Caveats

- **Config-selection bias favors the LLM.** The winning stops-on config was chosen to maximize the real model's PnL on this slice; the baselines run a config not tuned for them. A failure to clear the tail is therefore decisive; a positive result is suggestive only.
- **Small trade counts and one regime.** Stops-on configs trade tens of trades per slice over ~26-day windows; the 20-seed null is coarse (90th percentile ≈ rank 18/20). Four months of correlated IDR data is one market regime, not a robustness guarantee across bull/chop/drawdown.
- **Fee sensitivity.** At 0.6% round trip, configs that trade more often are the most fee-exposed (Baseline B trades at every non-warmup decision).
