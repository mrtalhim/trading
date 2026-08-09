# Directional baseline control report — ETH/IDR slices

Generated 2026-08-09T00:21:32.781Z

Method: randomization test. For each slice the winning "best stops-on" risk config from the risk-regime sweep is held fixed; only the direction source changes — real LLM decisions vs **Baseline A** (seeded random direction, hold probability matched to the real model per slice, seeds 1–20) vs **Baseline B** (MA20 crossover, no randomness). The real model's PnL/win-rate percentile rank is taken within the 20-seed Baseline A null distribution. Same candles, same timestamps, same fees, same guardrails.

Setup: initialQuote 10,000,000 IDR, feeRate 0.003 per fill, minVolume 0.2, Baseline A fixed confidence 0.9, MA period 20.

Reading: percentile rank > 90 → credible directional signal; middle of the distribution → not distinguishable from noise; below Baseline B → the LLM is not earning its cost over a free rule.

## w0 · deepseekv4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.5, fraction 0.1, stopMult 2, tpMult 3.

Baseline A hold probability: 23% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (deepseekv4) | 33651 | 0.412 | 73 |
| Baseline B (MA20) | -12836 | 0.343 | 76 |
| Baseline A median (20 seeds) | 44043 | 0.470 | 74 |
| Baseline A range | -28845…104374 | 0.333…0.575 | — |

