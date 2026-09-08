# Rendering Performance

Prioritize changes that affect this project's interactive editor and Next.js rendering path.

## Server And Data Flow

- Avoid sequential awaits for independent work; start independent requests together.
- Minimize data serialized from Server Components to Client Components.
- Avoid module-level mutable request state in server-rendered code.
- Defer non-critical work rather than blocking the initial render.

## Client Rendering

- Keep expensive canvas or list work out of unrelated renders.
- Use `startTransition` for non-urgent updates when it improves interaction responsiveness.
- Use `useDeferredValue` when an expensive view should lag behind direct input; verify that it improves the scenario before adding it.
- Prefer direct, statically analyzable imports. Dynamically import a heavy, non-critical client feature only when it materially improves initial load.
- Avoid broad barrel imports and avoid adding client dependencies to a server path without need.

Measure before adding complexity. Correctness, stable rendering, and maintainable component boundaries take priority over speculative micro-optimizations.
