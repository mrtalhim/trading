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
