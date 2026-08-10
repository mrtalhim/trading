# Risk/regime sweep report — SOL/IDR slices

Generated 2026-08-10T08:04:50.995Z

Grid: minConfidence {0.5..0.9} × fraction {0.1} × stops {off, on} × stopMult {1,2,3} × tpMult {2,3}

Setup: initialQuote 10,000,000 IDR, feeRate 0.003 per fill (0.6% round-trip, Indodax standard ~0.3%/side), minVolume 5 (guardrail active: rejects candles below that volume floor — set per dataset since volume is in base-coin units that differ by asset).

Metrics: realizedPnl (IDR, on initialQuote), winRate (closing trades), trades, maxDrawdown.

"Best" rows are the highest-PnL variant with at least 3 closing trades.

## w0 · deepseekv4 (101 decisions, 97% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.7 | 0.1 | off | 2 | 3 | 14 | 0.400 | 17464 | 0.127 |
| best stops-on | 0.6 | 0.1 | on | 2 | 3 | 69 | 0.438 | 50995 | 0.059 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 18 | 0.333 | -60793 |
| 0.6 | 17 | 0.2 | -134499 |
| 0.7 | 14 | 0.4 | 17464 |
| 0.8 | 6 | 0 | -22986 |
| 0.9 | 0 | 0 | 0 |

## w1 · deepseekv4 (101 decisions, 96% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.8 | 0.1 | off | 2 | 3 | 3 | 0.000 | 0 | 0.037 |
| best stops-on | 0.5 | 0.1 | on | 3 | 3 | 78 | 0.553 | 173216 | 0.056 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 41 | 0.353 | -668393 |
| 0.6 | 41 | 0.353 | -668393 |
| 0.7 | 17 | 0 | -1034311 |
| 0.8 | 3 | 0 | 0 |
| 0.9 | 0 | 0 | 0 |

## w2 · deepseekv4 (101 decisions, 98% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.5 | 0.1 | off | 2 | 3 | 24 | 0.375 | 24194 | 0.193 |
| best stops-on | 0.5 | 0.1 | on | 3 | 2 | 90 | 0.667 | 124952 | 0.108 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 24 | 0.375 | 24194 |
| 0.6 | 24 | 0.375 | 24194 |
| 0.7 | 35 | 0.286 | -56742 |
| 0.8 | 6 | 0 | -73472 |
| 0.9 | 0 | 0 | 0 |

## w3 · deepseekv4 (101 decisions, 93% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.8 | 0.1 | off | 2 | 3 | 6 | 0.000 | -206126 | 0.031 |
| best stops-on | 0.5 | 0.1 | on | 2 | 3 | 79 | 0.474 | 102645 | 0.035 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 26 | 0.222 | -255019 |
| 0.6 | 26 | 0.222 | -255019 |
| 0.7 | 40 | 0.278 | -487409 |
| 0.8 | 6 | 0 | -206126 |
| 0.9 | 0 | 0 | 0 |

## Summary

| slice | model | n | bestPnl no-stops | winRate no-stops | bestPnl stops-on | winRate stops-on |
| --- | --- | --- | --- | --- | --- | --- |
| w0 | deepseekv4 | 101 | 17464 | 0.400 | 50995 | 0.438 |
| w1 | deepseekv4 | 101 | 0 | 0.000 | 173216 | 0.553 |
| w2 | deepseekv4 | 101 | 24194 | 0.375 | 124952 | 0.667 |
| w3 | deepseekv4 | 101 | -206126 | 0.000 | 102645 | 0.474 |

## Caveats

- **Small trade counts.** No-stops configs trade 7–24 times per slice/model; a 100% win rate over 7 trades (e.g. w1) is within pure-luck range and should not anchor conclusions. Treat per-cell numbers as noisy; only cross-slice patterns are meaningful.
- **No configuration wins consistently across w0–w3.** PnL swings strongly positive to strongly negative by slice for both models under both stop regimes. This is the real result: fixed stop/TP multipliers do not rescue a signal whose directional accuracy is near coin-flip (M3.5 measured 47.8–52.9%). "Some periods trend, some chop" — a single fixed exit policy has no universal answer.
- **Fee sensitivity.** At 0.6% round trip, high-trade-count configs are the most fee-exposed; a higher fee (e.g. Indodax VIP tiers or maker/taker asymmetry) can flip which cells look best.
- **minVolume floor differs per dataset scale.** Volume is in base-coin units, and medians differ widely by asset (BTC/IDR ~0.1, ETH/IDR ~1.1, SOL/IDR ~24 per 15m candle). A floor suitable for one scale rejects everything on the other — hence the per-run minVolume override.
- **Call failures recorded as holds.** A small number of calls failed (network/timeout/429) and were recorded as holds; visible as decision rows without a `usage` field.

