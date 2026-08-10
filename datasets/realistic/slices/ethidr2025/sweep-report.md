# Risk/regime sweep report — ETH/IDR slices

Generated 2026-08-10T08:04:12.201Z

Grid: minConfidence {0.5..0.9} × fraction {0.1} × stops {off, on} × stopMult {1,2,3} × tpMult {2,3}

Setup: initialQuote 10,000,000 IDR, feeRate 0.003 per fill (0.6% round-trip, Indodax standard ~0.3%/side), minVolume 0.2 (guardrail active: rejects candles below that volume floor — set per dataset since volume is in base-coin units that differ by asset).

Metrics: realizedPnl (IDR, on initialQuote), winRate (closing trades), trades, maxDrawdown.

"Best" rows are the highest-PnL variant with at least 3 closing trades.

## w0 · deepseekv4 (101 decisions, 96% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.8 | 0.1 | off | 2 | 3 | 5 | 0.000 | 0 | 0.085 |
| best stops-on | 0.8 | 0.1 | on | 3 | 3 | 12 | 0.667 | 7365 | 0.004 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 7 | 0 | -11616 |
| 0.6 | 7 | 0 | -11616 |
| 0.7 | 17 | 0.2 | -24923 |
| 0.8 | 5 | 0 | 0 |
| 0.9 | 0 | 0 | 0 |

## w1 · deepseekv4 (101 decisions, 96% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.5 | 0.1 | off | 2 | 3 | 16 | 0.750 | 885 | 0.121 |
| best stops-on | 0.6 | 0.1 | on | 1 | 3 | 72 | 0.371 | 58288 | 0.055 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 16 | 0.75 | 885 |
| 0.6 | 16 | 0.75 | 885 |
| 0.7 | 7 | 0 | -7131 |
| 0.8 | 6 | 0.5 | -34700 |
| 0.9 | 0 | 0 | 0 |

## w2 · deepseekv4 (101 decisions, 94% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.8 | 0.1 | off | 2 | 3 | 10 | 0.333 | 312783 | 0.034 |
| best stops-on | 0.7 | 0.1 | on | 3 | 3 | 43 | 0.571 | 60263 | 0.059 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 53 | 0.318 | -166904 |
| 0.6 | 53 | 0.318 | -166904 |
| 0.7 | 16 | 0.25 | 93277 |
| 0.8 | 10 | 0.333 | 312783 |
| 0.9 | 0 | 0 | 0 |

## w3 · deepseekv4 (101 decisions, 97% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.5 | 0.1 | off | 2 | 3 | 13 | 0.000 | -86314 | 0.073 |
| best stops-on | 0.6 | 0.1 | on | 3 | 2 | 97 | 0.681 | 123806 | 0.038 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 13 | 0 | -86314 |
| 0.6 | 13 | 0 | -86314 |
| 0.7 | 24 | 0.25 | -201737 |
| 0.8 | 6 | 0 | -366296 |
| 0.9 | 0 | 0 | 0 |

## Summary

| slice | model | n | bestPnl no-stops | winRate no-stops | bestPnl stops-on | winRate stops-on |
| --- | --- | --- | --- | --- | --- | --- |
| w0 | deepseekv4 | 101 | 0 | 0.000 | 7365 | 0.667 |
| w1 | deepseekv4 | 101 | 885 | 0.750 | 58288 | 0.371 |
| w2 | deepseekv4 | 101 | 312783 | 0.333 | 60263 | 0.571 |
| w3 | deepseekv4 | 101 | -86314 | 0.000 | 123806 | 0.681 |

## Caveats

- **Small trade counts.** No-stops configs trade 7–24 times per slice/model; a 100% win rate over 7 trades (e.g. w1) is within pure-luck range and should not anchor conclusions. Treat per-cell numbers as noisy; only cross-slice patterns are meaningful.
- **No configuration wins consistently across w0–w3.** PnL swings strongly positive to strongly negative by slice for both models under both stop regimes. This is the real result: fixed stop/TP multipliers do not rescue a signal whose directional accuracy is near coin-flip (M3.5 measured 47.8–52.9%). "Some periods trend, some chop" — a single fixed exit policy has no universal answer.
- **Fee sensitivity.** At 0.6% round trip, high-trade-count configs are the most fee-exposed; a higher fee (e.g. Indodax VIP tiers or maker/taker asymmetry) can flip which cells look best.
- **minVolume floor differs per dataset scale.** Volume is in base-coin units, and medians differ widely by asset (BTC/IDR ~0.1, ETH/IDR ~1.1, SOL/IDR ~24 per 15m candle). A floor suitable for one scale rejects everything on the other — hence the per-run minVolume override.
- **Call failures recorded as holds.** A small number of calls failed (network/timeout/429) and were recorded as holds; visible as decision rows without a `usage` field.

