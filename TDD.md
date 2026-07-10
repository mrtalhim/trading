# TDD.md — Acceptance Criteria by Feature

This is the law. A feature is done when its acceptance criteria pass as tests — not when code exists that looks plausible. Do not implement a feature before its acceptance criteria are written as failing tests.

---

## Indicators (`packages/indicators`)

**RSI14 / ATR14 / ADX14 / MACD / MA20 / MA50 / VWAP**

- ✓ Matches known reference values for a fixed sample dataset (e.g. cross-check a few points against TradingView or a trusted reference)
- ✓ Returns NaN / explicit "insufficient data" until enough candles exist, never a silently wrong number
- ✓ Deterministic: same input candles always produce the same output
- ✓ Feature-pipeline version is hashed and included in output metadata

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

## Guardrails (`apps/indodax-agent`) — one test per rule, deterministic and boring

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

## Definition of done (applies to every milestone in ROADMAP.md)

- 100% of that milestone's tests passing
- Zero TypeScript errors, zero lint errors
- CI green
- No `// TODO` left in code
- No duplicated logic that should have lived in a shared module
- Documentation for the milestone's public interfaces updated
