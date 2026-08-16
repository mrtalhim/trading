# Adaptive ATR multiplier report — datasets/realistic/slices/solidr2025

Generated 2026-08-16T06:09:44.592Z

Pre-registered analysis `docs/experiments/adaptive-atr-multiplier.md`. Control = per-slice best stops-on fixed config from the risk-regime sweep (oracle, in-sample). Treatment = same decisions/sizing/guardrails with the pre-committed regime-adaptive rule (window 96, thresholds 0.75/0.25, multipliers grid {1,2,3}×{2,3} → expanding 3/3, neutral 2/3, contracting 1/2). Only stop/TP multiplier selection differs between arms.

Setup: initialQuote 10,000,000 IDR, feeRate 0.003 per fill, minVolume 5, sweep grid minConfidences [0.5…0.9] × fraction 0.1.

Units processed: 4 (4 kept for analysis, 0 dropped for < 3 closing trades in an arm).

| unit | model | ctrl pnl | adap pnl | delta | ctrl wr | adap wr | ctrl dd | adap dd | ctrl tr | adap tr | ctrl closed | adap closed | expanding | neutral | contracting |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| w0 | deepseekv4 | 50995 | -4791 | -55786 | 0.438 | 0.375 | 0 | 0 | 69 | 68 | 32 | 32 | 14 | 13 | 9 |
| w1 | deepseekv4 | 173216 | 81559 | -91656 | 0.553 | 0.417 | 0 | 0 | 78 | 72 | 38 | 36 | 7 | 18 | 11 |
| w2 | deepseekv4 | 124952 | -25075 | -150028 | 0.667 | 0.353 | 0 | 0 | 90 | 72 | 42 | 34 | 10 | 14 | 14 |
| w3 | deepseekv4 | 102645 | 130041 | 27396 | 0.474 | 0.513 | 0 | 0 | 79 | 81 | 38 | 39 | 8 | 21 | 12 |

## Local paired bootstrap (per slice dir)

Paired deltas (adaptive − control) over 4 units, 10000 resamples, seed 20260815.

| statistic | value |
| --- | --- |
| mean paired delta | -67519 |
| 95% CI | -126467 … -2367 |
| units where adaptive > control | 1/4 |
| sum control PnL | 451808 |
| sum adaptive PnL | 181733 |

