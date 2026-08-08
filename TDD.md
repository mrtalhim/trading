# TDD.md — Acceptance Criteria by Feature

This is the law. A feature is done when its acceptance criteria pass as tests — not when code exists that looks plausible. Do not implement a feature before its acceptance criteria are written as failing tests.

---

## Dataset infrastructure (`packages/datasets`)

**Dataset interface**

- ✓ `Dataset.metadata()` returns correct `DatasetMetadata` for each golden dataset
- ✓ `Dataset.candles()` yields all candles in order as `AsyncIterable<Candle>`
- ✓ Metadata is cached across multiple calls

**JSONL loader**

- ✓ Reads `metadata.json` + `candles.jsonl` from a directory
- ✓ Yields candles in file order
- ✓ Handles empty files gracefully

**CSV loader**

- ✓ Reads `metadata.json` + `candles.csv` from a directory
- ✓ Parses header row correctly, casts numeric types
- ✓ Produces identical candle data as JSONL loader for the same dataset

**Parquet loader**

- ✓ Reads `metadata.json` + `candles.parquet` from a directory
- ✓ Handles INT64 timestamps (bigint → number conversion)
- ✓ Produces identical candle data as JSONL loader for the same dataset

**Validator**

- ✓ Passes for valid candles with correct interval spacing
- ✓ Detects decreasing timestamps
- ✓ Detects duplicate timestamps
- ✓ Detects missing candles (gap != expected interval)
- ✓ Detects OHLCV integrity violations (high < open/close, low > open/close, negative volume)
- ✓ Returns empty error list for empty candle array
- ✓ Parses known interval strings (1m, 5m, 15m, 1h, 1d, etc.)
- ✓ Throws on unknown interval strings

**Checksum**

- ✓ Returns 16-character hex string
- ✓ Deterministic for same input
- ✓ Order-independent (sorts by timestamp)
- ✓ Differs for different data

**ReplayLoader**

- ✓ Yields candles sequentially via `next()`
- ✓ Returns null when exhausted
- ✓ `peek()` returns current candle without advancing
- ✓ `seek(timestamp)` jumps to correct position
- ✓ `seek()` returns false for timestamp beyond end
- ✓ `skip(n)` advances position by n
- ✓ `skip()` does not exceed total
- ✓ `rewind()` resets position to 0
- ✓ `total` returns candle count after loading
- ✓ `all()` returns all candles as array

**Golden datasets**

- ✓ BTC/ETH/SOL synthetic datasets: 100 candles each, validated
- ✓ Realistic Binance BTC 2024 dataset: 1000 candles, validated
- ✓ All golden datasets pass validation (timestamps, OHLCV, intervals)
- ✓ Checksums match computed values

## Indicators (`packages/indicators`)

**RSI14 / ATR14 / ADX14 / MACD / MA20 / MA50 / VWAP**

- ✓ Matches known reference values for a fixed sample dataset (e.g. cross-check a few points against TradingView or a trusted reference)
- ✓ Returns NaN / explicit "insufficient data" until enough candles exist, never a silently wrong number
- ✓ Deterministic: same input candles always produce the same output
- ✓ Feature-pipeline version is hashed and included in output metadata

## Feature pipeline (`packages/features`)

Consumes a `Dataset` and produces an enriched candle stream (one `FeatureRow` per candle). Indicators are applied per-window over the prefix ending at each candle.

- ✓ Yields one `FeatureRow` per source candle, in order, with `row.candle` equal to the source candle
- ✓ Final-row indicator features equal the single-call indicator value computed over the full candle array (RSI/ATR/EMA/SMA/ADX/VWAP)
- ✓ Warmup rows: features needing more history than available are `NaN` and listed in `row.insufficient`; the pipeline never throws
- ✓ Determinism: two runs on the same `Dataset` produce identical feature values and identical `pipelineVersion`
- ✓ `pipelineVersion` is a 16-char hex string, deterministic for identical specs, and changes when any spec (name/indicator/params) changes
- ✓ `pipelineVersion` incorporates the underlying indicator `pipelineVersion` (recomputed from indicator result metadata), so a change to an indicator implementation changes the feature version
- ✓ Metadata propagation: `FeatureMetadata.source` deep-equals the source `DatasetMetadata` (exchange, pair, interval, checksum preserved)
- ✓ Writing to disk (`writeFeatureDataset`) produces `candles.jsonl` + `features.jsonl` + `metadata.json`; reading back reproduces identical rows and metadata (`NaN` round-trips via `null`)
- ✓ Two writes of the same pipeline are byte-identical for `candles.jsonl`, `features.jsonl`, and `metadata.json`
- ✓ Generic engine supports the M1 indicators (`rsi`, `atr`, `adx`, `ema`, `sma`, `vwap`) plus derived examples (`return`, `logReturn`); `return`/`logReturn` are `NaN` at index 0
- ✓ Invalid configs are rejected: unknown indicator, duplicate feature name, or empty spec list

