# Risk/regime sweep report — BTC/USDT slices (free models)

Generated 2026-08-08T12:23:20.268Z

Grid: minConfidence {0.5..0.9} × fraction {0.1} × stops {off, on} × stopMult {1,2,3} × tpMult {2,3}

Setup: initialQuote 10,000, minVolume 0 (IDR volume column is in BTC units ~0.02, so the default floor of 100 rejects every entry), feeRate 0.

Metrics: realizedPnl, winRate (closing trades), trades, maxDrawdown.

## btc_15m_2024 · gemma4 (84 decisions, 99% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.9 | 0.1 | off | 2 | 3 | 1 | 0.000 | 0 | 0.000 |
| best stops-on | 0.9 | 0.1 | on | 1 | 2 | 2 | 0.000 | -11 | 0.008 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 42 | 0 | -222 |
| 0.6 | 42 | 0 | -222 |
| 0.7 | 13 | 0 | -198 |
| 0.8 | 11 | 0 | -254 |
| 0.9 | 1 | 0 | 0 |

## btc_15m_2024 · nemotronultra (84 decisions, 80% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.7 | 0.1 | off | 2 | 3 | 10 | 0.500 | 98 | 0.035 |
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
| btc_15m_2024 | gemma4 | 84 | 0 | 0.000 | -11 | 0.000 |
| btc_15m_2024 | nemotronultra | 84 | 98 | 0.500 | 42 | 0.800 |
