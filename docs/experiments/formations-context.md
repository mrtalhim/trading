# M3.9 Chart-formation context arm — pre-registered analysis plan

Status: **pre-registered 2026-08-15; executed 2026-08-15 — non-informative, no verdict** (formation fire rate 0.3% ≪ 10% gate; run needs a re-plan, detectors not tuned). See Execution record below. Buildable now — unlike order-flow depth
(M3.7) and trade tape (trades-imbalance.md), chart formations are computed
entirely from candles we already have complete, gapless history for. No live-only
source, no availability gate, no forward recorder. This document fixes the
threshold parameters, the metric, the pairing, and the verdict thresholds
**before** any detector is tuned against outcome data and **before** any LLM
probe runs.

## Motivation — why formations, after four nulls

The context-arm program so far: patterns (M3.5, mixed → keep-as-configurable),
F&G (M3.6, credibly harmful → discard), orderflow (M3.7, exploratory null,
availability gate failed), USD/IDR (M3.8, credibly harmful → discard). Four
straight rounds with no credible win-rate improvement. What all four have in
common: none of them changed the _shape_ of what the model sees — they appended
a signal block to the same candle dump. F&G was daily-granularity, USD/IDR daily,
orderflow instantaneous; all were single-value context. The direction call has
stayed near coin-flip across both regimes (ROADMAP M8 directional-baseline).

Chart formations are the one candidate that changes what the model can read over
a **medium horizon** (30–60+ candles): a head-and-shoulders or double top is
structure that exists across time, not a per-candle property. If the model is
noise-limited on direction, giving it resolved, completed multi-bar structure is
a qualitatively different test than the previous single-value arms — and it is
also the cheapest one to run, mechanically, because it is candle-derived.

## External parameter source (committed before any detector code)

Formation detectors are not unambiguous formulas like RSI; they need tolerance
parameters, and tuning those against our own win-rate data would be p-hacking
through the detector instead of through the stats. Parameters are anchored to
**Lo, Mamaysky & Wang (2000), "Foundations of Technical Analysis:
Computational Algorithms, Statistical Inference, and Empirical Implementation",
Journal of Finance 55(4): 1705–1770** — the standard academic reference on
algorithmic chart-pattern detection.

Honesty constraint, committed: LM&W detect patterns on a **kernel-smoothed**
price series. What the paper actually publishes is (a) the kernel-regression
smoothing principle, (b) local extrema as the feature primitive, and (c) the ten
formation definitions (head-and-shoulders, inverse H&S, double top/bottom, triple
top/bottom, rectangle, three triangles, broadening) as **perceptual comparisons
between extrema** — not a numeric tolerance table. The concrete tolerance numbers
below are therefore **our mapping** of LM&W's qualitative rules onto discrete
15m candles. That mapping is fixed and committed here, **before** any outcome
data exists; it is not re-tuned after results. Re-tuning any number in this table
because a run was disappointing is p-hacking and is disallowed.

## Swing-point detector first (its own tested unit)

Every formation is defined over local highs/lows (a head-and-shoulders is three
swing highs, middle tallest). Build the pivot/fractal detector first, in
`packages/indicators`, as its own unit with its own TDD suite validated against
known textbook chart examples — same discipline as the M3.5 candlestick
detectors — before any formation detector is built on top of it, since every
formation detector inherits its bugs otherwise.

Detection semantics (committed):

- A **swing high** at bar `i`: `high[i]` strictly greater than `high` of the
  `pivotLeft` bars before and `pivotRight` bars after. Flat tops produce no
  pivot (strict comparison — identical heights are not a pivot), matching the
  "no silently-wrong output" rule.
- A **swing low** mirrors it on `low`.
- **Insufficient history → no pivots, never a crash** (`candles.length ≤
pivotLeft + pivotRight + 1` → empty pivot list).
- Detection analyzes the **last candle of the window it receives**, and only
  reports **completed** formations: a double top/bottom or head-and-shoulders
  requires the last candle's close to have crossed the neckline (see
  confirmation rule below). An unconfirmed right side is `false`, not `true` —
  strict causality: the model only ever sees formations that have already
  resolved at decision time.

