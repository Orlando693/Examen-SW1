# Known Project Debt

Classify against evidence, not merely console presence.

| Finding | Baseline classification | Audit treatment |
| --- | --- | --- |
| `favicon.ico` returns 404 | SUGGESTION | Record if it affects perceived quality or deployment completeness. |
| MUI Drawer `aria-hidden` / retained-focus Chrome warning | WARNING | Reproduce, inspect focus movement, and escalate to BLOCKER only if keyboard or assistive-tech access fails. |
| Accessibility refinement remains pending | WARNING | Audit changed flows; do not claim complete accessibility without evidence. |
| CU-02 responsive history | WARNING | Recheck desktop/tablet/mobile and canvas hydration when responsive editor code changes. |

Not every console warning is a blocker. Severity depends on user impact, reproducibility, and whether it violates a required interaction or acceptance path.
