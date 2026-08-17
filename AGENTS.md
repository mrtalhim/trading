# AGENTS.md

Entry point for any agent (Claude Code, Cursor, OpenCode, OpenClaw, etc.) working on this repo. Read this first, every session, before touching code.

## Read order

1. **PROJECT_CHARTER.md** — philosophy and working rules. Always in scope, never changes.
2. **VISION.md** — architecture, goals, constraints. Always in scope, changes rarely.
3. **ARCHITECTURE_DECISIONS.md** — why things are built the way they are. Check before proposing a different approach to something already decided; add a new ADR if a decision genuinely needs to change, don't silently drift from it.
4. **ROADMAP.md** — find the current milestone. This defines what you are allowed to touch right now.
5. **TDD.md** — find the acceptance criteria for whatever you're implementing in the current milestone. Write the failing tests before the implementation.

## The one rule that overrides convenience

**Work on the current milestone only** (per ROADMAP.md). If something outside the current milestone looks broken, missing, or like it would be easier to fix while you're in there — don't. Flag it instead and stay in scope. Milestones are ordered the way they are on purpose: guardrails, risk math, and validation get built and fully tested before any LLM or live exchange integration exists, because that's the code protecting real money.

## Before writing any code this session

State back, briefly:

- Which milestone you're on
- What the Definition of Done for it is (TDD.md)
- Anything in the spec that's ambiguous or missing for this milestone

Don't start implementing until that's done. Silent assumptions are the main source of architectural drift on a project like this.

## Non-negotiables (also in PROJECT_CHARTER.md and VISION.md, repeated because they matter most)

- LLM output is `{action, confidence}` only. Never let a model output position size, stop-loss, or take-profit — those are deterministic risk-engine code.
- No trade executes without passing validation → risk engine → guardrails, in that order.
- `packages/core` has zero dependencies on anything above it. No exceptions.
- No `// TODO`, no stub implementations, no skipped tests to hit a milestone faster.
- Paper mode is the default everywhere. Live trading requires three independent confirmations (see VISION.md / TDD.md) and is not something to enable as part of routine implementation work.

## Where things live

| Path                     | What                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `packages/core`          | Decision types, state machine, interfaces, schemas — zero deps                       |
| `packages/indicators`    | RSI/ATR/EMA/SMA/ADX/VWAP, self-implemented                                           |
| `packages/risk`          | Deterministic sizing/stop/TP strategies                                              |
| `packages/guardrails`    | Pure, deterministic approve/reject rules — imported identically by every app, never embedded in one |
| `packages/llm`           | `DecisionEngine` interface + provider adapters                                       |
| `packages/exchanges`     | `indodax/`, `paper/`                                                                 |
| `packages/notifications` | Telegram/WhatsApp/Discord                                                            |
| `packages/storage`       | JSONL now, DuckDB later                                                              |
| `packages/datasets`      | `Dataset` interface, JSONL/CSV/Parquet loaders, validator, checksum, `ReplayLoader`, golden datasets |
| `packages/features`      | Feature pipeline consuming `Dataset` (indicators per-window, versioned)              |
| `packages/android`       | Termux/proot deployment, device health                                               |
| `apps/indodax-agent`     | The live/paper trading runtime                                                       |
| `apps/backtest`          | Record/replay                                                                        |
| `apps/benchmark`         | Multi-model leaderboard                                                              |
| `apps/evaluator`         | Standalone, independently-scheduled (daily/weekly) drift review over runner logs — DuckDB queries on JSONL, alerts only, no auto-adjustment, own configured LLM provider |
| `tests/`                 | unit/, integration/, contracts/, property/, replay/, e2e/ — mirrors the architecture |

## If you're an agent picking up mid-project

Check CI status and the last milestone marked done in ROADMAP.md before assuming where the project is. Don't trust an in-progress branch's state over what CI says actually passes.

If `.github/workflows/ci.yml` doesn't exist yet, that's an M0 gap, not a green light to skip the check — add it (lint → typecheck → test) before treating any later milestone's DoD as real. Local `pnpm check` is not a substitute for CI actually running.

## Indodax exchange behaviors (verified live 2026-08, do not "fix" by assumption)

- **Two id spellings, one per surface**: REST pair endpoints (`pairs_v2`, `tickers`, `depth/{id}`, `trades/{id}`, `search_v2`) take the lowercase id (`btcidr`); `tradingview/history_v2` requires the uppercase ticker (`BTCIDR`). The underscore form `btc_idr` is **rejected** (`invalid_pair`). Use `normalizePairSymbol()` / `normalizeHistorySymbol()` in `packages/exchanges/src/indodax/public-api.ts` — never hand-roll id transforms.
- **`history_v2` `tf` is minutes-only.** `1440` and `D` return `400 invalid TimeFrame`; verified `15` and `60` work. Longest safe window for datasets: 4h (`240`). No 1D candles through this endpoint.
- **Unknown symbols hang ~30 s** on `history_v2` (then return `[]`). Resolve ids via `pairs_v2`/`search_v2` first; never probe with an unvalidated symbol. `search_v2` only matches near-complete ids (`btcidr` works, `btc` → errmsg).
- **Latency is jittery**: 90 ms–23 s per public request observed, no hard rate-limit seen at 20-call bursts. Every request must carry a timeout — the client's `RetryPolicy` (`.timeoutMs`, `.minIntervalMs`, retry-on-429/5xx/abort) is the enforcement point. Default `historyRetryPolicy` = 3 retries, 15 s timeout, 150 ms min interval.
- **No websocket.** All surfaces are polling; the agent's design (15 m candle loop, signal-file control) is built around that.
- **Clock** comes from `/api/server_time` (ms epoch); first call ~2-3 s, so `ClockSync` samples repeatedly.
- **Private API is `/tapi`** (nonce + signature; ccxt handles it). Verified live: `fetchBalance`/`getInfo`. ccxt `indodax` does **not** implement fetchOrders history or `fetchMyTrades`/`trade_history` (only `fetchOpenOrders`, `fetchClosedOrders`→`/orderHistory`, `fetchOrder`), deposits, or withdrawals; tapi gets no client-order-id — ownership (`ownership.ts`) maps by our own stored ids, and reconciliation (`reconcile.ts`) matches live orders to records by **exchange id** (captured at create time), with fills sourced from `fetchClosedOrders` (`/orderHistory`) as the ccxt-available trade-history proxy.
- **`tickers` vs `ticker/{pair}`**: `/api/tickers` returns the whole market (~200 pairs, strings); it is the cheap broadcast source. `trades/{id}` gives public fills (`tid` as string).

## When touching live-API code

- Never hit the exchange from unit tests — inject `fetch` / `fetchFn` (public client) or ccxt (private). Live smoke tests are opt-in scripts, never part of `vitest run`.
- Treat key material as `.env`-only (gitignored). Rotate, don't print: a temp probe script that reads the secret must be deleted after use.