## Committed parameter table (fixed 2026-08-15, not tunable after results exist)

| Parameter                  | Value                                  | LM&W analog                                                                                         |
| -------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `pivotLeft` / `pivotRight` | `2` / `2`                              | local-extrema window; the discrete analog of the kernel bandwidth (wider = smoother = fewer pivots) |
| `minSwingSize`             | `0.5%` of median close over the window | suppresses micro-swings that are noise, not structure                                               |
| `minFormationSpan`         | `30` candles                           | formations are low-frequency; shorter windows return `false`                                        |
| `shoulderSymmetry`         | `5%`                                   | left/right shoulder pivot heights within 5% of each other                                           |
| `headMargin`               | `≥ 2%`                                 | head pivot strictly above both shoulders by ≥ 2%                                                    |
| `necklineSlope`            | `≤ 5%`                                 | absolute percentage slope of the fitted neckline over its span (near-horizontal)                    |
| `doubleEqualTolerance`     | `5%`                                   | the two tops (or bottoms) within 5% of each other                                                   |
| `valleyDepth`              | `≥ 2%`                                 | the intervening trough (or peak) at least 2% away from the two tops (or bottoms)                    |
| `confirmationRule`         | last close beyond the neckline         | completed-pattern-only, strict causality                                                            |

Formations in scope for the first slice (committed): `headAndShoulders`,
`inverseHeadAndShoulders`, `doubleTop`, `doubleBottom`. Additional formations
(triple top/bottom, rectangles, triangles, broadening) are **not** added this
round; if this round shows anything, a second slice may extend the set under the
same external-source rule. This is the LM&W top-frequency set and keeps the first
pass small.

## Metric (single, pre-committed)

The arm renders a compact, deterministic block to the user prompt:

```
Formations:
- version: <16-char hash>
- pivots: <n> (nHigh/nLow) over <lookback> candles
- headAndShoulders: <bool>; inverseHeadAndShoulders: <bool>
- doubleTop: <bool>; doubleBottom: <bool>
- neckline: <price> (slope <pct>%) [only when a neckline formation fired]
```

- Versioned via a definition hash over every parameter above + detector version
  constants (the `patternVersion` / `ORDERFLOW_VERSION` convention, 16-char hex).
- **Insufficient history → each boolean `false`**, the block still renders
  (`pivots: 0`), never throws, never suppresses the decision.
- No other formation summary is used in the arm.

## Lookback (pre-committed)

Default record/probe lookback is **20 candles** (`apps/benchmark/src/probe.ts`,
`apps/backtest/src/record.ts`) — too short for formations. Both arms run at
**`--lookback 60`** (already a CLI flag, no new plumbing). Same lookback on both
sides keeps pairing valid; the control arm's candle window is therefore not
byte-identical to the M3.6/M3.8 runs — noted, expected, not a defect. The
`minFormationSpan` of 30 plus `pivotLeft/pivotRight` of 2 means a 60-candle
window leaves room for a completed formation and its confirmation.

## Experiment design (identical rigor to M3.6/M3.8)

1. Build: pivot detector + formation detectors + `detectFormationContext` in
   `packages/indicators`; `--context=formations` arm in `packages/llm`
   (indicators + formations block); threaded through `backtest --record` and
   `benchmark probe`/`run`. Full TDD suite including the property tests below;
   `pnpm check` green before any probe runs.
2. Two fresh probe passes on the same dataset slice —
   `datasets/realistic/btc_idr_15m_2026` (real Indodax BTC/IDR 15m, 10,020
   candles, the paper-mode E2E dataset): control `--context=indicators`,
   treatment `--context=formations`, deepseek-v4-flash (cheapest paid model, M8
   pick), 3 repeats, `--timeout 60000`, `--lookback 60`, guardrails threaded with
   correct per-asset `--min-volume` (BTC/IDR 0.02), **≥ 300 matched decision
   points/arm**.
