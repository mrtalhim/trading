# Trade-tape aggressor-imbalance experiment — pre-registered analysis plan

Status: **pre-registered 2026-08-10**. Not yet buildable — the trade tape is a
**live-only** source on Indodax, so like order-flow depth (M3.7) this experiment
is gated on *forward* collection. It queues **behind** the current BTC/IDR depth
capture and would extend `scripts/record-depth.mjs` only after that collection
finalizes (one recorder, one capture cycle, per the no-parallel-live-collection
rule). This document fixes the metric, the causality rule, and the verdict
thresholds *before* any data exists.

## Why trades, after depth

Depth imbalance (M3.7) measures *resting* pressure; the trade tape measures
*executed* pressure. An aggressor imbalance over the minutes before a candle
close answers a different question: is the last flow being pushed through the
book (maker side), and in which direction? `/api/trades/{pair}` gives public
fills (`tid` as string, price/qty + side). It is the complement to the depth
arm, not a replacement — a model that sees both can distinguish "resting
buy-side" from "buying actually happening."

## Live-source probe (2026-08-10, recorded before this plan)

`/api/trades/{id}` returns only the **~500 most-recent fills (~112 min window)**
and **ignores the `since` param** — no historical tape. Same structural limit as
depth (M3.7 ROADMAP:107): the experiment therefore requires a forward recorder,
and collection is queued until the M3.7 capture completes.

## Hypothesis (committed before running)

Appending a pre-close aggressor-imbalance summary to the prompt lets the LLM
distinguish resting pressure from executed pressure, improving near-term
directional calls **more than the ~40–80 token/call it adds**.

Directional prediction: win rate improves; PnL / max drawdown are secondary.

## Metric (single, pre-committed)

Per candle close, over fills with `timestamp < close` (strictly before the
close):

```
buyVol  = Σ volume of buyside fills in window
sellVol = Σ volume of sellside fills in window
aggressorImbalance = (buyVol − sellVol) / (buyVol + sellVol)   ∈ [−1, 1]
```

with `window = [close − lookbackMs, close)`. Rendered with fill count and window
coverage (`coverage%` = observed fills vs expected cadence, so a sparse tape is
reported rather than silently trusted). Versioned via a definition hash (the
`patternVersion` / `ORDERFLOW_VERSION` convention). No other trade-tape summary
is used in the arm.

## Causality and availability

- **Fills-before-close causality:** only fills stamped strictly before the
  decision candle's close timestamp enter the window — never the current candle
  (its own close may reveal post-close flow). The recorder aligns to the same
  15m-boundary cadence as `record-depth.mjs`.
- **Availability gate (pre-committed):** a valid run requires ≥ 90% of matched
  decision points with a non-empty pre-close fill window; reported either way.

## Experiment design (identical rigor to M3.6/M3.7)

1. Two fresh probe passes on the same collected slice: control
   `--context=indicators`, treatment `--context=trades-imbalance`,
   deepseek-v4-flash, 3 repeats, `--timeout 60000`, correct per-asset
   `--min-volume`, **≥ 300 matched decision points/arm**.
2. `benchmark abtest` — paired block bootstrap, **block size 100**.
3. **Primary metric: win rate** (pre-committed). Report also: pnlDelta /
   maxDdDelta means + CIs, directional accuracy, McNemar p, coverage rate.
4. **One pass** — no re-running with tweaked definitions after results exist.

## Verdict thresholds (pre-committed)

- **Keep as an off-by-default configurable option** only if the win-rate delta CI
  excludes zero AND the improvement beats the added token cost.
- **Discard** if no credible improvement — matching the fng (M3.6) precedent.
- **Promotion** to default context requires a larger, multi-regime confirmation.

## Selection bias — the null is decisive, a positive is only suggestive

Same rule as M3.5/M3.7/M3.8: the A/B re-probes decisions whose risk config was
tuned on the model's own PnL (bias favors the model), so a null/negative is
decisive (discard) while a positive is only suggestive (keep-as-configurable at
most, needs fresh out-of-sample confirmation). One pass only.

## Collection plan (queued)

- Extend `scripts/record-depth.mjs` (or a sibling recorder) to append trade-tape
  buckets at the same 15m boundary, keyed to the candle close timestamp, only
  after the current M3.7 depth capture finalizes.
- Target: ~4–5 days to reach ≥ 300 matched points on BTC/IDR.
- Expected cost: zero (public endpoint, no API key); wall time is the only cost.
