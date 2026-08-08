# Architecture Decision Records

Read these before making a change that touches the choices below. If a decision needs to change, add a new ADR rather than silently drifting from it.

---

### ADR-001: TypeScript for the entire platform

**Decision**: TypeScript throughout, both packages and apps.
**Reason**: The surrounding ecosystem (OpenClaw, CCXT, Telegram bot libraries, Node, JSON Schema tooling) is already TS/JS-native. A single language avoids cross-language serialization overhead between the trading logic and the runtime it plugs into.
**Alternatives considered**: Python — rejected because it would require a separate bridge to OpenClaw/Node-based tooling, adding a layer of translation risk for no clear benefit here.

### ADR-002: pnpm workspace, no Nx/Turborepo

**Decision**: Simple `packages/` + `apps/` pnpm workspace.
**Reason**: The project doesn't yet have the scale (package count, build complexity) that justifies a heavier monorepo tool. Add one later if build times or dependency graphs actually demand it.

### ADR-003: LLM output limited to `{action, confidence}`

**Decision**: The LLM never outputs position size, stop-loss, or take-profit — only directional bias and a confidence score.
**Reason**: Determinism. Risk parameters must not vary between calls to a stochastic model. This also makes the decision contract simple enough to benchmark cleanly across providers.
**Alternatives considered**: Full risk-parameter output from the LLM — rejected as it couples capital risk directly to model output variance.

### ADR-004: JSONL for storage initially, no database

**Decision**: Logs, contexts, decisions, and fills are stored as JSONL files.
**Reason**: Simple, portable, human-inspectable, and sufficient at this data volume. Avoids operational overhead (schema migrations, a running DB process) on a phone-hosted deployment.
**Revisit when**: query patterns actually require it — DuckDB is the planned next step (SQL over local JSONL/Parquet, no server) before reaching for Postgres.

### ADR-005: Zod for all schema validation

**Decision**: Every boundary — exchange responses, LLM output, config files, logs — is parsed through a Zod schema into a typed object.
**Reason**: A single validation approach across the codebase, consistent error messages, and compile-time type inference from the same schema used at runtime.

### ADR-006: Provider-agnostic LLM layer

**Decision**: `packages/llm` defines a `DecisionEngine` interface; Anthropic, Gemini, OpenRouter, Groq, and Ollama are adapters behind it, selected via config.
**Reason**: No permanent dependency on one vendor's pricing or availability; enables the benchmark app to compare models on identical data and pick the cheapest adequate one.

### ADR-007: Guardrails and risk logic built and tested before the LLM layer

**Decision**: Build order is validation → risk → guardrails → exchange contract → LLM → replay → paper E2E → Android (see ROADMAP.md).
**Reason**: The deterministic, capital-protecting code is the part that must be correct with the highest confidence, and it's fully testable without any LLM or live exchange in the loop. Building it first also means the LLM layer, once added, is constrained by an already-tested safety net rather than being trusted by default.

### ADR-008: Self-implemented indicators, not third-party TA libraries

**Decision**: RSI, ATR, EMA, SMA, ADX, VWAP implemented directly in `packages/indicators`.
**Reason**: Many npm TA libraries are unmaintained; owning the implementation means the exact calculation is known, versionable, and testable against a fixed reference, which matters for reproducible backtests.

### ADR-009: OpenClaw (or any runtime) is a frontend, not the platform

**Decision**: Business logic in `packages/*` and `apps/indodax-agent` must be callable independent of OpenClaw specifically.
**Reason**: Avoids coupling core trading/risk logic to one agent framework's lifecycle or config format; keeps the option open to expose the same logic via a CLI or REST API later.

### ADR-011: Guardrails live in `packages/guardrails`, not in an app

**Decision**: The guardrail rule set is implemented as a pure, deterministic module in `packages/guardrails`. It depends only on `@trading/core` (type-only) and consumes risk-engine output (e.g. proposed position size) through its input context. It is **not** placed inside `apps/indodax-agent`.

**Reason**: `apps/backtest` and `apps/benchmark` must reuse the exact same guardrail logic the live agent uses — duplicating that logic across apps is explicitly forbidden (PROJECT_CHARTER: "Never duplicate logic that already exists in a shared module"). If guardrails lived in `apps/indodax-agent`, `apps/backtest` would have to import from another app, which violates the dependency-direction rule in VISION.md (apps depend on packages, never on each other). A pure module in `packages/` matches the shape of `packages/risk` (pure, deterministic, reusable). This corrects the literal module path written in TDD.md; the roadmap description ("a pure, deterministic module") and the architecture principle stand unchanged.

**Alternatives considered**: Guardrails inside `apps/indodax-agent` — rejected because it forces cross-app imports and would duplicate capital-protecting logic across apps.

### ADR-013: Pattern-detection in `packages/indicators`, delivered through the LLM prompt, gated by a pre-committed A/B

**Decision**: Candlestick pattern detection (single/double/triple-candle detectors plus structural trend/support-resistance) lives inside `packages/indicators` as pure, versioned, deterministic modules — not in a separate `packages/patterns` package. It reaches the trading loop only through the LLM prompt (`buildPatternBlock` → `contextOptionsFor`), selected via a `--context` flag threaded through `backtest --record` and `benchmark probe`/`run`. It is **not** a FeatureRow/FeaturePipeline column, and the FeatureRow schema, feature checksums, and golden replay baselines are untouched.

**Reason** (this intentionally corrects the earlier addendum plan which proposed a separate `packages/patterns`): the work is candle-geometry only — no new inputs to a feature pipeline, no matrix shape, no per-window compositional versioning — so it belongs with the other self-implemented deterministic indicators. Housing it in `indicators` (ADR-008) keeps one home for determinism, versioning and known-implementation guarantees. Keeping it prompt-only keeps the FeaturePipeline and its checksums untouched and makes the change trivially reversible, which matters because the value is unproven.

