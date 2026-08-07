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

## M9 — Indodax live adapter

**Build**: real `packages/exchanges/indodax` implementation (replacing paper for this adapter), retry policy, clock sync, exchange filters, reconciliation (startup + periodic), authenticated control commands, cost/budget caps, daily reset logic, position ownership policy.
**Do not touch**: Android deployment — build and test this on a dev machine first, paper mode only.
**Indodax historical candles**: pull real OHLC directly from the public TradingView-compatible endpoint `/tradingview/history_v2?from={ts}&symbol={pair_id}&tf={minutes}&to={ts}` (e.g. `symbol=btc_idr`). Do **not** build a trade-aggregation pipeline from `/api/trades` — candles already exist (ADR-012). Before writing a parser, hit the endpoint with `curl` for a known range and confirm the response shape (field names; whether `tf` is number or string). Validate/checksum the pulled data the same way as the synthetic set.
**Done when**: a full paper-mode run against real Indodax market data (real prices, simulated fills) survives a 10,000-candle E2E test with no crashes, no NaN, deterministic PnL.

## M10 — Android / Termux deployment

**Build**: Termux + proot-distro setup scripts, device-health monitoring, wake-lock handling, heartbeat, circuit breakers tied to device state, `tmux`-based persistence.
**Done when**: the M9 paper-mode agent runs unattended on the phone for a defined soak period (e.g. 1-2 weeks) with no missed heartbeats beyond the alerting threshold and no state corruption after at least one forced reboot.

---

## Only after M10, and only as a separate, explicit decision

Enabling live trading (`mode: live` + `--confirm-live` + `LIVE_CONFIRMATION` env var) is not a milestone — it's a decision made after M10 has run clean in paper mode for an extended period across varied market conditions, on a small allocation.