## Candlestick pattern context (`packages/indicators`) — M3.5

Deterministic, pure candle-geometry detectors. Every detector analyses the last candle of the window it receives.

**Single-candle detectors (doji, hammer, invertedHammer, hangingMan, shootingStar, marubozu)**

- ✓ Fires on a known textbook example
- ✓ Does not fire on a clearly non-matching candle
- ✓ Returns `false` (never throws) when there is insufficient candle history
- ✓ Hammer/hangingMan and invertedHammer/shootingStar are distinguished by preceding trend direction: the same shape never fires both

**Double-candle detectors (bullishEngulfing, bearishEngulfing, piercingLine, darkCloudCover, bullishHarami, bearishHarami)**

- ✓ Fires on a known textbook pair, does not fire on a non-matching pair
- ✓ Returns `false` (never throws) with fewer than two candles
- ✓ Engulfing uses strict containment, so identical/doji pairs never fire both directions

**Triple-candle detectors (morningStar, eveningStar, threeWhiteSoldiers, threeBlackCrows)**

- ✓ Fires on a known textbook example, does not fire on a non-matching example
- ✓ Returns `false` (never throws) with fewer than three candles

**Structural (`trendStructure`, `nearSupport`, `nearResistance`)**

- ✓ Correctly classifies synthetic monotonic uptrend / downtrend / ranging series
- ✓ Structure classified over the window preceding the last candle
- ✓ Support/resistance proximity uses a configurable `proximityThreshold`, tested at the boundary (float-stable)
- ✓ Returns `ranging` / `false` (never throws) below `minStructureCandles`

**Versioning + determinism**

- ✓ Same candles, same options → byte-identical `PatternContext` including `patternVersion`
- ✓ `patternVersion` is a 16-char hex string and changes when any detector version constant or option changes
- ✓ All booleans; no NaN anywhere; empty input handled

**Property test (100k random windows)**

- ✓ Never produces two mutually-exclusive patterns as both true (engulfing pair, piercing/darkCloud, harami pair, star pairs, soldiers/crows, doji/marubozu, hammer/hangingMan)
- ✓ Never crashes for any window length 0–40
- ✓ No NaN or non-boolean anywhere in the output

## LLM context arms (`packages/llm`) — M3.5

- ✓ `--context=baseline` renders byte-identical prompts to the pre-M3.5 output (record/probe unchanged)
- ✓ `--context=indicators` appends an indicator block (RSI/ATR/ADX/EMA/SMA/VWAP final values) to the user prompt; insufficient history renders `n/a`, never crashes
- ✓ `--context=patterns` appends both the indicator block and a structural pattern block (`trendStructure`, `nearSupport/nearResistance`, per-class booleans, `patternVersion`)
- ✓ Renders are deterministic for identical input
- ✓ Context flags are threaded through `backtest --record` and `benchmark probe`/`benchmark run`; invalid `--context` values are rejected

## Paired A/B analysis (`apps/benchmark abtest`) — M3.5

