# Risk/regime sweep report — BTC/IDR slices (free models)

Generated 2026-08-08T12:22:46.737Z

Grid: minConfidence {0.5..0.9} × fraction {0.1} × stops {off, on} × stopMult {1,2,3} × tpMult {2,3}

Setup: initialQuote 10,000,000, minVolume 0 (IDR volume column is in BTC units ~0.02, so the default floor of 100 rejects every entry), feeRate 0.

Metrics: realizedPnl, winRate (closing trades), trades, maxDrawdown.

## w0 · gemma4 (101 decisions, 96% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.9 | 0.1 | off | 2 | 3 | 0 | 0.000 | 0 | 0.000 |
| best stops-on | 0.5 | 0.1 | on | 1 | 3 | 83 | 0.341 | 32058 | 0.013 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 21 | 0.143 | -83355 |
| 0.6 | 21 | 0.143 | -83355 |
| 0.7 | 17 | 0.2 | -64312 |
| 0.8 | 9 | 0 | -55211 |
| 0.9 | 0 | 0 | 0 |

## w0 · nemotronultra (101 decisions, 72% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.8 | 0.1 | off | 2 | 3 | 1 | 0.000 | 0 | 0.000 |
| best stops-on | 0.7 | 0.1 | on | 3 | 3 | 12 | 0.667 | 21054 | 0.007 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 15 | 0 | -76478 |
| 0.6 | 24 | 0.222 | -49210 |
| 0.7 | 8 | 0 | -74038 |
| 0.8 | 1 | 0 | 0 |
| 0.9 | 0 | 0 | 0 |

## w1 · gemma4 (101 decisions, 97% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.8 | 0.1 | off | 2 | 3 | 7 | 1.000 | 270715 | 0.015 |
| best stops-on | 0.8 | 0.1 | on | 2 | 3 | 12 | 0.667 | 22579 | 0.032 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 7 | 1 | 85826 |
| 0.6 | 7 | 1 | 85826 |
| 0.7 | 8 | 1 | 114925 |
| 0.8 | 7 | 1 | 270715 |
| 0.9 | 0 | 0 | 0 |

## w1 · nemotronultra (101 decisions, 77% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.6 | 0.1 | off | 2 | 3 | 8 | 1.000 | 38259 | 0.138 |
| best stops-on | 0.5 | 0.1 | on | 1 | 2 | 64 | 0.406 | 8594 | 0.041 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 11 | 0.333 | 10723 |
| 0.6 | 8 | 1 | 38259 |
| 0.7 | 13 | 0.4 | -14628 |
| 0.8 | 0 | 0 | 0 |
| 0.9 | 0 | 0 | 0 |

## w2 · gemma4 (101 decisions, 96% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.5 | 0.1 | off | 2 | 3 | 20 | 0.429 | 44118 | 0.066 |
| best stops-on | 0.7 | 0.1 | on | 1 | 2 | 52 | 0.385 | 530 | 0.021 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 20 | 0.429 | 44118 |
| 0.6 | 20 | 0.429 | 44118 |
| 0.7 | 19 | 0.429 | 24769 |
| 0.8 | 5 | 0 | -15760 |
| 0.9 | 0 | 0 | 0 |

## w2 · nemotronultra (101 decisions, 65% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.8 | 0.1 | off | 2 | 3 | 1 | 0.000 | 0 | 0.000 |
| best stops-on | 0.7 | 0.1 | on | 2 | 2 | 22 | 0.636 | 2718 | 0.004 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 19 | 0.167 | -147867 |
| 0.6 | 19 | 0.167 | -147867 |
| 0.7 | 15 | 0.2 | -74249 |
| 0.8 | 1 | 0 | 0 |
| 0.9 | 0 | 0 | 0 |

## w3 · gemma4 (101 decisions, 95% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.7 | 0.1 | off | 2 | 3 | 24 | 0.429 | 16813 | 0.032 |
| best stops-on | 0.7 | 0.1 | on | 1 | 3 | 80 | 0.325 | 24358 | 0.012 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 61 | 0.435 | -21575 |
| 0.6 | 61 | 0.435 | -21575 |
| 0.7 | 24 | 0.429 | 16813 |
| 0.8 | 5 | 0 | -25395 |
| 0.9 | 0 | 0 | 0 |

## w3 · nemotronultra (101 decisions, 76% non-hold)

| variant | minConf | fraction | stops | stopMult | tpMult | trades | winRate | pnl | maxDD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| best no-stops | 0.6 | 0.1 | off | 2 | 3 | 12 | 0.667 | 74662 | 0.034 |
| best stops-on | 0.6 | 0.1 | on | 1 | 3 | 60 | 0.333 | 22265 | 0.012 |

minConfidence effect (stops off):
| minConf | trades | winRate | pnl |
| --- | --- | --- | --- |
| 0.5 | 16 | 0.4 | 37003 |
| 0.6 | 12 | 0.667 | 74662 |
| 0.7 | 9 | 0.5 | -75409 |
| 0.8 | 0 | 0 | 0 |
| 0.9 | 0 | 0 | 0 |

## Summary

| slice | model | n | bestPnl no-stops | winRate no-stops | bestPnl stops-on | winRate stops-on |
| --- | --- | --- | --- | --- | --- | --- |
| w0 | gemma4 | 101 | 0 | 0.000 | 32058 | 0.341 |
| w0 | nemotronultra | 101 | 0 | 0.000 | 21054 | 0.667 |
| w1 | gemma4 | 101 | 270715 | 1.000 | 22579 | 0.667 |
| w1 | nemotronultra | 101 | 38259 | 1.000 | 8594 | 0.406 |
| w2 | gemma4 | 101 | 44118 | 0.429 | 530 | 0.385 |
| w2 | nemotronultra | 101 | 0 | 0.000 | 2718 | 0.636 |
| w3 | gemma4 | 101 | 16813 | 0.429 | 24358 | 0.325 |
| w3 | nemotronultra | 101 | 74662 | 0.667 | 22265 | 0.333 |
