# OSS Bot Audit — Freqtrade & Jesse vs. this repo

- Date: 2026-08-12
- Scope (Part 1): Freqtrade `freqtrade/exchange/exchange.py` (+ `common.py`, `exchange_utils.py`) vs. `packages/exchanges/src/indodax/*`
- Scope (Part 2): Jesse's backtest candle-access API vs. `packages/datasets/src/replay/replay-loader.ts` + `packages/features/src/features.ts`
- Method: source read of both sides at the audited refs; ccxt `4.5.71` checked from `node_modules` (the version this repo pins)
- Non-goals: no `hyperopt` adoption, no new dependencies/vendoring, no architecture changes, no general OSS reading.

Verdict legend: ✅ already handled / matches · ⚠️ gap — needs test or fix · 🎫 gap filed as follow-up ticket

---

## Part 1 — Freqtrade CCXT wrapper vs. the Indodax adapter (M9)

### 1.1 Order precision applied before submission — ✅ matches (delegated to ccxt)

- **Freqtrade**: `create_order` calls `amount_to_precision` / `price_to_precision` before hitting the exchange (`exchange.py` ≈1467-1470; helpers ≈1045/1052). Amounts are truncated to the market's tick size.
- **Ours**: the adapter passes the raw `quantity` straight through (`indodax-exchange.ts` `createOrder`), but `ccxt.indodax.createOrder` auto-loads markets and applies the precision itself: market **sell** → `request[baseId] = amountToPrecision(...)` (truncate), market **buy** → quote cost derived and `costToPrecision(...)` (ccxt `js/src/indodax.js` ≈968-996; `amountToPrecision`/`costToPrecision` in `js/src/base/Exchange.js` ≈6484-6512).
- Note: this delegation works only because ccxt's `createOrder` calls `loadMarkets()` lazily on first use (`indodax.js` ≈968-970). It is invisible to our unit tests, which inject a mock and never touch real ccxt — see 🎫 follow-up for a sandbox-contract test.

### 1.2 Market-buy quote-cost price requirement — ⚠️ real gap, FIXED NOW

- `ccxt.indodax.createOrder` for a market **buy** derives the quote cost as `amount × price` and **throws `InvalidOrder` if no price is passed** (`indodax.js` ≈988-990) — the Indodax `trade` endpoint needs an IDR cost reference. Market sells only need the base amount.
- **Ours**: `apps/indodax-agent/src/engine.ts` `executeTrade` submitted every market order with no price (`engine.ts` ≈509-515). Every long entry therefore threw `InvalidOrder` against the real client. The ccxt mock in `indodax.contract.test.ts` accepted a price-less buy, so tests never caught it.
- **Fix (this change)**:
  - `packages/exchanges/src/indodax/indodax-exchange.ts` — new `resolvePrice()`: explicit price is forwarded; a price-less market buy falls back to `fetchTicker().last ?? .close` and throws a clear error if the ticker has no usable price.
  - `apps/indodax-agent/src/engine.ts` — buys now pass `price: candle.close` (the same reference price used for sizing), so the ccxt-derived cost equals `proposedPositionSize` exactly and no extra ticker call is needed.
  - Tests: `packages/exchanges/src/__tests__/indodax.price.test.ts` (ticker fallback, explicit price passthrough, sell untouched, unusable ticker, transient-ticker retry).

### 1.3 Retry / backoff policy — ✅ matches (ours is strictly stronger)

- **Freqtrade**: its own `retrier` decorator with exponential backoff; `API_RETRY_COUNT = 4`; ignores exchange `Retry-After` (`common.py`). An empty order status is mapped to "open" and `fetch_order` is retried `API_FETCH_ORDER_RETRY_COUNT = 5` times (`exchange.py` ≈1483-1489, 1708).
- **Ours**: `executeWithRetry` — exponential backoff on 429/5xx, fatal on 401/signature, unknown errors not retried. `executeCreateWithRecovery` turns a post-submit timeout into a `fetchOrder` by `clientOrderId` lookup instead of blind re-submit.
- Direction matches; ours additionally de-duplicates the risky post-submit-timeout case that Freqtrade's wrapper would blindly retry.

### 1.4 Unknown / empty order status — ✅ matches

- Freqtrade maps an empty status to `open` (never fabricates `rejected`). Ours: `mapOrder` defaults unknown statuses to `open` (`mapping.ts` STATUS_MAP). Same intent.

### 1.5 Balance normalization — ✅ matches

