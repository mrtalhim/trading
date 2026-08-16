# Adaptive ATR multiplier report — datasets/realistic/slices/idr2026

Generated 2026-08-16T06:05:03.894Z

Pre-registered analysis `docs/experiments/adaptive-atr-multiplier.md`. Control = per-slice best stops-on fixed config from the risk-regime sweep (oracle, in-sample). Treatment = same decisions/sizing/guardrails with the pre-committed regime-adaptive rule (window 96, thresholds 0.75/0.25, multipliers grid {1,2,3}×{2,3} → expanding 3/3, neutral 2/3, contracting 1/2). Only stop/TP multiplier selection differs between arms.

Setup: initialQuote 10,000,000 IDR, feeRate 0.003 per fill, minVolume 0.02, sweep grid minConfidences [0.5…0.9] × fraction 0.1.

Units processed: 8 (8 kept for analysis, 0 dropped for < 3 closing trades in an arm).

| unit | model | ctrl pnl | adap pnl | delta | ctrl wr | adap wr | ctrl dd | adap dd | ctrl tr | adap tr | ctrl closed | adap closed | expanding | neutral | contracting |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| w0 | gemma4 | 33398 | 27966 | -5432 | 0.364 | 0.516 | 0 | 0 | 67 | 63 | 33 | 31 | 12 | 13 | 7 |
| w0 | nemotronultra | 21047 | 21828 | 781 | 0.667 | 0.667 | 0 | 0 | 12 | 12 | 6 | 6 | 2 | 1 | 3 |
| w1 | gemma4 | 22565 | 22565 | 0 | 0.667 | 0.667 | 0 | 0 | 12 | 12 | 6 | 6 | 1 | 5 | 0 |
| w1 | nemotronultra | 8718 | -51295 | -60014 | 0.406 | 0.321 | 0 | 0 | 64 | 57 | 32 | 28 | 9 | 13 | 7 |
| w2 | gemma4 | 5642 | -8375 | -14016 | 0.556 | 0.417 | 0 | 0 | 56 | 50 | 27 | 24 | 2 | 14 | 10 |
| w2 | nemotronultra | 2690 | -22808 | -25498 | 0.636 | 0.364 | 0 | 0 | 22 | 22 | 11 | 11 | 2 | 4 | 5 |
| w3 | gemma4 | 23124 | 7652 | -15472 | 0.318 | 0.390 | 0 | 0 | 88 | 83 | 44 | 41 | 11 | 16 | 15 |
| w3 | nemotronultra | 25892 | 11882 | -14010 | 0.345 | 0.433 | 0 | 0 | 58 | 61 | 29 | 30 | 9 | 12 | 10 |

## Local paired bootstrap (per slice dir)

Paired deltas (adaptive − control) over 8 units, 10000 resamples, seed 20260815.

| statistic | value |
| --- | --- |
| mean paired delta | -16708 |
| 95% CI | -31031 … -5933 |
| units where adaptive > control | 1/8 |
| sum control PnL | 143076 |
| sum adaptive PnL | 9414 |

