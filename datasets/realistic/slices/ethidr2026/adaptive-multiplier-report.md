# Adaptive ATR multiplier report — datasets/realistic/slices/ethidr2026

Generated 2026-08-16T05:59:44.861Z

Pre-registered analysis `docs/experiments/adaptive-atr-multiplier.md`. Control = per-slice best stops-on fixed config from the risk-regime sweep (oracle, in-sample). Treatment = same decisions/sizing/guardrails with the pre-committed regime-adaptive rule (window 96, thresholds 0.75/0.25, multipliers grid {1,2,3}×{2,3} → expanding 3/3, neutral 2/3, contracting 1/2). Only stop/TP multiplier selection differs between arms.

Setup: initialQuote 10,000,000 IDR, feeRate 0.003 per fill, minVolume 0.2, sweep grid minConfidences [0.5…0.9] × fraction 0.1.

Units processed: 4 (4 kept for analysis, 0 dropped for < 3 closing trades in an arm).

| unit | model | ctrl pnl | adap pnl | delta | ctrl wr | adap wr | ctrl dd | adap dd | ctrl tr | adap tr | ctrl closed | adap closed | expanding | neutral | contracting |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| w0 | deepseekv4 | 33651 | 30763 | -2888 | 0.412 | 0.412 | 0 | 0 | 73 | 73 | 34 | 34 | 8 | 15 | 15 |
| w1 | deepseekv4 | 135190 | 115250 | -19941 | 0.476 | 0.450 | 0 | 0 | 87 | 83 | 42 | 40 | 8 | 22 | 13 |
| w2 | deepseekv4 | 18453 | -31489 | -49942 | 0.600 | 0.313 | 0 | 0 | 86 | 69 | 40 | 32 | 7 | 19 | 11 |
| w3 | deepseekv4 | 50081 | 47139 | -2941 | 0.579 | 0.650 | 0 | 0 | 40 | 42 | 19 | 20 | 7 | 11 | 4 |

## Local paired bootstrap (per slice dir)

Paired deltas (adaptive − control) over 4 units, 10000 resamples, seed 20260815.

| statistic | value |
| --- | --- |
| mean paired delta | -18928 |
| 95% CI | -38192 … -2915 |
| units where adaptive > control | 0/4 |
| sum control PnL | 237374 |
| sum adaptive PnL | 161662 |

