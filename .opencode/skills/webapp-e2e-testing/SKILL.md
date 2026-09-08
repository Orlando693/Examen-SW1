---
name: webapp-e2e-testing
description: Use when implementing or fixing a web UI, responsive behavior, browser interaction, hydration, React Flow, screenshots, console investigation, manual acceptance, or Playwright E2E verification. Requires real-browser evidence before declaring frontend behavior complete.
---

# Web Application E2E Testing

Use this skill to verify browser-visible behavior. Passing unit tests, type checks, lint, builds, or an HTTP `200` does not demonstrate that a frontend is functional.

Use `react-next-best-practices` to guide a React/Next.js implementation. Use this skill to verify it in a real browser when browser automation is available.

## Required References

Read the relevant references before verification:

- `references/browser-test-workflow.md`
- `references/console-regressions.md`
- `references/responsive-testing.md` when layout can change by viewport
- `references/project-routes.md`

## Verification Standard

1. Identify the changed user behavior and observable acceptance result.
2. Follow the browser workflow, including browser console and page errors.
3. Test each relevant viewport and interaction path.
4. Report `PASS` or `FAIL` per scenario, with pending verification stated plainly.

Never describe browser behavior as verified based only on static checks or a successful HTTP response.

## Playwright Availability

Detect whether `playwright` or `@playwright/test` is available in the project before attempting browser automation. Prefer the project's installed version and its existing configuration.

Do not install Playwright just to satisfy this skill. If a future task requires E2E automation and Playwright is unavailable, explain that dependency decision before changing dependencies. If no real browser can run, state exactly: `Real browser verification remains pending.`

## Scope

Do not create testing infrastructure, scripts, or dependencies unless the active task needs them. Use the smallest reproducible browser workflow that can verify the behavior.

## Attribution

This local skill is an original, project-specific adaptation of concepts from Anthropic's `webapp-testing` skill:

- https://github.com/anthropics/skills
- https://github.com/anthropics/skills/blob/main/skills/webapp-testing/SKILL.md

The referenced Anthropic skill is licensed under Apache License 2.0. No large text blocks or helper scripts were copied.
