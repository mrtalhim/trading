# Adaptive ATR multiplier report — datasets/realistic/slices/idr2025

Generated 2026-08-16T06:11:41.888Z

Pre-registered analysis `docs/experiments/adaptive-atr-multiplier.md`. Control = per-slice best stops-on fixed config from the risk-regime sweep (oracle, in-sample). Treatment = same decisions/sizing/guardrails with the pre-committed regime-adaptive rule (window 96, thresholds 0.75/0.25, multipliers grid {1,2,3}×{2,3} → expanding 3/3, neutral 2/3, contracting 1/2). Only stop/TP multiplier selection differs between arms.

Setup: initialQuote 10,000,000 IDR, feeRate 0.003 per fill, minVolume 0.02, sweep grid minConfidences [0.5…0.9] × fraction 0.1.

Units processed: 8 (8 kept for analysis, 0 dropped for < 3 closing trades in an arm).

| unit | model | ctrl pnl | adap pnl | delta | ctrl wr | adap wr | ctrl dd | adap dd | ctrl tr | adap tr | ctrl closed | adap closed | expanding | neutral | contracting |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| w0 | gemma4 | 17551 | 8211 | -9340 | 0.512 | 0.500 | 0 | 0 | 82 | 77 | 41 | 38 | 8 | 21 | 10 |
| w0 | nemotronultra | 28992 | 20700 | -8292 | 0.676 | 0.618 | 0 | 0 | 77 | 70 | 37 | 34 | 9 | 16 | 11 |
| w1 | gemma4 | 15176 | -20218 | -35394 | 0.364 | 0.375 | 0 | 0 | 67 | 66 | 33 | 32 | 9 | 15 | 10 |
| w1 | nemotronultra | 42371 | 25518 | -16854 | 0.769 | 0.538 | 0 | 0 | 26 | 26 | 13 | 13 | 8 | 3 | 2 |
| w2 | gemma4 | 41302 | 33347 | -7955 | 0.750 | 0.625 | 0 | 0 | 17 | 17 | 8 | 8 | 2 | 3 | 4 |
| w2 | nemotronultra | 87834 | 78049 | -9785 | 0.615 | 0.583 | 0 | 0 | 81 | 74 | 39 | 36 | 8 | 17 | 13 |
| w3 | gemma4 | 87716 | 92242 | 4525 | 0.512 | 0.463 | 0 | 0 | 91 | 86 | 41 | 41 | 9 | 20 | 16 |
| w3 | nemotronultra | 73186 | 39875 | -33312 | 0.568 | 0.364 | 0 | 0 | 79 | 68 | 37 | 33 | 6 | 15 | 14 |

## Local paired bootstrap (per slice dir)

Paired deltas (adaptive − control) over 8 units, 10000 resamples, seed 20260815.

| statistic | value |
| --- | --- |
| mean paired delta | -14551 |
| 95% CI | -23552 … -6335 |
| units where adaptive > control | 1/8 |
| sum control PnL | 394129 |
| sum adaptive PnL | 277724 |

