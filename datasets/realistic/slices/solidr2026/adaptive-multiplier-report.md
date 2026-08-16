# Adaptive ATR multiplier report — datasets/realistic/slices/solidr2026

Generated 2026-08-16T06:00:56.437Z

Pre-registered analysis `docs/experiments/adaptive-atr-multiplier.md`. Control = per-slice best stops-on fixed config from the risk-regime sweep (oracle, in-sample). Treatment = same decisions/sizing/guardrails with the pre-committed regime-adaptive rule (window 96, thresholds 0.75/0.25, multipliers grid {1,2,3}×{2,3} → expanding 3/3, neutral 2/3, contracting 1/2). Only stop/TP multiplier selection differs between arms.

Setup: initialQuote 10,000,000 IDR, feeRate 0.003 per fill, minVolume 5, sweep grid minConfidences [0.5…0.9] × fraction 0.1.

Units processed: 4 (4 kept for analysis, 0 dropped for < 3 closing trades in an arm).

| unit | model | ctrl pnl | adap pnl | delta | ctrl wr | adap wr | ctrl dd | adap dd | ctrl tr | adap tr | ctrl closed | adap closed | expanding | neutral | contracting |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| w0 | deepseekv4 | 11226 | 17190 | 5963 | 0.387 | 0.412 | 0 | 0 | 68 | 73 | 31 | 34 | 10 | 15 | 14 |
| w1 | deepseekv4 | 59072 | -36763 | -95835 | 0.390 | 0.333 | 0 | 0 | 86 | 82 | 41 | 39 | 15 | 12 | 15 |
| w2 | deepseekv4 | 84459 | -38127 | -122586 | 0.727 | 0.235 | 0 | 0 | 47 | 37 | 22 | 17 | 6 | 8 | 6 |
| w3 | deepseekv4 | 23038 | -9975 | -33013 | 1.000 | 0.250 | 0 | 0 | 8 | 8 | 4 | 4 | 2 | 1 | 1 |

## Local paired bootstrap (per slice dir)

Paired deltas (adaptive − control) over 4 units, 10000 resamples, seed 20260815.

| statistic | value |
| --- | --- |
| mean paired delta | -61368 |
| 95% CI | -109211 … -13525 |
| units where adaptive > control | 1/4 |
| sum control PnL | 177795 |
| sum adaptive PnL | -67675 |

