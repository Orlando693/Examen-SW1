# Archive And Git

Archive only after all tasks are complete, applicable acceptance is evidenced, `BLOCKERS total: 0`, and verification reports `Ready for archive: YES`.

During `/opsx:archive`:

1. Sync applicable main specs.
2. Move the completed change to the archive.
3. Update the CU document with actual outcome and known debt.
4. Update `docs/STATUS.md` and `docs/HANDOFF.md`.
5. Do not implement the next CU.

## Git Closure

From `C:\Orlando693\Examen-SW1` in PowerShell:

```powershell
git status --short --untracked-files=all
git diff --check
```

Review the files before staging. Do not stage `node_modules/`, `.next/`, `dist/`, `.env`, secrets, `*.tsbuildinfo`, caches, or temporary logs. Then stage deliberately:

```powershell
git add <reviewed-paths>
git status
git commit -m "<accurate CU closure message>"
git push
```

`git add .` is acceptable only after the review confirms every included path is intended. Closure requires a clean working tree. Prefer one coherent closure commit per CU; tooling skills may use separate coherent commits when appropriate.
