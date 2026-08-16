# Adaptive ATR multiplier report — datasets/realistic/slices/ethidr2025

Generated 2026-08-16T06:06:03.748Z

Pre-registered analysis `docs/experiments/adaptive-atr-multiplier.md`. Control = per-slice best stops-on fixed config from the risk-regime sweep (oracle, in-sample). Treatment = same decisions/sizing/guardrails with the pre-committed regime-adaptive rule (window 96, thresholds 0.75/0.25, multipliers grid {1,2,3}×{2,3} → expanding 3/3, neutral 2/3, contracting 1/2). Only stop/TP multiplier selection differs between arms.

Setup: initialQuote 10,000,000 IDR, feeRate 0.003 per fill, minVolume 0.2, sweep grid minConfidences [0.5…0.9] × fraction 0.1.

Units processed: 4 (4 kept for analysis, 0 dropped for < 3 closing trades in an arm).

| unit | model | ctrl pnl | adap pnl | delta | ctrl wr | adap wr | ctrl dd | adap dd | ctrl tr | adap tr | ctrl closed | adap closed | expanding | neutral | contracting |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| w0 | deepseekv4 | 7365 | -8951 | -16316 | 0.667 | 0.400 | 0 | 0 | 12 | 10 | 6 | 5 | 2 | 3 | 0 |
| w1 | deepseekv4 | 58288 | -19269 | -77557 | 0.371 | 0.417 | 0 | 0 | 72 | 74 | 35 | 36 | 11 | 13 | 13 |
| w2 | deepseekv4 | 60263 | 62719 | 2457 | 0.571 | 0.500 | 0 | 0 | 43 | 40 | 21 | 20 | 7 | 8 | 5 |
| w3 | deepseekv4 | 123806 | 99629 | -24177 | 0.681 | 0.447 | 0 | 0 | 97 | 81 | 47 | 38 | 9 | 18 | 16 |

## Local paired bootstrap (per slice dir)

Paired deltas (adaptive − control) over 4 units, 10000 resamples, seed 20260815.

| statistic | value |
| --- | --- |
| mean paired delta | -28898 |
| 95% CI | -62246 … -4202 |
| units where adaptive > control | 1/4 |
| sum control PnL | 249722 |
| sum adaptive PnL | 134129 |