3. `benchmark abtest` — paired block bootstrap, **block size 100**, intersection
   pairing (the orderflow fix: pair on timestamps present in both arms; invalid
   probes map to `{action: hold, confidence: 0}` per M8 score parity).
4. **Primary metric: win rate** (pre-committed). Report also: pnlDelta /
   maxDdDelta means + CIs, directional accuracy, McNemar p, valid-JSON rate per
   arm, and the **formation fire rate** (fraction of matched points where ≥ 1
   completed formation fired).
5. **One pass** — no re-running with tweaked definitions or parameters after
   results exist (that is p-hacking).

## Quality gates (pre-committed, learned from the M3.7 degeneracy)

The orderflow run's lesson was a _degenerate metric_: the availability gate
failed and 92% of window candles fell under the `--min-volume` floor, so the
"null" sat on almost no actual signal. Two gates apply here:

- **Formation fire rate ≥ 10%** of matched decision points with ≥ 1 completed
  formation. If the detectors fire on fewer than 10% of points, the arm is
  effectively inert and the run is **non-informative, not a clean null** — the
  verdict is "no verdict", the block size / `minSwingSize` / `pivotLeft` /
  `pivotRight` are not tuned, and the run would need a re-plan. Reported either
  way.
- **Valid-JSON rate ≥ 85% per arm** (deepseekv4 ran 95–100% valid JSON in
  M3.6–M3.8 at `--timeout 60000`); below that the run is suspect on probe
  quality and reported as such.

Formations have no availability gate (always computable from history) — the fire
rate above replaces it as the signal-adequacy check.

## Verdict thresholds (pre-committed)

- **Keep as an off-by-default configurable option** only if the win-rate delta CI
  excludes zero AND the improvement beats the added token cost (~100–200
  tokens/call for the formations block).
- **Discard** (remove arm, detectors stay in `packages/indicators` only if they
  are genuinely dead code-removable per the keep/discard rule — at minimum they
  are not wired into any default) if no credible improvement — matching the
  fng/usdidr precedent. The pivot detector's TDD suite has standalone value and
  is retained regardless; the _arm_ is what the verdict governs.
- **Promotion** to default context requires a larger, multi-regime confirmation;
  an experiment alone does not promote architecture.

## Fifth-null decision rule (pre-committed 2026-08-15, before this run)

The pre-committed consequence of a fifth credible null — decided now, not after
seeing results. A "null" here means: win-rate delta CI includes zero (or excludes
zero harmfully), after a non-degenerate run per the gates above.

- **Trigger**: a fifth null in this experiment.
- **Action**: this is a recorded decision point, not an automatic change. The
  M3.5 verdict already leaned this way — "M9/M10 effort should concentrate on the
  risk/exit layer, not on chasing better direction" (ROADMAP M8 directional
  baseline) — and the orderflow/usdidr rounds have not weakened it. The trigger
  formally opens the **risk-engine-only review**: a milestone-scoped reassessment
  of whether the LLM direction call earns its token cost at all, versus
  deterministic rules (free MA baseline B already proved competitive) + the
  deterministic ATR stop/TP layer that carries the positive expectancy in both
  regimes.
- **What it is not**: the trigger does _not_ auto-disable the LLM or auto-enable
  the MA rule. Per PROJECT_CHARTER, architecture changes are decisions with
  pre-committed acceptance criteria of their own, made by the project. The fifth
  null converts "context arms are not paying off" from a private leaning into a
  recorded, reviewable finding with a named owner step.
- **Exception**: a credible win-rate improvement in _this_ run does not trigger
  the review; it follows the keep-as-configurable path (at most) and the
  multi-regime confirmation requirement still applies.

## Selection bias — the null is decisive, a positive is only suggestive

