# Focus And Keyboard

- Use visible, unobscured `:focus-visible` indicators. Toolbars and dense editor controls must remain keyboard navigable.
- Follow expected keyboard behavior for dialogs and drawers: focus moves in on open, remains appropriately contained, `Escape` closes when safe, and focus restores to a meaningful invoker or canvas target.
- Do not leave focus in content that becomes hidden, `aria-hidden`, or inert. Inspect the accessibility tree when warnings occur.
- Provide keyboard-accessible alternatives for non-essential drag, gesture, pan, or path-based operations.
- Ensure active relation mode can be cancelled from the keyboard and communicates its state.

## Current Debt

Chrome has reported: `Blocked aria-hidden on an element because its descendant retained focus` when a MUI Drawer is used. Treat this as an audit target in future refinements. It is not automatically a blocker without demonstrated user impact, but it must not be suppressed.