- ✓ Computes one block delta per contiguous block: control PnL / win rate / max drawdown, treatment values, and delta
- ✓ Paired bootstrap (seeded) yields deterministic mean + 95% CI per metric for the same inputs
- ✓ Matched-decision directional accuracy per arm (next candle moves in the action's direction)
- ✓ Exact two-sided binomial McNemar on discordant pairs (treatment-wrong/control-right and vice versa)
- ✓ Invalid probes mapped to `{action: hold, confidence: 0}` before scoring, matching the M8 score path
- Offline-only: no network in the analyzer or its tests

## Indodax live adapter (`packages/exchanges/indodax`) — M9

**`history_v2` public client**

- ✓ Parses a known raw `history_v2` response into `Candle[]`: `Time` (epoch seconds) → `timestamp` (ms), `Volume` (string) → `volume` number, `Open/High/Low/Close` mapped
- ✓ `tf` accepted as string (`"15"`) and number (`15`); supported resolutions match the charting datafeed (`1`,`5`,`15`,`30`,`h`,`2H`,`4H`,`D`,`3D`,`W`,`2W`,`1M`)
- ✓ Symbol ids come from the `search_v2` response `id` field (uppercase ticker, e.g. `BTCIDR`) — not the CCXT pair symbol
- ✓ Bars outside the requested `[from, to)` window are dropped; `[]` response → empty result (noData), no crash
- ✓ `pairs_v2` maps to `PairInfo`: `ticker_id`, `minNotional` (`trade_min_base_currency`), `minQuantity` (`trade_min_traded_currency`), `feeTaker`/`feeMaker`, `pricePrecision`, `isMaintenance`
- ✓ Non-200 / network failures throw a clear error (no silent empty array); retried per policy for transient statuses
- Tests inject the fetch function — no network in unit tests

**Dataset puller**

- ✓ Pulling a range writes a canonical dataset dir (`metadata.json` + `candles.jsonl`) readable by `JsonlLoader`
- ✓ Pulled candles pass `validateCandles(candles, interval)`; `metadata.checksum` equals `computeChecksum(candles)`
- ✓ Same server response → identical dataset bytes (deterministic)

**Clock sync**

- ✓ `skewMs = serverTime - localNow`; positive and negative skew handled
- ✓ Sync failure keeps the previous skew and does not crash
- ✓ Skew value is available to feed the clock-skew guardrail (`MarketState.clockSkewMs`)

**Budget caps + daily reset**

- ✓ `spend(notional)` under the configured daily IDR cap is allowed; spending past the cap → `canSpend` false (reject new positions)
- ✓ Daily spending resets at the WIB (Asia/Bangkok) day boundary, per the exchange clock
- ✓ NaN / negative spends are rejected, never accumulated

**Reconciliation + position ownership**

- ✓ Only orders whose `clientOrderId` carries this agent's prefix are owned; unowned open orders are never cancelled or counted
- ✓ Startup reconciliation rebuilds position state from exchange balances + open orders
- ✓ Periodic reconciliation picks up new fills and updates the position
- ✓ Simulated process restart → reconciled state has no leaked trades and no duplicate `clientOrderId`

**Signal-file control commands**

- ✓ `pause` file → loop skips new positions but keeps monitoring; `resume` → new positions allowed again
- ✓ `shutdown` file → loop exits cleanly with state flushed
- ✓ `status` request → writes a `status.json` with the last cycle's summary
- ✓ Missing/unparseable signal file → treated as no command, loop continues (no crash)

## Validation (`packages/core`)

- ✓ Accepts a well-formed `{action, confidence}` JSON object
- ✓ Rejects malformed JSON
- ✓ Rejects unknown `action` values (anything not `long|short|hold`)
- ✓ Rejects `confidence` outside [0,1], including NaN
- ✓ Rejects objects with missing required keys
- ✓ Rejects objects with extra/unexpected keys
- No exchange, no LLM, no network — pure functions only

## Risk engine (`packages/risk`)

**Position sizing**

- ✓ Given portfolio value + cash + configured % → returns exact expected position size
- ✓ Zero cash → returns zero position, never negative or NaN
- ✓ Respects exchange minimum notional / minimum order size (rejects or clamps, per config)

**ATR-based stop/take-profit**

- ✓ Given ATR value + multiplier → returns exact expected stop/TP price
- ✓ Handles the "insufficient ATR history" case from the indicator layer without crashing

**Kelly sizing (if implemented)**

- ✓ Given win rate + payoff ratio → returns expected fraction
- ✓ Never returns a fraction that would exceed configured max position

## Guardrails (`packages/guardrails`) — one test per rule, deterministic and boring

- ✓ Position at/above max % → reject
- ✓ Daily loss cap reached → reject all new positions
- ✓ Trades this hour ≥ max_trades_per_hour → reject
- ✓ Active cooldown → reject
- ✓ Confidence below configured minimum → reject
- ✓ Spread above configured maximum → reject
- ✓ Volume below configured minimum → reject
- ✓ ATR spike beyond threshold → reject
- ✓ Candle staleness beyond threshold → reject
- ✓ Clock skew beyond threshold → reject
- ✓ LLM latency beyond threshold → treat as hold, don't execute
- ✓ Exchange reports degraded/offline → reject
- ✓ Duplicate `clientOrderId` detected → reject, don't resubmit
- ✓ Insufficient balance for proposed size → reject
- ✓ Battery below 15% (Android) → reject new positions
- ✓ Missed heartbeat beyond threshold → reject new positions until heartbeat resumes

## Exchange contract (`packages/exchanges/indodax`)

- Mock CCXT responses — never mock your own wrapper around CCXT
- ✓ `fetchTicker()` → correct `InternalTicker` shape for a known raw response
- ✓ `fetchBalance()` → correct `InternalBalance` shape
- ✓ `createOrder()` → correct `InternalOrder` shape, `clientOrderId` round-trips correctly
- ✓ Retry policy: 429 → backoff and retry; 5xx → retry with backoff; timeout post-submit → look up by `clientOrderId`, never blind-retry; 401 → no retry, fatal; signature error → no retry, fatal
- ✓ Partial fill scenarios produce the configured behavior (cancel remainder / keep / replace)

## DecisionEngine contract (`packages/llm`)

Same fixture set run against every provider adapter — no duplicated tests per provider.

- ✓ Well-formed provider response → correctly parsed into `{action, confidence}`
- ✓ Malformed provider response → validation rejects it, doesn't crash the pipeline
- ✓ Timeout (configurable threshold) → treated as hold, logged, cycle continues
- ✓ Works identically regardless of which provider is configured (Anthropic, OpenRouter, Gemini, Groq, Ollama)

## Replay / golden datasets (`packages/datasets`)

- ✓ Given a fixed historical dataset + fixed recorded LLM decisions → replay produces the exact same trades, PnL, and guardrail outcomes every run
- ✓ CI fails if a change to indicators, risk, or guardrails changes the replay output for the golden dataset (this is the signal that something changed — it should be investigated, not silently accepted)

## Property tests (`tests/property/guardrails`)

Generate large volumes (100k+) of randomized proposed decisions (action, confidence, ATR, spread, latency, battery, position size) and assert, across all of them:

- ✓ Never a negative position size
- ✓ Never a NaN anywhere in the output
- ✓ Never exceeds configured max exposure
- ✓ Never a duplicate order for the same `clientOrderId`
- ✓ Never opens a position with zero available cash

## State machine transitions

- ✓ LLM timeout → validation and execution both skipped → notify → sleep (never silently hangs)
- ✓ Exchange 500 → retry → success → continue normally
- ✓ Exchange 401 → fatal → agent pauses, does not keep attempting requests
- ✓ Malformed LLM JSON → validation rejects → logged as rejection, not as an error that crashes the cycle

## Paper-mode end-to-end

Run 10,000 recorded historical candles through the full pipeline (paper exchange, real guardrails, real risk engine):

- ✓ No crash
- ✓ No NaN anywhere in output or logs
- ✓ No duplicate trades
- ✓ No leaked state between cycles
- ✓ Deterministic PnL — rerunning the same dataset produces the same result

## Android-specific

- ✓ Battery reported <15% → no new positions opened, existing positions still monitored
- ✓ Heartbeat missed beyond threshold → agent pauses new positions
- ✓ Wake lock lost → alert fires (via notification channel)
- ✓ Simulated process restart → reconciliation runs → state rebuilt from exchange → agent resumes correctly

## Benchmark (`apps/benchmark`)

M8. Runs the same recorded contexts (from M6/M7 datasets) through multiple provider/model configs and produces a comparable leaderboard. All probe/score/leaderboard logic is offline-testable with a fake engine — no network in tests.

**Context reuse**

- ✓ `buildDecisionSystemPrompt(symbol)` and `buildDecisionUserPrompt(candles)` (shared, in `packages/llm`) produce byte-identical prompts to the M7 `record` path (regression: recording behavior unchanged)

**Probe**

- ✓ `probeDecisions` returns exactly one `ProbeResult` per (recorded timestamp × repeat), with the context window derived from the dataset at that timestamp (same `lookback` as record)
- ✓ Valid engine response → `validJson: true`, `errorKind: null`, action and confidence recorded, no crash
- ✓ Malformed response (engine throws `DecisionError`) → `validJson: false`, `errorKind: 'malformed_json'`, action/confidence null, no crash
- ✓ Failed calls record a distinct `errorKind` from `classifyLlmError` (`timeout` / `rate_limited` / `malformed_json` / `http_error` / `network_error` / `fatal`) plus a truncated `errorMessage`, so rate-limits, timeouts and malformed output are not conflated
- ✓ `latencyMs` recorded (≥ 0) per request
- ✓ `costUsd` recorded per request (0 for free engines)
- ✓ `repeats: N` yields N results per timestamp (used by the consistency test)
- ✓ Unknown timestamp in the dataset → throws a clear error, no silent skip
- ✓ Deterministic except `latencyMs`: two runs with the same fake engine and dataset produce identical `validJson`/`errorKind`/action/confidence/costUsd

**Consistency test**

- ✓ A context whose repeats all returned the same valid action counts as consistent
- ✓ A context where any repeat failed to parse (invalid JSON/timeout) is inconsistent
- ✓ A context where repeats disagree on action is inconsistent
- ✓ `consistency` = consistent contexts / total contexts (0 if none)

**Score**

- ✓ Invalid probes map to `{action: hold, confidence: 0}` before replay (production `safeDecide` parity); the first probe per timestamp is what production would have used
- ✓ `winRate` = winning closes / closed trades (closes = trades with `realizedPnl !== 0`)
- ✓ `maxDrawdown` computed from the equity curve as the max peak-to-trough relative decline (0 when fewer than 2 points)
- ✓ Deterministic: same probes + dataset → identical score and BacktestEngine checksum

**BacktestEngine equity curve (M8 support)**

- ✓ Default (no flag): result has no `equityCurve`; golden replay checksum unchanged (regression)
- ✓ `collectEquity: true` → `equityCurve` has one `{timestamp, equity}` entry per candle, mark-to-market (`quoteFree + baseTotal*close`)
- ✓ Equity curve values are finite (no NaN)

**Leaderboard**

- ✓ Merges probe stats + score per provider into one row: `validJsonRate`, `meanLatencyMs`, `consistency`, `costUsd`, `winRate`, `realizedPnl`, `maxDrawdown`, `tradeCount`
- ✓ Rows sorted by `realizedPnl` desc, tie-break `validJsonRate` desc
- ✓ Same inputs → byte-identical JSON output (no timestamps in output)
- ✓ Provider with zero probes or zero valid decisions still appears with `winRate`/`consistency` = 0 rather than crashing

**DoD (adapted per decision — no paid provider available):** the `leaderboard run` command completes across ≥2 free models (gemini native + OpenRouter free) on the same recorded dataset and emits a comparable leaderboard; `costUsd` is 0 for free models and wired for future paid keys.

## M9 agent paper-mode E2E (10,000 real Indodax candles)

Runs the `apps/indodax-agent` paper-mode loop over the committed real Indodax dataset (`datasets/realistic/btc_idr_15m_2026`, 15m, real prices) with recorded decisions:

- ✓ Completes without crashing; **no NaN anywhere** in trades, PnL, balances, or outcomes
- ✓ No duplicate clientOrderIds across the whole run
- ✓ Deterministic: two runs on the same dataset + decisions produce identical trades, PnL, and checksum
- ✓ The run survives signal files mid-run (pause → resume → shutdown) and flushes state on the clean exit

## Evaluator (`apps/evaluator`) — M9.5

- ✓ Correctly aggregates win rate, PnL, guardrail-rejection rate, cost per trade, and confidence calibration from a fixed sample of JSONL logs (known expected output for a fixed input log set)
- ✓ Comparison against benchmark expectations produces the correct drift delta for a known input (no drift → reports no drift; injected drift → reports the correct magnitude)
- ✓ Pause-and-alert state fires only when the configured threshold is actually crossed, not on ordinary short-term noise — test both a false-positive case (small fluctuation, no alert) and a true-positive case (deliberately degraded win rate, alert fires)
- ✓ Read-only: running the evaluator against a log set never writes to runner state, guardrail config, or risk parameters — assert this explicitly with a test, don't just assume it from the design
- ✓ Runs correctly against an empty or partial log set (e.g. first day of a new deployment) without crashing
- ✓ Uses its own configured provider/model, independent of the runner's — changing the runner's model config must not silently change the evaluator's

## Runner decision logging + evaluator pause integration (M9.5)

- ✓ The runner writes one `decisions.jsonl` entry per decision cycle, with the fields the evaluator needs: `candleTimestamp` (tie-to-candle), pair, model, usage, latency, decision outcome, and the trades that executed in that cycle
- ✓ An active evaluator pause is honored by the runner: no trades execute, entries are tagged `pausedBy: "evaluator"`, and the pause is surfaced in `status.json`
- ✓ An expired or missing evaluator pause file is treated as "not paused" — the runner never crashes on it

## Definition of done (applies to every milestone in ROADMAP.md)

- 100% of that milestone's tests passing
- Zero TypeScript errors, zero lint errors
- CI green
- No `// TODO` left in code
- No duplicated logic that should have lived in a shared module
- Documentation for the milestone's public interfaces updated
