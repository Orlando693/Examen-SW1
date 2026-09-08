# Apply Phase

During `/opsx:apply`:

- Implement only the active CU/change and follow its proposal, design, specs, and tasks.
- Preserve established sources of truth and architectural contracts.
- Do not silently broaden scope or implement future CUs.
- Update OpenSpec tasks as work actually completes.
- Add relevant automated tests.
- Update CU documentation and state documents when implementation state changes.
- Run relevant checks for affected workspaces.

Detect affected workspaces rather than assuming every CU has identical commands. The current baseline may include:

```powershell
npm run test
npm run typecheck
npm run lint
npm run build
npm run test --workspace frontend
npm run typecheck --workspace frontend
npm run lint --workspace frontend
npm run build --workspace frontend
```

Use equivalent backend or package commands when those workspaces are affected. Avoid expensive checks with no relevance, but never omit relevant checks.

## Boundaries

Do not archive, commit, or push during apply unless the user explicitly instructs a CU closure. A bug reported while the CU is active belongs to the same OpenSpec change: add corrective tasks, fix it, and reverify. Do not create a second CU or change for an in-scope correction.
