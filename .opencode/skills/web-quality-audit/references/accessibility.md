# Accessibility

- Prefer semantic HTML before ARIA. Do not use ARIA to repair incorrect native structure.
- Give every interactive control an accessible name. Icon-only controls need explicit text alternatives.
- Verify text and essential state contrast; do not communicate state by color alone.
- Use appropriate Dialog and Drawer semantics through MUI, including understandable titles, labels, close controls, and disabled states.
- Keep screen reader output concise and meaningful for canvas tools, relationship modes, diagnostics, and property controls.
- Announce important async feedback, validation, and operational errors accessibly when users need to know it changed.
- Decorative content may be hidden from assistive technology; meaningful diagrams and controls must not be.
