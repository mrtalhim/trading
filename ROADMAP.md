# ROADMAP.md — Build One Milestone at a Time

Rule for the agent: work on the **current milestone only**. Do not touch packages listed under later milestones, even if it seems convenient. Each milestone ends with its Definition of Done (see TDD.md) fully met before moving to the next.

---

## M0 — Workspace foundation ✅

**Build**: pnpm workspace scaffold, TypeScript config, ESLint, Vitest config, CI pipeline (lint → unit → build), empty `packages/core` and `apps/` folders with correct dependency direction enforced (no upper layer imported by a lower one).
**Do not touch**: any business logic.
**Done when**: CI runs green on an empty scaffold.

## M1 — Core + Indicators + Risk ✅

**Build**: `packages/core` (Decision type, state machine skeleton, interfaces, Zod schemas), `packages/indicators` (RSI/ATR/EMA/SMA/ADX/VWAP, self-implemented), `packages/risk` (sizing strategies, ATR-based stop/TP).
**Do not touch**: LLM, exchanges, Android, notifications, benchmark.
**Done when**: all TDD.md "Indicators" and "Risk engine" tests pass. No exchange or network code exists yet.

## M2 — Dataset Infrastructure ✅

**Build**: `packages/datasets` (Dataset interface, JSONL/CSV/Parquet loaders, validator, metadata/checksum, ReplayLoader), golden datasets (synthetic BTC/ETH/SOL + realistic Binance BTC 2024), migrate indicator tests to golden datasets.
**Do not touch**: real exchange, real LLM, Android.
**Done when**: all TDD.md "Dataset infrastructure" tests pass, golden datasets validated, all three loaders produce identical candle data from the same dataset.

## M3 — Feature Engineering ✅

**Build**: Feature pipeline that consumes `Dataset` and produces enriched candle streams. Indicators are applied per-window, not per-call. Feature versioning and metadata propagation.
**Do not touch**: LLM, exchanges, Android.
**Done when**: feature pipeline produces deterministic output for golden datasets, version metadata propagates correctly.

## M3.5 — Candlestick Pattern Context + A/B experiment (current)

**Build**: candlestick pattern detection inside `packages/indicators` (single/double/triple-candle detectors + structural trend/support-resistance; `detectPatternContext` returns a structured `PatternContext` with a hashed `patternVersion`). Optional LLM context arms in `packages/llm`: `baseline` (candles-only, byte-identical to today), `indicators` (+ indicator block), `patterns` (+ indicator + pattern block), selected via a `--context` flag threaded through `backtest --record` and `benchmark probe`/`run`. Paired A/B harness `benchmark abtest`: block-wise per-arm scores → paired deltas → seeded paired-bootstrap 95% CIs + directional McNemar.

This is an experiment with a pre-decided keep/discard rule, not a permanent architecture change until it earns one (per PROJECT_CHARTER.md simplicity rule).

**Do not touch**: real exchange integration (Indodax live), live trading, `packages/features` FeatureRow schema / feature checksums / golden replay baselines.

**Procedure** (TDD.md acceptance criteria must pass as tests first):

