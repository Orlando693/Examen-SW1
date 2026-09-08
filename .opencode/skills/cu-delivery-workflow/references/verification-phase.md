# Verification Phase

`/opsx:verify` is an evidence review, not another implementation phase. Compare tasks, proposal, design, specs, code, tests, documentation, acceptance evidence, repository hygiene, and actual scope.

Run OpenSpec checks from `C:\Orlando693\Examen-SW1` as applicable:

```powershell
openspec status --change "<change>"
openspec validate "<change>" --strict
git diff --check
```

Use the installed CLI's equivalent command if the requested OpenSpec command is unavailable; report the substitution and result.

## Required Output

Use this shape:

```text
Completeness
Correctness
BLOCKER
WARNING
Checks Passed
Final Assessment
BLOCKERS total: N
Ready for archive: YES/NO
```

`Ready for archive: YES` requires every applicable task and acceptance criterion to be evidenced, documentation to be factual, scope to be respected, and `BLOCKERS total: 0`.

If any blocker exists, do not archive. Fix it in the active change, update tasks/evidence, and rerun relevant verification.
