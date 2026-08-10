# M3.7 Order-book imbalance experiment — pre-registered analysis plan

Status: **pre-registered 2026-08-10**, while BTC/IDR depth collection is still
running (started 2026-08-09 ~15:30 UTC, target ≥ 300 matched decision points).
This document fixes the metric, the pairing, and the verdict thresholds **before**
the A/B is run, so no post-hoc reasoning can creep into the interpretation. The
build (fetchDepth / JsonlLoader orderbook / recorder / `--context=orderflow` arm)
and its TDD suite are already complete; this is the analysis contract.

## Hypothesis (committed before results)

Order-book imbalance at the decision candle's close is the most direct
publicly-available measure of imminent buy/sell pressure on Indodax. Including it
in the prompt should improve the LLM's near-term directional calls **more than
the ~60–80 token/call it adds** — a fair test of "does more context help" that
FNG's daily granularity (M3.6) could not provide.

Directional prediction: win rate improves; PnL / max drawdown are secondary.

## Metric (single, pre-committed)

Per candle close, from the snapshot stamped with that candle's own close
timestamp:

```
topBid = sum of top-5 bid sizes
topAsk = sum of top-5 ask sizes
imbalance = (topBid − topAsk) / (topBid + topAsk)   ∈ [−1, 1]
```

Rendered with `spread%` and best bid/ask. Versioned via a definition hash
(`patternVersion` convention). Deeply negative imbalance ⇒ sell-side pressure,
positive ⇒ buy-side pressure. No other order-book summary is used in the arm.

## Causality and availability

- The probe looks up the snapshot **only** at the decision candle's close
  timestamp (strict per-candle causality; `record-depth.mjs` stamps snapshots
  with the candle close). Missing snapshot → context renders `Orderbook:
  unavailable` (decision still proceeds).
- **Availability gate (pre-committed):** the A/B is only a valid run if ≥ 90%
  of matched decision points have a snapshot; availability is reported either way.

## Experiment design (identical rigor to M3.6)

1. Two fresh probe passes on the same dataset slice: control `--context=indicators`,
   treatment `--context=orderflow`, deepseek-v4-flash, 3 repeats, `--timeout 60000`,
   guardrails with correct per-asset `--min-volume` (BTC/IDR 0.02), ≥ 300 matched
   decision points/arm.
2. `benchmark abtest --control … --treatment …` — paired block bootstrap,
   **block size 100** (fng/M3.5 convention), on the collected dataset
   (`datasets/experiments/orderflow-btc_idr-15m-2026`).
3. **Primary metric: win rate** (pre-committed). Report also: pnlDelta /
   maxDdDelta means + CIs, directional accuracy, McNemar p, snapshot availability rate.
4. **One pass** — no re-running with tweaked definitions until something already
   looks statistically credible (that is p-hacking).

## Verdict thresholds (pre-committed)

- **Keep as an off-by-default configurable option** only if the win-rate delta CI
  excludes zero AND the improvement beats the added token cost.
- **Discard** (remove the arm and the collected snapshots) if no credible
  improvement — matching the fng (M3.6) precedent.
- **Promotion** to default context requires a larger, multi-regime confirmation;
  an experiment alone does not promote architecture.

## Collection status (as of 2026-08-10 ~03:50 UTC)

Recorder + canary running and healthy (PIDs checked, cadence aligned to 15m
boundaries, no duplicate/gap timestamps). 45 snapshots captured ≈ 10.75 h of a
~4–5 day target. Expected data-complete ~2026-08-13/14; the A/B runs once
collection + `--finalize` complete.
