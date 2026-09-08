# Handoff And Context

`docs/STATUS.md` is the concise project snapshot: active CU, completed CUs, open problems, current checks, and next action.

`docs/HANDOFF.md` is the exact continuation point: active CU/change, increment, finished and pending work, current errors, important decisions, current tests, and exact next action. Keep it operational, not historical.

The CU document records that CU's implementation and acceptance history. OpenSpec artifacts are the change contract. Avoid duplicating all details across them.

When a session becomes long or debugging is prolonged:

1. Update STATUS and HANDOFF truthfully.
2. Leave the active change coherent.
3. Start a fresh OpenCode session.
4. Reread those documents and the active artifacts.
5. Continue from the recorded next action.

Prefer a fresh session before starting a new CU. Never rely on remembered chat context instead of repository documents.