Percentile rank of real LLM within Baseline A null: **pnl 7/20 (35%)**, winRate 6/20 (30%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 57995 | 0.441 | 72 |
| 2 | 10410 | 0.394 | 70 |
| 3 | 59771 | 0.382 | 72 |
| 4 | 44639 | 0.486 | 76 |
| 5 | 43447 | 0.537 | 84 |
| 6 | 19960 | 0.432 | 78 |
| 7 | 104374 | 0.553 | 81 |
| 8 | -13870 | 0.367 | 63 |
| 9 | 18248 | 0.455 | 69 |
| 10 | 74316 | 0.541 | 78 |
| 11 | 54563 | 0.528 | 74 |
| 12 | 62697 | 0.486 | 74 |
| 13 | -267 | 0.444 | 75 |
| 14 | 102182 | 0.550 | 84 |
| 15 | 48642 | 0.485 | 69 |
| 16 | -28845 | 0.333 | 72 |
| 17 | 38445 | 0.394 | 70 |
| 18 | -24825 | 0.394 | 72 |
| 19 | 77571 | 0.575 | 84 |
| 20 | 33960 | 0.486 | 79 |

## w1 · deepseekv4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.5, fraction 0.1, stopMult 2, tpMult 3.

Baseline A hold probability: 17% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (deepseekv4) | 135190 | 0.476 | 87 |
| Baseline B (MA20) | 100707 | 0.435 | 94 |
| Baseline A median (20 seeds) | 50769 | 0.458 | 82 |
| Baseline A range | -49520…125580 | 0.343…0.523 | — |

Percentile rank of real LLM within Baseline A null: **pnl 20/20 (100%)**, winRate 13/20 (65%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: clears both baselines.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 63660 | 0.513 | 78 |
| 2 | 17257 | 0.405 | 85 |
| 3 | 43743 | 0.447 | 81 |
| 4 | -28700 | 0.395 | 81 |
| 5 | -33401 | 0.353 | 72 |
| 6 | 73097 | 0.487 | 82 |
| 7 | 6020 | 0.410 | 80 |
| 8 | 28089 | 0.439 | 82 |
| 9 | 75996 | 0.475 | 82 |
| 10 | 105197 | 0.500 | 81 |
| 11 | 111067 | 0.511 | 91 |
| 12 | 125580 | 0.523 | 90 |
| 13 | -49520 | 0.343 | 73 |
| 14 | 82160 | 0.465 | 90 |
| 15 | -491 | 0.417 | 76 |
| 16 | 97268 | 0.500 | 86 |
| 17 | 29330 | 0.450 | 82 |
| 18 | 20703 | 0.425 | 82 |
| 19 | 97523 | 0.523 | 90 |
| 20 | 57795 | 0.475 | 84 |

## w2 · deepseekv4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.5, fraction 0.1, stopMult 3, tpMult 2.

Baseline A hold probability: 23% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (deepseekv4) | 18453 | 0.600 | 86 |
| Baseline B (MA20) | -22368 | 0.522 | 100 |
| Baseline A median (20 seeds) | -20740 | 0.541 | 81.5 |
| Baseline A range | -61857…41233 | 0.421…0.667 | — |

Percentile rank of real LLM within Baseline A null: **pnl 16/20 (80%)**, winRate 15/20 (75%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | -33069 | 0.500 | 87 |
| 2 | -51321 | 0.513 | 82 |
| 3 | 28436 | 0.541 | 78 |
| 4 | -25170 | 0.558 | 88 |
| 5 | -5902 | 0.528 | 76 |
| 6 | 20916 | 0.600 | 86 |
| 7 | -16311 | 0.605 | 93 |
| 8 | 10571 | 0.619 | 89 |
| 9 | -34953 | 0.568 | 79 |
| 10 | -1007 | 0.486 | 75 |
| 11 | 3080 | 0.600 | 92 |
| 12 | -41435 | 0.526 | 81 |
| 13 | -2213 | 0.639 | 77 |
| 14 | -42692 | 0.526 | 80 |
| 15 | -61857 | 0.444 | 78 |
| 16 | 34458 | 0.667 | 101 |
| 17 | -48568 | 0.421 | 81 |
| 18 | -25536 | 0.533 | 94 |
| 19 | 41233 | 0.614 | 92 |
| 20 | -54990 | 0.541 | 80 |

## w3 · deepseekv4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.7, fraction 0.1, stopMult 2, tpMult 3.

Baseline A hold probability: 25% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (deepseekv4) | 50081 | 0.579 | 40 |
| Baseline B (MA20) | 52159 | 0.479 | 98 |
| Baseline A median (20 seeds) | 25790 | 0.436 | 75 |
| Baseline A range | -45033…96337 | 0.258…0.556 | — |

Percentile rank of real LLM within Baseline A null: **pnl 14/20 (70%)**, winRate 20/20 (100%).
Beats Baseline B on both PnL and win-rate: **no**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 48716 | 0.548 | 84 |
| 2 | -37765 | 0.306 | 74 |
| 3 | 82102 | 0.475 | 85 |
| 4 | 18497 | 0.351 | 75 |
| 5 | 29237 | 0.459 | 74 |
| 6 | 20794 | 0.412 | 71 |
| 7 | 96337 | 0.556 | 93 |
| 8 | -45033 | 0.258 | 64 |
| 9 | 5407 | 0.405 | 75 |
| 10 | -19289 | 0.389 | 73 |
| 11 | 22908 | 0.465 | 88 |
| 12 | 78092 | 0.472 | 77 |
| 13 | 29219 | 0.344 | 65 |
| 14 | -15029 | 0.361 | 75 |
| 15 | 3222 | 0.355 | 64 |
| 16 | 58830 | 0.526 | 82 |
| 17 | 28673 | 0.487 | 82 |
| 18 | 57189 | 0.514 | 76 |
| 19 | 2780 | 0.389 | 73 |
| 20 | 58876 | 0.500 | 74 |

## Summary

| slice | model | real pnl | real wr | B pnl | B wr | null median | pnl pct | wr pct | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| w0 | deepseekv4 | 33651 | 0.412 | -12836 | 0.343 | 44043 | 35% | 30% | not distinguishable from noise |
| w1 | deepseekv4 | 135190 | 0.476 | 100707 | 0.435 | 50769 | 100% | 65% | clears both baselines |
| w2 | deepseekv4 | 18453 | 0.600 | -22368 | 0.522 | -20740 | 80% | 75% | not distinguishable from noise |
| w3 | deepseekv4 | 50081 | 0.579 | 52159 | 0.479 | 25790 | 70% | 100% | not distinguishable from noise |

Cross-slice aggregate: 4 units; 1/4 in the random tail on PnL; 1/4 clear both baselines (PnL and win-rate); 3/4 beat Baseline B on both metrics.

## Caveats

- **Config-selection bias favors the LLM.** The winning stops-on config was chosen to maximize the real model's PnL on this slice; the baselines run a config not tuned for them. A failure to clear the tail is therefore decisive; a positive result is suggestive only.
- **Small trade counts and one regime.** Stops-on configs trade tens of trades per slice over ~26-day windows; the 20-seed null is coarse (90th percentile ≈ rank 18/20). Four months of correlated IDR data is one market regime, not a robustness guarantee across bull/chop/drawdown.
- **Fee sensitivity.** At 0.6% round trip, configs that trade more often are the most fee-exposed (Baseline B trades at every non-warmup decision).
