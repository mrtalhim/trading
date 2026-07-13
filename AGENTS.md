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
| `packages/guardrails`    | Pure, deterministic guardrail rule set (depends on `core`; consumed by all apps)     |
| `packages/llm`           | `DecisionEngine` interface + provider adapters                                       |
| `packages/exchanges`     | `indodax/`, `paper/`                                                                 |
| `packages/notifications` | Telegram/WhatsApp/Discord                                                            |
| `packages/storage`       | JSONL now, DuckDB later                                                              |
| `packages/datasets`      | Record/version/replay for golden datasets                                            |
| `packages/features`      | Feature pipeline consuming `Dataset` (indicators per-window, versioned)              |
| `packages/android`       | Termux/proot deployment, device health                                               |
| `apps/indodax-agent`     | The live/paper trading runtime                                                       |
| `apps/backtest`          | Record/replay                                                                        |
| `apps/benchmark`         | Multi-model leaderboard                                                              |
| `tests/`                 | unit/, integration/, contracts/, property/, replay/, e2e/ — mirrors the architecture |

## If you're an agent picking up mid-project

Check CI status and the last milestone marked done in ROADMAP.md before assuming where the project is. Don't trust an in-progress branch's state over what CI says actually passes.
