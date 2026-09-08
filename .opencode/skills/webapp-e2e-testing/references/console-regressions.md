# Console Regressions

Classify browser findings by impact. Do not declare every warning a blocker, but do not ignore errors that invalidate the user scenario.

## BLOCKER

- `Maximum update depth exceeded`: indicates a render, effect, or store update loop. The affected scenario fails until resolved.
- React Flow error `#004`: commonly means React Flow mounted without a measurable container. The canvas scenario fails until its host has real dimensions and the error is absent.
- `Hydration failed` or a server/client markup mismatch: investigate the upstream rendering decision. Do not blame a child library without evidence.
- Duplicate React keys: unstable reconciliation can corrupt visible lists and must be corrected with stable IDs.
- Uncaught page errors or console errors that prevent an affected interaction from completing.

## WARNING

- `Blocked aria-hidden on an element because its descendant retained focus`: inspect MUI Drawer/dialog focus behavior and assess keyboard impact. It is not automatically a functional blocker, but should not be dismissed.
- Failed requests, accessibility warnings, or layout warnings that do not block the scenario but affect quality or future reliability.

## INFO

- A missing `favicon.ico` returning 404 is a minor issue unless the task concerns assets or request cleanliness.
- Development-only noise that has no effect on the tested scenario should be recorded only when relevant.

## Project Lessons From CU-02

- HMR is not acceptance: reload behavior and live edits do not prove a clean initial browser session.
- `GET /editor 200` is not a functional application: it does not inspect hydration, React Flow sizing, console output, focus, or interactions.
- Repeat validation after a full reload when investigating hydration or initialization regressions.
