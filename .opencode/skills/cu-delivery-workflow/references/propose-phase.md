# Propose Phase

Before `/opsx:propose`, read:

- `AGENTS.md`.
- `docs/product/product-01-next-nestjs.md`.
- `docs/puds/use-cases/README.md`.
- `docs/STATUS.md` and `docs/HANDOFF.md`.
- The target CU document.
- Related main OpenSpec specs and archived prior changes.
- Relevant existing code and tests.

## Required Proposal Content

Define the objective, in-scope behavior, out-of-scope behavior, prior-CU dependencies, architectural decisions, contracts, data implications, UI implications, security implications, testing strategy, acceptance evidence, documentation updates, and risks.

Keep the proposal aligned with the active CU. A prerequisite from a later CU must be the smallest documented dependency, not silent scope expansion.

## Decision Gate

If an important architectural, product, persistence, security, or UX decision is ambiguous, present bounded options and request the user's decision before apply. Do not implement while proposing.

After proposal artifacts exist, review their proposal, design, specs, and tasks together before `/opsx:apply`.