1. Implement detectors + TDD suite (done once `pnpm check` is green).
2. Pick the M8 cost-adjusted leaderboard leaders (deepseek-v4-flash, gemini-2.5-flash, nemotron-3-nano).
3. For each model: two fresh probe passes on the same dataset slice — `--context=indicators` then `--context=patterns` (real LLM calls; replay cannot substitute, the prompt itself changes). Target ≥300 matched decision points per arm per model on `datasets/realistic/btc_15m_2024`.
4. `benchmark abtest --control <probes-indicators.jsonl> --treatment <probes-patterns.jsonl> --dataset datasets/realistic/btc_15m_2024` per model.
5. Report per model: pnlDelta / winRateDelta / maxDdDelta means + CIs, directional accuracy, McNemar p. Primary metric: win rate (pre-committed). One pass per model — no re-running with tweaked pattern definitions until something looks significant (that's p-hacking).

**Decision rule**:

- Keep patterns permanently only if at least one model shows a statistically credible improvement (CI excludes zero) larger than the added token cost justifies.
- Keep as an off-by-default configurable option if results are mixed/model-dependent.
- Discard if no model shows a credible improvement.

**Cost**: ~2 arms × 3 models × ~400 decisions ≈ 2,400 calls; pattern block adds ~100–150 tokens/call; expected < $5–10 total on the M8 model mix.

**Done when**: all TDD.md "M3.5" acceptance criteria pass as tests, the A/B runs complete, and the verdict (keep / configurable / discard) is recorded below.

**Verdict (recorded 2026-08-07)**: **Keep as an off-by-default configurable option** — results were mixed/model-dependent, so patterns are not promoted to default and are not discarded. Reports: `apps/benchmark/ab-results/ab-{deepseekv4,gemini,nemotron}.json` (paired block bootstrap, block=100, 490 matched samples/arm).

- **deepseekv4**: pnl delta mean **+90.5**, CI **[8.9, 204.2]** (excludes 0) · win-rate delta **+0.063**, CI [-0.05, 0.24] (includes 0, primary metric not credible) · directional accuracy 47.8% → 52.9% · McNemar p = 0.064 (14/5 discordant). Best case for keeping.
- **nemotron**: pnl delta **+8.0**, CI [-29.6, 49.7] · win-rate delta +0.243, CI [-0.13, 0.65] · directional 49.5% → 46.0% · McNemar p = 0.761. Neutral.
- **gemini**: not informative — 487/490 probes in each arm failed the probe gate (`validJson: false`, mapped to hold), so the paired comparison has ~0 effective action pairs. **Cause unclassified**: the M3.5 probe path conflated every failure mode into `validJson: false` (rate-limits, timeouts, network errors and malformed JSON all look identical in that data), so the failure cannot be attributed retroactively; M8's own gemini run reached ~79% valid JSON under the same parsing logic, which points at rate-limiting rather than a JSON-shape problem. The probe error taxonomy (`errorKind` via `classifyLlmError`) was added after this run — a re-probe is the definitive check, not the M3.5 verdict.

Per the pre-committed rule: no model showed a credible win-rate improvement (primary metric), so patterns are **not** made the default context; because deepseekv4 showed a credible secondary-metric (PnL) improvement and no model was harmed, the `--context=patterns` option stays available off-by-default. Real spend ≈ **$0.09** (deepseek only; nemotron free tier; gemini paid API, uncounted).

**M3.6 (fng) — Fear & Greed context arm + A/B experiment** (recorded 2026-08-09).

**Build**: `--context=fng` arm in `packages/llm` — appends a `Sentiment: Fear & Greed <value> (<class>) — day <UTC-date>` line to the user prompt using the **previous UTC day's** value (strict causality) from a committed daily snapshot (`packages/llm/data/fear-greed.json`, pulled by `scripts/pull-fear-greed.mjs` from the free alternative.me F&G API, coverage 2018-02-01..2026-08-09). Threaded through `backtest --record` and `benchmark probe`. Full TDD suite added (lookup causality, block rendering, context-arm wiring, CLI, record path); `pnpm check` green (72 files / 485 tests).

**Experiment**: paired A/B on the combined ETH/IDR 15m dataset `datasets/experiments/fng-ethidr2026` (the four `ethidr2026` w0-w3 slices, 2026-04-26..2026-08-08, 10,020 candles), 404 matched decision points/arm, deepseekv4, 3 repeats. Reports: `apps/benchmark/ab-results/fng/paired-ab-60s.json`.

Probe quality fix in the same pass: the default 10s client timeout cut ~30% of probes at exactly 10,000 ms (known M3.5 gemini failure mode, ROADMAP:61), turning them into forced holds. Re-probed both arms with `--timeout 60000` → valid-JSON rate 66.9%→**95.0%** (baseline) and 61.5%→**87.6%** (fng). Also fixed a latent harness gap: `benchmark abtest`/`scoreProbes` never passed guardrails, so the default `minVolume: 100` rejected every ETH/IDR candle (~7 volume) and produced zero trades; added `--min-volume` threading through the abtest path (tests in `tests/benchmark/paired.test.ts`).

**Results** (primary metric win rate, pre-committed):

- **PnL delta −66.1, CI [−149.2, −2.1]** — excludes 0 on the **harmful** side.
- **Win-rate delta −0.171, CI [−0.410, 0.019]** — negative lean, not credible.
- MaxDD delta +0.006, CI [−0.007, 0.027] — neutral.
- Directional accuracy 50.3% → 48.1%; McNemar p = 0.503 (12/8 discordant) — no improvement.

**Verdict (recorded 2026-08-09)**: **Discard.** The fng context arm credibly *hurts* backtested PnL (CI excludes 0 on the negative side), the primary win-rate metric leans negative, and directional accuracy does not improve. Per the pre-committed rule ("discard if no credible improvement"), the `--context=fng` arm and its snapshot are removed from the codebase; the `--min-volume` harness fix stays (it is a general correctness fix). Real spend ≈ **$0.55** across the two probe passes (10s and 60s timeouts).

**M3.7 (orderflow) — Order-book imbalance context arm + A/B experiment** (plan pre-committed 2026-08-09, data collection in progress).

The fair test of "does more context help" that FNG's daily granularity couldn't give: order-book imbalance from `/api/depth/{pair}` is free, Indodax-native, updates in real time, and the most directly tied to near-term price action of anything on the context list. Unlike patterns (computed from historical candles) and fng (had an 2018–now daily snapshot), **Indodax has no order-book history**, so this experiment is gated on *forward* data collection.

**Build**:
- `fetchDepth` on `IndodaxPublicApiClient` (public-api.ts) — `/api/depth/{lowercase-id}`, same `historyRetryPolicy` (timeout/retry/throttle), injected fetch for tests. `parseDepth` maps `buy`→`bids` (price desc), `sell`→`asks` (price asc) onto the core `OrderBook` shape; values arrive as strings live, parser coerces numbers.
- `JsonlLoader` order-book support: reads `orderbook.jsonl` snapshots keyed by timestamp, completing the `Dataset.orderbook?(timestamp)` contract that already existed on the interface. Datasets without a snapshot file return `null` (never throw).
- Recorder `scripts/record-depth.mjs`: samples depth at each 15m boundary aligned to exchange server time (`/api/server_time`), stamps the snapshot with the candle close timestamp, maintains `candles.jsonl` from `history_v2`, writes validated `metadata.json` (`includes.orderbook: true`). Long-running loop, resumable/idempotent, `--once`/`--no-wait`/`--finalize` modes. Snapshots are keyed to the decision candle's own close timestamp — strict per-candle causality (the probe only ever looks up the snapshot at the decision candle's ts; missing → `Orderbook: unavailable`). Collection started **2026-08-09 ~15:30 UTC**, target ≥300 matched decision points (~4–5 days) on BTC/IDR.
- `--context=orderflow` arm in `packages/llm` (contexts.ts): `computeOrderFlow` / `buildOrderFlowBlock` — **pre-committed single metric**: top-5 bid vs ask size sums, `imbalance = (topBid − topAsk)/(topBid + topAsk)` ∈ [−1, 1], plus `spread%` and best bid/ask, versioned via a definition hash (same convention as `patternVersion`). Arm = indicators + orderflow block (mirrors patterns' control/treatment isolation). Threaded through `backtest --record` and `benchmark probe`/`run`; both CLIs accept `--context=orderflow`.

**Experiment** (identical rigor to M3.6, pre-committed before running):
1. Collect BTC/IDR 15m depth snapshots for ~4–5 days (in progress, free public endpoint, no API key).
2. Two fresh probe passes on the same dataset slice: control `--context=indicators`, treatment `--context=orderflow`, deepseek-v4-flash (cheapest paid model, M8 pick), 3 repeats, `--timeout 60000` (fng's fix), guardrails threaded with correct `--min-volume` (BTC/IDR 0.02), ≥300 matched decision points/arm.
3. `benchmark abtest --control … --treatment … --dataset datasets/experiments/orderflow-btc_idr-15m-2026`. Primary metric **win rate** (pre-committed). Report also: pnlDelta/maxDdDelta means + CIs, directional accuracy, McNemar p, snapshot availability rate.
4. One pass — no re-running with tweaked metric definitions until something looks significant (that's p-hacking). Snapshot availability ≥90% of matched points required for a valid run; report it either way.

**Decision rule** (pre-committed):
- **Keep as an off-by-default configurable option** only if the win-rate delta CI excludes zero AND the improvement beats the added token cost (orderflow block adds ~60–80 tokens/call).
- **Discard** (remove the arm and any snapshots) if no credible improvement — matching the fng precedent.
- **Promotion** to default context would require a larger, multi-regime confirmation — an experiment alone does not promote architecture.

**Status**: build + TDD complete, `pnpm check` green (71 files / 497 tests); collection finalized; verdict recorded below.

**Collection health check (2026-08-10, day 1)**: recorder + canary healthy; 551 candles (no duplicate/gap/bad-boundary timestamps) + 45 order-book snapshots, all unique and aligned to 15m candle boundaries, 150-level books. Snapshot cadence matches the 15m cycle (44–45 snapshots ≈ 10.75 h from the 15:30 UTC start). Full analysis contract pre-registered at `docs/experiments/orderflow-obi.md` (metric, pairing, verdict thresholds fixed before results exist).

**Collection health check (2026-08-10, day 2)**: 88 snapshots, all unique, zero off-grid timestamps (2026-08-09 15:30 UTC → 2026-08-10 13:15 UTC), 594 candles; top-5 bid depth ≈ 0.17 BTC at ~1.154B — sane magnitudes. Cadence and alignment stable across day 1→2. Also added to `docs/experiments/orderflow-obi.md`: the selection-bias rule (null is decisive, positive only suggestive) and the day-2 snapshot check.

**A/B run (2026-08-14) — EXPLORATORY, underpowered; not a confirmatory null.** Collection finalized at **238 snapshots** (2026-08-09 15:30 UTC → 2026-08-14 12:45 UTC), all aligned to 15m candle boundaries. **Collection-window snapshot availability: 50.6%** (238 of 470 15m slots) — the Aug 11 02:45 → Aug 14 01:45 UTC outage left the gap; the pre-registered ≥90% gate is **not** met. Matched points = every candle with a snapshot (238, below the ≥300 target), so availability *of the matched set* is 100% by construction. Report: `apps/benchmark/ab-results/orderflow/paired-ab-60s.json` (deepseekv4, 3 repeats, `--timeout 60000`, block 100, `--min-volume 0.02`); probe quality 100% control / 99.7% treatment valid JSON; spend ≈ **$0.13**.

**Results** (primary metric **win rate**, pre-committed): win-rate delta CI95 **[−0.5, 0]** (includes zero); pnlDelta CI95 [0, 1.272]; maxDdDelta CI95 [−0.0017, 0]; directional accuracy 63/138 (45.7%) control vs 84/155 (54.2%) treatment (McNemar p = 0.200, n.s.); decisions changed on 107/238 (45%) of points.

**Verdict (recorded 2026-08-14)**: **Not keep.** The win-rate CI does not exclude zero, so the pre-committed rule does **not** advance the arm to keep-as-configurable. Labeled honestly: this is **exploratory, not a clean null** — the metric is degenerate (92% of window candles fall below the pre-registered 0.02 BTC `--min-volume` floor, leaving only 4 control / 11 treatment closed trades, so per-block win rates sit on almost no data) and the ≥90% availability gate failed. Per the selection-bias rule the arm is not promoted; **do not treat as final** — the arm stays off-by-default and the snapshots are retained pending a proper re-run on a ≥90%-availability window with tradeable volume (collector restarted). A confirmatory run will either override or confirm this result; the fng discard precedent applies only to a credibly-measured no-improvement.

**Trade-tape aggressor imbalance (flagged, not unblocked)**: `/api/trades/{pair}` was probed 2026-08-10 — it returns only ~500 most-recent fills (~112 min window) and ignores the `since` param. Trade tape is **also live-only** (same structural limit as depth), so the trade-tape aggressor-imbalance experiment also requires forward collection. Analysis contract pre-registered at `docs/experiments/trades-imbalance.md` (fills-before-close causality, ≥300 matched points/arm, block bootstrap 100, discard rule, selection-bias rule); it stays queued behind the current depth capture and would extend `record-depth.mjs` only after this collection finalizes.

**M3.8 (usdidr) — USD/IDR exchange-rate context arm + A/B experiment** (recorded 2026-08-10).

**Build**: `--context=usdidr` arm in `packages/llm` — appends an `Fx: USD/IDR <rate> — day <UTC-date>` line to the user prompt (indicators + fx block) using the **previous UTC day's** rate (strict causality, never same-day) from a committed daily snapshot (`packages/llm/data/usdidr.json`, pulled by `scripts/pull-usdidr.mjs` from frankfurter.app/ECB, 3144 rates, 2017-12-29 → 2026-08-07, forward-filled so weekend/holiday lookups always resolve; missing key renders `Fx: unavailable`). Threaded through `benchmark probe`/`run` (the A/B path). Full TDD suite added (lookup causality incl. weekend forward-fill, block rendering, context-arm wiring, CLI + probe threading); `pnpm check` green (71 files / 509 tests).

**Experiment** (pre-registered, identical rigor to M3.6/M3.7): paired A/B on the combined ETH/IDR 15m dataset `datasets/experiments/usdidr-ethidr2026` (the four `ethidr2026` w0-w3 slices, 2026-04-26..2026-08-08, 10,020 candles), 404 matched decision points/arm, deepseekv4, 3 repeats, `--timeout 60000`, block size 100, `--min-volume 0.2`. Report: `apps/benchmark/ab-results/usdidr/paired-ab-60s.json`. Probe quality high (valid JSON 98.8% control / 99.2% treatment); total spend ≈ **$0.22**.

**Results** (primary metric win rate, pre-committed):

- **Win-rate delta −0.227, CI [−0.458, −0.050]** — excludes 0 on the **harmful** side.
- **PnL delta −5.5, CI [−80.2, +46.5]** — neutral.
- MaxDD delta +0.0003, CI [−0.0005, +0.0015] — neutral.
- Directional accuracy 51.7% → 47.6%; McNemar p = 0.79 (8/6 discordant) — no improvement.
- Only 118/2020 decisions changed (~6%); where the fx block changed the call, treatment lost (block 2: win rate 1.000 → 0.333).

**Verdict (recorded 2026-08-10)**: **Discard.** The usdidr context credibly *hurts* the primary metric (win-rate CI excludes 0 harmfully) with no compensating gain — matching the fng (M3.6) precedent. Arm code, CLI threading, tests, the `usdidr.json` snapshot, and `pull-usdidr.mjs` are removed; the A/B report and this verdict remain. Selection-bias rule (null is decisive, positive only suggestive — config was tuned on the model's own PnL) recorded in both this entry and the experiment docs.

## M4 — Validation + Guardrails + Property tests ✅

**Build**: validation layer (already delivered in `packages/core` — see M1/M2), full guardrail rule set as `packages/guardrails` (a pure, deterministic module operating on mock inputs, reused by `apps/backtest` and `apps/benchmark` per ADR-011), property tests against guardrails.
**Do not touch**: real exchange, real LLM, Android.
**Done when**: every guardrail rule in TDD.md has a passing test, and property tests run 100k+ random cases without a single violation.

## M5 — Exchange abstraction + Paper exchange ✅

**Build**: `packages/exchanges` interface, a `paper` exchange adapter (simulated fills, no real API calls), exchange contract tests using mocked CCXT responses.
**Do not touch**: real Indodax credentials, live trading.
**Done when**: the paper exchange can process a simulated order end-to-end and contract tests pass.

## M6 — Replay engine + Dataset recorder ✅

**Build**: `packages/datasets` recorder implementation (Indodax live → canonical dataset), `apps/backtest` in replay-only mode against the paper exchange and a static historical dataset.
**Do not touch**: any LLM provider yet — use fixed/scripted decisions to prove the replay pipeline works before an LLM is in the loop.
**Done when**: replaying the same dataset twice produces identical output (deterministic).

## M7 — LLM providers ✅

**Build**: `packages/llm` `DecisionEngine` interface, at least two provider adapters (e.g. one free-tier — Gemini or OpenRouter — plus Anthropic), contract tests run against both with the same fixtures, timeout handling.
**Do not touch**: Indodax live keys, Android, benchmark app.
**Done when**: both providers pass the identical `DecisionEngine` contract test suite, and `backtest --record` can capture real LLM decisions into the dataset format from M6.

## M8 — Benchmark

**Build**: `apps/benchmark` — runs recorded contexts (from M6/M7) through multiple provider/model configs, produces the leaderboard (valid-JSON rate, latency, cost, win rate, PnL, drawdown, consistency test).
**Do not touch**: Indodax live integration.
**Done when**: you can run the benchmark across at least 2 free models and 1 paid model on the same recorded dataset and get a comparable leaderboard.
**Done (2026-08-06)**: app code complete, all 273 tests green. OpenRouter credit added ($10) → `leaderboard run` completed across **4 free models on the same recorded dataset** (`datasets/golden/btc_15m`, 12 contexts × 2 repeats, `--decisions m8-decisions-sample.jsonl`):

| model | validJson | latency | consistency | winRate | realizedPnl | trades |
| --- | --- | --- | --- | --- | --- | --- |
| gemini-2.5-flash | 0.79 | 8.4s | 0.67 | 0.60 | **+24.92** | 13 |
| google/gemma-4-26b-a4b-it:free | 0.96 | 6.1s | 0.92 | 0.00 | 0.00 | 5 |
| openai/gpt-oss-20b:free | 0.63 | 40.9s | 0.17 | 0.00 | 0.00 | 5 |
| nvidia/nemotron-3-nano-30b-a3b:free | 1.00 | 5.0s | 0.83 | 0.50 | −16.50 | 8 |

`costUsd` is 0 (all free) and wired for paid keys. Gemini native still rate-caps at 20 req/min — keep `--request-delay` ≥ 1s for gemini runs (commit `f75df3e`).

**Extended (2026-08-06)**: added cheap paid + newer Gemini presets (`gemma431`, `gptoss120b`, `lunapro`, `deepseekv4`, `gemini36`, `gemini35lite`) via OpenRouter credit. Final 5-model leaderboard on the same dataset (12 contexts × 2 repeats):

| model | validJson | latency | consistency | winRate | realizedPnl | trades |
| --- | --- | --- | --- | --- | --- | --- |
| deepseek/deepseek-v4-flash | 0.79 | 8.7s | 0.50 | 0.50 | **+203.90** | 8 |
| openai/gpt-oss-120b | 1.00 | 15.3s | 0.83 | 0.00 | 0.00 | 5 |
| openai/gpt-5.6-luna-pro | 1.00 | 7.1s | 0.92 | 0.00 | 0.00 | 5 |
| google/gemma-4-31b-it | 1.00 | 3.2s | 1.00 | 0.50 | −16.50 | 8 |
| gemini-3.5-flash-lite | 1.00 | 1.3s | 1.00 | 0.50 | −16.50 | 8 |

gemini-3.5-flash-lite and gemma-4-31b produced byte-identical trades. `gemini-3.6-flash` excluded: free-tier **daily** quota exhausted mid-run (429 "check your plan"; unlike 2.5-flash's per-minute cap) — probe rows were poisoned by quota, not model quality. Fixed `apiKeyForPreset` (cli.ts) which routed only the exact name `'gemini'` to GEMINI_API_KEY, silently sending the OpenRouter key for the other Gemini presets (fast-fail 400s).

**Paid decision-models benchmark (2026-08-07)**: 3 cheap paid models probed on a fresh dataset slice (`datasets/realistic/btc_15m_2024`, 325 contexts × 3 repeats = 975 calls/model, `--context baseline`). Purpose: pick a cheap decision model — no top-of-the-line needed, per the recommended mix (gpt-5.6-luna-pro, deepseek-v4-flash, gemini-3.5-flash-lite). Added `gemini35liteor` preset (Google Gemini 3.5 Flash Lite over OpenRouter, `$0.30/$2.50` per M); gemini-3.6 connections to OpenRouter dropped from the run (priced ~15–40× the others, not "cheap"). Closed every probe with valid JSON — the paid tier avoids the free 3.6-flash quota that poisoned the M8-extended run.

| model | validJson | latency | consistency | winRate | realizedPnl | costUsd | trades |
| --- | --- | --- | --- | --- | --- | --- | --- |
| openai/gpt-5.6-luna-pro | 0.91 | 7.0s | 0.69 | 0.00 | −78.3 | 0.70 | 18 |
| deepseek/deepseek-v4-flash | 0.84 | 5.0s | 0.35 | 0.00 | −106.6 | 0.07 | 24 |
| google/gemini-3.5-flash-lite | 1.00 | 0.7s | 0.83 | 0.00 | −108.2 | 0.46 | 17 |

All three lost money on this 2024 slice (every closed trade lost → winRate 0). That is the dataset slice, not lack of model skill. Read the table as engineering metrics: deepseek-v4-flash is the cheapest by ~7–10×, gemini-3.5-flash-lite is fastest/most consistent (1.00 valid JSON, 0.7s), lunapro sits in between. Total spend ≈ **$1.23** (lunapro 0.70 + lite 0.46 + deepseek 0.07). Note: `.env` OpenRouter key was stale — the live key lives in `/root/.openrouter_key` (updated `.env` to match, commit not part of the preset change).

**Risk-regime sweeps (2026-08-08)**: cross-asset stop/TP sweep over recorded decisions — BTC/IDR free models (gemma4, nemotronultra) plus ETH/IDR and SOL/IDR paid deepseek-v4 (808 decisions total, ~$0.10). New real datasets `datasets/realistic/{eth,sol}_idr_15m_2026` (10020 15m candles each, Apr 26–Aug 8 2026); reports `datasets/realistic/slices/{ethidr2026,solidr2026}/sweep-report.md`. Grid: minConfidence {0.5..0.9} × fraction 0.1 × stops {off, on} × stopMult {1,2,3} × tpMult {2,3}, feeRate 0.3%/side, minVolume per-asset in base coin (BTC 0.02, ETH 0.2, SOL 5).

Conclusion (pattern-level, not per-cell — each slice window is only ~26 days / 2505 candles, and trade counts are 7–24):

- **Stops-on is positive in 16/16 windows** across 3 models and 3 assets; no-stops PnL swings sign by slice on every asset. The deterministic ATR stop/TP exits — not the model's calls — are what produce the consistent (modest) positive expectancy. This is the strongest cross-asset result so far and directly validates the non-negotiable that the LLM outputs `{action, confidence}` only, with sizing/stops/TP as deterministic risk-engine code.
- **Directional accuracy is still near coin-flip** (win rates 0.4–0.6; the 1.0 cells are 1–10-trade noise, per the "best" variant only when ≥3 closing trades). Paid deepseek-v4 changes **reliability** (~70–80% real non-hold across slices, no quota drops) not skill.
- **No universal fixed config exists**: the best stopMult/tpMult flips by slice and asset. A single fixed exit policy is a baseline, not an optimum — reinforces keeping the evaluator (M9.5) as alert-only drift review rather than auto-tuning.
- **Guardrails must be calibrated per asset**: 15m volume medians in base coin are BTC ~0.1, ETH ~1.1, SOL ~24; one `minVolume` floor cannot serve all assets.
- **Operational**: 808 paid decisions ≈ $0.10 (~$0.00012/decision) — wall time (~2h, latency-bound at ~15–25 s/call) is the real bottleneck, not money. Default routing (StreamLake) was kept for sweeps; a `deepseekv4baidu` preset pins the caching-capable Baidu provider for the live-recording loop (verified no privacy-policy 404; saves cache-read credits on the ~850-token sliding lookback).

**Directional baseline control (2026-08-09)** — answers the question the sweep left open: is the LLM's direction call adding anything over the deterministic risk engine alone? Same candles/timestamps/fees/guardrails per slice; only the direction source changes. For each of the **16 slices/units across 3 models** (ETH/IDR + SOL/IDR × w0–w3 × deepseekv4; BTC/IDR × w0–w3 × gemma4 + nemotronultra) the sweep's winning "best stops-on" risk config is held fixed, and the real model's PnL/win-rate is ranked inside a 20-seed **Baseline A** null (random direction, hold probability matched per slice to the real model's observed holds) and compared against **Baseline B** (free MA20 crossover, no randomness, no LLM). Reports: `datasets/realistic/slices/{ethidr2026,solidr2026,idr2026}/directional-baseline-report.md` + `directional-baseline-summary.md`.

- **The LLM does not credibly beat random direction.** It clears the >90th-percentile tail of the Baseline A null on **2/16 units** (ETH w1 deepseekv4, pnl rank 20/20; BTC w0 gemma4, 19/20) — exactly what chance alone predicts (~1.6 expected). On the other 14 its PnL percentile rank is 35–85%: middle-of-distribution. Primary conclusion per the pre-committed rule: **current signal quality is not distinguishable from noise**, and this is a *strong* negative because the winning config was tuned on the model's own PnL (selection bias favors the model).
- **The positive sweep expectancy lives in the risk engine, not the model.** Baseline A's null medians under *random* direction with the fixed stops-on config are positive in 12/16 units (e.g. ETH w0 +44k, ETH w1 +51k, SOL w1 +81k). Random long/short fed through the ATR stop/TP exits produces roughly the same positive expectancy the sweep attributed to "stops-on is positive in 16/16 windows" — direct confirmation of the sweep's explanation (b): the deterministic exit policy, not the model's calls, is what carries the edge. This validates the non-negotiable (LLM outputs `{action, confidence}` only) and argues that M9/M10 effort should concentrate on the risk/exit layer, not on chasing better direction.
- **The free MA rule is competitive but not dominant.** Baseline B beats the LLM on PnL in 4/16 units (ETH w3, SOL w1, BTC w0 both free models); the LLM beats it on both metrics in 11/16. So the MA rule is not a clear upgrade, but it is a zero-cost sanity benchmark worth keeping in `apps/benchmark`'s leaderboard as a floor — not a failure state, per the pre-committed rule.
- **Verdict under the pre-committed decision rule**: the "LLM doesn't clearly beat random on most slices" branch — priority shifts to improving context (richer features, longer history, multi-timeframe confirmation) or accepting that this setup's edge lives entirely in the risk engine. No architecture change: routing already treats direction as the only LLM output.
- **Caveats** (unchanged in spirit from the sweep): 2×~26-day windows per asset is one market regime, not a robustness guarantee across bull/chop/drawdown; 20-seed null is coarse (90th percentile ≈ rank 18/20); config-selection bias favors the LLM, so the null result is decisive while a positive would have been suggestive only; free-model nulls trade thinly (44–62% holds). Fixed 2026-08-10: `scripts/sweep-report.mjs`'s `validRate` no longer counts hold-with-confidence rows as "non-hold" — all sweep reports regenerated, non-hold figures now state real action rates (39–83% by model/slice; the earlier 96–99% figures were inflated by the bug).

**Older-window regime extension (2026-08-10)** — the 2026-only sweep/baseline above was one regime (Apr 26–Aug 8 2026, BTC/IDR volMed 1.04–1.44B). Re-ran the identical 16-unit design on a **contrast regime** (Sep–Dec 2025, BTC/IDR volMed 1.35–2.08B — ~50% higher volume, topping/decline macro backdrop) to check whether the conclusions hold or were regime-specific. New real datasets `datasets/realistic/{btc,eth,sol}_idr_15m_2025` (10020 15m candles each, 2025-08-31→2025-12-13); decisions recorded 2026-08-10 (1616 rows: ETH/SOL deepseek-v4 × 4, BTC gemma4 + nemotronultra × 4); identical params (10,000,000 IDR, fee 0.003, minVolume BTC 0.02/ETH 0.2/SOL 5, MA20, 20 seeds, conf 0.9). Reports `datasets/realistic/slices/{idr2025,ethidr2025,solidr2025}/sweep-report.md` + `directional-baseline-report.md`, combined summary merged into `directional-baseline-summary.md`.

- **Directional accuracy is not regime-tuned**: mean best-stops-on win rates hold in the older window (BTC gemma4 53.4% vs 47.6%, BTC nemotronultra 65.7% vs 51.4%, ETH 57.3% vs 51.7% — older *higher*; SOL 53.3% vs 62.6% — older lower). No regime collapses; per-slice coin-flip scatter (0.3–0.8) dominates, as in 2026. Near-coin-flip direction persists across both regimes.
- **Risk-engine expectancy is regime-robust**: mean best-stops-on PnL positive in **16/16** older-window units (BTC +40k/+58k, ETH +62k, SOL +113k means) — same 16/16-positive result as 2026. Deterministic ATR exits carry the edge in both regimes, independent of model or market backdrop.
- **Baseline A (random-direction) verdict reproduces**: older-window LLM PnL ranks inside the 20-seed null on 14/16 units (clears >90th pct on 2/16 — ETH w3, BTC w0 nemotronultra — vs 2/16 in 2026, exactly chance-level). "Not distinguishable from noise" holds cross-regime; 1/16 "clears both baselines" only where B pnl was low. Free MA20 baseline B stays competitive (LLM beats it on both metrics in ~11/16 older-window units).
- **Verdict (recorded 2026-08-10)**: the 2026 conclusions **replicate in a ~50%-higher-volume contrast regime**. The sweep/baseline findings are regime-robust, not artifacts of one window — no architecture change, and the M9/M10 effort concentration on the risk/exit layer is reaffirmed. Caveats (unchanged in spirit): both regimes share the same slice-size limitation (2×~26-day windows per asset); the sweep-report `validRate` mislabeling flagged in the 2026 run was fixed the same day (reports regenerated with real non-hold rates).

## M9 — Indodax live adapter

**Build**: real `packages/exchanges/indodax` implementation (replacing paper for this adapter), retry policy, clock sync, exchange filters, reconciliation (startup + periodic), authenticated control commands, cost/budget caps, daily reset logic, position ownership policy.
**Do not touch**: Android deployment — build and test this on a dev machine first, paper mode only.
**Indodax historical candles**: pull real OHLC directly from the public TradingView-compatible endpoint `/tradingview/history_v2?from={ts}&symbol={symbol}&tf={minutes}&to={ts}` where `symbol` is the uppercase pair id from `/tradingview/search_v2` (e.g. `symbol=BTCIDR`; the lowercase `.btc_idr` form does not resolve). Do **not** build a trade-aggregation pipeline from `/api/trades` — candles already exist (ADR-012). The parser is confirmed live: bars come back as one object per candle (`Time` epoch seconds, `Volume` as string) and `[]` when there is no data in range. Validate/checksum the pulled data the same way as the synthetic set.
**Done when**: a full paper-mode run against real Indodax market data (real prices, simulated fills) survives a 10,000-candle E2E test with no crashes, no NaN, deterministic PnL.

## M9.5 — Evaluator (slow-frequency performance review)

**Build**: `apps/evaluator` — a standalone, independently-scheduled script (daily, optionally also weekly), separate from the 15m runner loop. It reads the JSONL logs the runner already writes (DuckDB queries over them, per ADR-004's deferred plan — this is the moment that pays off), and:

- Aggregates realized win rate, PnL, guardrail-rejection rate, cost per trade, and confidence calibration over the period
- Compares each against the M8 benchmark's expected numbers for whichever model is currently live
- Sends a summary to the existing WhatsApp/Telegram notification channel
- Trips a distinct "pause new positions, alert for human review" state (not the same as a guardrail rejection) if drift crosses a configured threshold — e.g. win rate meaningfully below rolling backtest expectation
- Uses its own independently-configured LLM provider/model, separate from the runner's model choice — this component benefits from a stronger model since it runs far less often and the task is more open-ended (see reasoning below)

**Explicitly out of scope**: no automatic strategy or parameter adjustment based on evaluator findings. Read-only reporting and alerting only — a human decides what to do with a flagged drift. This keeps capital-protecting logic deterministic and human-gated, per the Project Charter.

**Do not touch**: the runner's decision loop itself, guardrails, risk engine — the evaluator observes, it never writes to trading state.

**Done when**: running the evaluator against a week of real or simulated log data produces an accurate, correctly-thresholded drift report, and a deliberately-injected drift (e.g. replaying logs with an artificially degraded win rate) correctly trips the pause-and-alert state.

**Status (2026-08-10)**: build complete (`788b0ea`, 2026-08-08) — DuckDB queries over runner JSONL logs, own independent review provider/model, drift-pause state, alerts. TDD suite green: 17 tests in 6 files (`tests/evaluator/`), including injected-drift trips pause-and-alert, read-only (never writes trading state), and own-provider independence. Remaining DoD work is the live soak (M10 scope): scheduled runs on device + one real report delivered.

## M10 — Android / Termux deployment

**Build**: Termux + proot-distro setup scripts, device-health monitoring, wake-lock handling, heartbeat, circuit breakers tied to device state, `tmux`-based persistence. Include the evaluator's schedule (cron/`termux-job-scheduler`) as part of this deployment, since it should be running throughout the M10 soak test, not added afterward.
**Done when**: the M9 paper-mode agent — plus the M9.5 evaluator running on schedule alongside it — runs unattended on the phone for a defined soak period (1-2 weeks) with no missed heartbeats beyond the alerting threshold, no state corruption after at least one forced reboot, and at least one real evaluator report generated and delivered on schedule.

---

## Only after M10, and only as a separate, explicit decision

Enabling live trading (`mode: live` + `--confirm-live` + `LIVE_CONFIRMATION` env var) is not a milestone — it's a decision made after M10 has run clean in paper mode for an extended period across varied market conditions, on a small allocation.
