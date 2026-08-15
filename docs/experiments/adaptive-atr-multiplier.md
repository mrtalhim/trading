# Regime-adaptive ATR multiplier — pre-registered analysis plan

Status: **pre-registered 2026-08-15**. Nothing has been run. This document fixes
the rule, the comparison, the metric, and the verdict thresholds **before** any
backtest executes, so no post-hoc reasoning can creep into the interpretation.

## Motivation (what the sweeps already established)

- Stops-on is positive in **16/16 windows** in both regimes (2026 and 2025
  contrast regime), but **no universal fixed stopMult/tpMult exists** — the best
  fixed config flips by slice and asset (ROADMAP "Risk-regime sweeps" and "Older-
  window regime extension").
- Direction is near coin-flip and the positive expectancy lives entirely in the
  deterministic ATR stop/TP exits (directional baseline). So the highest-value
  next test of the risk engine is: can the **exit parameterization itself** be
  improved, not just validated?
- Directly observed in the sweep data: the winning stopMult/tpMult magnitude
  varied a lot slice to slice. A single rule that **widens the stop/TP in
  high-ATR (expanding) conditions and tightens them in low-ATR (contracting)
  conditions** is the most direct candidate for a multiplier that adapts without
  per-slice tuning.

This experiment reuses the directional-baseline framework exactly, swapping the
**variable** from "direction source" to "risk parameterization". Same recorded
decisions, same candles, same fees, same guardrails, same per-unit reporting.
**No new LLM calls — zero marginal spend.**

## Hypothesis (committed before results)

For the same recorded decisions and identical sizing/guardrails, a single
pre-committed regime-adaptive stop/TP multiplier rule produces **higher or equal
realized PnL per unit** than the per-slice best fixed stops-on config, and
strictly higher PnL on average across units.

Mechanism (falsifiable, not assumed to hold):
- **Expanding** ATR (high relative to recent history, typically trend/volatility
  expansion): wider stops avoid premature stop-outs on noise; wider TP lets the
  trend winner run.
- **Contracting** ATR (low relative to recent history, typically chop): tighter
  TP captures the smaller move before reversal; a tighter stop cuts losers fast.

## The adaptive rule (pre-committed, fixed before running)

At every entry at candle close `t`:

1. Let `a = ATR(14)` at candle `t` — the engine's existing per-candle ATR value
   (the same value that already sets the fixed stop/TP levels).
2. Regime window: the ATR values at candles `t-96 … t` inclusive (96 = 24 h of
   15 m candles). If fewer than 15 ATR values are available yet, state = neutral.
3. Percentile rank `p` of `a` within the window (fraction of window values ≤ `a`).
4. State → multipliers (all grid values taken from the sweep grid
   `stopMultipliers [1,2,3] × tpMultipliers [2,3]`):

   | `p` | state | stopMult | tpMult |
   | --- | --- | --- | --- |
   | `p ≥ 0.75` | expanding | 3 | 3 |
   | `0.25 < p < 0.75` | neutral | 2 | 3 |
   | `p ≤ 0.25` | contracting | 1 | 2 |

5. Exit levels set as today: `stop = open ± a·stopMult`, `tp = open ± a·tpMult`
   (direction-dependent), using the entry candle's own ATR.

The rule is deterministic, causal (only candles up to and including `t`), and
parameterized by exactly the two thresholds (0.75 / 0.25) and the window (96).
No other state, no rolling recalculation mid-trade — the levels are fixed at
entry exactly as in the fixed-config path.

## Comparison (reuse of directional-baseline.mjs)

For each unit (slice × model) in the existing recorded-decision corpus —
32 units: ETH/SOL deepseek-v4 × w0–w3 and BTC gemma4 + nemotronultra × w0–w3,
for both 2026 (Apr 26–Aug 8) and 2025 (Aug 31–Dec 13) windows:

- **Control (fixed, oracle)**: the per-slice best stops-on fixed config from the
  sweep (`bestStops`: max realizedPnl among stops-on rows with ≥ 3 closing
  trades) — exactly what `directional-baseline.mjs` already holds fixed.
- **Treatment (adaptive)**: the rule above, same decisions, same fraction, same
  minConfidence, same minVolume, same feeRate — only stopMult/tpMult become
  adaptive at each entry.
- Drop a unit only if either arm has fewer than 3 closing trades; report the
  count either way.

## Metric (single, pre-committed)

- **Primary: realized PnL.** Direction source is identical between arms, so the
  only thing measured is the exit policy — expectancy is the risk engine's job.
- Secondary, reported per unit and aggregated: win rate, max drawdown, trade
  count, and the adaptive rule's **state distribution** (fraction of entries in
  each state — guards against a degenerate rule that collapses into one state,
  which would make the test equivalent to a fixed-config comparison).