- Freqtrade `get_balances` strips only `info`/`free`/`total`/`used` from each raw balance. Ours: `mapBalance` reads exactly those keys and drops `info` (`mapping.ts`). No meaningful divergence.

### 1.6 Ticker freshness / clock — ✅ matches (ours adds a guardrail)

- Freqtrade `fetch_ticker` is a plain `@retrier` — no staleness timestamp check (`exchange.py` ≈2158-2172). Ours doesn't reject stale tickers either, but the engine feeds `ClockSync.skewMs()` into `evaluateGuardrails` (`engine.ts` ≈382), a check Freqtrade lacks.

### 1.7 Minimum quantity / notional (dust) — 🎫 minor gap, follow-up

- Freqtrade applies precision but does **not** pre-check min base quantity in `create_order`; it lets the exchange reject dust. ccxt truncates the amount and only throws when it truncates to `0` (`Exchange.js` ≈6508-6510).
- Ours: the engine pre-checks `proposedPositionSize < minNotionalIdr` (quote side, `engine.ts` ≈360) before any open order, but never checks the base-side minimum order size for closes — a dust sell would fail loudly at the exchange without corrupting state.
- `PairInfo` parses `minNotional` (`trade_min_base_currency`) and `minQuantity` (`trade_min_traded_currency`) (`public-api.ts` ≈56-61) but the order path doesn't consume them. ⚠️ Note: the Indodax field names are reversed relative to our `PairInfo` property names (base-currency min landed on `minNotional`, traded-currency min on `minQuantity`) — any follow-up wiring must re-map these before use. Not a blocking fix.

---

## Part 2 — Jesse backtest look-ahead vs. `ReplayLoader` / `FeaturePipeline`

### 2.1 Strategy candle access — ✅ matches in practice, 🎫 structural enforcement weaker

- **Jesse**: strategy code can only ask for candles through `candle_service.get_current_candle(...).copy()` / `get_candles(...)` (`jesse/strategies/Strategy.py` ≈1439-1445, 1513-1521). The store is indexed by the backtest's current time, so a future candle **cannot** be addressed at all; `close` is `current_candle[2]`. Look-ahead is impossible by construction.
- **Ours**: `FeaturePipeline` builds each row from `candles.slice(0, i + 1)` (`features.ts` ≈76) — strictly causal windows, `insufficient` flags before warm-up, matching Jesse's discipline. `ReplayLoader` is a sequential cursor (`next`/`peek`/`seek`, `replay-loader.ts` ≈26-54), so normal replay is causal too.
- **Difference**: nothing structural stops a caller from `ReplayLoader.all()` (`replay-loader.ts` ≈72) or indexing `candles` beyond `i` and reading a future close. Jesse's API makes that impossible; ours relies on convention. 🎫 Follow-up: make `ReplayLoader` (or the Dataset interface) refuse future-candle access.

### 2.2 HTF candle construction — ✅ matches / N/A

- Jesse `generate_candle_from_one_minutes` builds HTF candles only from **completed** 1m candles and rejects the forming candle unless `accept_forming_candles=True`. Our pipeline has no HTF aggregation in scope — datasets are delivered already-aggregated, and nothing here forms candles from partial data. Nothing to fix.

### 2.3 Synthetic-candle mutation — ✅ matches (ours is immutable)

- Jesse `fix_jumped_candles_rust` mutates candle OHLC to repair gaps. `ReplayLoader` is a read-only cursor over the source — no mutation path exists, which is strictly safer. No action.

---

## Decisions

| Item                                        | Verdict       | Action                                                                 |
| ------------------------------------------- | ------------- | ---------------------------------------------------------------------- |
| Market-buy price requirement (Part 1.2)     | ⚠️ real gap   | Fixed now: adapter `resolvePrice` + engine passes candle.close + tests |
| All other Part 1 checks                     | ✅            | No change                                                              |
| Min-quantity dust pre-check (Part 1.7)      | 🎫 minor      | Follow-up ticket (M9 hardening)                                        |
| ReplayLoader future-access guard (Part 2.1) | 🎫 structural | Follow-up ticket (not urgent)                                          |
| Sandbox ccxt contract test                  | 🎫 test-only  | Follow-up ticket                                                       |

## Verification of this change

- `pnpm vitest run packages/exchanges --pool=forks` → 12 files / 70 tests pass (incl. new `indodax.price.test.ts`)
- `pnpm lint` and `pnpm typecheck` clean
