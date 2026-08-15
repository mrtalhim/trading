# Directional baseline control report — SOL/IDR slices

Generated 2026-08-10T08:09:11.446Z

Method: randomization test. For each slice the winning "best stops-on" risk config from the risk-regime sweep is held fixed; only the direction source changes — real LLM decisions vs **Baseline A** (seeded random direction, hold probability matched to the real model per slice, seeds 1–20) vs **Baseline B** (MA20 crossover, no randomness). The real model's PnL/win-rate percentile rank is taken within the 20-seed Baseline A null distribution. Same candles, same timestamps, same fees, same guardrails.

Setup: initialQuote 10,000,000 IDR, feeRate 0.003 per fill, minVolume 5, Baseline A fixed confidence 0.9, MA period 20.

Reading: percentile rank > 90 → credible directional signal; middle of the distribution → not distinguishable from noise; below Baseline B → the LLM is not earning its cost over a free rule.

## w0 · deepseekv4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.6, fraction 0.1, stopMult 2, tpMult 3.

Baseline A hold probability: 27% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (deepseekv4) | 50995 | 0.438 | 69 |
| Baseline B (MA20) | -31644 | 0.333 | 83 |
| Baseline A median (20 seeds) | -13872 | 0.387 | 73 |
| Baseline A range | -113115…76228 | 0.156…0.463 | — |

