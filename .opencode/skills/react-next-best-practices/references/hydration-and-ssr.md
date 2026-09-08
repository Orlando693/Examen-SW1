# Hydration And SSR

The server HTML must match the first client render. A hydration warning is an upstream rendering defect until investigated.

## Rules

- Do not use `Date.now()`, `Math.random()`, or generated random IDs in SSR render output. Use deterministic demo IDs when SSR needs them.
- Do not branch on `typeof window` to emit incompatible server and client markup.
- Prefer responsive CSS when a breakpoint changes presentation only. Introduce JavaScript media-query logic only when behavior genuinely differs.
- Understand MUI `useMediaQuery` SSR behavior before using it to choose structural markup.
- Verify the MUI and Next App Router integration stays compatible with the project's existing setup.
- Do not use `suppressHydrationWarning` to hide an unexplained mismatch.
- Do not assume a library child caused the mismatch. Trace the server and first-client render decisions upstream.

## CU-02 Regression

CU-02 produced desktop server markup while the first client render chose mobile markup. That structural difference caused `Hydration failed`. The correction must preserve identical initial markup and apply responsive client behavior only after hydration when JavaScript behavior is necessary.
