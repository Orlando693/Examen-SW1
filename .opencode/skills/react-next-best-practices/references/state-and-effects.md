# State And Effects

## React State

- Derive state during render when it can be calculated from props or existing state. Do not synchronize derived state through an effect.
- Use effects for synchronization with external systems, not for ordinary interaction logic or computed values.
- Keep effect dependencies narrow and correct. Avoid object or array dependencies recreated every render.
- Use functional state updates when the next value depends on the previous value.
- Move user-triggered logic into event handlers.
- Use refs for transient mutable values that should not cause rendering.
- Do not define component types inside other component render functions.
- Apply memoization only when measurement or an expensive calculation demonstrates value; do not use it by default.

## Zustand

- Select the smallest stable store slice required by a component.
- Avoid redundant store writes. An unchanged value should not create a new state update.
- Prevent store -> render -> effect -> store loops by deriving data during render or acting directly in event handlers.
- Keep domain state, including `ProjectDocument`, separate from UI-only state such as open panels, transient tools, and local focus.
- Preserve stable action references and do not subscribe to large state objects only to use them inside callbacks.