**A/B experiment, not permanent architecture (per PROJECT_CHARTER simplicity rule)**: the pattern block ships behind `--context=patterns` next to a candle-only `baseline` and `indicators`-only variant. `benchmark abtest` does a paired block-bootstrap of control vs treatment PnL/win-rate/max-drawdown with pre-committed verdict thresholds (ROADMAP.md M3.5 decision rule). Win rate is the pre-committed primary metric; one pass per model, no re-runs against tweaked definitions unless an effect is already statistically credible.

**Alternatives considered**:
- Separate `packages/patterns` (original addendum plan) — the user corrected this; rejected above.
- Feature-pipeline integration (pattern booleans as FeatureRow columns) — rejected: changes feature checksums and triggers a golden baseline rebuild, plus it bakes unproven signal into the deterministic scoring path where it cannot be A/B-tested cheaply.

### ADR-012: Indodax historical candles come from `/tradingview/history_v2`, not trade aggregation

**Decision**: When building the realistic Indodax dataset (M9), fetch historical OHLC directly from Indodax's public, TradingView-compatible endpoint `/tradingview/history_v2?from={timestamp}&symbol={symbol}&tf={minutes}&to={timestamp}` (e.g. `symbol=BTCIDR`, `tf` = timeframe in minutes). The `symbol` is the **uppercase** pair id returned by `/tradingview/search_v2` (`id`, e.g. `BTCIDR`) — not the lowercase `base_currency_traded_currency` form (`.btc_idr` / `btc_idr` do **not** resolve). `tf` is accepted as a number or string; bars come back as `{Time (epoch seconds), Open, High, Low, Close, Volume (string)}` and `[]` means no data in range. Do **not** reconstruct candles from raw `/api/trades`.

**Reason**: The endpoint already returns OHLC for a given pair/timeframe/date range. Rebuilding candles from trade prints (aggregation logic, gap handling in trade data, volume-weighting) is materially more work for the same result. An earlier analysis incorrectly concluded Indodax had no public candlestick endpoint (it only noted `/api/ticker`, `/api/trades`, `/api/depth`); the TradingView history endpoint was missed. This corrects that conclusion.

**Alternatives considered**: Aggregating `/api/trades` into candles — rejected as unnecessary effort given a native candle endpoint exists.

**Operational note**: Before writing a parser around this endpoint, hit it directly with `curl` for a known recent range and confirm the real response shape — field names, and whether `tf` is passed as a number or a string. Verify against live data rather than assuming; a five-minute manual look beats discovering a field-name mismatch three files deep.

### ADR-014: Evaluator reads runner `decisions.jsonl` via DuckDB; pause is a persistent file, review is freeform prose

**Decision**: The evaluator (`apps/evaluator`) is a read-only, independently-scheduled consumer of the runner's decision log. The runner writes one line per decision cycle to `decisions.jsonl` (`packages/storage`, `DecisionLogStore`), keyed by `candleTimestamp`. The evaluator queries that log through DuckDB (`@duckdb/node-api`, `read_json_auto` + SQL window filter), default `metricsSource: 'duckdb'`, with a `js` source for parity testing. Drift against pre-committed `benchmarks` in the evaluator config (not the runner's) is purely numeric and deterministic. When drift crosses a threshold, the evaluator writes a persistent `evaluator-pause.json` into the runner's `runDir` (distinct from the one-shot `command.json`); the runner re-checks it on its command cadence, treats missing/expired files as "not paused", and tags affected cycles `pausedBy: "evaluator"`. A separate optional LLM review (`ReviewEngine` in `packages/llm`) produces freeform prose only — it never gates the pause and never emits `{action, confidence}`.

**Reason**: ADR-004 kept JSONL as the write-side format; DuckDB is exactly the "planned next step" it named — SQL over local JSONL with no server — and it stays on the read side so the runner's write path stays dependency-free and deterministic. The `{action, confidence}` rule (ADR-003) constrains action decisions, not evaluator reviews: the review's output is analysis for humans, and capital decisions stay deterministic. Cost accounting lives in the evaluator config (`costModels`) with a fallback to `packages/llm` presets because the evaluator owns its own model choice and must not drift with the runner's. The persistent pause file exists because a drift-triggered stop must survive restarts and be visible in `status.json`, unlike the transient command channel.

**Alternatives considered**: DuckDB as the storage format itself — rejected, the JSONL logs remain the source of truth (human-inspectable, tolerant, ADR-004). Evaluator as a module inside `apps/indodax-agent` — rejected, it must stay independently scheduled and provider-independent (own LLM config) so a drift problem can be examined without a running agent. LLM-determined pause — rejected, drift thresholds are deterministic and pre-committed.

### ADR-010: Dataset-driven architecture

**Decision**: All data-consuming components (indicators, features, risk, LLM context, backtest, benchmark) receive data through a `Dataset` interface rather than direct file reads or live API calls.
**Reason**: Decouples the development and testing of every component from any specific data source. Indicators don't know if data came from Binance, a CSV file, or a live websocket. This makes the entire pipeline testable offline against golden datasets, replayable for regression, and benchmarkable across providers without any exchange connection.
**Alternatives considered**: Direct `Candle[]` injection — rejected because it doesn't support streaming (AsyncIterable) or metadata-rich datasets (ticker, orderbook, trades). CCXT-first data loading — rejected because it couples the data layer to a specific exchange library, defeating the purpose of data-source agnosticism.
