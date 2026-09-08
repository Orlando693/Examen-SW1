# Forms And Feedback

Apply these rules to the Inspector and Property Sheet while preserving their technical-editor character.

- Every editable field has a visible or programmatic label and a logical group.
- Validation errors identify the affected field and give an actionable correction.
- Loading and disabled states explain why an action is unavailable. Keep the action label visible when loading.
- Support expected keyboard submission, navigation, and cancellation behavior where the control is not a free-form editor.
- Treat destructive actions deliberately: confirmation, undo, or another safe recovery path when the command warrants it.
- Give immediate, accessible feedback for command success/failure without obscuring canvas work.
- Do not replace dense technical property editing with generic dashboard cards merely to satisfy form conventions.