Same rule as M3.5/M3.7/M3.8: the A/B re-probes decisions whose risk config was
tuned on the model's own PnL (bias favors the model), so a null/negative is
decisive (discard) while a positive is only suggestive (keep-as-configurable at
most, needs fresh out-of-sample confirmation). One pass only.

## Property test (pre-committed, mirrors the M3.5 suite)

100k random candle windows:

- Never both `doubleTop` and `doubleBottom` on the same window
- Never both `headAndShoulders` and `inverseHeadAndShoulders` on the same window
- A completed formation always implies the confirmation rule held (last close
  beyond the neckline) — self-consistency
- No NaN, no non-boolean, no crash for any window length 0–100

## Cost estimate

~2 arms × 3 repeats × ≥ 300 matched points ≈ 1,800 calls at deepseek-v4-flash
(≈ $0.12–0.13/1000 decisions observed in M8 sweeps) plus a longer 60-candle
prompt and the ~150-token formations block ≈ **$0.30–0.60** total. Wall time
(~15–25 s/call, latency-bound) is the real cost, as before.

## Execution record (2026-08-15, pre-registered analysis applied as-is)

Ran on `datasets/realistic/btc_idr_15m_2026` (10,020 real Indodax BTC/IDR 15m
candles), 332 decision points seeded every 30th candle after the 60-candle
lookback warmup, deepseek-v4-flash, 3 repeats, `--timeout 60000`, `--lookback 60`,
`--min-volume 0.02`. Artifacts: `apps/benchmark/ab-results/formations/`.

| Arm | probes | valid-JSON (≥85%) | failures | cost USD | mean latency |
| --- | --- | --- | --- | --- | --- |
| control (`indicators`) | 996 (332×3) | 92.2% ✓ | 74 malformed / 3 timeout / 1 net | 0.271 | 8.7 s |
| treatment (`formations`) | 996 (332×3) | 90.1% ✓ | 90 malformed / 9 timeout | 0.283 | 11.1 s |

Both arms cleared the valid-JSON gate. Total spend $0.55, inside the estimate.

**Formation fire rate: 1/332 = 0.3%** (a single doubleTop) — far below the
pre-committed ≥10% signal-adequacy gate. The treatment block rendered
`neckline: n/a`, `headAndShoulders: false` … for 331 of 332 decision points.

**A/B result** (`benchmark abtest`, block size 100, 332 matched, paired
intersection, invalid → `{hold, 0}`):

| metric | delta mean | 95% CI |
| --- | --- | --- |
| win rate (**primary**) | −0.212 | −0.313 … −0.067 |
| pnl | +80.77 | 25.43 … 147.57 |
| max drawdown | +0.0097 | −0.0012 … 0.0240 |
| directional accuracy | 45.2% vs 49.2% | McNemar p = 1 |

**Verdict: non-informative → no verdict.** The pre-committed rule for fire rate
<10% is explicit: the arm is effectively inert, this is *not a clean null*, the
detector parameters (`pivotLeft/Right`, `minSwingSize`, block size) are **not
tuned**, and the run needs a re-plan. The win-rate CI excludes zero harmfully,
but with the mechanism activated once it says nothing about formations as
evidence — at most it says an inert extra block did not help. The fifth-null
trigger does **not** fire: it requires a non-degenerate null, and this run is
degenerate by the fire-rate gate.

**Not done (pre-committed prohibitions):** no detector re-tuning, no re-running
with tweaked definitions, no promotion, no default wiring. The pivot detector's
TDD suite stands on its own value; the arm stays off-by-default.

**Re-plan options (project decision, not an execution choice):** the gate was
set before any data; a re-plan could target the strict
completed-at-last-candle confirmation (the tightest constraint — the neckline
cross is a narrow window on 15m bars), e.g. "any completed formation within the
window" or a wider confirmation lookback, under a fresh pre-registration with the
same external-source rule. That is explicitly out of scope of this run.
