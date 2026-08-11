# Risk/regime sweep report — BTC/USDT slices (free models)

Generated 2026-08-10T13:03:26.355Z

Grid: minConfidence {0.5..0.9} × fraction {0.1} × stops {off, on} × stopMult {1,2,3} × tpMult {2,3}

Setup: initialQuote 10,000, feeRate 0.003 per fill (0.6% round-trip, Indodax standard ~0.3%/side), minVolume 100 (guardrail active: rejects candles below that volume floor — kept small for IDR because its volume column is in BTC units with median ~0.1, vs ~373 on the 2024 slice).

Metrics: realizedPnl, winRate (closing trades), trades, maxDrawdown.

"Best" rows are the highest-PnL variant with at least 3 closing trades.

## btc_15m_2024 · gemma4 (84 decisions, 56% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.7 | 0.1 | off | 2 | 3 | 13 | 0.000 | -198 | 0.051 |
| best stops-on | 0.8 | 0.1 | on | 1 | 2 | 28 | 0.286 | -17 | 0.009 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 42 | 0 | -221 |
| 0.6 | 42 | 0 | -221 |
| 0.7 | 13 | 0 | -198 |
| 0.8 | 11 | 0 | -254 |
| 0.9 | 1 | 0 | 0 |

## btc_15m_2024 · nemotronultra (84 decisions, 52% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.7 | 0.1 | off | 2 | 3 | 10 | 0.500 | 98 | 0.036 |
| best stops-on | 0.8 | 0.1 | on | 2 | 3 | 10 | 0.800 | 42 | 0.007 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 15 | 0.25 | -241 |
| 0.6 | 12 | 0 | -259 |
| 0.7 | 10 | 0.5 | 98 |
| 0.8 | 7 | 0.5 | 56 |
| 0.9 | 0 | 0 | 0 |

## Summary

| slice | model | n | bestPnl no-stops | winRate no-stops | bestPnl stops-on | winRate stops-on |
| --- | --- | --- | --- | --- | --- | --- |
| btc_15m_2024 | gemma4 | 84 | -198 | 0.000 | -17 | 0.286 |
| btc_15m_2024 | nemotronultra | 84 | 98 | 0.500 | 42 | 0.800 |

## Caveats

- **Small trade counts.** No-stops configs trade 7–24 times per slice/model; a 100% win rate over 7 trades (e.g. w1/gemma4) is within pure-luck range and should not anchor conclusions. Treat per-cell numbers as noisy; only cross-slice patterns are meaningful.
- **No configuration wins consistently across w0–w3.** PnL swings strongly positive to strongly negative by slice for both models under both stop regimes. This is the real result: fixed stop/TP multipliers do not rescue a signal whose directional accuracy is near coin-flip (M3.5 measured 47.8–52.9%). "Some periods trend, some chop" — a single fixed exit policy has no universal answer.
- **Fee sensitivity.** At 0.6% round trip, high-trade-count configs are the most fee-exposed; a higher fee (e.g. Indodax VIP tiers or maker/taker asymmetry) can flip which cells look best.
- **minVolume floor differs per dataset scale.** IDR volume is in BTC units (median ~0.1); the 2024 slice median is ~373. A floor suitable for one scale rejects everything on the other — hence the per-run minVolume override.
- **Free-tier noise.** A small number of calls failed (network/timeout/429) and were recorded as holds; visible as decision rows without a `usage` field. gemini was excluded entirely when its free-tier daily quota exhausted mid-run.

