# Risk/regime sweep report — BTC/IDR slices

Generated 2026-08-10T08:03:33.602Z

Grid: minConfidence {0.5..0.9} × fraction {0.1} × stops {off, on} × stopMult {1,2,3} × tpMult {2,3}

Setup: initialQuote 10,000,000 IDR, feeRate 0.003 per fill (0.6% round-trip, Indodax standard ~0.3%/side), minVolume 0.02 (guardrail active: rejects candles below that volume floor — set per dataset since volume is in base-coin units that differ by asset).

Metrics: realizedPnl (IDR, on initialQuote), winRate (closing trades), trades, maxDrawdown.

"Best" rows are the highest-PnL variant with at least 3 closing trades.

## w0 · gemma4 (101 decisions, 93% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.8 | 0.1 | off | 2 | 3 | 11 | 0.333 | -2315 | 0.024 |
| best stops-on | 0.5 | 0.1 | on | 1 | 2 | 82 | 0.512 | 17551 | 0.022 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 8 | 0 | -65650 |
| 0.6 | 8 | 0 | -65650 |
| 0.7 | 7 | 0 | -59786 |
| 0.8 | 11 | 0.333 | -2315 |
| 0.9 | 0 | 0 | 0 |

## w0 · nemotronultra (101 decisions, 88% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.7 | 0.1 | off | 2 | 3 | 10 | 0.333 | 19283 | 0.030 |
| best stops-on | 0.5 | 0.1 | on | 2 | 2 | 77 | 0.676 | 28992 | 0.019 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 11 | 0.333 | 10540 |
| 0.6 | 11 | 0.333 | 10540 |
| 0.7 | 10 | 0.333 | 19283 |
| 0.8 | 1 | 0 | 0 |
| 0.9 | 0 | 0 | 0 |

## w1 · gemma4 (101 decisions, 93% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.8 | 0.1 | off | 2 | 3 | 7 | 1.000 | 110537 | 0.026 |
| best stops-on | 0.7 | 0.1 | on | 1 | 3 | 67 | 0.364 | 15176 | 0.042 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 21 | 0.429 | -146893 |
| 0.6 | 21 | 0.429 | -146893 |
| 0.7 | 17 | 0.4 | -184429 |
| 0.8 | 7 | 1 | 110537 |
| 0.9 | 0 | 0 | 0 |

## w1 · nemotronultra (101 decisions, 86% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.8 | 0.1 | off | 2 | 3 | 4 | 1.000 | 102785 | 0.011 |
| best stops-on | 0.7 | 0.1 | on | 3 | 2 | 26 | 0.769 | 42371 | 0.032 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 35 | 0.364 | -182032 |
| 0.6 | 41 | 0.462 | -48285 |
| 0.7 | 6 | 0 | 0 |
| 0.8 | 4 | 1 | 102785 |
| 0.9 | 0 | 0 | 0 |

## w2 · gemma4 (101 decisions, 91% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.8 | 0.1 | off | 2 | 3 | 12 | 0.667 | 218549 | 0.029 |
| best stops-on | 0.8 | 0.1 | on | 3 | 3 | 17 | 0.750 | 41302 | 0.033 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 49 | 0.375 | -121235 |
| 0.6 | 49 | 0.375 | -121235 |
| 0.7 | 23 | 0.167 | -10433 |
| 0.8 | 12 | 0.667 | 218549 |
| 0.9 | 0 | 0 | 0 |

## w2 · nemotronultra (101 decisions, 83% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.8 | 0.1 | off | 2 | 3 | 3 | 0.000 | 0 | 0.000 |
| best stops-on | 0.5 | 0.1 | on | 2 | 3 | 81 | 0.615 | 87834 | 0.051 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 17 | 0.5 | -60182 |
| 0.6 | 30 | 0.4 | -19261 |
| 0.7 | 14 | 0.8 | -31672 |
| 0.8 | 3 | 0 | 0 |
| 0.9 | 0 | 0 | 0 |

## w3 · gemma4 (101 decisions, 91% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.8 | 0.1 | off | 2 | 3 | 16 | 0.500 | 40496 | 0.026 |
| best stops-on | 0.5 | 0.1 | on | 3 | 3 | 91 | 0.512 | 87716 | 0.034 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 16 | 0.6 | -65449 |
| 0.6 | 16 | 0.6 | -65449 |
| 0.7 | 22 | 0.429 | -213708 |
| 0.8 | 16 | 0.5 | 40496 |
| 0.9 | 0 | 0 | 0 |

## w3 · nemotronultra (101 decisions, 77% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.8 | 0.1 | off | 2 | 3 | 5 | 1.000 | 76942 | 0.019 |
| best stops-on | 0.5 | 0.1 | on | 3 | 3 | 79 | 0.568 | 73186 | 0.033 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 35 | 0.5 | -51127 |
| 0.6 | 35 | 0.5 | -51127 |
| 0.7 | 6 | 0 | 0 |
| 0.8 | 5 | 1 | 76942 |
| 0.9 | 0 | 0 | 0 |

## Summary

| slice | model | n | bestPnl no-stops | winRate no-stops | bestPnl stops-on | winRate stops-on |
| --- | --- | --- | --- | --- | --- | --- |
| w0 | gemma4 | 101 | -2315 | 0.333 | 17551 | 0.512 |
| w0 | nemotronultra | 101 | 19283 | 0.333 | 28992 | 0.676 |
| w1 | gemma4 | 101 | 110537 | 1.000 | 15176 | 0.364 |
| w1 | nemotronultra | 101 | 102785 | 1.000 | 42371 | 0.769 |
| w2 | gemma4 | 101 | 218549 | 0.667 | 41302 | 0.750 |
| w2 | nemotronultra | 101 | 0 | 0.000 | 87834 | 0.615 |
| w3 | gemma4 | 101 | 40496 | 0.500 | 87716 | 0.512 |
| w3 | nemotronultra | 101 | 76942 | 1.000 | 73186 | 0.568 |

## Caveats

- **Small trade counts.** No-stops configs trade 7–24 times per slice/model; a 100% win rate over 7 trades (e.g. w1) is within pure-luck range and should not anchor conclusions. Treat per-cell numbers as noisy; only cross-slice patterns are meaningful.
- **No configuration wins consistently across w0–w3.** PnL swings strongly positive to strongly negative by slice for both models under both stop regimes. This is the real result: fixed stop/TP multipliers do not rescue a signal whose directional accuracy is near coin-flip (M3.5 measured 47.8–52.9%). "Some periods trend, some chop" — a single fixed exit policy has no universal answer.
- **Fee sensitivity.** At 0.6% round trip, high-trade-count configs are the most fee-exposed; a higher fee (e.g. Indodax VIP tiers or maker/taker asymmetry) can flip which cells look best.
- **minVolume floor differs per dataset scale.** Volume is in base-coin units, and medians differ widely by asset (BTC/IDR ~0.1, ETH/IDR ~1.1, SOL/IDR ~24 per 15m candle). A floor suitable for one scale rejects everything on the other — hence the per-run minVolume override.
- **Call failures recorded as holds.** A small number of calls failed (network/timeout/429) and were recorded as holds; visible as decision rows without a `usage` field.