## Verdict thresholds (pre-committed)

Analysis: paired per-unit deltas (adaptive − control PnL), **10,000-resample
paired bootstrap over units with a fixed seed**, reporting the mean paired delta
and its 95% CI; plus the count of units where adaptive beats control (sign test).

- **Adopt** the adaptive rule as the default risk-engine parameterization only
  if the bootstrap CI **excludes zero** on the positive side **and** adaptive
  beats control on **≥ 20/32** units.
- **Not adopted** if the CI excludes zero on the negative side **or** includes
  zero. A CI-includes-zero is a **decisive null**: the comparison already favors
  control (per-slice in-sample selection), so "no better than the oracle" means
  there is no evidence the rule is worth shipping over a fixed config.
- **One pass only.** No re-running with tweaked window, thresholds, state set,
  or comparison after seeing results (that is p-hacking). A rejected rule's data
  stays on the experiment branch as the record.

## Selection bias — the null is decisive, a positive is only suggestive

- The control is the per-slice **best** of 18 stops-on configs, chosen on the
  slice's own realizedPnl (an oracle). Adaptive is a single pre-committed rule
  with zero per-slice tuning. The comparison therefore stacks the deck **against**
  adaptive, which is the correct discipline for a proposed default: if adaptive
  cannot clear an oracle control, it cannot justify replacing per-slice
  selection — and in live trading per-slice selection on future PnL is impossible
  anyway, so a fixed-rule-vs-oracle null is the honest adoption gate.
- A **positive** result is still suggestive only in the usual sense: 32 units are
  two regimes of correlated IDR data, and trade counts are tens per slice.
  Adoption would be a risk-engine parameterization change (deterministic code,
  not LLM), which is exactly the layer the non-negotiable says carries the edge —
  but a follow-up out-of-sample confirmation would precede any live default.

## Caveats (committed before running)

- **One-corpus test**: the rule is fit on no new data and validated on the same
  32 units that produced the control configs; the fixed side has the oracle
  advantage, the adaptive side has none.
- **Small trade counts**: tens of closing trades per slice; bootstrap CIs, not
  point estimates, are the reading.
- **Parameter sensitivity**: results apply to this exact rule (window 96,
  thresholds 0.75/0.25, grid {1,2,3}×{2,3}); a "no" here does not kill the whole
  adaptive family, and a "yes" does not promote every member of it.
- **Engine semantics**: stop-triggered exit fires on the stop price when the next
  candle's low/high crosses it; both-levels-crossed candles are handled stop-first
  (already covered by `tests/backtest/stops.test.ts`). The adaptive path reuses
  the same exit semantics — only the multiplier selection changes.

## Implementation notes (for when this is green-lit)

- Extend `BacktestConfig` with `riskParameterMode: 'fixed' | 'adaptive'`
  (default `'fixed'`, so existing replay behavior is byte-identical — same
  guarantee `enableStops` already carries).
- The engine already keeps `atrByTimestamp`; add a rolling window of the prior
  ATR values so the percentile rank is computed at entry time.
- TDD, mirroring `tests/backtest/stops.test.ts`: crafted ATR series asserting
  each state selects the right multipliers and stop/TP prices, the < 15-value
  warmup fallback, determinism, and that default replay is untouched.
- New script `scripts/adaptive-multiplier.mjs` modeled on
  `scripts/directional-baseline.mjs`: per unit, load decisions, run control
  (`bestStops`) and treatment (adaptive) through the engine, emit a per-unit
  table + bootstrap CI + state distribution to
  `datasets/realistic/slices/…/adaptive-multiplier-report.md` and a combined
  summary.
