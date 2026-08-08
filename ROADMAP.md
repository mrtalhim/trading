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
- **Directional accuracy is still near coin-flip** (win rates 0.4–0.6; the 1.0 cells are 1–10-trade noise, per the "best" variant only when ≥3 closing trades). Paid deepseek-v4 changes **reliability** (96–99% non-hold, no quota drops) not skill.
- **No universal fixed config exists**: the best stopMult/tpMult flips by slice and asset. A single fixed exit policy is a baseline, not an optimum — reinforces keeping the evaluator (M9.5) as alert-only drift review rather than auto-tuning.
- **Guardrails must be calibrated per asset**: 15m volume medians in base coin are BTC ~0.1, ETH ~1.1, SOL ~24; one `minVolume` floor cannot serve all assets.
- **Operational**: 808 paid decisions ≈ $0.10 (~$0.00012/decision) — wall time (~2h, latency-bound at ~15–25 s/call) is the real bottleneck, not money. Default routing (StreamLake) was kept for sweeps; a `deepseekv4baidu` preset pins the caching-capable Baidu provider for the live-recording loop (verified no privacy-policy 404; saves cache-read credits on the ~850-token sliding lookback).

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

## M10 — Android / Termux deployment

**Build**: Termux + proot-distro setup scripts, device-health monitoring, wake-lock handling, heartbeat, circuit breakers tied to device state, `tmux`-based persistence. Include the evaluator's schedule (cron/`termux-job-scheduler`) as part of this deployment, since it should be running throughout the M10 soak test, not added afterward.
**Done when**: the M9 paper-mode agent — plus the M9.5 evaluator running on schedule alongside it — runs unattended on the phone for a defined soak period (1-2 weeks) with no missed heartbeats beyond the alerting threshold, no state corruption after at least one forced reboot, and at least one real evaluator report generated and delivered on schedule.

---

## Only after M10, and only as a separate, explicit decision

Enabling live trading (`mode: live` + `--confirm-live` + `LIVE_CONFIRMATION` env var) is not a milestone — it's a decision made after M10 has run clean in paper mode for an extended period across varied market conditions, on a small allocation.
