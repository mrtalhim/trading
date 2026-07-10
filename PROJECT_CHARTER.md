# Project Charter

This is philosophy, not implementation detail. Read this when a decision isn't explicitly covered elsewhere in Vision, TDD, Roadmap, or the ADRs — it's the compass for those gaps.

- This project optimizes for correctness over speed.
- Every deterministic rule should live in code, not in a prompt. If a human could write the rule as an `if` statement, it does not belong in an LLM's judgment.
- Every behavioral change must be measurable through replay or benchmark — "it feels better" is not evidence.
- The same input must produce the same output, unless the configured model itself changes. Non-determinism should only ever enter through the LLM call, nowhere else.
- Components should be replaceable through interfaces rather than rewrites. If replacing the exchange or the LLM provider requires touching more than the adapter, the boundary was drawn in the wrong place.
- Simplicity is preferred over cleverness. If a JSONL file solves the problem, don't introduce a database. If a pure function solves the problem, don't introduce a class.
- Treat this as a production codebase maintained for years, not a coding exercise. Make small, verifiable changes. Prefer incremental commits over large rewrites.
- Do not begin implementing a milestone without first summarizing the plan and flagging anything unclear or missing from the spec — assumptions made silently are the main source of drift.
- Capital-protecting code (guardrails, risk math, validation) is held to a higher bar than everything else, because it is the last line of defense between a model's output and real money.

## Agent working rules

- Never duplicate logic that already exists in a shared module.
- Never leave a `// TODO` or stub implementation — either implement it or don't start it.
- Never skip tests to move faster on a milestone.
- Every public function needs a test.
- Every package must compile and type-check independently.
- Every adapter (exchange, LLM provider, notification channel) must satisfy its contract tests before being considered part of the build.
- Never introduce a dependency from a lower layer to a higher one (e.g. `packages/core` must never import from `apps/*`).
- Stay within the current milestone's scope (see ROADMAP.md) — do not touch packages reserved for a later milestone even if it seems convenient in the moment.
