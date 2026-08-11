# Risk/regime sweep report — BTC/IDR slices (free models)

Generated 2026-08-10T13:09:17.717Z

Grid: minConfidence {0.5..0.9} × fraction {0.1} × stops {off, on} × stopMult {1,2,3} × tpMult {2,3}

Setup: initialQuote 10,000,000, feeRate 0.003 per fill (0.6% round-trip, Indodax standard ~0.3%/side), minVolume 0.02 (guardrail active: rejects candles below that volume floor — kept small for IDR because its volume column is in BTC units with median ~0.1, vs ~373 on the 2024 slice).

Metrics: realizedPnl, winRate (closing trades), trades, maxDrawdown.

"Best" rows are the highest-PnL variant with at least 3 closing trades.

## w0 · gemma4 (101 decisions, 65% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.8 | 0.1 | off | 2 | 3 | 9 | 0.000 | -55185 | 0.033 |
| best stops-on | 0.7 | 0.1 | on | 1 | 3 | 67 | 0.364 | 33398 | 0.023 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 20 | 0.143 | -62787 |
| 0.6 | 20 | 0.143 | -62787 |
| 0.7 | 17 | 0.2 | -64177 |
| 0.8 | 9 | 0 | -55185 |
| 0.9 | 0 | 0 | 0 |

## w0 · nemotronultra (101 decisions, 53% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.6 | 0.1 | off | 2 | 3 | 12 | 0.000 | -49062 | 0.033 |
| best stops-on | 0.7 | 0.1 | on | 3 | 3 | 12 | 0.667 | 21047 | 0.008 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 11 | 0 | -61366 |
| 0.6 | 12 | 0 | -49062 |
| 0.7 | 8 | 0 | -74020 |
| 0.8 | 1 | 0 | 0 |
| 0.9 | 0 | 0 | 0 |

## w1 · gemma4 (101 decisions, 71% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.8 | 0.1 | off | 2 | 3 | 7 | 1.000 | 270715 | 0.015 |
| best stops-on | 0.8 | 0.1 | on | 2 | 3 | 12 | 0.667 | 22565 | 0.033 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 12 | 0.333 | 28349 |
| 0.6 | 12 | 0.333 | 28349 |
| 0.7 | 7 | 1 | 101367 |
| 0.8 | 7 | 1 | 270715 |
| 0.9 | 0 | 0 | 0 |

## w1 · nemotronultra (101 decisions, 45% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.6 | 0.1 | off | 2 | 3 | 7 | 1.000 | 37916 | 0.118 |
| best stops-on | 0.5 | 0.1 | on | 1 | 2 | 64 | 0.406 | 8718 | 0.051 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 11 | 0.333 | 10688 |
| 0.6 | 7 | 1 | 37916 |
| 0.7 | 13 | 0.4 | -14606 |
| 0.8 | 0 | 0 | 0 |
| 0.9 | 0 | 0 | 0 |

## w2 · gemma4 (101 decisions, 62% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.7 | 0.1 | off | 2 | 3 | 15 | 0.600 | 89410 | 0.052 |
| best stops-on | 0.7 | 0.1 | on | 2 | 2 | 56 | 0.556 | 5642 | 0.029 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 18 | 0.429 | 30724 |
| 0.6 | 18 | 0.429 | 30724 |
| 0.7 | 15 | 0.6 | 89410 |
| 0.8 | 5 | 0 | -15760 |
| 0.9 | 0 | 0 | 0 |

## w2 · nemotronultra (101 decisions, 39% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.7 | 0.1 | off | 2 | 3 | 15 | 0.200 | -74111 | 0.020 |
| best stops-on | 0.7 | 0.1 | on | 2 | 2 | 22 | 0.636 | 2690 | 0.005 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 19 | 0.167 | -147499 |
| 0.6 | 19 | 0.167 | -147499 |
| 0.7 | 15 | 0.2 | -74111 |
| 0.8 | 1 | 0 | 0 |
| 0.9 | 0 | 0 | 0 |

## w3 · gemma4 (101 decisions, 70% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.8 | 0.1 | off | 2 | 3 | 5 | 0.000 | -25391 | 0.015 |
| best stops-on | 0.5 | 0.1 | on | 1 | 3 | 88 | 0.318 | 23124 | 0.026 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 49 | 0.421 | -41601 |
| 0.6 | 49 | 0.421 | -41601 |
| 0.7 | 24 | 0.429 | -28017 |
| 0.8 | 5 | 0 | -25391 |
| 0.9 | 0 | 0 | 0 |

## w3 · nemotronultra (101 decisions, 47% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.6 | 0.1 | off | 2 | 3 | 12 | 0.667 | 74656 | 0.034 |
| best stops-on | 0.6 | 0.1 | on | 1 | 3 | 58 | 0.345 | 25892 | 0.021 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 32 | 0.364 | -36650 |
| 0.6 | 12 | 0.667 | 74656 |
| 0.7 | 9 | 0.5 | -75377 |
| 0.8 | 0 | 0 | 0 |
| 0.9 | 0 | 0 | 0 |

## Summary

| slice | model | n | bestPnl no-stops | winRate no-stops | bestPnl stops-on | winRate stops-on |
| --- | --- | --- | --- | --- | --- | --- |
| w0 | gemma4 | 101 | -55185 | 0.000 | 33398 | 0.364 |
| w0 | nemotronultra | 101 | -49062 | 0.000 | 21047 | 0.667 |
| w1 | gemma4 | 101 | 270715 | 1.000 | 22565 | 0.667 |
| w1 | nemotronultra | 101 | 37916 | 1.000 | 8718 | 0.406 |
| w2 | gemma4 | 101 | 89410 | 0.600 | 5642 | 0.556 |
| w2 | nemotronultra | 101 | -74111 | 0.200 | 2690 | 0.636 |
| w3 | gemma4 | 101 | -25391 | 0.000 | 23124 | 0.318 |
| w3 | nemotronultra | 101 | 74656 | 0.667 | 25892 | 0.345 |

## Caveats

- **Small trade counts.** No-stops configs trade 7–24 times per slice/model; a 100% win rate over 7 trades (e.g. w1/gemma4) is within pure-luck range and should not anchor conclusions. Treat per-cell numbers as noisy; only cross-slice patterns are meaningful.
- **No configuration wins consistently across w0–w3.** PnL swings strongly positive to strongly negative by slice for both models under both stop regimes. This is the real result: fixed stop/TP multipliers do not rescue a signal whose directional accuracy is near coin-flip (M3.5 measured 47.8–52.9%). "Some periods trend, some chop" — a single fixed exit policy has no universal answer.
- **Fee sensitivity.** At 0.6% round trip, high-trade-count configs are the most fee-exposed; a higher fee (e.g. Indodax VIP tiers or maker/taker asymmetry) can flip which cells look best.
- **minVolume floor differs per dataset scale.** IDR volume is in BTC units (median ~0.1); the 2024 slice median is ~373. A floor suitable for one scale rejects everything on the other — hence the per-run minVolume override.
- **Free-tier noise.** A small number of calls failed (network/timeout/429) and were recorded as holds; visible as decision rows without a `usage` field. gemini was excluded entirely when its free-tier daily quota exhausted mid-run.

