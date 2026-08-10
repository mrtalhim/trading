# USD/IDR context-arm experiment — pre-registered hypothesis & methodology

Status: **pre-registered 2026-08-10** (M3.8-style). Probe passes **deferred** to a later
session — this document commits the hypothesis, metric, causality rule, and
discard rule *before* any LLM result exists. Per the FNG precedent (M3.6) the
data snapshot and arm are cheap to build and trivially removable if the verdict
is discard.

## Motivation

IDR-denominated crypto prices move for two reasons at once: the underlying
USD-denominated crypto move and the USD/IDR fiat rate. `BTC/IDR ≈ BTC/USD × USD/IDR`
by construction. A model that sees only the IDR candles cannot separate a
crypto-driven move from a rupiah-driven move. The F&G experiment (M3.6) tested a
*daily sentiment* context and was discarded; USD/IDR is a different candidate
because it is **mechanically** tied to the asset's quote currency, not a
soft/psychological signal.

## Hypothesis (commit before running)

Appending the previous UTC-day USD/IDR reference rate to the LLM prompt lets the
model decompose IDR-denominated candle moves into their crypto vs fiat
components, improving decision quality **more than the ~30–60 token/call cost**.

Directional prediction: win rate improves; PnL and max drawdown are secondary.

## Data source (verified live 2026-08-10)

- **frankfurter.app** (ECB reference rates): free, keyless, business-day
  cadence, deep history (≥ 2018 verified).
- Puller: `scripts/pull-usdidr.mjs` → `packages/llm/data/usdidr.json`
  (3144 daily rates, 2017-12-29 → 2026-08-07, forward-filled onto every
  calendar day).
- **Causality**: the arm uses the rate for **the previous UTC day** relative to
  the decision candle's timestamp — never the same day (a candle close at
  02:30 UTC could not know that day's later-published rate). Forward-filling
  guarantees a lookup for weekends/holidays; a missing key renders the context
  line as `Fx: unavailable` (never blocks the decision).
- Bank Indonesia's `api.bi.go.id` requires an API key and returned empty without
  auth in a probe; frankfurter is the chosen source. Not an endorsement of one
  rate provider over another — a future re-run may switch and update the
  `source` field + checksum.

## Experiment design (identical rigor to M3.6/M3.7)

1. `--context=usdidr` arm: indicators + `Fx: USD/IDR <rate> — day <UTC-date>` block.
2. Paired A/B on the same recorded dataset slice, control `--context=indicators`
   vs treatment `--context=usdidr`, deepseek-v4-flash, 3 repeats, `--timeout
   60000`, correct per-asset `--min-volume`, ≥ 300 matched decision points/arm.
3. `benchmark abtest` — paired block bootstrap, block size 100.
4. **Primary metric: win rate** (pre-committed). Report also: pnlDelta /
   maxDdDelta means + CIs, directional accuracy, McNemar p, Fx snapshot
   availability rate.

## Discard rule (pre-committed)

- **Keep as an off-by-default configurable option** only if the win-rate delta
  CI excludes zero AND the improvement beats the added token cost.
- **Discard** (remove arm + snapshot) if no credible improvement — matching the
  fng precedent.
- **Promotion** to default context requires a larger, multi-regime confirmation.

## Cost estimate

~2 arms × 1 model × ~300 matched points ≈ 600 calls × ~1k tokens ≈ well under
$1 on deepseek-v4-flash.
