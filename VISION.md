# Vision — Decision Platform

## What this is

A layered, provider-agnostic decision-making platform. The Indodax crypto trading agent is the first application built on it — not the platform itself. The architecture should support swapping the exchange, the asset class, or the decision domain later without rewriting the core.

## Goals

1. Make trading decisions on Indodax (spot, IDR pairs) using an LLM for directional bias, with all risk management handled deterministically in code.
2. Run entirely on an Android phone (Termux + proot-distro), 24/7, with no VPS.
3. Make every decision reproducible and auditable — same input, same output, unless the configured model itself changes.
4. Make the LLM provider swappable without touching business logic, so models can be benchmarked and the cheapest adequate one used.

## Principles

- **The LLM decides direction. Code decides risk.** Output contract is `{action: long|short|hold, confidence}` — nothing else. Position sizing, stop-loss, and take-profit are deterministic strategy code, never LLM output, because risk parameters should not vary between calls to a stochastic model.
- **Every deterministic rule lives in code, not in a prompt.** If a rule can be expressed as a guardrail function, it must be, not left to the LLM's judgment.
- **Layers depend downward only.** `core` has zero dependencies. Adapters (exchanges, LLM providers, notifications, storage) plug into interfaces core defines. Nothing in `core` knows Indodax, Telegram, Claude, or Android exist.
- **Replaceable through interfaces, not rewrites.** Any exchange, provider, or notification channel should be swappable via config.
- **Simplicity over cleverness.** JSONL before a database. Pure functions before classes. Don't build for scale you don't have yet.
- **Correctness over speed.** Guardrails, risk math, and validation are built and fully tested before the LLM layer is wired in at all.

## Architecture (layers)

```
Application     → apps/indodax-agent, apps/backtest, apps/benchmark, apps/cli
Strategy        → packages/risk (sizing/stop/TP strategies — LLM-direction is just one input)
Plugins         → packages/llm, packages/exchanges, packages/notifications, packages/storage
Core            → packages/core (Decision, State Machine, Interfaces, Schemas) — zero deps
```

OpenClaw (or any other runtime) is a frontend on top of this platform, not the platform itself. The business logic must be callable from a CLI, REST endpoint, or different runtime without modification.

## Constraints

- Trade-only Indodax API key, no withdraw permission, ever.
- Paper mode is the default. Live trading requires three independent, explicit confirmations (config flag + CLI flag + env var).
- No trade executes without passing validation → risk engine → guardrails, in that order.
- Phone-hosted: must survive reboots, battery events, and connectivity loss without corrupting state — startup and periodic reconciliation against the exchange are mandatory, not optional.

## Explicitly out of scope for now

- Other exchanges (Binance, Bybit) — the `exchanges` interface should support them later, but only Indodax gets implemented now.
- Other asset classes (stocks, forex) — architecture should not preclude this, but nothing gets built for it yet.
- A dashboard UI — CLI and chat notifications are sufficient for v1.

This document does not change as implementation proceeds. If something here needs to change, that's a signal to stop and reconsider, not to quietly drift.
