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
