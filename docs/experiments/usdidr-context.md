# USD/IDR context-arm experiment — pre-registered hypothesis & methodology

Status: **recorded 2026-08-10 — DISCARD verdict**. Built the `--context=usdidr`
arm (TDD), ran the pre-registered paired A/B (404 matched decision points/arm,
deepseek-v4-flash, 3 repeats, `--timeout 60000`), and per the pre-committed
discard rule removed the arm and snapshot. Report:
`apps/benchmark/ab-results/usdidr/paired-ab-60s.json`; verdict recorded in
ROADMAP M3.8. The hypothesis, metric, causality rule, and discard rule below
were committed *before* any LLM result existed.

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

## Result (recorded 2026-08-10)

Paired A/B, control `--context=indicators` vs treatment `--context=usdidr`,
deepseek-v4-flash, 3 repeats, `--timeout 60000`, block size 100, 404 matched
points/arm, total probe spend ≈ **$0.22** (98.8% / 99.2% valid JSON):

- **Win-rate delta −0.227, CI [−0.458, −0.050]** — primary metric **excludes 0
  on the harmful side** (treatment credibly lowers win rate).
- PnL delta −5.5, CI [−80.2, +46.5] — neutral.
- MaxDD delta +0.0003, CI [−0.0005, +0.0015] — neutral.
- Directional accuracy 51.7% → 47.6%; McNemar p = 0.79 (8/6 discordant).
- Only 118/2020 decisions changed (~6%); where the fx block changed the call,
  treatment lost (block 2: win rate 1.000 → 0.333).

**Verdict: discard.** The usdidr context credibly *hurts* the primary metric
with no compensating gain — matching the fng (M3.6) precedent. Arm code, CLI
threading, tests, the `usdidr.json` snapshot, and `pull-usdidr.mjs` are removed;
the report and this record remain.

## Selection bias — the null is decisive, a positive is only suggestive

The A/B re-probes recorded decisions whose risk configuration was tuned on the
model's own PnL (the sweep's "best stops-on" config). That tuning favors the
model, so a null/negative is decisive (discard without appeal) while a positive
is only suggestive (at most keep-as-configurable; requires fresh out-of-sample
confirmation before any architectural conclusion). One pass only — no re-running
with tweaked definitions after results exist. Identical rule to M3.5/M3.7.

## Cost estimate

~2 arms × 1 model × ~300 matched points ≈ 600 calls × ~1k tokens ≈ well under
$1 on deepseek-v4-flash.
