# Browser Test Workflow

## Goal

Verify observable user behavior in a real browser. `GET /editor 200` proves only that Next.js returned a response; it does not prove hydration, layout, interactions, React Flow, or console health.

## Workflow

1. Identify the routes and concrete scenarios affected by the task.
2. Identify every required server, such as the Next.js frontend and any backend endpoint used by the scenario.
3. Start servers in a controlled way using existing project commands. Record ports and avoid reusing an unrelated process.
4. Wait for actual readiness: the intended route must load and required API dependencies must be reachable. Do not treat process startup alone as readiness.
5. Detect project Playwright availability. When available, launch a real Chromium browser through the project installation and navigate to the route. Otherwise, do not claim automation occurred.
6. Interact through the user path using stable, rendered selectors: click, type, select, drag, open drawers, and use keyboard actions as relevant.
7. Assert observable results, not implementation details: visible state, enabled controls, persisted feedback, canvas behavior, or navigation.
8. Capture browser console messages throughout the scenario and classify findings using `console-regressions.md`.
9. Capture uncaught page errors and failed browser requests relevant to the scenario.
10. Capture a screenshot when it helps review a visual state, regression, responsive layout, or failure.
11. Run responsive scenarios when the route or behavior is viewport-sensitive.
12. Stop only the server processes started for the verification.
13. Report each scenario as `PASS` or `FAIL`, list console/page-error findings, and state any unverified behavior.

## Evidence Rules

- HTTP 200 is not UI correctness.
- HMR success is not acceptance.
- A screenshot is supporting evidence, not a substitute for interaction assertions.
- If real browser automation cannot run, state: `Real browser verification remains pending.`