Percentile rank of real LLM within Baseline A null: **pnl 18/20 (90%)**, winRate 18/20 (90%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | -4922 | 0.385 | 81 |
| 2 | -11784 | 0.425 | 81 |
| 3 | -44530 | 0.405 | 81 |
| 4 | -49613 | 0.333 | 70 |
| 5 | 76228 | 0.463 | 83 |
| 6 | -20157 | 0.382 | 70 |
| 7 | -24965 | 0.400 | 71 |
| 8 | -15961 | 0.382 | 71 |
| 9 | -28737 | 0.344 | 70 |
| 10 | 10491 | 0.400 | 71 |
| 11 | 69584 | 0.463 | 85 |
| 12 | -44524 | 0.323 | 65 |
| 13 | 45126 | 0.424 | 72 |
| 14 | -22757 | 0.378 | 76 |
| 15 | 50046 | 0.421 | 78 |
| 16 | -113115 | 0.156 | 66 |
| 17 | 20696 | 0.432 | 80 |
| 18 | 18203 | 0.389 | 74 |
| 19 | -89492 | 0.267 | 66 |
| 20 | -3301 | 0.343 | 74 |

## w1 · deepseekv4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.5, fraction 0.1, stopMult 3, tpMult 3.

Baseline A hold probability: 32% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (deepseekv4) | 173216 | 0.553 | 78 |
| Baseline B (MA20) | 59124 | 0.511 | 95 |
| Baseline A median (20 seeds) | 12552 | 0.494 | 79 |
| Baseline A range | -159586…156643 | 0.324…0.615 | — |

Percentile rank of real LLM within Baseline A null: **pnl 20/20 (100%)**, winRate 15/20 (75%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: clears both baselines.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 111298 | 0.615 | 78 |
| 2 | -35362 | 0.432 | 79 |
| 3 | 80817 | 0.538 | 84 |
| 4 | 77699 | 0.537 | 86 |
| 5 | -16621 | 0.500 | 76 |
| 6 | -72061 | 0.438 | 71 |
| 7 | 43653 | 0.526 | 85 |
| 8 | -124371 | 0.324 | 70 |
| 9 | 41725 | 0.487 | 82 |
| 10 | 64718 | 0.500 | 79 |
| 11 | -151092 | 0.436 | 86 |
| 12 | 156643 | 0.568 | 76 |
| 13 | 100889 | 0.559 | 71 |
| 14 | -101515 | 0.421 | 85 |
| 15 | -65913 | 0.355 | 65 |
| 16 | -17209 | 0.486 | 79 |
| 17 | 45063 | 0.579 | 81 |
| 18 | -159586 | 0.368 | 77 |
| 19 | -88495 | 0.462 | 83 |
| 20 | 94574 | 0.564 | 83 |

## w2 · deepseekv4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.5, fraction 0.1, stopMult 3, tpMult 2.

Baseline A hold probability: 34% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (deepseekv4) | 124952 | 0.667 | 90 |
| Baseline B (MA20) | 144870 | 0.641 | 134 |
| Baseline A median (20 seeds) | 71279 | 0.640 | 91.5 |
| Baseline A range | -143536…187284 | 0.500…0.731 | — |

Percentile rank of real LLM within Baseline A null: **pnl 15/20 (75%)**, winRate 12/20 (60%).
Beats Baseline B on both PnL and win-rate: **no**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 150186 | 0.698 | 88 |
| 2 | 73348 | 0.651 | 88 |
| 3 | 107274 | 0.698 | 90 |
| 4 | 180357 | 0.731 | 108 |
| 5 | 36516 | 0.619 | 84 |
| 6 | -5476 | 0.628 | 92 |
| 7 | -143536 | 0.500 | 77 |
| 8 | -8603 | 0.587 | 96 |
| 9 | 157922 | 0.702 | 101 |
| 10 | 11488 | 0.575 | 84 |
| 11 | 22160 | 0.596 | 99 |
| 12 | -73946 | 0.568 | 79 |
| 13 | 187284 | 0.689 | 96 |
| 14 | 116828 | 0.620 | 105 |
| 15 | 89519 | 0.682 | 91 |
| 16 | 143051 | 0.714 | 101 |
| 17 | 63385 | 0.620 | 104 |
| 18 | 123319 | 0.711 | 97 |
| 19 | -14446 | 0.561 | 83 |
| 20 | 69211 | 0.659 | 86 |

## w3 · deepseekv4

Winning stops-on config (from risk-regime sweep, held fixed): minConf 0.5, fraction 0.1, stopMult 2, tpMult 3.

Baseline A hold probability: 30% (matched to the real model's observed holds).

| direction source | pnl | winRate | trades |
| --- | --- | --- | --- |
| real LLM (deepseekv4) | 102645 | 0.474 | 79 |
| Baseline B (MA20) | -9852 | 0.378 | 93 |
| Baseline A median (20 seeds) | 13681 | 0.419 | 77 |
| Baseline A range | -103301…190269 | 0.303…0.568 | — |

Percentile rank of real LLM within Baseline A null: **pnl 16/20 (80%)**, winRate 16/20 (80%).
Beats Baseline B on both PnL and win-rate: **yes**.
**Verdict: not distinguishable from noise.**

Baseline A per-seed detail:
| seed | pnl | winRate | trades |
| --- | --- | --- | --- |
| 1 | 18169 | 0.444 | 73 |
| 2 | -57399 | 0.303 | 68 |
| 3 | 134956 | 0.438 | 73 |
| 4 | 152578 | 0.500 | 87 |
| 5 | -39207 | 0.421 | 78 |
| 6 | 37382 | 0.378 | 78 |
| 7 | -17848 | 0.367 | 65 |
| 8 | 14901 | 0.421 | 78 |
| 9 | -11281 | 0.450 | 81 |
| 10 | -10416 | 0.486 | 77 |
| 11 | -103301 | 0.344 | 69 |
| 12 | 190269 | 0.568 | 77 |
| 13 | 12460 | 0.375 | 71 |
| 14 | 45765 | 0.351 | 78 |
| 15 | -31664 | 0.382 | 72 |
| 16 | 122895 | 0.488 | 84 |
| 17 | 46538 | 0.425 | 84 |
| 18 | -81124 | 0.364 | 67 |
| 19 | 53798 | 0.417 | 80 |
| 20 | 3456 | 0.400 | 76 |

## Summary

| slice | model | real pnl | real wr | B pnl | B wr | null median | pnl pct | wr pct | verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| w0 | deepseekv4 | 50995 | 0.438 | -31644 | 0.333 | -13872 | 90% | 90% | not distinguishable from noise |
| w1 | deepseekv4 | 173216 | 0.553 | 59124 | 0.511 | 12552 | 100% | 75% | clears both baselines |
| w2 | deepseekv4 | 124952 | 0.667 | 144870 | 0.641 | 71279 | 75% | 60% | not distinguishable from noise |
| w3 | deepseekv4 | 102645 | 0.474 | -9852 | 0.378 | 13681 | 80% | 80% | not distinguishable from noise |

Cross-slice aggregate: 4 units; 1/4 in the random tail on PnL; 1/4 clear both baselines (PnL and win-rate); 3/4 beat Baseline B on both metrics.

## Caveats

- **Config-selection bias favors the LLM.** The winning stops-on config was chosen to maximize the real model's PnL on this slice; the baselines run a config not tuned for them. A failure to clear the tail is therefore decisive; a positive result is suggestive only.
- **Small trade counts and one regime.** Stops-on configs trade tens of trades per slice over ~26-day windows; the 20-seed null is coarse (90th percentile ≈ rank 18/20). Four months of correlated IDR data is one market regime, not a robustness guarantee across bull/chop/drawdown.
- **Fee sensitivity.** At 0.6% round trip, configs that trade more often are the most fee-exposed (Baseline B trades at every non-warmup decision).
