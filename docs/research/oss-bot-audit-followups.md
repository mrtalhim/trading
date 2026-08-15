# Follow-up tickets — OSS bot audit (2026-08-12)

Companion to `docs/research/oss-bot-audit.md`. No issue tracker exists in this repo yet;
numbered here so the audit's non-blocking findings are actionable.

## M9-1 — Wire PairInfo minimums into the order path (dust pre-check) — medium

- **Why**: `engine.ts` pre-checks only the quote-side `minNotionalIdr` (`engine.ts` ≈360). A dust sell close below the base-side minimum fails loudly at the exchange. `PairInfo` already carries both minimums (`public-api.ts` ≈56-61) but nothing consumes them.
- **Do**: add a base-side min-order pre-check (reject `below_min_quantity` like `below_min_notional`) and consume `PairInfo` instead of a hardcoded config value.
- **⚠️ Traps**: Indodax field names are reversed vs. our `PairInfo` names — `trade_min_base_currency` is the base-currency min (landed on `minNotional`), `trade_min_traded_currency` is the quote/IDR min (landed on `minQuantity`). Re-map before use; add a unit test asserting the mapping.
- **Also**: ccxt `amountToPrecision` truncates and only throws when the amount truncates to `0` (`Exchange.js` ≈6508-6510) — do not rely on ccxt for the dust check.

## M9-2 — Sandbox ccxt contract test — low (test-only)

- **Why**: the mock in `indodax.contract.test.ts` accepted a price-less market buy, hiding the real `ccxt.indodax` `InvalidOrder` requirement (`indodax.js` ≈988-990). The fix in `resolvePrice` is regression-protected only against mocks.
- **Do**: add a contract test that spins up a real `ccxt.indodax` in sandbox mode (public-only endpoints, no keys) asserting `createOrder`-equivalent behavior for a price-less market buy, or at minimum assert the ccxt version's behavior against `loadMarkets()` + precision. Keep it network-fenced so CI is deterministic.

## M9-3 — Structural look-ahead guard in ReplayLoader — low (not urgent)

- **Why**: Jesse makes future-candle access impossible by construction (candles come from a store keyed by current backtest time). Our `FeaturePipeline` is strictly causal (`features.ts` ≈76) but `ReplayLoader.all()` (`replay-loader.ts` ≈72) exposes the whole buffer, so a caller could read past the cursor.
- **Do**: make the replay cursor refuse reads beyond the current position (e.g. return only `next()`/`peek()`, or slice `all()` to `position`) so look-ahead is structurally impossible rather than a convention. Add a test proving a strategy sees only candles ≤ the current timestamp.
