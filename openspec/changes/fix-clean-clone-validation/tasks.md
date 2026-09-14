## 1. Reproducible Workspace Validation

- [x] 1.1 Order the root typecheck script after UML core declaration generation and verify `npm run typecheck` passes with `packages/uml-core/dist` absent initially.

## 2. Stable Database Constraint Coverage

- [x] 2.1 Replace both message-based membership foreign-key deletion assertions with Prisma `P2003` assertions and verify the focused projects API integration test passes.
- [x] 2.2 Apply a suite-local timeout for the heavy UML editor jsdom tests and verify two consecutive 39/39 focused runs pass without changing the frontend-wide timeout.

## 3. Validation and Documentation

- [x] 3.1 Run root typecheck, lint, build, focal and full tests, Prisma generate/validate, and non-destructive DEV/TEST migrations; verify no schema or migration files changed.
- [x] 3.2 Verify the OpenSpec change strictly and record the completed reproducibility fix in STATUS and HANDOFF without modifying CU-05 documentation.
